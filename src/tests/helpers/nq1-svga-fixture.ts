import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";
import protobuf from "protobufjs";
import {
  createTransparentImage,
  encodeRgbaPng,
  setPixel
} from "../../utils/png-writer.js";

export interface Nq1SvgaFixtureCase {
  fixtureId: string;
  seed: number;
  resourceCount: number;
  expectedSupported: boolean;
  expectedUnsupportedReason: string | null;
}

export interface Nq1GeneratedSvgaFixture {
  fixtureId: string;
  resourceCount: number;
  spriteCount: number;
  frameCount: number;
  resourceKeys: readonly string[];
  resourceHashes: Readonly<Record<string, string>>;
  expectedSupported: boolean;
  expectedUnsupportedReason: string | null;
  generatedSha256: string;
  sourceGeneratorVersion: string;
  bytes: Uint8Array;
  featureTags: readonly string[];
}

export const nq1FixtureGeneratorVersion = "nq1-fixture-generator-v1";

export const NQ1_FIXTURE_MATRIX_CASES: readonly Nq1SvgaFixtureCase[] = [
  { fixtureId: "nq1-r1-static", seed: 101, resourceCount: 1, expectedSupported: true, expectedUnsupportedReason: null },
  { fixtureId: "nq1-r2-shared", seed: 202, resourceCount: 2, expectedSupported: true, expectedUnsupportedReason: null },
  { fixtureId: "nq1-r3-unused", seed: 303, resourceCount: 3, expectedSupported: true, expectedUnsupportedReason: null },
  { fixtureId: "nq1-r5-varied", seed: 505, resourceCount: 5, expectedSupported: true, expectedUnsupportedReason: null },
  { fixtureId: "nq1-r10-sequence", seed: 1010, resourceCount: 10, expectedSupported: true, expectedUnsupportedReason: null },
  { fixtureId: "nq1-r25-stress", seed: 2525, resourceCount: 25, expectedSupported: true, expectedUnsupportedReason: null },
  { fixtureId: "nq1-unsupported-unknown-field", seed: 909, resourceCount: 3, expectedSupported: false, expectedUnsupportedReason: "unsupported_unknown_protobuf_field" }
];

export async function createNq1SvgaFixture(
  config: Nq1SvgaFixtureCase
): Promise<Nq1GeneratedSvgaFixture> {
  const root = await protobuf.load(protoPath());
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const resourceKeys = createResourceKeys(config.resourceCount);
  const images = Object.fromEntries(resourceKeys.map((resourceKey, index) => [
    resourceKey,
    createResourcePng(config.seed, index, resourceKey)
  ]));
  const sprites = createSprites(resourceKeys, config.seed);
  const payload = {
    version: "2.0",
    params: {
      viewBoxWidth: 300,
      viewBoxHeight: 300,
      fps: 24,
      frames: Math.max(...sprites.map(({ frames }) => frames.length), 1)
    },
    images,
    sprites,
    audios: []
  };
  const verificationError = MovieEntity.verify(payload);
  if (verificationError) {
    throw new Error(`NQ1 fixture verification failed: ${verificationError}`);
  }
  let bytes: Uint8Array = Uint8Array.from(deflateSync(MovieEntity.encode(MovieEntity.create(payload)).finish()));
  if (!config.expectedSupported) {
    bytes = appendUnknownVarintField(bytes, 99, 1);
  }
  return {
    fixtureId: config.fixtureId,
    resourceCount: resourceKeys.length,
    spriteCount: sprites.length,
    frameCount: payload.params.frames,
    resourceKeys,
    resourceHashes: Object.fromEntries(resourceKeys.map((key) => [key, sha256(images[key])])),
    expectedSupported: config.expectedSupported,
    expectedUnsupportedReason: config.expectedUnsupportedReason,
    generatedSha256: sha256(bytes),
    sourceGeneratorVersion: nq1FixtureGeneratorVersion,
    bytes,
    featureTags: createFeatureTags(config, resourceKeys, sprites)
  };
}

export function fixtureManifestRows(fixtures: readonly Nq1GeneratedSvgaFixture[]): readonly Record<string, unknown>[] {
  return fixtures.map((fixture) => ({
    fixtureId: fixture.fixtureId,
    resourceCount: fixture.resourceCount,
    spriteCount: fixture.spriteCount,
    frameCount: fixture.frameCount,
    resourceKeys: fixture.resourceKeys,
    resourceHashes: fixture.resourceHashes,
    expectedSupported: fixture.expectedSupported,
    expectedUnsupportedReason: fixture.expectedUnsupportedReason,
    generatedSha256: fixture.generatedSha256,
    sourceGeneratorVersion: fixture.sourceGeneratorVersion,
    featureTags: fixture.featureTags
  }));
}

