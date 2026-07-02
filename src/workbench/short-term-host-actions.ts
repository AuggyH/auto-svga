import { createHash } from "node:crypto";
import path from "node:path";
import type { ShortTermOpenSource } from "./short-term-app-state.js";
import {
  clearShortTermWorkbenchRecentFiles,
  closeShortTermWorkbenchFile,
  completeShortTermWorkbenchOpen,
  completeShortTermWorkbenchSave,
  createShortTermWorkbenchFacade,
  createShortTermWorkbenchSavePlan,
  failShortTermWorkbenchOpen,
  failShortTermWorkbenchSave,
  markShortTermWorkbenchRecentFileMissing,
  openShortTermWorkbenchRecentFile,
  applyShortTermWorkbenchTextPreview,
  cancelShortTermWorkbenchTransientWorkflow,
  createShortTermWorkbenchTextPreview,
  recoverShortTermWorkbenchPlayback,
  reportShortTermWorkbenchPlaybackFailure,
  resetShortTermWorkbenchImageReplacementPreview,
  resetShortTermWorkbenchTextPreview,
  runShortTermWorkbenchImageReplacementPreview,
  runShortTermWorkbenchOptimizationCompare,
  runShortTermWorkbenchRenamePreview,
  startShortTermWorkbenchOpen,
  type CreateShortTermWorkbenchFacadeOptions,
  type ShortTermWorkbenchFacadeState
} from "./short-term-workbench-facade.js";
import type { ShortTermRecentOpenSource } from "./short-term-recent-files.js";
import type { ShortTermProductInspectionModel } from "./short-term-product-model.js";
import type { ShortTermSaveCommand } from "./short-term-save-state.js";
import type { ShortTermSaveExecutionPlan } from "./short-term-save-execution.js";
import type {
  ShortTermRuntimeTextElement,
  ShortTermRuntimeTextReplacement
} from "./short-term-text-preview-session.js";
import {
  evaluateShortTermHostLifecycleRequest,
  hasShortTermUnsavedHostOutput
} from "./short-term-host-lifecycle.js";
import {
  canonicalShortTermHostMenuCommandId,
  classifyShortTermHostMenuCommand,
  isShortTermNativeDelegatedMenuCommand,
  shortTermRecentFileIdFromMenuCommandId,
  type ShortTermHostMenuCommandRoute
} from "./short-term-host-menu-routing.js";
import {
  shortTermPrdIdsForHostAction,
  shortTermPrdIdsForMenuDispatch,
  type ShortTermPrdId
} from "./short-term-prd-trace.js";
import {
  redactShortTermLocalPathsFromError,
  redactShortTermLocalPathsInValue
} from "./short-term-local-path-redaction.js";
import { shortTermDisplayNameFromPathLike } from "./short-term-path-display.js";

export const SHORT_TERM_HOST_ACTION_SCHEMA_VERSION = 1 as const;
export {
  classifyShortTermHostMenuCommand,
  type ShortTermHostMenuCommandRoute
};

export type ShortTermHostActionKind =
  | "openLocalFile"
  | "openRecentFile"
  | "clearRecentFiles"
  | "closeFile"
  | "runOptimization"
  | "renameImageKey"
  | "replaceImage"
  | "resetImageReplacement"
  | "cancelTransientWorkflow"
  | "prepareTextPreview"
  | "applyTextPreview"
  | "resetTextPreview"
  | "reportPlaybackFailure"
  | "recoverPlayback"
  | "save"
  | "menuDispatch";

export type ShortTermHostActionStatus = "completed" | "blocked" | "failed" | "delegated";
export type ShortTermHostActionPrdId = ShortTermPrdId;

export interface ShortTermHostActionState {
  facade: ShortTermWorkbenchFacadeState;
  currentLocalPath?: string;
  activeOutputBytes?: Uint8Array;
  lastAction?: ShortTermHostActionResult;
}

export interface ShortTermHostActionResult {
  schemaVersion: typeof SHORT_TERM_HOST_ACTION_SCHEMA_VERSION;
  source: "short-term-host-action";
  prdIds: readonly ShortTermHostActionPrdId[];
  action: ShortTermHostActionKind;
  status: ShortTermHostActionStatus;
  message: string;
  commandId?: string;
  targetDisplayName?: string;
  outputSha256?: string;
  pathRedacted: true;
  diagnostic?: {
    code: string;
    message: string;
  };
}

type ShortTermHostActionResultOptions =
  Partial<Omit<ShortTermHostActionResult, "schemaVersion" | "source" | "action" | "status" | "message" | "pathRedacted">>;

export interface ShortTermHostReadResult {
  bytes: Uint8Array;
  displayName?: string;
}

export interface ShortTermHostInspectionInput {
  bytes: Uint8Array;
  displayName: string;
  localPath?: string;
}

export interface ShortTermHostEnvironment {
  readLocalFile(localPath: string): Promise<ShortTermHostReadResult>;
  inspectSvga(input: ShortTermHostInspectionInput): Promise<ShortTermProductInspectionModel>;
  writeLocalFile(localPath: string, bytes: Uint8Array): Promise<void>;
  readSavedFile(localPath: string): Promise<Uint8Array>;
  fileExists?(localPath: string): Promise<boolean>;
}

export interface ShortTermHostOpenLocalFileInput {
  requestId: string;
  source: Extract<ShortTermOpenSource, "fileButton" | "dragDrop" | "menuOpen">;
  localPath: string;
  displayName?: string;
  discardUnsavedChanges?: boolean;
}

export interface ShortTermHostOpenRecentFileInput {
  requestId: string;
  recentFileId: string;
  source: ShortTermRecentOpenSource;
  discardUnsavedChanges?: boolean;
}

export interface ShortTermHostSaveInput {
  command: ShortTermSaveCommand;
  targetPath?: string;
}

export interface ShortTermHostCloseInput {
  discardUnsavedChanges?: boolean;
}

export interface ShortTermHostDirtyOperationInput {
  discardUnsavedChanges?: boolean;
}

export interface ShortTermHostPlaybackFailureInput {
  message: string;
}

const SAFE_RESULT_COMMAND_ID_PATTERN = /^[A-Za-z][A-Za-z0-9]*(?::[A-Za-z0-9._-]+)?$/u;

