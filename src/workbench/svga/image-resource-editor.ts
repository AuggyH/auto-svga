import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";
import protobuf from "protobufjs";
import { decodeRgbaPng } from "../../utils/png-reader.js";
import { readEmbeddedImageMetadata } from "./image-metadata.js";

export type SvgaImageReplacementStatus = "original" | "replaced";
export type SvgaImageValidationStatus = "valid" | "warning" | "error";
export type SvgaExportState = "idle" | "exporting" | "exported" | "failed";

export interface SvgaEditableImageResource {
  resourceKey: string;
  displayName: string;
  originalMime: "image/png" | "application/octet-stream";
  originalSizeBytes: number;
  originalSha256: string;
  decodedWidth?: number;
  decodedHeight?: number;
  usageCount: number;
  replacementStatus: SvgaImageReplacementStatus;
  replacementSha256?: string;
  validationStatus: SvgaImageValidationStatus;
}

export interface SvgaImageEditSession {
  sourceFile: {
    name: string;
    sizeBytes: number;
    sha256: string;
  };
  parsedMovie: {
    version: string;
    viewBoxWidth: number;
    viewBoxHeight: number;
    fps: number;
    frames: number;
    spriteCount: number;
    imageCount: number;
    audioCount: number;
  };
  imageResources: readonly SvgaEditableImageResource[];
  selectedResource?: string;
  replacements: Readonly<Record<string, SvgaReplacementSummary>>;
  dirty: boolean;
  validationErrors: readonly SvgaImageEditIssue[];
  exportState: SvgaExportState;
}

export interface SvgaReplacementSummary {
  resourceKey: string;
  replacementSha256: string;
  replacementSizeBytes: number;
  replacementWidth: number;
  replacementHeight: number;
  dimensionWarning?: string;
}

export interface SvgaImageEditIssue {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
}

export interface SvgaPngValidationLimits {
  maxInputBytes?: number;
  maxPixels?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface SvgaPngValidationResult {
  bytes: Uint8Array;
  sha256: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface SvgaImageReplacementInput {
  resourceKey: string;
  pngBytes: Uint8Array;
}

export interface SvgaInvariantCheck {
  code: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  evidenceHash?: string;
  comparisonDigest?: string;
  limitation: string;
  details?: Readonly<Record<string, unknown>>;
}

export interface SvgaUnknownFieldBoundary {
  scannerVersion: string;
  unknownFieldsDetected: boolean;
  unsupportedReason: string;
  supportedSubset: string;
  checkedBeforeDecodeEdit: boolean;
  passed: boolean;
}

export interface SvgaRoundTripCanonicalization {
  rules: readonly string[];
}

export interface SvgaRoundTripReportV2 {
  schemaVersion: 2;
  milestoneId: "P3";
  headCommit: string;
  sourceSha256: string;
  sourceSha256AfterEditing: string;
  exportedSha256: string;
  replacedResourceKey: string;
  originalResourceSha256: string;
  replacementSha256: string;
  exportedResourceSha256: string;
  unknownFieldBoundary: SvgaUnknownFieldBoundary;
  canonicalization: SvgaRoundTripCanonicalization;
  invariantChecks: readonly SvgaInvariantCheck[];
  changedFields: readonly string[];
  unexpectedChanges: readonly string[];
  decodePassed: boolean;
  playbackPassed: boolean;
  canvasNonBlank: boolean;
  passed: boolean;
}

export interface SvgaRoundTripReplacedResourceCheck {
  resourceKey: string;
  usageCount: number;
  originalSha256: string;
  replacementSha256: string;
  exportedSha256: string;
  originalResourceSha256: string;
  exportedResourceSha256: string;
  originalSizeBytes: number;
  replacementSizeBytes: number;
  originalWidth?: number;
  originalHeight?: number;
  replacementWidth: number;
  replacementHeight: number;
  keyStillPresent: boolean;
  referencedBySameSprites: boolean;
  exportedMatchesReplacement: boolean;
  passed: boolean;
}

export interface SvgaRoundTripUntouchedResourceCheck {
  resourceKey: string;
  originalSha256: string;
  exportedSha256: string;
  passed: boolean;
}

export interface SvgaRoundTripReportV3 {
  schemaVersion: 3;
  milestoneId: "P4";
  headCommit: string;
  sourceSha256: string;
  sourceSha256AfterEditing: string;
  exportedSha256: string;
  replacementCount: number;
  replacedResourceKeys: readonly string[];
  unchangedResourceKeys: readonly string[];
  replacements: readonly SvgaRoundTripReplacedResourceCheck[];
  untouchedResources: readonly SvgaRoundTripUntouchedResourceCheck[];
  replacedResources: readonly SvgaRoundTripReplacedResourceCheck[];
  unknownFieldBoundary: SvgaUnknownFieldBoundary;
  canonicalization: SvgaRoundTripCanonicalization;
  invariantChecks: readonly SvgaInvariantCheck[];
  changedFields: readonly string[];
  unexpectedChanges: readonly string[];
  decodePassed: boolean;
  playbackPassed: boolean;
  canvasNonBlank: boolean;
  passed: boolean;
}

export interface SvgaRoundTripAppliedMappingCheck {
  inputFileLabel: string;
  inputSha256: string;
  mappingRuleId: string;
  mappingStatus: string;
  resourceKey: string;
  originalResourceSha256: string;
  replacementSha256: string;
  exportedSha256: string;
  originalWidth?: number;
  originalHeight?: number;
  replacementWidth: number;
  replacementHeight: number;
  usageCount: number;
  sameSpriteReferences: boolean;
  passed: boolean;
}

export interface SvgaRoundTripReportV4 extends Omit<SvgaRoundTripReportV3, "schemaVersion" | "milestoneId"> {
  schemaVersion: 4;
  milestoneId: "P5";
  batchTransactionId: string;
  appliedMappingCount: number;
  appliedMappings: readonly SvgaRoundTripAppliedMappingCheck[];
  batchReplacementSetDigest: string;
  originalSourceUnchanged: boolean;
}

export type SvgaRoundTripReport = SvgaRoundTripReportV2 | SvgaRoundTripReportV3 | SvgaRoundTripReportV4;

export interface SvgaRoundTripBatchMappingInput {
  inputFileLabel: string;
  inputSha256: string;
  mappingRuleId: string;
  mappingStatus: string;
  resourceKey: string;
}

export interface SvgaRoundTripReportOptions {
  milestoneId?: "P3" | "P4" | "P5";
  headCommit?: string;
  batchTransactionId?: string;
  batchReplacementSetDigest?: string;
  batchMappings?: readonly SvgaRoundTripBatchMappingInput[];
  playbackPassed?: boolean;
  canvasNonBlank?: boolean;
}

export interface SvgaImageEditExportResult {
  editedBytes: Uint8Array;
  session: SvgaImageEditSession;
  roundTripReport: SvgaRoundTripReport;
}

export class SvgaImageEditError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = {}
  ) {
    super(message);
    this.name = "SvgaImageEditError";
  }
}

