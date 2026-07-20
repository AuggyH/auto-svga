import type {
  MotionAssetInfo,
  MotionSpecCheckReport,
  MotionSpecProfile,
  RoleAwareMemoryDiagnostics,
  SequenceFrameEvidence,
  SequenceResidencyDiagnostics
} from "./contracts.js";
import type { MotionAssetAuditSummary } from "./motion-asset-audit-summary.js";
import type { RoleAwareTransparentPaddingPolicySummary } from "./role-aware-transparent-padding.js";
import {
  collectCapabilityMatrixWarnings,
  validateFormatCapabilityMatrix
} from "./format-capability-matrix.js";

export type RecommendationFormat =
  | "svga"
  | "vap"
  | "lottie"
  | "webp"
  | "webm"
  | "apng"
  | "sprite"
  | "unknown";

export type TargetUsageContext =
  | "avatar_frame"
  | "gift_effect"
  | "room_banner"
  | "unknown";

export type CapabilitySupport = boolean | "unknown";

export type FormatCapabilityMatrixVersion = 1;
export type FormatCapabilityEvidenceType =
  | "format_spec"
  | "implementation_verified"
  | "project_assumption"
  | "needs_verification";
export type FormatCapabilityEvidenceConfidence = "high" | "medium" | "low" | "unknown";

export interface FormatCapabilityEvidence {
  evidenceSource: string;
  evidenceType: FormatCapabilityEvidenceType;
  confidence: FormatCapabilityEvidenceConfidence;
  lastReviewedAt: string;
  reviewEpoch: number;
  notes: string;
}

export type FormatImplementationMaturity =
  | "capability_known"
  | "parser_not_implemented"
  | "player_not_implemented"
  | "exporter_not_implemented"
  | "converter_not_implemented"
  | "production_not_supported"
  | "experimental"
  | "supported";

export interface FormatCapability {
  format: RecommendationFormat;
  supportsAlpha: CapabilitySupport;
  supportsReplaceableImage: CapabilitySupport;
  supportsReplaceableText: CapabilitySupport;
  supportsVector: CapabilitySupport;
  supportsVideoLikePlayback: CapabilitySupport;
  supportsFrameSequence: CapabilitySupport;
  typicalStrengths: readonly string[];
  typicalRisks: readonly string[];
  evidence: readonly FormatCapabilityEvidence[];
  implementationMaturity: readonly FormatImplementationMaturity[];
  productionSupport: "supported" | "not_supported" | "experimental";
}

export type FormatCapabilityMatrix = Readonly<Record<RecommendationFormat, FormatCapability>>;

export interface FormatCapabilityMatrixDocument {
  capabilityMatrixVersion: number;
  formats: FormatCapabilityMatrix;
}

export interface FormatRecommendationRequirements {
  requiresAlpha?: boolean;
  requiresReplaceableImage?: boolean;
  requiresReplaceableText?: boolean;
}

export interface FormatRecommendationProfileMetadata {
  assetType: string;
  profile?: MotionSpecProfile;
}

export interface FormatRecommendationInput {
  asset: MotionAssetInfo;
  profileMetadata: FormatRecommendationProfileMetadata;
  specReport: MotionSpecCheckReport;
  auditSummary: MotionAssetAuditSummary;
  memoryDiagnostics: RoleAwareMemoryDiagnostics;
  sequenceResidencyDiagnostics: SequenceResidencyDiagnostics;
  sequenceFrameEvidence: SequenceFrameEvidence;
  transparentPaddingPolicy?: RoleAwareTransparentPaddingPolicySummary;
  currentFormat: RecommendationFormat;
  targetUsageContext: TargetUsageContext;
  requirements?: FormatRecommendationRequirements;
  capabilityMatrixDocument?: FormatCapabilityMatrixDocument;
}

export type RecommendationCandidateStatus =
  | "capability_match"
  | "constraint_mismatch"
  | "needs_more_data";

export interface FormatRecommendationTradeoff {
  kind: "strength" | "risk" | "constraint";
  message: string;
}

export interface FormatRecommendationCandidate {
  format: RecommendationFormat;
  status: RecommendationCandidateStatus;
  implementationStatus: "supported" | "experimental" | "not_available";
  implementationMaturity: readonly FormatImplementationMaturity[];
  productionSupport: FormatCapability["productionSupport"];
  rationale: readonly string[];
  tradeoffs: readonly FormatRecommendationTradeoff[];
  evidenceRefs: readonly string[];
  uncertainty: "low" | "medium" | "high";
}

