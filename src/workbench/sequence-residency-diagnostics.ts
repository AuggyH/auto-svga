import type {
  MemoryRiskLevel,
  MotionAssetMemoryEstimation,
  MotionResourceInfo,
  MotionResourceMemoryEstimate,
  SequenceResidencyDiagnostics,
  SequenceResidencyGroup,
  SequenceResidencyModel,
  SequenceResidencyUncertainty
} from "./contracts.js";

const MEDIUM_SEQUENCE_BYTES = 4 * 1024 * 1024;
const HIGH_SEQUENCE_BYTES = 16 * 1024 * 1024;

interface Candidate {
  resource: MotionResourceInfo;
  estimate: MotionResourceMemoryEstimate;
  frameIndex?: number;
}

export function diagnoseSequenceResidency(
  resources: readonly MotionResourceInfo[],
  estimation: MotionAssetMemoryEstimation
): SequenceResidencyDiagnostics {
  const estimateById = new Map(
    estimation.resources.map((estimate) => [estimate.resourceId, estimate])
  );
  const candidates = resources
    .filter(isSequenceResource)
    .flatMap((resource) => {
      const estimate = estimateById.get(resource.id);
      return estimate ? [{ resource, estimate }] : [];
    });
  const { groups, ungroupedResourceIds } = groupCandidates(candidates);
  const totalSequenceFrameEstimatedDecodedBytes = totalBytes(
    candidates.map(({ estimate }) => estimate)
  );
  const possibleResidencyModels = residencyModels(groups, candidates.length, ungroupedResourceIds);
  const evidence = unique([
    ...(candidates.length > 0 ? ["sequence_or_baked_role"] : []),
    ...groups.flatMap((group) => group.evidence)
  ]);
  const uncertainty = overallUncertainty(groups, candidates, ungroupedResourceIds);

  return {
    sequenceGroupCount: groups.length,
    framesPerGroup: groups.map(({ groupId, frameCount }) => ({ groupId, frameCount })),
    totalSequenceFrameEstimatedDecodedBytes,
    largestSequenceGroupsByDecodedBytes: groups
      .filter(isKnownGroup)
      .sort((left, right) => (
        right.totalEstimatedDecodedBytes - left.totalEstimatedDecodedBytes
      )),
    possibleResidencyModels,
    advisoryRiskLevel: advisoryRisk(
      totalSequenceFrameEstimatedDecodedBytes,
      estimation.totalEstimatedDecodedResourceBytes
    ),
    evidence,
    uncertainty,
    ungroupedResourceIds
  };
}

function groupCandidates(candidates: readonly Candidate[]): {
  groups: SequenceResidencyGroup[];
  ungroupedResourceIds: string[];
} {
  const explicit = new Map<string, Candidate[]>();
  const inferred = new Map<string, Candidate[]>();
  const ungroupedResourceIds: string[] = [];

  for (const candidate of candidates) {
    const explicitGroupId = metadataString(candidate.resource, "sequenceGroupId");
    if (explicitGroupId) {
      append(
        explicit,
        `metadata:${candidate.resource.role}:${explicitGroupId}`,
        candidate
      );
      continue;
    }
    const match = /^(.*?)(\d+)$/.exec(candidate.resource.name);
    if (!match || match[1].length === 0) {
      ungroupedResourceIds.push(candidate.resource.id);
      continue;
    }
    const dimensions = candidate.resource.dimensions;
    const dimensionKey = dimensions ? `${dimensions.width}x${dimensions.height}` : "unknown";
    candidate.frameIndex = Number(match[2]);
    append(
      inferred,
      `${candidate.resource.role}:${match[1]}:${dimensionKey}`,
      candidate
    );
  }

  const groups = [...explicit.entries()].map(([groupId, group]) => (
    createGroup(groupId, group, ["known_sequence_group_metadata"])
  ));
  for (const [baseId, candidatesForPrefix] of inferred) {
    const sorted = [...candidatesForPrefix].sort(
      (left, right) => (left.frameIndex ?? 0) - (right.frameIndex ?? 0)
    );
    for (const segment of continuousSegments(sorted)) {
      if (segment.length < 3) {
        ungroupedResourceIds.push(...segment.map(({ resource }) => resource.id));
        continue;
      }
      const start = segment[0].frameIndex;
      const end = segment[segment.length - 1].frameIndex;
      groups.push(createGroup(
        `${baseId}:${start}-${end}`,
        segment,
        ["continuous_numeric_suffix"]
      ));
    }
  }

  return { groups, ungroupedResourceIds };
}

