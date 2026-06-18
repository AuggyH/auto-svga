import type {
  MemoryRiskLevel,
  MotionAssetInfo,
  MotionAssetMemoryEstimation,
  SequenceFrameEvidence,
  SequenceResidencyDiagnostics,
  WorkbenchIssue
} from "./contracts.js";

export type MotionAssetAuditStatus = "pass" | "advisory" | "needs_review" | "unknown";
export type MotionAssetAuditUncertainty =
  | "low"
  | "medium"
  | "high"
  | "insufficient_evidence";

export interface MotionAssetAuditFinding {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  evidenceRefs: readonly string[];
}

export interface MotionAssetOptimizationOpportunity {
  code: string;
  message: string;
  evidenceRefs: readonly string[];
}

export interface MotionAssetRiskSignal {
  code: string;
  level: MemoryRiskLevel;
  evidenceRefs: readonly string[];
}

export interface MotionAssetAuditSummary {
  auditStatus: MotionAssetAuditStatus;
  primaryFindings: readonly MotionAssetAuditFinding[];
  optimizationOpportunities: readonly MotionAssetOptimizationOpportunity[];
  riskSignals: readonly MotionAssetRiskSignal[];
  evidenceRefs: readonly string[];
  uncertainty: MotionAssetAuditUncertainty;
}

export interface MotionAssetAuditInput {
  asset: MotionAssetInfo;
  issues: readonly WorkbenchIssue[];
  memoryEstimation: MotionAssetMemoryEstimation;
  sequenceResidencyDiagnostics: SequenceResidencyDiagnostics;
  sequenceFrameEvidence: SequenceFrameEvidence;
}

const issueFindingCodes = new Map<string, string>([
  ["file_size_exceeds_limit", "File size exceeds the active specification."],
  ["resource_count_exceeds_limit", "Resource count exceeds the active specification."],
  ["resource_transparent_padding_exceeds_limit", "One or more resources exceed the transparent-padding limit."],
  ["fps_exceeds_limit", "FPS exceeds the active specification."],
  ["duration_exceeds_limit", "Duration exceeds the active specification."]
]);

export function createMotionAssetAuditSummary(
  input: MotionAssetAuditInput
): MotionAssetAuditSummary {
  const primaryFindings = findings(input);
  const optimizationOpportunities = opportunities(input);
  const riskSignals = risks(input);
  const uncertainty = auditUncertainty(input);

  return {
    auditStatus: auditStatus(primaryFindings, optimizationOpportunities, riskSignals, uncertainty),
    primaryFindings,
    optimizationOpportunities,
    riskSignals,
    evidenceRefs: unique([
      ...primaryFindings.flatMap(({ evidenceRefs }) => evidenceRefs),
      ...optimizationOpportunities.flatMap(({ evidenceRefs }) => evidenceRefs),
      ...riskSignals.flatMap(({ evidenceRefs }) => evidenceRefs)
    ]),
    uncertainty
  };
}

function findings(input: MotionAssetAuditInput): MotionAssetAuditFinding[] {
  const result: MotionAssetAuditFinding[] = input.issues.map((issue) => ({
    code: issue.code,
    severity: issue.severity,
    message: issueFindingCodes.get(issue.code) ?? issue.message,
    evidenceRefs: issueRefs(issue)
  }));
  const memoryRisk = input.memoryEstimation.memoryRiskLevel;
  if (memoryRisk !== "low") {
    result.push({
      code: memoryRisk === "unknown" ? "decoded_memory_unknown" : "decoded_memory_risk",
      severity: memoryRisk === "high" ? "error" : "warning",
      message: memoryRisk === "unknown"
        ? "Decoded resource memory cannot be fully estimated."
        : `Decoded resource memory has ${memoryRisk} advisory risk.`,
      evidenceRefs: ["metric:memoryEstimation.memoryRiskLevel"]
    });
  }
  const sequenceRisk = input.sequenceResidencyDiagnostics.advisoryRiskLevel;
  if (sequenceRisk !== "low") {
    result.push({
      code: sequenceRisk === "unknown"
        ? "sequence_memory_unknown"
        : "sequence_memory_concentration",
      severity: sequenceRisk === "high" ? "error" : "warning",
      message: sequenceRisk === "unknown"
        ? "Sequence resource memory cannot be fully estimated."
        : "Sequence resources contribute notable estimated decoded memory.",
      evidenceRefs: ["metric:sequenceResidencyDiagnostics.advisoryRiskLevel"]
    });
  }
  if (input.sequenceFrameEvidence.duplicateFrameGroups.length > 0) {
    result.push({
      code: "duplicate_encoded_frames",
      severity: "warning",
      message: "Byte-identical encoded sequence frames were found.",
      evidenceRefs: input.sequenceFrameEvidence.duplicateFrameGroups.map(
        ({ key }) => `hash-group:${key}`
      )
    });
  }
  addFrameEvidenceFindings(result, input.sequenceFrameEvidence);
  return result;
}

