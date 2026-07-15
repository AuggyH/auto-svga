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

const inventoryGroupLabels = Object.freeze({
  image_resources: "图片",
  text_candidates: "文本",
  vap_fusion_images: "VAP 融合图片",
  vap_fusion_texts: "VAP 融合文字",
  sequence_frames: "序列帧",
  audio_video_media: "音视频",
  unsupported_or_missing: "不支持或缺失",
  other_resources: "其他资源"
});

const inventoryItemLabels = Object.freeze({
  "Video track": "视频轨道",
  "Audio track": "音频轨道"
});

const assetKindLabels = Object.freeze({
  image: "图片",
  sequence: "序列帧",
  audio: "音频",
  video: "视频",
  text: "文本"
});

const ownerIssueCopyByCode = Object.freeze({
  missing_resource: Object.freeze({ code: "missing_resource", message: "预览所需资源缺失。" }),
  unsupported_feature: Object.freeze({ code: "unsupported_feature", message: "当前文件包含暂不支持的内容。" }),
  parse_precondition: Object.freeze({ code: "invalid_file", message: "文件内容不完整或格式异常，无法预览。" }),
  asset_reference_precondition: Object.freeze({ code: "invalid_file", message: "文件内容不完整或格式异常，无法预览。" }),
  playback_failure: Object.freeze({ code: "playback_failure", message: "文件预览播放出现问题。" })
});

const ownerUnsupportedFeatureLabels = Object.freeze({
  expression: "表达式",
  mask: "蒙版",
  effect: "特效",
  time_remap: "时间重映射",
  "3d_layer": "3D 图层",
  camera_layer: "摄像机图层",
  solid_layer: "纯色图层",
  embedded_image_asset: "内嵌图片资源",
  non_h264_video_codec: "非 H.264 视频编码",
  unknown_fusion_source_type: "未识别的融合元素类型"
});

const ownerFactLabelsById = Object.freeze({
  format: "格式",
  dimensions: "画布",
  duration: "时长",
  layers: "图层",
  assets: "资源",
  replaceable: "可替换",
  unsupported: "不支持特性",
  videoCodec: "视频编码",
  audio: "音频"
});

const ownerProjectionSchemas = Object.freeze({
  rightPanel: Object.freeze(["facts", "assets", "assetInventory", "unsupportedFeatures", "issues"]),
  fact: Object.freeze(["id", "label", "value", "status"]),
  asset: Object.freeze(["id", "name", "kind", "dimensions", "replaceable", "ownerKind", "fileSize", "resolutionStatus"]),
  inventory: Object.freeze(["schemaVersion", "pathRedacted", "format", "groups", "summary", "capabilityMarkers"]),
  inventorySummary: Object.freeze(["totalItems", "replaceableItems", "imageCount", "textCount", "sequenceFrameCount", "audioVideoCount", "unsupportedOrMissingCount"]),
  inventoryGroup: Object.freeze(["id", "label", "count", "replaceableCount", "status", "items"]),
  inventoryItem: Object.freeze(["id", "label", "groupId", "kind", "source", "status", "replaceable", "runtimeTargetId", "detail", "issueCode", "severity", "pathRedacted"]),
  issue: Object.freeze(["code", "severity", "message", "pathRedacted"]),
  unsupportedFeature: Object.freeze(["code", "severity", "feature", "path", "message", "pathRedacted"])
});

const ownerFactStatuses = new Set(["pass", "warning", "fail", "unknown"]);
const ownerIssueSeverities = new Set(["info", "warning", "error"]);
const ownerInventorySources = new Set(["asset", "text", "fusion", "media", "issue", "capability"]);
const ownerInventoryStatuses = new Set(["available", "replaceable", "missing", "unsupported", "blocked", "not_applicable"]);
const ownerGroupStatuses = new Set(["available", "empty", "warning", "blocked", "not_applicable"]);
const ownerAssetKinds = new Set(["image", "sequence", "audio", "video", "text"]);
const ownerFormats = new Set(["svga", "lottie", "vap"]);
const ownerPathPattern = /(?:file:\/\/|(?:^|[\s"'(=])\/(?:Users|Volumes|private|tmp|var|home)\/|[A-Za-z]:[\\/]|\\\\Users\\)/iu;

const genericOwnerIssue = Object.freeze({
  code: "owner_issue",
  message: "当前文件存在无法显示的检查问题。"
});
const genericUnsupportedFeatureMessage = "当前文件包含暂不支持的内容。";

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
    const count = Math.max(0, ownFiniteNumber(summary, key) ?? 0);
    return count > 0 ? [{ id, label, count }] : [];
  });
}

