import {
  escapeHtml,
  renderOverviewFactCellHtml
} from "./short-term-macos-render-model.mjs";
import { renderThumbnailHtml } from "./short-term-macos-thumbnail-renderers.mjs";

export function createOverviewFactCell(fact) {
  const cell = document.createElement("article");
  cell.className = "factCell";
  cell.dataset.component = "ProductionSpecInlineRow";
  cell.dataset.status = fact.status;
  cell.title = `${fact.label}: ${fact.value}`;
  cell.innerHTML = renderOverviewFactCellHtml(fact);
  return cell;
}

export function createAssetRow(asset, model) {
  const row = document.createElement("article");
  row.className = "assetRow";
  row.dataset.component = asset.kind === "sequence" ? "SequenceThumbnail" : asset.kind === "audio" ? "AudioAssetRow" : "AssetRow";
  row.dataset.kind = asset.kind;
  row.dataset.attention = asset.findingCodes.length > 0 ? "true" : "false";
  const detail = asset.kind === "audio" && model.overview.audioGroup.status === "empty"
    ? model.overview.audioGroup.copy
    : `${asset.dimensions} · ${asset.fileSize} · ${asset.usageCount} 次引用`;
  const badgeCopy = asset.findingCodes.length > 0
    ? "需关注"
    : asset.kind === "sequence" ? "序列" : asset.kind === "audio" ? "音频" : asset.replaceable ? "可替换" : "图片";
  const badgeClass = asset.findingCodes.length > 0 ? " review" : "";
  row.title = `${asset.name} ${detail}`;
  row.innerHTML = `
    <span class="thumb ${asset.kind === "sequence" ? "sequence" : asset.kind === "audio" ? "audio" : ""}">${renderThumbnailHtml(asset.thumbnail, model)}</span>
    <span class="rowText"><strong>${escapeHtml(asset.name)}</strong><span>${escapeHtml(detail)}</span></span>
    <span class="badge${badgeClass}">${escapeHtml(badgeCopy)}</span>
  `;
  return row;
}

export function renderOverviewFacts(nodes, view) {
  nodes.factGrid.replaceChildren(...view.facts.map(createOverviewFactCell));
}

export function renderAssetList(nodes, view, model) {
  nodes.assetList.replaceChildren(...view.assets.map((asset) => createAssetRow(asset, model)));
}
