import type { ResourceContentHash } from "./contracts.js";
import type { EmbeddedResourceHasher } from "./resource-hasher.js";
import {
  AEB_BAKE_JOB_SCHEMA_VERSION,
  AEB_BAKE_MANIFEST_SCHEMA_VERSION,
  AEB_BAKE_PLANNER_JOIN_SCHEMA_VERSION,
  AEB_BAKE_TASK_RECEIPT_SCHEMA_VERSION,
  type AebBakeFrameSource,
  type AebBakeExecutionReceipt,
  type AebBakeExecutionAuthority,
  type AebBakeJob,
  type AebBakeManifest,
  type AebBakeManifestFrame,
  type AebBakePlannerJoin,
  type AebBakeTaskReceipt,
  type BuildAebBakeManifestInput
} from "./aeb-bake-contracts.js";

export class AebBakePipelineError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "AebBakePipelineError";
  }
}

const MAX_BAKE_FRAMES = 10_000;
const MAX_BAKE_CANVAS_DIMENSION = 8_192;
const MAX_BAKE_ENCODED_BYTES = 128 * 1024 * 1024;
const MAX_BAKE_DECODED_RGBA_BYTES = 512 * 1024 * 1024;
const MAX_BAKE_PACKAGE_BYTES = 128 * 1024 * 1024;

