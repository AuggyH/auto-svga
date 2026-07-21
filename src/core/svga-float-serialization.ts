export const SVGA_FLOAT_SERIALIZATION_CONTRACT = Object.freeze({
  version: "svga_float32_v1" as const,
  sourceArithmetic: "ieee754_binary64" as const,
  serializedScalar: "ieee754_binary32" as const,
  arithmeticPolicy: "validate_binary64_sources_and_interpolants_round_serialized_fields" as const,
  rounding: "nearest_ties_to_even_via_math_fround" as const,
  maximumFiniteMagnitude: 3.4028234663852886e38,
  minimumNonzeroMagnitude: 1.401298464324817e-45,
  zero: "canonical_positive_zero" as const,
  signedZero: "canonicalize_to_positive_zero" as const,
  nonzeroUnderflow: "reject" as const,
  overflow: "reject" as const,
  nonfinite: "reject" as const
});

export const SVGA_GENERATED_NATIVE_STRUCTURE_CONTRACT = Object.freeze({
  version: "svga_generated_native_frame_v2" as const,
  frameCountBinding: "each_sprite_frames_exactly_equals_params_frames" as const,
  requiredFrameMessages: Object.freeze(["layout", "transform"] as const),
  canonicalLayoutFields: Object.freeze(["x", "y", "width", "height"] as const),
  canonicalTransformFields: Object.freeze(["a", "b", "c", "d", "tx", "ty"] as const),
  protobufDefaultPolicy: "proto3_default_scalar_omission_allowed_message_presence_required" as const
});

export const SVGA_GENERATED_NATIVE_OUTPUT_AUTHORITY_CONTRACT = Object.freeze({
  version: "aeb_generated_native_output_authority_v1" as const,
  scope: "image_transform_v0_generated_svga" as const,
  movieVocabulary: Object.freeze(["version", "params", "images", "sprites"] as const),
  unsupportedMovieFields: Object.freeze(["audios", "unknown_fields"] as const),
  unsupportedFrameFields: Object.freeze(["clipPath", "shapes", "unknown_fields"] as const),
  canonicalWire: "decode_and_deterministic_reencode_must_equal_exact_inflated_bytes" as const,
  projectJoin: "project_map_resources_must_match_movie_images_and_sprites_one_to_one" as const
});

const TRANSFORM_FIELDS = ["x", "y", "scaleX", "scaleY", "rotation", "opacity"] as const;
const MATRIX_FIELDS = ["a", "b", "c", "d", "tx", "ty"] as const;

export interface DecodedGeneratedNativeStructureReport {
  structureContractVersion: typeof SVGA_GENERATED_NATIVE_STRUCTURE_CONTRACT.version;
  authorityContractVersion: typeof SVGA_GENERATED_NATIVE_OUTPUT_AUTHORITY_CONTRACT.version;
  generatedNativeStructureValid: boolean;
  generatedNativeVocabularyValid: boolean;
  declaredFrameCount: number | null;
  spriteFrameCounts: number[];
  imageKeys: string[];
  spriteImageKeys: string[];
  totalFrameRecords: number;
  allSpriteFrameCountsMatch: boolean;
  requiredFrameFieldsPresent: boolean;
  canonicalFloatValues: boolean;
}

type TransformField = typeof TRANSFORM_FIELDS[number];

export interface SvgaFloatTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
}

export interface SvgaFloatKeyframe extends Partial<SvgaFloatTransform> {
  frame: number;
}

export interface SvgaFloatSpriteInput {
  transform: SvgaFloatTransform;
  anchor: { x: number; y: number };
  keyframes: SvgaFloatKeyframe[];
  width: number;
  height: number;
  fallbackOpacityMultiplier: number;
  visible?: boolean;
  visibleFrameRange?: { start: number; end: number };
}

