import { createHash } from "node:crypto";
import { constants, type BigIntStats } from "node:fs";
import { lstat, open, realpath, type FileHandle } from "node:fs/promises";
import path from "node:path";
import type {
  AebBakeJob,
  AebBakePlannerJoin,
  AebFormatNeutralIr
} from "../workbench/aeb-bake-contracts.js";
import { AEB_FORMAT_NEUTRAL_IR_SCHEMA_VERSION } from "../workbench/aeb-bake-contracts.js";
import { AebBakePipelineError } from "../workbench/aeb-bake-pipeline.js";
import type { AebAeBakeExecutionPlan } from "../workbench/aeb-ae-bake-execution.js";
import type { AebBoundedAeBakeExecutionResult } from "./aeb-node-bounded-ae-bake-executor.js";
import {
  NodeAebTaskRootAuthority,
  type AebBoundedTaskFile
} from "./aeb-node-bake-resource-reader.js";
import {
  consumeAebRetainedBakeCombinedHostRuntimeCapability,
  NodeAebRetainedBakeCombinedHostSession,
  type AebRetainedBakeCombinedHostInput
} from "./aeb-retained-bake-combined-host-session.js";
import type { AebRetainedBakeCombinedSourceFlowReport } from "./aeb-retained-bake-combined-source-flow.js";

export const AEB_RETAINED_BAKE_PANEL_SCRATCH_SCHEMA_VERSION =
  "aeb-retained-bake-panel-scratch-result-v1" as const;
export const AEB_RETAINED_BAKE_PANEL_EXPORT_SCHEMA_VERSION =
  "aeb-retained-bake-panel-export-result-v1" as const;
export const AEB_RETAINED_BAKE_PANEL_OUTPUT_SCHEMA_VERSION =
  "aeb-retained-bake-panel-output-result-v1" as const;
export const AEB_RETAINED_BAKE_PANEL_HANDOFF_SCHEMA_VERSION =
  "aeb-retained-bake-panel-main-handoff-v1" as const;

export interface PrepareAebRetainedBakePanelScratchInput {
  outputRoot: string;
  taskId: string;
}

export interface AebRetainedBakePanelOutputRootBinding {
  canonicalPath: string;
  identityDigest: string;
  ownerUid: number;
  mode: "0700";
  directChildTaskId: string;
}

export interface AebRetainedBakePanelScratchResult {
  schemaVersion: typeof AEB_RETAINED_BAKE_PANEL_SCRATCH_SCHEMA_VERSION;
  status: "prepared";
  action: "prepare_pilot_scratch";
  taskId: string;
  outputRoot: AebRetainedBakePanelOutputRootBinding;
  nextAction: "classify_and_export";
  authorityClaims: NoPanelOutputAuthorityClaims;
  resultHash: string;
}

export interface PrepareAebRetainedBakePanelExportInput {
  job: AebBakeJob;
  planner: AebBakePlannerJoin;
  sourceIr: AebFormatNeutralIr;
  plan?: AebAeBakeExecutionPlan;
  successorFileName: string;
}

export interface AebRetainedBakePanelClassification {
  nativeLayerIds: readonly string[];
  bakeRequiredLayerIds: readonly string[];
  blocked: readonly { layerId: string; reason: string }[];
  preservedReplaceableElementIds: readonly string[];
}

interface NoPanelOutputAuthorityClaims {
  actualAeBakeAuthorityMinted: false;
  packageOutputAuthorityMinted: false;
  standardsValidSvgaFragmentAuthorityMinted: false;
  fullCompositionOutputAuthorityMinted: false;
  previewOrSaveAuthorized: false;
}

export interface AebRetainedBakePanelBlockedResult {
  schemaVersion: typeof AEB_RETAINED_BAKE_PANEL_EXPORT_SCHEMA_VERSION;
  status: "blocked";
  action: "export_to_auto_svga";
  taskId: string;
  outputRoot: AebRetainedBakePanelOutputRootBinding;
  classification: AebRetainedBakePanelClassification;
  generatedOutputs: readonly [];
  authorityClaims: NoPanelOutputAuthorityClaims;
  resultHash: string;
}

export interface AebRetainedBakePanelExportReadyResult {
  schemaVersion: typeof AEB_RETAINED_BAKE_PANEL_EXPORT_SCHEMA_VERSION;
  status: "ready";
  action: "export_to_auto_svga";
  taskId: string;
  executionId: string;
  jobId: string;
  packageId: string;
  planHash: string;
  outputRoot: AebRetainedBakePanelOutputRootBinding;
  classification: AebRetainedBakePanelClassification;
  expectedOutput: AebRetainedBakeCombinedHostInput["expectedOutput"];
  nextAction: "execute_retained_ae_transaction";
  authorityClaims: NoPanelOutputAuthorityClaims;
  resultHash: string;
}

export type AebRetainedBakePanelExportResult =
  | AebRetainedBakePanelBlockedResult
  | AebRetainedBakePanelExportReadyResult;