export async function buildAebBakeManifest(
  input: BuildAebBakeManifestInput
): Promise<AebBakeManifest> {
  validateJob(input.job);
  validatePlannerJoin(input.job, input.planner);
  validateTaskReceipt(input.job, input.taskReceipt);
  const expectedFrames = validateFrameInventory(input.job, input.frames);
  await validateExecutionReceipt(input, expectedFrames);
  await input.reader.verifyTaskReceipt(input.taskReceipt);

  const frames: AebBakeManifestFrame[] = [];
  const canonicalByHash = new Map<string, string>();
  let totalEncodedBytes = 0;
  let totalDecodedRgbaBytes = 0;

  for (const source of expectedFrames) {
    const resource = await input.reader.readFrame(source, {
      width: input.job.canvas.width,
      height: input.job.canvas.height,
      maxEncodedBytes: input.job.budgets.maxEncodedBytes,
      maxDecodedRgbaBytes: input.job.budgets.maxDecodedRgbaBytes
    });
    const contentHash = requireSha256(await input.hasher.hash(resource.bytes));
    const resourceIdentity = await hashCanonical(input.hasher, {
      jobId: input.job.jobId,
      frameIndex: source.frameIndex
    });
    const resourceId = `bake_${resourceIdentity.slice(0, 24)}`;
    const canonicalResourceId = canonicalByHash.get(contentHash.value) ?? resourceId;
    canonicalByHash.set(contentHash.value, canonicalResourceId);
    totalEncodedBytes += resource.encodedBytes;
    totalDecodedRgbaBytes += resource.decodedRgbaBytes;
    assertBudget(totalEncodedBytes, input.job.budgets.maxEncodedBytes, "ENCODED_BUDGET_EXCEEDED");
    assertBudget(totalDecodedRgbaBytes, input.job.budgets.maxDecodedRgbaBytes, "DECODED_BUDGET_EXCEEDED");
    frames.push({
      frameIndex: source.frameIndex,
      relativePath: source.relativePath,
      resourceId,
      canonicalResourceId,
      contentHash,
      encodedBytes: resource.encodedBytes,
      decodedRgbaBytes: resource.decodedRgbaBytes,
      width: resource.width,
      height: resource.height,
      alphaBounds: resource.alphaBounds
    });
  }

  const resourceManifestId = await hashCanonical(input.hasher, {
    jobId: input.job.jobId,
    frames: frames.map((frame) => ({
      frameIndex: frame.frameIndex,
      relativePath: frame.relativePath,
      resourceId: frame.resourceId,
      canonicalResourceId: frame.canonicalResourceId,
      contentHash: frame.contentHash,
      encodedBytes: frame.encodedBytes,
      decodedRgbaBytes: frame.decodedRgbaBytes,
      width: frame.width,
      height: frame.height,
      alphaBounds: frame.alphaBounds
    }))
  });
  const estimatedPackageBytes = totalEncodedBytes + byteLength(canonicalJson({
    resourceManifestId,
    frames
  }));
  assertBudget(estimatedPackageBytes, input.job.budgets.maxPackageBytes, "PACKAGE_BUDGET_EXCEEDED");

  const sortedPlannerDecisions = input.planner.decisions
    .map((decision) => ({ ...decision }))
    .sort((left, right) => compareCodeUnits(left.layerId, right.layerId));
  const nativeLayerIds = sortedPlannerDecisions
    .filter((decision) => decision.outcome === "native")
    .map((decision) => decision.layerId)
    .sort(compareCodeUnits);
  const bakedLayerIds = [...input.job.target.layerIds].sort(compareCodeUnits);
  const manifestWithoutId: Omit<AebBakeManifest, "manifestId"> = {
    schemaVersion: AEB_BAKE_MANIFEST_SCHEMA_VERSION,
    job: {
      schemaVersion: input.job.schemaVersion,
      jobId: input.job.jobId,
      packageId: input.job.packageId,
      source: { ...input.job.source },
      target: {
        ...input.job.target,
        layerIds: [...input.job.target.layerIds].sort(compareCodeUnits),
        replaceableElementIds: [...input.job.target.replaceableElementIds].sort(compareCodeUnits)
      },
      timeRange: { ...input.job.timeRange },
      fps: input.job.fps,
      canvas: { ...input.job.canvas },
      alphaMode: input.job.alphaMode,
      bbox: { ...input.job.bbox },
      budgets: { ...input.job.budgets }
    },
    planner: {
      schemaVersion: input.planner.schemaVersion,
      decisions: sortedPlannerDecisions
    },
    execution: {
      mode: input.executionReceipt.mode,
      receiptHash: input.executionReceipt.receiptHash,
      frameInventoryDigest: input.executionReceipt.frameInventoryDigest,
      actualAeRenderExecuted: input.executionReceipt.actualAeRenderExecuted
    },
    frames,
    resources: {
      frameCount: frames.length,
      uniqueContentCount: canonicalByHash.size,
      deduplicatedFrameCount: frames.length - canonicalByHash.size,
      totalEncodedBytes,
      totalDecodedRgbaBytes,
      estimatedPackageBytes
    },
    reinsertion: {
      packageId: input.job.packageId,
      targetSourceId: input.job.target.sourceId,
      replaceBakedLayerIds: bakedLayerIds,
      preserveNativeLayerIds: nativeLayerIds,
      preservedReplaceableElementIds: [],
      blockedLayerIds: [],
      resourceManifestId,
      contractValidated: true,
      packageReinserted: false
    },
    safety: {
      taskId: input.taskReceipt.taskId,
      receiptId: input.taskReceipt.receiptId,
      sourceProjectMutationAllowed: false,
      replaceablePolicy: "preserve",
      cleanupPolicy: input.taskReceipt.cleanupPolicy,
      rollbackPolicy: input.taskReceipt.rollbackPolicy,
      taskOwnedPathsVerified: true
    },
    validation: {
      adapterNeutralValidated: true,
      packageReinsertionValidated: false,
      actualAeRenderExecuted: input.executionReceipt.actualAeRenderExecuted,
      runtimeProved: false,
      installedQaAccepted: false,
      productOwnerAccepted: false,
      finalEncoderValidationRequired: true
    },
    futureAdapters: {
      svga: "awaiting_package_reinsertion",
      vap: "not_implemented",
      lottie: "not_implemented",
      pag: "not_implemented"
    }
  };

  const manifest: AebBakeManifest = {
    ...manifestWithoutId,
    manifestId: await hashCanonical(input.hasher, manifestWithoutId)
  };
  if (!await verifyAebBakeManifestIntegrity(manifest, input.hasher, input.executionAuthority)) {
    fail("MANIFEST_INTEGRITY_INVALID", "AEB Bake manifest failed its trusted integrity verifier before publication.");
  }
  return manifest;
}