export interface PreparedSvgaFloatSprite extends Omit<SvgaFloatSpriteInput, "transform" | "anchor" | "keyframes" | "width" | "height" | "fallbackOpacityMultiplier"> {
  transform: SvgaFloatTransform;
  anchor: { x: number; y: number };
  keyframes: SvgaFloatKeyframe[];
  width: number;
  height: number;
  fallbackOpacityMultiplier: number;
}

export class SvgaFloatSerializationError extends Error {
  readonly code = "svga_float_serialization_invalid";

  constructor(readonly field: string) {
    super(`SVGA float32 serialization rejected ${field}.`);
    this.name = "SvgaFloatSerializationError";
  }
}

export function canonicalizeSvgaFloat32(value: number, field = "value"): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new SvgaFloatSerializationError(field);
  }
  const magnitude = Math.abs(value);
  if (magnitude > SVGA_FLOAT_SERIALIZATION_CONTRACT.maximumFiniteMagnitude) {
    throw new SvgaFloatSerializationError(field);
  }
  if (magnitude !== 0 && magnitude < SVGA_FLOAT_SERIALIZATION_CONTRACT.minimumNonzeroMagnitude) {
    throw new SvgaFloatSerializationError(field);
  }
  const canonical = Math.fround(value);
  if (!Number.isFinite(canonical) || (value !== 0 && canonical === 0)) {
    throw new SvgaFloatSerializationError(field);
  }
  return Object.is(canonical, -0) ? 0 : canonical;
}

export function prepareSvgaFloatSprite(input: SvgaFloatSpriteInput): PreparedSvgaFloatSprite {
  const transform = canonicalizeTransform(input.transform, "transform");
  const anchor = {
    x: validateSvgaFloat32Source(input.anchor.x, "anchor.x"),
    y: validateSvgaFloat32Source(input.anchor.y, "anchor.y")
  };
  const keyframes = [...input.keyframes]
    .sort((first, second) => first.frame - second.frame)
    .map((keyframe, index) => {
      if (!Number.isInteger(keyframe.frame)) {
        throw new SvgaFloatSerializationError(`keyframes[${index}].frame`);
      }
      const canonical: SvgaFloatKeyframe = { frame: keyframe.frame };
      for (const field of TRANSFORM_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(keyframe, field)) {
          canonical[field] = validateSvgaFloat32Source(keyframe[field] as number, `keyframes[${index}].${field}`);
        }
      }
      return canonical;
    });
  return {
    ...input,
    transform,
    anchor,
    keyframes,
    width: canonicalizeSvgaFloat32(input.width, "width"),
    height: canonicalizeSvgaFloat32(input.height, "height"),
    fallbackOpacityMultiplier: validateSvgaFloat32Source(input.fallbackOpacityMultiplier, "fallbackOpacityMultiplier")
  };
}

export function canonicalTransformAtFrame(sprite: PreparedSvgaFloatSprite, frame: number): SvgaFloatTransform & { width: number; height: number } {
  const base = { ...sprite.transform, width: sprite.width, height: sprite.height };
  if (sprite.keyframes.length === 0) return base;
  if (frame <= sprite.keyframes[0].frame) return mergeCanonicalKeyframe(base, sprite.keyframes[0]);
  if (frame >= sprite.keyframes[sprite.keyframes.length - 1].frame) {
    return mergeCanonicalKeyframe(base, sprite.keyframes[sprite.keyframes.length - 1]);
  }
  const nextIndex = sprite.keyframes.findIndex((keyframe) => keyframe.frame >= frame);
  const previous = sprite.keyframes[nextIndex - 1];
  const next = sprite.keyframes[nextIndex];
  const t = (frame - previous.frame) / Math.max(1, next.frame - previous.frame);
  const interpolated = { ...base };
  for (const field of TRANSFORM_FIELDS) {
    const start = previous[field] ?? base[field];
    const end = next[field] ?? base[field];
    interpolated[field] = validateSvgaFloat32Source(start + (end - start) * t, `frame[${frame}].${field}`);
  }
  return interpolated;
}