export const FORMAT_RECOMMENDATION_CAPABILITY_MATRIX_VERSION: FormatCapabilityMatrixVersion = 1;

const CAPABILITY_EVIDENCE: Readonly<Record<RecommendationFormat, readonly FormatCapabilityEvidence[]>> = {
  svga: [{
    evidenceSource: "repository:proto/svga.proto and current SVGA adapter/player/exporter tests",
    evidenceType: "implementation_verified",
    confidence: "high",
    lastReviewedAt: "2026-06-19",
    reviewEpoch: 1,
    notes: "Verified only for the repository's current bounded SVGA workflows."
  }],
  vap: [needsVerification("architecture:multiformat-workbench VAP research boundary")],
  lottie: [needsVerification("architecture:multiformat-workbench Lottie research boundary")],
  webp: [needsVerification("architecture:multiformat-workbench animated WebP boundary")],
  webm: [needsVerification("architecture:multiformat-workbench WebM boundary")],
  apng: [needsVerification("architecture:multiformat-workbench APNG boundary")],
  sprite: [needsVerification("architecture:multiformat-workbench sprite boundary")],
  unknown: [{
    evidenceSource: "none",
    evidenceType: "needs_verification",
    confidence: "unknown",
    lastReviewedAt: "2026-06-19",
    reviewEpoch: 1,
    notes: "No format identity or capability evidence is available."
  }]
};

const IMPLEMENTATION_MATURITY: Readonly<Record<RecommendationFormat, readonly FormatImplementationMaturity[]>> = {
  svga: ["capability_known", "converter_not_implemented", "supported"],
  vap: notImplementedMaturity(),
  lottie: notImplementedMaturity(),
  webp: notImplementedMaturity(),
  webm: notImplementedMaturity(),
  apng: notImplementedMaturity(),
  sprite: notImplementedMaturity(),
  unknown: ["production_not_supported"]
};

export interface FormatRecommendationReport {
  currentFormat: RecommendationFormat;
  candidateFormats: readonly FormatRecommendationCandidate[];
  recommendationStatus: "advisory" | "needs_more_data" | "unknown";
  rationale: readonly string[];
  tradeoffs: readonly FormatRecommendationTradeoff[];
  evidenceRefs: readonly string[];
  uncertainty: "low" | "medium" | "high";
}

export const FORMAT_RECOMMENDATION_CAPABILITY_MATRIX: FormatCapabilityMatrix = {
  svga: capability("svga", true, true, true, false, false, true,
    ["Layered raster animation with replaceable image and text semantics."],
    ["Runtime support and editable semantics vary across SVGA players."]),
  vap: capability("vap", true, "unknown", "unknown", false, true, true,
    ["Video-like playback can suit high-fidelity effects."],
    ["Replacement semantics and encoder support require implementation evidence."]),
  lottie: capability("lottie", true, true, true, true, false, false,
    ["Vector animation and semantic replacement can remain compact."],
    ["Renderer feature compatibility must be checked before delivery."]),
  webp: capability("webp", true, false, false, false, true, true,
    ["Flattened raster animation has broad image-style delivery semantics."],
    ["No semantic replaceable layers; decoded-frame residency can be high."]),
  webm: capability("webm", "unknown", false, false, false, true, false,
    ["Video codecs can reduce transfer size for long raster motion."],
    ["Alpha and codec support vary by platform; no semantic replacement."]),
  apng: capability("apng", true, false, false, false, true, true,
    ["Lossless alpha raster animation with straightforward frame semantics."],
    ["File size and decoded-frame memory can grow quickly."]),
  sprite: capability("sprite", true, false, false, false, false, true,
    ["Explicit frame packing can support deterministic frame playback."],
    ["Requires manifest and playback implementation; no semantic replacement."]),
  unknown: capability("unknown", "unknown", "unknown", "unknown", "unknown", "unknown", "unknown",
    [], ["Format capabilities are unknown."])
};

export const FORMAT_RECOMMENDATION_CAPABILITY_MATRIX_DOCUMENT = {
  capabilityMatrixVersion: FORMAT_RECOMMENDATION_CAPABILITY_MATRIX_VERSION,
  formats: FORMAT_RECOMMENDATION_CAPABILITY_MATRIX
} as const satisfies FormatCapabilityMatrixDocument;

