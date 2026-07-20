import type { EmbeddedResourceHasher } from "./resource-hasher.js";
import type {
  AebBakeFrameSource,
  AebBakeJob,
  AebBakePlannerJoin,
  AebBakeTaskReceipt
} from "./aeb-bake-contracts.js";
import { AebBakePipelineError } from "./aeb-bake-pipeline.js";

export const AEB_AE_BAKE_EXECUTION_PLAN_SCHEMA_VERSION = "aeb-ae-bake-execution-plan-v2" as const;
export const AEB_AE_BAKE_PRODUCER_RECEIPT_SCHEMA_VERSION = "aeb-ae-bake-producer-receipt-v3" as const;
export const AEB_AE_BAKE_CLEANUP_RECEIPT_SCHEMA_VERSION = "aeb-ae-bake-cleanup-receipt-v1" as const;
export const AEB_AE_CONTROLLED_SCAN_OUTPUT_SCHEMA_VERSION = "aeb-ae-controlled-comp-scan-output-v2" as const;
export const AEB_AE_CONTROLLED_SCAN_RECEIPT_SCHEMA_VERSION = "aeb-ae-controlled-comp-scan-receipt-v2" as const;
export const AEB_AE_SCRATCH_PROJECT_BINDING_SCHEMA_VERSION = "aeb-ae-scratch-project-binding-v1" as const;
export const AEB_AE_RETAINED_TRANSACTION_RECEIPT_SCHEMA_VERSION = "aeb-ae-retained-transaction-receipt-v1" as const;

const MAX_AE_EXECUTION_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_AE_SOURCE_PROJECT_BYTES = 128 * 1024 * 1024;

export interface AebAeBakeHostDescriptor {
  applicationId: "com.adobe.AfterEffects.application";
  version: string;
  build: string;
  executableHash: string;
  scriptExecutableHash: string;
  producerSourceHash: string;
}

export interface AebAeTargetLayerBinding {
  layerId: string;
  aeLayerId: string;
  name: string;
}

export interface AebAeControlledFeatures {
  twoDOnly: true;
  precompDepth: 1;
  effectMatchNames: readonly string[];
  maskModes: readonly ["add", ..."add"[]];
  expressionCount: number;
  expressionSampling: "ae_rasterized";
  audio: false;
  threeD: false;
  camera: false;
  thirdPartyPlugins: false;
  unknownHostCapabilities: false;
}

export interface AebAeScratchProjectBinding {
  schemaVersion: typeof AEB_AE_SCRATCH_PROJECT_BINDING_SCHEMA_VERSION;
  taskId: string;
  taskRootName: string;
  relativePath: string;
  pathDigest: string;
  contentHash: string;
  encodedBytes: number;
  identity: {
    device: string;
    inode: string;
    linkCount: 1;
    modifiedNs: string;
    changedNs: string;
    taskRootDevice: string;
    taskRootInode: string;
    parentDevice: string;
    parentInode: string;
    parentModifiedNs: string;
    parentChangedNs: string;
  };
}

export interface AebAeBakeExecutionPlan {
  schemaVersion: typeof AEB_AE_BAKE_EXECUTION_PLAN_SCHEMA_VERSION;
  executionId: string;
  planHash: string;
  job: AebBakeJob;
  planner: AebBakePlannerJoin;
  taskReceipt: AebBakeTaskReceipt;
  taskRootName: string;
  sourceFiles: {
    projectRelativePath: string;
    projectContentHash: string;
    projectMaxBytes: number;
    packageRelativePath: string;
    packageContentHash: string;
    packageMaxBytes: number;
  };
  composition: {
    id: string;
    name: string;
    targetLayers: readonly AebAeTargetLayerBinding[];
  };
  controlledFeatures: AebAeControlledFeatures;
  host: AebAeBakeHostDescriptor;
  render: {
    renderSettingsTemplate: string;
    outputModuleTemplate: string;
    alphaMode: "straight";
    timeoutMs: number;
  };
  output: {
    workDirectory: string;
    framesDirectory: string;
    frames: readonly AebBakeFrameSource[];
  };
}

export interface AebAeControlledScanOutput {
  schemaVersion: typeof AEB_AE_CONTROLLED_SCAN_OUTPUT_SCHEMA_VERSION;
  executionId: string;
  planHash: string;
  producerSourceHash: string;
  host: Pick<AebAeBakeHostDescriptor, "applicationId" | "version" | "build">;
  composition: Pick<AebAeBakeExecutionPlan["composition"], "id" | "name">;
  targetLayers: readonly AebAeTargetLayerBinding[];
  controlledFeatures: AebAeControlledFeatures;
  scratchProjectBefore: AebAeScratchProjectBinding;
  renderQueueIndex: number;
  temporaryRenderItemsCreated: 1;
}

export interface AebAeControlledScanReceipt extends Omit<AebAeControlledScanOutput, "schemaVersion"> {
  schemaVersion: typeof AEB_AE_CONTROLLED_SCAN_RECEIPT_SCHEMA_VERSION;
  scratchProjectAfter: AebAeScratchProjectBinding;
  requestDigest: string;
  resultDigest: string;
  receiptHash: string;
}

export interface AebAeRetainedTransactionReceipt {
  schemaVersion: typeof AEB_AE_RETAINED_TRANSACTION_RECEIPT_SCHEMA_VERSION;
  taskId: string;
  executionId: string;
  planHash: string;
  runtimePlanHash: string;
  jobId: string;
  packageId: string;
  sourceFingerprint: string;
  scanDigest: string;
  plannerDigest: string;
  source: {
    projectContentHash: string;
    packageContentHash: string;
  };
  timing: {
    startFrame: number;
    endFrameExclusive: number;
    fps: number;
  };
  canvas: { width: number; height: number };
  alphaMode: "straight";
  process: {
    pid: number;
    startIdentity: string;
    executableHash: string;
  };
  checkpoint: {
    relativePath: string;
    contentHash: string;
    encodedBytes: number;
    identityDigest: string;
  };
  approvalHash: string;
  resultHash: string;
  composition: {
    productId: string;
    retainedId: string;
    name: string;
  };
  targetLayers: readonly AebAeTargetLayerBinding[];
  controlledFeatures: AebAeControlledFeatures;
  renderQueue: {
    itemId: string;
    rqindex: number;
    renderStatus: "done";
  };
  output: {
    frames: readonly {
      frameIndex: number;
      relativePath: string;
      contentHash: string;
      encodedBytes: number;
      decodedRgbaBytes: number;
      width: number;
      height: number;
      alpha: "mixed";
    }[];
  };
  cleanup: {
    renderQueueItemRemoved: true;
    temporaryItemsRemoved: true;
    projectClosedWithoutSave: true;
    appOpenCountAfterCheckpoint: 0;
    approvalConsumedOnce: true;
    processClosedNormally: true;
    processGroupAbsenceProven: true;
    runRootRemoved: true;
    unexpectedResidue: [];
  };
  receiptHash: string;
}

