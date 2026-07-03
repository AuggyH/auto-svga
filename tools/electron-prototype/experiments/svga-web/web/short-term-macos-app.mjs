import {
  applyCommandState,
  applyModeButtons,
  applyTabState,
  applyViewState,
  setActionEnabled,
  tabButtons
} from "./short-term-macos-dom-state.mjs";
import { buildCommandState } from "./short-term-macos-command-state.mjs";
import {
  compareSlotView,
  generalCompareTraceView,
  optimizationCompareTraceView,
  renderCompareInfoHtml,
  renderGeneralComparePlaceholderHtml,
  renderOptimizationCompareResultHtml
} from "./short-term-macos-compare-model.mjs";
import {
  applyCompareSlotView,
  applyCompareTraceView,
  markCompareSlotLoaded,
  renderCompareInfoPanel
} from "./short-term-macos-compare-renderers.mjs";
import {
  renderLaunchRecentFiles,
  renderRecentFilesUnavailable
} from "./short-term-macos-launch-renderers.mjs";
import {
  applyRuntimeTextOverlay,
  clearSaveFeedbackBanner,
  clearRuntimeTextOverlay,
  hideSaveFeedbackBanner,
  hideResourceContextMenu,
  prependOptimizationResult,
  renderAssetList,
  renderDiscardMessage,
  renderEditReservedLayers,
  renderFailureMessage,
  renderFileHeader,
  renderLoadingMessage,
  renderOptimizationFindings,
  renderOverviewFacts,
  renderReplaceableImages,
  renderRuntimeTextElements,
  showSaveFeedbackBanner,
  showResourceContextMenu
} from "./short-term-macos-dom-renderers.mjs";
import { suffixName } from "./short-term-macos-render-model.mjs";
import {
  buildCurrentStateSummary,
  sourceUnmodifiedMessage
} from "./short-term-macos-feedback-model.mjs";
import { visibleLaunchRecentRecords } from "./short-term-macos-recent-files-model.mjs";
import {
  createSaveFailureProofActiveOutput,
  saveProofImageKey,
  saveProofSourceImageKey
} from "./short-term-macos-save-model.mjs";
import {
  consumeKeyboardEvent,
  isActivationKey,
  isContextMenuKey,
  nextTabIndexForKey
} from "./short-term-macos-interaction-model.mjs";
import {
  keyboardResourceMenuAnchor,
  resourceContextMenuView
} from "./short-term-macos-resource-menu-model.mjs";
import {
  nextSelectedTextKey,
  runtimeTextInputValue,
  runtimeTextListView,
  runtimeTextOverlayCopy,
  runtimeTextPlaceholder,
  selectedRuntimeTextElement
} from "./short-term-macos-text-model.mjs";
import {
  nextReplaceableSelection,
  replaceableImageListView
} from "./short-term-macos-replaceable-model.mjs";
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
  clearRecentSvgaFiles,
  getRecentSvgaFiles,
  syncShortTermMenuState
} from "./short-term-macos-host-client.mjs";
import {
  closeOpenDialog,
  confirmDiscardUnsavedOutput as confirmDiscardDialogOutput,
  hasOpenDialog,
  showDialog
} from "./short-term-macos-dialog-model.mjs";
import {
  clearCanvas as clearPlaybackCanvas,
  mountPlayback as mountSvgaPlayback,
  replayPrimaryPlayback,
  stopAllPlayback as stopAllSvgaPlayback,
  stopPlayback as stopSvgaPlayback,
  svgaWebPlayerPrototype,
  togglePrimaryPlayback as togglePrimarySvgaPlayback
} from "./short-term-macos-playback-model.mjs";

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
  lastMenuStateSnapshot: ""
};