export function canonicalTransformMatrix(
  transform: SvgaFloatTransform,
  anchor: { x: number; y: number }
): { a: number; b: number; c: number; d: number; tx: number; ty: number } {
  const radians = (transform.rotation / 180) * Math.PI;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rawA = cos * transform.scaleX;
  const rawB = sin * transform.scaleX;
  const rawC = -sin * transform.scaleY;
  const rawD = cos * transform.scaleY;
  return {
    a: canonicalizeSvgaFloat32(rawA, "matrix.a"),
    b: canonicalizeSvgaFloat32(rawB, "matrix.b"),
    c: canonicalizeSvgaFloat32(rawC, "matrix.c"),
    d: canonicalizeSvgaFloat32(rawD, "matrix.d"),
    tx: canonicalizeSvgaFloat32(transform.x - (rawA * anchor.x + rawC * anchor.y), "matrix.tx"),
    ty: canonicalizeSvgaFloat32(transform.y - (rawB * anchor.x + rawD * anchor.y), "matrix.ty")
  };
}

export function buildCanonicalSvgaFrame(sprite: PreparedSvgaFloatSprite, frame: number): {
  alpha: number;
  layout: { x: number; y: number; width: number; height: number };
  transform: { a: number; b: number; c: number; d: number; tx: number; ty: number };
} {
  const transform = canonicalTransformAtFrame(sprite, frame);
  const frameVisible = sprite.visible !== false
    && (!sprite.visibleFrameRange || (frame >= sprite.visibleFrameRange.start && frame <= sprite.visibleFrameRange.end));
  const alpha = frameVisible
    ? canonicalizeSvgaFloat32(Math.max(0, Math.min(1, transform.opacity * sprite.fallbackOpacityMultiplier)), `frame[${frame}].alpha`)
    : 0;
  return {
    alpha,
    layout: { x: 0, y: 0, width: transform.width, height: transform.height },
    transform: canonicalTransformMatrix(transform, sprite.anchor)
  };
}

export function validateSvgaLayerFloatDomain(input: SvgaFloatSpriteInput, durationFrames: number): { ok: true } | { ok: false; field: string } {
  try {
    const sprite = prepareSvgaFloatSprite(input);
    for (let frame = 0; frame < durationFrames; frame += 1) buildCanonicalSvgaFrame(sprite, frame);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      field: error instanceof SvgaFloatSerializationError ? error.field : "unknown"
    };
  }
}

export function decodedSvgaUsesCanonicalFloatDomain(decoded: unknown, encoded?: Uint8Array): boolean {
  if (encoded === undefined) return false;
  const report = inspectDecodedGeneratedNativeSubset(decoded, encoded);
  return report.generatedNativeStructureValid && report.canonicalFloatValues;
}

