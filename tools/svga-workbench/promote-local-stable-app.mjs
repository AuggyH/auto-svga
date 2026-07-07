import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");
const experimentRoot = path.join(repoRoot, "tools/electron-prototype/experiments/svga-web");
const trialRoot = path.join(experimentRoot, ".artifacts/internal-trial");
const manifestPath = path.join(trialRoot, "internal-trial-manifest.json");
const proofPath = path.join(trialRoot, "macos-package-proof.json");
const localStableRoot = path.join(repoRoot, ".artifacts/local-stable-app");
const promotionManifestPath = path.join(localStableRoot, "promotion-manifest.json");

function usage() {
  return [
    "Usage: node tools/svga-workbench/promote-local-stable-app.mjs [options]",
    "",
    "Options:",
    "  --use-existing        Reuse the current-head internal package instead of rebuilding.",
    "  --allow-dirty         Allow packaging from a dirty worktree. Not allowed by default.",
    "  --target <path>       Install target. Defaults to ~/Applications/Auto SVGA.app.",
    "  --skip-register      Do not register the installed app with Launch Services.",
    "  --help                Show this help."
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    useExisting: false,
    allowDirty: false,
    skipRegister: false,
    target: process.env.AUTO_SVGA_LOCAL_STABLE_APP_PATH
      ? path.resolve(process.env.AUTO_SVGA_LOCAL_STABLE_APP_PATH)
      : path.join(os.homedir(), "Applications", "Auto SVGA.app")
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--use-existing") options.useExisting = true;
    else if (arg === "--allow-dirty") options.allowDirty = true;
    else if (arg === "--skip-register") options.skipRegister = true;
    else if (arg === "--target") {
      const target = argv[index + 1];
      if (!target) throw new Error("--target requires a path");
      options.target = path.resolve(target.replace(/^~/, os.homedir()));
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}\n${usage()}`);
    }
  }

  return options;
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    encoding: options.encoding ?? "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

function git(args) {
  return run("git", args).trim();
}

function gitStatusPorcelain() {
  return git(["status", "--porcelain"]);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function directorySizeBytes(directoryPath) {
  let total = 0;
  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);
    const entryStat = lstatSync(entryPath);
    if (entryStat.isDirectory()) total += directorySizeBytes(entryPath);
    else if (entryStat.isFile()) total += entryStat.size;
  }
  return total;
}

function plistValue(plistPath, key) {
  return execFileSync("/usr/libexec/PlistBuddy", ["-c", `Print :${key}`, plistPath], {
    encoding: "utf8",
    stdio: "pipe"
  }).trim();
}

function assertDarwin() {
  if (process.platform !== "darwin") {
    throw new Error("Local stable app promotion is macOS-only.");
  }
}

function assertCleanWorktreeUnlessAllowed(options) {
  if (options.allowDirty || options.useExisting) return;
  const status = gitStatusPorcelain();
  if (status) {
    throw new Error(
      [
        "Refusing to package a dirty worktree for the local stable app.",
        "Commit or stash the changes first, or use --allow-dirty only for an explicit internal experiment.",
        status
      ].join("\n")
    );
  }
}

function packageInternalTrial() {
  run("npm", ["--prefix", "tools/electron-prototype/experiments/svga-web", "run", "internal:trial:package:mac"], {
    cwd: repoRoot,
    stdio: "inherit"
  });
}

function loadAndValidatePackage(options) {
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing internal trial manifest: ${manifestPath}`);
  }
  if (!existsSync(proofPath)) {
    throw new Error(`Missing macOS package proof: ${proofPath}`);
  }

  const manifest = readJson(manifestPath);
  const proof = readJson(proofPath);
  const head = git(["rev-parse", "HEAD"]);
  const sourceApp = path.resolve(repoRoot, manifest.packagePath ?? "");
  const sourceArchive = path.resolve(repoRoot, manifest.archivePath ?? "");

  const errors = [];
  if (manifest.appName !== "Auto SVGA") errors.push("manifest appName is not Auto SVGA");
  if (manifest.bundleDisplayName !== "Auto SVGA") errors.push("manifest display name is not Auto SVGA");
  if (manifest.buildCommit !== head) errors.push(`manifest buildCommit ${manifest.buildCommit} does not match HEAD ${head}`);
  if (manifest.productionApproved !== false) errors.push("manifest productionApproved must be false for D0 internal packages");
  if (manifest.distribution?.internalUseOnly !== true) errors.push("manifest distribution.internalUseOnly must be true");
  if (manifest.distribution?.unsigned !== true) errors.push("manifest distribution.unsigned must be true");
  if (manifest.distribution?.notarized !== false) errors.push("manifest distribution.notarized must be false");
  if (proof.distribution?.internalUseOnly !== true) errors.push("proof distribution.internalUseOnly must be true");
  if (proof.privacyAudit?.passed !== true) errors.push("proof privacy audit did not pass");
  if (!existsSync(sourceApp)) errors.push(`source app bundle missing: ${sourceApp}`);
  if (!existsSync(sourceArchive)) errors.push(`source app archive missing: ${sourceArchive}`);
  if (existsSync(sourceArchive) && manifest.sha256 && sha256(sourceArchive) !== manifest.sha256) {
    errors.push("manifest archive sha256 does not match the archive on disk");
  }

  if (errors.length > 0) {
    const hint = options.useExisting
      ? "Run without --use-existing after the source tree is clean to rebuild a fresh internal package."
      : "Rebuild failed validation; the local stable app was not changed.";
    throw new Error(`${errors.join("\n")}\n${hint}`);
  }

  validateAppIdentity(sourceApp);
  return { manifest, proof, sourceApp, sourceArchive, head };
}