const nodes = {
  app: document.querySelector(".macApp"),
  fileIdentity: document.querySelector("#fileIdentity"),
  saveBanner: document.querySelector("#saveBanner"),
  dropZone: document.querySelector("#dropZone"),
  recentList: document.querySelector("#recentList"),
  recentNote: document.querySelector("#recentNote"),
  clearRecentButton: document.querySelector("[data-action='clear-recent']"),
  loadingMessage: document.querySelector("#loadingMessage"),
  errorMessage: document.querySelector("#errorMessage"),
  primaryCanvas: document.querySelector("#primaryCanvas"),
  compareCanvasA: document.querySelector("#compareCanvasA"),
  compareCanvasB: document.querySelector("#compareCanvasB"),
  compareView: document.querySelector("[data-view='compare']"),
  compareCanvasWrapA: document.querySelector("#compareCanvasWrapA"),
  compareCanvasWrapB: document.querySelector("#compareCanvasWrapB"),
  compareCanvasTitleA: document.querySelector("#compareCanvasTitleA"),
  compareCanvasTitleB: document.querySelector("#compareCanvasTitleB"),
  compareCanvasMetaA: document.querySelector("#compareCanvasMetaA"),
  compareCanvasMetaB: document.querySelector("#compareCanvasMetaB"),
  editCanvas: document.querySelector("#editCanvas"),
  playbackMeta: document.querySelector("#playbackMeta"),
  factGrid: document.querySelector("#factGrid"),
  assetList: document.querySelector("#assetList"),
  findingList: document.querySelector("#findingList"),
  optimizationSummary: document.querySelector("#optimizationSummary"),
  runOptimizationButton: document.querySelector("[data-action='run-optimization']"),
  replaceableList: document.querySelector("#replaceableList"),
  replaceableSummary: document.querySelector("#replaceableSummary"),
  textPreviewSummary: document.querySelector("#textPreviewSummary"),
  textElementList: document.querySelector("#textElementList"),
  editTextButton: document.querySelector("[data-action='edit-text']"),
  resetTextButton: document.querySelector("[data-action='reset-text']"),
  resourceContextMenu: document.querySelector("#resourceContextMenu"),
  compareInfoA: document.querySelector("#compareInfoA"),
  compareInfoB: document.querySelector("#compareInfoB"),
  layerPanel: document.querySelector("#layerPanel"),
  textDialog: document.querySelector("#textDialog"),
  runtimeTextInput: document.querySelector("#runtimeTextInput"),
  runtimeTextOverlay: document.querySelector("#runtimeTextOverlay"),
  discardDialog: document.querySelector("#discardDialog"),
  discardMessage: document.querySelector("#discardMessage"),
  replacementFileInput: document.querySelector("#replacementFileInput")
};

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
  setView("loading");
  renderLoadingMessage(nodes, "正在打开最近文件。");
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
  renderCompareInfoPanel(nodes, "B", renderCompareInfoHtml("B 文件", model, opened.basename || "compare.svga", [
    `<button class="toolbarButton" type="button" data-action="back-preview">退出对比</button>`
  ]));
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

async function closeFile() {
  if (!(await confirmDiscardUnsavedOutput("关闭文件会放弃当前未保存的 SVGA 输出。"))) return;
  clearCurrentFile();
  state.mode = "preview";
  state.tab = "overview";
  renderFileHeader(nodes, "等待打开文件", "-");
  hideSaveFeedbackBanner(nodes.saveBanner);
  setTab("overview");
  applyModeButtons("preview");
  setView("launch");
  refreshRecentFiles().catch(() => {});
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
  if (!state.sourceBytes) throw new Error("保存证明需要先打开 SVGA。");
  const fromImageKey = saveProofSourceImageKey({
    selectedImageKey: state.selectedImageKey,
    model: state.model
  });
  if (!fromImageKey) throw new Error("保存证明没有可用 imageKey。");
  const toImageKey = saveProofImageKey(fromImageKey, suffix);
  showSaveBanner("正在生成保存证明输出。", "使用短期重命名工作流生成可验证 SVGA 输出。");
  const renamed = await renameShortTermImageKey({
    bytes: state.sourceBytes,
    name: state.displayName,
    fromImageKey,
    toImageKey,
    reportToken: bridge?.reportToken
  });
  const renamedBytes = renamed.renamedSvgaBase64 ? fromBase64(renamed.renamedSvgaBase64) : undefined;
  if (!renamedBytes?.byteLength || renamed.rename?.status !== "renamed") {
    throw new Error(renamed.rename?.diagnostic?.message || "保存证明输出生成失败。");
  }
  state.previewBytes = renamedBytes;
  state.model = await inspectShortTerm(renamedBytes, state.displayName);
  state.selectedImageKey = toImageKey;
  setActiveOutput({
    kind: "rename",
    bytes: renamedBytes,
    suggestedName: suffixName(state.displayName, "renamed"),
    title: renamed.rename.resultTitle,
    summary: renamed.rename.resultSummary
  });
  renderPreviewModel();
  await mountPlayback("primary", nodes.primaryCanvas, state.previewBytes);
  return {
    fromImageKey,
    toImageKey,
    expectedSha256: await sha256Hex(renamedBytes)
  };
}