export function inspectDecodedGeneratedNativeSubset(
  decoded: unknown,
  encoded: Uint8Array
): DecodedGeneratedNativeStructureReport {
  const report: DecodedGeneratedNativeStructureReport = {
    structureContractVersion: SVGA_GENERATED_NATIVE_STRUCTURE_CONTRACT.version,
    authorityContractVersion: SVGA_GENERATED_NATIVE_OUTPUT_AUTHORITY_CONTRACT.version,
    generatedNativeStructureValid: false,
    generatedNativeVocabularyValid: false,
    declaredFrameCount: null,
    spriteFrameCounts: [],
    imageKeys: [],
    spriteImageKeys: [],
    totalFrameRecords: 0,
    allSpriteFrameCountsMatch: false,
    requiredFrameFieldsPresent: false,
    canonicalFloatValues: false
  };
  const wire = inspectGeneratedNativeWireStructure(encoded);
  if (!wire) return report;
  report.declaredFrameCount = wire.declaredFrameCount;
  report.spriteFrameCounts = wire.spriteFrameCounts;
  report.imageKeys = wire.imageKeys;
  report.spriteImageKeys = wire.spriteImageKeys;
  report.totalFrameRecords = wire.totalFrameRecords;
  report.allSpriteFrameCountsMatch = wire.allSpriteFrameCountsMatch;
  report.requiredFrameFieldsPresent = wire.requiredFrameFieldsPresent;
  report.generatedNativeVocabularyValid = wire.closedVocabularyValid;
  if (!isRecord(decoded) || !isRecord(decoded.params) || !Array.isArray(decoded.sprites)) return report;
  if (decoded.params.frames !== wire.declaredFrameCount || decoded.sprites.length !== wire.spriteFrameCounts.length) return report;

  let canonicalFloatValues = true;
  let decodedStructureMatches = true;
  for (let spriteIndex = 0; spriteIndex < decoded.sprites.length; spriteIndex += 1) {
    const sprite = decoded.sprites[spriteIndex];
    if (!isRecord(sprite) || !Array.isArray(sprite.frames) || sprite.frames.length !== wire.spriteFrameCounts[spriteIndex]) {
      decodedStructureMatches = false;
      canonicalFloatValues = false;
      continue;
    }
    for (const frame of sprite.frames) {
      if (!isRecord(frame)) {
        decodedStructureMatches = false;
        canonicalFloatValues = false;
        continue;
      }
      if (!decodedFloatFieldOrDefaultIsCanonical(frame.alpha)) canonicalFloatValues = false;
      if (!isRecord(frame.layout) || !isRecord(frame.transform)) decodedStructureMatches = false;
      if (!decodedFloatRecordOrDefaultsIsCanonical(frame.layout, SVGA_GENERATED_NATIVE_STRUCTURE_CONTRACT.canonicalLayoutFields)) {
        canonicalFloatValues = false;
      }
      if (!decodedFloatRecordOrDefaultsIsCanonical(frame.transform, SVGA_GENERATED_NATIVE_STRUCTURE_CONTRACT.canonicalTransformFields)) {
        canonicalFloatValues = false;
      }
      if (Array.isArray(frame.shapes)) {
        for (const shape of frame.shapes) {
          if (isRecord(shape) && shape.transform !== undefined && !decodedFloatRecordOrDefaultsIsCanonical(shape.transform, MATRIX_FIELDS)) {
            canonicalFloatValues = false;
          }
        }
      }
    }
  }

  report.canonicalFloatValues = wire.requiredFrameFieldsPresent && canonicalFloatValues;
  report.generatedNativeStructureValid = wire.allSpriteFrameCountsMatch
    && wire.requiredFrameFieldsPresent
    && wire.closedVocabularyValid
    && decodedStructureMatches;
  return report;
}

interface GeneratedNativeWireStructure {
  declaredFrameCount: number;
  spriteFrameCounts: number[];
  imageKeys: string[];
  spriteImageKeys: string[];
  totalFrameRecords: number;
  allSpriteFrameCountsMatch: boolean;
  requiredFrameFieldsPresent: boolean;
  closedVocabularyValid: boolean;
}

interface WireCursor {
  bytes: Uint8Array;
  offset: number;
  end: number;
}

