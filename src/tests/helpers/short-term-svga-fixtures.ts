import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import protobuf from "protobufjs";
import {
  createTransparentImage,
  encodeRgbaPng,
  setPixel
} from "../../utils/png-writer.js";

export interface ShortTermSvgaFixtureOverrides {
  version?: string;
  params?: {
    viewBoxWidth: number;
    viewBoxHeight: number;
    fps: number;
    frames: number;
  };
  images?: Record<string, Uint8Array>;
  sprites?: Array<{
    imageKey?: string;
    frames?: unknown[];
    matteKey?: string;
  }>;
  audios?: unknown[];
}

export async function createShortTermOptimizableSvgaFixture(): Promise<Uint8Array> {
  return createShortTermSvgaFixture({
    images: {
      img_frame: createShortTermColoredPng(16, 16, [255, 0, 0, 255]),
      img_frame_copy: createShortTermColoredPng(16, 16, [255, 0, 0, 255]),
      img_unused: createShortTermColoredPng(4, 4, [0, 0, 255, 255])
    },
    sprites: [
      { imageKey: "img_frame", frames: createShortTermFrames(4) },
      { imageKey: "img_frame_copy", frames: createShortTermFrames(4) }
    ]
  });
}

export async function createShortTermSvgaFixture(
  overrides: Partial<ShortTermSvgaFixtureOverrides> = {}
): Promise<Uint8Array> {
  const root = await protobuf.load(protoPath());
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const payload = {
    version: overrides.version ?? "2.0",
    params: overrides.params ?? {
      viewBoxWidth: 128,
      viewBoxHeight: 128,
      fps: 24,
      frames: 48
    },
    images: overrides.images ?? {
      img_frame: createShortTermColoredPng(16, 16, [255, 0, 0, 255])
    },
    sprites: overrides.sprites ?? [
      { imageKey: "img_frame", frames: createShortTermFrames(4) }
    ],
    audios: overrides.audios ?? []
  };
  const verificationError = MovieEntity.verify(payload);
  assert.equal(verificationError, null);
  return deflateSync(MovieEntity.encode(MovieEntity.create(payload)).finish());
}

export function createShortTermFrames(count: number): unknown[] {
  return Array.from({ length: count }, (_, index) => ({
    alpha: index % 2 === 0 ? 1 : 0.8,
    layout: { x: 1, y: 2, width: 10, height: 11 },
    transform: { a: 1, b: 0, c: 0, d: 1, tx: index, ty: index + 1 },
    clipPath: "",
    shapes: []
  }));
}

export function createShortTermColoredPng(
  width: number,
  height: number,
  rgba: [number, number, number, number]
): Buffer {
  const image = createTransparentImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(image, x, y, rgba);
    }
  }
  return encodeRgbaPng(image);
}

function protoPath(): string {
  return fileURLToPath(new URL("../../../proto/svga.proto", import.meta.url));
}
