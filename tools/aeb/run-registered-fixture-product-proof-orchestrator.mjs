#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildProcessAuthorityInvocation,
  collectCrashContext,
  crashDelta,
  loadAndValidateProcessAuthority,
  prepareProcessAuthorityRoot,
  sha256File,
} from "./run-registered-electron-bootstrap-discriminator.mjs";
import { orchestrateLifecycle as runExactD001Lifecycle } from "./orchestrate-registered-electron-bootstrap-lifecycle.mjs";
import { snapshotBoundedPackageTree } from "./run-aeb-0.3-native-preview-product-proof.mjs";

const require = createRequire(import.meta.url);
const {
  CONTRACT,
  canonicalDescriptorBytes,
  descriptorSha256,
  readOwnDataRecord,
  validateDescriptor,
} = require("./aeb-registered-fixture-proof-contract.cjs");
const {
  HELPER_PATH,
  HELPER_SHA256,
  assertEvidenceRecordIdentity,
  assertRuntimeStateResidueAbsent,
  clearRuntimeState,
  createEvidenceStore,
  readBytesMetadata,
  readJsonRecord,
  validateEvidenceStore,
  writeJsonRecord,
} = require("./registered-fixture-proof-evidence-store.cjs");

const SCRIPT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const D001_PACKET_ROOT = SCRIPT_ROOT;
const D001_ORCHESTRATOR_PATH = path.join(D001_PACKET_ROOT, "orchestrate-registered-electron-bootstrap-lifecycle.mjs");
const D001_FINALIZER_PATH = path.join(D001_PACKET_ROOT, "finalize-registered-electron-bootstrap-discriminator.mjs");
const D001_ORCHESTRATOR_SHA256 = "bbc5ff7e933000795320e3c6aa14c3faf8f4593ad7f1fd10117ac316107aeee4";
const D001_FINALIZER_SHA256 = "0fdefb7add8ece5f817c779b97420e120e45c8a39553ab7010162ac5fa89f3dd";
const GIT_PATH = "/usr/bin/git";
const PRODUCT_RUNTIME_TIMEOUT_MS = 45_000;
const CRASH_SETTLE_DELAY_MS = 2_000;
const FINAL_SCHEMA = "auto-svga-aeb-registered-fixture-product-proof-final-v2";
const RUNTIME_PACKAGE_TREE_OBSERVATION_SCHEMA = "auto-svga-aeb-runtime-package-tree-observation-v1";
const RUNTIME_PACKAGE_TREE_OBSERVATION_PHASE = "aeb-native-preview-session-pre-conversion";
const RUNTIME_PACKAGE_TREE_OBSERVATION_RECORD = "registered-package-tree-runtime-observed.json";
const REGISTERED_BOOTSTRAP_WRAPPER_NAME = "registered-bootstrap-wrapper.cjs";
const PRIVATE_D001_AUTHORITIES = new WeakMap();

const CLI_KEYS = Object.freeze([
  "mode",
  "descriptor-base64",
  "descriptor-sha256",
  "d001-lifecycle-base64"
]);

const D001_LIFECYCLE_KEYS = Object.freeze([
  "executionId",
  "outputRoot",
  "packetHead",
  "permitId",
  "preflightRelayPath",
  "preflightRelaySha256",
  "prelaunchAuthorityPath",
  "prelaunchAuthoritySha256"
]);

function reject(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function parseArgs(argv) {
  if (!Array.isArray(argv) || argv.length !== CLI_KEYS.length * 2) reject("registered_fixture_orchestrator_arguments_invalid");
  const result = Object.create(null);
  for (let index = 0; index < argv.length; index += 2) {
    const token = argv[index];
    const value = argv[index + 1];
    if (typeof token !== "string" || typeof value !== "string" || !token.startsWith("--") || value.startsWith("--")) {
      reject("registered_fixture_orchestrator_arguments_invalid");
    }
    const key = token.slice(2);
    if (key !== CLI_KEYS[index / 2] || Object.prototype.hasOwnProperty.call(result, key)) {
      reject("registered_fixture_orchestrator_arguments_invalid");
    }
    result[key] = value;
  }
  if (result.mode !== "execute" || Object.keys(result).length !== CLI_KEYS.length) {
    reject("registered_fixture_orchestrator_arguments_invalid");
  }
  return result;
}

function parseBase64Json(value, code) {
  if (typeof value !== "string" || value.length === 0 || value.length > 1024 * 1024) reject(code);
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) reject(code.replace(/_invalid$/u, "_noncanonical"));
  let bytes;
  try {
    bytes = Buffer.from(value, "base64url");
  } catch {
    reject(code);
  }
  if (bytes.toString("base64url") !== value) reject(code.replace(/_invalid$/u, "_noncanonical"));
  try {
    return { bytes, value: JSON.parse(bytes.toString("utf8")) };
  } catch {
    reject(code);
  }
}

