import { createHash } from "node:crypto";
import {
  attachShortTermPersistedOutput,
  clearShortTermPersistedOutput,
  completeShortTermLocalOpen,
  createShortTermLaunchAppState,
  failShortTermLocalOpen,
  markShortTermRecentFileMissing as markAppRecentFileMissing,
  recoverShortTermPlayback,
  reportShortTermPlaybackFailure,
  setShortTermAppRecentFiles,
  startShortTermLocalOpen,
  type CompleteShortTermLocalOpenInput,
  type FailShortTermLocalOpenInput,
  type ShortTermAppStateModel,
  type ShortTermLocalOpenRequest
} from "./short-term-app-state.js";
import {
  createShortTermRecentFilesState,
  createShortTermRecentFilesViewModel,
  addShortTermRecentFile,
  clearShortTermRecentFiles,
  markShortTermRecentFileMissing,
  resolveShortTermRecentOpen,
  type ShortTermRecentFileInput,
  type ShortTermRecentFilesState,
  type ShortTermRecentFilesViewModel,
  type ShortTermRecentOpenResolution,
  type ShortTermRecentOpenSource
} from "./short-term-recent-files.js";
import {
  startShortTermOptimizationCompareSession,
  type ShortTermOptimizationCompareSessionResult
} from "./short-term-optimization-compare-session.js";
import {
  startShortTermRenamePreviewSession,
  type ShortTermRenamePreviewSessionResult
} from "./short-term-rename-preview-session.js";
import {
  applyShortTermImageReplacementPreview,
  createShortTermImageReplacementPreviewSession,
  resetShortTermImageReplacementPreview,
  type ShortTermImageReplacementPreviewSessionState
} from "./short-term-image-replacement-preview-session.js";
import {
  applyShortTermTextPreview,
  createShortTermTextPreviewSession,
  resetShortTermTextPreview,
  type ShortTermRuntimeTextElement,
  type ShortTermRuntimeTextReplacement,
  type ShortTermTextPreviewSessionState
} from "./short-term-text-preview-session.js";
import {
  completeShortTermSaveExecution,
  createShortTermSaveExecutionPlan,
  failShortTermSaveExecution,
  type CreateShortTermSaveExecutionPlanOptions,
  type ShortTermSaveExecutionPlan,
  type ShortTermSaveExecutionResult
} from "./short-term-save-execution.js";
import type { ShortTermPersistedOutputRecord, ShortTermSaveCommand } from "./short-term-save-state.js";
import {
  createShortTermCommandMenuModel,
  type ShortTermCommandMenuModel
} from "./short-term-command-menu.js";

export const SHORT_TERM_WORKBENCH_FACADE_SCHEMA_VERSION = 1 as const;

export type ShortTermFacadeWorkflowKind =
  | "none"
  | "open"
  | "recent"
  | "optimizationCompare"
  | "renamePreview"
  | "imageReplacementPreview"
  | "textPreview"
  | "playback"
  | "save";

export interface ShortTermFacadeWorkflowSummary {
  kind: ShortTermFacadeWorkflowKind;
  status: string;
  playerAction?: string;
  message: string;
}

export interface ShortTermWorkbenchFacadeModel {
  schemaVersion: typeof SHORT_TERM_WORKBENCH_FACADE_SCHEMA_VERSION;
  source: "short-term-workbench-facade";
  prdIds: readonly string[];
  appState: ShortTermAppStateModel;
  commandMenu: ShortTermCommandMenuModel;
  recentFiles: ShortTermRecentFilesViewModel;
  currentSourceSha256?: string;
  activeOutput?: ShortTermPersistedOutputRecord;
  activeWorkflow: ShortTermFacadeWorkflowSummary;
}

export interface ShortTermWorkbenchFacadeState {
  sourceBytes?: Uint8Array;
  recentState: ShortTermRecentFilesState;
  imageReplacementSession?: ShortTermImageReplacementPreviewSessionState;
  textPreviewSession?: ShortTermTextPreviewSessionState;
  model: ShortTermWorkbenchFacadeModel;
}

export interface CreateShortTermWorkbenchFacadeOptions {
  recentFiles?: readonly ShortTermRecentFileInput[];
}

export interface CompleteShortTermWorkbenchOpenInput extends CompleteShortTermLocalOpenInput {
  sourceBytes: Uint8Array;
  localPath?: string;
}