export interface ShortTermHostPrepareTextPreviewInput {
  textElements: readonly ShortTermRuntimeTextElement[];
}

export interface ShortTermHostApplyTextPreviewInput {
  replacement: ShortTermRuntimeTextReplacement;
}

export type ShortTermHostMenuActionInput =
  | ({ commandId: "openSvga" } & Omit<ShortTermHostOpenLocalFileInput, "source"> & { source?: ShortTermHostOpenLocalFileInput["source"] })
  | ({ commandId: "openRecent" } & Omit<ShortTermHostOpenRecentFileInput, "source"> & { source?: ShortTermRecentOpenSource })
  | { commandId: "clearRecent" }
  | ({ commandId: "closeFile" } & ShortTermHostCloseInput)
  | ({ commandId: "quit" } & ShortTermHostDirtyOperationInput)
  | ({ commandId: "save" | "saveAs" } & Omit<ShortTermHostSaveInput, "command">)
  | ({ commandId: "runOptimization" } & ShortTermHostDirtyOperationInput)
  | ({ commandId: "renameImageKey"; fromImageKey: string; toImageKey: string } & ShortTermHostDirtyOperationInput)
  | ({ commandId: "replaceImage"; imageKey: string; pngBytes: Uint8Array } & ShortTermHostDirtyOperationInput)
  | { commandId: "resetImageReplacement" }
  | { commandId: "resetTextPreview" }
  | { commandId: "cancelTransientWorkflow" }
  | ({ commandId: string } & Record<string, unknown>);

export function createShortTermHostActionState(
  options: CreateShortTermWorkbenchFacadeOptions = {}
): ShortTermHostActionState {
  return {
    facade: createShortTermWorkbenchFacade(options)
  };
}

export async function openShortTermHostLocalFile(
  state: ShortTermHostActionState,
  host: ShortTermHostEnvironment,
  input: ShortTermHostOpenLocalFileInput
): Promise<ShortTermHostActionState> {
  const openInput: Record<string, unknown> = isRecord(input) ? input : {};
  const requestId = openInput.requestId;
  const source = openInput.source;
  const localPath = openInput.localPath;
  if (
    !isNonEmptyString(requestId)
      || !isOpenLocalSource(source)
      || !isNonEmptyString(localPath)
  ) {
    return invalidOpenInput(state, "openLocalFile", "openSvga");
  }

  const normalizedInput: ShortTermHostOpenLocalFileInput = {
    requestId,
    source,
    localPath,
    ...(isNonEmptyString(openInput.displayName) ? { displayName: openInput.displayName } : {}),
    ...(openInput.discardUnsavedChanges === true ? { discardUnsavedChanges: true } : {})
  };

  if (hasShortTermUnsavedHostOutput(state) && normalizedInput.discardUnsavedChanges !== true) {
    return blockUnsavedOpen(state, "openLocalFile", "openSvga");
  }

  const loadingFacade = startShortTermWorkbenchOpen(state.facade, {
    requestId: normalizedInput.requestId,
    source: normalizedInput.source,
    localPath: normalizedInput.localPath,
    displayName: normalizedInput.displayName
  });
  return completeHostOpen(
    { ...state, facade: loadingFacade, activeOutputBytes: undefined },
    host,
    {
      action: "openLocalFile",
      requestId: normalizedInput.requestId,
      source: normalizedInput.source,
      localPath: normalizedInput.localPath,
      displayName: normalizedInput.displayName
    }
  );
}

export async function openShortTermHostRecentFile(
  state: ShortTermHostActionState,
  host: ShortTermHostEnvironment,
  input: ShortTermHostOpenRecentFileInput
): Promise<ShortTermHostActionState> {
  const openInput: Record<string, unknown> = isRecord(input) ? input : {};
  const requestId = openInput.requestId;
  const recentFileId = openInput.recentFileId;
  const source = openInput.source;
  if (
    !isNonEmptyString(requestId)
      || !isNonEmptyString(recentFileId)
      || !isRecentOpenSource(source)
  ) {
    return invalidOpenInput(state, "openRecentFile", "openRecent");
  }

  const normalizedInput: ShortTermHostOpenRecentFileInput = {
    requestId,
    recentFileId,
    source,
    ...(openInput.discardUnsavedChanges === true ? { discardUnsavedChanges: true } : {})
  };

  if (hasShortTermUnsavedHostOutput(state) && normalizedInput.discardUnsavedChanges !== true) {
    return blockUnsavedOpen(state, "openRecentFile", "openRecent");
  }

  const opened = openShortTermWorkbenchRecentFile(
    state.facade,
    normalizedInput.recentFileId,
    normalizedInput.source,
    normalizedInput.requestId
  );
  if (opened.resolution.status === "missing") {
    return withLastAction({
      ...state,
      facade: opened.state,
      activeOutputBytes: undefined,
      currentLocalPath: undefined
    }, result("openRecentFile", "failed", opened.resolution.message, {
      diagnostic: {
        code: "recent_file_missing",
        message: opened.resolution.message
      }
    }));
  }

  const { request } = opened.resolution;
  if (host.fileExists) {
    try {
      if (!(await host.fileExists(request.localPath))) {
        return recentFileUnavailable(state, opened.state, request.recentFileId, {
          code: "recent_file_missing",
          message: "Host reported that the recent file path is unavailable."
        });
      }
    } catch (error) {
      return recentFileUnavailable(state, opened.state, request.recentFileId, {
        code: "recent_file_availability_check_failed",
        message: errorMessage(error, "Host could not verify recent file availability.", [request.localPath])
      });
    }
  }

  return completeHostOpen(
    { ...state, facade: opened.state, activeOutputBytes: undefined },
    host,
    {
      action: "openRecentFile",
      requestId: request.requestId,
      source: request.source,
      localPath: request.localPath,
      displayName: request.displayName,
      recentFileId: request.recentFileId
    }
  );
}

function recentFileUnavailable(
  state: ShortTermHostActionState,
  openedState: ShortTermHostActionState["facade"],
  recentFileId: string,
  diagnostic: NonNullable<ShortTermHostActionResult["diagnostic"]>
): ShortTermHostActionState {
  return withLastAction({
    ...state,
    facade: markShortTermWorkbenchRecentFileMissing(openedState, recentFileId),
    activeOutputBytes: undefined,
    currentLocalPath: undefined
  }, result("openRecentFile", "failed", "最近文件已不存在或当前无法访问。", {
    diagnostic
  }));
}

