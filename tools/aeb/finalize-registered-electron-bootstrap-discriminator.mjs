#!/usr/bin/env node

import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  CONTRACT,
  PermitError,
  authorityPaths,
  buildProcessAuthorityInvocation,
  collectCrashContext,
  collectPacketMaterialHashes,
  crashDelta,
  expectedAuthorityBinding,
  loadAndValidateProcessAuthority,
  markerMatches,
  loadBoundEvidenceStore,
  readBoundedPrivateJson,
  readBoundEvidenceRecord,
  summarizeProcessAuthority,
  verifyGitBinding,
  writeBoundEvidenceRecord,
} from "./run-registered-electron-bootstrap-discriminator.mjs";

const POSTRUN_RELAY_SCHEMA = "aeb-pm-registered-electron-bootstrap-postrun-v0";
const PENDING_SCHEMA = "auto-svga-registered-electron-bootstrap-runtime-pending-v1";
const validatedPendingDigests = new WeakMap();

function reject(issueCode, message, details = {}) {
  throw new PermitError(issueCode, message, details);
}

function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

function requireEqual(failures, field, actual, expected) {
  if (actual !== expected) {
    failures.push({ field, expected, actual });
  }
}

function markerIdentity(pending) {
  const first = pending.firstJavaScriptMarker;
  return first
    ? {
      pid: first.pid,
      processExecPath: first.processExecPath,
      appPath: first.appPath,
      bundleId: first.bundleId,
    }
    : null;
}

const MARKER_FILES = Object.freeze([
  ["firstJavaScriptMarker", "firstJavaScript", "first-javascript-marker.json"],
  ["appReadyMarker", "appReady", "app-ready-marker.json"],
  ["normalQuitWillQuitMarker", "normalQuitWillQuit", "normal-quit-will-quit.json"],
  ["normalQuitObservedMarker", "normalQuitObserved", "normal-quit-observed.json"],
]);

export async function validateRuntimeMarkerFiles(pending, evidenceStore, dependencies = {}) {
  const readRecord = dependencies.readBoundEvidenceRecord || readBoundEvidenceRecord;
  for (const [valueField, hashField, basename] of MARKER_FILES) {
    const expectedValue = pending[valueField];
    const expectedHash = pending.markerHashes && pending.markerHashes[hashField];
    if (!expectedValue && !expectedHash) {
      continue;
    }
    if (!expectedValue || !/^[0-9a-f]{64}$/.test(expectedHash || "")) {
      reject("runtime_marker_binding_invalid", "Runtime marker value/hash binding is incomplete", { field: hashField });
    }
    const read = await readRecord(evidenceStore, basename);
    if (read.sha256 !== expectedHash || JSON.stringify(read.value) !== JSON.stringify(expectedValue)) {
      reject("runtime_marker_binding_mismatch", "Runtime marker bytes do not match the pending evidence", { field: hashField });
    }
  }
  return true;
}

