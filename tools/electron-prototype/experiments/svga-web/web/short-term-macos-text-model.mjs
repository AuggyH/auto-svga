export const RUNTIME_TEXT_DEFAULT_VALUE = "SVGA VIP";

export function runtimeTextInputValue(textPreview) {
  return textPreview || RUNTIME_TEXT_DEFAULT_VALUE;
}

export function runtimeTextPlaceholder(textElement) {
  return textElement?.initialText || textElement?.displayName || textElement?.textKey || "";
}

export function runtimeTextOverlayCopy(textElement, textPreview) {
  return `${textElement?.displayName || textElement?.textKey}: ${textPreview}`;
}

export function runtimeTextListView(model, textPreview) {
  const texts = Array.isArray(model?.texts) ? model.texts : [];
  return {
    texts,
    hasTextElements: texts.length > 0,
    emptyCopy: model?.textPreviewCopy || "当前文件没有可运行时预览的文本元素。",
    summaryCopy: texts.length === 0
      ? "未发现可运行时替换的 textKey。"
      : textPreview ? "文本预览已应用，源 SVGA 字节未修改。" : `${texts.length} 个文本元素可运行时预览。`
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
