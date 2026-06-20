import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";
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
  SvgaImageEditError,
  SvgaImageResourceEditor
} from "../workbench/svga/index.js";

test("SVGA image editor discovers stable resources, dimensions, hashes, and usage count", async () => {
  const bytes = await createSvgaFixture();
  const editor = new SvgaImageResourceEditor();
  const session = await editor.createSession(bytes, "fixture.svga");

  assert.equal(session.sourceFile.name, "fixture.svga");
  assert.equal(session.sourceFile.sizeBytes, bytes.byteLength);
  assert.equal(session.sourceFile.sha256, sha256(bytes));
  assert.equal(session.parsedMovie.viewBoxWidth, 480);
  assert.equal(session.parsedMovie.viewBoxHeight, 96);
  assert.equal(session.parsedMovie.fps, 24);
  assert.equal(session.parsedMovie.frames, 48);
  assert.equal(session.parsedMovie.spriteCount, 2);
  assert.equal(session.parsedMovie.imageCount, 3);
  assert.deepEqual(
    session.imageResources.map(({ resourceKey }) => resourceKey),
    ["img_frame", "img_sweep", "img_unused"]
  );
  assert.deepEqual(
    session.imageResources.map(({ decodedWidth, decodedHeight, usageCount }) => ({
      decodedWidth,
      decodedHeight,
      usageCount
    })),
    [
      { decodedWidth: 300, decodedHeight: 300, usageCount: 2 },
      { decodedWidth: 48, decodedHeight: 96, usageCount: 1 },
      { decodedWidth: 12, decodedHeight: 12, usageCount: 0 }
    ]
  );
  assert.equal(session.dirty, false);
  assert.equal(session.exportState, "idle");
});

test("SVGA image editor validates PNG replacements", async () => {
  const editor = new SvgaImageResourceEditor();
  const png = createColoredPng(8, 6, [255, 0, 0, 255]);
  const result = editor.validatePngReplacement(png);

  assert.equal(result.sha256, sha256(png));
  assert.equal(result.sizeBytes, png.byteLength);
  assert.equal(result.width, 8);
  assert.equal(result.height, 6);

  assertEditError(() => editor.validatePngReplacement(Uint8Array.from([1, 2, 3])), "replacement_not_png");
  assertEditError(() => editor.validatePngReplacement(corruptPngWithSize(2, 2)), "replacement_png_decode_failed");
  assertEditError(
    () => editor.validatePngReplacement(png, { maxInputBytes: 1 }),
    "replacement_png_too_large"
  );
  assertEditError(
    () => editor.validatePngReplacement(png, { maxPixels: 4 }),
    "replacement_png_dimensions_too_large"
  );
});

test("SVGA image editor replaces selected PNG bytes and preserves round-trip invariants", async () => {
  const bytes = await createSvgaFixture();
  const originalHash = sha256(bytes);
  const editor = new SvgaImageResourceEditor();
  const replacement = createColoredPng(16, 16, [0, 255, 0, 255]);
  const result = await editor.replaceImages(bytes, [{
    resourceKey: "img_sweep",
    pngBytes: replacement
  }], "fixture.svga");

  assert.equal(sha256(bytes), originalHash, "source bytes must remain unchanged");
  assert.notEqual(sha256(result.editedBytes), originalHash);
  assert.equal(result.session.dirty, true);
  assert.equal(result.session.exportState, "exported");
  assert.equal(result.session.replacements.img_sweep.replacementSha256, sha256(replacement));
  assert.equal(result.session.replacements.img_sweep.dimensionWarning, "replacement_dimensions_differ_from_original");

  const report = result.roundTripReport;
  assert.equal(report.replacedResourceKey, "img_sweep");
  assert.equal(report.originalResourceSha256, sha256(createTransparentPng(48, 96)));
  assert.equal(report.replacementSha256, sha256(replacement));
  assert.equal(report.exportedResourceSha256, sha256(replacement));
  assert.deepEqual(report.unexpectedChanges, []);
  assert.equal(report.decodePassed, true);
  assert.equal(report.passed, true);
  assert.deepEqual(
    report.invariantChecks.map(({ code, passed }) => ({ code, passed })),
    [
      { code: "version", passed: true },
      { code: "params", passed: true },
      { code: "sprites", passed: true },
      { code: "audios", passed: true },
      { code: "image_keys", passed: true },
      { code: "untouched_image_hashes", passed: true }
    ]
  );

  const inspected = await new NodeProtobufSvgaInspector().inspect(result.editedBytes);
  assert.equal(inspected.params.viewBoxWidth, 480);
  assert.equal(inspected.params.viewBoxHeight, 96);
  assert.equal(inspected.params.fps, 24);
  assert.equal(inspected.params.frames, 48);
  assert.deepEqual(inspected.sprites.map(({ imageKey, matteKey, frameCount }) => ({ imageKey, matteKey, frameCount })), [
    { imageKey: "img_frame", matteKey: "", frameCount: 48 },
    { imageKey: "img_sweep", matteKey: "img_frame", frameCount: 24 }
  ]);
  assert.deepEqual(
    Object.fromEntries(inspected.images.map(({ imageKey, bytes: imageBytes }) => [imageKey, sha256(imageBytes)])),
    {
      img_frame: sha256(createTransparentPng(300, 300)),
      img_sweep: sha256(replacement),
      img_unused: sha256(createTransparentPng(12, 12))
    }
  );
});

