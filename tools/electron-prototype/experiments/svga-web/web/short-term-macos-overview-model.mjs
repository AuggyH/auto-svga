import { overviewFactGroups } from "./short-term-macos-render-model.mjs";

const PLAYBACK_META_FACT_IDS = new Set(["canvas", "fps", "duration"]);
const ASSET_FILTERS = [
  { id: "all", label: "全部" },
  { id: "image", label: "图片" },
  { id: "sequence", label: "序列帧" },
  { id: "audio", label: "音频" }
];

export function assetFilterTabsView(assets = []) {
  const counts = new Map(ASSET_FILTERS.map((filter) => [filter.id, 0]));
  counts.set("all", assets.length);
  for (const asset of assets) {
    if (counts.has(asset.kind)) counts.set(asset.kind, (counts.get(asset.kind) ?? 0) + 1);
  }
  return ASSET_FILTERS.map((filter) => ({
    ...filter,
    count: counts.get(filter.id) ?? 0
  }));
}

export function normalizedAssetFilter(filter, assets = []) {
  const tabs = assetFilterTabsView(assets);
  return tabs.some((tab) => tab.id === filter) ? filter : "all";
}

export function filteredAssetsForTab(assets = [], filter = "all") {
  if (filter === "all") return assets;
  return assets.filter((asset) => asset.kind === filter);
}

export function overviewTabView(model) {
  const overviewFacts = model?.overview?.facts ?? [];
  const assets = Array.isArray(model?.assets) ? model.assets : [];
  const factGroups = overviewFactGroups(model);
  return {
    facts: factGroups.summary,
    moreInfoFacts: factGroups.moreInfo,
    assets,
    assetTabs: assetFilterTabsView(assets),
    playbackMeta: overviewFacts
      .filter((fact) => PLAYBACK_META_FACT_IDS.has(fact.id))
      .map((fact) => fact.value)
      .filter(Boolean)
      .join(" / ")
  };
}
