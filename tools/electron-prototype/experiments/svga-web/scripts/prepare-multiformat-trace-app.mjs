import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertPackagedRuntimeClosure,
  macosPackagerArgs
} from "./macos-package-proof.mjs";
import {
  assertTraceAppPreflight,
  traceAppPath,
  traceBundleIdentifier,
  traceHelperBundleIdentifier,
  traceMarkerFile,
  traceRunId,
  traceSyntheticLottiePath
} from "./multiformat-trace-app-preflight.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const experimentRoot = path.resolve(path.dirname(scriptPath), "..");
const repoRoot = path.resolve(experimentRoot, "../../../..");
const outputRoot = "/private/tmp/auto-svga-multiformat-trace-runtime-discriminator-018-package";
const packagedDirectory = path.join(outputRoot, "Auto SVGA-darwin-arm64");
const packagedApp = path.join(packagedDirectory, "Auto SVGA.app");
const runtimeBuildInfoPath = path.join(experimentRoot, ".runtime/build-info.json");
const packagedAsarPath = path.join(traceAppPath, "Contents/Resources/app.asar");
const traceMarkerPath = path.join(traceAppPath, "Contents/Resources", traceMarkerFile);

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: options.cwd ?? experimentRoot,
    stdio: options.stdio ?? "inherit",
    env: options.env ?? process.env
  });
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function writeRuntimeBuildInfo(buildCommit) {
  const buildInfo = {
    schemaVersion: 1,
    buildCommit,
    productMilestoneId: "0.2-multiformat-preview",
    source: "package-internal-trial"
  };
  await writeFile(runtimeBuildInfoPath, `${JSON.stringify(buildInfo, null, 2)}\n`);
}

async function writeSyntheticLottie() {
  const document = {
    v: "5.7.4",
    fr: 24,
    ip: 0,
    op: 48,
    w: 120,
    h: 120,
    nm: "runtime-discriminator-018",
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: "shape",
        ks: {
          o: { k: 100 },
          r: { k: 0 },
          p: { k: [60, 60, 0] },
          a: { k: [0, 0, 0] },
          s: { k: [100, 100, 100] }
        },
        shapes: [
          {
            ty: "el",
            p: { k: [0, 0] },
            s: { k: [48, 48] },
            nm: "ellipse"
          },
          {
            ty: "fl",
            c: { k: [0.1, 0.45, 0.8, 1] },
            o: { k: 100 },
            nm: "fill"
          }
        ],
        ip: 0,
        op: 48,
        st: 0,
        bm: 0
      }
    ]
  };
  await writeFile(traceSyntheticLottiePath, `${JSON.stringify(document)}\n`, { mode: 0o600 });
}

async function findCachedElectronZip() {
  const versionPath = path.join(experimentRoot, "../../node_modules/electron/dist/version");
  if (!existsSync(versionPath)) return undefined;
  const electronVersion = (await readFile(versionPath, "utf8")).trim();
  const zipName = `electron-v${electronVersion}-darwin-arm64.zip`;
  const roots = [
    process.env.ELECTRON_CACHE,
    process.env.HOME ? path.join(process.env.HOME, "Library/Caches/electron") : undefined,
    process.env.XDG_CACHE_HOME ? path.join(process.env.XDG_CACHE_HOME, "electron") : undefined
  ].filter(Boolean);

  for (const root of roots) {
    if (!existsSync(root)) continue;
    const entries = await import("node:fs/promises").then((fs) => fs.readdir(root, { withFileTypes: true }));
    for (const entry of entries) {
      const candidate = entry.isDirectory() ? path.join(root, entry.name, zipName) : path.join(root, entry.name);
      if (path.basename(candidate) === zipName && existsSync(candidate)) return path.dirname(candidate);
    }
  }
  return undefined;
}

async function main() {
  const buildCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8"
  }).trim();

  await rm(outputRoot, { recursive: true, force: true });
  await rm(traceAppPath, { recursive: true, force: true });
  await rm(`/private/tmp/auto-svga-multiformat-trace-${traceRunId}.jsonl`, { force: true });
  await mkdir(outputRoot, { recursive: true });

  run("npm", ["run", "spike:svga-web:prepare"]);
  await writeRuntimeBuildInfo(buildCommit);

  const cachedElectronZipDir = await findCachedElectronZip();
  const packagerArgs = [
    ...macosPackagerArgs(outputRoot).map((arg) => (
      arg.startsWith("--app-bundle-id=") ? `--app-bundle-id=${traceBundleIdentifier}` : arg
    )),
    `--helper-bundle-id=${traceHelperBundleIdentifier}`
  ];
  if (cachedElectronZipDir) packagerArgs.push(`--electron-zip-dir=${cachedElectronZipDir}`);
  run("../../node_modules/.bin/electron-packager", packagerArgs);

  run("/usr/bin/ditto", [packagedApp, traceAppPath]);
  await writeFile(traceMarkerPath, `${traceRunId}\n`, { mode: 0o600 });
  await writeSyntheticLottie();
  assertPackagedRuntimeClosure(packagedAsarPath, buildCommit);
  const preflight = await assertTraceAppPreflight(traceAppPath);
  const appStats = await stat(traceAppPath);
  const output = {
    schemaVersion: 1,
    status: preflight.passed ? "permit_ready" : "blocked",
    buildCommit,
    appBundle: traceAppPath,
    appBundleMtimeMs: appStats.mtimeMs,
    bundleIdentifier: preflight.mainBundleIdentifier,
    helperBundleIdentifiers: preflight.helperBundleIdentifiers.map((helper) => helper.bundleIdentifier),
    traceRunId,
    traceMarkerPath,
    syntheticLottiePath: traceSyntheticLottiePath,
    appAsarSha256: await sha256(packagedAsarPath),
    syntheticLottieSha256: await sha256(traceSyntheticLottiePath),
    preflight
  };
  console.log(JSON.stringify(output, null, 2));
  if (!preflight.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
