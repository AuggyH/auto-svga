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
}

export type FormatCapabilityMatrix = Readonly<Record<RecommendationFormat, FormatCapability>>;

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
  rationale: readonly string[];
  tradeoffs: readonly FormatRecommendationTradeoff[];
  evidenceRefs: readonly string[];
  uncertainty: "low" | "medium" | "high";
}

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

export function createFormatRecommendationReport(
  input: FormatRecommendationInput
): FormatRecommendationReport {
  const evidenceRefs = baseEvidenceRefs(input);
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
    ...(sequenceHeavy
      ? ["Sequence resources are present, so frame-sequence capability and residency tradeoffs require review."]
      : [])
  ];
  const candidates = recommendationFormats().map((format) =>
    evaluateCandidate(format, input.requirements, sequenceHeavy, evidenceRefs)
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
  requirements: FormatRecommendationRequirements | undefined,
  sequenceHeavy: boolean,
  evidenceRefs: readonly string[]
): FormatRecommendationCandidate {
  const capabilityProfile = FORMAT_RECOMMENDATION_CAPABILITY_MATRIX[format];
  const constraints = [
    requirement("alpha", requirements?.requiresAlpha, capabilityProfile.supportsAlpha),
    requirement("replaceable image", requirements?.requiresReplaceableImage, capabilityProfile.supportsReplaceableImage),
    requirement("replaceable text", requirements?.requiresReplaceableText, capabilityProfile.supportsReplaceableText)
  ].filter((value): value is NonNullable<typeof value> => value !== undefined);
  const status: RecommendationCandidateStatus = constraints.some(({ support }) => support === false)
    ? "constraint_mismatch"
    : constraints.some(({ support }) => support === "unknown")
      ? "needs_more_data"
      : "capability_match";
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
    rationale: sequenceHeavy && capabilityProfile.supportsFrameSequence === true
      ? ["Frame-sequence capability is relevant to the observed sequence evidence."]
      : [],
    tradeoffs,
    evidenceRefs,
    uncertainty: status === "capability_match" ? "medium" : "high"
  };
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
    typicalRisks
  };
}
