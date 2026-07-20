import { escapeHtml } from "./short-term-macos-render-model.mjs";
import { renderThumbnailHtml } from "./short-term-macos-thumbnail-renderers.mjs";

export function createEditLayerRow(asset, model) {
  const row = document.createElement("article");
  const thumbnailVariant = asset.kind === "sequence" ? "sequence" : "image";
  row.className = "layerRow";
  row.dataset.component = "LayerRow";
  row.innerHTML = `
    <span class="thumb ${thumbnailVariant === "sequence" ? "sequence" : ""}" data-component="ThumbnailFrame" data-variant="${thumbnailVariant}">${renderThumbnailHtml(asset.thumbnail, model)}</span>
    <span class="layerRowText"><strong>${escapeHtml(asset.name)}</strong></span>
  `;
  return row;
}

export function createEditLayerHeader(view) {
  const header = document.createElement("header");
  header.className = "layerPanelHeader";
  header.dataset.component = "RightInformationSurface";
  header.innerHTML = `<h1>${escapeHtml(view.displayName)}</h1>`;
  return header;
}

export function createEditLayerList(view, model) {
  const list = document.createElement("section");
  list.className = "layerList";
  list.dataset.component = "LayerRow";
  list.replaceChildren(...view.rows.map((asset) => createEditLayerRow(asset, model)));
  return list;
}

export function renderEditReservedLayers(nodes, view, model) {
  nodes.layerPanel.replaceChildren(
    createEditLayerHeader(view),
    createEditLayerList(view, model)
  );
}
