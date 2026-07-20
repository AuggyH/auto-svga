import { createHash } from "node:crypto";
import {
  runShortTermRenameWorkflow,
  type ShortTermRenameWorkflowModel,
  type ShortTermRenameWorkflowResult
} from "./short-term-rename-workflow.js";
import {
  createShortTermOutputSaveState,
  type ShortTermPersistedOutputRecord,
  type ShortTermPersistedOutputSaveStateModel
} from "./short-term-save-state.js";
import { shortTermSourceNameFromPathLike } from "./short-term-path-display.js";

export const SHORT_TERM_RENAME_PREVIEW_SESSION_SCHEMA_VERSION = 1 as const;

export type ShortTermRenamePreviewSessionStatus = "renameDirty" | "failed" | "cancelled";

export interface ShortTermRenamePreviewSessionModel {
  schemaVersion: typeof SHORT_TERM_RENAME_PREVIEW_SESSION_SCHEMA_VERSION;
  source: "short-term-rename-preview-session";
  prdIds: readonly ["S11", "S14"];
  mode: "preview";
  status: ShortTermRenamePreviewSessionStatus;
  sourceName: string;
  sourceSha256: string;
  previewSha256: string;
  fromImageKey: string;
  toImageKey: string;
  dirty: boolean;
  playerAction: "remountPreview" | "keepPreview" | "returnToPreview";
  saveState: ShortTermPersistedOutputSaveStateModel;
  persistedOutput?: ShortTermPersistedOutputRecord;
  workflow: ShortTermRenameWorkflowModel;
  message: string;
}

export interface ShortTermRenamePreviewSessionResult {
  sourceBytes: Uint8Array;
  previewBytes: Uint8Array;
  renamedBytes?: Uint8Array;
  model: ShortTermRenamePreviewSessionModel;
  workflow: ShortTermRenameWorkflowResult;
}

export interface StartShortTermRenamePreviewSessionOptions {
  sourceName?: string;
  protoPath?: string;
}

export async function startShortTermRenamePreviewSession(
  sourceBytes: Uint8Array,
  fromImageKey: string,
  toImageKey: string,
  options: StartShortTermRenamePreviewSessionOptions = {}
): Promise<ShortTermRenamePreviewSessionResult> {
  const sourceName = shortTermSourceNameFromPathLike(options.sourceName);
  const stableSourceBytes = new Uint8Array(sourceBytes);
  const sourceSha256 = sha256(stableSourceBytes);
  const workflow = await runShortTermRenameWorkflow(stableSourceBytes, fromImageKey, toImageKey, {
    ...options,
    sourceName
  });
  const workflowModel = workflow.model;
  const renamedBytes = workflow.renamedBytes;
  const renamed = renamedBytes !== undefined && workflowModel.status === "renamed";
  const previewBytes = renamed ? new Uint8Array(renamedBytes) : new Uint8Array(stableSourceBytes);

  return {
    sourceBytes: stableSourceBytes,
    previewBytes,
    ...(renamed ? { renamedBytes: new Uint8Array(renamedBytes) } : {}),
    model: {
      schemaVersion: SHORT_TERM_RENAME_PREVIEW_SESSION_SCHEMA_VERSION,
      source: "short-term-rename-preview-session",
      prdIds: ["S11", "S14"],
      mode: "preview",
      status: renamed ? "renameDirty" : "failed",
      sourceName,
      sourceSha256,
      previewSha256: sha256(previewBytes),
      fromImageKey: workflowModel.fromImageKey,
      toImageKey: workflowModel.toImageKey,
      dirty: renamed,
      playerAction: renamed ? "remountPreview" : "keepPreview",
      saveState: workflowModel.saveState,
      ...(workflowModel.persistedOutput ? { persistedOutput: workflowModel.persistedOutput } : {}),
      workflow: workflowModel,
      message: renamed
        ? "imageKey 已重命名，预览需要重新挂载，保存动作绑定到已验证输出。"
        : "imageKey 重命名失败，当前预览保持不变。"
    },
    workflow
  };
}

export function cancelShortTermRenamePreviewSession(
  session: ShortTermRenamePreviewSessionResult
): ShortTermRenamePreviewSessionResult {
  const sourceBytes = new Uint8Array(session.sourceBytes);
  return {
    sourceBytes,
    previewBytes: new Uint8Array(sourceBytes),
    model: {
      ...session.model,
      status: "cancelled",
      previewSha256: sha256(sourceBytes),
      dirty: false,
      playerAction: "returnToPreview",
      saveState: createShortTermOutputSaveState("renamed_svga", false, true),
      persistedOutput: undefined,
      message: "已取消 imageKey 重命名预览，预览回到源文件状态。"
    },
    workflow: session.workflow
  };
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
