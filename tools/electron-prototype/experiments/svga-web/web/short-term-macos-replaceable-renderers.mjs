import { escapeHtml } from "./short-term-macos-render-model.mjs";
import { renderThumbnailHtml } from "./short-term-macos-thumbnail-renderers.mjs";

const rowMenuIconHtml = `
  <svg class="rowMenuIcon" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="6" cy="12" r="1.5"></circle>
    <circle cx="12" cy="12" r="1.5"></circle>
    <circle cx="18" cy="12" r="1.5"></circle>
  </svg>
`;

const runtimeTextResetIconHtml = `
  <svg class="runtimeTextResetIcon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5.5 12a6.5 6.5 0 1 0 2-4.7"></path>
    <path d="M7.8 4.6v3.2H4.6"></path>
  </svg>
`;

export function createReplaceableImageRow(item, index, options) {
  const label = item.displayName || item.imageKey;
  const detail = item.detail || [item.dimensions, item.fileSize].filter(Boolean).join(" · ");
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
  row.title = [label, detail].filter(Boolean).join(" · ");
  if (options.renaming) {
    row.innerHTML = `
      <span class="rowIndex" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
      <span class="thumb">${renderThumbnailHtml({ type: "image", resourceIds: [item.resourceId] }, options.model)}</span>
      <label class="rowText renameEditor">新 imageKey
        <input class="renameInputInline" data-rename-input value="${escapeHtml(item.imageKey)}" autocomplete="off">
      </label>
      <span class="inlineActions">
        <button type="button" data-action="inline-rename-confirm">确认</button>
        <button type="button" data-action="inline-rename-cancel">取消</button>
      </span>
    `;
  } else {
    const trailingAction = options.directReplace
      ? `<button type="button" class="replaceImageButton" data-action="row-menu" data-image-key="${escapeHtml(item.imageKey)}" aria-label="替换 ${escapeHtml(label)} 图片">替换图片</button>`
      : `<button type="button" class="rowMenuButton" data-action="row-menu" data-image-key="${escapeHtml(item.imageKey)}" aria-label="${escapeHtml(label)} 操作">${rowMenuIconHtml}</button>`;
    row.innerHTML = `
      <span class="rowIndex" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
      <span class="thumb">${renderThumbnailHtml({ type: "image", resourceIds: [item.resourceId] }, options.model)}</span>
      <span class="rowText"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(detail)}</span></span>
      ${trailingAction}
    `;
  }
  return row;
}

export function renderReplaceableImages(nodes, view, model) {
  nodes.replaceableSummary.textContent = view.summaryCopy;
  nodes.replaceableList.closest(".replaceableSection")?.setAttribute("data-empty", view.hasImages ? "false" : "true");
  if (!view.hasImages) {
    nodes.replaceableList.replaceChildren();
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
    <button type="button" class="runtimeTextResetButton" data-action="runtime-text-reset" data-text-key="${escapeHtml(item.textKey)}" aria-label="重置 ${escapeHtml(label)} 文本预览" title="重置" ${item.resetDisabled ? "disabled" : ""}>${runtimeTextResetIconHtml}</button>
  `;
  return row;
}

export function renderRuntimeTextElements(nodes, view, selectedTextKey) {
  nodes.replaceableSummary.textContent = view.summaryCopy;
  nodes.textElementList.dataset.empty = view.hasTextElements ? "false" : "true";
  if (!view.hasTextElements) {
    nodes.textElementList.replaceChildren();
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
