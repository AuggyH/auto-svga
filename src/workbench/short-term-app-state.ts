import type { ShortTermProductInspectionModel } from "./short-term-product-model.js";
import type { ShortTermPersistedOutputRecord } from "./short-term-save-state.js";
import { shortTermDisplayNameFromPathLike } from "./short-term-path-display.js";

export const SHORT_TERM_APP_STATE_SCHEMA_VERSION = 1 as const;

export type ShortTermAppStateName =
  | "launch"
  | "loading"
  | "loadFailed"
  | "previewReady"
  | "playbackAbnormal"
  | "recentFileMissing";

export type ShortTermOpenSource =
  | "fileButton"
  | "dragDrop"
  | "menuOpen"
  | "recentLaunch"
  | "recentMenu";

export type ShortTermLoadFailureKind = "read" | "parse" | "unsupported" | "missing" | "unknown";
export type ShortTermCommandGroup = "File" | "Edit" | "View" | "Playback" | "Resource" | "Optimize" | "Window" | "Help";

export interface ShortTermRecentFileRecord {
  id: string;
  displayName: string;
  lastOpenedAt: string;
}

export interface ShortTermLocalOpenRequest {
  requestId: string;
  source: ShortTermOpenSource;
  displayName?: string;
  localPath?: string;
  recentFileId?: string;
}

export interface ShortTermLoadedFileSummary {
  requestId: string;
  displayName: string;
  openedFrom: ShortTermOpenSource;
  pathRedacted: true;
  rendererHasFullPath: false;
  inspection: ShortTermProductInspectionModel;
}

export interface ShortTermLoadingState {
  requestId: string;
  source: ShortTermOpenSource;
  displayName: string;
  recentFileId?: string;
  message: string;
}

export interface ShortTermFailureState {
  requestId?: string;
  kind: ShortTermLoadFailureKind | "playback";
  title: string;
  message: string;
  recoveryActions: readonly ["openFile", "dragFile", "menuOpen"];
}

export interface ShortTermCommandState {
  id: string;
  group: ShortTermCommandGroup;
  label: string;
  enabled: boolean;
  shortcut?: string;
  reason?: string;
}

export interface ShortTermAppStateModel {
  schemaVersion: typeof SHORT_TERM_APP_STATE_SCHEMA_VERSION;
  source: "short-term-app-state";
  prdIds: readonly ["S1", "S2", "S16"];
  state: ShortTermAppStateName;
  stateLabel: string;
  recentFiles: readonly ShortTermRecentFileRecord[];
  currentFile?: ShortTermLoadedFileSummary;
  persistedOutput?: ShortTermPersistedOutputRecord;
  loading?: ShortTermLoadingState;
  failure?: ShortTermFailureState;
  commands: readonly ShortTermCommandState[];
  staleFileDataCleared: boolean;
}

export interface CreateShortTermLaunchStateInput {
  recentFiles?: readonly ShortTermRecentFileRecord[];
}

export interface CompleteShortTermLocalOpenInput {
  requestId: string;
  inspection: ShortTermProductInspectionModel;
}

export interface FailShortTermLocalOpenInput {
  requestId?: string;
  kind: ShortTermLoadFailureKind;
  message: string;
}

export interface ReportShortTermPlaybackFailureInput {
  message: string;
}

export function createShortTermLaunchAppState(
  input: CreateShortTermLaunchStateInput = {}
): ShortTermAppStateModel {
  return withCommands({
    schemaVersion: SHORT_TERM_APP_STATE_SCHEMA_VERSION,
    source: "short-term-app-state",
    prdIds: ["S1", "S2", "S16"],
    state: "launch",
    stateLabel: "等待打开 SVGA",
    recentFiles: normalizeRecentFiles(input.recentFiles ?? []),
    staleFileDataCleared: true
  });
}

export function startShortTermLocalOpen(
  state: ShortTermAppStateModel,
  request: ShortTermLocalOpenRequest
): ShortTermAppStateModel {
  return withCommands({
    schemaVersion: SHORT_TERM_APP_STATE_SCHEMA_VERSION,
    source: "short-term-app-state",
    prdIds: ["S1", "S2", "S16"],
    state: "loading",
    stateLabel: "正在打开 SVGA",
    recentFiles: state.recentFiles,
    loading: {
      requestId: request.requestId,
      source: request.source,
      displayName: displayNameForRequest(request),
      ...(request.recentFileId ? { recentFileId: request.recentFileId } : {}),
      message: "正在读取并解析本地 SVGA。"
    },
    staleFileDataCleared: true
  });
}