export function clearShortTermHostRecentFiles(
  state: ShortTermHostActionState
): ShortTermHostActionState {
  return withLastAction({
    ...state,
    facade: clearShortTermWorkbenchRecentFiles(state.facade)
  }, result("clearRecentFiles", "completed", "最近记录已清除，源文件不会被删除。"));
}

export function closeShortTermHostFile(
  state: ShortTermHostActionState,
  input: ShortTermHostCloseInput = {}
): ShortTermHostActionState {
  if (hasShortTermUnsavedHostOutput(state) && !isDiscardConfirmed(input)) {
    return withLastAction(state, result("closeFile", "blocked", "当前文件有未保存输出，关闭前需要确认丢弃。", {
      commandId: "closeFile",
      diagnostic: {
        code: "close_requires_discard_confirmation",
        message: "Close file is blocked until the caller confirms discarding unsaved output."
      }
    }));
  }

  return withLastAction({
    ...state,
    facade: closeShortTermWorkbenchFile(state.facade),
    currentLocalPath: undefined,
    activeOutputBytes: undefined
  }, result("closeFile", "completed", "当前文件已关闭，最近记录保留。", {
    commandId: "closeFile"
  }));
}

export async function runShortTermHostOptimization(
  state: ShortTermHostActionState,
  input: ShortTermHostDirtyOperationInput = {}
): Promise<ShortTermHostActionState> {
  const unopened = requireOpenedFileForOutputAction(state, "runOptimization");
  if (unopened) return unopened;

  if (hasShortTermUnsavedHostOutput(state) && !isDiscardConfirmed(input)) {
    return blockUnsavedOperation(state, "runOptimization", "runOptimization");
  }

  const operation = await runShortTermWorkbenchOptimizationCompare(state.facade);
  return withLastAction({
    ...state,
    facade: operation.state,
    activeOutputBytes: operation.session.optimizedBytes
      ? new Uint8Array(operation.session.optimizedBytes)
      : undefined
  }, result("runOptimization", operation.session.optimizedBytes ? "completed" : "blocked", operation.session.model.message, {
    outputSha256: operation.session.optimizedBytes ? sha256(operation.session.optimizedBytes) : undefined
  }));
}

export async function runShortTermHostImageKeyRename(
  state: ShortTermHostActionState,
  fromImageKey: string,
  toImageKey: string,
  input: ShortTermHostDirtyOperationInput = {}
): Promise<ShortTermHostActionState> {
  const unopened = requireOpenedFileForOutputAction(state, "renameImageKey");
  if (unopened) return unopened;

  if (!isNonEmptyString(fromImageKey) || !isNonEmptyString(toImageKey)) {
    return invalidOutputInput(state, "renameImageKey", "renameImageKey");
  }

  if (hasShortTermUnsavedHostOutput(state) && !isDiscardConfirmed(input)) {
    return blockUnsavedOperation(state, "renameImageKey", "renameImageKey");
  }

  const operation = await runShortTermWorkbenchRenamePreview(state.facade, fromImageKey.trim(), toImageKey.trim());
  return withLastAction({
    ...state,
    facade: operation.state,
    activeOutputBytes: operation.session.renamedBytes
      ? new Uint8Array(operation.session.renamedBytes)
      : undefined
  }, result("renameImageKey", operation.session.renamedBytes ? "completed" : "blocked", operation.session.model.message, {
    outputSha256: operation.session.renamedBytes ? sha256(operation.session.renamedBytes) : undefined
  }));
}

export async function runShortTermHostImageReplacement(
  state: ShortTermHostActionState,
  imageKey: string,
  pngBytes: Uint8Array,
  input: ShortTermHostDirtyOperationInput = {}
): Promise<ShortTermHostActionState> {
  const unopened = requireOpenedFileForOutputAction(state, "replaceImage");
  if (unopened) return unopened;

  if (!isNonEmptyString(imageKey) || !isUint8Array(pngBytes)) {
    return invalidOutputInput(state, "replaceImage", "replaceImage");
  }

  if (
    hasShortTermUnsavedHostOutput(state)
      && state.facade.model.activeOutput?.outputKind !== "image_replacement_svga"
      && !isDiscardConfirmed(input)
  ) {
    return blockUnsavedOperation(state, "replaceImage", "replaceImage");
  }

  const operation = await runShortTermWorkbenchImageReplacementPreview(state.facade, imageKey.trim(), pngBytes);
  const outputBytes = operation.state.model.activeOutput ? operation.session.previewBytes : undefined;
  return withLastAction({
    ...state,
    facade: operation.state,
    activeOutputBytes: outputBytes ? new Uint8Array(outputBytes) : undefined
  }, result("replaceImage", outputBytes ? "completed" : "blocked", operation.session.model.lastAction.message, {
    outputSha256: outputBytes ? sha256(outputBytes) : undefined
  }));
}

export function resetShortTermHostImageReplacement(
  state: ShortTermHostActionState
): ShortTermHostActionState {
  const blocked = requireOpenedFileForPreviewAction(state, "resetImageReplacement");
  if (blocked) return blocked;

  const activeOutputKind = state.facade.model.activeOutput?.outputKind;
  if (hasShortTermUnsavedHostOutput(state) && activeOutputKind !== "image_replacement_svga") {
    return withLastAction(state, result("resetImageReplacement", "blocked", "当前文件有其他未保存输出，重置图片替换前需要先保存或确认丢弃。", {
      diagnostic: {
        code: "operation_requires_discard_confirmation",
        message: "Image replacement reset would clear active output and is blocked while another output kind is dirty."
      }
    }));
  }

  if (state.facade.imageReplacementSession?.model.resetEnabled !== true && activeOutputKind !== "image_replacement_svga") {
    return withLastAction(state, result("resetImageReplacement", "blocked", "当前没有需要重置的图片替换预览。", {
      diagnostic: {
        code: "image_replacement_reset_not_needed",
        message: "Image replacement reset is only enabled after an image replacement preview is applied."
      }
    }));
  }

  const facade = resetShortTermWorkbenchImageReplacementPreview(state.facade);
  return withLastAction({
    ...state,
    facade,
    activeOutputBytes: undefined
  }, result("resetImageReplacement", "completed", facade.model.activeWorkflow.message));
}

