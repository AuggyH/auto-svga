import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";

const require = createRequire(import.meta.url);
const { canonicalPackageTreeDigest } = require("./aeb-ae-package-handoff.cjs");
const {
  CONTRACT,
  canonicalDescriptorBytes,
  descriptorSha256,
  validateDescriptor,
} = require("./aeb-registered-fixture-proof-contract.cjs");
const {
  HELPER_PATH,
  HELPER_SHA256,
  assertRuntimeStateResidueAbsent,
  clearRuntimeState,
  createEvidenceStore,
  readBytesMetadata,
  readJsonRecord,
  writeJsonRecord,
} = require("./registered-fixture-proof-evidence-store.cjs");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const AEB_PACKAGE_TASK_ROOT = CONTRACT.taskRoot;
const AEB_OUTPUT_TASK_ROOT = CONTRACT.taskRoot;
const OPEN_PATH = "/usr/bin/open";
const PRODUCT_PROOF_CLI_KEYS = Object.freeze(["descriptor-path", "descriptor-sha256"]);
const PRODUCT_PROOF_REPORT_RECORD = "aeb-native-preview-product-proof.json";
const PRODUCT_PROOF_SAVE_RECORD = "aeb-native-preview-save-as.svga";
const PRODUCT_PROOF_WRAPPER_NAME = "product-proof-registered-bootstrap.cjs";
const AEB_MAX_PACKAGE_FILE_BYTES = 10 * 1024 * 1024;
const AEB_MAX_PACKAGE_BYTES = 25 * 1024 * 1024;
const AEB_MAX_PACKAGE_FILES = 128;

export async function runAebNativePreviewProductProof(input, runtime = {}) {
  const descriptor = validateDescriptor(input);
  const { packageRoot, outputRoot } = resolveProductProofRoots(descriptor.packageRoot, descriptor.outputRoot);
  const reportPath = path.join(outputRoot, "reports", PRODUCT_PROOF_REPORT_RECORD);
  const identityRoot = path.join(outputRoot, "identity");
  const packagePath = path.join(packageRoot, "ae-export-package.finalized.json");
  const fixturePath = path.join(packageRoot, "assets/layer-0001.png");
  const expected = expectedFromDescriptor(descriptor);
  const sourceHead = gitHead();
  const sourceClean = gitStatus() === "";

  assertEqual(sourceHead, expected.sourceHead, "source_head_drift");
  assertEqual(sourceClean, true, "source_not_clean");
  assertRegularFile(packagePath, "package_missing");
  assertRegularFile(fixturePath, "fixture_missing");
  assertEqual(fileSha256(packagePath), expected.packageSha256, "package_hash_drift");
  assertEqual(fileSha256(fixturePath), expected.fixtureSha256, "fixture_hash_drift");
  assertRegularSingleLinkFile(CONTRACT.electronExecutable, "electron_runtime_missing");
  assertRegularSingleLinkFile(CONTRACT.bootstrapPath, "electron_bootstrap_missing");
  if (fs.existsSync(outputRoot)) throw proofError("output_root_exists");
  const packageManifestBefore = snapshotBoundedPackageTree(packageRoot);
  assertPackageTreeMatchesExpected(packageManifestBefore, expected, "package_tree_descriptor_mismatch");

  assertPrivateProductProofTaskRoot(AEB_OUTPUT_TASK_ROOT);
  const store = (runtime.createEvidenceStore ?? createEvidenceStore)(outputRoot);
  const descriptorPublication = (runtime.writeJsonRecord ?? writeJsonRecord)(
    store,
    "reports",
    "registered-fixture-descriptor.json",
    descriptor,
  );
  if (descriptorPublication.sha256 !== descriptorSha256(descriptor)) {
    throw proofError("electron_descriptor_publication_invalid");
  }
  const wrapper = writeProductProofBootstrapWrapper(store);
  const savePath = path.join(outputRoot, "saved", PRODUCT_PROOF_SAVE_RECORD);
  const stdoutPath = path.join(outputRoot, "reports/electron-stdout.log");
  const stderrPath = path.join(outputRoot, "reports/electron-stderr.log");
  const launch = buildRegisteredProductProofLaunch({ descriptor, store, wrapper, stdoutPath, stderrPath });
  let execution;
  let runtimeStateCleanup;
  let filesystemRuntimeState;
  try {
    execution = (runtime.spawnSync ?? spawnSync)(launch.command, launch.args, {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024
    });
  } finally {
    runtimeStateCleanup = (runtime.clearRuntimeState ?? clearRuntimeState)(store);
    filesystemRuntimeState = (runtime.assertRuntimeStateResidueAbsent ?? assertRuntimeStateResidueAbsent)(store);
  }
  const packageManifestAfter = snapshotBoundedPackageTree(packageRoot);
  assertPackageTreeMatchesExpected(packageManifestAfter, expected, "package_tree_descriptor_mismatch");
  assertPackageTreeUnchanged(packageManifestBefore, packageManifestAfter);
  if (execution.error?.code === "ETIMEDOUT") throw proofError("electron_proof_timeout");
  if (!execution || execution.status !== 0 || execution.signal) throw proofError("electron_registered_launch_failed");
  const evidence = readProductProofEvidence(store, runtime);
  validateProductProofLifecycleEvidence(evidence, descriptor, store);
  const expectedWithEvidence = { ...expected, evidenceBindingSha256: store.bindingSha256 };
  validateElectronProductProofReport(evidence.report.value, expectedWithEvidence);
  const report = evidence.report.value;
  const independentlyReadIdentity = validateProjectIdentityArtifacts({ report, packagePath, identityRoot });
  assertEqual(evidence.project.sha256, independentlyReadIdentity.projectSha256, "electron_project_evidence_binding_drift");
  assertEqual(evidence.map.sha256, independentlyReadIdentity.mapSha256, "electron_map_evidence_binding_drift");
  assertEqual(evidence.assetSet.sha256, independentlyReadIdentity.assetSetSha256, "electron_asset_set_evidence_binding_drift");
  assertEqual(evidence.save.sha256, expected.generatedSvgaSha256, "electron_save_output_hash_drift");
  assertEqual(evidence.save.byteLength, expected.generatedSvgaBytes, "electron_save_output_size_drift");
  assertRegularFile(savePath, "electron_save_output_missing");
  assertEqual(fileSha256(savePath), evidence.save.sha256, "electron_save_output_identity_drift");
  assertEqual(fileSha256(packagePath), expected.packageSha256, "package_mutated_after_proof");
  assertEqual(fileSha256(fixturePath), expected.fixtureSha256, "fixture_mutated_after_proof");
  assertEqual(gitStatus(), "", "source_dirty_after_proof");
  rejectRawPaths(report);
  return {
    report,
    reportPath,
    reportSha256: evidence.report.sha256,
    runtimeStateCleanup,
    filesystemRuntimeState,
  };
}

