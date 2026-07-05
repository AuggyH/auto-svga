import {
  applyModeButtons
} from "./short-term-macos-dom-state.mjs";
import {
  hideShortTermSaveBanner
} from "./short-term-macos-feedback-surface.mjs";
import {
  renderFileHeader,
  renderLoadingMessage
} from "./short-term-macos-state-renderers.mjs";
import { clearRuntimeTextOverlay } from "./short-term-macos-text-renderers.mjs";
import { toUint8Array } from "./short-term-macos-byte-model.mjs";

export function renderShortTermRecentOpenLoading({ nodes, setView }) {
  setView("loading");
  renderLoadingMessage(nodes, "正在打开最近文件。");
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
  if (!opened || opened.status === "cancelled") return setView(state.sourceBytes ? "preview" : "launch");
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
  showFailure
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
    setView("preview");
    await mountPrimaryPlayback(state.previewBytes);
  } catch (error) {
    clearShortTermCurrentFile({ state, stopAllPlayback });
    showFailure(error);
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
  state.sourceBytes = new Uint8Array(bytes);
  state.previewBytes = new Uint8Array(bytes);
  state.sourceId = sourceId || "";
  state.displayName = displayName || "local.svga";
  state.selectedImageKey = "";
  state.selectedTextKey = "";
  state.renameImageKey = "";
  state.textPreview = "";
  state.textPreviewValues = {};
  state.cleanSaveAsVisible = false;
  clearRuntimeTextOverlay(nodes.runtimeTextOverlay);
  setView("loading");
  renderLoadingMessage(nodes, "解析文件并准备预览。");
}

export function clearShortTermCurrentFile({ state, stopAllPlayback }) {
  stopAllPlayback();
  state.sourceBytes = undefined;
  state.previewBytes = undefined;
  state.sourceId = "";
  state.displayName = "";
  state.model = undefined;
  state.selectedImageKey = "";
  state.selectedTextKey = "";
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