export function cancelShortTermHostTransientWorkflow(
  state: ShortTermHostActionState
): ShortTermHostActionState {
  if (!state.facade.model.appState.currentFile || !state.facade.sourceBytes) {
    return withLastAction(state, result("cancelTransientWorkflow", "blocked", "当前没有打开的 SVGA 可取消临时操作。", {
      diagnostic: {
        code: "cancel_transient_requires_open_file",
        message: "Transient workflow cancellation requires opened source bytes."
      }
    }));
  }

  const workflowKind = state.facade.model.activeWorkflow.kind;
  if (
    (workflowKind !== "optimizationCompare" && workflowKind !== "renamePreview")
      || !state.facade.model.activeOutput
  ) {
    return withLastAction(state, result("cancelTransientWorkflow", "blocked", "当前没有可取消的临时操作。", {
      diagnostic: {
        code: "transient_workflow_cancel_not_needed",
        message: "Only active optimization comparison and rename preview outputs are cancellable in the short-term host action boundary."
      }
    }));
  }

  const facade = cancelShortTermWorkbenchTransientWorkflow(state.facade);
  return withLastAction({
    ...state,
    facade,
    activeOutputBytes: undefined
  }, result("cancelTransientWorkflow", "completed", facade.model.activeWorkflow.message));
}

export async function saveShortTermHostOutput(
  state: ShortTermHostActionState,
  host: ShortTermHostEnvironment,
  input: ShortTermHostSaveInput
): Promise<ShortTermHostActionState> {
  const saveInput: Record<string, unknown> = isRecord(input) ? input : {};
  if (!isShortTermSaveCommand(saveInput.command)) {
    return invalidSaveInput(state);
  }
  if (saveInput.targetPath !== undefined && !isNonEmptyString(saveInput.targetPath)) {
    return invalidSaveInput(state, saveInput.command);
  }

  const command = saveInput.command;
  const explicitTargetPath = isNonEmptyString(saveInput.targetPath) ? saveInput.targetPath : undefined;
  const targetPath = explicitTargetPath ?? (command === "overwrite" ? state.currentLocalPath : undefined);
  if (!targetPath) {
    return withLastAction(state, result("save", "blocked", "保存目标不可用。", {
      commandId: command === "overwrite" ? "save" : "saveAs",
      diagnostic: {
        code: "save_target_missing",
        message: "Save As requires a target path and overwrite requires the current local path."
      }
    }));
  }
  if (command === "saveAs" && state.currentLocalPath && sameResolvedPath(targetPath, state.currentLocalPath)) {
    return withLastAction(state, result("save", "blocked", "另存为目标必须不同于当前源文件；如需覆盖请使用覆盖保存。", {
      commandId: "saveAs",
      targetDisplayName: shortTermDisplayNameFromPathLike(targetPath),
      diagnostic: {
        code: "save_as_target_matches_source",
        message: "Save As target must be different from the current source path."
      }
    }));
  }
  if (!state.activeOutputBytes) {
    return withLastAction(state, result("save", "blocked", "没有已验证的可保存输出。", {
      targetDisplayName: shortTermDisplayNameFromPathLike(targetPath),
      diagnostic: {
        code: "active_output_bytes_missing",
        message: "Host action state does not contain validated output bytes."
      }
    }));
  }

  const plan = createShortTermWorkbenchSavePlan(state.facade, command, { targetPath });
  if (!plan || plan.status !== "readyToWrite") {
    return withLastAction(state, result("save", "blocked", plan?.message ?? "没有已验证的可保存输出。", {
      targetDisplayName: shortTermDisplayNameFromPathLike(targetPath),
      diagnostic: plan?.diagnostic ?? {
        code: "save_plan_unavailable",
        message: "The facade did not expose a ready save plan."
      }
    }));
  }

  const outputBytes = new Uint8Array(state.activeOutputBytes);
  try {
    await host.writeLocalFile(targetPath, outputBytes);
    const savedBytes = await host.readSavedFile(targetPath);
    const completed = completeShortTermWorkbenchSave(state.facade, plan, savedBytes);
    return withLastAction({
      ...state,
      facade: completed.state,
      activeOutputBytes: completed.result.status === "saveComplete" ? undefined : outputBytes,
      currentLocalPath: command === "saveAs" && completed.result.status === "saveComplete"
        ? targetPath
        : state.currentLocalPath
    }, saveResult(completed.result.status === "saveComplete" ? "completed" : "failed", completed.result.message, plan, {
      outputSha256: completed.result.savedSha256
    }));
  } catch (error) {
    const failed = failShortTermWorkbenchSave(
      state.facade,
      plan,
      new Error(errorMessage(error, "保存失败。", [targetPath]))
    );
    return withLastAction({
      ...state,
      facade: failed.state,
      activeOutputBytes: outputBytes
    }, saveResult("failed", failed.result.message, plan, {
      diagnostic: failed.result.diagnostic
    }));
  }
}

export function reportShortTermHostPlaybackFailure(
  state: ShortTermHostActionState,
  input: ShortTermHostPlaybackFailureInput
): ShortTermHostActionState {
  if (!state.facade.model.appState.currentFile) {
    return withLastAction(state, result("reportPlaybackFailure", "blocked", "当前没有打开的 SVGA 可报告播放异常。", {
      diagnostic: {
        code: "playback_failure_requires_open_file",
        message: "Playback failure reporting requires an opened SVGA file."
      }
    }));
  }

  const playbackMessage = isRecord(input) ? input.message : undefined;
  if (typeof playbackMessage !== "string") {
    return withLastAction(state, result("reportPlaybackFailure", "blocked", "播放异常上报请求不可用。", {
      diagnostic: {
        code: "playback_failure_input_invalid",
        message: "Playback failure reporting requires a string message."
      }
    }));
  }

  const rawMessage = playbackMessage.trim();
  const message = rawMessage
    ? redactShortTermLocalPathsFromError(rawMessage, "播放器未正常完成播放。", [
      ...(state.currentLocalPath ? [state.currentLocalPath] : [])
    ])
    : "播放器未正常完成播放。";
  return withLastAction({
    ...state,
    facade: reportShortTermWorkbenchPlaybackFailure(state.facade, message)
  }, result("reportPlaybackFailure", "completed", message));
}