function canonicalD001LifecycleBytes(value) {
  const canonical = Object.fromEntries([...D001_LIFECYCLE_KEYS].sort().map((key) => [key, value[key]]));
  return Buffer.from(`${JSON.stringify(canonical, null, 2)}\n`, "utf8");
}

function validateParsedD001Lifecycle(record, descriptor) {
  if (
    !record
    || typeof record !== "object"
    || Array.isArray(record)
    || Object.getPrototypeOf(record) !== null
    || Object.keys(record).sort().some((key, index) => key !== [...D001_LIFECYCLE_KEYS].sort()[index])
    || Object.keys(record).length !== D001_LIFECYCLE_KEYS.length
  ) reject("registered_fixture_d001_lifecycle_record_invalid");
  for (const field of D001_LIFECYCLE_KEYS) {
    if (typeof record[field] !== "string") reject("registered_fixture_d001_lifecycle_primitive_invalid");
  }
  if (
    record.permitId !== descriptor.d001PermitId
    || record.executionId !== descriptor.d001ExecutionId
    || record.packetHead !== descriptor.d001PacketHead
    || record.outputRoot === descriptor.outputRoot
    || !/^[a-f0-9]{64}$/u.test(record.preflightRelaySha256)
    || !/^[a-f0-9]{64}$/u.test(record.prelaunchAuthoritySha256)
  ) reject("registered_fixture_d001_lifecycle_binding_invalid");
  return record;
}

function parseD001Lifecycle(value, descriptor) {
  const record = readOwnDataRecord(value, D001_LIFECYCLE_KEYS, "d001_lifecycle");
  return validateParsedD001Lifecycle(record, descriptor);
}

function boundedSourceFileSha256(filePath, expectedSha256) {
  const canonical = path.resolve(filePath);
  const before = fs.lstatSync(canonical);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || fs.realpathSync(canonical) !== canonical) {
    reject("registered_fixture_source_material_identity_invalid");
  }
  const descriptor = fs.openSync(canonical, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fs.fstatSync(descriptor);
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.nlink !== 1 || opened.size !== before.size) {
      reject("registered_fixture_source_material_identity_invalid");
    }
    const bytes = Buffer.allocUnsafe(opened.size + 1);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = fs.readSync(descriptor, bytes, offset, bytes.byteLength - offset, offset);
      if (count === 0) break;
      offset += count;
    }
    const after = fs.fstatSync(descriptor);
    const current = fs.lstatSync(canonical);
    const actual = createHash("sha256").update(bytes.subarray(0, offset)).digest("hex");
    if (
      offset !== opened.size
      || after.dev !== opened.dev
      || after.ino !== opened.ino
      || after.size !== opened.size
      || after.nlink !== 1
      || current.dev !== opened.dev
      || current.ino !== opened.ino
      || current.nlink !== 1
      || (expectedSha256 !== undefined && actual !== expectedSha256)
    ) reject("registered_fixture_source_material_hash_invalid");
    return actual;
  } finally {
    fs.closeSync(descriptor);
  }
}

function captureProductMaterialHashes() {
  const paths = [
    fileURLToPath(import.meta.url),
    path.join(SCRIPT_ROOT, "aeb-ae-package-handoff.cjs"),
    path.join(SCRIPT_ROOT, "aeb-registered-fixture-proof-contract.cjs"),
    CONTRACT.bootstrapPath,
    HELPER_PATH,
    path.join(SCRIPT_ROOT, "registered-fixture-proof-evidence-store.cjs"),
    path.join(CONTRACT.experimentRoot, "aeb-native-preview-electron-proof.cjs"),
    path.join(CONTRACT.experimentRoot, "main.cjs"),
  ];
  return paths.map((filePath) => Object.freeze({
    filePath,
    sha256: boundedSourceFileSha256(filePath),
  }));
}

function revalidateProductMaterialHashes(snapshot) {
  for (const entry of snapshot) boundedSourceFileSha256(entry.filePath, entry.sha256);
}

function gitOutput(args) {
  const result = spawnSync(GIT_PATH, args, { cwd: path.resolve(SCRIPT_ROOT, "../.."), encoding: "utf8", maxBuffer: 1024 * 1024 });
  if (!result || result.status !== 0 || result.signal) reject("registered_fixture_git_binding_unavailable");
  return String(result.stdout || "").trim();
}

function verifySourceBinding(descriptor) {
  const head = gitOutput(["rev-parse", "HEAD"]);
  const branch = gitOutput(["rev-parse", "--abbrev-ref", "HEAD"]);
  const status = gitOutput(["status", "--porcelain=v1", "--untracked-files=all"]);
  if (head !== descriptor.sourceHead || branch !== descriptor.sourceBranch || status !== "") {
    reject("registered_fixture_git_binding_invalid");
  }
  return { head, branch, trackedClean: true };
}

