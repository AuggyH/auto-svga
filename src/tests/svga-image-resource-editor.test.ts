import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { encode as encodeFastPng } from "fast-png";
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

  const indexedPng = createIndexedPng();
  const indexed = editor.validatePngReplacement(indexedPng);
  assert.equal(indexed.sha256, sha256(indexedPng));
  assert.equal(indexed.width, 2);
  assert.equal(indexed.height, 1);

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
  }], "fixture.svga", { milestoneId: "P3" });

  assert.equal(sha256(bytes), originalHash, "source bytes must remain unchanged");
  assert.notEqual(sha256(result.editedBytes), originalHash);
  assert.equal(result.session.dirty, true);
  assert.equal(result.session.exportState, "exported");
  assert.equal(result.session.replacements.img_sweep.replacementSha256, sha256(replacement));
  assert.equal(result.session.replacements.img_sweep.dimensionWarning, "replacement_dimensions_differ_from_original");

  const report = result.roundTripReport;
  assert.equal(report.schemaVersion, 2);
  assert.equal(report.milestoneId, "P3");
  assert.equal(report.sourceSha256, originalHash);
  assert.equal(report.sourceSha256AfterEditing, originalHash);
  assert.equal(report.replacedResourceKey, "img_sweep");
  assert.equal(report.originalResourceSha256, sha256(createTransparentPng(48, 96)));
  assert.equal(report.replacementSha256, sha256(replacement));
  assert.equal(report.exportedResourceSha256, sha256(replacement));
  assert.deepEqual(report.changedFields, ["images.img_sweep", "zlib_bytes", "protobuf_serialization"]);
  assert.deepEqual(report.unexpectedChanges, []);
  assert.equal(report.decodePassed, true);
  assert.equal(report.passed, true);
  assert.deepEqual(
    report.invariantChecks.map(({ code, passed }) => ({ code, passed })),
    [
      { code: "movie_version", passed: true },
      { code: "canvas_width", passed: true },
      { code: "canvas_height", passed: true },
      { code: "fps", passed: true },
      { code: "frame_count", passed: true },
      { code: "sprite_count", passed: true },
      { code: "sprite_order", passed: true },
      { code: "sprite_image_key", passed: true },
      { code: "sprite_matte_key", passed: true },
      { code: "sprite_frame_count", passed: true },
      { code: "frame_alpha", passed: true },
      { code: "frame_layout", passed: true },
      { code: "frame_transform", passed: true },
      { code: "frame_clip_path", passed: true },
      { code: "frame_shapes", passed: true },
      { code: "audio_count", passed: true },
      { code: "audio_entries", passed: true },
      { code: "image_resource_key_set", passed: true },
      { code: "untouched_image_hashes", passed: true },
      { code: "selected_resource_key_reference", passed: true },
      { code: "original_source_sha256_immutability", passed: true }
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

test("SVGA image editor round-trip v2 fails closed on granular non-image mutations", async () => {
  const editor = new SvgaImageResourceEditor();
  const sourceBytes = await createSvgaFixture();
  const replacement = createColoredPng(16, 16, [0, 255, 0, 255]);
  const mutatedBytes = await createSvgaFixture({
    version: "2.1",
    params: {
      viewBoxWidth: 481,
      viewBoxHeight: 97,
      fps: 30,
      frames: 49
    },
    images: {
      img_frame: createColoredPng(300, 300, [255, 0, 0, 255]),
      img_sweep: replacement,
      img_unused: createColoredPng(12, 12, [0, 0, 255, 255]),
      img_extra: createColoredPng(4, 4, [255, 255, 0, 255])
    },
    sprites: [
      {
        imageKey: "img_sweep",
        matteKey: "",
        frames: createFrames(12, { alpha: 0.25, txOffset: 10, layoutX: 7, clipPath: "M0 0L1 1", shapeCount: 1 })
      },
      {
        imageKey: "img_frame",
        matteKey: "img_extra",
        frames: createFrames(49, { alpha: 0.6, txOffset: 20, layoutX: 9 })
      },
      {
        imageKey: "img_extra",
        frames: createFrames(1)
      }
    ],
    audios: [{
      audioKey: "changed",
      startFrame: 2,
      endFrame: 10,
      startTime: 100,
      totalTime: 700
    }]
  });

  const report = await editor.validateRoundTrip(sourceBytes, mutatedBytes, [{
    resourceKey: "img_sweep",
    pngBytes: replacement
  }], { milestoneId: "P3" });

  assert.equal(report.schemaVersion, 2);
  assert.equal(report.passed, false);
  assert.equal(report.sourceSha256AfterEditing, report.sourceSha256);
  assert.deepEqual(
    report.invariantChecks
      .filter(({ passed }) => !passed)
      .map(({ code }) => code),
    [
      "movie_version",
      "canvas_width",
      "canvas_height",
      "fps",
      "frame_count",
      "sprite_count",
      "sprite_order",
      "sprite_image_key",
      "sprite_matte_key",
      "sprite_frame_count",
      "frame_alpha",
      "frame_layout",
      "frame_transform",
      "frame_clip_path",
      "frame_shapes",
      "audio_entries",
      "image_resource_key_set",
      "untouched_image_hashes"
    ]
  );
  assert.ok(report.invariantChecks.every((check) => "expected" in check && "actual" in check));
});

test("SVGA image editor reports P4 per-resource integrity for multiple replacements", async () => {
  const bytes = await createSvgaFixture();
  const originalHash = sha256(bytes);
  const editor = new SvgaImageResourceEditor();
  const replacementFrame = createColoredPng(300, 300, [0, 0, 255, 255]);
  const replacementSweep = createColoredPng(48, 96, [255, 255, 0, 255]);

  const result = await editor.replaceImages(bytes, [
    { resourceKey: "img_frame", pngBytes: replacementFrame },
    { resourceKey: "img_sweep", pngBytes: replacementSweep }
  ], "fixture.svga", { milestoneId: "P4", headCommit: "p4-test-head" });

  assert.equal(sha256(bytes), originalHash, "source bytes must remain unchanged");
  assert.equal(result.roundTripReport.schemaVersion, 3);
  assert.equal(result.roundTripReport.milestoneId, "P4");
  assert.equal(result.roundTripReport.headCommit, "p4-test-head");
  assert.equal(result.roundTripReport.replacementCount, 2);
  assert.deepEqual(result.roundTripReport.replacedResourceKeys, ["img_frame", "img_sweep"]);
  assert.deepEqual(result.roundTripReport.unchangedResourceKeys, ["img_unused"]);
  assert.deepEqual(
    result.roundTripReport.replacedResources.map((resource) => ({
      resourceKey: resource.resourceKey,
      replacementSha256: resource.replacementSha256,
      exportedResourceSha256: resource.exportedResourceSha256,
      passed: resource.passed
    })),
    [
      {
        resourceKey: "img_frame",
        replacementSha256: sha256(replacementFrame),
        exportedResourceSha256: sha256(replacementFrame),
        passed: true
      },
      {
        resourceKey: "img_sweep",
        replacementSha256: sha256(replacementSweep),
        exportedResourceSha256: sha256(replacementSweep),
        passed: true
      }
    ]
  );
  assert.equal(result.roundTripReport.passed, true);
  assert.deepEqual(result.roundTripReport.unexpectedChanges, []);
  assert.deepEqual(
    result.roundTripReport.changedFields,
    ["images.img_frame", "images.img_sweep", "zlib_bytes", "protobuf_serialization"]
  );
  assert.deepEqual(
    result.roundTripReport.invariantChecks
      .filter(({ code }) => code === "replaced_image_hashes" || code === "replacement_resource_key_references")
      .map(({ code, passed }) => ({ code, passed })),
    [
      { code: "replacement_resource_key_references", passed: true },
      { code: "replaced_image_hashes", passed: true }
    ]
  );
  assert.equal(result.session.replacements.img_frame.replacementSha256, sha256(replacementFrame));
  assert.equal(result.session.replacements.img_sweep.replacementSha256, sha256(replacementSweep));
  assert.equal(result.session.imageResources.filter(({ replacementStatus }) => replacementStatus === "replaced").length, 2);

  const inspected = await new NodeProtobufSvgaInspector().inspect(result.editedBytes);
  assert.deepEqual(
    Object.fromEntries(inspected.images.map(({ imageKey, bytes: imageBytes }) => [imageKey, sha256(imageBytes)])),
    {
      img_frame: sha256(replacementFrame),
      img_sweep: sha256(replacementSweep),
      img_unused: sha256(createTransparentPng(12, 12))
    }
  );
});

test("SVGA image editor does not mark P4 report passed with only one replacement", async () => {
  const bytes = await createSvgaFixture();
  const editor = new SvgaImageResourceEditor();
  const replacementFrame = createColoredPng(300, 300, [0, 0, 255, 255]);

  const result = await editor.replaceImages(bytes, [
    { resourceKey: "img_frame", pngBytes: replacementFrame }
  ], "fixture.svga", { milestoneId: "P4" });

  assert.equal(result.roundTripReport.schemaVersion, 3);
  assert.equal(result.roundTripReport.replacementCount, 1);
  assert.deepEqual(result.roundTripReport.unexpectedChanges, ["p4_minimum_replacement_count"]);
  assert.equal(result.roundTripReport.replacedResources.every((resource) => resource.passed), true);
  assert.equal(result.roundTripReport.passed, false);
});

test("SVGA image editor reports P5 batch mapping integrity for three replacements", async () => {
  const bytes = await createSvgaFixture();
  const editor = new SvgaImageResourceEditor();
  const replacements = [
    { resourceKey: "img_frame", pngBytes: createColoredPng(300, 300, [255, 0, 0, 255]), inputFileLabel: "img_frame.png" },
    { resourceKey: "img_sweep", pngBytes: createColoredPng(48, 96, [0, 255, 0, 255]), inputFileLabel: "img_sweep.png" },
    { resourceKey: "img_unused", pngBytes: createColoredPng(12, 12, [0, 0, 255, 255]), inputFileLabel: "img_unused.png" }
  ];

  const result = await editor.replaceImages(bytes, replacements.map(({ resourceKey, pngBytes }) => ({
    resourceKey,
    pngBytes
  })), "fixture.svga", {
    milestoneId: "P5",
    headCommit: "p5-test-head",
    batchTransactionId: "batch-test-1",
    batchReplacementSetDigest: "p5-batch-digest",
    batchMappings: replacements.map(({ resourceKey, pngBytes, inputFileLabel }) => ({
      inputFileLabel,
      inputSha256: sha256(pngBytes),
      mappingRuleId: "resource_key_exact",
      mappingStatus: "exact_match",
      resourceKey
    })),
    playbackPassed: true,
    canvasNonBlank: true
  });

  assert.equal(result.roundTripReport.schemaVersion, 4);
  assert.equal(result.roundTripReport.milestoneId, "P5");
  assert.equal(result.roundTripReport.headCommit, "p5-test-head");
  assert.equal(result.roundTripReport.batchTransactionId, "batch-test-1");
  assert.equal(result.roundTripReport.batchReplacementSetDigest, "p5-batch-digest");
  assert.equal(result.roundTripReport.appliedMappingCount, 3);
  assert.equal(result.roundTripReport.originalSourceUnchanged, true);
  assert.equal(result.roundTripReport.playbackPassed, true);
  assert.equal(result.roundTripReport.canvasNonBlank, true);
  assert.equal(result.roundTripReport.passed, true);
  assert.deepEqual(result.roundTripReport.unexpectedChanges, []);
  assert.deepEqual(result.roundTripReport.appliedMappings.map((mapping) => ({
    inputFileLabel: mapping.inputFileLabel,
    resourceKey: mapping.resourceKey,
    mappingRuleId: mapping.mappingRuleId,
    mappingStatus: mapping.mappingStatus,
    passed: mapping.passed
  })), [
    { inputFileLabel: "img_frame.png", resourceKey: "img_frame", mappingRuleId: "resource_key_exact", mappingStatus: "exact_match", passed: true },
    { inputFileLabel: "img_sweep.png", resourceKey: "img_sweep", mappingRuleId: "resource_key_exact", mappingStatus: "exact_match", passed: true },
    { inputFileLabel: "img_unused.png", resourceKey: "img_unused", mappingRuleId: "resource_key_exact", mappingStatus: "exact_match", passed: true }
  ]);
});

test("SVGA image editor allows P5 playback evidence to be bound by host preview", async () => {
  const editor = new SvgaImageResourceEditor();
  const bytes = await createSvgaFixture();
  const replacements = [
    { resourceKey: "img_frame", pngBytes: createColoredPng(300, 300, [255, 0, 0, 255]), inputFileLabel: "img_frame.png" },
    { resourceKey: "img_sweep", pngBytes: createColoredPng(48, 96, [0, 255, 0, 255]), inputFileLabel: "img_sweep.png" },
    { resourceKey: "img_unused", pngBytes: createColoredPng(12, 12, [0, 0, 255, 255]), inputFileLabel: "img_unused.png" }
  ];

  const result = await editor.replaceImages(bytes, replacements.map(({ resourceKey, pngBytes }) => ({
    resourceKey,
    pngBytes
  })), "fixture.svga", {
    milestoneId: "P5",
    batchTransactionId: "batch-preview-pending",
    batchMappings: replacements.map(({ resourceKey, pngBytes, inputFileLabel }) => ({
      inputFileLabel,
      inputSha256: sha256(pngBytes),
      mappingRuleId: "resource_key_exact",
      mappingStatus: "exact_match",
      resourceKey
    })),
    playbackPassed: false,
    canvasNonBlank: false
  });

  assert.equal(result.roundTripReport.schemaVersion, 4);
  assert.equal(result.roundTripReport.milestoneId, "P5");
  assert.equal(result.roundTripReport.passed, false);
  assert.deepEqual(result.roundTripReport.unexpectedChanges, [
    "p5_playback_smoke",
    "p5_canvas_nonblank"
  ]);
  assert.equal(result.roundTripReport.appliedMappings.every((mapping) => mapping.passed), true);
});

test("SVGA image editor rejects duplicate replacements for the same resource", async () => {
  const editor = new SvgaImageResourceEditor();
  const bytes = await createSvgaFixture();
  const replacement = createColoredPng(16, 16, [0, 255, 0, 255]);

  await assert.rejects(
    editor.replaceImages(bytes, [
      { resourceKey: "img_sweep", pngBytes: replacement },
      { resourceKey: "img_sweep", pngBytes: replacement }
    ], "fixture.svga", { milestoneId: "P4" }),
    (error) => error instanceof SvgaImageEditError && error.code === "duplicate_resource_replacement"
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

test("SVGA image editor rejects unsupported unknown protobuf fields", async () => {
  const editor = new SvgaImageResourceEditor();
  const bytesWithUnknownField = appendUnknownVarintField(await createSvgaFixture(), 99, 1);

  await assert.rejects(
    editor.createSession(bytesWithUnknownField, "unknown-field.svga"),
    (error) => error instanceof SvgaImageEditError
      && error.code === "unsupported_round_trip_file"
  );
  await assert.rejects(
    editor.replaceImages(bytesWithUnknownField, [{
      resourceKey: "img_sweep",
      pngBytes: createColoredPng(4, 4, [255, 0, 0, 255])
    }], "unknown-field.svga"),
    (error) => error instanceof SvgaImageEditError
      && error.code === "unsupported_round_trip_file"
  );
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
    sprites: overrides.sprites ?? [
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
    audios: overrides.audios ?? [{
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

function appendUnknownVarintField(sourceBytes: Uint8Array, fieldNumber: number, value: number): Uint8Array {
  return deflateSync(Buffer.concat([
    inflateSync(sourceBytes),
    encodeVarint((fieldNumber << 3) | 0),
    encodeVarint(value)
  ]));
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

function createFrames(
  count: number,
  options: Partial<{
    alpha: number;
    txOffset: number;
    layoutX: number;
    clipPath: string;
    shapeCount: number;
  }> = {}
): unknown[] {
  return Array.from({ length: count }, (_, index) => ({
    alpha: options.alpha ?? (index % 2 === 0 ? 1 : 0.8),
    layout: { x: options.layoutX ?? 1, y: 2, width: 10, height: 11 },
    transform: { a: 1, b: 0, c: 0, d: 1, tx: index + (options.txOffset ?? 0), ty: index + 1 },
    clipPath: options.clipPath ?? "",
    shapes: Array.from({ length: options.shapeCount ?? 0 }, () => ({
      type: 1,
      rect: { x: 0, y: 0, width: 1, height: 1 }
    }))
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

function createIndexedPng(): Uint8Array {
  return encodeFastPng({
    width: 2,
    height: 1,
    data: Uint8Array.from([0, 1]),
    channels: 1,
    depth: 8,
    palette: [
      [255, 0, 0, 255],
      [0, 255, 0, 255]
    ]
  });
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