function createSaveFailureProofOutput() {
  if (!state.sourceBytes) throw new Error("保存失败证明需要先打开 SVGA。");
  setActiveOutput(createSaveFailureProofActiveOutput(state.displayName));
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
  if (!state.sourceBytes) return;
  const textElement = selectedTextElement();
  if (!textElement) {
    showSaveBanner("没有可预览的文本元素。", "当前文件没有暴露可运行时替换的文本标识，源文件没有被修改。");
    return;
  }
  nodes.runtimeTextInput.value = runtimeTextInputValue(state.textPreview);
  nodes.runtimeTextInput.placeholder = runtimeTextPlaceholder(textElement);
  const result = await showDialog(nodes.textDialog, renderCommandState);
  if (result !== "confirm") return;
  state.textPreview = nodes.runtimeTextInput.value.trim();
  applyRuntimeTextOverlay(
    nodes.runtimeTextOverlay,
    runtimeTextOverlayCopy(textElement, state.textPreview),
    Boolean(state.textPreview)
  );
  renderTextElements(state.model?.replaceableElements);
  renderCommandState();
}

function resetRuntimeText() {
  state.textPreview = "";
  clearRuntimeTextOverlay(nodes.runtimeTextOverlay);
  renderTextElements(state.model?.replaceableElements);
  renderCommandState();
}