export interface AebAeSplitHostExecutionEvidence {
  kind: "split_scanner_renderer";
  scanner: {
    executableHash: string;
    producerSourceHash: string;
    requestDigest: string;
    resultDigest: string;
    scratchProjectBeforeDigest: string;
    scratchProjectAfterDigest: string;
    exitCode: 0;
  };
  renderer: {
    executableHash: string;
    scanReceiptHash: string;
    scratchProjectDigest: string;
    renderContractDigest: string;
    exitCode: 0;
  };
}

export interface AebAeRetainedHostExecutionEvidence {
  kind: "retained_ae_transaction";
  executableHash: string;
  producerSourceHash: string;
  runtimePlanHash: string;
  approvalHash: string;
  resultHash: string;
  transactionReceiptHash: string;
  processStartIdentity: string;
  checkpointIdentityDigest: string;
  frameInventoryDigest: string;
  processClosedNormally: true;
  processGroupAbsenceProven: true;
  runRootRemoved: true;
}

export type AebAeHostExecutionEvidence =
  | AebAeSplitHostExecutionEvidence
  | AebAeRetainedHostExecutionEvidence;

export interface AebAeBakeProgressEvent {
  phase: "prepared" | "rendering" | "canonicalizing" | "finalizing" | "completed";
  completedFrames: number;
  totalFrames: number;
}

export interface AebAeBakeHostRenderRequest {
  plan: AebAeBakeExecutionPlan;
  taskRootPath: string;
  scratchProjectPath: string;
  scratchProjectRelativePath: string;
  rawOutputDirectory: string;
  rawFrameFileNames: readonly string[];
  signal: AbortSignal;
  onProgress(event: AebAeBakeProgressEvent): void;
}

export interface AebAeBakeHostResult {
  host: AebAeBakeHostDescriptor;
  processStarted: true;
  completed: true;
  exitCode: 0;
  cancelled: false;
  timedOut: false;
  temporaryRenderItemsConfinedToScratch: true;
  scanReceipt: AebAeControlledScanReceipt | AebAeRetainedTransactionReceipt;
  executionEvidence: AebAeHostExecutionEvidence;
}

export interface AebAeBakeHostAdapter {
  readonly descriptor: AebAeBakeHostDescriptor;
  render(request: AebAeBakeHostRenderRequest): Promise<AebAeBakeHostResult>;
}

export interface AebAeBakeCleanupReceipt {
  schemaVersion: typeof AEB_AE_BAKE_CLEANUP_RECEIPT_SCHEMA_VERSION;
  executionId: string;
  taskId: string;
  jobId: string;
  planHash: string;
  outcome: "success" | "rollback";
  phase: "write" | "render" | "canonicalize" | "finalize" | "cleanup";
  workDirectory: string;
  framesDirectory: string;
  workDirectoryRemoved: true;
  partialFramesRemoved: boolean;
  planRemoved: boolean;
  temporaryRenderItemsRemoved: boolean;
  sourceProjectUnchanged: true;
  sourcePackageUnchanged: true;
  receiptHash: string;
}

export interface AebAeBakeProducerReceipt {
  schemaVersion: typeof AEB_AE_BAKE_PRODUCER_RECEIPT_SCHEMA_VERSION;
  executionId: string;
  planHash: string;
  jobId: string;
  packageId: string;
  sourceFingerprint: string;
  scanDigest: string;
  plannerDigest: string;
  taskId: string;
  taskReceiptId: string;
  target: {
    compositionId: string;
    compositionName: string;
    sourceId: string;
    layerIds: readonly string[];
  };
  timing: {
    startFrame: number;
    endFrameExclusive: number;
    fps: number;
  };
  canvas: AebBakeJob["canvas"];
  alphaMode: "straight";
  host: AebAeBakeHostDescriptor;
  scanReceipt: AebAeControlledScanReceipt | AebAeRetainedTransactionReceipt;
  hostExecution: AebAeHostExecutionEvidence;
  source: {
    project: AebAeBakeSourceFileReceipt;
    package: AebAeBakeSourceFileReceipt;
  };
  output: {
    frames: readonly AebAeBakeProducerFrameReceipt[];
    totalEncodedBytes: number;
    totalDecodedRgbaBytes: number;
  };
  execution: {
    state: "completed";
    processStarted: true;
    hostCompleted: true;
    exitCode: 0;
    cancelled: false;
    timedOut: false;
    progressDigest: string;
  };
  cleanupReceiptHash: string;
  receiptHash: string;
}

export interface AebAeBakeSourceFileReceipt {
  relativePath: string;
  contentHash: string;
  preIdentityDigest: string;
  postIdentityDigest: string;
  unchanged: true;
}

export interface AebAeBakeProducerFrameReceipt {
  frameIndex: number;
  relativePath: string;
  contentHash: string;
  encodedBytes: number;
  decodedRgbaBytes: number;
  width: number;
  height: number;
}

export interface CreateAebAeBakeExecutionPlanInput extends Omit<AebAeBakeExecutionPlan, "schemaVersion" | "planHash" | "output"> {
  output?: never;
}

