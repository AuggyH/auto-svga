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
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  inspectRecoveryState,
  recoverRollbackTransaction,
  rollbackPreviousApp
} from "./local-stable-recovery.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");
const experimentRoot = path.join(repoRoot, "tools/electron-prototype/experiments/svga-web");
const trialRoot = path.join(experimentRoot, ".artifacts/internal-trial");
const manifestPath = path.join(trialRoot, "internal-trial-manifest.json");
const proofPath = path.join(trialRoot, "macos-package-proof.json");
const localStableRoot = path.join(repoRoot, ".artifacts/local-stable-app");
const promotionManifestPath = path.join(localStableRoot, "promotion-manifest.json");
const rollbackManifestRoot = path.join(localStableRoot, "rollback-manifests");
const rollbackJournalRoot = path.join(localStableRoot, "rollback-journals");

function usage() {
  return [
    "Usage: node tools/svga-workbench/promote-local-stable-app.mjs [options]",
    "",
    "Options:",
    "  --inspect             Read and report installed, previous, and candidate identities without mutation.",
    "  --rollback-previous   Atomically exchange exact-bound installed and previous apps.",
    "  --recover-rollback    Resolve an interrupted durable rollback journal; never starts a new rollback.",
    "  --rollback-id <id>    Required single-use operation identifier for rollback/recovery.",
    "  --expected-installed-build <sha>",
    "  --expected-installed-info-plist-sha256 <sha>",
    "  --expected-installed-app-asar-sha256 <sha>",
    "  --expected-installed-build-info-sha256 <sha>",
    "  --expected-previous-build <sha>",
    "  --expected-previous-info-plist-sha256 <sha>",
    "  --expected-previous-app-asar-sha256 <sha>",
    "  --expected-previous-build-info-sha256 <sha>",
    "  --use-existing        Reuse the current-head internal package instead of rebuilding.",
    "  --allow-dirty         Allow packaging from a dirty worktree. Not allowed by default.",
    "  --target <path>       Install target. Defaults to ~/Applications/Auto SVGA.app.",
    "  --skip-register      Do not register the installed app with Launch Services.",
    "  --help                Show this help."
  ].join("\n");
}

function assertSafeRollbackIdValue(value, label = "rollback-id") {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value)) {
    throw new Error(`${label} must contain only safe alphanumeric, dot, underscore, or dash characters`);
  }
}

function assertHexValue(value, length, label) {
  if (typeof value !== "string" || !new RegExp(`^[0-9a-f]{${length}}$`).test(value)) {
    throw new Error(`${label} must be a ${length}-character lowercase hexadecimal value`);
  }
}