function expectedFromDescriptor(descriptor) {
  return validateExpected({
    sourceHead: descriptor.sourceHead,
    packageSha256: descriptor.packageSha256,
    packageTreeSha256: descriptor.packageTreeSha256,
    packageTreeFileCount: descriptor.packageTreeFileCount,
    packageTreeTotalBytes: descriptor.packageTreeTotalBytes,
    fixtureSha256: descriptor.fixtureSha256,
    generatedSvgaSha256: descriptor.expectedGeneratedSvgaSha256,
    generatedSvgaBytes: descriptor.expectedGeneratedSvgaBytes,
    requestId: descriptor.requestId,
    requestSha256: descriptor.requestSha256,
    permitId: descriptor.permitId,
    executionId: descriptor.executionId,
    d001PermitId: descriptor.d001PermitId,
    d001ExecutionId: descriptor.d001ExecutionId,
    d001PacketHead: descriptor.d001PacketHead,
  });
}

function writeProductProofBootstrapWrapper(store) {
  const wrapperPath = path.join(store.outputRoot, "session-data", PRODUCT_PROOF_WRAPPER_NAME);
  const expectedDirectory = path.join(store.outputRoot, "session-data");
  if (path.dirname(wrapperPath) !== expectedDirectory) throw proofError("electron_bootstrap_wrapper_path_invalid");
  const source = [
    '"use strict";',
    `require(${JSON.stringify(CONTRACT.bootstrapPath)}).main(process.argv.slice(2));`,
    "",
  ].join("\n");
  fs.writeFileSync(wrapperPath, source, { flag: "wx", mode: 0o600 });
  const before = fs.lstatSync(wrapperPath);
  const bytes = fs.readFileSync(wrapperPath);
  const after = fs.lstatSync(wrapperPath);
  if (
    !before.isFile()
    || before.isSymbolicLink()
    || before.nlink !== 1
    || fs.realpathSync(wrapperPath) !== wrapperPath
    || before.dev !== after.dev
    || before.ino !== after.ino
    || before.size !== after.size
    || after.nlink !== 1
    || bytes.byteLength !== after.size
  ) throw proofError("electron_bootstrap_wrapper_identity_invalid");
  return Object.freeze({ path: wrapperPath, sha256: sha256(bytes) });
}

export function buildRegisteredProductProofLaunch({ descriptor: input, store, wrapper, stdoutPath, stderrPath }) {
  const descriptor = validateDescriptor(input);
  if (
    !store
    || store.outputRoot !== descriptor.outputRoot
    || typeof store.bindingSha256 !== "string"
    || !/^[a-f0-9]{64}$/u.test(store.bindingSha256)
    || !store.binding
    || typeof store.binding !== "object"
    || Array.isArray(store.binding)
    || utilTypes.isProxy(store.binding)
    || typeof wrapper?.path !== "string"
    || path.dirname(wrapper.path) !== path.join(descriptor.outputRoot, "session-data")
    || !/^[a-f0-9]{64}$/u.test(wrapper.sha256 || "")
    || stdoutPath !== path.join(descriptor.outputRoot, "reports/electron-stdout.log")
    || stderrPath !== path.join(descriptor.outputRoot, "reports/electron-stderr.log")
  ) throw proofError("electron_registered_launch_binding_invalid");
  return Object.freeze({
    command: OPEN_PATH,
    args: Object.freeze([
      "-W", "-n", "-g",
      "--stdout", stdoutPath,
      "--stderr", stderrPath,
      "-a", CONTRACT.electronApp,
      "--args",
      wrapper.path,
      "--descriptor-path", path.join(descriptor.outputRoot, "reports", "registered-fixture-descriptor.json"),
      "--descriptor-sha256", descriptorSha256(descriptor),
      "--evidence-binding-base64", Buffer.from(JSON.stringify(store.binding), "utf8").toString("base64url"),
      "--evidence-binding-sha256", store.bindingSha256,
      "--evidence-helper-path", HELPER_PATH,
      "--evidence-helper-sha256", HELPER_SHA256,
      "--output-root", descriptor.outputRoot,
    ]),
  });
}