export interface AebRetainedBakePanelPhysicalOutput {
  relativePath: string;
  encodedBytes: number;
  contentHash: string;
  identityDigest: string;
}

export interface AebRetainedBakePanelSourceValidationResult {
  schemaVersion: typeof AEB_RETAINED_BAKE_PANEL_OUTPUT_SCHEMA_VERSION;
  status: "source_validated";
  taskId: string;
  executionId: string;
  jobId: string;
  packageId: string;
  planHash: string;
  outputRoot: AebRetainedBakePanelOutputRootBinding;
  classification: AebRetainedBakePanelClassification;
  package: AebRetainedBakePanelPhysicalOutput & {
    f1ReinsertionValidated: true;
    sourceProjectUnchanged: true;
    sourcePackageUnchanged: true;
  };
  fragment: AebRetainedBakePanelPhysicalOutput & {
    standardsValidSvgaFragment: true;
    nativeMergeRequired: true;
    fullCompositionEncoded: false;
  };
  fullComposition: AebRetainedBakePanelPhysicalOutput & {
    standardsValidSvga: true;
    nativeMergeCompleted: true;
    fullCompositionEncoded: true;
    previewOrSaveAuthorized: false;
  };
  authorityClaims: NoPanelOutputAuthorityClaims;
  resultHash: string;
}

interface ActualPanelOutputAuthorityClaims {
  actualAeBakeAuthorityMinted: true;
  packageOutputAuthorityMinted: true;
  standardsValidSvgaFragmentAuthorityMinted: true;
  fullCompositionOutputAuthorityMinted: true;
  previewOrSaveAuthorized: false;
}

export interface AebRetainedBakePanelRuntimeResult {
  schemaVersion: typeof AEB_RETAINED_BAKE_PANEL_OUTPUT_SCHEMA_VERSION;
  status: "completed";
  taskId: string;
  executionId: string;
  jobId: string;
  packageId: string;
  planHash: string;
  outputRoot: AebRetainedBakePanelOutputRootBinding;
  classification: AebRetainedBakePanelClassification;
  package: AebRetainedBakePanelSourceValidationResult["package"];
  fragment: AebRetainedBakePanelSourceValidationResult["fragment"];
  fullComposition: AebRetainedBakePanelSourceValidationResult["fullComposition"];
  retainedExecution: {
    actualAeRenderExecuted: true;
    executionReceiptHash: string;
    producerReceiptHash: string;
    cleanupReceiptHash: string;
    processClosedNormally: true;
    processGroupAbsenceProven: true;
    runRootRemoved: true;
  };
  authorityClaims: ActualPanelOutputAuthorityClaims;
  resultHash: string;
}

export interface AebRetainedBakePanelMainHandoff {
  schemaVersion: typeof AEB_RETAINED_BAKE_PANEL_HANDOFF_SCHEMA_VERSION;
  authorityState: "retained_bake_physical_outputs_ready_for_aeb_main";
  taskId: string;
  executionId: string;
  jobId: string;
  packageId: string;
  planHash: string;
  outputRoot: AebRetainedBakePanelOutputRootBinding;
  package: AebRetainedBakePanelRuntimeResult["package"];
  fragment: AebRetainedBakePanelRuntimeResult["fragment"];
  fullComposition: AebRetainedBakePanelRuntimeResult["fullComposition"];
  actualAeBakeAuthorityMinted: true;
  standardsValidSvgaFragmentAuthorityMinted: true;
  fullCompositionOutputAuthorityMinted: true;
  nativeMergeRequired: true;
  previewOrSaveAuthorized: false;
  handoffHash: string;
}

interface PinnedPanelRoot {
  binding: AebRetainedBakePanelOutputRootBinding;
  basePath: string;
  rootPath: string;
  baseIdentity: BigIntStats;
  rootIdentity: BigIntStats;
  baseHandle: FileHandle;
  rootHandle: FileHandle;
  authority: NodeAebTaskRootAuthority;
  closed: boolean;
}

interface ScratchState {
  root: PinnedPanelRoot;
  consumed: boolean;
}

interface ReadyState {
  root: PinnedPanelRoot;
  session: NodeAebRetainedBakeCombinedHostSession;
  prepared: AebRetainedBakeCombinedHostInput;
  plan: AebAeBakeExecutionPlan;
  classification: AebRetainedBakePanelClassification;
  consumed: boolean;
}

interface OutputState {
  root: PinnedPanelRoot;
  plan: AebAeBakeExecutionPlan;
  source: AebRetainedBakeCombinedHostInput["source"];
  package: AebRetainedBakePanelPhysicalOutput;
  fragment: AebRetainedBakePanelPhysicalOutput;
  fullComposition: AebRetainedBakePanelPhysicalOutput;
  consumed: boolean;
}

