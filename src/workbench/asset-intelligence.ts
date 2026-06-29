import type {
  EvidenceConfidence,
  MemoryRiskLevel,
  MotionAssetInfo,
  MotionAssetMemoryEstimation,
  MotionResourceInfo,
  MotionResourceRole,
  SequenceFrameEvidence,
  SequenceResidencyDiagnostics,
  SequenceResidencyUncertainty,
  WorkbenchIssue
} from "./contracts.js";
import { HIGH_MEMORY_RISK_BYTES, MEDIUM_MEMORY_RISK_BYTES } from "./memory-estimation.js";

export const ASSET_INTELLIGENCE_REPORT_SCHEMA_VERSION = 1;

export type AssetIntelligenceSeverity = "info" | "warning" | "error";
export type AssetIntelligenceAbnormalityLevel = "none" | "low" | "medium" | "high";
export type AssetIntelligenceOptimizationDisposition =
  | "safe_auto_optimize"
  | "requires_visual_confirmation"
  | "suggestion_only"
  | "structural_risky"
  | "unsupported";

export type AssetIntelligenceConcept =
  | "图片资源"
  | "图层"
  | "序列帧"
  | "未引用资源"
  | "可替换资源"
  | "遮罩资源";

export type AssetIntelligenceResourceSortKey =
  | "name"
  | "compressedSizeBytes"
  | "estimatedDecodedMemoryBytes"
  | "dimensionsArea"
  | "usageCount"
  | "abnormalityLevel";

export interface AssetIntelligenceResourceNode {
  resourceId: string;
  name: string;
  kind: MotionResourceInfo["kind"];
  role: MotionResourceRole;
  concepts: readonly AssetIntelligenceConcept[];
  usageCount: number;
  usedByLayerIds: readonly string[];
  compressedSizeBytes: number | null;
  estimatedDecodedMemoryBytes: number | null;
  dimensions?: MotionResourceInfo["dimensions"];
  contentHashKey: string | null;
  replaceable: boolean;
  abnormalityLevel: AssetIntelligenceAbnormalityLevel;
  findingCodes: readonly string[];
}

export interface AssetIntelligenceFinding {
  code: string;
  title: string;
  reason: string;
  severity: AssetIntelligenceSeverity;
  confidence: EvidenceConfidence;
  evidenceRefs: readonly string[];
  affectedResourceIds: readonly string[];
  estimatedFileSizeImpactBytes: number | null;
  estimatedDecodedMemoryImpactBytes: number | null;
  optimizationDisposition: AssetIntelligenceOptimizationDisposition;
  safeToAutoOptimize: boolean;
  roundTripRequired: boolean;
}

export interface AssetIntelligenceSummary {
  resourceCount: number;
  findingCount: number;
  severityCounts: Readonly<Record<AssetIntelligenceSeverity, number>>;
  safeAutoOptimizeFindingCount: number;
  estimatedSafeFileSizeSavingsBytes: number | null;
  estimatedSafeDecodedMemorySavingsBytes: number | null;
  unsupportedFindingCount: number;
}

export interface AssetIntelligenceReport {
  schemaVersion: typeof ASSET_INTELLIGENCE_REPORT_SCHEMA_VERSION;
  assetName: string;
  resources: readonly AssetIntelligenceResourceNode[];
  findings: readonly AssetIntelligenceFinding[];
  summary: AssetIntelligenceSummary;
  supportedSortKeys: readonly AssetIntelligenceResourceSortKey[];
}

export interface AssetIntelligenceInput {
  asset: MotionAssetInfo;
  issues: readonly WorkbenchIssue[];
  memoryEstimation: MotionAssetMemoryEstimation;
  sequenceResidencyDiagnostics: SequenceResidencyDiagnostics;
  sequenceFrameEvidence: SequenceFrameEvidence;
}