export function parseArgs(argv, env = process.env) {
  const envTarget = Object.prototype.hasOwnProperty.call(env, "AUTO_SVGA_LOCAL_STABLE_APP_PATH")
    ? env.AUTO_SVGA_LOCAL_STABLE_APP_PATH
    : undefined;
  if (envTarget === "") throw new Error("AUTO_SVGA_LOCAL_STABLE_APP_PATH must not be empty");
  const options = {
    inspect: false,
    rollbackPrevious: false,
    recoverRollback: false,
    useExisting: false,
    allowDirty: false,
    skipRegister: false,
    target: envTarget
      ? path.resolve(envTarget)
      : path.join(os.homedir(), "Applications", "Auto SVGA.app")
  };
  const seenOptions = new Set();

  function markOption(flag) {
    if (seenOptions.has(flag)) throw new Error(`Duplicate option: ${flag}`);
    seenOptions.add(flag);
  }

  function readOptionValue(flag, index) {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
    return value;
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--inspect") {
      markOption(arg);
      options.inspect = true;
    } else if (arg === "--rollback-previous") {
      markOption(arg);
      options.rollbackPrevious = true;
    } else if (arg === "--recover-rollback") {
      markOption(arg);
      options.recoverRollback = true;
    } else if (arg === "--use-existing") {
      markOption(arg);
      options.useExisting = true;
    } else if (arg === "--allow-dirty") {
      markOption(arg);
      options.allowDirty = true;
    } else if (arg === "--skip-register") {
      markOption(arg);
      options.skipRegister = true;
    }
    else if (arg === "--target") {
      markOption(arg);
      if (envTarget) throw new Error("--target cannot be combined with AUTO_SVGA_LOCAL_STABLE_APP_PATH environment authority");
      const target = readOptionValue(arg, index);
      options.target = path.resolve(target.replace(/^~/, os.homedir()));
      index += 1;
    } else if ([
      "--rollback-id",
      "--expected-installed-build",
      "--expected-installed-info-plist-sha256",
      "--expected-installed-app-asar-sha256",
      "--expected-installed-build-info-sha256",
      "--expected-previous-build",
      "--expected-previous-info-plist-sha256",
      "--expected-previous-app-asar-sha256",
      "--expected-previous-build-info-sha256"
    ].includes(arg)) {
      markOption(arg);
      const value = readOptionValue(arg, index);
      if (arg === "--rollback-id") assertSafeRollbackIdValue(value, "rollback-id");
      else if (arg.endsWith("-build")) assertHexValue(value, 40, arg.slice(2));
      else assertHexValue(value, 64, arg.slice(2));
      const property = arg.slice(2).replace(/-([a-z])/g, (_, character) => character.toUpperCase());
      options[property] = value;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}\n${usage()}`);
    }
  }

  const modeCount = [options.inspect, options.rollbackPrevious, options.recoverRollback].filter(Boolean).length;
  if (modeCount > 1) throw new Error("--inspect, --rollback-previous, and --recover-rollback are mutually exclusive");
  const bindingOptionPresent = Object.keys(options).some((key) => key.startsWith("expectedInstalled") || key.startsWith("expectedPrevious"));
  if ((options.rollbackPrevious || options.recoverRollback) && (options.useExisting || options.allowDirty || options.skipRegister)) {
    throw new Error("Rollback modes do not accept packaging or registration-bypass options");
  }
  if (options.inspect && (options.useExisting || options.allowDirty || options.skipRegister || options.rollbackId || bindingOptionPresent)) {
    throw new Error("Inspect mode does not accept packaging, registration-bypass, rollback-id, or rollback-binding options");
  }
  if (!options.rollbackPrevious && !options.recoverRollback && !options.inspect && (options.rollbackId || bindingOptionPresent)) {
    throw new Error("Rollback identifiers and bindings require an explicit inspect, rollback, or recovery mode");
  }

  return options;
}

function rollbackBindingsFromOptions(options) {
  return {
    installed: {
      buildCommit: options.expectedInstalledBuild,
      infoPlistSha256: options.expectedInstalledInfoPlistSha256,
      appAsarSha256: options.expectedInstalledAppAsarSha256,
      buildInfoSha256: options.expectedInstalledBuildInfoSha256
    },
    previous: {
      buildCommit: options.expectedPreviousBuild,
      infoPlistSha256: options.expectedPreviousInfoPlistSha256,
      appAsarSha256: options.expectedPreviousAppAsarSha256,
      buildInfoSha256: options.expectedPreviousBuildInfoSha256
    }
  };
}

function rollbackPathsForId(rollbackId) {
  if (!rollbackId) throw new Error("--rollback-id is required for rollback and recovery modes");
  assertSafeRollbackIdValue(rollbackId, "rollback-id");
  return {
    rollbackManifestPath: path.join(rollbackManifestRoot, `${rollbackId}.json`),
    rollbackJournalPath: path.join(rollbackJournalRoot, `${rollbackId}.json`)
  };
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

  if (options.inspect) {
    const packageInfo = loadAndValidatePackage({ ...options, useExisting: true });
    const rollbackPaths = options.rollbackId ? rollbackPathsForId(options.rollbackId) : {};
    console.log(JSON.stringify(inspectRecoveryState({
      target: options.target,
      candidateApp: packageInfo.sourceApp,
      ...rollbackPaths
    }), null, 2));
    return;
  }

  if (options.rollbackPrevious || options.recoverRollback) {
    const rollbackPaths = rollbackPathsForId(options.rollbackId);
    const operation = options.recoverRollback ? recoverRollbackTransaction : rollbackPreviousApp;
    const result = operation({
      target: options.target,
      rollbackId: options.rollbackId,
      bindings: rollbackBindingsFromOptions(options),
      ...rollbackPaths
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

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

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
