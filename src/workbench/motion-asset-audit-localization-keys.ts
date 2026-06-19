import type {
  MotionAssetAuditStatus,
  MotionAssetAuditUncertainty
} from "./motion-asset-audit-summary.js";

export type MotionAssetAuditPresentationSeverity =
  | "success"
  | "info"
  | "warning"
  | "error"
  | "unknown";

export type MotionAssetAuditCardCategory =
  | "specification"
  | "memory"
  | "transparency"
  | "sequence"
  | "general";

export type MotionAssetAuditActionType = "review_only";

export const motionAssetAuditLocalizationKeys = {
  status: {
    pass: "audit.status.pass",
    advisory: "audit.status.advisory",
    needs_review: "audit.status.needs_review",
    unknown: "audit.status.unknown"
  } satisfies Record<MotionAssetAuditStatus, string>,
  severity: {
    success: "audit.severity.success",
    info: "audit.severity.info",
    warning: "audit.severity.warning",
    error: "audit.severity.error",
    unknown: "audit.severity.unknown"
  } satisfies Record<MotionAssetAuditPresentationSeverity, string>,
  category: {
    specification: "audit.category.specification",
    memory: "audit.category.memory",
    transparency: "audit.category.transparency",
    sequence: "audit.category.sequence",
    general: "audit.category.general"
  } satisfies Record<MotionAssetAuditCardCategory, string>,
  actionType: {
    review_only: "audit.action.review_only"
  } satisfies Record<MotionAssetAuditActionType, string>,
  uncertainty: {
    low: "audit.uncertainty.low",
    medium: "audit.uncertainty.medium",
    high: "audit.uncertainty.high",
    insufficient_evidence: "audit.uncertainty.insufficient_evidence"
  } satisfies Record<MotionAssetAuditUncertainty, string>
} as const;

export const motionAssetAuditLocalizationKeyFor = {
  summaryTitle: (status: MotionAssetAuditStatus) => `audit.summary.${status}.title`,
  summaryDescription: (status: MotionAssetAuditStatus) => `audit.summary.${status}.description`,
  findingTitle: (code: string) => `audit.finding.${code}.title`,
  findingDescription: (code: string) => `audit.finding.${code}.description`,
  opportunityTitle: (code: string) => `audit.opportunity.${code}.title`,
  opportunityDescription: (code: string) => `audit.opportunity.${code}.description`
} as const;

const findingFallbacks: Readonly<Record<string, readonly [string, string]>> = {
  unsupported_motion_format: ["Unsupported format", "The active specification does not support this format."],
  file_size_exceeds_limit: ["File size limit", "File size exceeds the active specification."],
  dimensions_exceed_limit: ["Canvas dimensions", "Canvas dimensions exceed the active specification."],
  dimensions_unavailable: ["Canvas dimensions unavailable", "Canvas dimensions could not be inspected."],
  duration_exceeds_limit: ["Duration limit", "Duration exceeds the active specification."],
  duration_unavailable: ["Duration unavailable", "Duration could not be inspected."],
  fps_exceeds_limit: ["FPS limit", "FPS exceeds the active specification."],
  fps_unavailable: ["FPS unavailable", "FPS could not be inspected."],
  resource_count_exceeds_limit: ["Resource count limit", "Resource count exceeds the active specification."],
  resource_dimensions_exceed_limit: ["Resource dimensions", "An embedded resource exceeds the dimension limit."],
  resource_dimensions_unavailable: ["Resource dimensions unavailable", "One or more resource dimensions could not be inspected."],
  resource_fully_transparent: ["Fully transparent resource", "An embedded resource is fully transparent."],
  resource_transparent_padding_exceeds_limit: ["Transparent padding", "An embedded resource exceeds the transparent-padding limit."],
  resource_alpha_bounds_unavailable: ["Alpha bounds unavailable", "Alpha bounds could not be inspected for one or more resources."],
  decoded_memory_risk: ["Decoded memory risk", "Estimated decoded resource memory has advisory risk."],
  decoded_memory_unknown: ["Decoded memory unknown", "Decoded resource memory cannot be fully estimated."],
  sequence_memory_concentration: ["Sequence memory concentration", "Sequence resources contribute notable estimated decoded memory."],
  sequence_memory_unknown: ["Sequence memory unknown", "Sequence resource memory cannot be fully estimated."],
  duplicate_encoded_frames: ["Duplicate encoded frames", "Byte-identical encoded sequence frames were found."],
  fully_transparent_sequence_frames: ["Fully transparent frames", "Fully transparent sequence frames were found."],
  near_empty_sequence_frames: ["Near-empty frames", "Provisionally near-empty sequence frames were found."]
};

