import type { AvatarFrameInspectionReport } from "./avatar-frame-inspection-report.js";

export const MOTION_ASSET_AUDIT_REPORT_CONTRACT_VERSION = 1 as const;

export interface MotionAssetAuditReportContractValidation {
  valid: boolean;
  errors: readonly string[];
}

const OBJECT_PATHS = [
  "asset",
  "asset.timing",
  "memoryEstimation",
  "memoryDiagnostics",
  "memoryDiagnostics.byRole",
  "memoryDiagnostics.byRole.static_image",
  "memoryDiagnostics.byRole.sequence_frame",
  "memoryDiagnostics.byRole.baked_sweep_frame",
  "memoryDiagnostics.byRole.mask_or_matte",
  "memoryDiagnostics.byRole.unknown",
  "sequenceResidencyDiagnostics",
  "sequenceFrameEvidence",
  "auditSummary",
  "auditPresentation"
] as const;

const ARRAY_PATHS = [
  "issues",
  "calibrationNotes",
  "memoryEstimation.resources",
  "memoryEstimation.largestResourcesByDecodedBytes",
  "memoryEstimation.unknownResourceIds",
  "sequenceResidencyDiagnostics.framesPerGroup",
  "sequenceResidencyDiagnostics.largestSequenceGroupsByDecodedBytes",
  "sequenceResidencyDiagnostics.possibleResidencyModels",
  "sequenceResidencyDiagnostics.evidence",
  "sequenceResidencyDiagnostics.ungroupedResourceIds",
  "sequenceFrameEvidence.duplicateFrameGroups",
  "sequenceFrameEvidence.fullyTransparentFrames",
  "sequenceFrameEvidence.emptyOrNearEmptyFrames",
  "sequenceFrameEvidence.repeatedAlphaBoundsGroups",
  "sequenceFrameEvidence.repeatedDimensionsGroups",
  "sequenceFrameEvidence.missingContentHashResourceIds",
  "sequenceFrameEvidence.missingAlphaBoundsResourceIds",
  "auditSummary.primaryFindings",
  "auditSummary.optimizationOpportunities",
  "auditSummary.riskSignals",
  "auditSummary.evidenceRefs",
  "auditPresentation.findingCards",
  "auditPresentation.opportunityCards",
  "auditPresentation.uncertaintyNotes",
  "auditPresentation.evidenceRefs"
] as const;

const STRING_PATHS = [
  "asset.format",
  "asset.name",
  "specId",
  "profileId",
  "profileLabel",
  "profilePurpose",
  "memoryEstimation.memoryRiskLevel",
  "sequenceResidencyDiagnostics.advisoryRiskLevel",
  "sequenceResidencyDiagnostics.uncertainty",
  "sequenceFrameEvidence.duplicateEvidenceStatus",
  "sequenceFrameEvidence.evidenceConfidence",
  "sequenceFrameEvidence.uncertainty",
  "auditSummary.auditStatus",
  "auditSummary.uncertainty",
  "auditPresentation.severityLevel"
] as const;

const NUMBER_PATHS = [
  "asset.sizeBytes",
  "asset.layerCount",
  "asset.resourceCount",
  "memoryEstimation.bytesPerPixel",
  "sequenceResidencyDiagnostics.sequenceGroupCount",
  "sequenceFrameEvidence.analyzedResourceCount",
  "sequenceFrameEvidence.nearEmptyTransparentPaddingRatio"
] as const;

const REQUIRED_PATHS = [
  "memoryEstimation.totalEstimatedDecodedResourceBytes",
  "memoryEstimation.sequenceFrameEstimatedDecodedBytes",
  "memoryDiagnostics.sequenceFrameEstimatedDecodedBytes",
  "sequenceResidencyDiagnostics.totalSequenceFrameEstimatedDecodedBytes"
] as const;

const LOCALIZATION_KEY_PATHS = [
  "auditPresentation.statusLabel",
  "auditPresentation.severityLabel",
  "auditPresentation.summaryTitle",
  "auditPresentation.summaryDescription"
] as const;

export function serializeMotionAssetAuditReportV1(
  report: AvatarFrameInspectionReport
): string {
  return JSON.stringify(report);
}

