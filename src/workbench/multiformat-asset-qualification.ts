import type {
  MotionFormat,
  MotionResourceInfo,
  WorkbenchIssue
} from "./contracts.js";
import { redactLocalPaths } from "./local-path-redaction.js";

export type MultiFormatAssetInventoryGroupId =
  | "image_resources"
  | "text_candidates"
  | "vap_fusion_images"
  | "vap_fusion_texts"
  | "sequence_frames"
  | "audio_video_media"
  | "unsupported_or_missing"
  | "other_resources";

export type MultiFormatAssetInventoryItemStatus =
  | "available"
  | "replaceable"
  | "missing"
  | "unsupported"
  | "blocked"
  | "not_applicable";

export interface MultiFormatAssetInventoryItem {
  id: string;
  label: string;
  groupId: MultiFormatAssetInventoryGroupId;
  format?: MotionFormat;
  kind: string;
  source: "asset" | "text" | "fusion" | "media" | "issue" | "capability";
  status: MultiFormatAssetInventoryItemStatus;
  replaceable: boolean;
  runtimeTargetId?: string;
  detail: readonly string[];
  issueCode?: string;
  severity?: WorkbenchIssue["severity"];
  pathRedacted: true;
}

export interface MultiFormatAssetInventoryGroup {
  id: MultiFormatAssetInventoryGroupId;
  label: string;
  count: number;
  replaceableCount: number;
  status: "available" | "empty" | "warning" | "blocked" | "not_applicable";
  items: readonly MultiFormatAssetInventoryItem[];
}

export interface MultiFormatAssetInventorySummary {
  totalItems: number;
  replaceableItems: number;
  imageCount: number;
  textCount: number;
  sequenceFrameCount: number;
  audioVideoCount: number;
  unsupportedOrMissingCount: number;
}

export interface MultiFormatAssetInventory {
  schemaVersion: 1;
  pathRedacted: true;
  format?: MotionFormat;
  groups: readonly MultiFormatAssetInventoryGroup[];
  summary: MultiFormatAssetInventorySummary;
  capabilityMarkers: readonly MultiFormatAssetInventoryItem[];
}

export interface MultiFormatAssetInventoryAssetInput {
  id: string;
  name: string;
  kind: MotionResourceInfo["kind"];
  role?: MotionResourceInfo["role"];
  dimensions?: string;
  sizeBytes?: number;
  replaceable: boolean;
  resolutionStatus?: "not_required" | "resolved" | "missing" | "unsupported";
}

export interface MultiFormatAssetInventoryLayerInput {
  id: string;
  name: string;
  kind: string;
  resourceIds: readonly string[];
  replaceable: boolean;
}

export interface MultiFormatAssetInventoryTextInput {
  id: string;
  layerId: string;
  name: string;
  initialText?: string;
  replaceable: boolean;
}

export interface MultiFormatAssetInventoryFusionInput {
  id: string;
  kind: "image" | "text" | "unknown";
  resourceId: string;
  srcTag?: string;
  runtimeBindingKey?: string;
  replaceable: boolean;
  replacementRequired?: boolean;
  replacementProvided?: boolean;
  dimensions?: { width: number; height: number };
  placementSamples?: readonly unknown[];
  zValues?: readonly number[];
}

export interface MultiFormatAssetInventoryUnsupportedFeatureInput {
  feature: string;
  path: string;
}

export interface MultiFormatAssetInventoryInput {
  format?: MotionFormat;
  videoCodec?: string;
  audioPresent?: boolean;
  assets?: readonly MultiFormatAssetInventoryAssetInput[];
  layers?: readonly MultiFormatAssetInventoryLayerInput[];
  lottieTexts?: readonly MultiFormatAssetInventoryTextInput[];
  vapFusionImages?: readonly MultiFormatAssetInventoryFusionInput[];
  vapFusionTexts?: readonly MultiFormatAssetInventoryFusionInput[];
  issues?: readonly WorkbenchIssue[];
  unsupportedFeatures?: readonly MultiFormatAssetInventoryUnsupportedFeatureInput[];
}

export type QualificationMaterialKind = "svga" | "lottie_json" | "vap_mp4" | "unsupported";

export interface QualificationMaterialCandidate {
  displayName: string;
  sizeBytes?: number;
  mediaType?: string;
}

export interface QualificationMaterialBucket {
  kind: QualificationMaterialKind;
  count: number;
  totalSizeBytes: number | null;
  largestSizeBytes: number | null;
  syntheticFallbackRequired: boolean;
  evidence: readonly string[];
}

export interface MultiFormatQualificationReadinessMatrix {
  schemaVersion: 1;
  source: "read-only-local-material-qualification";
  materialRootRedacted: true;
  noAssetCopy: true;
  noMutation: true;
  foregroundRequired: false;
  buckets: readonly QualificationMaterialBucket[];
  requiredSyntheticFixtures: readonly QualificationMaterialKind[];
  matrixReady: boolean;
}