export function projectMultiFormatRightPanel(model = {}) {
  const candidateFormat = ownString(model, "detectedFormat");
  const format = ownerFormats.has(candidateFormat) ? candidateFormat : "";
  const source = ownRecord(model, "rightPanel") ?? {};
  const allowedFacts = formatFactIds[format] ?? commonFactIds;
  const facts = ownArrayValues(source, "facts")
    .flatMap((fact) => projectOwnerFact(fact, allowedFacts));
  const assets = ownArrayValues(source, "assets")
    .flatMap((asset, index) => projectFallbackAsset(asset, index));
  const inventory = projectInventory(ownRecord(source, "assetInventory"), format);
  const unsupportedFeatures = ownArrayValues(source, "unsupportedFeatures")
    .filter(isOwnerVisibleUnsupportedFeature)
    .map(projectOwnerUnsupportedFeature);
  const issues = ownArrayValues(source, "issues")
    .filter(isOwnerVisibleIssue)
    .map(projectOwnerIssue);
  return buildOwnerRecord("rightPanel", {
    facts,
    assets,
    assetInventory: inventory,
    unsupportedFeatures,
    issues
  });
}

function projectOwnerFact(fact, allowedFacts) {
  if (!isProjectionRecord(fact)) return [];
  const id = ownString(fact, "id");
  if (!allowedFacts.has(id) || !hasOwn(ownerFactLabelsById, id)) return [];
  return [buildOwnerRecord("fact", {
    id,
    label: ownerFactLabelsById[id],
    value: ownerFactValue(id, ownString(fact, "value")),
    status: ownerFactStatuses.has(ownString(fact, "status"))
      ? ownString(fact, "status")
      : "unknown"
  })];
}

function ownerFactValue(id, value) {
  if (typeof value !== "string") return "未知";
  if (id === "format") {
    return ["SVGA", "LOTTIE", "VAP"].includes(value) ? value : "未知";
  }
  if (id === "dimensions") {
    return /^\d{1,6}\s*[x×]\s*\d{1,6}$/u.test(value) ? value : "未知";
  }
  if (id === "duration") {
    return /^\d+(?:\.\d+)?s$/u.test(value) ? value : "未知";
  }
  if (["layers", "assets", "replaceable", "unsupported"].includes(id)) {
    return /^\d+$/u.test(value) ? value : "未知";
  }
  if (id === "videoCodec") {
    return /^[A-Za-z0-9._-]{1,32}$/u.test(value) ? value : "未知";
  }
  if (id === "audio") {
    return value === "present" ? "存在" : value === "not present" ? "不存在" : "未知";
  }
  return "未知";
}

function projectFallbackAsset(asset, index) {
  if (!isProjectionRecord(asset)) return [];
  const safeId = ownerIdentifier(ownString(asset, "id")) || `asset-${index}`;
  const safeName = ownerDisplayText(ownString(asset, "name")) || safeId;
  const candidateKind = ownString(asset, "kind");
  const kind = ownerAssetKinds.has(candidateKind) ? candidateKind : "unknown";
  return [buildOwnerRecord("asset", {
    id: safeId,
    name: safeName,
    kind,
    dimensions: ownerDimensions(ownString(asset, "dimensions")),
    replaceable: ownBoolean(asset, "replaceable") === true,
    ownerKind: hasOwn(assetKindLabels, kind) ? assetKindLabels[kind] : "资源",
    fileSize: formatOwnerBytes(ownFiniteNumber(asset, "sizeBytes")),
    resolutionStatus: localizeAssetStatus(ownString(asset, "resolutionStatus"))
  })];
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
  if (!isProjectionRecord(issue)) return false;
  return !containsInternalPhase(ownString(issue, "code"), ownString(issue, "message"));
}

function isOwnerVisibleUnsupportedFeature(entry) {
  if (!isProjectionRecord(entry)) return false;
  return !containsInternalPhase(ownString(entry, "feature"), ownString(entry, "path"));
}