export function recoverShortTermHostPlayback(
  state: ShortTermHostActionState
): ShortTermHostActionState {
  if (state.facade.model.appState.state !== "playbackAbnormal") {
    return withLastAction(state, result("recoverPlayback", "blocked", "当前没有播放异常需要恢复。", {
      diagnostic: {
        code: "playback_recovery_not_needed",
        message: "Playback recovery is only meaningful while the short-term app state is playbackAbnormal."
      }
    }));
  }

  return withLastAction({
    ...state,
    facade: recoverShortTermWorkbenchPlayback(state.facade)
  }, result("recoverPlayback", "completed", "播放异常状态已恢复，预览可重新播放。"));
}

export function prepareShortTermHostTextPreview(
  state: ShortTermHostActionState,
  input: ShortTermHostPrepareTextPreviewInput
): ShortTermHostActionState {
  const blocked = requireOpenedFileForPreviewAction(state, "prepareTextPreview");
  if (blocked) return blocked;
  if (!isRuntimeTextElementArray(isRecord(input) ? input.textElements : undefined)) {
    return invalidTextPreviewInput(state, "prepareTextPreview");
  }

  const facade = createShortTermWorkbenchTextPreview(state.facade, input.textElements);
  return withLastAction({
    ...state,
    facade
  }, result("prepareTextPreview", "completed", facade.model.activeWorkflow.message));
}

export function applyShortTermHostTextPreview(
  state: ShortTermHostActionState,
  input: ShortTermHostApplyTextPreviewInput
): ShortTermHostActionState {
  const blocked = requireOpenedFileForPreviewAction(state, "applyTextPreview");
  if (blocked) return blocked;
  if (!isRuntimeTextReplacement(isRecord(input) ? input.replacement : undefined)) {
    return invalidTextPreviewInput(state, "applyTextPreview");
  }

  const facade = applyShortTermWorkbenchTextPreview(state.facade, input.replacement);
  const status = facade.textPreviewSession?.model.status === "failed" ? "failed" : "completed";
  return withLastAction({
    ...state,
    facade
  }, result("applyTextPreview", status, facade.model.activeWorkflow.message, {
    diagnostic: facade.textPreviewSession?.model.diagnostic
  }));
}

export function resetShortTermHostTextPreview(
  state: ShortTermHostActionState
): ShortTermHostActionState {
  const blocked = requireOpenedFileForPreviewAction(state, "resetTextPreview");
  if (blocked) return blocked;

  if (!state.facade.textPreviewSession?.model.activeReplacement) {
    return withLastAction(state, result("resetTextPreview", "blocked", "当前没有需要重置的文本预览。", {
      diagnostic: {
        code: "text_preview_reset_not_needed",
        message: "Text preview reset is only enabled after a runtime text replacement is applied."
      }
    }));
  }

  const facade = resetShortTermWorkbenchTextPreview(state.facade);
  return withLastAction({
    ...state,
    facade
  }, result("resetTextPreview", "completed", facade.model.activeWorkflow.message));
}