export interface AssetIntelligenceResourceFilter {
  role?: MotionResourceRole;
  concept?: AssetIntelligenceConcept;
  abnormalityAtLeast?: AssetIntelligenceAbnormalityLevel;
  query?: string;
}

const supportedSortKeys: readonly AssetIntelligenceResourceSortKey[] = [
  "name",
  "compressedSizeBytes",
  "estimatedDecodedMemoryBytes",
  "dimensionsArea",
  "usageCount",
  "abnormalityLevel"
];

const abnormalityRank: Readonly<Record<AssetIntelligenceAbnormalityLevel, number>> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3
};

export function createAssetIntelligenceReport(
  input: AssetIntelligenceInput
): AssetIntelligenceReport {
  const usage = resourceUsage(input.asset);
  const decodedBytesById = new Map(
    input.memoryEstimation.resources.map((estimate) => [
      estimate.resourceId,
      estimate.estimatedDecodedBytes
    ])
  );
  const findings = createFindings(input, usage, decodedBytesById);
  const findingCodesByResource = findingsByResource(findings);
  const resources = input.asset.resources.map((resource) => {
    const findingCodes = findingCodesByResource.get(resource.id) ?? [];
    return resourceNode(
      resource,
      usage.get(resource.id) ?? [],
      decodedBytesById.get(resource.id) ?? null,
      findingCodes,
      abnormalityForFindingCodes(findings, findingCodes)
    );
  });

  return {
    schemaVersion: ASSET_INTELLIGENCE_REPORT_SCHEMA_VERSION,
    assetName: input.asset.name,
    resources,
    findings,
    summary: summarize(resources, findings),
    supportedSortKeys
  };
}

export function sortAssetIntelligenceResources(
  resources: readonly AssetIntelligenceResourceNode[],
  key: AssetIntelligenceResourceSortKey,
  direction: "asc" | "desc" = key === "name" ? "asc" : "desc"
): AssetIntelligenceResourceNode[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...resources].sort((left, right) => {
    const compared = compareResourceValue(left, right, key);
    if (compared !== 0) return compared * multiplier;
    return left.name.localeCompare(right.name) || left.resourceId.localeCompare(right.resourceId);
  });
}

export function filterAssetIntelligenceResources(
  resources: readonly AssetIntelligenceResourceNode[],
  filter: AssetIntelligenceResourceFilter
): AssetIntelligenceResourceNode[] {
  const minimumAbnormality = filter.abnormalityAtLeast
    ? abnormalityRank[filter.abnormalityAtLeast]
    : undefined;
  const query = filter.query?.trim().toLowerCase();
  return resources.filter((resource) => (
    (!filter.role || resource.role === filter.role)
    && (!filter.concept || resource.concepts.includes(filter.concept))
    && (
      minimumAbnormality === undefined
      || abnormalityRank[resource.abnormalityLevel] >= minimumAbnormality
    )
    && (!query || resource.name.toLowerCase().includes(query) || resource.resourceId.toLowerCase().includes(query))
  ));
}

function createFindings(
  input: AssetIntelligenceInput,
  usage: ReadonlyMap<string, readonly string[]>,
  decodedBytesById: ReadonlyMap<string, number | null>
): AssetIntelligenceFinding[] {
  return [
    ...unreferencedResourceFindings(input.asset, usage, decodedBytesById),
    ...duplicateResourceFindings(input.asset, decodedBytesById),
    ...transparentResourceFindings(input.asset, usage, decodedBytesById),
    ...transparentPaddingFindings(input.asset, input.issues, decodedBytesById),
    ...largeDecodedResourceFindings(input.asset, decodedBytesById),
    ...sequenceMemoryFindings(input.sequenceResidencyDiagnostics),
    ...analysisCoverageFindings(input.sequenceFrameEvidence)
  ];
}

