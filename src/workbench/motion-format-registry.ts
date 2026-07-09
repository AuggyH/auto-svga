import type {
  FormatProbeResult,
  MotionAssetSource,
  MotionFormat,
  WorkbenchIssue,
  WorkbenchOperationContext
} from "./contracts.js";
import {
  redactLocalPathsFromError,
  redactLocalPathsInValue
} from "./local-path-redaction.js";

export const MULTIFORMAT_PREVIEW_WP1_GATE = "0.2-multiformat-preview-wp1" as const;
export const MOTION_FORMAT_PROBE_MAX_BYTES = 262_144;

export type MotionFormatProbeStatus = "detected" | "candidate" | "unsupported" | "ambiguous";
export type MotionFormatProbeIssueCode =
  | "unsupported"
  | "missing_dependency"
  | "parse_precondition"
  | "ambiguous";
export type MotionFormatEvidenceKind =
  | "extension"
  | "media_type"
  | "magic"
  | "header"
  | "json_shape"
  | "mp4_box";

export interface MotionFormatProbeIssue extends WorkbenchIssue {
  code: MotionFormatProbeIssueCode;
}

export interface MotionFormatEvidence {
  format: MotionFormat;
  kind: MotionFormatEvidenceKind;
  confidence: number;
  detail: string;
}

export interface MotionFormatDetectionResult extends Omit<FormatProbeResult, "issues"> {
  status: MotionFormatProbeStatus;
  evidence: readonly MotionFormatEvidence[];
  issues: readonly MotionFormatProbeIssue[];
}

export interface MotionFormatProbeSource extends MotionAssetSource {
  readRange?(offset: number, length: number): Promise<Uint8Array>;
}

export interface MotionFormatProbeOptions {
  gate: string;
  context?: WorkbenchOperationContext;
}

export interface MotionFormatDetectorInput {
  bytes: Uint8Array;
  truncated: boolean;
  hasHint: boolean;
}

export interface MotionFormatDetectorResult {
  detected: boolean;
  evidence: readonly Omit<MotionFormatEvidence, "format">[];
  precondition?: string;
}

export type MotionFormatDetector = (
  input: MotionFormatDetectorInput
) => MotionFormatDetectorResult;

export interface MotionFormatRegistryEntry {
  format: MotionFormat;
  extensions: readonly string[];
  mediaTypes: readonly string[];
  detector?: MotionFormatDetector;
  missingDependency?: string;
}

interface NormalizedRegistryEntry extends MotionFormatRegistryEntry {
  extensions: readonly string[];
  mediaTypes: readonly string[];
}

interface SourceFeedback {
  sourceName: string;
  issuePath?: string;
  sensitivePaths: readonly string[];
}

interface BoundedSample {
  bytes?: Uint8Array;
  truncated: boolean;
  issueReason?: "bounded_read_required" | "read_failed";
  issueCause?: string;
}

interface FormatAssessment {
  entry: NormalizedRegistryEntry;
  evidence: MotionFormatEvidence[];
  detected: boolean;
  precondition?: string;
  missingDependency?: string;
}

export class MotionFormatRegistry {
  readonly entries: readonly NormalizedRegistryEntry[];

  constructor(entries: readonly MotionFormatRegistryEntry[]) {
    const formats = new Set<MotionFormat>();
    this.entries = entries.map((entry) => {
      if (formats.has(entry.format)) {
        throw new Error(`Duplicate motion format registration: ${entry.format}`);
      }
      if (!entry.detector && !entry.missingDependency) {
        throw new Error(`Motion format registration requires a detector or missing dependency: ${entry.format}`);
      }
      formats.add(entry.format);
      return {
        ...entry,
        extensions: entry.extensions.map(normalizeExtension),
        mediaTypes: entry.mediaTypes.map(normalizeMediaType)
      };
    });
  }
}

export class MotionFormatProbeService {
  constructor(private readonly registry: MotionFormatRegistry) {}