export async function dispatchShortTermHostMenuAction(
  state: ShortTermHostActionState,
  host: ShortTermHostEnvironment,
  input: ShortTermHostMenuActionInput
): Promise<ShortTermHostActionState> {
  const menuInput: Record<string, unknown> = isRecord(input) ? input : {};
  const rawCommandId = menuInput.commandId;
  if (!isNonEmptyString(rawCommandId)) {
    return withLastAction(state, result("menuDispatch", "blocked", "菜单命令不可用。", {
      commandId: "unsupported",
      prdIds: [],
      diagnostic: {
        code: "menu_command_id_invalid",
        message: "Menu command id is missing or invalid."
      }
    }));
  }

  const commandId = rawCommandId.trim();
  const canonicalCommandId = canonicalShortTermHostMenuCommandId(commandId);
  const resultCommandId = safeResultCommandId(commandId);
  const route = classifyShortTermHostMenuCommand(commandId);
  if (!isCommandEnabled(state, commandId)) {
    const command = state.facade.model.appState.commands.find((item) => item.id === canonicalCommandId);
    return withLastAction(state, result("menuDispatch", "blocked", command?.reason ?? "当前菜单命令不可用。", {
      commandId: resultCommandId,
      prdIds: shortTermPrdIdsForMenuDispatch(canonicalCommandId),
      diagnostic: {
        code: "menu_command_disabled",
        message: `Menu command "${resultCommandId}" is disabled or unsupported.`
      }
    }));
  }

  if (route === "native") {
    if (commandId === "quit") {
      const lifecycleInput = menuInput as ShortTermHostDirtyOperationInput;
      return guardedNativeLifecycleMenuCommand(state, commandId, lifecycleInput.discardUnsavedChanges);
    }
    return delegatedMenuCommand(state, commandId, "native", "该菜单命令由 macOS 原生命令处理。");
  }
  if (route === "renderer") {
    return delegatedMenuCommand(state, commandId, "renderer", "该菜单命令由预览界面运行时处理。");
  }

  switch (canonicalCommandId) {
    case "openSvga": {
      const openInput = menuInput;
      if (!isNonEmptyString(openInput.requestId) || !isNonEmptyString(openInput.localPath)) {
        return missingContextForMenuCommand(
          state,
          commandId,
          "需要先通过 macOS 打开面板选择有效 SVGA。",
          "openSvga requires requestId and localPath from the native open panel."
        );
      }
      return openShortTermHostLocalFile(state, host, {
        requestId: openInput.requestId,
        source: isOpenLocalSource(openInput.source) ? openInput.source : "menuOpen",
        localPath: openInput.localPath,
        ...(isNonEmptyString(openInput.displayName) ? { displayName: openInput.displayName } : {}),
        ...(openInput.discardUnsavedChanges === true ? { discardUnsavedChanges: true } : {})
      });
    }
    case "openRecent": {
      const recentInput = menuInput;
      const recentFileId = (
        isNonEmptyString(recentInput.recentFileId)
          ? recentInput.recentFileId
          : shortTermRecentFileIdFromMenuCommandId(commandId)
      );
      if (!recentFileId) {
        return withLastAction(state, result("openRecentFile", "blocked", "最近文件记录不可用。", {
          commandId: resultCommandId,
          diagnostic: {
            code: "recent_file_id_missing",
            message: `Menu command "${resultCommandId}" did not include a recent file id.`
          }
        }));
      }
      return openShortTermHostRecentFile(state, host, {
        requestId: isNonEmptyString(recentInput.requestId) ? recentInput.requestId : `recent-menu-${recentFileId}`,
        recentFileId,
        source: isRecentOpenSource(recentInput.source) ? recentInput.source : "recentMenu",
        ...(recentInput.discardUnsavedChanges === true ? { discardUnsavedChanges: true } : {})
      });
    }
    case "clearRecent":
      return clearShortTermHostRecentFiles(state);
    case "closeFile": {
      const closeInput = menuInput as ShortTermHostCloseInput;
      return closeShortTermHostFile(state, closeInput);
    }
    case "save": {
      const saveInput = menuInput as { targetPath?: unknown };
      return saveShortTermHostOutput(state, host, {
        command: "overwrite",
        ...(isNonEmptyString(saveInput.targetPath) ? { targetPath: saveInput.targetPath } : {})
      });
    }
    case "saveAs": {
      const saveInput = menuInput as { targetPath?: unknown };
      return saveShortTermHostOutput(state, host, {
        command: "saveAs",
        ...(isNonEmptyString(saveInput.targetPath) ? { targetPath: saveInput.targetPath } : {})
      });
    }
    case "runOptimization": {
      const operationInput = menuInput as ShortTermHostDirtyOperationInput;
      return runShortTermHostOptimization(state, operationInput);
    }
    case "renameImageKey": {
      const renameInput = menuInput as Partial<{ fromImageKey: unknown; toImageKey: unknown } & ShortTermHostDirtyOperationInput>;
      if (!isNonEmptyString(renameInput.fromImageKey) || !isNonEmptyString(renameInput.toImageKey)) {
        return missingContextForMenuCommand(
          state,
          commandId,
          "需要先选择图片资源并输入新的 imageKey。",
          "renameImageKey requires fromImageKey and toImageKey from the renderer context."
        );
      }
      return runShortTermHostImageKeyRename(state, renameInput.fromImageKey, renameInput.toImageKey, {
        discardUnsavedChanges: renameInput.discardUnsavedChanges
      });
    }
    case "replaceImage": {
      const replacementInput = menuInput as Partial<{ imageKey: unknown; pngBytes: unknown } & ShortTermHostDirtyOperationInput>;
      if (!isNonEmptyString(replacementInput.imageKey) || !isUint8Array(replacementInput.pngBytes)) {
        return missingContextForMenuCommand(
          state,
          commandId,
          "需要先选择图片资源并提供替换 PNG。",
          "replaceImage requires imageKey and PNG bytes from the renderer context."
        );
      }
      return runShortTermHostImageReplacement(state, replacementInput.imageKey, replacementInput.pngBytes, {
        discardUnsavedChanges: replacementInput.discardUnsavedChanges
      });
    }
    case "resetImageReplacement":
      return resetShortTermHostImageReplacement(state);
    case "resetTextPreview":
      return resetShortTermHostTextPreview(state);
    case "cancelTransientWorkflow":
      return cancelShortTermHostTransientWorkflow(state);
    default:
      return withLastAction(state, result("menuDispatch", "blocked", "当前菜单命令尚未接入主程动作。", {
        commandId: resultCommandId,
        prdIds: shortTermPrdIdsForMenuDispatch(canonicalCommandId),
        diagnostic: {
          code: "menu_command_not_routed",
          message: `Menu command "${resultCommandId}" has no host action route.`
        }
      }));
  }
}

function requireOpenedFileForPreviewAction(
  state: ShortTermHostActionState,
  action: Extract<ShortTermHostActionKind, "resetImageReplacement" | "prepareTextPreview" | "applyTextPreview" | "resetTextPreview">
): ShortTermHostActionState | undefined {
  if (state.facade.model.appState.currentFile && state.facade.sourceBytes) return undefined;
  return withLastAction(state, result(action, "blocked", "当前没有打开的 SVGA 可执行预览操作。", {
    diagnostic: {
      code: "preview_action_requires_open_file",
      message: "Preview actions require opened source bytes."
    }
  }));
}

function requireOpenedFileForOutputAction(
  state: ShortTermHostActionState,
  action: Extract<ShortTermHostActionKind, "runOptimization" | "renameImageKey" | "replaceImage">
): ShortTermHostActionState | undefined {
  if (state.facade.model.appState.currentFile && state.facade.sourceBytes) return undefined;
  return withLastAction(state, result(action, "blocked", "当前没有打开的 SVGA 可执行该操作。", {
    diagnostic: {
      code: "operation_requires_open_file",
      message: "Output-producing operations require opened source bytes."
    }
  }));
}

function guardedNativeLifecycleMenuCommand(
  state: ShortTermHostActionState,
  commandId: string,
  discardUnsavedChanges: boolean | undefined
): ShortTermHostActionState {
  const lifecycle = evaluateShortTermHostLifecycleRequest(state, {
    request: "appQuit",
    discardUnsavedChanges
  });
  if (!lifecycle.canProceed) {
    return withLastAction(state, result("menuDispatch", "blocked", lifecycle.message, {
      commandId: safeResultCommandId(commandId),
      prdIds: shortTermPrdIdsForMenuDispatch(commandId),
      outputSha256: lifecycle.activeOutputSha256,
      diagnostic: lifecycle.diagnostic
    }));
  }

  return withLastAction(state, result("menuDispatch", "delegated", lifecycle.message, {
    commandId: safeResultCommandId(commandId),
    prdIds: shortTermPrdIdsForMenuDispatch(commandId),
    outputSha256: lifecycle.activeOutputSha256,
    diagnostic: {
      code: "menu_command_delegated_to_native_after_lifecycle_check",
      message: `Menu command "${safeResultCommandId(commandId)}" is delegated only after the lifecycle guard allows it.`
    }
  }));
}

