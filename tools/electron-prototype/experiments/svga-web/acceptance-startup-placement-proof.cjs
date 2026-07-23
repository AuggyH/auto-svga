"use strict";

const { createHash } = require("node:crypto");
const { closeSync, fsyncSync, mkdirSync, openSync, writeSync } = require("node:fs");
const path = require("node:path");
const { isWindowContainedInWorkArea } = require("./short-term-window-bounds-policy.cjs");
const {
  finalizeStartupRecord,
  safeAcceptanceBootstrapReason,
  safeAcceptanceExecutionId,
  safeStartupProductMilestoneId,
  serializeStartupRecord
} = require("./startup-runtime-policy.cjs");

const ACCEPTANCE_STARTUP_PLACEMENT_PROOF_FILE = "acceptance-startup-placement-proof.json";

function strictRect(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const fields = [value.x, value.y, value.width, value.height];
  if (!fields.every(Number.isFinite)) return undefined;
  const rect = {
    x: Math.round(value.x),
    y: Math.round(value.y),
    width: Math.round(value.width),
    height: Math.round(value.height)
  };
  if (rect.width <= 0 || rect.height <= 0) return undefined;
  return rect;
}

function sameRect(a, b) {
  const left = strictRect(a);
  const right = strictRect(b);
  return Boolean(left && right)
    && left.x === right.x
    && left.y === right.y
    && left.width === right.width
    && left.height === right.height;
}

function rectIntersectionArea(a, b) {
  const left = strictRect(a);
  const right = strictRect(b);
  if (!left || !right) return 0;
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  return width * height;
}

function displayScaleReadiness(selectedDisplay, primaryDisplay) {
  const selectedScaleFactor = Number.isFinite(selectedDisplay?.scaleFactor) && selectedDisplay.scaleFactor > 0
    ? selectedDisplay.scaleFactor
    : undefined;
  const primaryScaleFactor = Number.isFinite(primaryDisplay?.scaleFactor) && primaryDisplay.scaleFactor > 0
    ? primaryDisplay.scaleFactor
    : undefined;
  const scaleFactorDelta = selectedScaleFactor !== undefined && primaryScaleFactor !== undefined
    ? Math.abs(selectedScaleFactor - primaryScaleFactor)
    : undefined;
  return {
    selectedScaleFactor,
    primaryScaleFactor,
    scaleFactorDelta,
    distinctFromPrimary: scaleFactorDelta !== undefined ? scaleFactorDelta > 0.0001 : false,
    evidenceReady: selectedScaleFactor !== undefined && primaryScaleFactor !== undefined
  };
}

function snapshotDisplay(display) {
  const id = Number.isSafeInteger(display?.id) ? display.id : undefined;
  const bounds = strictRect(display?.bounds);
  const workArea = strictRect(display?.workArea);
  const scaleFactor = Number.isFinite(display?.scaleFactor) && display.scaleFactor > 0
    ? display.scaleFactor
    : undefined;
  return id === undefined || !bounds || !workArea || scaleFactor === undefined
    ? undefined
    : { id, bounds, workArea, scaleFactor };
}

function publicBuildInfo(buildInfo) {
  if (!buildInfo || typeof buildInfo !== "object") return undefined;
  return {
    buildCommit: safeHeadCommit(buildInfo.buildCommit),
    source: buildInfo.source === "package-internal-trial" ? buildInfo.source : undefined,
    productMilestoneId: safeStartupProductMilestoneId(buildInfo.productMilestoneId)
  };
}

function safeHeadCommit(value) {
  return typeof value === "string" && /^[a-f0-9]{40}$/u.test(value) ? value : undefined;
}

function safeGeneratedAt(value) {
  if (typeof value !== "string") return new Date().toISOString();
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
    ? value
    : new Date().toISOString();
}

function publicProductIdentity(input) {
  return {
    productMilestoneId: safeStartupProductMilestoneId(input?.productMilestoneId),
    headCommit: safeHeadCommit(input?.headCommit),
    packagedRuntimeBuildInfo: publicBuildInfo(input?.packagedRuntimeBuildInfo)
  };
}

function rejected(reason) {
  return { status: "rejected", reason };
}

