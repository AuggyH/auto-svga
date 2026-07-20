import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createRoleAwarePaddingLabelReviewReport,
  type RoleAwarePaddingLabeledSampleV1
} from "../workbench/role-aware-padding-label-review.js";

test("summarizes label coverage and distributions", () => {
  const report = createRoleAwarePaddingLabelReviewReport([
    sample("sample-a", "reviewer-a"),
    sample("sample-a", "reviewer-b"),
    sample("sample-b", "reviewer-a", { sourceType: "legacy" })
  ]);

  assert.equal(report.summary.sampleCount, 2);
  assert.equal(report.summary.reviewDocumentCount, 3);
  assert.equal(report.summary.resourceLabelCount, 6);
  assert.equal(report.summary.uniqueResourceCount, 4);
  assert.equal(report.summary.groupLabelCount, 3);
  assert.equal(report.summary.reviewerCount, 2);
  assert.deepEqual(report.summary.sourceTypeDistribution, { production_target: 2, legacy: 1 });
  assert.equal(report.summary.defectTypeDistribution.no_issue, 9);
  assert.equal(report.policyComparison.status, "not_provided");
});

test("reports exact matches, disagreements, and insufficient reviewer coverage", () => {
  const first = sample("sample-a", "reviewer-a");
  const second = sample("sample-a", "reviewer-b", {
    resources: [
      first.resources[0],
      { ...first.resources[1], isDefect: true, defectType: "excessive_sequence_padding" }
    ],
    groups: [{ ...first.groups[0], intendedAlignment: "canvas" }]
  });
  const single = sample("sample-b", "reviewer-a");
  const report = createRoleAwarePaddingLabelReviewReport([first, second, single]);

  assert.deepEqual(report.reviewerAgreement.samples, {
    itemCount: 2,
    exactMatchCount: 1,
    disagreementCount: 0,
    insufficientReviewerCount: 1,
    fieldsWithDisagreement: {}
  });
  assert.equal(report.reviewerAgreement.resources.exactMatchCount, 1);
  assert.equal(report.reviewerAgreement.resources.disagreementCount, 1);
  assert.equal(report.reviewerAgreement.resources.insufficientReviewerCount, 2);
  assert.equal(report.reviewerAgreement.resources.fieldsWithDisagreement.isDefect, 1);
  assert.equal(report.reviewerAgreement.resources.fieldsWithDisagreement.defectType, 1);
  assert.equal(report.reviewerAgreement.groups.disagreementCount, 1);
  assert.equal(report.reviewerAgreement.groups.fieldsWithDisagreement.intendedAlignment, 1);
});

test("detects missing coverage and excessive unknown or low-confidence labels", () => {
  const weak = sample("sample-a", "reviewer-a", {
    labelConfidence: "low",
    resources: [unknownResource("unknown-a"), unknownResource("unknown-b")],
    groups: [{ ...baseGroup(), groupType: "unknown" }]
  });
  const codes = createRoleAwarePaddingLabelReviewReport([weak]).coverageGaps.map(({ code }) => code);

  assert.deepEqual(codes, [
    "missing_baked_sweep_frame",
    "missing_mask_or_matte",
    "missing_fully_transparent_unused_frame",
    "missing_classifier_wrong_role",
    "too_many_unknown_labels",
    "too_many_low_confidence_labels"
  ]);
});

test("recognizes representative role and defect coverage without inferring policy agreement", () => {
  const complete = sample("sample-a", "reviewer-a", {
    resources: [
      baseResource("static", "static_image"),
      { ...baseResource("mask", "mask_or_matte"), defectType: "classifier_wrong_role" },
      {
        ...baseResource("empty", "sequence_frame"),
        isDefect: true,
        defectType: "fully_transparent_unused_frame"
      }
    ],
    groups: [{ ...baseGroup(), groupType: "baked_sweep_frame" }]
  });
  const report = createRoleAwarePaddingLabelReviewReport([complete]);

  assert.equal(report.coverageGaps.some(({ code }) => code.startsWith("missing_")), false);
  assert.deepEqual(report.policyComparison, {
    status: "not_provided",
    comparedItemCount: 0,
    agreementCount: 0,
    disagreementCount: 0,
    notes: ["Policy output was not supplied; no policy-vs-human conclusion was inferred."]
  });
});

test("keeps label review computation host-neutral", async () => {
  const source = await readFile(
    new URL("../../src/workbench/role-aware-padding-label-review.ts", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(
    source,
    /from\s+["']node:|document\.|window\.|HTMLCanvasElement|CanvasRenderingContext|readFile|writeFile/
  );
});

function sample(
  sampleId: string,
  reviewer: string,
  overrides: Partial<RoleAwarePaddingLabeledSampleV1> = {}
): RoleAwarePaddingLabeledSampleV1 {
  return {
    schemaVersion: 1,
    sampleId,
    assetType: "avatar_frame",
    canvasSize: { width: 300, height: 300 },
    fps: 24,
    durationMs: 3000,
    sourceType: "production_target",
    reviewer,
    reviewDate: "2026-06-19",
    labelConfidence: "high",
    resources: [
      baseResource("static", "static_image"),
      baseResource("sequence", "sequence_frame")
    ],
    groups: [baseGroup()],
    ...overrides
  };
}

function baseResource(resourceKey: string, role: "static_image" | "sequence_frame" | "mask_or_matte") {
  return {
    resourceKey,
    detectedRole: role,
    humanRoleLabel: role,
    roleLabelConfidence: "high" as const,
    isDefect: false,
    defectType: "no_issue" as const,
    defectSeverity: "info" as const,
    paddingIntent: "required_alignment" as const,
    notes: "Synthetic label."
  };
}

function unknownResource(resourceKey: string) {
  return {
    ...baseResource(resourceKey, "static_image"),
    humanRoleLabel: "unknown" as const,
    roleLabelConfidence: "unknown" as const,
    isDefect: null,
    defectType: "unknown" as const,
    defectSeverity: "unknown" as const,
    paddingIntent: "unknown" as const
  };
}

function baseGroup() {
  return {
    groupId: "sequence:001-003",
    groupType: "sequence_frame" as const,
    frameCount: 3,
    intendedAlignment: "local_bounds" as const,
    canCropWithOffset: true,
    shouldRemainCanvasAligned: false,
    groupDefectType: "no_issue" as const,
    groupSeverity: "info" as const,
    notes: "Synthetic group label."
  };
}