export async function verifyAebBakeManifestIntegrity(
  manifest: AebBakeManifest,
  hasher: EmbeddedResourceHasher,
  executionAuthority?: AebBakeExecutionAuthority
): Promise<boolean> {
  if (!isRecord(manifest)
    || manifest.schemaVersion !== AEB_BAKE_MANIFEST_SCHEMA_VERSION
    || !isSha256(manifest.manifestId)
    || !isManifestSemanticallyValid(manifest)) {
    return false;
  }
  const canonicalByHash = new Map<string, string>();
  for (const frame of manifest.frames) {
    const identity = await hashCanonical(hasher, {
      jobId: manifest.job.jobId,
      frameIndex: frame.frameIndex
    });
    if (frame.resourceId !== `bake_${identity.slice(0, 24)}`) return false;
    const canonicalResourceId = canonicalByHash.get(frame.contentHash.value) ?? frame.resourceId;
    if (frame.canonicalResourceId !== canonicalResourceId) return false;
    canonicalByHash.set(frame.contentHash.value, canonicalResourceId);
  }
  const resourceManifestId = await hashCanonical(hasher, {
    jobId: manifest.job.jobId,
    frames: manifest.frames.map((frame) => ({
      frameIndex: frame.frameIndex,
      relativePath: frame.relativePath,
      resourceId: frame.resourceId,
      canonicalResourceId: frame.canonicalResourceId,
      contentHash: frame.contentHash,
      encodedBytes: frame.encodedBytes,
      decodedRgbaBytes: frame.decodedRgbaBytes,
      width: frame.width,
      height: frame.height,
      alphaBounds: frame.alphaBounds
    }))
  });
  if (manifest.reinsertion.resourceManifestId !== resourceManifestId
    || manifest.execution.frameInventoryDigest !== await frameInventoryDigest(manifest.frames, hasher)
    || manifest.resources.estimatedPackageBytes !== manifest.resources.totalEncodedBytes + byteLength(canonicalJson({
      resourceManifestId,
      frames: manifest.frames
    }))) return false;
  const { manifestId, ...manifestWithoutId } = manifest;
  if (manifestId !== await hashCanonical(hasher, manifestWithoutId)) return false;
  return manifest.execution.mode !== "after_effects"
    || Boolean(executionAuthority && await executionAuthority.verifyManifest(manifest));
}

