import { createHash } from "node:crypto";

export const AEB_RETAINED_AE_PLAN_SCHEMA = "aeb-retained-ae-discriminator-plan-v1";
export const AEB_RETAINED_AE_CHECKPOINT_SCHEMA = "aeb-retained-ae-checkpoint-publication-v1";
export const AEB_RETAINED_AE_APPROVAL_SCHEMA = "aeb-retained-ae-checkpoint-approval-v1";
export const AEB_RETAINED_AE_RESULT_SCHEMA = "aeb-retained-ae-discriminator-result-v1";
export const AEB_RETAINED_AE_EVIDENCE_SCHEMA = "aeb-retained-ae-runtime-evidence-v1";

export const AEB_RETAINED_AE_TASK_BASE = "/private/tmp/auto-svga-aeb-f2-s1-retained-ae-7920995d";
export const AEB_RETAINED_AE_REQUEST_ENV = "AUTO_SVGA_AEB_RETAINED_REQUEST";

export const AEB_RETAINED_AE_EXPECTED_HOST = Object.freeze({
  bundlePath: "/Applications/Adobe After Effects 2026/Adobe After Effects 2026.app",
  executablePath: "/Applications/Adobe After Effects 2026/Adobe After Effects 2026.app/Contents/MacOS/After Effects",
  bundleId: "com.adobe.AfterEffects.application",
  version: "26.3.0",
  build: "26.3.0.87",
  teamId: "JQ525L2MZD",
  executableSha256: "e24dbf277be8f8dd365d425da90fde442d33fea9de64de95c231cf347821ec46",
  cdHash: "0a0a028d5a8ca1ae55ce88d2d24e9bbe634eef7e",
  codeResourcesSha256: "c274e594188353227425669c18b257a5e070892d4fbdadf0246d44c18cb177cf"
});

export const AEB_RETAINED_AE_BUDGETS = Object.freeze({
  maxCheckpointBytes: 8 * 1024 * 1024,
  maxExchangeBytes: 64 * 1024,
  maxEncodedFrameBytes: 1024 * 1024,
  maxDecodedRgbaBytes: 4 * 4 * 4,
  maxAggregateEncodedBytes: 1024 * 1024,
  maxAggregateDecodedBytes: 4 * 4 * 4,
  maxFrames: 1,
  approvalWaitMs: 30_000,
  processTimeoutMs: 120_000,
  terminationGraceMs: 1_000
});

export interface AebRetainedAePlanInput {
  taskId: string;
  executionId: string;
}

export interface AebRetainedAeBakeAuthorityContext {
  kind: "f2_bake";
  sourceMode: "task_owned_controlled_fixture";
  bakePlanHash: string;
  jobId: string;
  packageId: string;
  sourceFingerprint: string;
  scanDigest: string;
  plannerDigest: string;
  sourceProjectContentHash: string;
  sourcePackageContentHash: string;
  composition: { id: string; name: string };
  targetLayerIds: readonly string[];
  timeRange: { startFrame: number; endFrameExclusive: number };
  fps: 1;
  canvas: { width: 4; height: 4 };
  alphaMode: "straight";
  frame: { frameIndex: number; relativePath: string };
}

export type AebRetainedAeAuthorityContext =
  | { kind: "discriminator_only" }
  | AebRetainedAeBakeAuthorityContext;

