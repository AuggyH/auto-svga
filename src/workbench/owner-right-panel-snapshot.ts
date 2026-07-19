import { createHash } from "node:crypto";

import type {
  MotionFormat,
  WorkbenchIssue
} from "./contracts.js";
import type {
  HiddenMultiFormatPreviewAssetRow,
  HiddenMultiFormatPreviewTextCandidate,
  HiddenMultiFormatPreviewUnsupportedMarker
} from "./multiformat-preview-workspace.js";
import type { VapPreparedFusionElement } from "./vap-playback-preparation.js";

export const OWNER_RIGHT_PANEL_SNAPSHOT_SCHEMA_VERSION = 1 as const;
const OWNER_RIGHT_PANEL_SNAPSHOT_MAX_BYTES = 128 * 1024;
const ownerSnapshotBrand = new WeakSet<object>();

export type OwnerSnapshotSeverity = "info" | "warning" | "error";
export type OwnerSnapshotStatus = "pass" | "warning" | "fail" | "unknown";
export type OwnerSnapshotFormat = Extract<MotionFormat, "svga" | "lottie" | "vap">;

export interface OwnerRightPanelSnapshotEnvelopeV1 {
  schemaVersion: typeof OWNER_RIGHT_PANEL_SNAPSHOT_SCHEMA_VERSION;
  sourceId: string;
  snapshotJson: string;
  snapshotByteLength: number;
  snapshotSha256: string;
  pathRedacted: true;
}

export interface OwnerRightPanelSnapshotFact {
  id: string;
  label: string;
  value: string;
  status: OwnerSnapshotStatus;
}

export interface OwnerRightPanelSnapshotAsset {
  id: string;
  name: string;
  kind: "image" | "sequence" | "audio" | "video" | "text" | "unknown";
  ownerKind: string;
  dimensions: string;
  fileSize: string;
  resolutionStatus: string;
  replaceable: boolean;
}

export interface OwnerRightPanelSnapshotInventoryItem {
  id: string;
  label: string;
  groupId: string;
  kind: string;
  source: "asset" | "text" | "fusion" | "media" | "issue";
  status: "available" | "replaceable" | "missing" | "unsupported" | "blocked" | "not_applicable";
  replaceable: boolean;
  runtimeTargetId?: string;
  detail: readonly string[];
  issueCode?: string;
  severity?: OwnerSnapshotSeverity;
  pathRedacted: true;
}

export interface OwnerRightPanelSnapshotInventoryGroup {
  id: string;
  label: string;
  count: number;
  replaceableCount: number;
  status: "available" | "empty" | "warning" | "blocked";
  items: readonly OwnerRightPanelSnapshotInventoryItem[];
}

export interface OwnerRightPanelSnapshotInventory {
  schemaVersion: typeof OWNER_RIGHT_PANEL_SNAPSHOT_SCHEMA_VERSION;
  pathRedacted: true;
  format?: OwnerSnapshotFormat;
  groups: readonly OwnerRightPanelSnapshotInventoryGroup[];
  summary: {
    totalItems: number;
    replaceableItems: number;
    imageCount: number;
    textCount: number;
    sequenceFrameCount: number;
    audioVideoCount: number;
    unsupportedOrMissingCount: number;
  };
  capabilityMarkers: readonly [];
}

export interface OwnerRightPanelSnapshotIssue {
  code: string;
  severity: OwnerSnapshotSeverity;
  message: string;
  pathRedacted: true;
}

export interface OwnerRightPanelSnapshotUnsupportedFeature {
  code: "unsupported_feature";
  severity: OwnerSnapshotSeverity;
  feature: string;
  path: "";
  message: string;
  pathRedacted: true;
}

export interface OwnerRightPanelSnapshotImageTarget {
  imageKey: string;
  resourceId: string;
  displayName: string;
  detail: string;
}

export interface OwnerRightPanelSnapshotTextTarget {
  textKey: string;
  displayName: string;
  initialText: string;
  placeholder: "输入文字以预览";
  resetDisabled: false;
}

