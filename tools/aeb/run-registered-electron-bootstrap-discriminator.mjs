#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  constants as fsConstants,
  createReadStream,
  existsSync,
} from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  readlink,
  realpath,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const CONTRACT = Object.freeze({
  schema: "auto-svga-registered-electron-bootstrap-runner-v0",
  sourceHead: "57d27079d7db8812963d5e7cd0f2b085683c2524",
  worktree: "/Users/huangtengxin/.codex/worktrees/448e/auto-svga",
  branch: "codex/aeb-package-tree-runtime-authority-successor-20260717",
  taskRoot: "/private/tmp/auto-svga-aeb-d001-8594bcfa",
  taskRootMode: 0o700,
  electronApp:
    "/Users/huangtengxin/Documents/auto-svga/tools/electron-prototype/node_modules/electron/dist/Electron.app",
  comparisonElectronApp:
    "/Users/huangtengxin/.codex/worktrees/d657/auto-svga/tools/electron-prototype/node_modules/electron/dist/Electron.app",
  bundleId: "com.github.Electron",
  version: "42.4.1",
  build: "42.4.1",
  executableRelativePath: "Contents/MacOS/Electron",
  expectedTreeManifestSha256: "063c5dd762d2ed0bca66777f6fa97a86276de62fef80e1e80cc68cfad78c12df",
  expectedTreeEntryCount: 272,
  expectedBootstrapSha256: "b03895dd1f405d87289fc67f1382457ad6b957eb1334a7ac2275de730bc78e21",
  expectedEvidenceStoreSha256: "1bafafae217bf915239fdb1d554795eeedb6d2022898938228e06d0164d204c9",
  expectedStrictCodeSignStatus: 1,
  expectedStrictCodeSignIssue: "missing_resources",
  expectedRootQuarantinePresent: false,
  expectedExecutableQuarantinePresent: false,
  firstJavaScriptTimeoutMs: 10_000,
  appReadyTimeoutMs: 15_000,
  legalQuitTimeoutMs: 25_000,
  zeroResidueTimeoutMs: 30_000,
  crashReportSettleDelayMs: 2_000,
  preflightMaxAgeMs: 30_000,
  passiveSampleCaptureWindowMs: 5_000,
  processAuthorityMaxAgeMs: 30_000,
  runtimePendingMaxAgeMs: 30_000,
  runtimeFutureSkewMs: 2_000,
  runtimeMaxDurationMs: 75_000,
  processAuthorityMaxBytes: 5 * 1024 * 1024,
  processAuthorityBaseRoot: "/private/tmp/auto-svga-aeb-d001-8594bcfa/process-authority",
  processAuthoritySchema: "auto-svga-aeb-process-authority-v1",
  producerSourceHead: "f2268f569017c46dc4e61a0681ff824e35844413",
  producerScriptPath:
    "/Users/huangtengxin/Documents/auto-svga/tools/aeb/capture-aeb-process-authority.py",
  producerScriptSha256: "9ed0d47c5d4fe7bd8be4990fd3a84fbf5006230483142e92bddffa84c62506a5",
  producerTestSha256: "31b858415fb559fd684e8fd091fefcd3850668033ee230007f0dbebec3625f41",
  processAuthorityTargetNames: Object.freeze([
    "Electron",
    "Electron Helper",
    "Electron Helper (GPU)",
    "Electron Helper (Plugin)",
    "Electron Helper (Renderer)",
  ]),
  processAuthorityLaunchctlNeedles: Object.freeze([
    "/Users/huangtengxin/Documents/auto-svga/tools/electron-prototype/node_modules/electron/dist/Electron.app",
    "com.github.Electron",
  ]),
  crashReportDirectory: "/Users/huangtengxin/Library/Logs/DiagnosticReports",
});

const SCRIPT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const BOOTSTRAP_PATH = path.join(SCRIPT_ROOT, "electron-bootstrap.cjs");
const TEST_PATH = path.join(SCRIPT_ROOT, "run-registered-electron-bootstrap-discriminator.test.mjs");
const FINALIZER_PATH = path.join(SCRIPT_ROOT, "finalize-registered-electron-bootstrap-discriminator.mjs");
const EVIDENCE_STORE_PATH = path.join(SCRIPT_ROOT, "registered-electron-evidence-store.py");
const ORCHESTRATOR_PATH = path.join(SCRIPT_ROOT, "orchestrate-registered-electron-bootstrap-lifecycle.mjs");
const LIFECYCLE_TEST_PATH = path.join(SCRIPT_ROOT, "orchestrate-registered-electron-bootstrap-lifecycle.test.mjs");
const RELAY_PUBLISHER_PATH = path.join(SCRIPT_ROOT, "publish-registered-electron-postrun-relay.py");
const PERMIT_PACKET_PATH = path.join(SCRIPT_ROOT, "aeb-registered-fixture-proof-contract.cjs");
const SOURCE_BINDING_REPORT_PATH = path.join(SCRIPT_ROOT, "source-binding-report.json");
const OPEN_PATH = "/usr/bin/open";

export class PermitError extends Error {
  constructor(issueCode, message, details = {}) {
    super(message);
    this.name = "PermitError";
    this.issueCode = issueCode;
    this.details = details;
  }
}

function reject(issueCode, message, details) {
  throw new PermitError(issueCode, message, details);
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function sha256File(filePath) {
  const hash = createHash("sha256");
  await new Promise((resolve, rejectPromise) => {
    const input = createReadStream(filePath);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("error", rejectPromise);
    input.on("end", resolve);
  });
  return hash.digest("hex");
}

async function walkTree(root, current, entries) {
  const names = await readdir(current);
  names.sort((left, right) => left.localeCompare(right));
  for (const name of names) {
    const absolutePath = path.join(current, name);
    const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
    const fileStat = await lstat(absolutePath);
    if (fileStat.isDirectory()) {
      await walkTree(root, absolutePath, entries);
      continue;
    }
    if (fileStat.isFile()) {
      entries.push({
        type: "file",
        relativePath,
        byteLength: fileStat.size,
        sha256: await sha256File(absolutePath),
      });
      continue;
    }
    if (fileStat.isSymbolicLink()) {
      entries.push({
        type: "symlink",
        relativePath,
        target: await readlink(absolutePath),
      });
      continue;
    }
    reject("electron_tree_special_file", "Electron distribution contains a special file", {
      relativePath,
    });
  }
}

export async function snapshotElectronTree(appPath) {
  const rootStat = await lstat(appPath);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    reject("electron_app_not_regular_directory", "Electron app root is not a regular directory");
  }
  const entries = [];
  await walkTree(appPath, appPath, entries);
  const manifestLines = entries.map((entry) =>
    entry.type === "file"
      ? `F\t${entry.relativePath}\t${entry.byteLength}\t${entry.sha256}`
      : `L\t${entry.relativePath}\t${entry.target}`,
  );
  return {
    entryCount: entries.length,
    fileCount: entries.filter((entry) => entry.type === "file").length,
    symlinkCount: entries.filter((entry) => entry.type === "symlink").length,
    totalFileBytes: entries
      .filter((entry) => entry.type === "file")
      .reduce((total, entry) => total + entry.byteLength, 0),
    manifestSha256: sha256Text(`${manifestLines.join("\n")}\n`),
  };
}

function runReadOnly(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  return {
    command,
    args,
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    errorCode: result.error && result.error.code ? result.error.code : null,
  };
}

function parsePlist(appPath) {
  const plistPath = path.join(appPath, "Contents/Info.plist");
  const result = runReadOnly("/usr/bin/plutil", ["-convert", "json", "-o", "-", plistPath]);
  if (result.status !== 0) {
    reject("electron_plist_unreadable", "Electron Info.plist could not be read");
  }
  return JSON.parse(result.stdout);
}

function inspectQuarantine(filePath) {
  const result = runReadOnly("/usr/bin/xattr", ["-p", "com.apple.quarantine", filePath]);
  if (result.status === 0) {
    return {
      present: true,
      valueSha256: sha256Text(result.stdout),
    };
  }
  if (result.status === 1 && result.stderr.includes("No such xattr")) {
    return {
      present: false,
      valueSha256: null,
    };
  }
  reject("electron_quarantine_probe_failed", "Electron quarantine metadata could not be read", {
    status: result.status,
    errorCode: result.errorCode,
  });
}