  async probe(
    source: MotionFormatProbeSource,
    options: MotionFormatProbeOptions
  ): Promise<MotionFormatDetectionResult> {
    const feedback = sourceFeedback(source);
    if (options.gate !== MULTIFORMAT_PREVIEW_WP1_GATE) {
      return resultWithIssue("unsupported", undefined, [], issue(
        feedback,
        "unsupported",
        "Multi-format probing is unavailable outside the authorized 0.2 gate.",
        { reason: "gate_required" }
      ));
    }

    options.context?.cancellation?.throwIfCancelled();
    const extension = sourceExtension(source.name);
    const mediaType = normalizeMediaType(source.mediaType ?? "");
    const sample = await readBoundedSample(source, feedback, options.context);
    options.context?.cancellation?.throwIfCancelled();

    const assessments = this.registry.entries
      .map((entry) => assess(entry, extension, mediaType, sample))
      .filter((assessment) => assessment.evidence.length > 0);

    if (assessments.length > 1) {
      const candidateFormats = assessments.map(({ entry }) => entry.format).sort();
      return resultWithIssue("ambiguous", undefined, flattenEvidence(assessments), issue(
        feedback,
        "ambiguous",
        `Conflicting evidence identifies multiple motion formats for ${feedback.sourceName}.`,
        { candidateFormats }
      ));
    }

    const assessment = assessments[0];
    if (!assessment) {
      const code: MotionFormatProbeIssueCode = sample.issueReason ? "parse_precondition" : "unsupported";
      return resultWithIssue("unsupported", undefined, [], issue(
        feedback,
        code,
        sample.issueReason
          ? `A bounded format probe could not inspect ${feedback.sourceName}.`
          : `${feedback.sourceName} does not match a registered WP1 motion format.`,
        sampleIssueDetails(sample)
      ));
    }

    if (assessment.missingDependency) {
      return resultWithIssue("candidate", assessment.entry.format, assessment.evidence, issue(
        feedback,
        "missing_dependency",
        `The ${assessment.entry.format} candidate cannot be probed because its approved probe dependency is unavailable.`,
        { dependency: assessment.missingDependency }
      ));
    }

    if (sample.issueReason) {
      return resultWithIssue("candidate", assessment.entry.format, assessment.evidence, issue(
        feedback,
        "parse_precondition",
        `The ${assessment.entry.format} candidate needs a bounded readable sample before detection can complete.`,
        sampleIssueDetails(sample)
      ));
    }

    if (assessment.detected) {
      return {
        status: "detected",
        format: assessment.entry.format,
        confidence: confidence(assessment.evidence),
        evidence: assessment.evidence,
        issues: []
      };
    }

    return resultWithIssue("candidate", assessment.entry.format, assessment.evidence, issue(
      feedback,
      "parse_precondition",
      `Evidence for ${assessment.entry.format} is incomplete and remains a candidate only.`,
      { reason: assessment.precondition ?? "conclusive_evidence_required" }
    ));
  }
}

export function createMultiFormatPreviewWp1Registry(): MotionFormatRegistry {
  return new MotionFormatRegistry([
    {
      format: "svga",
      extensions: [".svga"],
      mediaTypes: ["application/x-svga", "application/vnd.svga"],
      detector: detectSvga
    },
    {
      format: "lottie",
      extensions: [".json"],
      mediaTypes: ["application/json", "application/lottie+json", "application/vnd.lottie+json"],
      detector: detectLottie
    },
    {
      format: "vap",
      extensions: [".mp4", ".vap"],
      mediaTypes: ["video/mp4", "video/vap", "application/vnd.vap"],
      detector: detectVap
    }
  ]);
}

function assess(
  entry: NormalizedRegistryEntry,
  extension: string,
  mediaType: string,
  sample: BoundedSample
): FormatAssessment {
  const evidence: MotionFormatEvidence[] = [];
  if (entry.extensions.includes(extension)) {
    evidence.push({ format: entry.format, kind: "extension", confidence: 0.25, detail: extension });
  }
  if (entry.mediaTypes.includes(mediaType)) {
    evidence.push({ format: entry.format, kind: "media_type", confidence: 0.35, detail: mediaType });
  }

  if (!entry.detector) {
    return {
      entry,
      evidence,
      detected: false,
      missingDependency: evidence.length > 0 ? entry.missingDependency : undefined
    };
  }
  if (!sample.bytes) {
    return { entry, evidence, detected: false };
  }

  const detectorResult = entry.detector({
    bytes: sample.bytes,
    truncated: sample.truncated,
    hasHint: evidence.length > 0
  });
  evidence.push(...detectorResult.evidence.map((entryEvidence) => ({
    ...entryEvidence,
    format: entry.format
  })));
  return {
    entry,
    evidence,
    detected: detectorResult.detected,
    precondition: detectorResult.precondition
  };
}