export async function createAebAeBakeExecutionPlan(
  input: CreateAebAeBakeExecutionPlanInput,
  hasher: EmbeddedResourceHasher
): Promise<AebAeBakeExecutionPlan> {
  const frames = expectedFrameSources(input.job, input.executionId);
  const withoutHash: Omit<AebAeBakeExecutionPlan, "planHash"> = {
    ...input,
    schemaVersion: AEB_AE_BAKE_EXECUTION_PLAN_SCHEMA_VERSION,
    output: {
      workDirectory: `aeb-ae-work-${input.executionId}`,
      framesDirectory: `aeb-ae-frames-${input.executionId}`,
      frames
    }
  };
  const plan = { ...withoutHash, planHash: await hashCanonical(hasher, withoutHash) };
  if (!await verifyAebAeBakeExecutionPlan(plan, hasher)) {
    fail("AE_EXECUTION_PLAN_INVALID", "AEB AE Bake execution plan is outside the bounded product contract.");
  }
  return plan;
}

export async function verifyAebAeBakeExecutionPlan(
  plan: AebAeBakeExecutionPlan,
  hasher: EmbeddedResourceHasher
): Promise<boolean> {
  try {
    if (!isRecord(plan)
      || !isRecord(plan.job)
      || !isRecord(plan.planner)
      || !isRecord(plan.taskReceipt)
      || !isRecord(plan.sourceFiles)
      || !isRecord(plan.composition)
      || !isRecord(plan.controlledFeatures)
      || !isRecord(plan.host)
      || !isRecord(plan.render)
      || !isRecord(plan.output)
      || !Array.isArray(plan.output.frames)
      || !isBoundedJobAndPlanner(plan)
      || plan.schemaVersion !== AEB_AE_BAKE_EXECUTION_PLAN_SCHEMA_VERSION
      || !isFileIdentifier(plan.executionId)
      || !isSha256(plan.planHash)
      || !isIdentifier(plan.composition.id)
      || !isNonEmptyString(plan.composition.name)
      || !Array.isArray(plan.composition.targetLayers)
      || plan.composition.targetLayers.length !== plan.job.target.layerIds.length
      || new Set(plan.composition.targetLayers.map((item) => item.layerId)).size !== plan.composition.targetLayers.length
      || new Set(plan.composition.targetLayers.map((item) => item.aeLayerId)).size !== plan.composition.targetLayers.length
      || plan.composition.targetLayers.some((item) => !isRecord(item)
        || !isIdentifier(item.layerId)
        || !isIdentifier(item.aeLayerId)
        || !isNonEmptyString(item.name))
      || !sameStringArray(
        plan.composition.targetLayers.map((item) => item.layerId).sort(compareCodeUnits),
        [...plan.job.target.layerIds].sort(compareCodeUnits)
      )
      || plan.taskRootName !== plan.job.task.taskId
      || plan.taskReceipt.producer !== "after_effects"
      || plan.taskReceipt.taskId !== plan.job.task.taskId
      || plan.taskReceipt.receiptId !== plan.job.task.receiptId
      || plan.taskReceipt.jobId !== plan.job.jobId
      || plan.taskReceipt.packageId !== plan.job.packageId
      || plan.taskReceipt.sourceFingerprint !== plan.job.source.sourceFingerprint
      || plan.planner.jobId !== plan.job.jobId
      || plan.planner.sourceFingerprint !== plan.job.source.sourceFingerprint
      || plan.planner.scanDigest !== plan.job.source.scanDigest
      || plan.planner.plannerDigest !== plan.job.source.plannerDigest
      || !sameStringArray(
        [...plan.job.target.layerIds].sort(compareCodeUnits),
        plan.planner.decisions.filter((item) => item.outcome === "bake_required").map((item) => item.layerId).sort(compareCodeUnits)
      )
      || plan.planner.decisions.some((item) => item.outcome === "blocked")
      || plan.job.target.replaceableElementIds.length !== 0
      || !isRelativePath(plan.sourceFiles.projectRelativePath)
      || !isRelativePath(plan.sourceFiles.packageRelativePath)
      || plan.sourceFiles.projectRelativePath === plan.sourceFiles.packageRelativePath
      || !isSha256(plan.sourceFiles.projectContentHash)
      || !isSha256(plan.sourceFiles.packageContentHash)
      || plan.sourceFiles.projectContentHash !== plan.job.source.sourceFingerprint
      || !isPositiveInteger(plan.sourceFiles.projectMaxBytes)
      || plan.sourceFiles.projectMaxBytes > MAX_AE_SOURCE_PROJECT_BYTES
      || !isPositiveInteger(plan.sourceFiles.packageMaxBytes)
      || plan.sourceFiles.packageMaxBytes > plan.job.budgets.maxPackageBytes
      || plan.sourceFiles.packageMaxBytes + plan.job.budgets.maxEncodedBytes > plan.job.budgets.maxPackageBytes
      || plan.controlledFeatures.twoDOnly !== true
      || plan.controlledFeatures.precompDepth !== 1
      || !Array.isArray(plan.controlledFeatures.effectMatchNames)
      || plan.controlledFeatures.effectMatchNames.length === 0
      || plan.controlledFeatures.effectMatchNames.some((value) => !/^ADBE [A-Za-z0-9 ._-]+$/.test(value))
      || !Array.isArray(plan.controlledFeatures.maskModes)
      || plan.controlledFeatures.maskModes.length === 0
      || plan.controlledFeatures.maskModes.some((value) => value !== "add")
      || !isPositiveInteger(plan.controlledFeatures.expressionCount)
      || plan.controlledFeatures.expressionSampling !== "ae_rasterized"
      || plan.controlledFeatures.audio !== false
      || plan.controlledFeatures.threeD !== false
      || plan.controlledFeatures.camera !== false
      || plan.controlledFeatures.thirdPartyPlugins !== false
      || plan.controlledFeatures.unknownHostCapabilities !== false
      || plan.host.applicationId !== "com.adobe.AfterEffects.application"
      || !isNonEmptyString(plan.host.version)
      || !isNonEmptyString(plan.host.build)
      || !isSha256(plan.host.executableHash)
      || !isSha256(plan.host.scriptExecutableHash)
      || !isSha256(plan.host.producerSourceHash)
      || plan.render.alphaMode !== "straight"
      || !isNonEmptyString(plan.render.renderSettingsTemplate)
      || !isNonEmptyString(plan.render.outputModuleTemplate)
      || !isPositiveInteger(plan.render.timeoutMs)
      || plan.render.timeoutMs > MAX_AE_EXECUTION_TIMEOUT_MS
      || plan.output.workDirectory !== `aeb-ae-work-${plan.executionId}`
      || plan.output.framesDirectory !== `aeb-ae-frames-${plan.executionId}`
      || !sameJson(plan.output.frames, expectedFrameSources(plan.job, plan.executionId))) return false;
    const { planHash, ...withoutHash } = plan;
    return planHash === await hashCanonical(hasher, withoutHash);
  } catch {
    return false;
  }
}

