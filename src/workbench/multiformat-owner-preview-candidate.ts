import type {
  MotionFormat,
  PlaybackState,
  WorkbenchIssue
} from "./contracts.js";
import {
  LOTTIE_ADJACENT_RESOURCE_MAX_BYTES,
  type HiddenLottiePreviewReplacement
} from "./lottie-preview-vertical.js";
import type { HiddenVapPreviewFusionReplacement } from "./vap-preview-vertical.js";
import {
  HIDDEN_MULTIFORMAT_PREVIEW_WORKSPACE_GATE,
  createHiddenMultiFormatPreviewWorkspace,
  type CreateHiddenMultiFormatPreviewWorkspaceOptions,
  type HiddenMultiFormatPreviewAssetRow,
  type HiddenMultiFormatPreviewHost,
  type HiddenMultiFormatPreviewIssue,
  type HiddenMultiFormatPreviewModel,
  type HiddenMultiFormatPreviewOpenInput,
  type HiddenMultiFormatPreviewOpenSource,
  type HiddenMultiFormatPreviewStatus,
  type HiddenMultiFormatPreviewTextCandidate
} from "./multiformat-preview-workspace.js";
import type { VapPreparedFusionElement } from "./vap-playback-preparation.js";
import {
  buildMultiFormatAssetInventory,
  type MultiFormatAssetInventory
} from "./multiformat-asset-qualification.js";
import {
  redactLocalPathsFromError,
  redactLocalPathsInValue
} from "./local-path-redaction.js";
import {
  createOwnerRightPanelSnapshotEnvelope,
  type OwnerRightPanelSnapshotEnvelopeV1
} from "./owner-right-panel-snapshot.js";

export const OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE = "0.2-owner-visible-multiformat-preview-wp5" as const;
export const OWNER_VISIBLE_MULTIFORMAT_PREVIEW_SCHEMA_VERSION = 1 as const;
export const OWNER_VISIBLE_MULTIFORMAT_PREVIEW_PRODUCT_VERSION = "0.2.0-alpha.2" as const;

export type OwnerVisibleMultiFormatPreviewStatus =
  | "launch"
  | "loading"
  | "previewReady"
  | "playing"
  | "paused"
  | "playbackBlocked"
  | "playbackFailed"
  | "failed"
  | "disposed";

export type OwnerVisibleMultiFormatPreviewIssueCode =
  | "unsupported"
  | "missing_dependency"
  | "missing_resource"
  | "parse_precondition"
  | "ambiguous"
  | "capability"
  | "unsupported_feature"
  | "playback_failure";

export interface OwnerVisibleMultiFormatPreviewIssue extends WorkbenchIssue {
  code: OwnerVisibleMultiFormatPreviewIssueCode;
}

export interface OwnerVisibleMultiFormatPreviewOpenInput {
  gate: string;
  requestId: string;
  source: HiddenMultiFormatPreviewOpenSource;
  localPath: string;
  displayName?: string;
}

export interface OwnerVisibleMultiFormatPreviewReplacementInput {
  gate: string;
  requestId: string;
  targetId: string;
  kind: "image" | "text";
  value: string;
}

export interface OwnerVisibleMultiFormatPreviewResetInput {
  gate: string;
  requestId: string;
  targetId?: string;
  kind?: "image" | "text";
}

export interface OwnerVisibleMultiFormatPreviewReplacementSelectionInput {
  targetId: string;
  kind: "image" | "text";
}

export type OwnerVisibleMultiFormatPreviewReplacementSelection =
  | {
      status: "accepted";
      format: "svga" | "lottie" | "vap";
      kind: "image" | "text";
      publicTargetId: string;
      runtimeTargetId: string;
      bindingToken: string;
      pathRedacted: true;
    }
  | {
      status: "blocked";
      diagnostic: {
        code: string;
        message: string;
      };
      pathRedacted: true;
    };

export interface OwnerVisibleMultiFormatPreviewCommandState {
  openFile: boolean;
  dragDrop: boolean;
  play: boolean;
  pause: boolean;
  seek: boolean;
  loop: boolean;
  recover: boolean;
  replace: boolean;
  resetReplacement: boolean;
  save: false;
  export: false;
}

export interface OwnerVisibleMultiFormatPreviewCanvasState {
  status: OwnerVisibleMultiFormatPreviewStatus;
  format?: MotionFormat;
  dimensions?: string;
  playback: PlaybackState;
  emptyCopy: string;
}

export interface OwnerVisibleMultiFormatPreviewFactRow {
  id: string;
  label: string;
  value: string;
  status: "pass" | "warning" | "fail" | "unknown";
}

export interface OwnerVisibleMultiFormatPreviewRightPanel {
  facts: readonly OwnerVisibleMultiFormatPreviewFactRow[];
  assetInventory: MultiFormatAssetInventory;
  layers: HiddenMultiFormatPreviewModel["layers"];
  assets: readonly HiddenMultiFormatPreviewAssetRow[];
  lottieTexts: readonly HiddenMultiFormatPreviewTextCandidate[];
  vapFusionImages: readonly VapPreparedFusionElement[];
  vapFusionTexts: readonly VapPreparedFusionElement[];
  unsupportedFeatures: HiddenMultiFormatPreviewModel["unsupportedFeatures"];
  issues: readonly OwnerVisibleMultiFormatPreviewIssue[];
}

export interface OwnerVisibleMultiFormatPreviewReplacementRecord {
  format: "svga" | "lottie" | "vap";
  targetId: string;
  kind: "image" | "text";
  valuePreview: string;
}

export interface OwnerVisibleMultiFormatPreviewReplacementState {
  status: "idle" | "previewDirty" | "blocked" | "failed";
  revision: number;
  dirty: boolean;
  resetEnabled: boolean;
  playerAction: "none" | "reloadPreview" | "remountPreview" | "remountSource" | "keepCurrentPreview";
  active: readonly OwnerVisibleMultiFormatPreviewReplacementRecord[];
  lastAction?: {
    requestId: string;
    type: "applyReplacement" | "resetReplacement";
    status: "accepted" | "blocked" | "failed";
    message: string;
    publicTargetId?: string;
    runtimeTargetId?: string;
    bindingToken?: string;
    diagnostic?: {
      code: string;
      message: string;
    };
  };
}

export interface OwnerVisibleMultiFormatPreviewPackageCandidateReadiness {
  productVersion: typeof OWNER_VISIBLE_MULTIFORMAT_PREVIEW_PRODUCT_VERSION;
  channel: "internal-candidate";
  packagePromotionAllowed: false;
  localStableReplacementAllowed: false;
  supportClaim: false;
  requiredBeforePromotion: readonly ["code_review", "qa_acceptance", "packaging_gate"];
}

export interface OwnerVisibleMultiFormatPreviewModel {
  schemaVersion: typeof OWNER_VISIBLE_MULTIFORMAT_PREVIEW_SCHEMA_VERSION;
  source: "owner-visible-0.2-multiformat-preview-candidate";
  productMode: "0.2-multiformat-preview-candidate";
  productVersion: typeof OWNER_VISIBLE_MULTIFORMAT_PREVIEW_PRODUCT_VERSION;
  status: OwnerVisibleMultiFormatPreviewStatus;
  requestId?: string;
  openedFrom?: HiddenMultiFormatPreviewOpenSource;
  displayName?: string;
  detectedFormat?: MotionFormat;
  pathRedacted: true;
  rendererHasFullPath: false;
  visibleIn01: false;
  supportClaim: false;
  saveExportSupported: false;
  packageReadiness: OwnerVisibleMultiFormatPreviewPackageCandidateReadiness;
  commands: OwnerVisibleMultiFormatPreviewCommandState;
  canvas: OwnerVisibleMultiFormatPreviewCanvasState;
  rightPanel: OwnerVisibleMultiFormatPreviewRightPanel;
  ownerRightPanelSnapshotEnvelope: OwnerRightPanelSnapshotEnvelopeV1;
  replacement: OwnerVisibleMultiFormatPreviewReplacementState;
}