export async function inspectElectronDistribution(appPath) {
  const canonicalPath = await realpath(appPath);
  if (canonicalPath !== appPath) {
    reject("electron_app_alias", "Electron app path is not canonical");
  }
  const plist = parsePlist(appPath);
  const executablePath = path.join(appPath, CONTRACT.executableRelativePath);
  const executableStat = await lstat(executablePath);
  if (!executableStat.isFile() || executableStat.isSymbolicLink()) {
    reject("electron_executable_not_regular", "Electron executable is not a regular file");
  }
  const tree = await snapshotElectronTree(appPath);
  const codeSignDisplay = runReadOnly("/usr/bin/codesign", ["-dv", "--verbose=4", appPath]);
  const strictCodeSign = runReadOnly("/usr/bin/codesign", [
    "--verify",
    "--deep",
    "--strict",
    "--verbose=2",
    appPath,
  ]);
  const rootQuarantine = inspectQuarantine(appPath);
  const executableQuarantine = inspectQuarantine(executablePath);
  return {
    appPath,
    executablePath,
    bundleId: plist.CFBundleIdentifier || null,
    version: plist.CFBundleShortVersionString || null,
    build: plist.CFBundleVersion || null,
    executableName: plist.CFBundleExecutable || null,
    executableByteLength: executableStat.size,
    executableSha256: await sha256File(executablePath),
    infoPlistSha256: await sha256File(path.join(appPath, "Contents/Info.plist")),
    tree,
    codeSignDisplayStatus: codeSignDisplay.status,
    codeSignDisplaySha256: sha256Text(`${codeSignDisplay.stdout}${codeSignDisplay.stderr}`),
    strictCodeSignStatus: strictCodeSign.status,
    strictCodeSignOutputSha256: sha256Text(`${strictCodeSign.stdout}${strictCodeSign.stderr}`),
    strictCodeSignIssue:
      strictCodeSign.status === 1 &&
      strictCodeSign.stderr.includes("code has no resources but signature indicates they must be present")
        ? "missing_resources"
        : strictCodeSign.status === 0
          ? "pass"
          : "other_failure",
    rootQuarantine,
    executableQuarantine,
  };
}

function parseIpsText(text, basename) {
  const newline = text.indexOf("\n");
  if (newline < 0) {
    reject("crash_report_malformed", "Crash report is missing its JSON body", { basename });
  }
  const header = JSON.parse(text.slice(0, newline));
  const body = JSON.parse(text.slice(newline + 1));
  const triggeredThread = Array.isArray(body.threads)
    ? body.threads.find((thread) => thread && thread.triggered)
    : null;
  const symbols = triggeredThread && Array.isArray(triggeredThread.frames)
    ? triggeredThread.frames.map((frame) => frame.symbol).filter(Boolean)
    : [];
  return {
    basename,
    incidentId: header.incident_id || body.incident || null,
    timestamp: header.timestamp || body.captureTime || null,
    appName: header.app_name || body.procName || null,
    appVersion: header.app_version || null,
    bundleId: header.bundleID || (body.bundleInfo && body.bundleInfo.CFBundleIdentifier) || null,
    coalitionName: body.coalitionName || null,
    signal: body.exception && body.exception.signal ? body.exception.signal : null,
    terminationIndicator:
      body.termination && body.termination.indicator ? body.termination.indicator : null,
    triggeredSymbols: symbols.slice(0, 16),
  };
}

export async function collectCrashContext(crashDirectory = CONTRACT.crashReportDirectory) {
  const directoryEntries = await readdir(crashDirectory, { withFileTypes: true });
  const names = directoryEntries
    .filter((entry) => entry.isFile() && /^Electron-2026-07-14-\d{6}\.ips$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const reports = [];
  for (const basename of names) {
    const filePath = path.join(crashDirectory, basename);
    const text = await readFile(filePath, "utf8");
    reports.push({
      ...parseIpsText(text, basename),
      byteLength: Buffer.byteLength(text),
      sha256: sha256Text(text),
    });
  }
  return {
    reportCount: reports.length,
    reports,
    allSigabrt: reports.length > 0 && reports.every((report) => report.signal === "SIGABRT"),
    allCodexCoalition:
      reports.length > 0 && reports.every((report) => report.coalitionName === "com.openai.codex"),
    allRegisterApplicationStack:
      reports.length > 0 && reports.every((report) =>
        report.triggeredSymbols.includes("_RegisterApplication") &&
        report.triggeredSymbols.includes("-[NSApplication init]") &&
        report.triggeredSymbols.includes("+[NSApplication sharedApplication]"),
      ),
  };
}

function validateControlSample(sample, index, failures, nowMs) {
  const sampleCapturedAt = Date.parse(sample && sample.capturedAtUtc ? sample.capturedAtUtc : "");
  if (
    !Number.isFinite(sampleCapturedAt) ||
    sampleCapturedAt > nowMs ||
    nowMs - sampleCapturedAt > CONTRACT.preflightMaxAgeMs ||
    sample.foregroundLeaseConflict !== false ||
    sample.competingForegroundWorker !== false ||
    sample.modalState !== "clear" ||
    sample.keychainPromptState !== "absent" ||
    sample.runtimeApprovalPopupState !== "absent"
  ) {
    failures.push({
      field: `controlStabilitySamples[${index}]`,
      expected: "fresh ordered clear control sample",
      actual: sample,
    });
  }
  return sampleCapturedAt;
}

export function validatePreflightRelay(relay, expected) {
  const failures = [];
  const nowMs = expected.nowMs ?? Date.now();
  const capturedAt = Date.parse(relay.capturedAtUtc || "");
  const requireEqual = (field, actual, wanted) => {
    if (actual !== wanted) {
      failures.push({ field, expected: wanted, actual });
    }
  };
  requireEqual("schema", relay.schema, "aeb-pm-registered-electron-bootstrap-preflight-v1");
  requireEqual("permitId", relay.permitId, expected.permitId);
  requireEqual("executionId", relay.executionId, expected.executionId);
  requireEqual("sourceHead", relay.sourceHead, CONTRACT.sourceHead);
  requireEqual("packetHead", relay.packetHead, expected.packetHead);
  requireEqual("currentHead", relay.currentHead, expected.currentHead);
  requireEqual("electronApp", relay.electronApp, CONTRACT.electronApp);
  requireEqual("outputRoot", relay.outputRoot, expected.outputRoot);
  requireEqual("mutationPerformed", relay.mutationPerformed, false);
  requireEqual("foregroundLeaseConflict", relay.foregroundLeaseConflict, false);
  requireEqual("competingForegroundWorker", relay.competingForegroundWorker, false);
  requireEqual("modalState", relay.modalState, "clear");
  requireEqual("keychainPromptState", relay.keychainPromptState, "absent");
  requireEqual("runtimeApprovalPopupState", relay.runtimeApprovalPopupState, "absent");
  requireEqual("commandApprovalDecision", relay.commandApprovalDecision, "single_use_permit_active");
  requireEqual("registeredLaunchAllowed", relay.registeredLaunchAllowed, true);
  requireEqual("runnerSha256", relay.runnerSha256, expected.packetMaterialHashes.runnerSha256);
  requireEqual("bootstrapSha256", relay.bootstrapSha256, expected.packetMaterialHashes.bootstrapSha256);
  requireEqual("testSha256", relay.testSha256, expected.packetMaterialHashes.testSha256);
  requireEqual("permitPacketSha256", relay.permitPacketSha256, expected.packetMaterialHashes.permitPacketSha256);
  requireEqual("finalizerSha256", relay.finalizerSha256, expected.packetMaterialHashes.finalizerSha256);
  requireEqual("evidenceStoreSha256", relay.evidenceStoreSha256, expected.packetMaterialHashes.evidenceStoreSha256);
  requireEqual("orchestratorSha256", relay.orchestratorSha256, expected.packetMaterialHashes.orchestratorSha256);
  requireEqual("lifecycleTestSha256", relay.lifecycleTestSha256, expected.packetMaterialHashes.lifecycleTestSha256);
  requireEqual("relayPublisherSha256", relay.relayPublisherSha256, expected.packetMaterialHashes.relayPublisherSha256);
  const authorityBinding = relay.prelaunchProcessAuthority;
  const wantedAuthorityBinding = expected.prelaunchProcessAuthority;
  for (const field of [
    "producerSourceHead",
    "producerSchema",
    "producerScriptSha256",
    "producerTestSha256",
    "producerExitStatus",
    "artifactSha256",
    "invocationSha256",
    "targetRootsSha256",
    "targetNamesSha256",
    "forbiddenPidsSha256",
    "launchctlNeedlesSha256",
  ]) {
    requireEqual(
      `prelaunchProcessAuthority.${field}`,
      authorityBinding && authorityBinding[field],
      wantedAuthorityBinding && wantedAuthorityBinding[field],
    );
  }
  if (!Array.isArray(relay.controlStabilitySamples) || relay.controlStabilitySamples.length !== 2) {
    failures.push({
      field: "controlStabilitySamples",
      expected: "exactly two clear control samples",
      actual: relay.controlStabilitySamples,
    });
  } else {
    let previousCapturedAt = null;
    for (let index = 0; index < relay.controlStabilitySamples.length; index += 1) {
      const sample = relay.controlStabilitySamples[index];
      const sampleCapturedAt = validateControlSample(sample, index, failures, nowMs);
      if (previousCapturedAt !== null && sampleCapturedAt <= previousCapturedAt) {
        failures.push({ field: `controlStabilitySamples[${index}].capturedAtUtc`, expected: "strictly ordered", actual: sample.capturedAtUtc });
      }
      previousCapturedAt = sampleCapturedAt;
    }
    const finalSampleAt = Date.parse(relay.controlStabilitySamples[1].capturedAtUtc || "");
    if (
      !Number.isFinite(capturedAt) ||
      !Number.isFinite(finalSampleAt) ||
      finalSampleAt > capturedAt ||
      capturedAt - finalSampleAt > CONTRACT.passiveSampleCaptureWindowMs
    ) {
      failures.push({
        field: "controlStabilitySamples[1].capturedAtUtc",
        expected: "not later than relay capture and within the same five-second capture window",
        actual: relay.controlStabilitySamples[1].capturedAtUtc,
      });
    }
  }
  if (!Number.isFinite(capturedAt) || capturedAt > nowMs || nowMs - capturedAt > CONTRACT.preflightMaxAgeMs) {
    failures.push({ field: "capturedAtUtc", expected: "fresh and not future", actual: relay.capturedAtUtc });
  }
  if (failures.length > 0) {
    reject("preflight_relay_rejected", "PM preflight relay did not satisfy every no-action gate", {
      failures,
    });
  }
  return true;
}

export async function validateFreshOutputRoot(outputRoot, taskRoot = CONTRACT.taskRoot) {
  const resolvedRoot = path.resolve(outputRoot);
  const resolvedTaskRoot = path.resolve(taskRoot);
  if (path.dirname(resolvedRoot) !== resolvedTaskRoot) {
    reject("output_root_outside_task_root", "Output root must be a direct task-root child");
  }
  if (existsSync(resolvedRoot)) {
    reject("output_root_exists", "Output root must be absent before execution");
  }
  if (existsSync(resolvedTaskRoot)) {
    const taskStat = await lstat(resolvedTaskRoot);
    if (!taskStat.isDirectory() || taskStat.isSymbolicLink()) {
      reject("task_root_alias", "Task root must be a non-symlink directory");
    }
    if ((taskStat.mode & 0o777) !== CONTRACT.taskRootMode) {
      reject("task_root_mode_invalid", "Task root must be owned-mode 0700");
    }
    if ((await realpath(resolvedTaskRoot)) !== resolvedTaskRoot) {
      reject("task_root_alias", "Task root resolves outside its canonical path");
    }
  }
  return resolvedRoot;
}

async function validateBoundRegularFile(filePath, issueCode) {
  const fileStat = await lstat(filePath);
  if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
    reject(issueCode, "Bound file must be a regular non-symlink file");
  }
  if ((await realpath(filePath)) !== filePath) {
    reject(issueCode, "Bound file path is not canonical");
  }
  return fileStat;
}

