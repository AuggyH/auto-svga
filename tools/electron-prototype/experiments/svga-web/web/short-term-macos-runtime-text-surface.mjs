import {
  runtimeTextReplacementView,
  runtimeTextOverlayCopy,
  selectedRuntimeTextElement
} from "./short-term-macos-text-model.mjs";
import { applyRuntimeTextRowReplacementState } from "./short-term-macos-replaceable-renderers.mjs";
import {
  applyRuntimeTextOverlay,
  clearRuntimeTextOverlay
} from "./short-term-macos-text-renderers.mjs";

function findRuntimeTextInput(nodes, textKey) {
  return Array.from(nodes.textElementList.querySelectorAll("[data-text-input]"))
    .find((input) => input.dataset.textKey === textKey);
}

function setRuntimeTextValue(state, textKey, value) {
  state.textPreviewValues = { ...(state.textPreviewValues || {}) };
  if (value) {
    state.textPreviewValues[textKey] = value;
  } else {
    delete state.textPreviewValues[textKey];
  }
  state.textPreview = state.textPreviewValues[textKey] || "";
}

export function focusShortTermRuntimeTextPreviewInput({
  nodes,
  state,
  textElement,
  showSaveBanner
}) {
  if (!state.sourceBytes) return;
  if (!textElement) {
    showSaveBanner("没有可预览的文本元素。", "当前文件没有暴露可运行时替换的文本标识，源文件没有被修改。");
    return;
  }
  const input = findRuntimeTextInput(nodes, textElement.textKey);
  input?.focus();
  input?.select?.();
}

export function applyShortTermRuntimeTextPreview({
  nodes,
  state,
  textKey,
  value,
  renderCommandState
}) {
  if (!state.sourceBytes || !textKey) return;
  const textElement = selectedRuntimeTextElement(state.model?.replaceableElements, textKey);
  if (!textElement) return;
  state.selectedTextKey = textKey;
  setRuntimeTextValue(state, textKey, value);
  const replacement = runtimeTextReplacementView(textElement, state.textPreview, { emptyIsSource: true });
  applyRuntimeTextOverlay(
    nodes.runtimeTextOverlay,
    runtimeTextOverlayCopy(textElement, state.textPreview),
    Boolean(state.textPreview)
  );
  const input = findRuntimeTextInput(nodes, textKey);
  if (input && input.value !== replacement.value) input.value = replacement.value;
  applyRuntimeTextRowReplacementState(
    input?.closest(".textElementRow[data-text-key]"),
    replacement
  );
  renderCommandState();
}

export function resetShortTermRuntimeTextPreview({
  nodes,
  state,
  textKey,
  renderTextElements,
  renderCommandState
}) {
  if (!textKey) {
    state.textPreviewValues = {};
    state.textPreview = "";
    clearRuntimeTextOverlay(nodes.runtimeTextOverlay);
    renderTextElements(state.model?.replaceableElements);
    renderCommandState();
    return;
  }
  setRuntimeTextValue(state, textKey, "");
  if (state.selectedTextKey === textKey) {
    clearRuntimeTextOverlay(nodes.runtimeTextOverlay);
  } else {
    state.textPreview = state.textPreviewValues?.[state.selectedTextKey] || "";
  }
  renderTextElements(state.model?.replaceableElements);
  renderCommandState();
}