const groupLabels: Record<MultiFormatAssetInventoryGroupId, string> = {
  image_resources: "Images",
  text_candidates: "Text",
  vap_fusion_images: "VAP fusion images",
  vap_fusion_texts: "VAP fusion text",
  sequence_frames: "Image sequences",
  audio_video_media: "Audio / video",
  unsupported_or_missing: "Unsupported / missing",
  other_resources: "Other resources"
};

const orderedGroupIds: readonly MultiFormatAssetInventoryGroupId[] = [
  "image_resources",
  "text_candidates",
  "vap_fusion_images",
  "vap_fusion_texts",
  "sequence_frames",
  "audio_video_media",
  "unsupported_or_missing",
  "other_resources"
];

export function buildMultiFormatAssetInventory(
  input: MultiFormatAssetInventoryInput
): MultiFormatAssetInventory {
  const items = [
    ...assetItems(input),
    ...lottieTextItems(input),
    ...vapFusionItems(input),
    ...mediaFactItems(input),
    ...issueItems(input),
    ...capabilityMarkerItems(input)
  ];
  const capabilityMarkers = items.filter(({ source }) => source === "capability");
  const groups = orderedGroupIds.map((id) => groupFromItems(id, items.filter((item) => item.groupId === id)));
  const summary = inventorySummary(groups);
  return {
    schemaVersion: 1,
    pathRedacted: true,
    format: input.format,
    groups,
    summary,
    capabilityMarkers
  };
}

export function buildMultiFormatQualificationReadinessMatrix(
  candidates: readonly QualificationMaterialCandidate[]
): MultiFormatQualificationReadinessMatrix {
  const buckets = (["svga", "lottie_json", "vap_mp4", "unsupported"] as const).map((kind) => {
    const matches = candidates.filter((candidate) => classifyQualificationMaterial(candidate) === kind);
    const knownSizes = matches.map(({ sizeBytes }) => sizeBytes).filter(isFinitePositiveNumber);
    return {
      kind,
      count: matches.length,
      totalSizeBytes: knownSizes.length === matches.length
        ? knownSizes.reduce((sum, value) => sum + value, 0)
        : null,
      largestSizeBytes: knownSizes.length > 0 ? Math.max(...knownSizes) : null,
      syntheticFallbackRequired: kind !== "unsupported" && matches.length === 0,
      evidence: matches.length > 0
        ? [`${matches.length} local ${kindLabel(kind)} candidate(s) inventoried without copying or opening foreground UI.`]
        : [`No local ${kindLabel(kind)} candidate observed in the read-only inventory.`]
    };
  });
  const requiredSyntheticFixtures = buckets
    .filter(({ syntheticFallbackRequired }) => syntheticFallbackRequired)
    .map(({ kind }) => kind);
  return {
    schemaVersion: 1,
    source: "read-only-local-material-qualification",
    materialRootRedacted: true,
    noAssetCopy: true,
    noMutation: true,
    foregroundRequired: false,
    buckets,
    requiredSyntheticFixtures,
    matrixReady: buckets.some(({ kind, count }) => kind !== "unsupported" && count > 0)
  };
}

export function classifyQualificationMaterial(candidate: QualificationMaterialCandidate): QualificationMaterialKind {
  const name = candidate.displayName.toLowerCase();
  if (name.endsWith(".svga")) return "svga";
  if (name.endsWith(".json")) return "lottie_json";
  if (name.endsWith(".mp4") || name.endsWith(".vap")) return "vap_mp4";
  return "unsupported";
}

function assetItems(input: MultiFormatAssetInventoryInput): MultiFormatAssetInventoryItem[] {
  const fusionResourceIds = new Set([
    ...(input.vapFusionImages ?? []),
    ...(input.vapFusionTexts ?? [])
  ].map(({ resourceId }) => resourceId));
  return (input.assets ?? [])
    .filter((asset) => input.format !== "vap" || !fusionResourceIds.has(asset.id))
    .map((asset) => {
      const groupId = groupIdForAsset(asset);
      const status = statusForAsset(asset);
      return {
        id: inventoryText(asset.id, "asset"),
        label: inventoryText(asset.name || asset.id, "asset"),
        groupId,
        format: input.format,
        kind: inventoryText(asset.kind, "asset"),
        source: "asset",
        status,
        replaceable: asset.replaceable && status !== "missing" && status !== "unsupported",
        runtimeTargetId: asset.replaceable ? inventoryText(asset.id, "asset") : undefined,
        detail: inventoryDetails([
          asset.role,
          asset.dimensions,
          asset.sizeBytes !== undefined ? `${asset.sizeBytes} bytes` : undefined,
          asset.resolutionStatus
        ]),
        pathRedacted: true
      };
    });
}

