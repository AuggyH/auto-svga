import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const {
  isWindowContainedInWorkArea,
  normalizeWindowPlacementRecord,
  parseAcceptanceDisplayRequest,
  revalidateAcceptanceLaunchPlacement,
  resolveAcceptanceLaunchPlacement,
  resolveNormalLaunchPlacement,
  windowPlacementRecordFromBounds
} = require("../short-term-window-bounds-policy.cjs");
const {
  ACCEPTANCE_STARTUP_PLACEMENT_PROOF_FILE,
  buildAcceptanceStartupPlacementProof,
  buildRejectedAcceptanceStartupPlacementProof,
  writeAcceptanceStartupPlacementProof
} = require("../acceptance-startup-placement-proof.cjs");
const startupRuntimePolicy = require("../startup-runtime-policy.cjs");

const launchSize = { width: 640, height: 640 };
const minimumSize = { width: 640, height: 640 };
const primary = {
  id: 100,
  workArea: { x: 0, y: 24, width: 1440, height: 876 }
};
const secondary = {
  id: 200,
  workArea: { x: 1440, y: 0, width: 1920, height: 1080 }
};
const proofPrimary = {
  id: primary.id,
  bounds: { x: 0, y: 0, width: 1440, height: 900 },
  workArea: primary.workArea,
  scaleFactor: 2
};
const proofSecondary = {
  id: secondary.id,
  bounds: { x: 1440, y: 0, width: 1920, height: 1080 },
  workArea: secondary.workArea,
  scaleFactor: 2
};
const acceptedProofPlacement = {
  status: "accepted",
  mode: "acceptance",
  displayId: secondary.id,
  requestedDisplayId: secondary.id,
  executionId: "ASV-APR-20260715-089",
  bounds: { x: 2080, y: 220, width: 640, height: 640 },
  persist: false
};

function acceptedProofInput(overrides = {}) {
  return {
    artifactRoot: overrides.artifactRoot,
    placement: overrides.placement ?? acceptedProofPlacement,
    requestedDisplayId: overrides.requestedDisplayId ?? secondary.id,
    selectedDisplay: overrides.selectedDisplay ?? proofSecondary,
    primaryDisplay: overrides.primaryDisplay ?? proofPrimary,
    windowBounds: overrides.windowBounds ?? acceptedProofPlacement.bounds,
    runtimeInstanceId: "runtime-instance-proof",
    productMilestoneId: "0.2-multiformat-preview",
    headCommit: "57b8ef1f1ec55d872514766536f8b1c2df84156e",
    packagedRuntimeBuildInfo: {
      buildCommit: "57b8ef1f1ec55d872514766536f8b1c2df84156e",
      source: "package-internal-trial",
      productMilestoneId: "0.2-multiformat-preview",
      privatePath: "/must/not/appear"
    },
    generatedAt: "2026-07-15T08:00:00.000Z",
    ...overrides
  };
}

function observeUnhandledRejectionWithRelease(releaseMode) {
  const script = `
let observed;
const safetyHandler = () => {};
const candidateHandler = (error) => {
  observed = error instanceof Error ? error.message : String(error);
};
const release = () => process.off("unhandledRejection", candidateHandler);
process.on("unhandledRejection", safetyHandler);
process.once("unhandledRejection", candidateHandler);
Promise.reject(new Error("entrypoint-async-rejection"));
if (${JSON.stringify(releaseMode)} === "immediate") release();
if (${JSON.stringify(releaseMode)} === "setImmediate") setImmediate(release);
setImmediate(() => setImmediate(() => {
  process.off("unhandledRejection", safetyHandler);
  process.off("unhandledRejection", candidateHandler);
  console.log(JSON.stringify({ observed: observed ?? null }));
}));
`;
  const result = spawnSync(process.execPath, ["-e", script], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout.trim());
  return output.observed ?? undefined;
}

