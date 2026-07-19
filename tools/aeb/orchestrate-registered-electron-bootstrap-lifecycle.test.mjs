import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CONTRACT,
  PermitError,
  authorityPaths,
  buildProcessAuthorityInvocation,
  expectedAuthorityBinding,
} from "./run-registered-electron-bootstrap-discriminator.mjs";
import {
  PUBLIC_LIFECYCLE_ISSUE_CODE_MAP,
  assertLifecycleBudget,
  buildPostrunRelay,
  orchestrateLifecycle,
  serializeLifecycleError,
} from "./orchestrate-registered-electron-bootstrap-lifecycle.mjs";

const PACKET_HEAD = "a".repeat(40);
const PERMIT_ID = "ASV-APR-20260715-999";
const EXECUTION_ID = "aeb-registered-electron-lifecycle-test-001";
const OUTPUT_ROOT = `${CONTRACT.taskRoot}/${EXECUTION_ID}`;
const PRELAUNCH_SHA = "5".repeat(64);
const PENDING_SHA = "9".repeat(64);
const POSTRUN_SHA = "8".repeat(64);
const RELAY_SHA = "7".repeat(64);
const EVIDENCE_BINDING_SHA = "e".repeat(64);

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

function runtimeMarkers(pendingAtMs, runtimeDurationMs = 5_000) {
  const launchedAtMs = pendingAtMs - runtimeDurationMs;
  const spacing = runtimeDurationMs / 5;
  const base = {
    permitId: PERMIT_ID,
    packetHead: PACKET_HEAD,
    executionId: EXECUTION_ID,
    sourceHead: CONTRACT.sourceHead,
    pid: 123,
    processExecPath: `${CONTRACT.electronApp}/${CONTRACT.executableRelativePath}`,
    appPath: CONTRACT.electronApp,
    bundleId: CONTRACT.bundleId,
    electronVersion: CONTRACT.version,
    evidenceBindingSha256: EVIDENCE_BINDING_SHA,
  };
  return {
    launchedAtUtc: new Date(launchedAtMs).toISOString(),
    firstJavaScriptMarker: {
      ...base,
      schema: "auto-svga-registered-electron-bootstrap-v0-first-javascript",
      phase: "first-javascript",
      recordedAtUtc: new Date(launchedAtMs + spacing).toISOString(),
    },
    appReadyMarker: {
      ...base,
      schema: "auto-svga-registered-electron-bootstrap-v0-app-ready",
      phase: "app-ready",
      userDataBound: true,
      sessionDataBound: true,
      windowsCreated: 0,
      recordedAtUtc: new Date(launchedAtMs + spacing * 2).toISOString(),
    },
    normalQuitWillQuitMarker: {
      ...base,
      schema: "auto-svga-registered-electron-bootstrap-v0-normal-quit-will-quit",
      phase: "normal-quit-will-quit",
      recordedAtUtc: new Date(launchedAtMs + spacing * 3).toISOString(),
    },
    normalQuitObservedMarker: {
      ...base,
      schema: "auto-svga-registered-electron-bootstrap-v0-normal-quit-observed",
      phase: "normal-quit-observed",
      exitCode: 0,
      recordedAtUtc: new Date(launchedAtMs + spacing * 4).toISOString(),
    },
  };
}

function validPending(pendingAtMs) {
  const markers = runtimeMarkers(pendingAtMs);
  return {
    schema: "auto-svga-registered-electron-bootstrap-runtime-pending-v1",
    status: "runtime_completed_pending_postrun_authority",
    earliestMissingPhase: "postrun_process_authority",
    issueCode: "postrun_process_authority_required",
    permitId: PERMIT_ID,
    executionId: EXECUTION_ID,
    packetHead: PACKET_HEAD,
    sourceHead: CONTRACT.sourceHead,
    pendingAtUtc: new Date(pendingAtMs).toISOString(),
    outputRootSha256: sha256Text(OUTPUT_ROOT),
    evidenceStore: {
      schema: "auto-svga-registered-electron-evidence-binding-v1",
      helperSha256: CONTRACT.expectedEvidenceStoreSha256,
      bindingSha256: EVIDENCE_BINDING_SHA,
      bindingByteLength: 512,
      createdAtUtc: markers.launchedAtUtc,
      directoryIdentitySha256: "d".repeat(64),
    },
    launchedAtUtc: markers.launchedAtUtc,
    launchAttemptsPerformed: 1,
    launchResult: { status: 0, signal: null },
    prelaunchAuthorityArtifactSha256: PRELAUNCH_SHA,
    ...markers,
    markerHashes: {
      firstJavaScript: "1".repeat(64),
      appReady: "2".repeat(64),
      normalQuitWillQuit: "3".repeat(64),
      normalQuitObserved: "4".repeat(64),
    },
    crashBefore: { reports: [] },
    postrunAuthorityRequired: true,
    finalPassAllowedInRunner: false,
    productProofContinued: false,
    forcedTerminationUsed: false,
    retryUsed: false,
  };
}