export interface AebRetainedAeRuntimePlan {
  schemaVersion: typeof AEB_RETAINED_AE_PLAN_SCHEMA;
  mode: "runtime_discriminator_planned";
  taskId: string;
  executionId: string;
  runDirectoryName: string;
  createdAtMs: number;
  expiresAtMs: number;
  phase: "planned";
  expectedHost: typeof AEB_RETAINED_AE_EXPECTED_HOST;
  authorityContext: AebRetainedAeAuthorityContext;
  jsx: {
    relativePath: "tools/aeb/f2/aeb-retained-ae-discriminator.jsx";
    sha256: string;
  };
  fixture: {
    kind: "scratch_only_2d_rgba";
    compositionName: "AEB3_F2_S1_RETAINED_FIXTURE";
    marker: string;
    width: 4;
    height: 4;
    fps: 1;
    frameCount: 1;
    alphaMode: "straight";
    outputRelativePath: "output/frame-0000.png";
  };
  budgets: typeof AEB_RETAINED_AE_BUDGETS;
  approvalTokenSha256: string;
  authorityClaims: {
    runtimeDiscriminatorOnly: true;
    actualAeBakeAuthorityMinted: false;
    packageAuthorityMinted: false;
    adapterAuthorityMinted: false;
  };
  planHash: string;
}

export interface AebSyntheticRetainedAePlan {
  schemaVersion: typeof AEB_RETAINED_AE_PLAN_SCHEMA;
  mode: "synthetic_discriminator_planned";
  taskId: string;
  executionId: string;
  phase: "planned";
  authorityClaims: AebRetainedAeRuntimePlan["authorityClaims"];
  planHash: string;
}

export interface AebRetainedAeFileBinding {
  relativePath: string;
  sha256: string;
  byteCount: number;
  device: string;
  inode: string;
  linkCount: 1;
  identityDigest: string;
}

export interface AebRetainedAeProcessBinding {
  pid: number;
  startIdentity: string;
  executablePath: typeof AEB_RETAINED_AE_EXPECTED_HOST.executablePath;
  executableSha256: typeof AEB_RETAINED_AE_EXPECTED_HOST.executableSha256;
  bundleId: typeof AEB_RETAINED_AE_EXPECTED_HOST.bundleId;
  version: typeof AEB_RETAINED_AE_EXPECTED_HOST.version;
  build: typeof AEB_RETAINED_AE_EXPECTED_HOST.build;
  teamId: typeof AEB_RETAINED_AE_EXPECTED_HOST.teamId;
  cdHash: typeof AEB_RETAINED_AE_EXPECTED_HOST.cdHash;
  codeResourcesSha256: typeof AEB_RETAINED_AE_EXPECTED_HOST.codeResourcesSha256;
}

export interface AebRetainedAeCheckpointPublication {
  schemaVersion: typeof AEB_RETAINED_AE_CHECKPOINT_SCHEMA;
  taskId: string;
  executionId: string;
  planHash: string;
  phase: "checkpoint_published";
  marker: string;
  composition: { id: string; name: string };
  checkpointRelativePath: "checkpoint/checkpoint.aep";
  checkpointSaveCompleted: true;
  appOpenCountAfterCheckpoint: 0;
  authorityContext: AebRetainedAeAuthorityContext;
  publicationHash: string;
}

export interface AebRetainedAeApproval {
  schemaVersion: typeof AEB_RETAINED_AE_APPROVAL_SCHEMA;
  taskId: string;
  executionId: string;
  planHash: string;
  phase: "checkpoint_approved";
  token: string;
  tokenSha256: string;
  issuedAtMs: number;
  expiresAtMs: number;
  process: AebRetainedAeProcessBinding;
  checkpoint: AebRetainedAeFileBinding;
  checkpointPublication: AebRetainedAeFileBinding;
  jsxSha256: string;
  composition: { id: string; name: string };
  marker: string;
  budgets: typeof AEB_RETAINED_AE_BUDGETS;
  approvalHash: string;
}

export interface AebRetainedAeApprovalExpectation {
  process: AebRetainedAeProcessBinding;
  checkpoint: AebRetainedAeFileBinding;
  checkpointPublication: AebRetainedAeFileBinding;
  composition: { id: string; name: string };
}

