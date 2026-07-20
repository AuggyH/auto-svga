import type { EmbeddedResourceHasher } from "./resource-hasher.js";

export const AEB_BAKE_JOB_SCHEMA_VERSION = "aeb-bake-job-v1" as const;
export const AEB_BAKE_PLANNER_JOIN_SCHEMA_VERSION = "aeb-bake-planner-join-v1" as const;
export const AEB_BAKE_TASK_RECEIPT_SCHEMA_VERSION = "aeb-bake-task-receipt-v1" as const;
export const AEB_BAKE_MANIFEST_SCHEMA_VERSION = "aeb-bake-manifest-v1" as const;
export const AEB_FORMAT_NEUTRAL_IR_SCHEMA_VERSION = "aeb-format-neutral-ir-v1" as const;
export const AEB_NATIVE_LAYER_PAYLOAD_SCHEMA_VERSION = "aeb-native-layer-payload-v1" as const;
export const AEB_REINSERTED_PACKAGE_SCHEMA_VERSION = "aeb-reinserted-package-v1" as const;
export const AEB_BAKE_EXECUTION_RECEIPT_SCHEMA_VERSION = "aeb-bake-execution-receipt-v1" as const;
export const AEB_PHYSICAL_SUCCESSOR_SCHEMA_VERSION = "aeb-physical-successor-package-v1" as const;
export const AEB_PUBLICATION_RECEIPT_SCHEMA_VERSION = "aeb-package-publication-receipt-v1" as const;
export const AEB_PUBLICATION_ROLLBACK_RECEIPT_SCHEMA_VERSION = "aeb-package-publication-rollback-receipt-v1" as const;

export type AebBakePlannerOutcome = "native" | "bake_required" | "blocked";

export interface AebBakeSourceBinding {
  compositionId: string;
  sourceFingerprint: string;
  scanDigest: string;
  plannerDigest: string;
}

export interface AebBakeJob {
  schemaVersion: typeof AEB_BAKE_JOB_SCHEMA_VERSION;
  jobId: string;
  packageId: string;
  source: AebBakeSourceBinding;
  target: {
    kind: "layer" | "precomp";
    sourceId: string;
    layerIds: readonly string[];
    replaceableElementIds: readonly string[];
  };
  timeRange: {
    startFrame: number;
    endFrameExclusive: number;
  };
  fps: number;
  canvas: {
    width: number;
    height: number;
  };
  alphaMode: "straight";
  bbox: {
    mode: "full_canvas" | "tight";
    x: number;
    y: number;
    width: number;
    height: number;
  };
  budgets: {
    maxFrames: number;
    maxEncodedBytes: number;
    maxDecodedRgbaBytes: number;
    maxPackageBytes: number;
  };
  task: {
    taskId: string;
    receiptId: string;
  };
  safety: {
    sourceProjectMutationAllowed: false;
    replaceablePolicy: "preserve";
    cleanupRequired: true;
    rollbackReceiptRequired: true;
  };
}

export interface AebBakePlannerDecision {
  layerId: string;
  outcome: AebBakePlannerOutcome;
  reason: string;
}

export interface AebBakePlannerJoin {
  schemaVersion: typeof AEB_BAKE_PLANNER_JOIN_SCHEMA_VERSION;
  jobId: string;
  sourceFingerprint: string;
  scanDigest: string;
  plannerDigest: string;
  decisions: readonly AebBakePlannerDecision[];
}

export interface AebBakeTaskReceipt {
  schemaVersion: typeof AEB_BAKE_TASK_RECEIPT_SCHEMA_VERSION;
  taskId: string;
  receiptId: string;
  jobId: string;
  packageId: string;
  sourceFingerprint: string;
  outputDirectory: ".";
  cleanupPolicy: "delete_task_root_after_consumption";
  rollbackPolicy: "preserve_source_package";
  sourceProjectMutationAllowed: false;
  producer: "synthetic_fixture" | "after_effects";
}

