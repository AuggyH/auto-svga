import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { internalTrialCsp } from "../server.mjs";
import {
  appName,
  architecture,
  assertPackagedRuntimeClosure,
  bundleDisplayName,
  bundleIdentifier,
  bundleShortVersion,
  bundleVersion,
  candidateChannel,
  distributionChannel,
  finalAcceptanceOwner,
  macosPackagerArgs,
  ownerVisibleLabel,
  platform,
  productName,
  productVersion,
  productVersionLine,
  releaseStage,
  writeMacosPackageProof
} from "./macos-package-proof.mjs";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(experimentRoot, "../../../..");
const artifactsRoot = path.join(experimentRoot, ".artifacts/internal-trial");
const appDirectory = path.join(artifactsRoot, `${appName}-darwin-arm64`);
const appBundle = path.join(appDirectory, `${appName}.app`);
const packagedAsarPath = path.join(appBundle, "Contents/Resources/app.asar");
const packagedInfoPlist = path.join(appBundle, "Contents/Info.plist");
const entitlementsPath = path.join(experimentRoot, "packaging/macos/entitlements.plist");
const archivePath = path.join(artifactsRoot, `${appName}-darwin-arm64.zip`);
const manifestPath = path.join(artifactsRoot, "internal-trial-manifest.json");
const runtimeBuildInfoPath = path.join(experimentRoot, ".runtime/build-info.json");
const localElectronVersionPath = path.join(experimentRoot, "../../node_modules/electron/dist/version");
const internalTrialProductMilestoneId = "0.2-multiformat-preview";

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: options.cwd ?? experimentRoot,
    stdio: options.stdio ?? "inherit",
    env: options.env ?? process.env
  });
}

async function directorySizeBytes(directoryPath) {
  let total = 0;
  for (const entry of await readdir(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) total += await directorySizeBytes(entryPath);
    else if (entry.isFile()) total += (await stat(entryPath)).size;
  }
  return total;
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

function zipEntries(zipPath) {
  return execFileSync("unzip", ["-Z1", zipPath], {
    cwd: repoRoot,
    encoding: "utf8"
  }).split("\n").filter(Boolean).sort();
}

function assertCleanZipEntries(entries, label) {
  const seen = new Set();
  const duplicates = [];
  const forbidden = [];
  for (const entry of entries) {
    if (seen.has(entry)) duplicates.push(entry);
    seen.add(entry);
    const parts = entry.split("/").filter(Boolean);
    if (
      entry.startsWith("/")
      || parts.includes("..")
      || parts.some((part) => part === "__MACOSX" || part === ".DS_Store" || part.startsWith("._"))
      || parts.some((part) => part === ".fseventsd" || part === ".Spotlight-V100" || part === ".Trashes" || part === "Icon\r")
    ) {
      forbidden.push(entry);
    }
  }
  if (duplicates.length > 0 || forbidden.length > 0) {
    throw new Error(`${label} is not clean: duplicates=${duplicates.slice(0, 5).join(", ")} forbidden=${forbidden.slice(0, 5).join(", ")}`);
  }
}

async function writeRuntimeBuildInfo(buildCommit, productMilestoneId) {
  const buildInfo = {
    schemaVersion: 1,
    buildCommit,
    productMilestoneId,
    source: "package-internal-trial"
  };
  await writeFile(runtimeBuildInfoPath, `${JSON.stringify(buildInfo, null, 2)}\n`);
}

function assertPackagedRuntimeDependencies(buildCommit) {
  return assertPackagedRuntimeClosure(packagedAsarPath, buildCommit);
}

function createCleanAppArchive() {
  run("/usr/bin/ditto", [
    "-c",
    "-k",
    "--norsrc",
    "--keepParent",
    appBundle,
    archivePath
  ], {
    env: {
      ...process.env,
      COPYFILE_DISABLE: "1"
    }
  });
  assertCleanZipEntries(zipEntries(archivePath), "macOS internal App ZIP");
}

function deletePlistKey(plistPath, key) {
  const result = execFileSync("/usr/libexec/PlistBuddy", ["-c", `Delete :${key}`, plistPath], {
    cwd: experimentRoot,
    env: process.env,
    encoding: "utf8",
    stdio: "pipe"
  });
  return result;
}

function sanitizePackagedInfoPlist() {
  const removableKeys = [
    "NSAppTransportSecurity",
    "NSAudioCaptureUsageDescription",
    "NSBluetoothAlwaysUsageDescription",
    "NSBluetoothPeripheralUsageDescription",
    "NSCameraUsageDescription",
    "NSMicrophoneUsageDescription",
    "CFBundleDocumentTypes",
    "UTExportedTypeDeclarations",
    "UTImportedTypeDeclarations"
  ];
  for (const key of removableKeys) {
    try {
      deletePlistKey(packagedInfoPlist, key);
    } catch {
      // Missing keys are expected after the package has already been sanitized.
    }
  }
}

function sealPackagedAppForLaunchServices() {
  if (!existsSync(entitlementsPath)) {
    throw new Error(`macOS package entitlements are missing: ${path.relative(repoRoot, entitlementsPath)}`);
  }
  run("codesign", [
    "--force",
    "--deep",
    "--options",
    "runtime",
    "--entitlements",
    entitlementsPath,
    "--sign",
    "-",
    appBundle
  ]);
  run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appBundle]);
}