test("normal launch restores a validated placement and falls back before first frame", () => {
  const fallback = resolveNormalLaunchPlacement({
    storedPlacement: undefined,
    displays: [secondary, primary],
    primaryDisplay: primary,
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(fallback.status, "primaryFallback");
  assert.deepEqual(fallback.bounds, { x: 400, y: 142, width: 640, height: 640 });
  assert.equal(fallback.displayId, primary.id);
  assert.equal(isWindowContainedInWorkArea(fallback.bounds, primary.workArea), true);

  const restored = resolveNormalLaunchPlacement({
    storedPlacement: {
      schemaVersion: 1,
      source: "owner-normal-window",
      displayId: 200,
      bounds: { x: 3000, y: 800, width: 900, height: 760 },
      savedAt: "2026-07-15T08:00:00.000Z"
    },
    displays: [primary, secondary],
    primaryDisplay: primary,
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(restored.status, "restored");
  assert.equal(restored.displayId, secondary.id);
  assert.equal(isWindowContainedInWorkArea(restored.bounds, secondary.workArea), true);
  assert.deepEqual(restored.bounds, { x: 2460, y: 320, width: 900, height: 760 });

  const stale = resolveNormalLaunchPlacement({
    storedPlacement: {
      schemaVersion: 1,
      source: "owner-normal-window",
      displayId: 200,
      bounds: { x: -9000, y: -9000, width: 900, height: 760 },
      savedAt: "2026-07-15T08:00:00.000Z"
    },
    displays: [primary, secondary],
    primaryDisplay: primary,
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(stale.status, "primaryFallback");
  assert.equal(stale.reason, "placement_offline");
  assert.equal(stale.displayId, primary.id);
});

test("normal placement uses maximum display intersection with a deterministic tie", () => {
  const left = { id: 20, workArea: { x: -1000, y: 0, width: 1000, height: 900 } };
  const right = { id: 10, workArea: { x: 0, y: 0, width: 1000, height: 900 } };
  const placement = {
    schemaVersion: 1,
    source: "owner-normal-window",
    displayId: 20,
    bounds: { x: -320, y: 100, width: 640, height: 640 },
    savedAt: "2026-07-15T08:00:00.000Z"
  };
  const resolved = resolveNormalLaunchPlacement({
    storedPlacement: placement,
    displays: [left, right],
    primaryDisplay: right,
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(resolved.status, "restored");
  assert.equal(resolved.displayId, 10);
  assert.equal(isWindowContainedInWorkArea(resolved.bounds, right.workArea), true);
});

test("normal placement rejects malformed and undersized display inputs", () => {
  const malformed = resolveNormalLaunchPlacement({
    storedPlacement: {
      schemaVersion: 1,
      source: "owner-normal-window",
      displayId: 100,
      bounds: { x: "120", y: 40, width: 640, height: 640 },
      savedAt: "2026-07-15T08:00:00.000Z"
    },
    displays: [primary],
    primaryDisplay: primary,
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(malformed.status, "primaryFallback");
  assert.equal(malformed.reason, "placement_malformed");

  const tooSmallPrimary = resolveNormalLaunchPlacement({
    storedPlacement: undefined,
    displays: [{ id: 1, workArea: { x: 0, y: 0, width: 800, height: 600 } }],
    primaryDisplay: { id: 1, workArea: { x: 0, y: 0, width: 800, height: 600 } },
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(tooSmallPrimary.status, "rejected");
  assert.equal(tooSmallPrimary.reason, "primary_display_too_small");
});

test("normal placement schema is exact, integer-bound, and contains the full native frame", () => {
  const valid = {
    schemaVersion: 1,
    source: "owner-normal-window",
    displayId: 20,
    bounds: { x: -940, y: -180, width: 800, height: 700 },
    savedAt: "2026-07-15T08:00:00.000Z"
  };
  assert.deepEqual(normalizeWindowPlacementRecord(valid), valid);
  for (const malformed of [
    { ...valid, unexpected: true },
    { ...valid, displayId: undefined },
    { ...valid, savedAt: undefined },
    { ...valid, savedAt: "2026-07-15" },
    { ...valid, bounds: { ...valid.bounds, width: 800.5 } },
    { ...valid, bounds: { ...valid.bounds, extra: 1 } }
  ]) {
    assert.equal(normalizeWindowPlacementRecord(malformed), undefined);
  }

  const negativeDisplay = { id: 20, workArea: { x: -1200, y: -200, width: 1200, height: 900 } };
  const restored = resolveNormalLaunchPlacement({
    storedPlacement: valid,
    displays: [primary, negativeDisplay],
    primaryDisplay: primary,
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(restored.status, "restored");
  assert.equal(restored.displayId, 20);
  assert.equal(isWindowContainedInWorkArea(restored.bounds, negativeDisplay.workArea), true);
  assert.ok(restored.bounds.y >= negativeDisplay.workArea.y, "native titlebar must remain in the work area");
});

test("acceptance display input is singular, internal-only, and execution-bound", () => {
  const absent = parseAcceptanceDisplayRequest({
    argv: ["Auto SVGA"],
    environment: {},
    internalCandidate: true
  });
  assert.equal(absent.status, "absent");

  for (const fixture of [
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id=200"],
      environment: {},
      internalCandidate: true,
      reason: "acceptance_execution_unbound"
    },
    {
      argv: ["Auto SVGA"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
      internalCandidate: true,
      reason: "acceptance_display_missing"
    },
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id=200", "--auto-svga-acceptance-display-id=100"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
      internalCandidate: true,
      reason: "acceptance_display_duplicate"
    },
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id=2.5"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
      internalCandidate: true,
      reason: "acceptance_display_malformed"
    },
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id=4294967296"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
      internalCandidate: true,
      reason: "acceptance_display_malformed"
    },
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id", "200"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
      internalCandidate: true,
      reason: "acceptance_argument_forbidden"
    },
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id==200"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
      internalCandidate: true,
      reason: "acceptance_display_malformed"
    },
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id=+200"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
      internalCandidate: true,
      reason: "acceptance_display_malformed"
    },
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id=0200"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
      internalCandidate: true,
      reason: "acceptance_display_malformed"
    },
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id=200", "--auto-svga-acceptance-x=1440"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
      internalCandidate: true,
      reason: "acceptance_argument_forbidden"
    },
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id=200"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "short" },
      internalCandidate: true,
      reason: "acceptance_execution_malformed"
    },
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id=200"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
      internalCandidate: false,
      reason: "acceptance_channel_forbidden"
    }
  ]) {
    const result = parseAcceptanceDisplayRequest(fixture);
    assert.equal(result.status, "rejected");
    assert.equal(result.reason, fixture.reason);
  }
});

test("accepted display is resolved before construction and never persists", () => {
  const request = parseAcceptanceDisplayRequest({
    argv: ["Auto SVGA", "--auto-svga-acceptance-display-id=200"],
    environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
    internalCandidate: true
  });
  assert.equal(request.status, "accepted");

  const resolved = resolveAcceptanceLaunchPlacement({
    request,
    displays: [primary, secondary],
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(resolved.status, "accepted");
  assert.equal(resolved.displayId, secondary.id);
  assert.equal(resolved.persist, false);
  assert.equal(resolved.executionId, "ASV-APR-20260715-001");
  assert.deepEqual(resolved.bounds, { x: 2080, y: 220, width: 640, height: 640 });
  assert.equal(isWindowContainedInWorkArea(resolved.bounds, secondary.workArea), true);

  const unknown = resolveAcceptanceLaunchPlacement({
    request: { ...request, displayId: 999 },
    displays: [primary, secondary],
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(unknown.status, "rejected");
  assert.equal(unknown.reason, "acceptance_display_unknown");

  const duplicate = resolveAcceptanceLaunchPlacement({
    request,
    displays: [secondary, { ...secondary, workArea: { x: 0, y: 0, width: 800, height: 800 } }],
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(duplicate.status, "rejected");
  assert.equal(duplicate.reason, "acceptance_display_ambiguous");

  const tooSmall = resolveAcceptanceLaunchPlacement({
    request,
    displays: [{ id: 200, workArea: { x: -900, y: -100, width: 600, height: 600 } }],
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(tooSmall.status, "rejected");
  assert.equal(tooSmall.reason, "acceptance_display_too_small");

  const stable = revalidateAcceptanceLaunchPlacement({
    placement: resolved,
    displays: [primary, secondary],
    minimumSize
  });
  assert.equal(stable.status, "accepted");
  assert.deepEqual(stable.bounds, resolved.bounds);

  for (const changedDisplays of [
    [primary],
    [primary, { ...secondary, workArea: { ...secondary.workArea, height: 1040 } }],
    [primary, secondary, { ...secondary }]
  ]) {
    const drifted = revalidateAcceptanceLaunchPlacement({
      placement: resolved,
      displays: changedDisplays,
      minimumSize
    });
    assert.equal(drifted.status, "rejected");
    assert.match(drifted.reason, /^acceptance_display_(?:unknown|ambiguous|set_changed)$/u);
  }
});

test("acceptance startup placement proof writes a bounded pre-input artifact", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "auto-svga-acceptance-proof-"));
  try {
    const result = writeAcceptanceStartupPlacementProof(acceptedProofInput({ artifactRoot: root }));
    assert.equal(result.status, "written");
    assert.equal(result.fileName, ACCEPTANCE_STARTUP_PLACEMENT_PROOF_FILE);
    const proofPath = path.join(root, ACCEPTANCE_STARTUP_PLACEMENT_PROOF_FILE);
    assert.equal(existsSync(proofPath), true);
    const proofText = readFileSync(proofPath, "utf8");
    const proof = JSON.parse(proofText);
    assert.equal(proof.status, "accepted");
    assert.equal(proof.executionId, "ASV-APR-20260715-089");
    assert.equal(proof.requestedDisplayId, secondary.id);
    assert.equal(proof.resolvedDisplayId, secondary.id);
    assert.equal(proof.mainDisplayId, primary.id);
    assert.deepEqual(proof.windowBounds, acceptedProofPlacement.bounds);
    assert.equal(proof.selectedDisplay.id, secondary.id);
    assert.equal(proof.primaryDisplay.id, primary.id);
    assert.deepEqual(proof.displayScale, {
      selectedScaleFactor: proofSecondary.scaleFactor,
      primaryScaleFactor: proofPrimary.scaleFactor,
      scaleFactorDelta: 0,
      distinctFromPrimary: false,
      evidenceReady: true
    });
    assert.equal(proof.containment, true);
    assert.equal(proof.disjointFromPrimary, true);
    assert.equal(proof.placementMode, "acceptance");
    assert.equal(proof.runtimeInstanceId, "runtime-instance-proof");
    assert.equal(proof.productIdentity.productMilestoneId, "0.2-multiformat-preview");
    assert.equal(proof.productIdentity.packagedRuntimeBuildInfo.buildCommit, "57b8ef1f1ec55d872514766536f8b1c2df84156e");
    assert.equal(proof.productIdentity.packagedRuntimeBuildInfo.privatePath, undefined);
    assert.equal(proof.privacy.pathRedacted, true);
    assert.equal(proof.privacy.screenshots, false);
    assert.equal(proof.privacy.axTree, false);
    assert.equal(proof.privacy.materialNames, false);
    assert.equal(proof.privacy.ownerPreferenceMutated, false);
    assert.equal(proof.passed, true);
    assert.equal(proofText.includes(root), false);
    assert.equal(proofText.includes("/must/not/appear"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("acceptance startup placement proof records distinct-DPR readiness for matrix gating", () => {
  const distinctScaleInput = acceptedProofInput({
    selectedDisplay: {
      ...proofSecondary,
      scaleFactor: 1.5
    }
  });
  const distinct = buildAcceptanceStartupPlacementProof(distinctScaleInput);
  assert.equal(distinct.status, "accepted");
  assert.equal(distinct.proof.displayScale.selectedScaleFactor, 1.5);
  assert.equal(distinct.proof.displayScale.primaryScaleFactor, 2);
  assert.equal(distinct.proof.displayScale.scaleFactorDelta, 0.5);
  assert.equal(distinct.proof.displayScale.distinctFromPrimary, true);
  assert.equal(distinct.proof.displayScale.evidenceReady, true);
  assert.equal(distinct.proof.passed, true);

  const sameScale = buildAcceptanceStartupPlacementProof(acceptedProofInput());
  assert.equal(sameScale.status, "accepted");
  assert.equal(sameScale.proof.displayScale.distinctFromPrimary, false);
  assert.equal(sameScale.proof.displayScale.evidenceReady, true);

  const rejected = buildAcceptanceStartupPlacementProof(acceptedProofInput({
    selectedDisplay: {
      ...proofSecondary,
      scaleFactor: 1.25
    },
    windowBounds: { ...acceptedProofPlacement.bounds, x: acceptedProofPlacement.bounds.x + 1 }
  }));
  assert.equal(rejected.status, "rejected");
  const rejectedRoot = mkdtempSync(path.join(os.tmpdir(), "auto-svga-acceptance-proof-dpr-rejected-"));
  try {
    const rejectedWrite = writeAcceptanceStartupPlacementProof(acceptedProofInput({
      artifactRoot: rejectedRoot,
      selectedDisplay: {
        ...proofSecondary,
        scaleFactor: 1.25
      },
      windowBounds: { ...acceptedProofPlacement.bounds, x: acceptedProofPlacement.bounds.x + 1 }
    }));
    assert.equal(rejectedWrite.status, "written");
    assert.equal(rejectedWrite.proof.status, "rejected");
    assert.equal(rejectedWrite.proof.reason, "acceptance_window_bounds_drift");
    assert.equal(rejectedWrite.proof.displayScale.selectedScaleFactor, 1.25);
    assert.equal(rejectedWrite.proof.displayScale.primaryScaleFactor, 2);
    assert.equal(rejectedWrite.proof.displayScale.distinctFromPrimary, true);
    assert.equal(rejectedWrite.proof.displayScale.evidenceReady, true);
  } finally {
    rmSync(rejectedRoot, { recursive: true, force: true });
  }
});

test("acceptance startup placement proof rejects unsafe or inexact launches before product input", () => {
  const rejectionCases = [
    {
      name: "missing execution id",
      input: acceptedProofInput({ placement: { ...acceptedProofPlacement, executionId: "" } }),
      reason: "acceptance_execution_unbound"
    },
    {
      name: "wrong requested display",
      input: acceptedProofInput({ requestedDisplayId: 201 }),
      reason: "acceptance_display_mismatch"
    },
    {
      name: "window bounds drift",
      input: acceptedProofInput({ windowBounds: { ...acceptedProofPlacement.bounds, x: acceptedProofPlacement.bounds.x + 1 } }),
      reason: "acceptance_window_bounds_drift"
    },
    {
      name: "selected display is primary",
      input: acceptedProofInput({
        placement: { ...acceptedProofPlacement, displayId: primary.id, requestedDisplayId: primary.id, bounds: { x: 400, y: 142, width: 640, height: 640 } },
        requestedDisplayId: primary.id,
        selectedDisplay: proofPrimary,
        windowBounds: { x: 400, y: 142, width: 640, height: 640 }
      }),
      reason: "acceptance_primary_overlap"
    },
    {
      name: "window is outside selected display",
      input: acceptedProofInput({
        placement: { ...acceptedProofPlacement, bounds: { x: 120, y: 120, width: 640, height: 640 } },
        windowBounds: { x: 120, y: 120, width: 640, height: 640 }
      }),
      reason: "acceptance_window_not_contained"
    },
    {
      name: "runtime identity missing",
      input: acceptedProofInput({ runtimeInstanceId: "" }),
      reason: "acceptance_runtime_instance_missing"
    }
  ];
  for (const fixture of rejectionCases) {
    const result = buildAcceptanceStartupPlacementProof(fixture.input);
    assert.equal(result.status, "rejected", fixture.name);
    assert.equal(result.reason, fixture.reason, fixture.name);
  }

  const invalidRoot = writeAcceptanceStartupPlacementProof(acceptedProofInput({ artifactRoot: "relative-artifacts" }));
  assert.equal(invalidRoot.status, "rejected");
  assert.equal(invalidRoot.reason, "acceptance_artifact_root_invalid");

  const rejectedRoot = mkdtempSync(path.join(os.tmpdir(), "auto-svga-acceptance-proof-rejected-"));
  try {
    const rejectedWrite = writeAcceptanceStartupPlacementProof(acceptedProofInput({
      artifactRoot: rejectedRoot,
      windowBounds: { ...acceptedProofPlacement.bounds, x: acceptedProofPlacement.bounds.x + 1 }
    }));
    assert.equal(rejectedWrite.status, "written");
    assert.equal(rejectedWrite.proof.status, "rejected");
    assert.equal(rejectedWrite.proof.reason, "acceptance_window_bounds_drift");
    assert.equal(rejectedWrite.proof.passed, false);
    const rejectedProofText = readFileSync(path.join(rejectedRoot, ACCEPTANCE_STARTUP_PLACEMENT_PROOF_FILE), "utf8");
    const rejectedProof = JSON.parse(rejectedProofText);
    assert.equal(rejectedProof.status, "rejected");
    assert.equal(rejectedProof.reason, "acceptance_window_bounds_drift");
    assert.equal(rejectedProof.privacy.pathRedacted, true);
    assert.equal(rejectedProofText.includes(rejectedRoot), false);
    assert.equal(rejectedProofText.includes("/must/not/appear"), false);
  } finally {
    rmSync(rejectedRoot, { recursive: true, force: true });
  }

  const root = mkdtempSync(path.join(os.tmpdir(), "auto-svga-acceptance-proof-collision-"));
  try {
    assert.equal(writeAcceptanceStartupPlacementProof(acceptedProofInput({ artifactRoot: root })).status, "written");
    const collision = writeAcceptanceStartupPlacementProof(acceptedProofInput({ artifactRoot: root }));
    assert.equal(collision.status, "rejected");
    assert.equal(collision.reason, "acceptance_placement_proof_exists");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("acceptance startup proof writers never serialize unvalidated identity or reason payloads", () => {
  const invalidExecutionPayload = "PRIVATE";
  const pathPayload = "/Users/owner/private/client-name.svga";
  const milestonePayload = "Users_owner_private_client_name_svga";
  const root = mkdtempSync(path.join(os.tmpdir(), "auto-svga-acceptance-proof-adversarial-"));
  try {
    const result = writeAcceptanceStartupPlacementProof(acceptedProofInput({
      artifactRoot: root,
      placement: {
        ...acceptedProofPlacement,
        executionId: pathPayload
      },
      productMilestoneId: milestonePayload
    }));
    assert.equal(result.status, "written");
    assert.equal(result.proof.status, "rejected");
    assert.equal(result.proof.reason, "acceptance_execution_malformed");
    assert.equal(result.proof.executionId, undefined);
    assert.equal(result.proof.productIdentity.productMilestoneId, undefined);
    const text = readFileSync(path.join(root, ACCEPTANCE_STARTUP_PLACEMENT_PROOF_FILE), "utf8");
    for (const payload of [pathPayload, milestonePayload]) {
      assert.equal(text.includes(payload), false, payload);
    }

    const rejected = buildRejectedAcceptanceStartupPlacementProof(
      acceptedProofInput({
        placement: { ...acceptedProofPlacement, executionId: invalidExecutionPayload },
        productMilestoneId: milestonePayload,
        headCommit: "PRIVATE_CLIENT_BUILD_COMMIT",
        runtimeInstanceId: "/Users/owner/private/runtime-instance",
        generatedAt: "PRIVATE_GENERATED_AT",
        packagedRuntimeBuildInfo: {
          buildCommit: "PRIVATE_PACKAGED_BUILD_COMMIT",
          source: "PRIVATE_CLIENT_SOURCE",
          productMilestoneId: milestonePayload
        }
      }),
      "acceptance_users_owner_private_client_name_svga"
    );
    const rejectedText = JSON.stringify(rejected);
    assert.equal(rejected.reason, "acceptance_startup_bootstrap_failed");
    assert.equal(rejected.executionId, undefined);
    assert.equal(rejected.productIdentity.productMilestoneId, undefined);
    for (const payload of [
      invalidExecutionPayload,
      milestonePayload,
      "users_owner_private",
      "PRIVATE_CLIENT_BUILD_COMMIT",
      "/Users/owner/private/runtime-instance",
      "PRIVATE_GENERATED_AT",
      "PRIVATE_PACKAGED_BUILD_COMMIT",
      "PRIVATE_CLIENT_SOURCE"
    ]) {
      assert.equal(rejectedText.includes(payload), false, payload);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("only normal owner bounds become a placement preference", () => {
  const saved = windowPlacementRecordFromBounds({
    bounds: { x: 1500, y: 80, width: 1280, height: 800 },
    displayId: 200,
    workArea: secondary.workArea,
    windowState: { minimized: false, fullscreen: false, maximized: false },
    launchMode: "normal",
    savedAt: "2026-07-15T08:00:00.000Z"
  });
  assert.equal(saved.status, "accepted");
  assert.equal(saved.record.source, "owner-normal-window");
  assert.equal(saved.record.displayId, 200);

  for (const input of [
    { launchMode: "acceptance", windowState: { minimized: false, fullscreen: false, maximized: false } },
    { launchMode: "proof", windowState: { minimized: false, fullscreen: false, maximized: false } },
    { launchMode: "smoke", windowState: { minimized: false, fullscreen: false, maximized: false } },
    { launchMode: "audit", windowState: { minimized: false, fullscreen: false, maximized: false } },
    { launchMode: "normal", windowState: { minimized: true, fullscreen: false, maximized: false } },
    { launchMode: "normal", windowState: { minimized: false, fullscreen: true, maximized: false } },
    { launchMode: "normal", windowState: { minimized: false, fullscreen: false, maximized: true } }
  ]) {
    const result = windowPlacementRecordFromBounds({
      bounds: { x: 0, y: 0, width: 640, height: 640 },
      displayId: 100,
      savedAt: "2026-07-15T08:00:00.000Z",
      ...input
    });
    assert.equal(result.status, "ignored");
  }

  const outsideTitlebarContainment = windowPlacementRecordFromBounds({
    bounds: { x: 1500, y: -20, width: 1280, height: 800 },
    displayId: 200,
    workArea: secondary.workArea,
    windowState: { minimized: false, fullscreen: false, maximized: false },
    launchMode: "normal",
    savedAt: "2026-07-15T08:00:00.000Z"
  });
  assert.deepEqual(outsideTitlebarContainment, {
    status: "rejected",
    reason: "placement_out_of_bounds"
  });
});

test("main resolves placement before BrowserWindow and persists only owner-driven normal bounds", async () => {
  const source = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const policySource = await readFile(path.join(experimentRoot, "short-term-window-bounds-policy.cjs"), "utf8");
  const storeSource = await readFile(path.join(experimentRoot, "short-term-window-placement-store.cjs"), "utf8");
  const resolverIndex = source.indexOf("resolveInitialMultiFormatWindowPlacement()");
  const displaysIndex = source.indexOf("screen.getAllDisplays()", resolverIndex);
  const browserWindowIndex = source.indexOf("new BrowserWindow", resolverIndex);
  const electronRequireIndex = source.indexOf('require("electron")');
  const firstLocalRequireIndex = source.indexOf('require("./host-adapter-contract.cjs")');
  const bootstrapWriterIndex = source.indexOf("function writeAcceptanceStartupBootstrapFailureArtifact");
  const fatalHandlerIndex = source.indexOf('process.once("uncaughtException"');
  const proofLoaderIndex = source.indexOf("function loadAcceptanceStartupPlacementProofWriter()");
  const proofRequireIndex = source.indexOf('require("./acceptance-startup-placement-proof.cjs")');
  const proofCallIndex = source.indexOf("requireAcceptanceStartupPlacementProof(window, initialPlacement)", browserWindowIndex);
  const loadUrlIndex = source.indexOf("window.loadURL(rendererUrl)", browserWindowIndex);
  const whenReadyIndex = source.indexOf("app.whenReady().then(createExperimentWindow)");
  const fatalReleaseIndex = source.indexOf("scheduleAcceptanceStartupFatalHandlerRelease();", whenReadyIndex);
  assert.ok(resolverIndex >= 0, "missing initial placement resolver");
  assert.ok(displaysIndex > resolverIndex, "online displays must resolve inside the initial placement boundary");
  assert.ok(browserWindowIndex > displaysIndex, "display placement must resolve before BrowserWindow construction");
  assert.ok(electronRequireIndex >= 0, "missing Electron require");
  assert.ok(firstLocalRequireIndex > electronRequireIndex, "missing first local require boundary");
  assert.ok(bootstrapWriterIndex < electronRequireIndex, "bootstrap writer must be available before Electron require can abort");
  assert.ok(bootstrapWriterIndex < firstLocalRequireIndex, "bootstrap writer must be installed before local module loading can fail");
  assert.ok(fatalHandlerIndex > bootstrapWriterIndex, "fatal handler must use the bootstrap writer");
  assert.ok(fatalHandlerIndex < electronRequireIndex, "fatal handler must be installed before Electron require can fail");
  assert.ok(fatalHandlerIndex < firstLocalRequireIndex, "fatal handler must be installed before local module loading can fail");
  const entrypointBootstrap = source.slice(bootstrapWriterIndex, firstLocalRequireIndex);
  assert.match(entrypointBootstrap, /openSync\(proofPath, "wx", 0o600\)/u);
  assert.match(entrypointBootstrap, /acceptance_startup_entrypoint_exception/u);
  assert.match(entrypointBootstrap, /process\.once\("unhandledRejection"/u);
  assert.match(entrypointBootstrap, /pathRedacted: true/u);
  assert.doesNotMatch(entrypointBootstrap, /productArtifactIndex|packagedRuntimeBuildInfo|redactLogMessage/u);
  assert.ok(proofLoaderIndex >= 0, "missing acceptance startup placement proof lazy loader");
  assert.ok(proofRequireIndex > proofLoaderIndex, "placement proof helper must load inside the bootstrap-safe lazy loader");
  assert.doesNotMatch(source.slice(0, proofLoaderIndex), /acceptance-startup-placement-proof\.cjs/u);
  assert.ok(proofCallIndex > browserWindowIndex, "acceptance placement proof must run after BrowserWindow construction");
  assert.ok(proofCallIndex < loadUrlIndex, "acceptance placement proof must run before renderer load or product input");
  assert.equal(source.match(/new BrowserWindow\s*\(/gu)?.length, 1, "startup must have one BrowserWindow constructor");
  assert.match(source, /app\.whenReady\(\)\.then\(createExperimentWindow\)/u);
  assert.ok(fatalReleaseIndex > whenReadyIndex, "entrypoint fatal handler release should be scheduled after whenReady catch is installed");
  assert.match(source, /writeAcceptanceStartupBootstrapFailureArtifact\(acceptanceStartupFailureReason\(error\), error\)/u);
  assert.match(source, /proofResult\.status !== "written" \|\| proofResult\.proof\?\.status !== "accepted"/u);
  assert.match(source.slice(resolverIndex, browserWindowIndex), /revalidateAcceptanceLaunchPlacement[\s\S]*screen\.getAllDisplays\(\)/u);
  assert.match(source.slice(browserWindowIndex, browserWindowIndex + 900), /x: launchBounds\.x,[\s\S]*y: launchBounds\.y/u);
  const createStart = source.indexOf("async function createExperimentWindow()");
  const ownershipIndex = source.indexOf("activeMainWindow = window", browserWindowIndex);
  const initialConstructionBody = source.slice(createStart, ownershipIndex);
  assert.doesNotMatch(initialConstructionBody, /\.(?:setBounds|setPosition|center)\s*\(/u);
  assert.match(source, /process\.env\.AUTO_SVGA_PRODUCT_ARTIFACTS/u);
  assert.match(source, /window\.destroy\(\)[\s\S]*window_placement_rejected/u);
  assert.match(source, /normal-window-placement-v1\.json/u);
  assert.match(source, /readWindowPlacementPreference/u);
  assert.match(source, /writeWindowPlacementPreference/u);
  assert.match(source, /activeWindowPlacementMode !== "normal"/u);
  assert.match(source, /window\.on\("will-move"/u);
  assert.match(source, /window\.on\("will-resize"/u);
  assert.match(source, /window\.isMinimized\(\)[\s\S]*window\.isFullScreen\(\)[\s\S]*window\.isMaximized\(\)/u);
  assert.match(source, /app\.isPackaged[\s\S]*normalVisibleStartupMode[\s\S]*isMultiFormatDesktopProduct[\s\S]*source === "package-internal-trial"/u);
  assert.match(policySource, /function parseAcceptanceDisplayRequest/u);
  assert.match(policySource, /AUTO_SVGA_ACCEPTANCE_EXECUTION_ID/u);
  assert.match(policySource, /function revalidateAcceptanceLaunchPlacement/u);
  assert.match(storeSource, /O_NOFOLLOW/u);
  assert.match(storeSource, /fstatSync/u);
  assert.match(storeSource, /linkSync/u);
  assert.doesNotMatch(source, /AUTO_SVGA_(?:WINDOW|PLACEMENT)_(?:PATH|FILE)/u);
  assert.doesNotMatch(source, /--auto-svga-acceptance-(?:x|y|width|height)=/u);
});

test("entrypoint bootstrap rejection guard survives current-turn async local require rejection", async () => {
  const source = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const immediateReleaseObservation = observeUnhandledRejectionWithRelease("immediate");
  assert.equal(
    immediateReleaseObservation,
    undefined,
    "removing the guard in the same turn misses Node's later unhandledRejection delivery"
  );
  const delayedReleaseObservation = observeUnhandledRejectionWithRelease("setImmediate");
  assert.equal(delayedReleaseObservation, "entrypoint-async-rejection");
  assert.match(source, /function scheduleAcceptanceStartupFatalHandlerRelease/u);
  assert.match(source, /setImmediate\(\(\) => \{\s*releaseAcceptanceStartupFatalHandlers\(\);/u);
  assert.match(source, /app\.whenReady\(\)\.then\(createExperimentWindow\)\.catch/u);
  assert.match(source, /scheduleAcceptanceStartupFatalHandlerRelease\(\);/u);
  assert.doesNotMatch(source, /app\.whenReady\(\)\.then\(createExperimentWindow\)\.catch\([\s\S]*?\}\);\s*releaseAcceptanceStartupFatalHandlers\(\);/u);
});

test("packaged normal startup separates writable runtime state from explicit proof output", async () => {
  const source = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const policyResolutionIndex = source.indexOf("const startupRuntimePolicy = resolveStartupRuntimePolicy");
  const productMergeIndex = source.indexOf("mergeExistingProductArtifactIndex();");
  const productMkdirIndex = source.indexOf("mkdirSync(productArtifactRoot", productMergeIndex);
  assert.match(source, /require\("\.\/startup-runtime-policy\.cjs"\)/u);
  assert.match(source, /resolveStartupRuntimePolicy\(/u);
  assert.match(source, /visibleStartupProofEnabled/u);
  assert.match(source, /describeFatalBootstrapError\(/u);
  assert.ok(policyResolutionIndex >= 0, "startup runtime policy must be resolved");
  assert.ok(productMergeIndex > policyResolutionIndex, "runtime policy must reject before product proof merge/read");
  assert.ok(productMkdirIndex > policyResolutionIndex, "runtime policy must reject before product proof mkdir/write");
  assert.match(source, /function safeBootstrapErrorClass\(/u);
  assert.match(source, /errorClass: safeBootstrapErrorClass\(input\.error\)/u);
  assert.match(source, /errorClass: safeBootstrapErrorClass\(error\)/u);
  assert.doesNotMatch(
    source.slice(0, source.indexOf('require("./startup-runtime-policy.cjs")')),
    /errorClass:[\s\S]{0,120}\.name/u
  );
  assert.doesNotMatch(
    source,
    /productSmokeMode \|\| normalProofMode \|\| normalVisibleStartupMode\) mkdirSync\(productArtifactRoot/u
  );
  assert.doesNotMatch(source, /finderEquivalentLaunchCompatible:\s*true/u);
});

test("early fatal, artifact, and phase taxonomy rejects arbitrary payloads", async (t) => {
  const source = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const root = mkdtempSync(path.join(os.tmpdir(), "auto-svga-early-fatal-"));
  let currentRoot = root;
  const slice = (start, end) => {
    const startIndex = source.indexOf(start);
    const endIndex = source.indexOf(end, startIndex);
    assert.ok(startIndex >= 0 && endIndex > startIndex, `missing source slice ${start} -> ${end}`);
    return source.slice(startIndex, endIndex);
  };
  const harnessSource = [
    "let acceptanceStartupBootstrapPhaseSequence = 0;",
    slice("function acceptanceStartupFailureReason", "const safeBootstrapErrorClasses"),
    slice("const safeBootstrapErrorClasses", "let describeFatalBootstrapError"),
    slice("function writeAcceptanceStartupBootstrapPhase", "function writeAcceptanceStartupBootstrapFailureArtifact"),
    slice("function writeAcceptanceStartupBootstrapFailureArtifact", "function handleAcceptanceStartupFatalError")
  ].join("\n");
  const sandbox = {
    Buffer,
    Error,
    Set,
    acceptanceStartupBootstrapPhaseFileName: "acceptance-startup-bootstrap-phases.jsonl",
    acceptanceStartupPlacementProofFileName: "acceptance-startup-placement-proof.json",
    acceptanceStartupArtifactRoot: () => ({ status: "accepted", root: currentRoot }),
    closeSync,
    earlyAcceptanceRuntimeInstanceId: "early-runtime-test",
    fsyncSync,
    isAcceptanceStartupProofLaunch: () => true,
    mkdirSync,
    openSync,
    path,
    process: {
      arch: "arm64",
      env: {
        AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-EARLY-FATAL-TEST",
        AUTO_SVGA_PRODUCT_MILESTONE: "0.2-multiformat-preview"
      },
      pid: 42,
      platform: "darwin"
    },
    strictAcceptanceStartupDisplayArgument: () => 2,
    validatedAcceptanceStartupIdentity: { executionId: "ASV-EARLY-FATAL-TEST" },
    validatedStartupProductMilestoneId: "0.2-multiformat-preview",
    writeSync
  };

  try {
    vm.runInNewContext(`${harnessSource}
      globalThis.testApi = {
        acceptanceStartupFailureReason,
        describeEarlyFatalBootstrapError,
        writeAcceptanceStartupBootstrapPhase,
        writeAcceptanceStartupBootstrapFailureArtifact
      };`, sandbox);
    const privatePayload = "Failure /Users/owner/private/client-name.svga";
    const error = new Error("message with /Users/owner/private/client-name.svga");
    error.name = privatePayload;

    await t.test("path-shaped error names stay redacted", () => {
      const diagnostic = sandbox.testApi.describeEarlyFatalBootstrapError({
        source: "uncaught_exception",
        error,
        acceptanceLaunch: false,
        acceptanceProofResult: { status: "ignored", reason: "acceptance_launch_not_requested" }
      });
      assert.equal(diagnostic.errorClass, "Error");
      assert.equal(diagnostic.reason, "bootstrap_error");
      assert.equal(JSON.stringify(diagnostic).includes(privatePayload), false);
      assert.equal(JSON.stringify(diagnostic).includes("/Users/owner"), false);
    });

    const safeCharacterPayload = "PRIVATE_CLIENT_NAME_SVGA";
    const syscallPayload = "Users_owner_private";
    await t.test("safe-character plain-object fields stay redacted", () => {
      const plainObjectDiagnostic = sandbox.testApi.describeEarlyFatalBootstrapError({
        source: "uncaught_exception",
        error: {
          name: safeCharacterPayload,
          code: safeCharacterPayload,
          syscall: syscallPayload
        },
        acceptanceLaunch: false,
        acceptanceProofResult: { status: "ignored", reason: "acceptance_launch_not_requested" }
      });
      assert.deepEqual(JSON.parse(JSON.stringify(plainObjectDiagnostic)), {
        source: "uncaught_exception",
        acceptanceLaunch: false,
        reason: "bootstrap_error",
        errorClass: "Error"
      });
    });

    const policyError = Object.assign(
      new Error("startup_policy_invalid_product_milestone"),
      { code: "AUTO_SVGA_STARTUP_POLICY_INVALID_PRODUCT_MILESTONE" }
    );
    await t.test("early acceptance diagnostics retain fixed policy taxonomy only", () => {
      const acceptanceDiagnostic = sandbox.testApi.describeEarlyFatalBootstrapError({
        source: "unhandled_rejection",
        error: policyError,
        acceptanceLaunch: true,
        acceptanceProofResult: {
          status: "rejected",
          reason: "acceptance_users_owner_private_client_name_svga"
        }
      });
      assert.equal(acceptanceDiagnostic.reason, "startup_policy_invalid_product_milestone");
      assert.equal(
        acceptanceDiagnostic.errorCode,
        "AUTO_SVGA_STARTUP_POLICY_INVALID_PRODUCT_MILESTONE"
      );
      assert.equal(JSON.stringify(acceptanceDiagnostic).includes("users_owner_private"), false);
    });

    await t.test("acceptance failure artifact retains fixed policy taxonomy only", () => {
      const result = sandbox.testApi.writeAcceptanceStartupBootstrapFailureArtifact(
        "acceptance_users_owner_private_client_name_svga",
        policyError
      );
      assert.equal(result.status, "written");
      const artifactText = readFileSync(
        path.join(root, "acceptance-startup-placement-proof.json"),
        "utf8"
      );
      const artifact = JSON.parse(artifactText);
      assert.equal(artifact.errorClass, "Error");
      assert.equal(artifact.reason, "startup_policy_invalid_product_milestone");
      assert.equal(artifactText.includes(privatePayload), false);
      assert.equal(artifactText.includes("/Users/owner"), false);
      assert.equal(artifactText.includes("users_owner_private"), false);
    });

    await t.test("window placement and phase reasons use bounded fixed enums", () => {
      const unboundedPlacementReason = sandbox.testApi.acceptanceStartupFailureReason(
        new Error(`window_placement_rejected:${"a".repeat(4096)}`)
      );
      assert.equal(unboundedPlacementReason, "acceptance_startup_bootstrap_failed");
      const phaseResult = sandbox.testApi.writeAcceptanceStartupBootstrapPhase(
        "phase_users_owner_private",
        { reason: "acceptance_users_owner_private_client_name_svga" }
      );
      assert.equal(phaseResult.status, "written");
      assert.equal(phaseResult.record.phase, "bootstrap_phase_unknown");
      assert.equal(phaseResult.record.reason, "acceptance_startup_bootstrap_failed");
      const phaseText = readFileSync(
        path.join(root, "acceptance-startup-bootstrap-phases.jsonl"),
        "utf8"
      );
      assert.equal(phaseText.includes("users_owner_private"), false);
      assert.equal(phaseText.length < 4096, true);
    });

    await t.test("early phase and failure proof reject Unicode, NUL, and overlong payloads", () => {
      const payloads = [
        "PRIVATE_CLIENT_NAME_SVGA",
        "/Users/owner/private/client-name.svga",
        "用户隐私素材",
        "PRIVATE\0CLIENT",
        "x".repeat(4096)
      ];
      const containsPayload = (value, payload) => {
        if (typeof value === "string") return value.includes(payload);
        if (Array.isArray(value)) return value.some((entry) => containsPayload(entry, payload));
        return value && typeof value === "object"
          ? Object.entries(value).some(([key, entry]) => key.includes(payload) || containsPayload(entry, payload))
          : false;
      };
      for (const [index, payload] of payloads.entries()) {
        currentRoot = path.join(root, `payload-${index}`);
        const payloadError = Object.assign(new Error(payload), {
          name: payload,
          code: payload,
          syscall: payload,
          path: payload
        });
        const phase = sandbox.testApi.writeAcceptanceStartupBootstrapPhase(payload, {
          reason: payload,
          placementMode: payload
        });
        const failure = sandbox.testApi.writeAcceptanceStartupBootstrapFailureArtifact(payload, payloadError);
        assert.equal(phase.status, "written");
        assert.equal(failure.status, "written");
        assert.equal(containsPayload(phase.record, payload), false, JSON.stringify(payload));
        assert.equal(containsPayload(failure.proof, payload), false, JSON.stringify(payload));
        const serialized = [
          readFileSync(path.join(currentRoot, "acceptance-startup-bootstrap-phases.jsonl"), "utf8")
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line)),
          JSON.parse(readFileSync(path.join(currentRoot, "acceptance-startup-placement-proof.json"), "utf8"))
        ];
        assert.equal(containsPayload(serialized, payload), false, JSON.stringify(payload));
      }
      currentRoot = root;
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("early fatal artifacts omit unvalidated environment identity payloads", async () => {
  const source = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const root = mkdtempSync(path.join(os.tmpdir(), "auto-svga-early-identity-"));
  const slice = (start, end) => {
    const startIndex = source.indexOf(start);
    const endIndex = source.indexOf(end, startIndex);
    assert.ok(startIndex >= 0 && endIndex > startIndex, `missing source slice ${start} -> ${end}`);
    return source.slice(startIndex, endIndex);
  };
  const harnessSource = [
    "let acceptanceStartupBootstrapPhaseSequence = 0;",
    slice("const safeBootstrapErrorClasses", "let describeFatalBootstrapError"),
    slice("function writeAcceptanceStartupBootstrapPhase", "function writeAcceptanceStartupBootstrapFailureArtifact"),
    slice("function writeAcceptanceStartupBootstrapFailureArtifact", "function handleAcceptanceStartupFatalError")
  ].join("\n");
  const executionPayload = "PRIVATE_CLIENT_NAME_SVGA";
  const milestonePayload = "Users_owner_private_client_name_svga";
  const pathPayload = "/Users/owner/private/client-name.svga";
  const sandbox = {
    Buffer,
    Error,
    Set,
    acceptanceStartupBootstrapPhaseFileName: "acceptance-startup-bootstrap-phases.jsonl",
    acceptanceStartupPlacementProofFileName: "acceptance-startup-placement-proof.json",
    acceptanceStartupArtifactRoot: () => ({ status: "accepted", root }),
    closeSync,
    earlyAcceptanceRuntimeInstanceId: "early-runtime-test",
    fsyncSync,
    isAcceptanceStartupProofLaunch: () => true,
    mkdirSync,
    openSync,
    path,
    process: {
      arch: "arm64",
      env: {
        AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: executionPayload,
        AUTO_SVGA_PRODUCT_MILESTONE: milestonePayload
      },
      pid: 42,
      platform: "darwin"
    },
    strictAcceptanceStartupDisplayArgument: () => undefined,
    validatedAcceptanceStartupIdentity: undefined,
    validatedStartupProductMilestoneId: undefined,
    writeSync
  };

  try {
    vm.runInNewContext(`${harnessSource}
      globalThis.testApi = {
        writeAcceptanceStartupBootstrapPhase,
        writeAcceptanceStartupBootstrapFailureArtifact
      };`, sandbox);
    const phase = sandbox.testApi.writeAcceptanceStartupBootstrapPhase("entrypoint_loaded");
    assert.equal(phase.status, "written");
    assert.equal(phase.record.executionId, undefined);
    const error = Object.assign(new Error(pathPayload), {
      code: executionPayload,
      syscall: milestonePayload
    });
    error.name = pathPayload;
    const artifact = sandbox.testApi.writeAcceptanceStartupBootstrapFailureArtifact(
      "acceptance_users_owner_private_client_name_svga",
      error
    );
    assert.equal(artifact.status, "written");
    assert.equal(artifact.proof.executionId, undefined);
    assert.equal(artifact.proof.productIdentity.productMilestoneId, undefined);
    const serialized = [
      readFileSync(path.join(root, "acceptance-startup-bootstrap-phases.jsonl"), "utf8"),
      readFileSync(path.join(root, "acceptance-startup-placement-proof.json"), "utf8")
    ].join("\n");
    for (const payload of [executionPayload, milestonePayload, pathPayload, "users_owner_private"]) {
      assert.equal(serialized.includes(payload), false, payload);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("late app-ready failures use the bounded structured fatal taxonomy", async () => {
  const source = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const redactorStart = source.indexOf("const LOCAL_PATH_PATTERNS");
  const redactorEnd = source.indexOf("function gitHeadCommit", redactorStart);
  const catchStart = source.indexOf("app.whenReady().then(createExperimentWindow).catch");
  const catchEnd = source.indexOf("\n});", catchStart) + 4;
  assert.ok(redactorStart >= 0 && redactorEnd > redactorStart);
  assert.ok(catchStart >= 0 && catchEnd > catchStart);

  const observe = (error) => {
    const lines = [];
    const sandbox = {
      Error,
      acceptanceStartupFailureReason: () => "acceptance_startup_bootstrap_failed",
      app: {
        exit: () => {},
        whenReady: () => ({
          then: () => ({
            catch: (handler) => {
              sandbox.catchHandler = handler;
            }
          })
        })
      },
      console: { error: (value) => lines.push(String(value)) },
      createExperimentWindow: () => {},
      describeFatalBootstrapError: startupRuntimePolicy.describeFatalBootstrapError,
      isAcceptanceStartupProofLaunch: () => false,
      sessionRoot: "/private/auto-svga-session",
      writeAcceptanceStartupBootstrapFailureArtifact: () => ({
        status: "ignored",
        reason: "acceptance_launch_not_requested"
      }),
      writeAcceptanceStartupBootstrapPhase: () => ({ status: "ignored" })
    };
    vm.runInNewContext(
      `${source.slice(redactorStart, redactorEnd)}\n${source.slice(catchStart, catchEnd)}`,
      sandbox
    );
    sandbox.catchHandler(error);
    return lines;
  };

  const safePayload = "PRIVATE_CLIENT_NAME_SVGA";
  const filesystemError = Object.assign(new Error(safePayload), {
    code: "EACCES",
    syscall: "mkdir"
  });
  filesystemError.name = "/Users/owner/private/client-name.svga";
  const filesystemLines = observe(filesystemError);
  const prefix = "AUTO_SVGA_WEB_EXPERIMENT_ERROR ";
  const filesystemLine = filesystemLines.find((line) => line.startsWith(prefix));
  assert.ok(filesystemLine);
  const filesystemDiagnostic = JSON.parse(filesystemLine.slice(prefix.length));
  assert.deepEqual(filesystemDiagnostic, {
    source: "app_ready_rejection",
    acceptanceLaunch: false,
    reason: "bootstrap_eacces",
    errorClass: "Error",
    errorCode: "EACCES",
    errorSyscall: "mkdir"
  });
  assert.equal(filesystemLine.includes(safePayload), false);
  assert.equal(filesystemLine.includes("/Users/owner"), false);

  const pathPayload = "/Users/owner/private/client-name.svga";
  const plainLines = observe({
    name: safePayload,
    message: pathPayload,
    code: safePayload,
    syscall: "Users_owner_private"
  });
  const plainLine = plainLines.find((line) => line.startsWith(prefix));
  assert.ok(plainLine);
  const plainDiagnostic = JSON.parse(plainLine.slice(prefix.length));
  assert.deepEqual(plainDiagnostic, {
    source: "app_ready_rejection",
    acceptanceLaunch: false,
    reason: "bootstrap_error",
    errorClass: "Error"
  });
  for (const payload of [safePayload, pathPayload, "Users_owner_private"]) {
    assert.equal(plainLine.includes(payload), false, payload);
  }
});

test("early and loaded fatal taxonomy have a complete fail-closed parity invariant", async () => {
  const source = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const taxonomyStart = source.indexOf("const safeBootstrapErrorClasses");
  const taxonomyEnd = source.indexOf("const safeAcceptanceBootstrapPhases", taxonomyStart);
  assert.ok(taxonomyStart >= 0 && taxonomyEnd > taxonomyStart);
  const sandbox = {};
  vm.runInNewContext(
    `${source.slice(taxonomyStart, taxonomyEnd)};
      globalThis.earlyTaxonomy = earlyStartupFatalDiagnosticTaxonomy;`,
    sandbox
  );
  assert.equal(typeof startupRuntimePolicy.startupFatalDiagnosticTaxonomy, "object");
  assert.equal(typeof startupRuntimePolicy.assertStartupFatalDiagnosticTaxonomyParity, "function");
  assert.deepEqual(
    JSON.parse(JSON.stringify(sandbox.earlyTaxonomy)),
    JSON.parse(JSON.stringify(startupRuntimePolicy.startupFatalDiagnosticTaxonomy))
  );
  assert.match(
    source,
    /assertStartupFatalDiagnosticTaxonomyParity\(earlyStartupFatalDiagnosticTaxonomy\)/u
  );
  assert.doesNotThrow(() => startupRuntimePolicy.assertStartupFatalDiagnosticTaxonomyParity(
    startupRuntimePolicy.startupFatalDiagnosticTaxonomy
  ));
  for (const key of Object.keys(startupRuntimePolicy.startupFatalDiagnosticTaxonomy)) {
    const value = startupRuntimePolicy.startupFatalDiagnosticTaxonomy[key];
    const mutated = {
      ...startupRuntimePolicy.startupFatalDiagnosticTaxonomy,
      [key]: Array.isArray(value)
        ? value.slice(1)
        : typeof value === "string"
          ? `${value}PRIVATE_CLIENT_NAME_SVGA`
          : { ...value, PRIVATE_CLIENT_NAME_SVGA: "bootstrap_error" }
    };
    assert.throws(
      () => startupRuntimePolicy.assertStartupFatalDiagnosticTaxonomyParity(mutated),
      /startup_fatal_diagnostic_taxonomy_mismatch/u,
      key
    );
  }
});

test("acceptance startup bootstrap phase trace distinguishes no-proof startup stops", async () => {
  const source = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const phaseFileIndex = source.indexOf('const acceptanceStartupBootstrapPhaseFileName = "acceptance-startup-bootstrap-phases.jsonl"');
  const phaseWriterIndex = source.indexOf("function writeAcceptanceStartupBootstrapPhase");
  const entrypointPhaseIndex = source.indexOf('writeAcceptanceStartupBootstrapPhase("entrypoint_loaded")');
  const electronRequireBeginIndex = source.indexOf('writeAcceptanceStartupBootstrapPhase("electron_require_begin")');
  const electronRequireIndex = source.indexOf('require("electron")');
  const electronRequiredIndex = source.indexOf('writeAcceptanceStartupBootstrapPhase("electron_required")');
  const localRequiresBeginIndex = source.indexOf('writeAcceptanceStartupBootstrapPhase("local_requires_begin")');
  const firstLocalRequireIndex = source.indexOf('require("./host-adapter-contract.cjs")');
  const localRequiresCompleteIndex = source.indexOf('writeAcceptanceStartupBootstrapPhase("local_requires_complete")');
  const appReadyRegisterBeginIndex = source.indexOf('writeAcceptanceStartupBootstrapPhase("app_ready_handler_register_begin")');
  const appReadyIndex = source.indexOf("app.whenReady().then(createExperimentWindow)");
  const appReadyRegisteredIndex = source.indexOf('writeAcceptanceStartupBootstrapPhase("app_ready_handler_registered")');
  assert.ok(phaseFileIndex >= 0, "missing bootstrap phase file name");
  assert.ok(phaseWriterIndex >= 0, "missing bootstrap phase writer");
  assert.ok(entrypointPhaseIndex > phaseWriterIndex, "entrypoint phase must use the bounded phase writer");
  assert.ok(electronRequireBeginIndex > entrypointPhaseIndex, "Electron require begin must follow entrypoint phase");
  assert.ok(electronRequireIndex > electronRequireBeginIndex, "Electron require begin phase must be written before require");
  assert.ok(electronRequiredIndex > electronRequireIndex, "Electron required phase must prove Electron module load completed");
  assert.ok(localRequiresBeginIndex > electronRequiredIndex, "local require begin must follow Electron module load");
  assert.ok(firstLocalRequireIndex > localRequiresBeginIndex, "local require begin must be written before first local require");
  assert.ok(localRequiresCompleteIndex > firstLocalRequireIndex, "local require complete must prove local startup module load completed");
  assert.ok(appReadyRegisterBeginIndex > localRequiresCompleteIndex, "app-ready registration must follow local startup load");
  assert.ok(appReadyIndex > appReadyRegisterBeginIndex, "app-ready registration begin must precede app.whenReady");
  assert.ok(appReadyRegisteredIndex > appReadyIndex, "app-ready registered phase must follow handler registration");

  const createStart = source.indexOf("async function createExperimentWindow()");
  const createEnd = source.indexOf("\n}\n\nfunction handleMultiFormatOpenFileEvent", createStart);
  const createSource = source.slice(createStart, createEnd);
  const createPhases = [
    "app_ready_create_window_begin",
    "server_import_begin",
    "server_imported",
    "server_started",
    "placement_resolve_begin",
    "placement_resolved",
    "browser_window_construct_begin",
    "browser_window_constructed",
    "renderer_load_begin",
    "renderer_load_completed"
  ];
  let previousIndex = -1;
  for (const phase of createPhases) {
    const index = createSource.indexOf(`writeAcceptanceStartupBootstrapPhase("${phase}"`);
    assert.ok(index > previousIndex, `phase ${phase} must appear in runtime order`);
    previousIndex = index;
  }
  assert.match(source, /writeAcceptanceStartupBootstrapPhase\("placement_proof_publish_begin"\)/u);
  assert.match(source, /writeAcceptanceStartupBootstrapPhase\("placement_proof_published"\)/u);
  assert.match(source, /writeAcceptanceStartupBootstrapPhase\("placement_proof_rejected"/u);
  assert.match(source, /writeAcceptanceStartupBootstrapPhase\("app_ready_create_window_failed"/u);
  assert.match(source, /writeAcceptanceStartupBootstrapPhase\("bootstrap_failure_artifact_begin"/u);
  assert.match(source, /pathRedacted: true/u);
  assert.doesNotMatch(source, /acceptance-startup-bootstrap-phases\.jsonl[\s\S]{0,120}targetPath|rawPath|ownerPath/u);
});
