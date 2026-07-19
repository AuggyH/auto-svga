import type {
  AebBakeExecutionAuthority,
  AebBakeExecutionReceipt,
  AebBakeManifest,
  AebPackagePublicationAuthorityVerifier,
  AebPublishedSuccessorPackage
} from "./aeb-bake-contracts.js";
import { AebBakePipelineError, verifyAebBakeManifestIntegrity } from "./aeb-bake-pipeline.js";
import {
  verifyAebPublishedSuccessorPackageIntegrity
} from "./aeb-package-reinsertion.js";
import type {
  AebAeBakeCleanupReceipt,
  AebAeBakeExecutionPlan,
  AebAeBakeProducerReceipt,
  AebAeRetainedTransactionReceipt
} from "./aeb-ae-bake-execution.js";
import {
  AEB_AE_RETAINED_TRANSACTION_RECEIPT_SCHEMA_VERSION,
  hashCanonical,
  verifyAebAeBakeExecutionPlan,
  verifyAebAeBakeProducerReceipt,
  verifyAebAeRetainedTransactionReceipt
} from "./aeb-ae-bake-execution.js";
import type { EmbeddedResourceHasher } from "./resource-hasher.js";
import type { SvgaAebBakeAdapterInput } from "./svga/aeb-bake-adapter.js";

export const AEB_RETAINED_BAKE_AUTHORITY_CHAIN_SCHEMA_VERSION = "aeb-retained-bake-authority-chain-v1" as const;

export interface AebRetainedBakeAuthorityChainReceipt {
  schemaVersion: typeof AEB_RETAINED_BAKE_AUTHORITY_CHAIN_SCHEMA_VERSION;
  authorityState: "source_validated_svga_adapter_ready";
  taskId: string;
  executionId: string;
  planHash: string;
  runtimePlanHash: string;
  jobId: string;
  packageId: string;
  sourceFingerprint: string;
  scanDigest: string;
  plannerDigest: string;
  retainedTransactionReceiptHash: string;
  producerReceiptHash: string;
  cleanupReceiptHash: string;
  executionReceiptHash: string;
  manifestId: string;
  packageBundleId: string;
  publicationReceiptHash: string;
  svgaAdapterDigest: string;
  frameInventoryDigest: string;
  actualAeRenderExecuted: true;
  runtimeProved: false;
  standardsValidSvgaEncoded: false;
  realPreviewValidated: false;
  saveAsBytesAuthorized: false;
  installedQaAccepted: false;
  productOwnerAccepted: false;
  chainHash: string;
}

export interface CreateAebRetainedBakeAuthorityChainInput {
  plan: AebAeBakeExecutionPlan;
  producerReceipt: AebAeBakeProducerReceipt;
  cleanupReceipt: AebAeBakeCleanupReceipt;
  executionReceipt: AebBakeExecutionReceipt;
  executionAuthority: AebBakeExecutionAuthority;
  manifest: AebBakeManifest;
  published: AebPublishedSuccessorPackage;
  publicationAuthority: AebPackagePublicationAuthorityVerifier;
  adapterInput: SvgaAebBakeAdapterInput;
  hasher: EmbeddedResourceHasher;
}

export async function createAebRetainedBakeAuthorityChain(
  input: CreateAebRetainedBakeAuthorityChainInput
): Promise<AebRetainedBakeAuthorityChainReceipt> {
  await validateControlledRetainedChain(input);
  const retained = input.producerReceipt.scanReceipt as AebAeRetainedTransactionReceipt;
  const unsigned: Omit<AebRetainedBakeAuthorityChainReceipt, "chainHash"> = {
    schemaVersion: AEB_RETAINED_BAKE_AUTHORITY_CHAIN_SCHEMA_VERSION,
    authorityState: "source_validated_svga_adapter_ready",
    taskId: input.plan.job.task.taskId,
    executionId: input.plan.executionId,
    planHash: input.plan.planHash,
    runtimePlanHash: retained.runtimePlanHash,
    jobId: input.plan.job.jobId,
    packageId: input.plan.job.packageId,
    sourceFingerprint: input.plan.job.source.sourceFingerprint,
    scanDigest: input.plan.job.source.scanDigest,
    plannerDigest: input.plan.job.source.plannerDigest,
    retainedTransactionReceiptHash: retained.receiptHash,
    producerReceiptHash: input.producerReceipt.receiptHash,
    cleanupReceiptHash: input.cleanupReceipt.receiptHash,
    executionReceiptHash: input.executionReceipt.receiptHash,
    manifestId: input.manifest.manifestId,
    packageBundleId: input.published.bundle.packageBundleId,
    publicationReceiptHash: input.published.publicationReceipt.receiptHash,
    svgaAdapterDigest: await hashCanonical(input.hasher, input.adapterInput),
    frameInventoryDigest: input.executionReceipt.frameInventoryDigest,
    actualAeRenderExecuted: true,
    runtimeProved: false,
    standardsValidSvgaEncoded: false,
    realPreviewValidated: false,
    saveAsBytesAuthorized: false,
    installedQaAccepted: false,
    productOwnerAccepted: false
  };
  return { ...unsigned, chainHash: await hashCanonical(input.hasher, unsigned) };
}

