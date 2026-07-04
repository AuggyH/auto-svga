import { setActionEnabled } from "./short-term-macos-dom-state.mjs";
import {
  renderReplaceableImages,
  renderRuntimeTextElements
} from "./short-term-macos-replaceable-renderers.mjs";
import {
  nextReplaceableSelection,
  replaceableImageListView
} from "./short-term-macos-replaceable-model.mjs";
import {
  nextSelectedTextKey,
  runtimeTextListView,
  selectedRuntimeTextElement
} from "./short-term-macos-text-model.mjs";
import { clearRuntimeTextOverlay } from "./short-term-macos-text-renderers.mjs";

export function renderShortTermReplaceableImages({ nodes, state, model }) {
  if (!model) return;
  const view = replaceableImageListView(model, state.selectedImageKey, state.renameImageKey);
  renderReplaceableImages(nodes, view, state.model);
}

export function renderShortTermRuntimeTextElements({ nodes, state, model }) {
  const view = runtimeTextListView(model, state.textPreview);
  state.selectedTextKey = nextSelectedTextKey(state.selectedTextKey, view.texts);
  renderRuntimeTextElements(nodes, view, state.selectedTextKey);
  setActionEnabled("edit-text", view.hasTextElements, "当前文件没有可预览文本元素");
  setActionEnabled("reset-text", Boolean(state.textPreview), "当前没有已应用的文本预览");
}

export function selectShortTermRuntimeTextElement({ nodes, state, textKey }) {
  if (!textKey) return;
  state.selectedTextKey = textKey;
  state.textPreview = "";
  clearRuntimeTextOverlay(nodes.runtimeTextOverlay);
  renderShortTermRuntimeTextElements({
    nodes,
    state,
    model: state.model?.replaceableElements
  });
}

export function selectedShortTermRuntimeTextElement(state) {
  return selectedRuntimeTextElement(state.model?.replaceableElements, state.selectedTextKey);
}

export function selectShortTermImageKey({
  documentRef = document,
  nodes,
  state,
  imageKey
}) {
  if (!imageKey) return;
  const selection = nextReplaceableSelection(imageKey, state.renameImageKey);
  state.selectedImageKey = selection.selectedImageKey;
  state.renameImageKey = selection.renameImageKey;
  if (selection.shouldRerender) {
    renderShortTermReplaceableImages({
      nodes,
      state,
      model: state.model?.replaceableElements
    });
    return;
  }
  documentRef.querySelectorAll(".replaceableRow").forEach((row) => {
    const selected = row.dataset.imageKey === imageKey;
    row.classList.toggle("isSelected", selected);
    row.setAttribute("aria-selected", selected ? "true" : "false");
  });
}