export interface AebRetainedAeResult {
  schemaVersion: typeof AEB_RETAINED_AE_RESULT_SCHEMA;
  taskId: string;
  executionId: string;
  planHash: string;
  phase: "transaction_completed";
  tokenSha256: string;
  process: { pid: number; startIdentity: string };
  marker: string;
  authorityContext: AebRetainedAeAuthorityContext;
  composition: { id: string; name: string };
  scanFacts: {
    twoDOnly: true;
    effectMatchNames: string[];
    maskModes: string[];
    expressionCount: number;
    audio: false;
    threeD: false;
    camera: false;
    thirdPartyPlugins: false;
  };
  renderQueue: {
    itemId: string;
    rqindex: number;
    outputModuleTemplate: "PNG Sequence with Alpha";
    renderStatus: "done";
  };
  output: {
    files: Array<{ relativePath: string; frameIndex: number }>;
  };
  rollback: {
    renderQueueItemRemoved: true;
    temporaryItemsRemoved: true;
    projectClosedWithoutSave: true;
  };
  continuation: {
    appOpenCountAfterCheckpoint: 0;
    approvalConsumedOnce: true;
    closeRequested: true;
  };
  unexpectedResidue: [];
  resultHash: string;
}

export interface AebRetainedAeRuntimeEvidence {
  schemaVersion: typeof AEB_RETAINED_AE_EVIDENCE_SCHEMA;
  mode: "runtime_discriminator_evidence";
  disposition: "feasible" | "infeasible";
  taskId: string;
  executionId: string;
  planHash: string;
  retainedAeTransactionObserved: boolean;
  processClosedNormally: boolean;
  actualAeBakeAuthorityMinted: false;
  packageAuthorityMinted: false;
  adapterAuthorityMinted: false;
  checkpoint: AebRetainedAeFileBinding;
  result: AebRetainedAeFileBinding;
  outputs: AebRetainedAeFileBinding[];
  unexpectedResidue: string[];
  evidenceHash: string;
}

export class AebRetainedAeDiscriminatorError extends Error {
  readonly disposition = "infeasible" as const;

  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "AebRetainedAeDiscriminatorError";
  }
}

export class AebRetainedAeApprovalGate {
  private consumed = false;

  constructor(
    private readonly plan: AebRetainedAeRuntimePlan,
    private readonly expected: AebRetainedAeApprovalExpectation
  ) {}

  consume(approval: AebRetainedAeApproval, nowMs: number): boolean {
    if (this.consumed || !verifyAebRetainedAeApproval(this.plan, approval, nowMs, this.expected)) {
      return false;
    }
    this.consumed = true;
    return true;
  }
}

export function createAebRetainedAeRuntimePlan(
  input: AebRetainedAePlanInput,
  jsxSha256: string,
  approvalTokenSha256: string,
  createdAtMs: number,
  authorityContext: AebRetainedAeAuthorityContext = { kind: "discriminator_only" }
): AebRetainedAeRuntimePlan {
  assertSafeId(input.taskId, "TASK_ID_INVALID");
  assertSafeId(input.executionId, "EXECUTION_ID_INVALID");
  assertSha256(jsxSha256, "JSX_HASH_INVALID");
  assertSha256(approvalTokenSha256, "APPROVAL_TOKEN_HASH_INVALID");
  if (!Number.isSafeInteger(createdAtMs) || createdAtMs <= 0) {
    fail("PLAN_TIME_INVALID", "The discriminator plan time is invalid.");
  }
  const runDirectoryName = `run-${sha256(`${input.taskId}\0${input.executionId}`)}`;
  const marker = `aeb3-f2-s1-${sha256(`${input.executionId}\0marker`).slice(0, 24)}`;
  const unsigned = {
    schemaVersion: AEB_RETAINED_AE_PLAN_SCHEMA as typeof AEB_RETAINED_AE_PLAN_SCHEMA,
    mode: "runtime_discriminator_planned" as const,
    taskId: input.taskId,
    executionId: input.executionId,
    runDirectoryName,
    createdAtMs,
    expiresAtMs: createdAtMs + AEB_RETAINED_AE_BUDGETS.processTimeoutMs,
    phase: "planned" as const,
    expectedHost: AEB_RETAINED_AE_EXPECTED_HOST,
    authorityContext: structuredClone(authorityContext),
    jsx: {
      relativePath: "tools/aeb/f2/aeb-retained-ae-discriminator.jsx" as const,
      sha256: jsxSha256
    },
    fixture: {
      kind: "scratch_only_2d_rgba" as const,
      compositionName: "AEB3_F2_S1_RETAINED_FIXTURE" as const,
      marker,
      width: 4 as const,
      height: 4 as const,
      fps: 1 as const,
      frameCount: 1 as const,
      alphaMode: "straight" as const,
      outputRelativePath: "output/frame-0000.png" as const
    },
    budgets: AEB_RETAINED_AE_BUDGETS,
    approvalTokenSha256,
    authorityClaims: {
      runtimeDiscriminatorOnly: true as const,
      actualAeBakeAuthorityMinted: false as const,
      packageAuthorityMinted: false as const,
      adapterAuthorityMinted: false as const
    }
  };
  return { ...unsigned, planHash: hashCanonical(unsigned) };
}

