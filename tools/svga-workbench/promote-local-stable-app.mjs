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

function buildPromotionExchangeManifest({
  operationId,
  target,
  backupTarget,
  sourceApp,
  stagedApp,
  installedBefore,
  previousBefore,
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
    sourceApp,
    stagedApp,
    before: {
      installed: compactAppIdentity(installedBefore),
      previous: compactAppIdentity(previousBefore)
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
  sourceApp,
  stagingRoot,
  stagedApp,
  manifestPath,
  sourceIdentity,
  stagedIdentity,
  installedBefore,
  previousBefore,
  phase,
  now
}) {
  return {
    schemaVersion: 1,
    operation: "promote-local-stable-install-journal",
    operationId,
    target,
    backupTarget,
    sourceApp,
    stagingRoot,
    stagedApp,
    manifestPath,
    retrySafe: false,
    invocationCount: 1,
    phase,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expected: {
      source: compactAppIdentity(sourceIdentity),
      stagedCandidate: compactAppIdentity(stagedIdentity),
      installedBefore: compactAppIdentity(installedBefore),
      previousBefore: compactAppIdentity(previousBefore)
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

function classifyPromotionTransaction({ installed, previous, stage, expected }) {
  const original = appPayloadMatches(installed, expected.installedBefore)
    && appPayloadMatches(previous, expected.previousBefore)
    && appPayloadMatches(stage, expected.stagedCandidate);
  if (original) return "original-roles";

  const afterFirstExchange = appPayloadMatches(installed, expected.stagedCandidate)
    && appPayloadMatches(previous, expected.previousBefore)
    && appPayloadMatches(stage, expected.installedBefore);
  if (afterFirstExchange) return "after-first-exchange";

  const complete = appPayloadMatches(installed, expected.stagedCandidate)
    && appPayloadMatches(previous, expected.installedBefore)
    && (!stage || appPayloadMatches(stage, expected.previousBefore));
  if (complete) return "complete";

  return "ambiguous-role-bytes";
}

function inspectPromotionTransaction(journal, inspectBundle) {
  const installed = inspectIfExists(journal.target, inspectBundle);
  const previous = inspectIfExists(journal.backupTarget, inspectBundle);
  const stage = inspectIfExists(journal.stagedApp, inspectBundle);
  return {
    installed,
    previous,
    stage,
    state: classifyPromotionTransaction({
      installed,
      previous,
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
    copyBundle: (source, destination) => run("/usr/bin/ditto", [source, destination], { stdio: "inherit" }),
    createOperationId: defaultPromotionOperationId,
    createStagedAppPath: defaultPromotionStagedAppPath,
    inspectBundle: inspectAppBundle,
    promotionTransactionPaths: defaultPromotionTransactionPaths,
    preflightDestination: assertDestinationWritable,
    removeDurably,
    updateJournal: replaceJsonDurably,
    validateIdentity: validateAppIdentity,
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
    sourceApp: journal.sourceApp,
    stagedApp: journal.stagedApp,
    installedBefore: journal.expected.installedBefore,
    previousBefore: journal.expected.previousBefore,
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
    journal = updatePromotionJournalPhase(dependencies, journalPath, journal, "aborted-before-exchange");
    dependencies.removeDurably(journalPath);
    return { disposition: "aborted-before-exchange", mutationPerformed: false };
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

  journal = publishPromotionExchangeManifest({ dependencies, journal, journalPath });
  cleanupCompletedPromotion({ dependencies, journal, journalPath });
  return { disposition: "completed-after-interrupted-exchange", mutationPerformed: true, manifestPath: journal.manifestPath };
}

export function installApp({ sourceApp, target, dependencies = {} }) {
  const resolvedDependencies = promotionInstallDependencies(dependencies);
  const targetParent = path.dirname(target);
  const backupTarget = path.join(targetParent, "Auto SVGA.previous.app");
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
    const previousBefore = existsSync(backupTarget) ? resolvedDependencies.inspectBundle(backupTarget) : null;
    journal = buildPromotionJournal({
      operationId,
      target,
      backupTarget,
      sourceApp,
      stagingRoot,
      stagedApp,
      manifestPath: exchangeManifestPath,
      sourceIdentity,
      stagedIdentity,
      installedBefore,
      previousBefore,
      phase: "staged",
      now: resolvedDependencies.now()
    });
    resolvedDependencies.writeJournalInitial(journalPath, journal);
    journalCreated = true;
    resolvedDependencies.checkpoint("after-promotion-journal");

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

    journal = publishPromotionExchangeManifest({ dependencies: resolvedDependencies, journal, journalPath });
    resolvedDependencies.checkpoint("after-exchange-manifest");
    cleanupCompletedPromotion({ dependencies: resolvedDependencies, journal, journalPath });
    transactionCompleted = true;
    resolvedDependencies.validateIdentity(target);
    return { backupTarget: existsSync(backupTarget) ? backupTarget : undefined };
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
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
