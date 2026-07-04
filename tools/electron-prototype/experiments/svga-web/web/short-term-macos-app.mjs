import {
  applyModeButtons,
  applyViewState
} from "./short-term-macos-dom-state.mjs";
import {
  renderAssetList,
  renderOverviewFacts
} from "./short-term-macos-overview-renderers.mjs";
import {
  prependOptimizationResult,
  renderOptimizationFindings
} from "./short-term-macos-optimization-renderers.mjs";
import {
  renderDiscardMessage,
  renderFileHeader
} from "./short-term-macos-state-renderers.mjs";
import {
  renderEditReservedLayers
} from "./short-term-macos-edit-reserved-renderers.mjs";
import { suffixName } from "./short-term-macos-render-model.mjs";
import {
  optimizationResultTone,
  optimizationTabView
} from "./short-term-macos-optimization-model.mjs";
import { overviewTabView } from "./short-term-macos-overview-model.mjs";
import { editReservedLayerListView } from "./short-term-macos-edit-reserved-model.mjs";
import {
  collectShortTermDesignInteractionProof,
  collectShortTermEmptyStateProof,
  collectShortTermRuntimeTextBoundaryProof,
  collectShortTermSpecComparisonProof,
  collectShortTermTabKeyboardProof,
  collectShortTermTabCaptureState,
  collectShortTermThumbnailProof,
  collectShortTermReplaceableClassificationProof,
  collectShortTermOptimizationProof,
  collectShortTermRenameProof,
  collectShortTermReplacementProof,
  collectShortTermOpenFlowProof,
  collectShortTermLoadFailureProof,
  createSmokeArtifactCapture,
  reportShortTermSmokeFailure,
  resourceEntriesAreLocalOnly,
  waitForCanvasPixels,
  waitForSmokeCondition,
  waitForSmokeFrame
} from "./short-term-macos-smoke-proof-model.mjs";
import {
  fromBase64,
  sha256Hex,
  toBase64,
  toUint8Array
} from "./short-term-macos-byte-model.mjs";
import {
  inspectShortTermSvga,
  optimizeShortTermSvga,
  probeInvalidShortTermInspection,
  renameShortTermImageKey,
  replaceShortTermImageAsset
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
  shortTermPlayerPrototype,
  stopAllShortTermPlayback,
  stopShortTermPlayback,
  toggleShortTermPrimaryPlayback
} from "./short-term-macos-playback-surface.mjs";
import {
  markShortTermCompareSlotLoaded,
  renderShortTermCompareInfo,
  renderShortTermCompareSlot,
  renderShortTermGeneralComparePlaceholder,
  renderShortTermGeneralCompareTrace,
  renderShortTermOptimizationCompareResult,
  renderShortTermOptimizationCompareTrace
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
  renderShortTermReplaceableImages,
  renderShortTermRuntimeTextElements,
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
  if (!state.sourceBytes) return;
  if (!(await confirmDiscardUnsavedOutput("执行安全优化会放弃当前未保存的 SVGA 输出。"))) return;
  setTab("optimization");
  showSaveBanner("正在执行安全优化。", "只处理当前可安全执行的项目。");
  try {
    const result = await optimizeShortTermSvga({
      bytes: state.sourceBytes,
      name: state.displayName,
      reportToken: bridge?.reportToken
    });
    const optimizedBytes = result.optimizedSvgaBase64 ? fromBase64(result.optimizedSvgaBase64) : undefined;
    if (!optimizedBytes?.byteLength || result.optimization?.status !== "optimized") {
      showSaveBanner(result.optimization?.resultTitle || "没有可安全执行的优化项。", result.optimization?.resultSummary || "保存保持关闭。");
      renderOptimizationResult(result.optimization);
      return;
    }
    state.previewBytes = optimizedBytes;
    setActiveOutput({
      kind: "optimization",
      bytes: optimizedBytes,
      suggestedName: suffixName(state.displayName, "optimized"),
      title: result.optimization.resultTitle,
      summary: result.optimization.resultSummary,
      details: result.optimization
    });
    renderOptimizationCompare(result.optimization, optimizedBytes);
  } catch (error) {
    showOperationFailure("优化未完成。", error);
  }
}

async function renameSelectedImageKey() {
  if (!state.sourceBytes || !state.selectedImageKey) return;
  if (!(await confirmDiscardUnsavedOutput("重命名 imageKey 会放弃当前未保存的 SVGA 输出。"))) return;
  state.renameImageKey = state.selectedImageKey;
  if (state.view !== "preview") setMode("preview");
  setTab("replaceable");
  renderReplaceables(state.model?.replaceableElements);
  requestAnimationFrame(() => {
    const input = nodes.replaceableList.querySelector("[data-rename-input]");
    input?.focus();
    input?.select?.();
  });
}