function inspectGeneratedNativeWireStructure(encoded: Uint8Array): GeneratedNativeWireStructure | null {
  try {
    const cursor = wireCursor(encoded);
    let declaredFrameCount: number | null = null;
    let versionCount = 0;
    let paramsCount = 0;
    const imageKeys: string[] = [];
    const seenImageKeys = new Set<string>();
    const spriteFrameCounts: number[] = [];
    const spriteImageKeys: string[] = [];
    let requiredFrameFieldsPresent = true;
    let closedVocabularyValid = true;
    while (cursor.offset < cursor.end) {
      const { field, wireType } = readWireTag(cursor);
      if (field === 1 && wireType === 2) {
        versionCount += 1;
        const version = readWireString(cursor);
        if (version !== "2.0") closedVocabularyValid = false;
      } else if (field === 2 && wireType === 2) {
        paramsCount += 1;
        const params = readParamsStructure(readWireMessage(cursor));
        declaredFrameCount = params.declaredFrameCount;
        if (!params.valid) closedVocabularyValid = false;
      } else if (field === 3 && wireType === 2) {
        const image = readImageMapEntry(readWireMessage(cursor));
        if (!image.valid || seenImageKeys.has(image.key ?? "")) closedVocabularyValid = false;
        if (image.key !== null) {
          imageKeys.push(image.key);
          seenImageKeys.add(image.key);
        }
      } else if (field === 4 && wireType === 2) {
        const sprite = readSpriteStructure(readWireMessage(cursor));
        spriteFrameCounts.push(sprite.frameCount);
        if (sprite.imageKey !== null) spriteImageKeys.push(sprite.imageKey);
        if (!sprite.requiredFrameFieldsPresent) requiredFrameFieldsPresent = false;
        if (!sprite.closedVocabularyValid) closedVocabularyValid = false;
      } else {
        closedVocabularyValid = false;
        skipWireValue(cursor, wireType);
      }
    }
    if (versionCount !== 1 || paramsCount !== 1 || declaredFrameCount === null || declaredFrameCount < 1) return null;
    if (spriteImageKeys.length !== spriteFrameCounts.length) closedVocabularyValid = false;
    if (!spriteImageKeys.every((imageKey) => seenImageKeys.has(imageKey))) closedVocabularyValid = false;
    return {
      declaredFrameCount,
      spriteFrameCounts,
      imageKeys,
      spriteImageKeys,
      totalFrameRecords: spriteFrameCounts.reduce((total, count) => total + count, 0),
      allSpriteFrameCountsMatch: spriteFrameCounts.every((count) => count === declaredFrameCount),
      requiredFrameFieldsPresent,
      closedVocabularyValid
    };
  } catch {
    return null;
  }
}

function readParamsStructure(cursor: WireCursor): { declaredFrameCount: number | null; valid: boolean } {
  const counts = new Map<number, number>();
  let declaredFrameCount: number | null = null;
  let valid = true;
  while (cursor.offset < cursor.end) {
    const { field, wireType } = readWireTag(cursor);
    if ((field === 1 || field === 2) && wireType === 5) {
      counts.set(field, (counts.get(field) ?? 0) + 1);
      skipWireValue(cursor, wireType);
    } else if ((field === 3 || field === 4) && wireType === 0) {
      counts.set(field, (counts.get(field) ?? 0) + 1);
      const value = readWireVarint(cursor);
      if (field === 4) declaredFrameCount = value;
    } else {
      valid = false;
      skipWireValue(cursor, wireType);
    }
  }
  valid = valid && [1, 2, 3, 4].every((field) => counts.get(field) === 1);
  return { declaredFrameCount: Number.isSafeInteger(declaredFrameCount) ? declaredFrameCount : null, valid };
}

function readImageMapEntry(cursor: WireCursor): { key: string | null; valid: boolean } {
  let key: string | null = null;
  let keyCount = 0;
  let valueCount = 0;
  let valid = true;
  while (cursor.offset < cursor.end) {
    const { field, wireType } = readWireTag(cursor);
    if (field === 1 && wireType === 2) {
      keyCount += 1;
      key = readWireString(cursor);
    } else if (field === 2 && wireType === 2) {
      valueCount += 1;
      const bytes = readWireBytes(cursor);
      if (bytes.byteLength === 0) valid = false;
    } else {
      valid = false;
      skipWireValue(cursor, wireType);
    }
  }
  return { key, valid: valid && keyCount === 1 && valueCount === 1 && typeof key === "string" && key.length > 0 };
}

