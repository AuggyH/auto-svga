import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { internalTrialCsp } from "../server.mjs";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(experimentRoot, "../../../..");
const artifactsRoot = path.join(experimentRoot, ".artifacts/internal-trial");
const appName = "AutoSVGAInternalPrototype";
const appDirectory = path.join(artifactsRoot, `${appName}-darwin-arm64`);
const appBundle = path.join(appDirectory, `${appName}.app`);
const archivePath = path.join(artifactsRoot, `${appName}-darwin-arm64.zip`);
const manifestPath = path.join(artifactsRoot, "internal-trial-manifest.json");

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: options.cwd ?? experimentRoot,
    stdio: options.stdio ?? "inherit",
    env: process.env
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

async function main() {
  const buildCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8"
  }).trim();

  await rm(artifactsRoot, { recursive: true, force: true });
  await mkdir(artifactsRoot, { recursive: true });

  run("npm", ["run", "spike:svga-web:prepare"]);
  run("../../node_modules/.bin/electron-packager", [
    ".",
    appName,
    "--platform=darwin",
    "--arch=arm64",
    `--out=${artifactsRoot}`,
    "--overwrite",
    "--prune=true",
    "--asar",
    "--ignore=^/(tests|scripts|\\.artifacts)($|/)"
  ]);
  run("/usr/bin/ditto", [
    "-c",
    "-k",
    "--sequesterRsrc",
    "--keepParent",
    appBundle,
    archivePath
  ]);

  const packageSizeBytes = await directorySizeBytes(appBundle);
  const archiveSizeBytes = (await stat(archivePath)).size;
  const archiveSha256 = await sha256(archivePath);
  const manifest = {
    appName,
    prototypeLabel: "内部原型，非生产版本，仅供内部测试",
    version: "0.0.0-internal",
    buildCommit,
    platform: "darwin",
    architecture: "arm64",
    playerPackage: "svga-web",
    playerVersion: "2.4.4",
    CSP: internalTrialCsp,
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
    sha256: archiveSha256,
    knownRisks: [
      "Requires wasm-unsafe-eval for svga-web WebAssembly fast path.",
      "Unsigned and not notarized.",
      "Internal testing only; not approved for production distribution.",
      "Windows runtime is not verified."
    ],
    rollbackCommand: "npm run local:preview",
    productionApproved: false
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