function lottieTextItems(input: MultiFormatAssetInventoryInput): MultiFormatAssetInventoryItem[] {
  return (input.lottieTexts ?? []).map((text) => ({
    id: inventoryText(text.id, "text"),
    label: inventoryText(text.name || text.layerId || text.id, "text"),
    groupId: "text_candidates",
    format: input.format,
    kind: "text",
    source: "text",
    status: text.replaceable ? "replaceable" : "available",
    replaceable: text.replaceable,
    runtimeTargetId: text.replaceable ? inventoryText(text.id, "text") : undefined,
    detail: inventoryDetails([text.layerId, text.initialText ? "initial text present" : undefined]),
    pathRedacted: true
  }));
}

function vapFusionItems(input: MultiFormatAssetInventoryInput): MultiFormatAssetInventoryItem[] {
  const fusion = [
    ...(input.vapFusionImages ?? []),
    ...(input.vapFusionTexts ?? [])
  ];
  return fusion.map((element) => {
    const missing = element.replacementRequired === true && element.replacementProvided !== true;
    const unsupported = element.kind === "unknown";
    const runtimeTarget = element.srcTag || element.runtimeBindingKey;
    return {
      id: inventoryText(element.id, "fusion"),
      label: inventoryText(element.srcTag || element.runtimeBindingKey || element.id, "fusion"),
      groupId: element.kind === "image"
        ? "vap_fusion_images"
        : element.kind === "text"
          ? "vap_fusion_texts"
          : "unsupported_or_missing",
      format: input.format,
      kind: inventoryText(`fusion_${element.kind}`, "fusion"),
      source: "fusion",
      status: unsupported ? "unsupported" : missing ? "missing" : element.replaceable ? "replaceable" : "available",
      replaceable: element.replaceable && !missing && !unsupported,
      runtimeTargetId: runtimeTarget ? inventoryText(runtimeTarget, "fusion") : undefined,
      detail: inventoryDetails([
        element.resourceId,
        dimensionsLabel(element.dimensions),
        element.zValues && element.zValues.length > 0 ? `z:${element.zValues.join(",")}` : undefined,
        element.placementSamples && element.placementSamples.length > 0 ? `${element.placementSamples.length} placement sample(s)` : undefined,
        missing ? "replacement required" : undefined,
        unsupported ? "unsupported fusion kind" : undefined
      ]),
      pathRedacted: true
    };
  });
}

function mediaFactItems(input: MultiFormatAssetInventoryInput): MultiFormatAssetInventoryItem[] {
  const items: MultiFormatAssetInventoryItem[] = [];
  if (input.videoCodec) {
    items.push({
      id: "container-video",
      label: "Video track",
      groupId: "audio_video_media",
      format: input.format,
      kind: "video",
      source: "media",
      status: input.videoCodec === "avc1" || input.videoCodec === "avc3" ? "available" : "unsupported",
      replaceable: false,
      detail: [`codec:${input.videoCodec}`],
      pathRedacted: true
    });
  }
  if (input.audioPresent !== undefined) {
    items.push({
      id: "container-audio",
      label: "Audio track",
      groupId: "audio_video_media",
      format: input.format,
      kind: "audio",
      source: "media",
      status: input.audioPresent ? "available" : "not_applicable",
      replaceable: false,
      detail: [input.audioPresent ? "present" : "not present"],
      pathRedacted: true
    });
  }
  return items;
}

function issueItems(input: MultiFormatAssetInventoryInput): MultiFormatAssetInventoryItem[] {
  const issues = (input.issues ?? [])
    .filter(({ code, severity }) => severity === "error" || code === "missing_resource" || code === "unsupported_feature" || code === "capability");
  const issueRows = issues.map((entry, index): MultiFormatAssetInventoryItem => {
    const code = inventoryText(entry.code, "issue");
    return {
      id: `issue:${index}:${code}`,
      label: code,
      groupId: "unsupported_or_missing",
      format: input.format,
      kind: "issue",
      source: "issue",
      status: entry.code === "missing_resource" ? "missing" : entry.severity === "error" ? "blocked" : "unsupported",
      replaceable: false,
      detail: inventoryDetails([entry.message]),
      issueCode: code,
      severity: entry.severity,
      pathRedacted: true
    };
  });
  const unsupported = (input.unsupportedFeatures ?? []).map((entry, index): MultiFormatAssetInventoryItem => {
    const feature = inventoryText(entry.feature, "unsupported_feature");
    return {
      id: `unsupported:${index}:${feature}`,
      label: feature,
      groupId: "unsupported_or_missing",
      format: input.format,
      kind: "unsupported_feature",
      source: "issue",
      status: "unsupported",
      replaceable: false,
      detail: inventoryDetails([entry.path]),
      issueCode: "unsupported_feature",
      severity: "warning",
      pathRedacted: true
    };
  });
  return [...issueRows, ...unsupported];
}