function buildAcceptanceStartupPlacementProof(input) {
  if (input?.placement?.mode !== "acceptance" || input.placement.status !== "accepted") {
    return rejected("acceptance_placement_not_active");
  }
  const rawExecutionId = input.placement.executionId;
  if (typeof rawExecutionId !== "string" || rawExecutionId.length === 0) {
    return rejected("acceptance_execution_unbound");
  }
  const executionId = safeAcceptanceExecutionId(rawExecutionId);
  if (!executionId) return rejected("acceptance_execution_malformed");
  const requestedDisplayId = input.requestedDisplayId ?? input.placement.displayId;
  if (!Number.isSafeInteger(requestedDisplayId)) return rejected("acceptance_display_malformed");
  const resolvedDisplayId = input.placement.displayId;
  if (!Number.isSafeInteger(resolvedDisplayId)) return rejected("acceptance_display_malformed");

  const selectedDisplay = snapshotDisplay(input.selectedDisplay);
  const primaryDisplay = snapshotDisplay(input.primaryDisplay);
  const windowBounds = strictRect(input.windowBounds);
  const expectedBounds = strictRect(input.placement.bounds);
  if (!selectedDisplay || !primaryDisplay || !windowBounds || !expectedBounds) {
    return rejected("acceptance_placement_malformed");
  }
  if (selectedDisplay.id !== resolvedDisplayId || requestedDisplayId !== resolvedDisplayId) {
    return rejected("acceptance_display_mismatch");
  }
  if (!sameRect(windowBounds, expectedBounds)) {
    return rejected("acceptance_window_bounds_drift");
  }
  const containment = isWindowContainedInWorkArea(windowBounds, selectedDisplay.workArea);
  if (!containment) return rejected("acceptance_window_not_contained");
  const disjointFromPrimary = selectedDisplay.id !== primaryDisplay.id
    && rectIntersectionArea(windowBounds, primaryDisplay.bounds) === 0;
  if (!disjointFromPrimary) return rejected("acceptance_primary_overlap");
  const displayScale = displayScaleReadiness(selectedDisplay, primaryDisplay);

  const generatedAt = safeGeneratedAt(input.generatedAt);
  const runtimeInstanceId = safeAcceptanceExecutionId(input.runtimeInstanceId);
  if (!runtimeInstanceId) return rejected("acceptance_runtime_instance_missing");
  const proof = {
    schemaVersion: 1,
    proofId: "acceptance-startup-placement-proof",
    status: "accepted",
    placementMode: "acceptance",
    executionId,
    requestedDisplayId,
    resolvedDisplayId,
    mainDisplayId: primaryDisplay.id,
    windowBounds,
    selectedDisplay,
    primaryDisplay,
    displayScale,
    containment,
    disjointFromPrimary,
    runtimeInstanceId,
    productIdentity: publicProductIdentity(input),
    privacy: {
      pathRedacted: true,
      screenshots: false,
      axTree: false,
      materialNames: false,
      ownerPreferenceMutated: false
    },
    generatedAt
  };
  proof.digest = createHash("sha256").update(JSON.stringify({
    executionId,
    requestedDisplayId,
    resolvedDisplayId,
    windowBounds,
    selectedDisplay,
    primaryDisplay,
    displayScale,
    runtimeInstanceId,
    productIdentity: proof.productIdentity
  })).digest("hex");
  proof.passed = proof.containment === true
    && proof.disjointFromPrimary === true
    && proof.privacy.pathRedacted === true
    && proof.privacy.ownerPreferenceMutated === false;
  return { status: "accepted", proof: finalizeStartupRecord("placement-accepted", proof) };
}

