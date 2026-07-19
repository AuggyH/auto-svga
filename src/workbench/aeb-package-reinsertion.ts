import type { ResourceContentHash } from "./contracts.js";
import type { EmbeddedResourceHasher } from "./resource-hasher.js";
import {
  AEB_FORMAT_NEUTRAL_IR_SCHEMA_VERSION,
  AEB_REINSERTED_PACKAGE_SCHEMA_VERSION,
  type AebFormatNeutralIr,
  type AebBakeExecutionAuthority,
  type AebFormatNeutralIrLayer,
  type AebPackagePublicationRollbackAuthority,
  type AebPackagePublicationRollbackReceipt,
  type AebPublishedSuccessorPackage,
  type AebReinsertedPackage,
  type AebBakeManifest
} from "./aeb-bake-contracts.js";
import {
  AebBakePipelineError,
  verifyAebBakeManifestIntegrity
} from "./aeb-bake-pipeline.js";

export async function reinsertAebBakePackage(
  sourceIr: AebFormatNeutralIr,
  manifest: AebBakeManifest,
  hasher: EmbeddedResourceHasher,
  executionAuthority?: AebBakeExecutionAuthority
): Promise<AebReinsertedPackage> {
  if (!await verifyAebBakeManifestIntegrity(manifest, hasher, executionAuthority)) {
    fail("MANIFEST_INTEGRITY_INVALID", "AEB Bake manifest hash binding is invalid before package reinsertion.");
  }
  validateSourceIr(sourceIr, manifest);

  const targetLayerIds = new Set(manifest.reinsertion.replaceBakedLayerIds);
  const preservedNativeLayers = sourceIr.layers
    .filter((layer) => layer.plannerOutcome === "native")
    .map(copyLayer)
    .sort((left, right) => compareCodeUnits(left.layerId, right.layerId));
  const bakedTargets = sourceIr.layers.filter((layer) => targetLayerIds.has(layer.layerId));
  if (bakedTargets.length !== targetLayerIds.size
    || bakedTargets.some((layer) => layer.plannerOutcome !== "bake_required" || layer.replaceableElementIds.length > 0)) {
    fail("PACKAGE_REINSERTION_TARGET_INVALID", "AEB IR Bake targets do not close over the manifest target contract.");
  }

  const nativeLayerIds = new Set(preservedNativeLayers.map((layer) => layer.layerId));
  const nativeResources = sourceIr.resources.map((resource) => ({
    ...resource,
    contentHash: { ...resource.contentHash }
  })).sort((left, right) => compareCodeUnits(left.resourceId, right.resourceId));
  if (nativeResources.some((resource) => !nativeLayerIds.has(resource.ownerLayerId))) {
    fail("PACKAGE_NATIVE_RESOURCE_CLOSURE_INVALID", "AEB IR native resources must belong to preserved native layers.");
  }
  const bakedCanonicalResourceIds = [...new Set(manifest.frames.map((frame) => frame.canonicalResourceId))]
    .sort(compareCodeUnits);
  if (bakedCanonicalResourceIds.some((resourceId) => !manifest.frames.some((frame) => frame.resourceId === resourceId))) {
    fail("PACKAGE_BAKE_RESOURCE_CLOSURE_INVALID", "AEB Bake canonical resources do not resolve inside the manifest.");
  }

  const sequenceIdentity = await hashCanonical(hasher, {
    jobId: manifest.job.jobId,
    targetSourceId: manifest.reinsertion.targetSourceId,
    replacesLayerIds: manifest.reinsertion.replaceBakedLayerIds
  });
  const packageWithoutId: Omit<AebReinsertedPackage, "packageBundleId"> = {
    schemaVersion: AEB_REINSERTED_PACKAGE_SCHEMA_VERSION,
    packageId: sourceIr.packageId,
    source: { ...sourceIr.source },
    composition: {
      canvas: { ...sourceIr.composition.canvas },
      fps: sourceIr.composition.fps,
      timeRange: { ...sourceIr.composition.timeRange }
    },
    bakeManifest: manifest,
    preservedNativeLayers,
    bakedSequences: [{
      sequenceId: `baked_sequence_${sequenceIdentity.slice(0, 24)}`,
      targetSourceId: manifest.reinsertion.targetSourceId,
      replacesLayerIds: [...manifest.reinsertion.replaceBakedLayerIds],
      frames: manifest.frames.map((frame) => ({
        ...frame,
        contentHash: { ...frame.contentHash },
        alphaBounds: { ...frame.alphaBounds }
      }))
    }],
    resources: {
      native: nativeResources,
      bakedCanonicalResourceIds
    },
    validation: {
      sourceBindingValidated: true,
      plannerJoinValidated: true,
      replaceableElementsPreserved: true,
      resourceClosureValidated: true,
      packageReinsertionValidated: true,
      svgaAdapterInputReady: true,
      actualAeRenderExecuted: manifest.execution.actualAeRenderExecuted,
      runtimeProved: false,
      installedQaAccepted: false,
      productOwnerAccepted: false
    }
  };

  return {
    ...packageWithoutId,
    packageBundleId: await hashCanonical(hasher, packageWithoutId)
  };
}