export function createFormatRecommendationReport(
  input: FormatRecommendationInput
): FormatRecommendationReport {
  const evidenceRefs = baseEvidenceRefs(input);
  const matrixDocument = input.capabilityMatrixDocument
    ?? FORMAT_RECOMMENDATION_CAPABILITY_MATRIX_DOCUMENT;
  const matrixValidation = validateFormatCapabilityMatrix(matrixDocument);
  if (!matrixValidation.valid) {
    return unresolved(input.currentFormat, "needs_more_data", [
      "Capability matrix validation failed.",
      ...matrixValidation.errors.map(({ message }) => message)
    ], evidenceRefs);
  }
  const matrixWarnings = collectCapabilityMatrixWarnings(matrixDocument);
  if (input.currentFormat === "unknown" || input.targetUsageContext === "unknown") {
    return unresolved(input.currentFormat, "unknown", [
      "Current format and target usage context are required before evaluating candidates."
    ], evidenceRefs);
  }
  if (input.targetUsageContext !== "avatar_frame") {
    return unresolved(input.currentFormat, "needs_more_data", [
      `No calibrated MVP recommendation policy exists for ${input.targetUsageContext}.`
    ], evidenceRefs);
  }
  if (input.auditSummary.uncertainty === "insufficient_evidence") {
    return unresolved(input.currentFormat, "needs_more_data", [
      "Motion Asset Audit evidence is insufficient for candidate evaluation."
    ], evidenceRefs);
  }

  const sequenceHeavy = input.sequenceResidencyDiagnostics.sequenceGroupCount > 0
    && input.sequenceResidencyDiagnostics.totalSequenceFrameEstimatedDecodedBytes !== null;
  const rationale = [
    "Candidates are capability constraints only; this MVP does not select a best format.",
    ...matrixWarnings
      .filter(({ code }) => code === "stale_capability_evidence")
      .map(({ message }) => `Capability matrix warning: ${message}`),
    ...(sequenceHeavy
      ? ["Sequence resources are present, so frame-sequence capability and residency tradeoffs require review."]
      : [])
  ];
  const candidates = recommendationFormats().map((format) =>
    evaluateCandidate(
      format,
      matrixDocument.formats,
      matrixWarnings,
      input.requirements,
      sequenceHeavy,
      evidenceRefs
    )
  );

  return {
    currentFormat: input.currentFormat,
    candidateFormats: candidates,
    recommendationStatus: "advisory",
    rationale,
    tradeoffs: [],
    evidenceRefs,
    uncertainty: input.auditSummary.uncertainty === "low" ? "medium" : "high"
  };
}

function evaluateCandidate(
  format: Exclude<RecommendationFormat, "unknown">,
  matrix: FormatCapabilityMatrix,
  matrixWarnings: readonly { code: string; path: string; message: string }[],
  requirements: FormatRecommendationRequirements | undefined,
  sequenceHeavy: boolean,
  evidenceRefs: readonly string[]
): FormatRecommendationCandidate {
  const capabilityProfile = matrix[format];
  const relevantWarnings = matrixWarnings.filter(({ path }) => path.startsWith(`formats.${format}`));
  const constraints = [
    requirement("alpha", requirements?.requiresAlpha, capabilityProfile.supportsAlpha),
    requirement("replaceable image", requirements?.requiresReplaceableImage, capabilityProfile.supportsReplaceableImage),
    requirement("replaceable text", requirements?.requiresReplaceableText, capabilityProfile.supportsReplaceableText)
  ].filter((value): value is NonNullable<typeof value> => value !== undefined);
  const status: RecommendationCandidateStatus = constraints.some(({ support }) => support === false)
    ? "constraint_mismatch"
    : constraints.some(({ support }) => support === "unknown")
      ? "needs_more_data"
      : implementationStatus(capabilityProfile) === "supported"
        && capabilityProfile.productionSupport === "supported"
        ? "capability_match"
        : "needs_more_data";
  const currentImplementationStatus = implementationStatus(capabilityProfile);
  const tradeoffs: FormatRecommendationTradeoff[] = [
    ...capabilityProfile.typicalStrengths.map((message) => ({ kind: "strength" as const, message })),
    ...capabilityProfile.typicalRisks.map((message) => ({ kind: "risk" as const, message })),
    ...constraints.map(({ name, support }) => ({
      kind: "constraint" as const,
      message: support === true
        ? `Supports required ${name}.`
        : support === false
          ? `Does not support required ${name}.`
          : `Support for required ${name} is not established.`
    }))
  ];

  return {
    format,
    status,
    implementationStatus: currentImplementationStatus,
    implementationMaturity: capabilityProfile.implementationMaturity,
    productionSupport: capabilityProfile.productionSupport,
    rationale: [
      `Format capability evidence is ${capabilityProfile.evidence[0]?.confidence ?? "unknown"} confidence.`,
      ...(currentImplementationStatus === "supported"
        ? ["Auto SVGA has a bounded current implementation baseline for this format."]
        : [
            "Format capability may be known, but the required Auto SVGA implementation is not available.",
            "This candidate is not a production recommendation."
          ]),
      ...relevantWarnings.map(({ message }) => `Capability matrix warning: ${message}`),
      ...(sequenceHeavy && capabilityProfile.supportsFrameSequence === true
        ? ["Frame-sequence capability is relevant to the observed sequence evidence."]
        : [])
    ],
    tradeoffs,
    evidenceRefs,
    uncertainty: status === "capability_match" && currentImplementationStatus === "supported"
      && capabilityProfile.productionSupport === "supported"
      ? "medium"
      : "high"
  };
}