export class NodeAebRetainedBakePanelHost {
  private readonly roots = new Set<PinnedPanelRoot>();
  private readonly scratchStates = new WeakMap<AebRetainedBakePanelScratchResult, ScratchState>();
  private readonly readyStates = new WeakMap<AebRetainedBakePanelExportReadyResult, ReadyState>();
  private readonly sourceStates = new WeakMap<AebRetainedBakePanelSourceValidationResult, OutputState>();
  private readonly runtimeStates = new WeakMap<AebRetainedBakePanelRuntimeResult, OutputState>();
  private readonly handoffStates = new WeakMap<AebRetainedBakePanelMainHandoff, OutputState>();

  async preparePilotScratch(
    input: PrepareAebRetainedBakePanelScratchInput
  ): Promise<AebRetainedBakePanelScratchResult> {
    const root = await pinPanelRoot(input);
    this.roots.add(root);
    const unsigned: Omit<AebRetainedBakePanelScratchResult, "resultHash"> = {
      schemaVersion: AEB_RETAINED_BAKE_PANEL_SCRATCH_SCHEMA_VERSION,
      status: "prepared",
      action: "prepare_pilot_scratch",
      taskId: input.taskId,
      outputRoot: root.binding,
      nextAction: "classify_and_export",
      authorityClaims: noAuthorityClaims()
    };
    const result = deepFreeze({ ...unsigned, resultHash: sha256Canonical(unsigned) });
    this.scratchStates.set(result, { root, consumed: false });
    return result;
  }

  async prepareRetainedExport(
    scratch: AebRetainedBakePanelScratchResult,
    input: PrepareAebRetainedBakePanelExportInput
  ): Promise<AebRetainedBakePanelExportResult> {
    const state = this.scratchStates.get(scratch);
    if (!state || state.consumed
      || scratch.resultHash !== sha256Canonical(withoutKey(scratch, "resultHash"))) {
      fail("AEB_PANEL_SCRATCH_RESULT_REQUIRED", "Retained Bake export requires the original one-use scratch result.");
    }
    state.consumed = true;
    await verifyPinnedPanelRoot(state.root);
    const trusted = snapshotExportInput(input);
    const classification = validateClassification(state.root, trusted);
    if (classification.blocked.length > 0) {
      if (trusted.plan !== undefined) {
        fail("AEB_PANEL_BLOCKED_PLAN_FORBIDDEN", "Blocked classification must stop before a Bake execution plan exists.");
      }
      const unsigned: Omit<AebRetainedBakePanelBlockedResult, "resultHash"> = {
        schemaVersion: AEB_RETAINED_BAKE_PANEL_EXPORT_SCHEMA_VERSION,
        status: "blocked",
        action: "export_to_auto_svga",
        taskId: trusted.job.task.taskId,
        outputRoot: state.root.binding,
        classification,
        generatedOutputs: [],
        authorityClaims: noAuthorityClaims()
      };
      return deepFreeze({ ...unsigned, resultHash: sha256Canonical(unsigned) });
    }
    if (!trusted.plan) {
      fail("AEB_PANEL_RETAINED_PLAN_REQUIRED", "Bake-required classification needs the reviewed retained execution plan.");
    }
    if (!sameJson(trusted.plan.job, trusted.job)
      || !sameJson(trusted.plan.planner, trusted.planner)) {
      fail("AEB_PANEL_PLAN_CLASSIFICATION_MISMATCH", "Retained plan does not match the panel classification.");
    }
    const session = new NodeAebRetainedBakeCombinedHostSession(state.root.authority);
    const prepared = await session.prepare({
      plan: trusted.plan,
      sourceIr: trusted.sourceIr,
      successorFileName: trusted.successorFileName
    });
    const unsigned: Omit<AebRetainedBakePanelExportReadyResult, "resultHash"> = {
      schemaVersion: AEB_RETAINED_BAKE_PANEL_EXPORT_SCHEMA_VERSION,
      status: "ready",
      action: "export_to_auto_svga",
      taskId: prepared.taskId,
      executionId: prepared.executionId,
      jobId: prepared.jobId,
      packageId: prepared.packageId,
      planHash: prepared.planHash,
      outputRoot: state.root.binding,
      classification,
      expectedOutput: prepared.expectedOutput,
      nextAction: "execute_retained_ae_transaction",
      authorityClaims: noAuthorityClaims()
    };
    const result = deepFreeze({ ...unsigned, resultHash: sha256Canonical(unsigned) });
    this.readyStates.set(result, {
      root: state.root,
      session,
      prepared,
      plan: trusted.plan,
      classification,
      consumed: false
    });
    return result;
  }

