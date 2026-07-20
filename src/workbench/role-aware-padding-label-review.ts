import type { MotionResourceRole } from "./contracts.js";

export const UNKNOWN_LABEL_RATIO_THRESHOLD = 0.25;
export const LOW_CONFIDENCE_LABEL_RATIO_THRESHOLD = 0.25;

export type LabelConfidence = "high" | "medium" | "low" | "unknown";
export type LabeledSampleSourceType =
  | "production_target"
  | "legacy"
  | "experimental"
  | "unknown";
export type PaddingDefectType =
  | "excessive_static_padding"
  | "excessive_sequence_padding"
  | "unnecessary_canvas_aligned_frames"
  | "required_canvas_alignment"
  | "fully_transparent_unused_frame"
  | "near_empty_frame"
  | "mask_size_mismatch"
  | "baked_sweep_expected_padding"
  | "classifier_wrong_role"
  | "no_issue"
  | "unknown";
export type PaddingDefectSeverity = "critical" | "major" | "minor" | "info" | "unknown";
export type PaddingIntent =
  | "accidental_waste"
  | "required_alignment"
  | "required_mask_match"
  | "required_sequence_consistency"
  | "baked_effect_artifact"
  | "unknown";
export type PaddingGroupType = "sequence_frame" | "baked_sweep_frame" | "mask_or_matte" | "unknown";
export type IntendedAlignment = "canvas" | "local_bounds" | "target_layer" | "unknown";

export interface RoleAwarePaddingResourceLabel {
  resourceKey: string;
  detectedRole: MotionResourceRole;
  humanRoleLabel: MotionResourceRole;
  roleLabelConfidence: LabelConfidence;
  isDefect: boolean | null;
  defectType: PaddingDefectType;
  defectSeverity: PaddingDefectSeverity;
  paddingIntent: PaddingIntent;
  notes: string;
}

export interface RoleAwarePaddingGroupLabel {
  groupId: string;
  groupType: PaddingGroupType;
  frameCount: number;
  intendedAlignment: IntendedAlignment;
  canCropWithOffset: boolean | null;
  shouldRemainCanvasAligned: boolean | null;
  groupDefectType: PaddingDefectType;
  groupSeverity: PaddingDefectSeverity;
  notes: string;
}

export interface RoleAwarePaddingLabeledSampleV1 {
  schemaVersion: 1;
  sampleId: string;
  fileName?: string;
  externalReference?: string;
  assetType: "avatar_frame";
  canvasSize: { width: number; height: number };
  fps: number;
  durationMs: number;
  sourceType: LabeledSampleSourceType;
  reviewer: string;
  reviewDate: string;
  labelConfidence: LabelConfidence;
  resources: readonly RoleAwarePaddingResourceLabel[];
  groups: readonly RoleAwarePaddingGroupLabel[];
}

export interface LabelCoverageGap {
  code: string;
  message: string;
  details?: Readonly<Record<string, number | string>>;
}

export interface ReviewerAgreementSummary {
  itemCount: number;
  exactMatchCount: number;
  disagreementCount: number;
  insufficientReviewerCount: number;
  fieldsWithDisagreement: Readonly<Record<string, number>>;
}

export interface RoleAwarePaddingLabelReviewReport {
  summary: {
    sampleCount: number;
    reviewDocumentCount: number;
    resourceLabelCount: number;
    uniqueResourceCount: number;
    groupLabelCount: number;
    uniqueGroupCount: number;
    reviewerCount: number;
    labelConfidenceDistribution: Readonly<Record<string, number>>;
    roleLabelConfidenceDistribution: Readonly<Record<string, number>>;
    defectTypeDistribution: Readonly<Record<string, number>>;
    paddingIntentDistribution: Readonly<Record<string, number>>;
    sourceTypeDistribution: Readonly<Record<string, number>>;
  };
  coverageGaps: readonly LabelCoverageGap[];
  reviewerAgreement: {
    samples: ReviewerAgreementSummary;
    resources: ReviewerAgreementSummary;
    groups: ReviewerAgreementSummary;
  };
  policyComparison: {
    status: "not_provided";
    comparedItemCount: 0;
    agreementCount: 0;
    disagreementCount: 0;
    notes: readonly string[];
  };
}

export function createRoleAwarePaddingLabelReviewReport(
  samples: readonly RoleAwarePaddingLabeledSampleV1[]
): RoleAwarePaddingLabelReviewReport {
  const resourceEntries = samples.flatMap((sample) =>
    sample.resources.map((label) => ({ sampleId: sample.sampleId, reviewer: sample.reviewer, label }))
  );
  const groupEntries = samples.flatMap((sample) =>
    sample.groups.map((label) => ({ sampleId: sample.sampleId, reviewer: sample.reviewer, label }))
  );

  return {
    summary: {
      sampleCount: new Set(samples.map(({ sampleId }) => sampleId)).size,
      reviewDocumentCount: samples.length,
      resourceLabelCount: resourceEntries.length,
      uniqueResourceCount: new Set(resourceEntries.map(({ sampleId, label }) => `${sampleId}:${label.resourceKey}`)).size,
      groupLabelCount: groupEntries.length,
      uniqueGroupCount: new Set(groupEntries.map(({ sampleId, label }) => `${sampleId}:${label.groupId}`)).size,
      reviewerCount: new Set(samples.map(({ reviewer }) => reviewer)).size,
      labelConfidenceDistribution: countValues(samples.map(({ labelConfidence }) => labelConfidence)),
      roleLabelConfidenceDistribution: countValues(resourceEntries.map(({ label }) => label.roleLabelConfidence)),
      defectTypeDistribution: countValues([
        ...resourceEntries.map(({ label }) => label.defectType),
        ...groupEntries.map(({ label }) => label.groupDefectType)
      ]),
      paddingIntentDistribution: countValues(resourceEntries.map(({ label }) => label.paddingIntent)),
      sourceTypeDistribution: countValues(samples.map(({ sourceType }) => sourceType))
    },
    coverageGaps: findCoverageGaps(samples, resourceEntries, groupEntries),
    reviewerAgreement: {
      samples: summarizeAgreement(
        samples.map((sample) => ({ key: sample.sampleId, reviewer: sample.reviewer, value: sample })),
        ["sourceType"]
      ),
      resources: summarizeAgreement(
        resourceEntries.map(({ sampleId, reviewer, label }) => ({
          key: `${sampleId}:${label.resourceKey}`,
          reviewer,
          value: label
        })),
        ["humanRoleLabel", "roleLabelConfidence", "isDefect", "defectType", "defectSeverity", "paddingIntent"]
      ),
      groups: summarizeAgreement(
        groupEntries.map(({ sampleId, reviewer, label }) => ({
          key: `${sampleId}:${label.groupId}`,
          reviewer,
          value: label
        })),
        [
          "groupType",
          "intendedAlignment",
          "canCropWithOffset",
          "shouldRemainCanvasAligned",
          "groupDefectType",
          "groupSeverity"
        ]
      )
    },
    policyComparison: {
      status: "not_provided",
      comparedItemCount: 0,
      agreementCount: 0,
      disagreementCount: 0,
      notes: ["Policy output was not supplied; no policy-vs-human conclusion was inferred."]
    }
  };
}