function addFrameEvidenceFindings(
  findings: MotionAssetAuditFinding[],
  evidence: SequenceFrameEvidence
): void {
  if (evidence.fullyTransparentFrames.length > 0) {
    findings.push({
      code: "fully_transparent_sequence_frames",
      severity: "error",
      message: "Fully transparent sequence frames were found.",
      evidenceRefs: evidence.fullyTransparentFrames.map((id) => `resource:${id}`)
    });
  }
  const nearEmpty = evidence.emptyOrNearEmptyFrames.filter(
    (id) => !evidence.fullyTransparentFrames.includes(id)
  );
  if (nearEmpty.length > 0) {
    findings.push({
      code: "near_empty_sequence_frames",
      severity: "warning",
      message: "Provisionally near-empty sequence frames were found.",
      evidenceRefs: nearEmpty.map((id) => `resource:${id}`)
    });
  }
}

function opportunities(input: MotionAssetAuditInput): MotionAssetOptimizationOpportunity[] {
  const result: MotionAssetOptimizationOpportunity[] = [];
  if (["medium", "high"].includes(input.memoryEstimation.memoryRiskLevel)) {
    const resources = input.memoryEstimation.largestResourcesByDecodedBytes.slice(0, 3);
    if (resources.length > 0) {
      result.push(opportunity(
        "review_large_resources",
        "Review the largest decoded resources.",
        resources.map(({ resourceId }) => `resource:${resourceId}`)
      ));
    }
  }
  addPaddingOpportunities(result, input);
  if (input.sequenceFrameEvidence.duplicateFrameGroups.length > 0) {
    result.push(opportunity(
      "review_duplicate_encoded_frames",
      "Review byte-identical encoded sequence frames.",
      input.sequenceFrameEvidence.duplicateFrameGroups.map(({ key }) => `hash-group:${key}`)
    ));
  }
  if (input.sequenceFrameEvidence.fullyTransparentFrames.length > 0) {
    result.push(opportunity(
      "review_fully_transparent_frames",
      "Review fully transparent sequence frames.",
      input.sequenceFrameEvidence.fullyTransparentFrames.map((id) => `resource:${id}`)
    ));
  }
  if (input.sequenceResidencyDiagnostics.possibleResidencyModels.includes("sprite_sheet_candidate")) {
    result.push(opportunity(
      "evaluate_sprite_sheet_packing",
      "Evaluate sprite-sheet packing for deterministic sequence groups.",
      input.sequenceResidencyDiagnostics.framesPerGroup.map(
        ({ groupId }) => `sequence-group:${groupId}`
      )
    ));
  }
  for (const code of ["fps_exceeds_limit", "duration_exceeds_limit"] as const) {
    if (input.issues.some((issue) => issue.code === code)) {
      result.push(opportunity(
        code === "fps_exceeds_limit" ? "review_fps" : "review_duration",
        code === "fps_exceeds_limit"
          ? "Review FPS because the active specification reports a limit violation."
          : "Review duration because the active specification reports a limit violation.",
        [`issue:${code}`]
      ));
    }
  }
  return result;
}

