export const EDIT_RESERVED_LAYER_LIMIT = 32;

export function editReservedLayerListView(model, displayName) {
  return {
    displayName: displayName || "未打开文件",
    rows: (model?.assets ?? [])
      .filter((asset) => asset.kind !== "audio")
      .slice(0, EDIT_RESERVED_LAYER_LIMIT)
  };
}