export async function verifyAebReinsertedPackageIntegrity(
  bundle: AebReinsertedPackage,
  hasher: EmbeddedResourceHasher,
  executionAuthority?: AebBakeExecutionAuthority
): Promise<boolean> {
  if (!isRecord(bundle)
    || !isRecord(bundle.bakeManifest)
    || bundle.schemaVersion !== AEB_REINSERTED_PACKAGE_SCHEMA_VERSION
    || !isReinsertedPackageSemanticallyValid(bundle)
    || !isSha256(bundle.packageBundleId)) {
    return false;
  }
  const { packageBundleId, ...packageWithoutId } = bundle;
  const sequenceIdentity = await hashCanonical(hasher, {
    jobId: bundle.bakeManifest.job.jobId,
    targetSourceId: bundle.bakeManifest.reinsertion.targetSourceId,
    replacesLayerIds: bundle.bakeManifest.reinsertion.replaceBakedLayerIds
  });
  return packageBundleId === await hashCanonical(hasher, packageWithoutId)
    && bundle.bakedSequences[0]?.sequenceId === `baked_sequence_${sequenceIdentity.slice(0, 24)}`
    && await verifyAebBakeManifestIntegrity(bundle.bakeManifest, hasher, executionAuthority);
}

export async function verifyAebPublishedSuccessorPackageIntegrity(
  published: AebPublishedSuccessorPackage,
  hasher: EmbeddedResourceHasher,
  executionAuthority?: AebBakeExecutionAuthority
): Promise<boolean> {
  try {
    if (!isRecord(published)
      || !isRecord(published.publicationReceipt)
      || !isRecord(published.bundle)
      || !await verifyAebReinsertedPackageIntegrity(published.bundle, hasher, executionAuthority)) return false;
    const receipt = published.publicationReceipt;
    const manifest = published.bundle.bakeManifest;
    if (!isRecord(receipt.sourcePackage)
      || !isRecord(receipt.successorPackage)
      || !isRecord(receipt.joins)
      || !isRecord(receipt.cleanup)
      || receipt.schemaVersion !== "aeb-package-publication-receipt-v1"
      || !isSha256(receipt.receiptHash)
      || receipt.receiptId !== manifest.safety.receiptId
      || receipt.taskId !== manifest.safety.taskId
      || receipt.jobId !== manifest.job.jobId
      || receipt.packageId !== manifest.job.packageId
      || receipt.sourceFingerprint !== manifest.job.source.sourceFingerprint
      || !isRelativePath(receipt.sourcePackage.relativePath)
      || !isRelativePath(receipt.successorPackage.relativePath)
      || receipt.sourcePackage.relativePath === receipt.successorPackage.relativePath
      || !isPositiveSafeInteger(receipt.sourcePackage.encodedBytes)
      || !isPositiveSafeInteger(receipt.successorPackage.encodedBytes)
      || receipt.sourcePackage.preIdentityDigest !== receipt.sourcePackage.postIdentityDigest
      || !isSha256(receipt.sourcePackage.preIdentityDigest)
      || receipt.sourcePackage.unchanged !== true
      || !isEncodedSha256(receipt.sourcePackage.contentHash)
      || !isEncodedSha256(receipt.successorPackage.contentHash)
      || receipt.successorPackage.encodedBytes > manifest.job.budgets.maxPackageBytes
      || receipt.successorPackage.atomicAbsentDestination !== true
      || receipt.successorPackage.noOverwrite !== true
      || receipt.joins.executionReceiptHash !== manifest.execution.receiptHash
      || receipt.joins.manifestId !== manifest.manifestId
      || receipt.joins.packageBundleId !== published.bundle.packageBundleId
      || receipt.cleanup.temporaryPathRemoved !== true
      || receipt.cleanup.rollbackOnFailure !== true
      || receipt.cleanup.rollbackPerformed !== false
      || receipt.cleanup.partialSuccessorPresent !== false) return false;
    const { receiptHash, ...receiptWithoutHash } = receipt;
    return receiptHash === await hashCanonical(hasher, receiptWithoutHash);
  } catch {
    return false;
  }
}