export async function createAebAeScratchProjectPathDigest(
  plan: AebAeBakeExecutionPlan,
  relativePath: string,
  hasher: EmbeddedResourceHasher
): Promise<string> {
  return hashCanonical(hasher, {
    schemaVersion: AEB_AE_SCRATCH_PROJECT_BINDING_SCHEMA_VERSION,
    executionId: plan.executionId,
    taskId: plan.job.task.taskId,
    taskRootName: plan.taskRootName,
    relativePath
  });
}

export async function verifyAebAeScratchProjectBinding(
  plan: AebAeBakeExecutionPlan,
  binding: AebAeScratchProjectBinding,
  hasher: EmbeddedResourceHasher,
  expectedInitialContent = false
): Promise<boolean> {
  try {
    const expectedRelativePath = `${plan.output.workDirectory}/scratch-project.aep`;
    return isRecord(binding)
      && isRecord(binding.identity)
      && binding.schemaVersion === AEB_AE_SCRATCH_PROJECT_BINDING_SCHEMA_VERSION
      && binding.taskId === plan.job.task.taskId
      && binding.taskRootName === plan.taskRootName
      && binding.relativePath === expectedRelativePath
      && binding.pathDigest === await createAebAeScratchProjectPathDigest(plan, expectedRelativePath, hasher)
      && isSha256(binding.contentHash)
      && (!expectedInitialContent || binding.contentHash === plan.sourceFiles.projectContentHash)
      && isPositiveInteger(binding.encodedBytes)
      && binding.encodedBytes <= plan.sourceFiles.projectMaxBytes
      && isUnsignedIntegerString(binding.identity.device)
      && isUnsignedIntegerString(binding.identity.inode)
      && binding.identity.linkCount === 1
      && isUnsignedIntegerString(binding.identity.modifiedNs)
      && isUnsignedIntegerString(binding.identity.changedNs)
      && isUnsignedIntegerString(binding.identity.taskRootDevice)
      && isUnsignedIntegerString(binding.identity.taskRootInode)
      && isUnsignedIntegerString(binding.identity.parentDevice)
      && isUnsignedIntegerString(binding.identity.parentInode)
      && isUnsignedIntegerString(binding.identity.parentModifiedNs)
      && isUnsignedIntegerString(binding.identity.parentChangedNs);
  } catch {
    return false;
  }
}

export function sameAebAeScratchProjectObject(
  before: AebAeScratchProjectBinding,
  after: AebAeScratchProjectBinding
): boolean {
  return before.taskId === after.taskId
    && before.taskRootName === after.taskRootName
    && before.relativePath === after.relativePath
    && before.pathDigest === after.pathDigest
    && before.identity.device === after.identity.device
    && before.identity.inode === after.identity.inode
    && before.identity.linkCount === 1
    && after.identity.linkCount === 1
    && before.identity.taskRootDevice === after.identity.taskRootDevice
    && before.identity.taskRootInode === after.identity.taskRootInode
    && before.identity.parentDevice === after.identity.parentDevice
    && before.identity.parentInode === after.identity.parentInode;
}

export function createAebAeScannerInvocationContract(
  plan: AebAeBakeExecutionPlan,
  scratchProjectBefore: AebAeScratchProjectBinding
) {
  return {
    schemaVersion: "aeb-ae-controlled-comp-scan-request-v2" as const,
    executionId: plan.executionId,
    planHash: plan.planHash,
    producerSourceHash: plan.host.producerSourceHash,
    host: {
      applicationId: plan.host.applicationId,
      version: plan.host.version,
      build: plan.host.build,
      scriptExecutableHash: plan.host.scriptExecutableHash
    },
    composition: {
      id: plan.composition.id,
      name: plan.composition.name,
      targetLayers: plan.composition.targetLayers.map((item) => ({ ...item }))
    },
    controlledFeatures: cloneControlledFeatures(plan.controlledFeatures),
    scratchProjectBefore: structuredClone(scratchProjectBefore)
  };
}

export function createAebAeRendererInvocationContract(
  plan: AebAeBakeExecutionPlan,
  scanReceipt: AebAeControlledScanReceipt
) {
  return {
    schemaVersion: "aeb-ae-render-invocation-v2" as const,
    executionId: plan.executionId,
    planHash: plan.planHash,
    executableHash: plan.host.executableHash,
    compositionId: plan.composition.id,
    scanReceiptHash: scanReceipt.receiptHash,
    scratchProjectAfter: structuredClone(scanReceipt.scratchProjectAfter),
    renderQueueIndex: scanReceipt.renderQueueIndex,
    startFrame: plan.job.timeRange.startFrame,
    endFrameExclusive: plan.job.timeRange.endFrameExclusive,
    renderSettingsTemplate: plan.render.renderSettingsTemplate,
    outputModuleTemplate: plan.render.outputModuleTemplate,
    alphaMode: plan.render.alphaMode,
    outputFileNames: plan.output.frames.map((frame) => frame.relativePath.split("/").at(-1))
  };
}

