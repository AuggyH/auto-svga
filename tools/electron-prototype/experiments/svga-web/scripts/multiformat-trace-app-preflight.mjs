import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const traceRunId = "runtime-discriminator-018";
export const traceBundleIdentifier = "local.auto-svga.multiformat-trace.runtime-discriminator-018";
export const traceHelperBundleIdentifier = `${traceBundleIdentifier}.helper`;
export const traceAppPath = "/private/tmp/Auto SVGA Multi-format Trace 018.app";
export const traceSyntheticLottiePath = "/private/tmp/auto-svga-multiformat-trace-runtime-discriminator-018-lottie.json";
export const traceOutputPath = `/private/tmp/auto-svga-multiformat-trace-${traceRunId}.jsonl`;
export const traceMarkerFile = "auto-svga-multiformat-trace-run-id";

const scriptPath = fileURLToPath(import.meta.url);
const experimentRoot = path.resolve(path.dirname(scriptPath), "..");

function plistValue(plistPath, keyPath) {
  return execFileSync("/usr/libexec/PlistBuddy", ["-c", `Print :${keyPath}`, plistPath], {
    cwd: experimentRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

async function helperInfoPlists(appBundle) {
  const frameworksPath = path.join(appBundle, "Contents/Frameworks");
  const entries = await readdir(frameworksPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && /^Auto SVGA Helper(?: |\.app|\()/u.test(entry.name))
    .map((entry) => path.join(frameworksPath, entry.name, "Contents/Info.plist"))
    .filter((plistPath) => existsSync(plistPath))
    .sort();
}

export async function readTraceAppPreflight(appBundle = traceAppPath) {
  const mainInfoPlist = path.join(appBundle, "Contents/Info.plist");
  const executablePath = path.join(appBundle, "Contents/MacOS", plistValue(mainInfoPlist, "CFBundleExecutable"));
  const asarPath = path.join(appBundle, "Contents/Resources/app.asar");
  const markerPath = path.join(appBundle, "Contents/Resources", traceMarkerFile);
  const mainBundleIdentifier = plistValue(mainInfoPlist, "CFBundleIdentifier");
  const helperPlists = await helperInfoPlists(appBundle);
  const helperBundleIdentifiers = helperPlists.map((plistPath) => ({
    plistPath,
    bundleIdentifier: plistValue(plistPath, "CFBundleIdentifier"),
    executable: plistValue(plistPath, "CFBundleExecutable")
  }));
  const asarHeaderHash = await readAsarHeaderHash(asarPath);
  const expectedAsarHeaderHash = plistValue(mainInfoPlist, "ElectronAsarIntegrity:Resources/app.asar:hash");
  const marker = existsSync(markerPath) ? (await readFile(markerPath, "utf8")).trim() : "";
  const quarantine = readXattr(appBundle).includes("com.apple.quarantine");
  const criticalPathKinds = await criticalPathReport([
    appBundle,
    path.join(appBundle, "Contents"),
    executablePath,
    asarPath,
    markerPath,
    ...helperPlists
  ]);

  return {
    appBundle,
    mainInfoPlist,
    executablePath,
    asarPath,
    markerPath,
    mainBundleIdentifier,
    helperBundleIdentifiers,
    asarHeaderHash,
    expectedAsarHeaderHash,
    marker,
    quarantine,
    criticalPathKinds
  };
}

export async function assertTraceAppPreflight(appBundle = traceAppPath, options = {}) {
  const expectedBundleIdentifier = options.expectedBundleIdentifier ?? traceBundleIdentifier;
  const expectedHelperBundleIdentifier = options.expectedHelperBundleIdentifier ?? traceHelperBundleIdentifier;
  const expectedRunId = options.expectedRunId ?? traceRunId;
  const preflight = await readTraceAppPreflight(appBundle);
  const findings = [];

  if (preflight.mainBundleIdentifier !== expectedBundleIdentifier) {
    findings.push(`main bundle id ${preflight.mainBundleIdentifier} does not match ${expectedBundleIdentifier}`);
  }
  if (preflight.helperBundleIdentifiers.length !== 4) {
    findings.push(`expected 4 Electron helper app identities, found ${preflight.helperBundleIdentifiers.length}`);
  }
  for (const helper of preflight.helperBundleIdentifiers) {
    if (helper.bundleIdentifier !== expectedHelperBundleIdentifier) {
      findings.push(`helper ${path.basename(path.dirname(path.dirname(helper.plistPath)))} bundle id ${helper.bundleIdentifier} does not match ${expectedHelperBundleIdentifier}`);
    }
  }
  if (preflight.asarHeaderHash !== preflight.expectedAsarHeaderHash) {
    findings.push(`app.asar header hash ${preflight.asarHeaderHash} does not match Info.plist ${preflight.expectedAsarHeaderHash}`);
  }
  if (preflight.marker !== expectedRunId) {
    findings.push(`trace marker ${preflight.marker || "missing"} does not match ${expectedRunId}`);
  }
  if (preflight.quarantine) {
    findings.push("app bundle has com.apple.quarantine xattr");
  }
  for (const item of preflight.criticalPathKinds) {
    if (item.missing) findings.push(`missing critical path ${item.path}`);
    if (item.symlink) findings.push(`critical path is a symlink ${item.path}`);
  }

  return {
    ...preflight,
    passed: findings.length === 0,
    findings
  };
}

async function readAsarHeaderHash(asarPath) {
  const buffer = await readFile(asarPath);
  if (buffer.length < 16) throw new Error("app.asar is too small");
  const headerSize = buffer.readUInt32LE(12);
  const headerStart = 16;
  const headerEnd = headerStart + headerSize;
  if (headerSize <= 0 || headerEnd > buffer.length) {
    throw new Error(`invalid app.asar header size ${headerSize}`);
  }
  const header = buffer.subarray(headerStart, headerEnd);
  if (header[0] !== 0x7b) throw new Error("app.asar header does not start with JSON");
  return createHash("sha256").update(header).digest("hex");
}

function readXattr(appBundle) {
  try {
    return execFileSync("xattr", ["-lr", appBundle], {
      cwd: experimentRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    return error?.stdout?.toString?.() ?? "";
  }
}

async function criticalPathReport(paths) {
  const report = [];
  for (const itemPath of paths) {
    try {
      const stats = await lstat(itemPath);
      report.push({
        path: itemPath,
        missing: false,
        symlink: stats.isSymbolicLink(),
        mode: stats.mode
      });
    } catch {
      report.push({
        path: itemPath,
        missing: true,
        symlink: false,
        mode: null
      });
    }
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const appBundle = process.argv[2] || traceAppPath;
  assertTraceAppPreflight(appBundle).then((result) => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.passed) process.exitCode = 1;
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
