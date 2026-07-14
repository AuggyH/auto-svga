import {
  dragDecisionZoneForEvent,
  dragFileFromEvent
} from "./short-term-macos-drag-decision-model.mjs";

const multiFormatDropPattern = /\.(svga|json|mp4)$/i;
const svgaDropPattern = /\.svga$/i;

const commonFactIds = new Set([
  "format",
  "dimensions",
  "duration",
  "layers",
  "assets",
  "replaceable",
  "unsupported"
]);

const formatFactIds = Object.freeze({
  svga: commonFactIds,
  lottie: commonFactIds,
  vap: new Set([...commonFactIds, "videoCodec", "audio"])
});

const formatInventoryGroups = Object.freeze({
  svga: new Set([
    "image_resources",
    "text_candidates",
    "sequence_frames",
    "audio_video_media",
    "unsupported_or_missing",
    "other_resources"
  ]),
  lottie: new Set([
    "image_resources",
    "text_candidates",
    "sequence_frames",
    "unsupported_or_missing",
    "other_resources"
  ]),
  vap: new Set([
    "vap_fusion_images",
    "vap_fusion_texts",
    "audio_video_media",
    "unsupported_or_missing",
    "other_resources"
  ])
});

const internalPhasePattern = /(?:hidden_0\.2_spike|source-side preview contract|preview candidate)/iu;

const inventorySummaryDefinitions = Object.freeze([
  { id: "images", label: "图片", key: "imageCount" },
  { id: "texts", label: "文本", key: "textCount" },
  { id: "sequences", label: "序列", key: "sequenceFrameCount" },
  { id: "media", label: "媒体", key: "audioVideoCount" },
  { id: "issues", label: "问题", key: "unsupportedOrMissingCount" }
]);

const inventoryGroupLabels = new Map([
  ["image_resources", "图片"],
  ["text_candidates", "文本"],
  ["vap_fusion_images", "VAP 融合图片"],
  ["vap_fusion_texts", "VAP 融合文字"],
  ["sequence_frames", "序列帧"],
  ["audio_video_media", "音视频"],
  ["unsupported_or_missing", "不支持或缺失"],
  ["other_resources", "其他资源"]
]);

const inventoryItemLabels = new Map([
  ["Video track", "视频轨道"],
  ["Audio track", "音频轨道"]
]);

const assetKindLabels = new Map([
  ["image", "图片"],
  ["sequence", "序列帧"],
  ["audio", "音频"],
  ["video", "视频"],
  ["text", "文本"]
]);

export function multiFormatDragDecisionForEvent(target, event, options = {}) {
  const file = dragFileFromEvent(event);
  const supported = !file || multiFormatDropPattern.test(file.name || "");
  const compareAvailable = options.activeFormat === "svga"
    && (!file || svgaDropPattern.test(file.name || ""));
  return {
    file,
    focusZone: compareAvailable ? dragDecisionZoneForEvent(target, event) : "open",
    supported,
    compareAvailable
  };
}

export function multiFormatInventorySummaryItems(summary = {}) {
  return inventorySummaryDefinitions.flatMap(({ id, label, key }) => {
    const count = Math.max(0, Number(summary[key]) || 0);
    return count > 0 ? [{ id, label, count }] : [];
  });
}

export function projectMultiFormatRightPanel(model = {}) {
  const format = model.detectedFormat;
  const source = model.rightPanel ?? {};
  const allowedFacts = formatFactIds[format] ?? commonFactIds;
  const facts = (source.facts ?? [])
    .filter((fact) => allowedFacts.has(fact.id))
    .map((fact) => ({ ...fact, value: localizeOwnerText(fact.value) }));
  const inventory = projectInventory(source.assetInventory, format);
  return {
    ...source,
    facts,
    assets: (source.assets ?? []).map(projectFallbackAsset),
    assetInventory: inventory,
    unsupportedFeatures: (source.unsupportedFeatures ?? [])
      .filter(isOwnerVisibleUnsupportedFeature)
      .map((entry) => ({ ...entry, feature: ownerCopy(entry.feature), path: ownerCopy(entry.path) })),
    issues: (source.issues ?? [])
      .filter(isOwnerVisibleIssue)
      .map((issue) => ({ ...issue, message: ownerCopy(issue.message) }))
  };
}

function projectFallbackAsset(asset) {
  return {
    ...asset,
    ownerKind: assetKindLabels.get(asset.kind) ?? "资源",
    fileSize: formatOwnerBytes(asset.sizeBytes),
    resolutionStatus: localizeAssetStatus(asset.resolutionStatus)
  };
}