export function createSyntheticAebRetainedAeDiscriminatorPlan(
  input: AebRetainedAePlanInput
): AebSyntheticRetainedAePlan {
  assertSafeId(input.taskId, "TASK_ID_INVALID");
  assertSafeId(input.executionId, "EXECUTION_ID_INVALID");
  const unsigned = {
    schemaVersion: AEB_RETAINED_AE_PLAN_SCHEMA as typeof AEB_RETAINED_AE_PLAN_SCHEMA,
    mode: "synthetic_discriminator_planned" as const,
    taskId: input.taskId,
    executionId: input.executionId,
    phase: "planned" as const,
    authorityClaims: {
      runtimeDiscriminatorOnly: true as const,
      actualAeBakeAuthorityMinted: false as const,
      packageAuthorityMinted: false as const,
      adapterAuthorityMinted: false as const
    }
  };
  return { ...unsigned, planHash: hashCanonical(unsigned) };
}

export function createAebRetainedAeApproval(input: Omit<AebRetainedAeApproval, "approvalHash">): AebRetainedAeApproval {
  validateApprovalShape(input);
  return { ...input, approvalHash: hashCanonical(input) };
}

export function verifyAebRetainedAeApproval(
  plan: AebRetainedAeRuntimePlan,
  approval: AebRetainedAeApproval,
  nowMs: number,
  expected: AebRetainedAeApprovalExpectation
): boolean {
  try {
    validateRuntimePlan(plan);
    validateApprovalShape(approval);
    if (!Number.isSafeInteger(nowMs)
      || approval.approvalHash !== hashCanonical(withoutKey(approval, "approvalHash"))
      || approval.taskId !== plan.taskId
      || approval.executionId !== plan.executionId
      || approval.planHash !== plan.planHash
      || approval.tokenSha256 !== plan.approvalTokenSha256
      || sha256(approval.token) !== approval.tokenSha256
      || approval.issuedAtMs < plan.createdAtMs
      || approval.issuedAtMs > nowMs
      || approval.expiresAtMs !== Math.min(
        plan.expiresAtMs,
        plan.createdAtMs + plan.budgets.approvalWaitMs
      )
      || nowMs > approval.expiresAtMs
      || approval.jsxSha256 !== plan.jsx.sha256
      || approval.marker !== plan.fixture.marker
      || approval.composition.name !== plan.fixture.compositionName
      || !sameJson(approval.budgets, plan.budgets)
      || !sameJson(approval.process, expectedProcessProjection(approval.process))
      || !sameJson(approval.process, expected.process)
        || !sameJson(approval.checkpoint, expected.checkpoint)
        || !sameJson(approval.checkpointPublication, expected.checkpointPublication)
        || !sameJson(approval.composition, expected.composition)
      ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function verifyAebRetainedAeResult(
  plan: AebRetainedAeRuntimePlan,
  approval: AebRetainedAeApproval,
  result: AebRetainedAeResult
): boolean {
  try {
    assertKnownKeys(result as unknown as Record<string, unknown>, [
      "schemaVersion", "taskId", "executionId", "planHash", "phase", "tokenSha256", "process",
      "marker", "authorityContext", "composition", "scanFacts", "renderQueue", "output", "rollback", "continuation",
      "unexpectedResidue", "resultHash"
    ], "RESULT_FIELDS_INVALID");
    assertKnownKeys(result.process as unknown as Record<string, unknown>, ["pid", "startIdentity"], "RESULT_PROCESS_FIELDS_INVALID");
    assertKnownKeys(result.composition as unknown as Record<string, unknown>, ["id", "name"], "RESULT_COMPOSITION_FIELDS_INVALID");
    assertKnownKeys(result.scanFacts as unknown as Record<string, unknown>, [
      "twoDOnly", "effectMatchNames", "maskModes", "expressionCount", "audio", "threeD", "camera", "thirdPartyPlugins"
    ], "RESULT_SCAN_FIELDS_INVALID");
    assertKnownKeys(result.renderQueue as unknown as Record<string, unknown>, [
      "itemId", "rqindex", "outputModuleTemplate", "renderStatus"
    ], "RESULT_QUEUE_FIELDS_INVALID");
    assertKnownKeys(result.output as unknown as Record<string, unknown>, ["files"], "RESULT_OUTPUT_FIELDS_INVALID");
    assertKnownKeys(result.output.files[0] as unknown as Record<string, unknown>, [
      "relativePath", "frameIndex"
    ], "RESULT_OUTPUT_FILE_FIELDS_INVALID");
    assertKnownKeys(result.rollback as unknown as Record<string, unknown>, [
      "renderQueueItemRemoved", "temporaryItemsRemoved", "projectClosedWithoutSave"
    ], "RESULT_ROLLBACK_FIELDS_INVALID");
    assertKnownKeys(result.continuation as unknown as Record<string, unknown>, [
      "appOpenCountAfterCheckpoint", "approvalConsumedOnce", "closeRequested"
    ], "RESULT_CONTINUATION_FIELDS_INVALID");
    if (result.schemaVersion !== AEB_RETAINED_AE_RESULT_SCHEMA
      || result.phase !== "transaction_completed"
      || result.resultHash !== hashCanonical(withoutKey(result, "resultHash"))
      || result.taskId !== plan.taskId
      || result.executionId !== plan.executionId
      || result.planHash !== plan.planHash
      || result.tokenSha256 !== approval.tokenSha256
      || result.process.pid !== approval.process.pid
      || result.process.startIdentity !== approval.process.startIdentity
      || result.marker !== plan.fixture.marker
      || !sameJson(result.authorityContext, plan.authorityContext)
      || result.composition.id !== approval.composition.id
      || result.composition.name !== plan.fixture.compositionName
      || result.scanFacts.twoDOnly !== true
      || result.scanFacts.audio !== false
      || result.scanFacts.threeD !== false
      || result.scanFacts.camera !== false
      || result.scanFacts.thirdPartyPlugins !== false
      || !sameJson(result.scanFacts.effectMatchNames, ["ADBE Fill"])
      || !sameJson(result.scanFacts.maskModes, ["add"])
      || result.scanFacts.expressionCount !== 1
      || result.renderQueue.rqindex < 1
      || result.renderQueue.itemId !== `${plan.fixture.marker}-rq-${result.renderQueue.rqindex}`
      || result.renderQueue.outputModuleTemplate !== "PNG Sequence with Alpha"
      || result.renderQueue.renderStatus !== "done"
      || result.output.files.length !== 1
      || result.output.files[0]?.relativePath !== plan.fixture.outputRelativePath
      || result.output.files[0]?.frameIndex !== (plan.authorityContext.kind === "f2_bake"
        ? plan.authorityContext.frame.frameIndex
        : 0)
      || result.rollback.renderQueueItemRemoved !== true
      || result.rollback.temporaryItemsRemoved !== true
      || result.rollback.projectClosedWithoutSave !== true
      || result.continuation.appOpenCountAfterCheckpoint !== 0
      || result.continuation.approvalConsumedOnce !== true
      || result.continuation.closeRequested !== true
      || result.unexpectedResidue.length !== 0) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function validateRuntimePlan(plan: AebRetainedAeRuntimePlan): void {
  assertKnownKeys(plan as unknown as Record<string, unknown>, [
    "schemaVersion", "mode", "taskId", "executionId", "runDirectoryName", "createdAtMs", "expiresAtMs",
    "phase", "expectedHost", "authorityContext", "jsx", "fixture", "budgets", "approvalTokenSha256", "authorityClaims", "planHash"
  ], "PLAN_FIELDS_INVALID");
  assertKnownKeys(plan.jsx as unknown as Record<string, unknown>, ["relativePath", "sha256"], "PLAN_JSX_FIELDS_INVALID");
  assertKnownKeys(plan.fixture as unknown as Record<string, unknown>, [
    "kind", "compositionName", "marker", "width", "height", "fps", "frameCount", "alphaMode", "outputRelativePath"
  ], "PLAN_FIXTURE_FIELDS_INVALID");
  assertKnownKeys(plan.authorityClaims as unknown as Record<string, unknown>, [
    "runtimeDiscriminatorOnly", "actualAeBakeAuthorityMinted", "packageAuthorityMinted", "adapterAuthorityMinted"
  ], "PLAN_AUTHORITY_FIELDS_INVALID");
  if (plan.schemaVersion !== AEB_RETAINED_AE_PLAN_SCHEMA
    || plan.mode !== "runtime_discriminator_planned"
    || plan.phase !== "planned"
    || !Number.isSafeInteger(plan.createdAtMs)
    || plan.createdAtMs <= 0
    || plan.planHash !== hashCanonical(withoutKey(plan, "planHash"))
    || plan.runDirectoryName !== `run-${sha256(`${plan.taskId}\0${plan.executionId}`)}`
    || plan.expiresAtMs !== plan.createdAtMs + plan.budgets.processTimeoutMs
    || !sameJson(plan.expectedHost, AEB_RETAINED_AE_EXPECTED_HOST)
    || !isAuthorityContextValid(plan.authorityContext)
    || !sameJson(plan.budgets, AEB_RETAINED_AE_BUDGETS)
    || !sameJson(plan.jsx, {
      relativePath: "tools/aeb/f2/aeb-retained-ae-discriminator.jsx",
      sha256: plan.jsx.sha256
    })
    || !sameJson(plan.fixture, {
      kind: "scratch_only_2d_rgba",
      compositionName: "AEB3_F2_S1_RETAINED_FIXTURE",
      marker: `aeb3-f2-s1-${sha256(`${plan.executionId}\0marker`).slice(0, 24)}`,
      width: 4,
      height: 4,
      fps: 1,
      frameCount: 1,
      alphaMode: "straight",
      outputRelativePath: "output/frame-0000.png"
    })
    || !sameJson(plan.authorityClaims, {
      runtimeDiscriminatorOnly: true,
      actualAeBakeAuthorityMinted: false,
      packageAuthorityMinted: false,
      adapterAuthorityMinted: false
    })) {
    fail("PLAN_INVALID", "The retained AE discriminator plan is invalid.");
  }
  assertSafeId(plan.taskId, "TASK_ID_INVALID");
  assertSafeId(plan.executionId, "EXECUTION_ID_INVALID");
  assertSha256(plan.jsx.sha256, "JSX_HASH_INVALID");
  assertSha256(plan.approvalTokenSha256, "APPROVAL_TOKEN_HASH_INVALID");
}

function isAuthorityContextValid(value: AebRetainedAeAuthorityContext): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value.kind === "discriminator_only") {
    return sameJson(value, { kind: "discriminator_only" });
  }
  if (value.kind !== "f2_bake") return false;
  const keys = Object.keys(value).sort(compareCodeUnits);
  const expectedKeys = [
    "kind", "sourceMode", "bakePlanHash", "jobId", "packageId", "sourceFingerprint", "scanDigest",
    "plannerDigest", "sourceProjectContentHash", "sourcePackageContentHash", "composition",
    "targetLayerIds", "timeRange", "fps", "canvas", "alphaMode", "frame"
  ].sort(compareCodeUnits);
  return sameJson(keys, expectedKeys)
    && value.sourceMode === "task_owned_controlled_fixture"
    && [
      value.bakePlanHash,
      value.sourceFingerprint,
      value.scanDigest,
      value.plannerDigest,
      value.sourceProjectContentHash,
      value.sourcePackageContentHash
    ].every((item) => typeof item === "string" && /^[a-f0-9]{64}$/.test(item))
    && typeof value.jobId === "string"
    && typeof value.packageId === "string"
    && typeof value.composition?.id === "string"
    && typeof value.composition?.name === "string"
    && value.composition.name.length > 0
    && Array.isArray(value.targetLayerIds)
    && value.targetLayerIds.length > 0
    && new Set(value.targetLayerIds).size === value.targetLayerIds.length
    && value.targetLayerIds.every((item) => typeof item === "string" && item.length > 0)
    && Number.isSafeInteger(value.timeRange?.startFrame)
    && value.timeRange.endFrameExclusive === value.timeRange.startFrame + 1
    && value.fps === 1
    && value.canvas?.width === 4
    && value.canvas?.height === 4
    && value.alphaMode === "straight"
    && value.frame?.frameIndex === value.timeRange.startFrame
    && typeof value.frame.relativePath === "string"
    && /^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/.test(value.frame.relativePath)
    && !value.frame.relativePath.startsWith("/")
    && !value.frame.relativePath.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
}

export function hashCanonical(value: unknown): string {
  return sha256(canonicalJson(value));
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function validateApprovalShape(value: Omit<AebRetainedAeApproval, "approvalHash"> | AebRetainedAeApproval): void {
  const allowed = [
    "schemaVersion", "taskId", "executionId", "planHash", "phase", "token", "tokenSha256",
    "issuedAtMs", "expiresAtMs", "process", "checkpoint", "checkpointPublication", "jsxSha256",
    "composition", "marker", "budgets"
  ];
  if ("approvalHash" in value) allowed.push("approvalHash");
  assertKnownKeys(value as unknown as Record<string, unknown>, allowed, "APPROVAL_FIELDS_INVALID");
  assertKnownKeys(value.process as unknown as Record<string, unknown>, [
    "pid", "startIdentity", "executablePath", "executableSha256", "bundleId", "version", "build",
    "teamId", "cdHash", "codeResourcesSha256"
  ], "APPROVAL_PROCESS_FIELDS_INVALID");
  assertKnownKeys(value.checkpoint as unknown as Record<string, unknown>, [
    "relativePath", "sha256", "byteCount", "device", "inode", "linkCount", "identityDigest"
  ], "APPROVAL_CHECKPOINT_FIELDS_INVALID");
  assertKnownKeys(value.checkpointPublication as unknown as Record<string, unknown>, [
    "relativePath", "sha256", "byteCount", "device", "inode", "linkCount", "identityDigest"
  ], "APPROVAL_PUBLICATION_FIELDS_INVALID");
  assertKnownKeys(value.composition as unknown as Record<string, unknown>, ["id", "name"], "APPROVAL_COMPOSITION_FIELDS_INVALID");
  if (value.schemaVersion !== AEB_RETAINED_AE_APPROVAL_SCHEMA
    || value.phase !== "checkpoint_approved"
    || typeof value.token !== "string"
    || value.token.length < 32
    || !Number.isSafeInteger(value.issuedAtMs)
    || !Number.isSafeInteger(value.expiresAtMs)
    || value.expiresAtMs <= value.issuedAtMs
    || !Number.isSafeInteger(value.process.pid)
    || value.process.pid <= 0
    || !/^[a-f0-9]{64}$/.test(value.process.startIdentity)
    || !/^[1-9][0-9]*$/.test(value.composition.id)
    || typeof value.composition.name !== "string"
    || value.composition.name === ""
    || value.checkpoint.linkCount !== 1
    || value.checkpointPublication.linkCount !== 1) {
    fail("APPROVAL_INVALID", "The retained AE checkpoint approval is invalid.");
  }
  assertSha256(value.tokenSha256, "APPROVAL_TOKEN_HASH_INVALID");
  assertSha256(value.jsxSha256, "JSX_HASH_INVALID");
  assertSha256(value.checkpoint.sha256, "CHECKPOINT_HASH_INVALID");
  assertSha256(value.checkpointPublication.sha256, "CHECKPOINT_PUBLICATION_HASH_INVALID");
  assertFileBinding(value.checkpoint, "CHECKPOINT_BINDING_INVALID");
  assertFileBinding(value.checkpointPublication, "CHECKPOINT_PUBLICATION_BINDING_INVALID");
}

function assertFileBinding(value: AebRetainedAeFileBinding, code: string): void {
  if (typeof value.relativePath !== "string"
    || value.relativePath === ""
    || !Number.isSafeInteger(value.byteCount)
    || value.byteCount <= 0
    || !/^[0-9]+$/.test(value.device)
    || !/^[0-9]+$/.test(value.inode)
    || value.linkCount !== 1) {
    fail(code, "The retained AE file binding is invalid.");
  }
  assertSha256(value.sha256, code);
  assertSha256(value.identityDigest, code);
}

function expectedProcessProjection(process: AebRetainedAeProcessBinding): AebRetainedAeProcessBinding {
  return {
    pid: process.pid,
    startIdentity: process.startIdentity,
    executablePath: AEB_RETAINED_AE_EXPECTED_HOST.executablePath,
    executableSha256: AEB_RETAINED_AE_EXPECTED_HOST.executableSha256,
    bundleId: AEB_RETAINED_AE_EXPECTED_HOST.bundleId,
    version: AEB_RETAINED_AE_EXPECTED_HOST.version,
    build: AEB_RETAINED_AE_EXPECTED_HOST.build,
    teamId: AEB_RETAINED_AE_EXPECTED_HOST.teamId,
    cdHash: AEB_RETAINED_AE_EXPECTED_HOST.cdHash,
    codeResourcesSha256: AEB_RETAINED_AE_EXPECTED_HOST.codeResourcesSha256
  };
}

function assertKnownKeys(value: Record<string, unknown>, expected: readonly string[], code: string): void {
  const actual = Object.keys(value).sort(compareCodeUnits);
  const allowed = [...expected].sort(compareCodeUnits);
  if (!sameJson(actual, allowed)) {
    fail(code, "The retained AE discriminator object contains missing or unknown fields.");
  }
}

function assertSafeId(value: string, code: string): void {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/.test(value)) {
    fail(code, "The retained AE discriminator identifier is invalid.");
  }
}

function assertSha256(value: string, code: string): void {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    fail(code, "The retained AE discriminator SHA-256 value is invalid.");
  }
}

function withoutKey<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
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

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameJson(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function fail(code: string, message: string): never {
  throw new AebRetainedAeDiscriminatorError(code, message);
}