export async function verifyAebRetainedBakeAuthorityChainReceipt(
  receipt: AebRetainedBakeAuthorityChainReceipt,
  input: CreateAebRetainedBakeAuthorityChainInput
): Promise<boolean> {
  try {
    const expected = await createAebRetainedBakeAuthorityChain(input);
    return sameJson(receipt, expected);
  } catch {
    return false;
  }
}

async function validateControlledRetainedChain(input: CreateAebRetainedBakeAuthorityChainInput): Promise<void> {
  if (!await verifyAebAeBakeExecutionPlan(input.plan, input.hasher)) {
    fail("AE_EXECUTION_PLAN_INVALID", "Retained Bake chain requires a valid bounded AE execution plan.");
  }
  if (!isControlledFixturePlan(input.plan)) {
    fail("AE_RETAINED_CHAIN_SCOPE_UNSUPPORTED", "Retained Bake chain is limited to the reviewed 4x4 one-frame fixture.");
  }
  const retained = input.producerReceipt.scanReceipt;
  if (retained.schemaVersion !== AEB_AE_RETAINED_TRANSACTION_RECEIPT_SCHEMA_VERSION) {
    fail("AE_RETAINED_TRANSACTION_REQUIRED", "Retained Bake chain requires a retained AE transaction receipt.");
  }
  if (!await verifyAebAeRetainedTransactionReceipt(
    input.plan,
    retained as AebAeRetainedTransactionReceipt,
    input.hasher
  ) || !await verifyAebAeBakeProducerReceipt(
    input.plan,
    input.producerReceipt,
    input.cleanupReceipt,
    input.hasher
  )) {
    fail("AE_RETAINED_TRANSACTION_INVALID", "Retained Bake producer authority does not match the bounded plan.");
  }
  if (!isRetainedHostEvidenceBound(input.producerReceipt, retained as AebAeRetainedTransactionReceipt)) {
    fail("AE_RETAINED_HOST_EVIDENCE_MISMATCH", "Retained host evidence does not bind the same transaction receipt.");
  }
  if (!isExecutionReceiptBound(input)) {
    fail("AE_RETAINED_EXECUTION_RECEIPT_MISMATCH", "Retained execution receipt is stale or bound to another result.");
  }
  if (!await input.executionAuthority.verifyExecution({
    job: input.plan.job,
    planner: input.plan.planner,
    taskReceipt: input.plan.taskReceipt,
    frames: input.plan.output.frames,
    executionReceipt: input.executionReceipt,
    hasher: input.hasher
  })) {
    fail("AE_RETAINED_EXECUTION_AUTHORITY_INVALID", "Retained execution authority did not verify the current result.");
  }
  if (!await verifyAebBakeManifestIntegrity(input.manifest, input.hasher, input.executionAuthority)
    || !isManifestBound(input)) {
    fail("AE_RETAINED_MANIFEST_BINDING_INVALID", "F1 Bake manifest is not bound to the retained execution result.");
  }
  if (!await verifyAebPublishedSuccessorPackageIntegrity(
    input.published,
    input.hasher,
    input.executionAuthority
  )
    || !await input.publicationAuthority.verifyPublishedSuccessor(input.published, input.hasher)
    || !isPublishedPackageBound(input)) {
    fail("AE_RETAINED_PUBLICATION_BINDING_INVALID", "Physical successor package is not bound to the retained execution result.");
  }
  if (!isSvgaAdapterInputBound(input)) {
    fail("AE_RETAINED_SVGA_ADAPTER_BINDING_INVALID", "SVGA adapter input is stale or bound to another package.");
  }
  if (input.adapterInput.validation.standardsValidSvgaEncoded !== false
    || input.adapterInput.validation.realPreviewValidated !== false
    || input.adapterInput.validation.finalEncoderValidationRequired !== true
    || input.adapterInput.validation.runtimeValidatorRequired !== true
    || input.published.bundle.validation.runtimeProved !== false
    || input.published.bundle.validation.installedQaAccepted !== false
    || input.published.bundle.validation.productOwnerAccepted !== false) {
    fail("AE_RETAINED_PREVIEW_SAVE_ELEVATION_FORBIDDEN", "Retained Bake chain cannot elevate Preview, Save, QA, or Owner acceptance.");
  }
}

