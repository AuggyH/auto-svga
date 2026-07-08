import type {
  AssetIntelligenceFinding,
  AssetIntelligenceOptimizationDisposition,
  AssetIntelligenceResourceNode
} from "./asset-intelligence.js";
import type { AvatarFrameInspectionReport } from "./avatar-frame-inspection-report.js";
import type { MemoryRiskLevel, MotionResourceRole, WorkbenchIssue } from "./contracts.js";
import type { RuntimeStructureDiagnostics } from "./runtime-structure-diagnostics.js";
import { avatarFrameProductionSpec } from "./specs/index.js";

export const SHORT_TERM_PRODUCT_MODEL_SCHEMA_VERSION = 1 as const;

export type ShortTermFactStatus = "pass" | "warning" | "fail" | "unknown";
export type ShortTermOptimizationDisposition = "safeExecutable" | "reviewOnly" | "unsupported";

export interface ShortTermFactRow {
  id:
    | "fileSize"
    | "decodedMemory"
    | "runtimeStructure"
    | "runtimeObjectCount"
    | "animationFrameRecordCount"
    | "runtimeVisibleDensity"
    | "runtimeInvisibleRatio"
    | "sequenceFanoutRisk"
    | "canvas"
    | "fps"
    | "assetCount"
    | "duration";
  label: string;
  value: string;
  requirement: string;
  status: ShortTermFactStatus;
  copyable: boolean;
  disclosure?: "summary" | "moreInfo";
  evidenceRefs?: readonly string[];
}

export interface ShortTermAssetRow {
  id: string;
  kind: "image" | "sequence" | "audio";
  name: string;
  role: MotionResourceRole | "audio";
  thumbnail: {
    type: "image" | "sequence-four-grid" | "audio-empty" | "music";
    resourceIds: readonly string[];
  };
  dimensions: string;
  fileSize: string;
  usageCount: number;
  replaceable: boolean;
  findingCodes: readonly string[];
}

export interface ShortTermReplaceableImageElement {
  index: number;
  imageKey: string;
  resourceId: string;
  dimensions: string;
  fileSize: string;
  usageCount: number;
}

export type ShortTermRuntimeTextField = "text";

export interface ShortTermReplaceableTextElement {
  index: number;
  textKey: string;
  imageKey: string;
  resourceId: string;
  displayName: string;
  initialText: string;
  supportedFields: readonly ShortTermRuntimeTextField[];
  anchorSource: "designerNamedImageKey";
}

export interface ShortTermReplaceableElementsModel {
  images: readonly ShortTermReplaceableImageElement[];
  texts: readonly ShortTermReplaceableTextElement[];
  emptyCopy: string;
  textPreviewCopy: string;
}

export interface ShortTermOptimizationItem {
  code: string;
  title: string;
  summary: string;
  disposition: ShortTermOptimizationDisposition;
  enabled: boolean;
  estimatedFileSizeImpact: string;
  estimatedDecodedMemoryImpact: string;
  affectedResourceIds: readonly string[];
  evidenceRefs: readonly string[];
}

export interface ShortTermOptimizationModel {
  safeExecutableCount: number;
  reviewOnlyCount: number;
  unsupportedCount: number;
  estimatedSafeFileSizeSavings: string;
  estimatedSafeDecodedMemorySavings: string;
  batchActionEnabled: boolean;
  batchActionLabel: string;
  items: readonly ShortTermOptimizationItem[];
}

export interface ShortTermAudioGroupModel {
  status: "empty" | "detected" | "unsupported";
  copy: string;
  count: number;
}

export interface ShortTermOverviewModel {
  profileId: string;
  profileLabel: string;
  facts: readonly ShortTermFactRow[];
  assetSummary: {
    imageResourceCount: number;
    sequenceGroupCount: number;
    replaceableImageCount: number;
    findingCount: number;
  };
  audioGroup: ShortTermAudioGroupModel;
}

export interface ShortTermProductInspectionModel {
  schemaVersion: typeof SHORT_TERM_PRODUCT_MODEL_SCHEMA_VERSION;
  source: "avatar-frame-inspection-report";
  prdIds: readonly string[];
  overview: ShortTermOverviewModel;
  assets: readonly ShortTermAssetRow[];
  replaceableElements: ShortTermReplaceableElementsModel;
  optimization: ShortTermOptimizationModel;
}