  async completeSourceValidation(
    ready: AebRetainedBakePanelExportReadyResult,
    execution: AebBoundedAeBakeExecutionResult
  ): Promise<AebRetainedBakePanelSourceValidationResult> {
    const state = await this.consumeReady(ready);
    const report = await state.session.runSourceValidation(state.prepared, execution);
    const outputs = await bindReportOutputs(state.root, state.plan, state.prepared.source, report);
    const unsigned: Omit<AebRetainedBakePanelSourceValidationResult, "resultHash"> = {
      schemaVersion: AEB_RETAINED_BAKE_PANEL_OUTPUT_SCHEMA_VERSION,
      status: "source_validated",
      taskId: report.taskId,
      executionId: report.executionId,
      jobId: report.jobId,
      packageId: report.packageId,
      planHash: report.planHash,
      outputRoot: state.root.binding,
      classification: state.classification,
      package: {
        ...outputs.package,
        f1ReinsertionValidated: true,
        sourceProjectUnchanged: true,
        sourcePackageUnchanged: true
      },
      fragment: {
        ...outputs.fragment,
        standardsValidSvgaFragment: true,
        nativeMergeRequired: true,
        fullCompositionEncoded: false
      },
      fullComposition: {
        ...outputs.fullComposition,
        standardsValidSvga: true,
        nativeMergeCompleted: true,
        fullCompositionEncoded: true,
        previewOrSaveAuthorized: false
      },
      authorityClaims: noAuthorityClaims()
    };
    const result = deepFreeze({ ...unsigned, resultHash: sha256Canonical(unsigned) });
    this.sourceStates.set(result, {
      root: state.root,
      plan: state.plan,
      source: state.prepared.source,
      ...outputs,
      consumed: false
    });
    return result;
  }

  async run(
    ready: AebRetainedBakePanelExportReadyResult
  ): Promise<AebRetainedBakePanelRuntimeResult> {
    const state = await this.consumeReady(ready);
    const completed = await state.session.run(state.prepared);
    if (!consumeAebRetainedBakeCombinedHostRuntimeCapability(completed)) {
      fail(
        "AEB_PANEL_RETAINED_RUNTIME_CAPABILITY_REQUIRED",
        "Panel runtime authority requires the original retained host-session result."
      );
    }
    const { execution, report } = completed;
    const retained = execution.producerReceipt.hostExecution;
    if (execution.executionReceipt.mode !== "after_effects"
      || execution.executionReceipt.actualAeRenderExecuted !== true
      || retained.kind !== "retained_ae_transaction"
      || retained.processClosedNormally !== true
      || retained.processGroupAbsenceProven !== true
      || retained.runRootRemoved !== true
      || execution.cleanupReceipt.outcome !== "success") {
      fail("AEB_PANEL_RETAINED_RUNTIME_INCOMPLETE", "Retained AE runtime did not complete its exact cleanup-bound transaction.");
    }
    const outputs = await bindReportOutputs(state.root, state.plan, state.prepared.source, report);
    const unsigned: Omit<AebRetainedBakePanelRuntimeResult, "resultHash"> = {
      schemaVersion: AEB_RETAINED_BAKE_PANEL_OUTPUT_SCHEMA_VERSION,
      status: "completed",
      taskId: report.taskId,
      executionId: report.executionId,
      jobId: report.jobId,
      packageId: report.packageId,
      planHash: report.planHash,
      outputRoot: state.root.binding,
      classification: state.classification,
      package: {
        ...outputs.package,
        f1ReinsertionValidated: true,
        sourceProjectUnchanged: true,
        sourcePackageUnchanged: true
      },
      fragment: {
        ...outputs.fragment,
        standardsValidSvgaFragment: true,
        nativeMergeRequired: true,
        fullCompositionEncoded: false
      },
      fullComposition: {
        ...outputs.fullComposition,
        standardsValidSvga: true,
        nativeMergeCompleted: true,
        fullCompositionEncoded: true,
        previewOrSaveAuthorized: false
      },
      retainedExecution: {
        actualAeRenderExecuted: true,
        executionReceiptHash: execution.executionReceipt.receiptHash,
        producerReceiptHash: execution.producerReceipt.receiptHash,
        cleanupReceiptHash: execution.cleanupReceipt.receiptHash,
        processClosedNormally: true,
        processGroupAbsenceProven: true,
        runRootRemoved: true
      },
      authorityClaims: actualAuthorityClaims()
    };
    const result = deepFreeze({ ...unsigned, resultHash: sha256Canonical(unsigned) });
    this.runtimeStates.set(result, {
      root: state.root,
      plan: state.plan,
      source: state.prepared.source,
      ...outputs,
      consumed: false
    });
    return result;
  }

  async verifySourceValidationResult(result: AebRetainedBakePanelSourceValidationResult): Promise<boolean> {
    return this.verifyOutputState(result, this.sourceStates.get(result));
  }

  async verifyRuntimeResult(result: AebRetainedBakePanelRuntimeResult): Promise<boolean> {
    return this.verifyOutputState(result, this.runtimeStates.get(result));
  }