export function completeShortTermLocalOpen(
  state: ShortTermAppStateModel,
  input: CompleteShortTermLocalOpenInput
): ShortTermAppStateModel {
  if (state.state !== "loading" || state.loading?.requestId !== input.requestId) {
    return state;
  }

  return withCommands({
    schemaVersion: SHORT_TERM_APP_STATE_SCHEMA_VERSION,
    source: "short-term-app-state",
    prdIds: ["S1", "S2", "S16"],
    state: "previewReady",
    stateLabel: "预览就绪",
    recentFiles: state.recentFiles,
    currentFile: {
      requestId: input.requestId,
      displayName: state.loading.displayName,
      openedFrom: state.loading.source,
      pathRedacted: true,
      rendererHasFullPath: false,
      inspection: input.inspection
    },
    staleFileDataCleared: false
  });
}

export function failShortTermLocalOpen(
  state: ShortTermAppStateModel,
  input: FailShortTermLocalOpenInput
): ShortTermAppStateModel {
  if (input.requestId && (state.state !== "loading" || state.loading?.requestId !== input.requestId)) {
    return state;
  }

  return withCommands({
    schemaVersion: SHORT_TERM_APP_STATE_SCHEMA_VERSION,
    source: "short-term-app-state",
    prdIds: ["S1", "S2", "S16"],
    state: "loadFailed",
    stateLabel: "打开失败",
    recentFiles: state.recentFiles,
    failure: {
      requestId: input.requestId,
      kind: input.kind,
      title: titleForLoadFailure(input.kind),
      message: input.message,
      recoveryActions: ["openFile", "dragFile", "menuOpen"]
    },
    staleFileDataCleared: true
  });
}

export function reportShortTermPlaybackFailure(
  state: ShortTermAppStateModel,
  input: ReportShortTermPlaybackFailureInput
): ShortTermAppStateModel {
  if (!state.currentFile) return state;

  return withCommands({
    schemaVersion: SHORT_TERM_APP_STATE_SCHEMA_VERSION,
    source: "short-term-app-state",
    prdIds: ["S1", "S2", "S16"],
    state: "playbackAbnormal",
    stateLabel: "播放异常",
    recentFiles: state.recentFiles,
    currentFile: state.currentFile,
    ...(state.persistedOutput ? { persistedOutput: state.persistedOutput } : {}),
    failure: {
      requestId: state.currentFile.requestId,
      kind: "playback",
      title: "播放未正常完成",
      message: input.message,
      recoveryActions: ["openFile", "dragFile", "menuOpen"]
    },
    staleFileDataCleared: false
  });
}

export function recoverShortTermPlayback(state: ShortTermAppStateModel): ShortTermAppStateModel {
  if (!state.currentFile) return createShortTermLaunchAppState({ recentFiles: state.recentFiles });

  return withCommands({
    schemaVersion: SHORT_TERM_APP_STATE_SCHEMA_VERSION,
    source: "short-term-app-state",
    prdIds: ["S1", "S2", "S16"],
    state: "previewReady",
    stateLabel: "预览就绪",
    recentFiles: state.recentFiles,
    currentFile: state.currentFile,
    ...(state.persistedOutput ? { persistedOutput: state.persistedOutput } : {}),
    staleFileDataCleared: false
  });
}

export function attachShortTermPersistedOutput(
  state: ShortTermAppStateModel,
  persistedOutput: ShortTermPersistedOutputRecord
): ShortTermAppStateModel {
  if (!state.currentFile || !persistedOutput.saveState.outputAvailable) return state;

  return withCommands({
    ...state,
    persistedOutput
  });
}

export function clearShortTermPersistedOutput(state: ShortTermAppStateModel): ShortTermAppStateModel {
  if (!state.persistedOutput) return state;
  const nextState = { ...state };
  delete nextState.persistedOutput;
  return withCommands(nextState);
}

export function setShortTermAppRecentFiles(
  state: ShortTermAppStateModel,
  recentFiles: readonly ShortTermRecentFileRecord[]
): ShortTermAppStateModel {
  return withCommands({
    ...state,
    recentFiles: normalizeRecentFiles(recentFiles)
  });
}