function readProductProofEvidence(store, runtime = {}) {
  const readJson = runtime.readJsonRecord ?? readJsonRecord;
  const readBytes = runtime.readBytesMetadata ?? readBytesMetadata;
  const requiredJson = (name, code) => {
    try {
      return readJson(store, "reports", name);
    } catch {
      throw proofError(code);
    }
  };
  const requiredBytes = (group, name, code) => {
    try {
      return readBytes(store, group, name);
    } catch {
      throw proofError(code);
    }
  };
  return Object.freeze({
    firstJavaScript: requiredJson("registered-first-javascript-marker.json", "electron_first_javascript_missing"),
    normalQuitRequested: requiredJson("registered-normal-quit-requested.json", "electron_normal_quit_requested_missing"),
    normalQuitWillQuit: requiredJson("registered-normal-quit-will-quit.json", "electron_normal_quit_will_quit_missing"),
    normalQuitObserved: requiredJson("registered-normal-quit-observed.json", "electron_normal_quit_observed_missing"),
    report: requiredJson(PRODUCT_PROOF_REPORT_RECORD, "electron_report_missing"),
    save: requiredBytes("saved", PRODUCT_PROOF_SAVE_RECORD, "electron_save_output_missing"),
    project: requiredBytes("identity", "project.json", "electron_project_artifact_missing"),
    map: requiredBytes("identity", "svga-map.json", "electron_map_artifact_missing"),
    assetSet: requiredBytes("identity", "asset-set.json", "electron_asset_set_artifact_missing"),
  });
}

function exactOwnRecord(value, keys, code) {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || utilTypes.isProxy(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) throw proofError(code);
  const ownKeys = Reflect.ownKeys(value);
  const expectedKeys = [...keys].sort();
  if (
    ownKeys.some((key) => typeof key !== "string")
    || ownKeys.slice().sort().some((key, index) => key !== expectedKeys[index])
    || ownKeys.length !== expectedKeys.length
  ) throw proofError(code);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const result = Object.create(null);
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set || descriptor.enumerable !== true) {
      throw proofError(code);
    }
    const primitive = descriptor.value;
    if (primitive !== null && !["string", "number", "boolean"].includes(typeof primitive)) throw proofError(code);
    result[key] = primitive;
  }
  return result;
}

function exactProductProofMarker(record, phase, descriptor, store, expectedPid, expectedStartedAtUtc) {
  const baseKeys = [
    "appPath", "bundleId", "d001ExecutionId", "d001PacketHead", "d001PermitId",
    "electronVersion", "evidenceBindingSha256", "executionId", "permitId", "phase", "pid", "ppid",
    "processExecPath", "processStartedAtUtc", "recordedAtUtc", "requestId", "requestSha256",
    "schema", "sourceHead",
  ];
  const keys = phase === "first-javascript"
    ? [...baseKeys, "argvSha256"]
    : phase === "normal-quit-observed"
      ? [...baseKeys, "exitCode"]
      : baseKeys;
  const value = exactOwnRecord(record, keys, `electron_${phase.replaceAll("-", "_")}_invalid`);
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
    if (value[field] !== expectedValue) throw proofError(`electron_marker_${field}_invalid`);
  }
  if (!Number.isInteger(value.pid) || value.pid <= 0 || (expectedPid && value.pid !== expectedPid)) {
    throw proofError("electron_marker_pid_invalid");
  }
  if (!Number.isInteger(value.ppid) || value.ppid <= 0 || !Number.isFinite(Date.parse(value.recordedAtUtc))) {
    throw proofError("electron_marker_process_identity_invalid");
  }
  if (
    !Number.isFinite(Date.parse(value.processStartedAtUtc))
    || (expectedStartedAtUtc && value.processStartedAtUtc !== expectedStartedAtUtc)
  ) throw proofError("electron_marker_process_start_invalid");
  if (phase === "first-javascript" && !/^[a-f0-9]{64}$/u.test(value.argvSha256)) {
    throw proofError("electron_marker_argv_invalid");
  }
  if (phase === "normal-quit-observed" && value.exitCode !== 0) throw proofError("electron_normal_exit_invalid");
  return value;
}