function projectInventory(inventory, format) {
  if (!isProjectionRecord(inventory)) return undefined;
  const allowedGroups = formatInventoryGroups[format] ?? new Set();
  const groups = ownArrayValues(inventory, "groups").flatMap((group) => {
    if (!isProjectionRecord(group)) return [];
    const id = ownString(group, "id");
    const groupStatus = ownString(group, "status");
    if (!allowedGroups.has(id) || groupStatus === "not_applicable") return [];
    const items = ownArrayValues(group, "items").filter((item) => {
      if (!isProjectionRecord(item)) return false;
      const itemStatus = ownString(item, "status");
      const source = ownString(item, "source");
      const detail = ownStringArray(item, "detail");
      return itemStatus !== "not_applicable"
        && source !== "capability"
        && !containsInternalPhase(ownString(item, "label"), ...detail);
    });
    if (items.length === 0) return [];
    const projectedItems = items.map((item, index) => projectInventoryItem(item, index, id));
    return [buildOwnerRecord("inventoryGroup", {
      id,
      label: inventoryGroupLabels[id],
      count: items.length,
      replaceableCount: projectedItems.filter((item) => item.replaceable).length,
      status: ownerGroupStatuses.has(groupStatus) ? groupStatus : "available",
      items: projectedItems
    })];
  });
  const summary = buildOwnerRecord("inventorySummary", {
    totalItems: groups.reduce((sum, group) => sum + group.count, 0),
    replaceableItems: groups.reduce((sum, group) => sum + group.replaceableCount, 0),
    imageCount: countGroups(groups, ["image_resources", "vap_fusion_images"]),
    textCount: countGroups(groups, ["text_candidates", "vap_fusion_texts"]),
    sequenceFrameCount: countGroups(groups, ["sequence_frames"]),
    audioVideoCount: countGroups(groups, ["audio_video_media"]),
    unsupportedOrMissingCount: countGroups(groups, ["unsupported_or_missing"])
  });
  return buildOwnerRecord("inventory", {
    schemaVersion: 1,
    pathRedacted: true,
    format: ownerFormats.has(format) ? format : undefined,
    groups,
    summary,
    capabilityMarkers: []
  });
}

function projectInventoryItem(item, index, groupId) {
  const source = ownerInventorySources.has(ownString(item, "source"))
    ? ownString(item, "source")
    : "asset";
  const status = ownerInventoryStatuses.has(ownString(item, "status"))
    ? ownString(item, "status")
    : "available";
  const severity = ownerSeverity(ownString(item, "severity"));
  if (source === "issue") {
    const issueCode = ownString(item, "issueCode");
    const projection = issueCode === "unsupported_feature"
      ? projectOwnerUnsupportedFeatureFromValues(ownString(item, "label"), severity)
      : projectOwnerIssueFromValues(issueCode, severity);
    return buildOwnerRecord("inventoryItem", {
      id: `owner-issue:${index}`,
      label: projection.message,
      groupId,
      kind: "issue",
      source: "issue",
      status,
      replaceable: false,
      detail: [],
      issueCode: projection.code,
      severity,
      pathRedacted: true
    });
  }
  const rawLabel = ownString(item, "label");
  const kind = ownerIdentifier(ownString(item, "kind")) || "resource";
  const runtimeTargetId = ownerIdentifier(ownString(item, "runtimeTargetId")) || undefined;
  return buildOwnerRecord("inventoryItem", {
    id: ownerIdentifier(ownString(item, "id")) || `owner-item:${index}`,
    label: hasOwn(inventoryItemLabels, rawLabel)
      ? inventoryItemLabels[rawLabel]
      : ownerDisplayText(rawLabel) || "资源",
    groupId,
    kind,
    source,
    status,
    replaceable: ownBoolean(item, "replaceable") === true
      && !["missing", "unsupported", "blocked"].includes(status),
    runtimeTargetId,
    detail: ownStringArray(item, "detail")
      .map(localizeOwnerText)
      .filter(Boolean),
    pathRedacted: true
  });
}

function projectOwnerIssue(issue = {}) {
  return projectOwnerIssueFromValues(
    ownString(issue, "code"),
    ownerSeverity(ownString(issue, "severity"))
  );
}

function projectOwnerIssueFromValues(code, severity) {
  const projection = hasOwn(ownerIssueCopyByCode, code)
    ? ownerIssueCopyByCode[code]
    : genericOwnerIssue;
  return buildOwnerRecord("issue", {
    code: projection.code,
    severity,
    message: projection.message,
    pathRedacted: true
  });
}

function projectOwnerUnsupportedFeature(entry = {}) {
  return projectOwnerUnsupportedFeatureFromValues(
    ownString(entry, "feature"),
    ownerSeverity(ownString(entry, "severity"))
  );
}

