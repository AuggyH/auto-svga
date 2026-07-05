import { escapeHtml } from "./short-term-macos-render-model.mjs";
import { renderThumbnailHtml } from "./short-term-macos-thumbnail-renderers.mjs";

export function createEditLayerRow(asset, model) {
  const row = document.createElement("article");
  row.className = "assetRow";
  row.dataset.component = "LayerRow";
  row.innerHTML = `
    <span class="thumb ${asset.kind === "sequence" ? "sequence" : ""}">${renderThumbnailHtml(asset.thumbnail, model)}</span>
    <span class="rowText"><strong>${escapeHtml(asset.name)}</strong></span>
  `;
  return row;
}

export function renderEditReservedLayers(nodes, view, model) {
  nodes.layerPanel.replaceChildren(...view.rows.map((asset) => createEditLayerRow(asset, model)));
}
