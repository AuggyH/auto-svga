import type {
  FormatAdapter,
  FormatProbeResult,
  MotionAssetInfo,
  MotionAssetSource,
  MotionDimensions,
  MotionLayerInfo,
  MotionResourceInfo,
  WorkbenchIssue,
  WorkbenchOperationContext,
  WorkbenchResult
} from "./contracts.js";
import {
  redactLocalPathsFromError,
  redactLocalPathsInValue
} from "./local-path-redaction.js";
import {
  MOTION_FORMAT_PROBE_MAX_BYTES,
  MULTIFORMAT_PREVIEW_WP1_GATE,
  MotionFormatProbeService,
  createMultiFormatPreviewWp1Registry,
  type MotionFormatProbeSource
} from "./motion-format-registry.js";

export const VAP_INSPECTION_READINESS_GATE = "0.2-hidden-vap-inspection-readiness" as const;
export const VAP_COMPATIBILITY_MAX_DIMENSION = 1504;

export type VapInspectionIssueCode =
  | "unsupported"
  | "parse_precondition"
  | "missing_resource"
  | "unsupported_feature"
  | "capability"
  | "ambiguous";

export interface VapInspectionIssue extends WorkbenchIssue {
  code: VapInspectionIssueCode;
}

export interface VapInspectionSource extends MotionAssetSource {
  readRange?(offset: number, length: number): Promise<Uint8Array>;
}

export interface VapInspectionOptions {
  gate: string;
  context?: WorkbenchOperationContext;
  providedFusionTags?: readonly string[];
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

interface Mp4Box {
  type: string;
  path: string;
  start: number;
  size: number;
  headerSize: number;
  payloadStart: number;
  payloadEnd: number;
}

interface Mp4ParseResult {
  boxes: Mp4Box[];
  malformedReason?: string;
  malformedBoxPath?: string;
  truncatedAfterVapc?: {
    boxPath: string;
    boxType: string;
  };
}

interface Mp4Facts {
  ftyp?: {
    majorBrand: string;
    minorVersion: number;
    compatibleBrands: readonly string[];
  };
  topLevelBoxes: readonly string[];
  handlerTypes: readonly string[];
  sampleEntries: readonly string[];
  videoCodec?: string;
  audioPresent: boolean;
  videoPresent: boolean;
  durationMs?: number;
  trackDimensions?: MotionDimensions;
}

interface VapConfigDocument {
  info: Record<string, unknown>;
  src?: unknown;
  frame?: unknown;
}

interface FusionPlacement {
  frameIndex?: number;
  z?: number;
  frame?: unknown;
  maskFrame?: unknown;
  maskTransform?: unknown;
}

interface NormalizedFusion {
  resources: MotionResourceInfo[];
  layers: MotionLayerInfo[];
  issues: VapInspectionIssue[];
  imageSourceCount: number;
  textSourceCount: number;
  unknownSourceCount: number;
  placementCount: number;
  missingReplacementCount: number;
}

export class VapFormatAdapter implements FormatAdapter {
  readonly format = "vap" as const;

  constructor(
    private readonly inspection = new VapInspectionService(),
    private readonly probeService = new MotionFormatProbeService(createMultiFormatPreviewWp1Registry())
  ) {}

  probe(
    source: MotionFormatProbeSource,
    context?: WorkbenchOperationContext
  ): Promise<FormatProbeResult> {
    return this.probeService.probe(source, {
      gate: MULTIFORMAT_PREVIEW_WP1_GATE,
      context
    });
  }