export async function createAebAeControlledScanReceipt(
  plan: AebAeBakeExecutionPlan,
  output: AebAeControlledScanOutput,
  scratchProjectAfter: AebAeScratchProjectBinding,
  hasher: EmbeddedResourceHasher
): Promise<AebAeControlledScanReceipt> {
  if (!await verifyAebAeBakeExecutionPlan(plan, hasher)
    || !isPositiveInteger(output.renderQueueIndex)
    || !await verifyAebAeScratchProjectBinding(plan, output.scratchProjectBefore, hasher, true)
    || !await verifyAebAeScratchProjectBinding(plan, scratchProjectAfter, hasher)
    || !sameAebAeScratchProjectObject(output.scratchProjectBefore, scratchProjectAfter)) {
    fail("AE_CONTROLLED_SCAN_INVALID", "AEB AE controlled scan output is outside the execution plan.");
  }
  const expected: AebAeControlledScanOutput = {
    schemaVersion: AEB_AE_CONTROLLED_SCAN_OUTPUT_SCHEMA_VERSION,
    executionId: plan.executionId,
    planHash: plan.planHash,
    producerSourceHash: plan.host.producerSourceHash,
    host: {
      applicationId: plan.host.applicationId,
      version: plan.host.version,
      build: plan.host.build
    },
    composition: { id: plan.composition.id, name: plan.composition.name },
    targetLayers: plan.composition.targetLayers.map((item) => ({ ...item })),
    controlledFeatures: cloneControlledFeatures(plan.controlledFeatures),
    scratchProjectBefore: structuredClone(output.scratchProjectBefore),
    renderQueueIndex: output.renderQueueIndex,
    temporaryRenderItemsCreated: 1
  };
  if (!sameJson(output, expected)) {
    fail("AE_CONTROLLED_SCAN_INVALID", "AEB AE controlled scan result contradicts the approved composition or feature inventory.");
  }
  const receiptWithoutHash: Omit<AebAeControlledScanReceipt, "receiptHash"> = {
    ...expected,
    schemaVersion: AEB_AE_CONTROLLED_SCAN_RECEIPT_SCHEMA_VERSION,
    scratchProjectAfter: structuredClone(scratchProjectAfter),
    requestDigest: await hashCanonical(hasher, createAebAeScannerInvocationContract(plan, output.scratchProjectBefore)),
    resultDigest: await hashCanonical(hasher, expected)
  };
  return { ...receiptWithoutHash, receiptHash: await hashCanonical(hasher, receiptWithoutHash) };
}

export async function verifyAebAeControlledScanReceipt(
  plan: AebAeBakeExecutionPlan,
  receipt: AebAeControlledScanReceipt,
  hasher: EmbeddedResourceHasher
): Promise<boolean> {
  try {
    const output: AebAeControlledScanOutput = {
      schemaVersion: AEB_AE_CONTROLLED_SCAN_OUTPUT_SCHEMA_VERSION,
      executionId: receipt.executionId,
      planHash: receipt.planHash,
      producerSourceHash: receipt.producerSourceHash,
      host: receipt.host,
      composition: receipt.composition,
      targetLayers: receipt.targetLayers,
      controlledFeatures: receipt.controlledFeatures,
      scratchProjectBefore: receipt.scratchProjectBefore,
      renderQueueIndex: receipt.renderQueueIndex,
      temporaryRenderItemsCreated: receipt.temporaryRenderItemsCreated
    };
    const expected = await createAebAeControlledScanReceipt(plan, output, receipt.scratchProjectAfter, hasher);
    return sameJson(expected, receipt);
  } catch {
    return false;
  }
}

export async function createAebAeHostExecutionEvidence(
  plan: AebAeBakeExecutionPlan,
  scanReceipt: AebAeControlledScanReceipt,
  hasher: EmbeddedResourceHasher
): Promise<AebAeHostExecutionEvidence> {
  if (!await verifyAebAeControlledScanReceipt(plan, scanReceipt, hasher)) {
    fail("AE_CONTROLLED_SCAN_INVALID", "AEB AE host execution evidence requires a current controlled scan receipt.");
  }
  return {
    kind: "split_scanner_renderer",
    scanner: {
      executableHash: plan.host.scriptExecutableHash,
      producerSourceHash: plan.host.producerSourceHash,
      requestDigest: scanReceipt.requestDigest,
      resultDigest: scanReceipt.resultDigest,
      scratchProjectBeforeDigest: await hashCanonical(hasher, scanReceipt.scratchProjectBefore),
      scratchProjectAfterDigest: await hashCanonical(hasher, scanReceipt.scratchProjectAfter),
      exitCode: 0
    },
    renderer: {
      executableHash: plan.host.executableHash,
      scanReceiptHash: scanReceipt.receiptHash,
      scratchProjectDigest: await hashCanonical(hasher, scanReceipt.scratchProjectAfter),
      renderContractDigest: await hashCanonical(
        hasher,
        createAebAeRendererInvocationContract(plan, scanReceipt)
      ),
      exitCode: 0
    }
  };
}

