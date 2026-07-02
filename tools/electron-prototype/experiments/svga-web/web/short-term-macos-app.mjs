import { FILL_MODE, Parser as SvgaWebParser, Player as SvgaWebPlayer } from "/vendor/svga-web-2.4.4.js";

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
  loadingMessage: document.querySelector("#loadingMessage"),
  errorMessage: document.querySelector("#errorMessage"),
  primaryCanvas: document.querySelector("#primaryCanvas"),
  compareCanvasA: document.querySelector("#compareCanvasA"),
  compareCanvasB: document.querySelector("#compareCanvasB"),
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
  nodes.app.dataset.appState = view;
  document.querySelectorAll("[data-view]").forEach((node) => {
    const active = node.dataset.view === view;
    node.hidden = !active;
    node.classList.toggle("isActive", active);
  });
  renderCommandState();
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll("[data-action='mode-preview'], [data-action='mode-edit']").forEach((button) => {
    button.classList.toggle("isSelected", button.dataset.action === `mode-${mode}`);
  });
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
  nodes.loadingMessage.textContent = "解析 SVGA、建立短期检查模型。";
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
  document.querySelectorAll("[data-action='mode-preview'], [data-action='mode-edit']").forEach((button) => {
    button.classList.toggle("isSelected", button.dataset.action === "mode-preview");
  });
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
  showSaveBanner("正在执行安全优化。", "只处理可机械验证的安全项。");
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
      summary: renamed.rename.resultSummary
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
    showSaveBanner("没有可预览的文本元素。", "当前 SVGA 未暴露可运行时替换的 textKey，源文件没有被修改。");
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
    state.sourceBytes = outputBytes;
    state.previewBytes = new Uint8Array(outputBytes);
    state.sourceId = result.sourceId || state.sourceId;
    state.displayName = result.fileName || state.displayName;
    clearTransientOutput();
    state.model = await inspectShortTerm(state.sourceBytes, state.displayName);
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
  nodes.factGrid.replaceChildren(...model.overview.facts.map((fact) => {
    const cell = document.createElement("article");
    cell.className = "factCell";
    cell.dataset.status = fact.status;
    cell.innerHTML = `
      <strong>${escapeHtml(fact.value)}</strong>
      <span>${escapeHtml(fact.label)}</span>
      <small>${escapeHtml(fact.requirement)} · ${statusCopy(fact.status)}</small>
    `;
    return cell;
  }));
}

function renderAssets(model) {
  const rows = model.assets.map((asset) => {
    const row = document.createElement("article");
    row.className = "assetRow";
    const detail = asset.kind === "audio" && model.overview.audioGroup.status === "empty"
      ? model.overview.audioGroup.copy
      : `${asset.dimensions} · ${asset.fileSize} · ${asset.usageCount} 次引用`;
    row.innerHTML = `
      <span class="thumb ${asset.kind === "sequence" ? "sequence" : asset.kind === "audio" ? "audio" : ""}">${renderThumbnail(asset.thumbnail)}</span>
      <span class="rowText"><strong>${escapeHtml(asset.name)}</strong><span>${escapeHtml(detail)}</span></span>
      <span class="badge">${asset.kind === "sequence" ? "序列" : asset.kind === "audio" ? "音频" : asset.replaceable ? "可替换" : "图片"}</span>
    `;
    return row;
  });
  nodes.assetList.replaceChildren(...rows);
}

function renderOptimization(model) {
  if (!model) return;
  nodes.optimizationSummary.textContent = `${model.safeExecutableCount} 项可安全执行，${model.reviewOnlyCount} 项需复核，${model.unsupportedCount} 项暂不支持。`;
  document.querySelector("[data-action='run-optimization']").disabled = !model.batchActionEnabled;
  nodes.findingList.replaceChildren(...model.items.map((item) => {
    const row = document.createElement("article");
    row.className = "findingRow";
    row.innerHTML = `
      <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.summary)} ${escapeHtml(item.estimatedFileSizeImpact)}</p></div>
      <span class="badge ${item.disposition === "safeExecutable" ? "safe" : item.disposition === "reviewOnly" ? "review" : "unsupported"}">${dispositionCopy(item.disposition)}</span>
    `;
    return row;
  }));
}