export function containMotionMedia({ width, height }, { width: availableWidth, height: availableHeight }) {
  const mediaWidth = finitePositive(width);
  const mediaHeight = finitePositive(height);
  const stageWidth = finitePositive(availableWidth);
  const stageHeight = finitePositive(availableHeight);
  if (!mediaWidth || !mediaHeight || !stageWidth || !stageHeight) {
    return { width: 0, height: 0, scale: 0 };
  }
  const scale = Math.min(stageWidth / mediaWidth, stageHeight / mediaHeight);
  return {
    width: Math.max(1, Math.round(mediaWidth * scale)),
    height: Math.max(1, Math.round(mediaHeight * scale)),
    scale
  };
}

export function isOwnerVisibleIssue(issue) {
  return issue && !internalPhasePattern.test(`${issue.code ?? ""} ${issue.message ?? ""}`);
}

function isOwnerVisibleUnsupportedFeature(entry) {
  return entry && !internalPhasePattern.test(`${entry.feature ?? ""} ${entry.path ?? ""}`);
}

function projectInventory(inventory, format) {
  if (!inventory) return inventory;
  const allowedGroups = formatInventoryGroups[format] ?? new Set();
  const groups = (inventory.groups ?? []).flatMap((group) => {
    if (!allowedGroups.has(group.id) || group.status === "not_applicable") return [];
    const items = (group.items ?? []).filter((item) => (
      item.status !== "not_applicable"
      && item.source !== "capability"
      && !internalPhasePattern.test(`${item.label ?? ""} ${(item.detail ?? []).join(" ")}`)
    ));
    if (items.length === 0) return [];
    return [{
      ...group,
      label: inventoryGroupLabels.get(group.id) ?? ownerCopy(group.label),
      count: items.length,
      replaceableCount: items.filter(({ replaceable }) => replaceable).length,
      items: items.map(projectInventoryItem)
    }];
  });
  const summary = {
    totalItems: groups.reduce((sum, group) => sum + group.count, 0),
    replaceableItems: groups.reduce((sum, group) => sum + group.replaceableCount, 0),
    imageCount: countGroups(groups, ["image_resources", "vap_fusion_images"]),
    textCount: countGroups(groups, ["text_candidates", "vap_fusion_texts"]),
    sequenceFrameCount: countGroups(groups, ["sequence_frames"]),
    audioVideoCount: countGroups(groups, ["audio_video_media"]),
    unsupportedOrMissingCount: countGroups(groups, ["unsupported_or_missing"])
  };
  return {
    ...inventory,
    groups,
    summary,
    capabilityMarkers: []
  };
}

function projectInventoryItem(item) {
  const detail = (item.detail ?? []).map(localizeOwnerText).filter(Boolean);
  const issueLabel = item.source === "issue" ? detail[0] : "";
  return {
    ...item,
    label: issueLabel || inventoryItemLabels.get(item.label) || ownerCopy(item.label),
    detail: issueLabel ? detail.slice(1) : detail
  };
}

function countGroups(groups, ids) {
  return groups
    .filter(({ id }) => ids.includes(id))
    .reduce((sum, group) => sum + group.count, 0);
}

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function formatOwnerBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes >= 1024 * 1024) return `${trimDecimal(bytes / (1024 * 1024))} MiB`;
  if (bytes >= 1024) return `${trimDecimal(bytes / 1024)} KiB`;
  return `${Math.round(bytes)} B`;
}

function trimDecimal(value) {
  return value.toFixed(value >= 10 ? 0 : 1).replace(/\.0$/u, "");
}

function localizeAssetStatus(value) {
  const status = String(value ?? "").trim().toLowerCase();
  if (["missing", "unresolved"].includes(status)) return "缺失";
  if (["unsupported", "blocked"].includes(status)) return "不支持";
  if (["oversized", "too_large"].includes(status)) return "尺寸过大";
  return "";
}

function ownerCopy(value) {
  return String(value ?? "")
    .replace(/preview candidate/giu, "file")
    .replace(/candidate/giu, "file");
}

function localizeOwnerText(value) {
  const copy = ownerCopy(value);
  const exact = new Map([
    ["initial text present", "包含初始文字"],
    ["replacement required", "需要替换"],
    ["unsupported fusion kind", "不支持的融合类型"],
    ["present", "存在"],
    ["not present", "不存在"],
    ["not applicable", "不适用"],
    ["unknown", "未知"]
  ]).get(copy);
  if (exact) return exact;
  return copy
    .replace(/^codec:/iu, "编码：")
    .replace(/^(\d+) placement sample\(s\)$/iu, "$1 个位置样本");
}