const opportunityFallbacks: Readonly<Record<string, readonly [string, string]>> = {
  review_large_resources: ["Review large resources", "Review the largest decoded resources."],
  crop_static_transparent_padding: ["Review static cropping", "Review static transparent padding with offset preservation."],
  evaluate_group_level_sequence_crop: ["Review sequence cropping", "Evaluate group-level sequence cropping with offset preservation."],
  review_duplicate_encoded_frames: ["Review duplicate frames", "Review byte-identical encoded sequence frames."],
  review_fully_transparent_frames: ["Review transparent frames", "Review fully transparent sequence frames."],
  evaluate_sprite_sheet_packing: ["Review sprite-sheet packing", "Evaluate sprite-sheet packing for deterministic sequence groups."],
  review_fps: ["Review FPS", "Review FPS because the active specification reports a limit violation."],
  review_duration: ["Review duration", "Review duration because the active specification reports a limit violation."]
};

export const motionAssetAuditEnglishFallbacks: Readonly<Record<string, string>> =
  Object.freeze({
    ...fixedFallbacks(),
    ...cardFallbacks("finding", findingFallbacks),
    ...cardFallbacks("opportunity", opportunityFallbacks)
  });

export function resolveMotionAssetAuditFallback(
  key: string,
  fallback: string
): string {
  return motionAssetAuditEnglishFallbacks[key] ?? fallback;
}

function fixedFallbacks(): Record<string, string> {
  const keys = motionAssetAuditLocalizationKeys;
  return {
    [keys.status.pass]: "Pass",
    [keys.status.advisory]: "Advisory",
    [keys.status.needs_review]: "Needs review",
    [keys.status.unknown]: "Unknown",
    [keys.severity.success]: "Success",
    [keys.severity.info]: "Information",
    [keys.severity.warning]: "Warning",
    [keys.severity.error]: "Error",
    [keys.severity.unknown]: "Unknown",
    [keys.category.specification]: "Specification",
    [keys.category.memory]: "Memory",
    [keys.category.transparency]: "Transparency",
    [keys.category.sequence]: "Sequence",
    [keys.category.general]: "General",
    [keys.actionType.review_only]: "Review only",
    [keys.uncertainty.low]: "Low uncertainty",
    [keys.uncertainty.medium]: "Some evidence remains uncertain.",
    [keys.uncertainty.high]: "Important evidence remains uncertain.",
    [keys.uncertainty.insufficient_evidence]: "Evidence is insufficient for a conclusion.",
    ...summaryFallbacks()
  };
}

function summaryFallbacks(): Record<string, string> {
  const values: Record<MotionAssetAuditStatus, readonly [string, string]> = {
    pass: ["No primary audit risks", "Current deterministic checks found no primary optimization signal."],
    advisory: ["Review advisory findings", "The audit found non-blocking signals worth reviewing."],
    needs_review: ["Asset needs review", "The audit found one or more significant risk signals."],
    unknown: ["Audit evidence incomplete", "Available evidence is insufficient for a reliable summary."]
  };
  return Object.fromEntries(Object.entries(values).flatMap(([status, [title, description]]) => [
    [motionAssetAuditLocalizationKeyFor.summaryTitle(status as MotionAssetAuditStatus), title],
    [motionAssetAuditLocalizationKeyFor.summaryDescription(status as MotionAssetAuditStatus), description]
  ]));
}

function cardFallbacks(
  kind: "finding" | "opportunity",
  values: Readonly<Record<string, readonly [string, string]>>
): Record<string, string> {
  const keyFor = kind === "finding"
    ? [motionAssetAuditLocalizationKeyFor.findingTitle, motionAssetAuditLocalizationKeyFor.findingDescription]
    : [motionAssetAuditLocalizationKeyFor.opportunityTitle, motionAssetAuditLocalizationKeyFor.opportunityDescription];
  return Object.fromEntries(Object.entries(values).flatMap(([code, [title, description]]) => [
    [keyFor[0](code), title],
    [keyFor[1](code), description]
  ]));
}