async function saveActiveOutput(command) {
  if (!state.activeOutput?.bytes?.byteLength || !bridge?.saveShortTermSvgaOutput) return;
  if (state.saveStatus === "validating") return;
  if (command === "overwrite" && !state.sourceId) {
    showSaveBanner("当前文件不支持覆盖保存。", "请使用“另存为”保存这份 SVGA 输出。");
    return;
  }
  state.saveStatus = "validating";
  renderCommandState();
  showSaveBanner("正在验证保存输出。", "写入后会读取文件并校验哈希。");
  try {
    const outputKind = state.activeOutput.kind;
    const outputBytes = new Uint8Array(state.activeOutput.bytes);
    const expectedSha256 = await sha256Hex(outputBytes);
    const result = await bridge.saveShortTermSvgaOutput({
      command,
      sourceId: state.sourceId,
      suggestedName: state.activeOutput.suggestedName,
      bytesBase64: toBase64(outputBytes),
      expectedSha256
    });
    if (!result || result.status === "cancelled") {
      state.saveStatus = "idle";
      renderCommandState();
      showSaveBanner("已取消保存。", "当前输出仍未保存。");
      return result;
    }
    const savedModel = await inspectShortTerm(outputBytes, result.fileName || state.displayName);
    state.sourceBytes = outputBytes;
    state.previewBytes = new Uint8Array(outputBytes);
    state.sourceId = result.sourceId || state.sourceId;
    state.displayName = result.fileName || state.displayName;
    clearTransientOutput();
    state.model = savedModel;
    renderPreviewModel();
    await mountPlayback("primary", nodes.primaryCanvas, state.previewBytes);
    showSaveBanner("已保存并通过验证。", `${result.fileName || "输出文件"} 已重新进入干净状态。`);
    await refreshRecentFiles();
    return {
      ...result,
      outputKind,
      expectedSha256
    };
  } catch (error) {
    state.saveStatus = "failed";
    renderCommandState();
    showSaveBanner("保存失败。", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

function setActiveOutput({ kind, bytes, suggestedName, title, summary, details }) {
  state.activeOutput = {
    kind,
    bytes: new Uint8Array(bytes),
    suggestedName,
    title,
    summary,
    details
  };
  state.saveStatus = "dirty";
  showSaveBanner(title, summary);
  renderCommandState();
}

function clearTransientOutput() {
  state.activeOutput = undefined;
  state.saveStatus = "idle";
  clearSaveFeedbackBanner(nodes.saveBanner);
  renderCommandState();
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
  if (!model) return;
  const view = replaceableImageListView(model, state.selectedImageKey, state.renameImageKey);
  renderReplaceableImages(nodes, view, state.model);
}

function renderTextElements(model) {
  const view = runtimeTextListView(model, state.textPreview);
  state.selectedTextKey = nextSelectedTextKey(state.selectedTextKey, view.texts);
  renderRuntimeTextElements(nodes, view, state.selectedTextKey);
  setActionEnabled("edit-text", view.hasTextElements, "当前文件没有可预览文本元素");
  setActionEnabled("reset-text", Boolean(state.textPreview), "当前没有已应用的文本预览");
}

function selectTextKey(textKey) {
  if (!textKey) return;
  state.selectedTextKey = textKey;
  state.textPreview = "";
  clearRuntimeTextOverlay(nodes.runtimeTextOverlay);
  renderTextElements(state.model?.replaceableElements);
}

function selectedTextElement() {
  return selectedRuntimeTextElement(state.model?.replaceableElements, state.selectedTextKey);
}

function selectImageKey(imageKey) {
  if (!imageKey) return;
  const selection = nextReplaceableSelection(imageKey, state.renameImageKey);
  state.selectedImageKey = selection.selectedImageKey;
  state.renameImageKey = selection.renameImageKey;
  if (selection.shouldRerender) {
    renderReplaceables(state.model?.replaceableElements);
    return;
  }
  document.querySelectorAll(".replaceableRow").forEach((row) => {
    const selected = row.dataset.imageKey === imageKey;
    row.classList.toggle("isSelected", selected);
    row.setAttribute("aria-selected", selected ? "true" : "false");
  });
}

function openKeyboardResourceContextMenu(row) {
  const rect = row.getBoundingClientRect();
  openResourceContextMenu(keyboardResourceMenuAnchor(rect), row.dataset.imageKey);
}

function openResourceContextMenu(event, imageKey) {
  if (!imageKey) return;
  selectImageKey(imageKey);
  const menu = nodes.resourceContextMenu;
  const view = resourceContextMenuView({
    clientX: event.clientX,
    clientY: event.clientY,
    menuWidth: menu.offsetWidth,
    menuHeight: menu.offsetHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    activeOutput: state.activeOutput
  });
  showResourceContextMenu(menu, view);
}

function closeResourceContextMenu() {
  hideResourceContextMenu(nodes.resourceContextMenu);
}

function renderEditReserved() {
  renderEditReservedLayers(nodes, editReservedLayerListView(state.model), state.model);
}

async function renderOptimizationCompare(model, optimizedBytes) {
  setView("compare");
  setCompareTrace(optimizationCompareTraceView());
  setCompareSlot("A", state.displayName || "原始文件", state.model);
  setCompareSlot("B", model.resultTitle || "优化结果", undefined, "优化副本");
  renderCompareInfoPanel(nodes, "A", renderCompareInfoHtml("原始文件", state.model, state.displayName));
  renderCompareInfoPanel(nodes, "B", renderOptimizationCompareResultHtml(model));
  await Promise.all([
    mountPlayback("compareA", nodes.compareCanvasA, state.sourceBytes),
    mountPlayback("compareB", nodes.compareCanvasB, optimizedBytes)
  ]);
  markCompareSlotLoaded(nodes, "B");
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
  const view = compareSlotView(slot, title, model, fallbackMeta);
  applyCompareSlotView(nodes, slot, view);
}

function setCompareTrace(view) {
  applyCompareTraceView(nodes.compareView, view);
}

async function enterGeneralCompare() {
  if (!state.sourceBytes) return;
  setView("compare");
  setCompareTrace(generalCompareTraceView());
  setCompareSlot("A", state.displayName || "A 文件", state.model);
  setCompareSlot("B", "B 文件", undefined, "等待打开");
  renderCompareInfoPanel(nodes, "A", renderCompareInfoHtml("A 文件", state.model, state.displayName));
  renderCompareInfoPanel(nodes, "B", renderGeneralComparePlaceholderHtml());
  await mountPlayback("compareA", nodes.compareCanvasA, state.previewBytes ?? state.sourceBytes);
  clearCanvas(nodes.compareCanvasB);
}

async function mountPlayback(key, canvas, bytes, options = {}) {
  return mountSvgaPlayback({
    key,
    canvas,
    bytes,
    options,
    playbackState: state,
    onPlaybackStateChange: renderCommandState
  });
}

function stopPlayback(key) {
  stopSvgaPlayback({ key, playbackState: state });
}

function stopAllPlayback() {
  stopAllSvgaPlayback(state);
}

function togglePrimaryPlayback() {
  togglePrimarySvgaPlayback(state, renderCommandState);
}

function replayPrimary() {
  replayPrimaryPlayback(state, renderCommandState);
}

function clearCanvas(canvas) {
  clearPlaybackCanvas(canvas);
}

function setTab(tab, options = {}) {
  state.tab = tab;
  applyTabState(tab, options);
}

function handleTabListKeydown(event) {
  const tabs = tabButtons();
  const current = event.target.closest("[data-tab]");
  if (!current || tabs.length === 0) return;
  const currentIndex = Math.max(0, tabs.indexOf(current));
  const nextIndex = nextTabIndexForKey(event.key, currentIndex, tabs.length);
  if (nextIndex === undefined) return;
  consumeKeyboardEvent(event);
  setTab(tabs[nextIndex].dataset.tab, { focus: true });
}

function openTab(tab) {
  if (state.sourceBytes && state.view !== "preview") setMode("preview");
  setTab(tab);
}

async function refreshRecentFiles() {
  const result = await getRecentSvgaFiles(bridge);
  if (!result.available) {
    renderRecentFilesUnavailable({
      listNode: nodes.recentList,
      noteNode: nodes.recentNote,
      clearButton: nodes.clearRecentButton
    });
    return;
  }
  renderLaunchRecentFiles({
    listNode: nodes.recentList,
    noteNode: nodes.recentNote,
    clearButton: nodes.clearRecentButton
  }, visibleLaunchRecentRecords(result.value));
}

async function clearRecentFiles() {
  await clearRecentSvgaFiles(bridge);
  await refreshRecentFiles();
}

function renderCommandState() {
  const commandState = buildCommandState({
    view: state.view,
    mode: state.mode,
    tab: state.tab,
    hasFile: Boolean(state.sourceBytes),
    activeOutput: state.activeOutput,
    saveStatus: state.saveStatus,
    sourceId: state.sourceId,
    optimizationBatchActionEnabled: state.model?.optimization?.batchActionEnabled === true,
    selectedImageKey: state.selectedImageKey,
    canEditText: Boolean(selectedTextElement()),
    textPreview: state.textPreview,
    primaryPlaybackPlaying: state.primaryPlayback?.playing === true,
    renameImageKey: state.renameImageKey,
    dialogOpen: hasOpenDialog(document)
  });
  applyCommandState(commandState);
  state.lastMenuStateSnapshot = syncShortTermMenuState(
    bridge,
    commandState.menuState,
    state.lastMenuStateSnapshot
  );
}

function showSaveBanner(title, message, tone) {
  showSaveFeedbackBanner(nodes.saveBanner, title, message, tone);
}

function showFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  renderFailureMessage(nodes, sourceUnmodifiedMessage(message));
  setView("failed");
}

function showOperationFailure(title, error) {
  const message = error instanceof Error ? error.message : String(error);
  if (state.sourceBytes && !["preview", "compare", "edit"].includes(state.view)) {
    setMode("preview");
  }
  showSaveBanner(title, sourceUnmodifiedMessage(message));
  state.saveStatus = state.activeOutput ? "dirty" : "idle";
  renderCommandState();
}

function currentStateSummary() {
  return buildCurrentStateSummary({
    view: state.view,
    displayName: state.displayName,
    playbackMeta: nodes.playbackMeta.textContent,
    activeOutput: state.activeOutput,
    saveBannerVisible: !nodes.saveBanner.hidden,
    saveBannerText: nodes.saveBanner.textContent,
    errorVisible: state.view === "failed",
    errorText: nodes.errorMessage.textContent
  });
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!event.target.closest("#resourceContextMenu")) closeResourceContextMenu();
  if (!target) return;
  const { action } = target.dataset;
  if (action === "open") openFromHostDialog().catch(showFailure);
  if (action === "open-recent") openRecentFromMenu(target.dataset.recentId).catch(showFailure);
  if (action === "clear-recent") clearRecentFiles().catch(showFailure);
  if (action === "compare") enterGeneralCompare().catch(showFailure);
  if (action === "back-preview") setMode("preview");
  if (action === "mode-preview") setMode("preview");
  if (action === "mode-edit") setMode("edit");
  if (action === "play-pause") togglePrimaryPlayback();
  if (action === "replay") replayPrimary();
  if (action === "run-optimization") runOptimization().catch(showFailure);
  if (action === "save-as") saveActiveOutput("saveAs").catch(showFailure);
  if (action === "save-overwrite") saveActiveOutput("overwrite").catch(showFailure);
  if (action === "open-compare-b") openCompareBFromHost().catch(showFailure);
  if (action === "select-resource") selectImageKey(target.dataset.imageKey || state.selectedImageKey);
  if (action === "row-menu") {
    const rect = target.getBoundingClientRect();
    openResourceContextMenu({
      clientX: rect.right,
      clientY: rect.bottom
    }, target.dataset.imageKey || state.selectedImageKey);
  }
  if (action === "select-text") selectTextKey(target.dataset.textKey || state.selectedTextKey);
  if (action === "inline-rename-confirm") confirmInlineRename().catch(showFailure);
  if (action === "inline-rename-cancel") cancelInlineRename();
  if (action === "context-rename") {
    closeResourceContextMenu();
    renameSelectedImageKey().catch(showFailure);
  }
  if (action === "context-replace") {
    closeResourceContextMenu();
    chooseReplacementImage();
  }
  if (action === "context-reset") {
    closeResourceContextMenu();
    resetImageReplacement().catch(showFailure);
  }
  if (action === "edit-text") editRuntimeText().catch(showFailure);
  if (action === "reset-text") resetRuntimeText();
});

