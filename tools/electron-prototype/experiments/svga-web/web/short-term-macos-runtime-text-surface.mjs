import {
  runtimeTextReplacementView,
  selectedRuntimeTextElement
} from "./short-term-macos-text-model.mjs";
import { applyRuntimeTextRowReplacementState } from "./short-term-macos-replaceable-renderers.mjs";
import { clearRuntimeTextOverlay } from "./short-term-macos-text-renderers.mjs";
import {
  applySvgaRuntimeTextTarget,
  resetSvgaRuntimeTextTarget
} from "./short-term-macos-svga-runtime-text-model.mjs";

function findRuntimeTextInput(nodes, textKey) {
  return [nodes.textElementList, nodes.replaceableList]
    .flatMap((list) => Array.from(list?.querySelectorAll?.("[data-text-input]") || []))
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
  renderCommandState,
  showSaveBanner
}) {
  if (!state.sourceBytes || !textKey) return;
  const textElement = selectedRuntimeTextElement(state.model?.replaceableElements, textKey);
  if (!textElement) return;
  const replacement = runtimeTextReplacementView(textElement, value, {
    emptyIsSource: true,
    initialIsSource: false
  });
  const targetResult = replacement.hasPreview
    ? applySvgaRuntimeTextTarget(state.primaryPlayback, textElement.imageKey, replacement.value)
    : resetSvgaRuntimeTextTarget(state.primaryPlayback, textElement.imageKey);
  if (replacement.hasPreview && !targetResult.applied) {
    showSaveBanner?.(
      "文本预览未应用。",
      `播放器未能把运行时文本绑定到 ${textElement.imageKey}；源文件没有被修改。`
    );
    return;
  }
  state.selectedTextKey = textKey;
  setRuntimeTextValue(state, textKey, replacement.hasPreview ? replacement.value : "");
  clearRuntimeTextOverlay(nodes.runtimeTextOverlay);
  const input = findRuntimeTextInput(nodes, textKey);
  applyRuntimeTextRowReplacementState(
    input?.closest(".textElementRow") ?? input?.closest(".replaceableRow"),
    replacement
  );
  renderCommandState();
}

export function restoreShortTermRuntimeTextPreviews(state) {
  const appliedImageKeys = [];
  for (const [textKey, value] of Object.entries(state.textPreviewValues || {})) {
    if (!value) continue;
    const textElement = selectedRuntimeTextElement(state.model?.replaceableElements, textKey);
    const result = textElement
      ? applySvgaRuntimeTextTarget(state.primaryPlayback, textElement.imageKey, value)
      : { applied: false };
    if (!result.applied) {
      for (const imageKey of appliedImageKeys) {
        resetSvgaRuntimeTextTarget(state.primaryPlayback, imageKey);
      }
      return false;
    }
    appliedImageKeys.push(textElement.imageKey);
  }
  return true;
}

export function resetShortTermRuntimeTextPreview({
  nodes,
  state,
  textKey,
  renderTextElements,
  renderCommandState
}) {
  if (!textKey) {
    for (const activeTextKey of Object.keys(state.textPreviewValues || {})) {
      const activeTextElement = selectedRuntimeTextElement(state.model?.replaceableElements, activeTextKey);
      resetSvgaRuntimeTextTarget(state.primaryPlayback, activeTextElement?.imageKey);
      const activeInput = findRuntimeTextInput(nodes, activeTextKey);
      if (activeInput) activeInput.value = "";
      applyRuntimeTextRowReplacementState(
        activeInput?.closest(".textElementRow") ?? activeInput?.closest(".replaceableRow"),
        runtimeTextReplacementView(activeTextElement, "", {
          emptyIsSource: true,
          initialIsSource: false
        })
      );
    }
    state.textPreviewValues = {};
    state.textPreview = "";
    clearRuntimeTextOverlay(nodes.runtimeTextOverlay);
    renderTextElements(state.model?.replaceableElements);
    renderCommandState();
    return;
  }
  const textElement = selectedRuntimeTextElement(state.model?.replaceableElements, textKey);
  resetSvgaRuntimeTextTarget(state.primaryPlayback, textElement?.imageKey);
  setRuntimeTextValue(state, textKey, "");
  const input = findRuntimeTextInput(nodes, textKey);
  if (input) input.value = "";
  applyRuntimeTextRowReplacementState(
    input?.closest(".textElementRow") ?? input?.closest(".replaceableRow"),
    runtimeTextReplacementView(textElement, "", {
      emptyIsSource: true,
      initialIsSource: false
    })
  );
  if (state.selectedTextKey === textKey) {
    clearRuntimeTextOverlay(nodes.runtimeTextOverlay);
  } else {
    state.textPreview = state.textPreviewValues?.[state.selectedTextKey] || "";
  }
  renderTextElements(state.model?.replaceableElements);
  renderCommandState();
}