export function validateProductProofLifecycleEvidence(evidence, descriptorInput, store) {
  const descriptor = validateDescriptor(descriptorInput);
  const first = exactProductProofMarker(evidence?.firstJavaScript?.value, "first-javascript", descriptor, store);
  const requested = exactProductProofMarker(
    evidence?.normalQuitRequested?.value,
    "normal-quit-requested",
    descriptor,
    store,
    first.pid,
    first.processStartedAtUtc,
  );
  const willQuit = exactProductProofMarker(
    evidence?.normalQuitWillQuit?.value,
    "normal-quit-will-quit",
    descriptor,
    store,
    first.pid,
    first.processStartedAtUtc,
  );
  const observed = exactProductProofMarker(
    evidence?.normalQuitObserved?.value,
    "normal-quit-observed",
    descriptor,
    store,
    first.pid,
    first.processStartedAtUtc,
  );
  const times = [first, requested, willQuit, observed].map((record) => Date.parse(record.recordedAtUtc));
  if (times.some((value, index) => index > 0 && value < times[index - 1])) {
    throw proofError("electron_lifecycle_marker_order_invalid");
  }
  return Object.freeze({ pid: first.pid, processStartedAtUtc: first.processStartedAtUtc, normalExitCode: observed.exitCode });
}

export function snapshotBoundedPackageTree(packageRoot) {
  const resolvedRoot = path.resolve(packageRoot);
  const rootStat = fs.lstatSync(resolvedRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || fs.realpathSync(resolvedRoot) !== resolvedRoot) {
    throw proofError("package_tree_root_invalid");
  }
  const entries = [];
  let totalBytes = 0;
  const visit = (directory, relativeRoot = "") => {
    for (const name of fs.readdirSync(directory).sort()) {
      const absolute = path.join(directory, name);
      const relative = path.posix.join(relativeRoot, name);
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) throw proofError("package_tree_symlink");
      if (stat.isDirectory()) {
        visit(absolute, relative);
        continue;
      }
      if (!stat.isFile()) throw proofError("package_tree_entry_invalid");
      const bytes = readBoundedProofFile(absolute, AEB_MAX_PACKAGE_FILE_BYTES);
      totalBytes += bytes.byteLength;
      entries.push({ relative, sizeBytes: bytes.byteLength, sha256: sha256(bytes) });
      if (entries.length > AEB_MAX_PACKAGE_FILES || totalBytes > AEB_MAX_PACKAGE_BYTES) {
        throw proofError("package_tree_bound");
      }
    }
  };
  visit(resolvedRoot);
  if (entries.length === 0) throw proofError("package_tree_empty");
  return {
    entries,
    fileCount: entries.length,
    totalBytes,
    sha256: canonicalPackageTreeDigest(entries)
  };
}

export function assertPackageTreeUnchanged(before, after) {
  if (
    before?.sha256 !== after?.sha256
    || before?.fileCount !== after?.fileCount
    || before?.totalBytes !== after?.totalBytes
    || stableStringify(before?.entries) !== stableStringify(after?.entries)
  ) throw proofError("package_tree_mutated_during_electron_proof");
  return true;
}

