import {
  applyModeButtons,
  applyViewState
} from "./short-term-macos-dom-state.mjs";
import {
  renderAssetList,
  renderOverviewFacts
} from "./short-term-macos-overview-renderers.mjs";
import {
  renderDiscardMessage,
  renderFileHeader
} from "./short-term-macos-state-renderers.mjs";
import {
  renderEditReservedLayers
} from "./short-term-macos-edit-reserved-renderers.mjs";
import { overviewTabView } from "./short-term-macos-overview-model.mjs";
import { editReservedLayerListView } from "./short-term-macos-edit-reserved-model.mjs";
import { toUint8Array } from "./short-term-macos-byte-model.mjs";
import {
  inspectShortTermSvga
} from "./short-term-macos-api-client.mjs";
import {
  confirmDiscardUnsavedOutput as confirmDiscardDialogOutput
} from "./short-term-macos-dialog-model.mjs";
import { collectShortTermNodes } from "./short-term-macos-nodes.mjs";
import { bindShortTermInteractionEvents } from "./short-term-macos-event-bindings.mjs";
import { installShortTermActionBridge } from "./short-term-macos-action-bridge.mjs";
import { renderShortTermCommandSurface } from "./short-term-macos-command-surface.mjs";
import {
  clearShortTermRecentFiles,
  refreshShortTermRecentFiles
} from "./short-term-macos-recent-files-surface.mjs";
import {
  shortTermCurrentStateSummary,
  showShortTermFailure,
  showShortTermOperationFailure
} from "./short-term-macos-feedback-surface.mjs";
import {
  clearShortTermPlaybackCanvas,
  mountShortTermPlayback,
  replayShortTermPrimaryPlayback,
  stopAllShortTermPlayback,
  stopShortTermPlayback,
  toggleShortTermPrimaryPlayback
} from "./short-term-macos-playback-surface.mjs";
import {
  renderShortTermCompareInfo,
  renderShortTermCompareSlot,
  renderShortTermGeneralComparePlaceholder,
  renderShortTermGeneralCompareTrace
} from "./short-term-macos-compare-surface.mjs";
import {
  closeShortTermResourceMenu,
  handleShortTermResourceMenuKeydown,
  openShortTermKeyboardResourceMenu,
  openShortTermResourceMenu
} from "./short-term-macos-resource-menu-surface.mjs";
import {
  handleShortTermTabListKeydown,
  openShortTermTab,
  setShortTermTab
} from "./short-term-macos-navigation-surface.mjs";
import {
  applyShortTermReplacementFile,
  beginShortTermImageKeyRename,
  cancelShortTermInlineRename,
  chooseShortTermReplacementImage,
  confirmShortTermInlineRename,
  renderShortTermReplaceableImages,
  renderShortTermRuntimeTextElements,
  resetShortTermImageReplacement,
  selectShortTermImageKey,
  selectShortTermRuntimeTextElement,
  selectedShortTermRuntimeTextElement
} from "./short-term-macos-replaceable-surface.mjs";
import {
  clearShortTermTransientOutput,
  setShortTermActiveOutput,
  showShortTermOutputBanner
} from "./short-term-macos-output-surface.mjs";
import {
  clearShortTermCurrentFile,
  prepareShortTermSourceLoad,
  renderShortTermRecentOpenLoading,
  resetShortTermLaunchSurface
} from "./short-term-macos-file-surface.mjs";
import {
  createShortTermSaveFailureProofOutput,
  createShortTermSaveProofOutput,
  saveShortTermActiveOutput
} from "./short-term-macos-save-surface.mjs";
import {
  editShortTermRuntimeTextPreview,
  resetShortTermRuntimeTextPreview
} from "./short-term-macos-runtime-text-surface.mjs";
import {
  renderShortTermOptimization,
  runShortTermOptimizationWorkflow,
  showShortTermOptimizationComparison
} from "./short-term-macos-optimization-surface.mjs";
import { runShortTermSmokeIfRequested } from "./short-term-macos-smoke-runner.mjs";

const bridge = globalThis.autoSvgaElectronHost;
const state = {
  view: "launch",
  tab: "overview",
  mode: "preview",
  sourceBytes: undefined,
  previewBytes: undefined,
  sourceId: "",
  displayName: "",
  model: undefined,
  selectedImageKey: "",
  selectedTextKey: "",
  renameImageKey: "",
  activeOutput: undefined,
  primaryPlayback: undefined,
  compareAPlayback: undefined,
  compareBPlayback: undefined,
  editPlayback: undefined,
  textPreview: "",
  saveStatus: "idle",
  resourceMenuReturnFocus: undefined,
  lastMenuStateSnapshot: ""
};