function readDeclaredFrameCount(cursor: WireCursor): number | null {
  let frameCount: number | null = null;
  let frameCountFields = 0;
  while (cursor.offset < cursor.end) {
    const { field, wireType } = readWireTag(cursor);
    if (field === 4 && wireType === 0) {
      frameCountFields += 1;
      frameCount = readWireVarint(cursor);
    } else {
      skipWireValue(cursor, wireType);
    }
  }
  return frameCountFields === 1 && Number.isSafeInteger(frameCount) ? frameCount : null;
}

function readSpriteStructure(cursor: WireCursor): {
  imageKey: string | null;
  frameCount: number;
  requiredFrameFieldsPresent: boolean;
  closedVocabularyValid: boolean;
} {
  let imageKey: string | null = null;
  let imageKeyCount = 0;
  let frameCount = 0;
  let requiredFrameFieldsPresent = true;
  let closedVocabularyValid = true;
  while (cursor.offset < cursor.end) {
    const { field, wireType } = readWireTag(cursor);
    if (field === 1 && wireType === 2) {
      imageKeyCount += 1;
      imageKey = readWireString(cursor);
    } else if (field === 2 && wireType === 2) {
      frameCount += 1;
      const frame = readFrameStructure(readWireMessage(cursor));
      if (!frame.requiredFrameFieldsPresent) requiredFrameFieldsPresent = false;
      if (!frame.closedVocabularyValid) closedVocabularyValid = false;
    } else {
      closedVocabularyValid = false;
      skipWireValue(cursor, wireType);
    }
  }
  if (imageKeyCount !== 1 || !imageKey) closedVocabularyValid = false;
  return { imageKey, frameCount, requiredFrameFieldsPresent, closedVocabularyValid };
}

function readFrameStructure(cursor: WireCursor): { requiredFrameFieldsPresent: boolean; closedVocabularyValid: boolean } {
  let alphaCount = 0;
  let layoutCount = 0;
  let transformCount = 0;
  let layoutValid = false;
  let transformValid = false;
  let closedVocabularyValid = true;
  while (cursor.offset < cursor.end) {
    const { field, wireType } = readWireTag(cursor);
    if (field === 1 && wireType === 5) {
      alphaCount += 1;
      skipWireValue(cursor, wireType);
    } else if (field === 2 && wireType === 2) {
      layoutCount += 1;
      layoutValid = readCanonicalFixed32Fields(readWireMessage(cursor), [1, 2, 3, 4]);
    } else if (field === 3 && wireType === 2) {
      transformCount += 1;
      transformValid = readCanonicalFixed32Fields(readWireMessage(cursor), [1, 2, 3, 4, 5, 6]);
    } else {
      closedVocabularyValid = false;
      skipWireValue(cursor, wireType);
    }
  }
  return {
    requiredFrameFieldsPresent: alphaCount <= 1
    && layoutCount === 1
    && transformCount === 1
    && layoutValid
    && transformValid,
    closedVocabularyValid
  };
}

function readCanonicalFixed32Fields(cursor: WireCursor, allowedFields: readonly number[]): boolean {
  const counts = new Map<number, number>();
  let valid = true;
  while (cursor.offset < cursor.end) {
    const { field, wireType } = readWireTag(cursor);
    if (allowedFields.includes(field) && wireType === 5) {
      counts.set(field, (counts.get(field) ?? 0) + 1);
      skipWireValue(cursor, wireType);
    } else {
      valid = false;
      skipWireValue(cursor, wireType);
    }
  }
  return valid && [...counts.values()].every((count) => count === 1);
}

function wireCursor(bytes: Uint8Array, offset = 0, end = bytes.byteLength): WireCursor {
  if (offset < 0 || end < offset || end > bytes.byteLength) throw new Error("invalid wire bounds");
  return { bytes, offset, end };
}

function readWireTag(cursor: WireCursor): { field: number; wireType: number } {
  const tag = readWireVarint(cursor);
  const field = Math.floor(tag / 8);
  const wireType = tag % 8;
  if (field < 1) throw new Error("invalid wire field");
  return { field, wireType };
}