function projectOwnerUnsupportedFeatureFromValues(feature, severity) {
  const label = hasOwn(ownerUnsupportedFeatureLabels, feature)
    ? ownerUnsupportedFeatureLabels[feature]
    : "";
  return buildOwnerRecord("unsupportedFeature", {
    code: "unsupported_feature",
    severity,
    feature: label || genericUnsupportedFeatureMessage,
    path: "",
    message: label ? `暂不支持：${label}` : genericUnsupportedFeatureMessage,
    pathRedacted: true
  });
}

function buildOwnerRecord(schemaName, values) {
  const schema = ownerProjectionSchemas[schemaName];
  const record = {};
  for (const key of schema) {
    const descriptor = Object.getOwnPropertyDescriptor(values, key);
    if (descriptor && "value" in descriptor && descriptor.value !== undefined) {
      record[key] = descriptor.value;
    }
  }
  return record;
}

function isProjectionRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function ownDataValue(record, key) {
  if (!isProjectionRecord(record)) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function ownRecord(record, key) {
  const value = ownDataValue(record, key);
  return isProjectionRecord(value) ? value : undefined;
}

function ownString(record, key) {
  const value = ownDataValue(record, key);
  return typeof value === "string" ? value : undefined;
}

function ownBoolean(record, key) {
  const value = ownDataValue(record, key);
  return typeof value === "boolean" ? value : undefined;
}

function ownFiniteNumber(record, key) {
  const value = ownDataValue(record, key);
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function ownArrayValues(record, key) {
  const value = ownDataValue(record, key);
  if (!Array.isArray(value)) return [];
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  const length = lengthDescriptor && "value" in lengthDescriptor
    && Number.isSafeInteger(lengthDescriptor.value)
    && lengthDescriptor.value >= 0
    ? Math.min(lengthDescriptor.value, 10000)
    : 0;
  const items = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor && "value" in descriptor) items.push(descriptor.value);
  }
  return items;
}

function ownStringArray(record, key) {
  return ownArrayValues(record, key).filter((value) => typeof value === "string");
}

function hasOwn(record, key) {
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(record, key);
}

function ownerSeverity(value) {
  return ownerIssueSeverities.has(value) ? value : "warning";
}

function containsInternalPhase(...values) {
  return values.some((value) => typeof value === "string" && internalPhasePattern.test(value));
}

function ownerDisplayText(value) {
  if (typeof value !== "string") return "";
  const copy = value.trim();
  if (!copy || copy.length > 256 || /[\u0000-\u001f\u007f]/u.test(copy)) return "";
  if (ownerPathPattern.test(copy) || copy.includes("/") || copy.includes("\\")) return "";
  return copy;
}

function ownerIdentifier(value) {
  const copy = ownerDisplayText(value);
  return copy && copy.length <= 128 ? copy : "";
}

function ownerDimensions(value) {
  return typeof value === "string" && /^\d{1,6}\s*[x×]\s*\d{1,6}$/u.test(value)
    ? value
    : "";
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
  const bytes = value;
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes >= 1024 * 1024) return `${trimDecimal(bytes / (1024 * 1024))} MiB`;
  if (bytes >= 1024) return `${trimDecimal(bytes / 1024)} KiB`;
  return `${Math.round(bytes)} B`;
}

function trimDecimal(value) {
  return value.toFixed(value >= 10 ? 0 : 1).replace(/\.0$/u, "");
}

function localizeAssetStatus(value) {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (["missing", "unresolved"].includes(status)) return "缺失";
  if (["unsupported", "blocked"].includes(status)) return "不支持";
  if (["oversized", "too_large"].includes(status)) return "尺寸过大";
  return "";
}

function ownerCopy(value) {
  return ownerDisplayText(value)
    .replace(/preview candidate/giu, "file")
    .replace(/candidate/giu, "file");
}

function localizeOwnerText(value) {
  const copy = ownerCopy(value);
  const exactCopy = Object.freeze({
    "initial text present": "包含初始文字",
    "replacement required": "需要替换",
    "unsupported fusion kind": "不支持的融合类型",
    present: "存在",
    "not present": "不存在",
    "not applicable": "不适用",
    unknown: "未知"
  });
  const exact = hasOwn(exactCopy, copy) ? exactCopy[copy] : "";
  if (exact) return exact;
  return copy
    .replace(/^codec:/iu, "编码：")
    .replace(/^(\d+) placement sample\(s\)$/iu, "$1 个位置样本");
}