function capabilityMarkerItems(input: MultiFormatAssetInventoryInput): MultiFormatAssetInventoryItem[] {
  const format = input.format;
  if (!format) return [];
  const markers: MultiFormatAssetInventoryItem[] = [];
  if (format !== "vap") {
    markers.push(capabilityMarker("capability:vap-fusion", "VAP fusion tags", "vap_fusion_images", format, "Only VAP exposes fusion image/text tags."));
  }
  if (format !== "lottie") {
    markers.push(capabilityMarker("capability:lottie-text", "Lottie text layers", "text_candidates", format, "Lottie text candidates are format-specific."));
  }
  if (format !== "svga") {
    markers.push(capabilityMarker("capability:svga-imagekey", "SVGA imageKey resources", "image_resources", format, "SVGA imageKey replacement is format-specific."));
  }
  return markers;
}

function capabilityMarker(
  id: string,
  label: string,
  groupId: MultiFormatAssetInventoryGroupId,
  format: MotionFormat,
  message: string
): MultiFormatAssetInventoryItem {
  return {
    id,
    label,
    groupId,
    format,
    kind: "capability_marker",
    source: "capability",
    status: "not_applicable",
    replaceable: false,
    detail: [message],
    pathRedacted: true
  };
}

function groupFromItems(
  id: MultiFormatAssetInventoryGroupId,
  items: readonly MultiFormatAssetInventoryItem[]
): MultiFormatAssetInventoryGroup {
  const replaceableCount = items.filter(({ replaceable }) => replaceable).length;
  const activeItems = items.filter(({ source }) => source !== "capability");
  const hasBlocked = items.some(({ status }) => status === "blocked" || status === "missing");
  const hasWarning = items.some(({ status }) => status === "unsupported");
  const hasOnlyCapabilities = items.length > 0 && activeItems.length === 0;
  return {
    id,
    label: groupLabels[id],
    count: activeItems.length,
    replaceableCount,
    status: hasBlocked ? "blocked" : hasWarning ? "warning" : hasOnlyCapabilities ? "not_applicable" : activeItems.length > 0 ? "available" : "empty",
    items
  };
}

function inventorySummary(groups: readonly MultiFormatAssetInventoryGroup[]): MultiFormatAssetInventorySummary {
  const count = (id: MultiFormatAssetInventoryGroupId) => groups.find((group) => group.id === id)?.count ?? 0;
  return {
    totalItems: groups.reduce((sum, group) => sum + group.count, 0),
    replaceableItems: groups.reduce((sum, group) => sum + group.replaceableCount, 0),
    imageCount: count("image_resources") + count("vap_fusion_images"),
    textCount: count("text_candidates") + count("vap_fusion_texts"),
    sequenceFrameCount: count("sequence_frames"),
    audioVideoCount: count("audio_video_media"),
    unsupportedOrMissingCount: count("unsupported_or_missing")
  };
}

function groupIdForAsset(asset: MultiFormatAssetInventoryAssetInput): MultiFormatAssetInventoryGroupId {
  if (asset.role === "sequence_frame" || asset.role === "baked_sweep_frame") return "sequence_frames";
  if (asset.kind === "image") return "image_resources";
  if (asset.kind === "audio" || asset.kind === "video") return "audio_video_media";
  return "other_resources";
}

function statusForAsset(asset: MultiFormatAssetInventoryAssetInput): MultiFormatAssetInventoryItemStatus {
  if (asset.resolutionStatus === "missing") return "missing";
  if (asset.resolutionStatus === "unsupported") return "unsupported";
  return asset.replaceable ? "replaceable" : "available";
}

function dimensionsLabel(dimensions: { width: number; height: number } | undefined): string | undefined {
  return dimensions ? `${dimensions.width} x ${dimensions.height}` : undefined;
}

function compact(values: readonly (string | number | undefined)[]): string[] {
  return values
    .filter((value): value is string | number => value !== undefined && value !== "")
    .map(String);
}

function inventoryDetails(values: readonly (string | number | undefined)[]): string[] {
  return compact(values).map((value) => inventoryText(value, "metadata"));
}

function inventoryText(value: string | number, fallback: string): string {
  const redacted = redactLocalPaths(String(value)).trim();
  return redacted || fallback;
}

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function kindLabel(kind: QualificationMaterialKind): string {
  switch (kind) {
    case "svga": return "SVGA";
    case "lottie_json": return "Lottie JSON";
    case "vap_mp4": return "VAP/MP4";
    case "unsupported": return "unsupported";
  }
}
