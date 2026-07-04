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

export function renderShortTermRecentOpenLoading({ nodes, setView }) {
  setView("loading");
  renderLoadingMessage(nodes, "正在打开最近文件。");
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
  state.renameImageKey = "";
  state.textPreview = "";
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
  state.activeOutput = undefined;
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