function isControlledFixturePlan(plan: AebAeBakeExecutionPlan): boolean {
  return plan.composition.name === "AEB3_F2_S1_RETAINED_FIXTURE"
    && plan.job.canvas.width === 4
    && plan.job.canvas.height === 4
    && plan.job.fps === 1
    && plan.job.timeRange.endFrameExclusive === plan.job.timeRange.startFrame + 1
    && plan.job.alphaMode === "straight"
    && plan.output.frames.length === 1
    && plan.controlledFeatures.twoDOnly === true
    && plan.controlledFeatures.precompDepth === 1
    && sameJson(plan.controlledFeatures.effectMatchNames, ["ADBE Fill"])
    && sameJson(plan.controlledFeatures.maskModes, ["add"])
    && plan.controlledFeatures.expressionCount === 1
    && plan.controlledFeatures.expressionSampling === "ae_rasterized"
    && plan.controlledFeatures.audio === false
    && plan.controlledFeatures.threeD === false
    && plan.controlledFeatures.camera === false
    && plan.controlledFeatures.thirdPartyPlugins === false
    && plan.controlledFeatures.unknownHostCapabilities === false;
}

function isRetainedHostEvidenceBound(
  producerReceipt: AebAeBakeProducerReceipt,
  retained: AebAeRetainedTransactionReceipt
): boolean {
  const evidence = producerReceipt.hostExecution;
  return evidence.kind === "retained_ae_transaction"
    && evidence.runtimePlanHash === retained.runtimePlanHash
    && evidence.approvalHash === retained.approvalHash
    && evidence.resultHash === retained.resultHash
    && evidence.transactionReceiptHash === retained.receiptHash
    && evidence.processStartIdentity === retained.process.startIdentity
    && evidence.checkpointIdentityDigest === retained.checkpoint.identityDigest
    && evidence.processClosedNormally === true
    && evidence.processGroupAbsenceProven === true
    && evidence.runRootRemoved === true;
}

function isExecutionReceiptBound(input: CreateAebRetainedBakeAuthorityChainInput): boolean {
  const receipt = input.executionReceipt;
  return receipt.mode === "after_effects"
    && receipt.actualAeRenderExecuted === true
    && receipt.jobId === input.plan.job.jobId
    && receipt.taskId === input.plan.job.task.taskId
    && receipt.taskReceiptId === input.plan.job.task.receiptId
    && receipt.sourceFingerprint === input.plan.job.source.sourceFingerprint
    && receipt.scanDigest === input.plan.job.source.scanDigest
    && receipt.plannerDigest === input.plan.job.source.plannerDigest
    && receipt.evidence.kind === "after_effects"
    && receipt.evidence.hostSessionId === input.plan.executionId
    && receipt.evidence.aeVersion === `${input.plan.host.version}+${input.plan.host.build}`
    && receipt.evidence.scriptDigest === input.plan.host.producerSourceHash
    && receipt.evidence.renderReceiptDigest === input.producerReceipt.receiptHash
    && receipt.frameInventoryDigest === input.manifest.execution.frameInventoryDigest;
}

