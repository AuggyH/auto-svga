import type {
  MemoryRiskLevel,
  MotionAssetInfo,
  MotionLayerInfo,
  MotionResourceInfo
} from "./contracts.js";

export const RUNTIME_STRUCTURE_DIAGNOSTICS_SCHEMA_VERSION = 1;

export interface RuntimeStructureSequenceFanoutGroup {
  groupId: string;
  resourceIds: readonly string[];
  spriteReferenceCount: number;
  estimatedInstanceCount: number | null;
}

export interface RuntimeStructureSequenceFanoutDiagnostics {
  groupCount: number;
  totalSpriteReferences: number;
  maxSpriteReferencesInGroup: number;
  groups: readonly RuntimeStructureSequenceFanoutGroup[];
}

export interface RuntimeStructureDiagnostics {
  schemaVersion: typeof RUNTIME_STRUCTURE_DIAGNOSTICS_SCHEMA_VERSION;
  spriteCount: number;
  frameEntityCount: number;
  alphaPositiveFrameCount: number;
  zeroAlphaFrameCount: number;
  lowAlphaFrameCount: number;
  targetPlayerVisibleFrameCount: null;
  invisibleFrameRatio: number | null;
  lowAlphaFrameRatio: number | null;
  perFrameVisibleSpritePeak: number | null;
  perFrameVisibleSpriteAverage: number | null;
  estimatedRuntimeStructureBytes: number | null;
  estimatedRuntimeStructureMiB: number | null;
  riskLevel: MemoryRiskLevel;
  allZeroSpriteCount: number;
  allZeroFrameEntityCount: number;
  allZeroSpriteResourceIds: readonly string[];
  sequenceFrameFanout: RuntimeStructureSequenceFanoutDiagnostics;
  evidence: readonly string[];
  limitations: readonly string[];
}

const ESTIMATED_SPRITE_RUNTIME_BYTES = 256;
const ESTIMATED_FRAME_ENTITY_RUNTIME_BYTES = 56;
const MEDIUM_RUNTIME_STRUCTURE_RISK_BYTES = 4 * 1024 * 1024;
const HIGH_RUNTIME_STRUCTURE_RISK_BYTES = 16 * 1024 * 1024;
const LOW_ALPHA_THRESHOLD = 0.05;

export function diagnoseRuntimeStructure(asset: MotionAssetInfo): RuntimeStructureDiagnostics {
  const spriteLayers = asset.layers.filter(({ kind }) => kind === "sprite");
  const frameEntityCount = sum(spriteLayers.map(frameCountForLayer));
  const alphaFrames = spriteLayers.flatMap(frameAlphasForLayer);
  const knownAlphaFrameCount = alphaFrames.length;
  const alphaPositiveFrameCount = alphaFrames.filter((alpha) => alpha > 0).length;
  const zeroAlphaFrameCount = alphaFrames.filter((alpha) => alpha <= 0).length;
  const lowAlphaFrameCount = alphaFrames.filter((alpha) => alpha > 0 && alpha < LOW_ALPHA_THRESHOLD).length;
  const allZeroSprites = spriteLayers.filter(isAllZeroSpriteLayer);
  const estimatedRuntimeStructureBytes = estimateRuntimeStructureBytes(spriteLayers.length, frameEntityCount);
  const sequenceFrameFanout = sequenceFanout(asset.resources, spriteLayers);
  const visibleCounts = visibleCountsByFrame(spriteLayers);

  return {
    schemaVersion: RUNTIME_STRUCTURE_DIAGNOSTICS_SCHEMA_VERSION,
    spriteCount: spriteLayers.length,
    frameEntityCount,
    alphaPositiveFrameCount,
    zeroAlphaFrameCount,
    lowAlphaFrameCount,
    targetPlayerVisibleFrameCount: null,
    invisibleFrameRatio: ratioOrNull(zeroAlphaFrameCount, knownAlphaFrameCount),
    lowAlphaFrameRatio: ratioOrNull(lowAlphaFrameCount, knownAlphaFrameCount),
    perFrameVisibleSpritePeak: visibleCounts.length > 0 ? Math.max(...visibleCounts) : null,
    perFrameVisibleSpriteAverage: visibleCounts.length > 0 ? sum(visibleCounts) / visibleCounts.length : null,
    estimatedRuntimeStructureBytes,
    estimatedRuntimeStructureMiB: estimatedRuntimeStructureBytes / (1024 * 1024),
    riskLevel: runtimeRiskLevel(estimatedRuntimeStructureBytes),
    allZeroSpriteCount: allZeroSprites.length,
    allZeroFrameEntityCount: sum(allZeroSprites.map(frameCountForLayer)),
    allZeroSpriteResourceIds: unique(allZeroSprites.flatMap(({ resourceIds }) => resourceIds)),
    sequenceFrameFanout,
    evidence: [
      `spriteCount=${spriteLayers.length}`,
      `frameEntityCount=${frameEntityCount}`,
      `alphaPositiveFrameCount=${alphaPositiveFrameCount}`,
      `allZeroSpriteCount=${allZeroSprites.length}`,
      `estimatedFrameEntityBytes=${ESTIMATED_FRAME_ENTITY_RUNTIME_BYTES}`,
      `estimatedSpriteBytes=${ESTIMATED_SPRITE_RUNTIME_BYTES}`
    ],
    limitations: [
      "target_player_low_alpha_visibility_profile_not_configured",
      "runtime_structure_memory_is_an_estimate_not_device_measurement"
    ]
  };
}