export async function verifyAebAeRetainedTransactionReceipt(
  plan: AebAeBakeExecutionPlan,
  receipt: AebAeRetainedTransactionReceipt,
  hasher: EmbeddedResourceHasher
): Promise<boolean> {
  try {
    if (!hasExactKeys(receipt, [
      "schemaVersion", "taskId", "executionId", "planHash", "runtimePlanHash", "jobId", "packageId",
      "sourceFingerprint", "scanDigest", "plannerDigest", "source", "timing", "canvas", "alphaMode",
      "process", "checkpoint", "approvalHash", "resultHash", "composition", "targetLayers",
      "controlledFeatures", "renderQueue", "output", "cleanup", "receiptHash"
    ])
      || !hasExactKeys(receipt.source, ["projectContentHash", "packageContentHash"])
      || !hasExactKeys(receipt.timing, ["startFrame", "endFrameExclusive", "fps"])
      || !hasExactKeys(receipt.canvas, ["width", "height"])
      || !hasExactKeys(receipt.process, ["pid", "startIdentity", "executableHash"])
      || !hasExactKeys(receipt.checkpoint, ["relativePath", "contentHash", "encodedBytes", "identityDigest"])
      || !hasExactKeys(receipt.composition, ["productId", "retainedId", "name"])
      || !hasExactKeys(receipt.renderQueue, ["itemId", "rqindex", "renderStatus"])
      || !hasExactKeys(receipt.output, ["frames"])
      || receipt.output.frames.some((frame) => !hasExactKeys(frame, [
        "frameIndex", "relativePath", "contentHash", "encodedBytes", "decodedRgbaBytes", "width", "height", "alpha"
      ]))
      || !hasExactKeys(receipt.cleanup, [
        "renderQueueItemRemoved", "temporaryItemsRemoved", "projectClosedWithoutSave", "appOpenCountAfterCheckpoint",
        "approvalConsumedOnce", "processClosedNormally", "processGroupAbsenceProven", "runRootRemoved", "unexpectedResidue"
      ])
      || !await verifyAebAeBakeExecutionPlan(plan, hasher)
      || receipt.schemaVersion !== AEB_AE_RETAINED_TRANSACTION_RECEIPT_SCHEMA_VERSION
      || receipt.taskId !== plan.job.task.taskId
      || receipt.executionId !== plan.executionId
      || receipt.planHash !== plan.planHash
      || !isSha256(receipt.runtimePlanHash)
      || receipt.jobId !== plan.job.jobId
      || receipt.packageId !== plan.job.packageId
      || receipt.sourceFingerprint !== plan.job.source.sourceFingerprint
      || receipt.scanDigest !== plan.job.source.scanDigest
      || receipt.plannerDigest !== plan.job.source.plannerDigest
      || receipt.source.projectContentHash !== plan.sourceFiles.projectContentHash
      || receipt.source.packageContentHash !== plan.sourceFiles.packageContentHash
      || receipt.timing.startFrame !== plan.job.timeRange.startFrame
      || receipt.timing.endFrameExclusive !== plan.job.timeRange.endFrameExclusive
      || receipt.timing.fps !== plan.job.fps
      || !sameJson(receipt.canvas, plan.job.canvas)
      || receipt.alphaMode !== plan.job.alphaMode
      || !Number.isSafeInteger(receipt.process.pid)
      || receipt.process.pid <= 0
      || !isSha256(receipt.process.startIdentity)
      || receipt.process.executableHash !== plan.host.executableHash
      || receipt.checkpoint.relativePath !== "checkpoint/checkpoint.aep"
      || !isSha256(receipt.checkpoint.contentHash)
      || !isPositiveInteger(receipt.checkpoint.encodedBytes)
      || !isSha256(receipt.checkpoint.identityDigest)
      || !isSha256(receipt.approvalHash)
      || !isSha256(receipt.resultHash)
      || receipt.composition.productId !== plan.composition.id
      || !/^[1-9][0-9]*$/.test(receipt.composition.retainedId)
      || receipt.composition.name !== plan.composition.name
      || !sameJson(receipt.targetLayers, plan.composition.targetLayers)
      || !sameJson(receipt.controlledFeatures, plan.controlledFeatures)
      || !isNonEmptyString(receipt.renderQueue.itemId)
      || !isPositiveInteger(receipt.renderQueue.rqindex)
      || receipt.renderQueue.renderStatus !== "done"
      || receipt.output.frames.length !== plan.output.frames.length
      || receipt.output.frames.some((frame, index) => frame.frameIndex !== plan.output.frames[index].frameIndex
        || frame.relativePath !== plan.output.frames[index].relativePath
        || !isSha256(frame.contentHash)
        || !isPositiveInteger(frame.encodedBytes)
        || frame.decodedRgbaBytes !== plan.job.canvas.width * plan.job.canvas.height * 4
        || frame.width !== plan.job.canvas.width
        || frame.height !== plan.job.canvas.height
        || frame.alpha !== "mixed")
      || receipt.cleanup.renderQueueItemRemoved !== true
      || receipt.cleanup.temporaryItemsRemoved !== true
      || receipt.cleanup.projectClosedWithoutSave !== true
      || receipt.cleanup.appOpenCountAfterCheckpoint !== 0
      || receipt.cleanup.approvalConsumedOnce !== true
      || receipt.cleanup.processClosedNormally !== true
      || receipt.cleanup.processGroupAbsenceProven !== true
      || receipt.cleanup.runRootRemoved !== true
      || receipt.cleanup.unexpectedResidue.length !== 0
      || !isSha256(receipt.receiptHash)) return false;
    const { receiptHash, ...withoutHash } = receipt;
    return receiptHash === await hashCanonical(hasher, withoutHash);
  } catch {
    return false;
  }
}

export async function createAebAeRetainedHostExecutionEvidence(
  plan: AebAeBakeExecutionPlan,
  receipt: AebAeRetainedTransactionReceipt,
  hasher: EmbeddedResourceHasher
): Promise<AebAeRetainedHostExecutionEvidence> {
  if (!await verifyAebAeRetainedTransactionReceipt(plan, receipt, hasher)) {
    fail("AE_RETAINED_TRANSACTION_RECEIPT_INVALID", "The retained AE transaction receipt is invalid.");
  }
  return {
    kind: "retained_ae_transaction",
    executableHash: plan.host.executableHash,
    producerSourceHash: plan.host.producerSourceHash,
    runtimePlanHash: receipt.runtimePlanHash,
    approvalHash: receipt.approvalHash,
    resultHash: receipt.resultHash,
    transactionReceiptHash: receipt.receiptHash,
    processStartIdentity: receipt.process.startIdentity,
    checkpointIdentityDigest: receipt.checkpoint.identityDigest,
    frameInventoryDigest: await hashCanonical(hasher, receipt.output.frames),
    processClosedNormally: true,
    processGroupAbsenceProven: true,
    runRootRemoved: true
  };
}