export function createShortTermWorkbenchFacade(
  options: CreateShortTermWorkbenchFacadeOptions = {}
): ShortTermWorkbenchFacadeState {
  const recentState = createShortTermRecentFilesState(options.recentFiles ?? []);
  const recentView = createShortTermRecentFilesViewModel(recentState);
  const appState = createShortTermLaunchAppState({ recentFiles: recentView.launchRecentFiles });
  return buildFacadeState({
    recentState,
    appState,
    activeWorkflow: idleWorkflow("等待打开 SVGA。")
  });
}

export function startShortTermWorkbenchOpen(
  state: ShortTermWorkbenchFacadeState,
  request: ShortTermLocalOpenRequest
): ShortTermWorkbenchFacadeState {
  return buildFacadeState({
    recentState: state.recentState,
    appState: startShortTermLocalOpen(state.model.appState, request),
    activeWorkflow: {
      kind: "open",
      status: "loading",
      message: "正在通过统一本地打开流程加载 SVGA。"
    }
  });
}

export function completeShortTermWorkbenchOpen(
  state: ShortTermWorkbenchFacadeState,
  input: CompleteShortTermWorkbenchOpenInput
): ShortTermWorkbenchFacadeState {
  const sourceBytes = new Uint8Array(input.sourceBytes);
  let recentState = state.recentState;
  if (input.localPath) {
    recentState = addShortTermRecentFile(recentState, {
      localPath: input.localPath,
      displayName: state.model.appState.loading?.displayName,
      lastOpenedAt: new Date().toISOString()
    });
  }
  const recentView = createShortTermRecentFilesViewModel(recentState);
  const appState = setShortTermAppRecentFiles(
    completeShortTermLocalOpen(state.model.appState, input),
    recentView.launchRecentFiles
  );
  return buildFacadeState({
    sourceBytes,
    recentState,
    appState,
    activeWorkflow: {
      kind: "open",
      status: appState.state,
      message: "SVGA 已完成打开并进入短期产品状态。"
    }
  });
}

export function failShortTermWorkbenchOpen(
  state: ShortTermWorkbenchFacadeState,
  input: FailShortTermLocalOpenInput
): ShortTermWorkbenchFacadeState {
  return buildFacadeState({
    recentState: state.recentState,
    appState: failShortTermLocalOpen(state.model.appState, input),
    activeWorkflow: {
      kind: "open",
      status: "failed",
      message: input.message
    }
  });
}

export function clearShortTermWorkbenchRecentFiles(
  state: ShortTermWorkbenchFacadeState
): ShortTermWorkbenchFacadeState {
  const recentState = clearShortTermRecentFiles();
  const appState = setShortTermAppRecentFiles(state.model.appState, []);
  return buildFacadeState({
    sourceBytes: state.sourceBytes,
    recentState,
    appState,
    activeOutput: state.model.activeOutput,
    activeWorkflow: {
      kind: "recent",
      status: "cleared",
      message: "最近记录已清除，源文件不会被删除。"
    }
  });
}

export function closeShortTermWorkbenchFile(
  state: ShortTermWorkbenchFacadeState
): ShortTermWorkbenchFacadeState {
  const recentView = createShortTermRecentFilesViewModel(state.recentState);
  return buildFacadeState({
    recentState: state.recentState,
    appState: createShortTermLaunchAppState({
      recentFiles: recentView.launchRecentFiles
    }),
    activeWorkflow: idleWorkflow("当前文件已关闭。")
  });
}

export function openShortTermWorkbenchRecentFile(
  state: ShortTermWorkbenchFacadeState,
  recentFileId: string,
  source: ShortTermRecentOpenSource,
  requestId: string
): { state: ShortTermWorkbenchFacadeState; resolution: ShortTermRecentOpenResolution } {
  const resolution = resolveShortTermRecentOpen(state.recentState, recentFileId, source, requestId);
  if (resolution.status === "ready") {
    return {
      resolution,
      state: startShortTermWorkbenchOpen(state, resolution.request)
    };
  }

  const recentState = markShortTermRecentFileMissing(state.recentState, recentFileId);
  const recentView = createShortTermRecentFilesViewModel(recentState, "missing");
  const appState = markAppRecentFileMissing(
    setShortTermAppRecentFiles(state.model.appState, recentView.launchRecentFiles),
    recentFileId,
    resolution.message
  );
  return {
    resolution,
    state: buildFacadeState({
      recentState,
      appState,
      activeWorkflow: {
        kind: "recent",
        status: "missing",
        message: resolution.message
      }
    })
  };
}

