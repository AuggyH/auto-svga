import { replaceableElementSummaryCopy } from "./short-term-macos-replaceable-model.mjs";

export const RUNTIME_TEXT_DEFAULT_VALUE = "SVGA VIP";

export function runtimeTextInputValue(textPreviewValues, textElement) {
  return textPreviewValues?.[textElement?.textKey] || "";
}

export function runtimeTextPlaceholder(textElement) {
  return textElement?.initialText || textElement?.displayName || textElement?.textKey || "";
}

export function runtimeTextOverlayCopy(textElement, textPreview) {
  return `${textElement?.displayName || textElement?.textKey}: ${textPreview}`;
}

export function runtimeTextReplacementView(textElement, inputValue, options = {}) {
  const initialValue = typeof textElement?.initialText === "string" ? textElement.initialText : "";
  const value = typeof inputValue === "string" ? inputValue : "";
  const sourceEquivalent = value === initialValue
    || (options.emptyIsSource === true && value === "");
  return {
    value,
    initialValue,
    hasPreview: !sourceEquivalent,
    resetDisabled: sourceEquivalent,
    replacementState: sourceEquivalent ? "source" : "preview"
  };
}

export function hasRuntimeTextPreview(textPreviewValues) {
  return Object.values(textPreviewValues || {}).some(Boolean);
}

export function runtimeTextListView(model, textPreviewValues) {
  const texts = Array.isArray(model?.texts) ? model.texts : [];
  const images = Array.isArray(model?.images) ? model.images : [];
  const hasImagePreview = images.some((item) => item?.replacementActive === true);
  const hasTextPreview = hasRuntimeTextPreview(textPreviewValues);
  return {
    texts: texts.map((item) => {
      const inputValue = runtimeTextInputValue(textPreviewValues, item);
      const replacement = runtimeTextReplacementView(item, inputValue, { emptyIsSource: true });
      return {
        ...item,
        inputValue,
        placeholder: runtimeTextPlaceholder(item),
        resetDisabled: replacement.resetDisabled
      };
    }),
    hasTextElements: texts.length > 0,
    hasTextPreview,
    emptyCopy: "",
    summaryCopy: replaceableElementSummaryCopy(images.length + texts.length, hasImagePreview || hasTextPreview)
  };
}

export function nextSelectedTextKey(selectedTextKey, texts) {
  return selectedTextKey && texts.some((item) => item.textKey === selectedTextKey)
    ? selectedTextKey
    : texts[0]?.textKey || "";
}

export function selectedRuntimeTextElement(model, selectedTextKey) {
  const texts = Array.isArray(model?.texts) ? model.texts : [];
  return texts.find((item) => item.textKey === selectedTextKey);
}