async function findCachedElectronZip() {
  if (!existsSync(localElectronVersionPath)) return undefined;
  const electronVersion = (await readFile(localElectronVersionPath, "utf8")).trim();
  const zipName = `electron-v${electronVersion}-darwin-arm64.zip`;
  const cacheRoots = [
    process.env.ELECTRON_CACHE,
    process.env.npm_config_electron_mirror ? undefined : process.env.ELECTRON_CUSTOM_DIR,
    process.env.HOME ? path.join(process.env.HOME, "Library/Caches/electron") : undefined,
    process.env.XDG_CACHE_HOME ? path.join(process.env.XDG_CACHE_HOME, "electron") : undefined
  ].filter(Boolean);

  for (const cacheRoot of cacheRoots) {
    if (!existsSync(cacheRoot)) continue;
    for (const entry of await readdir(cacheRoot, { withFileTypes: true })) {
      const candidate = entry.isDirectory()
        ? path.join(cacheRoot, entry.name, zipName)
        : path.join(cacheRoot, entry.name);
      if (path.basename(candidate) === zipName && existsSync(candidate)) {
        return path.dirname(candidate);
      }
    }
  }
  return undefined;
}

async function main() {
  const buildCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8"
  }).trim();

  await rm(artifactsRoot, { recursive: true, force: true });
  await mkdir(artifactsRoot, { recursive: true });

  run("npm", ["run", "spike:svga-web:prepare"]);
  await writeRuntimeBuildInfo(buildCommit, internalTrialProductMilestoneId);
  const cachedElectronZipDir = await findCachedElectronZip();
  const packagerArgs = cachedElectronZipDir
    ? [...macosPackagerArgs(artifactsRoot), `--electron-zip-dir=${cachedElectronZipDir}`]
    : macosPackagerArgs(artifactsRoot);
  run("../../node_modules/.bin/electron-packager", packagerArgs);
  sanitizePackagedInfoPlist();
  sealPackagedAppForLaunchServices();
  assertPackagedRuntimeDependencies(buildCommit);
  createCleanAppArchive();

  const packageSizeBytes = await directorySizeBytes(appBundle);
  const archiveSizeBytes = (await stat(archivePath)).size;
  const archiveSha256 = await sha256(archivePath);
  const archiveEntryCount = zipEntries(archivePath).length;
  const proof = await writeMacosPackageProof({ appBundle, archivePath });
  const manifest = {
    appName,
    bundleDisplayName,
    bundleIdentifier,
    prototypeLabel: "内部原型，非生产版本，仅供内部测试",
    version: bundleShortVersion,
    bundleVersion,
    productVersionLine,
    productVersion,
    productName,
    releaseStage,
    distributionChannel,
    candidateChannel,
    ownerVisibleLabel,
    productIdentity: {
      productVersionLine,
      productVersion,
      productName,
      releaseStage,
      distributionChannel,
      candidateChannel,
      ownerVisibleLabel
    },
    productMilestoneId: internalTrialProductMilestoneId,
    buildCommit,
    platform,
    architecture,
    playerPackage: "svga-web",
    playerVersion: "2.4.4",
    CSP: internalTrialCsp,
    documentTypes: proof.documentTypes,
    appIcon: proof.appIcon,
    distribution: proof.distribution,
    packagedRuntimeClosure: proof.packagingScaffold.packagedRuntimeClosure,
    launchServicesExecutableReadiness: proof.packagingScaffold.launchServicesExecutableReadiness,
    securityFlags: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      remoteNavigationBlocked: true,
      newWindowsBlocked: true,
      permissionsDenied: true,
      telemetry: false,
      persistedAbsolutePaths: false,
      arbitraryFileServing: false
    },
    packagePath: path.relative(repoRoot, appBundle),
    archivePath: path.relative(repoRoot, archivePath),
    packageSizeBytes,
    archiveSizeBytes,
    archiveEntryCount,
    sha256: archiveSha256,
    knownRisks: [
      "Requires wasm-unsafe-eval for svga-web WebAssembly fast path.",
      "Unsigned and not notarized.",
      "Internal testing only; not approved for production distribution.",
      `Final packaged App acceptance is owned by ${finalAcceptanceOwner}.`,
      "Windows runtime is not verified."
    ],
    rollbackCommand: "npm run local:preview",
    proofManifestPath: path.relative(repoRoot, path.join(artifactsRoot, "macos-package-proof.json")),
    productionApproved: false
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