function isManifestSemanticallyValid(manifest: AebBakeManifest): boolean {
  try {
    const frameCount = manifest.job.timeRange.endFrameExclusive - manifest.job.timeRange.startFrame;
    if (manifest.job.schemaVersion !== AEB_BAKE_JOB_SCHEMA_VERSION
      || !isIdentifier(manifest.job.jobId)
      || !isIdentifier(manifest.job.packageId)
      || !isIdentifier(manifest.job.source.compositionId)
      || !isSha256(manifest.job.source.sourceFingerprint)
      || !isSha256(manifest.job.source.scanDigest)
      || !isSha256(manifest.job.source.plannerDigest)
      || (manifest.job.target.kind !== "layer" && manifest.job.target.kind !== "precomp")
      || !isIdentifier(manifest.job.target.sourceId)
      || manifest.job.target.layerIds.length === 0
      || new Set(manifest.job.target.layerIds).size !== manifest.job.target.layerIds.length
      || manifest.job.target.layerIds.some((layerId) => !isIdentifier(layerId))
      || !isSorted(manifest.job.target.layerIds)
      || manifest.job.target.replaceableElementIds.length !== 0
      || manifest.job.alphaMode !== "straight"
      || !isPositiveInteger(manifest.job.canvas.width)
      || !isPositiveInteger(manifest.job.canvas.height)
      || manifest.job.canvas.width > MAX_BAKE_CANVAS_DIMENSION
      || manifest.job.canvas.height > MAX_BAKE_CANVAS_DIMENSION
      || !Number.isFinite(manifest.job.fps)
      || manifest.job.fps <= 0
      || manifest.job.fps > 240
      || !isBboxValid(manifest.job)
      || !areBudgetsWithinHardLimits(manifest.job.budgets)
      || manifest.planner.schemaVersion !== AEB_BAKE_PLANNER_JOIN_SCHEMA_VERSION
      || frameCount <= 0
      || frameCount > manifest.job.budgets.maxFrames
      || frameCount !== manifest.frames.length
      || frameCount !== manifest.resources.frameCount
      || manifest.frames.some((frame, offset) =>
        frame.frameIndex !== manifest.job.timeRange.startFrame + offset
        || !isNormalizedRelativePngPath(frame.relativePath)
        || !isSha256(frame.contentHash.value)
        || frame.contentHash.algorithm !== "sha256"
        || frame.contentHash.scope !== "encoded_bytes"
        || !/^bake_[a-f0-9]{24}$/.test(frame.resourceId)
        || !/^bake_[a-f0-9]{24}$/.test(frame.canonicalResourceId)
        || frame.width !== manifest.job.canvas.width
        || frame.height !== manifest.job.canvas.height
        || frame.encodedBytes <= 0
        || frame.decodedRgbaBytes !== frame.width * frame.height * 4
        || !isAlphaBoundsValid(frame.alphaBounds, frame.width, frame.height)
      )) return false;
    const resourceIds = new Set(manifest.frames.map((frame) => frame.resourceId));
    if (resourceIds.size !== manifest.frames.length
      || manifest.frames.some((frame) => !resourceIds.has(frame.canonicalResourceId))) return false;
    const hashes = new Set(manifest.frames.map((frame) => frame.contentHash.value));
    const totalEncodedBytes = manifest.frames.reduce((total, frame) => total + frame.encodedBytes, 0);
    const totalDecodedRgbaBytes = manifest.frames.reduce((total, frame) => total + frame.decodedRgbaBytes, 0);
    if (manifest.resources.uniqueContentCount !== hashes.size
      || manifest.resources.deduplicatedFrameCount !== manifest.frames.length - hashes.size
      || manifest.resources.totalEncodedBytes !== totalEncodedBytes
      || manifest.resources.totalDecodedRgbaBytes !== totalDecodedRgbaBytes
      || totalEncodedBytes > manifest.job.budgets.maxEncodedBytes
      || totalDecodedRgbaBytes > manifest.job.budgets.maxDecodedRgbaBytes
      || manifest.resources.estimatedPackageBytes <= 0
      || manifest.resources.estimatedPackageBytes > manifest.job.budgets.maxPackageBytes) return false;
    const decisions = manifest.planner.decisions;
    if (decisions.length === 0
      || new Set(decisions.map((decision) => decision.layerId)).size !== decisions.length
      || decisions.some((decision) => !isIdentifier(decision.layerId)
        || !["native", "bake_required", "blocked"].includes(decision.outcome)
        || typeof decision.reason !== "string"
        || decision.reason.trim() === "")
      || decisions.some((decision, index) => index > 0 && compareCodeUnits(decisions[index - 1].layerId, decision.layerId) >= 0)
      || decisions.some((decision) => decision.outcome === "blocked")) return false;
    const targetLayers = [...manifest.job.target.layerIds].sort(compareCodeUnits);
    const bakedLayers = decisions.filter((decision) => decision.outcome === "bake_required").map((decision) => decision.layerId).sort(compareCodeUnits);
    const nativeLayers = decisions.filter((decision) => decision.outcome === "native").map((decision) => decision.layerId).sort(compareCodeUnits);
    if (targetLayers.length === 0
      || targetLayers.some((layerId) => decisions.find((decision) => decision.layerId === layerId)?.outcome !== "bake_required")
      || !sameStringArray(targetLayers, bakedLayers)
      || !sameStringArray(targetLayers, manifest.reinsertion.replaceBakedLayerIds)
      || !sameStringArray(nativeLayers, manifest.reinsertion.preserveNativeLayerIds)
      || manifest.reinsertion.packageId !== manifest.job.packageId
      || manifest.reinsertion.targetSourceId !== manifest.job.target.sourceId
      || manifest.reinsertion.blockedLayerIds.length !== 0
      || manifest.reinsertion.preservedReplaceableElementIds.length !== 0
      || !isSha256(manifest.reinsertion.resourceManifestId)
      || manifest.reinsertion.contractValidated !== true
      || manifest.reinsertion.packageReinserted !== false) return false;
    const executionStateValid = (manifest.execution.mode === "synthetic_fixture"
      && manifest.execution.actualAeRenderExecuted === false)
      || (manifest.execution.mode === "after_effects"
        && manifest.execution.actualAeRenderExecuted === true);
    return isSha256(manifest.execution.frameInventoryDigest)
      && isSha256(manifest.execution.receiptHash)
      && executionStateValid
      && isTaskId(manifest.safety.taskId)
      && isIdentifier(manifest.safety.receiptId)
      && manifest.safety.sourceProjectMutationAllowed === false
      && manifest.safety.replaceablePolicy === "preserve"
      && manifest.safety.cleanupPolicy === "delete_task_root_after_consumption"
      && manifest.safety.rollbackPolicy === "preserve_source_package"
      && manifest.safety.taskOwnedPathsVerified === true
      && manifest.validation.adapterNeutralValidated === true
      && manifest.validation.packageReinsertionValidated === false
      && manifest.validation.actualAeRenderExecuted === manifest.execution.actualAeRenderExecuted
      && manifest.validation.runtimeProved === false
      && manifest.validation.installedQaAccepted === false
      && manifest.validation.productOwnerAccepted === false
      && manifest.validation.finalEncoderValidationRequired === true
      && manifest.futureAdapters.svga === "awaiting_package_reinsertion"
      && manifest.futureAdapters.vap === "not_implemented"
      && manifest.futureAdapters.lottie === "not_implemented"
      && manifest.futureAdapters.pag === "not_implemented";
  } catch {
    return false;
  }
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isNormalizedRelativePngPath(value: string): boolean {
  const segments = typeof value === "string" ? value.split("/") : [];
  return typeof value === "string"
    && value !== ""
    && !value.includes("\\")
    && !value.startsWith("/")
    && !value.startsWith("../")
    && segments.every((segment) => segment !== "" && segment !== "." && segment !== "..")
    && value.toLowerCase().endsWith(".png");
}

export async function createSyntheticAebBakeExecutionReceipt(
  input: {
    job: AebBakeJob;
    frames: readonly AebBakeFrameSource[];
    fixtureId: string;
  },
  hasher: EmbeddedResourceHasher
): Promise<AebBakeExecutionReceipt> {
  validateJob(input.job);
  const frames = validateFrameInventory(input.job, input.frames);
  if (!isIdentifier(input.fixtureId)) {
    fail("EXECUTION_RECEIPT_INVALID", "Synthetic execution fixture ID is invalid.");
  }
  const receiptWithoutHash: Omit<AebBakeExecutionReceipt, "receiptHash"> = {
    schemaVersion: "aeb-bake-execution-receipt-v1",
    mode: "synthetic_fixture",
    jobId: input.job.jobId,
    taskId: input.job.task.taskId,
    taskReceiptId: input.job.task.receiptId,
    sourceFingerprint: input.job.source.sourceFingerprint,
    scanDigest: input.job.source.scanDigest,
    plannerDigest: input.job.source.plannerDigest,
    frameInventoryDigest: await frameInventoryDigest(frames, hasher),
    actualAeRenderExecuted: false,
    evidence: { kind: "synthetic_fixture", fixtureId: input.fixtureId }
  };
  return {
    ...receiptWithoutHash,
    receiptHash: await hashCanonical(hasher, receiptWithoutHash)
  };
}

function validateJob(job: AebBakeJob): void {
  if (!isRecord(job)
    || !isRecord(job.source)
    || !isRecord(job.target)
    || !Array.isArray(job.target.layerIds)
    || !Array.isArray(job.target.replaceableElementIds)
    || !isRecord(job.timeRange)
    || !isRecord(job.canvas)
    || !isRecord(job.bbox)
    || !isRecord(job.budgets)
    || !isRecord(job.task)
    || !isRecord(job.safety)) {
    fail("JOB_INVALID", "AEB Bake job is malformed.");
  }
  if (job.schemaVersion !== AEB_BAKE_JOB_SCHEMA_VERSION) {
    fail("JOB_SCHEMA_UNSUPPORTED", "Unsupported AEB Bake job schema.");
  }
  for (const [name, value] of Object.entries({
    jobId: job.jobId,
    packageId: job.packageId,
    compositionId: job.source.compositionId,
    targetSourceId: job.target.sourceId,
    receiptId: job.task.receiptId
  })) {
    if (!isIdentifier(value)) {
      fail("JOB_INVALID", `AEB Bake job ${name} is invalid.`);
    }
  }
  if (!isTaskId(job.task.taskId)
    || (job.target.kind !== "layer" && job.target.kind !== "precomp")
    || job.alphaMode !== "straight") {
    fail("JOB_INVALID", "AEB Bake job enum or task identity is invalid.");
  }
  for (const [name, value] of Object.entries({
    sourceFingerprint: job.source.sourceFingerprint,
    scanDigest: job.source.scanDigest,
    plannerDigest: job.source.plannerDigest
  })) {
    if (!isSha256(value)) {
      fail("JOB_INVALID", `AEB Bake job ${name} must be a SHA-256 digest.`);
    }
  }
  if (job.target.layerIds.length === 0 || new Set(job.target.layerIds).size !== job.target.layerIds.length) {
    fail("JOB_INVALID", "AEB Bake target layer IDs must be non-empty and unique.");
  }
  if (job.target.layerIds.some((layerId) => !isIdentifier(layerId))) {
    fail("JOB_INVALID", "AEB Bake target layer ID is invalid.");
  }
  if (job.target.replaceableElementIds.length > 0) {
    fail(
      "REPLACEABLE_ELEMENT_LOSS",
      "This bounded Bake slice cannot rasterize a target containing replaceable elements."
    );
  }
  if (!isPositiveInteger(job.canvas.width)
    || !isPositiveInteger(job.canvas.height)
    || job.canvas.width > MAX_BAKE_CANVAS_DIMENSION
    || job.canvas.height > MAX_BAKE_CANVAS_DIMENSION) {
    fail("JOB_INVALID", "AEB Bake canvas dimensions exceed the bounded contract.");
  }
  if (!Number.isFinite(job.fps) || job.fps <= 0 || job.fps > 240) {
    fail("JOB_INVALID", "AEB Bake FPS must be greater than zero and no more than 240.");
  }
  if (!Number.isInteger(job.timeRange.startFrame)
    || !Number.isInteger(job.timeRange.endFrameExclusive)
    || job.timeRange.endFrameExclusive <= job.timeRange.startFrame) {
    fail("JOB_INVALID", "AEB Bake time range must be a non-empty half-open frame interval.");
  }
  validateBbox(job);
  if (!areBudgetsWithinHardLimits(job.budgets)) {
    fail("JOB_INVALID", "AEB Bake budgets exceed the bounded contract.");
  }
  if (job.canvas.width * job.canvas.height * 4 > job.budgets.maxDecodedRgbaBytes) {
    fail("DECODED_BUDGET_EXCEEDED", "AEB Bake decoded budget cannot hold one RGBA canvas frame.");
  }
  const frameCount = job.timeRange.endFrameExclusive - job.timeRange.startFrame;
  if (frameCount > job.budgets.maxFrames) {
    fail("FRAME_BUDGET_EXCEEDED", "AEB Bake time range exceeds the frame budget.");
  }
  if (job.safety.sourceProjectMutationAllowed !== false
    || job.safety.replaceablePolicy !== "preserve"
    || job.safety.cleanupRequired !== true
    || job.safety.rollbackReceiptRequired !== true) {
    fail("SOURCE_SAFETY_INVALID", "AEB Bake source, cleanup, rollback, and replaceable safety is mandatory.");
  }
}

function validateBbox(job: AebBakeJob): void {
  const { x, y, width, height } = job.bbox;
  if ((job.bbox.mode !== "full_canvas" && job.bbox.mode !== "tight")
    || ![x, y, width, height].every(Number.isInteger)
    || x < 0 || y < 0 || width <= 0 || height <= 0
    || x + width > job.canvas.width || y + height > job.canvas.height) {
    fail("JOB_INVALID", "AEB Bake bounding box must fit inside the canvas.");
  }
  if (job.bbox.mode === "full_canvas"
    && (x !== 0 || y !== 0 || width !== job.canvas.width || height !== job.canvas.height)) {
    fail("JOB_INVALID", "Full-canvas Bake bounding box must match the canvas.");
  }
}

function validatePlannerJoin(job: AebBakeJob, planner: AebBakePlannerJoin): void {
  if (!isRecord(planner)
    || !Array.isArray(planner.decisions)
    || planner.decisions.some((decision) => !isRecord(decision))) {
    fail("PLANNER_INVALID", "AEB Bake planner join is malformed.");
  }
  if (planner.schemaVersion !== AEB_BAKE_PLANNER_JOIN_SCHEMA_VERSION) {
    fail("PLANNER_SCHEMA_UNSUPPORTED", "Unsupported AEB Bake planner join schema.");
  }
  if (planner.jobId !== job.jobId
    || planner.sourceFingerprint !== job.source.sourceFingerprint
    || planner.scanDigest !== job.source.scanDigest
    || planner.plannerDigest !== job.source.plannerDigest) {
    fail("PLANNER_BINDING_MISMATCH", "AEB Bake planner join does not bind to the requested source and scan.");
  }
  const layerIds = planner.decisions.map((decision) => decision.layerId);
  if (layerIds.length === 0 || new Set(layerIds).size !== layerIds.length) {
    fail("PLANNER_INVALID", "AEB Bake planner decisions must be non-empty and unique by layer.");
  }
  if (planner.decisions.some((decision) =>
    !isIdentifier(decision.layerId)
    || !["native", "bake_required", "blocked"].includes(decision.outcome)
    || typeof decision.reason !== "string"
    || decision.reason.trim() === ""
  )) {
    fail("PLANNER_INVALID", "AEB Bake planner decision is malformed.");
  }
  const blocked = planner.decisions.filter((decision) => decision.outcome === "blocked");
  if (blocked.length > 0) {
    fail("PLANNER_BLOCKED", `AEB Bake planner contains blocked layers: ${blocked.map((item) => item.layerId).join(", ")}.`);
  }
  for (const targetLayerId of job.target.layerIds) {
    if (planner.decisions.find((decision) => decision.layerId === targetLayerId)?.outcome !== "bake_required") {
      fail("PLANNER_TARGET_MISMATCH", `AEB Bake target ${targetLayerId} is not classified bake_required.`);
    }
  }
  const targetLayerIds = [...job.target.layerIds].sort(compareCodeUnits);
  const bakeRequiredLayerIds = planner.decisions
    .filter((decision) => decision.outcome === "bake_required")
    .map((decision) => decision.layerId)
    .sort(compareCodeUnits);
  if (!sameStringArray(targetLayerIds, bakeRequiredLayerIds)) {
    fail(
      "PLANNER_JOB_SCOPE_MISMATCH",
      "AEB Bake job targets must exactly match the planner bake_required decisions."
    );
  }
}

function validateTaskReceipt(job: AebBakeJob, receipt: AebBakeTaskReceipt): void {
  if (!isRecord(receipt)) {
    fail("TASK_RECEIPT_MALFORMED", "AEB Bake task receipt is malformed.");
  }
  if (receipt.schemaVersion !== AEB_BAKE_TASK_RECEIPT_SCHEMA_VERSION) {
    fail("TASK_RECEIPT_SCHEMA_UNSUPPORTED", "Unsupported AEB Bake task receipt schema.");
  }
  if (receipt.taskId !== job.task.taskId
    || receipt.receiptId !== job.task.receiptId
    || receipt.jobId !== job.jobId
    || receipt.packageId !== job.packageId
    || receipt.sourceFingerprint !== job.source.sourceFingerprint) {
    fail("TASK_RECEIPT_BINDING_MISMATCH", "AEB Bake task receipt is stale or bound to another job.");
  }
  if (receipt.outputDirectory !== "."
    || receipt.cleanupPolicy !== "delete_task_root_after_consumption"
    || receipt.rollbackPolicy !== "preserve_source_package"
    || receipt.sourceProjectMutationAllowed !== false
    || (receipt.producer !== "synthetic_fixture" && receipt.producer !== "after_effects")) {
    fail("TASK_RECEIPT_SAFETY_INVALID", "AEB Bake task receipt does not preserve path, cleanup, rollback, and source safety.");
  }
}

async function validateExecutionReceipt(
  input: BuildAebBakeManifestInput,
  frames: readonly AebBakeFrameSource[]
): Promise<void> {
  const receipt = input.executionReceipt;
  if (!isRecord(receipt)
    || !isRecord(receipt.evidence)
    || receipt.schemaVersion !== "aeb-bake-execution-receipt-v1"
    || !isSha256(receipt.receiptHash)
    || receipt.jobId !== input.job.jobId
    || receipt.taskId !== input.job.task.taskId
    || receipt.taskReceiptId !== input.job.task.receiptId
    || receipt.sourceFingerprint !== input.job.source.sourceFingerprint
    || receipt.scanDigest !== input.job.source.scanDigest
    || receipt.plannerDigest !== input.job.source.plannerDigest
    || receipt.frameInventoryDigest !== await frameInventoryDigest(frames, input.hasher)
    || receipt.mode !== input.taskReceipt.producer) {
    fail("EXECUTION_RECEIPT_INVALID", "AEB Bake execution receipt is malformed or bound to another job.");
  }
  const { receiptHash, ...receiptWithoutHash } = receipt;
  if (receiptHash !== await hashCanonical(input.hasher, receiptWithoutHash)) {
    fail("EXECUTION_RECEIPT_INTEGRITY_INVALID", "AEB Bake execution receipt hash binding is invalid.");
  }
  if (receipt.mode === "synthetic_fixture") {
    if (receipt.actualAeRenderExecuted !== false
      || receipt.evidence.kind !== "synthetic_fixture"
      || !isIdentifier(receipt.evidence.fixtureId)) {
      fail("EXECUTION_RECEIPT_INVALID", "Synthetic Bake execution receipt cannot claim real AE render execution.");
    }
    return;
  }
  if (receipt.mode !== "after_effects"
    || receipt.actualAeRenderExecuted !== true
    || receipt.evidence.kind !== "after_effects"
    || !isIdentifier(receipt.evidence.hostSessionId)
    || typeof receipt.evidence.aeVersion !== "string"
    || receipt.evidence.aeVersion.trim() === ""
    || !isSha256(receipt.evidence.scriptDigest)
    || !isSha256(receipt.evidence.renderReceiptDigest)) {
    fail("EXECUTION_RECEIPT_INVALID", "After Effects Bake execution receipt is malformed.");
  }
  if (!input.executionAuthority
    || !await input.executionAuthority.verifyExecution({
      job: input.job,
      planner: input.planner,
      taskReceipt: input.taskReceipt,
      frames,
      executionReceipt: receipt,
      hasher: input.hasher
    })) {
    fail(
      "AE_EXECUTION_AUTHORITY_REQUIRED",
      "After Effects execution claims require current task-owned producer authority."
    );
  }
}

function validateFrameInventory(job: AebBakeJob, frames: readonly AebBakeFrameSource[]): AebBakeFrameSource[] {
  if (!Array.isArray(frames) || frames.some((frame) => !isRecord(frame))) {
    fail("FRAME_INVENTORY_INVALID", "AEB Bake frame inventory is malformed.");
  }
  const expectedCount = job.timeRange.endFrameExclusive - job.timeRange.startFrame;
  if (frames.length !== expectedCount) {
    fail("FRAME_INVENTORY_INCOMPLETE", "AEB Bake frame inventory does not cover the requested time range.");
  }
  const sorted = [...frames].sort((left, right) => left.frameIndex - right.frameIndex);
  if (new Set(sorted.map((frame) => frame.relativePath)).size !== sorted.length) {
    fail("FRAME_INVENTORY_INVALID", "AEB Bake frame inventory contains duplicate resource paths.");
  }
  sorted.forEach((frame, offset) => {
    if (frame.frameIndex !== job.timeRange.startFrame + offset || frame.relativePath.trim() === "") {
      fail("FRAME_INVENTORY_INCOMPLETE", "AEB Bake frame inventory must be contiguous and ordered by frame index.");
    }
  });
  return sorted;
}

async function hashCanonical(hasher: EmbeddedResourceHasher, value: unknown): Promise<string> {
  return requireSha256(await hasher.hash(new TextEncoder().encode(canonicalJson(value)))).value;
}

async function frameInventoryDigest(
  frames: readonly AebBakeFrameSource[],
  hasher: EmbeddedResourceHasher
): Promise<string> {
  return hashCanonical(hasher, frames
    .map((frame) => ({ frameIndex: frame.frameIndex, relativePath: frame.relativePath }))
    .sort((left, right) => left.frameIndex - right.frameIndex));
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => compareCodeUnits(left, right))
        .map(([key, child]) => [key, sortValue(child)])
    );
  }
  return value;
}