function unreferencedResourceFindings(
  asset: MotionAssetInfo,
  usage: ReadonlyMap<string, readonly string[]>,
  decodedBytesById: ReadonlyMap<string, number | null>
): AssetIntelligenceFinding[] {
  return asset.resources
    .filter((resource) => resource.kind === "image" && (usage.get(resource.id)?.length ?? 0) === 0)
    .map((resource) => finding({
      code: "unreferenced_image_resource",
      title: "未引用图片资源",
      reason: "No layer references this image resource, so it is a safe removal candidate after round-trip validation.",
      severity: "warning",
      confidence: "high",
      evidenceRefs: [`resource:${resource.id}`, "resourceGraph:usageCount=0"],
      affectedResourceIds: [resource.id],
      fileSizeImpact: resource.sizeBytes ?? null,
      decodedMemoryImpact: decodedBytesById.get(resource.id) ?? null,
      disposition: "safe_auto_optimize"
    }));
}

function duplicateResourceFindings(
  asset: MotionAssetInfo,
  decodedBytesById: ReadonlyMap<string, number | null>
): AssetIntelligenceFinding[] {
  const groups = new Map<string, MotionResourceInfo[]>();
  for (const resource of asset.resources) {
    if (resource.kind !== "image" || !resource.contentHash || resource.contentHash.scope !== "encoded_bytes") {
      continue;
    }
    const key = contentHashKey(resource);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(resource);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .filter(([, group]) => group.length >= 2)
    .map(([key, group]) => {
      const duplicates = group.slice(1);
      return finding({
        code: "duplicate_encoded_image_resource",
        title: "重复图片资源",
        reason: "Multiple image resources have byte-identical encoded content. References can be collapsed only through a new exported SVGA and reopened validation.",
        severity: "warning",
        confidence: "high",
        evidenceRefs: [`hash-group:${key}`, ...group.map(({ id }) => `resource:${id}`)],
        affectedResourceIds: duplicates.map(({ id }) => id),
        fileSizeImpact: nullableSum(duplicates.map(({ sizeBytes }) => sizeBytes ?? null)),
        decodedMemoryImpact: nullableSum(duplicates.map(({ id }) => decodedBytesById.get(id) ?? null)),
        disposition: "safe_auto_optimize"
      });
    });
}

function transparentResourceFindings(
  asset: MotionAssetInfo,
  usage: ReadonlyMap<string, readonly string[]>,
  decodedBytesById: ReadonlyMap<string, number | null>
): AssetIntelligenceFinding[] {
  return asset.resources
    .filter((resource) => resource.alphaBounds?.status === "fullyTransparent")
    .map((resource) => {
      const usageCount = usage.get(resource.id)?.length ?? 0;
      return finding({
        code: "fully_transparent_image_resource",
        title: "全透明图片资源",
        reason: usageCount === 0
          ? "The image is fully transparent and unreferenced, so removal is mechanically safe after round-trip validation."
          : "The image is fully transparent but still referenced by layers; removal requires visual confirmation.",
        severity: usageCount === 0 ? "warning" : "error",
        confidence: "high",
        evidenceRefs: [`resource:${resource.id}`, "alphaBounds:fullyTransparent"],
        affectedResourceIds: [resource.id],
        fileSizeImpact: resource.sizeBytes ?? null,
        decodedMemoryImpact: decodedBytesById.get(resource.id) ?? null,
        disposition: usageCount === 0 ? "safe_auto_optimize" : "requires_visual_confirmation"
      });
    });
}

function transparentPaddingFindings(
  asset: MotionAssetInfo,
  issues: readonly WorkbenchIssue[],
  decodedBytesById: ReadonlyMap<string, number | null>
): AssetIntelligenceFinding[] {
  return issues
    .filter(({ code }) => code === "resource_transparent_padding_exceeds_limit")
    .map((issue) => {
      const resourceIds = issueResourceIds(issue);
      const decodedImpact = nullableSum(resourceIds.map((id) => {
        const resource = asset.resources.find((candidate) => candidate.id === id);
        const decodedBytes = decodedBytesById.get(id);
        const ratio = resource?.alphaBounds?.transparentPaddingRatio;
        return typeof decodedBytes === "number" && typeof ratio === "number"
          ? Math.round(decodedBytes * ratio)
          : null;
      }));
      return finding({
        code: "excessive_transparent_padding",
        title: "透明留白过多",
        reason: "Transparent padding exceeds the active specification. Cropping requires transform or offset compensation and visual comparison.",
        severity: issue.severity === "error" ? "error" : "warning",
        confidence: resourceIds.length > 0 ? "high" : "medium",
        evidenceRefs: [`issue:${issue.code}`, ...resourceIds.map((id) => `resource:${id}`)],
        affectedResourceIds: resourceIds,
        fileSizeImpact: null,
        decodedMemoryImpact: decodedImpact,
        disposition: "requires_visual_confirmation"
      });
    });
}

function largeDecodedResourceFindings(
  asset: MotionAssetInfo,
  decodedBytesById: ReadonlyMap<string, number | null>
): AssetIntelligenceFinding[] {
  return asset.resources.flatMap((resource) => {
    const decodedBytes = decodedBytesById.get(resource.id);
    if (typeof decodedBytes !== "number" || decodedBytes <= MEDIUM_MEMORY_RISK_BYTES) return [];
    const highRisk = decodedBytes > HIGH_MEMORY_RISK_BYTES;
    return [finding({
      code: "large_decoded_image_resource",
      title: "图片解码内存偏高",
      reason: "Decoded memory estimate is high enough to require product review before optimization.",
      severity: highRisk ? "error" : "warning",
      confidence: "high",
      evidenceRefs: [`resource:${resource.id}`, `metric:decodedBytes=${decodedBytes}`],
      affectedResourceIds: [resource.id],
      fileSizeImpact: resource.sizeBytes ?? null,
      decodedMemoryImpact: decodedBytes,
      disposition: "suggestion_only"
    })];
  });
}

function sequenceMemoryFindings(
  diagnostics: SequenceResidencyDiagnostics
): AssetIntelligenceFinding[] {
  if (diagnostics.advisoryRiskLevel === "low" || diagnostics.advisoryRiskLevel === "unknown") {
    return [];
  }
  const affectedResourceIds = diagnostics.largestSequenceGroupsByDecodedBytes
    .flatMap(({ resourceIds }) => resourceIds);
  return [finding({
    code: "sequence_frame_memory_concentration",
    title: "序列帧内存集中",
    reason: "Sequence-frame resources account for a notable decoded-memory share. Repair or packing choices need playback validation.",
    severity: diagnostics.advisoryRiskLevel === "high" ? "error" : "warning",
    confidence: confidenceFromUncertainty(diagnostics.uncertainty),
    evidenceRefs: [
      "metric:sequenceResidencyDiagnostics.advisoryRiskLevel",
      ...diagnostics.framesPerGroup.map(({ groupId }) => `sequence-group:${groupId}`)
    ],
    affectedResourceIds,
    fileSizeImpact: null,
    decodedMemoryImpact: diagnostics.totalSequenceFrameEstimatedDecodedBytes,
    disposition: "suggestion_only"
  })];
}

function analysisCoverageFindings(evidence: SequenceFrameEvidence): AssetIntelligenceFinding[] {
  if (
    evidence.analyzedResourceCount === 0
    || evidence.duplicateEvidenceStatus !== "insufficient_evidence"
  ) {
    return [];
  }
  const affectedResourceIds = unique([
    ...evidence.missingContentHashResourceIds,
    ...evidence.missingAlphaBoundsResourceIds
  ]);
  return [finding({
    code: "sequence_frame_analysis_incomplete",
    title: "序列帧证据不足",
    reason: "Sequence-frame duplicate or emptiness analysis is incomplete because required hashes or alpha bounds are missing.",
    severity: "info",
    confidence: evidence.evidenceConfidence,
    evidenceRefs: [
      "metric:sequenceFrameEvidence.duplicateEvidenceStatus",
      ...affectedResourceIds.map((id) => `resource:${id}`)
    ],
    affectedResourceIds,
    fileSizeImpact: null,
    decodedMemoryImpact: null,
    disposition: "unsupported"
  })];
}

function resourceNode(
  resource: MotionResourceInfo,
  usedByLayerIds: readonly string[],
  estimatedDecodedMemoryBytes: number | null,
  findingCodes: readonly string[],
  abnormalityLevel: AssetIntelligenceAbnormalityLevel
): AssetIntelligenceResourceNode {
  return {
    resourceId: resource.id,
    name: resource.name,
    kind: resource.kind,
    role: resource.role ?? "unknown",
    concepts: resourceConcepts(resource, usedByLayerIds),
    usageCount: usedByLayerIds.length,
    usedByLayerIds,
    compressedSizeBytes: resource.sizeBytes ?? null,
    estimatedDecodedMemoryBytes,
    dimensions: resource.dimensions,
    contentHashKey: contentHashKey(resource),
    replaceable: resource.replaceable === true,
    abnormalityLevel,
    findingCodes
  };
}

function resourceConcepts(
  resource: MotionResourceInfo,
  usedByLayerIds: readonly string[]
): AssetIntelligenceConcept[] {
  return unique([
    "图片资源",
    ...(usedByLayerIds.length > 0 ? ["图层"] as const : ["未引用资源"] as const),
    ...(resource.role === "sequence_frame" || resource.role === "baked_sweep_frame" ? ["序列帧"] as const : []),
    ...(resource.role === "mask_or_matte" ? ["遮罩资源"] as const : []),
    ...(resource.replaceable === true ? ["可替换资源"] as const : [])
  ]);
}

function resourceUsage(asset: MotionAssetInfo): Map<string, string[]> {
  const usage = new Map<string, string[]>();
  for (const layer of asset.layers) {
    for (const resourceId of layer.resourceIds) {
      const ids = usage.get(resourceId) ?? [];
      ids.push(layer.id);
      usage.set(resourceId, ids);
    }
  }
  return usage;
}

function finding(input: {
  code: string;
  title: string;
  reason: string;
  severity: AssetIntelligenceSeverity;
  confidence: EvidenceConfidence;
  evidenceRefs: readonly string[];
  affectedResourceIds: readonly string[];
  fileSizeImpact: number | null;
  decodedMemoryImpact: number | null;
  disposition: AssetIntelligenceOptimizationDisposition;
}): AssetIntelligenceFinding {
  return {
    code: input.code,
    title: input.title,
    reason: input.reason,
    severity: input.severity,
    confidence: input.confidence,
    evidenceRefs: unique(input.evidenceRefs),
    affectedResourceIds: unique(input.affectedResourceIds),
    estimatedFileSizeImpactBytes: input.fileSizeImpact,
    estimatedDecodedMemoryImpactBytes: input.decodedMemoryImpact,
    optimizationDisposition: input.disposition,
    safeToAutoOptimize: input.disposition === "safe_auto_optimize",
    roundTripRequired: input.disposition === "safe_auto_optimize"
  };
}

function summarize(
  resources: readonly AssetIntelligenceResourceNode[],
  findings: readonly AssetIntelligenceFinding[]
): AssetIntelligenceSummary {
  const safeFindings = findings.filter(({ safeToAutoOptimize }) => safeToAutoOptimize);
  const hasOverlappingSafeResources = hasOverlappingAffectedResourceIds(safeFindings);
  return {
    resourceCount: resources.length,
    findingCount: findings.length,
    severityCounts: {
      info: findings.filter(({ severity }) => severity === "info").length,
      warning: findings.filter(({ severity }) => severity === "warning").length,
      error: findings.filter(({ severity }) => severity === "error").length
    },
    safeAutoOptimizeFindingCount: safeFindings.length,
    estimatedSafeFileSizeSavingsBytes: hasOverlappingSafeResources
      ? null
      : nullableSum(safeFindings.map(({ estimatedFileSizeImpactBytes }) => estimatedFileSizeImpactBytes)),
    estimatedSafeDecodedMemorySavingsBytes: hasOverlappingSafeResources
      ? null
      : nullableSum(safeFindings.map(({ estimatedDecodedMemoryImpactBytes }) => estimatedDecodedMemoryImpactBytes)),
    unsupportedFindingCount: findings.filter(({ optimizationDisposition }) => optimizationDisposition === "unsupported").length
  };
}

function hasOverlappingAffectedResourceIds(findings: readonly AssetIntelligenceFinding[]): boolean {
  const seen = new Set<string>();
  for (const finding of findings) {
    for (const resourceId of finding.affectedResourceIds) {
      if (seen.has(resourceId)) return true;
      seen.add(resourceId);
    }
  }
  return false;
}

function findingsByResource(
  findings: readonly AssetIntelligenceFinding[]
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const finding of findings) {
    for (const resourceId of finding.affectedResourceIds) {
      const codes = result.get(resourceId) ?? [];
      codes.push(finding.code);
      result.set(resourceId, codes);
    }
  }
  return result;
}

