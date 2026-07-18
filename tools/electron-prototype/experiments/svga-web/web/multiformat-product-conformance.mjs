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
  { id: "all", label: "全部", key: "totalItems" },
  { id: "images", label: "图片", key: "imageCount" },
  { id: "texts", label: "文本", key: "textCount" },
  { id: "sequences", label: "序列帧", key: "sequenceFrameCount" },
  { id: "media", label: "音视频", key: "audioVideoCount" },
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
const ownerAssetKinds = new Set(["image", "sequence", "audio", "video", "text", "unknown"]);
const ownerFormats = new Set(["svga", "lottie", "vap"]);
const ownerPathPattern = /(?:file:\/\/|(?:^|[\s"'(=])\/(?:Users|Volumes|private|tmp|var|home)\/|[A-Za-z]:[\\/]|\\\\Users\\)/iu;

const genericOwnerIssue = Object.freeze({
  code: "owner_issue",
  message: "当前文件存在无法显示的检查问题。"
});
const genericUnsupportedFeatureMessage = "当前文件包含暂不支持的内容。";
const ownerSnapshotMaxBytes = 128 * 1024;
const ownerSnapshotSchemas = Object.freeze({
  envelope: Object.freeze(["pathRedacted", "schemaVersion", "snapshotByteLength", "snapshotJson", "snapshotSha256", "sourceId"]),
  snapshot: Object.freeze(["assetInventory", "assets", "facts", "imageTargets", "issues", "pathRedacted", "schemaVersion", "textTargets", "unsupportedFeatures"]),
  fact: Object.freeze(["id", "label", "status", "value"]),
  asset: Object.freeze(["dimensions", "fileSize", "id", "kind", "name", "ownerKind", "replaceable", "resolutionStatus"]),
  inventory: Object.freeze(["capabilityMarkers", "format", "groups", "pathRedacted", "schemaVersion", "summary"]),
  inventoryNoFormat: Object.freeze(["capabilityMarkers", "groups", "pathRedacted", "schemaVersion", "summary"]),
  inventorySummary: Object.freeze(["audioVideoCount", "imageCount", "replaceableItems", "sequenceFrameCount", "textCount", "totalItems", "unsupportedOrMissingCount"]),
  inventoryGroup: Object.freeze(["count", "id", "items", "label", "replaceableCount", "status"]),
  inventoryItem: Object.freeze(["detail", "groupId", "id", "issueCode", "kind", "label", "pathRedacted", "replaceable", "runtimeTargetId", "severity", "source", "status"]),
  inventoryItemBase: Object.freeze(["detail", "groupId", "id", "kind", "label", "pathRedacted", "replaceable", "source", "status"]),
  issue: Object.freeze(["code", "message", "pathRedacted", "severity"]),
  unsupportedFeature: Object.freeze(["code", "feature", "message", "path", "pathRedacted", "severity"]),
  imageTarget: Object.freeze(["detail", "displayName", "imageKey", "resourceId"]),
  textTarget: Object.freeze(["displayName", "initialText", "placeholder", "resetDisabled", "textKey"])
});

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

export function projectMultiFormatRightPanel(modelOrEnvelope = {}) {
  return validateOwnerRightPanelSnapshotEnvelope(ownerSnapshotEnvelope(modelOrEnvelope))
    ?? emptyOwnerRightPanelProjection();
}

export function validateOwnerRightPanelSnapshotEnvelope(envelope) {
  if (!isPlainJsonRecord(envelope) || !exactKeys(envelope, ownerSnapshotSchemas.envelope)) return undefined;
  if (envelope.schemaVersion !== 1 || envelope.pathRedacted !== true) return undefined;
  if (typeof envelope.sourceId !== "string" || !/^[A-Za-z0-9._:-]{0,128}$/u.test(envelope.sourceId)) return undefined;
  if (typeof envelope.snapshotJson !== "string" || typeof envelope.snapshotSha256 !== "string") return undefined;
  if (!Number.isSafeInteger(envelope.snapshotByteLength) || envelope.snapshotByteLength <= 0 || envelope.snapshotByteLength > ownerSnapshotMaxBytes) return undefined;
  if (utf8ByteLength(envelope.snapshotJson) !== envelope.snapshotByteLength) return undefined;
  if (sha256Hex(envelope.snapshotJson) !== envelope.snapshotSha256) return undefined;
  let snapshot;
  try {
    snapshot = JSON.parse(envelope.snapshotJson);
  } catch {
    return undefined;
  }
  if (!validateOwnerSnapshot(snapshot)) return undefined;
  if (stableStringify(snapshot) !== envelope.snapshotJson) return undefined;
  return snapshot;
}

function ownerSnapshotEnvelope(modelOrEnvelope) {
  if (isPlainJsonRecord(modelOrEnvelope) && exactKeys(modelOrEnvelope, ownerSnapshotSchemas.envelope)) return modelOrEnvelope;
  return ownRecord(modelOrEnvelope, "ownerRightPanelSnapshotEnvelope");
}

function emptyOwnerRightPanelProjection() {
  return {
    schemaVersion: 1,
    pathRedacted: true,
    facts: [],
    assets: [],
    assetInventory: {
      schemaVersion: 1,
      pathRedacted: true,
      groups: [],
      summary: {
        totalItems: 0,
        replaceableItems: 0,
        imageCount: 0,
        textCount: 0,
        sequenceFrameCount: 0,
        audioVideoCount: 0,
        unsupportedOrMissingCount: 0
      },
      capabilityMarkers: []
    },
    unsupportedFeatures: [],
    issues: [{
      code: genericOwnerIssue.code,
      severity: "warning",
      message: genericOwnerIssue.message,
      pathRedacted: true
    }],
    imageTargets: [],
    textTargets: []
  };
}

function validateOwnerSnapshot(snapshot) {
  if (!isPlainJsonRecord(snapshot) || !exactKeys(snapshot, ownerSnapshotSchemas.snapshot)) return false;
  if (snapshot.schemaVersion !== 1 || snapshot.pathRedacted !== true) return false;
  if (!arrayOf(snapshot.facts, validateSnapshotFact, 64)) return false;
  if (!arrayOf(snapshot.assets, validateSnapshotAsset, 1000)) return false;
  if (!validateSnapshotInventory(snapshot.assetInventory)) return false;
  if (!arrayOf(snapshot.unsupportedFeatures, validateSnapshotUnsupportedFeature, 256)) return false;
  if (!arrayOf(snapshot.issues, validateSnapshotIssue, 256)) return false;
  if (!arrayOf(snapshot.imageTargets, validateSnapshotImageTarget, 1000)) return false;
  if (!arrayOf(snapshot.textTargets, validateSnapshotTextTarget, 1000)) return false;
  return true;
}

function validateSnapshotFact(fact) {
  return isPlainJsonRecord(fact)
    && exactKeys(fact, ownerSnapshotSchemas.fact)
    && ownerIdentifier(fact.id)
    && typeof fact.label === "string"
    && fact.label.length > 0
    && fact.label.length <= 32
    && typeof fact.value === "string"
    && fact.value.length <= 64
    && ownerFactStatuses.has(fact.status);
}

function validateSnapshotAsset(asset) {
  return isPlainJsonRecord(asset)
    && exactKeys(asset, ownerSnapshotSchemas.asset)
    && ownerIdentifier(asset.id)
    && ownerSafeCopy(asset.name, 96)
    && ownerAssetKinds.has(asset.kind)
    && ownerSafeCopy(asset.ownerKind, 32)
    && typeof asset.dimensions === "string"
    && asset.dimensions.length <= 32
    && typeof asset.fileSize === "string"
    && asset.fileSize.length <= 32
    && typeof asset.resolutionStatus === "string"
    && asset.resolutionStatus.length <= 32
    && typeof asset.replaceable === "boolean";
}

function validateSnapshotInventory(inventory) {
  if (!isPlainJsonRecord(inventory)) return false;
  const schema = typeof inventory.format === "string" ? ownerSnapshotSchemas.inventory : ownerSnapshotSchemas.inventoryNoFormat;
  return exactKeys(inventory, schema)
    && inventory.schemaVersion === 1
    && inventory.pathRedacted === true
    && (inventory.format === undefined || ownerFormats.has(inventory.format))
    && arrayOf(inventory.groups, validateSnapshotInventoryGroup, 32)
    && validateSnapshotInventorySummary(inventory.summary)
    && Array.isArray(inventory.capabilityMarkers)
    && inventory.capabilityMarkers.length === 0;
}

function validateSnapshotInventorySummary(summary) {
  return isPlainJsonRecord(summary)
    && exactKeys(summary, ownerSnapshotSchemas.inventorySummary)
    && Object.values(summary).every((value) => Number.isSafeInteger(value) && value >= 0 && value <= 100000);
}

function validateSnapshotInventoryGroup(group) {
  return isPlainJsonRecord(group)
    && exactKeys(group, ownerSnapshotSchemas.inventoryGroup)
    && ownerIdentifier(group.id)
    && ownerSafeCopy(group.label, 64)
    && Number.isSafeInteger(group.count)
    && group.count >= 0
    && Number.isSafeInteger(group.replaceableCount)
    && group.replaceableCount >= 0
    && ownerGroupStatuses.has(group.status)
    && arrayOf(group.items, validateSnapshotInventoryItem, 1000);
}

function validateSnapshotInventoryItem(item) {
  if (!isPlainJsonRecord(item)) return false;
  const keys = Object.keys(item);
  const allowed = new Set(ownerSnapshotSchemas.inventoryItem);
  return ownerSnapshotSchemas.inventoryItemBase.every((key) => keys.includes(key))
    && keys.every((key) => allowed.has(key))
    && ownerIdentifier(item.id)
    && ownerSafeCopy(item.label, 120)
    && ownerIdentifier(item.groupId)
    && ownerIdentifier(item.kind)
    && ownerInventorySources.has(item.source)
    && ownerInventoryStatuses.has(item.status)
    && typeof item.replaceable === "boolean"
    && (item.runtimeTargetId === undefined || ownerIdentifier(item.runtimeTargetId))
    && arrayOf(item.detail, (entry) => ownerSafeCopy(entry, 80), 16)
    && (item.issueCode === undefined || ownerIdentifier(item.issueCode))
    && (item.severity === undefined || ownerIssueSeverities.has(item.severity))
    && item.pathRedacted === true;
}

function validateSnapshotIssue(issue) {
  return isPlainJsonRecord(issue)
    && exactKeys(issue, ownerSnapshotSchemas.issue)
    && ownerIdentifier(issue.code)
    && ownerIssueSeverities.has(issue.severity)
    && ownerSafeCopy(issue.message, 120)
    && issue.pathRedacted === true;
}

function validateSnapshotUnsupportedFeature(feature) {
  return isPlainJsonRecord(feature)
    && exactKeys(feature, ownerSnapshotSchemas.unsupportedFeature)
    && feature.code === "unsupported_feature"
    && ownerIssueSeverities.has(feature.severity)
    && ownerSafeCopy(feature.feature, 80)
    && feature.path === ""
    && ownerSafeCopy(feature.message, 120)
    && feature.pathRedacted === true;
}

function validateSnapshotImageTarget(target) {
  return isPlainJsonRecord(target)
    && exactKeys(target, ownerSnapshotSchemas.imageTarget)
    && ownerIdentifier(target.imageKey)
    && ownerIdentifier(target.resourceId)
    && ownerSafeCopy(target.displayName, 96)
    && typeof target.detail === "string"
    && target.detail.length <= 160;
}

function validateSnapshotTextTarget(target) {
  return isPlainJsonRecord(target)
    && exactKeys(target, ownerSnapshotSchemas.textTarget)
    && ownerIdentifier(target.textKey)
    && ownerSafeCopy(target.displayName, 96)
    && typeof target.initialText === "string"
    && target.initialText.length <= 160
    && target.placeholder === "输入文字以预览"
    && target.resetDisabled === false;
}

function arrayOf(value, validator, maxLength) {
  return Array.isArray(value)
    && value.length <= maxLength
    && value.every((entry) => validator(entry));
}

function isPlainJsonRecord(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function exactKeys(record, expected) {
  const keys = Object.keys(record).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function ownerSafeCopy(value, maxLength) {
  if (typeof value !== "string") return false;
  if (!value || value.length > maxLength || /[\u0000-\u001f\u007f]/u.test(value)) return false;
  return !ownerPathPattern.test(value) && !/(?:layers|assets|src|frame|obj)\.\d+|\bbounded JSON\b|\bhidden\b|\bpreview candidate\b/iu.test(value);
}

function utf8ByteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function stableStringify(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const words = [];
  for (let index = 0; index < bytes.length; index += 1) {
    words[index >> 2] |= bytes[index] << (24 - (index % 4) * 8);
  }
  words[bytes.length >> 2] |= 0x80 << (24 - (bytes.length % 4) * 8);
  words[(((bytes.length + 8) >> 6) << 4) + 15] = bytes.length * 8;
  const k = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];
  const hash = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rightRotate = (number, bits) => (number >>> bits) | (number << (32 - bits));
  for (let offset = 0; offset < words.length; offset += 16) {
    const w = words.slice(offset, offset + 16);
    for (let index = 16; index < 64; index += 1) {
      const word15 = w[index - 15] ?? 0;
      const word2 = w[index - 2] ?? 0;
      const s0 = rightRotate(word15, 7) ^ rightRotate(word15, 18) ^ (word15 >>> 3);
      const s1 = rightRotate(word2, 17) ^ rightRotate(word2, 19) ^ (word2 >>> 10);
      w[index] = ((((w[index - 16] ?? 0) + s0) >>> 0) + (((w[index - 7] ?? 0) + s1) >>> 0)) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (((((h + s1) >>> 0) + ch) >>> 0) + ((k[index] + (w[index] ?? 0)) >>> 0)) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((value, index) => {
      hash[index] = (hash[index] + value) >>> 0;
    });
  }
  return hash.map((value) => value.toString(16).padStart(8, "0")).join("");
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
