import type {
  MotionAssetMemoryEstimation,
  MotionResourceMemoryEstimate,
  MotionResourceRole,
  RoleAwareMemoryDiagnostics,
  RoleMemoryDiagnostic
} from "./contracts.js";

const RESOURCE_ROLES: readonly MotionResourceRole[] = [
  "static_image",
  "sequence_frame",
  "baked_sweep_frame",
  "mask_or_matte",
  "unknown"
];

export function diagnoseMemoryByRole(
  estimation: MotionAssetMemoryEstimation
): RoleAwareMemoryDiagnostics {
  const grouped = new Map<MotionResourceRole, MotionResourceMemoryEstimate[]>(
    RESOURCE_ROLES.map((role) => [role, []])
  );

  for (const resource of estimation.resources) {
    grouped.get(resource.role ?? "unknown")?.push(resource);
  }

  const diagnostics = Object.fromEntries(
    RESOURCE_ROLES.map((role) => [role, summarizeRole(role, grouped.get(role) ?? [])])
  ) as Record<MotionResourceRole, RoleMemoryDiagnostic>;

  return {
    byRole: diagnostics,
    sequenceFrameEstimatedDecodedBytes:
      diagnostics.sequence_frame.totalEstimatedDecodedBytes
  };
}

function summarizeRole(
  role: MotionResourceRole,
  resources: readonly MotionResourceMemoryEstimate[]
): RoleMemoryDiagnostic {
  const known = resources.filter(isKnownEstimate);
  const unknownMemoryCount = resources.length - known.length;

  return {
    role,
    resourceCount: resources.length,
    knownMemoryCount: known.length,
    unknownMemoryCount,
    totalEstimatedDecodedBytes: unknownMemoryCount === 0
      ? known.reduce((total, resource) => total + resource.estimatedDecodedBytes, 0)
      : null,
    totalEstimatedTextureBytes: resources.some(
      ({ estimatedTextureBytes }) => estimatedTextureBytes === null
    )
      ? null
      : resources.reduce(
        (total, resource) => total + (resource.estimatedTextureBytes ?? 0),
        0
      ),
    largestResourcesByDecodedBytes: [...known].sort(
      (left, right) => right.estimatedDecodedBytes - left.estimatedDecodedBytes
    )
  };
}

function isKnownEstimate(
  resource: MotionResourceMemoryEstimate
): resource is MotionResourceMemoryEstimate & { estimatedDecodedBytes: number } {
  return resource.estimatedDecodedBytes !== null;
}