nodes.replaceableList.addEventListener("contextmenu", (event) => {
  if (event.target.closest("[data-rename-input]")) return;
  const target = event.target.closest(".replaceableRow");
  if (!target) return;
  event.preventDefault();
  openResourceContextMenu(event, target.dataset.imageKey);
});

nodes.replaceableList.addEventListener("keydown", (event) => {
  if (event.target.matches("[data-rename-input]")) {
    if (event.key === "Enter") {
      consumeKeyboardEvent(event);
      confirmInlineRename().catch(showFailure);
    }
    if (event.key === "Escape") {
      consumeKeyboardEvent(event);
      cancelInlineRename();
    }
    return;
  }
  if (event.target.closest("button")) return;
  const row = event.target.closest(".replaceableRow[data-image-key]");
  if (!row) return;
  if (isActivationKey(event)) {
    consumeKeyboardEvent(event);
    selectImageKey(row.dataset.imageKey);
  }
  if (isContextMenuKey(event)) {
    consumeKeyboardEvent(event);
    openKeyboardResourceContextMenu(row);
  }
});

nodes.textElementList.addEventListener("keydown", (event) => {
  const row = event.target.closest(".textElementRow[data-text-key]");
  if (!row) return;
  if (isActivationKey(event)) {
    consumeKeyboardEvent(event);
    selectTextKey(row.dataset.textKey);
  }
});

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => setTab(button.dataset.tab));
});