export interface OwnerRightPanelSnapshotV1 {
  schemaVersion: typeof OWNER_RIGHT_PANEL_SNAPSHOT_SCHEMA_VERSION;
  pathRedacted: true;
  facts: readonly OwnerRightPanelSnapshotFact[];
  assets: readonly OwnerRightPanelSnapshotAsset[];
  assetInventory: OwnerRightPanelSnapshotInventory;
  unsupportedFeatures: readonly OwnerRightPanelSnapshotUnsupportedFeature[];
  issues: readonly OwnerRightPanelSnapshotIssue[];
  imageTargets: readonly OwnerRightPanelSnapshotImageTarget[];
  textTargets: readonly OwnerRightPanelSnapshotTextTarget[];
}

export interface OwnerRightPanelSnapshotFactInput {
  id: string;
  label: string;
  value: string;
  status: OwnerSnapshotStatus;
}

export interface CreateOwnerRightPanelSnapshotInput {
  detectedFormat?: MotionFormat;
  facts: readonly OwnerRightPanelSnapshotFactInput[];
  assets: readonly HiddenMultiFormatPreviewAssetRow[];
  lottieTexts: readonly HiddenMultiFormatPreviewTextCandidate[];
  vapFusionImages: readonly VapPreparedFusionElement[];
  vapFusionTexts: readonly VapPreparedFusionElement[];
  unsupportedFeatures: readonly HiddenMultiFormatPreviewUnsupportedMarker[];
  issues: readonly WorkbenchIssue[];
  videoCodec?: string;
  audioPresent?: boolean;
}