export function markShortTermRecentFileMissing(
  state: ShortTermAppStateModel,
  recentFileId: string,
  message = "最近文件已不存在或当前无法访问。"
): ShortTermAppStateModel {
  const record = state.recentFiles.find(({ id }) => id === recentFileId);
  return withCommands({
    schemaVersion: SHORT_TERM_APP_STATE_SCHEMA_VERSION,
    source: "short-term-app-state",
    prdIds: ["S1", "S2", "S16"],
    state: "recentFileMissing",
    stateLabel: "最近文件不可用",
    recentFiles: state.recentFiles,
    failure: {
      requestId: recentFileId,
      kind: "missing",
      title: record ? `${record.displayName} 无法打开` : "最近文件无法打开",
      message,
      recoveryActions: ["openFile", "dragFile", "menuOpen"]
    },
    staleFileDataCleared: true
  });
}

function withCommands(state: Omit<ShortTermAppStateModel, "commands">): ShortTermAppStateModel {
  return {
    ...state,
    commands: commandStates(state)
  };
}

function commandStates(state: Omit<ShortTermAppStateModel, "commands">): ShortTermCommandState[] {
  const hasFile = Boolean(state.currentFile);
  const isLoading = state.state === "loading";
  const canInspect = state.state === "previewReady" || state.state === "playbackAbnormal";
  const canPlay = state.state === "previewReady";
  const saveEnabled = state.persistedOutput?.saveState.overwriteSaveEnabled === true;
  const saveAsEnabled = state.persistedOutput?.saveState.saveAsEnabled === true;
  return [
    command("openSvga", "File", "打开 SVGA", true, "Cmd+O"),
    command("openRecent", "File", "最近打开", state.recentFiles.length > 0, undefined, "没有最近文件"),
    command("clearRecent", "File", "清空最近记录", state.recentFiles.length > 0, undefined, "没有最近文件"),
    command("closeFile", "File", "关闭文件", hasFile && !isLoading, "Cmd+W", "当前没有打开文件"),
    command("save", "File", "保存", saveEnabled, "Cmd+S", "没有已验证的可保存输出"),
    command("saveAs", "File", "另存为", saveAsEnabled, "Shift+Cmd+S", "没有已验证的可保存输出"),
    command("copy", "Edit", "复制", true, "Cmd+C"),
    command("selectAll", "Edit", "全选", true, "Cmd+A"),
    command("toggleCompare", "View", "比较预览", canInspect, undefined, "需要先打开有效 SVGA"),
    command("playPause", "Playback", "播放/暂停", canPlay, "Space", "预览未就绪"),
    command("replay", "Playback", "重新播放", canInspect, undefined, "预览未就绪"),
    command("renameImageKey", "Resource", "重命名 imageKey", state.state === "previewReady", "Cmd+R", "需要先打开有效 SVGA"),
    command("replaceImage", "Resource", "替换图片预览", state.state === "previewReady", undefined, "需要先打开有效 SVGA"),
    command("editTextPreview", "Resource", "文本预览", state.state === "previewReady", undefined, "需要先打开有效 SVGA"),
    command("runOptimization", "Optimize", "生成优化副本", state.state === "previewReady", undefined, "需要先打开有效 SVGA"),
    command("minimize", "Window", "最小化", true, "Cmd+M"),
    command("help", "Help", "Auto SVGA 帮助", true)
  ];
}

function command(
  id: string,
  group: ShortTermCommandGroup,
  label: string,
  enabled: boolean,
  shortcut?: string,
  disabledReason?: string
): ShortTermCommandState {
  return {
    id,
    group,
    label,
    enabled,
    ...(shortcut ? { shortcut } : {}),
    ...(!enabled && disabledReason ? { reason: disabledReason } : {})
  };
}

function displayNameForRequest(request: ShortTermLocalOpenRequest): string {
  return shortTermDisplayNameFromPathLike(request.displayName)
    || shortTermDisplayNameFromPathLike(request.localPath)
    || "未命名.svga";
}

function normalizeRecentFiles(records: readonly ShortTermRecentFileRecord[]): ShortTermRecentFileRecord[] {
  return records.slice(0, 10).map((record) => ({
    id: record.id,
    displayName: shortTermDisplayNameFromPathLike(record.displayName) || "未命名.svga",
    lastOpenedAt: record.lastOpenedAt
  }));
}

function titleForLoadFailure(kind: ShortTermLoadFailureKind): string {
  switch (kind) {
    case "read":
      return "文件读取失败";
    case "parse":
      return "SVGA 解析失败";
    case "unsupported":
      return "暂不支持该文件";
    case "missing":
      return "文件不可用";
    case "unknown":
      return "打开失败";
  }
}
