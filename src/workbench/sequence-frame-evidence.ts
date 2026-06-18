import type {
  EvidenceAvailability,
  EvidenceConfidence,
  ImageAlphaBounds,
  MotionResourceInfo,
  SequenceFrameEvidence,
  SequenceFrameEvidenceGroup,
  SequenceResidencyUncertainty
} from "./contracts.js";

export const NEAR_EMPTY_TRANSPARENT_PADDING_RATIO = 0.99;

export function collectSequenceFrameEvidence(
  resources: readonly MotionResourceInfo[]
): SequenceFrameEvidence {
  const candidates = resources.filter(isSequenceResource);
  const missingContentHashResourceIds = candidates
    .filter(({ contentHash }) => !contentHash)
    .map(({ id }) => id);
  const missingAlphaBoundsResourceIds = candidates
    .filter(({ alphaBounds }) => !isUsableAlphaBounds(alphaBounds))
    .map(({ id }) => id);
  const duplicateFrameGroups = groupedEvidence(
    candidates.filter(({ contentHash }) => Boolean(contentHash)),
    ({ contentHash }) => contentHash
      ? `${contentHash.algorithm}:${contentHash.scope}:${contentHash.value}`
      : undefined
  );
  const fullyTransparentFrames = candidates
    .filter(({ alphaBounds }) => alphaBounds?.status === "fullyTransparent")
    .map(({ id }) => id);
  const emptyOrNearEmptyFrames = candidates
    .filter(({ alphaBounds }) => (
      alphaBounds?.status === "fullyTransparent"
      || (
        alphaBounds?.status === "known"
        && (alphaBounds.transparentPaddingRatio ?? 0)
          >= NEAR_EMPTY_TRANSPARENT_PADDING_RATIO
      )
    ))
    .map(({ id }) => id);
  const repeatedAlphaBoundsGroups = groupedEvidence(
    candidates.filter(({ alphaBounds }) => isUsableAlphaBounds(alphaBounds)),
    ({ alphaBounds }) => alphaBoundsKey(alphaBounds)
  );
  const repeatedDimensionsGroups = groupedEvidence(
    candidates.filter(({ dimensions }) => Boolean(dimensions)),
    ({ dimensions }) => dimensions
      ? `${dimensions.width}x${dimensions.height}`
      : undefined
  );

  return {
    analyzedResourceCount: candidates.length,
    duplicateEvidenceStatus: availability(
      candidates.length,
      missingContentHashResourceIds.length
    ),
    duplicateFrameGroups,
    fullyTransparentFrames,
    emptyOrNearEmptyFrames,
    nearEmptyTransparentPaddingRatio: NEAR_EMPTY_TRANSPARENT_PADDING_RATIO,
    repeatedAlphaBoundsGroups,
    repeatedDimensionsGroups,
    missingContentHashResourceIds,
    missingAlphaBoundsResourceIds,
    evidenceConfidence: confidence(
      candidates.length,
      missingContentHashResourceIds.length,
      missingAlphaBoundsResourceIds.length
    ),
    uncertainty: uncertainty(
      candidates.length,
      missingContentHashResourceIds.length,
      missingAlphaBoundsResourceIds.length
    )
  };
}

function groupedEvidence(
  resources: readonly MotionResourceInfo[],
  keyFor: (resource: MotionResourceInfo) => string | undefined
): SequenceFrameEvidenceGroup[] {
  const groups = new Map<string, string[]>();
  for (const resource of resources) {
    const key = keyFor(resource);
    if (!key) continue;
    const ids = groups.get(key) ?? [];
    ids.push(resource.id);
    groups.set(key, ids);
  }
  return [...groups.entries()]
    .filter(([, resourceIds]) => resourceIds.length >= 2)
    .map(([key, resourceIds]) => ({ key, resourceIds }));
}

function alphaBoundsKey(bounds: ImageAlphaBounds | undefined): string | undefined {
  if (!isUsableAlphaBounds(bounds)) return undefined;
  return [
    bounds.status,
    bounds.x ?? "",
    bounds.y ?? "",
    bounds.width ?? "",
    bounds.height ?? ""
  ].join(":");
}

function isUsableAlphaBounds(
  bounds: ImageAlphaBounds | undefined
): bounds is ImageAlphaBounds {
  return Boolean(bounds && bounds.status !== "unknown" && bounds.status !== "unsupported");
}

function availability(
  candidateCount: number,
  missingCount: number
): EvidenceAvailability {
  if (candidateCount === 0) return "not_applicable";
  if (missingCount === candidateCount) return "insufficient_evidence";
  return missingCount === 0 ? "known" : "partial";
}

function confidence(
  candidateCount: number,
  missingHashCount: number,
  missingAlphaCount: number
): EvidenceConfidence {
  if (candidateCount === 0) return "unknown";
  if (missingHashCount === 0 && missingAlphaCount === 0) return "high";
  if (missingHashCount < candidateCount || missingAlphaCount < candidateCount) {
    return "medium";
  }
  return "low";
}

function uncertainty(
  candidateCount: number,
  missingHashCount: number,
  missingAlphaCount: number
): SequenceResidencyUncertainty {
  if (candidateCount === 0 || (
    missingHashCount === candidateCount && missingAlphaCount === candidateCount
  )) {
    return "high";
  }
  return missingHashCount === 0 && missingAlphaCount === 0 ? "low" : "medium";
}

function isSequenceResource(resource: MotionResourceInfo): boolean {
  return resource.role === "sequence_frame" || resource.role === "baked_sweep_frame";
}
