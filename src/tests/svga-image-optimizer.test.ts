import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import test from "node:test";
import protobuf from "protobufjs";
import {
  createTransparentImage,
  encodeRgbaPng,
  setPixel
} from "../utils/png-writer.js";
import {
  NodeProtobufSvgaInspector,
  optimizeSvgaImageResources,
  SvgaImageOptimizationError
} from "../workbench/svga/index.js";

test("SVGA image optimizer removes unreferenced images and redirects byte-identical duplicates", async () => {
  const duplicateBytes = createColoredPng(16, 16, [255, 0, 0, 255]);
  const sweepBytes = createColoredPng(8, 16, [0, 255, 0, 255]);
  const unusedBytes = createColoredPng(4, 4, [0, 0, 255, 255]);
  const sourceBytes = await createSvgaFixture({
    images: {
      img_frame: duplicateBytes,
      img_frame_copy: duplicateBytes,
      img_sweep: sweepBytes,
      img_unused: unusedBytes
    },
    sprites: [
      { imageKey: "img_frame", frames: createFrames(4) },
      { imageKey: "img_frame_copy", matteKey: "img_sweep", frames: createFrames(4) }
    ]
  });
  const sourceHash = sha256(sourceBytes);

  const result = await optimizeSvgaImageResources(sourceBytes, { sourceName: "fixture.svga" });

  assert.equal(sha256(sourceBytes), sourceHash, "source bytes must remain unchanged");
  assert.notEqual(sha256(result.optimizedBytes), sourceHash);
  assert.equal(result.report.schemaVersion, 1);
  assert.equal(result.report.optimizationId, "svga-safe-image-optimizer-v1");
  assert.equal(result.report.sourceSha256, sourceHash);
  assert.equal(result.report.sourceSha256AfterOptimization, sourceHash);
  assert.equal(result.report.sourceUnchanged, true);
  assert.equal(result.report.saveAsRequired, true);
  assert.equal(result.report.passed, true);
  assert.equal(result.report.originalImageCount, 4);
  assert.equal(result.report.optimizedImageCount, 2);
  assert.deepEqual(result.report.removedResourceKeys, ["img_frame_copy", "img_unused"]);
  assert.deepEqual(result.report.redirectedResourceReferences, [{
    fromResourceKey: "img_frame_copy",
    toResourceKey: "img_frame",
    originalSha256: sha256(duplicateBytes),
    usageCountBefore: 1
  }]);
  assert.deepEqual(
    result.report.actions.map(({ type, resourceKey, canonicalResourceKey }) => ({
      type,
      resourceKey,
      canonicalResourceKey
    })),
    [
      {
        type: "deduplicate_encoded_image",
        resourceKey: "img_frame_copy",
        canonicalResourceKey: "img_frame"
      },
      {
        type: "remove_unreferenced_image",
        resourceKey: "img_unused",
        canonicalResourceKey: undefined
      }
    ]
  );
  assert.equal(result.report.estimatedFileSizeSavingsBytes, duplicateBytes.byteLength + unusedBytes.byteLength);
  assert.deepEqual(result.report.changedFields, [
    "images.img_frame_copy",
    "images.img_unused",
    "sprite_references.img_frame_copy->img_frame",
    "zlib_bytes",
    "protobuf_serialization"
  ]);
  assert.equal(result.report.invariantChecks.every(({ passed }) => passed), true);

  const inspected = await new NodeProtobufSvgaInspector().inspect(result.optimizedBytes);
  assert.deepEqual(
    inspected.images.map(({ imageKey }) => imageKey).sort(),
    ["img_frame", "img_sweep"]
  );
  assert.deepEqual(
    inspected.sprites.map(({ imageKey, matteKey }) => ({ imageKey, matteKey })),
    [
      { imageKey: "img_frame", matteKey: "" },
      { imageKey: "img_frame", matteKey: "img_sweep" }
    ]
  );
  assert.deepEqual(
    Object.fromEntries(inspected.images.map(({ imageKey, bytes }) => [imageKey, sha256(bytes)])),
    {
      img_frame: sha256(duplicateBytes),
      img_sweep: sha256(sweepBytes)
    }
  );
});

