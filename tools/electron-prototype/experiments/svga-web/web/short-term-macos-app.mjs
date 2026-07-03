import { FILL_MODE, Parser as SvgaWebParser, Player as SvgaWebPlayer } from "/vendor/svga-web-2.4.4.js";
import {
  applyModeButtons,
  applyTabState,
  applyViewState,
  setActionEnabled,
  tabButtons
} from "./short-term-macos-dom-state.mjs";
import { buildCommandState } from "./short-term-macos-command-state.mjs";
import {
  createAssetRow,
  createEditLayerRow,
  createOptimizationFindingRow,
  createOverviewFactCell,
  createReplaceableImageRow,
  createTextElementRow
} from "./short-term-macos-dom-renderers.mjs";
import {
  escapeHtml,
  groupOptimizationItems,
  overviewVisibleFacts,
  renderCompareFactCellHtml,
  renderCompareMetricCellHtml,
  renderMessageRowHtml,
  suffixName
} from "./short-term-macos-render-model.mjs";

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
  nodes.loadingMessage.textContent = "正在打开最近文件。";
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
  nodes.compareInfoB.innerHTML = renderCompareInfo("B 文件", model, opened.basename || "compare.svga", [
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
  if (!bytes?.byteLength) throw new Error("文件为空。");
  clearTransientOutput();
  state.sourceBytes = new Uint8Array(bytes);
  state.previewBytes = new Uint8Array(bytes);
  state.sourceId = sourceId || "";
  state.displayName = displayName || "local.svga";
  state.selectedImageKey = "";
  state.renameImageKey = "";
  state.textPreview = "";
  nodes.runtimeTextOverlay.hidden = true;
  setView("loading");
  nodes.loadingMessage.textContent = "解析文件并准备预览。";
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
  nodes.fileIdentity.textContent = "等待打开文件";
  nodes.playbackMeta.textContent = "-";
  nodes.saveBanner.hidden = true;
  setTab("overview");
  applyModeButtons("preview");
  setView("launch");
  refreshRecentFiles().catch(() => {});
}

async function inspectShortTerm(bytes, name) {
  return postBytes(`/api/short-term-product-inspection-model?name=${encodeURIComponent(name)}`, bytes);
}

async function runOptimization() {
  if (!state.sourceBytes) return;
  if (!(await confirmDiscardUnsavedOutput("执行安全优化会放弃当前未保存的 SVGA 输出。"))) return;
  setTab("optimization");
  showSaveBanner("正在执行安全优化。", "只处理当前可安全执行的项目。");
  try {
    const result = await postBytes(
      `/api/short-term-product-optimization-workflow?name=${encodeURIComponent(state.displayName)}`,
      state.sourceBytes
    );
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
    const renamed = await postBytes(
      `/api/short-term-product-image-key-rename?name=${encodeURIComponent(state.displayName)}&from=${encodeURIComponent(fromImageKey)}&to=${encodeURIComponent(toImageKey)}`,
      state.sourceBytes
    );
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

function saveProofImageKey(fromImageKey, suffix) {
  const clean = String(fromImageKey || "image_key")
    .replace(/[\u0000-\u001F\u007F/\\]/gu, "_")
    .replace(/[^A-Za-z0-9_.-]/g, "_")
    .slice(0, 64) || "image_key";
  return `${clean}_${suffix}`;
}

async function createSaveProofOutput(suffix) {
  if (!state.sourceBytes) throw new Error("保存证明需要先打开 SVGA。");
  const fromImageKey = state.selectedImageKey
    || state.model?.replaceableElements?.images?.[0]?.imageKey
    || state.model?.assets?.find((asset) => asset.kind === "image")?.name
    || "";
  if (!fromImageKey) throw new Error("保存证明没有可用 imageKey。");
  const toImageKey = saveProofImageKey(fromImageKey, suffix);
  showSaveBanner("正在生成保存证明输出。", "使用短期重命名工作流生成可验证 SVGA 输出。");
  const renamed = await postBytes(
    `/api/short-term-product-image-key-rename?name=${encodeURIComponent(state.displayName)}&from=${encodeURIComponent(fromImageKey)}&to=${encodeURIComponent(toImageKey)}`,
    state.sourceBytes
  );
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
  setActiveOutput({
    kind: "rename",
    bytes: new Uint8Array([0, 1, 2, 3, 4]),
    suggestedName: suffixName(state.displayName || "save-failure", "invalid"),
    title: "保存失败验证输出",
    summary: "保存后重开验证应失败，当前源文件保持不变。"
  });
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
    const replaced = await postJson("/api/short-term-product-image-replacement-workflow", payload);
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
  nodes.runtimeTextInput.value = state.textPreview || "SVGA VIP";
  nodes.runtimeTextInput.placeholder = textElement.initialText || textElement.displayName || textElement.textKey;
  const result = await showDialog(nodes.textDialog);
  if (result !== "confirm") return;
  state.textPreview = nodes.runtimeTextInput.value.trim();
  nodes.runtimeTextOverlay.textContent = `${textElement.displayName || textElement.textKey}: ${state.textPreview}`;
  nodes.runtimeTextOverlay.hidden = !state.textPreview;
  renderTextElements(state.model?.replaceableElements);
  renderCommandState();
}

function resetRuntimeText() {
  state.textPreview = "";
  nodes.runtimeTextOverlay.hidden = true;
  nodes.runtimeTextOverlay.textContent = "";
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
  nodes.saveBanner.hidden = true;
  nodes.saveBanner.removeAttribute("data-status");
  renderCommandState();
}

async function confirmDiscardUnsavedOutput(message) {
  if (!state.activeOutput) return true;
  nodes.discardMessage.textContent = message;
  return (await showDialog(nodes.discardDialog)) === "confirm";
}

function renderPreviewModel() {
  const model = state.model;
  if (!model) return;
  nodes.fileIdentity.textContent = state.displayName;
  renderFacts(model);
  renderAssets(model);
  renderOptimization(model.optimization);
  renderReplaceables(model.replaceableElements);
  renderTextElements(model.replaceableElements);
  renderEditReserved();
  nodes.playbackMeta.textContent = model.overview.facts
    .filter((fact) => ["canvas", "fps", "duration"].includes(fact.id))
    .map((fact) => fact.value)
    .join(" / ");
}

function renderFacts(model) {
  nodes.factGrid.replaceChildren(...overviewVisibleFacts(model).map(createOverviewFactCell));
}

function renderAssets(model) {
  const rows = model.assets.map((asset) => createAssetRow(asset, model));
  nodes.assetList.replaceChildren(...rows);
}

function renderOptimization(model) {
  if (!model) return;
  nodes.optimizationSummary.textContent = `${model.safeExecutableCount} 项可安全执行，${model.reviewOnlyCount} 项需复核，${model.unsupportedCount} 项暂不支持。`;
  const runButton = document.querySelector("[data-action='run-optimization']");
  runButton.textContent = "一键优化";
  runButton.title = model.batchActionEnabled
    ? "批量执行当前可安全执行的优化项"
    : "没有可安全执行的优化项";
  runButton.disabled = !model.batchActionEnabled;
  const groupedItems = groupOptimizationItems(model.items);
  if (groupedItems.length === 0) {
    const empty = document.createElement("p");
    empty.className = "emptyText";
    empty.dataset.component = "InlineStatus";
    empty.textContent = "没有可一键优化的安全项。若总览存在超标，请按规格复核或等待后续支持。";
    nodes.findingList.replaceChildren(empty);
    return;
  }
  nodes.findingList.replaceChildren(...groupedItems.map(createOptimizationFindingRow));
}

function renderOptimizationResult(model) {
  if (!model) return;
  const tone = model.status === "optimized"
    ? "success"
    : model.status === "failed" ? "danger" : "warning";
  nodes.findingList.prepend(messageRow(model.resultTitle, model.resultSummary, tone));
}

function renderReplaceables(model) {
  if (!model) return;
  const rows = model.images.map((item, index) => {
    const selected = item.imageKey === state.selectedImageKey;
    const renaming = item.imageKey === state.renameImageKey;
    return createReplaceableImageRow(item, index, { model: state.model, selected, renaming });
  });
  if (rows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "emptyText";
    empty.dataset.component = "InlineStatus";
    empty.textContent = model.emptyCopy || "没有可替换元素。";
    nodes.replaceableList.replaceChildren(empty);
  } else {
    nodes.replaceableList.replaceChildren(...rows);
  }
  nodes.replaceableSummary.textContent = rows.length
    ? `${rows.length} 个设计师命名图片元素。`
    : "普通自动命名图片不会出现在这里。";
}

function renderTextElements(model) {
  const texts = Array.isArray(model?.texts) ? model.texts : [];
  if (!state.selectedTextKey || !texts.some((item) => item.textKey === state.selectedTextKey)) {
    state.selectedTextKey = texts[0]?.textKey || "";
  }
  if (texts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "emptyText";
    empty.dataset.component = "InlineStatus";
    empty.textContent = model?.textPreviewCopy || "当前文件没有可运行时预览的文本元素。";
    nodes.textElementList.replaceChildren(empty);
    nodes.textPreviewSummary.textContent = "未发现可运行时替换的 textKey。";
    nodes.editTextButton.hidden = true;
    nodes.resetTextButton.hidden = true;
  } else {
    nodes.editTextButton.hidden = false;
    nodes.resetTextButton.hidden = false;
    nodes.textElementList.replaceChildren(...texts.map((item, index) => createTextElementRow(item, index, {
      selected: item.textKey === state.selectedTextKey
    })));
    nodes.textPreviewSummary.textContent = state.textPreview
      ? "文本预览已应用，源 SVGA 字节未修改。"
      : `${texts.length} 个文本元素可运行时预览。`;
  }
  setActionEnabled("edit-text", texts.length > 0, "当前文件没有可预览文本元素");
  setActionEnabled("reset-text", Boolean(state.textPreview), "当前没有已应用的文本预览");
}

function selectTextKey(textKey) {
  if (!textKey) return;
  state.selectedTextKey = textKey;
  state.textPreview = "";
  nodes.runtimeTextOverlay.hidden = true;
  nodes.runtimeTextOverlay.textContent = "";
  renderTextElements(state.model?.replaceableElements);
}

function selectedTextElement() {
  const texts = Array.isArray(state.model?.replaceableElements?.texts)
    ? state.model.replaceableElements.texts
    : [];
  return texts.find((item) => item.textKey === state.selectedTextKey);
}

function selectImageKey(imageKey) {
  if (!imageKey) return;
  const shouldCancelRename = state.renameImageKey && state.renameImageKey !== imageKey;
  state.selectedImageKey = imageKey;
  if (shouldCancelRename) {
    state.renameImageKey = "";
    renderReplaceables(state.model?.replaceableElements);
    return;
  }
  document.querySelectorAll(".replaceableRow").forEach((row) => {
    const selected = row.dataset.imageKey === imageKey;
    row.classList.toggle("isSelected", selected);
    row.setAttribute("aria-selected", selected ? "true" : "false");
  });
}

function consumeKeyboardEvent(event) {
  event.preventDefault();
  event.stopPropagation();
}

function isActivationKey(event) {
  return event.key === "Enter" || event.key === " " || event.key === "Spacebar";
}

function isContextMenuKey(event) {
  return event.key === "ContextMenu" || (event.shiftKey && event.key === "F10");
}

function openKeyboardResourceContextMenu(row) {
  const rect = row.getBoundingClientRect();
  openResourceContextMenu({
    clientX: rect.right - 4,
    clientY: rect.top + Math.min(rect.height - 4, 28)
  }, row.dataset.imageKey);
}

function openResourceContextMenu(event, imageKey) {
  if (!imageKey) return;
  selectImageKey(imageKey);
  const menu = nodes.resourceContextMenu;
  menu.hidden = false;
  menu.style.left = `${Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8)}px`;
  menu.style.top = `${Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8)}px`;
  menu.querySelector("[data-action='context-reset']").disabled = state.activeOutput?.kind !== "replacement";
  menu.querySelector("button:not(:disabled)")?.focus();
}

function closeResourceContextMenu() {
  nodes.resourceContextMenu.hidden = true;
}

function renderEditReserved() {
  const assets = state.model?.assets ?? [];
  nodes.layerPanel.replaceChildren(...assets
    .filter((asset) => asset.kind !== "audio")
    .slice(0, 32)
    .map((asset) => createEditLayerRow(asset, state.model)));
}

async function renderOptimizationCompare(model, optimizedBytes) {
  setView("compare");
  setCompareTrace("OptimizationCompareModule", "Optimization compare");
  setCompareSlot("A", state.displayName || "原始文件", state.model);
  setCompareSlot("B", model.resultTitle || "优化结果", undefined, "优化副本");
  const actionRows = (model.actions ?? []).map((action) => `
    <li>
      <strong>${escapeHtml(action.title)}</strong>
      <span>${escapeHtml(action.summary)}</span>
    </li>
  `).join("");
  const skippedRows = (model.methods ?? [])
    .filter((method) => method.disposition !== "executed")
    .map((method) => `<li><strong>${escapeHtml(method.label)}</strong><span>${escapeHtml(method.reason)}</span></li>`)
    .join("");
  nodes.compareInfoA.innerHTML = renderCompareInfo("原始文件", state.model, state.displayName);
  nodes.compareInfoB.innerHTML = `
    <section class="compareSummary" data-status="success">
      <h2>${escapeHtml(model.resultTitle)}</h2>
      <p>${escapeHtml(model.resultSummary)}</p>
    </section>
    ${(model.metrics ?? []).length ? `<section class="compareMetricGrid" aria-label="优化指标">${(model.metrics ?? []).map(renderCompareMetricCellHtml).join("")}</section>` : ""}
    ${actionRows ? `<section class="resultGroup" data-status="success"><h3>已执行</h3><ul data-optimization-actions>${actionRows}</ul></section>` : ""}
    ${skippedRows ? `<section class="resultGroup muted" data-status="warning"><h3>未执行</h3><ul data-optimization-skipped>${skippedRows}</ul></section>` : ""}
    <div class="compareActions">
      <button class="toolbarButton primary" type="button" data-action="save-as">另存为</button>
      <button class="toolbarButton" type="button" data-action="back-preview">返回预览</button>
    </div>
  `;
  await Promise.all([
    mountPlayback("compareA", nodes.compareCanvasA, state.sourceBytes),
    mountPlayback("compareB", nodes.compareCanvasB, optimizedBytes)
  ]);
  if (nodes.compareCanvasWrapB) nodes.compareCanvasWrapB.dataset.compareState = "loaded";
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

function renderCompareInfo(title, model, displayName, actions = []) {
  const actionHtml = actions.length ? `<div class="compareActions">${actions.join("")}</div>` : "";
  if (!model) {
    return `<section class="compareSummary" data-status="warning"><h2>${escapeHtml(title)}</h2><p>未打开文件。</p></section>${actionHtml}`;
  }
  const facts = overviewVisibleFacts(model).map(renderCompareFactCellHtml).join("");
  return `<section class="compareSummary"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(displayName)}</p></section><section class="compareMetricGrid" aria-label="${escapeHtml(title)} 信息">${facts}</section>${actionHtml}`;
}

function compareSlotMeta(model, fallback = "") {
  const facts = overviewVisibleFacts(model);
  const canvas = facts.find((fact) => fact.id === "canvas")?.value;
  const fps = facts.find((fact) => fact.id === "fps")?.value;
  return [canvas, fps ? `${fps} FPS` : ""].filter(Boolean).join(" / ") || fallback;
}

function setCompareSlot(slot, title, model, fallbackMeta = "") {
  const titleNode = slot === "A" ? nodes.compareCanvasTitleA : nodes.compareCanvasTitleB;
  const metaNode = slot === "A" ? nodes.compareCanvasMetaA : nodes.compareCanvasMetaB;
  const wrapNode = slot === "A" ? nodes.compareCanvasWrapA : nodes.compareCanvasWrapB;
  if (titleNode) titleNode.textContent = title || `${slot} 文件`;
  if (metaNode) metaNode.textContent = compareSlotMeta(model, fallbackMeta);
  if (wrapNode) wrapNode.dataset.compareState = model ? "loaded" : "empty";
}

function setCompareTrace(moduleName, pageState) {
  const compareView = document.querySelector("[data-view='compare']");
  if (!compareView) return;
  compareView.dataset.module = moduleName;
  compareView.dataset.pageState = pageState;
}

async function enterGeneralCompare() {
  if (!state.sourceBytes) return;
  setView("compare");
  setCompareTrace("GeneralCompareModule", "General comparing");
  setCompareSlot("A", state.displayName || "A 文件", state.model);
  setCompareSlot("B", "B 文件", undefined, "等待打开");
  nodes.compareInfoA.innerHTML = renderCompareInfo("A 文件", state.model, state.displayName);
  nodes.compareInfoB.innerHTML = `
    <section class="compareSummary" data-status="info">
      <h2>B 文件</h2>
      <p>打开另一个 SVGA 后开始对比。</p>
    </section>
    <div class="compareActions">
      <button class="toolbarButton primary" type="button" data-action="open-compare-b">打开 B 文件</button>
      <button class="toolbarButton" type="button" data-action="back-preview">退出对比</button>
    </div>
  `;
  await mountPlayback("compareA", nodes.compareCanvasA, state.previewBytes ?? state.sourceBytes);
  clearCanvas(nodes.compareCanvasB);
}

async function mountPlayback(key, canvas, bytes, options = {}) {
  if (!canvas || !bytes?.byteLength) return undefined;
  stopPlayback(key);
  const parser = new SvgaWebParser();
  const videoItem = await parser.do(toParserArrayBuffer(bytes));
  canvas.width = Math.max(1, Math.round(videoItem.videoSize?.width ?? videoItem.width ?? 512));
  canvas.height = Math.max(1, Math.round(videoItem.videoSize?.height ?? videoItem.height ?? 512));
  const player = new SvgaWebPlayer(canvas);
  player.set({ loop: true, fillMode: FILL_MODE.FORWARDS, noExecutionDelay: false });
  await player.mount(videoItem);
  if (options.start !== false) player.start();
  state[`${key}Playback`] = { player, videoItem, playing: options.start !== false };
  renderCommandState();
  return state[`${key}Playback`];
}

function stopPlayback(key) {
  const playback = state[`${key}Playback`];
  try {
    playback?.player?.clear?.();
  } catch {
    // Renderer cleanup should never block opening another local file.
  }
  state[`${key}Playback`] = undefined;
}

function stopAllPlayback() {
  for (const key of ["primary", "compareA", "compareB", "edit"]) stopPlayback(key);
}

function togglePrimaryPlayback() {
  const playback = state.primaryPlayback;
  if (!playback) return;
  if (playback.playing) {
    playback.player.pause();
    playback.playing = false;
  } else {
    playback.player.start();
    playback.playing = true;
  }
  renderCommandState();
}

function replayPrimary() {
  const playback = state.primaryPlayback;
  if (!playback) return;
  playback.player.clear();
  playback.player.start();
  playback.playing = true;
  renderCommandState();
}

function clearCanvas(canvas) {
  const context = canvas.getContext("2d");
  context?.clearRect(0, 0, canvas.width, canvas.height);
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
  let nextIndex = currentIndex;
  if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
  else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = tabs.length - 1;
  else return;
  consumeKeyboardEvent(event);
  setTab(tabs[nextIndex].dataset.tab, { focus: true });
}

function openTab(tab) {
  if (state.sourceBytes && state.view !== "preview") setMode("preview");
  setTab(tab);
}

async function refreshRecentFiles() {
  if (!bridge?.getRecentSvgaFiles) {
    nodes.recentList.replaceChildren();
    nodes.clearRecentButton.disabled = true;
    nodes.recentNote.textContent = "最近文件由 macOS 客户端提供。";
    return;
  }
  const result = await bridge.getRecentSvgaFiles();
  const records = Array.isArray(result?.records) ? result.records : [];
  const visible = records.slice(0, 5);
  nodes.clearRecentButton.disabled = visible.length === 0;
  nodes.recentList.replaceChildren(...visible.map((record) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <button type="button" data-action="open-recent" data-recent-id="${escapeHtml(record.id)}">${escapeHtml(record.displayName)}</button>
      <span class="recentMeta">${escapeHtml(record.parentName || "本地文件")}</span>
    `;
    return item;
  }));
  if (visible.length === 0) {
    const empty = document.createElement("li");
    empty.className = "isEmpty";
    empty.innerHTML = `<span class="recentMeta">暂无最近打开记录</span>`;
    nodes.recentList.append(empty);
  }
  nodes.recentNote.textContent = "仅显示文件名和父级位置。";
}

async function clearRecentFiles() {
  if (bridge?.clearRecentSvgaFiles) await bridge.clearRecentSvgaFiles();
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
    dialogOpen: Boolean(document.querySelector("dialog[open]"))
  });
  Object.entries(commandState.actionStates).forEach(([action, actionState]) => {
    setActionEnabled(action, actionState.enabled, actionState.reason);
  });
  document.querySelector("[data-action='play-pause']").textContent = commandState.playPauseCopy;
  syncShortTermMenuState(commandState.menuState);
}

function syncShortTermMenuState(snapshot) {
  if (!bridge?.updateShortTermMenuState) return;
  const serialized = JSON.stringify(snapshot);
  if (serialized === state.lastMenuStateSnapshot) return;
  state.lastMenuStateSnapshot = serialized;
  bridge.updateShortTermMenuState(snapshot).catch(() => {});
}

function bannerTone(title) {
  if (/正在/.test(title)) return "loading";
  if (/失败|未完成|未通过/.test(title)) return "danger";
  if (/没有|不支持|取消/.test(title)) return "warning";
  if (/已/.test(title)) return "success";
  return "info";
}

function showSaveBanner(title, message, tone = bannerTone(title)) {
  nodes.saveBanner.hidden = false;
  nodes.saveBanner.dataset.status = tone;
  nodes.saveBanner.innerHTML = `<strong>${escapeHtml(title)}</strong><span> ${escapeHtml(message || "")}</span>`;
}

function showFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  nodes.errorMessage.textContent = `${message || "未知错误"} 源文件没有被修改。`;
  setView("failed");
}

function showOperationFailure(title, error) {
  const message = error instanceof Error ? error.message : String(error);
  if (state.sourceBytes && !["preview", "compare", "edit"].includes(state.view)) {
    setMode("preview");
  }
  showSaveBanner(title, `${message || "未知错误"} 源文件没有被修改。`);
  state.saveStatus = state.activeOutput ? "dirty" : "idle";
  renderCommandState();
}

function buildCurrentStateSummary() {
  const lines = [
    "Auto SVGA 状态摘要",
    `状态：${viewCopy(state.view)}`,
    state.displayName ? `文件：${state.displayName}` : "文件：未打开",
    nodes.playbackMeta.textContent && nodes.playbackMeta.textContent !== "-"
      ? `播放：${nodes.playbackMeta.textContent}`
      : "",
    state.activeOutput ? `未保存输出：${state.activeOutput.title || state.activeOutput.kind}` : "",
    !nodes.saveBanner.hidden && nodes.saveBanner.textContent ? `提示：${nodes.saveBanner.textContent.trim()}` : "",
    state.view === "failed" && nodes.errorMessage.textContent ? `错误：${nodes.errorMessage.textContent.trim()}` : ""
  ];
  return lines.filter(Boolean).join("\n");
}

function viewCopy(view) {
  return {
    launch: "等待打开",
    loading: "正在打开",
    failed: "打开失败",
    preview: "预览",
    compare: "对比",
    edit: "编辑预留"
  }[view] || view;
}

function messageRow(title, summary, tone = "info") {
  const row = document.createElement("article");
  row.className = "findingRow messageRow";
  row.dataset.status = tone;
  row.dataset.component = "InlineStatus";
  row.innerHTML = renderMessageRowHtml(title, summary, tone);
  return row;
}

async function postBytes(url, bytes) {
  const response = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: bytes
  });
  return readJsonResponse(response);
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "content-type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(payload)
  });
  return readJsonResponse(response);
}

function authHeaders() {
  return bridge?.reportToken ? { "x-auto-svga-prototype-token": bridge.reportToken } : {};
}

async function readJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `请求失败 (${response.status})`);
  return payload;
}

function toUint8Array(value) {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return new Uint8Array(value);
  if (value?.data && Array.isArray(value.data)) return new Uint8Array(value.data);
  if (value && typeof value === "object") return new Uint8Array(Object.values(value).map(Number));
  return new Uint8Array();
}

function toBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function toParserArrayBuffer(bytes) {
  const view = toUint8Array(bytes);
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function showDialog(dialog) {
  return new Promise((resolve) => {
    const handler = () => {
      dialog.removeEventListener("close", handler);
      renderCommandState();
      resolve(dialog.returnValue);
    };
    dialog.addEventListener("close", handler);
    dialog.showModal();
    renderCommandState();
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
    document.querySelector("dialog[open]")?.close("cancel");
    if (state.view === "compare") setMode("preview");
  },
  copyStateSummary: () => bridge?.writeClipboardText?.(buildCurrentStateSummary())
});

refreshRecentFiles().catch(() => {});
renderCommandState();
runShortTermSmokeIfRequested().catch((error) => {
  reportShortTermSmokeFailure("smoke-runner", error).catch(() => {});
});

async function runShortTermSmokeIfRequested() {
  if (new URLSearchParams(location.search).get("mode") !== "smoke") return;
  const screenshotCaptures = [];
  const captureSmokeArtifact = async (scenario) => {
    const artifact = await bridge?.captureArtifact?.(scenario);
    screenshotCaptures.push(Boolean(artifact?.path));
    return artifact;
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
  const overviewFactRows = overviewVisibleFacts(state.model);
  const shortTermSpecComparisonProof = {
    schemaVersion: 1,
    proofId: "short-term-spec-comparison-proof",
    source: "short-term-smoke",
    prdIds: ["S4"],
    profileId: state.model?.overview?.profileId || "",
    profileLabel: state.model?.overview?.profileLabel || "",
    factRowCount: overviewFactRows.length,
    renderedFactRowCount: nodes.factGrid.querySelectorAll(".factCell").length,
    factRows: overviewFactRows.map((fact) => ({
      id: fact.id,
      label: fact.label,
      value: fact.value,
      requirement: fact.requirement,
      status: fact.status
    })),
    actualRequirementPairsVisible: overviewFactRows.length > 0
      && overviewFactRows.every((fact) => Boolean(fact.value) && Boolean(fact.requirement)),
    overviewTabActive: state.tab === "overview",
    separateProductionSpecModuleExposed: Boolean(document.querySelector("#productionSpecModule, #specReportSection, [data-panel='production-spec']"))
  };
  shortTermSpecComparisonProof.passed = [
    shortTermSpecComparisonProof.profileId === "production_target",
    shortTermSpecComparisonProof.factRowCount >= 5,
    shortTermSpecComparisonProof.renderedFactRowCount >= shortTermSpecComparisonProof.factRowCount,
    shortTermSpecComparisonProof.actualRequirementPairsVisible,
    shortTermSpecComparisonProof.overviewTabActive,
    shortTermSpecComparisonProof.separateProductionSpecModuleExposed === false
  ].every(Boolean);
  const noAudioCopy = [...nodes.assetList.querySelectorAll(".assetRow")]
    .map((row) => row.textContent.trim())
    .find((text) => text.includes("当前文件暂无音频资产")) || "";
  const shortTermTabKeyboardProof = await collectShortTermTabKeyboardProof();
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
  const shortTermEmptyStateProof = {
    schemaVersion: 1,
    proofId: "short-term-empty-state-proof",
    source: "short-term-smoke",
    noAudioVisible: noAudioCopy.includes("当前文件暂无音频资产"),
    noReplaceableImagesVisible: replaceableImageRowCount === 0 && noReplaceableCopy.includes("未发现设计师命名"),
    textUnavailableVisible: textElementRowCount === 0 && textUnavailableCopy.includes("未发现可运行时替换"),
    ordinaryImagesNotDuplicatedInReplaceables: replaceableImageRowCount === 0 && nodes.assetList.children.length > 0,
    ordinaryImageThumbnailVisible: ordinaryImageThumbnailCount > 0,
    assetRowCount: nodes.assetList.children.length,
    ordinaryImageThumbnailCount,
    replaceableImageRowCount,
    textElementRowCount,
    noAudioCopy,
    noReplaceableCopy,
    textUnavailableCopy
  };
  let shortTermRuntimeTextBoundaryProof;
  shortTermEmptyStateProof.passed = [
    shortTermEmptyStateProof.noAudioVisible,
    shortTermEmptyStateProof.noReplaceableImagesVisible,
    shortTermEmptyStateProof.textUnavailableVisible,
    shortTermEmptyStateProof.ordinaryImagesNotDuplicatedInReplaceables,
    shortTermEmptyStateProof.ordinaryImageThumbnailVisible
  ].every(Boolean);
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
  const sequenceRows = [...nodes.assetList.querySelectorAll(".assetRow")]
    .filter((row) => row.querySelector(".thumb.sequence"));
  const sequenceThumbnailImageCount = sequenceRows.reduce((total, row) => total + row.querySelectorAll(".thumb.sequence img").length, 0);
  const shortTermThumbnailProof = {
    schemaVersion: 1,
    proofId: "short-term-thumbnail-proof",
    source: "short-term-smoke",
    prdIds: ["S5", "S6", "S15"],
    ordinaryImageThumbnailVisible: ordinaryImageThumbnailCount > 0,
    ordinaryImageThumbnailCount,
    sequenceFixtureName: "sequence-repair-smoke.svga",
    sequenceRowCount: sequenceRows.length,
    sequenceThumbnailImageCount,
    sequenceFourGridVisible: sequenceRows.length > 0 && sequenceThumbnailImageCount >= 4,
    audioEmptyStateVisible: noAudioCopy.includes("当前文件暂无音频资产"),
    passed: ordinaryImageThumbnailCount > 0
      && sequenceRows.length > 0
      && sequenceThumbnailImageCount >= 4
      && noAudioCopy.includes("当前文件暂无音频资产")
  };
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
  const optimizationSaveButton = nodes.compareInfoB.querySelector("[data-action='save-as']");
  const shortTermOptimizationProof = {
    schemaVersion: 1,
    proofId: "short-term-optimization-proof",
    source: "short-term-smoke",
    prdIds: ["S8", "S9", "S10", "S14"],
    fixtureName: "optimizer-reopen-smoke.svga",
    sourceSha256Before: optimizationSourceSha256Before,
    sourceSha256After: optimizationSourceSha256After,
    sourceBytesUnchanged: optimizationSourceSha256After === optimizationSourceSha256Before,
    sourceSizeBytes: state.sourceBytes.byteLength,
    optimizedSha256,
    optimizedSizeBytes: optimizedBytes.byteLength,
    optimizedOutputProduced: optimizedBytes.byteLength > 0,
    optimizedBytesDifferent: optimizedSha256 !== optimizationSourceSha256Before,
    optimizedBytesSmaller: optimizedBytes.byteLength < state.sourceBytes.byteLength,
    batchActionEnabled: optimizationModel.batchActionEnabled === true,
    safeExecutableCount: optimizationModel.safeExecutableCount,
    reviewOnlyCount: optimizationModel.reviewOnlyCount,
    unsupportedCount: optimizationModel.unsupportedCount,
    optimizationCandidateRows,
    optimizationCandidatesVisible: optimizationCandidateRows > 0,
    resultStatus: optimizationResult.status,
    resultTitle: state.activeOutput.title,
    resultSummary: state.activeOutput.summary,
    executedActionCount: Array.isArray(optimizationResult.actions) ? optimizationResult.actions.length : 0,
    executedActionRowsVisible: nodes.compareInfoB.querySelectorAll("[data-optimization-actions] li").length,
    skippedMethodRowsVisible: nodes.compareInfoB.querySelectorAll("[data-optimization-skipped] li").length,
    metricCount: Array.isArray(optimizationResult.metrics) ? optimizationResult.metrics.length : 0,
    metricsVisible: nodes.compareInfoB.querySelectorAll(".factCell").length >= 2,
    comparisonVisible: state.view === "compare",
    compareCanvasANonBlank: optimizationCompareANonBlank,
    compareCanvasBNonBlank: optimizationCompareBNonBlank,
    saveAsEnabled: optimizationSaveButton?.disabled === false,
    sourceOutputSeparated: state.activeOutput.bytes !== state.sourceBytes
  };
  shortTermOptimizationProof.passed = [
    shortTermOptimizationProof.sourceBytesUnchanged,
    shortTermOptimizationProof.optimizedOutputProduced,
    shortTermOptimizationProof.optimizedBytesDifferent,
    shortTermOptimizationProof.optimizedBytesSmaller,
    shortTermOptimizationProof.batchActionEnabled,
    shortTermOptimizationProof.safeExecutableCount > 0,
    shortTermOptimizationProof.optimizationCandidatesVisible,
    shortTermOptimizationProof.resultStatus === "optimized",
    shortTermOptimizationProof.resultTitle === "已生成优化副本",
    shortTermOptimizationProof.executedActionCount > 0,
    shortTermOptimizationProof.executedActionRowsVisible >= shortTermOptimizationProof.executedActionCount,
    shortTermOptimizationProof.skippedMethodRowsVisible > 0,
    shortTermOptimizationProof.metricCount >= 2,
    shortTermOptimizationProof.metricsVisible,
    shortTermOptimizationProof.comparisonVisible,
    shortTermOptimizationProof.compareCanvasANonBlank,
    shortTermOptimizationProof.compareCanvasBNonBlank,
    shortTermOptimizationProof.saveAsEnabled,
    shortTermOptimizationProof.sourceOutputSeparated
  ].every(Boolean);
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
  shortTermRuntimeTextBoundaryProof = {
    schemaVersion: 1,
    proofId: "short-term-runtime-text-boundary-proof",
    source: "short-term-smoke",
    prdIds: ["S13"],
    parserTextSource: "designer_named_imagekey_text_anchor",
    runtimeTextKeySource: "official_svga_dynamic_text_imagekey",
    textElementsDiscovered: designerRuntimeTextKeys.length,
    textKeys: designerRuntimeTextKeys,
    modalOpened: runtimeTextModalOpened,
    editApplied: runtimeTextApplied,
    runtimeOverlayVisibleAfterApply: runtimeTextOverlayCopy.includes("SVGA VIP"),
    runtimeOverlayCopy: runtimeTextOverlayCopy,
    resetCommandEnabledAfterApply: runtimeTextResetCommandEnabled,
    resetApplied: true,
    resetClearedOverlay: nodes.runtimeTextOverlay.hidden && !nodes.runtimeTextOverlay.textContent.trim(),
    bytePersistenceClaimed: false,
    productCompleteClaimed: true,
    visualPreviewMechanism: "dom_overlay_on_preview_canvas",
    sourceSha256Before: runtimeTextSourceSha256Before,
    sourceSha256AfterApply: runtimeTextSourceSha256AfterApply,
    sourceSha256AfterReset: runtimeTextSourceSha256AfterReset,
    sourceBytesUnchanged: runtimeTextSourceSha256AfterApply === runtimeTextSourceSha256Before
      && runtimeTextSourceSha256AfterReset === runtimeTextSourceSha256Before,
    supportedRuntimeFields: ["text"]
  };
  shortTermRuntimeTextBoundaryProof.passed = [
    shortTermRuntimeTextBoundaryProof.textElementsDiscovered > 0,
    shortTermRuntimeTextBoundaryProof.textKeys.includes("nickname_text"),
    shortTermRuntimeTextBoundaryProof.modalOpened,
    shortTermRuntimeTextBoundaryProof.editApplied,
    shortTermRuntimeTextBoundaryProof.runtimeOverlayVisibleAfterApply,
    shortTermRuntimeTextBoundaryProof.resetCommandEnabledAfterApply,
    shortTermRuntimeTextBoundaryProof.resetApplied,
    shortTermRuntimeTextBoundaryProof.resetClearedOverlay,
    shortTermRuntimeTextBoundaryProof.bytePersistenceClaimed === false,
    shortTermRuntimeTextBoundaryProof.productCompleteClaimed,
    shortTermRuntimeTextBoundaryProof.sourceBytesUnchanged
  ].every(Boolean);
  const shortTermReplaceableClassificationProof = {
    schemaVersion: 1,
    proofId: "short-term-replaceable-classification-proof",
    source: "short-term-smoke",
    prdIds: ["S7"],
    rule: "exclude_automatic_image_keys_include_designer_named_image_keys",
    automaticFixtureName: file.name,
    automaticImageAssetCount: automaticFixtureImageAssetCount,
    automaticExcludedExamples: automaticImageNames.slice(0, 6),
    automaticReplaceableCount: replaceableImageRowCount,
    noReplaceableCopy,
    designerFixtureName: "replaceable-workflow-smoke.svga",
    designerImageAssetCount,
    includedDesignerKeys: designerReplaceableKeys,
    includedDesignerCount: designerReplaceableKeys.length,
    automaticKeysExcluded: automaticImageNames.length > 0 && replaceableImageRowCount === 0,
    designerKeysIncluded: designerReplaceableKeys.includes("profile_frame"),
    replaceableElementsNotAllImages: designerReplaceableKeys.length > 0 && designerReplaceableKeys.length < designerImageAssetCount,
    emptyStateExplainsAutomaticExclusion: noReplaceableCopy.includes("自动命名资源")
  };
  shortTermReplaceableClassificationProof.passed = [
    shortTermReplaceableClassificationProof.automaticKeysExcluded,
    shortTermReplaceableClassificationProof.designerKeysIncluded,
    shortTermReplaceableClassificationProof.replaceableElementsNotAllImages,
    shortTermReplaceableClassificationProof.emptyStateExplainsAutomaticExclusion
  ].every(Boolean);
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
  const shortTermRenameProof = {
    schemaVersion: 1,
    proofId: "short-term-rename-proof",
    source: "short-term-smoke",
    prdIds: ["S11", "S14"],
    fixtureName: "replaceable-workflow-smoke.svga",
    fromImageKey: renameFromImageKey,
    toImageKey: renameToImageKey,
    contextMenuOpened: renameContextMenuOpened,
    enterConfirmed: true,
    sourceSha256Before: renameSourceSha256Before,
    sourceSha256After: renameSourceSha256After,
    sourceBytesUnchanged: renameSourceSha256After === renameSourceSha256Before,
    renamedSha256,
    renamedOutputProduced: state.activeOutput.bytes.byteLength > 0,
    renamedBytesDifferent: renamedSha256 !== renameSourceSha256Before,
    renamedKeyVisible: renamedImageKeys.includes(renameToImageKey),
    oldKeyAbsent: !renamedImageKeys.includes(renameFromImageKey),
    referenceFieldsChecked: ["imageKey", "matteKey"],
    referenceUpdateCount: referenceUpdates.length,
    imageKeyReferenceUpdates: referenceUpdates.filter((update) => update.field === "imageKey").length,
    matteKeyReferenceUpdates: referenceUpdates.filter((update) => update.field === "matteKey").length,
    decodePassed: renameValidation.decodePassed === true,
    reopenPassed: renameValidation.reopenPassed === true,
    referenceClosurePassed: renameValidation.referenceClosurePassed === true,
    imageKeyReferenceClosurePassed: renameValidation.referenceClosurePassed === true
      && danglingReferences.every((resourceKey) => resourceKey !== renameToImageKey),
    matteKeyReferenceClosurePassed: renameValidation.referenceClosurePassed === true
      && danglingReferences.every((resourceKey) => resourceKey !== renameToImageKey),
    danglingReferences,
    danglingReferenceCount: danglingReferences.length,
    newKeyPresent: renameValidation.newKeyPresent === true,
    imageBytesPreserved: renameValidation.imageBytesPreserved === true,
    previewModeStayed: state.view === "preview" && state.mode === "preview",
    saveAsEnabled: document.querySelector("[data-action='save-as']")?.disabled === false,
    canvasNonBlank: renameCanvasNonBlank,
    resultTitle: state.activeOutput.title,
    resultSummary: state.activeOutput.summary
  };
  shortTermRenameProof.passed = [
    shortTermRenameProof.contextMenuOpened,
    shortTermRenameProof.enterConfirmed,
    shortTermRenameProof.sourceBytesUnchanged,
    shortTermRenameProof.renamedOutputProduced,
    shortTermRenameProof.renamedBytesDifferent,
    shortTermRenameProof.renamedKeyVisible,
    shortTermRenameProof.oldKeyAbsent,
    shortTermRenameProof.decodePassed,
    shortTermRenameProof.reopenPassed,
    shortTermRenameProof.referenceClosurePassed,
    shortTermRenameProof.imageKeyReferenceClosurePassed,
    shortTermRenameProof.matteKeyReferenceClosurePassed,
    shortTermRenameProof.danglingReferenceCount === 0,
    shortTermRenameProof.newKeyPresent,
    shortTermRenameProof.imageBytesPreserved,
    shortTermRenameProof.previewModeStayed,
    shortTermRenameProof.saveAsEnabled,
    shortTermRenameProof.canvasNonBlank,
    shortTermRenameProof.resultTitle === "已重命名 imageKey"
  ].every(Boolean);
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
  const shortTermReplacementProof = {
    schemaVersion: 1,
    proofId: "short-term-replacement-proof",
    source: "short-term-smoke",
    prdIds: ["S12", "S14"],
    fixtureName: "replaceable-workflow-smoke.svga",
    imageKey: replacementImageKey,
    replacementPngSha256,
    sourceSha256Before: replacementSourceSha256Before,
    sourceSha256After: replacementSourceSha256After,
    sourceBytesUnchanged: replacementSourceSha256After === replacementSourceSha256Before,
    editedSha256: replacementEditedSha256,
    replacementOutputProduced: state.saveStatus === "dirty" || replacementEditedSha256 !== replacementSourceSha256Before,
    replacementBytesDifferent: replacementEditedSha256 !== replacementSourceSha256Before,
    previewModeStayed: state.view === "preview" && state.mode === "preview",
    saveAsEnabledBeforeReset: replacementSaveAsEnabledBeforeReset,
    contextMenuOpenedAfterReplacement: replacementContextMenuOpened,
    resetCommandEnabled,
    replacementCanvasNonBlank,
    resetPreviewSha256,
    resetRestoredOriginal: resetPreviewSha256 === replacementSourceSha256Before,
    resetClearedOutput: !state.activeOutput && state.saveStatus === "idle",
    resetCanvasNonBlank,
    resultTitle: replacementResultTitle
  };
  shortTermReplacementProof.passed = [
    shortTermReplacementProof.sourceBytesUnchanged,
    shortTermReplacementProof.replacementOutputProduced,
    shortTermReplacementProof.replacementBytesDifferent,
    shortTermReplacementProof.previewModeStayed,
    shortTermReplacementProof.saveAsEnabledBeforeReset,
    shortTermReplacementProof.contextMenuOpenedAfterReplacement,
    shortTermReplacementProof.resetCommandEnabled,
    shortTermReplacementProof.replacementCanvasNonBlank,
    shortTermReplacementProof.resetRestoredOriginal,
    shortTermReplacementProof.resetClearedOutput,
    shortTermReplacementProof.resetCanvasNonBlank
  ].every(Boolean);
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
  const shortTermOpenFlowProof = {
    schemaVersion: 1,
    proofId: "short-term-open-flow-proof",
    source: "short-term-smoke",
    prdIds: ["S1"],
    fixtureName: file.name,
    fixtureSha256: await sha256Hex(fixtureBytes),
    sourceSizeBytes: fixtureBytes.byteLength,
    dragDropAttempted: true,
    dragDropLoaded,
    previewReached: playbackReady && inspectionReportVisible && canvasNonBlank,
    localOnly: resourceEntriesAreLocalOnly(),
    pathRedacted: !file.name.includes("/") && !file.name.includes("\\"),
    rendererFilesystemAccessClaimed: false,
    pairedNormalProof: "normal-runtime-proof.json"
  };
  shortTermOpenFlowProof.passed = [
    shortTermOpenFlowProof.dragDropAttempted,
    shortTermOpenFlowProof.dragDropLoaded,
    shortTermOpenFlowProof.previewReached,
    shortTermOpenFlowProof.localOnly,
    shortTermOpenFlowProof.pathRedacted,
    shortTermOpenFlowProof.rendererFilesystemAccessClaimed === false
  ].every(Boolean);
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
  const originalPlayerMount = SvgaWebPlayer.prototype.mount;
  try {
    SvgaWebPlayer.prototype.mount = async function playbackFailureSmokeProbe() {
      throw new Error("播放失败：播放器挂载失败。");
    };
    await loadOpenedSource({
      bytes: fixtureBytes,
      displayName: "playback-failure-smoke.svga",
      sourceId: ""
    });
  } finally {
    SvgaWebPlayer.prototype.mount = originalPlayerMount;
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
  const invalidResponse = await fetch("/api/short-term-product-inspection-model?name=invalid.svga", {
    method: "POST",
    headers: authHeaders(),
    body: new Uint8Array([0, 1, 2, 3, 4])
  });
  const shortTermLoadFailureProof = {
    schemaVersion: 1,
    proofId: "short-term-load-failure-proof",
    source: "short-term-smoke",
    prdIds: ["S2"],
    invalidFileName: "invalid.svga",
    invalidSizeBytes: invalidBytes.byteLength,
    invalidDropAttempted: true,
    loadFailedVisible,
    errorCopy: loadFailureCopy,
    sourceFileUnmodifiedClaimVisible: loadFailureCopy.includes("源文件没有被修改"),
    noStaleMetadataAfterFailure,
    invalidApiRejected: invalidResponse.ok === false,
    recoveryFileName: file.name,
    recoveryLoaded: state.view === "preview" && Boolean(state.model),
    playbackRecovered: Boolean(state.primaryPlayback),
    sourceSha256BeforeInvalid: recoverySourceSha256Before,
    sourceSha256AfterRecovery: recoverySourceSha256After,
    sourceBytesRestoredAfterRecovery: recoverySourceSha256After === recoverySourceSha256Before,
    playbackFailureInjected: true,
    playbackFailureFileName: "playback-failure-smoke.svga",
    playbackFailureVisible,
    playbackFailureCopy,
    noStaleMetadataAfterPlaybackFailure,
    playbackFailureRecovered: state.view === "preview" && Boolean(state.primaryPlayback),
    playbackFailureSourceSha256Before,
    playbackFailureSourceSha256AfterRecovery,
    playbackFailureSourceBytesRestoredAfterRecovery: playbackFailureSourceSha256AfterRecovery === playbackFailureSourceSha256Before
  };
  shortTermLoadFailureProof.passed = [
    shortTermLoadFailureProof.invalidDropAttempted,
    shortTermLoadFailureProof.loadFailedVisible,
    shortTermLoadFailureProof.sourceFileUnmodifiedClaimVisible,
    shortTermLoadFailureProof.noStaleMetadataAfterFailure,
    shortTermLoadFailureProof.invalidApiRejected,
    shortTermLoadFailureProof.recoveryLoaded,
    shortTermLoadFailureProof.playbackRecovered,
    shortTermLoadFailureProof.sourceBytesRestoredAfterRecovery,
    shortTermLoadFailureProof.playbackFailureInjected,
    shortTermLoadFailureProof.playbackFailureVisible,
    shortTermLoadFailureProof.noStaleMetadataAfterPlaybackFailure,
    shortTermLoadFailureProof.playbackFailureRecovered,
    shortTermLoadFailureProof.playbackFailureSourceBytesRestoredAfterRecovery
  ].every(Boolean);
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
    shortTermScreenshots: screenshotCaptures.length >= 9 && screenshotCaptures.every(Boolean),
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
    cleanup: true
  });
}

async function collectShortTermTabKeyboardProof() {
  const tabs = tabButtons();
  const tabOverview = document.querySelector("#tabOverview");
  const tabOptimization = document.querySelector("#tabOptimization");
  const tabReplaceable = document.querySelector("#tabReplaceable");
  const panelOverview = document.querySelector("#panelOverview");
  const panelOptimization = document.querySelector("#panelOptimization");
  const panelReplaceable = document.querySelector("#panelReplaceable");
  setTab("overview");
  await waitForSmokeFrame();
  tabOverview?.focus();
  const arrowRightPrevented = !tabOverview?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
  await waitForSmokeFrame();
  const arrowRightState = {
    selectedTab: state.tab,
    focusedTabId: document.activeElement?.id || "",
    optimizationPanelVisible: panelOptimization?.hidden === false
  };
  const endPrevented = !tabOptimization?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
  await waitForSmokeFrame();
  const endState = {
    selectedTab: state.tab,
    focusedTabId: document.activeElement?.id || "",
    replaceablePanelVisible: panelReplaceable?.hidden === false
  };
  const homePrevented = !tabReplaceable?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
  await waitForSmokeFrame();
  const homeState = {
    selectedTab: state.tab,
    focusedTabId: document.activeElement?.id || "",
    overviewPanelVisible: panelOverview?.hidden === false
  };
  const selectedTabOnlyInSequentialFocus = tabs.filter((tab) => tab.tabIndex === 0).length === 1
    && tabOverview?.tabIndex === 0
    && tabOptimization?.tabIndex === -1
    && tabReplaceable?.tabIndex === -1;
  const ariaSelectedSynced = tabOverview?.getAttribute("aria-selected") === "true"
    && tabOptimization?.getAttribute("aria-selected") === "false"
    && tabReplaceable?.getAttribute("aria-selected") === "false";
  const panelVisibilitySynced = panelOverview?.hidden === false
    && panelOptimization?.hidden === true
    && panelReplaceable?.hidden === true;
  const proof = {
    schemaVersion: 1,
    proofId: "short-term-tab-keyboard-proof",
    source: "short-term-smoke",
    prdIds: ["S3", "S8", "S12", "S13"],
    component: "RightTabPanel",
    molecule: "TabItem",
    tabOrder: tabs.map((tab) => tab.dataset.tab || ""),
    arrowRightPrevented,
    arrowRightSelected: arrowRightState.selectedTab === "optimization",
    arrowRightFocusedTabId: arrowRightState.focusedTabId,
    arrowRightPanelVisible: arrowRightState.optimizationPanelVisible,
    endPrevented,
    endSelected: endState.selectedTab === "replaceable",
    endFocusedTabId: endState.focusedTabId,
    endPanelVisible: endState.replaceablePanelVisible,
    homePrevented,
    homeSelected: homeState.selectedTab === "overview",
    homeFocusedTabId: homeState.focusedTabId,
    homePanelVisible: homeState.overviewPanelVisible,
    selectedTabOnlyInSequentialFocus,
    ariaSelectedSynced,
    panelVisibilitySynced
  };
  proof.passed = [
    proof.tabOrder.join(",") === "overview,optimization,replaceable",
    proof.arrowRightPrevented,
    proof.arrowRightSelected,
    proof.arrowRightFocusedTabId === "tabOptimization",
    proof.arrowRightPanelVisible,
    proof.endPrevented,
    proof.endSelected,
    proof.endFocusedTabId === "tabReplaceable",
    proof.endPanelVisible,
    proof.homePrevented,
    proof.homeSelected,
    proof.homeFocusedTabId === "tabOverview",
    proof.homePanelVisible,
    proof.selectedTabOnlyInSequentialFocus,
    proof.ariaSelectedSynced,
    proof.panelVisibilitySynced
  ].every(Boolean);
  return proof;
}

async function reportShortTermSmokeFailure(phase, error) {
  await bridge?.reportSmokeResult?.({
    localPage: location.origin.startsWith("http://127.0.0.1:"),
    localOnly: resourceEntriesAreLocalOnly(),
    strictCsp: Boolean(document.querySelector('meta[name="auto-svga-csp"]')),
    noCspViolation: true,
    playback: false,
    canvasNonBlank: false,
    inspectionReport: false,
    auditPanel: false,
    fileInput: false,
    dragDrop: false,
    errorFile: false,
    playerLifecycle: false,
    cleanup: false,
    diagnostics: {
      schemaVersion: 1,
      phase,
      errorName: boundedSmokeText(error instanceof Error ? error.name : "Error", 80),
      errorMessage: boundedSmokeText(error instanceof Error ? error.message : String(error), 260),
      actionCount: 0,
      currentActionId: null,
      lastActionId: null
    }
  });
}

function boundedSmokeText(value, maxLength) {
  return String(value ?? "").slice(0, maxLength);
}

function resourceEntriesAreLocalOnly() {
  return performance.getEntriesByType("resource").every((entry) => {
    try {
      const url = new URL(entry.name, location.href);
      return url.origin === location.origin || entry.name.startsWith(`blob:${location.origin}/`);
    } catch {
      return false;
    }
  });
}

function waitForSmokeCondition(predicate, timeoutMs) {
  const startedAt = performance.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) {
        resolve(true);
        return;
      }
      if (performance.now() - startedAt > timeoutMs) {
        reject(new Error("Short-term smoke timed out."));
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function waitForSmokeFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

async function waitForCanvasPixels(canvas, timeoutMs) {
  const startedAt = performance.now();
  while (performance.now() - startedAt <= timeoutMs) {
    if (canvasHasNonBlankPixels(canvas)) return true;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  return false;
}

function canvasHasNonBlankPixels(canvas) {
  if (!canvas?.width || !canvas?.height) return false;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return false;
  const sampleCount = 7;
  for (let y = 0; y < sampleCount; y += 1) {
    for (let x = 0; x < sampleCount; x += 1) {
      const pixelX = Math.min(canvas.width - 1, Math.max(0, Math.round((canvas.width * (x + 0.5)) / sampleCount)));
      const pixelY = Math.min(canvas.height - 1, Math.max(0, Math.round((canvas.height * (y + 0.5)) / sampleCount)));
      const [red, green, blue, alpha] = context.getImageData(pixelX, pixelY, 1, 1).data;
      if (alpha > 0 && (red > 0 || green > 0 || blue > 0)) return true;
    }
  }
  return false;
}