export interface OwnerVisibleSvgaReplacementControllerResult {
  accepted: boolean;
  message: string;
  playerAction?: "remountPreview" | "remountSource" | "keepCurrentPreview";
  playback?: PlaybackState;
  diagnostic?: {
    code: string;
    message: string;
  };
}

export interface OwnerVisibleSvgaReplacementController {
  applyImage(input: {
    requestId: string;
    targetId: string;
    value: string;
    workspaceModel: HiddenMultiFormatPreviewModel;
  }): Promise<OwnerVisibleSvgaReplacementControllerResult>;
  reset(input: {
    requestId: string;
    workspaceModel: HiddenMultiFormatPreviewModel;
  }): Promise<OwnerVisibleSvgaReplacementControllerResult>;
}

export interface CreateOwnerVisibleMultiFormatPreviewCandidateOptions
  extends CreateHiddenMultiFormatPreviewWorkspaceOptions {
  svgaReplacementController?: OwnerVisibleSvgaReplacementController;
}

interface OpenContext {
  requestId: string;
  source: HiddenMultiFormatPreviewOpenSource;
  localPath: string;
  displayName?: string;
}

interface ReplacementContext {
  lottie: Record<string, HiddenLottiePreviewReplacement>;
  vap: Record<string, HiddenVapPreviewFusionReplacement>;
  active: OwnerVisibleMultiFormatPreviewReplacementRecord[];
  revision: number;
}

interface ResetSourceDependencies {
  lottieAdjacentResources: readonly string[];
}

export function createOwnerVisibleMultiFormatPreviewCandidate(
  options: CreateOwnerVisibleMultiFormatPreviewCandidateOptions
): OwnerVisibleMultiFormatPreviewCandidateSession {
  return new OwnerVisibleMultiFormatPreviewCandidateSession(options);
}

export class OwnerVisibleMultiFormatPreviewCandidateSession {
  private readonly workspace: ReturnType<typeof createHiddenMultiFormatPreviewWorkspace>;
  private readonly host: HiddenMultiFormatPreviewHost;
  private readonly svgaReplacementController: OwnerVisibleSvgaReplacementController | undefined;
  private activeGeneration = 0;
  private currentOpen?: OpenContext;
  private replacements: ReplacementContext = emptyReplacementContext();
  private resetSourceDependencies: ResetSourceDependencies = emptyResetSourceDependencies();
  private model: OwnerVisibleMultiFormatPreviewModel = idleModel();

  constructor(options: CreateOwnerVisibleMultiFormatPreviewCandidateOptions) {
    this.host = options.host;
    this.workspace = createHiddenMultiFormatPreviewWorkspace(options);
    this.svgaReplacementController = options.svgaReplacementController;
  }

  getModel(): OwnerVisibleMultiFormatPreviewModel {
    return cloneModel(this.model);
  }

  resolveReplacementSelection(
    input: OwnerVisibleMultiFormatPreviewReplacementSelectionInput
  ): OwnerVisibleMultiFormatPreviewReplacementSelection {
    return structuredClone(resolveReplacementSelection(this.model, input));
  }

  async openLocalCandidate(input: OwnerVisibleMultiFormatPreviewOpenInput): Promise<OwnerVisibleMultiFormatPreviewModel> {
    const generation = this.beginOperation();
    const validationIssue = validateOpenInput(input);
    if (validationIssue) {
      this.currentOpen = undefined;
      this.replacements = emptyReplacementContext();
      this.resetSourceDependencies = emptyResetSourceDependencies();
      this.model = failedModel([validationIssue], "failed");
      return this.getModel();
    }

    this.currentOpen = {
      requestId: input.requestId,
      source: input.source,
      localPath: input.localPath,
      ...(input.displayName ? { displayName: input.displayName } : {})
    };
    this.replacements = emptyReplacementContext();
    this.resetSourceDependencies = emptyResetSourceDependencies();
    this.model = {
      ...idleModel(),
      status: "loading",
      requestId: input.requestId,
      openedFrom: input.source,
      displayName: safeSourceName(input.displayName ?? input.localPath) || "motion asset",
      canvas: {
        ...idleModel().canvas,
        status: "loading",
        playback: playbackState("loading")
      }
    };

    let workspaceModel = await this.workspace.openLocalCandidate(toWorkspaceOpenInput(this.currentOpen, this.replacements));
    if (!this.isActive(generation)) return this.getModel();
    if (workspaceModel.status === "ready") {
      try {
        workspaceModel = await this.workspace.play();
      } catch (error) {
        if (!this.isActive(generation)) return this.getModel();
        const readyModel = this.workspace.getModel();
        workspaceModel = {
          ...readyModel,
          status: "playbackFailed",
          issues: [
            ...readyModel.issues,
            issue("playback_failure", "Owner-visible multi-format preview autoplay failed.", "error", {
              reason: "autoplay_play_rejected",
              cause: redactLocalPathsFromError(error, "autoplay failed", [this.currentOpen.localPath])
            }, this.currentOpen.localPath)
          ],
          playback: playbackState("error", readyModel.playback.durationMs)
        };
      }
      if (!this.isActive(generation)) return this.getModel();
    }
    this.resetSourceDependencies = resetSourceDependenciesFromWorkspace(workspaceModel);
    this.model = modelFromWorkspace(workspaceModel, this.replacements, undefined);
    return this.getModel();
  }

  async play(): Promise<OwnerVisibleMultiFormatPreviewModel> {
    if (this.model.status === "disposed") return this.getModel();
    const workspaceModel = await this.workspace.play();
    this.model = modelFromWorkspace(workspaceModel, this.replacements, this.model.replacement.lastAction);
    return this.getModel();
  }

  pause(): OwnerVisibleMultiFormatPreviewModel {
    if (this.model.status === "disposed") return this.getModel();
    this.model = modelFromWorkspace(this.workspace.pause(), this.replacements, this.model.replacement.lastAction);
    return this.getModel();
  }

  seek(timeMs: number): OwnerVisibleMultiFormatPreviewModel {
    if (this.model.status === "disposed") return this.getModel();
    this.model = modelFromWorkspace(this.workspace.seek(timeMs), this.replacements, this.model.replacement.lastAction);
    return this.getModel();
  }

  setLoop(loop: boolean): OwnerVisibleMultiFormatPreviewModel {
    if (this.model.status === "disposed") return this.getModel();
    this.model = modelFromWorkspace(this.workspace.setLoop(loop), this.replacements, this.model.replacement.lastAction);
    return this.getModel();
  }

  async recoverPlayback(): Promise<OwnerVisibleMultiFormatPreviewModel> {
    if (this.model.status === "disposed") return this.getModel();
    const workspaceModel = await this.workspace.recoverPlayback();
    this.model = modelFromWorkspace(workspaceModel, this.replacements, this.model.replacement.lastAction);
    return this.getModel();
  }

