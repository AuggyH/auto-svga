import { escapeHtml } from "./short-term-macos-render-model.mjs";
import { createInlineStatusText } from "./short-term-macos-inline-status-renderers.mjs";
import { renderThumbnailHtml } from "./short-term-macos-thumbnail-renderers.mjs";

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
      <button type="button" class="rowMenuButton" data-action="row-menu" data-image-key="${escapeHtml(item.imageKey)}" aria-label="${escapeHtml(item.imageKey)} 操作">...</button>
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
  const label = item.displayName || item.textKey;
  const value = item.inputValue || "";
  row.title = `${label}: ${value || item.initialText || item.textKey}`;
  row.innerHTML = `
    <span class="rowIndex" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
    <span class="rowText"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(item.initialText || item.textKey)}</span></span>
    <input class="runtimeTextInput" data-component="InlineTextReplacementInput" data-text-input data-text-key="${escapeHtml(item.textKey)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(item.placeholder)}" autocomplete="off" aria-label="${escapeHtml(label)} 文本预览">
    <button type="button" class="runtimeTextResetButton" data-action="runtime-text-reset" data-text-key="${escapeHtml(item.textKey)}" aria-label="重置 ${escapeHtml(label)} 文本预览" ${item.resetDisabled ? "disabled" : ""}>重置</button>
  `;
  return row;
}

export function renderRuntimeTextElements(nodes, view, selectedTextKey) {
  nodes.textPreviewSummary.textContent = view.summaryCopy;
  if (!view.hasTextElements) {
    nodes.textElementList.replaceChildren(createInlineStatusText(view.emptyCopy));
    return;
  }
  nodes.textElementList.replaceChildren(...view.texts.map((item, index) => createTextElementRow(item, index, {
    selected: item.textKey === selectedTextKey
  })));
}

export function applyRuntimeTextSelection(nodes, selectedTextKey) {
  nodes.textElementList.querySelectorAll(".textElementRow[data-text-key]").forEach((row) => {
    const selected = row.dataset.textKey === selectedTextKey;
    row.classList.toggle("isSelected", selected);
    row.setAttribute("aria-selected", selected ? "true" : "false");
  });
}