function findCoverageGaps(
  samples: readonly RoleAwarePaddingLabeledSampleV1[],
  resources: readonly { label: RoleAwarePaddingResourceLabel }[],
  groups: readonly { label: RoleAwarePaddingGroupLabel }[]
): LabelCoverageGap[] {
  const gaps: LabelCoverageGap[] = [];
  const roles = [
    ...resources.map(({ label }) => label.humanRoleLabel),
    ...groups.map(({ label }) => label.groupType)
  ];
  const defects = [
    ...resources.map(({ label }) => label.defectType),
    ...groups.map(({ label }) => label.groupDefectType)
  ];

  addMissingGap(gaps, roles.includes("baked_sweep_frame"), "missing_baked_sweep_frame", "No baked sweep labels are present.");
  addMissingGap(gaps, roles.includes("mask_or_matte"), "missing_mask_or_matte", "No mask or matte labels are present.");
  addMissingGap(
    gaps,
    defects.includes("fully_transparent_unused_frame"),
    "missing_fully_transparent_unused_frame",
    "No fully transparent unused frame labels are present."
  );
  addMissingGap(
    gaps,
    defects.includes("classifier_wrong_role"),
    "missing_classifier_wrong_role",
    "No classifier wrong-role labels are present."
  );

  const unknownCount = roles.filter((role) => role === "unknown").length;
  const unknownRatio = roles.length === 0 ? 0 : unknownCount / roles.length;
  if (unknownRatio > UNKNOWN_LABEL_RATIO_THRESHOLD) {
    gaps.push({
      code: "too_many_unknown_labels",
      message: "Unknown role labels exceed the provisional coverage threshold.",
      details: { count: unknownCount, ratio: unknownRatio, threshold: UNKNOWN_LABEL_RATIO_THRESHOLD }
    });
  }

  const confidenceValues = [
    ...samples.map(({ labelConfidence }) => labelConfidence),
    ...resources.map(({ label }) => label.roleLabelConfidence)
  ];
  const lowConfidenceCount = confidenceValues.filter((value) => value === "low" || value === "unknown").length;
  const lowConfidenceRatio = confidenceValues.length === 0 ? 0 : lowConfidenceCount / confidenceValues.length;
  if (lowConfidenceRatio > LOW_CONFIDENCE_LABEL_RATIO_THRESHOLD) {
    gaps.push({
      code: "too_many_low_confidence_labels",
      message: "Low or unknown confidence labels exceed the provisional coverage threshold.",
      details: { count: lowConfidenceCount, ratio: lowConfidenceRatio, threshold: LOW_CONFIDENCE_LABEL_RATIO_THRESHOLD }
    });
  }

  return gaps;
}

function addMissingGap(
  gaps: LabelCoverageGap[],
  present: boolean,
  code: string,
  message: string
): void {
  if (!present) gaps.push({ code, message });
}

function countValues(values: readonly string[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function summarizeAgreement<T extends object>(
  entries: readonly { key: string; reviewer: string; value: T }[],
  fields: readonly (keyof T)[]
): ReviewerAgreementSummary {
  const byItem = new Map<string, Map<string, T>>();
  for (const entry of entries) {
    const byReviewer = byItem.get(entry.key) ?? new Map<string, T>();
    byReviewer.set(entry.reviewer, entry.value);
    byItem.set(entry.key, byReviewer);
  }

  let exactMatchCount = 0;
  let disagreementCount = 0;
  let insufficientReviewerCount = 0;
  const fieldsWithDisagreement: Record<string, number> = {};

  for (const reviews of byItem.values()) {
    if (reviews.size < 2) {
      insufficientReviewerCount += 1;
      continue;
    }
    const values = [...reviews.values()];
    const differingFields = fields.filter((field) =>
      new Set(values.map((value) => JSON.stringify(value[field]))).size > 1
    );
    if (differingFields.length === 0) {
      exactMatchCount += 1;
      continue;
    }
    disagreementCount += 1;
    for (const field of differingFields) {
      const name = String(field);
      fieldsWithDisagreement[name] = (fieldsWithDisagreement[name] ?? 0) + 1;
    }
  }

  return {
    itemCount: byItem.size,
    exactMatchCount,
    disagreementCount,
    insufficientReviewerCount,
    fieldsWithDisagreement
  };
}