function validateD001LifecycleResult(result, descriptor) {
  if (
    !result
    || result.schema !== "auto-svga-registered-electron-bootstrap-lifecycle-v0"
    || result.status !== "pass"
    || result.permitId !== descriptor.d001PermitId
    || result.executionId !== descriptor.d001ExecutionId
    || result.packetHead !== descriptor.d001PacketHead
    || result.sourceHead !== descriptor.d001SourceHead
    || result.lifecycleCounts?.runnerInvocations !== 1
    || result.lifecycleCounts?.producerInvocations !== 1
    || result.lifecycleCounts?.relayPublicationAttempts !== 1
    || result.lifecycleCounts?.finalizerInvocations !== 1
    || result.finalDisposition?.status !== "pass"
    || result.finalDisposition?.permitId !== descriptor.d001PermitId
    || result.finalDisposition?.executionId !== descriptor.d001ExecutionId
    || result.finalDisposition?.packetHead !== descriptor.d001PacketHead
    || result.finalDisposition?.sourceHead !== descriptor.d001SourceHead
    || result.noRetry !== true
    || result.noFallback !== true
    || result.noForcedTermination !== true
    || result.productProofContinued !== false
  ) reject("registered_fixture_d001_private_authority_rejected");
  const authority = Object.freeze({});
  PRIVATE_D001_AUTHORITIES.set(authority, {
    permitId: result.permitId,
    executionId: result.executionId,
    packetHead: result.packetHead,
    sourceHead: result.sourceHead,
    sha256: createHash("sha256").update(JSON.stringify(result)).digest("hex"),
    launchBound: false,
  });
  return authority;
}

function bindD001AuthorityToLaunch(authority, descriptor) {
  const value = PRIVATE_D001_AUTHORITIES.get(authority);
  if (
    !value
    || value.launchBound !== false
    || value.permitId !== descriptor.d001PermitId
    || value.executionId !== descriptor.d001ExecutionId
    || value.packetHead !== descriptor.d001PacketHead
    || value.sourceHead !== descriptor.d001SourceHead
  ) reject("registered_fixture_d001_private_authority_required");
  value.launchBound = true;
  return value;
}

function consumeD001AuthorityForFinalization(authority, descriptor) {
  const value = PRIVATE_D001_AUTHORITIES.get(authority);
  PRIVATE_D001_AUTHORITIES.delete(authority);
  if (
    !value
    || value.launchBound !== true
    || value.permitId !== descriptor.d001PermitId
    || value.executionId !== descriptor.d001ExecutionId
    || value.packetHead !== descriptor.d001PacketHead
    || value.sourceHead !== descriptor.d001SourceHead
  ) reject("registered_fixture_d001_private_authority_required");
  return value;
}