function renderOptimizationResult(model) {
  if (!model) return;
  nodes.findingList.prepend(messageRow(model.resultTitle, model.resultSummary));
}

function renderReplaceables(model) {
  if (!model) return;
  const rows = model.images.map((item) => {
    const row = document.createElement("article");
    row.className = "replaceableRow";
    row.tabIndex = 0;
    row.dataset.action = "select-resource";
    row.dataset.imageKey = item.imageKey;
    const selected = item.imageKey === state.selectedImageKey;
    const renaming = item.imageKey === state.renameImageKey;
    row.classList.toggle("isSelected", selected);
    row.classList.toggle("isRenaming", renaming);
    if (renaming) {
      row.innerHTML = `
        <span class="thumb">${renderThumbnail({ type: "image", resourceIds: [item.resourceId] })}</span>
        <label class="rowText renameEditor">新 imageKey
          <input class="renameInputInline" data-rename-input value="${escapeHtml(item.imageKey)}" autocomplete="off">
          <span>Enter 确认 · Esc 取消</span>
        </label>
        <span class="inlineActions">
          <button type="button" data-action="inline-rename-confirm">确认</button>
          <button type="button" data-action="inline-rename-cancel">取消</button>
        </span>
      `;
    } else {
      row.innerHTML = `
        <span class="thumb">${renderThumbnail({ type: "image", resourceIds: [item.resourceId] })}</span>
        <span class="rowText"><strong>${escapeHtml(item.imageKey)}</strong><span>${escapeHtml(item.dimensions)} · ${escapeHtml(item.fileSize)}</span></span>
        <span class="badge">${selected ? "已选中" : "可替换"}</span>
      `;
    }
    return row;
  });
  if (rows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "emptyText";
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
    empty.textContent = model?.textPreviewCopy || "当前文件没有可运行时预览的文本元素。";
    nodes.textElementList.replaceChildren(empty);
    nodes.textPreviewSummary.textContent = "未发现可运行时替换的 textKey。";
  } else {
    nodes.textElementList.replaceChildren(...texts.map((item) => {
      const row = document.createElement("article");
      row.className = "textElementRow";
      row.tabIndex = 0;
      row.dataset.action = "select-text";
      row.dataset.textKey = item.textKey;
      row.classList.toggle("isSelected", item.textKey === state.selectedTextKey);
      row.innerHTML = `
        <span class="rowText"><strong>${escapeHtml(item.displayName || item.textKey)}</strong><span>${escapeHtml(item.initialText || item.textKey)}</span></span>
        <span class="badge">${item.textKey === state.selectedTextKey ? "已选中" : "文本"}</span>
      `;
      return row;
    }));
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
    const badge = row.querySelector(".badge");
    if (badge) badge.textContent = selected ? "已选中" : "可替换";
  });
}

function openResourceContextMenu(event, imageKey) {
  if (!imageKey) return;
  selectImageKey(imageKey);
  const menu = nodes.resourceContextMenu;
  menu.hidden = false;
  menu.style.left = `${Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8)}px`;
  menu.style.top = `${Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8)}px`;
  menu.querySelector("[data-action='context-reset']").disabled = state.activeOutput?.kind !== "replacement";
  menu.focus();
}

function closeResourceContextMenu() {
  nodes.resourceContextMenu.hidden = true;
}

function renderThumbnail(thumbnail) {
  if (!thumbnail || thumbnail.type === "audio-empty") return "无音频";
  if (thumbnail.type === "music") return "音频";
  const urls = (thumbnail.resourceIds ?? [])
    .map((id) => state.model?.thumbnails?.imageDataUrlsByResourceId?.[id])
    .filter(isSafeImageDataUrl)
    .slice(0, thumbnail.type === "sequence-four-grid" ? 4 : 1);
  if (urls.length === 0) return "";
  return urls
    .map((url) => `<img src="${escapeHtml(url)}" alt="">`)
    .join("");
}

function isSafeImageDataUrl(value) {
  return typeof value === "string" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value);
}

