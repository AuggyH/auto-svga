import assert from "node:assert/strict";
import test from "node:test";
import type {
  MotionAssetInfo,
  MotionResourceInfo,
  WorkbenchIssue
} from "../workbench/contracts.js";
import { estimateDecodedMemory } from "../workbench/memory-estimation.js";
import { createMotionAssetAuditSummary } from "../workbench/motion-asset-audit-summary.js";
import { diagnoseSequenceResidency } from "../workbench/sequence-residency-diagnostics.js";
import { collectSequenceFrameEvidence } from "../workbench/sequence-frame-evidence.js";

test("returns a low-uncertainty pass for a clean static asset", () => {
  const result = audit([resource("frame", "static_image")]);

  assert.equal(result.auditStatus, "pass");
  assert.equal(result.uncertainty, "low");
  assert.deepEqual(result.primaryFindings, []);
  assert.deepEqual(result.optimizationOpportunities, []);
});

test("composes deterministic findings and opportunities from existing evidence", () => {
  const resources = [
    resource("frame", "static_image", { width: 1024, height: 1024 }),
    resource("sweep_001", "sequence_frame", {
      width: 1024,
      height: 1024,
      hash: "duplicate",
      alphaStatus: "fullyTransparent"
    }),
    resource("sweep_002", "sequence_frame", {
      width: 1024,
      height: 1024,
      hash: "duplicate",
      paddingRatio: 0.999
    }),
    resource("sweep_003", "sequence_frame", {
      width: 1024,
      height: 1024,
      hash: "unique"
    }),
    resource("sweep_004", "sequence_frame", {
      width: 1024,
      height: 1024,
      hash: "four"
    })
  ];
  const issues: WorkbenchIssue[] = [
    issue("file_size_exceeds_limit", "error"),
    issue("resource_count_exceeds_limit", "error"),
    issue("resource_transparent_padding_exceeds_limit", "warning", "frame"),
    issue("resource_transparent_padding_exceeds_limit", "warning", "sweep_002"),
    issue("fps_exceeds_limit", "error"),
    issue("duration_exceeds_limit", "error")
  ];

  const result = audit(resources, issues);
  const findingCodes = result.primaryFindings.map(({ code }) => code);
  const opportunityCodes = result.optimizationOpportunities.map(({ code }) => code);

  assert.equal(result.auditStatus, "needs_review");
  assert.ok(findingCodes.includes("decoded_memory_risk"));
  assert.ok(findingCodes.includes("sequence_memory_concentration"));
  assert.ok(findingCodes.includes("duplicate_encoded_frames"));
  assert.ok(findingCodes.includes("fully_transparent_sequence_frames"));
  assert.ok(findingCodes.includes("near_empty_sequence_frames"));
  assert.ok(opportunityCodes.includes("review_large_resources"));
  assert.ok(opportunityCodes.includes("crop_static_transparent_padding"));
  assert.ok(opportunityCodes.includes("evaluate_group_level_sequence_crop"));
  assert.ok(opportunityCodes.includes("review_duplicate_encoded_frames"));
  assert.ok(opportunityCodes.includes("review_fully_transparent_frames"));
  assert.ok(opportunityCodes.includes("evaluate_sprite_sheet_packing"));
  assert.ok(opportunityCodes.includes("review_fps"));
  assert.ok(opportunityCodes.includes("review_duration"));
  assert.ok(result.primaryFindings.every(({ evidenceRefs }) => evidenceRefs.length > 0));
  assert.ok(result.optimizationOpportunities.every(({ evidenceRefs }) => evidenceRefs.length > 0));
});

test("reports unknown when sequence evidence is insufficient", () => {
  const result = audit([
    resource("first", "sequence_frame", { hash: undefined, alphaStatus: "unknown" }),
    resource("second", "sequence_frame", { hash: undefined, alphaStatus: "unknown" })
  ]);

  assert.equal(result.auditStatus, "unknown");
  assert.equal(result.uncertainty, "insufficient_evidence");
  assert.ok(!result.primaryFindings.some(
    ({ code }) => code === "duplicate_encoded_frames"
  ));
  assert.ok(!result.optimizationOpportunities.some(
    ({ code }) => code === "review_duplicate_encoded_frames"
  ));
});

test("does not suggest FPS or duration changes without existing spec issues", () => {
  const result = audit([resource("frame", "static_image")]);

  assert.ok(!result.optimizationOpportunities.some(
    ({ code }) => code === "review_fps" || code === "review_duration"
  ));
});

function audit(resources: MotionResourceInfo[], issues: WorkbenchIssue[] = []) {
  const asset: MotionAssetInfo = {
    format: "svga",
    name: "fixture.svga",
    sizeBytes: 128,
    dimensions: { width: 300, height: 300 },
    timing: { fps: 24, frameCount: 72, durationMs: 3000 },
    layers: [],
    resources
  };
  const memoryEstimation = estimateDecodedMemory(resources);
  return createMotionAssetAuditSummary({
    asset,
    issues,
    memoryEstimation,
    sequenceResidencyDiagnostics: diagnoseSequenceResidency(resources, memoryEstimation),
    sequenceFrameEvidence: collectSequenceFrameEvidence(resources)
  });
}

interface ResourceOptions {
  width?: number;
  height?: number;
  hash?: string;
  alphaStatus?: "known" | "fullyTransparent" | "unknown";
  paddingRatio?: number;
}

function resource(
  id: string,
  role: MotionResourceInfo["role"],
  options: ResourceOptions = {}
): MotionResourceInfo {
  const width = options.width ?? 20;
  const height = options.height ?? 20;
  const alphaStatus = options.alphaStatus ?? "known";
  return {
    id,
    name: id,
    kind: "image",
    role,
    dimensions: { width, height },
    alphaBounds: alphaStatus === "known"
      ? {
          status: "known",
          x: 0,
          y: 0,
          width,
          height,
          transparentPaddingRatio: options.paddingRatio ?? 0
        }
      : { status: alphaStatus },
    contentHash: options.hash
      ? { algorithm: "sha256", value: options.hash, scope: "encoded_bytes" }
      : undefined
  };
}

function issue(
  code: string,
  severity: WorkbenchIssue["severity"],
  resourceId?: string
): WorkbenchIssue {
  return {
    code,
    severity,
    message: code,
    details: resourceId ? { resourceId } : undefined
  };
}