  async consumeRuntimeHandoff(
    result: AebRetainedBakePanelRuntimeResult
  ): Promise<AebRetainedBakePanelMainHandoff> {
    const state = this.runtimeStates.get(result);
    if (!state || state.consumed || !await this.verifyOutputState(result, state)) {
      fail("AEB_PANEL_RUNTIME_RESULT_REQUIRED", "AEB Main handoff requires the original verified runtime result.");
    }
    state.consumed = true;
    const unsigned: Omit<AebRetainedBakePanelMainHandoff, "handoffHash"> = {
      schemaVersion: AEB_RETAINED_BAKE_PANEL_HANDOFF_SCHEMA_VERSION,
      authorityState: "retained_bake_physical_outputs_ready_for_aeb_main",
      taskId: result.taskId,
      executionId: result.executionId,
      jobId: result.jobId,
      packageId: result.packageId,
      planHash: result.planHash,
      outputRoot: result.outputRoot,
      package: result.package,
      fragment: result.fragment,
      fullComposition: result.fullComposition,
      actualAeBakeAuthorityMinted: true,
      standardsValidSvgaFragmentAuthorityMinted: true,
      fullCompositionOutputAuthorityMinted: true,
      nativeMergeRequired: true,
      previewOrSaveAuthorized: false
    };
    const handoff = deepFreeze({ ...unsigned, handoffHash: sha256Canonical(unsigned) });
    this.handoffStates.set(handoff, { ...state, consumed: false });
    return handoff;
  }

  async verifyRuntimeHandoff(handoff: AebRetainedBakePanelMainHandoff): Promise<boolean> {
    const state = this.handoffStates.get(handoff);
    return this.verifyOutputState(handoff, state);
  }

  async close(): Promise<void> {
    await Promise.allSettled([...this.roots].map((root) => closePinnedPanelRoot(root)));
    this.roots.clear();
  }

  private async consumeReady(ready: AebRetainedBakePanelExportReadyResult): Promise<ReadyState> {
    const state = this.readyStates.get(ready);
    if (!state || state.consumed
      || ready.resultHash !== sha256Canonical(withoutKey(ready, "resultHash"))) {
      fail("AEB_PANEL_EXPORT_READY_RESULT_REQUIRED", "Retained Bake execution requires the original one-use ready result.");
    }
    state.consumed = true;
    await verifyPinnedPanelRoot(state.root);
    return state;
  }

  private async verifyOutputState(
    value: { outputRoot: AebRetainedBakePanelOutputRootBinding; package: AebRetainedBakePanelPhysicalOutput; fragment: AebRetainedBakePanelPhysicalOutput; fullComposition: AebRetainedBakePanelPhysicalOutput },
    state: OutputState | undefined
  ): Promise<boolean> {
    try {
      if (!state || !sameJson(value.outputRoot, state.root.binding)) return false;
      await verifyPinnedPanelRoot(state.root);
      if (!await sourcesStillBound(state.root.authority, state.plan, state.source)) return false;
      const packageFile = await readOutput(state.root.authority, state.package, state.plan.job.budgets.maxPackageBytes);
      const fragmentFile = await readOutput(state.root.authority, state.fragment, state.plan.job.budgets.maxPackageBytes);
      const fullCompositionFile = await readOutput(
        state.root.authority,
        state.fullComposition,
        state.plan.job.budgets.maxPackageBytes
      );
      return samePhysicalOutput(packageFile, state.package)
        && samePhysicalOutput(fragmentFile, state.fragment)
        && samePhysicalOutput(fullCompositionFile, state.fullComposition)
        && sameOutputBinding(value.package, state.package)
        && sameOutputBinding(value.fragment, state.fragment)
        && sameOutputBinding(value.fullComposition, state.fullComposition);
    } catch {
      return false;
    }
  }
}

function snapshotExportInput(input: PrepareAebRetainedBakePanelExportInput): PrepareAebRetainedBakePanelExportInput {
  try {
    return deepFreeze(structuredClone(input));
  } catch {
    fail("AEB_PANEL_EXPORT_INPUT_INVALID", "Panel export input could not be captured safely.");
  }
}