function renderEditReserved() {
  const assets = state.model?.assets ?? [];
  nodes.layerPanel.replaceChildren(...assets.filter((asset) => asset.kind !== "audio").slice(0, 32).map((asset) => {
    const row = document.createElement("article");
    row.className = "assetRow";
    row.innerHTML = `
      <span class="thumb ${asset.kind === "sequence" ? "sequence" : ""}">${renderThumbnail(asset.thumbnail)}</span>
      <span class="rowText"><strong>${escapeHtml(asset.name)}</strong><span>${asset.kind === "sequence" ? "序列组" : "图层资源"}</span></span>
      <span class="badge">${asset.kind === "sequence" ? "组" : "层"}</span>
    `;
    return row;
  }));
}

async function renderOptimizationCompare(model, optimizedBytes) {
  setView("compare");
  nodes.compareInfoA.innerHTML = renderCompareInfo("原始文件", state.model, state.displayName);
  nodes.compareInfoB.innerHTML = `
    <h2>${escapeHtml(model.resultTitle)}</h2>
    <p>${escapeHtml(model.resultSummary)}</p>
    ${(model.metrics ?? []).map((metric) => `<div class="factCell"><strong>${escapeHtml(metric.after)}</strong><span>${escapeHtml(metric.label)}</span><small>${escapeHtml(metric.delta)}</small></div>`).join("")}
    <button class="toolbarButton primary" type="button" data-action="save-as">另存为</button>
    <button class="toolbarButton" type="button" data-action="back-preview">返回预览</button>
  `;
  await Promise.all([
    mountPlayback("compareA", nodes.compareCanvasA, state.sourceBytes),
    mountPlayback("compareB", nodes.compareCanvasB, optimizedBytes)
  ]);
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
  if (!model) return `<h2>${escapeHtml(title)}</h2><p>未打开文件。</p>${actions.join("")}`;
  const facts = model.overview.facts.slice(0, 5).map((fact) => `
    <div class="factCell"><strong>${escapeHtml(fact.value)}</strong><span>${escapeHtml(fact.label)}</span></div>
  `).join("");
  return `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(displayName)}</p>${facts}${actions.join("")}`;
}