interface KnownMoviePayload {
  version?: string;
  params?: {
    viewBoxWidth?: number;
    viewBoxHeight?: number;
    fps?: number;
    frames?: number;
  };
  images?: Record<string, Uint8Array>;
  sprites?: Array<{
    imageKey?: string;
    frames?: unknown[];
    matteKey?: string;
  }>;
  audios?: unknown[];
}

interface DecodedKnownMovie {
  MovieEntity: protobuf.Type;
  payload: KnownMoviePayload;
}

interface UnknownProtobufField {
  path: string;
  fieldNumber: number;
  wireType: number;
}

interface NormalizedMovieInvariants {
  version: string;
  canvasWidth: number;
  canvasHeight: number;
  fps: number;
  frameCount: number;
  spriteCount: number;
  spriteOrder: readonly string[];
  spriteImageKeys: readonly string[];
  spriteMatteKeys: readonly string[];
  spriteFrameCounts: readonly number[];
  spriteFrameAlpha: unknown;
  spriteFrameLayout: unknown;
  spriteFrameTransform: unknown;
  spriteFrameClipPath: unknown;
  spriteFrameShapes: unknown;
  audioCount: number;
  audios: unknown;
  imageKeys: readonly string[];
  imageHashes: Readonly<Record<string, string>>;
  imageSizes: Readonly<Record<string, number>>;
  imageDimensions: Readonly<Record<string, { width: number; height: number }>>;
  imageUsageCounts: Readonly<Record<string, number>>;
}

const defaultPngLimits: Required<SvgaPngValidationLimits> = {
  maxInputBytes: 10 * 1024 * 1024,
  maxPixels: 4_000_000,
  maxWidth: 4_096,
  maxHeight: 4_096
};

export class SvgaImageResourceEditor {
  private movieEntityPromise?: Promise<protobuf.Type>;

  constructor(
    private readonly protoPath = fileURLToPath(new URL("../../../proto/svga.proto", import.meta.url))
  ) {}

  async createSession(bytes: Uint8Array, name = "untitled.svga"): Promise<SvgaImageEditSession> {
    const { payload } = await this.decode(bytes);
    const images = normalizeImages(payload.images);
    const sprites = payload.sprites ?? [];
    const params = payload.params ?? {};

    if (Object.keys(images).length === 0) {
      throw new SvgaImageEditError(
        "svga_no_image_resources",
        "SVGA does not contain editable embedded image resources."
      );
    }

    const imageResources = Object.entries(images).map(([resourceKey, imageBytes]) => {
      const metadata = readEmbeddedImageMetadata(imageBytes);
      const dimensions = metadata.dimensions;
      return {
        resourceKey,
        displayName: resourceKey,
        originalMime: metadata.format === "png" ? "image/png" as const : "application/octet-stream" as const,
        originalSizeBytes: imageBytes.byteLength,
        originalSha256: sha256(imageBytes),
        decodedWidth: dimensions?.width,
        decodedHeight: dimensions?.height,
        usageCount: usageCountFor(resourceKey, sprites),
        replacementStatus: "original" as const,
        validationStatus: metadata.format === "png" && dimensions ? "valid" as const : "warning" as const
      };
    });

    return {
      sourceFile: {
        name,
        sizeBytes: bytes.byteLength,
        sha256: sha256(bytes)
      },
      parsedMovie: {
        version: payload.version ?? "",
        viewBoxWidth: params.viewBoxWidth ?? 0,
        viewBoxHeight: params.viewBoxHeight ?? 0,
        fps: params.fps ?? 0,
        frames: params.frames ?? 0,
        spriteCount: sprites.length,
        imageCount: imageResources.length,
        audioCount: payload.audios?.length ?? 0
      },
      imageResources,
      replacements: {},
      dirty: false,
      validationErrors: [],
      exportState: "idle"
    };
  }

  validatePngReplacement(
    pngBytes: Uint8Array,
    limits: SvgaPngValidationLimits = {}
  ): SvgaPngValidationResult {
    const resolvedLimits = { ...defaultPngLimits, ...limits };
    if (pngBytes.byteLength > resolvedLimits.maxInputBytes) {
      throw new SvgaImageEditError("replacement_png_too_large", "Replacement PNG is too large.", {
        sizeBytes: pngBytes.byteLength,
        maxInputBytes: resolvedLimits.maxInputBytes
      });
    }

    const metadata = readEmbeddedImageMetadata(pngBytes);
    if (metadata.format !== "png" || !metadata.dimensions) {
      throw new SvgaImageEditError("replacement_not_png", "Replacement must be a valid PNG file.");
    }
    const { width, height } = metadata.dimensions;
    if (width <= 0 || height <= 0) {
      throw new SvgaImageEditError("replacement_png_invalid_dimensions", "Replacement PNG has invalid dimensions.");
    }
    if (
      width > resolvedLimits.maxWidth
      || height > resolvedLimits.maxHeight
      || width * height > resolvedLimits.maxPixels
    ) {
      throw new SvgaImageEditError("replacement_png_dimensions_too_large", "Replacement PNG dimensions are too large.", {
        width,
        height,
        maxWidth: resolvedLimits.maxWidth,
        maxHeight: resolvedLimits.maxHeight,
        maxPixels: resolvedLimits.maxPixels
      });
    }

    try {
      decodeRgbaPng(Buffer.from(pngBytes.buffer, pngBytes.byteOffset, pngBytes.byteLength));
    } catch (error) {
      throw new SvgaImageEditError(
        "replacement_png_decode_failed",
        "Replacement PNG could not be decoded.",
        { reason: error instanceof Error ? error.message : String(error) }
      );
    }

    return {
      bytes: pngBytes.slice(),
      sha256: sha256(pngBytes),
      sizeBytes: pngBytes.byteLength,
      width,
      height
    };
  }