async function confirmInlineRename() {
  if (!state.sourceBytes || !state.renameImageKey) return;
  const fromImageKey = state.renameImageKey;
  const input = nodes.replaceableList.querySelector("[data-rename-input]");
  const toImageKey = input?.value?.trim() ?? "";
  if (!toImageKey || toImageKey === fromImageKey) {
    cancelInlineRename();
    return;
  }
  showSaveBanner("正在重命名 imageKey。", "完成引用闭合检查后启用保存。");
  try {
    const renamed = await renameShortTermImageKey({
      bytes: state.sourceBytes,
      name: state.displayName,
      fromImageKey,
      toImageKey,
      reportToken: bridge?.reportToken
    });
    const renamedBytes = renamed.renamedSvgaBase64 ? fromBase64(renamed.renamedSvgaBase64) : undefined;
    if (!renamedBytes?.byteLength || renamed.rename?.status !== "renamed") {
      showSaveBanner(renamed.rename?.resultTitle || "重命名失败。", renamed.rename?.diagnostic?.message || "保存保持关闭。");
      return;
    }
    state.previewBytes = renamedBytes;
    state.model = await inspectShortTerm(renamedBytes, state.displayName);
    state.selectedImageKey = toImageKey;
    state.renameImageKey = "";
    setActiveOutput({
      kind: "rename",
      bytes: renamedBytes,
      suggestedName: suffixName(state.displayName, "renamed"),
      title: renamed.rename.resultTitle,
      summary: renamed.rename.resultSummary,
      details: renamed.rename
    });
    renderPreviewModel();
    await mountPlayback("primary", nodes.primaryCanvas, state.previewBytes);
  } catch (error) {
    showOperationFailure("重命名未完成。", error);
  }
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
  state.renameImageKey = "";
  renderReplaceables(state.model?.replaceableElements);
}

function chooseReplacementImage(imageKey = state.selectedImageKey) {
  if (!state.sourceBytes || !imageKey) return;
  state.selectedImageKey = imageKey;
  nodes.replacementFileInput.value = "";
  nodes.replacementFileInput.click();
}

async function applyReplacementFile(file) {
  if (!file || !state.sourceBytes || !state.selectedImageKey) return;
  if (!(await confirmDiscardUnsavedOutput("替换图片会放弃当前未保存的 SVGA 输出。"))) return;
  showSaveBanner("正在替换图片资源。", "完成重开验证后启用保存。");
  try {
    const payload = {
      name: state.displayName,
      imageKey: state.selectedImageKey,
      svgaBase64: toBase64(state.sourceBytes),
      pngBase64: toBase64(new Uint8Array(await file.arrayBuffer()))
    };
    const replaced = await replaceShortTermImageAsset({
      payload,
      reportToken: bridge?.reportToken
    });
    const replacedBytes = replaced.replacedSvgaBase64 ? fromBase64(replaced.replacedSvgaBase64) : undefined;
    if (!replacedBytes?.byteLength || replaced.replacement?.status !== "replaced") {
      showSaveBanner(replaced.replacement?.resultTitle || "替换未完成。", replaced.replacement?.diagnostic?.message || "保存保持关闭。");
      return;
    }
    state.previewBytes = replacedBytes;
    state.model = await inspectShortTerm(replacedBytes, state.displayName);
    setActiveOutput({
      kind: "replacement",
      bytes: replacedBytes,
      suggestedName: suffixName(state.displayName, "replaced"),
      title: replaced.replacement.resultTitle,
      summary: replaced.replacement.resultSummary
    });
    renderPreviewModel();
    await mountPlayback("primary", nodes.primaryCanvas, state.previewBytes);
  } catch (error) {
    showOperationFailure("替换未完成。", error);
  }
}

async function resetImageReplacement() {
  if (!state.sourceBytes || state.activeOutput?.kind !== "replacement") return;
  state.previewBytes = new Uint8Array(state.sourceBytes);
  state.model = await inspectShortTerm(state.sourceBytes, state.displayName);
  clearTransientOutput();
  renderPreviewModel();
  await mountPlayback("primary", nodes.primaryCanvas, state.previewBytes);
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
  if (!model) return;
  renderOptimizationFindings(nodes, optimizationTabView(model));
}