function readWireMessage(cursor: WireCursor): WireCursor {
  const length = readWireVarint(cursor);
  const end = cursor.offset + length;
  if (!Number.isSafeInteger(length) || end > cursor.end) throw new Error("invalid wire message");
  const nested = wireCursor(cursor.bytes, cursor.offset, end);
  cursor.offset = end;
  return nested;
}

function readWireBytes(cursor: WireCursor): Uint8Array {
  const length = readWireVarint(cursor);
  const end = cursor.offset + length;
  if (!Number.isSafeInteger(length) || end > cursor.end) throw new Error("invalid wire bytes");
  const bytes = cursor.bytes.subarray(cursor.offset, end);
  cursor.offset = end;
  return bytes;
}

function readWireString(cursor: WireCursor): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(readWireBytes(cursor));
}

function readWireVarint(cursor: WireCursor): number {
  let result = 0;
  let multiplier = 1;
  for (let index = 0; index < 10; index += 1) {
    if (cursor.offset >= cursor.end) throw new Error("truncated varint");
    const byte = cursor.bytes[cursor.offset];
    cursor.offset += 1;
    result += (byte & 0x7f) * multiplier;
    if (result > Number.MAX_SAFE_INTEGER) throw new Error("unsafe varint");
    if ((byte & 0x80) === 0) return result;
    multiplier *= 128;
  }
  throw new Error("overlong varint");
}

function skipWireValue(cursor: WireCursor, wireType: number): void {
  if (wireType === 0) {
    readWireVarint(cursor);
    return;
  }
  if (wireType === 1) {
    advanceWire(cursor, 8);
    return;
  }
  if (wireType === 2) {
    advanceWire(cursor, readWireVarint(cursor));
    return;
  }
  if (wireType === 5) {
    advanceWire(cursor, 4);
    return;
  }
  throw new Error("unsupported wire type");
}

function advanceWire(cursor: WireCursor, byteCount: number): void {
  if (!Number.isSafeInteger(byteCount) || byteCount < 0 || cursor.offset + byteCount > cursor.end) {
    throw new Error("truncated wire value");
  }
  cursor.offset += byteCount;
}

function canonicalizeTransform(value: SvgaFloatTransform, prefix: string): SvgaFloatTransform {
  const output = {} as SvgaFloatTransform;
  for (const field of TRANSFORM_FIELDS) output[field] = validateSvgaFloat32Source(value[field], `${prefix}.${field}`);
  return output;
}

function validateSvgaFloat32Source(value: number, field: string): number {
  canonicalizeSvgaFloat32(value, field);
  return Object.is(value, -0) ? 0 : value;
}

function mergeCanonicalKeyframe<T extends SvgaFloatTransform & { width: number; height: number }>(base: T, keyframe: SvgaFloatKeyframe): T {
  const merged = { ...base };
  for (const field of TRANSFORM_FIELDS) {
    if (typeof keyframe[field] === "number") merged[field] = keyframe[field] as T[TransformField];
  }
  return merged;
}

function decodedFloatRecordOrDefaultsIsCanonical(value: unknown, fields: readonly string[]): boolean {
  return isRecord(value) && fields.every((field) => decodedFloatFieldOrDefaultIsCanonical(value[field]));
}

function decodedFloatFieldOrDefaultIsCanonical(value: unknown): boolean {
  return value === undefined || decodedFloatFieldIsCanonical(value);
}

function decodedFloatFieldIsCanonical(value: unknown): boolean {
  return typeof value === "number"
    && Number.isFinite(value)
    && !Object.is(value, -0)
    && (value === 0
      || (Math.abs(value) >= SVGA_FLOAT_SERIALIZATION_CONTRACT.minimumNonzeroMagnitude
        && Math.abs(value) <= SVGA_FLOAT_SERIALIZATION_CONTRACT.maximumFiniteMagnitude));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