function canonicalJsonSha256(value) {
  return sha256Text(JSON.stringify(value));
}

function exactArrayEqual(actual, expected) {
  return Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index]);
}

export function authorityPaths(executionId, baseRoot = CONTRACT.processAuthorityBaseRoot) {
  if (!/^[a-z0-9][a-z0-9-]{15,95}$/.test(executionId || "")) {
    reject("execution_id_invalid", "Execution id must be a bounded lowercase task identity");
  }
  const authorityRoot = path.join(baseRoot, executionId);
  return {
    authorityRoot,
    prelaunchArtifactPath: path.join(authorityRoot, "prelaunch-authority.json"),
    postrunArtifactPath: path.join(authorityRoot, "postrun-authority.json"),
    postrunRelayPath: path.join(authorityRoot, "postrun-finalization-relay.json"),
  };
}

async function lstatIfPresent(targetPath) {
  try {
    return await lstat(targetPath);
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function assertOwnedCanonicalDirectory(targetPath, {
  issuePrefix,
  expectedMode = CONTRACT.taskRootMode,
  ownerUid = typeof process.getuid === "function" ? process.getuid() : null,
}) {
  const targetStat = await lstat(targetPath);
  if (!targetStat.isDirectory() || targetStat.isSymbolicLink()) {
    reject(`${issuePrefix}_alias`, "Process authority directory must be a non-symlink directory");
  }
  if ((targetStat.mode & 0o777) !== expectedMode) {
    reject(`${issuePrefix}_mode_invalid`, "Process authority directory must be owned-mode 0700");
  }
  if (ownerUid !== null && targetStat.uid !== ownerUid) {
    reject(`${issuePrefix}_owner_invalid`, "Process authority directory owner did not match the runner user");
  }
  if ((await realpath(targetPath)) !== targetPath) {
    reject(`${issuePrefix}_alias`, "Process authority directory path is not canonical");
  }
  return targetStat;
}

export async function prepareProcessAuthorityRoot({
  executionId,
  baseRoot = CONTRACT.processAuthorityBaseRoot,
  taskRoot = CONTRACT.taskRoot,
  ownerUid = typeof process.getuid === "function" ? process.getuid() : null,
  requireAbsent = false,
  allowedExistingEntries = [],
} = {}) {
  const resolvedTaskRoot = path.resolve(taskRoot);
  const resolvedBaseRoot = path.resolve(baseRoot);
  if (path.dirname(resolvedBaseRoot) !== resolvedTaskRoot || path.basename(resolvedBaseRoot) !== "process-authority") {
    reject("process_authority_base_outside_task_root", "Process authority base must be the task-root process-authority child");
  }
  if ((await lstatIfPresent(resolvedTaskRoot)) === null) {
    reject("process_authority_task_root_missing", "Task root must exist before process authority publication");
  }
  await assertOwnedCanonicalDirectory(resolvedTaskRoot, {
    issuePrefix: "process_authority_task_root",
    ownerUid,
  });

  const paths = authorityPaths(executionId, resolvedBaseRoot);
  if (path.dirname(paths.authorityRoot) !== resolvedBaseRoot) {
    reject("process_authority_root_outside_base", "Process authority execution root must be a direct process-authority child");
  }

  const baseStat = await lstatIfPresent(resolvedBaseRoot);
  if (baseStat === null) {
    await mkdir(resolvedBaseRoot, { mode: CONTRACT.taskRootMode });
  }
  await assertOwnedCanonicalDirectory(resolvedBaseRoot, {
    issuePrefix: "process_authority_base",
    ownerUid,
  });

  let authorityRootCreated = false;
  const authorityStat = await lstatIfPresent(paths.authorityRoot);
  if (authorityStat === null) {
    await mkdir(paths.authorityRoot, { mode: CONTRACT.taskRootMode });
    authorityRootCreated = true;
  }
  await assertOwnedCanonicalDirectory(paths.authorityRoot, {
    issuePrefix: "process_authority_root",
    ownerUid,
  });
  if (requireAbsent && !authorityRootCreated) {
    reject("process_authority_root_exists", "Process authority execution root must be absent before this publication phase");
  }
  const entries = await readdir(paths.authorityRoot);
  const allowedEntries = new Set(allowedExistingEntries);
  if (entries.some((entry) => !allowedEntries.has(entry))) {
    reject("process_authority_root_not_fresh", "Process authority execution root must contain only approved phase artifacts before producer publication");
  }
  return {
    ...paths,
    baseRoot: resolvedBaseRoot,
    taskRoot: resolvedTaskRoot,
  };
}

export function buildProcessAuthorityInvocation({
  phase,
  executionId,
  expectedPid = null,
  baseRoot = CONTRACT.processAuthorityBaseRoot,
}) {
  const paths = authorityPaths(executionId, baseRoot);
  const artifactPath = phase === "prelaunch"
    ? paths.prelaunchArtifactPath
    : phase === "postrun"
      ? paths.postrunArtifactPath
      : reject("process_authority_phase_invalid", "Process authority phase must be prelaunch or postrun");
  const forbiddenPids = phase === "postrun" && expectedPid !== null ? [expectedPid] : [];
  if (forbiddenPids.some((pid) => !Number.isInteger(pid) || pid <= 0)) {
    reject("process_authority_pid_invalid", "Postrun authority requires the exact positive runtime PID");
  }
  const args = [CONTRACT.producerScriptPath, "--target-root", CONTRACT.electronApp];
  for (const name of CONTRACT.processAuthorityTargetNames) {
    args.push("--target-name", name);
  }
  for (const pid of forbiddenPids) {
    args.push("--forbid-pid", String(pid));
  }
  for (const needle of CONTRACT.processAuthorityLaunchctlNeedles) {
    args.push("--launchctl-needle", needle);
  }
  args.push(
    "--output", artifactPath,
    "--output-root", paths.authorityRoot,
    "--samples", "2",
    "--interval-ms", "250",
  );
  const invocation = { command: "/usr/bin/python3", args };
  return {
    ...invocation,
    artifactPath,
    authorityRoot: paths.authorityRoot,
    forbiddenPids,
    invocationSha256: canonicalJsonSha256(invocation),
  };
}

export function expectedAuthorityBinding({
  artifactSha256,
  invocationSha256,
  forbiddenPids,
}) {
  return {
    producerSourceHead: CONTRACT.producerSourceHead,
    producerSchema: CONTRACT.processAuthoritySchema,
    producerScriptSha256: CONTRACT.producerScriptSha256,
    producerTestSha256: CONTRACT.producerTestSha256,
    producerExitStatus: 0,
    artifactSha256,
    invocationSha256,
    targetRootsSha256: canonicalJsonSha256([CONTRACT.electronApp]),
    targetNamesSha256: canonicalJsonSha256([...CONTRACT.processAuthorityTargetNames]),
    forbiddenPidsSha256: canonicalJsonSha256(forbiddenPids),
    launchctlNeedlesSha256: canonicalJsonSha256([...CONTRACT.processAuthorityLaunchctlNeedles]),
  };
}

export async function readBoundedPrivateJson(
  filePath,
  expectedPath,
  issueCode = "private_evidence_invalid",
) {
  if (path.resolve(filePath) !== expectedPath) {
    reject(issueCode, "Private evidence path does not match the exact execution binding");
  }
  const initialPathStat = await lstat(filePath);
  if (!initialPathStat.isFile() || initialPathStat.isSymbolicLink() || (await realpath(filePath)) !== filePath) {
    reject(issueCode, "Private evidence must be a canonical regular non-symlink file");
  }
  const handle = await open(filePath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0));
  try {
    const openedStat = await handle.stat();
    if (!openedStat.isFile() || openedStat.size <= 0 || openedStat.size > CONTRACT.processAuthorityMaxBytes) {
      reject(issueCode, "Private evidence size is outside the bounded contract");
    }
    const buffer = Buffer.alloc(openedStat.size + 1);
    let bytesRead = 0;
    while (bytesRead < buffer.length) {
      const readResult = await handle.read(buffer, bytesRead, buffer.length - bytesRead, bytesRead);
      if (readResult.bytesRead === 0) {
        break;
      }
      bytesRead += readResult.bytesRead;
    }
    const postStat = await handle.stat();
    const finalPathStat = await lstat(filePath);
    if (
      bytesRead !== openedStat.size ||
      postStat.size !== openedStat.size ||
      postStat.dev !== openedStat.dev ||
      postStat.ino !== openedStat.ino ||
      finalPathStat.dev !== openedStat.dev ||
      finalPathStat.ino !== openedStat.ino ||
      finalPathStat.size !== openedStat.size
    ) {
      reject(issueCode, "Private evidence changed during its bounded read");
    }
    const bytes = buffer.subarray(0, bytesRead);
    let value;
    try {
      value = JSON.parse(bytes.toString("utf8"));
    } catch {
      reject(issueCode, "Private evidence JSON is malformed");
    }
    return {
      value,
      byteLength: bytesRead,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  } finally {
    await handle.close();
  }
}

async function assertEvidenceStoreMaterial() {
  await validateBoundRegularFile(EVIDENCE_STORE_PATH, "evidence_store_not_regular");
  const actualSha256 = await sha256File(EVIDENCE_STORE_PATH);
  if (actualSha256 !== CONTRACT.expectedEvidenceStoreSha256) {
    reject("evidence_store_helper_drift", "Evidence-store helper hash drifted", {
      expectedSha256: CONTRACT.expectedEvidenceStoreSha256,
      actualSha256,
    });
  }
  return actualSha256;
}

function parseEvidenceStoreFailure(result) {
  let parsed = null;
  try {
    parsed = JSON.parse(result.stderr || "");
  } catch {
    parsed = null;
  }
  reject(
    parsed && typeof parsed.issueCode === "string" ? parsed.issueCode : "evidence_store_rejected",
    parsed && typeof parsed.message === "string" ? parsed.message : "Evidence-store helper rejected the operation",
    {
      status: result.status,
      signal: result.signal || null,
      stderrSha256: sha256Text(result.stderr || ""),
    },
  );
}

export async function invokeEvidenceStore(options, dependencies = {}) {
  const assertMaterial = dependencies.assertEvidenceStoreMaterial || assertEvidenceStoreMaterial;
  const spawn = dependencies.spawnSync || spawnSync;
  await assertMaterial();
  const args = [EVIDENCE_STORE_PATH, "--mode", options.mode, "--output-root", options.outputRoot];
  if (options.bindingSha256) {
    args.push("--binding-sha256", options.bindingSha256);
  }
  if (options.recordName) {
    args.push("--record-name", options.recordName);
  }
  const input = options.mode === "write"
    ? `${JSON.stringify({ binding: options.binding, value: options.value })}\n`
    : undefined;
  const result = spawn("/usr/bin/python3", args, {
    encoding: "utf8",
    input,
    maxBuffer: 8 * 1024 * 1024,
    timeout: 5_000,
  });
  if (result.status !== 0) {
    parseEvidenceStoreFailure(result);
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout || "");
  } catch {
    reject("evidence_store_output_invalid", "Evidence-store helper output was not valid JSON", {
      stdoutSha256: sha256Text(result.stdout || ""),
    });
  }
  if (!parsed || parsed.status !== "pass") {
    reject("evidence_store_output_invalid", "Evidence-store helper did not return PASS");
  }
  return parsed;
}

export async function createBoundEvidenceStore(outputRoot, dependencies = {}) {
  const created = await invokeEvidenceStore({ mode: "create", outputRoot }, dependencies);
  if (
    !created.binding ||
    !/^[0-9a-f]{64}$/.test(created.bindingSha256 || "") ||
    created.binding.helperSha256 !== CONTRACT.expectedEvidenceStoreSha256
  ) {
    reject("evidence_binding_invalid", "Created evidence binding is incomplete or mismatched");
  }
  return {
    outputRoot,
    binding: created.binding,
    bindingSha256: created.bindingSha256,
    bindingByteLength: created.bindingByteLength,
  };
}

export async function loadBoundEvidenceStore(outputRoot, bindingSha256, dependencies = {}) {
  const loaded = await invokeEvidenceStore({
    mode: "load-binding",
    outputRoot,
    bindingSha256,
  }, dependencies);
  if (
    loaded.bindingSha256 !== bindingSha256 ||
    !loaded.binding ||
    loaded.binding.helperSha256 !== CONTRACT.expectedEvidenceStoreSha256
  ) {
    reject("evidence_binding_invalid", "Loaded evidence binding is incomplete or mismatched");
  }
  return {
    outputRoot,
    binding: loaded.binding,
    bindingSha256: loaded.bindingSha256,
    bindingByteLength: loaded.bindingByteLength,
  };
}

export async function writeBoundEvidenceRecord(store, recordName, value, dependencies = {}) {
  return invokeEvidenceStore({
    mode: "write",
    outputRoot: store.outputRoot,
    bindingSha256: store.bindingSha256,
    binding: store.binding,
    recordName,
    value,
  }, dependencies);
}

export async function readBoundEvidenceRecord(store, recordName, dependencies = {}) {
  return invokeEvidenceStore({
    mode: "read",
    outputRoot: store.outputRoot,
    bindingSha256: store.bindingSha256,
    recordName,
  }, dependencies);
}

export function summarizeEvidenceStore(store) {
  return {
    schema: store.binding.schema,
    helperSha256: store.binding.helperSha256,
    bindingSha256: store.bindingSha256,
    bindingByteLength: store.bindingByteLength,
    createdAtUtc: store.binding.createdAtUtc,
    directoryIdentitySha256: canonicalJsonSha256(store.binding.identities),
  };
}

function validateAuthoritySample(sample, index, expected, failures) {
  const capturedAt = Date.parse(sample && sample.capturedAtUtc ? sample.capturedAtUtc : "");
  if (
    !Number.isFinite(capturedAt) ||
    capturedAt > expected.nowMs ||
    expected.nowMs - capturedAt > CONTRACT.processAuthorityMaxAgeMs ||
    (expected.notBeforeMs !== null && capturedAt < expected.notBeforeMs) ||
    sample.authorityAccepted !== true ||
    !sample.evaluation ||
    sample.evaluation.accepted !== true ||
    !sample.launchctl ||
    sample.launchctl.available !== true ||
    sample.launchctl.status !== 0
  ) {
    failures.push({ field: `samples[${index}]`, expected: "fresh accepted producer sample", actual: sample });
    return capturedAt;
  }
  for (const field of [
    "targetMatches",
    "ambiguousTargetNames",
    "forbiddenPidMatches",
    "liveUnidentifiedPids",
    "unstableGenerationPids",
  ]) {
    if (!Array.isArray(sample.evaluation[field]) || sample.evaluation[field].length !== 0) {
      failures.push({ field: `samples[${index}].evaluation.${field}`, expected: [], actual: sample.evaluation[field] });
    }
  }
  if (!Array.isArray(sample.launchctl.matchedNeedles) || sample.launchctl.matchedNeedles.length !== 0) {
    failures.push({ field: `samples[${index}].launchctl.matchedNeedles`, expected: [], actual: sample.launchctl.matchedNeedles });
  }
  return capturedAt;
}

export function validateProcessAuthorityArtifact(artifact, expected) {
  const failures = [];
  const requireEqual = (field, actual, wanted) => {
    if (actual !== wanted) {
      failures.push({ field, expected: wanted, actual });
    }
  };
  requireEqual("schema", artifact.schema, CONTRACT.processAuthoritySchema);
  requireEqual("scriptPath", artifact.scriptPath, CONTRACT.producerScriptPath);
  requireEqual("scriptSha256", artifact.scriptSha256, CONTRACT.producerScriptSha256);
  requireEqual("sampleCount", artifact.sampleCount, 2);
  requireEqual("authorityAccepted", artifact.authorityAccepted, true);
  requireEqual("mutationPerformed", artifact.mutationPerformed, false);
  requireEqual("launchPerformed", artifact.launchPerformed, false);
  requireEqual("foregroundActionPerformed", artifact.foregroundActionPerformed, false);
  if (!exactArrayEqual(artifact.targetRoots, [CONTRACT.electronApp])) {
    failures.push({ field: "targetRoots", expected: "exact bound target-root set", actual: artifact.targetRoots });
  }
  if (!exactArrayEqual(artifact.targetNames, [...CONTRACT.processAuthorityTargetNames])) {
    failures.push({ field: "targetNames", expected: "exact bound target-name set", actual: artifact.targetNames });
  }
  if (!exactArrayEqual(artifact.forbiddenPids, expected.forbiddenPids)) {
    failures.push({ field: "forbiddenPids", expected: "exact bound forbidden-PID set", actual: artifact.forbiddenPids });
  }
  if (!exactArrayEqual(artifact.launchctlNeedles, [...CONTRACT.processAuthorityLaunchctlNeedles])) {
    failures.push({ field: "launchctlNeedles", expected: "exact bound launchctl needle set", actual: artifact.launchctlNeedles });
  }
  const capturedAt = Date.parse(artifact.capturedAtUtc || "");
  if (
    !Number.isFinite(capturedAt) ||
    capturedAt > expected.nowMs ||
    expected.nowMs - capturedAt > CONTRACT.processAuthorityMaxAgeMs ||
    (expected.notBeforeMs !== null && capturedAt < expected.notBeforeMs)
  ) {
    failures.push({ field: "capturedAtUtc", expected: "fresh, nonfuture, and phase ordered", actual: artifact.capturedAtUtc });
  }
  if (!Array.isArray(artifact.samples) || artifact.samples.length !== 2) {
    failures.push({ field: "samples", expected: "exactly two producer samples", actual: artifact.samples });
  } else {
    let previous = null;
    for (let index = 0; index < artifact.samples.length; index += 1) {
      const sampleAt = validateAuthoritySample(artifact.samples[index], index, expected, failures);
      if (previous !== null && sampleAt <= previous) {
        failures.push({ field: `samples[${index}].capturedAtUtc`, expected: "strictly ordered", actual: artifact.samples[index].capturedAtUtc });
      }
      if (Number.isFinite(capturedAt) && sampleAt > capturedAt) {
        failures.push({ field: `samples[${index}].capturedAtUtc`, expected: "not later than artifact capture", actual: artifact.samples[index].capturedAtUtc });
      }
      previous = sampleAt;
    }
  }
  if (failures.length > 0) {
    reject("process_authority_rejected", "Process authority artifact did not satisfy the exact private contract", { failures });
  }
  return artifact;
}

export async function loadAndValidateProcessAuthority({
  artifactPath,
  artifactSha256,
  phase,
  executionId,
  expectedPid = null,
  notBeforeMs = null,
  nowMs = Date.now(),
  baseRoot = CONTRACT.processAuthorityBaseRoot,
}) {
  if (!/^[0-9a-f]{64}$/.test(artifactSha256 || "")) {
    reject("process_authority_hash_invalid", "Process authority SHA-256 is required");
  }
  const invocation = buildProcessAuthorityInvocation({ phase, executionId, expectedPid, baseRoot });
  const read = await readBoundedPrivateJson(
    artifactPath,
    invocation.artifactPath,
    "process_authority_file_rejected",
  );
  if (read.sha256 !== artifactSha256) {
    reject("process_authority_hash_mismatch", "Process authority artifact hash mismatched");
  }
  const artifact = validateProcessAuthorityArtifact(read.value, {
    forbiddenPids: invocation.forbiddenPids,
    notBeforeMs,
    nowMs,
  });
  return {
    artifact,
    artifactSha256: read.sha256,
    artifactByteLength: read.byteLength,
    invocation,
    binding: expectedAuthorityBinding({
      artifactSha256: read.sha256,
      invocationSha256: invocation.invocationSha256,
      forbiddenPids: invocation.forbiddenPids,
    }),
  };
}

export function summarizeProcessAuthority(validated) {
  const artifact = validated.artifact;
  return {
    schema: artifact.schema,
    artifactSha256: validated.artifactSha256,
    artifactByteLength: validated.artifactByteLength,
    producerScriptSha256: artifact.scriptSha256,
    capturedAtUtc: artifact.capturedAtUtc,
    sampleCount: artifact.sampleCount,
    authorityAccepted: artifact.authorityAccepted,
    invocationSha256: validated.invocation.invocationSha256,
    targetRootsSha256: canonicalJsonSha256(artifact.targetRoots),
    targetNamesSha256: canonicalJsonSha256(artifact.targetNames),
    forbiddenPidsSha256: canonicalJsonSha256(artifact.forbiddenPids),
    launchctlNeedlesSha256: canonicalJsonSha256(artifact.launchctlNeedles),
    samples: artifact.samples.map((sample) => ({
      capturedAtUtc: sample.capturedAtUtc,
      pidCount: sample.pidCount,
      nameReadableCount: sample.nameReadableCount,
      pathReadableCount: sample.pathReadableCount,
      authorityAccepted: sample.authorityAccepted,
      targetMatchCount: sample.evaluation.targetMatches.length,
      ambiguousTargetNameCount: sample.evaluation.ambiguousTargetNames.length,
      forbiddenPidMatchCount: sample.evaluation.forbiddenPidMatches.length,
      liveUnidentifiedCount: sample.evaluation.liveUnidentifiedPids.length,
      unstableGenerationCount: sample.evaluation.unstableGenerationPids.length,
      launchctlAvailable: sample.launchctl.available,
      launchctlStatus: sample.launchctl.status,
      launchctlMatchCount: sample.launchctl.matchedNeedles.length,
    })),
  };
}

export function summarizeDistributionBinding(distribution) {
  return {
    identitySha256: canonicalJsonSha256({
      appPath: distribution.appPath,
      executablePath: distribution.executablePath,
      bundleId: distribution.bundleId,
      version: distribution.version,
      build: distribution.build,
      executableName: distribution.executableName,
    }),
    executableByteLength: distribution.executableByteLength,
    executableSha256: distribution.executableSha256,
    infoPlistSha256: distribution.infoPlistSha256,
    tree: distribution.tree,
    codeSignDisplayStatus: distribution.codeSignDisplayStatus,
    codeSignDisplaySha256: distribution.codeSignDisplaySha256,
    strictCodeSignStatus: distribution.strictCodeSignStatus,
    strictCodeSignOutputSha256: distribution.strictCodeSignOutputSha256,
    strictCodeSignIssueSha256: sha256Text(distribution.strictCodeSignIssue),
    rootQuarantinePresent: distribution.rootQuarantine.present,
    executableQuarantinePresent: distribution.executableQuarantine.present,
  };
}

export function summarizeCrashContext(crashContext) {
  return {
    reportCount: crashContext.reportCount,
    reportSetSha256: canonicalJsonSha256(crashContext.reports),
    allSigabrt: crashContext.allSigabrt,
    allCodexCoalition: crashContext.allCodexCoalition,
    allRegisterApplicationStack: crashContext.allRegisterApplicationStack,
  };
}

function requireReadOnlySuccess(command, args, issueCode) {
  const result = runReadOnly(command, args);
  if (result.status !== 0) {
    reject(issueCode, "Read-only Git binding command failed", {
      command,
      args,
      status: result.status,
    });
  }
  return result.stdout.trim();
}

export function verifyGitBinding(packetHead) {
  const actualHead = requireReadOnlySuccess(
    "/usr/bin/git",
    ["-C", CONTRACT.worktree, "rev-parse", "HEAD"],
    "git_head_unavailable",
  );
  const actualBranch = requireReadOnlySuccess(
    "/usr/bin/git",
    ["-C", CONTRACT.worktree, "branch", "--show-current"],
    "git_branch_unavailable",
  );
  const trackedStatus = requireReadOnlySuccess(
    "/usr/bin/git",
    ["-C", CONTRACT.worktree, "status", "--porcelain", "--untracked-files=no"],
    "git_status_unavailable",
  );
  const sourceAncestry = runReadOnly("/usr/bin/git", [
    "-C",
    CONTRACT.worktree,
    "merge-base",
    "--is-ancestor",
    CONTRACT.sourceHead,
    packetHead,
  ]);
  return validateGitBindingSnapshot({
    actualHead,
    actualBranch,
    trackedStatusEmpty: trackedStatus === "",
    sourceAncestor: sourceAncestry.status === 0,
  }, packetHead);
}

export function validateGitBindingSnapshot(snapshot, packetHead) {
  if (
    snapshot.actualHead !== packetHead ||
    snapshot.actualBranch !== CONTRACT.branch ||
    snapshot.trackedStatusEmpty !== true ||
    snapshot.sourceAncestor !== true
  ) {
    reject("git_binding_drift", "Packet branch, exact head, ancestry, or tracked status drifted", {
      ...snapshot,
      packetHead,
    });
  }
  return { ...snapshot, packetHead };
}

export function buildLaunchSpec({ permitId, packetHead, executionId, outputRoot, evidenceStore }) {
  if (!evidenceStore || !/^[0-9a-f]{64}$/.test(evidenceStore.bindingSha256 || "")) {
    reject("evidence_binding_missing", "Launch specification requires an exact evidence binding");
  }
  return {
    command: OPEN_PATH,
    args: [
      "-n",
      "-g",
      "-a",
      CONTRACT.electronApp,
      "--args",
      BOOTSTRAP_PATH,
      "--permit-id",
      permitId,
      "--packet-head",
      packetHead,
      "--execution-id",
      executionId,
      "--output-root",
      outputRoot,
      "--evidence-store-path",
      EVIDENCE_STORE_PATH,
      "--evidence-store-sha256",
      CONTRACT.expectedEvidenceStoreSha256,
      "--evidence-binding-sha256",
      evidenceStore.bindingSha256,
      "--evidence-binding-base64",
      Buffer.from(JSON.stringify(evidenceStore.binding), "utf8").toString("base64url"),
    ],
    launchMechanism: "registered-launchservices-open",
    attemptLimit: 1,
    alternateLauncherAllowed: false,
    directExecutableAllowed: false,
  };
}

export async function waitForBoundEvidenceRecord(store, recordName, timeoutMs, dependencies = {}) {
  const readRecord = dependencies.readBoundEvidenceRecord || readBoundEvidenceRecord;
  const sleep = dependencies.sleep || ((delay) => new Promise((resolve) => setTimeout(resolve, delay)));
  const now = dependencies.now || Date.now;
  const deadline = now() + timeoutMs;
  while (now() <= deadline) {
    try {
      const read = await readRecord(store, recordName);
      return {
        value: read.value,
        sha256: read.sha256,
        byteLength: read.byteLength,
      };
    } catch (error) {
      if (!(error instanceof PermitError) || error.issueCode !== "evidence_record_missing") {
        throw error;
      }
    }
    await sleep(100);
  }
  return null;
}

export function crashDelta(before, after) {
  const beforeKeys = new Set(before.reports.map((report) => `${report.basename}:${report.sha256}`));
  return after.reports.filter((report) => !beforeKeys.has(`${report.basename}:${report.sha256}`));
}

async function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  await rename(temporaryPath, filePath);
}