function requireSha256(hash: ResourceContentHash): AebBakeManifestFrame["contentHash"] {
  if (hash.algorithm !== "sha256" || hash.scope !== "encoded_bytes" || !isSha256(hash.value)) {
    fail("HASHER_CONTRACT_INVALID", "AEB Bake resources require encoded-byte SHA-256 hashes.");
  }
  return { algorithm: "sha256", value: hash.value, scope: "encoded_bytes" };
}

function assertBudget(actual: number, maximum: number, code: string): void {
  if (actual > maximum) {
    fail(code, `AEB Bake budget exceeded: ${actual} > ${maximum}.`);
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isTaskId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);
}

function areBudgetsWithinHardLimits(budgets: AebBakeJob["budgets"]): boolean {
  return isPositiveInteger(budgets.maxFrames)
    && budgets.maxFrames <= MAX_BAKE_FRAMES
    && isPositiveInteger(budgets.maxEncodedBytes)
    && budgets.maxEncodedBytes <= MAX_BAKE_ENCODED_BYTES
    && isPositiveInteger(budgets.maxDecodedRgbaBytes)
    && budgets.maxDecodedRgbaBytes <= MAX_BAKE_DECODED_RGBA_BYTES
    && isPositiveInteger(budgets.maxPackageBytes)
    && budgets.maxPackageBytes <= MAX_BAKE_PACKAGE_BYTES;
}