function buildRejectedAcceptanceStartupPlacementProof(input, reason) {
  const executionId = safeAcceptanceExecutionId(input?.placement?.executionId);
  const requestedDisplayId = Number.isSafeInteger(input?.requestedDisplayId ?? input?.placement?.requestedDisplayId ?? input?.placement?.displayId)
    ? input.requestedDisplayId ?? input.placement.requestedDisplayId ?? input.placement.displayId
    : undefined;
  const resolvedDisplayId = Number.isSafeInteger(input?.placement?.displayId)
    ? input.placement.displayId
    : undefined;
  const selectedDisplay = snapshotDisplay(input?.selectedDisplay);
  const primaryDisplay = snapshotDisplay(input?.primaryDisplay);
  const windowBounds = strictRect(input?.windowBounds);
  const containment = Boolean(windowBounds && selectedDisplay && isWindowContainedInWorkArea(windowBounds, selectedDisplay.workArea));
  const disjointFromPrimary = Boolean(windowBounds && selectedDisplay && primaryDisplay
    && selectedDisplay.id !== primaryDisplay.id
    && rectIntersectionArea(windowBounds, primaryDisplay.bounds) === 0);
  const displayScale = displayScaleReadiness(selectedDisplay, primaryDisplay);
  const generatedAt = safeGeneratedAt(input?.generatedAt);
  const runtimeInstanceId = safeAcceptanceExecutionId(input?.runtimeInstanceId);
  const proof = {
    schemaVersion: 1,
    proofId: "acceptance-startup-placement-proof",
    status: "rejected",
    placementMode: input?.placement?.mode === "acceptance" ? "acceptance" : "unknown",
    reason: safeAcceptanceBootstrapReason(reason),
    executionId,
    requestedDisplayId,
    resolvedDisplayId,
    mainDisplayId: primaryDisplay?.id,
    windowBounds,
    selectedDisplay,
    primaryDisplay,
    displayScale,
    containment,
    disjointFromPrimary,
    runtimeInstanceId,
    productIdentity: publicProductIdentity(input),
    privacy: {
      pathRedacted: true,
      screenshots: false,
      axTree: false,
      materialNames: false,
      ownerPreferenceMutated: false
    },
    generatedAt,
    passed: false
  };
  proof.digest = createHash("sha256").update(JSON.stringify({
    status: proof.status,
    reason: proof.reason,
    executionId,
    requestedDisplayId,
    resolvedDisplayId,
    windowBounds,
    selectedDisplay,
    primaryDisplay,
    displayScale,
    runtimeInstanceId,
    productIdentity: proof.productIdentity
  })).digest("hex");
  return finalizeStartupRecord("placement-rejected", proof);
}

function validateArtifactRoot(root) {
  if (typeof root !== "string" || root.length === 0) return rejected("acceptance_artifact_root_missing");
  if (root.includes("\0") || !path.isAbsolute(root)) return rejected("acceptance_artifact_root_invalid");
  return { status: "accepted", root };
}

function writeAcceptanceStartupPlacementProof(input, fsApi = { mkdirSync, openSync, writeSync, fsyncSync, closeSync }) {
  const root = validateArtifactRoot(input?.artifactRoot);
  if (root.status !== "accepted") return root;
  const built = buildAcceptanceStartupPlacementProof(input);
  const proof = built.status === "accepted"
    ? built.proof
    : buildRejectedAcceptanceStartupPlacementProof(input, built.reason);
  const proofPath = path.join(root.root, ACCEPTANCE_STARTUP_PLACEMENT_PROOF_FILE);
  const schemaId = proof.status === "accepted" ? "placement-accepted" : "placement-rejected";
  const bytes = Buffer.from(serializeStartupRecord(schemaId, proof, 2));
  let fd;
  try {
    fsApi.mkdirSync(root.root, { recursive: true });
    fd = fsApi.openSync(proofPath, "wx", 0o600);
    fsApi.writeSync(fd, bytes, 0, bytes.length);
    fsApi.fsyncSync(fd);
  } catch (error) {
    return {
      status: "rejected",
      reason: error?.code === "EEXIST" ? "acceptance_placement_proof_exists" : "acceptance_placement_proof_write_failed"
    };
  } finally {
    if (fd !== undefined) {
      try {
        fsApi.closeSync(fd);
      } catch {
        // The caller receives a redacted write failure above when the critical write path fails.
      }
    }
  }
  return {
    status: "written",
    fileName: ACCEPTANCE_STARTUP_PLACEMENT_PROOF_FILE,
    proof
  };
}

module.exports = {
  ACCEPTANCE_STARTUP_PLACEMENT_PROOF_FILE,
  buildAcceptanceStartupPlacementProof,
  buildRejectedAcceptanceStartupPlacementProof,
  writeAcceptanceStartupPlacementProof
};