  async applyReplacement(
    input: OwnerVisibleMultiFormatPreviewReplacementInput
  ): Promise<OwnerVisibleMultiFormatPreviewModel> {
    const generation = this.beginOperation();
    const validationIssue = validateReplacementInput(input);
    if (validationIssue) {
      this.model = withReplacementAction(this.model, this.replacements, {
        requestId: input.requestId,
        type: "applyReplacement",
        status: "blocked",
        message: validationIssue.message,
        diagnostic: diagnosticFromIssue(validationIssue)
      }, "blocked", "keepCurrentPreview");
      return this.getModel();
    }
    if (!this.currentOpen || !this.model.detectedFormat) {
      return this.blockReplacement(input.requestId, "applyReplacement", "No opened motion asset is available for replacement preview.", {
        code: "replacement_requires_open_asset",
        message: "Replacement preview requires an opened SVGA, Lottie, or VAP candidate."
      });
    }

    const selection = resolveReplacementSelection(this.model, input);
    if (selection.status !== "accepted") {
      return this.blockReplacement(
        input.requestId,
        "applyReplacement",
        selection.diagnostic.message,
        selection.diagnostic
      );
    }
    const target: ReplacementTarget = {
      format: selection.format,
      runtimeTargetId: selection.runtimeTargetId
    };

    if (target.format === "svga") {
      return this.applySvgaReplacement(input, selection, generation);
    }

    const nextReplacements = cloneReplacementContext(this.replacements);
    nextReplacements.active = upsertReplacementRecord(nextReplacements.active, {
      format: target.format,
      targetId: target.runtimeTargetId,
      kind: input.kind,
      valuePreview: replacementValuePreview(input.kind, input.value)
    });
    nextReplacements.revision += 1;

    if (target.format === "lottie") {
      nextReplacements.lottie[target.runtimeTargetId] = { kind: input.kind, value: input.value };
    } else {
      nextReplacements.vap[target.runtimeTargetId] = { kind: input.kind, value: input.value };
    }

    const workspaceModel = await this.workspace.openLocalCandidate(toWorkspaceOpenInput({
      ...this.currentOpen,
      requestId: input.requestId
    }, nextReplacements));
    if (!this.isActive(generation)) return this.getModel();
    const accepted = workspaceModel.status === "ready" || workspaceModel.status === "playing" || workspaceModel.status === "paused";
    if (!accepted) {
      this.model = modelFromWorkspace(workspaceModel, this.replacements, {
        requestId: input.requestId,
        type: "applyReplacement",
        status: "failed",
        message: "Replacement preview was rejected by the active format vertical.",
        diagnostic: firstIssueDiagnostic(workspaceModel.issues)
      }, "failed", "keepCurrentPreview");
      return this.getModel();
    }

    this.currentOpen = { ...this.currentOpen, requestId: input.requestId };
    this.replacements = nextReplacements;
    this.model = modelFromWorkspace(workspaceModel, this.replacements, {
      requestId: input.requestId,
      type: "applyReplacement",
      status: "accepted",
      message: "Replacement preview is applied to the runtime candidate only.",
      publicTargetId: selection.publicTargetId,
      runtimeTargetId: selection.runtimeTargetId,
      bindingToken: selection.bindingToken
    }, "previewDirty", "reloadPreview");
    return this.getModel();
  }

  async resetReplacement(input: OwnerVisibleMultiFormatPreviewResetInput): Promise<OwnerVisibleMultiFormatPreviewModel> {
    const generation = this.beginOperation();
    const validationIssue = validateResetInput(input);
    if (validationIssue) {
      this.model = withReplacementAction(this.model, this.replacements, {
        requestId: input.requestId,
        type: "resetReplacement",
        status: "blocked",
        message: validationIssue.message,
        diagnostic: diagnosticFromIssue(validationIssue)
      }, "blocked", "keepCurrentPreview");
      return this.getModel();
    }
    if (!this.currentOpen || !this.model.detectedFormat || !this.replacements.active.length) {
      return this.blockReplacement(input.requestId, "resetReplacement", "There is no runtime replacement preview to reset.", {
        code: "replacement_reset_not_needed",
        message: "Reset is enabled only after a runtime replacement preview is applied."
      });
    }

    const targetedReset = input.targetId !== undefined || input.kind !== undefined;
    const selection = targetedReset
      ? resolveReplacementSelection(this.model, {
          targetId: input.targetId ?? "",
          kind: input.kind === "text" ? "text" : "image"
        })
      : undefined;
    if (selection?.status === "blocked") {
      return this.blockReplacement(
        input.requestId,
        "resetReplacement",
        selection.diagnostic.message,
        selection.diagnostic
      );
    }
    if (selection?.status === "accepted" && !hasActiveReplacement(this.replacements, selection)) {
      return this.blockReplacement(input.requestId, "resetReplacement", "The selected runtime replacement is not active.", {
        code: "replacement_reset_not_needed",
        message: "Reset is enabled only for an active runtime replacement target."
      });
    }

    if (this.model.detectedFormat === "svga") {
      return this.resetSvgaReplacement(
        input,
        generation,
        selection?.status === "accepted" ? selection : undefined
      );
    }

    const resetPreflightDiagnostic = await this.preflightResetSource();
    if (!this.isActive(generation)) return this.getModel();
    if (resetPreflightDiagnostic) {
      return this.failReplacement(
        input.requestId,
        "resetReplacement",
        "Runtime replacement reset could not reopen the original source.",
        resetPreflightDiagnostic
      );
    }

    const previousOpen = { ...this.currentOpen };
    const previousReplacements = cloneReplacementContext(this.replacements);
    const previousDependencies = cloneResetSourceDependencies(this.resetSourceDependencies);
    const nextReplacements = selection?.status === "accepted"
      ? replacementContextWithoutTarget(this.replacements, selection)
      : emptyReplacementContext(this.replacements.revision + 1);
    const workspaceModel = await this.workspace.openLocalCandidate(toWorkspaceOpenInput({
      ...this.currentOpen,
      requestId: input.requestId
    }, nextReplacements));
    if (!this.isActive(generation)) return this.getModel();
    const resetFailureDiagnostic = resetFailureDiagnosticForWorkspace(workspaceModel, this.model.detectedFormat);
    if (resetFailureDiagnostic) {
      return this.failResetWithRollback(
        input.requestId,
        "Runtime replacement reset was rejected by the active format vertical.",
        resetFailureDiagnostic,
        previousOpen,
        previousReplacements,
        previousDependencies,
        generation
      );
    }
    this.currentOpen = { ...this.currentOpen, requestId: input.requestId };
    this.replacements = nextReplacements;
    this.resetSourceDependencies = resetSourceDependenciesFromWorkspace(workspaceModel);
    const hasRemainingReplacements = nextReplacements.active.length > 0;
    this.model = modelFromWorkspace(workspaceModel, this.replacements, {
      requestId: input.requestId,
      type: "resetReplacement",
      status: "accepted",
      message: hasRemainingReplacements
        ? "The selected runtime replacement preview has been reset."
        : "Runtime replacement preview has been reset to the opened source.",
      ...(selection?.status === "accepted" ? {
        publicTargetId: selection.publicTargetId,
        runtimeTargetId: selection.runtimeTargetId,
        bindingToken: selection.bindingToken
      } : {})
    }, hasRemainingReplacements ? "previewDirty" : "idle", hasRemainingReplacements ? "reloadPreview" : "remountSource");
    return this.getModel();
  }

  private async preflightResetSource(): Promise<{ code: string; message: string } | undefined> {
    const localPath = this.currentOpen?.localPath;
    if (!localPath) {
      return {
        code: "replacement_requires_open_asset",
        message: "Reset requires an opened motion asset."
      };
    }
    try {
      const stat = await this.host.statLocalFile(localPath);
      const boundedLength = Number.isFinite(stat.sizeBytes) && stat.sizeBytes > 0
        ? Math.min(1, Math.trunc(stat.sizeBytes))
        : 1;
      await this.host.readLocalFileRange(localPath, 0, boundedLength);
    } catch (error) {
      return {
        code: "parse_precondition",
        message: `Original source could not be reopened for runtime replacement reset: ${redactLocalPathsFromError(
          error,
          "Source unavailable.",
          [localPath]
        )}`
      };
    }
    if (this.model.detectedFormat === "lottie") {
      return this.preflightLottieResetResources(localPath);
    }
    return undefined;
  }

  private async preflightLottieResetResources(localPath: string): Promise<{ code: string; message: string } | undefined> {
    for (const relativePath of this.resetSourceDependencies.lottieAdjacentResources) {
      try {
        const read = await this.host.readAdjacentResource({
          sourceLocalPath: localPath,
          relativePath,
          maxBytes: LOTTIE_ADJACENT_RESOURCE_MAX_BYTES
        });
        const sizeBytes = read.sizeBytes ?? read.bytes.byteLength;
        if (sizeBytes > LOTTIE_ADJACENT_RESOURCE_MAX_BYTES || read.bytes.byteLength > LOTTIE_ADJACENT_RESOURCE_MAX_BYTES) {
          return {
            code: "capability",
            message: "Original Lottie adjacent image resource exceeds the runtime reset bound."
          };
        }
      } catch (error) {
        return {
          code: "missing_resource",
          message: `Original Lottie adjacent image resource could not be reopened for runtime reset: ${redactLocalPathsFromError(
            error,
            "Adjacent resource unavailable.",
            [localPath]
          )}`
        };
      }
    }
    return undefined;
  }