export interface AebBakeFrameSource {
  frameIndex: number;
  relativePath: string;
}

export interface AebBakeReadResource {
  bytes: Uint8Array;
  encodedBytes: number;
  width: number;
  height: number;
  decodedRgbaBytes: number;
  alphaBounds:
    | { status: "fully_transparent" }
    | { status: "known"; x: number; y: number; width: number; height: number };
  fileIdentity: string;
}

export interface AebBakeResourceReader {
  verifyTaskReceipt(expected: AebBakeTaskReceipt): Promise<void>;
  readFrame(
    source: AebBakeFrameSource,
    expected: {
      width: number;
      height: number;
      maxEncodedBytes: number;
      maxDecodedRgbaBytes: number;
    }
  ): Promise<AebBakeReadResource>;
}

export interface AebBakeExecutionReceipt {
  schemaVersion: typeof AEB_BAKE_EXECUTION_RECEIPT_SCHEMA_VERSION;
  mode: "synthetic_fixture" | "after_effects";
  jobId: string;
  taskId: string;
  taskReceiptId: string;
  sourceFingerprint: string;
  scanDigest: string;
  plannerDigest: string;
  frameInventoryDigest: string;
  actualAeRenderExecuted: boolean;
  evidence:
    | { kind: "synthetic_fixture"; fixtureId: string }
    | {
      kind: "after_effects";
      hostSessionId: string;
      aeVersion: string;
      scriptDigest: string;
      renderReceiptDigest: string;
    };
  receiptHash: string;
}

export interface AebBakeExecutionVerificationInput {
  job: AebBakeJob;
  planner: AebBakePlannerJoin;
  taskReceipt: AebBakeTaskReceipt;
  frames: readonly AebBakeFrameSource[];
  executionReceipt: AebBakeExecutionReceipt;
  hasher: EmbeddedResourceHasher;
}

export interface AebBakeExecutionAuthority {
  verifyExecution(input: AebBakeExecutionVerificationInput): Promise<boolean>;
  verifyManifest(manifest: AebBakeManifest): Promise<boolean>;
}

export interface AebBakeManifestFrame {
  frameIndex: number;
  relativePath: string;
  resourceId: string;
  canonicalResourceId: string;
  contentHash: { algorithm: "sha256"; value: string; scope: "encoded_bytes" };
  encodedBytes: number;
  decodedRgbaBytes: number;
  width: number;
  height: number;
  alphaBounds: AebBakeReadResource["alphaBounds"];
}

export interface AebBakeManifest {
  schemaVersion: typeof AEB_BAKE_MANIFEST_SCHEMA_VERSION;
  manifestId: string;
  job: {
    schemaVersion: typeof AEB_BAKE_JOB_SCHEMA_VERSION;
    jobId: string;
    packageId: string;
    source: AebBakeSourceBinding;
    target: AebBakeJob["target"];
    timeRange: AebBakeJob["timeRange"];
    fps: number;
    canvas: AebBakeJob["canvas"];
    alphaMode: "straight";
    bbox: AebBakeJob["bbox"];
    budgets: AebBakeJob["budgets"];
  };
  planner: {
    schemaVersion: typeof AEB_BAKE_PLANNER_JOIN_SCHEMA_VERSION;
    decisions: readonly AebBakePlannerDecision[];
  };
  execution: {
    mode: "synthetic_fixture" | "after_effects";
    receiptHash: string;
    frameInventoryDigest: string;
    actualAeRenderExecuted: boolean;
  };
  frames: readonly AebBakeManifestFrame[];
  resources: {
    frameCount: number;
    uniqueContentCount: number;
    deduplicatedFrameCount: number;
    totalEncodedBytes: number;
    totalDecodedRgbaBytes: number;
    estimatedPackageBytes: number;
  };
  reinsertion: {
    packageId: string;
    targetSourceId: string;
    replaceBakedLayerIds: readonly string[];
    preserveNativeLayerIds: readonly string[];
    preservedReplaceableElementIds: readonly string[];
    blockedLayerIds: readonly string[];
    resourceManifestId: string;
    contractValidated: true;
    packageReinserted: false;
  };
  safety: {
    taskId: string;
    receiptId: string;
    sourceProjectMutationAllowed: false;
    replaceablePolicy: "preserve";
    cleanupPolicy: "delete_task_root_after_consumption";
    rollbackPolicy: "preserve_source_package";
    taskOwnedPathsVerified: true;
  };
  validation: {
    adapterNeutralValidated: true;
    packageReinsertionValidated: false;
    actualAeRenderExecuted: boolean;
    runtimeProved: false;
    installedQaAccepted: false;
    productOwnerAccepted: false;
    finalEncoderValidationRequired: true;
  };
  futureAdapters: {
    svga: "awaiting_package_reinsertion";
    vap: "not_implemented";
    lottie: "not_implemented";
    pag: "not_implemented";
  };
}