function validateClassification(
  root: PinnedPanelRoot,
  input: PrepareAebRetainedBakePanelExportInput
): AebRetainedBakePanelClassification {
  const { job, planner, sourceIr } = input;
  if (!isRecord(job)
    || !isRecord(job.source)
    || !isRecord(job.task)
    || !isRecord(planner)
    || !Array.isArray(planner.decisions)
    || !isRecord(sourceIr)
    || !Array.isArray(sourceIr.layers)
    || root.binding.directChildTaskId !== job.task.taskId
    || planner.jobId !== job.jobId
    || planner.sourceFingerprint !== job.source.sourceFingerprint
    || planner.scanDigest !== job.source.scanDigest
    || planner.plannerDigest !== job.source.plannerDigest
    || sourceIr.schemaVersion !== AEB_FORMAT_NEUTRAL_IR_SCHEMA_VERSION
    || sourceIr.packageId !== job.packageId
    || !sameJson(sourceIr.source, job.source)
    || sourceIr.layers.length !== planner.decisions.length) {
    fail("AEB_PANEL_CLASSIFICATION_INVALID", "Panel classification does not match the exact task, source, job, and package joins.");
  }
  const decisions = planner.decisions.slice().sort((left, right) => compareCodeUnits(left.layerId, right.layerId));
  const layers = sourceIr.layers.slice().sort((left, right) => compareCodeUnits(left.layerId, right.layerId));
  if (new Set(decisions.map((item) => item.layerId)).size !== decisions.length
    || new Set(layers.map((item) => item.layerId)).size !== layers.length
    || decisions.some((decision, index) => !isIdentifier(decision.layerId)
      || !isIdentifier(decision.reason)
      || !["native", "bake_required", "blocked"].includes(decision.outcome)
      || layers[index]?.layerId !== decision.layerId
      || layers[index]?.plannerOutcome !== decision.outcome)) {
    fail("AEB_PANEL_CLASSIFICATION_INVALID", "Panel classification contains inconsistent layer outcomes or unsafe reasons.");
  }
  const nativeLayerIds = decisions.filter((item) => item.outcome === "native").map((item) => item.layerId);
  const bakeRequiredLayerIds = decisions.filter((item) => item.outcome === "bake_required").map((item) => item.layerId);
  const blocked = decisions.filter((item) => item.outcome === "blocked")
    .map((item) => ({ layerId: item.layerId, reason: item.reason }));
  const nativeIds = new Set(nativeLayerIds);
  const preservedReplaceableElementIds = layers
    .filter((layer) => nativeIds.has(layer.layerId))
    .flatMap((layer) => layer.replaceableElementIds)
    .sort(compareCodeUnits);
  if (layers.some((layer) => !Array.isArray(layer.replaceableElementIds))
    || layers.some((layer) => layer.plannerOutcome !== "native" && layer.replaceableElementIds.length > 0)
    || new Set(preservedReplaceableElementIds).size !== preservedReplaceableElementIds.length
    || preservedReplaceableElementIds.some((item) => !isIdentifier(item))) {
    fail("AEB_PANEL_REPLACEABLE_PROTECTION_INVALID", "Panel classification would lose or duplicate protected replaceable elements.");
  }
  return deepFreeze({ nativeLayerIds, bakeRequiredLayerIds, blocked, preservedReplaceableElementIds });
}