test("SVGA image editor rejects missing resources and SVGA with no images", async () => {
  const editor = new SvgaImageResourceEditor();
  const bytes = await createSvgaFixture();
  await assert.rejects(
    editor.replaceImages(bytes, [{ resourceKey: "missing", pngBytes: createColoredPng(4, 4, [0, 0, 255, 255]) }]),
    (error) => error instanceof SvgaImageEditError && error.code === "resource_not_found"
  );

  await assert.rejects(
    editor.createSession(await createSvgaFixture({ images: {} })),
    (error) => error instanceof SvgaImageEditError && error.code === "svga_no_image_resources"
  );
});

async function createSvgaFixture(overrides: Partial<{ images: Record<string, Uint8Array> }> = {}): Promise<Uint8Array> {
  const root = await protobuf.load(protoPath());
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const payload = {
    version: "2.0",
    params: {
      viewBoxWidth: 480,
      viewBoxHeight: 96,
      fps: 24,
      frames: 48
    },
    images: overrides.images ?? {
      img_frame: createTransparentPng(300, 300),
      img_sweep: createTransparentPng(48, 96),
      img_unused: createTransparentPng(12, 12)
    },
    sprites: [
      {
        imageKey: "img_frame",
        frames: createFrames(48)
      },
      {
        imageKey: "img_sweep",
        matteKey: "img_frame",
        frames: createFrames(24)
      }
    ],
    audios: [{
      audioKey: "silent",
      startFrame: 0,
      endFrame: 12,
      startTime: 0,
      totalTime: 500
    }]
  };
  const verificationError = MovieEntity.verify(payload);
  assert.equal(verificationError, null);
  return deflateSync(MovieEntity.encode(MovieEntity.create(payload)).finish());
}

function createFrames(count: number): unknown[] {
  return Array.from({ length: count }, (_, index) => ({
    alpha: index % 2 === 0 ? 1 : 0.8,
    layout: { x: 1, y: 2, width: 10, height: 11 },
    transform: { a: 1, b: 0, c: 0, d: 1, tx: index, ty: index + 1 },
    clipPath: "",
    shapes: []
  }));
}

function createTransparentPng(width: number, height: number): Buffer {
  return encodeRgbaPng(createTransparentImage(width, height));
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

function corruptPngWithSize(width: number, height: number): Uint8Array {
  const bytes = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  bytes[24] = 8;
  bytes[25] = 6;
  return bytes;
}

function assertEditError(action: () => unknown, code: string): void {
  assert.throws(action, (error) => (
    error instanceof SvgaImageEditError
    && error.code === code
  ));
}

function protoPath(): string {
  return fileURLToPath(new URL("../../proto/svga.proto", import.meta.url));
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