export interface AebFormatNeutralIrLayer {
  layerId: string;
  sourceId: string;
  plannerOutcome: AebBakePlannerOutcome;
  replaceableElementIds: readonly string[];
  nativePayloadRef?: string;
  stackIndex?: number;
  activeRange?: AebBakeJob["timeRange"];
  nativePayload?: AebNativeLayerPayload;
}

export interface AebNativeLayerPayload {
  schemaVersion: typeof AEB_NATIVE_LAYER_PAYLOAD_SCHEMA_VERSION;
  resourceId: string;
  imageKey: string;
  width: number;
  height: number;
  anchor: { x: number; y: number };
  transform: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    opacity: number;
  };
  keyframes: readonly {
    frame: number;
    x?: number;
    y?: number;
    scaleX?: number;
    scaleY?: number;
    rotation?: number;
    opacity?: number;
  }[];
  payloadHash: string;
}

export interface AebFormatNeutralIrResource {
  resourceId: string;
  relativePath: string;
  contentHash: { algorithm: "sha256"; value: string; scope: "encoded_bytes" };
  ownerLayerId: string;
}

export interface AebFormatNeutralIr {
  schemaVersion: typeof AEB_FORMAT_NEUTRAL_IR_SCHEMA_VERSION;
  packageId: string;
  source: AebBakeSourceBinding;
  composition: {
    canvas: AebBakeJob["canvas"];
    fps: number;
    timeRange: AebBakeJob["timeRange"];
  };
  layers: readonly AebFormatNeutralIrLayer[];
  resources: readonly AebFormatNeutralIrResource[];
}

export interface AebReinsertedPackage {
  schemaVersion: typeof AEB_REINSERTED_PACKAGE_SCHEMA_VERSION;
  packageBundleId: string;
  packageId: string;
  source: AebBakeSourceBinding;
  composition: AebFormatNeutralIr["composition"];
  bakeManifest: AebBakeManifest;
  preservedNativeLayers: readonly AebFormatNeutralIrLayer[];
  bakedSequences: readonly {
    sequenceId: string;
    targetSourceId: string;
    replacesLayerIds: readonly string[];
    frames: readonly AebBakeManifestFrame[];
  }[];
  resources: {
    native: readonly AebFormatNeutralIrResource[];
    bakedCanonicalResourceIds: readonly string[];
  };
  validation: {
    sourceBindingValidated: true;
    plannerJoinValidated: true;
    replaceableElementsPreserved: true;
    resourceClosureValidated: true;
    packageReinsertionValidated: true;
    svgaAdapterInputReady: true;
    actualAeRenderExecuted: boolean;
    runtimeProved: false;
    installedQaAccepted: false;
    productOwnerAccepted: false;
  };
}