function isManifestBound(input: CreateAebRetainedBakeAuthorityChainInput): boolean {
  return input.manifest.job.jobId === input.plan.job.jobId
    && input.manifest.job.packageId === input.plan.job.packageId
    && sameJson(input.manifest.job.source, input.plan.job.source)
    && sameJson(input.manifest.job.timeRange, input.plan.job.timeRange)
    && input.manifest.job.fps === input.plan.job.fps
    && sameJson(input.manifest.job.canvas, input.plan.job.canvas)
    && input.manifest.execution.mode === "after_effects"
    && input.manifest.execution.actualAeRenderExecuted === true
    && input.manifest.execution.receiptHash === input.executionReceipt.receiptHash
    && input.manifest.execution.frameInventoryDigest === input.executionReceipt.frameInventoryDigest
    && input.manifest.frames.length === input.producerReceipt.output.frames.length
    && input.manifest.frames.every((frame, index) => {
      const producerFrame = input.producerReceipt.output.frames[index];
      return frame.frameIndex === producerFrame.frameIndex
        && frame.relativePath === producerFrame.relativePath
        && frame.contentHash.value === producerFrame.contentHash
        && frame.encodedBytes === producerFrame.encodedBytes
        && frame.decodedRgbaBytes === producerFrame.decodedRgbaBytes
        && frame.width === producerFrame.width
        && frame.height === producerFrame.height;
    });
}

function isPublishedPackageBound(input: CreateAebRetainedBakeAuthorityChainInput): boolean {
  const receipt = input.published.publicationReceipt;
  return input.published.bundle.packageId === input.plan.job.packageId
    && input.published.bundle.packageBundleId === receipt.joins.packageBundleId
    && input.published.bundle.bakeManifest.manifestId === input.manifest.manifestId
    && receipt.taskId === input.plan.job.task.taskId
    && receipt.jobId === input.plan.job.jobId
    && receipt.packageId === input.plan.job.packageId
    && receipt.sourceFingerprint === input.plan.job.source.sourceFingerprint
    && receipt.sourcePackage.relativePath === input.plan.sourceFiles.packageRelativePath
    && receipt.sourcePackage.contentHash.value === input.plan.sourceFiles.packageContentHash
    && receipt.sourcePackage.unchanged === true
    && receipt.joins.executionReceiptHash === input.executionReceipt.receiptHash
    && receipt.joins.manifestId === input.manifest.manifestId
    && receipt.cleanup.temporaryPathRemoved === true
    && receipt.cleanup.rollbackPerformed === false
    && receipt.cleanup.partialSuccessorPresent === false;
}

function isSvgaAdapterInputBound(input: CreateAebRetainedBakeAuthorityChainInput): boolean {
  const bundle = input.published.bundle;
  const sequence = bundle.bakedSequences[0];
  return input.adapterInput.sourceFormat === "aeb_physical_successor_package"
    && input.adapterInput.outputFormat === "svga"
    && input.adapterInput.packageId === bundle.packageId
    && input.adapterInput.jobId === input.manifest.job.jobId
    && input.adapterInput.sourceFingerprint === input.manifest.job.source.sourceFingerprint
    && sameJson(input.adapterInput.canvas, input.manifest.job.canvas)
    && input.adapterInput.fps === input.manifest.job.fps
    && sameJson(input.adapterInput.timeRange, input.manifest.job.timeRange)
    && sameJson(input.adapterInput.preservedNativeLayerIds, bundle.preservedNativeLayers.map((layer) => layer.layerId))
    && Boolean(sequence)
    && sameJson(input.adapterInput.bakedLayerIds, sequence.replacesLayerIds)
    && input.adapterInput.frames.length === sequence.frames.length
    && input.adapterInput.frames.every((frame, index) => {
      const source = sequence.frames[index];
      return frame.frameIndex === source.frameIndex
        && frame.imageKey === `aeb_${source.resourceId}`
        && frame.relativePath === source.relativePath
        && frame.resourceId === source.resourceId
        && frame.canonicalResourceId === source.canonicalResourceId
        && frame.contentHash === source.contentHash.value
        && frame.width === source.width
        && frame.height === source.height;
    });
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(sortValue(left)) === JSON.stringify(sortValue(right));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => [key, sortValue(child)]));
  }
  return value;
}

function fail(code: string, message: string): never {
  throw new AebBakePipelineError(code, message);
}