export async function verifyAebPackagePublicationRollbackReceiptIntegrity(
  receipt: AebPackagePublicationRollbackReceipt,
  hasher: EmbeddedResourceHasher,
  authority: AebPackagePublicationRollbackAuthority
): Promise<boolean> {
  try {
    if (!isRecord(receipt)
      || !isRecord(receipt.sourcePackage)
      || !isRecord(receipt.successorPackage)
      || !isRecord(receipt.cleanup)
      || !isRecord(authority)
      || !isRecord(authority.sourcePackage)
      || !isRecord(authority.successorPackage)
      || receipt.schemaVersion !== "aeb-package-publication-rollback-receipt-v1"
      || !isIdentifier(receipt.taskId)
      || !isIdentifier(receipt.receiptId)
      || !isIdentifier(receipt.jobId)
      || !isIdentifier(receipt.packageId)
      || !["write", "finalize", "cleanup", "verification"].includes(receipt.phase)
      || !isRelativePath(receipt.sourcePackage.relativePath)
      || !isRelativePath(receipt.successorPackage.relativePath)
      || !isEncodedSha256(receipt.sourcePackage.contentHash)
      || !isSha256(receipt.sourcePackage.preIdentityDigest)
      || receipt.sourcePackage.preIdentityDigest !== receipt.sourcePackage.postIdentityDigest
      || receipt.sourcePackage.unchanged !== true
      || receipt.taskId !== authority.taskId
      || receipt.receiptId !== authority.receiptId
      || receipt.jobId !== authority.jobId
      || receipt.packageId !== authority.packageId
      || receipt.sourcePackage.relativePath !== authority.sourcePackage.relativePath
      || receipt.sourcePackage.preIdentityDigest !== authority.sourcePackage.identityDigest
      || !sameJson(receipt.sourcePackage.contentHash, authority.sourcePackage.contentHash)
      || receipt.successorPackage.relativePath !== authority.successorPackage.relativePath
      || !isRelativePath(authority.sourcePackage.relativePath)
      || !isEncodedSha256(authority.sourcePackage.contentHash)
      || !isSha256(authority.sourcePackage.identityDigest)
      || !isRelativePath(authority.successorPackage.relativePath)
      || receipt.successorPackage.partialSuccessorPresent !== false
      || typeof receipt.successorPackage.ownedDestinationCreated !== "boolean"
      || typeof receipt.successorPackage.ownedDestinationRemoved !== "boolean"
      || typeof receipt.cleanup.temporaryPathCreated !== "boolean"
      || receipt.cleanup.temporaryPathRemoved !== true
      || typeof receipt.cleanup.rollbackPerformed !== "boolean"
      || !isRollbackHistoryValid(receipt)
      || !isSha256(receipt.receiptHash)) return false;
    const { receiptHash, ...withoutHash } = receipt;
    return receiptHash === await hashCanonical(hasher, withoutHash);
  } catch {
    return false;
  }
}

function isRollbackHistoryValid(receipt: AebPackagePublicationRollbackReceipt): boolean {
  const temporaryCreated = receipt.cleanup.temporaryPathCreated;
  const destinationCreated = receipt.successorPackage.ownedDestinationCreated;
  if (receipt.successorPackage.ownedDestinationRemoved !== destinationCreated
    || receipt.cleanup.rollbackPerformed !== (temporaryCreated || destinationCreated)) {
    return false;
  }
  if (receipt.phase === "write") {
    return destinationCreated === false;
  }
  if (receipt.phase === "finalize") {
    return temporaryCreated === true;
  }
  return temporaryCreated === true && destinationCreated === true;
}

