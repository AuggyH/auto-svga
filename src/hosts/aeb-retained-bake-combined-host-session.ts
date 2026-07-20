import { createHash } from "node:crypto";
import { lstat } from "node:fs/promises";
import { AEB_RETAINED_AE_EXPECTED_HOST } from "../experiments/aeb-retained-ae-discriminator/contracts.js";
import {
  AEB_RETAINED_AE_BAKE_HOST_DESCRIPTOR,
  NodeAebRetainedAeBakeHostAdapter
} from "../experiments/aeb-retained-ae-discriminator/runtime.js";
import {
  AEB_FORMAT_NEUTRAL_IR_SCHEMA_VERSION,
  type AebFormatNeutralIr
} from "../workbench/aeb-bake-contracts.js";
import { AebBakePipelineError } from "../workbench/aeb-bake-pipeline.js";
import type { AebAeBakeExecutionPlan } from "../workbench/aeb-ae-bake-execution.js";
import { verifyAebAeBakeExecutionPlan } from "../workbench/aeb-ae-bake-execution.js";
import {
  NodeAebBoundedAeBakeExecutor,
  cleanupReceiptFile,
  planFile,
  producerReceiptFile,
  type AebBoundedAeBakeExecutionResult,
  type ExecuteAebBoundedAeBakeOptions
} from "./aeb-node-bounded-ae-bake-executor.js";
import {
  NodeAebBakeResourceReader,
  NodeAebTaskRootAuthority,
  type AebBoundedTaskFile
} from "./aeb-node-bake-resource-reader.js";
import {
  NodeAebRetainedBakeCombinedSourceFlow,
  type AebRetainedBakeCombinedSourceFlowReport
} from "./aeb-retained-bake-combined-source-flow.js";
import { Sha256ResourceHasher } from "./sha256-resource-hasher.js";

export const AEB_RETAINED_BAKE_COMBINED_HOST_INPUT_SCHEMA_VERSION =
  "aeb-retained-bake-combined-host-input-v2" as const;

export interface PrepareAebRetainedBakeCombinedHostInput {
  plan: AebAeBakeExecutionPlan;
  sourceIr: AebFormatNeutralIr;
  successorFileName: string;
}

export interface AebRetainedBakeCombinedHostInput {
  schemaVersion: typeof AEB_RETAINED_BAKE_COMBINED_HOST_INPUT_SCHEMA_VERSION;
  authorityState: "retained_bake_combined_host_input_prepared";
  taskId: string;
  executionId: string;
  jobId: string;
  packageId: string;
  planHash: string;
  planBytesHash: string;
  sourceIrHash: string;
  host: typeof AEB_RETAINED_AE_BAKE_HOST_DESCRIPTOR;
  runtimeHost: typeof AEB_RETAINED_AE_EXPECTED_HOST;
  classification: {
    nativeLayerIds: readonly string[];
    bakeRequiredLayerIds: readonly string[];
    blockedLayerIds: readonly string[];
    preservedReplaceableElementIds: readonly string[];
  };
  source: {
    project: AebRetainedBakeCombinedSourceBinding;
    package: AebRetainedBakeCombinedSourceBinding;
    immutable: true;
  };
  expectedOutput: {
    successorPackageRelativePath: string;
    framesDirectory: string;
    frames: readonly { frameIndex: number; relativePath: string }[];
    canvas: { width: 4; height: 4 };
    fps: 1;
    alphaMode: "straight";
    standardsValidSvgaFragmentRequired: true;
    nativeMergeRequired: true;
    fullCompositionRequired: true;
  };
  authorityClaims: {
    preparedOnly: true;
    actualAeBakeAuthorityMinted: false;
    packageAuthorityMinted: false;
    adapterAuthorityMinted: false;
    previewOrSaveAuthorized: false;
  };
  inputHash: string;
}

export interface AebRetainedBakeCombinedSourceBinding {
  relativePath: string;
  contentHash: string;
  encodedBytes: number;
  identityDigest: string;
}

export interface AebRetainedBakeCombinedHostSessionResult {
  preparedInput: AebRetainedBakeCombinedHostInput;
  execution: AebBoundedAeBakeExecutionResult;
  report: AebRetainedBakeCombinedSourceFlowReport;
}