function implementationStatus(
  capabilityProfile: FormatCapability
): FormatRecommendationCandidate["implementationStatus"] {
  if (capabilityProfile.implementationMaturity.includes("supported")) return "supported";
  if (capabilityProfile.implementationMaturity.includes("experimental")) return "experimental";
  return "not_available";
}

function requirement(
  name: string,
  required: boolean | undefined,
  support: CapabilitySupport
): { name: string; support: CapabilitySupport } | undefined {
  return required ? { name, support } : undefined;
}

function unresolved(
  currentFormat: RecommendationFormat,
  recommendationStatus: "needs_more_data" | "unknown",
  rationale: readonly string[],
  evidenceRefs: readonly string[]
): FormatRecommendationReport {
  return {
    currentFormat,
    candidateFormats: [],
    recommendationStatus,
    rationale,
    tradeoffs: [],
    evidenceRefs,
    uncertainty: "high"
  };
}

function baseEvidenceRefs(input: FormatRecommendationInput): string[] {
  return [
    `asset:format:${input.currentFormat}`,
    `usage:${input.targetUsageContext}`,
    `spec:${input.specReport.specId}`,
    `audit:status:${input.auditSummary.auditStatus}`,
    ...(input.profileMetadata.profile ? [`profile:${input.profileMetadata.profile.id}`] : []),
    ...input.auditSummary.evidenceRefs
  ];
}

function recommendationFormats(): readonly Exclude<RecommendationFormat, "unknown">[] {
  return ["svga", "vap", "lottie", "webp", "webm", "apng", "sprite"];
}

function capability(
  format: RecommendationFormat,
  supportsAlpha: CapabilitySupport,
  supportsReplaceableImage: CapabilitySupport,
  supportsReplaceableText: CapabilitySupport,
  supportsVector: CapabilitySupport,
  supportsVideoLikePlayback: CapabilitySupport,
  supportsFrameSequence: CapabilitySupport,
  typicalStrengths: readonly string[],
  typicalRisks: readonly string[]
): FormatCapability {
  return {
    format,
    supportsAlpha,
    supportsReplaceableImage,
    supportsReplaceableText,
    supportsVector,
    supportsVideoLikePlayback,
    supportsFrameSequence,
    typicalStrengths,
    typicalRisks,
    evidence: CAPABILITY_EVIDENCE[format],
    implementationMaturity: IMPLEMENTATION_MATURITY[format],
    productionSupport: format === "svga" ? "supported" : "not_supported"
  };
}

function needsVerification(evidenceSource: string): FormatCapabilityEvidence {
  return {
    evidenceSource,
    evidenceType: "needs_verification",
    confidence: "low",
    lastReviewedAt: "2026-06-19",
    reviewEpoch: 1,
    notes: "Format characteristics are an architecture baseline, not implementation evidence."
  };
}

function notImplementedMaturity(): readonly FormatImplementationMaturity[] {
  return [
    "capability_known",
    "parser_not_implemented",
    "player_not_implemented",
    "exporter_not_implemented",
    "converter_not_implemented",
    "production_not_supported"
  ];
}