function addPaddingOpportunities(
  result: MotionAssetOptimizationOpportunity[],
  input: MotionAssetAuditInput
): void {
  const paddedIds = input.issues
    .filter(({ code }) => code === "resource_transparent_padding_exceeds_limit")
    .flatMap((issue) => resourceIds(issue));
  const staticIds = paddedIds.filter((id) => resourceRole(input.asset, id) === "static_image");
  const sequenceIds = paddedIds.filter((id) => (
    resourceRole(input.asset, id) === "sequence_frame"
    || resourceRole(input.asset, id) === "baked_sweep_frame"
  ));
  if (staticIds.length > 0) {
    result.push(opportunity(
      "crop_static_transparent_padding",
      "Review static transparent padding with offset preservation.",
      ["issue:resource_transparent_padding_exceeds_limit", ...staticIds.map((id) => `resource:${id}`)]
    ));
  }
  if (sequenceIds.length > 0) {
    result.push(opportunity(
      "evaluate_group_level_sequence_crop",
      "Evaluate group-level sequence cropping with offset preservation.",
      ["issue:resource_transparent_padding_exceeds_limit", ...sequenceIds.map((id) => `resource:${id}`)]
    ));
  }
}

function risks(input: MotionAssetAuditInput): MotionAssetRiskSignal[] {
  return [
    {
      code: "decoded_memory",
      level: input.memoryEstimation.memoryRiskLevel,
      evidenceRefs: ["metric:memoryEstimation.memoryRiskLevel"]
    },
    {
      code: "sequence_residency",
      level: input.sequenceResidencyDiagnostics.advisoryRiskLevel,
      evidenceRefs: ["metric:sequenceResidencyDiagnostics.advisoryRiskLevel"]
    }
  ];
}

function auditUncertainty(input: MotionAssetAuditInput): MotionAssetAuditUncertainty {
  const sequenceEvidence = input.sequenceFrameEvidence;
  if (
    sequenceEvidence.analyzedResourceCount > 0
    && sequenceEvidence.duplicateEvidenceStatus === "insufficient_evidence"
  ) {
    return "insufficient_evidence";
  }
  if (
    input.memoryEstimation.memoryRiskLevel === "unknown"
    || (
      sequenceEvidence.analyzedResourceCount > 0
      && input.sequenceResidencyDiagnostics.uncertainty === "high"
    )
  ) {
    return "high";
  }
  if (
    input.sequenceResidencyDiagnostics.uncertainty === "medium"
    || sequenceEvidence.evidenceConfidence === "medium"
    || sequenceEvidence.evidenceConfidence === "low"
  ) {
    return "medium";
  }
  return "low";
}

function auditStatus(
  findings: readonly MotionAssetAuditFinding[],
  opportunities: readonly MotionAssetOptimizationOpportunity[],
  risks: readonly MotionAssetRiskSignal[],
  uncertainty: MotionAssetAuditUncertainty
): MotionAssetAuditStatus {
  if (
    findings.some(({ severity }) => severity === "error")
    || risks.some(({ level }) => level === "high")
  ) return "needs_review";
  if (uncertainty === "high" || uncertainty === "insufficient_evidence") return "unknown";
  if (findings.length > 0 || opportunities.length > 0) return "advisory";
  return "pass";
}

function issueRefs(issue: WorkbenchIssue): string[] {
  return [
    `issue:${issue.code}`,
    ...resourceIds(issue).map((id) => `resource:${id}`)
  ];
}

function resourceIds(issue: WorkbenchIssue): string[] {
  const value = issue.details?.resourceId;
  return typeof value === "string" ? [value] : [];
}

function resourceRole(asset: MotionAssetInfo, id: string) {
  return asset.resources.find((resource) => resource.id === id)?.role;
}

function opportunity(
  code: string,
  message: string,
  evidenceRefs: readonly string[]
): MotionAssetOptimizationOpportunity {
  return { code, message, evidenceRefs };
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