const retainedRuntimeResults = new WeakSet<AebRetainedBakeCombinedHostSessionResult>();

export function consumeAebRetainedBakeCombinedHostRuntimeCapability(
  result: AebRetainedBakeCombinedHostSessionResult
): boolean {
  if (!retainedRuntimeResults.has(result)) return false;
  retainedRuntimeResults.delete(result);
  return true;
}

interface PrivatePreparedInputState {
  plan: AebAeBakeExecutionPlan;
  sourceIr: AebFormatNeutralIr;
  successorFileName: string;
  project: AebRetainedBakeCombinedSourceBinding;
  package: AebRetainedBakeCombinedSourceBinding;
  consumed: boolean;
}

export class NodeAebRetainedBakeCombinedHostSession {
  private readonly hasher = new Sha256ResourceHasher();
  private readonly preparedInputs = new WeakMap<AebRetainedBakeCombinedHostInput, PrivatePreparedInputState>();

  constructor(private readonly authority: NodeAebTaskRootAuthority) {}

  async prepare(
    input: PrepareAebRetainedBakeCombinedHostInput
  ): Promise<AebRetainedBakeCombinedHostInput> {
    const plan = deepFreeze(structuredClone(input.plan));
    const sourceIr = deepFreeze(structuredClone(input.sourceIr));
    if (!await verifyAebAeBakeExecutionPlan(plan, this.hasher)) {
      fail("AE_RETAINED_COMBINED_HOST_PLAN_INVALID", "Combined host session requires a valid bounded Bake plan.");
    }
    validateRetainedSlice(this.authority, plan);
    const classification = validateClassification(plan, sourceIr);
    validateSuccessorName(input.successorFileName, plan);

    const reader = new NodeAebBakeResourceReader(this.authority);
    await reader.verifyTaskReceipt(plan.taskReceipt);
    const projectFile = await this.authority.readBoundedTaskFile(
      plan.sourceFiles.projectRelativePath,
      plan.sourceFiles.projectMaxBytes,
      "SOURCE_PROJECT"
    );
    const packageFile = await this.authority.readBoundedTaskFile(
      plan.sourceFiles.packageRelativePath,
      plan.sourceFiles.packageMaxBytes,
      "SOURCE_PACKAGE"
    );
    const project = bindSource(projectFile, plan.sourceFiles.projectRelativePath, plan.sourceFiles.projectContentHash);
    const sourcePackage = bindSource(packageFile, plan.sourceFiles.packageRelativePath, plan.sourceFiles.packageContentHash);
    await this.assertFreshExecutionPaths(plan, input.successorFileName);

    const unsigned: Omit<AebRetainedBakeCombinedHostInput, "inputHash"> = {
      schemaVersion: AEB_RETAINED_BAKE_COMBINED_HOST_INPUT_SCHEMA_VERSION,
      authorityState: "retained_bake_combined_host_input_prepared",
      taskId: plan.job.task.taskId,
      executionId: plan.executionId,
      jobId: plan.job.jobId,
      packageId: plan.job.packageId,
      planHash: plan.planHash,
      planBytesHash: sha256Canonical(plan),
      sourceIrHash: sha256Canonical(sourceIr),
      host: { ...AEB_RETAINED_AE_BAKE_HOST_DESCRIPTOR },
      runtimeHost: { ...AEB_RETAINED_AE_EXPECTED_HOST },
      classification,
      source: { project, package: sourcePackage, immutable: true },
      expectedOutput: {
        successorPackageRelativePath: input.successorFileName,
        framesDirectory: plan.output.framesDirectory,
        frames: plan.output.frames.map((frame) => ({
          frameIndex: frame.frameIndex,
          relativePath: frame.relativePath
        })),
        canvas: { width: 4, height: 4 },
        fps: 1,
        alphaMode: "straight",
        standardsValidSvgaFragmentRequired: true,
        nativeMergeRequired: true,
        fullCompositionRequired: true
      },
      authorityClaims: {
        preparedOnly: true,
        actualAeBakeAuthorityMinted: false,
        packageAuthorityMinted: false,
        adapterAuthorityMinted: false,
        previewOrSaveAuthorized: false
      }
    };
    const prepared = deepFreeze({ ...unsigned, inputHash: sha256Canonical(unsigned) });
    this.preparedInputs.set(prepared, {
      plan,
      sourceIr,
      successorFileName: input.successorFileName,
      project,
      package: sourcePackage,
      consumed: false
    });
    return prepared;
  }