export function createShortTermProductInspectionModel(
  report: AvatarFrameInspectionReport
): ShortTermProductInspectionModel {
  const sequenceGroups = groupSequenceResources(report.assetIntelligence.resources);
  const sequenceResourceIds = new Set(sequenceGroups.flatMap(({ resources }) => resources.map(({ resourceId }) => resourceId)));
  const replaceableTexts = replaceableTextElements(report.assetIntelligence.resources);
  const replaceableTextResourceIds = new Set(replaceableTexts.map(({ resourceId }) => resourceId));
  const replaceableImages = replaceableImageElements(report.assetIntelligence.resources, replaceableTextResourceIds);
  const audioResources = report.assetIntelligence.resources.filter(({ kind }) => kind === "audio");

  return {
    schemaVersion: SHORT_TERM_PRODUCT_MODEL_SCHEMA_VERSION,
    source: "avatar-frame-inspection-report",
    prdIds: ["S3", "S4", "S5", "S6", "S7", "S8", "S9", "S13", "S15", "S17", "S18"],
    overview: {
      profileId: report.profileId,
      profileLabel: report.profileLabel,
      facts: factRows(report),
      assetSummary: {
        imageResourceCount: report.assetIntelligence.resources.filter(({ kind }) => kind === "image").length,
        sequenceGroupCount: sequenceGroups.length,
        replaceableImageCount: replaceableImages.length,
        findingCount: report.assetIntelligence.summary.findingCount
      },
      audioGroup: audioGroup(audioResources)
    },
    assets: [
      ...imageAssetRows(report.assetIntelligence.resources, sequenceResourceIds),
      ...sequenceGroups.map(sequenceAssetRow),
      audioAssetRow(audioResources)
    ],
    replaceableElements: {
      images: replaceableImages,
      texts: replaceableTexts,
      emptyCopy: replaceableImages.length === 0
        ? "未发现设计师命名的可替换图片元素。自动命名资源不会出现在这里。"
        : "",
      textPreviewCopy: replaceableTexts.length === 0
        ? "未发现设计师命名的文本锚点。短期版本仅支持运行时文本预览，不写入 SVGA 字节。"
        : "文本会叠加到对应 imageKey 的预览位置，不写入 SVGA 字节。"
    },
    optimization: optimizationModel(report.assetIntelligence.findings, report.assetIntelligence.summary)
  };
}

export function isAutomaticImageKey(imageKey: string): boolean {
  const normalized = imageKey.trim();
  return /^\d+$/.test(normalized) || /^img[_-]?\d+$/i.test(normalized);
}

export function isReplaceableImageResource(resource: Pick<AssetIntelligenceResourceNode, "kind" | "name" | "role">): boolean {
  return resource.kind === "image"
    && !isAutomaticImageKey(resource.name)
    && !["sequence_frame", "baked_sweep_frame", "mask_or_matte"].includes(resource.role);
}

function factRows(report: AvatarFrameInspectionReport): ShortTermFactRow[] {
  const rows: Array<Omit<ShortTermFactRow, "copyable">> = [
    {
      id: "fileSize",
      label: "文件大小",
      value: formatBytes(report.asset.sizeBytes),
      requirement: `<= ${formatBytes(avatarFrameProductionSpec.maxFileSizeBytes)}`,
      status: statusFromIssue(report.issues, "file_size_exceeds_limit")
    },
    {
      id: "decodedMemory",
      label: "估算内存",
      value: formatBytes(report.memoryEstimation.totalEstimatedDecodedResourceBytes),
      requirement: "低风险 <= 4 MiB",
      status: memoryStatus(report.memoryEstimation.memoryRiskLevel)
    },
    ...runtimeStructureFactRows(report.runtimeStructureDiagnostics),
    {
      id: "canvas",
      label: "画布",
      value: formatDimensions(report.asset.dimensions),
      requirement: `<= ${formatDimensions(avatarFrameProductionSpec.maxDimensions)}`,
      status: statusFromIssue(report.issues, "dimensions_exceed_limit")
    },
    {
      id: "fps",
      label: "FPS",
      value: formatNumber(report.asset.timing.fps),
      requirement: `<= ${formatNumber(avatarFrameProductionSpec.maxFps)}`,
      status: statusFromIssue(report.issues, "fps_exceeds_limit")
    },
    {
      id: "assetCount",
      label: "资源数量",
      value: String(report.asset.resourceCount),
      requirement: `<= ${formatNumber(avatarFrameProductionSpec.maxResourceCount)}`,
      status: statusFromIssue(report.issues, "resource_count_exceeds_limit")
    },
    {
      id: "duration",
      label: "时长",
      value: formatDuration(report.asset.timing.durationMs),
      requirement: `<= ${formatDuration(avatarFrameProductionSpec.maxDurationMs)}`,
      status: statusFromIssue(report.issues, "duration_exceeds_limit")
    }
  ];
  return rows.map((fact) => ({ ...fact, copyable: true }));
}