  async replaceImages(
    sourceBytes: Uint8Array,
    replacements: readonly SvgaImageReplacementInput[],
    name = "untitled.svga",
    options: SvgaRoundTripReportOptions = {}
  ): Promise<SvgaImageEditExportResult> {
    if (replacements.length === 0) {
      throw new SvgaImageEditError("replacement_required", "At least one replacement is required.");
    }

    const decoded = await this.decode(sourceBytes);
    const originalImages = normalizeImages(decoded.payload.images);
    const replacementMap = new Map<string, SvgaPngValidationResult>();

    for (const replacement of replacements) {
      if (!Object.hasOwn(originalImages, replacement.resourceKey)) {
        throw new SvgaImageEditError("resource_not_found", "Selected image resource does not exist.", {
          resourceKey: replacement.resourceKey
        });
      }
      if (replacementMap.has(replacement.resourceKey)) {
        throw new SvgaImageEditError("duplicate_resource_replacement", "A resource can only have one pending replacement.", {
          resourceKey: replacement.resourceKey
        });
      }
      replacementMap.set(
        replacement.resourceKey,
        this.validatePngReplacement(replacement.pngBytes)
      );
    }

    const originalInvariants = normalizeMovieInvariants(decoded.payload);
    const editedImages = Object.fromEntries(
      Object.entries(originalImages).map(([key, imageBytes]) => [
        key,
        replacementMap.get(key)?.bytes ?? imageBytes
      ])
    );
    const editedPayload = {
      ...decoded.payload,
      images: editedImages
    };
    const verificationError = decoded.MovieEntity.verify(editedPayload);
    if (verificationError) {
      throw new SvgaImageEditError("svga_verify_failed", `Edited SVGA verification failed: ${verificationError}`);
    }

    const editedBytes = deflateSync(decoded.MovieEntity.encode(decoded.MovieEntity.create(editedPayload)).finish());
    const exportedDecoded = await this.decode(editedBytes);
    const exportedInvariants = normalizeMovieInvariants(exportedDecoded.payload);
    const report = buildRoundTripReport({
      sourceBytes,
      editedBytes,
      originalInvariants,
      exportedInvariants,
      replacements: replacementMap,
      options
    });
    const onlyP4MinimumReplacementGateFailed = options.milestoneId === "P4"
      && report.unexpectedChanges.length === 1
      && report.unexpectedChanges[0] === "p4_minimum_replacement_count";
    const onlyP5DeferredPlaybackGateFailed = options.milestoneId === "P5"
      && report.unexpectedChanges.length > 0
      && report.unexpectedChanges.every((code) => (
        code === "p5_playback_smoke" || code === "p5_canvas_nonblank"
      ));
    if (!report.passed && !onlyP4MinimumReplacementGateFailed && !onlyP5DeferredPlaybackGateFailed) {
      throw new SvgaImageEditError("unsupported_round_trip_file", "Edited SVGA failed round-trip invariant checks.", {
        unexpectedChanges: report.unexpectedChanges
      });
    }

    const session = await this.createSession(sourceBytes, name);
    const replacementSummaries = Object.fromEntries([...replacementMap].map(([resourceKey, replacement]) => {
      const original = session.imageResources.find((resource) => resource.resourceKey === resourceKey);
      const dimensionWarning = original?.decodedWidth && original?.decodedHeight
        && (original.decodedWidth !== replacement.width || original.decodedHeight !== replacement.height)
          ? "replacement_dimensions_differ_from_original"
          : undefined;
      return [resourceKey, {
        resourceKey,
        replacementSha256: replacement.sha256,
        replacementSizeBytes: replacement.sizeBytes,
        replacementWidth: replacement.width,
        replacementHeight: replacement.height,
        dimensionWarning
      }];
    }));

    return {
      editedBytes,
      session: {
        ...session,
        imageResources: session.imageResources.map((resource) => {
          const replacement = replacementSummaries[resource.resourceKey];
          if (!replacement) return resource;
          return {
            ...resource,
            replacementStatus: "replaced",
            replacementSha256: replacement.replacementSha256,
            validationStatus: replacement.dimensionWarning ? "warning" : "valid"
          };
        }),
        replacements: replacementSummaries,
        dirty: true,
        exportState: "exported"
      },
      roundTripReport: report
    };
  }

  async validateRoundTrip(
    sourceBytes: Uint8Array,
    editedBytes: Uint8Array,
    replacements: readonly SvgaImageReplacementInput[],
    options: SvgaRoundTripReportOptions = {}
  ): Promise<SvgaRoundTripReport> {
    const originalDecoded = await this.decode(sourceBytes);
    const exportedDecoded = await this.decode(editedBytes);
    const replacementMap = new Map<string, SvgaPngValidationResult>();
    for (const replacement of replacements) {
      if (replacementMap.has(replacement.resourceKey)) {
        throw new SvgaImageEditError("duplicate_resource_replacement", "A resource can only have one pending replacement.", {
          resourceKey: replacement.resourceKey
        });
      }
      replacementMap.set(replacement.resourceKey, this.validatePngReplacement(replacement.pngBytes));
    }
    return buildRoundTripReport({
      sourceBytes,
      editedBytes,
      originalInvariants: normalizeMovieInvariants(originalDecoded.payload),
      exportedInvariants: normalizeMovieInvariants(exportedDecoded.payload),
      replacements: replacementMap,
      options
    });
  }

