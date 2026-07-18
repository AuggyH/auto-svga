export function replaceableImageListView(model, selectedImageKey, renameImageKey) {
  const images = Array.isArray(model?.images) ? model.images : [];
  const hasPreview = images.some((item) => item?.replacementActive === true);
  return {
    images,
    rows: images.map((item, index) => ({
      item,
      index,
      selected: item.imageKey === selectedImageKey,
      renaming: item.imageKey === renameImageKey
    })),
    hasImages: images.length > 0,
    emptyCopy: "",
    summaryCopy: replaceableElementSummaryCopy(images.length, hasPreview)
  };
}

export function replaceableElementSummaryCopy(totalCount, hasPreview = false) {
  return `(${Math.max(0, Number(totalCount) || 0)})${hasPreview ? "*" : ""}`;
}

export function nextReplaceableSelection(imageKey, renameImageKey) {
  const shouldCancelRename = Boolean(renameImageKey && renameImageKey !== imageKey);
  return {
    selectedImageKey: imageKey,
    renameImageKey: shouldCancelRename ? "" : renameImageKey,
    shouldRerender: shouldCancelRename
  };
}
