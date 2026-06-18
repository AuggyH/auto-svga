import type {
  MemoryRiskLevel,
  MotionAssetMemoryEstimation,
  MotionResourceInfo,
  MotionResourceMemoryEstimate
} from "./contracts.js";

export const DECODED_BYTES_PER_PIXEL = 4;
export const MEDIUM_MEMORY_RISK_BYTES = 4 * 1024 * 1024;
export const HIGH_MEMORY_RISK_BYTES = 16 * 1024 * 1024;

export function estimateDecodedMemory(
  resources: readonly MotionResourceInfo[]
): MotionAssetMemoryEstimation {
  const estimates = resources.map(estimateResource);
  const unknownResourceIds = estimates
    .filter(({ estimatedDecodedBytes }) => estimatedDecodedBytes === null)
    .map(({ resourceId }) => resourceId);
  const knownEstimates = estimates.filter(isKnownEstimate);
  const totalEstimatedDecodedResourceBytes = unknownResourceIds.length === 0
    ? sumDecodedBytes(knownEstimates)
    : null;
  const sequenceEstimates = estimates.filter(({ role }) => role === "sequence_frame");
  const sequenceFrameEstimatedDecodedBytes = sequenceEstimates.some(
    ({ estimatedDecodedBytes }) => estimatedDecodedBytes === null
  )
    ? null
    : sumDecodedBytes(sequenceEstimates.filter(isKnownEstimate));

  return {
    bytesPerPixel: DECODED_BYTES_PER_PIXEL,
    resources: estimates,
    totalEstimatedDecodedResourceBytes,
    largestResourcesByDecodedBytes: [...knownEstimates].sort(
      (left, right) => right.estimatedDecodedBytes - left.estimatedDecodedBytes
    ),
    sequenceFrameEstimatedDecodedBytes,
    unknownResourceIds,
    memoryRiskLevel: memoryRiskLevel(totalEstimatedDecodedResourceBytes)
  };
}

function estimateResource(resource: MotionResourceInfo): MotionResourceMemoryEstimate {
  const dimensions = resource.dimensions;
  const candidateBytes = dimensions && validDimension(dimensions.width) && validDimension(dimensions.height)
    ? dimensions.width * dimensions.height * DECODED_BYTES_PER_PIXEL
    : null;
  const estimatedBytes = candidateBytes !== null && Number.isSafeInteger(candidateBytes)
    ? candidateBytes
    : null;

  return {
    resourceId: resource.id,
    resourceName: resource.name,
    role: resource.role,
    estimatedDecodedBytes: estimatedBytes,
    estimatedTextureBytes: estimatedBytes
  };
}

function validDimension(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isKnownEstimate(
  estimate: MotionResourceMemoryEstimate
): estimate is MotionResourceMemoryEstimate & { estimatedDecodedBytes: number } {
  return estimate.estimatedDecodedBytes !== null;
}

function sumDecodedBytes(
  estimates: readonly (MotionResourceMemoryEstimate & { estimatedDecodedBytes: number })[]
): number {
  return estimates.reduce((total, estimate) => total + estimate.estimatedDecodedBytes, 0);
}

function memoryRiskLevel(totalBytes: number | null): MemoryRiskLevel {
  if (totalBytes === null) {
    return "unknown";
  }
  if (totalBytes > HIGH_MEMORY_RISK_BYTES) {
    return "high";
  }
  if (totalBytes > MEDIUM_MEMORY_RISK_BYTES) {
    return "medium";
  }
  return "low";
}
