import {
  escapeHtml,
  renderOverviewFactCellHtml
} from "./short-term-macos-render-model.mjs";
import {
  assetFilterFocusTarget,
  filteredAssetsForTab,
  normalizedAssetFilter
} from "./short-term-macos-overview-model.mjs";
import { renderThumbnailHtml } from "./short-term-macos-thumbnail-renderers.mjs";

export function createOverviewFactCell(fact) {
  const cell = document.createElement("article");
  cell.className = "factCell";
  cell.dataset.component = "FactCell";
  cell.dataset.role = "ProductionSpecInlineRow";
  cell.dataset.factId = fact.id;
  cell.dataset.status = fact.status;
  cell.title = `${fact.label}: ${fact.value}`;
  cell.innerHTML = renderOverviewFactCellHtml(fact);
  return cell;
}

export function createOverviewMoreInfoDisclosure(facts) {
  const disclosure = document.createElement("details");
  disclosure.className = "factMoreInfo";
  disclosure.dataset.component = "RuntimeStructureMoreInfo";

  const summary = document.createElement("summary");
  summary.textContent = "更多信息";

  const grid = document.createElement("div");
  grid.className = "factMoreInfoGrid";
  grid.replaceChildren(...facts.map(createOverviewFactCell));

  disclosure.replaceChildren(summary, grid);
  return disclosure;
}

export function createAssetRow(asset, model) {
  const row = document.createElement("article");
  row.className = "assetRow";
  row.dataset.component = asset.kind === "sequence" ? "SequenceThumbnail" : asset.kind === "audio" ? "AudioAssetRow" : "AssetRow";
  row.dataset.kind = asset.kind;
  row.dataset.attention = asset.findingCodes.length > 0 ? "true" : "false";
  const detail = asset.kind === "audio" && model.overview.audioGroup.status === "empty"
    ? model.overview.audioGroup.copy
    : `${asset.dimensions} · ${asset.fileSize}`;
  const badgeCopy = asset.findingCodes.length > 0
    ? "需关注"
    : "";
  const badgeClass = asset.findingCodes.length > 0 ? " review" : "";
  row.title = `${asset.name} ${detail}`;
  row.innerHTML = `
    <span class="thumb ${asset.kind === "sequence" ? "sequence" : asset.kind === "audio" ? "audio" : ""}">${renderThumbnailHtml(asset.thumbnail, model)}</span>
    <span class="rowText"><strong>${escapeHtml(asset.name)}</strong><span>${escapeHtml(detail)}</span></span>
    ${badgeCopy ? `<span class="badge${badgeClass}">${escapeHtml(badgeCopy)}</span>` : ""}
  `;
  return row;
}

export function renderOverviewFacts(nodes, view) {
  const children = view.facts.map(createOverviewFactCell);
  if (Array.isArray(view.moreInfoFacts) && view.moreInfoFacts.length > 0) {
    children.push(createOverviewMoreInfoDisclosure(view.moreInfoFacts));
  }
  nodes.factGrid.replaceChildren(...children);
}

export function renderAssetFilterTabs(nodes, view, activeFilter) {
  if (!nodes.assetFilterTabs) return;
  const tabs = view.assetTabs ?? [];
  const activeElement = nodes.assetFilterTabs.ownerDocument?.activeElement;
  const previousFocusedFilter = nodes.assetFilterTabs.contains(activeElement)
    ? activeElement?.dataset?.assetFilter || ""
    : "";
  nodes.assetFilterTabs.replaceChildren(...tabs.map((tab) => {
    const selected = tab.id === activeFilter;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.component = "TabItem";
    button.dataset.action = "asset-filter";
    button.dataset.assetFilter = tab.id;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", selected ? "true" : "false");
    button.tabIndex = selected ? 0 : -1;
    button.classList.toggle("isSelected", selected);
    button.textContent = `${tab.label} (${tab.count})`;
    return button;
  }));
  const focusTarget = assetFilterFocusTarget(activeFilter, previousFocusedFilter);
  if (!focusTarget) return;
  const nextFocus = [...nodes.assetFilterTabs.querySelectorAll("[data-action='asset-filter']")]
    .find((button) => button.dataset.assetFilter === focusTarget);
  nextFocus?.focus({ preventScroll: true });
}

export function renderAssetList(nodes, view, model, activeFilter = "all") {
  const nextFilter = normalizedAssetFilter(activeFilter, view.assets);
  const visibleAssets = filteredAssetsForTab(view.assets, nextFilter);
  if (nodes.assetListHeading) nodes.assetListHeading.textContent = `资产列表 (${view.assets.length})`;
  renderAssetFilterTabs(nodes, view, nextFilter);
  nodes.assetList.replaceChildren(...visibleAssets.map((asset) => createAssetRow(asset, model)));
}
