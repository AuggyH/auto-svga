import {
  escapeHtml,
  isSafeImageDataUrl,
  renderMessageRowHtml,
  renderOptimizationFindingHtml,
  renderOverviewFactCellHtml
} from "./short-term-macos-render-model.mjs";

export function createOverviewFactCell(fact) {
  const cell = document.createElement("article");
  cell.className = "factCell";
  cell.dataset.component = "ProductionSpecInlineRow";
  cell.dataset.status = fact.status;
  cell.title = `${fact.label}: ${fact.value}`;
  cell.innerHTML = renderOverviewFactCellHtml(fact);
  return cell;
}

export function createAssetRow(asset, model) {
  const row = document.createElement("article");
  row.className = "assetRow";
  row.dataset.component = asset.kind === "sequence" ? "SequenceThumbnail" : asset.kind === "audio" ? "AudioAssetRow" : "AssetRow";
  row.dataset.kind = asset.kind;
  row.dataset.attention = asset.findingCodes.length > 0 ? "true" : "false";
  const detail = asset.kind === "audio" && model.overview.audioGroup.status === "empty"
    ? model.overview.audioGroup.copy
    : `${asset.dimensions} · ${asset.fileSize} · ${asset.usageCount} 次引用`;
  const badgeCopy = asset.findingCodes.length > 0
    ? "需关注"
    : asset.kind === "sequence" ? "序列" : asset.kind === "audio" ? "音频" : asset.replaceable ? "可替换" : "图片";
  const badgeClass = asset.findingCodes.length > 0 ? " review" : "";
  row.title = `${asset.name} ${detail}`;
  row.innerHTML = `
    <span class="thumb ${asset.kind === "sequence" ? "sequence" : asset.kind === "audio" ? "audio" : ""}">${renderThumbnailHtml(asset.thumbnail, model)}</span>
    <span class="rowText"><strong>${escapeHtml(asset.name)}</strong><span>${escapeHtml(detail)}</span></span>
    <span class="badge${badgeClass}">${escapeHtml(badgeCopy)}</span>
  `;
  return row;
}

export function renderOverviewFacts(nodes, view) {
  nodes.factGrid.replaceChildren(...view.facts.map(createOverviewFactCell));
}

export function renderAssetList(nodes, view, model) {
  nodes.assetList.replaceChildren(...view.assets.map((asset) => createAssetRow(asset, model)));
}

export function createOptimizationFindingRow(item) {
  const row = document.createElement("article");
  row.className = "findingRow";
  row.dataset.component = "OptimizationFindingRow";
  row.dataset.disposition = item.disposition;
  row.title = `${item.title}: ${item.summary}`;
  row.innerHTML = renderOptimizationFindingHtml(item);
  return row;
}

export function renderOptimizationFindings(nodes, view) {
  nodes.optimizationSummary.textContent = view.summaryCopy;
  nodes.runOptimizationButton.textContent = view.runButtonCopy;
  nodes.runOptimizationButton.title = view.runButtonTitle;
  nodes.runOptimizationButton.disabled = view.runButtonDisabled;
  if (!view.hasFindings) {
    nodes.findingList.replaceChildren(createInlineStatusText(view.emptyCopy));
    return;
  }
  nodes.findingList.replaceChildren(...view.groupedItems.map(createOptimizationFindingRow));
}

export function prependOptimizationResult(nodes, title, summary, tone) {
  nodes.findingList.prepend(createMessageRow(title, summary, tone));
}

export function createMessageRow(title, summary, tone = "info") {
  const row = document.createElement("article");
  row.className = "findingRow messageRow";
  row.dataset.status = tone;
  row.dataset.component = "InlineStatus";
  row.innerHTML = renderMessageRowHtml(title, summary, tone);
  return row;
}

export function createInlineStatusText(copy) {
  const empty = document.createElement("p");
  empty.className = "emptyText";
  empty.dataset.component = "InlineStatus";
  empty.textContent = copy;
  return empty;
}