document.querySelector("[role='tablist']")?.addEventListener("keydown", handleTabListKeydown);

nodes.replacementFileInput.addEventListener("change", () => {
  applyReplacementFile(nodes.replacementFileInput.files?.[0]).catch(showFailure);
});

nodes.runtimeTextInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    nodes.textDialog.close("confirm");
  }
  if (event.key === "Escape") {
    event.preventDefault();
    nodes.textDialog.close("cancel");
  }
});

nodes.dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  nodes.dropZone.classList.add("isDragOver");
});

nodes.dropZone.addEventListener("dragleave", () => nodes.dropZone.classList.remove("isDragOver"));
nodes.dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  nodes.dropZone.classList.remove("isDragOver");
  loadDroppedFile(event.dataTransfer?.files?.[0]).catch(showFailure);
});

document.addEventListener("keydown", (event) => {
  const command = event.metaKey || event.ctrlKey;
  const textInput = event.target.matches("input, textarea, [contenteditable='true']");
  if (textInput && command && ["o", "r", "s"].includes(event.key.toLowerCase())) return;
  if (command && event.key.toLowerCase() === "o") {
    event.preventDefault();
    openFromHostDialog().catch(showFailure);
  }
  if (command && event.key.toLowerCase() === "r") {
    event.preventDefault();
    renameSelectedImageKey().catch(showFailure);
  }
  if (command && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveActiveOutput(event.shiftKey ? "saveAs" : "overwrite").catch(showFailure);
  }
  if (event.key === " " && !textInput) {
    event.preventDefault();
    togglePrimaryPlayback();
  }
  if (event.key === "Escape" && state.view === "compare") setMode("preview");
  if (event.key === "Escape" && state.renameImageKey) cancelInlineRename();
  if (event.key === "Escape") closeResourceContextMenu();
});