async function readBoundedSample(
  source: MotionFormatProbeSource,
  feedback: SourceFeedback,
  context?: WorkbenchOperationContext
): Promise<BoundedSample> {
  try {
    context?.onProgress?.({ phase: "format_probe_read", completed: 0, total: 1 });
    if (source.sizeBytes > MOTION_FORMAT_PROBE_MAX_BYTES && !source.readRange) {
      return { truncated: true, issueReason: "bounded_read_required" };
    }
    const bytes = source.sizeBytes > MOTION_FORMAT_PROBE_MAX_BYTES
      ? await source.readRange!(0, MOTION_FORMAT_PROBE_MAX_BYTES)
      : await source.read();
    context?.onProgress?.({ phase: "format_probe_read", completed: 1, total: 1 });
    return {
      bytes: bytes.slice(0, MOTION_FORMAT_PROBE_MAX_BYTES),
      truncated: source.sizeBytes > MOTION_FORMAT_PROBE_MAX_BYTES
        || bytes.byteLength > MOTION_FORMAT_PROBE_MAX_BYTES
    };
  } catch (error) {
    return {
      truncated: false,
      issueReason: "read_failed",
      issueCause: redactLocalPathsFromError(
        error,
        "The source could not be read.",
        feedback.sensitivePaths
      )
    };
  }
}

function detectSvga({ bytes, hasHint }: MotionFormatDetectorInput): MotionFormatDetectorResult {
  const hasZlibHeader = isZlibHeader(bytes);
  return {
    detected: hasZlibHeader && hasHint,
    evidence: hasZlibHeader
      ? [{ kind: "header", confidence: 0.6, detail: "zlib" }]
      : [],
    precondition: hasZlibHeader
      ? "svga_hint_required"
      : "svga_zlib_header_required"
  };
}

function detectLottie({ bytes, truncated }: MotionFormatDetectorInput): MotionFormatDetectorResult {
  const text = decodeUtf8(bytes).trimStart();
  if (!text.startsWith("{")) {
    return { detected: false, evidence: [], precondition: "json_object_required" };
  }
  const evidence: Array<Omit<MotionFormatEvidence, "format">> = [{
    kind: "header",
    confidence: 0.15,
    detail: "json_object"
  }];
  if (truncated) {
    return { detected: false, evidence, precondition: "complete_bounded_json_required" };
  }

  try {
    const value = JSON.parse(text) as unknown;
    if (!isLottieJsonShape(value)) {
      return { detected: false, evidence, precondition: "lottie_json_shape_required" };
    }
    evidence.push({ kind: "json_shape", confidence: 0.95, detail: "lottie_minimum_fields" });
    return { detected: true, evidence };
  } catch {
    return { detected: false, evidence, precondition: "valid_json_required" };
  }
}

function detectVap({ bytes, truncated }: MotionFormatDetectorInput): MotionFormatDetectorResult {
  const inspection = inspectMp4Boxes(bytes);
  const evidence: Array<Omit<MotionFormatEvidence, "format">> = [];
  if (inspection.ftyp) {
    evidence.push({ kind: "magic", confidence: 0.6, detail: "mp4_ftyp" });
  }
  if (inspection.vapc) {
    evidence.push({ kind: "mp4_box", confidence: 1, detail: "vapc" });
  }
  return {
    detected: inspection.ftyp && inspection.vapc && !inspection.malformed,
    evidence,
    precondition: inspection.malformed
      ? "valid_mp4_boxes_required"
      : truncated
        ? "vapc_not_found_in_bounded_sample"
        : "embedded_vapc_box_required"
  };
}