const factLabels = Object.freeze({
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

const ownerIssueCopyByCode = Object.freeze({
  missing_resource: Object.freeze({ code: "missing_resource", message: "预览所需资源缺失。" }),
  unsupported_feature: Object.freeze({ code: "unsupported_feature", message: "当前文件包含暂不支持的内容。" }),
  parse_precondition: Object.freeze({ code: "invalid_file", message: "文件内容不完整或格式异常，无法预览。" }),
  asset_reference_precondition: Object.freeze({ code: "invalid_file", message: "文件内容不完整或格式异常，无法预览。" }),
  playback_failure: Object.freeze({ code: "playback_failure", message: "文件预览播放出现问题。" })
});
const vapCanvasRiskIssue = Object.freeze({
  code: "canvas_size_risk",
  message: "画布尺寸超过兼容性阈值，仍可播放；请留意设备性能。"
});

const unsupportedFeatureLabels = Object.freeze({
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

const groupLabels = Object.freeze({
  image_resources: "图片",
  text_candidates: "文本",
  vap_fusion_images: "VAP 融合图片",
  vap_fusion_texts: "VAP 融合文字",
  sequence_frames: "序列帧",
  audio_video_media: "音视频",
  unsupported_or_missing: "不支持或缺失",
  other_resources: "其他资源"
});

const assetKindLabels = Object.freeze({
  image: "图片",
  sequence: "序列帧",
  audio: "音频",
  video: "视频",
  text: "文本",
  unknown: "资源"
});

type OwnerInventoryGroupId = keyof typeof groupLabels;
type OwnerInventoryGroupStatus = OwnerRightPanelSnapshotInventoryGroup["status"];

const formatGroups: Readonly<Record<OwnerSnapshotFormat, readonly OwnerInventoryGroupId[]>> = Object.freeze({
  svga: ["image_resources", "text_candidates", "sequence_frames", "audio_video_media", "unsupported_or_missing", "other_resources"],
  lottie: ["image_resources", "text_candidates", "sequence_frames", "unsupported_or_missing", "other_resources"],
  vap: ["vap_fusion_images", "vap_fusion_texts", "audio_video_media", "unsupported_or_missing", "other_resources"]
});

const genericIssue = Object.freeze({
  code: "owner_issue",
  message: "当前文件存在无法显示的检查问题。"
});

const genericUnsupportedFeatureMessage = "当前文件包含暂不支持的内容。";
const pathLikePattern = /(?:file:\/\/|(?:^|[\s"'(=])\/(?:Users|Volumes|private|tmp|var|home)\/|[A-Za-z]:[\\/]|\\\\Users\\|[\\/])/iu;
const structuralPattern = /(?:^|[\s"'(])(?:layers|assets|src|frame|obj|records)\.\d+(?:\.|$)|\b(?:xp|runtime|hidden|bounded JSON|preview candidate|source-side)\b/iu;

export function createOwnerRightPanelSnapshotEnvelope(
  input: CreateOwnerRightPanelSnapshotInput,
  sourceId = ""
): OwnerRightPanelSnapshotEnvelopeV1 {
  return serializeOwnerRightPanelSnapshot(createOwnerRightPanelSnapshot(input), sourceId);
}

export function serializeOwnerRightPanelSnapshot(
  snapshot: OwnerRightPanelSnapshotV1,
  sourceId = ""
): OwnerRightPanelSnapshotEnvelopeV1 {
  if (!ownerSnapshotBrand.has(snapshot)) {
    throw new Error("OwnerRightPanelSnapshotV1 must be minted by the canonicalizer.");
  }
  const snapshotJson = stableStringify(snapshot);
  const snapshotByteLength = Buffer.byteLength(snapshotJson, "utf8");
  if (snapshotByteLength <= 0 || snapshotByteLength > OWNER_RIGHT_PANEL_SNAPSHOT_MAX_BYTES) {
    throw new Error("OwnerRightPanelSnapshotV1 exceeds the bounded owner-visible payload limit.");
  }
  return Object.freeze({
    schemaVersion: OWNER_RIGHT_PANEL_SNAPSHOT_SCHEMA_VERSION,
    sourceId: safeSourceId(sourceId),
    snapshotJson,
    snapshotByteLength,
    snapshotSha256: sha256(snapshotJson),
    pathRedacted: true
  });
}

function createOwnerRightPanelSnapshot(input: CreateOwnerRightPanelSnapshotInput): OwnerRightPanelSnapshotV1 {
  const format = ownerFormat(input.detectedFormat);
  const issues = uniqueOwnerIssues(input.issues.map((issue) => ownerIssue(issue)));
  const unsupportedFeatures = input.unsupportedFeatures.map((entry) => ownerUnsupportedFeature(entry));
  const vapFusionTargetIds = new Set(format === "vap"
    ? [
        ...input.vapFusionImages.map((entry, index) => safeIdentifier(entry.resourceId, `vap-image-${index + 1}`)),
        ...input.vapFusionTexts.map((entry, index) => safeIdentifier(entry.resourceId, `vap-text-${index + 1}`))
      ]
    : []);
  const assets = input.assets
    .map((asset, index) => ownerAsset(asset, index))
    .filter((asset) => format !== "vap" || !vapFusionTargetIds.has(asset.id));
  const imageTargets = [
    ...assets
      .filter((asset) => asset.replaceable && !(format === "vap" && vapFusionTargetIds.has(asset.id)))
      .map((asset) => ({
        imageKey: asset.id,
        resourceId: asset.id,
        displayName: asset.name,
        detail: [asset.dimensions, asset.fileSize].filter(Boolean).join(" · ")
      })),
    ...input.vapFusionImages.filter((entry) => entry.replaceable).map((entry, index) => {
      const displayName = ownerDisplayName(entry.srcTag, `融合图片 ${index + 1}`);
      return {
        imageKey: safeIdentifier(entry.resourceId, `vap-image-${index + 1}`),
        resourceId: safeIdentifier(entry.resourceId, `vap-image-${index + 1}`),
        displayName,
        detail: ["VAP 融合图片", ownerDimensionsFromObject(entry.dimensions)].filter(Boolean).join(" · ")
      };
    })
  ];
  const textTargets = [
    ...input.lottieTexts.filter((entry) => entry.replaceable).map((entry, index) => ({
      textKey: safeIdentifier(entry.id, `lottie-text-${index + 1}`),
      displayName: ownerDisplayName(entry.name || entry.layerId, `文本 ${index + 1}`),
      initialText: ownerTextPreview(entry.initialText),
      placeholder: "输入文字以预览" as const,
      resetDisabled: false as const
    })),
    ...input.vapFusionTexts.filter((entry) => entry.replaceable).map((entry, index) => ({
      textKey: safeIdentifier(entry.resourceId, `vap-text-${index + 1}`),
      displayName: ownerDisplayName(entry.srcTag, `融合文字 ${index + 1}`),
      initialText: "VAP 融合文字",
      placeholder: "输入文字以预览" as const,
      resetDisabled: false as const
    }))
  ];
  const snapshot: OwnerRightPanelSnapshotV1 = {
    schemaVersion: OWNER_RIGHT_PANEL_SNAPSHOT_SCHEMA_VERSION,
    pathRedacted: true,
    facts: input.facts.flatMap((fact) => ownerFact(fact, format)),
    assets,
    assetInventory: ownerInventory({
      format,
      assets,
      textTargets,
      imageTargets,
      issues,
      unsupportedFeatures,
      videoCodec: input.videoCodec,
      audioPresent: input.audioPresent
    }),
    unsupportedFeatures,
    issues,
    imageTargets,
    textTargets
  };
  freezeTree(snapshot);
  ownerSnapshotBrand.add(snapshot);
  return snapshot;
}

function uniqueOwnerIssues(
  issues: readonly OwnerRightPanelSnapshotIssue[]
): OwnerRightPanelSnapshotIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}\u0000${issue.severity}\u0000${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ownerFact(fact: OwnerRightPanelSnapshotFactInput, format?: OwnerSnapshotFormat): OwnerRightPanelSnapshotFact[] {
  if (!hasKey(factLabels, fact.id)) return [];
  if (fact.id === "videoCodec" && format !== "vap") return [];
  const value = factValue(fact.id, fact.value);
  return [{
    id: fact.id,
    label: factLabels[fact.id],
    value,
    status: factStatus(fact.status)
  }];
}

function factValue(id: string, value: string): string {
  if (id === "format") return ["SVGA", "LOTTIE", "VAP"].includes(value) ? value : "未知";
  if (id === "dimensions") return ownerDimensionsString(value) || "未知";
  if (id === "duration") return /^\d+(?:\.\d+)?s$/u.test(value) ? value : "未知";
  if (["layers", "assets", "replaceable", "unsupported"].includes(id)) return /^\d+$/u.test(value) ? value : "未知";
  if (id === "videoCodec") return /^[A-Za-z0-9._-]{1,32}$/u.test(value) ? value : "未知";
  if (id === "audio") return value === "present" ? "存在" : value === "not present" ? "不存在" : "未知";
  return "未知";
}

function ownerAsset(asset: HiddenMultiFormatPreviewAssetRow, index: number): OwnerRightPanelSnapshotAsset {
  const kind = assetKind(asset.kind);
  return {
    id: safeIdentifier(asset.id, `asset-${index + 1}`),
    name: ownerDisplayName(asset.name, `资源 ${index + 1}`),
    kind,
    ownerKind: assetKindLabels[kind],
    dimensions: ownerDimensionsString(asset.dimensions ?? ""),
    fileSize: formatBytes(asset.sizeBytes),
    resolutionStatus: resolutionStatus(asset.resolutionStatus),
    replaceable: asset.replaceable === true
  };
}

function ownerInventory(input: {
  format?: OwnerSnapshotFormat;
  assets: readonly OwnerRightPanelSnapshotAsset[];
  imageTargets: readonly OwnerRightPanelSnapshotImageTarget[];
  textTargets: readonly OwnerRightPanelSnapshotTextTarget[];
  issues: readonly OwnerRightPanelSnapshotIssue[];
  unsupportedFeatures: readonly OwnerRightPanelSnapshotUnsupportedFeature[];
  videoCodec?: string;
  audioPresent?: boolean;
}): OwnerRightPanelSnapshotInventory {
  const groups = new Map<string, OwnerRightPanelSnapshotInventoryItem[]>();
  const add = (groupId: string, item: OwnerRightPanelSnapshotInventoryItem) => {
    groups.set(groupId, [...(groups.get(groupId) ?? []), item]);
  };

  input.assets.forEach((asset, index) => {
    const groupId = asset.kind === "sequence"
      ? "sequence_frames"
      : asset.kind === "audio" || asset.kind === "video"
        ? "audio_video_media"
        : asset.kind === "image"
          ? "image_resources"
          : "other_resources";
    add(groupId, {
      id: asset.id,
      label: asset.name,
      groupId,
      kind: asset.kind,
      source: "asset",
      status: asset.replaceable ? "replaceable" : "available",
      replaceable: asset.replaceable,
      runtimeTargetId: asset.id,
      detail: [asset.dimensions, asset.fileSize, asset.resolutionStatus].filter(Boolean),
      pathRedacted: true
    });
    void index;
  });

  input.textTargets.forEach((target, index) => add(input.format === "vap" ? "vap_fusion_texts" : "text_candidates", {
    id: target.textKey,
    label: target.displayName,
    groupId: input.format === "vap" ? "vap_fusion_texts" : "text_candidates",
    kind: "text",
    source: input.format === "vap" ? "fusion" : "text",
    status: "replaceable",
    replaceable: true,
    runtimeTargetId: target.textKey,
    detail: target.initialText ? ["包含初始文字"] : [],
    pathRedacted: true
  }));
  input.imageTargets
    .filter((target) => input.format === "vap")
    .forEach((target) => add("vap_fusion_images", {
      id: target.resourceId,
      label: target.displayName,
      groupId: "vap_fusion_images",
      kind: "image",
      source: "fusion",
      status: "replaceable",
      replaceable: true,
      runtimeTargetId: target.resourceId,
      detail: target.detail ? [target.detail] : [],
      pathRedacted: true
    }));

  if (input.format === "vap") {
    add("audio_video_media", {
      id: "vap-video",
      label: "视频轨道",
      groupId: "audio_video_media",
      kind: "video",
      source: "media",
      status: "available",
      replaceable: false,
      detail: [input.videoCodec ? `编码：${factValue("videoCodec", input.videoCodec)}` : ""].filter(Boolean),
      pathRedacted: true
    });
    if (input.audioPresent !== undefined) {
      add("audio_video_media", {
        id: "vap-audio",
        label: "音频轨道",
        groupId: "audio_video_media",
        kind: "audio",
        source: "media",
        status: input.audioPresent ? "available" : "not_applicable",
        replaceable: false,
        detail: [input.audioPresent ? "存在音频" : "无音频"],
        pathRedacted: true
      });
    }
  }

  input.issues.forEach((issue, index) => add("unsupported_or_missing", {
    id: `owner-issue-${index + 1}`,
    label: issue.message,
    groupId: "unsupported_or_missing",
    kind: "issue",
    source: "issue",
    status: issue.severity === "error" ? "blocked" : "unsupported",
    replaceable: false,
    detail: [],
    issueCode: issue.code,
    severity: issue.severity,
    pathRedacted: true
  }));
  input.unsupportedFeatures.forEach((feature, index) => add("unsupported_or_missing", {
    id: `unsupported-feature-${index + 1}`,
    label: feature.message,
    groupId: "unsupported_or_missing",
    kind: "issue",
    source: "issue",
    status: "unsupported",
    replaceable: false,
    detail: [],
    issueCode: feature.code,
    severity: feature.severity,
    pathRedacted: true
  }));

  const allowedGroups: readonly OwnerInventoryGroupId[] = input.format ? formatGroups[input.format] : [];
  const inventoryGroups: OwnerRightPanelSnapshotInventoryGroup[] = allowedGroups.flatMap((groupId) => {
    const items = groups.get(groupId) ?? [];
    if (items.length === 0) return [];
    const status: OwnerInventoryGroupStatus = items.some((item) => item.status === "blocked")
      ? "blocked"
      : items.some((item) => item.status === "unsupported")
        ? "warning"
        : "available";
    return [{
      id: groupId,
      label: groupLabels[groupId],
      count: items.length,
      replaceableCount: items.filter((item) => item.replaceable).length,
      status,
      items
    }];
  });
  return {
    schemaVersion: OWNER_RIGHT_PANEL_SNAPSHOT_SCHEMA_VERSION,
    pathRedacted: true,
    ...(input.format ? { format: input.format } : {}),
    groups: inventoryGroups,
    summary: {
      totalItems: inventoryGroups.reduce((sum, group) => sum + group.count, 0),
      replaceableItems: inventoryGroups.reduce((sum, group) => sum + group.replaceableCount, 0),
      imageCount: countGroups(inventoryGroups, ["image_resources", "vap_fusion_images"]),
      textCount: countGroups(inventoryGroups, ["text_candidates", "vap_fusion_texts"]),
      sequenceFrameCount: countGroups(inventoryGroups, ["sequence_frames"]),
      audioVideoCount: countGroups(inventoryGroups, ["audio_video_media"]),
      unsupportedOrMissingCount: countGroups(inventoryGroups, ["unsupported_or_missing"])
    },
    capabilityMarkers: []
  };
}

function ownerIssue(issue: WorkbenchIssue): OwnerRightPanelSnapshotIssue {
  const known = issue.code === "capability" && ownerIssueReason(issue) === "vap_dimensions_over_1504"
    ? vapCanvasRiskIssue
    : hasKey(ownerIssueCopyByCode, issue.code)
      ? ownerIssueCopyByCode[issue.code]
      : genericIssue;
  return {
    code: known.code,
    severity: severity(issue.severity),
    message: known.message,
    pathRedacted: true
  };
}

function ownerIssueReason(issue: WorkbenchIssue): string {
  const direct = issue.details?.reason;
  if (typeof direct === "string") return direct;
  const nested = issue.details?.details;
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) return "";
  const reason = (nested as Record<string, unknown>).reason;
  return typeof reason === "string" ? reason : "";
}

function ownerUnsupportedFeature(entry: HiddenMultiFormatPreviewUnsupportedMarker): OwnerRightPanelSnapshotUnsupportedFeature {
  const label = hasKey(unsupportedFeatureLabels, entry.feature) ? unsupportedFeatureLabels[entry.feature] : "";
  return {
    code: "unsupported_feature",
    severity: "warning",
    feature: label || genericUnsupportedFeatureMessage,
    path: "",
    message: label ? `暂不支持：${label}` : genericUnsupportedFeatureMessage,
    pathRedacted: true
  };
}

function ownerFormat(format: MotionFormat | undefined): OwnerSnapshotFormat | undefined {
  return format === "svga" || format === "lottie" || format === "vap" ? format : undefined;
}

function factStatus(value: string): OwnerSnapshotStatus {
  return value === "pass" || value === "warning" || value === "fail" || value === "unknown" ? value : "unknown";
}

function severity(value: unknown): OwnerSnapshotSeverity {
  return value === "info" || value === "warning" || value === "error" ? value : "warning";
}

function assetKind(value: unknown): OwnerRightPanelSnapshotAsset["kind"] {
  return value === "image" || value === "sequence" || value === "audio" || value === "video" || value === "text"
    ? value
    : "unknown";
}

function ownerDimensionsString(value: string): string {
  const match = /^\s*(\d{1,6})\s*[x×]\s*(\d{1,6})\s*$/u.exec(value);
  if (!match) return "";
  return `${match[1]} x ${match[2]}`;
}

function ownerDimensionsFromObject(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const dimensions = value as { width?: unknown; height?: unknown };
  const width = positiveInteger(dimensions.width);
  const height = positiveInteger(dimensions.height);
  return width && height ? `${width} x ${height}` : "";
}

function positiveInteger(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 999999 ? value : 0;
}

function ownerDisplayName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80 || /[\u0000-\u001f\u007f]/u.test(trimmed)) return fallback;
  if (pathLikePattern.test(trimmed) || structuralPattern.test(trimmed)) return fallback;
  return trimmed;
}

function ownerTextPreview(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120 || /[\u0000-\u001f\u007f]/u.test(trimmed)) return "";
  if (pathLikePattern.test(trimmed) || structuralPattern.test(trimmed)) return "";
  return trimmed;
}

function safeIdentifier(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return /^[A-Za-z0-9._:-]{1,128}$/u.test(trimmed) ? trimmed : fallback;
}

function safeSourceId(value: unknown): string {
  return typeof value === "string" && /^[A-Za-z0-9._:-]{0,128}$/u.test(value) ? value : "";
}

function formatBytes(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "";
  if (value >= 1024 * 1024) return `${trimDecimal(value / (1024 * 1024))} MiB`;
  if (value >= 1024) return `${trimDecimal(value / 1024)} KiB`;
  return `${Math.round(value)} B`;
}

function trimDecimal(value: number): string {
  return value.toFixed(value >= 10 ? 0 : 1).replace(/\.0$/u, "");
}

function resolutionStatus(value: unknown): string {
  if (value === "missing") return "缺失";
  if (value === "unsupported") return "不支持";
  return "";
}

function countGroups(groups: readonly OwnerRightPanelSnapshotInventoryGroup[], ids: readonly string[]): number {
  return groups.filter((group) => ids.includes(group.id)).reduce((sum, group) => sum + group.count, 0);
}

function freezeTree<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    if (child && typeof child === "object" && !Object.isFrozen(child)) freezeTree(child);
  }
  return value;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hasKey<T extends object>(record: T, key: unknown): key is keyof T {
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(record, key);
}