async function verifyDistributionBindings() {
  const inspected = await inspectElectronDistribution(CONTRACT.electronApp);
  if (
    inspected.bundleId !== CONTRACT.bundleId ||
    inspected.version !== CONTRACT.version ||
    inspected.build !== CONTRACT.build ||
    inspected.tree.entryCount !== CONTRACT.expectedTreeEntryCount ||
    inspected.tree.manifestSha256 !== CONTRACT.expectedTreeManifestSha256 ||
    inspected.strictCodeSignStatus !== CONTRACT.expectedStrictCodeSignStatus ||
    inspected.strictCodeSignIssue !== CONTRACT.expectedStrictCodeSignIssue ||
    inspected.rootQuarantine.present !== CONTRACT.expectedRootQuarantinePresent ||
    inspected.executableQuarantine.present !== CONTRACT.expectedExecutableQuarantinePresent
  ) {
    reject("electron_distribution_drift", "Electron distribution identity drifted", { inspected });
  }
  const bootstrapSha256 = await sha256File(BOOTSTRAP_PATH);
  if (bootstrapSha256 !== CONTRACT.expectedBootstrapSha256) {
    reject("bootstrap_helper_drift", "Bootstrap helper hash drifted", { bootstrapSha256 });
  }
  return { inspected, bootstrapSha256 };
}