export function validatePendingDisposition(pending, expected) {
  const failures = [];
  requireEqual(failures, "schema", pending.schema, PENDING_SCHEMA);
  requireEqual(failures, "permitId", pending.permitId, expected.permitId);
  requireEqual(failures, "executionId", pending.executionId, expected.executionId);
  requireEqual(failures, "packetHead", pending.packetHead, expected.packetHead);
  requireEqual(failures, "sourceHead", pending.sourceHead, CONTRACT.sourceHead);
  requireEqual(
    failures,
    "prelaunchAuthorityArtifactSha256",
    pending.prelaunchAuthorityArtifactSha256,
    expected.prelaunchAuthorityArtifactSha256,
  );
  requireEqual(failures, "outputRootSha256", pending.outputRootSha256, expected.outputRootSha256);
  requireEqual(
    failures,
    "evidenceStore.bindingSha256",
    pending.evidenceStore && pending.evidenceStore.bindingSha256,
    expected.evidenceBindingSha256,
  );
  requireEqual(
    failures,
    "evidenceStore.helperSha256",
    pending.evidenceStore && pending.evidenceStore.helperSha256,
    CONTRACT.expectedEvidenceStoreSha256,
  );
  requireEqual(failures, "launchAttemptsPerformed", pending.launchAttemptsPerformed, 1);
  requireEqual(failures, "postrunAuthorityRequired", pending.postrunAuthorityRequired, true);
  requireEqual(failures, "finalPassAllowedInRunner", pending.finalPassAllowedInRunner, false);
  requireEqual(failures, "productProofContinued", pending.productProofContinued, false);
  requireEqual(failures, "forcedTerminationUsed", pending.forcedTerminationUsed, false);
  requireEqual(failures, "retryUsed", pending.retryUsed, false);
  if (![
    "runtime_completed_pending_postrun_authority",
    "runtime_failed_pending_postrun_authority",
  ].includes(pending.status)) {
    failures.push({ field: "status", expected: "runtime pending status", actual: pending.status });
  }
  if (!pending.crashBefore || !Array.isArray(pending.crashBefore.reports)) {
    failures.push({ field: "crashBefore", expected: "bound prelaunch crash context", actual: pending.crashBefore });
  }
  if (pending.status === "runtime_completed_pending_postrun_authority") {
    requireEqual(failures, "earliestMissingPhase", pending.earliestMissingPhase, "postrun_process_authority");
    requireEqual(failures, "issueCode", pending.issueCode, "postrun_process_authority_required");
    requireEqual(failures, "launchResult.status", pending.launchResult && pending.launchResult.status, 0);
    requireEqual(failures, "launchResult.signal", pending.launchResult && pending.launchResult.signal, null);
    const identity = {
      permitId: expected.permitId,
      packetHead: expected.packetHead,
      executionId: expected.executionId,
      evidenceBindingSha256: expected.evidenceBindingSha256,
    };
    const first = pending.firstJavaScriptMarker;
    if (!markerMatches(first, "first-javascript", identity)) {
      failures.push({ field: "firstJavaScriptMarker", expected: "exact marker identity", actual: "invalid" });
    }
    const pid = first && first.pid;
    for (const [field, phase, marker] of [
      ["appReadyMarker", "app-ready", pending.appReadyMarker],
      ["normalQuitWillQuitMarker", "normal-quit-will-quit", pending.normalQuitWillQuitMarker],
      ["normalQuitObservedMarker", "normal-quit-observed", pending.normalQuitObservedMarker],
    ]) {
      if (!markerMatches(marker, phase, identity, pid)) {
        failures.push({ field, expected: "same-PID exact marker identity", actual: "invalid" });
      }
    }
    if (!pending.normalQuitObservedMarker || pending.normalQuitObservedMarker.exitCode !== 0) {
      failures.push({ field: "normalQuitObservedMarker.exitCode", expected: 0, actual: pending.normalQuitObservedMarker && pending.normalQuitObservedMarker.exitCode });
    }
    if (!pending.appReadyMarker || pending.appReadyMarker.userDataBound !== true) {
      failures.push({ field: "appReadyMarker.userDataBound", expected: true, actual: pending.appReadyMarker && pending.appReadyMarker.userDataBound });
    }
    if (!pending.appReadyMarker || pending.appReadyMarker.sessionDataBound !== true) {
      failures.push({ field: "appReadyMarker.sessionDataBound", expected: true, actual: pending.appReadyMarker && pending.appReadyMarker.sessionDataBound });
    }
    if (!pending.appReadyMarker || pending.appReadyMarker.windowsCreated !== 0) {
      failures.push({ field: "appReadyMarker.windowsCreated", expected: 0, actual: pending.appReadyMarker && pending.appReadyMarker.windowsCreated });
    }
    const timestamps = [
      pending.launchedAtUtc,
      pending.firstJavaScriptMarker && pending.firstJavaScriptMarker.recordedAtUtc,
      pending.appReadyMarker && pending.appReadyMarker.recordedAtUtc,
      pending.normalQuitWillQuitMarker && pending.normalQuitWillQuitMarker.recordedAtUtc,
      pending.normalQuitObservedMarker && pending.normalQuitObservedMarker.recordedAtUtc,
      pending.pendingAtUtc,
    ].map((value) => Date.parse(value || ""));
    const launchedAtMs = timestamps[0];
    const pendingAtMs = timestamps[timestamps.length - 1];
    if (
      timestamps.some((value) => !Number.isFinite(value)) ||
      timestamps.some((value, index) => index > 0 && value < timestamps[index - 1])
    ) {
      failures.push({ field: "runtimeTimestamps", expected: "finite ordered evidence", actual: "invalid" });
    }
    if (!Number.isFinite(expected.nowMs)) {
      failures.push({ field: "finalizerNowMs", expected: "finite finalizer time", actual: expected.nowMs });
    } else if (
      Number.isFinite(pendingAtMs) &&
      (pendingAtMs < expected.nowMs - CONTRACT.runtimePendingMaxAgeMs ||
        pendingAtMs > expected.nowMs + CONTRACT.runtimeFutureSkewMs)
    ) {
      failures.push({
        field: "pendingAtUtc",
        expected: "within finalizer freshness and future-skew bounds",
        actual: pending.pendingAtUtc,
      });
    }
    if (
      Number.isFinite(expected.nowMs) &&
      timestamps.some((value) => Number.isFinite(value) && value > expected.nowMs + CONTRACT.runtimeFutureSkewMs)
    ) {
      failures.push({ field: "runtimeTimestamps", expected: "within bounded future skew", actual: "future" });
    }
    if (
      Number.isFinite(launchedAtMs) &&
      Number.isFinite(pendingAtMs) &&
      pendingAtMs - launchedAtMs > CONTRACT.runtimeMaxDurationMs
    ) {
      failures.push({
        field: "runtimeDurationMs",
        expected: `at most ${CONTRACT.runtimeMaxDurationMs}`,
        actual: pendingAtMs - launchedAtMs,
      });
    }
  }
  if (failures.length > 0) {
    reject("runtime_pending_rejected", "Runtime pending evidence did not satisfy the exact finalizer contract", { failures });
  }
  validatedPendingDigests.set(pending, sha256Json(pending));
  return pending;
}

