import { createHash } from "node:crypto";

export const P6_PARITY_REPORT_CONTRACT_VERSION = 1 as const;

export const P6_PARITY_SECTION_IDS = [
  "feature_parity",
  "visual_parity",
  "interaction_parity",
  "state_parity",
  "motion_parity",
  "browser_regression",
  "desktop_runtime_proof",
  "security_audit",
  "accessibility_report",
  "artifact_index"
] as const;

export type P6ParitySectionId = (typeof P6_PARITY_SECTION_IDS)[number];

export type P6ParityEvidenceStatus =
  | "pass"
  | "fail"
  | "partial"
  | "not_run"
  | "blocked";

export interface P6ParityEvidenceRef {
  id: string;
  status: P6ParityEvidenceStatus;
  artifactIds: readonly string[];
  summary: string;
}

export interface P6ParityInventory {
  itemCount: number;
  itemIds: readonly string[];
}

export interface P6ParitySectionBase<TId extends P6ParitySectionId> {
  id: TId;
  status: P6ParityEvidenceStatus;
  requiredEvidenceCount: number;
  evidence: readonly P6ParityEvidenceRef[];
  inventory: P6ParityInventory;
}

export type P6FeatureParityReport = P6ParitySectionBase<"feature_parity">;
export type P6VisualParityReport = P6ParitySectionBase<"visual_parity">;
export type P6InteractionParityReport = P6ParitySectionBase<"interaction_parity">;
export type P6StateParityReport = P6ParitySectionBase<"state_parity">;
export type P6MotionParityReport = P6ParitySectionBase<"motion_parity">;
export type P6BrowserRegressionReport = P6ParitySectionBase<"browser_regression">;
export type P6DesktopRuntimeProofReport = P6ParitySectionBase<"desktop_runtime_proof">;
export type P6SecurityAuditReport = P6ParitySectionBase<"security_audit">;
export type P6AccessibilityReport = P6ParitySectionBase<"accessibility_report">;

export interface P6ParityArtifactBinding {
  id: string;
  path: string;
  role: string;
  sha256: string;
  sizeBytes: number;
  mediaType?: string;
}

export interface P6ParityArtifactManifest {
  id: string;
  artifactIds: readonly string[];
  sha256: string;
}

export interface P6ArtifactIndexReport extends P6ParitySectionBase<"artifact_index"> {
  artifacts: readonly P6ParityArtifactBinding[];
  manifests: readonly P6ParityArtifactManifest[];
}

export interface P6ParityReportSections {
  featureParity: P6FeatureParityReport;
  visualParity: P6VisualParityReport;
  interactionParity: P6InteractionParityReport;
  stateParity: P6StateParityReport;
  motionParity: P6MotionParityReport;
  browserRegression: P6BrowserRegressionReport;
  desktopRuntimeProof: P6DesktopRuntimeProofReport;
  securityAudit: P6SecurityAuditReport;
  accessibilityReport: P6AccessibilityReport;
  artifactIndex: P6ArtifactIndexReport;
}

export interface P6ParitySourceBinding {
  baseCommit: string;
  headCommit: string;
  branch: string;
}

export interface P6AllowedInventoryShrink {
  sectionId: P6ParitySectionId;
  previousItemCount: number;
  currentItemCount: number;
  reason: string;
}

export interface P6ParityReportV1 {
  contractVersion: typeof P6_PARITY_REPORT_CONTRACT_VERSION;
  generatedAt: string;
  source: P6ParitySourceBinding;
  sections: P6ParityReportSections;
  allowedInventoryShrink?: readonly P6AllowedInventoryShrink[];
}

export interface P6ParityReportValidation {
  valid: boolean;
  errors: readonly string[];
}

export interface P6ParityValidationOptions {
  requiredEvidenceCounts?: Partial<Record<P6ParitySectionId, number>>;
  previousReport?: P6ParityReportV1;
}