function abnormalityForFindingCodes(
  findings: readonly AssetIntelligenceFinding[],
  codes: readonly string[]
): AssetIntelligenceAbnormalityLevel {
  const severities = findings
    .filter(({ code }) => codes.includes(code))
    .map(({ severity }) => severity);
  if (severities.includes("error")) return "high";
  if (severities.includes("warning")) return "medium";
  if (severities.includes("info")) return "low";
  return "none";
}

function compareResourceValue(
  left: AssetIntelligenceResourceNode,
  right: AssetIntelligenceResourceNode,
  key: AssetIntelligenceResourceSortKey
): number {
  if (key === "name") return left.name.localeCompare(right.name);
  if (key === "abnormalityLevel") {
    return abnormalityRank[left.abnormalityLevel] - abnormalityRank[right.abnormalityLevel];
  }
  return compareNullableNumber(resourceSortNumber(left, key), resourceSortNumber(right, key));
}

function resourceSortNumber(
  resource: AssetIntelligenceResourceNode,
  key: Exclude<AssetIntelligenceResourceSortKey, "name" | "abnormalityLevel">
): number | null {
  if (key === "compressedSizeBytes") return resource.compressedSizeBytes;
  if (key === "estimatedDecodedMemoryBytes") return resource.estimatedDecodedMemoryBytes;
  if (key === "usageCount") return resource.usageCount;
  const dimensions = resource.dimensions;
  return dimensions ? dimensions.width * dimensions.height : null;
}

function compareNullableNumber(left: number | null, right: number | null): number {
  if (left === null && right === null) return 0;
  if (left === null) return -1;
  if (right === null) return 1;
  return left - right;
}

function issueResourceIds(issue: WorkbenchIssue): string[] {
  const value = issue.details?.resourceId;
  if (typeof value === "string") return [value];
  const values = issue.details?.resources;
  if (Array.isArray(values)) {
    return values.filter((candidate): candidate is string => typeof candidate === "string");
  }
  return [];
}

function contentHashKey(resource: MotionResourceInfo): string | null {
  const hash = resource.contentHash;
  return hash ? `${hash.algorithm}:${hash.scope}:${hash.value}` : null;
}

function confidenceFromUncertainty(
  uncertainty: SequenceResidencyUncertainty
): EvidenceConfidence {
  if (uncertainty === "low") return "high";
  if (uncertainty === "medium") return "medium";
  return "low";
}

function nullableSum(values: readonly (number | null | undefined)[]): number | null {
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