export function validatePostrunRelay(relay, expected) {
  const failures = [];
  const capturedAt = Date.parse(relay.capturedAtUtc || "");
  requireEqual(failures, "schema", relay.schema, POSTRUN_RELAY_SCHEMA);
  requireEqual(failures, "permitId", relay.permitId, expected.permitId);
  requireEqual(failures, "executionId", relay.executionId, expected.executionId);
  requireEqual(failures, "packetHead", relay.packetHead, expected.packetHead);
  requireEqual(failures, "sourceHead", relay.sourceHead, CONTRACT.sourceHead);
  requireEqual(failures, "pendingDispositionSha256", relay.pendingDispositionSha256, expected.pendingDispositionSha256);
  requireEqual(failures, "prelaunchAuthorityArtifactSha256", relay.prelaunchAuthorityArtifactSha256, expected.prelaunchAuthorityArtifactSha256);
  requireEqual(failures, "postrunAuthorityArtifactSha256", relay.postrunAuthorityArtifactSha256, expected.postrunAuthorityArtifactSha256);
  requireEqual(failures, "outputRootSha256", relay.outputRootSha256, expected.outputRootSha256);
  requireEqual(failures, "evidenceBindingSha256", relay.evidenceBindingSha256, expected.evidenceBindingSha256);
  requireEqual(failures, "mutationPerformed", relay.mutationPerformed, false);
  requireEqual(failures, "launchPerformed", relay.launchPerformed, false);
  requireEqual(failures, "foregroundActionPerformed", relay.foregroundActionPerformed, false);
  requireEqual(failures, "expectedPid", relay.expectedPid, expected.expectedPid);
  requireEqual(failures, "processExecPathSha256", relay.processExecPathSha256, expected.processExecPathSha256);
  requireEqual(failures, "appPathSha256", relay.appPathSha256, expected.appPathSha256);
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
      failures,
      `postrunProcessAuthority.${field}`,
      relay.postrunProcessAuthority && relay.postrunProcessAuthority[field],
      expected.postrunProcessAuthority[field],
    );
  }
  const relayMarkerHashes = relay.markerHashes || {};
  for (const field of ["firstJavaScript", "appReady", "normalQuitWillQuit", "normalQuitObserved"]) {
    requireEqual(failures, `markerHashes.${field}`, relayMarkerHashes[field], expected.markerHashes[field]);
  }
  if (
    !Number.isFinite(capturedAt) ||
    capturedAt > expected.nowMs ||
    expected.nowMs - capturedAt > CONTRACT.processAuthorityMaxAgeMs ||
    capturedAt < expected.postrunAuthorityCapturedAtMs
  ) {
    failures.push({ field: "capturedAtUtc", expected: "fresh and after postrun authority", actual: relay.capturedAtUtc });
  }
  if (failures.length > 0) {
    reject("postrun_relay_rejected", "Postrun finalization relay did not satisfy the exact private contract", { failures });
  }
  return relay;
}