export function createReplaceableImageRow(item, index, options) {
  const row = document.createElement("article");
  row.className = "replaceableRow";
  row.tabIndex = 0;
  row.dataset.action = "select-resource";
  row.dataset.component = "ReplaceableImageRow";
  row.dataset.imageKey = item.imageKey;
  row.setAttribute("role", "option");
  row.classList.toggle("isSelected", options.selected);
  row.classList.toggle("isRenaming", options.renaming);
  row.setAttribute("aria-selected", options.selected ? "true" : "false");
  row.title = `${item.imageKey} ${item.dimensions} ${item.fileSize}`;
  if (options.renaming) {
    row.innerHTML = `
      <span class="rowIndex" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
      <span class="thumb">${renderThumbnailHtml({ type: "image", resourceIds: [item.resourceId] }, options.model)}</span>
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
      <span class="rowIndex" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
      <span class="thumb">${renderThumbnailHtml({ type: "image", resourceIds: [item.resourceId] }, options.model)}</span>
      <span class="rowText"><strong>${escapeHtml(item.imageKey)}</strong><span>${escapeHtml(item.dimensions)} · ${escapeHtml(item.fileSize)}</span></span>
      <button type="button" class="rowMenuButton" data-action="row-menu" data-image-key="${escapeHtml(item.imageKey)}" aria-label="${escapeHtml(item.imageKey)} 操作">操作</button>
    `;
  }
  return row;
}

export function renderReplaceableImages(nodes, view, model) {
  nodes.replaceableSummary.textContent = view.summaryCopy;
  if (!view.hasImages) {
    nodes.replaceableList.replaceChildren(createInlineStatusText(view.emptyCopy));
    return;
  }
  nodes.replaceableList.replaceChildren(...view.rows.map((row) => createReplaceableImageRow(row.item, row.index, {
    model,
    selected: row.selected,
    renaming: row.renaming
  })));
}

export function createTextElementRow(item, index, options) {
  const row = document.createElement("article");
  row.className = "textElementRow";
  row.tabIndex = 0;
  row.dataset.action = "select-text";
  row.dataset.component = "ReplaceableTextRow";
  row.dataset.textKey = item.textKey;
  row.setAttribute("role", "option");
  row.classList.toggle("isSelected", options.selected);
  row.setAttribute("aria-selected", options.selected ? "true" : "false");
  row.title = `${item.displayName || item.textKey}: ${item.initialText || item.textKey}`;
  row.innerHTML = `
    <span class="rowIndex" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
    <span class="rowText"><strong>${escapeHtml(item.displayName || item.textKey)}</strong><span>${escapeHtml(item.initialText || item.textKey)}</span></span>
    <span class="badge">文本</span>
  `;
  return row;
}

export function renderRuntimeTextElements(nodes, view, selectedTextKey) {
  nodes.textPreviewSummary.textContent = view.summaryCopy;
  nodes.editTextButton.hidden = !view.hasTextElements;
  nodes.resetTextButton.hidden = !view.hasTextElements;
  if (!view.hasTextElements) {
    nodes.textElementList.replaceChildren(createInlineStatusText(view.emptyCopy));
    return;
  }
  nodes.textElementList.replaceChildren(...view.texts.map((item, index) => createTextElementRow(item, index, {
    selected: item.textKey === selectedTextKey
  })));
}

export function createEditLayerRow(asset, model) {
  const row = document.createElement("article");
  row.className = "assetRow";
  row.dataset.component = "LayerRow";
  row.innerHTML = `
    <span class="thumb ${asset.kind === "sequence" ? "sequence" : ""}">${renderThumbnailHtml(asset.thumbnail, model)}</span>
    <span class="rowText"><strong>${escapeHtml(asset.name)}</strong><span>${asset.kind === "sequence" ? "序列组" : "图层资源"}</span></span>
    <span class="badge">${asset.kind === "sequence" ? "组" : "层"}</span>
  `;
  return row;
}

export function renderEditReservedLayers(nodes, view, model) {
  nodes.layerPanel.replaceChildren(...view.rows.map((asset) => createEditLayerRow(asset, model)));
}

function renderThumbnailHtml(thumbnail, model) {
  if (!thumbnail || thumbnail.type === "audio-empty") return "无音频";
  if (thumbnail.type === "music") return "音频";
  const urls = (thumbnail.resourceIds ?? [])
    .map((id) => model?.thumbnails?.imageDataUrlsByResourceId?.[id])
    .filter(isSafeImageDataUrl)
    .slice(0, thumbnail.type === "sequence-four-grid" ? 4 : 1);
  if (urls.length === 0) return "";
  return urls
    .map((url) => `<img src="${escapeHtml(url)}" alt="">`)
    .join("");
}
