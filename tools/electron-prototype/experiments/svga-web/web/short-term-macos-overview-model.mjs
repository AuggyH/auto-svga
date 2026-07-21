import { overviewFactGroups } from "./short-term-macos-render-model.mjs";

const PLAYBACK_META_FACT_IDS = new Set(["canvas", "fps", "duration"]);
const ASSET_FILTERS = [
  { id: "all", label: "全部" },
  { id: "image", label: "图片" },
  { id: "sequence", label: "序列帧" },
  { id: "audio", label: "音频" }
];

export function assetFilterTabsView(assets = [], audioCount) {
  const counts = new Map(ASSET_FILTERS.map((filter) => [filter.id, 0]));
  counts.set("all", assets.length);
  for (const asset of assets) {
    if (counts.has(asset.kind)) counts.set(asset.kind, (counts.get(asset.kind) ?? 0) + 1);
  }
  if (Number.isSafeInteger(audioCount) && audioCount >= 0) counts.set("audio", audioCount);
  return ASSET_FILTERS.map((filter) => ({
    ...filter,
    count: counts.get(filter.id) ?? 0
  }));
}

export function normalizedOverviewAssets(model) {
  const assets = Array.isArray(model?.assets) ? model.assets : [];
  const audioGroup = model?.overview?.audioGroup;
  const audioCount = audioGroup?.status === "empty"
    ? 0
    : Number.isSafeInteger(audioGroup?.count)
      ? Math.max(0, audioGroup.count)
      : assets.filter((asset) => asset?.kind === "audio").length;
  return audioCount === 0 ? assets.filter((asset) => asset?.kind !== "audio") : assets;
}

export function assetFilterTabCopy(tab) {
  return tab?.count > 0 ? `${tab.label} (${tab.count})` : tab?.label || "";
}

export function assetFilterEmptyCopy(filter) {
  if (filter === "sequence") return "当前文件暂无序列帧资产";
  if (filter === "audio") return "当前文件暂无音频资产";
  return "";
}

export function normalizedAssetFilter(filter, assets = []) {
  const tabs = assetFilterTabsView(assets);
  return tabs.some((tab) => tab.id === filter) ? filter : "all";
}

function assetFilterIndex(filter, tabs = ASSET_FILTERS) {
  const index = tabs.findIndex((tab) => tab.id === filter);
  return index >= 0 ? index : 0;
}

export function nextAssetFilterForKey(currentFilter, key, tabs = ASSET_FILTERS) {
  if (!tabs.length) return currentFilter || "all";
  const currentIndex = assetFilterIndex(currentFilter, tabs);
  if (key === "ArrowRight" || key === "ArrowDown") {
    return tabs[(currentIndex + 1) % tabs.length].id;
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    return tabs[currentIndex > 0 ? currentIndex - 1 : tabs.length - 1].id;
  }
  if (key === "Home") return tabs[0].id;
  if (key === "End") return tabs[tabs.length - 1].id;
  return tabs[currentIndex].id;
}

export function assetFilterFocusTarget(activeFilter, previousFocusedFilter) {
  return previousFocusedFilter ? activeFilter : "";
}

export function filteredAssetsForTab(assets = [], filter = "all") {
  if (filter === "all") return assets;
  return assets.filter((asset) => asset.kind === filter);
}

export function overviewTabView(model) {
  const overviewFacts = model?.overview?.facts ?? [];
  const assets = normalizedOverviewAssets(model);
  const audioCount = model?.overview?.audioGroup?.status === "empty"
    ? 0
    : model?.overview?.audioGroup?.count;
  const factGroups = overviewFactGroups(model);
  return {
    facts: factGroups.summary,
    moreInfoFacts: factGroups.moreInfo,
    assets,
    assetTabs: assetFilterTabsView(assets, audioCount),
    playbackMeta: overviewFacts
      .filter((fact) => PLAYBACK_META_FACT_IDS.has(fact.id))
      .map((fact) => fact.value)
      .filter(Boolean)
      .join(" / ")
  };
}
