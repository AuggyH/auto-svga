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

export function hasRuntimeTextPreview(textPreviewValues) {
  return Object.values(textPreviewValues || {}).some(Boolean);
}

export function runtimeTextListView(model, textPreviewValues) {
  const texts = Array.isArray(model?.texts) ? model.texts : [];
  return {
    texts: texts.map((item) => ({
      ...item,
      inputValue: runtimeTextInputValue(textPreviewValues, item),
      placeholder: runtimeTextPlaceholder(item),
      resetDisabled: !runtimeTextInputValue(textPreviewValues, item)
    })),
    hasTextElements: texts.length > 0,
    hasTextPreview: hasRuntimeTextPreview(textPreviewValues),
    emptyCopy: model?.textPreviewCopy || "当前文件没有可运行时预览的文本元素。",
    summaryCopy: `(${texts.length})`
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