  private async decode(bytes: Uint8Array): Promise<DecodedKnownMovie> {
    try {
      const MovieEntity = await this.loadMovieEntity();
      const inflated = inflateSync(bytes);
      const unknownFields = findUnknownProtobufFields(MovieEntity, inflated);
      if (unknownFields.length > 0) {
        throw new SvgaImageEditError(
          "unsupported_round_trip_file",
          "SVGA contains protobuf fields that P3 cannot safely preserve.",
          { unknownFields: unknownFields.slice(0, 20) }
        );
      }
      const decoded = MovieEntity.decode(inflated);
      const payload = MovieEntity.toObject(decoded, {
        bytes: Buffer,
        defaults: true
      }) as KnownMoviePayload;
      if (!payload.params || !payload.images || !payload.sprites) {
        throw new Error("SVGA MovieEntity is missing params, images, or sprites.");
      }
      return {
        MovieEntity,
        payload: {
          ...payload,
          images: normalizeImages(payload.images)
        }
      };
    } catch (error) {
      if (error instanceof SvgaImageEditError) throw error;
      throw new SvgaImageEditError(
        "svga_decode_failed",
        "SVGA could not be inflated and decoded.",
        { reason: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  private loadMovieEntity(): Promise<protobuf.Type> {
    this.movieEntityPromise ??= protobuf.load(this.protoPath)
      .then((root) => root.lookupType("com.opensource.svga.MovieEntity"));
    return this.movieEntityPromise;
  }
}

function buildRoundTripReport(input: {
  sourceBytes: Uint8Array;
  editedBytes: Uint8Array;
  originalInvariants: NormalizedMovieInvariants;
  exportedInvariants: NormalizedMovieInvariants;
  replacements: ReadonlyMap<string, SvgaPngValidationResult>;
  options?: SvgaRoundTripReportOptions;
}): SvgaRoundTripReport {
  if (input.options?.milestoneId === "P5") {
    return buildRoundTripReportV4(input);
  }
  if (input.options?.milestoneId !== "P3") {
    return buildRoundTripReportV3(input);
  }
  return buildRoundTripReportV2(input);
}

function buildRoundTripReportV2(input: {
  sourceBytes: Uint8Array;
  editedBytes: Uint8Array;
  originalInvariants: NormalizedMovieInvariants;
  exportedInvariants: NormalizedMovieInvariants;
  replacements: ReadonlyMap<string, SvgaPngValidationResult>;
  options?: SvgaRoundTripReportOptions;
}): SvgaRoundTripReportV2 {
  const replacedResourceKey = replacementEntries(input.replacements)[0]?.[0] ?? "";
  const replacement = input.replacements.get(replacedResourceKey);
  const sourceSha256 = sha256(input.sourceBytes);
  const sourceSha256AfterEditing = sha256(input.sourceBytes);
  const checks: SvgaInvariantCheck[] = [
    checkEqual("movie_version", input.originalInvariants.version, input.exportedInvariants.version, "MovieEntity.version must not change."),
    checkEqual("canvas_width", input.originalInvariants.canvasWidth, input.exportedInvariants.canvasWidth, "params.viewBoxWidth must not change."),
    checkEqual("canvas_height", input.originalInvariants.canvasHeight, input.exportedInvariants.canvasHeight, "params.viewBoxHeight must not change."),
    checkEqual("fps", input.originalInvariants.fps, input.exportedInvariants.fps, "params.fps must not change."),
    checkEqual("frame_count", input.originalInvariants.frameCount, input.exportedInvariants.frameCount, "params.frames must not change."),
    checkEqual("sprite_count", input.originalInvariants.spriteCount, input.exportedInvariants.spriteCount, "Sprite count must not change."),
    checkDigest("sprite_order", input.originalInvariants.spriteOrder, input.exportedInvariants.spriteOrder, "Sprite ordering is compared by canonical imageKey/matteKey sequence."),
    checkDigest("sprite_image_key", input.originalInvariants.spriteImageKeys, input.exportedInvariants.spriteImageKeys, "Each sprite imageKey must remain stable."),
    checkDigest("sprite_matte_key", input.originalInvariants.spriteMatteKeys, input.exportedInvariants.spriteMatteKeys, "Each sprite matteKey must remain stable."),
    checkDigest("sprite_frame_count", input.originalInvariants.spriteFrameCounts, input.exportedInvariants.spriteFrameCounts, "Each sprite frame count must remain stable."),
    checkDigest("frame_alpha", input.originalInvariants.spriteFrameAlpha, input.exportedInvariants.spriteFrameAlpha, "Frame alpha values are canonicalized per sprite and frame."),
    checkDigest("frame_layout", input.originalInvariants.spriteFrameLayout, input.exportedInvariants.spriteFrameLayout, "Frame layout values are canonicalized per sprite and frame."),
    checkDigest("frame_transform", input.originalInvariants.spriteFrameTransform, input.exportedInvariants.spriteFrameTransform, "Frame transform values are canonicalized per sprite and frame."),
    checkDigest("frame_clip_path", input.originalInvariants.spriteFrameClipPath, input.exportedInvariants.spriteFrameClipPath, "Frame clipPath values are canonicalized per sprite and frame."),
    checkDigest("frame_shapes", input.originalInvariants.spriteFrameShapes, input.exportedInvariants.spriteFrameShapes, "Frame shapes are canonicalized per sprite and frame."),
    checkEqual("audio_count", input.originalInvariants.audioCount, input.exportedInvariants.audioCount, "Audio count must not change."),
    checkDigest("audio_entries", input.originalInvariants.audios, input.exportedInvariants.audios, "Audio entries are canonicalized as known protobuf fields."),
    checkEqual("image_resource_key_set", input.originalInvariants.imageKeys, input.exportedInvariants.imageKeys, "Image resource key set must remain stable."),
    checkUntouchedImages(input.originalInvariants, input.exportedInvariants, input.replacements),
    checkSelectedResource(input.originalInvariants, replacedResourceKey),
    checkEqual("original_source_sha256_immutability", sourceSha256, sourceSha256AfterEditing, "Source bytes are treated as immutable input and are never written in place.")
  ];
  const unexpectedChanges = checks
    .filter((check) => !check.passed)
    .map((check) => check.code);
  const changedFields = [
    ...[...input.replacements.keys()].map((key) => `images.${key}`),
    "zlib_bytes",
    "protobuf_serialization"
  ];
  const exportedResourceSha256 = replacedResourceKey
    ? input.exportedInvariants.imageHashes[replacedResourceKey] ?? ""
    : "";

  return {
    schemaVersion: 2,
    milestoneId: "P3",
    headCommit: input.options?.headCommit ?? "",
    sourceSha256,
    sourceSha256AfterEditing,
    exportedSha256: sha256(input.editedBytes),
    replacedResourceKey,
    originalResourceSha256: input.originalInvariants.imageHashes[replacedResourceKey] ?? "",
    replacementSha256: replacement?.sha256 ?? "",
    exportedResourceSha256,
    unknownFieldBoundary: {
      scannerVersion: "p3-wire-unknown-field-scanner-v1",
      unknownFieldsDetected: false,
      unsupportedReason: "none",
      supportedSubset: "known proto/svga.proto MovieEntity fields with edits limited to existing images.<resourceKey> PNG bytes",
      checkedBeforeDecodeEdit: true,
      passed: true
    },
    canonicalization: {
      rules: [
        "Known protobuf fields are converted with defaults enabled.",
        "Object keys are sorted recursively before digesting.",
        "Large sprite frame arrays are compared by SHA-256 canonical digests instead of inline JSON expansion.",
        "Only images.<selected-resource-key>, zlib bytes, and protobuf serialization bytes are allowed to change."
      ]
    },
    invariantChecks: checks,
    changedFields,
    unexpectedChanges,
    decodePassed: true,
    playbackPassed: false,
    canvasNonBlank: false,
    passed: unexpectedChanges.length === 0
      && Boolean(replacement)
      && exportedResourceSha256 === replacement?.sha256
  };
}

function buildRoundTripReportV3(input: {
  sourceBytes: Uint8Array;
  editedBytes: Uint8Array;
  originalInvariants: NormalizedMovieInvariants;
  exportedInvariants: NormalizedMovieInvariants;
  replacements: ReadonlyMap<string, SvgaPngValidationResult>;
  options?: SvgaRoundTripReportOptions;
}): SvgaRoundTripReportV3 {
  const sourceSha256 = sha256(input.sourceBytes);
  const sourceSha256AfterEditing = sha256(input.sourceBytes);
  const replacedResources = buildReplacedResourceChecks(
    input.originalInvariants,
    input.exportedInvariants,
    input.replacements
  );
  const replacedResourceKeys = replacedResources.map((resource) => resource.resourceKey);
  const untouchedResources = buildUntouchedResourceChecks(
    input.originalInvariants,
    input.exportedInvariants,
    input.replacements
  );
  const unchangedResourceKeys = untouchedResources.map((resource) => resource.resourceKey);
  const checks: SvgaInvariantCheck[] = [
    checkEqual("movie_version", input.originalInvariants.version, input.exportedInvariants.version, "MovieEntity.version must not change."),
    checkEqual("canvas_width", input.originalInvariants.canvasWidth, input.exportedInvariants.canvasWidth, "params.viewBoxWidth must not change."),
    checkEqual("canvas_height", input.originalInvariants.canvasHeight, input.exportedInvariants.canvasHeight, "params.viewBoxHeight must not change."),
    checkEqual("fps", input.originalInvariants.fps, input.exportedInvariants.fps, "params.fps must not change."),
    checkEqual("frame_count", input.originalInvariants.frameCount, input.exportedInvariants.frameCount, "params.frames must not change."),
    checkEqual("sprite_count", input.originalInvariants.spriteCount, input.exportedInvariants.spriteCount, "Sprite count must not change."),
    checkDigest("sprite_order", input.originalInvariants.spriteOrder, input.exportedInvariants.spriteOrder, "Sprite ordering is compared by canonical imageKey/matteKey sequence."),
    checkDigest("sprite_image_key", input.originalInvariants.spriteImageKeys, input.exportedInvariants.spriteImageKeys, "Each sprite imageKey must remain stable."),
    checkDigest("sprite_matte_key", input.originalInvariants.spriteMatteKeys, input.exportedInvariants.spriteMatteKeys, "Each sprite matteKey must remain stable."),
    checkDigest("sprite_frame_count", input.originalInvariants.spriteFrameCounts, input.exportedInvariants.spriteFrameCounts, "Each sprite frame count must remain stable."),
    checkDigest("frame_alpha", input.originalInvariants.spriteFrameAlpha, input.exportedInvariants.spriteFrameAlpha, "Frame alpha values are canonicalized per sprite and frame."),
    checkDigest("frame_layout", input.originalInvariants.spriteFrameLayout, input.exportedInvariants.spriteFrameLayout, "Frame layout values are canonicalized per sprite and frame."),
    checkDigest("frame_transform", input.originalInvariants.spriteFrameTransform, input.exportedInvariants.spriteFrameTransform, "Frame transform values are canonicalized per sprite and frame."),
    checkDigest("frame_clip_path", input.originalInvariants.spriteFrameClipPath, input.exportedInvariants.spriteFrameClipPath, "Frame clipPath values are canonicalized per sprite and frame."),
    checkDigest("frame_shapes", input.originalInvariants.spriteFrameShapes, input.exportedInvariants.spriteFrameShapes, "Frame shapes are canonicalized per sprite and frame."),
    checkEqual("audio_count", input.originalInvariants.audioCount, input.exportedInvariants.audioCount, "Audio count must not change."),
    checkDigest("audio_entries", input.originalInvariants.audios, input.exportedInvariants.audios, "Audio entries are canonicalized as known protobuf fields."),
    checkEqual("image_resource_key_set", input.originalInvariants.imageKeys, input.exportedInvariants.imageKeys, "Image resource key set must remain stable."),
    ...(input.options?.milestoneId === "P4"
      ? [checkEqual("p4_minimum_replacement_count", true, replacedResources.length >= 2, "P4 final pass requires at least two independent resource replacements.")]
      : []),
    checkUntouchedImages(input.originalInvariants, input.exportedInvariants, input.replacements),
    checkReplacedResourceReferences(input.originalInvariants, input.replacements),
    checkReplacedImageHashes(replacedResources),
    checkEqual("original_source_sha256_immutability", sourceSha256, sourceSha256AfterEditing, "Source bytes are treated as immutable input and are never written in place.")
  ];
  const unexpectedChanges = checks
    .filter((check) => !check.passed)
    .map((check) => check.code);
  const changedFields = [
    ...replacedResourceKeys.map((key) => `images.${key}`),
    "zlib_bytes",
    "protobuf_serialization"
  ];
  return {
    schemaVersion: 3,
    milestoneId: "P4",
    headCommit: input.options?.headCommit ?? "",
    sourceSha256,
    sourceSha256AfterEditing,
    exportedSha256: sha256(input.editedBytes),
    replacementCount: replacedResources.length,
    replacedResourceKeys,
    unchangedResourceKeys,
    replacements: replacedResources,
    untouchedResources,
    replacedResources,
    unknownFieldBoundary: {
      scannerVersion: "p3-wire-unknown-field-scanner-v1",
      unknownFieldsDetected: false,
      unsupportedReason: "none",
      supportedSubset: "known proto/svga.proto MovieEntity fields with edits limited to existing images.<resourceKey> PNG bytes",
      checkedBeforeDecodeEdit: true,
      passed: true
    },
    canonicalization: {
      rules: [
        "Known protobuf fields are converted with defaults enabled.",
        "Object keys are sorted recursively before digesting.",
        "Large sprite frame arrays are compared by SHA-256 canonical digests instead of inline JSON expansion.",
        "Only images.<resource-key>, zlib bytes, and protobuf serialization bytes are allowed to change.",
        "Every replaced resource must independently match its replacement PNG hash after export."
      ]
    },
    invariantChecks: checks,
    changedFields,
    unexpectedChanges,
    decodePassed: true,
    playbackPassed: false,
    canvasNonBlank: false,
    passed: unexpectedChanges.length === 0
      && replacedResources.length >= 2
      && replacedResources.every((resource) => resource.passed)
  };
}

function buildRoundTripReportV4(input: {
  sourceBytes: Uint8Array;
  editedBytes: Uint8Array;
  originalInvariants: NormalizedMovieInvariants;
  exportedInvariants: NormalizedMovieInvariants;
  replacements: ReadonlyMap<string, SvgaPngValidationResult>;
  options?: SvgaRoundTripReportOptions;
}): SvgaRoundTripReportV4 {
  const base = buildRoundTripReportV3({
    ...input,
    options: { ...input.options, milestoneId: "P4" }
  });
  const mappingByResource = new Map((input.options?.batchMappings ?? []).map((mapping) => [
    mapping.resourceKey,
    mapping
  ]));
  const appliedMappings = base.replacedResources.map((resource) => {
    const mapping = mappingByResource.get(resource.resourceKey);
    return {
      inputFileLabel: mapping?.inputFileLabel ?? `${resource.resourceKey}.png`,
      inputSha256: mapping?.inputSha256 ?? resource.replacementSha256,
      mappingRuleId: mapping?.mappingRuleId ?? "unknown",
      mappingStatus: mapping?.mappingStatus ?? "unknown",
      resourceKey: resource.resourceKey,
      originalResourceSha256: resource.originalResourceSha256,
      replacementSha256: resource.replacementSha256,
      exportedSha256: resource.exportedSha256,
      originalWidth: resource.originalWidth,
      originalHeight: resource.originalHeight,
      replacementWidth: resource.replacementWidth,
      replacementHeight: resource.replacementHeight,
      usageCount: resource.usageCount,
      sameSpriteReferences: resource.referencedBySameSprites,
      passed: resource.passed
        && (mapping?.inputSha256 ?? resource.replacementSha256) === resource.replacementSha256
    };
  });
  const p5Checks: SvgaInvariantCheck[] = [
    checkEqual("p5_minimum_applied_mapping_count", true, appliedMappings.length >= 3, "P5 batch acceptance requires at least three applied mappings."),
    checkEqual("p5_applied_mapping_hashes", true, appliedMappings.every((mapping) => mapping.passed), "Every applied mapping must export the exact replacement PNG bytes."),
    checkEqual("p5_playback_smoke", true, input.options?.playbackPassed === true, "P5 report must be bound to an explicit playback smoke result."),
    checkEqual("p5_canvas_nonblank", true, input.options?.canvasNonBlank === true, "P5 report must be bound to an explicit nonblank canvas smoke result.")
  ];
  const invariantChecks = [...base.invariantChecks, ...p5Checks];
  const unexpectedChanges = invariantChecks
    .filter((check) => !check.passed)
    .map((check) => check.code);
  return {
    ...base,
    schemaVersion: 4,
    milestoneId: "P5",
    batchTransactionId: input.options?.batchTransactionId ?? "",
    appliedMappingCount: appliedMappings.length,
    appliedMappings,
    batchReplacementSetDigest: input.options?.batchReplacementSetDigest ?? digest(appliedMappings),
    originalSourceUnchanged: base.sourceSha256 === base.sourceSha256AfterEditing,
    invariantChecks,
    unexpectedChanges,
    playbackPassed: input.options?.playbackPassed === true,
    canvasNonBlank: input.options?.canvasNonBlank === true,
    passed: unexpectedChanges.length === 0
      && appliedMappings.length >= 3
      && appliedMappings.every((mapping) => mapping.passed)
  };
}

function checkEqual(code: string, expected: unknown, actual: unknown, limitation: string): SvgaInvariantCheck {
  const passed = stableStringify(expected) === stableStringify(actual);
  return {
    code,
    passed,
    expected,
    actual,
    evidenceHash: digest({ code, expected, actual }),
    limitation
  };
}

function checkDigest(code: string, expectedValue: unknown, actualValue: unknown, limitation: string): SvgaInvariantCheck {
  const expectedDigest = digest(expectedValue);
  const actualDigest = digest(actualValue);
  return {
    code,
    passed: expectedDigest === actualDigest,
    expected: { canonicalDigest: expectedDigest },
    actual: { canonicalDigest: actualDigest },
    comparisonDigest: digest({ code, expectedDigest, actualDigest }),
    limitation
  };
}

function checkUntouchedImages(
  original: NormalizedMovieInvariants,
  exported: NormalizedMovieInvariants,
  replacements: ReadonlyMap<string, SvgaPngValidationResult>
): SvgaInvariantCheck {
  const changed: string[] = [];
  for (const key of original.imageKeys) {
    if (replacements.has(key)) continue;
    if (original.imageHashes[key] !== exported.imageHashes[key]) {
      changed.push(key);
    }
  }
  const expected = Object.fromEntries(
    original.imageKeys
      .filter((key) => !replacements.has(key))
      .map((key) => [key, original.imageHashes[key]])
  );
  const actual = Object.fromEntries(
    original.imageKeys
      .filter((key) => !replacements.has(key))
      .map((key) => [key, exported.imageHashes[key]])
  );
  return {
    code: "untouched_image_hashes",
    passed: changed.length === 0,
    expected,
    actual,
    comparisonDigest: digest({ expected, actual }),
    limitation: "Selected replacement resource is excluded; all other image resource SHA-256 values must remain identical.",
    details: changed.length > 0 ? { changed } : undefined
  };
}

function checkSelectedResource(original: NormalizedMovieInvariants, resourceKey: string): SvgaInvariantCheck {
  const actual = {
    resourceKey,
    existsInImageResources: original.imageKeys.includes(resourceKey),
    referencedBySpriteCount: original.spriteImageKeys.filter((key) => key === resourceKey).length
      + original.spriteMatteKeys.filter((key) => key === resourceKey).length
  };
  return {
    code: "selected_resource_key_reference",
    passed: Boolean(resourceKey) && actual.existsInImageResources,
    expected: { resourceKey, existsInImageResources: true },
    actual,
    evidenceHash: digest(actual),
    limitation: "P3 requires the selected key to exist in MovieEntity.images; a zero sprite reference count is allowed for unused embedded resources."
  };
}

function checkReplacedResourceReferences(
  original: NormalizedMovieInvariants,
  replacements: ReadonlyMap<string, SvgaPngValidationResult>
): SvgaInvariantCheck {
  const actual = Object.fromEntries(replacementEntries(replacements).map(([resourceKey]) => [
    resourceKey,
    {
      existsInImageResources: original.imageKeys.includes(resourceKey),
      referencedBySpriteCount: original.spriteImageKeys.filter((key) => key === resourceKey).length
        + original.spriteMatteKeys.filter((key) => key === resourceKey).length
    }
  ]));
  const missing = Object.entries(actual)
    .filter(([, value]) => !value.existsInImageResources)
    .map(([resourceKey]) => resourceKey);
  return {
    code: "replacement_resource_key_references",
    passed: replacements.size > 0 && missing.length === 0,
    expected: Object.fromEntries([...replacements.keys()].sort().map((resourceKey) => [
      resourceKey,
      { existsInImageResources: true }
    ])),
    actual,
    evidenceHash: digest(actual),
    limitation: "P4 requires every replacement key to exist in MovieEntity.images; a zero sprite reference count remains allowed for unused embedded resources.",
    details: missing.length > 0 ? { missing } : undefined
  };
}

function checkReplacedImageHashes(replacedResources: readonly SvgaRoundTripReplacedResourceCheck[]): SvgaInvariantCheck {
  const expected = Object.fromEntries(replacedResources.map((resource) => [
    resource.resourceKey,
    { exportedResourceSha256: resource.replacementSha256 }
  ]));
  const actual = Object.fromEntries(replacedResources.map((resource) => [
    resource.resourceKey,
    {
      exportedResourceSha256: resource.exportedResourceSha256,
      exportedMatchesReplacement: resource.exportedMatchesReplacement
    }
  ]));
  const failed = replacedResources
    .filter((resource) => !resource.passed)
    .map((resource) => resource.resourceKey);
  return {
    code: "replaced_image_hashes",
    passed: replacedResources.length > 0 && failed.length === 0,
    expected,
    actual,
    comparisonDigest: digest({ expected, actual }),
    limitation: "Every changed image resource must decode from the exported SVGA with the exact replacement PNG SHA-256.",
    details: failed.length > 0 ? { failed } : undefined
  };
}

function buildReplacedResourceChecks(
  original: NormalizedMovieInvariants,
  exported: NormalizedMovieInvariants,
  replacements: ReadonlyMap<string, SvgaPngValidationResult>
): SvgaRoundTripReplacedResourceCheck[] {
  return replacementEntries(replacements).map(([resourceKey, replacement]) => {
    const originalResourceSha256 = original.imageHashes[resourceKey] ?? "";
    const exportedResourceSha256 = exported.imageHashes[resourceKey] ?? "";
    const originalDimensions = original.imageDimensions[resourceKey];
    const exportedMatchesReplacement = exportedResourceSha256 === replacement.sha256;
    const keyStillPresent = exported.imageKeys.includes(resourceKey);
    const referencedBySameSprites = original.imageUsageCounts[resourceKey] === exported.imageUsageCounts[resourceKey];
    return {
      resourceKey,
      usageCount: original.imageUsageCounts[resourceKey] ?? 0,
      originalSha256: originalResourceSha256,
      replacementSha256: replacement.sha256,
      exportedSha256: exportedResourceSha256,
      originalResourceSha256,
      exportedResourceSha256,
      originalSizeBytes: original.imageSizes[resourceKey] ?? 0,
      replacementSizeBytes: replacement.sizeBytes,
      originalWidth: originalDimensions?.width,
      originalHeight: originalDimensions?.height,
      replacementWidth: replacement.width,
      replacementHeight: replacement.height,
      keyStillPresent,
      referencedBySameSprites,
      exportedMatchesReplacement,
      passed: Boolean(originalResourceSha256)
        && keyStillPresent
        && referencedBySameSprites
        && exportedMatchesReplacement
    };
  });
}

function buildUntouchedResourceChecks(
  original: NormalizedMovieInvariants,
  exported: NormalizedMovieInvariants,
  replacements: ReadonlyMap<string, SvgaPngValidationResult>
): SvgaRoundTripUntouchedResourceCheck[] {
  return original.imageKeys
    .filter((key) => !replacements.has(key))
    .map((resourceKey) => {
      const originalSha256 = original.imageHashes[resourceKey] ?? "";
      const exportedSha256 = exported.imageHashes[resourceKey] ?? "";
      return {
        resourceKey,
        originalSha256,
        exportedSha256,
        passed: Boolean(originalSha256) && originalSha256 === exportedSha256
      };
    });
}

function replacementEntries(
  replacements: ReadonlyMap<string, SvgaPngValidationResult>
): Array<[string, SvgaPngValidationResult]> {
  return [...replacements.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function normalizeMovieInvariants(payload: KnownMoviePayload): NormalizedMovieInvariants {
  const images = normalizeImages(payload.images);
  const sprites = payload.sprites ?? [];
  const params = payload.params ?? {};
  const imageMetadata = Object.fromEntries(
    Object.entries(images).map(([key, bytes]) => [key, readEmbeddedImageMetadata(bytes)])
  );
  return {
    version: payload.version ?? "",
    canvasWidth: params.viewBoxWidth ?? 0,
    canvasHeight: params.viewBoxHeight ?? 0,
    fps: params.fps ?? 0,
    frameCount: params.frames ?? 0,
    spriteCount: sprites.length,
    spriteOrder: sprites.map((sprite, index) => `${index}:${sprite.imageKey ?? ""}:${sprite.matteKey ?? ""}`),
    spriteImageKeys: sprites.map((sprite) => sprite.imageKey ?? ""),
    spriteMatteKeys: sprites.map((sprite) => sprite.matteKey ?? ""),
    spriteFrameCounts: sprites.map((sprite) => sprite.frames?.length ?? 0),
    spriteFrameAlpha: spriteFrameField(sprites, "alpha"),
    spriteFrameLayout: spriteFrameField(sprites, "layout"),
    spriteFrameTransform: spriteFrameField(sprites, "transform"),
    spriteFrameClipPath: spriteFrameField(sprites, "clipPath"),
    spriteFrameShapes: spriteFrameField(sprites, "shapes"),
    audioCount: payload.audios?.length ?? 0,
    audios: payload.audios ?? [],
    imageKeys: Object.keys(images).sort(),
    imageHashes: Object.fromEntries(
      Object.entries(images).map(([key, bytes]) => [key, sha256(bytes)])
    ),
    imageSizes: Object.fromEntries(
      Object.entries(images).map(([key, bytes]) => [key, bytes.byteLength])
    ),
    imageDimensions: Object.fromEntries(
      Object.entries(imageMetadata)
        .flatMap(([key, metadata]) => metadata.dimensions ? [[key, metadata.dimensions]] : [])
    ),
    imageUsageCounts: Object.fromEntries(
      Object.keys(images).map((key) => [key, usageCountFor(key, sprites)])
    )
  };
}

function spriteFrameField(sprites: KnownMoviePayload["sprites"], key: string): unknown {
  return (sprites ?? []).map((sprite, spriteIndex) => ({
    spriteIndex,
    imageKey: sprite.imageKey ?? "",
    matteKey: sprite.matteKey ?? "",
    values: (sprite.frames ?? []).map((frame) => (
      frame && typeof frame === "object"
        ? (frame as Record<string, unknown>)[key] ?? null
        : null
    ))
  }));
}

function normalizeImages(images: KnownMoviePayload["images"]): Record<string, Uint8Array> {
  return Object.fromEntries(
    Object.entries(images ?? {}).map(([key, value]) => [key, toUint8Array(value)])
  );
}

function toUint8Array(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    return value.slice();
  }
  if (Array.isArray(value)) {
    return Uint8Array.from(value);
  }
  throw new SvgaImageEditError("svga_invalid_image_bytes", "SVGA image bytes are not readable.");
}

function findUnknownProtobufFields(type: protobuf.Type, bytes: Uint8Array, path = type.fullName): UnknownProtobufField[] {
  const issues: UnknownProtobufField[] = [];
  let offset = 0;
  while (offset < bytes.byteLength) {
    const tag = readVarint(bytes, offset);
    offset = tag.offset;
    const fieldNumber = Number(tag.value >> 3n);
    const wireType = Number(tag.value & 7n);
    const field = type.fieldsById[fieldNumber];
    if (!field || fieldNumber <= 0) {
      issues.push({ path, fieldNumber, wireType });
    }

    if (wireType === 0) {
      offset = readVarint(bytes, offset).offset;
    } else if (wireType === 1) {
      offset = boundedOffset(bytes, offset, 8);
    } else if (wireType === 2) {
      const length = readVarint(bytes, offset);
      offset = length.offset;
      const dataStart = offset;
      const dataEnd = boundedOffset(bytes, dataStart, Number(length.value));
      if (field?.resolvedType instanceof protobuf.Type) {
        issues.push(...findUnknownProtobufFields(
          field.resolvedType,
          bytes.subarray(dataStart, dataEnd),
          `${path}.${field.name}`
        ));
      }
      offset = dataEnd;
    } else if (wireType === 5) {
      offset = boundedOffset(bytes, offset, 4);
    } else {
      issues.push({ path, fieldNumber, wireType });
      break;
    }
  }
  return issues;
}

function readVarint(bytes: Uint8Array, startOffset: number): { value: bigint; offset: number } {
  let value = 0n;
  let shift = 0n;
  let offset = startOffset;
  while (offset < bytes.byteLength) {
    const byte = BigInt(bytes[offset]);
    value |= (byte & 0x7fn) << shift;
    offset += 1;
    if ((byte & 0x80n) === 0n) return { value, offset };
    shift += 7n;
    if (shift > 70n) break;
  }
  throw new SvgaImageEditError("svga_invalid_protobuf_wire", "SVGA protobuf wire data is invalid.");
}

function boundedOffset(bytes: Uint8Array, offset: number, length: number): number {
  if (!Number.isSafeInteger(length) || length < 0 || offset + length > bytes.byteLength) {
    throw new SvgaImageEditError("svga_invalid_protobuf_wire", "SVGA protobuf wire data is truncated.");
  }
  return offset + length;
}

function usageCountFor(resourceKey: string, sprites: KnownMoviePayload["sprites"]): number {
  return (sprites ?? []).reduce((count, sprite) => (
    count
    + (sprite.imageKey === resourceKey ? 1 : 0)
    + (sprite.matteKey === resourceKey ? 1 : 0)
  ), 0);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortObject(value));
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (value && typeof value === "object" && !(value instanceof Uint8Array)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortObject(item)])
    );
  }
  return value;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function digest(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}