  dispose(): OwnerVisibleMultiFormatPreviewModel {
    this.activeGeneration += 1;
    this.workspace.dispose();
    this.currentOpen = undefined;
    this.replacements = emptyReplacementContext(this.replacements.revision);
    this.resetSourceDependencies = emptyResetSourceDependencies();
    this.model = {
      ...this.model,
      status: "disposed",
      canvas: {
        ...this.model.canvas,
        status: "disposed",
        playback: playbackState("disposed", this.model.canvas.playback.durationMs)
      },
      commands: commandState("disposed", this.model.replacement),
      replacement: {
        ...this.model.replacement,
        playerAction: "none"
      }
    };
    return this.getModel();
  }

  private async applySvgaReplacement(
    input: OwnerVisibleMultiFormatPreviewReplacementInput,
    selection: Extract<OwnerVisibleMultiFormatPreviewReplacementSelection, { status: "accepted" }>,
    generation: number
  ): Promise<OwnerVisibleMultiFormatPreviewModel> {
    if (input.kind !== "image") {
      return this.blockReplacement(input.requestId, "applyReplacement", "SVGA runtime preview currently accepts imageKey replacements only.", {
        code: "svga_text_replacement_unsupported",
        message: "Text replacement is not a supported SVGA runtime preview operation in WP5."
      });
    }
    if (!this.svgaReplacementController) {
      return this.blockReplacement(input.requestId, "applyReplacement", "SVGA runtime replacement preview controller is not configured.", {
        code: "svga_replacement_controller_missing",
        message: "The owner-preview candidate fails closed without an injected SVGA replacement controller."
      });
    }
    const workspaceModel = this.workspace.getModel();
    let result: OwnerVisibleSvgaReplacementControllerResult;
    try {
      result = await this.svgaReplacementController.applyImage({
        requestId: input.requestId,
        targetId: selection.runtimeTargetId,
        value: input.value,
        workspaceModel
      });
    } catch (error) {
      if (!this.isActive(generation)) return this.getModel();
      return this.failReplacement(input.requestId, "applyReplacement", "SVGA replacement controller failed.", {
        code: "svga_replacement_controller_failed",
        message: redactLocalPathsFromError(error, "SVGA replacement controller failed.")
      });
    }
    if (!this.isActive(generation)) return this.getModel();
    if (!result.accepted) {
      return this.blockReplacement(input.requestId, "applyReplacement", result.message, result.diagnostic);
    }
    this.replacements = cloneReplacementContext(this.replacements);
    this.replacements.revision += 1;
    this.replacements.active = upsertReplacementRecord(this.replacements.active, {
      format: "svga",
      targetId: selection.runtimeTargetId,
      kind: "image",
      valuePreview: replacementValuePreview("image", input.value)
    });
    const baseModel = this.workspace.getModel();
    const updated = {
      ...baseModel,
      requestId: input.requestId,
      playback: result.playback ?? baseModel.playback
    };
    this.model = modelFromWorkspace(updated, this.replacements, {
      requestId: input.requestId,
      type: "applyReplacement",
      status: "accepted",
      message: result.message,
      publicTargetId: selection.publicTargetId,
      runtimeTargetId: selection.runtimeTargetId,
      bindingToken: selection.bindingToken
    }, "previewDirty", result.playerAction ?? "remountPreview");
    return this.getModel();
  }

  private async resetSvgaReplacement(
    input: OwnerVisibleMultiFormatPreviewResetInput,
    generation: number,
    selection?: Extract<OwnerVisibleMultiFormatPreviewReplacementSelection, { status: "accepted" }>
  ): Promise<OwnerVisibleMultiFormatPreviewModel> {
    if (!this.svgaReplacementController) {
      return this.blockReplacement(input.requestId, "resetReplacement", "SVGA runtime replacement preview controller is not configured.", {
        code: "svga_replacement_controller_missing",
        message: "The owner-preview candidate cannot reset a controller it does not own."
      });
    }
    let result: OwnerVisibleSvgaReplacementControllerResult;
    try {
      result = await this.svgaReplacementController.reset({
        requestId: input.requestId,
        workspaceModel: this.workspace.getModel()
      });
    } catch (error) {
      if (!this.isActive(generation)) return this.getModel();
      return this.failReplacement(input.requestId, "resetReplacement", "SVGA replacement controller reset failed.", {
        code: "svga_replacement_reset_failed",
        message: redactLocalPathsFromError(error, "SVGA replacement controller reset failed.")
      });
    }
    if (!this.isActive(generation)) return this.getModel();
    if (!result.accepted) {
      return this.blockReplacement(input.requestId, "resetReplacement", result.message, result.diagnostic);
    }
    this.replacements = emptyReplacementContext(this.replacements.revision + 1);
    const baseModel = this.workspace.getModel();
    this.model = modelFromWorkspace({
      ...baseModel,
      requestId: input.requestId,
      playback: result.playback ?? baseModel.playback
    }, this.replacements, {
      requestId: input.requestId,
      type: "resetReplacement",
      status: "accepted",
      message: result.message,
      ...(selection ? {
        publicTargetId: selection.publicTargetId,
        runtimeTargetId: selection.runtimeTargetId,
        bindingToken: selection.bindingToken
      } : {})
    }, "idle", result.playerAction ?? "remountSource");
    return this.getModel();
  }

  private blockReplacement(
    requestId: string,
    type: "applyReplacement" | "resetReplacement",
    message: string,
    diagnostic?: { code: string; message: string }
  ): OwnerVisibleMultiFormatPreviewModel {
    this.model = withReplacementAction(this.model, this.replacements, {
      requestId,
      type,
      status: "blocked",
      message,
      ...(diagnostic ? { diagnostic } : {})
    }, "blocked", "keepCurrentPreview");
    return this.getModel();
  }

  private failReplacement(
    requestId: string,
    type: "applyReplacement" | "resetReplacement",
    message: string,
    diagnostic?: { code: string; message: string }
  ): OwnerVisibleMultiFormatPreviewModel {
    this.model = withReplacementAction(this.model, this.replacements, {
      requestId,
      type,
      status: "failed",
      message,
      ...(diagnostic ? { diagnostic } : {})
    }, "failed", "keepCurrentPreview");
    return this.getModel();
  }

  private async failResetWithRollback(
    requestId: string,
    message: string,
    diagnostic: { code: string; message: string },
    previousOpen: OpenContext,
    previousReplacements: ReplacementContext,
    previousDependencies: ResetSourceDependencies,
    generation: number
  ): Promise<OwnerVisibleMultiFormatPreviewModel> {
    const rollbackModel = await this.workspace.openLocalCandidate(toWorkspaceOpenInput({
      ...previousOpen,
      requestId: `${requestId}:rollback`
    }, previousReplacements));
    if (!this.isActive(generation)) return this.getModel();
    this.currentOpen = { ...previousOpen, requestId };
    this.replacements = previousReplacements;
    this.resetSourceDependencies = previousDependencies;
    this.model = modelFromWorkspace({
      ...rollbackModel,
      requestId
    }, this.replacements, {
      requestId,
      type: "resetReplacement",
      status: "failed",
      message,
      diagnostic
    }, "failed", "keepCurrentPreview");
    return this.getModel();
  }

  private beginOperation(): number {
    this.activeGeneration += 1;
    return this.activeGeneration;
  }

  private isActive(generation: number): boolean {
    return this.activeGeneration === generation && this.model.status !== "disposed";
  }
}

interface ReplacementTarget {
  format: "svga" | "lottie" | "vap";
  runtimeTargetId: string;
}

function toWorkspaceOpenInput(
  open: OpenContext,
  replacements: ReplacementContext
): HiddenMultiFormatPreviewOpenInput {
  return {
    gate: HIDDEN_MULTIFORMAT_PREVIEW_WORKSPACE_GATE,
    requestId: open.requestId,
    source: open.source,
    localPath: open.localPath,
    ...(open.displayName ? { displayName: open.displayName } : {}),
    ...(Object.keys(replacements.lottie).length > 0 ? { lottieReplacements: replacements.lottie } : {}),
    ...(Object.keys(replacements.vap).length > 0 ? { vapFusionReplacements: replacements.vap } : {})
  };
}

