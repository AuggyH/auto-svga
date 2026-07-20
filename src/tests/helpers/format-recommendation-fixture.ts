import type {
  MotionAssetInfo,
  RoleAwareMemoryDiagnostics,
  SequenceFrameEvidence,
  SequenceResidencyDiagnostics
} from "../../workbench/contracts.js";
import type { FormatRecommendationInput } from "../../workbench/format-recommendation.js";
import type { MotionAssetAuditSummary } from "../../workbench/motion-asset-audit-summary.js";

export function recommendationInput(
  overrides: Partial<FormatRecommendationInput> = {}
): FormatRecommendationInput {
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

export function auditSummary(
  uncertainty: MotionAssetAuditSummary["uncertainty"]
): MotionAssetAuditSummary {
  return {
    auditStatus: uncertainty === "insufficient_evidence" ? "unknown" : "pass",
    primaryFindings: [],
    optimizationOpportunities: [],
    riskSignals: [],
    evidenceRefs: [],
    uncertainty
  };
}

export function sequenceDiagnostics(sequenceGroupCount: number): SequenceResidencyDiagnostics {
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