  async verifyPrepared(prepared: AebRetainedBakeCombinedHostInput): Promise<boolean> {
    try {
      const state = this.preparedInputs.get(prepared);
      return Boolean(state
        && !state.consumed
        && prepared.inputHash === sha256Canonical(withoutKey(prepared, "inputHash"))
        && await this.sourcesStillBound(state));
    } catch {
      return false;
    }
  }

  async run(
    prepared: AebRetainedBakeCombinedHostInput,
    options: ExecuteAebBoundedAeBakeOptions = {}
  ): Promise<AebRetainedBakeCombinedHostSessionResult> {
    const state = await this.consumePrepared(prepared, true);
    const execution = await new NodeAebBoundedAeBakeExecutor(this.authority, this.hasher).execute(
      state.plan,
      new NodeAebRetainedAeBakeHostAdapter(),
      options
    );
    const report = await this.completeSourceFlow(state, execution);
    const result = { preparedInput: prepared, execution, report };
    retainedRuntimeResults.add(result);
    return result;
  }

  async runSourceValidation(
    prepared: AebRetainedBakeCombinedHostInput,
    execution: AebBoundedAeBakeExecutionResult
  ): Promise<AebRetainedBakeCombinedSourceFlowReport> {
    const state = await this.consumePrepared(prepared, false);
    if (sha256Canonical(execution.plan) !== sha256Canonical(state.plan)) {
      fail(
        "AE_RETAINED_COMBINED_HOST_EXECUTION_MISMATCH",
        "Source validation received an execution result for another retained Bake input."
      );
    }
    return this.completeSourceFlow(state, execution);
  }

  private async completeSourceFlow(
    state: PrivatePreparedInputState,
    execution: AebBoundedAeBakeExecutionResult
  ): Promise<AebRetainedBakeCombinedSourceFlowReport> {
    const flow = new NodeAebRetainedBakeCombinedSourceFlow(this.authority);
    const report = await flow.run({
      execution,
      sourceIr: state.sourceIr,
      successorFileName: state.successorFileName,
      hasher: this.hasher
    });
    if (!await flow.verify(report)) {
      fail(
        "AE_RETAINED_COMBINED_HOST_FINAL_VERIFICATION_FAILED",
        "Combined host session could not verify its physical F1 and SVGA outputs."
      );
    }
    return report;
  }

  private async consumePrepared(
    prepared: AebRetainedBakeCombinedHostInput,
    requireFreshExecutionPaths: boolean
  ): Promise<PrivatePreparedInputState> {
    const state = this.preparedInputs.get(prepared);
    if (!state || state.consumed
      || prepared.inputHash !== sha256Canonical(withoutKey(prepared, "inputHash"))) {
      fail(
        "AE_RETAINED_COMBINED_HOST_INPUT_REQUIRED",
        "Combined host session requires the original single-use prepared input."
      );
    }
    state.consumed = true;
    if (!await this.sourcesStillBound(state)) {
      fail(
        "AE_RETAINED_COMBINED_HOST_SOURCE_CHANGED",
        "Combined host session source bytes or file identity changed after preparation."
      );
    }
    if (requireFreshExecutionPaths) {
      await this.assertFreshExecutionPaths(state.plan, state.successorFileName);
    }
    return state;
  }

  private async sourcesStillBound(state: PrivatePreparedInputState): Promise<boolean> {
    try {
      const currentProject = await this.authority.readBoundedTaskFile(
        state.project.relativePath,
        state.plan.sourceFiles.projectMaxBytes,
        "SOURCE_PROJECT"
      );
      const currentPackage = await this.authority.readBoundedTaskFile(
        state.package.relativePath,
        state.plan.sourceFiles.packageMaxBytes,
        "SOURCE_PACKAGE"
      );
      return sameSource(currentProject, state.project) && sameSource(currentPackage, state.package);
    } catch {
      return false;
    }
  }

