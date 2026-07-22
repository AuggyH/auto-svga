export function replaceableImageListView(model, selectedImageKey, renameImageKey, textPreviewValues = {}) {
  const images = Array.isArray(model?.images) ? model.images : [];
  return {
    images,
    rows: images.map((item, index) => ({
      item: {
        ...item,
        textKey: item.imageKey,
        initialText: "SVGA VIP",
        textPreviewValue: textPreviewValues[item.imageKey] || ""
      },
      index,
      selected: item.imageKey === selectedImageKey,
      renaming: item.imageKey === renameImageKey
    })),
    hasImages: images.length > 0,
    emptyCopy: "",
    summaryCopy: replaceableElementSummaryCopy(images.length)
  };
}

export function replaceableElementSummaryCopy(totalCount) {
  return `(${Math.max(0, Number(totalCount) || 0)})`;
}

export function nextReplaceableSelection(imageKey, renameImageKey) {
  const shouldCancelRename = Boolean(renameImageKey && renameImageKey !== imageKey);
  return {
    selectedImageKey: imageKey,
    renameImageKey: shouldCancelRename ? "" : renameImageKey,
    shouldRerender: shouldCancelRename
  };
}