function isReinsertedPackageSemanticallyValid(bundle: AebReinsertedPackage): boolean {
  try {
    const manifest = bundle.bakeManifest;
    const nativeIds = manifest.reinsertion.preserveNativeLayerIds;
    const targetIds = manifest.reinsertion.replaceBakedLayerIds;
    const preservedIds = bundle.preservedNativeLayers.map((layer) => layer.layerId);
    const replaceableIds = bundle.preservedNativeLayers.flatMap((layer) => layer.replaceableElementIds);
    const canonicalIds = [...new Set(manifest.frames.map((frame) => frame.canonicalResourceId))].sort(compareCodeUnits);
    const nativeResourceIds = bundle.resources.native.map((resource) => resource.resourceId);
    const sequence = bundle.bakedSequences[0];
    return isIdentifier(bundle.packageId)
      && bundle.packageId === manifest.job.packageId
      && bundle.source.sourceFingerprint === manifest.job.source.sourceFingerprint
      && bundle.source.scanDigest === manifest.job.source.scanDigest
      && bundle.source.plannerDigest === manifest.job.source.plannerDigest
      && bundle.source.compositionId === manifest.job.source.compositionId
      && bundle.composition.canvas.width === manifest.job.canvas.width
      && bundle.composition.canvas.height === manifest.job.canvas.height
      && bundle.composition.fps === manifest.job.fps
      && bundle.composition.timeRange.startFrame === manifest.job.timeRange.startFrame
      && bundle.composition.timeRange.endFrameExclusive === manifest.job.timeRange.endFrameExclusive
      && sameStringArray(preservedIds, nativeIds)
      && isStrictlySorted(preservedIds)
      && new Set(replaceableIds).size === replaceableIds.length
      && bundle.preservedNativeLayers.every((layer) => layer.plannerOutcome === "native"
        && isIdentifier(layer.layerId)
        && isIdentifier(layer.sourceId)
        && isStrictlySorted(layer.replaceableElementIds)
        && layer.replaceableElementIds.every(isIdentifier)
        && (layer.nativePayloadRef === undefined || isRelativePath(layer.nativePayloadRef)))
      && bundle.bakedSequences.length === 1
      && /^baked_sequence_[a-f0-9]{24}$/.test(sequence.sequenceId)
      && sameStringArray(sequence.replacesLayerIds, targetIds)
      && sequence.targetSourceId === manifest.reinsertion.targetSourceId
      && sameJson(sequence.frames, manifest.frames)
      && new Set(nativeResourceIds).size === nativeResourceIds.length
      && isStrictlySorted(nativeResourceIds)
      && bundle.resources.native.every((resource) => isIdentifier(resource.resourceId)
        && isIdentifier(resource.ownerLayerId)
        && preservedIds.includes(resource.ownerLayerId)
        && isRelativePath(resource.relativePath)
        && isEncodedSha256(resource.contentHash))
      && isStrictlySorted(bundle.resources.bakedCanonicalResourceIds)
      && sameStringArray(bundle.resources.bakedCanonicalResourceIds, canonicalIds)
      && bundle.validation.sourceBindingValidated === true
      && bundle.validation.plannerJoinValidated === true
      && bundle.validation.replaceableElementsPreserved === true
      && bundle.validation.resourceClosureValidated === true
      && bundle.validation.packageReinsertionValidated === true
      && bundle.validation.svgaAdapterInputReady === true
      && bundle.validation.actualAeRenderExecuted === manifest.execution.actualAeRenderExecuted
      && bundle.validation.runtimeProved === false
      && bundle.validation.installedQaAccepted === false
      && bundle.validation.productOwnerAccepted === false;
  } catch {
    return false;
  }
}

