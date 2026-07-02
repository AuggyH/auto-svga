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
  | "save"
  | "menuDispatch";

export type ShortTermHostActionStatus = "completed" | "blocked" | "failed" | "delegated";

export interface ShortTermHostActionState {
  facade: ShortTermWorkbenchFacadeState;
  currentLocalPath?: string;
  activeOutputBytes?: Uint8Array;
  lastAction?: ShortTermHostActionResult;
}

export interface ShortTermHostActionResult {
  schemaVersion: typeof SHORT_TERM_HOST_ACTION_SCHEMA_VERSION;
  source: "short-term-host-action";
  prdIds: readonly ["S1", "S14", "S16"];
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
}

export interface ShortTermHostOpenRecentFileInput {
  requestId: string;
  recentFileId: string;
  source: ShortTermRecentOpenSource;
}

export interface ShortTermHostSaveInput {
  command: ShortTermSaveCommand;
  targetPath?: string;
}

export interface ShortTermHostCloseInput {
  discardUnsavedChanges?: boolean;
}

export type ShortTermHostMenuActionInput =
  | ({ commandId: "openSvga" } & Omit<ShortTermHostOpenLocalFileInput, "source"> & { source?: ShortTermHostOpenLocalFileInput["source"] })
  | ({ commandId: "openRecent" } & Omit<ShortTermHostOpenRecentFileInput, "source"> & { source?: ShortTermRecentOpenSource })
  | { commandId: "clearRecent" }
  | ({ commandId: "closeFile" } & ShortTermHostCloseInput)
  | ({ commandId: "save" | "saveAs" } & Omit<ShortTermHostSaveInput, "command">)
  | { commandId: "runOptimization" }
  | { commandId: "renameImageKey"; fromImageKey: string; toImageKey: string }
  | { commandId: "replaceImage"; imageKey: string; pngBytes: Uint8Array }
  | { commandId: string };

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
  if (hasUnsavedHostOutput(state) && input.discardUnsavedChanges !== true) {
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
  state: ShortTermHostActionState
): Promise<ShortTermHostActionState> {
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
  toImageKey: string
): Promise<ShortTermHostActionState> {
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
  pngBytes: Uint8Array
): Promise<ShortTermHostActionState> {
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
      diagnostic: {
        code: "menu_command_disabled",
        message: `Menu command "${commandId}" is disabled or unsupported.`
      }
    }));
  }

  if (route === "native") {
    return delegatedMenuCommand(state, commandId, "native", "该菜单命令由 macOS 原生命令处理。");
  }
  if (route === "renderer") {
    return delegatedMenuCommand(state, commandId, "renderer", "该菜单命令由预览界面运行时处理。");
  }

  switch (canonicalCommandId) {
    case "openSvga": {
      const openInput = input as {
        requestId: string;
        source?: ShortTermHostOpenLocalFileInput["source"];
        localPath: string;
        displayName?: string;
      };
      return openShortTermHostLocalFile(state, host, {
        requestId: openInput.requestId,
        source: openInput.source ?? "menuOpen",
        localPath: openInput.localPath,
        displayName: openInput.displayName
      });
    }
    case "openRecent": {
      const recentInput = input as {
        requestId: string;
        recentFileId?: string;
        source?: ShortTermRecentOpenSource;
      };
      const recentFileId = recentInput.recentFileId ?? shortTermRecentFileIdFromMenuCommandId(commandId);
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
        requestId: recentInput.requestId ?? `recent-menu-${recentFileId}`,
        recentFileId,
        source: recentInput.source ?? "recentMenu"
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
    case "runOptimization":
      return runShortTermHostOptimization(state);
    case "renameImageKey": {
      const renameInput = input as { fromImageKey: string; toImageKey: string };
      return runShortTermHostImageKeyRename(state, renameInput.fromImageKey, renameInput.toImageKey);
    }
    case "replaceImage": {
      const replacementInput = input as { imageKey: string; pngBytes: Uint8Array };
      return runShortTermHostImageReplacement(state, replacementInput.imageKey, replacementInput.pngBytes);
    }
    default:
      return withLastAction(state, result("menuDispatch", "blocked", "当前菜单命令尚未接入主程动作。", {
        commandId,
        diagnostic: {
          code: "menu_command_not_routed",
          message: `Menu command "${commandId}" has no host action route.`
        }
      }));
  }
}

function delegatedMenuCommand(
  state: ShortTermHostActionState,
  commandId: string,
  owner: "native" | "renderer",
  message: string
): ShortTermHostActionState {
  return withLastAction(state, result("menuDispatch", "delegated", message, {
    commandId,
    diagnostic: {
      code: owner === "native" ? "menu_command_delegated_to_native" : "menu_command_delegated_to_renderer",
      message: owner === "native"
        ? `Menu command "${commandId}" is handled by the native shell.`
        : `Menu command "${commandId}" is handled by the renderer runtime.`
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

function hasUnsavedHostOutput(state: ShortTermHostActionState): boolean {
  return Boolean(state.activeOutputBytes || state.facade.model.activeOutput);
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
  options: Partial<Omit<ShortTermHostActionResult, "schemaVersion" | "source" | "prdIds" | "action" | "status" | "message" | "pathRedacted">> = {}
): ShortTermHostActionResult {
  return {
    schemaVersion: SHORT_TERM_HOST_ACTION_SCHEMA_VERSION,
    source: "short-term-host-action",
    prdIds: ["S1", "S14", "S16"],
    action,
    status,
    message,
    pathRedacted: true,
    ...withoutUndefined(options)
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