async function enterGeneralCompare() {
  if (!state.sourceBytes) return;
  setView("compare");
  nodes.compareInfoA.innerHTML = renderCompareInfo("A 文件", state.model, state.displayName);
  nodes.compareInfoB.innerHTML = `
    <h2>B 文件</h2>
    <p>打开另一个 SVGA 后开始对比。</p>
    <button class="toolbarButton primary" type="button" data-action="open-compare-b">打开 B 文件</button>
    <button class="toolbarButton" type="button" data-action="back-preview">退出对比</button>
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

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("isSelected", button.dataset.tab === tab);
  });
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    const active = panel.dataset.panel === tab;
    panel.hidden = !active;
    panel.classList.toggle("isActive", active);
  });
}

function openTab(tab) {
  if (state.sourceBytes && state.view !== "preview") setMode("preview");
  setTab(tab);
}

async function refreshRecentFiles() {
  if (!bridge?.getRecentSvgaFiles) {
    nodes.recentList.replaceChildren();
    nodes.recentNote.textContent = "最近文件由 macOS 客户端提供。";
    return;
  }
  const result = await bridge.getRecentSvgaFiles();
  const records = Array.isArray(result?.records) ? result.records : [];
  const visible = records.slice(0, 5);
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
  const hasFile = Boolean(state.sourceBytes);
  const hasOutput = Boolean(state.activeOutput);
  const saveBusy = state.saveStatus === "validating";
  const canOverwrite = hasOutput && !saveBusy && Boolean(state.sourceId);
  const canSaveAs = hasOutput && !saveBusy;
  const canRunOptimization = hasFile && state.model?.optimization?.batchActionEnabled === true;
  const canRenameImageKey = hasFile && Boolean(state.selectedImageKey);
  const canEditText = Boolean(selectedTextElement());
  setActionEnabled("compare", hasFile, "请先打开 SVGA");
  setActionEnabled("play-pause", hasFile, "请先打开 SVGA");
  setActionEnabled("replay", hasFile, "请先打开 SVGA");
  setActionEnabled("run-optimization", canRunOptimization, "没有可安全执行的优化项");
  setActionEnabled("save-as", canSaveAs, hasOutput ? "正在验证保存输出" : "没有可保存的输出");
  setActionEnabled("save-overwrite", canOverwrite, state.sourceId ? "正在验证保存输出" : "当前文件不支持覆盖保存");
  setActionEnabled("edit-text", canEditText, "当前文件没有可预览文本元素");
  setActionEnabled("reset-text", Boolean(state.textPreview), "当前没有已应用的文本预览");
  document.querySelector("[data-action='play-pause']").textContent = state.primaryPlayback?.playing ? "暂停" : "播放";
  syncShortTermMenuState({
    view: state.view,
    mode: state.mode,
    tab: state.tab,
    hasFile,
    hasOutput,
    outputKind: state.activeOutput?.kind || "",
    canOverwrite,
    canSaveAs,
    saveBusy,
    canCompare: hasFile,
    canPlay: hasFile,
    canReplay: hasFile,
    canRenameImageKey,
    canReplaceImage: canRenameImageKey,
    canResetImageReplacement: state.activeOutput?.kind === "replacement",
    canEditText,
    canResetText: Boolean(state.textPreview),
    canRunOptimization,
    canShowOptimizationComparison: state.activeOutput?.kind === "optimization" && Boolean(state.activeOutput.bytes?.byteLength),
    isRenaming: Boolean(state.renameImageKey),
    hasTransientState: Boolean(state.renameImageKey) || state.view === "compare" || Boolean(document.querySelector("dialog[open]"))
  });
}

function setActionEnabled(action, enabled, reason) {
  document.querySelectorAll(`[data-action='${action}']`).forEach((button) => {
    button.disabled = !enabled;
    button.title = enabled ? "" : reason;
  });
}

function syncShortTermMenuState(snapshot) {
  if (!bridge?.updateShortTermMenuState) return;
  const serialized = JSON.stringify(snapshot);
  if (serialized === state.lastMenuStateSnapshot) return;
  state.lastMenuStateSnapshot = serialized;
  bridge.updateShortTermMenuState(snapshot).catch(() => {});
}

function showSaveBanner(title, message) {
  nodes.saveBanner.hidden = false;
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

function messageRow(title, summary) {
  const row = document.createElement("article");
  row.className = "findingRow";
  row.innerHTML = `<div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(summary || "")}</p></div><span class="badge fail">未执行</span>`;
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

function suffixName(name, suffix) {
  const cleanName = name && name.toLowerCase().endsWith(".svga") ? name.slice(0, -5) : (name || "output");
  return `${cleanName}-${suffix}.svga`;
}

function statusCopy(status) {
  return {
    pass: "通过",
    warning: "注意",
    fail: "超出",
    unknown: "未知"
  }[status] || "未知";
}

function dispositionCopy(disposition) {
  return {
    safeExecutable: "可安全执行",
    reviewOnly: "需复核",
    unsupported: "暂不支持"
  }[disposition] || "建议项";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
  if (!event.target.matches("[data-rename-input]")) return;
  if (event.key === "Enter") {
    event.preventDefault();
    confirmInlineRename().catch(showFailure);
  }
  if (event.key === "Escape") {
    event.preventDefault();
    cancelInlineRename();
  }
});

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => setTab(button.dataset.tab));
});

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
  setTab("optimization");
  await waitForSmokeFrame();
  await captureSmokeArtifact("short-term-preview-optimization");
  setTab("replaceable");
  await waitForSmokeFrame();
  await captureSmokeArtifact("short-term-preview-replaceable");
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
  const invalidResponse = await fetch("/api/short-term-product-inspection-model?name=invalid.svga", {
    method: "POST",
    headers: authHeaders(),
    body: new Uint8Array([0, 1, 2, 3, 4])
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
    playback: Boolean(state.primaryPlayback),
    canvasNonBlank,
    inspectionReport: Boolean(state.model && nodes.assetList.children.length > 0),
    auditPanel: Boolean(nodes.factGrid.children.length > 0),
    fileInput: Boolean(file.name && fixtureBytes.byteLength > 0),
    dragDrop: state.displayName === file.name,
    errorFile: invalidResponse.ok === false,
    playerLifecycle: Boolean(state.primaryPlayback),
    shortTermScreenshots: screenshotCaptures.length >= 7 && screenshotCaptures.every(Boolean),
    cleanup: true
  });
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