function validateSourceIr(sourceIr: AebFormatNeutralIr, manifest: AebBakeManifest): void {
  if (!isRecord(sourceIr)
    || !isRecord(sourceIr.source)
    || !isRecord(sourceIr.composition)
    || !isRecord(sourceIr.composition.canvas)
    || !isRecord(sourceIr.composition.timeRange)
    || !Array.isArray(sourceIr.layers)
    || sourceIr.layers.some((layer) => !isRecord(layer) || !Array.isArray(layer.replaceableElementIds))
    || !Array.isArray(sourceIr.resources)
    || sourceIr.resources.some((resource) => !isRecord(resource) || !isRecord(resource.contentHash))) {
    fail("SOURCE_IR_INVALID", "Format-neutral AEB IR is malformed.");
  }
  if (sourceIr.schemaVersion !== AEB_FORMAT_NEUTRAL_IR_SCHEMA_VERSION) {
    fail("SOURCE_IR_SCHEMA_UNSUPPORTED", "Unsupported format-neutral AEB IR schema.");
  }
  if (sourceIr.packageId !== manifest.job.packageId
    || sourceIr.source.compositionId !== manifest.job.source.compositionId
    || sourceIr.source.sourceFingerprint !== manifest.job.source.sourceFingerprint
    || sourceIr.source.scanDigest !== manifest.job.source.scanDigest
    || sourceIr.source.plannerDigest !== manifest.job.source.plannerDigest) {
    fail("SOURCE_IR_BINDING_MISMATCH", "Format-neutral AEB IR does not bind to the Bake manifest source.");
  }
  if (sourceIr.composition.canvas.width !== manifest.job.canvas.width
    || sourceIr.composition.canvas.height !== manifest.job.canvas.height
    || sourceIr.composition.fps !== manifest.job.fps
    || sourceIr.composition.timeRange.startFrame !== manifest.job.timeRange.startFrame
    || sourceIr.composition.timeRange.endFrameExclusive !== manifest.job.timeRange.endFrameExclusive) {
    fail("SOURCE_IR_COMPOSITION_MISMATCH", "Format-neutral AEB IR composition differs from the Bake job.");
  }

  const irLayerIds = sourceIr.layers.map((layer) => layer.layerId);
  const replaceableIds = sourceIr.layers.flatMap((layer) => layer.replaceableElementIds);
  const plannerDecisions = new Map(manifest.planner.decisions.map((decision) => [decision.layerId, decision.outcome]));
  if (irLayerIds.length === 0
    || new Set(irLayerIds).size !== irLayerIds.length
    || sourceIr.layers.length !== plannerDecisions.size
    || sourceIr.layers.some((layer) => plannerDecisions.get(layer.layerId) !== layer.plannerOutcome)
    || sourceIr.layers.some((layer) => !isIdentifier(layer.layerId) || !isIdentifier(layer.sourceId))
    || sourceIr.layers.some((layer) => layer.nativePayloadRef !== undefined && !isRelativePath(layer.nativePayloadRef))
    || replaceableIds.some((elementId) => !isIdentifier(elementId))
    || new Set(replaceableIds).size !== replaceableIds.length) {
    fail("SOURCE_IR_PLANNER_MISMATCH", "Format-neutral AEB IR layers do not exactly match the planner join.");
  }
  const resourceIds = sourceIr.resources.map((resource) => resource.resourceId);
  if (new Set(resourceIds).size !== resourceIds.length
    || sourceIr.resources.some((resource) => !isIdentifier(resource.resourceId)
      || !isIdentifier(resource.ownerLayerId)
      || !isRelativePath(resource.relativePath)
      || !isEncodedSha256(resource.contentHash))) {
    fail("SOURCE_IR_RESOURCE_INVALID", "Format-neutral AEB IR native resource inventory is malformed.");
  }
}

function copyLayer(layer: AebFormatNeutralIrLayer): AebFormatNeutralIrLayer {
  return {
    ...layer,
    replaceableElementIds: [...layer.replaceableElementIds].sort(compareCodeUnits)
  };
}

async function hashCanonical(hasher: EmbeddedResourceHasher, value: unknown): Promise<string> {
  const hash = await hasher.hash(new TextEncoder().encode(JSON.stringify(sortValue(value))));
  if (!isEncodedSha256(hash)) {
    fail("HASHER_CONTRACT_INVALID", "AEB package reinsertion requires encoded-byte SHA-256 hashes.");
  }
  return hash.value;
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

function isRelativePath(value: string): boolean {
  const segments = typeof value === "string" ? value.split("/") : [];
  return value !== ""
    && !value.includes("\\")
    && !value.startsWith("/")
    && segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function isEncodedSha256(hash: ResourceContentHash): boolean {
  return hash.algorithm === "sha256"
    && hash.scope === "encoded_bytes"
    && isSha256(hash.value);
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
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

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(sortValue(left)) === JSON.stringify(sortValue(right));
}

function isStrictlySorted(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || compareCodeUnits(values[index - 1], value) < 0);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}