function delegatedMenuCommand(
  state: ShortTermHostActionState,
  commandId: string,
  owner: "native" | "renderer",
  message: string
): ShortTermHostActionState {
  const resultCommandId = safeResultCommandId(commandId);
  return withLastAction(state, result("menuDispatch", "delegated", message, {
    commandId: resultCommandId,
    prdIds: shortTermPrdIdsForMenuDispatch(commandId),
    diagnostic: {
      code: owner === "native" ? "menu_command_delegated_to_native" : "menu_command_delegated_to_renderer",
      message: owner === "native"
        ? `Menu command "${resultCommandId}" is handled by the native shell.`
        : `Menu command "${resultCommandId}" is handled by the renderer runtime.`
    }
  }));
}

function missingContextForMenuCommand(
  state: ShortTermHostActionState,
  commandId: string,
  message: string,
  diagnosticMessage: string
): ShortTermHostActionState {
  const resultCommandId = safeResultCommandId(commandId);
  return withLastAction(state, result("menuDispatch", "blocked", message, {
    commandId: resultCommandId,
    prdIds: shortTermPrdIdsForMenuDispatch(commandId),
    diagnostic: {
      code: "menu_command_context_missing",
      message: diagnosticMessage.replaceAll(commandId, resultCommandId)
    }
  }));
}

function invalidOpenInput(
  state: ShortTermHostActionState,
  action: Extract<ShortTermHostActionKind, "openLocalFile" | "openRecentFile">,
  commandId: "openSvga" | "openRecent"
): ShortTermHostActionState {
  return withLastAction(state, result(action, "blocked", "打开请求不可用。", {
    commandId,
    diagnostic: {
      code: action === "openLocalFile" ? "open_local_input_invalid" : "open_recent_input_invalid",
      message: action === "openLocalFile"
        ? "Open local file requires requestId, source, and localPath."
        : "Open recent file requires requestId, recentFileId, and source."
    }
  }));
}

function invalidOutputInput(
  state: ShortTermHostActionState,
  action: Extract<ShortTermHostActionKind, "renameImageKey" | "replaceImage">,
  commandId: "renameImageKey" | "replaceImage"
): ShortTermHostActionState {
  return withLastAction(state, result(action, "blocked", "操作请求不可用。", {
    commandId,
    diagnostic: {
      code: action === "renameImageKey" ? "rename_input_invalid" : "replacement_input_invalid",
      message: action === "renameImageKey"
        ? "Rename imageKey requires source and target imageKey strings."
        : "Replace image requires an imageKey string and PNG bytes."
    }
  }));
}

function invalidTextPreviewInput(
  state: ShortTermHostActionState,
  action: Extract<ShortTermHostActionKind, "prepareTextPreview" | "applyTextPreview">
): ShortTermHostActionState {
  return withLastAction(state, result(action, "blocked", "文本预览请求不可用。", {
    diagnostic: {
      code: "text_preview_input_invalid",
      message: action === "prepareTextPreview"
        ? "Text preview preparation requires a valid textElements array."
        : "Text preview application requires a valid replacement payload."
    }
  }));
}

function invalidSaveInput(
  state: ShortTermHostActionState,
  command?: ShortTermSaveCommand
): ShortTermHostActionState {
  const commandId = command === "overwrite" ? "save" : command === "saveAs" ? "saveAs" : undefined;
  return withLastAction(state, result("save", "blocked", "保存请求不可用。", {
    ...(commandId ? { commandId } : {}),
    diagnostic: {
      code: "save_input_invalid",
      message: "Save requires a valid command and an optional string target path."
    }
  }));
}

function blockUnsavedOpen(
  state: ShortTermHostActionState,
  action: Extract<ShortTermHostActionKind, "openLocalFile" | "openRecentFile">,
  commandId: "openSvga" | "openRecent"
): ShortTermHostActionState {
  return withLastAction(state, result(action, "blocked", "当前文件有未保存输出，打开其他文件前需要确认丢弃。", {
    commandId,
    diagnostic: {
      code: "open_requires_discard_confirmation",
      message: "Opening another file is blocked until the caller confirms discarding unsaved output."
    }
  }));
}

function blockUnsavedOperation(
  state: ShortTermHostActionState,
  action: Extract<ShortTermHostActionKind, "runOptimization" | "renameImageKey" | "replaceImage">,
  commandId: "runOptimization" | "renameImageKey" | "replaceImage"
): ShortTermHostActionState {
  return withLastAction(state, result(action, "blocked", "当前文件有未保存输出，执行新操作前需要确认丢弃。", {
    commandId,
    diagnostic: {
      code: "operation_requires_discard_confirmation",
      message: "Starting another output-producing operation is blocked until the caller confirms discarding unsaved output."
    }
  }));
}

async function completeHostOpen(
  state: ShortTermHostActionState,
  host: ShortTermHostEnvironment,
  input: {
    action: "openLocalFile" | "openRecentFile";
    requestId: string;
    source: ShortTermOpenSource;
    localPath: string;
    displayName?: string;
    recentFileId?: string;
  }
): Promise<ShortTermHostActionState> {
  let file: ShortTermHostReadResult;
  try {
    file = await host.readLocalFile(input.localPath);
  } catch (error) {
    if (input.recentFileId) {
      return withLastAction({
        ...state,
        facade: markShortTermWorkbenchRecentFileMissing(
          state.facade,
          input.recentFileId,
          errorMessage(error, "最近文件已不存在或当前无法访问。", [input.localPath])
        ),
        currentLocalPath: undefined,
        activeOutputBytes: undefined
      }, result(input.action, "failed", "最近文件已不存在或当前无法访问。", {
        diagnostic: {
          code: "recent_file_read_failed",
          message: errorMessage(error, "Host could not read the recent file.", [input.localPath])
        }
      }));
    }

    return withLastAction({
      ...state,
      facade: failShortTermWorkbenchOpen(state.facade, {
        requestId: input.requestId,
        kind: "read",
        message: errorMessage(error, "文件读取失败。", [input.localPath])
      }),
      currentLocalPath: undefined,
      activeOutputBytes: undefined
    }, result(input.action, "failed", "文件读取失败。", {
      diagnostic: {
        code: "local_file_read_failed",
        message: errorMessage(error, "Host could not read the local file.", [input.localPath])
      }
    }));
  }

  const displayName = sanitizeDisplayName(input.displayName ?? file.displayName, input.localPath);
  try {
    const inspection = await host.inspectSvga({
      bytes: new Uint8Array(file.bytes),
      displayName,
      localPath: input.localPath
    });
    const facade = completeShortTermWorkbenchOpen(state.facade, {
      requestId: input.requestId,
      inspection: redactShortTermLocalPathsInValue(inspection, [input.localPath]),
      sourceBytes: file.bytes,
      localPath: input.localPath
    });
    return withLastAction({
      ...state,
      facade,
      currentLocalPath: input.localPath,
      activeOutputBytes: undefined
    }, result(input.action, "completed", "SVGA 已完成打开并进入短期产品状态。"));
  } catch (error) {
    return withLastAction({
      ...state,
      facade: failShortTermWorkbenchOpen(state.facade, {
        requestId: input.requestId,
        kind: "parse",
        message: errorMessage(error, "SVGA 解析失败。", [input.localPath])
      }),
      currentLocalPath: undefined,
      activeOutputBytes: undefined
    }, result(input.action, "failed", "SVGA 解析失败。", {
      diagnostic: {
        code: "local_file_inspection_failed",
        message: errorMessage(error, "Host could not inspect the SVGA file.", [input.localPath])
      }
    }));
  }
}