export const P6_PARITY_DEFAULT_REQUIRED_EVIDENCE_COUNTS:
  Readonly<Record<P6ParitySectionId, number>> = {
    feature_parity: 1,
    visual_parity: 1,
    interaction_parity: 1,
    state_parity: 1,
    motion_parity: 1,
    browser_regression: 1,
    desktop_runtime_proof: 1,
    security_audit: 1,
    accessibility_report: 1,
    artifact_index: 1
  };

const SECTION_KEYS = [
  ["featureParity", "feature_parity"],
  ["visualParity", "visual_parity"],
  ["interactionParity", "interaction_parity"],
  ["stateParity", "state_parity"],
  ["motionParity", "motion_parity"],
  ["browserRegression", "browser_regression"],
  ["desktopRuntimeProof", "desktop_runtime_proof"],
  ["securityAudit", "security_audit"],
  ["accessibilityReport", "accessibility_report"],
  ["artifactIndex", "artifact_index"]
] as const satisfies readonly (readonly [keyof P6ParityReportSections, P6ParitySectionId])[];

export function createP6ParityArtifactBinding(input: {
  id: string;
  path: string;
  role: string;
  bytes: Uint8Array;
  mediaType?: string;
}): P6ParityArtifactBinding {
  return {
    id: input.id,
    path: input.path,
    role: input.role,
    sha256: createHash("sha256").update(input.bytes).digest("hex"),
    sizeBytes: input.bytes.byteLength,
    ...(input.mediaType ? { mediaType: input.mediaType } : {})
  };
}

export function validateP6ParityReportV1(
  value: unknown,
  options: P6ParityValidationOptions = {}
): P6ParityReportValidation {
  if (!isRecord(value)) return invalid("report must be an object");
  const errors: string[] = [];
  const requiredCounts = {
    ...P6_PARITY_DEFAULT_REQUIRED_EVIDENCE_COUNTS,
    ...options.requiredEvidenceCounts
  };

  if (value.contractVersion !== P6_PARITY_REPORT_CONTRACT_VERSION) {
    errors.push(`contractVersion must equal ${P6_PARITY_REPORT_CONTRACT_VERSION}`);
  }
  if (typeof value.generatedAt !== "string") errors.push("generatedAt must be a string");
  validateSource(value.source, errors);
  if (!isRecord(value.sections)) {
    errors.push("sections must be an object");
    return { valid: false, errors };
  }

  for (const [key, sectionId] of SECTION_KEYS) {
    validateSection(value.sections[key], key, sectionId, requiredCounts[sectionId], errors);
  }
  validateArtifactIndex(value.sections.artifactIndex, errors);
  validateSectionArtifactRefs(value.sections, errors);
  validateNoSilentInventoryShrink(value, options.previousReport, errors);

  return { valid: errors.length === 0, errors };
}

export function assertValidP6ParityReportV1(
  value: unknown,
  options?: P6ParityValidationOptions
): asserts value is P6ParityReportV1 {
  const validation = validateP6ParityReportV1(value, options);
  if (!validation.valid) {
    throw new Error(`Invalid P6 parity report v1: ${validation.errors.join(", ")}`);
  }
}

export function parseP6ParityReportV1(
  serialized: string,
  options?: P6ParityValidationOptions
): P6ParityReportV1 {
  const value: unknown = JSON.parse(serialized);
  assertValidP6ParityReportV1(value, options);
  return value;
}

function validateSource(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("source must be an object");
    return;
  }
  for (const key of ["baseCommit", "headCommit", "branch"] as const) {
    if (typeof value[key] !== "string" || value[key].length === 0) {
      errors.push(`source.${key} must be a non-empty string`);
    }
  }
}