  private async assertFreshExecutionPaths(plan: AebAeBakeExecutionPlan, successorFileName: string): Promise<void> {
    const relativePaths = [
      planFile(plan.executionId),
      producerReceiptFile(plan.executionId),
      cleanupReceiptFile(plan.executionId),
      plan.output.workDirectory,
      plan.output.framesDirectory,
      successorFileName
    ];
    for (const relativePath of relativePaths) {
      const absolutePath = await this.authority.directChildPath(relativePath);
      if (await pathExists(absolutePath)) {
        fail(
          "AE_RETAINED_COMBINED_HOST_OUTPUT_EXISTS",
          "Combined host session requires absent task-owned execution destinations."
        );
      }
    }
  }
}

function validateRetainedSlice(authority: NodeAebTaskRootAuthority, plan: AebAeBakeExecutionPlan): void {
  const frame = plan.output.frames[0];
  if (authority.taskId !== plan.job.task.taskId
    || canonicalJson(plan.host) !== canonicalJson(AEB_RETAINED_AE_BAKE_HOST_DESCRIPTOR)
    || plan.composition.name !== "AEB3_F2_S1_RETAINED_FIXTURE"
    || plan.job.canvas.width !== 4
    || plan.job.canvas.height !== 4
    || plan.job.fps !== 1
    || plan.job.timeRange.endFrameExclusive !== plan.job.timeRange.startFrame + 1
    || plan.job.alphaMode !== "straight"
    || plan.output.frames.length !== 1
    || !frame
    || frame.frameIndex !== plan.job.timeRange.startFrame
    || canonicalJson(plan.controlledFeatures) !== canonicalJson({
      twoDOnly: true,
      precompDepth: 1,
      effectMatchNames: ["ADBE Fill"],
      maskModes: ["add"],
      expressionCount: 1,
      expressionSampling: "ae_rasterized",
      audio: false,
      threeD: false,
      camera: false,
      thirdPartyPlugins: false,
      unknownHostCapabilities: false
    })) {
    fail(
      "AE_RETAINED_COMBINED_HOST_SCOPE_UNSUPPORTED",
      "Combined host session is limited to the reviewed retained AE26.3 one-frame fixture."
    );
  }
}