export async function collectPacketMaterialHashes() {
  await validateBoundRegularFile(fileURLToPath(import.meta.url), "runner_not_regular");
  await validateBoundRegularFile(BOOTSTRAP_PATH, "bootstrap_not_regular");
  await validateBoundRegularFile(TEST_PATH, "test_not_regular");
  await validateBoundRegularFile(FINALIZER_PATH, "finalizer_not_regular");
  await validateBoundRegularFile(EVIDENCE_STORE_PATH, "evidence_store_not_regular");
  await validateBoundRegularFile(ORCHESTRATOR_PATH, "orchestrator_not_regular");
  await validateBoundRegularFile(LIFECYCLE_TEST_PATH, "lifecycle_test_not_regular");
  await validateBoundRegularFile(RELAY_PUBLISHER_PATH, "relay_publisher_not_regular");
  await validateBoundRegularFile(PERMIT_PACKET_PATH, "permit_packet_not_regular");
  return {
    runnerSha256: await sha256File(fileURLToPath(import.meta.url)),
    bootstrapSha256: await sha256File(BOOTSTRAP_PATH),
    testSha256: await sha256File(TEST_PATH),
    finalizerSha256: await sha256File(FINALIZER_PATH),
    evidenceStoreSha256: await sha256File(EVIDENCE_STORE_PATH),
    orchestratorSha256: await sha256File(ORCHESTRATOR_PATH),
    lifecycleTestSha256: await sha256File(LIFECYCLE_TEST_PATH),
    relayPublisherSha256: await sha256File(RELAY_PUBLISHER_PATH),
    permitPacketSha256: await sha256File(PERMIT_PACKET_PATH),
  };
}

