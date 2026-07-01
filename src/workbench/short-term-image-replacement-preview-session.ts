import { createHash } from "node:crypto";
import {
  createShortTermOutputSaveState,
  type ShortTermPersistedOutputRecord,
  type ShortTermPersistedOutputSaveStateModel
} from "./short-term-save-state.js";
import {
  runShortTermImageReplacementWorkflow,
  type ShortTermImageReplacementInput,
  type ShortTermImageReplacementSummary,
  type ShortTermImageReplacementWorkflowModel
} from "./short-term-image-replacement-workflow.js";

export const SHORT_TERM_IMAGE_REPLACEMENT_PREVIEW_SESSION_SCHEMA_VERSION = 1 as const;

export type ShortTermImageReplacementPreviewStatus = "ready" | "previewDirty";
export type ShortTermImageReplacementPreviewBytesSource = "source" | "imageReplacementOutput";
export type ShortTermImageReplacementPreviewPlayerAction =
  | "loadSource"
  | "remountPreview"
  | "remountSource"
  | "keepCurrentPreview";

export interface ShortTermImageReplacementPreviewActionModel {
  operationSequence: number;
  type: "loadSource" | "applyReplacement" | "reset";
  status: "accepted" | "rejected";
  message: string;
  diagnostic?: {
    code: string;
    message: string;
  };
}

export interface ShortTermImageReplacementPreviewSessionModel {
  schemaVersion: typeof SHORT_TERM_IMAGE_REPLACEMENT_PREVIEW_SESSION_SCHEMA_VERSION;
  source: "short-term-image-replacement-preview-session";
  prdIds: readonly ["S12", "S14"];
  mode: "preview";
  sourceName: string;
  sourceSha256: string;
  previewSha256: string;
  revision: number;
  operationSequence: number;
  status: ShortTermImageReplacementPreviewStatus;
  dirty: boolean;
  resetEnabled: boolean;
  previewBytesSource: ShortTermImageReplacementPreviewBytesSource;
  playerAction: ShortTermImageReplacementPreviewPlayerAction;
  sourceUnchanged: boolean;
  activeReplacement?: ShortTermImageReplacementSummary;
  saveState: ShortTermPersistedOutputSaveStateModel;
  persistedOutput?: ShortTermPersistedOutputRecord;
  lastAction: ShortTermImageReplacementPreviewActionModel;
}

export interface ShortTermImageReplacementPreviewSessionState {
  sourceBytes: Uint8Array;
  previewBytes: Uint8Array;
  model: ShortTermImageReplacementPreviewSessionModel;
}

export interface CreateShortTermImageReplacementPreviewSessionOptions {
  sourceName?: string;
}

export interface ApplyShortTermImageReplacementPreviewOptions {
  protoPath?: string;
}

export interface ApplyShortTermImageReplacementPreviewResult {
  accepted: boolean;
  session: ShortTermImageReplacementPreviewSessionState;
  workflow: ShortTermImageReplacementWorkflowModel;
}

export function createShortTermImageReplacementPreviewSession(
  sourceBytes: Uint8Array,
  options: CreateShortTermImageReplacementPreviewSessionOptions = {}
): ShortTermImageReplacementPreviewSessionState {
  const stableSourceBytes = new Uint8Array(sourceBytes);
  const sourceName = options.sourceName ?? "untitled.svga";
  const sourceSha256 = sha256(stableSourceBytes);
  return {
    sourceBytes: stableSourceBytes,
    previewBytes: new Uint8Array(stableSourceBytes),
    model: {
      schemaVersion: SHORT_TERM_IMAGE_REPLACEMENT_PREVIEW_SESSION_SCHEMA_VERSION,
      source: "short-term-image-replacement-preview-session",
      prdIds: ["S12", "S14"],
      mode: "preview",
      sourceName,
      sourceSha256,
      previewSha256: sourceSha256,
      revision: 0,
      operationSequence: 0,
      status: "ready",
      dirty: false,
      resetEnabled: false,
      previewBytesSource: "source",
      playerAction: "loadSource",
      sourceUnchanged: true,
      saveState: emptySaveState(true),
      lastAction: {
        operationSequence: 0,
        type: "loadSource",
        status: "accepted",
        message: "源文件已进入预览模式。"
      }
    }
  };
}