export function markShortTermWorkbenchRecentFileMissing(
  state: ShortTermWorkbenchFacadeState,
  recentFileId: string,
  message = "最近文件已不存在或当前无法访问。"
): ShortTermWorkbenchFacadeState {
  const recentState = markShortTermRecentFileMissing(state.recentState, recentFileId);
  const recentView = createShortTermRecentFilesViewModel(recentState, "missing");
  const appState = markAppRecentFileMissing(
    setShortTermAppRecentFiles(state.model.appState, recentView.launchRecentFiles),
    recentFileId,
    message
  );
  return buildFacadeState({
    recentState,
    appState,
    activeWorkflow: {
      kind: "recent",
      status: "missing",
      message
    }
  });
}

export async function runShortTermWorkbenchOptimizationCompare(
  state: ShortTermWorkbenchFacadeState
): Promise<{ state: ShortTermWorkbenchFacadeState; session: ShortTermOptimizationCompareSessionResult }> {
  const sourceBytes = requireSourceBytes(state);
  const session = await startShortTermOptimizationCompareSession(sourceBytes, {
    sourceName: state.model.appState.currentFile?.displayName
  });
  return {
    session,
    state: buildFacadeStateWithOutput(state, {
      activeWorkflow: {
        kind: "optimizationCompare",
        status: session.model.status,
        playerAction: session.model.playerAction,
        message: session.model.message
      },
      output: session.model.persistedOutput
    })
  };
}

export async function runShortTermWorkbenchRenamePreview(
  state: ShortTermWorkbenchFacadeState,
  fromImageKey: string,
  toImageKey: string
): Promise<{ state: ShortTermWorkbenchFacadeState; session: ShortTermRenamePreviewSessionResult }> {
  const sourceBytes = requireSourceBytes(state);
  const session = await startShortTermRenamePreviewSession(sourceBytes, fromImageKey, toImageKey, {
    sourceName: state.model.appState.currentFile?.displayName
  });
  return {
    session,
    state: buildFacadeStateWithOutput(state, {
      activeWorkflow: {
        kind: "renamePreview",
        status: session.model.status,
        playerAction: session.model.playerAction,
        message: session.model.message
      },
      output: session.model.persistedOutput
    })
  };
}

export async function runShortTermWorkbenchImageReplacementPreview(
  state: ShortTermWorkbenchFacadeState,
  imageKey: string,
  pngBytes: Uint8Array
): Promise<{ state: ShortTermWorkbenchFacadeState; session: ShortTermImageReplacementPreviewSessionState }> {
  const sourceBytes = requireSourceBytes(state);
  const initialSession = state.imageReplacementSession ?? createShortTermImageReplacementPreviewSession(sourceBytes, {
    sourceName: state.model.appState.currentFile?.displayName
  });
  const result = await applyShortTermImageReplacementPreview(initialSession, { imageKey, pngBytes });
  return {
    session: result.session,
    state: buildFacadeStateWithOutput(state, {
      imageReplacementSession: result.session,
      activeWorkflow: {
        kind: "imageReplacementPreview",
        status: result.session.model.status,
        playerAction: result.session.model.playerAction,
        message: result.session.model.lastAction.message
      },
      output: result.session.model.persistedOutput
    })
  };
}

export function resetShortTermWorkbenchImageReplacementPreview(
  state: ShortTermWorkbenchFacadeState
): ShortTermWorkbenchFacadeState {
  const sourceBytes = requireSourceBytes(state);
  const session = resetShortTermImageReplacementPreview(
    state.imageReplacementSession ?? createShortTermImageReplacementPreviewSession(sourceBytes)
  );
  return buildFacadeStateWithOutput(state, {
    imageReplacementSession: session,
    activeWorkflow: {
      kind: "imageReplacementPreview",
      status: session.model.status,
      playerAction: session.model.playerAction,
      message: session.model.lastAction.message
    }
  });
}