function writeRegisteredBootstrapWrapper(store) {
  const wrapperPath = path.join(store.outputRoot, "session-data", REGISTERED_BOOTSTRAP_WRAPPER_NAME);
  const expectedDir = path.join(store.outputRoot, "session-data");
  if (path.dirname(wrapperPath) !== expectedDir || path.relative(CONTRACT.taskRoot, wrapperPath).startsWith("..")) {
    reject("registered_fixture_bootstrap_wrapper_path_invalid");
  }
  const source = [
    '"use strict";',
    `const bootstrap = require(${JSON.stringify(CONTRACT.bootstrapPath)});`,
    'bootstrap.main(process.argv.slice(2));',
    "",
  ].join("\n");
  fs.writeFileSync(wrapperPath, source, { flag: "wx", mode: 0o600 });
  const before = fs.lstatSync(wrapperPath);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || fs.realpathSync(wrapperPath) !== wrapperPath) {
    reject("registered_fixture_bootstrap_wrapper_identity_invalid");
  }
  const bytes = fs.readFileSync(wrapperPath);
  const after = fs.lstatSync(wrapperPath);
  if (
    before.dev !== after.dev
    || before.ino !== after.ino
    || before.size !== after.size
    || after.nlink !== 1
    || bytes.byteLength !== before.size
  ) reject("registered_fixture_bootstrap_wrapper_identity_invalid");
  return {
    path: wrapperPath,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function buildRegisteredLaunch(authority, descriptor, store) {
  const d001 = bindD001AuthorityToLaunch(authority, descriptor);
  const descriptorPath = path.join(store.outputRoot, "reports", "registered-fixture-descriptor.json");
  const bootstrapWrapper = writeRegisteredBootstrapWrapper(store);
  return {
    d001,
    command: CONTRACT.electronExecutable,
    bootstrapWrapper,
    args: [
      bootstrapWrapper.path,
      "--descriptor-path", descriptorPath,
      "--descriptor-sha256", descriptorSha256(descriptor),
      "--evidence-binding-base64", Buffer.from(JSON.stringify(store.binding), "utf8").toString("base64url"),
      "--evidence-binding-sha256", store.bindingSha256,
      "--evidence-helper-path", HELPER_PATH,
      "--evidence-helper-sha256", HELPER_SHA256,
      "--output-root", store.outputRoot
    ]
  };
}

async function waitForJsonRecord(store, name, timeoutMs = PRODUCT_RUNTIME_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      return readJsonRecord(store, "reports", name);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  reject("registered_fixture_runtime_evidence_timeout");
}

function captureEvidenceSnapshot(store) {
  return Object.freeze({
    firstJavaScript: readJsonRecord(store, "reports", "registered-first-javascript-marker.json"),
    normalQuitRequested: readJsonRecord(store, "reports", "registered-normal-quit-requested.json"),
    normalQuitWillQuit: readJsonRecord(store, "reports", "registered-normal-quit-will-quit.json"),
    normalQuitObserved: readJsonRecord(store, "reports", "registered-normal-quit-observed.json"),
    runtimePackageTree: readJsonRecord(store, "reports", RUNTIME_PACKAGE_TREE_OBSERVATION_RECORD),
    report: readJsonRecord(store, "reports", "aeb-native-preview-product-proof.json"),
    save: readBytesMetadata(store, "saved", "aeb-native-preview-save-as.svga"),
    project: readBytesMetadata(store, "identity", "project.json"),
    map: readBytesMetadata(store, "identity", "svga-map.json"),
    assetSet: readBytesMetadata(store, "identity", "asset-set.json"),
  });
}

function assertSnapshot(name, current, snapshots) {
  const expected = snapshots?.[name];
  if (!expected) reject("registered_fixture_evidence_identity_changed");
  assertEvidenceRecordIdentity(expected, current);
}

function exactMarker(record, phase, descriptor, store, expectedPid, expectedStartedAtUtc) {
  const baseKeys = [
    "appPath", "bundleId", "d001ExecutionId", "d001PacketHead", "d001PermitId",
    "electronVersion", "evidenceBindingSha256", "executionId", "permitId", "phase", "pid", "ppid",
    "processExecPath", "processStartedAtUtc", "recordedAtUtc", "requestId", "requestSha256", "schema", "sourceHead"
  ];
  const keys = phase === "first-javascript"
    ? [...baseKeys, "argvSha256"]
    : phase === "normal-quit-observed"
      ? [...baseKeys, "exitCode"]
      : baseKeys;
  const value = readOwnDataRecord(record, keys, `marker_${phase.replaceAll("-", "_")}`);
  const expected = {
    schema: `auto-svga-aeb-registered-fixture-proof-${phase}-v1`,
    phase,
    permitId: descriptor.permitId,
    executionId: descriptor.executionId,
    sourceHead: descriptor.sourceHead,
    requestId: descriptor.requestId,
    requestSha256: descriptor.requestSha256,
    d001PermitId: descriptor.d001PermitId,
    d001ExecutionId: descriptor.d001ExecutionId,
    d001PacketHead: descriptor.d001PacketHead,
    processExecPath: CONTRACT.electronExecutable,
    appPath: CONTRACT.electronApp,
    bundleId: CONTRACT.electronBundleId,
    electronVersion: CONTRACT.electronVersion,
    evidenceBindingSha256: store.bindingSha256,
  };
  for (const [field, expectedValue] of Object.entries(expected)) {
    if (value[field] !== expectedValue) reject(`registered_fixture_marker_${field}_invalid`);
  }
  if (!Number.isInteger(value.pid) || value.pid <= 0 || (expectedPid && value.pid !== expectedPid)) {
    reject("registered_fixture_marker_pid_invalid");
  }
  if (!Number.isInteger(value.ppid) || value.ppid <= 0 || !Number.isFinite(Date.parse(value.recordedAtUtc))) {
    reject("registered_fixture_marker_process_identity_invalid");
  }
  if (
    !Number.isFinite(Date.parse(value.processStartedAtUtc))
    || (expectedStartedAtUtc && value.processStartedAtUtc !== expectedStartedAtUtc)
  ) reject("registered_fixture_marker_process_start_invalid");
  if (phase === "first-javascript" && !/^[a-f0-9]{64}$/u.test(value.argvSha256)) {
    reject("registered_fixture_marker_argv_invalid");
  }
  if (phase === "normal-quit-observed" && value.exitCode !== 0) {
    reject("registered_fixture_normal_exit_invalid");
  }
  return value;
}

function validateProductReport(report, descriptor, runtimePackageTreeObservation) {
  if (
    !report
    || report.schemaVersion !== "auto-svga-aeb-native-preview-electron-proof-v2"
    || report.status !== "pass"
    || report.source?.head !== descriptor.sourceHead
    || report.package?.sha256 !== descriptor.packageSha256
    || report.fixture?.sha256 !== descriptor.fixtureSha256
    || report.generatedSvga?.sha256 !== descriptor.expectedGeneratedSvgaSha256
    || report.generatedSvga?.sizeBytes !== descriptor.expectedGeneratedSvgaBytes
    || report.execution?.actualElectronMainEntry !== true
    || report.execution?.actualPreloadIpcRoundTrip !== true
    || report.execution?.actualRendererController !== true
    || report.execution?.actualRendererSvgaMount !== true
    || report.execution?.hiddenWindow !== true
    || report.execution?.electronVersion !== CONTRACT.electronVersion
    || report.playback?.changingPlayingPixels !== true
    || report.playback?.paused?.stablePixels !== true
    || report.playback?.paused?.stableFrame !== true
    || report.save?.status !== "saved"
    || report.save?.sha256 !== descriptor.expectedGeneratedSvgaSha256
    || report.save?.sizeBytes !== descriptor.expectedGeneratedSvgaBytes
    || report.save?.byteExact !== true
    || report.network?.externalRequestCount !== 0
    || !Array.isArray(report.network?.observedExternalRequests)
    || report.network.observedExternalRequests.length !== 0
  ) reject("registered_fixture_product_report_invalid");
  assertReportPackageTree(report.package?.expectedOuterManifest, descriptor, "registered_fixture_product_expected_tree_invalid");
  assertReportPackageTree(report.package?.outerManifest, descriptor, "registered_fixture_product_tree_invalid");
  const reportedRuntimeObservation = exactRuntimePackageTreeObservation(report.package?.runtimeObservedOuterManifest, descriptor);
  assertRuntimePackageTreeObservationMatches(runtimePackageTreeObservation, reportedRuntimeObservation);
  validateOwnerModelOracle(report.ownerModelOracle);
  for (const field of ["projectSha256", "mapSha256", "assetSetSha256"]) {
    if (!/^[a-f0-9]{64}$/u.test(report.projectIdentity?.[field] || "")) {
      reject("registered_fixture_project_identity_invalid");
    }
  }
  return report;
}

function exactRuntimePackageTreeObservation(value, descriptor, store) {
  const record = readOwnDataRecord(value, [
    "d001ExecutionId",
    "d001PacketHead",
    "d001PermitId",
    "evidenceBindingSha256",
    "executionId",
    "fileCount",
    "observationSource",
    "packageRootAlias",
    "pathRedacted",
    "permitId",
    "phase",
    "requestId",
    "requestSha256",
    "schema",
    "sha256",
    "sourceHead",
    "totalBytes"
  ], "runtime_package_tree_observation");
  if (
    record.schema !== RUNTIME_PACKAGE_TREE_OBSERVATION_SCHEMA
    || record.phase !== RUNTIME_PACKAGE_TREE_OBSERVATION_PHASE
    || record.observationSource !== "aeb-native-preview-session"
    || record.sourceHead !== descriptor.sourceHead
    || record.requestId !== descriptor.requestId
    || record.requestSha256 !== descriptor.requestSha256
    || record.permitId !== descriptor.permitId
    || record.executionId !== descriptor.executionId
    || record.d001PermitId !== descriptor.d001PermitId
    || record.d001ExecutionId !== descriptor.d001ExecutionId
    || record.d001PacketHead !== descriptor.d001PacketHead
    || (store && record.evidenceBindingSha256 !== store.bindingSha256)
    || record.packageRootAlias !== "proof-package-root"
    || record.pathRedacted !== true
    || record.sha256 !== descriptor.packageTreeSha256
    || record.fileCount !== descriptor.packageTreeFileCount
    || record.totalBytes !== descriptor.packageTreeTotalBytes
  ) reject("registered_fixture_runtime_package_tree_observation_invalid");
  return record;
}

function assertRuntimePackageTreeObservationMatches(expected, actual) {
  for (const field of [
    "schema",
    "phase",
    "observationSource",
    "packageRootAlias",
    "pathRedacted",
    "sourceHead",
    "requestId",
    "requestSha256",
    "permitId",
    "executionId",
    "d001PermitId",
    "d001ExecutionId",
    "d001PacketHead",
    "evidenceBindingSha256",
    "sha256",
    "fileCount",
    "totalBytes"
  ]) {
    if (expected?.[field] !== actual?.[field]) reject("registered_fixture_runtime_package_tree_observation_invalid");
  }
  return actual;
}

function assertReportPackageTree(value, descriptor, code) {
  if (
    !value
    || value.sha256 !== descriptor.packageTreeSha256
    || value.fileCount !== descriptor.packageTreeFileCount
    || value.totalBytes !== descriptor.packageTreeTotalBytes
    || value.pathRedacted !== true
  ) reject(code);
  if (Object.prototype.hasOwnProperty.call(value, "unchangedAcrossElectronRuntime") && value.unchangedAcrossElectronRuntime !== true) {
    reject(code);
  }
  return value;
}

function assertDescriptorPackageTree(descriptor, code) {
  const snapshot = snapshotBoundedPackageTree(descriptor.packageRoot);
  return assertPackageTreeSnapshotMatchesDescriptor(snapshot, descriptor, code);
}

function assertPackageTreeSnapshotMatchesDescriptor(snapshot, descriptor, code) {
  if (
    snapshot?.sha256 !== descriptor.packageTreeSha256
    || snapshot?.fileCount !== descriptor.packageTreeFileCount
    || snapshot?.totalBytes !== descriptor.packageTreeTotalBytes
  ) reject(code);
  return snapshot;
}

function validateOwnerModelOracle(oracle) {
  if (
    !oracle
    || oracle.schema !== "auto-svga-aeb-owner-model-product-oracle-v1"
    || oracle.nativeCount !== 1
    || oracle.bakeRequiredCount !== 0
    || oracle.blockedCount !== 0
    || oracle.suggestionOnlyCount !== 0
    || oracle.outputAllowed !== true
    || oracle.readOnly !== true
    || oracle.resourceAuthorityExact !== true
    || oracle.layerAuthorityExact !== true
    || oracle.saveExportSupported !== true
  ) reject("registered_fixture_owner_model_oracle_invalid");
  return oracle;
}

async function finalizeRegisteredFixtureProductProof(authority, input) {
  const descriptor = validateDescriptor(input.descriptor);
  const d001 = consumeD001AuthorityForFinalization(authority, descriptor);
  if (
    !/^[a-f0-9]{64}$/u.test(input.descriptorSha256 || "")
    || descriptorSha256(descriptor) !== input.descriptorSha256
    || !/^[a-f0-9]{64}$/u.test(input.postrunAuthoritySha256 || "")
  ) reject("registered_fixture_finalizer_hash_binding_invalid");
  const store = input.store;
  validateEvidenceStore(store);
  if (store.outputRoot !== descriptor.outputRoot) reject("registered_fixture_finalizer_output_root_invalid");

  const firstRead = readJsonRecord(store, "reports", "registered-first-javascript-marker.json");
  assertSnapshot("firstJavaScript", firstRead, input.evidenceSnapshot);
  const first = exactMarker(firstRead.value, "first-javascript", descriptor, store);
  const requestedRead = readJsonRecord(store, "reports", "registered-normal-quit-requested.json");
  assertSnapshot("normalQuitRequested", requestedRead, input.evidenceSnapshot);
  const requested = exactMarker(
    requestedRead.value,
    "normal-quit-requested",
    descriptor,
    store,
    first.pid,
    first.processStartedAtUtc,
  );
  const willQuitRead = readJsonRecord(store, "reports", "registered-normal-quit-will-quit.json");
  assertSnapshot("normalQuitWillQuit", willQuitRead, input.evidenceSnapshot);
  const willQuit = exactMarker(
    willQuitRead.value,
    "normal-quit-will-quit",
    descriptor,
    store,
    first.pid,
    first.processStartedAtUtc,
  );
  const observedRead = readJsonRecord(store, "reports", "registered-normal-quit-observed.json");
  assertSnapshot("normalQuitObserved", observedRead, input.evidenceSnapshot);
  const observed = exactMarker(
    observedRead.value,
    "normal-quit-observed",
    descriptor,
    store,
    first.pid,
    first.processStartedAtUtc,
  );
  const timestamps = [first, requested, willQuit, observed].map((value) => Date.parse(value.recordedAtUtc));
  if (timestamps.some((value, index) => index > 0 && value < timestamps[index - 1])) {
    reject("registered_fixture_marker_order_invalid");
  }

  const reportRead = readJsonRecord(store, "reports", "aeb-native-preview-product-proof.json");
  assertSnapshot("report", reportRead, input.evidenceSnapshot);
  const runtimePackageTreeRead = readJsonRecord(store, "reports", RUNTIME_PACKAGE_TREE_OBSERVATION_RECORD);
  assertSnapshot("runtimePackageTree", runtimePackageTreeRead, input.evidenceSnapshot);
  const runtimePackageTreeObservation = exactRuntimePackageTreeObservation(runtimePackageTreeRead.value, descriptor, store);
  assertDescriptorPackageTree(descriptor, "registered_fixture_package_tree_finalization_mismatch");
  const report = validateProductReport(reportRead.value, descriptor, runtimePackageTreeObservation);
  const save = readBytesMetadata(store, "saved", "aeb-native-preview-save-as.svga");
  assertSnapshot("save", save, input.evidenceSnapshot);
  if (save.sha256 !== descriptor.expectedGeneratedSvgaSha256 || save.byteLength !== descriptor.expectedGeneratedSvgaBytes) {
    reject("registered_fixture_save_identity_invalid");
  }
  const projectRead = readBytesMetadata(store, "identity", "project.json");
  const mapRead = readBytesMetadata(store, "identity", "svga-map.json");
  const assetSetRead = readBytesMetadata(store, "identity", "asset-set.json");
  assertSnapshot("project", projectRead, input.evidenceSnapshot);
  assertSnapshot("map", mapRead, input.evidenceSnapshot);
  assertSnapshot("assetSet", assetSetRead, input.evidenceSnapshot);
  const projectIdentity = {
    projectSha256: projectRead.sha256,
    mapSha256: mapRead.sha256,
    assetSetSha256: assetSetRead.sha256,
  };
  for (const [field, value] of Object.entries(projectIdentity)) {
    if (value !== report.projectIdentity[field]) reject("registered_fixture_identity_artifact_mismatch");
  }

  const nowMs = Date.now();
  const postrunAuthority = await loadAndValidateProcessAuthority({
    artifactPath: input.postrunAuthorityPath,
    artifactSha256: input.postrunAuthoritySha256,
    phase: "postrun",
    executionId: descriptor.executionId,
    expectedPid: first.pid,
    notBeforeMs: timestamps[3],
    nowMs,
  });
  if (!postrunAuthority || postrunAuthority.artifact?.authorityAccepted !== true) {
    reject("registered_fixture_postrun_authority_invalid");
  }
  const crashes = crashDelta(input.crashBefore, input.crashAfter);
  if (!Array.isArray(crashes) || crashes.length !== 0) reject("registered_fixture_crash_delta_present");
  const filesystemRuntimeState = assertRuntimeStateResidueAbsent(store);

  const processIdentitySha256 = createHash("sha256").update(JSON.stringify({
    pid: first.pid,
    ppid: first.ppid,
    processExecPath: first.processExecPath,
    appPath: first.appPath,
    processStartedAtUtc: first.processStartedAtUtc,
    firstJavascriptAtUtc: first.recordedAtUtc,
  })).digest("hex");
  const disposition = {
    schema: FINAL_SCHEMA,
    status: "pass",
    permitId: descriptor.permitId,
    executionId: descriptor.executionId,
    sourceHead: descriptor.sourceHead,
    requestId: descriptor.requestId,
    requestSha256: descriptor.requestSha256,
    d001PermitId: descriptor.d001PermitId,
    d001ExecutionId: descriptor.d001ExecutionId,
    d001PacketHead: descriptor.d001PacketHead,
    d001AuthoritySha256: d001.sha256,
    descriptorSha256: input.descriptorSha256,
    evidenceBindingSha256: store.bindingSha256,
    firstJavascriptMarkerSha256: firstRead.sha256,
    reportSha256: reportRead.sha256,
    saveSha256: save.sha256,
    saveBytes: save.byteLength,
    processIdentitySha256,
    postrunAuthorityArtifactSha256: input.postrunAuthoritySha256,
    crashDeltaCount: crashes.length,
    launchAttemptsPerformed: input.launchAttemptsPerformed,
    retryUsed: input.retryUsed,
    fallbackUsed: input.fallbackUsed,
    forcedTerminationUsed: input.forcedTerminationUsed,
    normalQuitObserved: observed.exitCode === 0,
    postrunProcessAuthorityAccepted: postrunAuthority.artifact.authorityAccepted === true,
    processResidueObserved: false,
    filesystemRuntimeStateResidueObserved: filesystemRuntimeState.filesystemRuntimeStateResidueObserved,
    runtimeStateEntryCount: filesystemRuntimeState.runtimeStateEntryCount,
    evidenceArtifactsRetained: true,
    productProofContinued: true,
    previewPixelsProved: true,
    saveBytesProved: true,
    finalizedAtUtc: new Date(nowMs).toISOString(),
  };
  if (
    disposition.launchAttemptsPerformed !== 1
    || disposition.retryUsed !== false
    || disposition.fallbackUsed !== false
    || disposition.forcedTerminationUsed !== false
  ) reject("registered_fixture_lifecycle_invariants_invalid");
  const publication = writeJsonRecord(store, "reports", "registered-fixture-final-disposition.json", disposition);
  const readback = readJsonRecord(store, "reports", "registered-fixture-final-disposition.json");
  if (publication.sha256 !== readback.sha256 || publication.byteLength !== readback.byteLength) {
    reject("registered_fixture_final_disposition_publication_invalid");
  }
  return disposition;
}

async function run(options) {
  const descriptor = validateDescriptor(options.descriptor);
  if (descriptorSha256(descriptor) !== options.descriptorSha256) reject("registered_fixture_descriptor_hash_mismatch");
  const d001Options = validateParsedD001Lifecycle(options.d001Lifecycle, descriptor);
  verifySourceBinding(descriptor);
  boundedSourceFileSha256(D001_ORCHESTRATOR_PATH, D001_ORCHESTRATOR_SHA256);
  boundedSourceFileSha256(D001_FINALIZER_PATH, D001_FINALIZER_SHA256);
  const productMaterialSnapshot = captureProductMaterialHashes();
  assertDescriptorPackageTree(descriptor, "registered_fixture_package_tree_prepared_mismatch");
  verifySourceBinding(descriptor);
  revalidateProductMaterialHashes(productMaterialSnapshot);
  const d001Result = await runExactD001Lifecycle(d001Options);
  const authority = validateD001LifecycleResult(d001Result, descriptor);

  verifySourceBinding(descriptor);
  const store = createEvidenceStore(descriptor.outputRoot);
  const descriptorPublication = writeJsonRecord(store, "reports", "registered-fixture-descriptor.json", descriptor);
  if (descriptorPublication.sha256 !== options.descriptorSha256) reject("registered_fixture_descriptor_publication_mismatch");
  const launch = buildRegisteredLaunch(authority, descriptor, store);
  const crashBefore = await collectCrashContext();
  let launchAttemptsPerformed = 0;
  let finalizerInvocations = 0;
  try {
    verifySourceBinding(descriptor);
    revalidateProductMaterialHashes(productMaterialSnapshot);
    assertDescriptorPackageTree(descriptor, "registered_fixture_package_tree_prelaunch_mismatch");
    launchAttemptsPerformed += 1;
    let launchResult;
    try {
      launchResult = spawnSync(launch.command, launch.args, { encoding: "utf8", maxBuffer: 1024 * 1024 });
    } finally {
      clearRuntimeState(store);
      assertRuntimeStateResidueAbsent(store);
    }
    if (!launchResult || launchResult.status !== 0 || launchResult.signal) reject("registered_fixture_registered_launch_failed");
    const firstRead = await waitForJsonRecord(store, "registered-first-javascript-marker.json");
    const expectedPid = firstRead.value?.pid;
    if (!Number.isInteger(expectedPid) || expectedPid <= 0) reject("registered_fixture_runtime_pid_missing");
    await waitForJsonRecord(store, "registered-normal-quit-observed.json");
    await waitForJsonRecord(store, "aeb-native-preview-product-proof.json");
    const evidenceSnapshot = captureEvidenceSnapshot(store);

    const producerInvocation = buildProcessAuthorityInvocation({
      phase: "postrun",
      executionId: descriptor.executionId,
      expectedPid,
    });
    const preparedAuthorityPaths = await prepareProcessAuthorityRoot({
      executionId: descriptor.executionId,
      requireAbsent: true,
    });
    if (preparedAuthorityPaths.authorityRoot !== producerInvocation.authorityRoot) {
      reject("registered_fixture_postrun_authority_root_mismatch");
    }
    const producerResult = spawnSync(producerInvocation.command, producerInvocation.args, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    if (!producerResult || producerResult.status !== 0 || producerResult.signal) {
      reject("registered_fixture_postrun_authority_command_failed");
    }
    const postrunAuthoritySha256 = await sha256File(producerInvocation.artifactPath);
    await new Promise((resolve) => setTimeout(resolve, CRASH_SETTLE_DELAY_MS));
    const crashAfter = await collectCrashContext();
    finalizerInvocations += 1;
    const disposition = await finalizeRegisteredFixtureProductProof(authority, {
      descriptor,
      store,
      descriptorSha256: options.descriptorSha256,
      postrunAuthorityPath: producerInvocation.artifactPath,
      postrunAuthoritySha256,
      crashBefore,
      crashAfter,
      evidenceSnapshot,
      launchAttemptsPerformed,
      retryUsed: false,
      fallbackUsed: false,
      forcedTerminationUsed: false,
    });
    if (disposition.status !== "pass" || finalizerInvocations !== 1) reject("registered_fixture_finalizer_rejected");
    return disposition;
  } catch (error) {
    try {
      writeJsonRecord(store, "reports", "registered-fixture-failed-disposition.json", {
        schema: "auto-svga-aeb-registered-fixture-product-proof-failure-v1",
        status: "failed_closed",
        issueCode: typeof error?.code === "string" ? error.code : "registered_fixture_orchestration_failed",
        launchAttemptsPerformed,
        finalizerInvocations,
        retryUsed: false,
        fallbackUsed: false,
        forcedTerminationUsed: false,
      });
    } catch {
      // The original failure remains authoritative; no overwrite or fallback is attempted.
    }
    throw error;
  }
}

export async function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);
  const descriptorInput = parseBase64Json(parsed["descriptor-base64"], "registered_fixture_descriptor_json_invalid");
  const descriptor = validateDescriptor(descriptorInput.value);
  if (!descriptorInput.bytes.equals(canonicalDescriptorBytes(descriptor))) {
    reject("registered_fixture_descriptor_json_noncanonical");
  }
  const descriptorSha = parsed["descriptor-sha256"];
  if (!/^[a-f0-9]{64}$/u.test(descriptorSha)) reject("registered_fixture_descriptor_hash_invalid");
  const d001Input = parseBase64Json(parsed["d001-lifecycle-base64"], "registered_fixture_d001_lifecycle_json_invalid");
  const d001Lifecycle = parseD001Lifecycle(d001Input.value, descriptor);
  if (!d001Input.bytes.equals(canonicalD001LifecycleBytes(d001Lifecycle))) {
    reject("registered_fixture_d001_lifecycle_json_noncanonical");
  }
  return run({ descriptor, descriptorSha256: descriptorSha, d001Lifecycle });
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().then((result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }).catch((error) => {
    process.stderr.write(`${JSON.stringify({
      status: "failed_closed",
      issueCode: typeof error?.code === "string" ? error.code : "registered_fixture_orchestration_failed"
    })}\n`);
    process.exitCode = 1;
  });
}

export {
  CLI_KEYS,
  D001_LIFECYCLE_KEYS,
  canonicalD001LifecycleBytes,
  parseArgs,
  parseD001Lifecycle,
  validateProductReport,
};
export { assertPackageTreeSnapshotMatchesDescriptor };