export async function verifyAebAeBakeProducerReceipt(
  plan: AebAeBakeExecutionPlan,
  producer: AebAeBakeProducerReceipt,
  cleanup: AebAeBakeCleanupReceipt,
  hasher: EmbeddedResourceHasher
): Promise<boolean> {
  try {
    const expectedFrames = plan.output.frames;
    const retained = producer.scanReceipt.schemaVersion === AEB_AE_RETAINED_TRANSACTION_RECEIPT_SCHEMA_VERSION;
    const expectedHostExecution = retained
      ? await createAebAeRetainedHostExecutionEvidence(
        plan,
        producer.scanReceipt as AebAeRetainedTransactionReceipt,
        hasher
      )
      : await createAebAeHostExecutionEvidence(
        plan,
        producer.scanReceipt as AebAeControlledScanReceipt,
        hasher
      );
    if (!await verifyAebAeBakeExecutionPlan(plan, hasher)
      || producer.schemaVersion !== AEB_AE_BAKE_PRODUCER_RECEIPT_SCHEMA_VERSION
      || cleanup.schemaVersion !== AEB_AE_BAKE_CLEANUP_RECEIPT_SCHEMA_VERSION
      || producer.executionId !== plan.executionId
      || producer.planHash !== plan.planHash
      || producer.jobId !== plan.job.jobId
      || producer.packageId !== plan.job.packageId
      || producer.sourceFingerprint !== plan.job.source.sourceFingerprint
      || producer.scanDigest !== plan.job.source.scanDigest
      || producer.plannerDigest !== plan.job.source.plannerDigest
      || producer.taskId !== plan.job.task.taskId
      || producer.taskReceiptId !== plan.job.task.receiptId
      || producer.target.compositionId !== plan.composition.id
      || producer.target.compositionName !== plan.composition.name
      || producer.target.sourceId !== plan.job.target.sourceId
      || !sameStringArray(producer.target.layerIds, [...plan.job.target.layerIds].sort(compareCodeUnits))
      || producer.timing.startFrame !== plan.job.timeRange.startFrame
      || producer.timing.endFrameExclusive !== plan.job.timeRange.endFrameExclusive
      || producer.timing.fps !== plan.job.fps
      || producer.canvas.width !== plan.job.canvas.width
      || producer.canvas.height !== plan.job.canvas.height
      || producer.alphaMode !== "straight"
      || !sameJson(producer.host, plan.host)
      || (retained
        ? !await verifyAebAeRetainedTransactionReceipt(
          plan,
          producer.scanReceipt as AebAeRetainedTransactionReceipt,
          hasher
        )
        : !await verifyAebAeControlledScanReceipt(
          plan,
          producer.scanReceipt as AebAeControlledScanReceipt,
          hasher
        ))
      || !sameJson(producer.hostExecution, expectedHostExecution)
      || producer.source.project.relativePath !== plan.sourceFiles.projectRelativePath
      || producer.source.project.contentHash !== plan.sourceFiles.projectContentHash
      || producer.source.package.relativePath !== plan.sourceFiles.packageRelativePath
      || producer.source.package.contentHash !== plan.sourceFiles.packageContentHash
      || !sourceReceiptUnchanged(producer.source.project)
      || !sourceReceiptUnchanged(producer.source.package)
      || producer.output.frames.length !== expectedFrames.length
      || producer.output.frames.some((frame, index) => frame.frameIndex !== expectedFrames[index].frameIndex
        || frame.relativePath !== expectedFrames[index].relativePath
        || !isSha256(frame.contentHash)
        || !isPositiveInteger(frame.encodedBytes)
        || frame.decodedRgbaBytes !== frame.width * frame.height * 4
        || frame.width !== plan.job.canvas.width
        || frame.height !== plan.job.canvas.height)
      || producer.output.totalEncodedBytes !== producer.output.frames.reduce((total, frame) => total + frame.encodedBytes, 0)
      || producer.output.totalDecodedRgbaBytes !== producer.output.frames.reduce((total, frame) => total + frame.decodedRgbaBytes, 0)
      || producer.output.totalEncodedBytes > plan.job.budgets.maxEncodedBytes
      || producer.output.totalDecodedRgbaBytes > plan.job.budgets.maxDecodedRgbaBytes
      || producer.execution.state !== "completed"
      || producer.execution.processStarted !== true
      || producer.execution.hostCompleted !== true
      || producer.execution.exitCode !== 0
      || producer.execution.cancelled !== false
      || producer.execution.timedOut !== false
      || !isSha256(producer.execution.progressDigest)
      || producer.cleanupReceiptHash !== cleanup.receiptHash
      || cleanup.executionId !== plan.executionId
      || cleanup.taskId !== plan.job.task.taskId
      || cleanup.jobId !== plan.job.jobId
      || cleanup.planHash !== plan.planHash
      || cleanup.outcome !== "success"
      || cleanup.phase !== "cleanup"
      || cleanup.workDirectory !== plan.output.workDirectory
      || cleanup.framesDirectory !== plan.output.framesDirectory
      || cleanup.workDirectoryRemoved !== true
      || cleanup.partialFramesRemoved !== false
      || cleanup.planRemoved !== false
      || cleanup.temporaryRenderItemsRemoved !== true
      || cleanup.sourceProjectUnchanged !== true
      || cleanup.sourcePackageUnchanged !== true
      || !isSha256(cleanup.receiptHash)
      || !isSha256(producer.receiptHash)) return false;
    return cleanup.receiptHash === await hashCleanupReceipt(hasher, cleanup)
      && producer.receiptHash === await hashProducerReceipt(hasher, producer);
  } catch {
    return false;
  }
}

export async function hashCanonical(hasher: EmbeddedResourceHasher, value: unknown): Promise<string> {
  const hash = await hasher.hash(new TextEncoder().encode(JSON.stringify(sortValue(value))));
  if (hash.algorithm !== "sha256" || hash.scope !== "encoded_bytes" || !isSha256(hash.value)) {
    fail("HASHER_CONTRACT_INVALID", "AEB AE Bake execution requires encoded-byte SHA-256 hashes.");
  }
  return hash.value;
}

async function hashProducerReceipt(hasher: EmbeddedResourceHasher, receipt: AebAeBakeProducerReceipt): Promise<string> {
  const { receiptHash, ...withoutHash } = receipt;
  return hashCanonical(hasher, withoutHash);
}

async function hashCleanupReceipt(hasher: EmbeddedResourceHasher, receipt: AebAeBakeCleanupReceipt): Promise<string> {
  const { receiptHash, ...withoutHash } = receipt;
  return hashCanonical(hasher, withoutHash);
}