function createResourceKeys(resourceCount: number): string[] {
  const base = Array.from({ length: resourceCount }, (_, index) => `img_resource_${String(index + 1).padStart(2, "0")}`);
  if (resourceCount >= 5) {
    base[1] = "img_动画_02";
    base[2] = "img_resource_with_a_long_stable_key_03";
    base[3] = "img_matte_mask_04";
  }
  return base;
}

function createResourcePng(seed: number, index: number, resourceKey: string): Buffer {
  const width = 12 + ((seed + index * 17) % 37);
  const height = 10 + ((seed + index * 23) % 41);
  const image = createTransparentImage(width, height);
  const transparentEdge = index % 3 === 0 || resourceKey.includes("matte");
  const startX = transparentEdge && width > 4 ? 1 : 0;
  const startY = transparentEdge && height > 4 ? 1 : 0;
  const endX = transparentEdge && width > 4 ? width - 1 : width;
  const endY = transparentEdge && height > 4 ? height - 1 : height;
  const color = colorFor(seed, index);
  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const alpha = resourceKey.includes("matte") ? 180 : 255;
      setPixel(image, x, y, [color[0], (color[1] + x) % 256, (color[2] + y) % 256, alpha]);
    }
  }
  return encodeRgbaPng(image);
}

function createSprites(resourceKeys: readonly string[], seed: number): Array<{
  imageKey: string;
  matteKey?: string;
  frames: unknown[];
}> {
  const usedKeys = resourceKeys.length >= 3 ? resourceKeys.slice(0, -1) : resourceKeys;
  const sprites = usedKeys.map((imageKey, index) => ({
    imageKey,
    matteKey: resourceKeys.length >= 5 && index === 1 ? resourceKeys[3] : "",
    frames: createFrames(index >= 2 ? 24 : 12, seed, index)
  }));
  if (resourceKeys.length >= 2) {
    sprites.push({
      imageKey: resourceKeys[0],
      matteKey: "",
      frames: createFrames(18, seed, 100)
    });
  }
  return sprites;
}

function createFrames(count: number, seed: number, spriteIndex: number): unknown[] {
  return Array.from({ length: count }, (_, frameIndex) => ({
    alpha: frameIndex % 2 === 0 ? 1 : 0.82,
    layout: {
      x: (seed + spriteIndex * 7) % 40,
      y: (seed + spriteIndex * 11) % 40,
      width: 20 + (spriteIndex % 5),
      height: 22 + (spriteIndex % 7)
    },
    transform: {
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      tx: 4 + spriteIndex * 3 + frameIndex,
      ty: 6 + spriteIndex * 2
    },
    clipPath: "",
    shapes: []
  }));
}

function createFeatureTags(
  config: Nq1SvgaFixtureCase,
  resourceKeys: readonly string[],
  sprites: readonly { imageKey: string; matteKey?: string; frames: readonly unknown[] }[]
): string[] {
  const tags = new Set<string>(["static_resource", "opaque_png", "transparent_edge_png"]);
  if (resourceKeys.length >= 2) tags.add("shared_resource");
  if (resourceKeys.length >= 3) tags.add("unused_resource");
  if (resourceKeys.length >= 3) tags.add("multiple_resource_keys");
  if (resourceKeys.some((key) => /[^\x00-\x7F]/.test(key))) tags.add("unicode_resource_key");
  if (resourceKeys.some((key) => key.length > 24)) tags.add("long_resource_key");
  if (resourceKeys.length >= 2) tags.add("same_dimensions_different_images");
  if (resourceKeys.length >= 3) tags.add("different_dimensions_png");
  if (sprites.some(({ matteKey }) => matteKey)) tags.add("matte_key_reference");
  if (sprites.length > 1) tags.add("multi_sprite_positions");
  if (sprites.some(({ frames }) => frames.length > 1)) tags.add("multi_frame_sprite");
  if (!config.expectedSupported) tags.add("unsupported_unknown_field_boundary");
  return [...tags].sort();
}

function appendUnknownVarintField(sourceBytes: Uint8Array, fieldNumber: number, value: number): Uint8Array {
  return Uint8Array.from(deflateSync(Buffer.concat([
    inflateSync(sourceBytes),
    encodeVarint((fieldNumber << 3) | 0),
    encodeVarint(value)
  ])));
}

function encodeVarint(value: number): Buffer {
  const bytes: number[] = [];
  let remaining = value >>> 0;
  while (remaining >= 0x80) {
    bytes.push((remaining & 0x7f) | 0x80);
    remaining >>>= 7;
  }
  bytes.push(remaining);
  return Buffer.from(bytes);
}

function colorFor(seed: number, index: number): [number, number, number] {
  return [
    (seed + index * 53) % 256,
    (seed * 3 + index * 71) % 256,
    (seed * 5 + index * 97) % 256
  ];
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function protoPath(): string {
  return fileURLToPath(new URL("../../../proto/svga.proto", import.meta.url));
}