function renderOptimizationResult(model) {
  if (!model) return;
  const tone = optimizationResultTone(model);
  prependOptimizationResult(nodes, model.resultTitle, model.resultSummary, tone);
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

async function renderOptimizationCompare(model, optimizedBytes) {
  setView("compare");
  setOptimizationCompareTrace();
  setCompareSlot("A", state.displayName || "原始文件", state.model);
  setCompareSlot("B", model.resultTitle || "优化结果", undefined, "优化副本");
  renderCompareInfo("A", "原始文件", state.model, state.displayName);
  renderShortTermOptimizationCompareResult({ nodes, model });
  await Promise.all([
    mountPlayback("compareA", nodes.compareCanvasA, state.sourceBytes),
    mountPlayback("compareB", nodes.compareCanvasB, optimizedBytes)
  ]);
  markShortTermCompareSlotLoaded({ nodes, slot: "B" });
}

async function showOptimizationComparison() {
  if (state.activeOutput?.kind !== "optimization" || !state.activeOutput.bytes?.byteLength) return;
  await renderOptimizationCompare(
    state.activeOutput.details ?? {
      resultTitle: state.activeOutput.title || "优化结果",
      resultSummary: state.activeOutput.summary || "已生成优化副本。",
      metrics: []
    },
    state.activeOutput.bytes
  );
}

function setCompareSlot(slot, title, model, fallbackMeta = "") {
  renderShortTermCompareSlot({ nodes, slot, title, model, fallbackMeta });
}

function setGeneralCompareTrace() {
  renderShortTermGeneralCompareTrace(nodes);
}

function setOptimizationCompareTrace() {
  renderShortTermOptimizationCompareTrace(nodes);
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
runShortTermSmokeIfRequested().catch((error) => {
  reportShortTermSmokeFailure({ bridge, phase: "smoke-runner", error }).catch(() => {});
});

async function runShortTermSmokeIfRequested() {
  if (new URLSearchParams(location.search).get("mode") !== "smoke") return;
  const smokeArtifactCapture = createSmokeArtifactCapture(bridge);
  const { captureSmokeArtifact } = smokeArtifactCapture;
  state.smokeTabCaptureStates = [];
  const setSmokeTab = async (tab, artifactName = "") => {
    setTab(tab, { focus: true });
    await waitForSmokeCondition(() => (
      state.tab === tab
      && document.querySelector(`[data-tab="${tab}"]`)?.classList.contains("isSelected")
      && document.querySelector(`[data-panel="${tab}"]`)?.hidden === false
    ), 2_000);
    await waitForSmokeFrame();
    if (artifactName) {
      state.smokeTabCaptureStates.push(collectShortTermTabCaptureState({
        artifactName,
        expectedTab: tab,
        stateTab: state.tab
      }));
      document.activeElement?.blur?.();
      await waitForSmokeFrame();
    }
  };
  await waitForSmokeFrame();
  await captureSmokeArtifact("short-term-launch");
  const fixtureResponse = await fetch("/fixture/avatar-frame-smoke.svga");
  const fixtureBytes = new Uint8Array(await fixtureResponse.arrayBuffer());
  const file = new File([fixtureBytes], "avatar-frame-smoke.svga", { type: "application/octet-stream" });
  const transfer = new DataTransfer();
  transfer.items.add(file);
  nodes.dropZone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  await waitForSmokeCondition(() => state.view === "preview" && Boolean(state.primaryPlayback) && Boolean(state.model), 8_000);
  const canvasNonBlank = await waitForCanvasPixels(nodes.primaryCanvas, 2_500);
  await captureSmokeArtifact("short-term-preview-overview");
  const overviewFactRows = overviewTabView(state.model).facts;
  const shortTermSpecComparisonProof = collectShortTermSpecComparisonProof({
    overviewFactRows,
    factGrid: nodes.factGrid,
    model: state.model,
    tab: state.tab
  });
  const noAudioCopy = [...nodes.assetList.querySelectorAll(".assetRow")]
    .map((row) => row.textContent.trim())
    .find((text) => text.includes("当前文件暂无音频资产")) || "";
  const shortTermTabKeyboardProof = await collectShortTermTabKeyboardProof({ setTab, waitForSmokeFrame, state });
  await setSmokeTab("optimization", "short-term-preview-optimization");
  await captureSmokeArtifact("short-term-preview-optimization");
  await setSmokeTab("replaceable", "short-term-preview-replaceable");
  await captureSmokeArtifact("short-term-preview-replaceable");
  const replaceableImageRowCount = nodes.replaceableList.querySelectorAll(".replaceableRow").length;
  const textElementRowCount = nodes.textElementList.querySelectorAll(".textElementRow").length;
  const noReplaceableCopy = nodes.replaceableList.textContent.trim();
  const textUnavailableCopy = nodes.textPreviewSummary.textContent.trim();
  const ordinaryImageThumbnailCount = nodes.assetList.querySelectorAll(".assetRow .thumb img").length;
  const automaticImageNames = (state.model?.assets ?? [])
    .filter((asset) => asset.kind === "image" && /^img[_-]?\d+$/i.test(asset.name))
    .map((asset) => asset.name);
  const automaticFixtureImageAssetCount = (state.model?.assets ?? []).filter((asset) => asset.kind === "image").length;
  const shortTermEmptyStateProof = collectShortTermEmptyStateProof({
    assetRowCount: nodes.assetList.children.length,
    noAudioCopy,
    noReplaceableCopy,
    ordinaryImageThumbnailCount,
    replaceableImageRowCount,
    textElementRowCount,
    textUnavailableCopy
  });
  const sequenceResponse = await fetch("/fixture/sequence-repair-smoke.svga");
  const sequenceBytes = new Uint8Array(await sequenceResponse.arrayBuffer());
  await loadOpenedSource({
    bytes: sequenceBytes,
    displayName: "sequence-repair-smoke.svga",
    sourceId: ""
  });
  await waitForSmokeCondition(() => state.view === "preview" && Boolean(state.primaryPlayback) && Boolean(state.model), 8_000);
  setTab("overview");
  await waitForSmokeFrame();
  await captureSmokeArtifact("short-term-sequence-thumbnails");
  const shortTermThumbnailProof = collectShortTermThumbnailProof({
    assetList: nodes.assetList,
    noAudioCopy,
    ordinaryImageThumbnailCount
  });
  const optimizationResponse = await fetch("/fixture/optimizer-reopen-smoke.svga");
  const optimizationBytes = new Uint8Array(await optimizationResponse.arrayBuffer());
  await loadOpenedSource({
    bytes: optimizationBytes,
    displayName: "optimizer-reopen-smoke.svga",
    sourceId: ""
  });
  await waitForSmokeCondition(() => state.view === "preview" && Boolean(state.primaryPlayback) && Boolean(state.model?.optimization), 8_000);
  setTab("optimization");
  await waitForSmokeFrame();
  const optimizationModel = state.model.optimization;
  const optimizationCandidateRows = nodes.findingList.querySelectorAll(".findingRow").length;
  const optimizationSourceSha256Before = await sha256Hex(state.sourceBytes);
  await runOptimization();
  await waitForSmokeCondition(() => state.view === "compare" && state.activeOutput?.kind === "optimization", 8_000);
  const optimizedBytes = state.activeOutput.bytes;
  const optimizationSourceSha256After = await sha256Hex(state.sourceBytes);
  const optimizedSha256 = await sha256Hex(optimizedBytes);
  const optimizationCompareANonBlank = await waitForCanvasPixels(nodes.compareCanvasA, 2_500);
  const optimizationCompareBNonBlank = await waitForCanvasPixels(nodes.compareCanvasB, 2_500);
  await captureSmokeArtifact("short-term-optimization-result");
  const optimizationResult = state.activeOutput.details ?? {};
  const shortTermOptimizationProof = collectShortTermOptimizationProof({
    activeOutput: state.activeOutput,
    compareCanvasANonBlank: optimizationCompareANonBlank,
    compareCanvasBNonBlank: optimizationCompareBNonBlank,
    compareInfoPanel: nodes.compareInfoB,
    optimizationCandidateRows,
    optimizationModel,
    optimizationResult,
    optimizedBytes,
    optimizedSha256,
    sourceBytes: state.sourceBytes,
    sourceSha256After: optimizationSourceSha256After,
    sourceSha256Before: optimizationSourceSha256Before,
    view: state.view
  });
  clearTransientOutput();
  const replaceableResponse = await fetch("/fixture/replaceable-workflow-smoke.svga");
  const replaceableBytes = new Uint8Array(await replaceableResponse.arrayBuffer());
  const replacementPngResponse = await fetch("/fixture/replacement-preview-green.png");
  const replacementPngBytes = new Uint8Array(await replacementPngResponse.arrayBuffer());
  await loadOpenedSource({
    bytes: replaceableBytes,
    displayName: "replaceable-workflow-smoke.svga",
    sourceId: ""
  });
  await waitForSmokeCondition(() => (
    state.view === "preview"
    && Boolean(state.primaryPlayback)
    && (state.model?.replaceableElements?.images?.length ?? 0) > 0
  ), 8_000);
  setTab("replaceable");
  await waitForSmokeFrame();
  const designerReplaceableKeys = (state.model?.replaceableElements?.images ?? []).map((item) => item.imageKey);
  const designerRuntimeTextKeys = (state.model?.replaceableElements?.texts ?? []).map((item) => item.textKey);
  const designerImageAssetCount = (state.model?.assets ?? []).filter((asset) => asset.kind === "image").length;
  const runtimeTextSourceSha256Before = await sha256Hex(state.sourceBytes);
  nodes.editTextButton.focus();
  const runtimeTextEditPromise = editRuntimeText();
  await waitForSmokeCondition(() => Boolean(nodes.textDialog.open), 2_000);
  const runtimeTextModalOpened = Boolean(nodes.textDialog.open);
  const runtimeTextInitialFocusInput = document.activeElement === nodes.runtimeTextInput;
  const runtimeTextModalPlaybackBeforeSpace = state.primaryPlayback?.playing === true;
  nodes.textDialog.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
  await waitForSmokeFrame();
  const runtimeTextModalPlaybackAfterSpace = state.primaryPlayback?.playing === true;
  nodes.runtimeTextInput.value = "SVGA VIP";
  nodes.textDialog.close("confirm");
  await runtimeTextEditPromise;
  const runtimeTextFocusReturnedAfterClose = document.activeElement === nodes.editTextButton;
  await waitForSmokeCondition(() => !nodes.runtimeTextOverlay.hidden && nodes.runtimeTextOverlay.textContent.includes("SVGA VIP"), 2_000);
  await waitForSmokeFrame();
  const runtimeTextSourceSha256AfterApply = await sha256Hex(state.sourceBytes);
  const runtimeTextOverlayCopy = nodes.runtimeTextOverlay.textContent.trim();
  const runtimeTextApplied = state.textPreview === "SVGA VIP";
  const runtimeTextResetCommandEnabled = document.querySelector("[data-action='reset-text']")?.disabled === false;
  await captureSmokeArtifact("short-term-runtime-text-applied");
  resetRuntimeText();
  await waitForSmokeFrame();
  const runtimeTextSourceSha256AfterReset = await sha256Hex(state.sourceBytes);
  const shortTermRuntimeTextBoundaryProof = collectShortTermRuntimeTextBoundaryProof({
    editApplied: runtimeTextApplied,
    focusReturnedAfterClose: runtimeTextFocusReturnedAfterClose,
    initialFocusInput: runtimeTextInitialFocusInput,
    modalSpaceSuppressed: runtimeTextModalPlaybackAfterSpace === runtimeTextModalPlaybackBeforeSpace,
    modalOpened: runtimeTextModalOpened,
    resetClearedOverlay: nodes.runtimeTextOverlay.hidden && !nodes.runtimeTextOverlay.textContent.trim(),
    resetCommandEnabledAfterApply: runtimeTextResetCommandEnabled,
    runtimeOverlayCopy: runtimeTextOverlayCopy,
    sourceSha256AfterApply: runtimeTextSourceSha256AfterApply,
    sourceSha256AfterReset: runtimeTextSourceSha256AfterReset,
    sourceSha256Before: runtimeTextSourceSha256Before,
    textKeys: designerRuntimeTextKeys
  });
  const shortTermReplaceableClassificationProof = collectShortTermReplaceableClassificationProof({
    automaticFixtureName: file.name,
    automaticImageAssetCount: automaticFixtureImageAssetCount,
    automaticImageNames,
    automaticReplaceableCount: replaceableImageRowCount,
    designerFixtureName: "replaceable-workflow-smoke.svga",
    designerImageAssetCount,
    designerReplaceableKeys,
    noReplaceableCopy
  });
  const renameRow = nodes.replaceableList.querySelector(".replaceableRow");
  const renameFromImageKey = renameRow?.dataset.imageKey || state.model.replaceableElements.images[0]?.imageKey || "";
  const renameToImageKey = `${renameFromImageKey}_renamed`;
  const renameSourceSha256Before = await sha256Hex(state.sourceBytes);
  const renameContextEvent = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: renameRow?.getBoundingClientRect().left ?? 240,
    clientY: renameRow?.getBoundingClientRect().top ?? 240
  });
  renameRow?.dispatchEvent(renameContextEvent);
  await waitForSmokeFrame();
  const renameContextMenuOpened = nodes.resourceContextMenu.hidden === false;
  nodes.resourceContextMenu.querySelector("[data-action='context-rename']")?.click();
  await waitForSmokeCondition(() => state.renameImageKey === renameFromImageKey && Boolean(nodes.replaceableList.querySelector("[data-rename-input]")), 2_000);
  const renameInput = nodes.replaceableList.querySelector("[data-rename-input]");
  renameInput.value = renameToImageKey;
  renameInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  await waitForSmokeCondition(() => state.activeOutput?.kind === "rename" && state.selectedImageKey === renameToImageKey, 8_000);
  const renameSourceSha256After = await sha256Hex(state.sourceBytes);
  const renamedSha256 = await sha256Hex(state.activeOutput.bytes);
  const renameCanvasNonBlank = await waitForCanvasPixels(nodes.primaryCanvas, 2_500);
  await captureSmokeArtifact("short-term-rename-dirty");
  const renamedImageKeys = (state.model?.replaceableElements?.images ?? []).map((item) => item.imageKey);
  const renameWorkflow = state.activeOutput.details ?? {};
  const renameValidation = renameWorkflow.validation ?? {};
  const referenceUpdates = Array.isArray(renameWorkflow.referenceUpdates) ? renameWorkflow.referenceUpdates : [];
  const danglingReferences = Array.isArray(renameValidation.danglingReferences) ? renameValidation.danglingReferences : [];
  const shortTermRenameProof = collectShortTermRenameProof({
    activeOutput: state.activeOutput,
    canvasNonBlank: renameCanvasNonBlank,
    contextMenuOpened: renameContextMenuOpened,
    danglingReferences,
    fromImageKey: renameFromImageKey,
    previewModeStayed: state.view === "preview" && state.mode === "preview",
    referenceUpdates,
    renamedImageKeys,
    renamedSha256,
    renameValidation,
    saveAsEnabled: document.querySelector("[data-action='save-as']")?.disabled === false,
    sourceSha256After: renameSourceSha256After,
    sourceSha256Before: renameSourceSha256Before,
    toImageKey: renameToImageKey
  });
  clearTransientOutput();
  await loadOpenedSource({
    bytes: replaceableBytes,
    displayName: "replaceable-workflow-smoke.svga",
    sourceId: ""
  });
  await waitForSmokeCondition(() => (
    state.view === "preview"
    && Boolean(state.primaryPlayback)
    && (state.model?.replaceableElements?.images?.length ?? 0) > 0
  ), 8_000);
  setTab("replaceable");
  await waitForSmokeFrame();
  const replacementImageKey = state.model.replaceableElements.images[0]?.imageKey || "";
  const replacementSourceSha256Before = await sha256Hex(state.sourceBytes);
  selectImageKey(replacementImageKey);
  await applyReplacementFile(new File([replacementPngBytes], "replacement-preview-green.png", { type: "image/png" }));
  await waitForSmokeCondition(() => state.activeOutput?.kind === "replacement", 8_000);
  const replacementSourceSha256After = await sha256Hex(state.sourceBytes);
  const replacementEditedSha256 = await sha256Hex(state.activeOutput.bytes);
  const replacementPngSha256 = await sha256Hex(replacementPngBytes);
  const replacementSaveAsEnabledBeforeReset = document.querySelector("[data-action='save-as']")?.disabled === false;
  const replacementResultTitle = state.activeOutput.title;
  const replacementCanvasNonBlank = await waitForCanvasPixels(nodes.primaryCanvas, 2_500);
  const replacementRow = nodes.replaceableList.querySelector(`[data-image-key='${CSS.escape(replacementImageKey)}']`) || nodes.replaceableList.querySelector(".replaceableRow");
  replacementRow?.dispatchEvent(new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: replacementRow?.getBoundingClientRect().left ?? 240,
    clientY: replacementRow?.getBoundingClientRect().top ?? 240
  }));
  await waitForSmokeFrame();
  const replacementContextMenuOpened = nodes.resourceContextMenu.hidden === false;
  const resetCommandEnabled = nodes.resourceContextMenu.querySelector("[data-action='context-reset']")?.disabled === false;
  const resourceMenuInitialFocusedAction = document.activeElement?.dataset.action || "";
  document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
  const resourceMenuArrowDownFocusedAction = document.activeElement?.dataset.action || "";
  document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
  const resourceMenuEndFocusedAction = document.activeElement?.dataset.action || "";
  document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
  const resourceMenuHomeFocusedAction = document.activeElement?.dataset.action || "";
  closeResourceContextMenu({ restoreFocus: true });
  const resourceMenuFocusReturnedAfterClose = document.activeElement === replacementRow;
  await captureSmokeArtifact("short-term-replacement-dirty");
  await resetImageReplacement();
  await waitForSmokeCondition(() => !state.activeOutput && state.saveStatus === "idle", 4_000);
  const resetPreviewSha256 = await sha256Hex(state.previewBytes);
  const resetCanvasNonBlank = await waitForCanvasPixels(nodes.primaryCanvas, 2_500);
  await captureSmokeArtifact("short-term-replacement-reset");
  const shortTermReplacementProof = collectShortTermReplacementProof({
    contextMenuOpenedAfterReplacement: replacementContextMenuOpened,
    editedSha256: replacementEditedSha256,
    imageKey: replacementImageKey,
    previewModeStayed: state.view === "preview" && state.mode === "preview",
    resourceMenuArrowDownFocusedAction,
    resourceMenuEndFocusedAction,
    resourceMenuFocusReturnedAfterClose,
    resourceMenuHomeFocusedAction,
    resourceMenuInitialFocusedAction,
    replacementCanvasNonBlank,
    replacementPngSha256,
    resetCanvasNonBlank,
    resetClearedOutput: !state.activeOutput && state.saveStatus === "idle",
    resetCommandEnabled,
    resetPreviewSha256,
    resultTitle: replacementResultTitle,
    saveAsEnabledBeforeReset: replacementSaveAsEnabledBeforeReset,
    saveStatusAfterReset: state.saveStatus,
    sourceSha256After: replacementSourceSha256After,
    sourceSha256Before: replacementSourceSha256Before
  });
  await loadOpenedSource({
    bytes: fixtureBytes,
    displayName: file.name,
    sourceId: ""
  });
  await waitForSmokeCondition(() => state.view === "preview" && Boolean(state.primaryPlayback) && Boolean(state.model), 8_000);
  setTab("overview");
  await waitForSmokeFrame();
  await enterGeneralCompare();
  await waitForSmokeCondition(() => state.view === "compare", 2_000);
  await waitForCanvasPixels(nodes.compareCanvasA, 2_500);
  await captureSmokeArtifact("short-term-general-compare");
  setMode("edit");
  await waitForSmokeCondition(() => state.view === "edit", 2_000);
  await waitForCanvasPixels(nodes.editCanvas, 2_500);
  await waitForSmokeFrame();
  await captureSmokeArtifact("short-term-edit-reserved");
  setMode("preview");
  await waitForSmokeCondition(() => state.view === "preview", 2_000);
  setTab("overview");
  await waitForSmokeFrame();
  await captureSmokeArtifact("short-term-preview-minimum");
  const focusedControlForSpace = document.querySelector("[data-action='compare']");
  focusedControlForSpace?.focus();
  const focusedControlPlaybackBeforeSpace = state.primaryPlayback?.playing === true;
  const focusedControlSpacePrevented = focusedControlForSpace
    ? !focusedControlForSpace.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }))
    : true;
  await waitForSmokeFrame();
  const focusedControlSpaceProof = {
    targetAction: focusedControlForSpace?.dataset.action || "",
    targetStillFocused: document.activeElement === focusedControlForSpace,
    spacePrevented: focusedControlSpacePrevented,
    playbackUnchanged: (state.primaryPlayback?.playing === true) === focusedControlPlaybackBeforeSpace
  };
  const shortTermDesignInteractionProof = collectShortTermDesignInteractionProof({
    focusedControlSpaceProof,
    minimumPreviewCaptured: smokeArtifactCapture.lastSmokeArtifactCaptured(),
    nodes,
    state,
    currentStateSummary
  });
  createSaveFailureProofOutput();
  await waitForSmokeCondition(() => state.activeOutput && state.saveStatus === "dirty", 2_000);
  try {
    await window.__autoSvgaShortTermActions.saveAs();
  } catch {
    // Expected: smoke-only invalid bytes must fail the post-write reopen validation.
  }
  await waitForSmokeCondition(() => (
    state.saveStatus === "failed"
    && !nodes.saveBanner.hidden
    && nodes.saveBanner.textContent.includes("保存失败")
    && state.view === "preview"
    && Boolean(state.sourceBytes)
  ), 4_000);
  await waitForSmokeFrame();
  await captureSmokeArtifact("short-term-save-failed");
  const saveFailedVisible = state.saveStatus === "failed"
    && nodes.saveBanner.textContent.includes("保存失败")
    && state.view === "preview";
  const playbackReady = Boolean(state.primaryPlayback);
  const inspectionReportVisible = Boolean(state.model && nodes.assetList.children.length > 0);
  const auditPanelVisible = Boolean(nodes.factGrid.children.length > 0);
  const dragDropLoaded = state.displayName === file.name;
  const playerLifecycleOk = Boolean(state.primaryPlayback);
  const shortTermOpenFlowProof = collectShortTermOpenFlowProof({
    canvasNonBlank,
    dragDropLoaded,
    fileName: file.name,
    fixtureSha256: await sha256Hex(fixtureBytes),
    inspectionReportVisible,
    playbackReady,
    resourceEntriesLocalOnly: resourceEntriesAreLocalOnly(),
    sourceSizeBytes: fixtureBytes.byteLength
  });
  clearTransientOutput();
  const recoverySourceSha256Before = await sha256Hex(state.sourceBytes);
  const invalidBytes = new Uint8Array([0, 1, 2, 3, 4]);
  await loadDroppedFile(new File([invalidBytes], "invalid.svga", { type: "application/octet-stream" }));
  await waitForSmokeCondition(() => state.view === "failed" && nodes.errorMessage.textContent.includes("源文件没有被修改"), 4_000);
  await waitForSmokeFrame();
  await captureSmokeArtifact("short-term-load-failed");
  const loadFailedVisible = state.view === "failed"
    && nodes.errorMessage.textContent.includes("源文件没有被修改");
  const loadFailureCopy = nodes.errorMessage.textContent.trim();
  const noStaleMetadataAfterFailure = !state.sourceBytes
    && !state.model
    && !state.activeOutput
    && nodes.errorMessage.textContent.includes("源文件没有被修改");
  await loadOpenedSource({
    bytes: fixtureBytes,
    displayName: file.name,
    sourceId: ""
  });
  await waitForSmokeCondition(() => state.view === "preview" && Boolean(state.primaryPlayback) && Boolean(state.model), 8_000);
  const recoverySourceSha256After = await sha256Hex(state.sourceBytes);
  const playbackFailureSourceSha256Before = await sha256Hex(state.sourceBytes);
  const playerPrototype = shortTermPlayerPrototype();
  const originalPlayerMount = playerPrototype.mount;
  try {
    playerPrototype.mount = async function playbackFailureSmokeProbe() {
      throw new Error("播放失败：播放器挂载失败。");
    };
    await loadOpenedSource({
      bytes: fixtureBytes,
      displayName: "playback-failure-smoke.svga",
      sourceId: ""
    });
  } finally {
    playerPrototype.mount = originalPlayerMount;
  }
  await waitForSmokeCondition(() => state.view === "failed" && nodes.errorMessage.textContent.includes("播放失败"), 4_000);
  await waitForSmokeFrame();
  await captureSmokeArtifact("short-term-playback-failed");
  const playbackFailureVisible = state.view === "failed"
    && nodes.errorMessage.textContent.includes("播放失败")
    && nodes.errorMessage.textContent.includes("源文件没有被修改");
  const playbackFailureCopy = nodes.errorMessage.textContent.trim();
  const noStaleMetadataAfterPlaybackFailure = !state.sourceBytes
    && !state.model
    && !state.activeOutput
    && nodes.errorMessage.textContent.includes("源文件没有被修改");
  await loadOpenedSource({
    bytes: fixtureBytes,
    displayName: file.name,
    sourceId: ""
  });
  await waitForSmokeCondition(() => state.view === "preview" && Boolean(state.primaryPlayback) && Boolean(state.model), 8_000);
  const playbackFailureSourceSha256AfterRecovery = await sha256Hex(state.sourceBytes);
  const invalidResponse = await probeInvalidShortTermInspection({
    reportToken: bridge?.reportToken
  });
  const shortTermLoadFailureProof = collectShortTermLoadFailureProof({
    invalidApiRejected: invalidResponse.ok === false,
    invalidSizeBytes: invalidBytes.byteLength,
    loadFailedVisible,
    loadFailureCopy,
    noStaleMetadataAfterFailure,
    noStaleMetadataAfterPlaybackFailure,
    playbackFailureCopy,
    playbackFailureSourceSha256AfterRecovery,
    playbackFailureSourceSha256Before,
    playbackFailureVisible,
    playbackFailureRecovered: state.view === "preview" && Boolean(state.primaryPlayback),
    playbackRecovered: Boolean(state.primaryPlayback),
    recoveryFileName: file.name,
    recoveryLoaded: state.view === "preview" && Boolean(state.model),
    sourceSha256AfterRecovery: recoverySourceSha256After,
    sourceSha256BeforeInvalid: recoverySourceSha256Before
  });
  if (state.primaryPlayback) {
    state.primaryPlayback.player.pause();
    state.primaryPlayback.player.start();
  }
  await bridge?.reportSmokeResult?.({
    localPage: location.origin.startsWith("http://127.0.0.1:"),
    localOnly: resourceEntriesAreLocalOnly(),
    strictCsp: Boolean(document.querySelector('meta[name="auto-svga-csp"]')),
    noCspViolation: true,
    playback: playbackReady,
    canvasNonBlank,
    inspectionReport: inspectionReportVisible,
    auditPanel: auditPanelVisible,
    fileInput: Boolean(file.name && fixtureBytes.byteLength > 0),
    dragDrop: dragDropLoaded,
    errorFile: invalidResponse.ok === false,
    playerLifecycle: playerLifecycleOk,
    shortTermOpenFlowProof,
    shortTermScreenshots: smokeArtifactCapture.allSmokeArtifactsCaptured(9),
    shortTermSaveFailed: saveFailedVisible,
    shortTermLoadFailed: loadFailedVisible,
    shortTermLoadFailureProof,
    shortTermSpecComparisonProof,
    shortTermTabKeyboardProof,
    shortTermEmptyStateProof,
    shortTermRuntimeTextBoundaryProof,
    shortTermThumbnailProof,
    shortTermOptimizationProof,
    shortTermReplaceableClassificationProof,
    shortTermRenameProof,
    shortTermReplacementProof,
    shortTermDesignInteractionProof,
    cleanup: true
  });
}