export function parseMotionAssetAuditReportV1(
  serialized: string
): AvatarFrameInspectionReport {
  const value: unknown = JSON.parse(serialized);
  const validation = validateMotionAssetAuditReportV1(value);
  if (!validation.valid) {
    throw new Error(`Invalid Motion Asset Audit report v1: ${validation.errors.join(", ")}`);
  }
  return value as AvatarFrameInspectionReport;
}

export function validateMotionAssetAuditReportV1(
  value: unknown
): MotionAssetAuditReportContractValidation {
  if (!isRecord(value)) return { valid: false, errors: ["report must be an object"] };
  const errors: string[] = [];

  if (value.contractVersion !== MOTION_ASSET_AUDIT_REPORT_CONTRACT_VERSION) {
    errors.push(`contractVersion must equal ${MOTION_ASSET_AUDIT_REPORT_CONTRACT_VERSION}`);
  }
  validatePaths(value, OBJECT_PATHS, isRecord, "an object", errors);
  validatePaths(value, ARRAY_PATHS, Array.isArray, "an array", errors);
  validatePaths(value, STRING_PATHS, (item) => typeof item === "string", "a string", errors);
  validatePaths(value, NUMBER_PATHS, (item) => typeof item === "number", "a number", errors);
  validatePaths(value, REQUIRED_PATHS, (item) => item !== MISSING, "present", errors);
  validatePaths(value, LOCALIZATION_KEY_PATHS, isLocalizationKey, "an audit localization key", errors);
  if (typeof value.passed !== "boolean") errors.push("passed must be a boolean");

  validateCards(value, "findingCards", false, errors);
  validateCards(value, "opportunityCards", true, errors);
  validateLocalizationKeyArray(value, "uncertaintyNotes", errors);
  return { valid: errors.length === 0, errors };
}

const MISSING = Symbol("missing");

function validatePaths(
  value: Record<string, unknown>,
  paths: readonly string[],
  predicate: (item: unknown) => boolean,
  expectation: string,
  errors: string[]
): void {
  for (const path of paths) {
    if (!predicate(valueAt(value, path))) errors.push(`${path} must be ${expectation}`);
  }
}

function validateCards(
  report: Record<string, unknown>,
  field: "findingCards" | "opportunityCards",
  opportunity: boolean,
  errors: string[]
): void {
  const cards = valueAt(report, `auditPresentation.${field}`);
  if (!Array.isArray(cards)) return;
  cards.forEach((card, index) => {
    const parent = `auditPresentation.${field}[${index}]`;
    if (!isRecord(card)) {
      errors.push(`${parent} must be an object`);
      return;
    }
    for (const key of ["code", "description", "category"]) {
      if (typeof card[key] !== "string") errors.push(`${parent}.${key} must be a string`);
    }
    for (const key of ["title", "descriptionKey", "categoryLabel"]) {
      if (!isLocalizationKey(card[key])) errors.push(`${parent}.${key} must be an audit localization key`);
    }
    if (!Array.isArray(card.evidenceRefs)) errors.push(`${parent}.evidenceRefs must be an array`);
    if (opportunity) {
      if (card.actionType !== "review_only") errors.push(`${parent}.actionType must equal review_only`);
      if (!isLocalizationKey(card.actionTypeLabel)) errors.push(`${parent}.actionTypeLabel must be an audit localization key`);
    } else {
      if (typeof card.severity !== "string") errors.push(`${parent}.severity must be a string`);
      if (!isLocalizationKey(card.severityLabel)) errors.push(`${parent}.severityLabel must be an audit localization key`);
    }
  });
}

function validateLocalizationKeyArray(
  report: Record<string, unknown>,
  field: string,
  errors: string[]
): void {
  const values = valueAt(report, `auditPresentation.${field}`);
  if (!Array.isArray(values)) return;
  values.forEach((value, index) => {
    if (!isLocalizationKey(value)) {
      errors.push(`auditPresentation.${field}[${index}] must be an audit localization key`);
    }
  });
}

function valueAt(value: Record<string, unknown>, path: string): unknown {
  let current: unknown = value;
  for (const segment of path.split(".")) {
    if (!isRecord(current) || !(segment in current)) return MISSING;
    current = current[segment];
  }
  return current;
}

function isLocalizationKey(value: unknown): boolean {
  return typeof value === "string" && value.startsWith("audit.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