export function validateElectronProductProofReport(report, expectedInput) {
  const expected = validateExpected(expectedInput);
  assertEqual(report?.schemaVersion, "auto-svga-aeb-native-preview-electron-proof-v2", "electron_proof_schema_invalid");
  assertEqual(report?.status, "pass", "electron_proof_status_failed");
  assertEqual(report?.productMilestoneId, "0.3.0-alpha.1", "electron_product_milestone_invalid");
  assertEqual(report?.source?.head, expected.sourceHead, "electron_source_head_drift");
  for (const [field, code] of [
    ["actualElectronMainEntry", "electron_main_path_unproven"],
    ["actualPreloadIpcRoundTrip", "electron_preload_ipc_unproven"],
    ["actualRendererController", "electron_renderer_controller_unproven"],
    ["actualRendererSvgaMount", "electron_renderer_mount_unproven"],
    ["rendererActionBridgeOpen", "electron_renderer_action_unproven"],
    ["hiddenWindow", "electron_hidden_window_unproven"],
    ["taskOwnedUserDataBound", "electron_user_data_binding_unproven"],
    ["userDataPathRedacted", "electron_user_data_redaction_unproven"]
  ]) assertEqual(report?.execution?.[field], true, code);
  assertEqual(report?.package?.sha256, expected.packageSha256, "electron_package_hash_drift");
  assertEqual(report?.package?.sourceImmutable, true, "electron_package_immutability_unproven");
  assertReportPackageManifest(report?.package?.expectedOuterManifest, expected, "electron_expected_package_manifest");
  assertRuntimePackageTreeObservation(report?.package?.runtimeObservedOuterManifest, expected);
  assertReportPackageManifest(report?.package?.outerManifest, expected, "electron_package_manifest");
  assertEqual(report.package.outerManifest.unchangedAcrossElectronRuntime, true, "electron_package_manifest_changed");
  assertEqual(report.package.outerManifest.pathRedacted, true, "electron_package_manifest_path_leak");
  assertEqual(report?.fixture?.sha256, expected.fixtureSha256, "electron_fixture_hash_drift");
  assertEqual(report?.generatedSvga?.sha256, expected.generatedSvgaSha256, "electron_generated_svga_hash_drift");
  assertEqual(report?.generatedSvga?.sizeBytes, expected.generatedSvgaBytes, "electron_generated_svga_size_drift");
  assertEqual(report?.generatedSvga?.rendererMounted, true, "electron_generated_svga_mount_unproven");
  assertEqual(report?.generatedSvga?.playbackLoadPrepared, true, "electron_playback_load_unproven");
  assertProjectIdentity(report?.projectIdentity);
  assertOwnerModelOracle(report?.ownerModelOracle);
  assertEqual(report.projectIdentity.hostReadbackMatched, true, "electron_project_host_readback_unproven");
  assertEqual(report?.identityArtifacts?.project, "project.json", "electron_project_artifact_invalid");
  assertEqual(report?.identityArtifacts?.map, "svga-map.json", "electron_map_artifact_invalid");
  assertEqual(report?.identityArtifacts?.assetSet, "asset-set.json", "electron_asset_set_artifact_invalid");
  assertEqual(report?.identityArtifacts?.pathRedacted, true, "electron_identity_artifact_path_leak");
  if ((report?.renderer?.informationFacts ?? 0) < 4) throw proofError("electron_information_facts_missing");
  if ((report?.renderer?.assets ?? 0) < 1) throw proofError("electron_asset_inventory_missing");
  if ((report?.renderer?.diagnostics ?? 0) < 1) throw proofError("electron_diagnostics_missing");
  assertEqual(report?.renderer?.runtimeCanvas?.source, "canvas-backing-store", "electron_direct_pixels_unproven");
  assertEqual(report?.playback?.changingPlayingPixels, true, "electron_playing_pixels_static");
  if (!Array.isArray(report?.playback?.playingSamples) || report.playback.playingSamples.length < 2) {
    throw proofError("electron_playing_samples_missing");
  }
  assertEqual(report?.playback?.paused?.stablePixels, true, "electron_paused_pixels_changed");
  assertEqual(report?.playback?.paused?.stableFrame, true, "electron_paused_frame_changed");
  assertEqual(report?.save?.status, "saved", "electron_save_as_failed");
  assertEqual(report?.save?.sha256, expected.generatedSvgaSha256, "electron_save_as_hash_drift");
  assertEqual(report?.save?.sizeBytes, expected.generatedSvgaBytes, "electron_save_as_size_drift");
  assertEqual(report?.save?.byteExact, true, "electron_save_as_bytes_unproven");
  assertEqual(report?.save?.overwriteAllowed, false, "electron_overwrite_boundary_failed");
  assertEqual(report?.network?.captureInstalled, true, "electron_network_capture_missing");
  assertEqual(report?.network?.externalRequestCount, 0, "electron_external_request_observed");
  assertEqual(Array.isArray(report?.network?.observedExternalRequests), true, "electron_external_request_capture_invalid");
  assertEqual(report.network.observedExternalRequests.length, 0, "electron_external_request_observed");
  for (const field of ["sourcePackageMutation", "renderOrBakeExecuted", "foregroundUsed", "installedAppMutated", "supportClaimAllowed", "productOwnerAcceptanceClaimed", "releaseClaimed"]) {
    assertEqual(report?.boundaries?.[field], false, `electron_boundary_${field}_failed`);
  }
  rejectRawPaths(report);
  return report;
}

export function validateProjectIdentityArtifacts({ report, packagePath, identityRoot }) {
  const projectPath = path.join(identityRoot, "project.json");
  const mapPath = path.join(identityRoot, "svga-map.json");
  const assetSetPath = path.join(identityRoot, "asset-set.json");
  for (const [filePath, code] of [
    [projectPath, "electron_project_artifact_missing"],
    [mapPath, "electron_map_artifact_missing"],
    [assetSetPath, "electron_asset_set_artifact_missing"]
  ]) assertRegularFile(filePath, code);

  const packageDocument = readJsonFile(packagePath, "electron_package_json_invalid");
  const packageValue = packageDocument?.schemaVersion === "aeb-wp2-script-output-v0"
    ? packageDocument.aeExportPackage
    : packageDocument;
  const packageId = packageValue?.packageIdentity?.packageId;
  if (typeof packageId !== "string" || !/^[A-Za-z0-9._-]{1,120}$/u.test(packageId)) {
    throw proofError("electron_package_project_identity_invalid");
  }
  const projectBytes = fs.readFileSync(projectPath);
  const mapBytes = fs.readFileSync(mapPath);
  const assetSetBytes = fs.readFileSync(assetSetPath);
  const project = parseJsonBytes(projectBytes, "electron_project_json_invalid");
  const map = parseJsonBytes(mapBytes, "electron_map_json_invalid");
  const assetSet = parseJsonBytes(assetSetBytes, "electron_asset_set_json_invalid");
  const expectedProjectId = `${packageId}-wp5am-native-subset`;
  assertEqual(project?.projectId, expectedProjectId, "electron_project_id_drift");
  assertEqual(map?.projectId, expectedProjectId, "electron_map_project_id_drift");
  const expectedAssetSet = (packageValue?.semanticGraph?.assets ?? []).map((asset) => ({
    id: asset?.assetId,
    sha256: asset?.sha256
  }));
  if (!Array.isArray(assetSet) || stableStringify(assetSet) !== stableStringify(expectedAssetSet)) {
    throw proofError("electron_asset_set_binding_drift");
  }
  if (stableStringify((project?.assets ?? []).map((asset) => asset?.id)) !== stableStringify(assetSet.map((asset) => asset.id))) {
    throw proofError("electron_project_asset_identity_drift");
  }
  const independentlyRead = {
    projectId: expectedProjectId,
    projectSha256: sha256(projectBytes),
    mapSha256: sha256(mapBytes),
    assetSetSha256: sha256(assetSetBytes)
  };
  for (const [field, code] of [
    ["projectId", "electron_project_id_binding_drift"],
    ["projectSha256", "electron_project_sha256_binding_drift"],
    ["mapSha256", "electron_map_sha256_binding_drift"],
    ["assetSetSha256", "electron_asset_set_sha256_binding_drift"]
  ]) {
    assertEqual(report?.projectIdentity?.[field], independentlyRead[field], code);
  }
  rejectRawPaths({ project, map, assetSet });
  return independentlyRead;
}

