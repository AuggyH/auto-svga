import type {
  FormatCapability,
  FormatCapabilityMatrixDocument,
  RecommendationFormat
} from "./format-recommendation.js";

export const CURRENT_CAPABILITY_MATRIX_VERSION = 1;
export const SUPPORTED_CAPABILITY_MATRIX_VERSIONS = [1] as const;
export const CURRENT_CAPABILITY_EVIDENCE_REVIEW_EPOCH = 1;

const listedFormats: readonly RecommendationFormat[] = [
  "svga", "vap", "lottie", "webp", "webm", "apng", "sprite", "unknown"
];

export interface CapabilityMatrixValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface CapabilityMatrixValidationResult {
  valid: boolean;
  errors: readonly CapabilityMatrixValidationIssue[];
  warnings: readonly CapabilityMatrixValidationIssue[];
}

export function getCurrentCapabilityMatrixVersion(): number {
  return CURRENT_CAPABILITY_MATRIX_VERSION;
}

export function getSupportedCapabilityMatrixVersions(): readonly number[] {
  return SUPPORTED_CAPABILITY_MATRIX_VERSIONS;
}

export function assertSupportedCapabilityMatrixVersion(version: unknown): asserts version is 1 {
  if (typeof version !== "number" || !SUPPORTED_CAPABILITY_MATRIX_VERSIONS.includes(version as 1)) {
    throw new Error(`Unsupported capability matrix version: ${String(version)}`);
  }
}

export function validateFormatCapabilityMatrix(document: unknown): CapabilityMatrixValidationResult {
  const errors: CapabilityMatrixValidationIssue[] = [];
  const warnings: CapabilityMatrixValidationIssue[] = [];
  if (!isRecord(document)) {
    return invalid("invalid_capability_matrix", "$", "Capability matrix must be an object.");
  }
  try {
    assertSupportedCapabilityMatrixVersion(document.capabilityMatrixVersion);
  } catch {
    errors.push(issue(
      "unsupported_capability_matrix_version",
      "capabilityMatrixVersion",
      `Unsupported capability matrix version: ${String(document.capabilityMatrixVersion)}`
    ));
  }
  if (!isRecord(document.formats)) {
    errors.push(issue("missing_formats", "formats", "Capability matrix formats are required."));
    return { valid: false, errors, warnings };
  }

  for (const format of listedFormats) {
    const path = `formats.${format}`;
    const capability = document.formats[format];
    if (!isRecord(capability)) {
      errors.push(issue("missing_format", path, `Capability entry for ${format} is required.`));
      continue;
    }
    validateCapability(capability, path, errors, warnings);
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function collectCapabilityMatrixWarnings(
  document: FormatCapabilityMatrixDocument | unknown
): readonly CapabilityMatrixValidationIssue[] {
  return validateFormatCapabilityMatrix(document).warnings;
}

function validateCapability(
  capability: Record<string, unknown>,
  path: string,
  errors: CapabilityMatrixValidationIssue[],
  warnings: CapabilityMatrixValidationIssue[]
): void {
  for (const field of [
    "supportsAlpha",
    "supportsReplaceableImage",
    "supportsReplaceableText",
    "supportsVector",
    "supportsVideoLikePlayback",
    "supportsFrameSequence"
  ]) {
    if (![true, false, "unknown"].includes(capability[field] as never)) {
      errors.push(issue("missing_capability_field", `${path}.${field}`, `${field} must be boolean or unknown.`));
    }
  }
  if (!Array.isArray(capability.evidence) || capability.evidence.length === 0) {
    errors.push(issue("missing_capability_evidence", `${path}.evidence`, "Capability evidence is required."));
  } else {
    capability.evidence.forEach((evidence, index) => validateEvidence(evidence, `${path}.evidence.${index}`, errors, warnings));
  }
  if (!Array.isArray(capability.implementationMaturity) || capability.implementationMaturity.length === 0) {
    errors.push(issue("missing_implementation_maturity", `${path}.implementationMaturity`, "Implementation maturity is required."));
  }
  if (!["supported", "not_supported", "experimental"].includes(String(capability.productionSupport))) {
    errors.push(issue("missing_production_support", `${path}.productionSupport`, "Production support marker is required."));
  }

  const maturity = Array.isArray(capability.implementationMaturity)
    ? capability.implementationMaturity.map(String)
    : [];
  const productionSupport = capability.productionSupport;
  if (productionSupport === "supported" && !maturity.includes("supported")) {
    errors.push(issue("production_support_maturity_conflict", path, "Production support requires supported implementation maturity."));
  }
  if (productionSupport !== "supported" && maturity.includes("supported")) {
    errors.push(issue("production_support_maturity_conflict", path, "Supported maturity conflicts with non-production support."));
  }
  if (maturity.includes("capability_known") && maturity.some((value) => value.endsWith("_not_implemented"))) {
    warnings.push(issue(
      "implementation_unavailable",
      path,
      "Format capability is known, but one or more Auto SVGA implementations are unavailable."
    ));
  }
}

function validateEvidence(
  value: unknown,
  path: string,
  errors: CapabilityMatrixValidationIssue[],
  warnings: CapabilityMatrixValidationIssue[]
): void {
  if (!isRecord(value)) {
    errors.push(issue("invalid_capability_evidence", path, "Capability evidence must be an object."));
    return;
  }
  for (const field of ["evidenceSource", "evidenceType", "confidence", "lastReviewedAt", "notes"]) {
    if (typeof value[field] !== "string" || value[field].length === 0) {
      errors.push(issue("invalid_capability_evidence", `${path}.${field}`, `${field} is required.`));
    }
  }
  if (typeof value.reviewEpoch !== "number") {
    errors.push(issue("missing_evidence_review_marker", `${path}.reviewEpoch`, "Evidence review epoch is required."));
  } else if (value.reviewEpoch < CURRENT_CAPABILITY_EVIDENCE_REVIEW_EPOCH) {
    warnings.push(issue(
      "stale_capability_evidence",
      path,
      "Capability evidence is older than the current review epoch."
    ));
  }
}

function invalid(code: string, path: string, message: string): CapabilityMatrixValidationResult {
  return { valid: false, errors: [issue(code, path, message)], warnings: [] };
}

function issue(code: string, path: string, message: string): CapabilityMatrixValidationIssue {
  return { code, path, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