function runtimeStructureFactRows(
  diagnostics: RuntimeStructureDiagnostics | undefined
): Array<Omit<ShortTermFactRow, "copyable">> {
  if (!diagnostics) return [];
  const risky = diagnostics.riskLevel === "medium" || diagnostics.riskLevel === "high";
  const hasOptimizationCandidate = diagnostics.allZeroSpriteCount > 0;
  const hasSequenceFanoutWarning = diagnostics.sequenceFrameFanout.maxSpriteReferencesInGroup >= 100;
  return [
    {
      id: "runtimeStructure",
      label: "运行时结构",
      value: runtimeStructureSummaryValue(diagnostics),
      requirement: "估算风险低",
      status: memoryStatus(diagnostics.riskLevel),
      disclosure: "summary",
      evidenceRefs: diagnostics.evidence
    },
    {
      id: "runtimeObjectCount",
      label: "运行对象数",
      value: formatNumber(diagnostics.spriteCount),
      requirement: hasOptimizationCandidate
        ? `${diagnostics.allZeroSpriteCount} 个全程不可见可清理`
        : "数量越低越稳",
      status: hasOptimizationCandidate ? "warning" : memoryStatus(diagnostics.riskLevel),
      disclosure: "summary",
      evidenceRefs: ["MovieEntity.sprites.length"]
    },
    {
      id: "animationFrameRecordCount",
      label: "动画帧记录数",
      value: formatNumber(diagnostics.frameEntityCount),
      requirement: hasOptimizationCandidate
        ? `${formatNumber(diagnostics.allZeroFrameEntityCount)} 条全零记录可清理`
        : "按运行对象逐帧累计",
      status: hasOptimizationCandidate ? "warning" : memoryStatus(diagnostics.riskLevel),
      disclosure: "summary",
      evidenceRefs: ["sum(sprite.frames.length)"]
    },
    {
      id: "sequenceFanoutRisk",
      label: "序列帧展开风险",
      value: diagnostics.sequenceFrameFanout.groupCount > 0
        ? `${diagnostics.sequenceFrameFanout.groupCount} 组 / 峰值 ${diagnostics.sequenceFrameFanout.maxSpriteReferencesInGroup}`
        : "未发现",
      requirement: hasSequenceFanoutWarning ? "需复核" : "低风险",
      status: hasSequenceFanoutWarning ? "warning" : "pass",
      disclosure: hasSequenceFanoutWarning ? "summary" : "moreInfo",
      evidenceRefs: diagnostics.sequenceFrameFanout.groups.map(({ groupId }) => `sequence-group:${groupId}`)
    },
    {
      id: "runtimeVisibleDensity",
      label: "活跃绘制峰值/平均",
      value: `${formatNullableNumber(diagnostics.perFrameVisibleSpritePeak)} / ${formatNullableNumber(diagnostics.perFrameVisibleSpriteAverage)}`,
      requirement: "按 alpha > 0 估算",
      status: risky ? "warning" : "pass",
      disclosure: risky ? "summary" : "moreInfo",
      evidenceRefs: ["per-frame visible runtime object count"]
    },
    {
      id: "runtimeInvisibleRatio",
      label: "不可见记录占比",
      value: formatPercent(diagnostics.invisibleFrameRatio),
      requirement: diagnostics.lowAlphaFrameCount > 0
        ? `低透明度 ${formatPercent(diagnostics.lowAlphaFrameRatio)}，需目标播放器 profile`
        : "alpha = 0 记录占比",
      status: hasOptimizationCandidate ? "warning" : "pass",
      disclosure: hasOptimizationCandidate ? "summary" : "moreInfo",
      evidenceRefs: ["FrameEntity.alpha"]
    }
  ];
}