function assertOwnerModelOracle(value) {
  if (
    !value
    || value.schema !== "auto-svga-aeb-owner-model-product-oracle-v1"
    || value.nativeCount !== 1
    || value.bakeRequiredCount !== 0
    || value.blockedCount !== 0
    || value.suggestionOnlyCount !== 0
    || value.outputAllowed !== true
    || value.readOnly !== true
    || value.resourceAuthorityExact !== true
    || value.layerAuthorityExact !== true
    || value.saveExportSupported !== true
  ) throw proofError("electron_owner_model_oracle_invalid");
}

function validateExpected(input) {
  const value = {
    sourceHead: input.sourceHead,
    packageSha256: input.packageSha256,
    packageTreeSha256: input.packageTreeSha256,
    packageTreeFileCount: Number(input.packageTreeFileCount),
    packageTreeTotalBytes: Number(input.packageTreeTotalBytes),
    fixtureSha256: input.fixtureSha256,
    generatedSvgaSha256: input.generatedSvgaSha256,
    generatedSvgaBytes: Number(input.generatedSvgaBytes),
    requestId: input.requestId,
    requestSha256: input.requestSha256,
    permitId: input.permitId,
    executionId: input.executionId,
    d001PermitId: input.d001PermitId,
    d001ExecutionId: input.d001ExecutionId,
    d001PacketHead: input.d001PacketHead,
    evidenceBindingSha256: input.evidenceBindingSha256,
  };
  if (!/^[a-f0-9]{40}$/u.test(value.sourceHead || "")) throw proofError("invalid_sourceHead");
  for (const field of ["packageSha256", "packageTreeSha256", "fixtureSha256", "generatedSvgaSha256"]) {
    if (!/^[a-f0-9]{64}$/u.test(value[field] || "")) throw proofError(`invalid_${field}`);
  }
  if (!Number.isInteger(value.packageTreeFileCount) || value.packageTreeFileCount <= 0 || value.packageTreeFileCount > AEB_MAX_PACKAGE_FILES) {
    throw proofError("invalid_package_tree_file_count");
  }
  if (!Number.isInteger(value.packageTreeTotalBytes) || value.packageTreeTotalBytes <= 0 || value.packageTreeTotalBytes > AEB_MAX_PACKAGE_BYTES) {
    throw proofError("invalid_package_tree_total_bytes");
  }
  if (!Number.isInteger(value.generatedSvgaBytes) || value.generatedSvgaBytes <= 0) {
    throw proofError("invalid_generated_svga_bytes");
  }
  const optionalIdentityPatterns = {
    requestId: /^aeb-semantic-[a-z0-9][a-z0-9-]{7,79}$/u,
    requestSha256: /^[a-f0-9]{64}$/u,
    permitId: /^ASV-APR-\d{8}-\d{3}$/u,
    executionId: /^[a-z0-9][a-z0-9-]{15,95}$/u,
    d001PermitId: /^ASV-APR-\d{8}-\d{3}$/u,
    d001ExecutionId: /^[a-z0-9][a-z0-9-]{15,95}$/u,
    d001PacketHead: /^[a-f0-9]{40}$/u,
    evidenceBindingSha256: /^[a-f0-9]{64}$/u,
  };
  for (const [field, pattern] of Object.entries(optionalIdentityPatterns)) {
    if (value[field] !== undefined && !pattern.test(value[field])) throw proofError(`invalid_${field}`);
  }
  return value;
}

function assertPackageTreeMatchesExpected(snapshot, expected, code) {
  if (
    snapshot?.sha256 !== expected.packageTreeSha256
    || snapshot?.fileCount !== expected.packageTreeFileCount
    || snapshot?.totalBytes !== expected.packageTreeTotalBytes
  ) throw proofError(code);
}