export function assessFinalization({ pending, postrunAuthority, crashReports }) {
  if (!pending || validatedPendingDigests.get(pending) !== sha256Json(pending)) {
    return {
      status: "failed_closed",
      earliestMissingPhase: "runtime_pending_validation",
      issueCode: "runtime_pending_not_validated",
    };
  }
  if (!postrunAuthority || postrunAuthority.artifact.authorityAccepted !== true) {
    return { status: "failed_closed", earliestMissingPhase: "postrun_process_authority", issueCode: "postrun_process_authority_rejected" };
  }
  if (!Array.isArray(crashReports) || crashReports.length > 0) {
    return { status: "failed_closed", earliestMissingPhase: "post_quit_crash_delta", issueCode: "new_crash_report_present" };
  }
  if (pending.status !== "runtime_completed_pending_postrun_authority") {
    return { status: "failed_closed", earliestMissingPhase: pending.earliestMissingPhase, issueCode: pending.issueCode };
  }
  return { status: "pass", earliestMissingPhase: null, issueCode: null };
}

export function buildVisibleFinalDisposition({
  pending,
  pendingDispositionSha256,
  postrunRelaySha256,
  postrunAuthority,
  crashReports,
  outcome,
}) {
  if (outcome.status === "pass" && validatedPendingDigests.get(pending) !== sha256Json(pending)) {
    reject("runtime_pending_not_validated", "PASS publication requires the exact validated private pending bytes");
  }
  const identity = markerIdentity(pending);
  return {
    schema: "auto-svga-registered-electron-bootstrap-final-disposition-v1",
    status: outcome.status,
    earliestMissingPhase: outcome.earliestMissingPhase,
    issueCode: outcome.issueCode,
    permitId: pending.permitId,
    executionId: pending.executionId,
    packetHead: pending.packetHead,
    sourceHead: pending.sourceHead,
    pendingDispositionSha256,
    postrunRelaySha256,
    prelaunchAuthorityArtifactSha256: pending.prelaunchAuthorityArtifactSha256,
    postrunProcessAuthority: summarizeProcessAuthority(postrunAuthority),
    markerHashes: pending.markerHashes,
    processIdentitySha256: identity ? sha256Json(identity) : null,
    crashReportSettleDelayMs: CONTRACT.crashReportSettleDelayMs,
    crashDeltaCount: crashReports.length,
    postrunAuthorityFinalized: true,
    finalizerPerformedLaunch: false,
    launchAttemptsPerformed: pending.launchAttemptsPerformed,
    userDataBound: pending.appReadyMarker && pending.appReadyMarker.userDataBound,
    sessionDataBound: pending.appReadyMarker && pending.appReadyMarker.sessionDataBound,
    windowsCreated: pending.appReadyMarker && pending.appReadyMarker.windowsCreated,
    postrunAuthorityRequired: pending.postrunAuthorityRequired,
    finalPassAllowedInRunner: pending.finalPassAllowedInRunner,
    productProofContinued: pending.productProofContinued,
    forcedTerminationUsed: pending.forcedTerminationUsed,
    retryUsed: pending.retryUsed,
    successBoundary: outcome.status === "pass"
      ? "javascript_entry_normal_quit_external_zero_residue_no_crash_delta"
      : null,
    nonclaims: ["product_proof", "preview_success", "save_success", "qa_acceptance", "release_readiness"],
  };
}

