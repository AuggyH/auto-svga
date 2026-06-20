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
  details?: Readonly<Record<string, unknown>>;
}

export interface SvgaRoundTripReport {
  sourceSha256: string;
  exportedSha256: string;
  replacedResourceKey: string;
  originalResourceSha256: string;
  replacementSha256: string;
  exportedResourceSha256: string;
  invariantChecks: readonly SvgaInvariantCheck[];
  changedFields: readonly string[];
  unexpectedChanges: readonly string[];
  decodePassed: boolean;
  playbackPassed: boolean;
  canvasNonBlank: boolean;
  passed: boolean;
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
  params: KnownMoviePayload["params"];
  sprites: unknown;
  audios: unknown;
  imageKeys: readonly string[];
  imageHashes: Readonly<Record<string, string>>;
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
    name = "untitled.svga"
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
      replacements: replacementMap
    });
    if (!report.passed) {
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
}): SvgaRoundTripReport {
  const replacedResourceKey = [...input.replacements.keys()][0] ?? "";
  const replacement = input.replacements.get(replacedResourceKey);
  const checks: SvgaInvariantCheck[] = [
    checkEqual("version", input.originalInvariants.version, input.exportedInvariants.version),
    checkEqual("params", input.originalInvariants.params, input.exportedInvariants.params),
    checkEqual("sprites", input.originalInvariants.sprites, input.exportedInvariants.sprites),
    checkEqual("audios", input.originalInvariants.audios, input.exportedInvariants.audios),
    checkEqual("image_keys", input.originalInvariants.imageKeys, input.exportedInvariants.imageKeys),
    checkUntouchedImages(input.originalInvariants, input.exportedInvariants, input.replacements)
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
    sourceSha256: sha256(input.sourceBytes),
    exportedSha256: sha256(input.editedBytes),
    replacedResourceKey,
    originalResourceSha256: input.originalInvariants.imageHashes[replacedResourceKey] ?? "",
    replacementSha256: replacement?.sha256 ?? "",
    exportedResourceSha256,
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

function checkEqual(code: string, actual: unknown, expected: unknown): SvgaInvariantCheck {
  return {
    code,
    passed: stableStringify(actual) === stableStringify(expected)
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
  return {
    code: "untouched_image_hashes",
    passed: changed.length === 0,
    details: changed.length > 0 ? { changed } : undefined
  };
}

function normalizeMovieInvariants(payload: KnownMoviePayload): NormalizedMovieInvariants {
  const images = normalizeImages(payload.images);
  return {
    version: payload.version ?? "",
    params: payload.params ?? {},
    sprites: payload.sprites ?? [],
    audios: payload.audios ?? [],
    imageKeys: Object.keys(images).sort(),
    imageHashes: Object.fromEntries(
      Object.entries(images).map(([key, bytes]) => [key, sha256(bytes)])
    )
  };
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