function exactObjectFieldsEqual(left, right, fields) {
  return fields.every((field) => left && right && left[field] === right[field]);
}

export async function withFreshPreLaunchIdentity(options, action, dependencies = {}) {
  const verifyBinding = dependencies.verifyGitBinding || verifyGitBinding;
  const collectHashes = dependencies.collectPacketMaterialHashes || collectPacketMaterialHashes;
  const freshGitBinding = await verifyBinding(options.packetHead);
  const freshPacketMaterialHashes = await collectHashes();
  const gitFields = ["actualHead", "actualBranch", "trackedStatusEmpty", "sourceAncestor", "packetHead"];
  const materialFields = [
    "runnerSha256",
    "bootstrapSha256",
    "testSha256",
    "finalizerSha256",
    "evidenceStoreSha256",
    "orchestratorSha256",
    "lifecycleTestSha256",
    "relayPublisherSha256",
    "permitPacketSha256",
  ];
  if (
    !exactObjectFieldsEqual(options.initialGitBinding, freshGitBinding, gitFields) ||
    !exactObjectFieldsEqual(options.initialPacketMaterialHashes, freshPacketMaterialHashes, materialFields)
  ) {
    reject("pre_launch_identity_drift", "Git or packet material identity changed before launch", {
      gitBindingStable: exactObjectFieldsEqual(options.initialGitBinding, freshGitBinding, gitFields),
      packetMaterialStable: exactObjectFieldsEqual(
        options.initialPacketMaterialHashes,
        freshPacketMaterialHashes,
        materialFields,
      ),
    });
  }
  const revalidatedAtUtc = new Date().toISOString();
  validatePreflightRelay(options.relay, {
    permitId: options.permitId,
    packetHead: options.packetHead,
    currentHead: freshGitBinding.actualHead,
    outputRoot: options.outputRoot,
    packetMaterialHashes: freshPacketMaterialHashes,
    executionId: options.executionId,
    prelaunchProcessAuthority: options.initialProcessAuthority.binding,
    nowMs: Date.parse(revalidatedAtUtc),
  });
  const freshProcessAuthority = await options.revalidateProcessAuthority(Date.parse(revalidatedAtUtc));
  if (
    freshProcessAuthority.artifactSha256 !== options.initialProcessAuthority.artifactSha256 ||
    freshProcessAuthority.invocation.invocationSha256 !== options.initialProcessAuthority.invocation.invocationSha256
  ) {
    reject("pre_launch_process_authority_drift", "Prelaunch process authority changed before launch");
  }
  const actionResult = await action({
    gitBinding: freshGitBinding,
    packetMaterialHashes: freshPacketMaterialHashes,
    revalidatedAtUtc,
    processAuthority: freshProcessAuthority,
  });
  return {
    gitBinding: freshGitBinding,
    packetMaterialHashes: freshPacketMaterialHashes,
    revalidatedAtUtc,
    processAuthority: freshProcessAuthority,
    actionResult,
  };
}

