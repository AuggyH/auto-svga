#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  CONTRACT,
  PermitError,
  authorityPaths,
  buildProcessAuthorityInvocation,
  collectPacketMaterialHashes,
  loadAndValidateProcessAuthority,
  loadBoundEvidenceStore,
  main as runRegisteredDiscriminator,
  prepareProcessAuthorityRoot,
  readBoundEvidenceRecord,
  sha256File,
  verifyGitBinding,
} from "./run-registered-electron-bootstrap-discriminator.mjs";
import {
  finalizeMode,
  validatePendingDisposition,
  validateRuntimeMarkerFiles,
} from "./finalize-registered-electron-bootstrap-discriminator.mjs";

const SCRIPT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const RELAY_PUBLISHER_PATH = path.join(
  SCRIPT_ROOT,
  "publish-registered-electron-postrun-relay.py",
);
const POSTRUN_RELAY_SCHEMA = "aeb-pm-registered-electron-bootstrap-postrun-v0";
const FINALIZER_START_RESERVE_MS = CONTRACT.crashReportSettleDelayMs;
const LIFECYCLE_ERROR_SCHEMA = "auto-svga-registered-electron-bootstrap-lifecycle-error-v0";
const LIFECYCLE_ERROR_MESSAGE = "Lifecycle execution failed closed.";
const LIFECYCLE_COUNT_FIELDS = [
  "runnerInvocations",
  "producerInvocations",
  "relayPublicationAttempts",
  "finalizerInvocations",
];
export const PUBLIC_LIFECYCLE_ISSUE_CODE_MAP = Object.freeze(Object.assign(Object.create(null), {
  argument_invalid: "argument_invalid",
  lifecycle_finalizer_failed: "lifecycle_finalizer_failed",
  lifecycle_orchestration_error: "lifecycle_orchestration_error",
  lifecycle_pending_budget_expired: "lifecycle_pending_budget_expired",
  lifecycle_pending_future: "lifecycle_pending_future",
  lifecycle_pending_timestamp_invalid: "lifecycle_pending_timestamp_invalid",
  mode_invalid: "mode_invalid",
  postrun_material_identity_drift: "postrun_material_identity_drift",
  postrun_process_authority_command_failed: "postrun_process_authority_command_failed",
  postrun_relay_publication_failed: "postrun_relay_publication_failed",
  process_authority_rejected: "process_authority_rejected",
  runner_pending_rejected: "runner_pending_rejected",
  runtime_identity_missing: "runtime_identity_missing",
  runtime_pending_hash_mismatch: "runtime_pending_hash_mismatch",
}));