function validateClassification(
  plan: AebAeBakeExecutionPlan,
  sourceIr: AebFormatNeutralIr
): AebRetainedBakeCombinedHostInput["classification"] {
  if (!isRecord(sourceIr)
    || !isRecord(sourceIr.source)
    || !isRecord(sourceIr.composition)
    || !isRecord(sourceIr.composition.canvas)
    || !isRecord(sourceIr.composition.timeRange)
    || !Array.isArray(sourceIr.layers)
    || !Array.isArray(sourceIr.resources)
    || sourceIr.layers.some((layer) => !isRecord(layer) || !Array.isArray(layer.replaceableElementIds))
    || sourceIr.resources.some((resource) => !isRecord(resource) || !isRecord(resource.contentHash))) {
    fail(
      "AE_RETAINED_COMBINED_HOST_CLASSIFICATION_INVALID",
      "Combined host session requires a complete format-neutral classification input."
    );
  }
  const decisions = plan.planner.decisions.slice().sort((left, right) => compareCodeUnits(left.layerId, right.layerId));
  const outcomes = new Map(decisions.map((decision) => [decision.layerId, decision.outcome]));
  const nativeLayerIds = decisions.filter((decision) => decision.outcome === "native").map((decision) => decision.layerId);
  const bakeRequiredLayerIds = decisions.filter((decision) => decision.outcome === "bake_required").map((decision) => decision.layerId);
  const blockedLayerIds = decisions.filter((decision) => decision.outcome === "blocked").map((decision) => decision.layerId);
  const preservedReplaceableElementIds = sourceIr.layers
    .filter((layer) => layer.plannerOutcome === "native")
    .flatMap((layer) => layer.replaceableElementIds)
    .sort(compareCodeUnits);
  const layerIds = sourceIr.layers.map((layer) => layer.layerId);
  const resourceIds = sourceIr.resources.map((resource) => resource.resourceId);
  const nativeLayerIdSet = new Set(nativeLayerIds);
  if (sourceIr.schemaVersion !== AEB_FORMAT_NEUTRAL_IR_SCHEMA_VERSION
    || sourceIr.packageId !== plan.job.packageId
    || canonicalJson(sourceIr.source) !== canonicalJson(plan.job.source)
    || sourceIr.composition.canvas.width !== 4
    || sourceIr.composition.canvas.height !== 4
    || sourceIr.composition.fps !== 1
    || canonicalJson(sourceIr.composition.timeRange) !== canonicalJson(plan.job.timeRange)
    || sourceIr.layers.length !== decisions.length
    || new Set(layerIds).size !== layerIds.length
    || sourceIr.layers.some((layer) => outcomes.get(layer.layerId) !== layer.plannerOutcome)
    || sourceIr.layers.some((layer) => !isIdentifier(layer.layerId)
      || !isIdentifier(layer.sourceId)
      || (layer.nativePayloadRef !== undefined && !isRelativePath(layer.nativePayloadRef)))
    || sourceIr.layers.some((layer) => layer.plannerOutcome === "bake_required" && layer.replaceableElementIds.length > 0)
    || nativeLayerIds.length === 0
    || bakeRequiredLayerIds.length !== 1
    || blockedLayerIds.length !== 0
    || preservedReplaceableElementIds.length === 0
    || new Set(preservedReplaceableElementIds).size !== preservedReplaceableElementIds.length
    || preservedReplaceableElementIds.some((elementId) => !isIdentifier(elementId))
    || sourceIr.resources.length === 0
    || new Set(resourceIds).size !== resourceIds.length
    || sourceIr.resources.some((resource) => !isIdentifier(resource.resourceId)
      || !nativeLayerIdSet.has(resource.ownerLayerId)
      || !isRelativePath(resource.relativePath)
      || resource.contentHash.algorithm !== "sha256"
      || resource.contentHash.scope !== "encoded_bytes"
      || !isSha256(resource.contentHash.value))) {
    fail(
      "AE_RETAINED_COMBINED_HOST_CLASSIFICATION_INVALID",
      "Combined host session requires exact native/bake classification and replaceable preservation."
    );
  }
  return { nativeLayerIds, bakeRequiredLayerIds, blockedLayerIds, preservedReplaceableElementIds };
}

function isIdentifier(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRelativePath(value: string): boolean {
  return value.length > 0
    && value.length <= 512
    && !value.startsWith("/")
    && !value.includes("\\")
    && value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function validateSuccessorName(name: string, plan: AebAeBakeExecutionPlan): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.json$/.test(name)
    || name === plan.sourceFiles.projectRelativePath
    || name === plan.sourceFiles.packageRelativePath
    || name === ".aeb-bake-task.json") {
    fail(
      "AE_RETAINED_COMBINED_HOST_SUCCESSOR_INVALID",
      "Combined host session successor name is invalid or aliases a protected input."
    );
  }
}

function bindSource(
  file: AebBoundedTaskFile,
  relativePath: string,
  expectedHash: string
): AebRetainedBakeCombinedSourceBinding {
  const contentHash = sha256Bytes(file.bytes);
  if (contentHash !== expectedHash) {
    fail(
      "AE_RETAINED_COMBINED_HOST_SOURCE_HASH_MISMATCH",
      "Combined host session source bytes do not match the Bake plan."
    );
  }
  return {
    relativePath,
    contentHash,
    encodedBytes: file.encodedBytes,
    identityDigest: file.identityDigest
  };
}

function sameSource(file: AebBoundedTaskFile, expected: AebRetainedBakeCombinedSourceBinding): boolean {
  return file.encodedBytes === expected.encodedBytes
    && file.identityDigest === expected.identityDigest
    && sha256Bytes(file.bytes) === expected.contentHash;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256Canonical(value: unknown): string {
  return sha256Bytes(Buffer.from(canonicalJson(value)));
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
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

function withoutKey<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const clone = { ...value };
  delete clone[key];
  return clone;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(code: string, message: string): never {
  throw new AebBakePipelineError(code, message);
}