async function pinPanelRoot(input: PrepareAebRetainedBakePanelScratchInput): Promise<PinnedPanelRoot> {
  if (!isTaskId(input.taskId)
    || typeof input.outputRoot !== "string"
    || !path.isAbsolute(input.outputRoot)
    || path.resolve(input.outputRoot) !== input.outputRoot
    || path.normalize(input.outputRoot) !== input.outputRoot
    || path.basename(input.outputRoot) !== input.taskId) {
    fail("AEB_PANEL_OUTPUT_ROOT_NONCANONICAL", "Panel output root must be the exact canonical task direct-child path.");
  }
  const rootPath = input.outputRoot;
  const basePath = path.dirname(rootPath);
  let baseHandle: FileHandle | undefined;
  let rootHandle: FileHandle | undefined;
  try {
    const basePathState = await lstat(basePath, { bigint: true });
    const rootPathState = await lstat(rootPath, { bigint: true });
    if (basePathState.isSymbolicLink() || rootPathState.isSymbolicLink()
      || !basePathState.isDirectory() || !rootPathState.isDirectory()
      || await realpath(basePath) !== basePath
      || await realpath(rootPath) !== rootPath
      || path.dirname(rootPath) !== basePath) {
      fail("AEB_PANEL_OUTPUT_ROOT_NONCANONICAL", "Panel output root must be a real canonical direct child.");
    }
    assertOwnedMode(basePathState, "AEB_PANEL_TASK_BASE");
    assertOwnedMode(rootPathState, "AEB_PANEL_OUTPUT_ROOT");
    baseHandle = await open(basePath, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    rootHandle = await open(rootPath, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    const baseIdentity = await baseHandle.stat({ bigint: true });
    const rootIdentity = await rootHandle.stat({ bigint: true });
    assertSameDirectory(basePathState, baseIdentity, "AEB_PANEL_TASK_BASE_CHANGED");
    assertSameDirectory(rootPathState, rootIdentity, "AEB_PANEL_OUTPUT_ROOT_CHANGED");
    const authority = new NodeAebTaskRootAuthority({ approvedTaskBase: basePath, taskId: input.taskId });
    await authority.verifyPinned();
    return {
      binding: deepFreeze({
        canonicalPath: rootPath,
        identityDigest: directoryIdentityDigest(rootIdentity),
        ownerUid: Number(rootIdentity.uid),
        mode: "0700",
        directChildTaskId: input.taskId
      }),
      basePath,
      rootPath,
      baseIdentity,
      rootIdentity,
      baseHandle,
      rootHandle,
      authority,
      closed: false
    };
  } catch (error) {
    await Promise.allSettled([baseHandle?.close(), rootHandle?.close()]);
    if (error instanceof AebBakePipelineError) throw error;
    fail("AEB_PANEL_OUTPUT_ROOT_INVALID", "Panel output root could not be pinned safely.");
  }
}

async function verifyPinnedPanelRoot(root: PinnedPanelRoot): Promise<void> {
  if (root.closed) fail("AEB_PANEL_OUTPUT_ROOT_CLOSED", "Panel output root authority is closed.");
  const [baseDescriptor, rootDescriptor, baseCurrent, rootCurrent] = await Promise.all([
    root.baseHandle.stat({ bigint: true }),
    root.rootHandle.stat({ bigint: true }),
    lstat(root.basePath, { bigint: true }),
    lstat(root.rootPath, { bigint: true })
  ]);
  assertSameDirectory(root.baseIdentity, baseDescriptor, "AEB_PANEL_TASK_BASE_CHANGED");
  assertSameDirectory(baseDescriptor, baseCurrent, "AEB_PANEL_TASK_BASE_CHANGED");
  assertSameDirectory(root.rootIdentity, rootDescriptor, "AEB_PANEL_OUTPUT_ROOT_CHANGED");
  assertSameDirectory(rootDescriptor, rootCurrent, "AEB_PANEL_OUTPUT_ROOT_CHANGED");
  assertOwnedMode(baseCurrent, "AEB_PANEL_TASK_BASE");
  assertOwnedMode(rootCurrent, "AEB_PANEL_OUTPUT_ROOT");
  if (baseCurrent.isSymbolicLink() || rootCurrent.isSymbolicLink()
    || await realpath(root.basePath) !== root.basePath
    || await realpath(root.rootPath) !== root.rootPath
    || directoryIdentityDigest(rootDescriptor) !== root.binding.identityDigest) {
    fail("AEB_PANEL_OUTPUT_ROOT_CHANGED", "Panel output root authority changed after preparation.");
  }
  await root.authority.verifyPinned();
}

async function closePinnedPanelRoot(root: PinnedPanelRoot): Promise<void> {
  if (root.closed) return;
  root.closed = true;
  await root.authority.close();
  await Promise.allSettled([root.rootHandle.close(), root.baseHandle.close()]);
}

async function bindReportOutputs(
  root: PinnedPanelRoot,
  plan: AebAeBakeExecutionPlan,
  source: AebRetainedBakeCombinedHostInput["source"],
  report: AebRetainedBakeCombinedSourceFlowReport
): Promise<{
  package: AebRetainedBakePanelPhysicalOutput;
  fragment: AebRetainedBakePanelPhysicalOutput;
  fullComposition: AebRetainedBakePanelPhysicalOutput;
}> {
  await verifyPinnedPanelRoot(root);
  if (report.taskId !== plan.job.task.taskId
    || report.executionId !== plan.executionId
    || report.jobId !== plan.job.jobId
    || report.packageId !== plan.job.packageId
    || report.planHash !== plan.planHash
    || report.package.f1ReinsertionValidated !== true
    || report.package.sourceProjectContentHash !== source.project.contentHash
    || report.package.sourceProjectIdentityDigest !== source.project.identityDigest
    || report.package.sourcePackageContentHash !== source.package.contentHash
    || report.package.sourceProjectUnchanged !== true
    || report.package.sourcePackageUnchanged !== true
    || report.fragment.standardsValidSvgaFragment !== true
    || report.fragment.nativeMergeRequired !== true
    || report.fragment.fullCompositionEncoded !== false
    || report.fullComposition.standardsValidSvga !== true
    || report.fullComposition.nativeMergeCompleted !== true
    || report.fullComposition.fullCompositionEncoded !== true
    || report.fullComposition.validation.previewOrSaveAuthorized !== false
    || report.authority.realPreviewValidated !== false
    || report.authority.saveAsBytesAuthorized !== false) {
    fail("AEB_PANEL_OUTPUT_REPORT_INVALID", "Retained Bake output report does not match the prepared panel authority.");
  }
  const packageFile = await root.authority.readBoundedTaskFile(
    report.package.successorPackageRelativePath,
    plan.job.budgets.maxPackageBytes,
    "PANEL_SUCCESSOR_PACKAGE"
  );
  const fragmentFile = await root.authority.readBoundedTaskFile(
    report.fragment.relativePath,
    plan.job.budgets.maxPackageBytes,
    "PANEL_SVGA_FRAGMENT"
  );
  const fullCompositionFile = await root.authority.readBoundedTaskFile(
    report.fullComposition.output.relativePath,
    plan.job.budgets.maxPackageBytes,
    "PANEL_FULL_COMPOSITION"
  );
  const packageOutput = physicalOutput(report.package.successorPackageRelativePath, packageFile);
  const fragmentOutput = physicalOutput(report.fragment.relativePath, fragmentFile);
  const fullCompositionOutput = physicalOutput(
    report.fullComposition.output.relativePath,
    fullCompositionFile
  );
  if (packageOutput.contentHash !== report.package.successorPackageContentHash
    || fragmentOutput.contentHash !== report.fragment.contentHash
    || fragmentOutput.identityDigest !== report.fragment.identityDigest
    || fragmentOutput.encodedBytes !== report.fragment.encodedBytes
    || fullCompositionOutput.contentHash !== report.fullComposition.output.contentHash
    || fullCompositionOutput.identityDigest !== report.fullComposition.output.identityDigest
    || fullCompositionOutput.encodedBytes !== report.fullComposition.output.encodedBytes) {
    fail("AEB_PANEL_OUTPUT_REBIND_FAILED", "Retained Bake physical outputs changed before panel authority minting.");
  }
  if (!await sourcesStillBound(root.authority, plan, source)) {
    fail("AEB_PANEL_SOURCE_CHANGED", "Retained Bake source project or package changed before panel authority minting.");
  }
  return { package: packageOutput, fragment: fragmentOutput, fullComposition: fullCompositionOutput };
}

async function sourcesStillBound(
  authority: NodeAebTaskRootAuthority,
  plan: AebAeBakeExecutionPlan,
  source: AebRetainedBakeCombinedHostInput["source"]
): Promise<boolean> {
  try {
    const project = await authority.readBoundedTaskFile(
      plan.sourceFiles.projectRelativePath,
      plan.sourceFiles.projectMaxBytes,
      "SOURCE_PROJECT"
    );
    const sourcePackage = await authority.readBoundedTaskFile(
      plan.sourceFiles.packageRelativePath,
      plan.sourceFiles.packageMaxBytes,
      "SOURCE_PACKAGE"
    );
    return source.immutable === true
      && source.project.relativePath === plan.sourceFiles.projectRelativePath
      && source.package.relativePath === plan.sourceFiles.packageRelativePath
      && project.identityDigest === source.project.identityDigest
      && sourcePackage.identityDigest === source.package.identityDigest
      && sha256Bytes(project.bytes) === source.project.contentHash
      && sha256Bytes(sourcePackage.bytes) === source.package.contentHash
      && source.project.contentHash === plan.sourceFiles.projectContentHash
      && source.package.contentHash === plan.sourceFiles.packageContentHash;
  } catch {
    return false;
  }
}

async function readOutput(
  authority: NodeAebTaskRootAuthority,
  binding: AebRetainedBakePanelPhysicalOutput,
  maxBytes: number
): Promise<AebBoundedTaskFile> {
  return authority.readBoundedTaskFile(binding.relativePath, maxBytes, "PANEL_PHYSICAL_OUTPUT");
}

function physicalOutput(relativePath: string, file: AebBoundedTaskFile): AebRetainedBakePanelPhysicalOutput {
  return deepFreeze({
    relativePath,
    encodedBytes: file.encodedBytes,
    contentHash: sha256Bytes(file.bytes),
    identityDigest: file.identityDigest
  });
}

function samePhysicalOutput(file: AebBoundedTaskFile, expected: AebRetainedBakePanelPhysicalOutput): boolean {
  return file.encodedBytes === expected.encodedBytes
    && file.identityDigest === expected.identityDigest
    && sha256Bytes(file.bytes) === expected.contentHash;
}

function sameOutputBinding(
  actual: AebRetainedBakePanelPhysicalOutput,
  expected: AebRetainedBakePanelPhysicalOutput
): boolean {
  return actual.relativePath === expected.relativePath
    && actual.encodedBytes === expected.encodedBytes
    && actual.contentHash === expected.contentHash
    && actual.identityDigest === expected.identityDigest;
}

function assertOwnedMode(identity: BigIntStats, prefix: "AEB_PANEL_TASK_BASE" | "AEB_PANEL_OUTPUT_ROOT"): void {
  const uid = typeof process.getuid === "function" ? process.getuid() : -1;
  if (Number(identity.uid) !== uid) {
    fail(`${prefix}_OWNER_INVALID`, "Panel task authority must be owned by the current user.");
  }
  if (Number(identity.mode & 0o777n) !== 0o700) {
    fail(`${prefix}_MODE_INVALID`, "Panel task authority must use mode 0700.");
  }
}

function assertSameDirectory(left: BigIntStats, right: BigIntStats, code: string): void {
  if (!left.isDirectory() || !right.isDirectory()
    || left.dev !== right.dev || left.ino !== right.ino) {
    fail(code, "Panel task authority directory identity changed.");
  }
}

function directoryIdentityDigest(identity: BigIntStats): string {
  return createHash("sha256")
    .update(`${identity.dev}:${identity.ino}:${identity.uid}:${identity.mode & 0o777n}`)
    .digest("hex");
}

function noAuthorityClaims(): NoPanelOutputAuthorityClaims {
  return deepFreeze({
    actualAeBakeAuthorityMinted: false,
    packageOutputAuthorityMinted: false,
    standardsValidSvgaFragmentAuthorityMinted: false,
    fullCompositionOutputAuthorityMinted: false,
    previewOrSaveAuthorized: false
  });
}

function actualAuthorityClaims(): ActualPanelOutputAuthorityClaims {
  return deepFreeze({
    actualAeBakeAuthorityMinted: true,
    packageOutputAuthorityMinted: true,
    standardsValidSvgaFragmentAuthorityMinted: true,
    fullCompositionOutputAuthorityMinted: true,
    previewOrSaveAuthorized: false
  });
}

function isTaskId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
}

function isIdentifier(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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

function sameJson(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
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

function fail(code: string, message: string): never {
  throw new AebBakePipelineError(code, message);
}
