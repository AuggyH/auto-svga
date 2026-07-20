import { escapeHtml, formatDisplayDetailCopy } from "./short-term-macos-render-model.mjs";
import { createReplaceableEmptyStatus } from "./short-term-macos-inline-status-renderers.mjs";
import { runtimeTextReplacementView } from "./short-term-macos-text-model.mjs";
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

export function createReplaceableImageRow(item, _index, options) {
  const label = item.displayName || item.imageKey;
  const detail = formatDisplayDetailCopy(item.detail || [item.dimensions, item.fileSize].filter(Boolean).join(" · "));
  const replacementActive = options.replacementActive === true || item.replacementActive === true;
  const row = document.createElement("article");
  row.className = "replaceableRow";
  row.tabIndex = 0;
  row.dataset.action = "select-resource";
  row.dataset.component = "ReplaceableImageRow";
  row.dataset.imageKey = item.imageKey;
  row.dataset.replacementState = replacementActive ? "preview" : "source";
  row.setAttribute("role", "option");
  row.classList.toggle("isSelected", options.selected);
  row.classList.toggle("isRenaming", options.renaming);
  row.setAttribute("aria-selected", options.selected ? "true" : "false");
  row.title = [label, detail].filter(Boolean).join(" · ");
  if (options.renaming) {
    row.innerHTML = `
      <span class="replaceableIdentity">
        <span class="thumb" data-component="ThumbnailFrame" data-variant="image">${renderThumbnailHtml({ type: "image", resourceIds: [item.resourceId] }, options.model)}</span>
        <label class="rowText renameEditor">新 imageKey
          <input class="renameInputInline" data-rename-input value="${escapeHtml(item.imageKey)}" autocomplete="off">
        </label>
      </span>
      <span class="inlineActions">
        <button type="button" data-action="inline-rename-confirm">确认</button>
        <button type="button" data-action="inline-rename-cancel">取消</button>
      </span>
    `;
  } else {
    const trailingAction = options.directReplace
      ? `<span class="replacementRowActions">
          <button type="button" class="replaceImageButton" data-action="row-menu" data-image-key="${escapeHtml(item.imageKey)}" aria-label="替换 ${escapeHtml(label)} 图片">替换图片</button>
          <button type="button" class="resetImagePreviewButton" data-action="reset-image-preview" data-image-key="${escapeHtml(item.imageKey)}" aria-label="重置 ${escapeHtml(label)} 图片预览" title="重置" ${replacementActive ? "" : "disabled"}>${runtimeTextResetIconHtml}</button>
        </span>`
      : `<button type="button" class="rowMenuButton" data-action="row-menu" data-image-key="${escapeHtml(item.imageKey)}" aria-label="${escapeHtml(label)} 操作">${rowMenuIconHtml}</button>`;
    row.innerHTML = `
      <span class="replaceableIdentity">
        <span class="thumb" data-component="ThumbnailFrame" data-variant="image">${renderThumbnailHtml({ type: "image", resourceIds: [item.resourceId] }, options.model)}</span>
        <span class="rowText"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(detail)}</span></span>
      </span>
      ${trailingAction}
    `;
  }
  return row;
}

