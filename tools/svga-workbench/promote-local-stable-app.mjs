import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  atomicSwapApps,
  inspectAppBundle,
  inspectRecoveryState,
  legacyPreviousAppPathForTarget,
  previousBackupPathForTarget,
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
const promotionExchangeManifestRoot = path.join(localStableRoot, "promotion-manifests");
const promotionExchangeJournalPath = path.join(localStableRoot, "promotion-journal.json");
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
    "  --recover-promotion   Resolve an interrupted durable promotion journal; never starts a new promotion.",
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
    "  --skip-register      Deprecated; normal promotion requires LaunchServices postcheck.",
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
    recoverPromotion: false,
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
    } else if (arg === "--recover-promotion") {
      markOption(arg);
      options.recoverPromotion = true;
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

  const modeCount = [options.inspect, options.rollbackPrevious, options.recoverRollback, options.recoverPromotion]
    .filter(Boolean).length;
  if (modeCount > 1) {
    throw new Error("--inspect, --rollback-previous, --recover-rollback, and --recover-promotion are mutually exclusive");
  }
  const bindingOptionPresent = Object.keys(options).some((key) => key.startsWith("expectedInstalled") || key.startsWith("expectedPrevious"));
  if ((options.rollbackPrevious || options.recoverRollback) && (options.useExisting || options.allowDirty || options.skipRegister)) {
    throw new Error("Rollback modes do not accept packaging or registration-bypass options");
  }
  const targetOptionPresent = seenOptions.has("--target") || envTarget !== undefined;
  if (options.recoverPromotion && (
    options.useExisting
    || options.allowDirty
    || options.skipRegister
    || options.rollbackId
    || bindingOptionPresent
    || targetOptionPresent
  )) {
    throw new Error("Promotion recovery does not accept packaging, target, registration-bypass, rollback-id, or rollback-binding options");
  }
  if (options.inspect && (options.useExisting || options.allowDirty || options.skipRegister || options.rollbackId || bindingOptionPresent)) {
    throw new Error("Inspect mode does not accept packaging, registration-bypass, rollback-id, or rollback-binding options");
  }
  if (
    !options.rollbackPrevious
    && !options.recoverRollback
    && !options.recoverPromotion
    && !options.inspect
    && (options.rollbackId || bindingOptionPresent)
  ) {
    throw new Error("Rollback identifiers and bindings require an explicit inspect, rollback, or recovery mode");
  }
  if (
    !options.rollbackPrevious
    && !options.recoverRollback
    && !options.recoverPromotion
    && !options.inspect
    && options.skipRegister
  ) {
    throw new Error("--skip-register is not allowed for local-stable promotion; LaunchServices postcheck is mandatory");
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

function fsyncDirectory(directoryPath) {
  const descriptor = openSync(directoryPath, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function writeJsonExclusive(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  let descriptor;
  let created = false;
  try {
    descriptor = openSync(filePath, "wx", 0o600);
    created = true;
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    fsyncDirectory(path.dirname(filePath));
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    if (created) {
      rmSync(filePath, { force: true });
      fsyncDirectory(path.dirname(filePath));
    }
    throw error;
  }
}

function replaceJsonDurably(filePath, value) {
  const temporaryPath = `${filePath}.next`;
  if (existsSync(temporaryPath)) throw new Error(`Promotion journal update residue already exists: ${temporaryPath}`);
  writeJsonExclusive(temporaryPath, value);
  renameSync(temporaryPath, filePath);
  fsyncDirectory(path.dirname(filePath));
}

function removeDurably(filePath) {
  rmSync(filePath, { recursive: true, force: false });
  fsyncDirectory(path.dirname(filePath));
}

function assertRealDirectory(directoryPath, label) {
  let stat;
  try {
    stat = lstatSync(directoryPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`${label} must be an existing real directory: ${directoryPath}`);
    }
    throw error;
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a real directory: ${directoryPath}`);
  }
  return stat;
}

function compactAppIdentity(identity) {
  if (!identity) return null;
  return {
    appPath: identity.appPath,
    realPath: identity.realPath,
    rootObject: identity.rootObject,
    catalogDigest: identity.catalogDigest,
    entryCount: identity.entryCount,
    sizeBytes: identity.sizeBytes,
    stabilityFingerprint: identity.stabilityFingerprint,
    infoPlist: identity.infoPlist,
    appAsar: identity.appAsar,
    buildInfo: identity.buildInfo,
    runtimeClosure: identity.runtimeClosure
  };
}

function assertSameAppPayload(left, right, label) {
  const mismatches = [];
  if (left.infoPlist?.sha256 !== right.infoPlist?.sha256) mismatches.push("Info.plist sha256");
  if (left.appAsar?.sha256 !== right.appAsar?.sha256) mismatches.push("app.asar sha256");
  if (left.buildInfo?.sha256 !== right.buildInfo?.sha256) mismatches.push("build-info sha256");
  if (left.buildInfo?.buildCommit !== right.buildInfo?.buildCommit) mismatches.push("buildCommit");
  if (left.entryCount !== right.entryCount) mismatches.push("bundle entry count");
  if (left.sizeBytes !== right.sizeBytes) mismatches.push("bundle size");
  if (right.runtimeClosure?.validated !== true || right.runtimeClosure?.missingEntries?.length !== 0) {
    mismatches.push("runtime closure");
  }
  if (mismatches.length > 0) {
    throw new Error(`${label} does not match expected app payload: ${mismatches.join(", ")}`);
  }
}

function appPayloadMatches(identity, expected) {
  if (!identity && !expected) return true;
  if (!identity || !expected) return false;
  return identity.catalogDigest === expected.catalogDigest
    && identity.infoPlist?.sha256 === expected.infoPlist?.sha256
    && identity.appAsar?.sha256 === expected.appAsar?.sha256
    && identity.buildInfo?.sha256 === expected.buildInfo?.sha256
    && identity.buildInfo?.buildCommit === expected.buildInfo?.buildCommit
    && identity.entryCount === expected.entryCount
    && identity.sizeBytes === expected.sizeBytes
    && identity.runtimeClosure?.validated === true
    && identity.runtimeClosure?.missingEntries?.length === 0;
}

function defaultPromotionStagedAppPath(targetParent, operationId) {
  assertSafeRollbackIdValue(operationId, "promotion operation id");
  assertRealDirectory(targetParent, "Promotion target parent");
  const stagedApp = path.join(targetParent, `.Auto-SVGA.promote-${operationId}.stage.app`);
  const resolvedTargetParent = realpathSync.native(targetParent);
  const resolvedStageParent = realpathSync.native(path.dirname(stagedApp));
  if (resolvedStageParent !== resolvedTargetParent) {
    throw new Error(`Promotion staged app must share target parent: ${stagedApp}`);
  }
  if (existsSync(stagedApp)) {
    throw new Error(`Promotion staging app already exists: ${stagedApp}`);
  }
  return stagedApp;
}

function findPromotionResidue(targetParent) {
  if (!existsSync(targetParent)) return [];
  return readdirSync(targetParent).filter((name) => (
    name.startsWith(".Auto SVGA.promote-")
    || name.startsWith(".Auto-SVGA.promote-")
    || name.startsWith(".Auto SVGA.rollback-")
    || name.startsWith(".Auto-SVGA.rollback-")
  ));
}

function assertNoPromotionResidue(targetParent) {
  const residue = findPromotionResidue(targetParent);
  if (residue.length > 0) {
    throw new Error(`Refusing local-stable promotion with existing staging or journal residue: ${residue.join(", ")}`);
  }
}

function defaultPromotionOperationId() {
  return `promote-${new Date().toISOString().replace(/[^0-9A-Za-z]/g, "")}-${process.pid}`;
}

function defaultPromotionTransactionPaths(operationId) {
  return {
    journalPath: promotionExchangeJournalPath,
    manifestPath: path.join(promotionExchangeManifestRoot, `${operationId}.json`)
  };
}

function assertNoPromotionTransactionResidue({ journalPath, manifestPath }) {
  const residues = [];
  if (existsSync(journalPath)) residues.push(journalPath);
  if (existsSync(`${journalPath}.next`)) residues.push(`${journalPath}.next`);
  if (existsSync(manifestPath)) residues.push(manifestPath);
  if (residues.length > 0) {
    throw new Error(`Refusing local-stable promotion with existing promotion transaction residue: ${residues.join(", ")}`);
  }
}

function readXattrValue(filePath, name) {
  try {
    return run("/usr/bin/xattr", ["-p", name, filePath], { stdio: "pipe" }).trim();
  } catch (error) {
    const stderr = error?.stderr?.toString?.() ?? "";
    if (error?.status === 1 && /No such xattr/.test(stderr)) return null;
    throw error;
  }
}

function clearXattrValue(filePath, name) {
  try {
    run("/usr/bin/xattr", ["-d", name, filePath], { stdio: "ignore" });
  } catch (error) {
    const stderr = error?.stderr?.toString?.() ?? "";
    if (error?.status === 1 && /No such xattr/.test(stderr)) return;
    throw error;
  }
}

function writeXattrValue(filePath, name, value) {
  run("/usr/bin/xattr", ["-w", name, value, filePath], { stdio: "ignore" });
}

function readBundleIdentifier(appBundle) {
  const plistPath = path.join(appBundle, "Contents/Info.plist");
  if (!existsSync(plistPath)) return null;
  try {
    return plistValue(plistPath, "CFBundleIdentifier");
  } catch {
    try {
      const plist = JSON.parse(readFileSync(plistPath, "utf8"));
      return plist.CFBundleIdentifier ?? plist.bundleIdentifier ?? null;
    } catch {
      throw new Error(`Unable to read CFBundleIdentifier from sibling app: ${appBundle}`);
    }
  }
}

function sameExistingPath(left, right) {
  if (!left || !right || !existsSync(left) || !existsSync(right)) return false;
  return realpathSync.native(left) === realpathSync.native(right);
}

function normalizeLaunchServicesPath(recordPath) {
  if (typeof recordPath !== "string" || recordPath.trim() === "") return null;
  const withoutScheme = recordPath.trim().replace(/^file:\/\//, "");
  try {
    return path.resolve(decodeURI(withoutScheme));
  } catch {
    return path.resolve(withoutScheme);
  }
}

export function parseLaunchServicesDump(dump, bundleIdentifier) {
  const records = [];
  const blocks = String(dump).split(/\n\s*\n/);
  for (const block of blocks) {
    if (!block.includes(bundleIdentifier)) continue;
    const pathMatch = block.match(/^\s*(?:path|bundle path|url|URL)\s*:\s*(.+?)\s*$/im)
      ?? block.match(/^\s*(\/.+?\.app)\s*$/im);
    const identifierMatch = block.match(/^\s*(?:identifier|bundle id|bundle identifier|CFBundleIdentifier)\s*:\s*([^\s]+)\s*$/im);
    const identifier = identifierMatch?.[1] ?? (block.includes(bundleIdentifier) ? bundleIdentifier : null);
    const recordPath = normalizeLaunchServicesPath(pathMatch?.[1]);
    if (identifier !== bundleIdentifier || !recordPath) continue;
    records.push({
      bundleIdentifier: identifier,
      path: recordPath,
      nodeMissing: /Bundle node not found on disk|node not found|No such file/i.test(block),
      raw: block
    });
  }
  return records;
}

function defaultReadLaunchServicesRecords(bundleIdentifier) {
  const lsregister = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";
  if (!existsSync(lsregister)) throw new Error(`LaunchServices registration tool is missing: ${lsregister}`);
  const dump = run(lsregister, ["-dump"], { stdio: "pipe" });
  return parseLaunchServicesDump(dump, bundleIdentifier);
}

function defaultUnregisterLaunchServicesRecord(recordPath) {
  const lsregister = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";
  if (!existsSync(lsregister)) throw new Error(`LaunchServices registration tool is missing: ${lsregister}`);
  run(lsregister, ["-u", recordPath], { stdio: "ignore" });
  return true;
}

function isRepositoryManagedLaunchServicesStalePath(recordPath) {
  const normalized = normalizeLaunchServicesPath(recordPath);
  if (!normalized || path.basename(normalized) !== "Auto SVGA.app") return false;
  const safeRoots = [
    "/Users/huangtengxin/.codex/worktrees",
    "/Users/huangtengxin/.codex/visualizations",
    "/private/tmp",
    "/private/var/folders/vh/lkxvz3qn4wzbk5mbwxc9fb9r0000gn/T"
  ];
  if (!safeRoots.some((root) => normalized === root || normalized.startsWith(`${root}${path.sep}`))) return false;
  return normalized.includes(`${path.sep}review${path.sep}`)
    || normalized.includes(`${path.sep}.artifacts${path.sep}`)
    || normalized.includes(`${path.sep}auto-svga${path.sep}`)
    || normalized.includes(`${path.sep}auto-svga-`);
}

function launchServicesRecordPathMatches(recordPath, targetPath) {
  const left = normalizeLaunchServicesPath(recordPath);
  const right = normalizeLaunchServicesPath(targetPath);
  if (!left || !right) return false;
  if (left === right) return true;
  if (existsSync(left) && existsSync(right)) return sameExistingPath(left, right);
  return false;
}

function compactLaunchServicesRecord(record) {
  return {
    bundleIdentifier: record.bundleIdentifier,
    path: record.path,
    nodeMissing: Boolean(record.nodeMissing),
    classification: record.classification,
    reason: record.reason
  };
}

function classifyLaunchServicesRecord({
  record,
  target,
  legacyBackupTarget,
  bundleIdentifier,
  pathExists = existsSync
}) {
  if (record.bundleIdentifier !== bundleIdentifier) return { classification: "ignored", reason: "different-bundle-id" };
  if (launchServicesRecordPathMatches(record.path, target) && pathExists(target)) {
    return { classification: "target", reason: "installed-target" };
  }
  if (launchServicesRecordPathMatches(record.path, legacyBackupTarget)) {
    return { classification: "removable", reason: "legacy-previous-app" };
  }
  const exists = pathExists(record.path);
  if (!exists && isRepositoryManagedLaunchServicesStalePath(record.path)) {
    return { classification: "removable", reason: "repository-managed-missing-record" };
  }
  return {
    classification: "blocked",
    reason: exists ? "same-bundle-id-usable-non-target-record" : "same-bundle-id-unattributed-missing-record"
  };
}

function planLaunchServicesRecordRemediation({
  records,
  target,
  legacyBackupTarget,
  bundleIdentifier,
  pathExists = existsSync
}) {
  const classifiedRecords = records.map((record) => ({
    ...record,
    ...classifyLaunchServicesRecord({ record, target, legacyBackupTarget, bundleIdentifier, pathExists })
  }));
  const blockers = classifiedRecords.filter((record) => record.classification === "blocked");
  if (blockers.length > 0) {
    throw new Error(
      `LaunchServices same-bundle-id records are not safely attributable: ${
        blockers.map((record) => `${record.path} (${record.reason})`).join(", ")
      }`
    );
  }
  return {
    bundleIdentifier,
    target,
    legacyBackupTarget,
    records: classifiedRecords.map(compactLaunchServicesRecord),
    removals: classifiedRecords
      .filter((record) => record.classification === "removable")
      .map(compactLaunchServicesRecord)
  };
}

function assertLaunchServicesUniqueTarget({
  records,
  target,
  bundleIdentifier,
  pathExists = existsSync
}) {
  const sameBundleRecords = records.filter((record) => record.bundleIdentifier === bundleIdentifier);
  const targetRecords = sameBundleRecords.filter((record) => launchServicesRecordPathMatches(record.path, target) && pathExists(target));
  const blockers = sameBundleRecords.filter((record) => !launchServicesRecordPathMatches(record.path, target));
  if (targetRecords.length !== 1 || blockers.length > 0) {
    throw new Error(
      `LaunchServices post-registration is ambiguous for ${bundleIdentifier}: targetRecords=${targetRecords.length}, blockers=${
        blockers.map((record) => record.path).join(", ") || "<none>"
      }`
    );
  }
  return {
    bundleIdentifier,
    uniqueTarget: compactLaunchServicesRecord({
      ...targetRecords[0],
      classification: "target",
      reason: "post-registration-unique-target"
    }),
    records: sameBundleRecords.map((record) => compactLaunchServicesRecord({
      ...record,
      classification: launchServicesRecordPathMatches(record.path, target) ? "target" : "blocked",
      reason: launchServicesRecordPathMatches(record.path, target) ? "post-registration-target" : "post-registration-blocker"
    }))
  };
}

function planLaunchServicesInstallState({
  target,
  backupTarget = previousBackupPathForTarget(target),
  legacyBackupTarget = legacyPreviousAppPathForTarget(target),
  sourceApp,
  sourceIdentity,
  targetParent = path.dirname(target),
  readLaunchServicesRecords = defaultReadLaunchServicesRecords,
  readXattr = readXattrValue,
  readBundleIdentifier: readSiblingBundleIdentifier = readBundleIdentifier,
  pathExists = existsSync,
  listDirectory = readdirSync
} = {}) {
  const parentQuarantine = readXattr(targetParent, "com.apple.quarantine");

  const bundleIdentifier = sourceIdentity?.infoPlist?.bundleIdentifier;
  if (!bundleIdentifier) {
    throw new Error("Candidate bundle identifier is unavailable for LaunchServices install-state validation");
  }

  const backupExists = existsSync(backupTarget);
  const legacyExists = existsSync(legacyBackupTarget);
  if (backupExists && legacyExists) {
    throw new Error(`Both inert previous bundle and legacy previous app exist: ${backupTarget}, ${legacyBackupTarget}`);
  }

  const collisions = [];
  for (const entryName of listDirectory(targetParent)) {
    if (!entryName.endsWith(".app")) continue;
    const siblingPath = path.join(targetParent, entryName);
    if (sameExistingPath(siblingPath, target)) continue;
    if (sameExistingPath(siblingPath, sourceApp)) continue;
    const isLegacyPrevious = sameExistingPath(siblingPath, legacyBackupTarget);
    const siblingIdentifier = readSiblingBundleIdentifier(siblingPath);
    if (isLegacyPrevious && siblingIdentifier === bundleIdentifier) continue;
    if (isLegacyPrevious) {
      throw new Error(`Legacy previous app has unexpected bundle identifier ${siblingIdentifier ?? "<missing>"}`);
    }
    if (siblingIdentifier === bundleIdentifier) collisions.push(siblingPath);
  }

  if (collisions.length > 0) {
    throw new Error(
      `LaunchServices bundle identifier collision in target parent for ${bundleIdentifier}: ${collisions.join(", ")}`
    );
  }

  const launchServices = planLaunchServicesRecordRemediation({
    records: readLaunchServicesRecords(bundleIdentifier),
    target,
    legacyBackupTarget,
    bundleIdentifier,
    pathExists
  });

  return {
    targetParent,
    targetParentQuarantine: parentQuarantine,
    backupTarget,
    legacyBackupTarget,
    migrateLegacyPrevious: legacyExists && !backupExists,
    bundleIdentifier,
    launchServices
  };
}

function applyTargetParentQuarantineRemediation({ dependencies, targetParent, expectedValue }) {
  if (!expectedValue) return { mutationPerformed: false, before: null, after: null };
  const currentValue = dependencies.readXattr(targetParent, "com.apple.quarantine");
  if (currentValue !== expectedValue) {
    throw new Error(
      `Target parent quarantine changed before remediation: expected ${expectedValue}, observed ${currentValue ?? "<absent>"}`
    );
  }
  dependencies.clearXattr(targetParent, "com.apple.quarantine");
  const after = dependencies.readXattr(targetParent, "com.apple.quarantine");
  if (after !== null) {
    throw new Error(`Target parent quarantine remediation did not clear the exact xattr; observed ${after}`);
  }
  return { mutationPerformed: true, before: expectedValue, after: null };
}

function restoreTargetParentQuarantine({ dependencies, targetParent, expectedValue }) {
  if (!expectedValue) return { restored: false, value: null };
  const currentValue = dependencies.readXattr(targetParent, "com.apple.quarantine");
  if (currentValue === expectedValue) return { restored: false, value: expectedValue };
  if (currentValue !== null) {
    throw new Error(
      `Cannot restore target parent quarantine because it changed to ${currentValue}; expected absent or ${expectedValue}`
    );
  }
  dependencies.writeXattr(targetParent, "com.apple.quarantine", expectedValue);
  const restoredValue = dependencies.readXattr(targetParent, "com.apple.quarantine");
  if (restoredValue !== expectedValue) {
    throw new Error(`Target parent quarantine restore failed; observed ${restoredValue ?? "<absent>"}`);
  }
  return { restored: true, value: restoredValue };
}

function applyLaunchServicesRecordRemediation({ dependencies, plan }) {
  const removals = [];
  for (const record of plan.removals ?? []) {
    dependencies.unregisterLaunchServicesRecord(record.path);
    removals.push({ ...record, removed: true });
  }
  const recordsAfter = dependencies.readLaunchServicesRecords(plan.bundleIdentifier);
  const afterPlan = planLaunchServicesRecordRemediation({
    records: recordsAfter,
    target: plan.target,
    legacyBackupTarget: plan.legacyBackupTarget,
    bundleIdentifier: plan.bundleIdentifier,
    pathExists: dependencies.pathExists
  });
  if ((afterPlan.removals ?? []).length > 0) {
    throw new Error(
      `LaunchServices stale records remain after remediation: ${afterPlan.removals.map((record) => record.path).join(", ")}`
    );
  }
  return {
    applied: true,
    removals,
    recordsAfter: afterPlan.records
  };
}

function finalizePromotionLaunchServices({ dependencies, journal, journalPath }) {
  if (journal.launchServicesRegistered !== true) {
    dependencies.checkpoint("before-launch-services-registration");
    if (dependencies.registerLaunchServices(journal.target) !== true) {
      throw new Error("LaunchServices registration did not report success");
    }
    journal = updatePromotionJournalPhase(dependencies, journalPath, journal, "launch-services-registered", {
      launchServicesRegistered: true
    });
    dependencies.checkpoint("after-launch-services-registration");
  }

  const bundleIdentifier = journal.remediation?.launchServices?.bundleIdentifier;
  if (!bundleIdentifier) throw new Error("Promotion journal is missing LaunchServices bundle identifier authority");
  const postRegistration = assertLaunchServicesUniqueTarget({
    records: dependencies.readLaunchServicesRecords(bundleIdentifier),
    target: journal.target,
    bundleIdentifier,
    pathExists: dependencies.pathExists
  });
  const remediation = {
    ...journal.remediation,
    launchServices: {
      ...journal.remediation.launchServices,
      postRegistration
    }
  };
  return updatePromotionJournalPhase(dependencies, journalPath, { ...journal, remediation }, "launch-services-postchecked");
}

function buildPromotionExchangeManifest({
  operationId,
  target,
  backupTarget,
  legacyBackupTarget,
  sourceApp,
  stagedApp,
  remediation,
  installedBefore,
  previousBefore,
  legacyPreviousBefore,
  installedAfter,
  previousAfter,
  completedAt
}) {
  return {
    schemaVersion: 1,
    operation: "promote-local-stable-install-exchange",
    operationId,
    completedAt: completedAt.toISOString(),
    retrySafe: false,
    invocationCount: 1,
    target,
    backupTarget,
    legacyBackupTarget,
    sourceApp,
    stagedApp,
    launchServicesRegistered: true,
    remediation,
    before: {
      installed: compactAppIdentity(installedBefore),
      previous: compactAppIdentity(previousBefore),
      legacyPrevious: compactAppIdentity(legacyPreviousBefore)
    },
    after: {
      installed: compactAppIdentity(installedAfter),
      previous: compactAppIdentity(previousAfter)
    }
  };
}

function buildPromotionJournal({
  operationId,
  target,
  backupTarget,
  legacyBackupTarget,
  sourceApp,
  stagingRoot,
  stagedApp,
  manifestPath,
  remediation,
  sourceIdentity,
  stagedIdentity,
  installedBefore,
  previousBefore,
  legacyPreviousBefore,
  phase,
  now
}) {
  return {
    schemaVersion: 1,
    operation: "promote-local-stable-install-journal",
    operationId,
    target,
    backupTarget,
    legacyBackupTarget,
    sourceApp,
    stagingRoot,
    stagedApp,
    manifestPath,
    remediation,
    launchServicesRegistered: false,
    retrySafe: false,
    invocationCount: 1,
    phase,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expected: {
      source: compactAppIdentity(sourceIdentity),
      stagedCandidate: compactAppIdentity(stagedIdentity),
      installedBefore: compactAppIdentity(installedBefore),
      previousBefore: compactAppIdentity(previousBefore),
      legacyPreviousBefore: compactAppIdentity(legacyPreviousBefore)
    }
  };
}

function updatePromotionJournalPhase(dependencies, journalPath, journal, phase, extra = {}) {
  const nextJournal = {
    ...journal,
    ...extra,
    phase,
    updatedAt: dependencies.now().toISOString()
  };
  dependencies.updateJournal(journalPath, nextJournal);
  return nextJournal;
}

function inspectIfExists(appPath, inspectBundle) {
  return existsSync(appPath) ? inspectBundle(appPath) : null;
}

function classifyPromotionTransaction({ installed, previous, legacyPrevious, stage, expected }) {
  if (previous && legacyPrevious) return "ambiguous-role-bytes";
  const previousCandidate = previous ?? legacyPrevious;
  const original = appPayloadMatches(installed, expected.installedBefore)
    && appPayloadMatches(previousCandidate, expected.previousBefore)
    && appPayloadMatches(stage, expected.stagedCandidate);
  if (original) return "original-roles";

  const afterFirstExchange = appPayloadMatches(installed, expected.stagedCandidate)
    && appPayloadMatches(previousCandidate, expected.previousBefore)
    && appPayloadMatches(stage, expected.installedBefore);
  if (afterFirstExchange) return "after-first-exchange";

  const complete = appPayloadMatches(installed, expected.stagedCandidate)
    && appPayloadMatches(previous, expected.installedBefore)
    && !legacyPrevious
    && (!stage || appPayloadMatches(stage, expected.previousBefore));
  if (complete) return "complete";

  return "ambiguous-role-bytes";
}

function inspectPromotionTransaction(journal, inspectBundle) {
  const installed = inspectIfExists(journal.target, inspectBundle);
  const previous = inspectIfExists(journal.backupTarget, inspectBundle);
  const legacyPrevious = journal.legacyBackupTarget
    ? inspectIfExists(journal.legacyBackupTarget, inspectBundle)
    : null;
  const stage = inspectIfExists(journal.stagedApp, inspectBundle);
  return {
    installed,
    previous,
    legacyPrevious,
    stage,
    state: classifyPromotionTransaction({
      installed,
      previous,
      legacyPrevious,
      stage,
      expected: journal.expected
    })
  };
}

function assertDestinationWritable(targetParent) {
  const probePath = path.join(targetParent, `.Auto-SVGA.promote-probe-${process.pid}-${Date.now()}`);
  mkdirSync(probePath, { mode: 0o700 });
  rmSync(probePath, { recursive: true, force: false });
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

function promotionInstallDependencies(overrides = {}) {
  return {
    atomicSwap: atomicSwapApps,
    clearQuarantine: (appBundle) => run("/usr/bin/xattr", ["-dr", "com.apple.quarantine", appBundle], { stdio: "ignore" }),
    clearXattr: clearXattrValue,
    copyBundle: (source, destination) => run("/usr/bin/ditto", [source, destination], { stdio: "inherit" }),
    createOperationId: defaultPromotionOperationId,
    createStagedAppPath: defaultPromotionStagedAppPath,
    fsyncDirectory,
    inspectBundle: inspectAppBundle,
    listDirectory: readdirSync,
    planLaunchServicesInstallState,
    pathExists: existsSync,
    promotionTransactionPaths: defaultPromotionTransactionPaths,
    preflightDestination: assertDestinationWritable,
    readBundleIdentifier,
    readLaunchServicesRecords: defaultReadLaunchServicesRecords,
    readXattr: readXattrValue,
    registerLaunchServices,
    removeDurably,
    renameDurably: (source, destination) => {
      renameSync(source, destination);
      fsyncDirectory(path.dirname(destination));
    },
    updateJournal: replaceJsonDurably,
    validateIdentity: validateAppIdentity,
    unregisterLaunchServicesRecord: defaultUnregisterLaunchServicesRecord,
    writeXattr: writeXattrValue,
    writeJournalInitial: writeJsonExclusive,
    writeManifestExclusive: writeJsonExclusive,
    now: () => new Date(),
    checkpoint: () => {},
    ...overrides
  };
}

function publishPromotionExchangeManifest({ dependencies, journal, journalPath }) {
  const state = inspectPromotionTransaction(journal, dependencies.inspectBundle);
  if (state.state !== "complete") {
    throw new Error(`Promotion exchange is not complete; current state is ${state.state}`);
  }

  if (existsSync(journal.manifestPath)) {
    if (!journal.manifestSha256) {
      throw new Error(`Promotion exchange manifest exists without journal-bound sha256 authority: ${journal.manifestPath}`);
    }
    const existingManifestSha256 = sha256(journal.manifestPath);
    if (existingManifestSha256 !== journal.manifestSha256) {
      throw new Error(
        `Promotion exchange manifest sha256 ${existingManifestSha256} does not match journal ${journal.manifestSha256}`
      );
    }
    return journal;
  }

  const manifest = buildPromotionExchangeManifest({
    operationId: journal.operationId,
    target: journal.target,
    backupTarget: journal.backupTarget,
    legacyBackupTarget: journal.legacyBackupTarget,
    sourceApp: journal.sourceApp,
    stagedApp: journal.stagedApp,
    remediation: journal.remediation,
    installedBefore: journal.expected.installedBefore,
    previousBefore: journal.expected.previousBefore,
    legacyPreviousBefore: journal.expected.legacyPreviousBefore,
    installedAfter: state.installed,
    previousAfter: state.previous,
    completedAt: dependencies.now()
  });
  dependencies.checkpoint("before-exchange-manifest-write");
  dependencies.writeManifestExclusive(journal.manifestPath, manifest);
  dependencies.checkpoint("after-exchange-manifest-write-before-journal");
  const manifestSha256 = sha256(journal.manifestPath);
  return updatePromotionJournalPhase(dependencies, journalPath, journal, "manifest-published", { manifestSha256 });
}

function cleanupCompletedPromotion({ dependencies, journal, journalPath }) {
  if (existsSync(journal.stagingRoot)) {
    dependencies.removeDurably(journal.stagingRoot);
  }
  const afterCleanup = updatePromotionJournalPhase(dependencies, journalPath, journal, "stage-cleaned");
  dependencies.removeDurably(journalPath);
  return afterCleanup;
}

export function recoverPromotionTransaction({
  journalPath = promotionExchangeJournalPath,
  dependencies: dependencyOverrides = {}
} = {}) {
  const dependencies = promotionInstallDependencies(dependencyOverrides);
  if (!existsSync(journalPath)) throw new Error(`Promotion journal is missing: ${journalPath}`);
  let journal = readJson(journalPath);
  const state = inspectPromotionTransaction(journal, dependencies.inspectBundle);

  if (state.state === "original-roles") {
    if (existsSync(journal.stagingRoot)) dependencies.removeDurably(journal.stagingRoot);
    if (journal.remediation?.targetParentQuarantine?.before) {
      restoreTargetParentQuarantine({
        dependencies,
        targetParent: journal.remediation.targetParent,
        expectedValue: journal.remediation.targetParentQuarantine.before
      });
    }
    journal = updatePromotionJournalPhase(dependencies, journalPath, journal, "aborted-before-exchange");
    dependencies.removeDurably(journalPath);
    return {
      disposition: "aborted-before-exchange",
      mutationPerformed: false,
      remediationRetained: journal.remediation?.legacyPrevious?.migrated === true
    };
  }

  if (state.state === "after-first-exchange") {
    journal = updatePromotionJournalPhase(dependencies, journalPath, journal, "recovering-after-first-exchange");
    if (journal.expected.previousBefore) {
      dependencies.atomicSwap(journal.stagedApp, journal.backupTarget, {
        leftObject: state.stage.rootObject,
        rightObject: state.previous.rootObject
      });
    } else {
      renameSync(journal.stagedApp, journal.backupTarget);
    }
    journal = updatePromotionJournalPhase(dependencies, journalPath, journal, "exchange-complete");
  } else if (state.state !== "complete") {
    throw new Error(`Promotion journal state is not safely recoverable: ${state.state}`);
  }

  journal = finalizePromotionLaunchServices({ dependencies, journal, journalPath });
  journal = publishPromotionExchangeManifest({ dependencies, journal, journalPath });
  cleanupCompletedPromotion({ dependencies, journal, journalPath });
  return { disposition: "completed-after-interrupted-exchange", mutationPerformed: true, manifestPath: journal.manifestPath };
}

export function installApp({ sourceApp, target, dependencies = {} }) {
  const resolvedDependencies = promotionInstallDependencies(dependencies);
  const targetParent = path.dirname(target);
  const backupTarget = previousBackupPathForTarget(target);
  const legacyBackupTarget = legacyPreviousAppPathForTarget(target);
  const operationId = resolvedDependencies.createOperationId();
  const transactionPaths = resolvedDependencies.promotionTransactionPaths(operationId);
  const journalPath = transactionPaths.journalPath;
  const exchangeManifestPath = transactionPaths.manifestPath;
  let stagingRoot;
  let stagedApp;
  let journal;
  let journalCreated = false;
  let transactionCompleted = false;

  try {
    assertRealDirectory(targetParent, "Local stable target parent");
    assertNoPromotionResidue(targetParent);
    assertNoPromotionTransactionResidue({ journalPath, manifestPath: exchangeManifestPath });

    const sourceIdentity = resolvedDependencies.inspectBundle(sourceApp);
    const installStatePlan = resolvedDependencies.planLaunchServicesInstallState({
      target,
      backupTarget,
      legacyBackupTarget,
      sourceApp,
      sourceIdentity,
      targetParent,
      readXattr: resolvedDependencies.readXattr,
      readBundleIdentifier: resolvedDependencies.readBundleIdentifier,
      readLaunchServicesRecords: resolvedDependencies.readLaunchServicesRecords,
      pathExists: resolvedDependencies.pathExists,
      listDirectory: resolvedDependencies.listDirectory
    });
    resolvedDependencies.preflightDestination(targetParent);
    assertNoPromotionResidue(targetParent);

    stagedApp = resolvedDependencies.createStagedAppPath(targetParent, operationId);
    if (!path.isAbsolute(stagedApp)) throw new Error(`Promotion staged app must be absolute: ${stagedApp}`);
    if (path.dirname(stagedApp) !== targetParent) {
      throw new Error(`Promotion staged app must share target parent: ${stagedApp}`);
    }
    if (existsSync(stagedApp)) throw new Error(`Promotion staging app already exists: ${stagedApp}`);
    stagingRoot = stagedApp;

    resolvedDependencies.copyBundle(sourceApp, stagedApp);
    resolvedDependencies.clearQuarantine(stagedApp);
    resolvedDependencies.validateIdentity(stagedApp);
    const stagedIdentity = resolvedDependencies.inspectBundle(stagedApp);
    assertSameAppPayload(sourceIdentity, stagedIdentity, "Staged candidate");

    resolvedDependencies.checkpoint("after-staged-candidate-validation");
    const installedBefore = existsSync(target) ? resolvedDependencies.inspectBundle(target) : null;
    const legacyPreviousBefore = installStatePlan.migrateLegacyPrevious
      ? resolvedDependencies.inspectBundle(legacyBackupTarget)
      : null;
    let previousBefore = existsSync(backupTarget)
      ? resolvedDependencies.inspectBundle(backupTarget)
      : legacyPreviousBefore;
    const remediation = {
      targetParent,
      targetParentQuarantine: {
        name: "com.apple.quarantine",
        before: installStatePlan.targetParentQuarantine,
        after: installStatePlan.targetParentQuarantine ? null : null,
        applied: false
      },
      legacyPrevious: {
        from: legacyBackupTarget,
        to: backupTarget,
        required: installStatePlan.migrateLegacyPrevious,
        migrated: false
      },
      launchServices: {
        bundleIdentifier: installStatePlan.bundleIdentifier,
        recordsBefore: installStatePlan.launchServices.records,
        removals: installStatePlan.launchServices.removals,
        applied: false,
        recordsAfterRemediation: null,
        postRegistration: null
      }
    };
    journal = buildPromotionJournal({
      operationId,
      target,
      backupTarget,
      legacyBackupTarget,
      sourceApp,
      stagingRoot,
      stagedApp,
      manifestPath: exchangeManifestPath,
      remediation,
      sourceIdentity,
      stagedIdentity,
      installedBefore,
      previousBefore,
      legacyPreviousBefore,
      phase: "staged",
      now: resolvedDependencies.now()
    });
    resolvedDependencies.writeJournalInitial(journalPath, journal);
    journalCreated = true;
    resolvedDependencies.checkpoint("after-promotion-journal");

    if (installStatePlan.migrateLegacyPrevious) {
      if (existsSync(backupTarget)) throw new Error(`Inert previous bundle already exists before migration: ${backupTarget}`);
      resolvedDependencies.checkpoint("before-legacy-previous-migration");
      resolvedDependencies.renameDurably(legacyBackupTarget, backupTarget);
      resolvedDependencies.checkpoint("after-legacy-previous-migration");
      const migratedPrevious = resolvedDependencies.inspectBundle(backupTarget);
      assertSameAppPayload(legacyPreviousBefore, migratedPrevious, "Migrated legacy previous bundle");
      previousBefore = migratedPrevious;
      remediation.legacyPrevious.migrated = true;
      journal = updatePromotionJournalPhase(resolvedDependencies, journalPath, {
        ...journal,
        expected: {
          ...journal.expected,
          previousBefore: compactAppIdentity(previousBefore)
        },
        remediation
      }, "legacy-previous-migrated");
    }

    if (installStatePlan.targetParentQuarantine) {
      journal = updatePromotionJournalPhase(resolvedDependencies, journalPath, {
        ...journal,
        remediation
      }, "target-parent-quarantine-remediation-planned");
    }
    const quarantineRemediation = applyTargetParentQuarantineRemediation({
      dependencies: resolvedDependencies,
      targetParent,
      expectedValue: installStatePlan.targetParentQuarantine
    });
    if (quarantineRemediation.mutationPerformed) {
      remediation.targetParentQuarantine.applied = true;
      remediation.targetParentQuarantine.after = quarantineRemediation.after;
      journal = updatePromotionJournalPhase(resolvedDependencies, journalPath, {
        ...journal,
        remediation
      }, "target-parent-quarantine-remediated");
      resolvedDependencies.checkpoint("after-target-parent-quarantine-remediation");
    }

    if (remediation.launchServices.removals.length > 0) {
      journal = updatePromotionJournalPhase(resolvedDependencies, journalPath, {
        ...journal,
        remediation
      }, "launch-services-stale-record-remediation-planned");
    }
    const launchServicesRemediation = applyLaunchServicesRecordRemediation({
      dependencies: resolvedDependencies,
      plan: installStatePlan.launchServices
    });
    remediation.launchServices.applied = launchServicesRemediation.applied;
    remediation.launchServices.removals = launchServicesRemediation.removals;
    remediation.launchServices.recordsAfterRemediation = launchServicesRemediation.recordsAfter;
    journal = updatePromotionJournalPhase(resolvedDependencies, journalPath, {
      ...journal,
      remediation
    }, "launch-services-stale-records-remediated");
    resolvedDependencies.checkpoint("after-launch-services-stale-record-remediation");

    if (installedBefore) {
      assertRealDirectory(target, "Installed app");
      if (previousBefore) assertRealDirectory(backupTarget, "Previous app");
      resolvedDependencies.checkpoint("before-first-exchange");
      resolvedDependencies.atomicSwap(stagedApp, target, {
        leftObject: stagedIdentity.rootObject,
        rightObject: installedBefore.rootObject
      });
      journal = updatePromotionJournalPhase(resolvedDependencies, journalPath, journal, "first-exchange-complete");
      resolvedDependencies.checkpoint("after-first-exchange");
      const installedAfter = resolvedDependencies.inspectBundle(target);
      const displacedInstalled = resolvedDependencies.inspectBundle(stagedApp);
      assertSameAppPayload(stagedIdentity, installedAfter, "Installed app after promotion");
      assertSameAppPayload(installedBefore, displacedInstalled, "Displaced installed app");

      if (previousBefore) {
        resolvedDependencies.checkpoint("before-second-exchange");
        resolvedDependencies.atomicSwap(stagedApp, backupTarget, {
          leftObject: displacedInstalled.rootObject,
          rightObject: previousBefore.rootObject
        });
      } else {
        renameSync(stagedApp, backupTarget);
      }
      journal = updatePromotionJournalPhase(resolvedDependencies, journalPath, journal, "exchange-complete");
      resolvedDependencies.checkpoint("after-second-exchange");
      const previousAfter = resolvedDependencies.inspectBundle(backupTarget);
      assertSameAppPayload(installedBefore, previousAfter, "Previous app after promotion");
    } else {
      resolvedDependencies.checkpoint("before-first-install");
      renameSync(stagedApp, target);
      journal = updatePromotionJournalPhase(resolvedDependencies, journalPath, journal, "exchange-complete");
      resolvedDependencies.checkpoint("after-first-install");
      const installedAfter = resolvedDependencies.inspectBundle(target);
      assertSameAppPayload(stagedIdentity, installedAfter, "Installed app after first promotion");
    }

    journal = finalizePromotionLaunchServices({ dependencies: resolvedDependencies, journal, journalPath });
    const launchServicesPostcheck = journal.remediation.launchServices.postRegistration;
    journal = publishPromotionExchangeManifest({ dependencies: resolvedDependencies, journal, journalPath });
    resolvedDependencies.checkpoint("after-exchange-manifest");
    cleanupCompletedPromotion({ dependencies: resolvedDependencies, journal, journalPath });
    transactionCompleted = true;
    resolvedDependencies.validateIdentity(target);
    return {
      backupTarget: existsSync(backupTarget) ? backupTarget : undefined,
      launchServicesRegistered: journal.launchServicesRegistered === true,
      launchServicesPostcheck
    };
  } finally {
    if (stagingRoot && !journalCreated && !transactionCompleted) {
      rmSync(stagingRoot, { recursive: true, force: true });
    }
  }
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

export function recoverPromotionCommand({
  journalPath = promotionExchangeJournalPath,
  dependencies = {},
  writeOutput = (value) => console.log(JSON.stringify(value, null, 2))
} = {}) {
  const result = recoverPromotionTransaction({ journalPath, dependencies });
  const summary = {
    schemaVersion: 1,
    mode: "recover-promotion",
    ...result
  };
  writeOutput(summary);
  return summary;
}

export async function runCli(argv = process.argv.slice(2), env = process.env, hooks = {}) {
  const options = parseArgs(argv, env);
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

  if (options.recoverPromotion) {
    recoverPromotionCommand({
      journalPath: hooks.promotionJournalPath,
      dependencies: hooks.promotionRecoveryDependencies ?? {},
      writeOutput: hooks.writeOutput
    });
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
    launchServicesRegistered: installInfo.launchServicesRegistered,
    launchServicesPostcheck: installInfo.launchServicesPostcheck,
    distribution: packageInfo.manifest.distribution,
    productionApproved: packageInfo.manifest.productionApproved
  };
  writePromotionManifest(summary);
  console.log(JSON.stringify(summary, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