function expectedFrameSources(job: AebBakeJob, executionId: string): AebBakeFrameSource[] {
  const width = Math.max(6, String(Math.max(0, job.timeRange.endFrameExclusive - 1)).length);
  return Array.from(
    { length: job.timeRange.endFrameExclusive - job.timeRange.startFrame },
    (_, offset) => {
      const frameIndex = job.timeRange.startFrame + offset;
      return {
        frameIndex,
        relativePath: `aeb-ae-frames-${executionId}/frame_${String(frameIndex).padStart(width, "0")}.png`
      };
    }
  );
}

function sourceReceiptUnchanged(receipt: AebAeBakeSourceFileReceipt): boolean {
  return isRelativePath(receipt.relativePath)
    && isSha256(receipt.contentHash)
    && isSha256(receipt.preIdentityDigest)
    && receipt.preIdentityDigest === receipt.postIdentityDigest
    && receipt.unchanged === true;
}

function cloneControlledFeatures(features: AebAeControlledFeatures): AebAeControlledFeatures {
  return {
    ...features,
    effectMatchNames: [...features.effectMatchNames],
    maskModes: [...features.maskModes] as ["add", ..."add"[]]
  };
}

function isBoundedJobAndPlanner(plan: AebAeBakeExecutionPlan): boolean {
  const job = plan.job;
  const planner = plan.planner;
  const receipt = plan.taskReceipt;
  const frameCount = job.timeRange.endFrameExclusive - job.timeRange.startFrame;
  const budgets = job.budgets;
  const bbox = job.bbox;
  const layerIds = job.target.layerIds;
  const decisionIds = planner.decisions.map((decision) => decision.layerId);
  return job.schemaVersion === "aeb-bake-job-v1"
    && isIdentifier(job.jobId)
    && isIdentifier(job.packageId)
    && isIdentifier(job.source.compositionId)
    && isSha256(job.source.sourceFingerprint)
    && isSha256(job.source.scanDigest)
    && isSha256(job.source.plannerDigest)
    && (job.target.kind === "layer" || job.target.kind === "precomp")
    && isIdentifier(job.target.sourceId)
    && Array.isArray(layerIds)
    && layerIds.length > 0
    && new Set(layerIds).size === layerIds.length
    && layerIds.every(isIdentifier)
    && Array.isArray(job.target.replaceableElementIds)
    && job.target.replaceableElementIds.length === 0
    && Number.isInteger(job.timeRange.startFrame)
    && Number.isInteger(job.timeRange.endFrameExclusive)
    && frameCount > 0
    && frameCount <= budgets.maxFrames
    && Number.isFinite(job.fps)
    && job.fps > 0
    && job.fps <= 240
    && isPositiveInteger(job.canvas.width)
    && isPositiveInteger(job.canvas.height)
    && job.canvas.width <= 8_192
    && job.canvas.height <= 8_192
    && job.alphaMode === "straight"
    && (bbox.mode === "full_canvas" || bbox.mode === "tight")
    && [bbox.x, bbox.y, bbox.width, bbox.height].every(Number.isInteger)
    && bbox.x >= 0
    && bbox.y >= 0
    && bbox.width > 0
    && bbox.height > 0
    && bbox.x + bbox.width <= job.canvas.width
    && bbox.y + bbox.height <= job.canvas.height
    && (bbox.mode !== "full_canvas"
      || (bbox.x === 0 && bbox.y === 0 && bbox.width === job.canvas.width && bbox.height === job.canvas.height))
    && isPositiveInteger(budgets.maxFrames)
    && budgets.maxFrames <= 10_000
    && isPositiveInteger(budgets.maxEncodedBytes)
    && budgets.maxEncodedBytes <= 128 * 1024 * 1024
    && isPositiveInteger(budgets.maxDecodedRgbaBytes)
    && budgets.maxDecodedRgbaBytes <= 512 * 1024 * 1024
    && isPositiveInteger(budgets.maxPackageBytes)
    && budgets.maxPackageBytes <= 128 * 1024 * 1024
    && frameCount * job.canvas.width * job.canvas.height * 4 <= budgets.maxDecodedRgbaBytes
    && budgets.maxEncodedBytes <= budgets.maxPackageBytes
    && job.safety.sourceProjectMutationAllowed === false
    && job.safety.replaceablePolicy === "preserve"
    && job.safety.cleanupRequired === true
    && job.safety.rollbackReceiptRequired === true
    && planner.schemaVersion === "aeb-bake-planner-join-v1"
    && planner.jobId === job.jobId
    && planner.sourceFingerprint === job.source.sourceFingerprint
    && planner.scanDigest === job.source.scanDigest
    && planner.plannerDigest === job.source.plannerDigest
    && Array.isArray(planner.decisions)
    && planner.decisions.length > 0
    && new Set(decisionIds).size === decisionIds.length
    && planner.decisions.every((decision) => isIdentifier(decision.layerId)
      && ["native", "bake_required", "blocked"].includes(decision.outcome)
      && isNonEmptyString(decision.reason))
    && planner.decisions.every((decision) => decision.outcome !== "blocked")
    && receipt.schemaVersion === "aeb-bake-task-receipt-v1"
    && receipt.outputDirectory === "."
    && receipt.cleanupPolicy === "delete_task_root_after_consumption"
    && receipt.rollbackPolicy === "preserve_source_package"
    && receipt.sourceProjectMutationAllowed === false
    && receipt.producer === "after_effects";
}

function isRelativePath(value: unknown): value is string {
  if (typeof value !== "string" || value === "" || value.includes("\\") || value.startsWith("/")) return false;
  const segments = value.split("/");
  return segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value);
}

function isFileIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= 255;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isUnsignedIntegerString(value: unknown): value is string {
  return typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, child]) => [key, sortValue(child)]));
  }
  return value;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(sortValue(left)) === JSON.stringify(sortValue(right));
}

function hasExactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return sameJson(Object.keys(value).sort(compareCodeUnits), [...expected].sort(compareCodeUnits));
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(code: string, message: string): never {
  throw new AebBakePipelineError(code, message);
}