export function markerMatches(marker, phase, expected, pid = null) {
  return Boolean(marker) &&
    marker.schema === `auto-svga-registered-electron-bootstrap-v0-${phase}` &&
    marker.phase === phase &&
    marker.permitId === expected.permitId &&
    marker.executionId === expected.executionId &&
    marker.packetHead === expected.packetHead &&
    marker.sourceHead === CONTRACT.sourceHead &&
    marker.processExecPath === path.join(CONTRACT.electronApp, CONTRACT.executableRelativePath) &&
    marker.appPath === CONTRACT.electronApp &&
    marker.bundleId === CONTRACT.bundleId &&
    marker.electronVersion === CONTRACT.version &&
    (!expected.evidenceBindingSha256 || marker.evidenceBindingSha256 === expected.evidenceBindingSha256) &&
    Number.isInteger(marker.pid) && marker.pid > 0 &&
    (pid === null || marker.pid === pid);
}

async function inspectMode(args) {
  const reportPath = args["report-path"];
  if (!reportPath) {
    reject("missing_report_path", "inspect mode requires --report-path");
  }
  if (path.resolve(reportPath) !== SOURCE_BINDING_REPORT_PATH) {
    reject("inspect_report_path_rejected", "Inspect report path must be the packet-local binding report");
  }
  const target = await inspectElectronDistribution(CONTRACT.electronApp);
  const comparison = await inspectElectronDistribution(CONTRACT.comparisonElectronApp);
  const crashContext = await collectCrashContext();
  const report = {
    schema: "auto-svga-registered-electron-bootstrap-source-binding-v0",
    generatedAtUtc: new Date().toISOString(),
    sourceHead: CONTRACT.sourceHead,
    target: summarizeDistributionBinding(target),
    comparison: summarizeDistributionBinding(comparison),
    distributionEquality: {
      externalReviewEntryCountClaim: "275/275",
      independentRegularFileAndSymlinkCount: `${target.tree.entryCount}/${comparison.tree.entryCount}`,
      externalCountReproduced: target.tree.entryCount === 275 && comparison.tree.entryCount === 275,
      entryCountsEqual: target.tree.entryCount === comparison.tree.entryCount,
      manifestSha256Equal: target.tree.manifestSha256 === comparison.tree.manifestSha256,
      executableSha256Equal: target.executableSha256 === comparison.executableSha256,
      strictCodeSignStatusEqual: target.strictCodeSignStatus === comparison.strictCodeSignStatus,
      strictCodeSignIssueEqual: target.strictCodeSignIssue === comparison.strictCodeSignIssue,
      strictCodeSignOutputSha256Equal:
        target.strictCodeSignOutputSha256 === comparison.strictCodeSignOutputSha256,
    },
    crashContext: summarizeCrashContext(crashContext),
    bootstrapSha256: await sha256File(BOOTSTRAP_PATH),
    runnerSha256: await sha256File(fileURLToPath(import.meta.url)),
    testSha256: await sha256File(TEST_PATH),
    finalizerSha256: await sha256File(FINALIZER_PATH),
    evidenceStoreSha256: await sha256File(EVIDENCE_STORE_PATH),
    processAuthorityProducer: {
      sourceHead: CONTRACT.producerSourceHead,
      schema: CONTRACT.processAuthoritySchema,
      scriptSha256: CONTRACT.producerScriptSha256,
      testSha256: CONTRACT.producerTestSha256,
      integrationMode: "private_hash_bound_contiguous_runner_postrun_relay_finalizer",
    },
    permitPacketBinding: existsSync(PERMIT_PACKET_PATH)
      ? { status: "present", sha256: await sha256File(PERMIT_PACKET_PATH) }
      : { status: "pending_pm_repair_review", sha256: null },
    noLaunchPerformed: true,
  };
  await writeJsonAtomic(reportPath, report);
  return report;
}

async function executeMode(args) {
  const permitId = args["permit-id"];
  const packetHead = args["packet-head"];
  const executionId = args["execution-id"];
  const outputRoot = args["output-root"];
  const relayPath = args["preflight-relay"];
  const relaySha256 = args["preflight-relay-sha256"];
  const prelaunchAuthorityPath = args["prelaunch-authority"];
  const prelaunchAuthoritySha256 = args["prelaunch-authority-sha256"];
  if (!/^ASV-APR-\d{8}-\d{3}$/.test(permitId || "")) {
    reject("permit_id_invalid", "An issued single-use permit id is required");
  }
  if (!/^[0-9a-f]{40}$/.test(packetHead || "")) {
    reject("packet_head_invalid", "A full packet head is required");
  }
  authorityPaths(executionId);
  if (!relayPath || !/^[0-9a-f]{64}$/.test(relaySha256 || "")) {
    reject("preflight_relay_binding_missing", "A hash-bound PM preflight relay is required");
  }
  const prelaunchInvocation = buildProcessAuthorityInvocation({ phase: "prelaunch", executionId });
  if (
    prelaunchAuthorityPath !== prelaunchInvocation.artifactPath ||
    !/^[0-9a-f]{64}$/.test(prelaunchAuthoritySha256 || "")
  ) {
    reject("prelaunch_process_authority_binding_missing", "Exact private prelaunch process authority is required");
  }
  await validateFreshOutputRoot(outputRoot);
  const gitBinding = verifyGitBinding(packetHead);
  const packetMaterialHashes = await collectPacketMaterialHashes();
  await validateBoundRegularFile(relayPath, "preflight_relay_not_regular");
  const actualRelaySha256 = await sha256File(relayPath);
  if (actualRelaySha256 !== relaySha256) {
    reject("preflight_relay_hash_mismatch", "PM preflight relay hash mismatched");
  }
  const relay = JSON.parse(await readFile(relayPath, "utf8"));
  const expectedPrelaunchBinding = expectedAuthorityBinding({
    artifactSha256: prelaunchAuthoritySha256,
    invocationSha256: prelaunchInvocation.invocationSha256,
    forbiddenPids: [],
  });
  validatePreflightRelay(relay, {
    permitId,
    packetHead,
    currentHead: gitBinding.actualHead,
    outputRoot,
    packetMaterialHashes,
    executionId,
    prelaunchProcessAuthority: expectedPrelaunchBinding,
  });
  const initialProcessAuthority = await loadAndValidateProcessAuthority({
    artifactPath: prelaunchAuthorityPath,
    artifactSha256: prelaunchAuthoritySha256,
    phase: "prelaunch",
    executionId,
  });
  const distribution = await verifyDistributionBindings();

  const evidenceStore = await createBoundEvidenceStore(outputRoot);
  const crashBefore = await collectCrashContext();
  const launchSpec = buildLaunchSpec({ permitId, packetHead, executionId, outputRoot, evidenceStore });
  let preLaunchDispatch;
  try {
    preLaunchDispatch = await withFreshPreLaunchIdentity({
      permitId,
      packetHead,
      executionId,
      outputRoot,
      relay,
      initialGitBinding: gitBinding,
      initialPacketMaterialHashes: packetMaterialHashes,
      initialProcessAuthority,
      revalidateProcessAuthority: (nowMs) => loadAndValidateProcessAuthority({
        artifactPath: prelaunchAuthorityPath,
        artifactSha256: prelaunchAuthoritySha256,
        phase: "prelaunch",
        executionId,
        nowMs,
      }),
    }, async (freshIdentity) => {
      await writeBoundEvidenceRecord(evidenceStore, "launch-command.json", {
        schema: "auto-svga-registered-electron-bootstrap-launch-command-v1",
        permitId,
        executionId,
        packetHead,
        sourceHead: CONTRACT.sourceHead,
        launchSpec,
        preflightRelaySha256: relaySha256,
        distribution,
        initialPacketMaterialHashes: packetMaterialHashes,
        packetMaterialHashes: freshIdentity.packetMaterialHashes,
        initialGitBinding: gitBinding,
        gitBinding: freshIdentity.gitBinding,
        prelaunchProcessAuthority: summarizeProcessAuthority(freshIdentity.processAuthority),
        preLaunchRelayRevalidatedAtUtc: freshIdentity.revalidatedAtUtc,
        crashBaselineCount: crashBefore.reportCount,
        launchAttemptsAuthorized: 1,
        launchAttemptsPerformed: 0,
      });
      const launchDispatchedAtUtc = new Date().toISOString();
      return {
        launchDispatchedAtUtc,
        launchResult: spawnSync(launchSpec.command, launchSpec.args, {
          encoding: "utf8",
          maxBuffer: 1024 * 1024,
        }),
      };
    });
  } catch (error) {
    const preLaunchIdentityCheckFailedAtUtc = new Date().toISOString();
    const disposition = {
      schema: "auto-svga-registered-electron-bootstrap-disposition-v0",
      status: "failed_closed",
      earliestMissingPhase: "pre_launch_relay_revalidation",
      issueCode: error.issueCode || "preflight_relay_rejected",
      permitId,
      executionId,
      packetHead,
      sourceHead: CONTRACT.sourceHead,
      preLaunchIdentityCheckFailedAtUtc,
      launchAttemptsPerformed: 0,
      processAuthorityAccepted: false,
      forcedTerminationUsed: false,
      retryUsed: false,
    };
    await writeBoundEvidenceRecord(evidenceStore, "disposition.json", disposition);
    return disposition;
  }
  const launch = preLaunchDispatch.actionResult.launchResult;
  const launchedAtUtc = preLaunchDispatch.actionResult.launchDispatchedAtUtc;
  const launchResult = {
    status: launch.status,
    signal: launch.signal || null,
    stdoutSha256: sha256Text(launch.stdout || ""),
    stderrSha256: sha256Text(launch.stderr || ""),
    stdoutByteLength: Buffer.byteLength(launch.stdout || ""),
    stderrByteLength: Buffer.byteLength(launch.stderr || ""),
  };
  const firstMarker = launch.status === 0 ? await waitForBoundEvidenceRecord(
    evidenceStore,
    "first-javascript-marker.json",
    CONTRACT.firstJavaScriptTimeoutMs,
  ) : null;
  const readyMarker = firstMarker
    ? await waitForBoundEvidenceRecord(evidenceStore, "app-ready-marker.json", CONTRACT.appReadyTimeoutMs)
    : null;
  const willQuitMarker = readyMarker
    ? await waitForBoundEvidenceRecord(evidenceStore, "normal-quit-will-quit.json", CONTRACT.legalQuitTimeoutMs)
    : null;
  const quitObservedMarker = willQuitMarker
    ? await waitForBoundEvidenceRecord(evidenceStore, "normal-quit-observed.json", CONTRACT.legalQuitTimeoutMs)
    : null;
  const outcome = assessRuntimePendingOutcome({
    permitId,
    packetHead,
    executionId,
    launchResult,
    firstMarker: firstMarker && firstMarker.value,
    readyMarker: readyMarker && readyMarker.value,
    willQuitMarker: willQuitMarker && willQuitMarker.value,
    quitObservedMarker: quitObservedMarker && quitObservedMarker.value,
    evidenceBindingSha256: evidenceStore.bindingSha256,
  });
  const pendingDisposition = {
    schema: "auto-svga-registered-electron-bootstrap-runtime-pending-v1",
    status: outcome.status,
    earliestMissingPhase: outcome.earliestMissingPhase,
    issueCode: outcome.issueCode,
    permitId,
    executionId,
    packetHead,
    sourceHead: CONTRACT.sourceHead,
    pendingAtUtc: new Date().toISOString(),
    outputRootSha256: sha256Text(outputRoot),
    evidenceStore: summarizeEvidenceStore(evidenceStore),
    launchedAtUtc,
    launchAttemptsPerformed: 1,
    launchResult,
    prelaunchAuthorityArtifactSha256: prelaunchAuthoritySha256,
    prelaunchAuthoritySummary: summarizeProcessAuthority(initialProcessAuthority),
    firstJavaScriptMarker: firstMarker && firstMarker.value,
    appReadyMarker: readyMarker && readyMarker.value,
    normalQuitWillQuitMarker: willQuitMarker && willQuitMarker.value,
    normalQuitObservedMarker: quitObservedMarker && quitObservedMarker.value,
    markerHashes: {
      firstJavaScript: firstMarker && firstMarker.sha256,
      appReady: readyMarker && readyMarker.sha256,
      normalQuitWillQuit: willQuitMarker && willQuitMarker.sha256,
      normalQuitObserved: quitObservedMarker && quitObservedMarker.sha256,
    },
    crashBefore,
    postrunAuthorityRequired: true,
    finalPassAllowedInRunner: false,
    productProofContinued: false,
    forcedTerminationUsed: false,
    retryUsed: false,
  };
  const privateWrite = await writeBoundEvidenceRecord(
    evidenceStore,
    "runtime-pending-private.json",
    pendingDisposition,
  );
  const visibleSummary = summarizeRuntimePending(pendingDisposition);
  await writeBoundEvidenceRecord(evidenceStore, "runtime-pending-summary.json", {
    ...visibleSummary,
    pendingDispositionSha256: privateWrite.sha256,
  });
  return { ...visibleSummary, pendingDispositionSha256: privateWrite.sha256 };
}

