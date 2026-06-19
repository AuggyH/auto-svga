import assert from "node:assert/strict";
import test from "node:test";
import type { MotionAssetAuditSummary } from "../workbench/motion-asset-audit-summary.js";
import { createMotionAssetAuditPresentation } from "../workbench/motion-asset-audit-presentation.js";

test("maps a passing audit to stable read-only presentation keys", () => {
  const summary = auditSummary({ auditStatus: "pass" });
  const presentation = createMotionAssetAuditPresentation(summary);

  assert.equal(presentation.statusLabel, "audit.status.pass");
  assert.equal(presentation.severityLevel, "success");
  assert.equal(presentation.summaryTitle, "audit.summary.pass.title");
  assert.equal(presentation.summaryDescription, "audit.summary.pass.description");
  assert.deepEqual(presentation.findingCards, []);
  assert.deepEqual(presentation.opportunityCards, []);
  assert.deepEqual(presentation.uncertaintyNotes, []);
});

test("creates categorized finding and review-only opportunity cards", () => {
  const summary = auditSummary({
    auditStatus: "needs_review",
    primaryFindings: [
      {
        code: "file_size_exceeds_limit",
        severity: "error",
        message: "File size exceeds the active specification.",
        evidenceRefs: ["issue:file_size_exceeds_limit"]
      },
      {
        code: "sequence_memory_concentration",
        severity: "warning",
        message: "Sequence resources contribute notable estimated decoded memory.",
        evidenceRefs: ["metric:sequenceResidencyDiagnostics.advisoryRiskLevel"]
      }
    ],
    optimizationOpportunities: [
      {
        code: "crop_static_transparent_padding",
        message: "Review static transparent padding with offset preservation.",
        evidenceRefs: ["resource:frame"]
      },
      {
        code: "evaluate_sprite_sheet_packing",
        message: "Evaluate sprite-sheet packing for deterministic sequence groups.",
        evidenceRefs: ["sequence-group:sweep"]
      }
    ],
    evidenceRefs: [
      "issue:file_size_exceeds_limit",
      "metric:sequenceResidencyDiagnostics.advisoryRiskLevel",
      "resource:frame",
      "sequence-group:sweep"
    ]
  });

  const presentation = createMotionAssetAuditPresentation(summary);

  assert.equal(presentation.severityLevel, "error");
  assert.equal(presentation.findingCards[0].category, "specification");
  assert.equal(presentation.findingCards[1].category, "memory");
  assert.equal(presentation.opportunityCards[0].category, "transparency");
  assert.equal(presentation.opportunityCards[1].category, "sequence");
  assert.ok(presentation.opportunityCards.every(
    ({ actionType }) => actionType === "review_only"
  ));
  assert.deepEqual(presentation.evidenceRefs, summary.evidenceRefs);
});

test("preserves explicit uncertainty without inventing evidence", () => {
  const summary = auditSummary({
    auditStatus: "unknown",
    uncertainty: "insufficient_evidence",
    evidenceRefs: ["metric:memoryEstimation.memoryRiskLevel"]
  });

  const presentation = createMotionAssetAuditPresentation(summary);

  assert.equal(presentation.severityLevel, "unknown");
  assert.deepEqual(
    presentation.uncertaintyNotes,
    ["audit.uncertainty.insufficient_evidence"]
  );
  assert.deepEqual(
    presentation.evidenceRefs,
    ["metric:memoryEstimation.memoryRiskLevel"]
  );
});

test("does not mutate the source audit summary", () => {
  const summary = auditSummary({
    auditStatus: "advisory",
    primaryFindings: [{
      code: "decoded_memory_risk",
      severity: "warning",
      message: "Decoded resource memory has medium advisory risk.",
      evidenceRefs: ["metric:memoryEstimation.memoryRiskLevel"]
    }]
  });
  const before = structuredClone(summary);

  createMotionAssetAuditPresentation(summary);

  assert.deepEqual(summary, before);
});

function auditSummary(
  overrides: Partial<MotionAssetAuditSummary>
): MotionAssetAuditSummary {
  return {
    auditStatus: "pass",
    primaryFindings: [],
    optimizationOpportunities: [],
    riskSignals: [],
    evidenceRefs: [],
    uncertainty: "low",
    ...overrides
  };
}