export async function finalizeMode(args, dependencies = {}) {
  const permitId = args["permit-id"];
  const packetHead = args["packet-head"];
  const executionId = args["execution-id"];
  const outputRoot = args["output-root"];
  const pendingDispositionSha256 = args["pending-disposition-sha256"];
  const prelaunchAuthorityArtifactSha256 = args["prelaunch-authority-sha256"];
  const postrunAuthorityArtifactSha256 = args["postrun-authority-sha256"];
  const postrunRelaySha256 = args["postrun-relay-sha256"];
  const evidenceBindingSha256 = args["evidence-binding-sha256"];
  if (!/^ASV-APR-\d{8}-\d{3}$/.test(permitId || "") || !/^[0-9a-f]{40}$/.test(packetHead || "")) {
    reject("finalizer_identity_invalid", "Finalizer requires exact permit and packet identities");
  }
  const paths = authorityPaths(executionId);
  const postrunAuthorityPath = args["postrun-authority"];
  const postrunRelayPath = args["postrun-relay"];
  if (
    postrunAuthorityPath !== paths.postrunArtifactPath ||
    postrunRelayPath !== paths.postrunRelayPath ||
    ![
      pendingDispositionSha256,
      prelaunchAuthorityArtifactSha256,
      postrunAuthorityArtifactSha256,
      postrunRelaySha256,
      evidenceBindingSha256,
    ]
      .every((value) => /^[0-9a-f]{64}$/.test(value || ""))
  ) {
    reject("finalizer_binding_missing", "Finalizer requires exact hash-bound private evidence paths");
  }
  const loadStore = dependencies.loadBoundEvidenceStore || loadBoundEvidenceStore;
  const readRecord = dependencies.readBoundEvidenceRecord || readBoundEvidenceRecord;
  const writeRecord = dependencies.writeBoundEvidenceRecord || writeBoundEvidenceRecord;
  const verifyBinding = dependencies.verifyGitBinding || verifyGitBinding;
  const collectMaterials = dependencies.collectPacketMaterialHashes || collectPacketMaterialHashes;
  const loadAuthority = dependencies.loadAndValidateProcessAuthority || loadAndValidateProcessAuthority;
  const readPrivateJson = dependencies.readBoundedPrivateJson || readBoundedPrivateJson;
  const evidenceStore = await loadStore(outputRoot, evidenceBindingSha256);
  verifyBinding(packetHead);
  await collectMaterials();
  const pendingRead = await readRecord(evidenceStore, "runtime-pending-private.json");
  if (pendingRead.sha256 !== pendingDispositionSha256) {
    reject("runtime_pending_hash_mismatch", "Runtime pending disposition hash mismatched");
  }
  const nowMs = (dependencies.now || Date.now)();
  const pending = validatePendingDisposition(pendingRead.value, {
    permitId,
    packetHead,
    executionId,
    prelaunchAuthorityArtifactSha256,
    outputRootSha256: sha256Text(outputRoot),
    evidenceBindingSha256,
    nowMs,
  });
  await validateRuntimeMarkerFiles(pending, evidenceStore, { readBoundEvidenceRecord: readRecord });
  const expectedPid = pending.firstJavaScriptMarker ? pending.firstJavaScriptMarker.pid : null;
  const notBeforeText = pending.normalQuitObservedMarker
    ? pending.normalQuitObservedMarker.recordedAtUtc
    : pending.pendingAtUtc;
  const notBeforeMs = Date.parse(notBeforeText || "");
  if (!Number.isFinite(notBeforeMs)) {
    reject("postrun_ordering_unavailable", "Postrun authority cannot be ordered after runtime evidence");
  }
  const postrunAuthority = await loadAuthority({
    artifactPath: postrunAuthorityPath,
    artifactSha256: postrunAuthorityArtifactSha256,
    phase: "postrun",
    executionId,
    expectedPid,
    notBeforeMs,
    nowMs,
  });
  const relayRead = await readPrivateJson(postrunRelayPath, postrunRelayPath, "postrun_relay_file_rejected");
  if (relayRead.sha256 !== postrunRelaySha256) {
    reject("postrun_relay_hash_mismatch", "Postrun finalization relay hash mismatched");
  }
  const identity = markerIdentity(pending);
  validatePostrunRelay(relayRead.value, {
    permitId,
    executionId,
    packetHead,
    pendingDispositionSha256,
    prelaunchAuthorityArtifactSha256,
    postrunAuthorityArtifactSha256,
    outputRootSha256: sha256Text(outputRoot),
    evidenceBindingSha256,
    expectedPid,
    processExecPathSha256: identity ? createHash("sha256").update(identity.processExecPath).digest("hex") : null,
    appPathSha256: identity ? createHash("sha256").update(identity.appPath).digest("hex") : null,
    markerHashes: pending.markerHashes,
    postrunProcessAuthority: postrunAuthority.binding,
    postrunAuthorityCapturedAtMs: Date.parse(postrunAuthority.artifact.capturedAtUtc),
    nowMs,
  });
  const sleep = dependencies.sleep || ((delay) => new Promise((resolve) => setTimeout(resolve, delay)));
  const collectCrash = dependencies.collectCrashContext || collectCrashContext;
  await sleep(CONTRACT.crashReportSettleDelayMs);
  const settledAtMs = (dependencies.now || Date.now)();
  const pendingAtMs = Date.parse(pending.pendingAtUtc || "");
  if (
    !Number.isFinite(settledAtMs)
    || !Number.isFinite(pendingAtMs)
    || settledAtMs - pendingAtMs > CONTRACT.runtimePendingMaxAgeMs
  ) {
    reject("runtime_pending_expired_during_crash_settle", "Runtime pending freshness expired during the fixed crash-report settle window", {
      pendingAgeAfterSettleMs: Number.isFinite(settledAtMs) && Number.isFinite(pendingAtMs)
        ? settledAtMs - pendingAtMs
        : null,
    });
  }
  const crashAfter = await collectCrash();
  const newCrashReports = crashDelta(pending.crashBefore, crashAfter);
  const outcome = assessFinalization({ pending, postrunAuthority, crashReports: newCrashReports });
  const visible = buildVisibleFinalDisposition({
    pending,
    pendingDispositionSha256,
    postrunRelaySha256,
    postrunAuthority,
    crashReports: newCrashReports,
    outcome,
  });
  await writeRecord(evidenceStore, "disposition.json", visible);
  return visible;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    if (!token.startsWith("--") || !value || value.startsWith("--")) {
      reject("argument_invalid", "Finalizer arguments must be exact key/value pairs");
    }
    args[token.slice(2)] = value;
    index += 1;
  }
  return args;
}

export async function main(argv = process.argv.slice(2)) {
  return finalizeMode(parseArgs(argv));
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().then((result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }).catch((error) => {
    process.stderr.write(`${JSON.stringify({
      status: "failed_closed",
      issueCode: error.issueCode || "finalizer_error",
      message: error.message,
    })}\n`);
    process.exitCode = 1;
  });
}