export function assessRuntimePendingOutcome({
  permitId,
  packetHead,
  executionId,
  launchResult,
  firstMarker,
  readyMarker,
  willQuitMarker,
  quitObservedMarker,
  evidenceBindingSha256,
}) {
  const failed = (earliestMissingPhase, issueCode) => ({
    status: "runtime_failed_pending_postrun_authority",
    earliestMissingPhase,
    issueCode,
  });
  if (!launchResult || launchResult.status !== 0) {
    return failed("registered_launchservices_dispatch", "registered_launch_failed");
  }
  const markerIdentity = { permitId, packetHead, executionId, evidenceBindingSha256 };
  if (!firstMarker) {
    return failed("first_javascript_entry", "first_javascript_marker_missing");
  }
  if (!markerMatches(firstMarker, "first-javascript", markerIdentity)) {
    return failed("first_javascript_identity", "first_javascript_marker_invalid");
  }
  if (!readyMarker) {
    return failed("app_ready", "app_ready_marker_missing");
  }
  if (
    !markerMatches(readyMarker, "app-ready", markerIdentity, firstMarker.pid) ||
    readyMarker.userDataBound !== true ||
    readyMarker.sessionDataBound !== true ||
    readyMarker.windowsCreated !== 0
  ) {
    return failed("app_ready_identity", "app_ready_marker_invalid");
  }
  if (!willQuitMarker) {
    return failed("normal_application_quit", "normal_quit_marker_missing");
  }
  if (!markerMatches(willQuitMarker, "normal-quit-will-quit", markerIdentity, firstMarker.pid)) {
    return failed("normal_application_quit_identity", "normal_quit_marker_invalid");
  }
  if (!quitObservedMarker) {
    return failed("normal_application_quit_observed", "normal_quit_observed_marker_missing");
  }
  if (
    !markerMatches(quitObservedMarker, "normal-quit-observed", markerIdentity, firstMarker.pid) ||
    quitObservedMarker.exitCode !== 0
  ) {
    return failed("normal_application_quit_observed_identity", "normal_quit_observed_marker_invalid");
  }
  return {
    status: "runtime_completed_pending_postrun_authority",
    earliestMissingPhase: "postrun_process_authority",
    issueCode: "postrun_process_authority_required",
  };
}

export function summarizeRuntimePending(pending) {
  const firstMarker = pending.firstJavaScriptMarker;
  const identityDigest = firstMarker
    ? canonicalJsonSha256({
      pid: firstMarker.pid,
      processExecPath: firstMarker.processExecPath,
      appPath: firstMarker.appPath,
      bundleId: firstMarker.bundleId,
    })
    : null;
  return {
    schema: "auto-svga-registered-electron-bootstrap-runtime-pending-summary-v1",
    status: pending.status,
    earliestMissingPhase: pending.earliestMissingPhase,
    issueCode: pending.issueCode,
    permitId: pending.permitId,
    executionId: pending.executionId,
    packetHead: pending.packetHead,
    sourceHead: pending.sourceHead,
    launchAttemptsPerformed: pending.launchAttemptsPerformed,
    launchStatus: pending.launchResult && pending.launchResult.status,
    prelaunchProcessAuthority: pending.prelaunchAuthoritySummary,
    markerPresence: {
      firstJavaScript: Boolean(pending.firstJavaScriptMarker),
      appReady: Boolean(pending.appReadyMarker),
      normalQuitWillQuit: Boolean(pending.normalQuitWillQuitMarker),
      normalQuitObserved: Boolean(pending.normalQuitObservedMarker),
    },
    markerHashes: pending.markerHashes,
    processIdentitySha256: identityDigest,
    evidenceStore: pending.evidenceStore,
    postrunAuthorityRequired: pending.postrunAuthorityRequired,
    finalPassAllowedInRunner: pending.finalPassAllowedInRunner,
    productProofContinued: pending.productProofContinued,
    forcedTerminationUsed: pending.forcedTerminationUsed,
    retryUsed: pending.retryUsed,
    nonclaims: ["electron_runtime_pass", "product_proof", "preview_success", "save_success"],
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      reject("argument_invalid", "Unexpected positional argument");
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      reject("argument_missing_value", `Missing value for ${token}`);
    }
    args[token.slice(2)] = value;
    index += 1;
  }
  return args;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.mode === "inspect") {
    return inspectMode(args);
  }
  if (args.mode === "execute") {
    return executeMode(args);
  }
  reject("mode_invalid", "Mode must be inspect or execute");
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().then((result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }).catch((error) => {
    process.stderr.write(`${JSON.stringify({
      status: "failed_closed",
      issueCode: error.issueCode || "runner_error",
      message: error.message,
      details: error.details || {},
    })}\n`);
    process.exitCode = 1;
  });
}