  parse(
    source: MotionAssetSource,
    context?: WorkbenchOperationContext
  ): Promise<WorkbenchResult<MotionAssetInfo>> {
    return this.inspection.inspect(source as VapInspectionSource, {
      gate: VAP_INSPECTION_READINESS_GATE,
      context
    });
  }
}

export class VapInspectionService {
  async inspect(
    source: VapInspectionSource,
    options: VapInspectionOptions
  ): Promise<WorkbenchResult<MotionAssetInfo>> {
    const feedback = sourceFeedback(source);
    if (options.gate !== VAP_INSPECTION_READINESS_GATE) {
      return {
        issues: [issue(
          feedback,
          "unsupported",
          "VAP inspection is unavailable outside the authorized hidden 0.2 readiness gate.",
          { reason: "gate_required" }
        )]
      };
    }

    options.context?.cancellation?.throwIfCancelled();
    const sample = await readBoundedSample(source, feedback, options.context);
    options.context?.cancellation?.throwIfCancelled();
    if (!sample.bytes) {
      return {
        issues: [issue(
          feedback,
          "parse_precondition",
          `A bounded VAP/MP4 sample could not inspect ${feedback.sourceName}.`,
          sampleIssueDetails(sample)
        )]
      };
    }

    const mp4 = parseMp4(sample.bytes);
    if (mp4.malformedReason) {
      return {
        issues: [issue(
          feedback,
          "parse_precondition",
          "VAP inspection requires well-formed bounded MP4 boxes.",
          {
            reason: "valid_mp4_boxes_required",
            malformedReason: mp4.malformedReason,
            path: mp4.malformedBoxPath
          }
        )]
      };
    }

    const facts = collectMp4Facts(mp4, sample.bytes);
    if (!facts.ftyp) {
      return {
        issues: [issue(
          feedback,
          "parse_precondition",
          "VAP inspection requires an MP4 ftyp box.",
          { reason: "mp4_ftyp_required" }
        )]
      };
    }

    const vapcBoxes = mp4.boxes.filter(({ type }) => type === "vapc");
    if (vapcBoxes.length === 0) {
      return {
        issues: [issue(
          feedback,
          "parse_precondition",
          sample.truncated
            ? "A bounded MP4 sample did not include an embedded vapc box."
            : "Ordinary MP4 input is not a VAP package without embedded vapc metadata.",
          { reason: sample.truncated ? "vapc_not_found_in_bounded_sample" : "embedded_vapc_box_required" }
        )]
      };
    }
    if (vapcBoxes.length > 1) {
      return {
        issues: [issue(
          feedback,
          "ambiguous",
          "VAP inspection requires exactly one embedded vapc box.",
          { reason: "ambiguous_vapc_box", count: vapcBoxes.length }
        )]
      };
    }

    const vapcBox = vapcBoxes[0];
    const vapcPayload = sample.bytes.slice(vapcBox.payloadStart, vapcBox.payloadEnd);
    if (vapcPayload.byteLength === 0) {
      return {
        issues: [issue(
          feedback,
          "parse_precondition",
          "The embedded vapc box must contain JSON configuration bytes.",
          { reason: "vapc_payload_required", vapcPath: vapcBox.path }
        )]
      };
    }

    const vapc = parseVapcJson(vapcPayload, feedback, vapcBox.path);
    if (!vapc.value) return { issues: vapc.issues };

    const info = vapc.value.info;
    const displayDimensions = dimensionsFromInfo(info, "w", "h");
    const videoDimensions = dimensionsFromInfo(info, "videoW", "videoH") ?? facts.trackDimensions;
    const frameCount = positiveNumber(info.f) ? info.f : undefined;
    const fps = positiveNumber(info.fps) ? info.fps : undefined;
    const durationMs = frameCount && fps
      ? Math.round((frameCount / fps) * 1000)
      : facts.durationMs;
    const providedTags = new Set((options.providedFusionTags ?? []).map((tag) => tag.trim()).filter(Boolean));
    const fusion = normalizeFusion(vapc.value, providedTags, feedback);
    const fusionErrors = fusion.issues.filter(({ severity }) => severity === "error");
    if (fusionErrors.length > 0) {
      return { issues: [...vapc.issues, ...fusion.issues] };
    }
    const containerIssues = containerReadinessIssues(facts, feedback);
    const containerErrors = containerIssues.filter(({ severity }) => severity === "error");
    if (containerErrors.length > 0) {
      return { issues: [...vapc.issues, ...fusion.issues, ...containerIssues] };
    }
    const issues = [
      ...vapc.issues,
      ...fusion.issues,
      ...containerIssues,
      ...dimensionReadinessIssues(displayDimensions, videoDimensions, feedback)
    ];

    const asset: MotionAssetInfo = {
      format: "vap",
      name: safeSourceName(source.name) || safeSourceName(source.id) || "effect.mp4",
      sizeBytes: Number.isFinite(source.sizeBytes) && source.sizeBytes >= 0
        ? source.sizeBytes
        : sample.bytes.byteLength,
      dimensions: displayDimensions,
      timing: {
        fps,
        frameCount,
        durationMs
      },
      layers: fusion.layers,
      resources: fusion.resources,
      metadata: {
        vap: {
          version: metadataValue(info.v),
          displayDimensions,
          videoDimensions,
          frameCount,
          fps,
          durationMs,
          timingEvidence: frameCount && fps ? "vapc_info" : facts.durationMs ? "mp4_duration" : "insufficient_evidence",
          isVapx: info.isVapx === true,
          alphaFrame: info.aFrame,
          rgbFrame: info.rgbFrame,
          vapc: {
            path: vapcBox.path,
            payloadBytes: vapcPayload.byteLength
          },
          container: {
            ftyp: facts.ftyp,
            topLevelBoxes: facts.topLevelBoxes,
            handlerTypes: facts.handlerTypes,
            sampleEntries: facts.sampleEntries,
            videoCodec: facts.videoCodec,
            audioPresent: facts.audioPresent,
            videoPresent: facts.videoPresent,
            mp4DurationMs: facts.durationMs,
            trackDimensions: facts.trackDimensions,
            boundedSampleTruncated: sample.truncated,
            clippedTrailingMediaData: mp4.truncatedAfterVapc
          },
          fusion: {
            sourceCount: fusion.resources.length,
            imageSourceCount: fusion.imageSourceCount,
            textSourceCount: fusion.textSourceCount,
            unknownSourceCount: fusion.unknownSourceCount,
            placementCount: fusion.placementCount,
            missingReplacementCount: fusion.missingReplacementCount
          },
          playbackReadiness: {
            dependencyApproved: false,
            runtimeIntegrated: false,
            reason: "VAP playback runtime is pending Product Owner dependency approval."
          }
        }
      }
    };

    return { value: asset, issues };
  }
}

async function readBoundedSample(
  source: VapInspectionSource,
  feedback: SourceFeedback,
  context?: WorkbenchOperationContext
): Promise<BoundedSample> {
  try {
    context?.onProgress?.({ phase: "vap_mp4_read", completed: 0, total: 1 });
    const finiteSize = Number.isFinite(source.sizeBytes) && source.sizeBytes >= 0
      ? source.sizeBytes
      : undefined;
    const bytes = source.readRange
      ? await source.readRange(0, MOTION_FORMAT_PROBE_MAX_BYTES)
      : finiteSize === undefined || finiteSize > MOTION_FORMAT_PROBE_MAX_BYTES
        ? undefined
        : await source.read();
    if (!bytes) return { truncated: true, issueReason: "bounded_read_required" };
    const boundedBytes = bytes.slice(0, MOTION_FORMAT_PROBE_MAX_BYTES);
    context?.onProgress?.({ phase: "vap_mp4_read", completed: 1, total: 1 });
    return {
      bytes: boundedBytes,
      truncated: (finiteSize !== undefined && finiteSize > MOTION_FORMAT_PROBE_MAX_BYTES)
        || bytes.byteLength > MOTION_FORMAT_PROBE_MAX_BYTES
        || bytes.byteLength === MOTION_FORMAT_PROBE_MAX_BYTES
    };
  } catch (error) {
    return {
      truncated: false,
      issueReason: "read_failed",
      issueCause: redactLocalPathsFromError(error, "The source could not be read.", feedback.sensitivePaths)
    };
  }
}

function parseMp4(bytes: Uint8Array): Mp4ParseResult {
  const result: Mp4ParseResult = { boxes: [] };
  parseBoxRange(bytes, 0, bytes.byteLength, "", 0, result);
  return result;
}

function parseBoxRange(
  bytes: Uint8Array,
  start: number,
  end: number,
  parentPath: string,
  depth: number,
  result: Mp4ParseResult
): void {
  if (result.malformedReason) return;
  if (depth > 8) {
    result.malformedReason = "mp4_box_depth_exceeded";
    result.malformedBoxPath = parentPath || "$";
    return;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = start;
  while (offset < end) {
    const remaining = end - offset;
    if (remaining < 8) {
      result.malformedReason = "trailing_bytes";
      result.malformedBoxPath = parentPath || "$";
      return;
    }
    const size32 = view.getUint32(offset);
    const type = ascii(bytes, offset + 4, 4);
    if (!/^[\x20-\x7e]{4}$/u.test(type)) {
      result.malformedReason = "invalid_box_type";
      result.malformedBoxPath = parentPath || "$";
      return;
    }
    let headerSize = 8;
    let size = size32;
    if (size32 === 0) {
      result.malformedReason = "size_zero_box";
      result.malformedBoxPath = boxPath(parentPath, type, result.boxes.length);
      return;
    }
    if (size32 === 1) {
      if (remaining < 16) {
        result.malformedReason = "extended_size_header_truncated";
        result.malformedBoxPath = boxPath(parentPath, type, result.boxes.length);
        return;
      }
      const size64 = view.getBigUint64(offset + 8);
      if (size64 > BigInt(Number.MAX_SAFE_INTEGER)) {
        result.malformedReason = "extended_size_unsafe";
        result.malformedBoxPath = boxPath(parentPath, type, result.boxes.length);
        return;
      }
      size = Number(size64);
      headerSize = 16;
    }
    if (size < headerSize) {
      result.malformedReason = "box_size_underflow";
      result.malformedBoxPath = boxPath(parentPath, type, result.boxes.length);
      return;
    }
    const path = boxPath(parentPath, type, result.boxes.length);
    if (size > remaining) {
      if (canKeepClippedTrailingMediaBox(parentPath, type, result)) {
        result.boxes.push({
          type,
          path,
          start: offset,
          size: remaining,
          headerSize,
          payloadStart: offset + headerSize,
          payloadEnd: end
        });
        result.truncatedAfterVapc = { boxPath: path, boxType: type };
        return;
      }
      result.malformedReason = "box_size_overflow";
      result.malformedBoxPath = path;
      return;
    }

    const box: Mp4Box = {
      type,
      path,
      start: offset,
      size,
      headerSize,
      payloadStart: offset + headerSize,
      payloadEnd: offset + size
    };
    result.boxes.push(box);
    if (MP4_CONTAINER_BOXES.has(type)) {
      parseBoxRange(bytes, box.payloadStart, box.payloadEnd, path, depth + 1, result);
    }
    offset += size;
  }
}

const MP4_CONTAINER_BOXES = new Set(["moov", "trak", "mdia", "minf", "stbl"]);
const MP4_BOUNDED_TRAILING_MEDIA_BOXES = new Set(["mdat"]);

function canKeepClippedTrailingMediaBox(
  parentPath: string,
  type: string,
  result: Mp4ParseResult
): boolean {
  return parentPath === ""
    && MP4_BOUNDED_TRAILING_MEDIA_BOXES.has(type)
    && result.boxes.some(({ type: boxType }) => boxType === "vapc");
}

function boxPath(parentPath: string, type: string, index: number): string {
  return parentPath ? `${parentPath}.${type}[${index}]` : `${type}[${index}]`;
}

function collectMp4Facts(result: Mp4ParseResult, bytes: Uint8Array): Mp4Facts {
  const ftypBox = result.boxes.find(({ type }) => type === "ftyp");
  const handlerTypes = new Set<string>();
  const sampleEntries = new Set<string>();
  const topLevelBoxes = result.boxes
    .filter(({ path }) => !path.includes("."))
    .map(({ type }) => type);
  let durationMs: number | undefined;
  let trackDimensions: MotionDimensions | undefined;

  for (const box of result.boxes) {
    if (box.type === "hdlr") {
      const handler = parseHandler(bytes, box);
      if (handler) handlerTypes.add(handler);
    }
    if (box.type === "stsd") {
      for (const entry of parseSampleEntries(bytes, box)) sampleEntries.add(entry);
    }
    if (box.type === "mvhd" && durationMs === undefined) {
      durationMs = parseDuration(bytes, box);
    }
    if (box.type === "tkhd" && trackDimensions === undefined) {
      trackDimensions = parseTrackDimensions(bytes, box);
    }
  }

  const entries = [...sampleEntries];
  return {
    ftyp: ftypBox ? parseFtyp(bytes, ftypBox) : undefined,
    topLevelBoxes,
    handlerTypes: [...handlerTypes].sort(),
    sampleEntries: entries.sort(),
    videoCodec: entries.find((entry) => VIDEO_SAMPLE_ENTRIES.has(entry)),
    audioPresent: handlerTypes.has("soun") || entries.some((entry) => AUDIO_SAMPLE_ENTRIES.has(entry)),
    videoPresent: handlerTypes.has("vide") || entries.some((entry) => VIDEO_SAMPLE_ENTRIES.has(entry)),
    durationMs,
    trackDimensions
  };
}

const VIDEO_SAMPLE_ENTRIES = new Set(["avc1", "avc3", "hvc1", "hev1", "mp4v"]);
const AUDIO_SAMPLE_ENTRIES = new Set(["mp4a", "enca", "ac-3", "ec-3"]);

function parseFtyp(bytes: Uint8Array, box: Mp4Box): Mp4Facts["ftyp"] | undefined {
  if (box.payloadEnd - box.payloadStart < 8) return undefined;
  const view = viewFor(bytes);
  const compatibleBrands: string[] = [];
  for (let offset = box.payloadStart + 8; offset + 4 <= box.payloadEnd; offset += 4) {
    compatibleBrands.push(ascii(bytes, offset, 4));
  }
  return {
    majorBrand: ascii(bytes, box.payloadStart, 4),
    minorVersion: view.getUint32(box.payloadStart + 4),
    compatibleBrands
  };
}

function parseHandler(bytes: Uint8Array, box: Mp4Box): string | undefined {
  return box.payloadEnd - box.payloadStart >= 12
    ? ascii(bytes, box.payloadStart + 8, 4)
    : undefined;
}

function parseSampleEntries(bytes: Uint8Array, box: Mp4Box): string[] {
  if (box.payloadEnd - box.payloadStart < 8) return [];
  const view = viewFor(bytes);
  const count = view.getUint32(box.payloadStart + 4);
  const entries: string[] = [];
  let offset = box.payloadStart + 8;
  for (let index = 0; index < count && offset + 8 <= box.payloadEnd; index += 1) {
    const size = view.getUint32(offset);
    if (size < 8 || offset + size > box.payloadEnd) break;
    entries.push(ascii(bytes, offset + 4, 4));
    offset += size;
  }
  return entries;
}

function parseDuration(bytes: Uint8Array, box: Mp4Box): number | undefined {
  const view = viewFor(bytes);
  const version = bytes[box.payloadStart];
  if (version === 0 && box.payloadEnd - box.payloadStart >= 20) {
    const timescale = view.getUint32(box.payloadStart + 12);
    const duration = view.getUint32(box.payloadStart + 16);
    return timescale > 0 ? Math.round((duration / timescale) * 1000) : undefined;
  }
  if (version === 1 && box.payloadEnd - box.payloadStart >= 32) {
    const timescale = view.getUint32(box.payloadStart + 20);
    const duration = view.getBigUint64(box.payloadStart + 24);
    return timescale > 0 && duration <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Math.round((Number(duration) / timescale) * 1000)
      : undefined;
  }
  return undefined;
}

function parseTrackDimensions(bytes: Uint8Array, box: Mp4Box): MotionDimensions | undefined {
  if (box.payloadEnd - box.payloadStart < 8) return undefined;
  const view = viewFor(bytes);
  const widthRaw = view.getUint32(box.payloadEnd - 8);
  const heightRaw = view.getUint32(box.payloadEnd - 4);
  const width = widthRaw / 65536;
  const height = heightRaw / 65536;
  return positiveNumber(width) && positiveNumber(height) ? { width, height } : undefined;
}

function parseVapcJson(
  bytes: Uint8Array,
  feedback: SourceFeedback,
  vapcPath: string
): { value?: VapConfigDocument; issues: VapInspectionIssue[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeUtf8(bytes).trim());
  } catch (error) {
    return {
      issues: [issue(
        feedback,
        "parse_precondition",
        "The embedded vapc box must contain valid JSON.",
        {
          reason: "valid_vapc_json_required",
          vapcPath,
          cause: redactLocalPathsFromError(error, "vapc JSON parse failed.", feedback.sensitivePaths)
        }
      )]
    };
  }
  if (!isRecord(parsed) || !isRecord(parsed.info)) {
    return {
      issues: [issue(
        feedback,
        "parse_precondition",
        "The embedded vapc JSON must include an info object.",
        { reason: "vapc_info_required", vapcPath }
      )]
    };
  }
  return {
    value: {
      info: parsed.info,
      src: parsed.src,
      frame: parsed.frame
    },
    issues: []
  };
}

function normalizeFusion(
  config: VapConfigDocument,
  providedTags: Set<string>,
  feedback: SourceFeedback
): NormalizedFusion {
  const sourceRecords = arrayValue(config.src);
  const placements = collectPlacements(config.frame);
  const resources: MotionResourceInfo[] = [];
  const layers: MotionLayerInfo[] = [];
  const issues: VapInspectionIssue[] = [];
  const seen = new Set<string>();
  let imageSourceCount = 0;
  let textSourceCount = 0;
  let unknownSourceCount = 0;
  let missingReplacementCount = 0;

  sourceRecords.forEach((source, index) => {
    if (!isRecord(source)) return;
    const srcId = stringValue(source.srcId) || `src_${index}`;
    if (seen.has(srcId)) {
      issues.push(issue(
        feedback,
        "ambiguous",
        "VAP fusion source ids must be unique for deterministic inspection.",
        { reason: "ambiguous_fusion_source_id", srcId, path: `src.${index}.srcId` }
      ));
      return;
    }
    seen.add(srcId);

    const fusionType = fusionSourceType(source.srcType);
    if (fusionType === "image") imageSourceCount += 1;
    else if (fusionType === "text") textSourceCount += 1;
    else {
      unknownSourceCount += 1;
      issues.push(issue(
        feedback,
        "unsupported_feature",
        "VAP fusion source type is not supported by the readiness inspector.",
        { feature: "unknown_fusion_source_type", srcId, srcType: source.srcType }
      ));
    }

    const srcTag = stringValue(source.srcTag);
    const replacementKnown = srcTag ? providedTags.has(srcTag) : false;
    if (srcTag && !replacementKnown) {
      missingReplacementCount += 1;
      issues.push(issue(
        feedback,
        "missing_resource",
        "VAP fusion playback needs runtime replacement data for this source tag.",
        { reason: "fusion_replacement_required", srcId, srcTag, fusionType }
      ));
    }

    const resourceId = `vap_fusion_${srcId}`;
    const sourcePlacements = placements.get(srcId) ?? [];
    resources.push({
      id: resourceId,
      name: srcTag || srcId,
      kind: fusionType === "image" ? "image" : "unknown",
      role: fusionType === "image" ? "static_image" : "unknown",
      dimensions: dimensionsFromInfo(source, "w", "h"),
      replaceable: fusionType !== "unknown",
      metadata: {
        vapResourceType: "fusion_source",
        srcId,
        srcTag,
        srcType: source.srcType,
        loadType: source.loadType,
        color: source.color,
        style: source.style,
        fitType: source.fitType,
        replacementProvided: replacementKnown
      }
    });
    layers.push({
      id: `vap_layer_${srcId}`,
      name: srcTag || srcId,
      kind: fusionType === "image" ? "vap_fusion_image" : fusionType === "text" ? "vap_fusion_text" : "vap_fusion_unknown",
      resourceIds: [resourceId],
      replaceable: fusionType !== "unknown",
      metadata: {
        vapLayerType: "fusion_source",
        srcId,
        srcTag,
        placementCount: sourcePlacements.length,
        placements: sourcePlacements.slice(0, 5),
        zValues: [...new Set(sourcePlacements.map(({ z }) => z).filter((value): value is number => value !== undefined))].sort((a, b) => a - b)
      }
    });
  });

  for (const srcId of placements.keys()) {
    if (!seen.has(srcId)) {
      issues.push(issue(
        feedback,
        "parse_precondition",
        "VAP frame placement references a missing fusion source.",
        { reason: "missing_fusion_source", srcId }
      ));
    }
  }

  return {
    resources,
    layers,
    issues,
    imageSourceCount,
    textSourceCount,
    unknownSourceCount,
    placementCount: [...placements.values()].reduce((sum, list) => sum + list.length, 0),
    missingReplacementCount
  };
}

function collectPlacements(frameValue: unknown): Map<string, FusionPlacement[]> {
  const placements = new Map<string, FusionPlacement[]>();
  arrayValue(frameValue).forEach((frame, frameIndex) => {
    if (!isRecord(frame)) return;
    arrayValue(frame.obj).forEach((object) => {
      if (!isRecord(object)) return;
      const srcId = stringValue(object.srcId);
      if (!srcId) return;
      const list = placements.get(srcId) ?? [];
      list.push({
        frameIndex: finiteNumber(frame.i) ? frame.i : frameIndex,
        z: finiteNumber(object.z) ? object.z : undefined,
        frame: object.frame,
        maskFrame: object.mFrame,
        maskTransform: object.mt
      });
      placements.set(srcId, list);
    });
  });
  return placements;
}

function containerReadinessIssues(facts: Mp4Facts, feedback: SourceFeedback): VapInspectionIssue[] {
  const issues: VapInspectionIssue[] = [];
  if (!facts.videoPresent) {
    issues.push(issue(
      feedback,
      "parse_precondition",
      "VAP readiness inspection requires video track evidence.",
      { reason: "video_track_required" }
    ));
  }
  if (facts.videoCodec && !["avc1", "avc3"].includes(facts.videoCodec)) {
    issues.push(issue(
      feedback,
      "unsupported_feature",
      "Only H.264 MP4 video is ready for the future hidden Web VAP playback path.",
      { feature: "non_h264_video_codec", codec: facts.videoCodec }
    ));
  }
  return issues;
}

function dimensionReadinessIssues(
  displayDimensions: MotionDimensions | undefined,
  videoDimensions: MotionDimensions | undefined,
  feedback: SourceFeedback
): VapInspectionIssue[] {
  const dimensions = [displayDimensions, videoDimensions].filter((value): value is MotionDimensions => !!value);
  return dimensions
    .filter(({ width, height }) => width > VAP_COMPATIBILITY_MAX_DIMENSION || height > VAP_COMPATIBILITY_MAX_DIMENSION)
    .map((dimensionsValue) => issue(
      feedback,
      "capability",
      "VAP dimensions exceed the documented 1504 compatibility limit.",
      {
        reason: "vap_dimensions_over_1504",
        limit: VAP_COMPATIBILITY_MAX_DIMENSION,
        dimensions: dimensionsValue
      }
    ));
}

function issue(
  feedback: SourceFeedback,
  code: VapInspectionIssueCode,
  message: string,
  details: Readonly<Record<string, unknown>> = {}
): VapInspectionIssue {
  return {
    severity: code === "missing_resource" || code === "unsupported_feature" || code === "capability" ? "warning" : "error",
    code,
    message,
    path: feedback.issuePath,
    details: redactLocalPathsInValue({
      sourceName: feedback.sourceName,
      ...details
    }, feedback.sensitivePaths)
  };
}

function sampleIssueDetails(sample: BoundedSample): Readonly<Record<string, unknown>> {
  return {
    reason: sample.issueReason,
    ...(sample.issueCause ? { cause: sample.issueCause } : {})
  };
}

function sourceFeedback(source: MotionAssetSource): SourceFeedback {
  const sensitivePaths = [source.id, source.name].filter((value) => isPathLike(value));
  const sourceName = safeSourceName(source.name) || safeSourceName(source.id) || "effect.mp4";
  return {
    sourceName,
    issuePath: sensitivePaths.length > 0 ? "[local path]" : undefined,
    sensitivePaths
  };
}

function dimensionsFromInfo(
  record: Record<string, unknown>,
  widthKey: string,
  heightKey: string
): MotionDimensions | undefined {
  const width = record[widthKey];
  const height = record[heightKey];
  return positiveNumber(width) && positiveNumber(height) ? { width, height } : undefined;
}

function fusionSourceType(value: unknown): "image" | "text" | "unknown" {
  if (typeof value === "number") {
    if (value === 1) return "image";
    if (value === 2) return "text";
  }
  const normalized = stringValue(value).toLocaleLowerCase("en-US");
  if (normalized === "image" || normalized === "img") return "image";
  if (normalized === "text" || normalized === "txt") return "text";
  return "unknown";
}

function arrayValue(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function metadataValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  return undefined;
}

function stringValue(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" ? value.trim() : "";
}

function safeSourceName(value: string): string {
  const parts = value.trim().split(/[\\/]+/u).filter(Boolean);
  return (parts.at(-1) ?? "")
    .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function isPathLike(value: string): boolean {
  return /[\\/]/u.test(value) || /^[A-Za-z]:/u.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function positiveNumber(value: unknown): value is number {
  return finiteNumber(value) && value > 0;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function viewFor(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