function validPostrunAuthority(pending, nowMs) {
  const invocation = buildProcessAuthorityInvocation({
    phase: "postrun",
    executionId: pending.executionId,
    expectedPid: pending.firstJavaScriptMarker.pid,
  });
  return {
    artifact: {
      capturedAtUtc: new Date(nowMs - 100).toISOString(),
      authorityAccepted: true,
    },
    artifactSha256: POSTRUN_SHA,
    invocation,
    binding: expectedAuthorityBinding({
      artifactSha256: POSTRUN_SHA,
      invocationSha256: invocation.invocationSha256,
      forbiddenPids: [pending.firstJavaScriptMarker.pid],
    }),
  };
}

function packetMaterials() {
  return {
    runnerSha256: "1".repeat(64),
    bootstrapSha256: "2".repeat(64),
    testSha256: "3".repeat(64),
    finalizerSha256: "4".repeat(64),
    evidenceStoreSha256: CONTRACT.expectedEvidenceStoreSha256,
    orchestratorSha256: "6".repeat(64),
    lifecycleTestSha256: "7".repeat(64),
    relayPublisherSha256: "8".repeat(64),
    permitPacketSha256: "9".repeat(64),
  };
}

function options() {
  return {
    permitId: PERMIT_ID,
    packetHead: PACKET_HEAD,
    executionId: EXECUTION_ID,
    outputRoot: OUTPUT_ROOT,
    preflightRelayPath: "/private/test-control-relay.json",
    preflightRelaySha256: "a".repeat(64),
    prelaunchAuthorityPath: "/private/test-prelaunch-authority.json",
    prelaunchAuthoritySha256: PRELAUNCH_SHA,
  };
}

function lifecycleFixture({ pendingAtMs, nowMs }) {
  const pending = validPending(pendingAtMs);
  const postrunAuthority = validPostrunAuthority(pending, nowMs);
  const calls = { prepare: 0, producer: 0, publish: 0, finalizer: 0 };
  const git = {
    actualHead: PACKET_HEAD,
    actualBranch: CONTRACT.branch,
    trackedStatusEmpty: true,
    sourceAncestor: true,
    packetHead: PACKET_HEAD,
  };
  const summary = {
    status: pending.status,
    permitId: PERMIT_ID,
    executionId: EXECUTION_ID,
    packetHead: PACKET_HEAD,
    sourceHead: CONTRACT.sourceHead,
    launchAttemptsPerformed: 1,
    launchStatus: 0,
    evidenceStore: pending.evidenceStore,
    pendingDispositionSha256: PENDING_SHA,
    postrunAuthorityRequired: true,
    finalPassAllowedInRunner: false,
    productProofContinued: false,
    forcedTerminationUsed: false,
    retryUsed: false,
  };
  const dependencies = {
    now: () => nowMs,
    verifyGitBinding: async () => git,
    collectPacketMaterialHashes: async () => packetMaterials(),
    runRunner: async () => summary,
    loadBoundEvidenceStore: async () => ({ outputRoot: OUTPUT_ROOT, bindingSha256: EVIDENCE_BINDING_SHA }),
    readBoundEvidenceRecord: async () => ({ value: pending, sha256: PENDING_SHA }),
    validateRuntimeMarkerFiles: async () => true,
    prepareProcessAuthorityRoot: async ({ executionId, allowedExistingEntries }) => {
      calls.prepare += 1;
      assert.deepEqual(allowedExistingEntries, ["prelaunch-authority.json"]);
      return authorityPaths(executionId);
    },
    runProducer: async () => {
      calls.producer += 1;
      return { status: 0, signal: null };
    },
    sha256File: async () => POSTRUN_SHA,
    loadAndValidateProcessAuthority: async () => postrunAuthority,
    publishRelay: async ({ relay }) => {
      calls.publish += 1;
      assert.equal(relay.pendingDispositionSha256, PENDING_SHA);
      assert.equal(relay.expectedPid, 123);
      return { status: "pass", relaySha256: RELAY_SHA };
    },
    runFinalizer: async (args) => {
      calls.finalizer += 1;
      assert.equal(args["pending-disposition-sha256"], PENDING_SHA);
      assert.equal(args["postrun-authority-sha256"], POSTRUN_SHA);
      assert.equal(args["postrun-relay-sha256"], RELAY_SHA);
      return { status: "pass", issueCode: null };
    },
  };
  return { pending, postrunAuthority, calls, dependencies };
}