function assertRuntimePackageTreeObservation(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw proofError("electron_runtime_package_manifest_missing");
  if (value.schema !== "auto-svga-aeb-runtime-package-tree-observation-v1") {
    throw proofError("electron_runtime_package_manifest_schema_invalid");
  }
  if (value.phase !== "aeb-native-preview-session-pre-conversion") {
    throw proofError("electron_runtime_package_manifest_phase_invalid");
  }
  if (value.observationSource !== "aeb-native-preview-session") {
    throw proofError("electron_runtime_package_manifest_source_invalid");
  }
  if (value.packageRootAlias !== "proof-package-root" || value.pathRedacted !== true) {
    throw proofError("electron_runtime_package_manifest_path_leak");
  }
  if (value.sha256 !== expected.packageTreeSha256) throw proofError("electron_runtime_package_manifest_hash_invalid");
  if (value.fileCount !== expected.packageTreeFileCount) throw proofError("electron_runtime_package_manifest_count_invalid");
  if (value.totalBytes !== expected.packageTreeTotalBytes) throw proofError("electron_runtime_package_manifest_size_invalid");
  for (const field of [
    "sourceHead", "requestId", "requestSha256", "permitId", "executionId",
    "d001PermitId", "d001ExecutionId", "d001PacketHead", "evidenceBindingSha256",
  ]) {
    if (expected[field] !== undefined && value[field] !== expected[field]) {
      throw proofError("electron_runtime_package_manifest_identity_invalid");
    }
  }
  return value;
}

function assertReportPackageManifest(manifest, expected, prefix) {
  if (!manifest || manifest.sha256 !== expected.packageTreeSha256) {
    throw proofError(`${prefix}_hash_invalid`);
  }
  if (manifest.fileCount !== expected.packageTreeFileCount) {
    throw proofError(`${prefix}_count_invalid`);
  }
  if (manifest.totalBytes !== expected.packageTreeTotalBytes) {
    throw proofError(`${prefix}_size_invalid`);
  }
  if (manifest.pathRedacted !== true) {
    throw proofError(`${prefix}_path_leak`);
  }
}

function assertProjectIdentity(value) {
  if (!value || typeof value.projectId !== "string" || !/^[A-Za-z0-9._-]{1,180}$/u.test(value.projectId)) {
    throw proofError("electron_project_identity_invalid");
  }
  for (const field of ["projectSha256", "mapSha256", "assetSetSha256"]) {
    if (!/^[a-f0-9]{64}$/u.test(value[field] || "")) throw proofError(`electron_${field}_invalid`);
  }
}

function requireDirectChildPath(value, taskRoot, code) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) throw proofError(code);
  const resolved = path.resolve(value);
  if (resolved !== value || path.dirname(resolved) !== taskRoot) throw proofError(code);
  return resolved;
}

export function resolveProductProofRoots(packageRootInput, outputRootInput) {
  const packageRoot = requireDirectChildPath(
    packageRootInput,
    AEB_PACKAGE_TASK_ROOT,
    "package_root_not_task_owned",
  );
  const outputRoot = requireDirectChildPath(
    outputRootInput,
    AEB_OUTPUT_TASK_ROOT,
    "output_root_not_task_owned",
  );
  if (packageRoot === outputRoot) throw proofError("package_output_root_overlap");
  return Object.freeze({ packageRoot, outputRoot });
}

export function assertPrivateProductProofTaskRoot(
  taskRoot,
  code = "output_task_root_invalid",
  fileSystem = fs,
  currentUid = process.getuid(),
) {
  let stat;
  let canonicalPath;
  try {
    stat = fileSystem.lstatSync(taskRoot);
    canonicalPath = fileSystem.realpathSync(taskRoot);
  } catch {
    throw proofError(code);
  }
  if (
    !stat.isDirectory()
    || stat.isSymbolicLink()
    || canonicalPath !== taskRoot
    || stat.uid !== currentUid
    || (stat.mode & 0o777) !== 0o700
  ) throw proofError(code);
  return taskRoot;
}

function assertRegularFile(filePath, code) {
  if (!fs.existsSync(filePath)) throw proofError(code);
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw proofError(code);
}

function assertRegularSingleLinkFile(filePath, code) {
  try {
    const stat = fs.lstatSync(filePath);
    if (
      !stat.isFile()
      || stat.isSymbolicLink()
      || stat.nlink !== 1
      || fs.realpathSync(filePath) !== filePath
    ) throw proofError(code);
  } catch (error) {
    if (error?.code === code) throw error;
    throw proofError(code);
  }
}

