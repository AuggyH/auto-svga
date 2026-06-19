import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type {
  MotionAssetInfo,
  RoleAwareMemoryDiagnostics,
  SequenceFrameEvidence,
  SequenceResidencyDiagnostics
} from "../workbench/contracts.js";
import {
  createFormatRecommendationReport,
  FORMAT_RECOMMENDATION_CAPABILITY_MATRIX,
  FORMAT_RECOMMENDATION_CAPABILITY_MATRIX_DOCUMENT,
  FORMAT_RECOMMENDATION_CAPABILITY_MATRIX_VERSION,
  type FormatRecommendationInput
} from "../workbench/format-recommendation.js";
import type { MotionAssetAuditSummary } from "../workbench/motion-asset-audit-summary.js";

test("capability matrix covers every MVP recommendation format", () => {
  assert.deepEqual(Object.keys(FORMAT_RECOMMENDATION_CAPABILITY_MATRIX), [
    "svga", "vap", "lottie", "webp", "webm", "apng", "sprite", "unknown"
  ]);
});

test("capability matrix is versioned and every format has evidence and maturity", () => {
  assert.equal(FORMAT_RECOMMENDATION_CAPABILITY_MATRIX_VERSION, 1);
  assert.equal(FORMAT_RECOMMENDATION_CAPABILITY_MATRIX_DOCUMENT.capabilityMatrixVersion, 1);
  for (const capability of Object.values(FORMAT_RECOMMENDATION_CAPABILITY_MATRIX)) {
    assert.ok(capability.evidence.length > 0, capability.format);
    assert.ok(capability.evidence.every(({ evidenceSource, evidenceType, confidence, lastReviewedAt }) =>
      evidenceSource.length > 0
      && evidenceType.length > 0
      && confidence.length > 0
      && /^\d{4}-\d{2}-\d{2}$/.test(lastReviewedAt)
    ));
    assert.ok(capability.implementationMaturity.length > 0, capability.format);
  }
});

test("unknown input returns a conservative report without candidates", () => {
  const report = createFormatRecommendationReport(input({
    currentFormat: "unknown",
    targetUsageContext: "unknown"
  }));

  assert.equal(report.recommendationStatus, "unknown");
  assert.deepEqual(report.candidateFormats, []);
  assert.equal(report.uncertainty, "high");
});

test("replaceable image and text requirements constrain flattened candidates", () => {
  const report = createFormatRecommendationReport(input({
    requirements: { requiresAlpha: true, requiresReplaceableImage: true, requiresReplaceableText: true }
  }));
  const byFormat = new Map(report.candidateFormats.map((candidate) => [candidate.format, candidate]));

  assert.equal(byFormat.get("svga")?.status, "capability_match");
  assert.equal(byFormat.get("svga")?.implementationStatus, "supported");
  assert.equal(byFormat.get("lottie")?.status, "needs_more_data");
  assert.equal(byFormat.get("lottie")?.implementationStatus, "not_available");
  assert.equal(byFormat.get("webp")?.status, "constraint_mismatch");
  assert.equal(byFormat.get("webm")?.status, "constraint_mismatch");
  assert.equal(byFormat.get("vap")?.status, "needs_more_data");
});

test("known capability without implementation is not production-supported", () => {
  const report = createFormatRecommendationReport(input());
  const lottie = report.candidateFormats.find(({ format }) => format === "lottie");

  assert.equal(lottie?.implementationStatus, "not_available");
  assert.ok(lottie?.implementationMaturity.includes("parser_not_implemented"));
  assert.ok(lottie?.implementationMaturity.includes("production_not_supported"));
  assert.match(lottie?.rationale.join(" ") ?? "", /implementation is not available/);
  assert.match(lottie?.rationale.join(" ") ?? "", /not a production recommendation/);
  assert.equal(lottie?.uncertainty, "high");
});

test("SVGA remains the current bounded implementation baseline", () => {
  const report = createFormatRecommendationReport(input());
  const svga = report.candidateFormats.find(({ format }) => format === "svga");

  assert.equal(svga?.implementationStatus, "supported");
  assert.ok(svga?.implementationMaturity.includes("supported"));
  assert.equal(FORMAT_RECOMMENDATION_CAPABILITY_MATRIX.svga.evidence[0].evidenceType, "implementation_verified");
});