function modelFromWorkspace(
  workspaceModel: HiddenMultiFormatPreviewModel,
  replacements: ReplacementContext,
  lastReplacementAction: OwnerVisibleMultiFormatPreviewReplacementState["lastAction"],
  replacementStatus?: OwnerVisibleMultiFormatPreviewReplacementState["status"],
  playerAction?: OwnerVisibleMultiFormatPreviewReplacementState["playerAction"]
): OwnerVisibleMultiFormatPreviewModel {
  const status = ownerStatus(workspaceModel.status);
  const replacement = replacementState(replacements, lastReplacementAction, replacementStatus, playerAction);
  const visibleIssues = uniqueIssues(workspaceModel.issues);
  const facts = factRows(workspaceModel);
  const rightPanel: OwnerVisibleMultiFormatPreviewRightPanel = {
    facts,
    assetInventory: buildMultiFormatAssetInventory({
      format: workspaceModel.detectedFormat,
      videoCodec: workspaceModel.overview?.videoCodec,
      audioPresent: workspaceModel.overview?.audioPresent,
      assets: workspaceModel.assets,
      layers: workspaceModel.layers,
      lottieTexts: workspaceModel.replaceable.texts,
      vapFusionImages: workspaceModel.replaceable.fusionImages,
      vapFusionTexts: workspaceModel.replaceable.fusionTexts,
      issues: visibleIssues,
      unsupportedFeatures: workspaceModel.unsupportedFeatures
    }),
    layers: workspaceModel.layers.map((entry) => ({ ...entry, resourceIds: [...entry.resourceIds] })),
    assets: workspaceModel.assets.map((entry) => ({ ...entry })),
    lottieTexts: workspaceModel.replaceable.texts.map((entry) => ({ ...entry })),
    vapFusionImages: workspaceModel.replaceable.fusionImages.map(cloneFusionElement),
    vapFusionTexts: workspaceModel.replaceable.fusionTexts.map(cloneFusionElement),
    unsupportedFeatures: workspaceModel.unsupportedFeatures.map((entry) => ({ ...entry })),
    issues: visibleIssues.map(cloneIssue)
  };
  const ownerRightPanelSnapshotEnvelope = createOwnerRightPanelSnapshotEnvelope({
    detectedFormat: workspaceModel.detectedFormat,
    facts,
    assets: workspaceModel.assets,
    lottieTexts: workspaceModel.replaceable.texts,
    vapFusionImages: workspaceModel.replaceable.fusionImages,
    vapFusionTexts: workspaceModel.replaceable.fusionTexts,
    issues: visibleIssues,
    unsupportedFeatures: workspaceModel.unsupportedFeatures,
    videoCodec: workspaceModel.overview?.videoCodec,
    audioPresent: workspaceModel.overview?.audioPresent
  });
  return {
    schemaVersion: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_SCHEMA_VERSION,
    source: "owner-visible-0.2-multiformat-preview-candidate",
    productMode: "0.2-multiformat-preview-candidate",
    productVersion: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_PRODUCT_VERSION,
    status,
    requestId: workspaceModel.requestId,
    openedFrom: workspaceModel.openedFrom,
    displayName: workspaceModel.displayName,
    detectedFormat: workspaceModel.detectedFormat,
    pathRedacted: true,
    rendererHasFullPath: false,
    visibleIn01: false,
    supportClaim: false,
    saveExportSupported: false,
    packageReadiness: packageReadiness(),
    commands: commandState(status, replacement),
    canvas: {
      status,
      format: workspaceModel.detectedFormat,
      dimensions: workspaceModel.overview?.dimensions,
      playback: { ...workspaceModel.playback },
      emptyCopy: workspaceModel.detectedFormat
        ? "Preview candidate is available only inside the 0.2 gated workflow."
        : "Open or drop a local SVGA, Lottie JSON, or VAP/MP4 candidate."
    },
    rightPanel,
    ownerRightPanelSnapshotEnvelope,
    replacement
  };
}