export function createShortTermWorkbenchTextPreview(
  state: ShortTermWorkbenchFacadeState,
  textElements: readonly ShortTermRuntimeTextElement[]
): ShortTermWorkbenchFacadeState {
  const sourceBytes = requireSourceBytes(state);
  const textPreviewSession = createShortTermTextPreviewSession(sourceBytes, {
    sourceName: state.model.appState.currentFile?.displayName,
    textElements
  });
  return buildFacadeState({
    sourceBytes: state.sourceBytes,
    recentState: state.recentState,
    imageReplacementSession: state.imageReplacementSession,
    textPreviewSession,
    appState: state.model.appState,
    activeOutput: state.model.activeOutput,
    activeWorkflow: {
      kind: "textPreview",
      status: textPreviewSession.model.status,
      playerAction: textPreviewSession.model.playerAction,
      message: textPreviewSession.model.message
    }
  });
}

export function applyShortTermWorkbenchTextPreview(
  state: ShortTermWorkbenchFacadeState,
  replacement: ShortTermRuntimeTextReplacement
): ShortTermWorkbenchFacadeState {
  const sourceBytes = requireSourceBytes(state);
  const textPreviewSession = applyShortTermTextPreview(
    state.textPreviewSession ?? createShortTermTextPreviewSession(sourceBytes),
    replacement
  );
  return buildFacadeState({
    sourceBytes: state.sourceBytes,
    recentState: state.recentState,
    imageReplacementSession: state.imageReplacementSession,
    textPreviewSession,
    appState: state.model.appState,
    activeOutput: state.model.activeOutput,
    activeWorkflow: {
      kind: "textPreview",
      status: textPreviewSession.model.status,
      playerAction: textPreviewSession.model.playerAction,
      message: textPreviewSession.model.message
    }
  });
}

export function resetShortTermWorkbenchTextPreview(
  state: ShortTermWorkbenchFacadeState
): ShortTermWorkbenchFacadeState {
  const sourceBytes = requireSourceBytes(state);
  const textPreviewSession = resetShortTermTextPreview(
    state.textPreviewSession ?? createShortTermTextPreviewSession(sourceBytes)
  );
  return buildFacadeState({
    sourceBytes: state.sourceBytes,
    recentState: state.recentState,
    imageReplacementSession: state.imageReplacementSession,
    textPreviewSession,
    appState: state.model.appState,
    activeOutput: state.model.activeOutput,
    activeWorkflow: {
      kind: "textPreview",
      status: textPreviewSession.model.status,
      playerAction: textPreviewSession.model.playerAction,
      message: textPreviewSession.model.message
    }
  });
}

export function reportShortTermWorkbenchPlaybackFailure(
  state: ShortTermWorkbenchFacadeState,
  message: string
): ShortTermWorkbenchFacadeState {
  const appState = reportShortTermPlaybackFailure(state.model.appState, { message });
  return buildFacadeState({
    ...state,
    appState,
    activeOutput: state.model.activeOutput,
    activeWorkflow: {
      kind: "playback",
      status: appState.state,
      playerAction: "keepPreview",
      message
    }
  });
}

export function recoverShortTermWorkbenchPlayback(
  state: ShortTermWorkbenchFacadeState
): ShortTermWorkbenchFacadeState {
  const appState = recoverShortTermPlayback(state.model.appState);
  return buildFacadeState({
    ...state,
    appState,
    activeOutput: state.model.activeOutput,
    activeWorkflow: {
      kind: "playback",
      status: appState.state,
      playerAction: "replay",
      message: "播放异常状态已恢复，预览可重新播放。"
    }
  });
}

export function createShortTermWorkbenchSavePlan(
  state: ShortTermWorkbenchFacadeState,
  command: ShortTermSaveCommand,
  options: CreateShortTermSaveExecutionPlanOptions = {}
): ShortTermSaveExecutionPlan | undefined {
  const output = state.model.activeOutput;
  return output ? createShortTermSaveExecutionPlan(output, command, options) : undefined;
}