function reject(issueCode, message, details = {}) {
  throw new PermitError(issueCode, message, details);
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

function exactFieldsEqual(left, right, fields) {
  return fields.every((field) => left && right && left[field] === right[field]);
}

function redactedLifecycleCounts(error) {
  const source = error && error.details && error.details.lifecycleCounts;
  return Object.fromEntries(LIFECYCLE_COUNT_FIELDS.map((field) => [
    field,
    source && Number.isInteger(source[field]) && source[field] >= 0 && source[field] <= 1
      ? source[field]
      : null,
  ]));
}

function lifecycleFailurePhase(counts) {
  if (counts.finalizerInvocations === 1) return "finalizer";
  if (counts.relayPublicationAttempts === 1) return "postrun_relay";
  if (counts.producerInvocations === 1) return "postrun_authority";
  if (counts.runnerInvocations === 1) return "runner";
  return "preflight";
}

export function serializeLifecycleError(error) {
  const lifecycleCounts = redactedLifecycleCounts(error);
  const internalIssueCode = error && error.issueCode;
  const issueCode = typeof internalIssueCode === "string"
    && Object.prototype.hasOwnProperty.call(PUBLIC_LIFECYCLE_ISSUE_CODE_MAP, internalIssueCode)
    ? PUBLIC_LIFECYCLE_ISSUE_CODE_MAP[internalIssueCode]
    : PUBLIC_LIFECYCLE_ISSUE_CODE_MAP.lifecycle_orchestration_error;
  return {
    schema: LIFECYCLE_ERROR_SCHEMA,
    status: "failed_closed",
    issueCode,
    message: LIFECYCLE_ERROR_MESSAGE,
    phase: lifecycleFailurePhase(lifecycleCounts),
    lifecycleCounts,
  };
}

function parseJsonProcessResult(result, issueCode, label) {
  if (!result || result.status !== 0 || result.signal) {
    reject(issueCode, `${label} failed`, {
      status: result ? result.status : null,
      signal: result ? result.signal || null : null,
    });
  }
  const output = String(result.stdout || "").trim();
  const lines = output ? output.split(/\r?\n/) : [];
  if (lines.length !== 1) {
    reject(issueCode, `${label} did not return exactly one JSON record`);
  }
  try {
    return JSON.parse(lines[0]);
  } catch {
    reject(issueCode, `${label} returned malformed JSON`);
  }
}

function runnerArgs(options) {
  return [
    "--mode", "execute",
    "--permit-id", options.permitId,
    "--packet-head", options.packetHead,
    "--execution-id", options.executionId,
    "--output-root", options.outputRoot,
    "--preflight-relay", options.preflightRelayPath,
    "--preflight-relay-sha256", options.preflightRelaySha256,
    "--prelaunch-authority", options.prelaunchAuthorityPath,
    "--prelaunch-authority-sha256", options.prelaunchAuthoritySha256,
  ];
}

function finalizerArgs(options) {
  return {
    "permit-id": options.permitId,
    "packet-head": options.packetHead,
    "execution-id": options.executionId,
    "output-root": options.outputRoot,
    "evidence-binding-sha256": options.evidenceBindingSha256,
    "pending-disposition-sha256": options.pendingDispositionSha256,
    "prelaunch-authority-sha256": options.prelaunchAuthoritySha256,
    "postrun-authority": options.postrunAuthorityPath,
    "postrun-authority-sha256": options.postrunAuthoritySha256,
    "postrun-relay": options.postrunRelayPath,
    "postrun-relay-sha256": options.postrunRelaySha256,
  };
}

function assertRunnerPending(summary, options) {
  const failures = [];
  const requireEqual = (field, actual, expected) => {
    if (actual !== expected) failures.push({ field, actual, expected });
  };
  requireEqual("status", summary && summary.status, "runtime_completed_pending_postrun_authority");
  requireEqual("permitId", summary && summary.permitId, options.permitId);
  requireEqual("executionId", summary && summary.executionId, options.executionId);
  requireEqual("packetHead", summary && summary.packetHead, options.packetHead);
  requireEqual("sourceHead", summary && summary.sourceHead, CONTRACT.sourceHead);
  requireEqual("launchAttemptsPerformed", summary && summary.launchAttemptsPerformed, 1);
  requireEqual("postrunAuthorityRequired", summary && summary.postrunAuthorityRequired, true);
  requireEqual("finalPassAllowedInRunner", summary && summary.finalPassAllowedInRunner, false);
  requireEqual("productProofContinued", summary && summary.productProofContinued, false);
  requireEqual("forcedTerminationUsed", summary && summary.forcedTerminationUsed, false);
  requireEqual("retryUsed", summary && summary.retryUsed, false);
  if (!/^[0-9a-f]{64}$/.test(summary && summary.pendingDispositionSha256 || "")) {
    failures.push({ field: "pendingDispositionSha256", actual: summary && summary.pendingDispositionSha256 });
  }
  if (!/^[0-9a-f]{64}$/.test(summary && summary.evidenceStore && summary.evidenceStore.bindingSha256 || "")) {
    failures.push({ field: "evidenceStore.bindingSha256", actual: summary && summary.evidenceStore });
  }
  if (failures.length > 0) {
    reject("runner_pending_rejected", "Runner did not return the exact completed pending contract", { failures });
  }
}

export function assertLifecycleBudget(pending, nowMs, phase) {
  const pendingAtMs = Date.parse(pending && pending.pendingAtUtc || "");
  if (!Number.isFinite(pendingAtMs)) {
    reject("lifecycle_pending_timestamp_invalid", "Pending timestamp is malformed", { phase });
  }
  if (pendingAtMs > nowMs + CONTRACT.runtimeFutureSkewMs) {
    reject("lifecycle_pending_future", "Pending timestamp exceeds the approved future skew", { phase });
  }
  const finalizerStartDeadlineMs = pendingAtMs
    + CONTRACT.runtimePendingMaxAgeMs
    - FINALIZER_START_RESERVE_MS;
  if (nowMs > finalizerStartDeadlineMs) {
    reject("lifecycle_pending_budget_expired", "The contiguous finalizer-start budget expired", {
      phase,
      pendingAgeMs: nowMs - pendingAtMs,
      finalizerStartReserveMs: FINALIZER_START_RESERVE_MS,
    });
  }
  return {
    pendingAtMs,
    finalizerStartDeadlineMs,
    remainingUntilFinalizerStartMs: finalizerStartDeadlineMs - nowMs,
  };
}

export function buildPostrunRelay({
  pending,
  pendingDispositionSha256,
  postrunAuthority,
  capturedAtUtc,
}) {
  const identity = pending.firstJavaScriptMarker;
  if (!identity || !Number.isInteger(identity.pid) || identity.pid <= 0) {
    reject("runtime_identity_missing", "The descriptor-bound pending record has no exact runtime PID");
  }
  return {
    schema: POSTRUN_RELAY_SCHEMA,
    capturedAtUtc,
    permitId: pending.permitId,
    executionId: pending.executionId,
    packetHead: pending.packetHead,
    sourceHead: CONTRACT.sourceHead,
    pendingDispositionSha256,
    prelaunchAuthorityArtifactSha256: pending.prelaunchAuthorityArtifactSha256,
    postrunAuthorityArtifactSha256: postrunAuthority.artifactSha256,
    mutationPerformed: false,
    launchPerformed: false,
    foregroundActionPerformed: false,
    outputRootSha256: pending.outputRootSha256,
    evidenceBindingSha256: pending.evidenceStore.bindingSha256,
    expectedPid: identity.pid,
    processExecPathSha256: sha256Text(identity.processExecPath),
    appPathSha256: sha256Text(identity.appPath),
    markerHashes: pending.markerHashes,
    postrunProcessAuthority: postrunAuthority.binding,
  };
}

function publishRelayWithHelper({ relay, authorityRoot, relayPath }) {
  const result = spawnSync(
    "/usr/bin/python3",
    [
      RELAY_PUBLISHER_PATH,
      "--authority-root", authorityRoot,
      "--relay-path", relayPath,
      "--producer-path", CONTRACT.producerScriptPath,
    ],
    {
      encoding: "utf8",
      input: `${JSON.stringify(relay)}\n`,
      maxBuffer: 1024 * 1024,
    },
  );
  return parseJsonProcessResult(result, "postrun_relay_publication_failed", "Postrun relay publisher");
}

function materialFields() {
  return [
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
}

export async function orchestrateLifecycle(options, dependencies = {}) {
  const state = {
    runnerInvocations: 0,
    producerInvocations: 0,
    relayPublicationAttempts: 0,
    finalizerInvocations: 0,
  };
  const now = dependencies.now || Date.now;
  try {
    const verifyBinding = dependencies.verifyGitBinding || verifyGitBinding;
    const collectMaterials = dependencies.collectPacketMaterialHashes || collectPacketMaterialHashes;
    const runRunner = dependencies.runRunner || runRegisteredDiscriminator;
    const loadStore = dependencies.loadBoundEvidenceStore || loadBoundEvidenceStore;
    const readRecord = dependencies.readBoundEvidenceRecord || readBoundEvidenceRecord;
    const validateMarkers = dependencies.validateRuntimeMarkerFiles || validateRuntimeMarkerFiles;
    const loadAuthority = dependencies.loadAndValidateProcessAuthority || loadAndValidateProcessAuthority;
    const hashFile = dependencies.sha256File || sha256File;
    const prepareAuthorityRoot = dependencies.prepareProcessAuthorityRoot || prepareProcessAuthorityRoot;
    const runProducer = dependencies.runProducer || ((invocation) => spawnSync(
      invocation.command,
      invocation.args,
      { encoding: "utf8", maxBuffer: 1024 * 1024 },
    ));
    const publishRelay = dependencies.publishRelay || publishRelayWithHelper;
    const runFinalizer = dependencies.runFinalizer || finalizeMode;

    const initialGit = await verifyBinding(options.packetHead);
    const initialMaterials = await collectMaterials();
    state.runnerInvocations += 1;
    const runnerSummary = await runRunner(runnerArgs(options));
    assertRunnerPending(runnerSummary, options);

    const evidenceBindingSha256 = runnerSummary.evidenceStore.bindingSha256;
    const evidenceStore = await loadStore(options.outputRoot, evidenceBindingSha256);
    const pendingRead = await readRecord(evidenceStore, "runtime-pending-private.json");
    if (pendingRead.sha256 !== runnerSummary.pendingDispositionSha256) {
      reject("runtime_pending_hash_mismatch", "Runner summary did not bind the descriptor-loaded pending bytes");
    }
    const pending = validatePendingDisposition(pendingRead.value, {
      permitId: options.permitId,
      executionId: options.executionId,
      packetHead: options.packetHead,
      prelaunchAuthorityArtifactSha256: options.prelaunchAuthoritySha256,
      outputRootSha256: sha256Text(options.outputRoot),
      evidenceBindingSha256,
      nowMs: now(),
    });
    await validateMarkers(pending, evidenceStore, { readBoundEvidenceRecord: readRecord });
    assertLifecycleBudget(pending, now(), "before_postrun_authority");

    const freshGit = await verifyBinding(options.packetHead);
    const freshMaterials = await collectMaterials();
    const gitFields = ["actualHead", "actualBranch", "trackedStatusEmpty", "sourceAncestor", "packetHead"];
    if (
      !exactFieldsEqual(initialGit, freshGit, gitFields)
      || !exactFieldsEqual(initialMaterials, freshMaterials, materialFields())
    ) {
      reject("postrun_material_identity_drift", "Git or packet material changed after the runner completed");
    }

    const expectedPid = pending.firstJavaScriptMarker.pid;
    const paths = await prepareAuthorityRoot({
      executionId: options.executionId,
      allowedExistingEntries: ["prelaunch-authority.json"],
    });
    const producerInvocation = buildProcessAuthorityInvocation({
      phase: "postrun",
      executionId: options.executionId,
      expectedPid,
    });
    if (producerInvocation.authorityRoot !== paths.authorityRoot) {
      reject("postrun_process_authority_root_mismatch", "Prepared process-authority root did not match the exact producer invocation");
    }
    state.producerInvocations += 1;
    const producerResult = await runProducer(producerInvocation);
    if (!producerResult || producerResult.status !== 0 || producerResult.signal) {
      reject("postrun_process_authority_command_failed", "The exact approved postrun producer failed", {
        status: producerResult ? producerResult.status : null,
        signal: producerResult ? producerResult.signal || null : null,
      });
    }
    const postrunAuthoritySha256 = await hashFile(producerInvocation.artifactPath);
    const notBeforeMs = Date.parse(pending.normalQuitObservedMarker.recordedAtUtc);
    const postrunAuthority = await loadAuthority({
      artifactPath: producerInvocation.artifactPath,
      artifactSha256: postrunAuthoritySha256,
      phase: "postrun",
      executionId: options.executionId,
      expectedPid,
      notBeforeMs,
      nowMs: now(),
    });

    const relay = buildPostrunRelay({
      pending,
      pendingDispositionSha256: pendingRead.sha256,
      postrunAuthority,
      capturedAtUtc: new Date(now()).toISOString(),
    });
    state.relayPublicationAttempts += 1;
    const relayPublication = await publishRelay({
      relay,
      authorityRoot: paths.authorityRoot,
      relayPath: paths.postrunRelayPath,
    });
    if (
      !relayPublication
      || relayPublication.status !== "pass"
      || !/^[0-9a-f]{64}$/.test(relayPublication.relaySha256 || "")
    ) {
      reject("postrun_relay_publication_failed", "Postrun relay publication did not return an exact hash");
    }

    assertLifecycleBudget(pending, now(), "before_finalizer");
    state.finalizerInvocations += 1;
    const finalDisposition = await runFinalizer(finalizerArgs({
      ...options,
      evidenceBindingSha256,
      pendingDispositionSha256: pendingRead.sha256,
      postrunAuthorityPath: producerInvocation.artifactPath,
      postrunAuthoritySha256,
      postrunRelayPath: paths.postrunRelayPath,
      postrunRelaySha256: relayPublication.relaySha256,
    }));
    if (!finalDisposition || finalDisposition.status !== "pass") {
      reject("lifecycle_finalizer_failed", "The sole finalizer did not publish PASS", {
        finalizerStatus: finalDisposition && finalDisposition.status,
        finalizerIssueCode: finalDisposition && finalDisposition.issueCode,
      });
    }
    return {
      schema: "auto-svga-registered-electron-bootstrap-lifecycle-v0",
      status: "pass",
      permitId: options.permitId,
      executionId: options.executionId,
      packetHead: options.packetHead,
      sourceHead: CONTRACT.sourceHead,
      pendingDispositionSha256: pendingRead.sha256,
      postrunAuthorityArtifactSha256: postrunAuthoritySha256,
      postrunRelaySha256: relayPublication.relaySha256,
      finalDisposition,
      lifecycleCounts: state,
      finalizerStartReserveMs: FINALIZER_START_RESERVE_MS,
      noRetry: true,
      noFallback: true,
      noForcedTermination: true,
      productProofContinued: false,
    };
  } catch (error) {
    if (error && typeof error === "object") {
      error.details = { ...(error.details || {}), lifecycleCounts: { ...state } };
    }
    throw error;
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key || !key.startsWith("--") || !value || value.startsWith("--")) {
      reject("argument_invalid", "Lifecycle arguments must be exact key/value pairs");
    }
    parsed[key.slice(2)] = value;
  }
  if (parsed.mode !== "execute") {
    reject("mode_invalid", "Lifecycle orchestrator supports execute mode only");
  }
  return {
    permitId: parsed["permit-id"],
    packetHead: parsed["packet-head"],
    executionId: parsed["execution-id"],
    outputRoot: parsed["output-root"],
    preflightRelayPath: parsed["preflight-relay"],
    preflightRelaySha256: parsed["preflight-relay-sha256"],
    prelaunchAuthorityPath: parsed["prelaunch-authority"],
    prelaunchAuthoritySha256: parsed["prelaunch-authority-sha256"],
  };
}

export async function main(argv = process.argv.slice(2)) {
  return orchestrateLifecycle(parseArgs(argv));
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().then((result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }).catch((error) => {
    process.stderr.write(`${JSON.stringify(serializeLifecycleError(error))}\n`);
    process.exitCode = 1;
  });
}