test("failure-first reproduces the Permit 071 51-second coordinator delay", async () => {
  const nowMs = Date.parse("2026-07-14T17:23:48.985Z");
  const pendingAtMs = Date.parse("2026-07-14T17:22:57.837Z");
  assert.equal(nowMs - pendingAtMs, 51_148);
  assert.throws(
    () => assertLifecycleBudget(validPending(pendingAtMs), nowMs, "permit_071_reproduction"),
    (error) => error instanceof PermitError && error.issueCode === "lifecycle_pending_budget_expired",
  );
  const fixture = lifecycleFixture({ pendingAtMs, nowMs });
  await assert.rejects(
    orchestrateLifecycle(options(), fixture.dependencies),
    (error) => error instanceof PermitError && error.issueCode === "runtime_pending_rejected",
  );
  assert.deepEqual(fixture.calls, { prepare: 0, producer: 0, publish: 0, finalizer: 0 });
});

test("fresh contiguous lifecycle derives pending identity and invokes the sole finalizer once", async () => {
  const nowMs = Date.parse("2026-07-15T01:00:00.000Z");
  const fixture = lifecycleFixture({ pendingAtMs: nowMs - 1_000, nowMs });
  const result = await orchestrateLifecycle(options(), fixture.dependencies);
  assert.equal(result.status, "pass");
  assert.deepEqual(fixture.calls, { prepare: 1, producer: 1, publish: 1, finalizer: 1 });
  assert.equal(result.lifecycleCounts.runnerInvocations, 1);
  assert.equal(result.lifecycleCounts.finalizerInvocations, 1);
  assert.equal(result.finalizerStartReserveMs, CONTRACT.crashReportSettleDelayMs);
  assert.equal(result.noRetry, true);
  assert.equal(result.productProofContinued, false);
});

test("postrun producer failure after authority-root preparation stops before relay and finalizer", async () => {
  const nowMs = Date.parse("2026-07-15T01:00:00.000Z");
  const fixture = lifecycleFixture({ pendingAtMs: nowMs - 1_000, nowMs });
  fixture.dependencies.runProducer = async () => {
    fixture.calls.producer += 1;
    return { status: 1, signal: null };
  };
  await assert.rejects(
    orchestrateLifecycle(options(), fixture.dependencies),
    (error) => error instanceof PermitError && error.issueCode === "postrun_process_authority_command_failed",
  );
  assert.deepEqual(fixture.calls, { prepare: 1, producer: 1, publish: 0, finalizer: 0 });
});

test("future and finalizer-reserve boundary timestamps fail closed", () => {
  const nowMs = Date.parse("2026-07-15T01:00:00.000Z");
  assert.throws(
    () => assertLifecycleBudget(validPending(nowMs + CONTRACT.runtimeFutureSkewMs + 1), nowMs, "future"),
    (error) => error instanceof PermitError && error.issueCode === "lifecycle_pending_future",
  );
  const lastAllowed = nowMs - (CONTRACT.runtimePendingMaxAgeMs - CONTRACT.crashReportSettleDelayMs);
  assert.equal(assertLifecycleBudget(validPending(lastAllowed), nowMs, "boundary").remainingUntilFinalizerStartMs, 0);
  assert.throws(
    () => assertLifecycleBudget(validPending(lastAllowed - 1), nowMs, "expired"),
    (error) => error instanceof PermitError && error.issueCode === "lifecycle_pending_budget_expired",
  );
});

test("producer, relay publication, and finalizer failures never retry or continue", async () => {
  const nowMs = Date.parse("2026-07-15T01:00:00.000Z");
  for (const failedPhase of ["producer", "publish", "finalizer"]) {
    const fixture = lifecycleFixture({ pendingAtMs: nowMs - 1_000, nowMs });
    if (failedPhase === "producer") {
      fixture.dependencies.runProducer = async () => {
        fixture.calls.producer += 1;
        return { status: 2, signal: null };
      };
    } else if (failedPhase === "publish") {
      fixture.dependencies.publishRelay = async () => {
        fixture.calls.publish += 1;
        throw new PermitError("postrun_relay_publication_failed", "injected publication failure");
      };
    } else {
      fixture.dependencies.runFinalizer = async () => {
        fixture.calls.finalizer += 1;
        return { status: "failed_closed", issueCode: "injected_finalizer_failure" };
      };
    }
    await assert.rejects(orchestrateLifecycle(options(), fixture.dependencies), PermitError);
    assert.equal(fixture.calls.producer, 1);
    assert.equal(fixture.calls.publish, failedPhase === "producer" ? 0 : 1);
    assert.equal(fixture.calls.finalizer, failedPhase === "finalizer" ? 1 : 0);
  }
});