function inspectMp4Boxes(bytes: Uint8Array): {
  ftyp: boolean;
  vapc: boolean;
  malformed: boolean;
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let ftyp = false;
  let vapc = false;
  let malformed = false;

  while (offset < bytes.byteLength) {
    if (bytes.byteLength - offset < 8) {
      malformed = true;
      break;
    }
    const size32 = view.getUint32(offset);
    const type = ascii(bytes, offset + 4, 4);
    let headerSize = 8;
    let size = size32;
    if (size32 === 1) {
      if (bytes.byteLength - offset < 16) {
        malformed = true;
        break;
      }
      const high = view.getUint32(offset + 8);
      const low = view.getUint32(offset + 12);
      const extendedSize = high * 0x1_0000_0000 + low;
      if (!Number.isSafeInteger(extendedSize)) {
        malformed = true;
        break;
      }
      size = extendedSize;
      headerSize = 16;
    } else if (size32 === 0) {
      size = bytes.byteLength - offset;
    }
    if (size < headerSize || size > bytes.byteLength - offset) {
      malformed = true;
      break;
    }
    if (offset === 0 && type === "ftyp") ftyp = true;
    if (type === "vapc") vapc = true;
    offset += size;
  }

  return { ftyp, vapc, malformed };
}

function isLottieJsonShape(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.v === "string" && record.v.trim().length > 0
    && positiveNumber(record.fr)
    && finiteNumber(record.ip)
    && finiteNumber(record.op) && record.op > record.ip
    && positiveNumber(record.w)
    && positiveNumber(record.h)
    && Array.isArray(record.layers);
}

function isZlibHeader(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 2) return false;
  const cmf = bytes[0];
  const flg = bytes[1];
  return (cmf & 0x0f) === 8 && ((cmf << 8) + flg) % 31 === 0;
}

function resultWithIssue(
  status: MotionFormatProbeStatus,
  format: MotionFormat | undefined,
  evidence: readonly MotionFormatEvidence[],
  resultIssue: MotionFormatProbeIssue
): MotionFormatDetectionResult {
  return {
    status,
    format,
    confidence: confidence(evidence),
    evidence,
    issues: [resultIssue]
  };
}

function issue(
  feedback: SourceFeedback,
  code: MotionFormatProbeIssueCode,
  message: string,
  details: Readonly<Record<string, unknown>> = {}
): MotionFormatProbeIssue {
  return {
    severity: code === "unsupported" ? "warning" : "error",
    code,
    message,
    path: feedback.issuePath,
    details: redactLocalPathsInValue({
      sourceName: feedback.sourceName,
      ...details
    }, feedback.sensitivePaths)
  };
}

function sourceFeedback(source: MotionAssetSource): SourceFeedback {
  const sensitivePaths = [source.id, source.name].filter((value) => isPathLike(value));
  const sourceName = safeSourceName(source.name) || safeSourceName(source.id) || "local file";
  return {
    sourceName,
    issuePath: sensitivePaths.length > 0 ? "[local path]" : undefined,
    sensitivePaths
  };
}

function sampleIssueDetails(sample: BoundedSample): Readonly<Record<string, unknown>> {
  return {
    reason: sample.issueReason,
    ...(sample.issueCause ? { cause: sample.issueCause } : {})
  };
}

function safeSourceName(value: string): string {
  const parts = value.trim().split(/[\\/]+/).filter(Boolean);
  return (parts.at(-1) ?? "")
    .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceExtension(value: string): string {
  const name = safeSourceName(value).toLocaleLowerCase("en-US");
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot) : "";
}

function normalizeExtension(value: string): string {
  const normalized = value.trim().toLocaleLowerCase("en-US");
  if (!normalized) return "";
  return normalized.startsWith(".") ? normalized : `.${normalized}`;
}

function normalizeMediaType(value: string): string {
  return value.split(";", 1)[0].trim().toLocaleLowerCase("en-US");
}

function isPathLike(value: string): boolean {
  return /[\\/]/.test(value) || /^[A-Za-z]:/.test(value);
}

function confidence(evidence: readonly MotionFormatEvidence[]): number {
  return Math.min(1, evidence.reduce((sum, item) => sum + item.confidence, 0));
}

function flattenEvidence(assessments: readonly FormatAssessment[]): MotionFormatEvidence[] {
  return assessments.flatMap(({ evidence }) => evidence);
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/^\uFEFF/, "");
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function positiveNumber(value: unknown): value is number {
  return finiteNumber(value) && value > 0;
}