export interface AebPhysicalSuccessorPackage {
  schemaVersion: typeof AEB_PHYSICAL_SUCCESSOR_SCHEMA_VERSION;
  sourcePackage: {
    relativePath: string;
    encodedBytes: number;
    contentHash: { algorithm: "sha256"; value: string; scope: "encoded_bytes" };
    bytesBase64: string;
  };
  reinsertedPackage: AebReinsertedPackage;
  publicationReceipt: {
    taskId: string;
    receiptId: string;
    executionReceiptHash: string;
    manifestId: string;
    packageBundleId: string;
    atomicAbsentDestination: true;
    noOverwrite: true;
    rollbackOnFailure: true;
    temporaryPathCleanupRequired: true;
    sourceMutationAllowed: false;
  };
}

export interface AebPackagePublicationReceipt {
  schemaVersion: typeof AEB_PUBLICATION_RECEIPT_SCHEMA_VERSION;
  receiptId: string;
  taskId: string;
  jobId: string;
  packageId: string;
  sourceFingerprint: string;
  sourcePackage: {
    relativePath: string;
    encodedBytes: number;
    contentHash: { algorithm: "sha256"; value: string; scope: "encoded_bytes" };
    preIdentityDigest: string;
    postIdentityDigest: string;
    unchanged: true;
  };
  successorPackage: {
    relativePath: string;
    encodedBytes: number;
    contentHash: { algorithm: "sha256"; value: string; scope: "encoded_bytes" };
    atomicAbsentDestination: true;
    noOverwrite: true;
  };
  joins: {
    executionReceiptHash: string;
    manifestId: string;
    packageBundleId: string;
  };
  cleanup: {
    temporaryPathRemoved: true;
    rollbackOnFailure: true;
    rollbackPerformed: false;
    partialSuccessorPresent: false;
  };
  receiptHash: string;
}

export interface AebPackagePublicationRollbackReceipt {
  schemaVersion: typeof AEB_PUBLICATION_ROLLBACK_RECEIPT_SCHEMA_VERSION;
  taskId: string;
  receiptId: string;
  jobId: string;
  packageId: string;
  phase: "write" | "finalize" | "cleanup" | "verification";
  sourcePackage: {
    relativePath: string;
    contentHash: { algorithm: "sha256"; value: string; scope: "encoded_bytes" };
    preIdentityDigest: string;
    postIdentityDigest: string;
    unchanged: true;
  };
  successorPackage: {
    relativePath: string;
    ownedDestinationCreated: boolean;
    ownedDestinationRemoved: boolean;
    partialSuccessorPresent: false;
  };
  cleanup: {
    temporaryPathCreated: boolean;
    temporaryPathRemoved: true;
    rollbackPerformed: boolean;
  };
  receiptHash: string;
}

export interface AebPackagePublicationRollbackAuthority {
  taskId: string;
  receiptId: string;
  jobId: string;
  packageId: string;
  sourcePackage: {
    relativePath: string;
    contentHash: { algorithm: "sha256"; value: string; scope: "encoded_bytes" };
    identityDigest: string;
  };
  successorPackage: {
    relativePath: string;
  };
}

export interface AebPublishedSuccessorPackage {
  bundle: AebReinsertedPackage;
  publicationReceipt: AebPackagePublicationReceipt;
}

export interface AebPackagePublicationAuthorityVerifier {
  verifyPublishedSuccessor(
    published: AebPublishedSuccessorPackage,
    hasher: EmbeddedResourceHasher
  ): Promise<boolean>;
}

export interface BuildAebBakeManifestInput {
  job: AebBakeJob;
  planner: AebBakePlannerJoin;
  taskReceipt: AebBakeTaskReceipt;
  frames: readonly AebBakeFrameSource[];
  executionReceipt: AebBakeExecutionReceipt;
  executionAuthority?: AebBakeExecutionAuthority;
  reader: AebBakeResourceReader;
  hasher: EmbeddedResourceHasher;
}