function runtimeStructureSummaryValue(diagnostics: RuntimeStructureDiagnostics): string {
  const riskCopy = {
    low: "低风险",
    medium: "中风险",
    high: "高风险",
    unknown: "未知"
  }[diagnostics.riskLevel];
  return `${riskCopy} / 估算 ${formatBytes(diagnostics.estimatedRuntimeStructureBytes)}`;
}

function imageAssetRows(
  resources: readonly AssetIntelligenceResourceNode[],
  sequenceResourceIds: ReadonlySet<string>
): ShortTermAssetRow[] {
  return resources
    .filter(({ kind, resourceId }) => kind === "image" && !sequenceResourceIds.has(resourceId))
    .map((resource) => ({
      id: resource.resourceId,
      kind: "image",
      name: resource.name,
      role: resource.role,
      thumbnail: {
        type: "image",
        resourceIds: [resource.resourceId]
      },
      dimensions: formatDimensions(resource.dimensions),
      fileSize: formatBytes(resource.compressedSizeBytes),
      usageCount: resource.usageCount,
      replaceable: isReplaceableImageResource(resource),
      findingCodes: resource.findingCodes
    }));
}

function sequenceAssetRow(group: SequenceResourceGroup): ShortTermAssetRow {
  const first = group.resources[0];
  return {
    id: group.id,
    kind: "sequence",
    name: group.name,
    role: first?.role ?? "sequence_frame",
    thumbnail: {
      type: "sequence-four-grid",
      resourceIds: group.resources.slice(0, 4).map(({ resourceId }) => resourceId)
    },
    dimensions: formatDimensions(first?.dimensions),
    fileSize: formatBytes(sumNullable(group.resources.map(({ compressedSizeBytes }) => compressedSizeBytes))),
    usageCount: group.resources.reduce((total, resource) => total + resource.usageCount, 0),
    replaceable: false,
    findingCodes: unique(group.resources.flatMap(({ findingCodes }) => findingCodes))
  };
}

function audioAssetRow(resources: readonly AssetIntelligenceResourceNode[]): ShortTermAssetRow {
  const group = audioGroup(resources);
  return {
    id: "audio",
    kind: "audio",
    name: "音频资产",
    role: "audio",
    thumbnail: {
      type: group.status === "detected" ? "music" : "audio-empty",
      resourceIds: resources.map(({ resourceId }) => resourceId)
    },
    dimensions: "-",
    fileSize: resources.length > 0 ? formatBytes(sumNullable(resources.map(({ compressedSizeBytes }) => compressedSizeBytes))) : "-",
    usageCount: resources.length,
    replaceable: false,
    findingCodes: []
  };
}

function replaceableImageElements(
  resources: readonly AssetIntelligenceResourceNode[],
  excludedResourceIds: ReadonlySet<string> = new Set()
): ShortTermReplaceableImageElement[] {
  return resources
    .filter((resource) => isReplaceableImageResource(resource) && !excludedResourceIds.has(resource.resourceId))
    .sort((left, right) => left.name.localeCompare(right.name) || left.resourceId.localeCompare(right.resourceId))
    .map((resource, index) => ({
      index: index + 1,
      imageKey: resource.name,
      resourceId: resource.resourceId,
      dimensions: formatDimensions(resource.dimensions),
      fileSize: formatBytes(resource.compressedSizeBytes),
      usageCount: resource.usageCount
    }));
}

function replaceableTextElements(
  resources: readonly AssetIntelligenceResourceNode[]
): ShortTermReplaceableTextElement[] {
  return resources
    .filter(isReplaceableTextAnchorResource)
    .sort((left, right) => left.name.localeCompare(right.name) || left.resourceId.localeCompare(right.resourceId))
    .map((resource, index) => ({
      index: index + 1,
      textKey: resource.name,
      imageKey: resource.name,
      resourceId: resource.resourceId,
      displayName: displayNameFromTextKey(resource.name),
      initialText: "SVGA VIP",
      supportedFields: ["text"],
      anchorSource: "designerNamedImageKey"
    }));
}