test("composed CLI error serialization preserves typed identity without raw process path or PID", async () => {
  const nowMs = Date.parse("2026-07-15T01:00:00.000Z");
  const fixture = lifecycleFixture({ pendingAtMs: nowMs - 1_000, nowMs });
  const rawPath = "/Users/alice/private/Electron.app/Contents/MacOS/Electron";
  fixture.dependencies.loadAndValidateProcessAuthority = async () => {
    throw new PermitError("process_authority_rejected", "Private diagnostic message", {
      failures: [{
        field: "samples[0].targetMatches",
        actual: [{ pid: 4321, processExecPath: rawPath }],
        expected: [],
      }],
      artifactPath: "/private/tmp/private-process-authority.json",
    });
  };

  let composedError;
  try {
    await orchestrateLifecycle(options(), fixture.dependencies);
  } catch (error) {
    composedError = error;
  }
  assert(composedError instanceof PermitError);
  const visible = serializeLifecycleError(composedError);
  const cliJson = JSON.stringify(visible);
  assert.deepEqual(Object.keys(visible), [
    "schema",
    "status",
    "issueCode",
    "message",
    "phase",
    "lifecycleCounts",
  ]);
  assert.equal(visible.schema, "auto-svga-registered-electron-bootstrap-lifecycle-error-v0");
  assert.equal(visible.status, "failed_closed");
  assert.equal(visible.issueCode, "process_authority_rejected");
  assert.equal(visible.message, "Lifecycle execution failed closed.");
  assert.equal(visible.phase, "postrun_authority");
  assert.deepEqual(visible.lifecycleCounts, {
    runnerInvocations: 1,
    producerInvocations: 1,
    relayPublicationAttempts: 0,
    finalizerInvocations: 0,
  });
  assert.equal(cliJson.includes(rawPath), false);
  assert.equal(cliJson.includes("4321"), false);
  assert.equal(cliJson.includes("private-process-authority.json"), false);
  assert.equal(cliJson.includes("failures"), false);

  assert.equal(Object.isFrozen(PUBLIC_LIFECYCLE_ISSUE_CODE_MAP), true);
  for (const knownCode of [
    "process_authority_rejected",
    "lifecycle_pending_budget_expired",
    "runner_pending_rejected",
  ]) {
    const knownVisible = serializeLifecycleError({
      issueCode: knownCode,
      details: composedError.details,
    });
    assert.equal(knownVisible.issueCode, knownCode);
    assert.equal(knownVisible.message, "Lifecycle execution failed closed.");
    assert.equal(knownVisible.phase, "postrun_authority");
    assert.deepEqual(knownVisible.lifecycleCounts, visible.lifecycleCounts);
    assert.deepEqual(Object.keys(knownVisible), Object.keys(visible));
  }

  const rejectedCodes = [
    "private_internal_detail",
    "private_pid_4321",
    "PRIVATE-PID",
    "",
    "   ",
    "a".repeat(97),
    { toString: () => "process_authority_rejected" },
    ["process_authority_rejected"],
    4321,
    Object("process_authority_rejected"),
  ];
  for (const rejectedCode of rejectedCodes) {
    const rejectedVisible = serializeLifecycleError({
      issueCode: rejectedCode,
      details: composedError.details,
    });
    const rejectedJson = JSON.stringify(rejectedVisible);
    assert.equal(rejectedVisible.issueCode, "lifecycle_orchestration_error");
    assert.equal(rejectedVisible.message, "Lifecycle execution failed closed.");
    assert.equal(rejectedVisible.phase, "postrun_authority");
    assert.deepEqual(rejectedVisible.lifecycleCounts, visible.lifecycleCounts);
    assert.deepEqual(Object.keys(rejectedVisible), Object.keys(visible));
    assert.equal(rejectedJson.includes(rawPath), false);
    assert.equal(rejectedJson.includes("4321"), false);
    assert.equal(rejectedJson.includes("private-process-authority.json"), false);
    assert.equal(rejectedJson.includes("failures"), false);
  }

  const untrustedCountsVisible = serializeLifecycleError({
    issueCode: "process_authority_rejected",
    details: {
      lifecycleCounts: {
        runnerInvocations: "1",
        producerInvocations: 2,
        relayPublicationAttempts: -1,
        finalizerInvocations: { valueOf: () => 1 },
      },
    },
  });
  assert.equal(untrustedCountsVisible.issueCode, "process_authority_rejected");
  assert.equal(untrustedCountsVisible.phase, "preflight");
  assert.deepEqual(untrustedCountsVisible.lifecycleCounts, {
    runnerInvocations: null,
    producerInvocations: null,
    relayPublicationAttempts: null,
    finalizerInvocations: null,
  });
  assert.deepEqual(Object.keys(untrustedCountsVisible), Object.keys(visible));

  const source = await readFile(
    new URL("./orchestrate-registered-electron-bootstrap-lifecycle.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /JSON\.stringify\(serializeLifecycleError\(error\)\)/);
});

test("relay payload binds the descriptor pending, exact PID, and private authority", () => {
  const nowMs = Date.parse("2026-07-15T01:00:00.000Z");
  const pending = validPending(nowMs - 1_000);
  const authority = validPostrunAuthority(pending, nowMs);
  const relay = buildPostrunRelay({
    pending,
    pendingDispositionSha256: PENDING_SHA,
    postrunAuthority: authority,
    capturedAtUtc: new Date(nowMs).toISOString(),
  });
  assert.equal(relay.pendingDispositionSha256, PENDING_SHA);
  assert.equal(relay.postrunAuthorityArtifactSha256, POSTRUN_SHA);
  assert.equal(relay.expectedPid, pending.firstJavaScriptMarker.pid);
  assert.equal(relay.processExecPathSha256, sha256Text(pending.firstJavaScriptMarker.processExecPath));
  assert.equal(relay.appPathSha256, sha256Text(pending.firstJavaScriptMarker.appPath));
});

test("relay publisher rejects replay, path swap, and partial publication without outside writes", async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "aeb-relay-publisher-test-")));
  const publisherPath = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "publish-registered-electron-postrun-relay.py",
  );
  const source = String.raw`
import importlib.util
import json
import os
import sys

publisher_path, root = sys.argv[1:]
spec = importlib.util.spec_from_file_location("publisher", publisher_path)
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)
producer = publisher.load_approved_producer(publisher.APPROVED_PRODUCER_PATH)
relay = {"schema": "test-relay", "value": 1}

def new_case(name):
    authority = os.path.join(root, name)
    os.mkdir(authority, 0o700)
    return authority, os.path.join(authority, publisher.RELAY_NAME)

authority, relay_path = new_case("replay-case")
first = publisher.publish_relay(
    relay, authority, relay_path, allowed_base_root=root, producer_module=producer
)
try:
    publisher.publish_relay(
        relay, authority, relay_path, allowed_base_root=root, producer_module=producer
    )
    raise AssertionError("replay publication was accepted")
except Exception:
    pass

outside = os.path.join(root, "outside")
os.mkdir(outside, 0o700)
authority, relay_path = new_case("swap-case")
held = authority + "-held"
def swap_root(_binding, _producer):
    os.rename(authority, held)
    os.symlink(outside, authority)
try:
    publisher.publish_relay(
        relay,
        authority,
        relay_path,
        allowed_base_root=root,
        producer_module=producer,
        before_publish=swap_root,
    )
    raise AssertionError("path swap was accepted")
except Exception:
    pass
assert os.listdir(outside) == []

authority, relay_path = new_case("partial-case")
original_link = producer.os.link
def fail_link(*_args, **_kwargs):
    raise OSError("injected link failure")
producer.os.link = fail_link
try:
    try:
        publisher.publish_relay(
            relay, authority, relay_path, allowed_base_root=root, producer_module=producer
        )
        raise AssertionError("partial publication was accepted")
    except Exception:
        pass
finally:
    producer.os.link = original_link
assert not os.path.exists(relay_path)
assert not any(name.startswith(".process-authority-") for name in os.listdir(authority))
print(json.dumps({"status": "pass", "relaySha256": first["relaySha256"]}))
`;
  try {
    const result = spawnSync("/usr/bin/python3", ["-c", source, publisherPath, root], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.status, "pass");
    assert.match(output.relaySha256, /^[0-9a-f]{64}$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the lifecycle repair does not widen approved pending or crash-settle bounds", async () => {
  const runner = await readFile(
    new URL("./run-registered-electron-bootstrap-discriminator.mjs", import.meta.url),
    "utf8",
  );
  assert.match(runner, /runtimePendingMaxAgeMs:\s*30_000/);
  assert.match(runner, /crashReportSettleDelayMs:\s*2_000/);
});
