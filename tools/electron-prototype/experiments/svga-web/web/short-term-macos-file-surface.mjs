import {
  applyModeButtons
} from "./short-term-macos-dom-state.mjs";
import {
  hideShortTermSaveBanner
} from "./short-term-macos-feedback-surface.mjs";
import {
  captureViewTransitionFocus,
  hidePlaybackFailureRecovery,
  moveViewTransitionFocus,
  renderFailureMessage,
  renderFileHeader,
  renderLoadingMessage
} from "./short-term-macos-state-renderers.mjs";
import { clearRuntimeTextOverlay } from "./short-term-macos-text-renderers.mjs";
import { toUint8Array } from "./short-term-macos-byte-model.mjs";

export function renderShortTermRecentOpenLoading({ nodes, setView }) {
  const focusContext = captureViewTransitionFocus(nodes);
  setView("loading");
  renderLoadingMessage(nodes, "");
  moveViewTransitionFocus(focusContext, nodes.loadingFocusTarget);
}

export async function openShortTermSourceFromHostDialog({
  bridge,
  confirmDiscardUnsavedOutput,
  loadOpenedSource,
  refreshRecentFiles,
  showFailure
}) {
  if (!bridge?.openSvgaFile) {
    showFailure(new Error("当前宿主不支持打开文件。"));
    return;
  }
  if (!(await confirmDiscardUnsavedOutput("打开新文件会放弃当前未保存的 SVGA 输出。"))) return;
  const opened = await bridge.openSvgaFile();
  if (!opened || opened.status === "cancelled") return;
  await loadOpenedSource({
    bytes: toUint8Array(opened.bytes),
    displayName: opened.basename || "local.svga",
    sourceId: opened.sourceId || "",
    openedFromHost: true
  });
  await refreshRecentFiles();
}

export async function openShortTermRecentSource({
  bridge,
  nodes,
  state,
  recentFileId,
  confirmDiscardUnsavedOutput,
  setView,
  loadOpenedSource,
  refreshRecentFiles,
  showFailure
}) {
  if (!bridge?.openRecentSvgaFile) return;
  if (!(await confirmDiscardUnsavedOutput("打开最近文件会放弃当前未保存的 SVGA 输出。"))) return;
  renderShortTermRecentOpenLoading({ nodes, setView });
  const opened = await bridge.openRecentSvgaFile(recentFileId);
  if (!opened || opened.status === "cancelled") {
    const focusContext = captureViewTransitionFocus(nodes);
    const returnView = state.sourceBytes ? "preview" : "launch";
    setView(returnView);
    moveViewTransitionFocus(
      focusContext,
      returnView === "preview" ? nodes.previewStagePanel : nodes.launchOpenButton
    );
    return;
  }
  if (opened.status === "missing") {
    await refreshRecentFiles();
    showFailure(new Error(opened.message || "这个最近文件已缺失或不可访问。"));
    return;
  }
  await loadOpenedSource({
    bytes: toUint8Array(opened.bytes),
    displayName: opened.basename || "local.svga",
    sourceId: opened.sourceId || "",
    openedFromHost: true
  });
  await refreshRecentFiles();
}

export async function loadShortTermDroppedFile({
  file,
  confirmDiscardUnsavedOutput,
  loadOpenedSource
}) {
  if (!file) return;
  if (!(await confirmDiscardUnsavedOutput("拖入新文件会放弃当前未保存的 SVGA 输出。"))) return;
  await loadOpenedSource({
    bytes: new Uint8Array(await file.arrayBuffer()),
    displayName: file.name || "dropped.svga",
    sourceId: "",
    openedFromHost: false
  });
}