function createGroup(
  groupId: string,
  candidates: readonly Candidate[],
  baseEvidence: readonly string[]
): SequenceResidencyGroup {
  const alphaEvidence = hasConsistentKnownAlphaBounds(candidates)
    ? ["consistent_alpha_bounds"]
    : [];
  const dimensionsKnown = candidates.every(({ resource }) => resource.dimensions);
  const dimensionsRepeated = dimensionsKnown && candidates.every(({ resource }) => (
    resource.dimensions?.width === candidates[0].resource.dimensions?.width
    && resource.dimensions?.height === candidates[0].resource.dimensions?.height
  ));
  const evidence = unique([
    "resource_role",
    ...baseEvidence,
    ...(dimensionsKnown ? ["known_dimensions"] : []),
    ...(dimensionsRepeated ? ["repeated_dimensions"] : []),
    ...(candidates.length >= 8 ? ["long_sequence_group"] : []),
    ...alphaEvidence
  ]);

  return {
    groupId,
    role: candidates[0].resource.role as "sequence_frame" | "baked_sweep_frame",
    resourceIds: candidates.map(({ resource }) => resource.id),
    frameCount: candidates.length,
    totalEstimatedDecodedBytes: totalBytes(candidates.map(({ estimate }) => estimate)),
    evidence,
    uncertainty: baseEvidence.includes("known_sequence_group_metadata")
      ? "low"
      : dimensionsKnown ? "medium" : "high"
  };
}

function continuousSegments(sorted: readonly Candidate[]): Candidate[][] {
  const segments: Candidate[][] = [];
  let current: Candidate[] = [];
  for (const candidate of sorted) {
    const previous = current[current.length - 1];
    if (previous && candidate.frameIndex !== (previous.frameIndex ?? 0) + 1) {
      segments.push(current);
      current = [];
    }
    current.push(candidate);
  }
  if (current.length > 0) {
    segments.push(current);
  }
  return segments;
}

function residencyModels(
  groups: readonly SequenceResidencyGroup[],
  candidateCount: number,
  ungroupedResourceIds: readonly string[]
): SequenceResidencyModel[] {
  if (candidateCount === 0) {
    return ["unknown"];
  }
  return unique([
    "all_frames_resident",
    ...(groups.length > 0 ? ["group_resident"] as const : []),
    ...(groups.some(({ evidence }) => evidence.includes("long_sequence_group"))
      ? ["windowed_or_streaming"] as const
      : []),
    ...(groups.some(({ evidence }) => evidence.includes("repeated_dimensions"))
      ? ["sprite_sheet_candidate"] as const
      : []),
    ...(ungroupedResourceIds.length > 0 ? ["unknown"] as const : [])
  ]);
}

function overallUncertainty(
  groups: readonly SequenceResidencyGroup[],
  candidates: readonly Candidate[],
  ungroupedResourceIds: readonly string[]
): SequenceResidencyUncertainty {
  if (
    candidates.length === 0
    || groups.length === 0
    || ungroupedResourceIds.length > 0
    || candidates.some(({ estimate }) => estimate.estimatedDecodedBytes === null)
  ) {
    return "high";
  }
  return groups.every(({ uncertainty }) => uncertainty === "low") ? "low" : "medium";
}

function advisoryRisk(sequenceBytes: number | null, totalBytes: number | null): MemoryRiskLevel {
  if (sequenceBytes === null) {
    return "unknown";
  }
  const share = totalBytes && totalBytes > 0 ? sequenceBytes / totalBytes : 0;
  if (sequenceBytes > HIGH_SEQUENCE_BYTES || (
    sequenceBytes > MEDIUM_SEQUENCE_BYTES && share >= 0.5
  )) {
    return "high";
  }
  if (sequenceBytes > MEDIUM_SEQUENCE_BYTES || share >= 0.5) {
    return "medium";
  }
  return "low";
}

function hasConsistentKnownAlphaBounds(candidates: readonly Candidate[]): boolean {
  const bounds = candidates.map(({ resource }) => resource.alphaBounds);
  if (bounds.length === 0 || bounds.some((value) => value?.status !== "known")) {
    return false;
  }
  const first = bounds[0];
  return bounds.every((value) => (
    value?.x === first?.x
    && value?.y === first?.y
    && value?.width === first?.width
    && value?.height === first?.height
    && value?.transparentPaddingRatio === first?.transparentPaddingRatio
  ));
}

function totalBytes(estimates: readonly MotionResourceMemoryEstimate[]): number | null {
  if (estimates.some(({ estimatedDecodedBytes }) => estimatedDecodedBytes === null)) {
    return null;
  }
  return estimates.reduce(
    (total, estimate) => total + (estimate.estimatedDecodedBytes ?? 0),
    0
  );
}

function metadataString(resource: MotionResourceInfo, key: string): string | undefined {
  const value = resource.metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isSequenceResource(resource: MotionResourceInfo): boolean {
  return resource.role === "sequence_frame" || resource.role === "baked_sweep_frame";
}

function append<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

function isKnownGroup(
  group: SequenceResidencyGroup
): group is SequenceResidencyGroup & { totalEstimatedDecodedBytes: number } {
  return group.totalEstimatedDecodedBytes !== null;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