const nodes = collectShortTermNodes();

function setView(view) {
  state.view = view;
  applyViewState(nodes.app, view);
  renderCommandState();
}

function setMode(mode) {
  state.mode = mode;
  applyModeButtons(mode);
  if (!state.sourceBytes) {
    setView("launch");
    return;
  }
  if (mode === "edit") {
    setView("edit");
    renderEditReserved();
    mountPlayback("edit", nodes.editCanvas, state.previewBytes ?? state.sourceBytes).catch(showFailure);
    return;
  }
  setView("preview");
  mountPlayback("primary", nodes.primaryCanvas, state.previewBytes ?? state.sourceBytes).catch(showFailure);
}

async function openFromHostDialog() {
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

async function openRecentFromMenu(recentFileId) {
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

async function openCompareBFromHost() {
  if (!bridge?.openSvgaFile) return;
  if (!state.sourceBytes) {
    await openFromHostDialog();
    return;
  }
  if (state.view !== "compare") await enterGeneralCompare();
  const opened = await bridge.openSvgaFile();
  if (!opened || opened.status === "cancelled") return;
  const bytes = toUint8Array(opened.bytes);
  await mountPlayback("compareB", nodes.compareCanvasB, bytes);
  const model = await inspectShortTerm(bytes, opened.basename || "compare.svga");
  setCompareSlot("B", opened.basename || "B 文件", model);
  renderCompareInfo("B", "B 文件", model, opened.basename || "compare.svga", [
    `<button class="toolbarButton" type="button" data-action="back-preview">退出对比</button>`
  ]);
  await refreshRecentFiles();
}

async function loadDroppedFile(file) {
  if (!file) return;
  if (!(await confirmDiscardUnsavedOutput("拖入新文件会放弃当前未保存的 SVGA 输出。"))) return;
  await loadOpenedSource({
    bytes: new Uint8Array(await file.arrayBuffer()),
    displayName: file.name || "dropped.svga",
    sourceId: "",
    openedFromHost: false
  });
}

async function loadOpenedSource({ bytes, displayName, sourceId }) {
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
    renderPreviewModel();
    setView("preview");
    await mountPlayback("primary", nodes.primaryCanvas, state.previewBytes);
  } catch (error) {
    clearCurrentFile();
    showFailure(error);
  }
}

function clearCurrentFile() {
  clearShortTermCurrentFile({ state, stopAllPlayback });
}

async function closeFile() {
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

async function inspectShortTerm(bytes, name) {
  return inspectShortTermSvga({ bytes, name, reportToken: bridge?.reportToken });
}

async function runOptimization() {
  return runShortTermOptimizationWorkflow({
    bridge,
    nodes,
    state,
    confirmDiscardUnsavedOutput,
    setTab,
    setView,
    showSaveBanner,
    setActiveOutput,
    setCompareSlot,
    renderCompareInfo,
    mountPlayback,
    showOperationFailure
  });
}

async function renameSelectedImageKey() {
  return beginShortTermImageKeyRename({
    nodes,
    state,
    confirmDiscardUnsavedOutput,
    setMode,
    setTab
  });
}

async function confirmInlineRename() {
  return confirmShortTermInlineRename({
    bridge,
    nodes,
    state,
    inspectShortTerm,
    setActiveOutput,
    renderPreviewModel,
    mountPrimaryPlayback: (bytes) => mountPlayback("primary", nodes.primaryCanvas, bytes),
    showSaveBanner,
    showOperationFailure
  });
}

async function createSaveProofOutput(suffix) {
  return createShortTermSaveProofOutput({
    state,
    suffix,
    reportToken: bridge?.reportToken,
    inspectShortTerm,
    setActiveOutput,
    renderPreviewModel,
    mountPrimaryPlayback: (bytes) => mountPlayback("primary", nodes.primaryCanvas, bytes),
    showSaveBanner
  });
}

function createSaveFailureProofOutput() {
  createShortTermSaveFailureProofOutput({ state, setActiveOutput });
}

function cancelInlineRename() {
  cancelShortTermInlineRename({ nodes, state });
}

function chooseReplacementImage(imageKey = state.selectedImageKey) {
  chooseShortTermReplacementImage({ nodes, state, imageKey });
}

async function applyReplacementFile(file) {
  return applyShortTermReplacementFile({
    bridge,
    file,
    state,
    confirmDiscardUnsavedOutput,
    inspectShortTerm,
    setActiveOutput,
    renderPreviewModel,
    mountPrimaryPlayback: (bytes) => mountPlayback("primary", nodes.primaryCanvas, bytes),
    showSaveBanner,
    showOperationFailure
  });
}

async function resetImageReplacement() {
  return resetShortTermImageReplacement({
    state,
    inspectShortTerm,
    clearTransientOutput,
    renderPreviewModel,
    mountPrimaryPlayback: (bytes) => mountPlayback("primary", nodes.primaryCanvas, bytes)
  });
}

async function editRuntimeText() {
  await editShortTermRuntimeTextPreview({
    nodes,
    state,
    textElement: selectedTextElement(),
    showSaveBanner,
    renderTextElements,
    renderCommandState
  });
}

function resetRuntimeText() {
  resetShortTermRuntimeTextPreview({
    nodes,
    state,
    renderTextElements,
    renderCommandState
  });
}

async function saveActiveOutput(command) {
  return saveShortTermActiveOutput({
    bridge,
    command,
    state,
    inspectShortTerm,
    clearTransientOutput,
    renderPreviewModel,
    renderCommandState,
    mountPrimaryPlayback: (bytes) => mountPlayback("primary", nodes.primaryCanvas, bytes),
    refreshRecentFiles,
    showSaveBanner
  });
}

function setActiveOutput({ kind, bytes, suggestedName, title, summary, details }) {
  setShortTermActiveOutput({
    nodes,
    state,
    output: { kind, bytes, suggestedName, title, summary, details },
    onOutputStateChange: renderCommandState
  });
}

function clearTransientOutput() {
  clearShortTermTransientOutput({ nodes, state, onOutputStateChange: renderCommandState });
}

async function confirmDiscardUnsavedOutput(message) {
  return confirmDiscardDialogOutput({
    hasActiveOutput: Boolean(state.activeOutput),
    message,
    dialog: nodes.discardDialog,
    renderMessage: (copy) => renderDiscardMessage(nodes, copy),
    onDialogStateChange: renderCommandState
  });
}

function renderPreviewModel() {
  const model = state.model;
  if (!model) return;
  const overviewView = overviewTabView(model);
  renderFileHeader(nodes, state.displayName, overviewView.playbackMeta);
  renderOverviewFacts(nodes, overviewView);
  renderAssetList(nodes, overviewView, model);
  renderOptimization(model.optimization);
  renderReplaceables(model.replaceableElements);
  renderTextElements(model.replaceableElements);
  renderEditReserved();
}

function renderOptimization(model) {
  renderShortTermOptimization({ nodes, model });
}

function renderReplaceables(model) {
  renderShortTermReplaceableImages({ nodes, state, model });
}

function renderTextElements(model) {
  renderShortTermRuntimeTextElements({ nodes, state, model });
}

function selectTextKey(textKey) {
  selectShortTermRuntimeTextElement({ nodes, state, textKey });
}

function selectedTextElement() {
  return selectedShortTermRuntimeTextElement(state);
}

function selectImageKey(imageKey) {
  selectShortTermImageKey({ nodes, state, imageKey });
}

function openKeyboardResourceContextMenu(row) {
  openShortTermKeyboardResourceMenu({ nodes, state, row, selectImageKey });
}

function openResourceContextMenu(event, imageKey, returnFocus = undefined) {
  openShortTermResourceMenu({ nodes, state, event, imageKey, returnFocus, selectImageKey });
}

function closeResourceContextMenu({ restoreFocus = false } = {}) {
  closeShortTermResourceMenu({ nodes, state, restoreFocus });
}

function renderEditReserved() {
  renderEditReservedLayers(nodes, editReservedLayerListView(state.model), state.model);
}

async function showOptimizationComparison() {
  await showShortTermOptimizationComparison({
    nodes,
    state,
    setView,
    setCompareSlot,
    renderCompareInfo,
    mountPlayback
  });
}

function setCompareSlot(slot, title, model, fallbackMeta = "") {
  renderShortTermCompareSlot({ nodes, slot, title, model, fallbackMeta });
}

function setGeneralCompareTrace() {
  renderShortTermGeneralCompareTrace(nodes);
}

function renderCompareInfo(slot, title, model, displayName, actions = []) {
  renderShortTermCompareInfo({ nodes, slot, title, model, displayName, actions });
}

async function enterGeneralCompare() {
  if (!state.sourceBytes) return;
  setView("compare");
  setGeneralCompareTrace();
  setCompareSlot("A", state.displayName || "A 文件", state.model);
  setCompareSlot("B", "B 文件", undefined, "等待打开");
  renderCompareInfo("A", "A 文件", state.model, state.displayName);
  renderShortTermGeneralComparePlaceholder(nodes);
  await mountPlayback("compareA", nodes.compareCanvasA, state.previewBytes ?? state.sourceBytes);
  clearCanvas(nodes.compareCanvasB);
}

async function mountPlayback(key, canvas, bytes, options = {}) {
  return mountShortTermPlayback({
    state,
    key,
    canvas,
    bytes,
    options,
    onPlaybackStateChange: renderCommandState
  });
}

function stopPlayback(key) {
  stopShortTermPlayback({ state, key });
}

function stopAllPlayback() {
  stopAllShortTermPlayback(state);
}

function togglePrimaryPlayback() {
  toggleShortTermPrimaryPlayback({ state, onPlaybackStateChange: renderCommandState });
}

function replayPrimary() {
  replayShortTermPrimaryPlayback({ state, onPlaybackStateChange: renderCommandState });
}

function clearCanvas(canvas) {
  clearShortTermPlaybackCanvas(canvas);
}

function setTab(tab, options = {}) {
  setShortTermTab({ state, tab, options });
}

function handleTabListKeydown(event) {
  handleShortTermTabListKeydown({ event, setTab });
}

function handleResourceContextMenuKeydown(event) {
  handleShortTermResourceMenuKeydown({ nodes, event });
}

function openTab(tab) {
  openShortTermTab({ state, tab, setMode, setTab });
}

async function refreshRecentFiles() {
  await refreshShortTermRecentFiles({ bridge, nodes });
}

async function clearRecentFiles() {
  await clearShortTermRecentFiles({ bridge, nodes });
}

function renderCommandState() {
  state.lastMenuStateSnapshot = renderShortTermCommandSurface({
    bridge,
    state,
    canEditText: Boolean(selectedTextElement())
  });
}

function showSaveBanner(title, message, tone) {
  showShortTermOutputBanner({ nodes, title, message, tone });
}

function showFailure(error) {
  showShortTermFailure({ nodes, setView }, error);
}

function showOperationFailure(title, error) {
  showShortTermOperationFailure({ nodes, state, setMode, renderCommandState }, title, error);
}

function currentStateSummary() {
  return shortTermCurrentStateSummary({ nodes, state });
}

bindShortTermInteractionEvents({
  nodes,
  state,
  handlers: {
    openFromHostDialog,
    openRecentFromMenu,
    clearRecentFiles,
    enterGeneralCompare,
    setMode,
    togglePrimaryPlayback,
    replayPrimary,
    runOptimization,
    saveActiveOutput,
    openCompareBFromHost,
    selectImageKey,
    openResourceContextMenu,
    closeResourceContextMenu,
    selectTextKey,
    confirmInlineRename,
    cancelInlineRename,
    renameSelectedImageKey,
    chooseReplacementImage,
    resetImageReplacement,
    editRuntimeText,
    resetRuntimeText,
    openKeyboardResourceContextMenu,
    setTab,
    handleTabListKeydown,
    handleResourceContextMenuKeydown,
    applyReplacementFile,
    loadDroppedFile,
    showFailure
  }
});

installShortTermActionBridge({
  bridge,
  state,
  handlers: {
    openFromHostDialog,
    openRecentFromMenu,
    clearRecentFiles,
    closeFile,
    saveActiveOutput,
    renameSelectedImageKey,
    createSaveProofOutput,
    createSaveFailureProofOutput,
    chooseReplacementImage,
    resetImageReplacement,
    editRuntimeText,
    resetRuntimeText,
    runOptimization,
    showOptimizationComparison,
    openCompareBFromHost,
    togglePrimaryPlayback,
    replayPrimary,
    setMode,
    enterGeneralCompare,
    openTab,
    currentStateSummary
  }
});

refreshRecentFiles().catch(() => {});
renderCommandState();
runShortTermSmokeIfRequested({
  bridge,
  nodes,
  state,
  setTab,
  loadOpenedSource,
  runOptimization,
  clearTransientOutput,
  editRuntimeText,
  resetRuntimeText,
  selectImageKey,
  applyReplacementFile,
  closeResourceContextMenu,
  resetImageReplacement,
  enterGeneralCompare,
  setMode,
  currentStateSummary,
  createSaveFailureProofOutput,
  loadDroppedFile
}).catch(() => {});