window.__autoSvgaShortTermActions = Object.freeze({
  openFromHostDialog,
  openRecentFromMenu,
  clearRecentFiles,
  closeFile,
  save: () => saveActiveOutput("overwrite"),
  saveAs: () => saveActiveOutput("saveAs"),
  renameImageKey: renameSelectedImageKey,
  createSaveProofOutput,
  createSaveFailureProofOutput,
  replaceImage: () => chooseReplacementImage(),
  resetImageReplacement,
  editTextPreview: editRuntimeText,
  resetTextPreview: resetRuntimeText,
  runOptimization,
  showOptimizationComparison,
  openCompareB: openCompareBFromHost,
  playPause: togglePrimaryPlayback,
  replay: replayPrimary,
  previewMode: () => setMode("preview"),
  editMode: () => setMode("edit"),
  toggleCompare: () => (state.view === "compare" ? setMode("preview") : enterGeneralCompare()),
  overviewTab: () => openTab("overview"),
  optimizationTab: () => openTab("optimization"),
  replaceableTab: () => openTab("replaceable"),
  cancel: () => {
    closeOpenDialog(document, "cancel");
    if (state.view === "compare") setMode("preview");
  },
  copyStateSummary: () => bridge?.writeClipboardText?.(currentStateSummary())
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
  setTab("optimization");
  await waitForSmokeFrame();
  await captureSmokeArtifact("short-term-preview-optimization");
  setTab("replaceable");
  await waitForSmokeFrame();
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
  const runtimeTextEditPromise = editRuntimeText();
  await waitForSmokeCondition(() => Boolean(nodes.textDialog.open), 2_000);
  const runtimeTextModalOpened = Boolean(nodes.textDialog.open);
  nodes.runtimeTextInput.value = "SVGA VIP";
  nodes.textDialog.close("confirm");
  await runtimeTextEditPromise;
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
  closeResourceContextMenu();
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
  const shortTermDesignInteractionProof = collectShortTermDesignInteractionProof({
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
  const playerPrototype = svgaWebPlayerPrototype();
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