test("SVGA image optimizer fails closed when no safe optimization is available", async () => {
  const sourceBytes = await createSvgaFixture({
    images: {
      img_frame: createColoredPng(16, 16, [255, 0, 0, 255]),
      img_sweep: createColoredPng(8, 16, [0, 255, 0, 255])
    },
    sprites: [
      { imageKey: "img_frame", frames: createFrames(4) },
      { imageKey: "img_sweep", frames: createFrames(4) }
    ]
  });

  await assert.rejects(
    optimizeSvgaImageResources(sourceBytes),
    (error) => error instanceof SvgaImageOptimizationError
      && error.code === "optimization_not_applicable"
  );
});

test("SVGA image optimizer prunes all-zero runtime sprites and newly unreferenced images", async () => {
  const visibleBytes = createColoredPng(16, 16, [255, 0, 0, 255]);
  const invisibleBytes = createColoredPng(8, 8, [0, 0, 0, 0]);
  const sourceBytes = await createSvgaFixture({
    images: {
      img_visible: visibleBytes,
      img_invisible: invisibleBytes
    },
    sprites: [
      { imageKey: "img_visible", frames: createFrames(4) },
      { imageKey: "img_invisible", frames: createFrames(4, { alpha: 0 }) }
    ]
  });

  const result = await optimizeSvgaImageResources(sourceBytes, { sourceName: "structure.svga" });

  assert.equal(result.report.passed, true);
  assert.equal(result.report.originalSpriteCount, 2);
  assert.equal(result.report.optimizedSpriteCount, 1);
  assert.equal(result.report.originalFrameEntityCount, 8);
  assert.equal(result.report.optimizedFrameEntityCount, 4);
  assert.equal(result.report.removedAllZeroSpriteCount, 1);
  assert.equal(result.report.removedAllZeroFrameEntityCount, 4);
  assert.deepEqual(result.report.removedResourceKeys, ["img_invisible"]);
  assert.deepEqual(
    result.report.actions.map(({ type, resourceKey, removedFrameCount }) => ({ type, resourceKey, removedFrameCount })),
    [
      { type: "remove_all_zero_sprite", resourceKey: "img_invisible", removedFrameCount: 4 },
      { type: "remove_unreferenced_image", resourceKey: "img_invisible", removedFrameCount: undefined }
    ]
  );
  assert.ok(result.report.changedFields.includes("sprites.1"));

  const inspected = await new NodeProtobufSvgaInspector().inspect(result.optimizedBytes);
  assert.deepEqual(inspected.images.map(({ imageKey }) => imageKey), ["img_visible"]);
  assert.deepEqual(inspected.sprites.map(({ imageKey, frameCount }) => ({ imageKey, frameCount })), [{
    imageKey: "img_visible",
    frameCount: 4
  }]);
});

async function createSvgaFixture(overrides: Partial<{
  version: string;
  params: {
    viewBoxWidth: number;
    viewBoxHeight: number;
    fps: number;
    frames: number;
  };
  images: Record<string, Uint8Array>;
  sprites: Array<{
    imageKey?: string;
    frames?: unknown[];
    matteKey?: string;
  }>;
  audios: unknown[];
}> = {}): Promise<Uint8Array> {
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
      img_frame: createColoredPng(16, 16, [255, 0, 0, 255]),
      img_sweep: createColoredPng(8, 16, [0, 255, 0, 255])
    },
    sprites: overrides.sprites ?? [
      { imageKey: "img_frame", frames: createFrames(4) },
      { imageKey: "img_sweep", frames: createFrames(4) }
    ],
    audios: overrides.audios ?? []
  };
  const verificationError = MovieEntity.verify(payload);
  assert.equal(verificationError, null);
  return deflateSync(MovieEntity.encode(MovieEntity.create(payload)).finish());
}

function createFrames(count: number, options: { alpha?: number } = {}): unknown[] {
  return Array.from({ length: count }, (_, index) => ({
    alpha: options.alpha ?? (index % 2 === 0 ? 1 : 0.8),
    layout: { x: 1, y: 2, width: 10, height: 11 },
    transform: { a: 1, b: 0, c: 0, d: 1, tx: index, ty: index + 1 },
    clipPath: "",
    shapes: []
  }));
}

function createColoredPng(width: number, height: number, rgba: [number, number, number, number]): Buffer {
  const image = createTransparentImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(image, x, y, rgba);
    }
  }
  return encodeRgbaPng(image);
}

function protoPath(): string {
  return fileURLToPath(new URL("../../proto/svga.proto", import.meta.url));
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
