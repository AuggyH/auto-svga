import type {
  MotionResourceInfo,
  MotionResourceRole,
  SequenceResidencyDiagnostics,
  SequenceResidencyGroup,
  SequenceResidencyUncertainty
} from "./contracts.js";

export type TransparentPaddingPolicySeverity =
  | "error"
  | "warning"
  | "advisory"
  | "info"
  | "unknown";

export interface TransparentPaddingPolicyDiagnostic {
  role: MotionResourceRole;
  resourceKey?: string;
  groupId?: string;
  paddingRatio: number | null;
  severity: TransparentPaddingPolicySeverity;
  policyCode: string;
  evidenceRefs: readonly string[];
  uncertainty: SequenceResidencyUncertainty;
  recommendedReview: string;
}

export interface RoleAwareTransparentPaddingPolicySummary {
  maximumTransparentPaddingRatio: number;
  evaluatedResourceCount: number;
  diagnostics: readonly TransparentPaddingPolicyDiagnostic[];
}

export interface RoleAwareTransparentPaddingPolicyInput {
  resources: readonly MotionResourceInfo[];
  sequenceResidencyDiagnostics: SequenceResidencyDiagnostics;
  maximumTransparentPaddingRatio: number;
}

export function evaluateRoleAwareTransparentPadding(
  input: RoleAwareTransparentPaddingPolicyInput
): RoleAwareTransparentPaddingPolicySummary {
  const images = input.resources.filter(({ kind }) => kind === "image");
  const groupsByResourceId = indexGroups(
    input.sequenceResidencyDiagnostics.largestSequenceGroupsByDecodedBytes
  );
  const diagnostics: TransparentPaddingPolicyDiagnostic[] = [];
  const handledGroups = new Set<string>();

  for (const resource of images) {
    const role = resource.role ?? "unknown";
    const bounds = resource.alphaBounds;
    if (!bounds || bounds.status === "unknown" || bounds.status === "unsupported") {
      diagnostics.push(unavailableDiagnostic(resource, role));
      continue;
    }
    if (bounds.status === "fullyTransparent") {
      diagnostics.push(fullyTransparentDiagnostic(resource, role));
      continue;
    }
    if (bounds.status !== "known") continue;

    const paddingRatio = bounds.transparentPaddingRatio;
    if (
      paddingRatio === undefined
      || paddingRatio <= input.maximumTransparentPaddingRatio
    ) {
      continue;
    }

    if (role === "sequence_frame" || role === "baked_sweep_frame") {
      const group = groupsByResourceId.get(resource.id);
      if (group && !handledGroups.has(group.groupId)) {
        handledGroups.add(group.groupId);
        diagnostics.push(groupDiagnostic(group, input.resources, input.maximumTransparentPaddingRatio));
      } else if (!group) {
        diagnostics.push(ungroupedSequenceDiagnostic(resource, role, paddingRatio));
      }
      continue;
    }

    diagnostics.push(resourcePaddingDiagnostic(resource, role, paddingRatio));
  }

  return {
    maximumTransparentPaddingRatio: input.maximumTransparentPaddingRatio,
    evaluatedResourceCount: images.length,
    diagnostics
  };
}

function groupDiagnostic(
  group: SequenceResidencyGroup,
  resources: readonly MotionResourceInfo[],
  maximum: number
): TransparentPaddingPolicyDiagnostic {
  const members = group.resourceIds
    .map((id) => resources.find((resource) => resource.id === id))
    .filter((resource): resource is MotionResourceInfo => Boolean(resource));
  const ratios = members.flatMap((resource) => {
    const bounds = resource.alphaBounds;
    if (bounds?.status === "fullyTransparent") return [1];
    return bounds?.status === "known" && bounds.transparentPaddingRatio !== undefined
      ? [bounds.transparentPaddingRatio]
      : [];
  });
  const highCount = ratios.filter((ratio) => ratio > maximum).length;
  const majorityHigh = ratios.length > 0 && highCount > ratios.length / 2;
  const baked = group.role === "baked_sweep_frame";

  return {
    role: group.role,
    groupId: group.groupId,
    paddingRatio: ratios.length > 0
      ? ratios.reduce((total, ratio) => total + ratio, 0) / ratios.length
      : null,
    severity: baked ? "advisory" : majorityHigh ? "warning" : "advisory",
    policyCode: baked
      ? "baked_sweep_group_padding_review"
      : majorityHigh
        ? "sequence_group_padding_majority_high"
        : "sequence_group_padding_review",
    evidenceRefs: [
      `sequence-group:${group.groupId}`,
      ...members.map(({ id }) => `resource:${id}`)
    ],
    uncertainty: group.uncertainty,
    recommendedReview: baked
      ? "Evaluate whether baked sweep frames or parameterized motion are appropriate."
      : "Evaluate group-level crop with offset preservation."
  };
}