function isCommandEnabled(state: ShortTermHostActionState, commandId: string): boolean {
  if (isShortTermNativeDelegatedMenuCommand(commandId)) return true;
  const recentFileId = shortTermRecentFileIdFromMenuCommandId(commandId);
  const canonicalCommandId = canonicalShortTermHostMenuCommandId(commandId);
  if (recentFileId) {
    const command = state.facade.model.appState.commands.find((item) => item.id === "openRecent");
    return command?.enabled === true && state.facade.recentState.records.some((record) => record.id === recentFileId);
  }
  const command = state.facade.model.appState.commands.find((item) => item.id === canonicalCommandId);
  return command?.enabled === true;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isDiscardConfirmed(value: unknown): boolean {
  return isRecord(value) && value.discardUnsavedChanges === true;
}

function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

function isOpenLocalSource(value: unknown): value is ShortTermHostOpenLocalFileInput["source"] {
  return value === "fileButton" || value === "dragDrop" || value === "menuOpen";
}

function isRecentOpenSource(value: unknown): value is ShortTermRecentOpenSource {
  return value === "recentLaunch" || value === "recentMenu";
}

function isShortTermSaveCommand(value: unknown): value is ShortTermSaveCommand {
  return value === "overwrite" || value === "saveAs";
}

function isRuntimeTextElementArray(value: unknown): value is readonly ShortTermRuntimeTextElement[] {
  return Array.isArray(value) && value.every(isRuntimeTextElement);
}

function isRuntimeTextElement(value: unknown): value is ShortTermRuntimeTextElement {
  if (!isRecord(value)) return false;
  if (!isNonEmptyString(value.textKey) || typeof value.displayName !== "string") return false;
  if (value.initialText !== undefined && typeof value.initialText !== "string") return false;
  return Array.isArray(value.supportedFields) && value.supportedFields.every((item) => typeof item === "string");
}

function isRuntimeTextReplacement(value: unknown): value is ShortTermRuntimeTextReplacement {
  if (!isRecord(value) || !isNonEmptyString(value.textKey) || !isRecord(value.fields)) return false;
  const fields = value.fields;
  if (fields.text !== undefined && typeof fields.text !== "string") return false;
  if (fields.family !== undefined && typeof fields.family !== "string") return false;
  if (fields.size !== undefined && !Number.isFinite(fields.size)) return false;
  if (fields.color !== undefined && typeof fields.color !== "string") return false;
  if (fields.offset !== undefined) {
    if (!isRecord(fields.offset)) return false;
    if (!Number.isFinite(fields.offset.x) || !Number.isFinite(fields.offset.y)) return false;
  }
  return true;
}

function withLastAction(
  state: ShortTermHostActionState,
  lastAction: ShortTermHostActionResult
): ShortTermHostActionState {
  return {
    ...state,
    ...(state.activeOutputBytes ? { activeOutputBytes: new Uint8Array(state.activeOutputBytes) } : {}),
    lastAction
  };
}

function result(
  action: ShortTermHostActionKind,
  status: ShortTermHostActionStatus,
  message: string,
  options: ShortTermHostActionResultOptions = {}
): ShortTermHostActionResult {
  const { prdIds, ...rest } = options;
  return {
    schemaVersion: SHORT_TERM_HOST_ACTION_SCHEMA_VERSION,
    source: "short-term-host-action",
    prdIds: prdIds ?? shortTermPrdIdsForHostAction(action),
    action,
    status,
    message,
    pathRedacted: true,
    ...withoutUndefined(rest)
  };
}

function saveResult(
  status: ShortTermHostActionStatus,
  message: string,
  plan: ShortTermSaveExecutionPlan,
  options: Partial<Pick<ShortTermHostActionResult, "outputSha256" | "diagnostic">> = {}
): ShortTermHostActionResult {
  return result("save", status, message, {
    commandId: plan.command === "overwrite" ? "save" : "saveAs",
    targetDisplayName: plan.targetDisplayName,
    ...options
  });
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function sanitizeDisplayName(displayName: string | undefined, localPath: string): string {
  return shortTermDisplayNameFromPathLike(displayName) || shortTermDisplayNameFromPathLike(localPath);
}

function sameResolvedPath(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}

function safeResultCommandId(commandId: string): string {
  const trimmed = commandId.trim();
  if (SAFE_RESULT_COMMAND_ID_PATTERN.test(trimmed)) return trimmed;
  const canonicalCommandId = canonicalShortTermHostMenuCommandId(trimmed);
  if (
    SAFE_RESULT_COMMAND_ID_PATTERN.test(canonicalCommandId)
    && classifyShortTermHostMenuCommand(canonicalCommandId) !== "unsupported"
  ) {
    return canonicalCommandId;
  }
  return "unsupported";
}

function errorMessage(error: unknown, fallback: string, sensitivePaths: readonly string[] = []): string {
  return redactShortTermLocalPathsFromError(error, fallback, sensitivePaths);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