export async function loadShortTermOpenedSource({
  nodes,
  state,
  bytes,
  displayName,
  sourceId,
  clearTransientOutput,
  setView,
  inspectShortTerm,
  renderPreviewModel,
  mountPrimaryPlayback,
  stopAllPlayback,
  showFailure,
  showPlaybackFailure
}) {
  prepareShortTermSourceLoad({
    nodes,
    state,
    bytes,
    displayName,
    sourceId,
    clearTransientOutput,
    setView
  });
  try {
    const model = await inspectShortTerm(bytes, state.displayName);
    state.model = model;
    state.selectedImageKey = model.replaceableElements.images[0]?.imageKey || "";
    state.selectedTextKey = model.replaceableElements.texts[0]?.textKey || "";
    renderPreviewModel();
    const focusContext = captureViewTransitionFocus(nodes);
    setView("preview");
    moveViewTransitionFocus(focusContext, nodes.previewStagePanel);
  } catch (error) {
    clearShortTermCurrentFile({ state, stopAllPlayback });
    showFailure(error);
    return;
  }
  try {
    await mountPrimaryPlayback(state.previewBytes);
  } catch (error) {
    stopAllPlayback();
    showPlaybackFailure(error);
  }
}

export async function closeShortTermSourceFile({
  nodes,
  state,
  confirmDiscardUnsavedOutput,
  stopAllPlayback,
  setTab,
  setView,
  refreshRecentFiles
}) {
  if (!(await confirmDiscardUnsavedOutput("关闭文件会放弃当前未保存的 SVGA 输出。"))) return;
  resetShortTermLaunchSurface({
    nodes,
    state,
    stopAllPlayback,
    setTab,
    setView,
    refreshRecentFiles
  });
}

export function prepareShortTermSourceLoad({
  nodes,
  state,
  bytes,
  displayName,
  sourceId,
  clearTransientOutput,
  setView
}) {
  if (!bytes?.byteLength) throw new Error("文件为空。");
  clearTransientOutput();
  renderFailureMessage(nodes, "");
  hidePlaybackFailureRecovery(nodes);
  state.sourceBytes = new Uint8Array(bytes);
  state.previewBytes = new Uint8Array(bytes);
  state.sourceId = sourceId || "";
  state.displayName = displayName || "local.svga";
  state.selectedImageKey = "";
  state.selectedTextKey = "";
  state.assetFilter = "all";
  state.renameImageKey = "";
  state.textPreview = "";
  state.textPreviewValues = {};
  state.cleanSaveAsVisible = false;
  clearRuntimeTextOverlay(nodes.runtimeTextOverlay);
  const focusContext = captureViewTransitionFocus(nodes);
  setView("loading");
  renderLoadingMessage(nodes, "");
  moveViewTransitionFocus(focusContext, nodes.loadingFocusTarget);
}

export function clearShortTermCurrentFile({ state, stopAllPlayback }) {
  stopAllPlayback();
  state.sourceBytes = undefined;
  state.previewBytes = undefined;
  state.sourceId = "";
  state.displayName = "";
  state.model = undefined;
  state.compareBSource = undefined;
  state.selectedImageKey = "";
  state.selectedTextKey = "";
  state.assetFilter = "all";
  state.renameImageKey = "";
  state.textPreview = "";
  state.textPreviewValues = {};
  state.activeOutput = undefined;
  state.cleanSaveAsVisible = false;
}

export function resetShortTermLaunchSurface({
  nodes,
  state,
  stopAllPlayback,
  setTab,
  setView,
  refreshRecentFiles
}) {
  clearShortTermCurrentFile({ state, stopAllPlayback });
  state.mode = "preview";
  state.tab = "overview";
  renderFileHeader(nodes, "等待打开文件", "-");
  hideShortTermSaveBanner(nodes);
  setTab("overview");
  applyModeButtons("preview");
  setView("launch");
  refreshRecentFiles?.().catch(() => {});
}

export function showShortTermUnsupportedDropState({
  nodes,
  state,
  stopAllPlayback,
  setView
}) {
  const focusContext = captureViewTransitionFocus(nodes);
  clearShortTermCurrentFile({ state, stopAllPlayback });
  state.mode = "preview";
  state.tab = "overview";
  hideShortTermSaveBanner(nodes);
  setView("unsupported");
  moveViewTransitionFocus(focusContext, nodes.unsupportedRecoveryButton);
}
