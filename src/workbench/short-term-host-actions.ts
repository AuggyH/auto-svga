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
  | "prepareTextPreview"
  | "applyTextPreview"
  | "resetTextPreview"
  | "reportPlaybackFailure"
  | "recoverPlayback"
  | "save"
  | "menuDispatch";

export type ShortTermHostActionStatus = "completed" | "blocked" | "failed" | "delegated";
export type ShortTermHostActionPrdId =
  | "S1"
  | "S2"
  | "S8"
  | "S9"
  | "S10"
  | "S11"
  | "S12"
  | "S13"
  | "S14"
  | "S16";

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
  if (hasShortTermUnsavedHostOutput(state) && input.discardUnsavedChanges !== true) {
    return blockUnsavedOpen(state, "openLocalFile", "openSvga");
  }

  const loadingFacade = startShortTermWorkbenchOpen(state.facade, {
    requestId: input.requestId,
    source: input.source,
    localPath: input.localPath,
    displayName: input.displayName
  });
  return completeHostOpen(
    { ...state, facade: loadingFacade, activeOutputBytes: undefined },
    host,
    {
      action: "openLocalFile",
      requestId: input.requestId,
      source: input.source,
      localPath: input.localPath,
      displayName: input.displayName
    }
  );
}

export async function openShortTermHostRecentFile(
  state: ShortTermHostActionState,
  host: ShortTermHostEnvironment,
  input: ShortTermHostOpenRecentFileInput
): Promise<ShortTermHostActionState> {
  if (hasShortTermUnsavedHostOutput(state) && input.discardUnsavedChanges !== true) {
    return blockUnsavedOpen(state, "openRecentFile", "openRecent");
  }

  const opened = openShortTermWorkbenchRecentFile(
    state.facade,
    input.recentFileId,
    input.source,
    input.requestId
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
  if (host.fileExists && !(await host.fileExists(request.localPath))) {
    return withLastAction({
      ...state,
      facade: markShortTermWorkbenchRecentFileMissing(opened.state, request.recentFileId),
      activeOutputBytes: undefined,
      currentLocalPath: undefined
    }, result("openRecentFile", "failed", "最近文件已不存在或当前无法访问。", {
      diagnostic: {
        code: "recent_file_missing",
        message: "Host reported that the recent file path is unavailable."
      }
    }));
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
  if (hasShortTermUnsavedHostOutput(state) && input.discardUnsavedChanges !== true) {
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

  if (hasShortTermUnsavedHostOutput(state) && input.discardUnsavedChanges !== true) {
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

  if (hasShortTermUnsavedHostOutput(state) && input.discardUnsavedChanges !== true) {
    return blockUnsavedOperation(state, "renameImageKey", "renameImageKey");
  }

  const operation = await runShortTermWorkbenchRenamePreview(state.facade, fromImageKey, toImageKey);
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

  if (
    hasShortTermUnsavedHostOutput(state)
      && state.facade.model.activeOutput?.outputKind !== "image_replacement_svga"
      && input.discardUnsavedChanges !== true
  ) {
    return blockUnsavedOperation(state, "replaceImage", "replaceImage");
  }

  const operation = await runShortTermWorkbenchImageReplacementPreview(state.facade, imageKey, pngBytes);
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

export async function saveShortTermHostOutput(
  state: ShortTermHostActionState,
  host: ShortTermHostEnvironment,
  input: ShortTermHostSaveInput
): Promise<ShortTermHostActionState> {
  const targetPath = input.targetPath ?? (input.command === "overwrite" ? state.currentLocalPath : undefined);
  if (!targetPath) {
    return withLastAction(state, result("save", "blocked", "保存目标不可用。", {
      diagnostic: {
        code: "save_target_missing",
        message: "Save As requires a target path and overwrite requires the current local path."
      }
    }));
  }
  if (input.command === "saveAs" && state.currentLocalPath && sameResolvedPath(targetPath, state.currentLocalPath)) {
    return withLastAction(state, result("save", "blocked", "另存为目标必须不同于当前源文件；如需覆盖请使用覆盖保存。", {
      commandId: "saveAs",
      targetDisplayName: path.basename(targetPath),
      diagnostic: {
        code: "save_as_target_matches_source",
        message: "Save As target must be different from the current source path."
      }
    }));
  }
  if (!state.activeOutputBytes) {
    return withLastAction(state, result("save", "blocked", "没有已验证的可保存输出。", {
      targetDisplayName: path.basename(targetPath),
      diagnostic: {
        code: "active_output_bytes_missing",
        message: "Host action state does not contain validated output bytes."
      }
    }));
  }

  const plan = createShortTermWorkbenchSavePlan(state.facade, input.command, { targetPath });
  if (!plan || plan.status !== "readyToWrite") {
    return withLastAction(state, result("save", "blocked", plan?.message ?? "没有已验证的可保存输出。", {
      targetDisplayName: path.basename(targetPath),
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
      currentLocalPath: input.command === "saveAs" && completed.result.status === "saveComplete"
        ? targetPath
        : state.currentLocalPath
    }, saveResult(completed.result.status === "saveComplete" ? "completed" : "failed", completed.result.message, plan, {
      outputSha256: completed.result.savedSha256
    }));
  } catch (error) {
    const failed = failShortTermWorkbenchSave(state.facade, plan, error);
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

  const message = input.message.trim() || "播放器未正常完成播放。";
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
  const commandId = input.commandId;
  const canonicalCommandId = canonicalShortTermHostMenuCommandId(commandId);
  const route = classifyShortTermHostMenuCommand(commandId);
  if (!isCommandEnabled(state, commandId)) {
    const command = state.facade.model.appState.commands.find((item) => item.id === canonicalCommandId);
    return withLastAction(state, result("menuDispatch", "blocked", command?.reason ?? "当前菜单命令不可用。", {
      commandId,
      prdIds: prdIdsForMenuCommand(canonicalCommandId),
      diagnostic: {
        code: "menu_command_disabled",
        message: `Menu command "${commandId}" is disabled or unsupported.`
      }
    }));
  }

  if (route === "native") {
    if (commandId === "quit") {
      const lifecycleInput = input as ShortTermHostDirtyOperationInput;
      return guardedNativeLifecycleMenuCommand(state, commandId, lifecycleInput.discardUnsavedChanges);
    }
    return delegatedMenuCommand(state, commandId, "native", "该菜单命令由 macOS 原生命令处理。");
  }
  if (route === "renderer") {
    return delegatedMenuCommand(state, commandId, "renderer", "该菜单命令由预览界面运行时处理。");
  }

  switch (canonicalCommandId) {
    case "openSvga": {
      const openInput = input as Record<string, unknown>;
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
      const recentInput = input as Record<string, unknown>;
      const recentFileId = (
        isNonEmptyString(recentInput.recentFileId)
          ? recentInput.recentFileId
          : shortTermRecentFileIdFromMenuCommandId(commandId)
      );
      if (!recentFileId) {
        return withLastAction(state, result("openRecentFile", "blocked", "最近文件记录不可用。", {
          commandId,
          diagnostic: {
            code: "recent_file_id_missing",
            message: `Menu command "${commandId}" did not include a recent file id.`
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
      const closeInput = input as ShortTermHostCloseInput;
      return closeShortTermHostFile(state, closeInput);
    }
    case "save": {
      const saveInput = input as { targetPath?: string };
      return saveShortTermHostOutput(state, host, {
        command: "overwrite",
        targetPath: saveInput.targetPath
      });
    }
    case "saveAs": {
      const saveInput = input as { targetPath?: string };
      return saveShortTermHostOutput(state, host, {
        command: "saveAs",
        targetPath: saveInput.targetPath
      });
    }
    case "runOptimization": {
      const operationInput = input as ShortTermHostDirtyOperationInput;
      return runShortTermHostOptimization(state, operationInput);
    }
    case "renameImageKey": {
      const renameInput = input as Partial<{ fromImageKey: unknown; toImageKey: unknown } & ShortTermHostDirtyOperationInput>;
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
      const replacementInput = input as Partial<{ imageKey: unknown; pngBytes: unknown } & ShortTermHostDirtyOperationInput>;
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
    default:
      return withLastAction(state, result("menuDispatch", "blocked", "当前菜单命令尚未接入主程动作。", {
        commandId,
        prdIds: prdIdsForMenuCommand(canonicalCommandId),
        diagnostic: {
          code: "menu_command_not_routed",
          message: `Menu command "${commandId}" has no host action route.`
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
      commandId,
      prdIds: prdIdsForMenuCommand(commandId),
      outputSha256: lifecycle.activeOutputSha256,
      diagnostic: lifecycle.diagnostic
    }));
  }

  return withLastAction(state, result("menuDispatch", "delegated", lifecycle.message, {
    commandId,
    prdIds: prdIdsForMenuCommand(commandId),
    outputSha256: lifecycle.activeOutputSha256,
    diagnostic: {
      code: "menu_command_delegated_to_native_after_lifecycle_check",
      message: `Menu command "${commandId}" is delegated only after the lifecycle guard allows it.`
    }
  }));
}

function delegatedMenuCommand(
  state: ShortTermHostActionState,
  commandId: string,
  owner: "native" | "renderer",
  message: string
): ShortTermHostActionState {
  return withLastAction(state, result("menuDispatch", "delegated", message, {
    commandId,
    prdIds: prdIdsForMenuCommand(commandId),
    diagnostic: {
      code: owner === "native" ? "menu_command_delegated_to_native" : "menu_command_delegated_to_renderer",
      message: owner === "native"
        ? `Menu command "${commandId}" is handled by the native shell.`
        : `Menu command "${commandId}" is handled by the renderer runtime.`
    }
  }));
}

function missingContextForMenuCommand(
  state: ShortTermHostActionState,
  commandId: string,
  message: string,
  diagnosticMessage: string
): ShortTermHostActionState {
  return withLastAction(state, result("menuDispatch", "blocked", message, {
    commandId,
    prdIds: prdIdsForMenuCommand(commandId),
    diagnostic: {
      code: "menu_command_context_missing",
      message: diagnosticMessage
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
          errorMessage(error, "最近文件已不存在或当前无法访问。")
        ),
        currentLocalPath: undefined,
        activeOutputBytes: undefined
      }, result(input.action, "failed", "最近文件已不存在或当前无法访问。", {
        diagnostic: {
          code: "recent_file_read_failed",
          message: errorMessage(error, "Host could not read the recent file.")
        }
      }));
    }

    return withLastAction({
      ...state,
      facade: failShortTermWorkbenchOpen(state.facade, {
        requestId: input.requestId,
        kind: "read",
        message: errorMessage(error, "文件读取失败。")
      }),
      currentLocalPath: undefined,
      activeOutputBytes: undefined
    }, result(input.action, "failed", "文件读取失败。", {
      diagnostic: {
        code: "local_file_read_failed",
        message: errorMessage(error, "Host could not read the local file.")
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
      inspection,
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
        message: errorMessage(error, "SVGA 解析失败。")
      }),
      currentLocalPath: undefined,
      activeOutputBytes: undefined
    }, result(input.action, "failed", "SVGA 解析失败。", {
      diagnostic: {
        code: "local_file_inspection_failed",
        message: errorMessage(error, "Host could not inspect the SVGA file.")
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

function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

function isOpenLocalSource(value: unknown): value is ShortTermHostOpenLocalFileInput["source"] {
  return value === "fileButton" || value === "dragDrop" || value === "menuOpen";
}

function isRecentOpenSource(value: unknown): value is ShortTermRecentOpenSource {
  return value === "recentLaunch" || value === "recentMenu";
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
    prdIds: prdIds ?? prdIdsForAction(action),
    action,
    status,
    message,
    pathRedacted: true,
    ...withoutUndefined(rest)
  };
}

function prdIdsForAction(action: ShortTermHostActionKind): readonly ShortTermHostActionPrdId[] {
  switch (action) {
    case "openLocalFile":
      return ["S1", "S2"];
    case "openRecentFile":
    case "clearRecentFiles":
      return ["S1", "S2", "S16"];
    case "closeFile":
      return ["S1", "S14"];
    case "runOptimization":
      return ["S8", "S9", "S10", "S14"];
    case "renameImageKey":
      return ["S11", "S14"];
    case "replaceImage":
    case "resetImageReplacement":
      return ["S12", "S14"];
    case "prepareTextPreview":
    case "applyTextPreview":
    case "resetTextPreview":
      return ["S13"];
    case "reportPlaybackFailure":
    case "recoverPlayback":
      return ["S2"];
    case "save":
      return ["S14"];
    case "menuDispatch":
      return ["S1", "S2", "S14", "S16"];
  }
}

function prdIdsForMenuCommand(commandId: string): readonly ShortTermHostActionPrdId[] {
  switch (canonicalShortTermHostMenuCommandId(commandId)) {
    case "openSvga":
      return ["S1", "S2"];
    case "openRecent":
    case "clearRecent":
      return ["S1", "S2", "S16"];
    case "closeFile":
    case "quit":
      return ["S1", "S14"];
    case "save":
    case "saveAs":
      return ["S14"];
    case "runOptimization":
      return ["S8", "S9", "S10", "S14"];
    case "renameImageKey":
      return ["S11", "S14"];
    case "replaceImage":
      return ["S12", "S14"];
    case "playPause":
    case "replay":
      return ["S2"];
    case "toggleCompare":
      return ["S10"];
    default:
      return [];
  }
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
  const candidate = displayName?.trim();
  if (candidate) return path.basename(candidate);
  return path.basename(localPath);
}

function sameResolvedPath(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}

function errorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error && error.message ? error.message : fallback;
  return message.replace(/\/[^\s，。；;:'")]+/gu, "[local path]");
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