function validateAppIdentity(appBundle) {
  const plistPath = path.join(appBundle, "Contents/Info.plist");
  const executablePath = path.join(appBundle, "Contents/MacOS/Auto SVGA");
  if (!existsSync(plistPath)) throw new Error(`Missing Info.plist: ${plistPath}`);
  if (!existsSync(executablePath)) throw new Error(`Missing executable: ${executablePath}`);

  const name = plistValue(plistPath, "CFBundleName");
  const displayName = plistValue(plistPath, "CFBundleDisplayName");
  const executable = plistValue(plistPath, "CFBundleExecutable");
  if (name !== "Auto SVGA" || displayName !== "Auto SVGA" || executable !== "Auto SVGA") {
    throw new Error(`Unexpected app identity: name=${name}, displayName=${displayName}, executable=${executable}`);
  }
}

function installApp({ sourceApp, target }) {
  const targetParent = path.dirname(target);
  const temporaryTarget = path.join(targetParent, `.Auto SVGA.promote-${process.pid}.app`);
  const backupTarget = path.join(targetParent, "Auto SVGA.previous.app");

  mkdirSync(targetParent, { recursive: true });
  rmSync(temporaryTarget, { recursive: true, force: true });
  run("/usr/bin/ditto", [sourceApp, temporaryTarget], { stdio: "inherit" });
  run("/usr/bin/xattr", ["-dr", "com.apple.quarantine", temporaryTarget], { stdio: "ignore" });
  validateAppIdentity(temporaryTarget);

  rmSync(backupTarget, { recursive: true, force: true });
  if (existsSync(target)) renameSync(target, backupTarget);
  try {
    renameSync(temporaryTarget, target);
  } catch (error) {
    if (existsSync(backupTarget) && !existsSync(target)) renameSync(backupTarget, target);
    throw error;
  }
  validateAppIdentity(target);
  return { backupTarget: existsSync(backupTarget) ? backupTarget : undefined };
}

function registerLaunchServices(target) {
  const lsregister = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";
  if (!existsSync(lsregister)) return false;
  run(lsregister, ["-f", target], { stdio: "ignore" });
  return true;
}

function writePromotionManifest(summary) {
  mkdirSync(localStableRoot, { recursive: true });
  writeFileSync(promotionManifestPath, `${JSON.stringify(summary, null, 2)}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertDarwin();
  assertCleanWorktreeUnlessAllowed(options);

  if (!options.useExisting) {
    packageInternalTrial();
  }

  const packageInfo = loadAndValidatePackage(options);
  const installInfo = installApp({ sourceApp: packageInfo.sourceApp, target: options.target });
  const launchServicesRegistered = options.skipRegister ? false : registerLaunchServices(options.target);

  const summary = {
    schemaVersion: 1,
    promotedAt: new Date().toISOString(),
    mode: options.useExisting ? "use-existing-current-head-package" : "rebuilt-current-head-package",
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
    buildCommit: packageInfo.head,
    sourceApp: path.relative(repoRoot, packageInfo.sourceApp),
    sourceArchive: path.relative(repoRoot, packageInfo.sourceArchive),
    archiveSha256: packageInfo.manifest.sha256,
    targetApp: options.target,
    targetSizeBytes: directorySizeBytes(options.target),
    backupApp: installInfo.backupTarget,
    launchServicesRegistered,
    distribution: packageInfo.manifest.distribution,
    productionApproved: packageInfo.manifest.productionApproved
  };
  writePromotionManifest(summary);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