function estimateRuntimeStructureBytes(spriteCount: number, frameEntityCount: number): number {
  return (spriteCount * ESTIMATED_SPRITE_RUNTIME_BYTES)
    + (frameEntityCount * ESTIMATED_FRAME_ENTITY_RUNTIME_BYTES);
}

function runtimeRiskLevel(estimatedBytes: number): MemoryRiskLevel {
  if (estimatedBytes >= HIGH_RUNTIME_STRUCTURE_RISK_BYTES) return "high";
  if (estimatedBytes >= MEDIUM_RUNTIME_STRUCTURE_RISK_BYTES) return "medium";
  return "low";
}

function frameCountForLayer(layer: MotionLayerInfo): number {
  const value = layer.metadata?.frameCount;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : 0;
}

function frameAlphasForLayer(layer: MotionLayerInfo): number[] {
  const values = layer.metadata?.frameAlphas;
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function isAllZeroSpriteLayer(layer: MotionLayerInfo): boolean {
  const alphas = frameAlphasForLayer(layer);
  return alphas.length > 0 && alphas.length === frameCountForLayer(layer) && alphas.every((alpha) => alpha <= 0);
}

function visibleCountsByFrame(layers: readonly MotionLayerInfo[]): number[] {
  const maxFrameCount = Math.max(0, ...layers.map(frameCountForLayer));
  const counts: number[] = [];
  for (let frameIndex = 0; frameIndex < maxFrameCount; frameIndex += 1) {
    counts.push(layers.reduce((total, layer) => {
      const alpha = frameAlphasForLayer(layer)[frameIndex] ?? 0;
      return total + (alpha > 0 ? 1 : 0);
    }, 0));
  }
  return counts;
}

function sequenceFanout(
  resources: readonly MotionResourceInfo[],
  spriteLayers: readonly MotionLayerInfo[]
): RuntimeStructureSequenceFanoutDiagnostics {
  const groups = sequenceResourceGroups(resources);
  const references = new Map<string, number>();
  for (const layer of spriteLayers) {
    for (const resourceId of layer.resourceIds) {
      references.set(resourceId, (references.get(resourceId) ?? 0) + 1);
    }
  }
  const fanoutGroups = [...groups.entries()]
    .map(([groupId, resourceIds]) => {
      const spriteReferenceCount = resourceIds.reduce((total, resourceId) => total + (references.get(resourceId) ?? 0), 0);
      return {
        groupId,
        resourceIds,
        spriteReferenceCount,
        estimatedInstanceCount: resourceIds.length > 0 ? spriteReferenceCount / resourceIds.length : null
      };
    })
    .filter(({ spriteReferenceCount }) => spriteReferenceCount > 0)
    .sort((left, right) => right.spriteReferenceCount - left.spriteReferenceCount || left.groupId.localeCompare(right.groupId));
  return {
    groupCount: fanoutGroups.length,
    totalSpriteReferences: sum(fanoutGroups.map(({ spriteReferenceCount }) => spriteReferenceCount)),
    maxSpriteReferencesInGroup: Math.max(0, ...fanoutGroups.map(({ spriteReferenceCount }) => spriteReferenceCount)),
    groups: fanoutGroups
  };
}

function sequenceResourceGroups(resources: readonly MotionResourceInfo[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const resource of resources) {
    if (resource.role !== "sequence_frame" && resource.role !== "baked_sweep_frame") continue;
    const groupId = sequenceGroupId(resource);
    groups.set(groupId, [...(groups.get(groupId) ?? []), resource.id]);
  }
  return new Map([...groups.entries()].map(([groupId, resourceIds]) => [
    groupId,
    [...resourceIds].sort(compareFrameResourceIds)
  ]));
}

function sequenceGroupId(resource: MotionResourceInfo): string {
  const match = /^(.*?)([_-]?\d+)$/.exec(resource.name);
  if (match && match[1]) return match[1].replace(/[_-]+$/, "") || resource.name;
  return `${resource.role}:${resource.name}`;
}

function compareFrameResourceIds(left: string, right: string): number {
  return frameIndex(left) - frameIndex(right) || left.localeCompare(right);
}

function frameIndex(name: string): number {
  const match = /(\d+)$/.exec(name);
  return match ? Number(match[1]) : 0;
}

function ratioOrNull(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