test("sequence evidence adds advisory rationale without selecting a winner", () => {
  const report = createFormatRecommendationReport(input({
    sequenceResidencyDiagnostics: sequenceDiagnostics(4)
  }));

  assert.equal(report.recommendationStatus, "advisory");
  assert.match(report.rationale.join(" "), /Sequence resources/);
  assert.ok(report.candidateFormats.some(({ rationale }) =>
    rationale.some((message) => message.includes("Frame-sequence capability"))
  ));
  assert.ok(!("recommendedFormat" in report));
});

test("insufficient audit evidence does not produce a recommendation", () => {
  const report = createFormatRecommendationReport(input({
    auditSummary: auditSummary("insufficient_evidence")
  }));

  assert.equal(report.recommendationStatus, "needs_more_data");
  assert.deepEqual(report.candidateFormats, []);
});

test("keeps recommendation contracts host-neutral and offline", async () => {
  const source = await readFile(
    new URL("../../src/workbench/format-recommendation.ts", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(
    source,
    /from\s+["']node:|document\.|window\.|HTMLCanvasElement|fetch\(|readFile|writeFile|https?:\/\//
  );
});

function input(overrides: Partial<FormatRecommendationInput> = {}): FormatRecommendationInput {
  return {
    asset: asset(),
    profileMetadata: {
      assetType: "avatar_frame",
      profile: {
        id: "avatar-frame-production-target",
        label: "Avatar frame production target",
        purpose: "New production delivery",
        approvedForNewDelivery: true
      }
    },
    specReport: { specId: "avatar-frame-production", passed: true, issues: [] },
    auditSummary: auditSummary("low"),
    memoryDiagnostics: memoryDiagnostics(),
    sequenceResidencyDiagnostics: sequenceDiagnostics(0),
    sequenceFrameEvidence: frameEvidence(),
    currentFormat: "svga",
    targetUsageContext: "avatar_frame",
    ...overrides
  };
}

function asset(): MotionAssetInfo {
  return {
    format: "svga",
    name: "fixture.svga",
    sizeBytes: 1024,
    dimensions: { width: 300, height: 300 },
    timing: { fps: 24, frameCount: 72, durationMs: 3000 },
    layers: [],
    resources: []
  };
}

function auditSummary(uncertainty: MotionAssetAuditSummary["uncertainty"]): MotionAssetAuditSummary {
  return {
    auditStatus: uncertainty === "insufficient_evidence" ? "unknown" : "pass",
    primaryFindings: [],
    optimizationOpportunities: [],
    riskSignals: [],
    evidenceRefs: [],
    uncertainty
  };
}

function memoryDiagnostics(): RoleAwareMemoryDiagnostics {
  const empty = {
    resourceCount: 0,
    knownMemoryCount: 0,
    unknownMemoryCount: 0,
    totalEstimatedDecodedBytes: 0,
    totalEstimatedTextureBytes: 0,
    largestResourcesByDecodedBytes: []
  };
  return {
    byRole: {
      static_image: { role: "static_image", ...empty },
      sequence_frame: { role: "sequence_frame", ...empty },
      baked_sweep_frame: { role: "baked_sweep_frame", ...empty },
      mask_or_matte: { role: "mask_or_matte", ...empty },
      unknown: { role: "unknown", ...empty }
    },
    sequenceFrameEstimatedDecodedBytes: 0
  };
}

function sequenceDiagnostics(sequenceGroupCount: number): SequenceResidencyDiagnostics {
  return {
    sequenceGroupCount,
    framesPerGroup: sequenceGroupCount > 0 ? [{ groupId: "sequence:001-004", frameCount: 4 }] : [],
    totalSequenceFrameEstimatedDecodedBytes: sequenceGroupCount > 0 ? 6400 : 0,
    largestSequenceGroupsByDecodedBytes: [],
    possibleResidencyModels: sequenceGroupCount > 0 ? ["all_frames_resident"] : ["unknown"],
    advisoryRiskLevel: "low",
    evidence: [],
    uncertainty: sequenceGroupCount > 0 ? "medium" : "high",
    ungroupedResourceIds: []
  };
}

function frameEvidence(): SequenceFrameEvidence {
  return {
    analyzedResourceCount: 0,
    duplicateEvidenceStatus: "not_applicable",
    duplicateFrameGroups: [],
    fullyTransparentFrames: [],
    emptyOrNearEmptyFrames: [],
    nearEmptyTransparentPaddingRatio: 0.99,
    repeatedAlphaBoundsGroups: [],
    repeatedDimensionsGroups: [],
    missingContentHashResourceIds: [],
    missingAlphaBoundsResourceIds: [],
    evidenceConfidence: "high",
    uncertainty: "low"
  };
}
