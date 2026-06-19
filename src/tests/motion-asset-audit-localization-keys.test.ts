import assert from "node:assert/strict";
import test from "node:test";
import {
  motionAssetAuditEnglishFallbacks,
  motionAssetAuditLocalizationKeyFor,
  motionAssetAuditLocalizationKeys,
  resolveMotionAssetAuditFallback
} from "../workbench/motion-asset-audit-localization-keys.js";

const findingCodes = [
  "unsupported_motion_format",
  "file_size_exceeds_limit",
  "dimensions_exceed_limit",
  "dimensions_unavailable",
  "duration_exceeds_limit",
  "duration_unavailable",
  "fps_exceeds_limit",
  "fps_unavailable",
  "resource_count_exceeds_limit",
  "resource_dimensions_exceed_limit",
  "resource_dimensions_unavailable",
  "resource_fully_transparent",
  "resource_transparent_padding_exceeds_limit",
  "resource_alpha_bounds_unavailable",
  "decoded_memory_risk",
  "decoded_memory_unknown",
  "sequence_memory_concentration",
  "sequence_memory_unknown",
  "duplicate_encoded_frames",
  "fully_transparent_sequence_frames",
  "near_empty_sequence_frames"
] as const;

const opportunityCodes = [
  "review_large_resources",
  "crop_static_transparent_padding",
  "evaluate_group_level_sequence_crop",
  "review_duplicate_encoded_frames",
  "review_fully_transparent_frames",
  "evaluate_sprite_sheet_packing",
  "review_fps",
  "review_duration"
] as const;

test("fixed localization keys are unique and have English fallbacks", () => {
  const keys = fixedKeys();

  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.every((key) => motionAssetAuditEnglishFallbacks[key]?.length > 0));
});

test("current finding and opportunity keys have title and description fallbacks", () => {
  const keys = [
    ...findingCodes.flatMap((code) => [
      motionAssetAuditLocalizationKeyFor.findingTitle(code),
      motionAssetAuditLocalizationKeyFor.findingDescription(code)
    ]),
    ...opportunityCodes.flatMap((code) => [
      motionAssetAuditLocalizationKeyFor.opportunityTitle(code),
      motionAssetAuditLocalizationKeyFor.opportunityDescription(code)
    ])
  ];

  assert.ok(keys.every((key) => motionAssetAuditEnglishFallbacks[key]?.length > 0));
});

test("dynamic builders keep unknown future codes stable and use caller fallback", () => {
  const key = motionAssetAuditLocalizationKeyFor.findingDescription("future_issue");

  assert.equal(key, "audit.finding.future_issue.description");
  assert.equal(resolveMotionAssetAuditFallback(key, "Original report message"), "Original report message");
});

function fixedKeys(): string[] {
  const keys = motionAssetAuditLocalizationKeys;
  return [
    ...Object.values(keys.status),
    ...Object.values(keys.severity),
    ...Object.values(keys.category),
    ...Object.values(keys.actionType),
    ...Object.values(keys.uncertainty),
    ...(["pass", "advisory", "needs_review", "unknown"] as const).flatMap((status) => [
      motionAssetAuditLocalizationKeyFor.summaryTitle(status),
      motionAssetAuditLocalizationKeyFor.summaryDescription(status)
    ])
  ];
}