function readBoundedProofFile(filePath, maxBytes) {
  let descriptor;
  let primaryError;
  try {
    const before = fs.lstatSync(filePath);
    if (!before.isFile() || before.isSymbolicLink() || before.size <= 0 || before.size > maxBytes) {
      throw proofError("package_tree_file_bound");
    }
    descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size) {
      throw proofError("package_tree_file_identity_changed");
    }
    const readCapacity = Math.min(opened.size + 1, maxBytes + 1);
    const buffer = Buffer.allocUnsafe(readCapacity);
    let bytesRead = 0;
    while (bytesRead < buffer.byteLength) {
      const count = fs.readSync(descriptor, buffer, bytesRead, buffer.byteLength - bytesRead, bytesRead);
      if (count === 0) break;
      bytesRead += count;
    }
    const after = fs.fstatSync(descriptor);
    const pathStat = fs.lstatSync(filePath);
    if (
      bytesRead > maxBytes
      || bytesRead !== after.size
      || after.size !== opened.size
      || after.mtimeMs !== opened.mtimeMs
      || after.ctimeMs !== opened.ctimeMs
      || pathStat.isSymbolicLink()
      || pathStat.dev !== after.dev
      || pathStat.ino !== after.ino
    ) throw proofError("package_tree_file_changed_during_read");
    return Buffer.from(buffer.subarray(0, bytesRead));
  } catch (error) {
    primaryError = typeof error?.code === "string" && /^[a-z0-9_]+$/u.test(error.code)
      ? error
      : proofError("package_tree_read_failed");
    throw primaryError;
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {
        if (!primaryError) throw proofError("package_tree_close_failed");
      }
    }
  }
}

function gitHead() {
  return execFileSync("/usr/bin/git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
}

function gitStatus() {
  return execFileSync("/usr/bin/git", ["status", "--short"], { cwd: repoRoot, encoding: "utf8" }).trim();
}

function fileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function readJsonFile(filePath, code) {
  return parseJsonBytes(fs.readFileSync(filePath), code);
}

function parseJsonBytes(bytes, code) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw proofError(code);
  }
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertEqual(actual, expected, code) {
  if (actual !== expected) throw proofError(code);
}

function rejectRawPaths(value) {
  const serialized = JSON.stringify(value);
  if (["/Users/", "/private/tmp/", "/var/folders/", "file://"].some((token) => serialized.includes(token))) {
    throw proofError("raw_path_leak");
  }
}

function proofError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function parseArgs(argv) {
  if (!Array.isArray(argv) || argv.length !== PRODUCT_PROOF_CLI_KEYS.length * 2) throw proofError("invalid_arguments");
  const args = Object.create(null);
  for (let index = 0; index < argv.length; index += 2) {
    const token = argv[index];
    const value = argv[index + 1];
    const key = typeof token === "string" && token.startsWith("--") ? token.slice(2) : "";
    if (
      key !== PRODUCT_PROOF_CLI_KEYS[index / 2]
      || typeof value !== "string"
      || value.length === 0
      || value.startsWith("--")
      || Object.prototype.hasOwnProperty.call(args, key)
    ) throw proofError("invalid_arguments");
    args[key] = value;
  }
  return args;
}

export function loadProductProofDescriptor(descriptorPathInput, expectedSha256) {
  if (
    typeof descriptorPathInput !== "string"
    || descriptorPathInput.length === 0
    || descriptorPathInput.includes("\0")
    || !/^[a-f0-9]{64}$/u.test(expectedSha256 || "")
  ) throw proofError("descriptor_input_invalid");
  assertPrivateProductProofTaskRoot(CONTRACT.aeDevRoot, "descriptor_task_root_invalid");
  const descriptorPath = path.resolve(descriptorPathInput);
  if (descriptorPath !== descriptorPathInput || path.dirname(descriptorPath) !== CONTRACT.aeDevRoot) {
    throw proofError("descriptor_path_invalid");
  }
  let before;
  let canonicalPath;
  try {
    before = fs.lstatSync(descriptorPath);
    canonicalPath = fs.realpathSync(descriptorPath);
  } catch {
    throw proofError("descriptor_path_invalid");
  }
  if (
    !before.isFile()
    || before.isSymbolicLink()
    || before.nlink !== 1
    || before.uid !== process.getuid()
    || (before.mode & 0o777) !== 0o600
    || canonicalPath !== descriptorPath
  ) throw proofError("descriptor_path_invalid");
  const bytes = readBoundedProofFile(descriptorPath, 1024 * 1024);
  const after = fs.lstatSync(descriptorPath);
  if (after.dev !== before.dev || after.ino !== before.ino || after.nlink !== 1 || sha256(bytes) !== expectedSha256) {
    throw proofError("descriptor_hash_invalid");
  }
  const descriptor = validateDescriptor(parseJsonBytes(bytes, "descriptor_json_invalid"));
  const canonical = canonicalDescriptorBytes(descriptor);
  if (!bytes.equals(canonical) || descriptorSha256(descriptor) !== expectedSha256) {
    throw proofError("descriptor_noncanonical");
  }
  return descriptor;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const descriptor = loadProductProofDescriptor(args["descriptor-path"], args["descriptor-sha256"]);
    const result = await runAebNativePreviewProductProof(descriptor);
    process.stdout.write(`${JSON.stringify({
      status: result.report.status,
      reportSha256: result.reportSha256,
      generatedSvgaSha256: result.report.generatedSvga.sha256,
      sourceHead: result.report.source.head
    }, null, 2)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: "fail", issueCode: String(error?.code || "proof_failed") }, null, 2)}\n`);
    process.exitCode = 1;
  }
}