function uniqueIssues<T extends WorkbenchIssue>(issues: readonly T[]): T[] {
  const seen = new Set<string>();
  return issues.filter((entry) => {
    const key = entry.details?.reason === "vap_dimensions_over_1504"
      ? JSON.stringify([entry.code, entry.severity, entry.details.reason, entry.details.limit ?? null])
      : JSON.stringify([entry.code, entry.severity, entry.message, entry.details ?? null]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ownerStatus(status: HiddenMultiFormatPreviewStatus): OwnerVisibleMultiFormatPreviewStatus {
  switch (status) {
    case "idle": return "launch";
    case "inspectionReady":
    case "ready": return "previewReady";
    default: return status;
  }
}

function factRows(model: HiddenMultiFormatPreviewModel): OwnerVisibleMultiFormatPreviewFactRow[] {
  const overview = model.overview;
  if (!overview) {
    return [{
      id: "mode",
      label: "Mode",
      value: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_PRODUCT_VERSION,
      status: "unknown"
    }];
  }
  const oversizedVapCanvas = overview.format === "vap" && model.issues.some(({ details }) =>
    details?.reason === "vap_dimensions_over_1504"
  );
  const rows: OwnerVisibleMultiFormatPreviewFactRow[] = [
    { id: "format", label: "Format", value: overview.format.toUpperCase(), status: "pass" },
    { id: "dimensions", label: "Canvas", value: overview.dimensions ?? "unknown", status: overview.dimensions ? (oversizedVapCanvas ? "warning" : "pass") : "unknown" },
    { id: "duration", label: "Duration", value: formatDuration(overview.durationMs), status: overview.durationMs ? "pass" : "unknown" },
    { id: "layers", label: "Layers", value: String(overview.layerCount), status: "pass" },
    { id: "assets", label: "Assets", value: String(overview.resourceCount), status: "pass" },
    { id: "replaceable", label: "Replaceable", value: String(
      model.replaceable.images.length
        + model.replaceable.texts.length
        + model.replaceable.fusionImages.length
        + model.replaceable.fusionTexts.length
    ), status: "pass" },
    { id: "maturity", label: "Maturity", value: overview.sourceMaturity, status: overview.sourceMaturity === "current" ? "pass" : "warning" }
  ];
  if (overview.videoCodec) rows.push({ id: "videoCodec", label: "Video codec", value: overview.videoCodec, status: overview.videoCodec === "avc1" || overview.videoCodec === "avc3" ? "pass" : "warning" });
  if (overview.audioPresent !== undefined) rows.push({ id: "audio", label: "Audio", value: overview.audioPresent ? "present" : "not present", status: "pass" });
  if (overview.unsupportedFeatureCount > 0) rows.push({ id: "unsupported", label: "Unsupported", value: String(overview.unsupportedFeatureCount), status: "warning" });
  return rows;
}

function replacementState(
  replacements: ReplacementContext,
  lastAction: OwnerVisibleMultiFormatPreviewReplacementState["lastAction"],
  status?: OwnerVisibleMultiFormatPreviewReplacementState["status"],
  playerAction?: OwnerVisibleMultiFormatPreviewReplacementState["playerAction"]
): OwnerVisibleMultiFormatPreviewReplacementState {
  const active = replacements.active.map((entry) => ({ ...entry }));
  const dirty = active.length > 0;
  return {
    status: status ?? (dirty ? "previewDirty" : "idle"),
    revision: replacements.revision,
    dirty,
    resetEnabled: dirty,
    playerAction: playerAction ?? "none",
    active,
    ...(lastAction ? { lastAction: { ...lastAction, diagnostic: lastAction.diagnostic ? { ...lastAction.diagnostic } : undefined } } : {})
  };
}

function commandState(
  status: OwnerVisibleMultiFormatPreviewStatus,
  replacement: OwnerVisibleMultiFormatPreviewReplacementState
): OwnerVisibleMultiFormatPreviewCommandState {
  const hasPreview = ["previewReady", "playing", "paused", "playbackBlocked", "playbackFailed"].includes(status);
  return {
    openFile: status !== "disposed",
    dragDrop: status !== "disposed",
    play: status === "previewReady" || status === "paused",
    pause: status === "playing",
    seek: hasPreview,
    loop: hasPreview,
    recover: status === "playbackBlocked" || status === "playbackFailed",
    replace: hasPreview,
    resetReplacement: replacement.resetEnabled,
    save: false,
    export: false
  };
}

function resolveReplacementSelection(
  model: OwnerVisibleMultiFormatPreviewModel,
  input: OwnerVisibleMultiFormatPreviewReplacementSelectionInput
): OwnerVisibleMultiFormatPreviewReplacementSelection {
  const requestedTargetId = isNonEmptyString(input.targetId) ? input.targetId.trim() : "";
  if (!requestedTargetId || (input.kind !== "image" && input.kind !== "text")) {
    return blockedReplacementSelection(
      "replacement_target_malformed",
      "Replacement target identity is malformed."
    );
  }
  if (model.detectedFormat === "svga" && input.kind === "image") {
    const asset = model.rightPanel.assets.find((entry) => entry.replaceable && (
      entry.id === requestedTargetId || entry.name === requestedTargetId
    ));
    return asset
      ? acceptedReplacementSelection(model, input.kind, "svga", requestedTargetId, asset.id)
      : blockedReplacementSelection(
          "replacement_target_unavailable",
          "The selected target is not replaceable for the active format."
        );
  }
  if (model.detectedFormat === "lottie") {
    const candidates = [
      ...model.rightPanel.assets
        .filter((entry) => entry.kind === "image" && entry.replaceable)
        .map((entry) => ({
          kind: "image" as const,
          publicAliases: uniqueStrings([entry.id]),
          runtimeTargetId: entry.id
        })),
      ...model.rightPanel.lottieTexts
        .filter((entry) => entry.replaceable)
        .map((entry) => ({
          kind: "text" as const,
          publicAliases: uniqueStrings([entry.id, entry.layerId, entry.name]),
          runtimeTargetId: entry.id
        }))
    ];
    const publicMatches = candidates.filter((entry) => entry.publicAliases.includes(requestedTargetId));
    if (publicMatches.length === 0) {
      return blockedReplacementSelection(
        "replacement_target_unavailable",
        "The selected target is not replaceable for the active format."
      );
    }
    if (publicMatches.length !== 1 || publicMatches[0].kind !== input.kind) {
      return blockedReplacementSelection(
        "replacement_target_ambiguous",
        "The selected Lottie replacement identity is ambiguous."
      );
    }
    const target = publicMatches[0];
    if (!isNonEmptyString(target.runtimeTargetId)) {
      return blockedReplacementSelection(
        "replacement_target_malformed",
        "The selected Lottie replacement has a malformed runtime binding."
      );
    }
    const canonicalRuntimeKey = target.runtimeTargetId.trim();
    const canonicalMatches = candidates.filter((entry) =>
      isNonEmptyString(entry.runtimeTargetId)
      && entry.runtimeTargetId.trim() === canonicalRuntimeKey
    );
    if (canonicalMatches.length !== 1) {
      return blockedReplacementSelection(
        "replacement_target_ambiguous",
        "The selected Lottie runtime binding is ambiguous."
      );
    }
    return acceptedReplacementSelection(
      model,
      input.kind,
      "lottie",
      requestedTargetId,
      canonicalRuntimeKey
    );
  }
  if (model.detectedFormat === "vap") {
    const candidates = input.kind === "image" ? model.rightPanel.vapFusionImages : model.rightPanel.vapFusionTexts;
    const matches = candidates.filter((entry) => entry.resourceId === requestedTargetId);
    if (matches.length === 0) {
      return blockedReplacementSelection(
        "replacement_target_unavailable",
        "The selected VAP fusion resource is not available."
      );
    }
    if (matches.length !== 1) {
      return blockedReplacementSelection(
        "replacement_target_ambiguous",
        "The selected VAP fusion resource identity is ambiguous."
      );
    }
    const target = matches[0];
    if (!isValidVapReplacementBinding(target, input.kind)) {
      return blockedReplacementSelection(
        "replacement_target_malformed",
        "The selected VAP fusion resource has a malformed runtime binding."
      );
    }
    if (!target.replaceable) {
      return blockedReplacementSelection(
        "replacement_target_not_replaceable",
        "The selected VAP fusion resource is not replaceable."
      );
    }
    const canonicalRuntimeKey = target.runtimeBindingKey.trim();
    const canonicalMatches = [
      ...model.rightPanel.vapFusionImages,
      ...model.rightPanel.vapFusionTexts
    ].filter((entry) =>
      isNonEmptyString(entry.runtimeBindingKey)
      && entry.runtimeBindingKey.trim() === canonicalRuntimeKey
    );
    if (canonicalMatches.length !== 1) {
      return blockedReplacementSelection(
        "replacement_target_ambiguous",
        "The selected VAP fusion runtime binding is ambiguous."
      );
    }
    return acceptedReplacementSelection(
      model,
      input.kind,
      "vap",
      target.resourceId,
      canonicalRuntimeKey
    );
  }
  return blockedReplacementSelection(
    "replacement_target_unavailable",
    "The selected target is not replaceable for the active format."
  );
}

function acceptedReplacementSelection(
  model: OwnerVisibleMultiFormatPreviewModel,
  kind: "image" | "text",
  format: "svga" | "lottie" | "vap",
  publicTargetId: string,
  runtimeTargetId: string
): OwnerVisibleMultiFormatPreviewReplacementSelection {
  const normalizedRuntimeTargetId = runtimeTargetId.trim();
  return {
    status: "accepted",
    format,
    kind,
    publicTargetId,
    runtimeTargetId: normalizedRuntimeTargetId,
    bindingToken: JSON.stringify([
      model.requestId ?? "",
      model.detectedFormat ?? "",
      model.replacement.revision,
      kind,
      publicTargetId,
      normalizedRuntimeTargetId
    ]),
    pathRedacted: true
  };
}

function blockedReplacementSelection(
  code: string,
  message: string
): OwnerVisibleMultiFormatPreviewReplacementSelection {
  return {
    status: "blocked",
    diagnostic: { code, message },
    pathRedacted: true
  };
}

function isValidVapReplacementBinding(
  target: VapPreparedFusionElement,
  kind: "image" | "text"
): target is VapPreparedFusionElement & { runtimeBindingKey: string } {
  if (target.kind !== kind) return false;
  if (!isNonEmptyString(target.id) || !isNonEmptyString(target.resourceId) || !isNonEmptyString(target.runtimeBindingKey)) {
    return false;
  }
  for (const optional of [target.layerId, target.srcId, target.srcTag]) {
    if (optional !== undefined && !isNonEmptyString(optional)) return false;
  }
  return true;
}

function validateOpenInput(input: OwnerVisibleMultiFormatPreviewOpenInput): OwnerVisibleMultiFormatPreviewIssue | undefined {
  if (input.gate !== OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE) {
    return issue("unsupported", "Owner-visible multi-format preview candidate is unavailable outside the authorized 0.2 gate.", "error", {
      reason: "gate_required"
    });
  }
  if (!isNonEmptyString(input.requestId) || !isOpenSource(input.source) || !isNonEmptyString(input.localPath)) {
    return issue("parse_precondition", "Owner-visible multi-format preview open input is incomplete.", "error", {
      reason: "open_input_invalid"
    }, input.localPath);
  }
  return undefined;
}

function validateReplacementInput(
  input: OwnerVisibleMultiFormatPreviewReplacementInput
): OwnerVisibleMultiFormatPreviewIssue | undefined {
  if (input.gate !== OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE) {
    return issue("unsupported", "Runtime replacement preview is unavailable outside the authorized 0.2 gate.", "error", {
      reason: "gate_required"
    });
  }
  if (!isNonEmptyString(input.requestId) || !isNonEmptyString(input.targetId) || (input.kind !== "image" && input.kind !== "text")) {
    return issue("parse_precondition", "Runtime replacement preview input is incomplete.", "error", {
      reason: "replacement_input_invalid"
    });
  }
  if (typeof input.value !== "string") {
    return issue("parse_precondition", "Runtime replacement preview value must be a string.", "error", {
      reason: "replacement_value_invalid"
    });
  }
  if (input.kind === "image" && !isSafeInlineOrBlobImage(input.value)) {
    return issue("unsupported_feature", "Runtime image replacement must be an inline data image or local object URL.", "error", {
      reason: "replacement_image_must_be_local"
    });
  }
  if (input.kind === "text" && input.value.length > 4_096) {
    return issue("capability", "Runtime text replacement exceeds the 0.2 candidate limit.", "error", {
      reason: "replacement_text_too_large",
      maxCharacters: 4_096
    });
  }
  return undefined;
}

function validateResetInput(input: OwnerVisibleMultiFormatPreviewResetInput): OwnerVisibleMultiFormatPreviewIssue | undefined {
  if (input.gate !== OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE) {
    return issue("unsupported", "Runtime replacement reset is unavailable outside the authorized 0.2 gate.", "error", {
      reason: "gate_required"
    });
  }
  if (!isNonEmptyString(input.requestId)) {
    return issue("parse_precondition", "Runtime replacement reset input is incomplete.", "error", {
      reason: "replacement_reset_input_invalid"
    });
  }
  const hasTargetId = input.targetId !== undefined;
  const hasKind = input.kind !== undefined;
  if (hasTargetId !== hasKind || (hasTargetId && !isNonEmptyString(input.targetId)) || (hasKind && input.kind !== "image" && input.kind !== "text")) {
    return issue("parse_precondition", "Runtime replacement reset target is incomplete.", "error", {
      reason: "replacement_reset_target_invalid"
    });
  }
  return undefined;
}

function withReplacementAction(
  model: OwnerVisibleMultiFormatPreviewModel,
  replacements: ReplacementContext,
  lastAction: NonNullable<OwnerVisibleMultiFormatPreviewReplacementState["lastAction"]>,
  status: OwnerVisibleMultiFormatPreviewReplacementState["status"],
  playerAction: OwnerVisibleMultiFormatPreviewReplacementState["playerAction"]
): OwnerVisibleMultiFormatPreviewModel {
  const replacement = replacementState(replacements, lastAction, status, playerAction);
  return {
    ...model,
    replacement,
    commands: commandState(model.status, replacement)
  };
}

function failedModel(
  issues: readonly OwnerVisibleMultiFormatPreviewIssue[],
  status: OwnerVisibleMultiFormatPreviewStatus
): OwnerVisibleMultiFormatPreviewModel {
  const ownerRightPanelSnapshotEnvelope = emptyOwnerRightPanelSnapshotEnvelope(issues);
  return {
    ...idleModel(),
    status,
    canvas: {
      ...idleModel().canvas,
      status,
      playback: playbackState("error")
    },
    rightPanel: {
      ...idleModel().rightPanel,
      issues: issues.map(cloneIssue)
    },
    ownerRightPanelSnapshotEnvelope
  };
}

function idleModel(): OwnerVisibleMultiFormatPreviewModel {
  const replacement = replacementState(emptyReplacementContext(), undefined);
  const ownerRightPanelSnapshotEnvelope = emptyOwnerRightPanelSnapshotEnvelope();
  return {
    schemaVersion: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_SCHEMA_VERSION,
    source: "owner-visible-0.2-multiformat-preview-candidate",
    productMode: "0.2-multiformat-preview-candidate",
    productVersion: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_PRODUCT_VERSION,
    status: "launch",
    pathRedacted: true,
    rendererHasFullPath: false,
    visibleIn01: false,
    supportClaim: false,
    saveExportSupported: false,
    packageReadiness: packageReadiness(),
    commands: commandState("launch", replacement),
    canvas: {
      status: "launch",
      playback: playbackState("idle"),
      emptyCopy: "Open or drop a local SVGA, Lottie JSON, or VAP/MP4 candidate."
    },
    rightPanel: {
      facts: [],
      assetInventory: buildMultiFormatAssetInventory({}),
      layers: [],
      assets: [],
      lottieTexts: [],
      vapFusionImages: [],
      vapFusionTexts: [],
      unsupportedFeatures: [],
      issues: []
    },
    ownerRightPanelSnapshotEnvelope,
    replacement
  };
}

function emptyOwnerRightPanelSnapshotEnvelope(
  issues: readonly OwnerVisibleMultiFormatPreviewIssue[] = []
): OwnerRightPanelSnapshotEnvelopeV1 {
  return createOwnerRightPanelSnapshotEnvelope({
    facts: [],
    assets: [],
    lottieTexts: [],
    vapFusionImages: [],
    vapFusionTexts: [],
    issues,
    unsupportedFeatures: []
  });
}

function packageReadiness(): OwnerVisibleMultiFormatPreviewPackageCandidateReadiness {
  return {
    productVersion: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_PRODUCT_VERSION,
    channel: "internal-candidate",
    packagePromotionAllowed: false,
    localStableReplacementAllowed: false,
    supportClaim: false,
    requiredBeforePromotion: ["code_review", "qa_acceptance", "packaging_gate"]
  };
}

function emptyReplacementContext(revision = 0): ReplacementContext {
  return { lottie: {}, vap: {}, active: [], revision };
}

function emptyResetSourceDependencies(): ResetSourceDependencies {
  return { lottieAdjacentResources: [] };
}

function resetSourceDependenciesFromWorkspace(model: HiddenMultiFormatPreviewModel): ResetSourceDependencies {
  if (model.detectedFormat !== "lottie") return emptyResetSourceDependencies();
  const lottieAdjacentResources = uniqueStrings(model.assets
    .filter(({ kind, referencePath }) => kind === "image" && isNonEmptyString(referencePath))
    .map(({ referencePath }) => referencePath as string));
  return { lottieAdjacentResources };
}

function cloneReplacementContext(context: ReplacementContext): ReplacementContext {
  return {
    lottie: { ...context.lottie },
    vap: { ...context.vap },
    active: context.active.map((entry) => ({ ...entry })),
    revision: context.revision
  };
}

function hasActiveReplacement(
  context: ReplacementContext,
  selection: Extract<OwnerVisibleMultiFormatPreviewReplacementSelection, { status: "accepted" }>
): boolean {
  return context.active.some((entry) =>
    entry.format === selection.format
    && entry.kind === selection.kind
    && entry.targetId === selection.runtimeTargetId
  );
}

function replacementContextWithoutTarget(
  context: ReplacementContext,
  selection: Extract<OwnerVisibleMultiFormatPreviewReplacementSelection, { status: "accepted" }>
): ReplacementContext {
  const next = cloneReplacementContext(context);
  next.active = next.active.filter((entry) => !(
    entry.format === selection.format
    && entry.kind === selection.kind
    && entry.targetId === selection.runtimeTargetId
  ));
  if (selection.format === "lottie") delete next.lottie[selection.runtimeTargetId];
  if (selection.format === "vap") delete next.vap[selection.runtimeTargetId];
  next.revision += 1;
  return next;
}

function cloneResetSourceDependencies(dependencies: ResetSourceDependencies): ResetSourceDependencies {
  return {
    lottieAdjacentResources: [...dependencies.lottieAdjacentResources]
  };
}

function upsertReplacementRecord(
  entries: readonly OwnerVisibleMultiFormatPreviewReplacementRecord[],
  next: OwnerVisibleMultiFormatPreviewReplacementRecord
): OwnerVisibleMultiFormatPreviewReplacementRecord[] {
  return [
    ...entries.filter((entry) => !(entry.format === next.format && entry.targetId === next.targetId)),
    next
  ];
}

function replacementValuePreview(kind: "image" | "text", value: string): string {
  if (kind === "image") return value.startsWith("blob:") ? "[local object URL image]" : "[inline image]";
  return value.length > 32 ? `${value.slice(0, 32)}...` : value;
}

function cloneFusionElement(element: VapPreparedFusionElement): VapPreparedFusionElement {
  return {
    ...element,
    zValues: [...element.zValues],
    placementSamples: [...element.placementSamples]
  };
}

function cloneIssue<T extends WorkbenchIssue>(entry: T): T {
  return {
    ...entry,
    details: entry.details ? { ...entry.details } : undefined
  };
}

function diagnosticFromIssue(issue: WorkbenchIssue): { code: string; message: string } {
  return {
    code: issue.code,
    message: issue.message
  };
}

function firstIssueDiagnostic(issues: readonly HiddenMultiFormatPreviewIssue[]): { code: string; message: string } | undefined {
  const issue = issues.find(({ severity }) => severity === "error") ?? issues[0];
  return issue ? diagnosticFromIssue(issue) : undefined;
}

function resetFailureDiagnosticForWorkspace(
  workspaceModel: HiddenMultiFormatPreviewModel,
  format: MotionFormat | undefined
): { code: string; message: string } | undefined {
  if (isAcceptedResetWorkspaceModel(workspaceModel, format)) return undefined;
  return firstIssueDiagnostic(workspaceModel.issues) ?? {
    code: "parse_precondition",
    message: "The original source could not be reopened into a viable reset session."
  };
}

function isAcceptedResetWorkspaceModel(
  workspaceModel: HiddenMultiFormatPreviewModel,
  format: MotionFormat | undefined
): boolean {
  if (["inspectionReady", "ready", "playing", "paused"].includes(workspaceModel.status)) {
    return !workspaceModel.issues.some((entry) => entry.severity === "error" && isFatalResetIssue(entry, format));
  }
  if (workspaceModel.status !== "playbackBlocked" || format !== "vap") return false;
  const errorIssues = workspaceModel.issues.filter(({ severity }) => severity === "error");
  return errorIssues.length > 0 && errorIssues.every(isAllowedVapResetBlockedIssue);
}

function isFatalResetIssue(issue: HiddenMultiFormatPreviewIssue, format: MotionFormat | undefined): boolean {
  if (format === "vap" && isAllowedVapResetBlockedIssue(issue)) return false;
  return ["missing_resource", "parse_precondition", "ambiguous", "playback_failure", "unsupported_feature"].includes(issue.code);
}

function isAllowedVapResetBlockedIssue(issue: HiddenMultiFormatPreviewIssue): boolean {
  const reason = issueReason(issue);
  if (issue.code === "missing_resource" && reason === "fusion_replacement_required") return true;
  if (issue.code === "capability") {
    return [
      "webgl_required",
      "h264_mp4_decode_required",
      "local_object_url_required",
      "blob_media_csp_required",
      "gpu_compositing_required"
    ].includes(reason);
  }
  return false;
}

function issueReason(issue: HiddenMultiFormatPreviewIssue): string {
  const reason = issue.details?.reason;
  return typeof reason === "string" ? reason : "";
}

function issue(
  code: OwnerVisibleMultiFormatPreviewIssueCode,
  message: string,
  severity: WorkbenchIssue["severity"],
  details: Readonly<Record<string, unknown>> = {},
  sensitivePath?: string
): OwnerVisibleMultiFormatPreviewIssue {
  const sensitivePaths = sensitivePath && isPathLike(sensitivePath) ? [sensitivePath] : [];
  return {
    severity,
    code,
    message,
    path: sensitivePaths.length > 0 ? "[local path]" : undefined,
    details: redactLocalPathsInValue(details, sensitivePaths)
  };
}

function playbackState(status: PlaybackState["status"], durationMs?: number): PlaybackState {
  return {
    status,
    currentTimeMs: 0,
    ...(durationMs !== undefined ? { durationMs } : {}),
    loop: false
  };
}

function formatDuration(durationMs: number | undefined): string {
  if (!Number.isFinite(durationMs)) return "unknown";
  return `${Math.round((durationMs ?? 0) / 100) / 10}s`;
}

function isSafeInlineOrBlobImage(value: string): boolean {
  const trimmed = value.trim();
  return /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/iu.test(trimmed)
    || trimmed.startsWith("blob:");
}

function isOpenSource(value: unknown): value is HiddenMultiFormatPreviewOpenSource {
  return value === "fileButton" || value === "dragDrop" || value === "menuOpen" || value === "fileOpenEvent";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function isPathLike(value: string): boolean {
  return /[\\/]/u.test(value) || /^[A-Za-z]:/u.test(value);
}

function safeSourceName(value: string): string {
  const parts = value.trim().split(/[\\/]+/u).filter(Boolean);
  return (parts.at(-1) ?? "")
    .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function cloneModel(model: OwnerVisibleMultiFormatPreviewModel): OwnerVisibleMultiFormatPreviewModel {
  const clone = structuredClone(model) as OwnerVisibleMultiFormatPreviewModel;
  return {
    ...clone,
    rightPanel: safePublicRightPanelFromSnapshot(clone)
  };
}

function safePublicRightPanelFromSnapshot(
  model: OwnerVisibleMultiFormatPreviewModel
): OwnerVisibleMultiFormatPreviewRightPanel {
  let snapshot: {
    facts?: OwnerVisibleMultiFormatPreviewFactRow[];
    assets?: Array<{
      id: string;
      name: string;
      kind: HiddenMultiFormatPreviewAssetRow["kind"] | "unknown";
      dimensions?: string;
      fileSize?: string;
      resolutionStatus?: string;
      replaceable: boolean;
    }>;
    assetInventory?: MultiFormatAssetInventory;
    unsupportedFeatures?: Array<{ feature: string; path: ""; message?: string; pathRedacted: true }>;
    issues?: OwnerVisibleMultiFormatPreviewIssue[];
    imageTargets?: Array<{ imageKey: string; resourceId: string; displayName: string; detail: string }>;
    textTargets?: Array<{ textKey: string; displayName: string; initialText: string }>;
  };
  try {
    snapshot = JSON.parse(model.ownerRightPanelSnapshotEnvelope.snapshotJson);
  } catch {
    snapshot = {};
  }
  const assets = (snapshot.assets ?? []).map((asset) => ({
    id: asset.id,
    name: asset.name,
    kind: asset.kind === "unknown" ? "image" : asset.kind,
    dimensions: asset.dimensions || undefined,
    replaceable: asset.replaceable,
    pathRedacted: true as const,
    resolutionStatus: asset.resolutionStatus === "缺失"
      ? "missing" as const
      : asset.resolutionStatus === "不支持"
        ? "unsupported" as const
        : "not_required" as const
  }));
  return {
    facts: snapshot.facts ?? [],
    assetInventory: snapshot.assetInventory ?? buildMultiFormatAssetInventory({}),
    layers: [],
    assets,
    lottieTexts: (snapshot.textTargets ?? []).map((target) => ({
      id: target.textKey,
      layerId: target.textKey,
      name: target.displayName,
      initialText: target.initialText,
      replaceable: true
    })),
    vapFusionImages: model.detectedFormat === "vap"
      ? (snapshot.imageTargets ?? []).map((target) => ({
          id: target.resourceId,
          resourceId: target.resourceId,
          srcTag: target.displayName,
          runtimeBindingKey: target.resourceId,
          kind: "image" as const,
          replaceable: true,
          replacementProvided: false,
          replacementRequired: false,
          placementCount: 0,
          zValues: [],
          placementSamples: []
        }))
      : [],
    vapFusionTexts: model.detectedFormat === "vap"
      ? (snapshot.textTargets ?? []).map((target) => ({
          id: target.textKey,
          resourceId: target.textKey,
          srcTag: target.displayName,
          runtimeBindingKey: target.textKey,
          kind: "text" as const,
          replaceable: true,
          replacementProvided: false,
          replacementRequired: false,
          placementCount: 0,
          zValues: [],
          placementSamples: []
        }))
      : [],
    unsupportedFeatures: (snapshot.unsupportedFeatures ?? []).map((entry) => ({
      feature: entry.feature,
      path: ""
    })),
    issues: (snapshot.issues ?? []).map((entry) => ({
      code: entry.code as OwnerVisibleMultiFormatPreviewIssueCode,
      severity: entry.severity,
      message: entry.message,
      pathRedacted: true
    }))
  };
}