function isReplaceableTextAnchorResource(resource: AssetIntelligenceResourceNode): boolean {
  return isReplaceableImageResource(resource) && isTextAnchorName(resource.name);
}

function isTextAnchorName(imageKey: string): boolean {
  const normalized = imageKey.trim().toLowerCase();
  return /(^|[_-])(text|txt|label|title|name|nickname|nick|level|caption|copy|desc|message|content|from|to|sender|receiver)(\d+)?([_-]|$)/i.test(normalized)
    || /^(text|txt)(\d+)$/i.test(normalized)
    || /^(from|to|sender|receiver|content|copy|label|desc|message)$/i.test(normalized)
    || /(文本|昵称|标题|等级|文案)/u.test(imageKey);
}

function displayNameFromTextKey(textKey: string): string {
  return textKey
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (value) => value.toUpperCase());
}

function optimizationModel(
  findings: readonly AssetIntelligenceFinding[],
  summary: AvatarFrameInspectionReport["assetIntelligence"]["summary"]
): ShortTermOptimizationModel {
  const items = findings.map(optimizationItem);
  const safeExecutableCount = items.filter(({ disposition }) => disposition === "safeExecutable").length;
  const reviewOnlyCount = items.filter(({ disposition }) => disposition === "reviewOnly").length;
  const unsupportedCount = items.filter(({ disposition }) => disposition === "unsupported").length;
  return {
    safeExecutableCount,
    reviewOnlyCount,
    unsupportedCount,
    estimatedSafeFileSizeSavings: formatBytes(summary.estimatedSafeFileSizeSavingsBytes),
    estimatedSafeDecodedMemorySavings: formatBytes(summary.estimatedSafeDecodedMemorySavingsBytes),
    batchActionEnabled: safeExecutableCount > 0,
    batchActionLabel: safeExecutableCount > 0 ? "执行安全优化" : "没有可安全执行项",
    items
  };
}

function optimizationItem(finding: AssetIntelligenceFinding): ShortTermOptimizationItem {
  const disposition = optimizationDisposition(finding.optimizationDisposition);
  return {
    code: finding.code,
    title: findingTitle(finding),
    summary: findingSummary(finding),
    disposition,
    enabled: disposition === "safeExecutable",
    estimatedFileSizeImpact: formatBytes(finding.estimatedFileSizeImpactBytes),
    estimatedDecodedMemoryImpact: formatBytes(finding.estimatedDecodedMemoryImpactBytes),
    affectedResourceIds: finding.affectedResourceIds,
    evidenceRefs: finding.evidenceRefs
  };
}

function optimizationDisposition(disposition: AssetIntelligenceOptimizationDisposition): ShortTermOptimizationDisposition {
  if (disposition === "safe_auto_optimize") return "safeExecutable";
  if (disposition === "unsupported") return "unsupported";
  return "reviewOnly";
}

function findingTitle(finding: AssetIntelligenceFinding): string {
  const titles: Readonly<Record<string, string>> = {
    unreferenced_image_resource: "未引用图片可清理",
    duplicate_encoded_image_resource: "重复图片可合并",
    all_zero_runtime_object_prunable: "全零运行对象可清理",
    runtime_structure_complexity_risk: "运行时结构复杂",
    fully_transparent_image_resource: "全透明图片需检查",
    excessive_transparent_padding: "透明留白需复核",
    large_decoded_image_resource: "解码内存偏高",
    sequence_frame_fanout_risk: "序列帧展开风险",
    sequence_frame_memory_concentration: "序列帧内存集中",
    sequence_frame_analysis_incomplete: "序列帧证据不足"
  };
  return titles[finding.code] ?? finding.title;
}