export function completeShortTermWorkbenchSave(
  state: ShortTermWorkbenchFacadeState,
  plan: ShortTermSaveExecutionPlan,
  savedBytes: Uint8Array
): { state: ShortTermWorkbenchFacadeState; result: ShortTermSaveExecutionResult } {
  const output = state.model.activeOutput;
  const result = output
    ? completeShortTermSaveExecution(plan, output, savedBytes)
    : failShortTermSaveExecution(plan, new Error("No active persisted output."));
  const appState = result.status === "saveComplete"
    ? clearShortTermPersistedOutput(state.model.appState)
    : state.model.appState;
  return {
    result,
    state: buildFacadeState({
      ...state,
      appState,
      activeOutput: result.status === "saveComplete" ? undefined : output,
      activeWorkflow: {
        kind: "save",
        status: result.status,
        message: result.message
      }
    })
  };
}

export function failShortTermWorkbenchSave(
  state: ShortTermWorkbenchFacadeState,
  plan: ShortTermSaveExecutionPlan,
  error: unknown
): { state: ShortTermWorkbenchFacadeState; result: ShortTermSaveExecutionResult } {
  const output = state.model.activeOutput;
  const result = failShortTermSaveExecution(plan, error);
  return {
    result,
    state: buildFacadeState({
      ...state,
      appState: state.model.appState,
      activeOutput: output,
      activeWorkflow: {
        kind: "save",
        status: result.status,
        message: result.message
      }
    })
  };
}

function buildFacadeStateWithOutput(
  state: ShortTermWorkbenchFacadeState,
  input: {
    activeWorkflow: ShortTermFacadeWorkflowSummary;
    output?: ShortTermPersistedOutputRecord;
    imageReplacementSession?: ShortTermImageReplacementPreviewSessionState;
  }
): ShortTermWorkbenchFacadeState {
  const activeOutput = input.output;
  const appState = activeOutput
    ? attachShortTermPersistedOutput(state.model.appState, activeOutput)
    : clearShortTermPersistedOutput(state.model.appState);
  return buildFacadeState({
    ...state,
    ...(input.imageReplacementSession ? { imageReplacementSession: input.imageReplacementSession } : {}),
    appState,
    activeOutput,
    activeWorkflow: input.activeWorkflow
  });
}

function buildFacadeState(input: {
  sourceBytes?: Uint8Array;
  recentState: ShortTermRecentFilesState;
  imageReplacementSession?: ShortTermImageReplacementPreviewSessionState;
  textPreviewSession?: ShortTermTextPreviewSessionState;
  appState: ShortTermAppStateModel;
  activeOutput?: ShortTermPersistedOutputRecord;
  activeWorkflow: ShortTermFacadeWorkflowSummary;
}): ShortTermWorkbenchFacadeState {
  const recentState = cloneFacadeData(input.recentState);
  const appState = cloneFacadeData(input.appState);
  const activeOutput = input.activeOutput ? cloneFacadeData(input.activeOutput) : undefined;
  const activeWorkflow = cloneFacadeData(input.activeWorkflow);
  const imageReplacementSession = input.imageReplacementSession ? cloneFacadeData(input.imageReplacementSession) : undefined;
  const textPreviewSession = input.textPreviewSession ? cloneFacadeData(input.textPreviewSession) : undefined;
  const recentFiles = createShortTermRecentFilesViewModel(recentState);
  const sourceBytes = input.sourceBytes ? new Uint8Array(input.sourceBytes) : undefined;
  return {
    ...(sourceBytes ? { sourceBytes } : {}),
    recentState,
    ...(imageReplacementSession ? { imageReplacementSession } : {}),
    ...(textPreviewSession ? { textPreviewSession } : {}),
    model: {
      schemaVersion: SHORT_TERM_WORKBENCH_FACADE_SCHEMA_VERSION,
      source: "short-term-workbench-facade",
      prdIds: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12", "S13", "S14", "S15", "S16"],
      appState,
      commandMenu: createShortTermCommandMenuModel(appState),
      recentFiles,
      ...(sourceBytes ? { currentSourceSha256: sha256(sourceBytes) } : {}),
      ...(activeOutput ? { activeOutput } : {}),
      activeWorkflow
    }
  };
}

function cloneFacadeData<T>(value: T): T {
  return structuredClone(value) as T;
}

function idleWorkflow(message: string): ShortTermFacadeWorkflowSummary {
  return {
    kind: "none",
    status: "idle",
    message
  };
}

function requireSourceBytes(state: ShortTermWorkbenchFacadeState): Uint8Array {
  if (!state.sourceBytes) {
    throw new Error("Short-term workbench facade has no opened source bytes.");
  }
  return new Uint8Array(state.sourceBytes);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