function validateSection(
  value: unknown,
  key: string,
  sectionId: P6ParitySectionId,
  requiredCount: number,
  errors: string[]
): void {
  if (!isRecord(value)) {
    errors.push(`sections.${key} must be an object`);
    return;
  }
  if (value.id !== sectionId) errors.push(`sections.${key}.id must equal ${sectionId}`);
  if (!isEvidenceStatus(value.status)) errors.push(`sections.${key}.status is invalid`);
  const requiredEvidenceCount = value.requiredEvidenceCount;
  if (
    typeof requiredEvidenceCount !== "number"
    || !Number.isSafeInteger(requiredEvidenceCount)
    || requiredEvidenceCount < 0
  ) {
    errors.push(`sections.${key}.requiredEvidenceCount must be a non-negative integer`);
  }
  const effectiveRequiredCount = Math.max(
    requiredCount,
    typeof requiredEvidenceCount === "number" ? requiredEvidenceCount : 0
  );
  if (!Array.isArray(value.evidence)) {
    errors.push(`sections.${key}.evidence must be an array`);
  } else {
    if (value.evidence.length < effectiveRequiredCount) {
      errors.push(`sections.${key}.evidence has ${value.evidence.length}, requires ${effectiveRequiredCount}`);
    }
    value.evidence.forEach((evidence, index) =>
      validateEvidence(evidence, `sections.${key}.evidence[${index}]`, errors)
    );
  }
  validateInventory(value.inventory, `sections.${key}.inventory`, errors);
}

function validateEvidence(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (typeof value.id !== "string" || value.id.length === 0) errors.push(`${path}.id must be a non-empty string`);
  if (!isEvidenceStatus(value.status)) errors.push(`${path}.status is invalid`);
  if (!Array.isArray(value.artifactIds)) {
    errors.push(`${path}.artifactIds must be an array`);
  } else if (!value.artifactIds.every((artifactId) => typeof artifactId === "string" && artifactId.length > 0)) {
    errors.push(`${path}.artifactIds must contain only non-empty strings`);
  }
  if (typeof value.summary !== "string" || value.summary.length === 0) {
    errors.push(`${path}.summary must be a non-empty string`);
  }
}

function validateInventory(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  const itemCount = value.itemCount;
  if (typeof itemCount !== "number" || !Number.isSafeInteger(itemCount) || itemCount < 0) {
    errors.push(`${path}.itemCount must be a non-negative integer`);
  }
  if (!Array.isArray(value.itemIds)) {
    errors.push(`${path}.itemIds must be an array`);
  } else {
    if (!value.itemIds.every((itemId) => typeof itemId === "string" && itemId.length > 0)) {
      errors.push(`${path}.itemIds must contain only non-empty strings`);
    }
    if (typeof itemCount === "number" && value.itemIds.length !== itemCount) {
      errors.push(`${path}.itemIds length must equal itemCount`);
    }
  }
}

function validateArtifactIndex(value: unknown, errors: string[]): void {
  if (!isRecord(value)) return;
  if (!Array.isArray(value.artifacts)) {
    errors.push("sections.artifactIndex.artifacts must be an array");
    return;
  }
  if (!Array.isArray(value.manifests)) {
    errors.push("sections.artifactIndex.manifests must be an array");
    return;
  }

  const artifactIds = new Set<string>();
  for (const [index, artifact] of value.artifacts.entries()) {
    const path = `sections.artifactIndex.artifacts[${index}]`;
    if (!isRecord(artifact)) {
      errors.push(`${path} must be an object`);
      continue;
    }
    validateUniqueId(artifact.id, path, artifactIds, errors);
    if (typeof artifact.path !== "string" || artifact.path.length === 0) errors.push(`${path}.path must be a non-empty string`);
    if (typeof artifact.role !== "string" || artifact.role.length === 0) errors.push(`${path}.role must be a non-empty string`);
    if (!isSha256(artifact.sha256)) errors.push(`${path}.sha256 must be a sha256 hex string`);
    const sizeBytes = artifact.sizeBytes;
    if (typeof sizeBytes !== "number" || !Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
      errors.push(`${path}.sizeBytes must be a non-negative integer`);
    }
  }

  const manifestIds = new Set<string>();
  for (const [index, manifest] of value.manifests.entries()) {
    const path = `sections.artifactIndex.manifests[${index}]`;
    if (!isRecord(manifest)) {
      errors.push(`${path} must be an object`);
      continue;
    }
    validateUniqueId(manifest.id, path, manifestIds, errors);
    if (!isSha256(manifest.sha256)) errors.push(`${path}.sha256 must be a sha256 hex string`);
    if (!Array.isArray(manifest.artifactIds)) {
      errors.push(`${path}.artifactIds must be an array`);
    } else {
      for (const artifactId of manifest.artifactIds) {
        if (typeof artifactId !== "string" || artifactId.length === 0) {
          errors.push(`${path}.artifactIds must contain only non-empty strings`);
        } else if (!artifactIds.has(artifactId)) {
          errors.push(`${path}.artifactIds references unknown artifact ${artifactId}`);
        }
      }
    }
  }
}