function resourcePaddingDiagnostic(
  resource: MotionResourceInfo,
  role: MotionResourceRole,
  paddingRatio: number
): TransparentPaddingPolicyDiagnostic {
  if (role === "static_image") {
    return diagnostic(
      resource, role, paddingRatio, "error",
      "static_image_padding_exceeds_threshold", "low",
      "Review static resource cropping with offset preservation."
    );
  }
  if (role === "mask_or_matte") {
    return diagnostic(
      resource, role, paddingRatio, "info",
      "mask_or_matte_padding_review", "medium",
      "Check whether mask dimensions intentionally match the target layer."
    );
  }
  return diagnostic(
    resource, role, paddingRatio, "unknown",
    "unknown_role_padding_needs_review", "high",
    "Confirm the resource role before applying a padding policy."
  );
}

function ungroupedSequenceDiagnostic(
  resource: MotionResourceInfo,
  role: "sequence_frame" | "baked_sweep_frame",
  paddingRatio: number
): TransparentPaddingPolicyDiagnostic {
  return diagnostic(
    resource,
    role,
    paddingRatio,
    "advisory",
    role === "baked_sweep_frame"
      ? "baked_sweep_padding_review"
      : "sequence_frame_padding_needs_group_review",
    "high",
    role === "baked_sweep_frame"
      ? "Evaluate whether baked sweep frames or parameterized motion are appropriate."
      : "Establish sequence grouping before evaluating group-level crop."
  );
}

function fullyTransparentDiagnostic(
  resource: MotionResourceInfo,
  role: MotionResourceRole
): TransparentPaddingPolicyDiagnostic {
  const severity: TransparentPaddingPolicySeverity = role === "static_image"
    ? "error"
    : role === "unknown" ? "unknown" : "warning";
  return diagnostic(
    resource,
    role,
    1,
    severity,
    "resource_fully_transparent",
    role === "unknown" ? "high" : "low",
    role === "mask_or_matte"
      ? "Check whether the fully transparent mask is intentional."
      : "Review whether the fully transparent resource is required."
  );
}

function unavailableDiagnostic(
  resource: MotionResourceInfo,
  role: MotionResourceRole
): TransparentPaddingPolicyDiagnostic {
  return diagnostic(
    resource,
    role,
    null,
    "unknown",
    "transparent_padding_unavailable",
    "high",
    role === "unknown"
      ? "Confirm the resource role and alpha-bound metadata before review."
      : "Provide alpha-bound metadata before applying the role policy."
  );
}

function diagnostic(
  resource: MotionResourceInfo,
  role: MotionResourceRole,
  paddingRatio: number | null,
  severity: TransparentPaddingPolicySeverity,
  policyCode: string,
  uncertainty: SequenceResidencyUncertainty,
  recommendedReview: string
): TransparentPaddingPolicyDiagnostic {
  return {
    role,
    resourceKey: resource.id,
    paddingRatio,
    severity,
    policyCode,
    evidenceRefs: [`resource:${resource.id}`, `alpha-bounds:${resource.id}`],
    uncertainty,
    recommendedReview
  };
}

function indexGroups(
  groups: readonly SequenceResidencyGroup[]
): Map<string, SequenceResidencyGroup> {
  const result = new Map<string, SequenceResidencyGroup>();
  for (const group of groups) {
    for (const resourceId of group.resourceIds) result.set(resourceId, group);
  }
  return result;
}
