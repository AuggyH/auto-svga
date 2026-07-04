export function replaceableImageListView(model, selectedImageKey, renameImageKey) {
  const images = Array.isArray(model?.images) ? model.images : [];
  return {
    images,
    rows: images.map((item, index) => ({
      item,
      index,
      selected: item.imageKey === selectedImageKey,
      renaming: item.imageKey === renameImageKey
    })),
    hasImages: images.length > 0,
    emptyCopy: model?.emptyCopy || "没有可替换元素。",
    summaryCopy: `(${images.length})`
  };
}

export function nextReplaceableSelection(imageKey, renameImageKey) {
  const shouldCancelRename = Boolean(renameImageKey && renameImageKey !== imageKey);
  return {
    selectedImageKey: imageKey,
    renameImageKey: shouldCancelRename ? "" : renameImageKey,
    shouldRerender: shouldCancelRename
  };
}