function findingSummary(finding: AssetIntelligenceFinding): string {
  const summaries: Readonly<Record<string, string>> = {
    unreferenced_image_resource: "图片未被图层引用，可生成新 SVGA 后重新打开验证。",
    duplicate_encoded_image_resource: "相同内容图片可合并引用，输出必须通过重新打开验证。",
    all_zero_runtime_object_prunable: "全程不可见的运行对象可机械移除，输出必须通过重新打开验证。",
    runtime_structure_complexity_risk: "运行对象或动画帧记录偏高，需要和解码内存分开判断。",
    fully_transparent_image_resource: "全透明资源可能影响占位或时序，引用中资源需要人工复核。",
    excessive_transparent_padding: "裁剪需要位移补偿和视觉对比，短期不进入安全批量。",
    large_decoded_image_resource: "资源解码内存偏高，先作为建议项展示。",
    sequence_frame_fanout_risk: "重复序列展开可能放大运行时结构，短期只做风险提示。",
    sequence_frame_memory_concentration: "短期只做优化建议，不执行序列帧闪帧修复。",
    sequence_frame_analysis_incomplete: "缺少哈希或透明度证据，自动优化保持关闭。"
  };
  return summaries[finding.code] ?? finding.reason;
}

function audioGroup(resources: readonly AssetIntelligenceResourceNode[]): ShortTermAudioGroupModel {
  if (resources.length === 0) {
    return {
      status: "empty",
      copy: "当前文件暂无音频资产",
      count: 0
    };
  }
  return {
    status: "detected",
    copy: "检测到音频资产；短期版本暂不要求解析时长。",
    count: resources.length
  };
}

interface SequenceResourceGroup {
  id: string;
  name: string;
  resources: readonly AssetIntelligenceResourceNode[];
}

function groupSequenceResources(
  resources: readonly AssetIntelligenceResourceNode[]
): SequenceResourceGroup[] {
  const groups = new Map<string, AssetIntelligenceResourceNode[]>();
  for (const resource of resources) {
    if (resource.role !== "sequence_frame" && resource.role !== "baked_sweep_frame") continue;
    const groupId = sequenceGroupId(resource);
    groups.set(groupId, [...(groups.get(groupId) ?? []), resource]);
  }
  return [...groups.entries()]
    .map(([id, groupResources]) => ({
      id,
      name: id,
      resources: [...groupResources].sort(compareFrameResource)
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function sequenceGroupId(resource: AssetIntelligenceResourceNode): string {
  const match = /^(.*?)([_-]?\d+)$/.exec(resource.name);
  if (match && match[1]) return match[1].replace(/[_-]+$/, "") || resource.name;
  return `${resource.role}:${resource.name}`;
}

function compareFrameResource(left: AssetIntelligenceResourceNode, right: AssetIntelligenceResourceNode): number {
  return frameIndex(left.name) - frameIndex(right.name) || left.name.localeCompare(right.name);
}

function frameIndex(name: string): number {
  const match = /(\d+)$/.exec(name);
  return match ? Number(match[1]) : 0;
}

function statusFromIssue(issues: readonly WorkbenchIssue[], code: string): ShortTermFactStatus {
  const issue = issues.find((candidate) => candidate.code === code);
  if (!issue) return "pass";
  if (issue.severity === "error") return "fail";
  if (issue.severity === "warning") return "warning";
  return "unknown";
}

function memoryStatus(level: MemoryRiskLevel): ShortTermFactStatus {
  if (level === "low") return "pass";
  if (level === "medium") return "warning";
  if (level === "high") return "fail";
  return "unknown";
}

function formatBytes(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 1024 * 1024) return `${trimNumber(value / (1024 * 1024))} MiB`;
  if (Math.abs(value) >= 1024) return `${trimNumber(value / 1024)} KiB`;
  return `${value} B`;
}

function formatDimensions(value: { width: number; height: number } | undefined): string {
  if (!value) return "-";
  return `${value.width} x ${value.height}`;
}

function formatNumber(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "-";
}

function formatNullableNumber(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? trimNumber(value) : "-";
}

function formatPercent(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `${trimNumber(value * 100)}%` : "-";
}

function formatDuration(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${trimNumber(value)} ms`;
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function sumNullable(values: readonly (number | null | undefined)[]): number | null {
  let total = 0;
  for (const value of values) {
    if (typeof value !== "number") return null;
    total += value;
  }
  return total;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