export async function applyShortTermImageReplacementPreview(
  session: ShortTermImageReplacementPreviewSessionState,
  replacement: ShortTermImageReplacementInput,
  options: ApplyShortTermImageReplacementPreviewOptions = {}
): Promise<ApplyShortTermImageReplacementPreviewResult> {
  const operationSequence = session.model.operationSequence + 1;
  const sourceBytes = new Uint8Array(session.sourceBytes);
  const workflowResult = await runShortTermImageReplacementWorkflow(sourceBytes, replacement, {
    sourceName: session.model.sourceName,
    protoPath: options.protoPath
  });
  const workflow = workflowResult.model;

  if (!workflowResult.replacedBytes || workflow.status !== "replaced") {
    return {
      accepted: false,
      session: rejectedApplySession(session, workflow, operationSequence),
      workflow
    };
  }

  const previewBytes = new Uint8Array(workflowResult.replacedBytes);
  const sourceUnchanged = sha256(sourceBytes) === session.model.sourceSha256;
  return {
    accepted: true,
    session: {
      sourceBytes,
      previewBytes,
      model: {
        ...session.model,
        previewSha256: sha256(previewBytes),
        revision: session.model.revision + 1,
        operationSequence,
        status: "previewDirty",
        dirty: true,
        resetEnabled: true,
        previewBytesSource: "imageReplacementOutput",
        playerAction: "remountPreview",
        sourceUnchanged,
        activeReplacement: workflow.replacement,
        saveState: workflow.saveState,
        ...(workflow.persistedOutput ? { persistedOutput: workflow.persistedOutput } : {}),
        lastAction: {
          operationSequence,
          type: "applyReplacement",
          status: "accepted",
          message: "替换图片已应用到预览副本，预览需要重新挂载。"
        }
      }
    },
    workflow
  };
}

export function resetShortTermImageReplacementPreview(
  session: ShortTermImageReplacementPreviewSessionState
): ShortTermImageReplacementPreviewSessionState {
  const sourceBytes = new Uint8Array(session.sourceBytes);
  const sourceSha256 = sha256(sourceBytes);
  const operationSequence = session.model.operationSequence + 1;
  const modelWithoutReplacement = { ...session.model };
  delete modelWithoutReplacement.activeReplacement;
  delete modelWithoutReplacement.persistedOutput;

  return {
    sourceBytes,
    previewBytes: new Uint8Array(sourceBytes),
    model: {
      ...modelWithoutReplacement,
      sourceSha256,
      previewSha256: sourceSha256,
      revision: session.model.dirty ? session.model.revision + 1 : session.model.revision,
      operationSequence,
      status: "ready",
      dirty: false,
      resetEnabled: false,
      previewBytesSource: "source",
      playerAction: "remountSource",
      sourceUnchanged: true,
      saveState: emptySaveState(true),
      lastAction: {
        operationSequence,
        type: "reset",
        status: "accepted",
        message: "预览已重置为源文件状态。"
      }
    }
  };
}

function rejectedApplySession(
  session: ShortTermImageReplacementPreviewSessionState,
  workflow: ShortTermImageReplacementWorkflowModel,
  operationSequence: number
): ShortTermImageReplacementPreviewSessionState {
  return {
    sourceBytes: new Uint8Array(session.sourceBytes),
    previewBytes: new Uint8Array(session.previewBytes),
    model: {
      ...session.model,
      operationSequence,
      playerAction: "keepCurrentPreview",
      sourceUnchanged: sha256(session.sourceBytes) === session.model.sourceSha256,
      lastAction: {
        operationSequence,
        type: "applyReplacement",
        status: "rejected",
        message: "替换图片未通过验证，当前预览保持不变。",
        diagnostic: workflow.diagnostic
      }
    }
  };
}

function emptySaveState(sourceUnchanged: boolean): ShortTermPersistedOutputSaveStateModel {
  return createShortTermOutputSaveState("image_replacement_svga", false, sourceUnchanged);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