function isBboxValid(job: Pick<AebBakeJob, "bbox" | "canvas">): boolean {
  const { x, y, width, height } = job.bbox;
  return (job.bbox.mode === "full_canvas" || job.bbox.mode === "tight")
    && [x, y, width, height].every(Number.isInteger)
    && x >= 0
    && y >= 0
    && width > 0
    && height > 0
    && x + width <= job.canvas.width
    && y + height <= job.canvas.height
    && (job.bbox.mode !== "full_canvas"
      || (x === 0 && y === 0 && width === job.canvas.width && height === job.canvas.height));
}

function isAlphaBoundsValid(
  bounds: AebBakeManifestFrame["alphaBounds"],
  width: number,
  height: number
): boolean {
  if (!isRecord(bounds)) return false;
  if (bounds.status === "fully_transparent") return true;
  return bounds.status === "known"
    && Number.isInteger(bounds.x)
    && Number.isInteger(bounds.y)
    && Number.isInteger(bounds.width)
    && Number.isInteger(bounds.height)
    && Number(bounds.x) >= 0
    && Number(bounds.y) >= 0
    && Number(bounds.width) > 0
    && Number(bounds.height) > 0
    && Number(bounds.x) + Number(bounds.width) <= width
    && Number(bounds.y) + Number(bounds.height) <= height;
}

function isSorted(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || compareCodeUnits(values[index - 1], value) < 0);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(code: string, message: string): never {
  throw new AebBakePipelineError(code, message);
}