export function renderReplaceableImages(nodes, view, model) {
  nodes.replaceableSummary.textContent = view.summaryCopy;
  nodes.replaceableList.closest(".replaceableSection")?.setAttribute("data-empty", view.hasImages ? "false" : "true");
  nodes.replaceableList.dataset.empty = view.hasImages ? "false" : "true";
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

export function renderReplaceableEmptyState(nodes) {
  const noImages = nodes.replaceableList.dataset.empty === "true";
  const noTexts = nodes.textElementList.dataset.empty === "true";
  const section = nodes.replaceableList.closest(".replaceableSection");
  if (!noImages || !noTexts) {
    section?.removeAttribute("data-page-state");
    return;
  }
  section?.setAttribute("data-empty", "true");
  section?.setAttribute("data-page-state", "no-replaceable");
  nodes.replaceableList.dataset.empty = "false";
  nodes.replaceableList.replaceChildren(createReplaceableEmptyStatus());
}

export function createTextElementRow(item, _index, options) {
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
  const replacement = runtimeTextReplacementView(item, value, {
    emptyIsSource: item.resetDisabled === true
  });
  const { initialValue } = replacement;
  const replacementActive = item.replacementActive === true || options.replacementActive === true;
  const resetDisabled = replacementActive ? false : replacement.resetDisabled;
  row.dataset.replacementState = replacementActive ? "preview" : replacement.replacementState;
  row.title = `${label}: ${value || item.initialText || item.textKey}`;
  row.innerHTML = `
    <span class="replaceableIdentity">
      <span class="thumb" data-component="ThumbnailFrame" data-variant="text">${renderThumbnailHtml({ type: "text" }, options.model)}</span>
      <span class="rowText"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(item.initialText || item.textKey)}</span></span>
    </span>
    <span class="runtimeTextActions">
      <input class="runtimeTextInput" data-component="InlineTextReplacementInput" data-text-input data-text-key="${escapeHtml(item.textKey)}" data-initial-value="${escapeHtml(initialValue)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(item.placeholder)}" autocomplete="off" aria-label="${escapeHtml(label)} 文本预览">
      <button type="button" class="runtimeTextResetButton" data-action="runtime-text-reset" data-text-key="${escapeHtml(item.textKey)}" aria-label="重置 ${escapeHtml(label)} 文本预览" title="重置" ${resetDisabled ? "disabled" : ""}>${runtimeTextResetIconHtml}</button>
    </span>
  `;
  return row;
}

export function applyRuntimeTextRowReplacementState(row, replacement) {
  if (!row || !replacement) return;
  row.dataset.replacementState = replacement.replacementState;
  const resetButton = row.querySelector("[data-action='runtime-text-reset']");
  if (resetButton) resetButton.disabled = replacement.resetDisabled;
}

export function captureRuntimeTextInputContext(textElementList) {
  const documentRef = textElementList?.ownerDocument || globalThis.document;
  const activeElement = documentRef?.activeElement;
  if (!activeElement?.matches?.("[data-text-input]")) return undefined;
  const row = activeElement.closest?.(".textElementRow[data-text-key]");
  if (!row || row.parentElement !== textElementList) return undefined;
  return {
    textKey: activeElement.dataset.textKey || row.dataset.textKey || "",
    replacementState: row.dataset.replacementState || "",
    value: typeof activeElement.value === "string" ? activeElement.value : "",
    selectionStart: Number.isInteger(activeElement.selectionStart) ? activeElement.selectionStart : undefined,
    selectionEnd: Number.isInteger(activeElement.selectionEnd) ? activeElement.selectionEnd : undefined,
    selectionDirection: activeElement.selectionDirection || "none"
  };
}

export function restoreRuntimeTextInputContext(textElementList, context) {
  if (!context?.textKey) return false;
  const input = Array.from(textElementList.querySelectorAll("[data-text-input]"))
    .find((candidate) => candidate.dataset.textKey === context.textKey);
  if (!input) return false;
  const row = input.closest?.(".textElementRow[data-text-key]");
  if (row?.dataset.replacementState === context.replacementState) {
    input.value = context.value;
  }
  input.focus({ preventScroll: true });
  if (
    Number.isInteger(context.selectionStart)
    && Number.isInteger(context.selectionEnd)
    && typeof input.setSelectionRange === "function"
  ) {
    input.setSelectionRange(
      Math.min(context.selectionStart, input.value.length),
      Math.min(context.selectionEnd, input.value.length),
      context.selectionDirection
    );
  }
  return true;
}

export function replaceRuntimeTextRows(textElementList, rows) {
  const inputContext = captureRuntimeTextInputContext(textElementList);
  textElementList.replaceChildren(...rows);
  restoreRuntimeTextInputContext(textElementList, inputContext);
}

export function renderRuntimeTextElements(nodes, view, selectedTextKey) {
  nodes.replaceableSummary.textContent = view.summaryCopy;
  nodes.textElementList.dataset.empty = view.hasTextElements ? "false" : "true";
  if (view.hasTextElements) {
    nodes.textElementList.closest(".replaceableSection")?.setAttribute("data-empty", "false");
  }
  if (!view.hasTextElements) {
    nodes.textElementList.replaceChildren();
    return;
  }
  replaceRuntimeTextRows(
    nodes.textElementList,
    view.texts.map((item, index) => createTextElementRow(item, index, {
      selected: item.textKey === selectedTextKey
    }))
  );
}

export function applyRuntimeTextSelection(nodes, selectedTextKey) {
  nodes.textElementList.querySelectorAll(".textElementRow[data-text-key]").forEach((row) => {
    const selected = row.dataset.textKey === selectedTextKey;
    row.classList.toggle("isSelected", selected);
    row.setAttribute("aria-selected", selected ? "true" : "false");
  });
}