function validateSectionArtifactRefs(
  sections: Record<string, unknown>,
  errors: string[]
): void {
  const artifactIds = collectArtifactIds(sections.artifactIndex);
  for (const [key] of SECTION_KEYS) {
    const section = sections[key];
    if (!isRecord(section) || !Array.isArray(section.evidence)) continue;
    section.evidence.forEach((evidence, evidenceIndex) => {
      if (!isRecord(evidence) || !Array.isArray(evidence.artifactIds)) return;
      evidence.artifactIds.forEach((artifactId) => {
        if (typeof artifactId === "string" && !artifactIds.has(artifactId)) {
          errors.push(`sections.${key}.evidence[${evidenceIndex}].artifactIds references unknown artifact ${artifactId}`);
        }
      });
    });
  }
}

function collectArtifactIds(artifactIndex: unknown): ReadonlySet<string> {
  const artifactIds = new Set<string>();
  if (!isRecord(artifactIndex) || !Array.isArray(artifactIndex.artifacts)) return artifactIds;
  for (const artifact of artifactIndex.artifacts) {
    if (isRecord(artifact) && typeof artifact.id === "string" && artifact.id.length > 0) {
      artifactIds.add(artifact.id);
    }
  }
  return artifactIds;
}

function validateNoSilentInventoryShrink(
  report: Record<string, unknown>,
  previousReport: P6ParityReportV1 | undefined,
  errors: string[]
): void {
  if (!previousReport || !isRecord(report.sections)) return;
  for (const [key, sectionId] of SECTION_KEYS) {
    const currentSection = report.sections[key];
    const previousSection = previousReport.sections[key];
    if (!isRecord(currentSection) || !isRecord(currentSection.inventory)) continue;
    const currentCount = currentSection.inventory.itemCount;
    const previousCount = previousSection.inventory.itemCount;
    if (
      typeof currentCount === "number"
      && currentCount < previousCount
      && !hasAllowedShrink(report.allowedInventoryShrink, sectionId, previousCount, currentCount)
    ) {
      errors.push(`sections.${key}.inventory silently shrank from ${previousCount} to ${currentCount}`);
    }
  }
}

function hasAllowedShrink(
  value: unknown,
  sectionId: P6ParitySectionId,
  previousItemCount: number,
  currentItemCount: number
): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((entry) =>
    isRecord(entry)
    && entry.sectionId === sectionId
    && entry.previousItemCount === previousItemCount
    && entry.currentItemCount === currentItemCount
    && typeof entry.reason === "string"
    && entry.reason.length > 0
  );
}

function validateUniqueId(
  value: unknown,
  path: string,
  ids: Set<string>,
  errors: string[]
): void {
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`${path}.id must be a non-empty string`);
    return;
  }
  if (ids.has(value)) {
    errors.push(`${path}.id duplicates ${value}`);
    return;
  }
  ids.add(value);
}

function isEvidenceStatus(value: unknown): value is P6ParityEvidenceStatus {
  return value === "pass"
    || value === "fail"
    || value === "partial"
    || value === "not_run"
    || value === "blocked";
}

function isSha256(value: unknown): boolean {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(error: string): P6ParityReportValidation {
  return { valid: false, errors: [error] };
}
