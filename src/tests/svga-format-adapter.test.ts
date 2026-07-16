import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import test from "node:test";
import protobuf from "protobufjs";
import { validateMvpSvgaOutput } from "../mvp/svga-exporter.js";
import { Sha256ResourceHasher } from "../hosts/sha256-resource-hasher.js";
import { createTransparentImage, encodeRgbaPng } from "../utils/png-writer.js";
import type { MotionAssetSource } from "../workbench/contracts.js";
import {
  NodeProtobufSvgaInspector,
  SvgaFormatAdapter
} from "../workbench/svga/index.js";

test("SVGA FormatAdapter preserves current protobuf inspection metadata", async () => {
  const bytes = await createSvgaFixture();
  const beforeHash = sha256(bytes);
  const inspector = new NodeProtobufSvgaInspector();
  const reference = await inspector.inspect(bytes);
  const adapter = new SvgaFormatAdapter(inspector);
  const result = await adapter.parse(sourceFromBytes("fixture.svga", bytes));

  assert.equal(result.issues.length, 0);
  assert.ok(result.value);
  const asset = result.value;

  assert.deepEqual(asset.dimensions, {
    width: reference.params.viewBoxWidth,
    height: reference.params.viewBoxHeight
  });
  assert.equal(asset.timing.fps, reference.params.fps);
  assert.equal(asset.timing.frameCount, reference.params.frames);
  assert.equal(asset.timing.durationMs, (reference.params.frames / reference.params.fps) * 1000);
  assert.equal(asset.resources.length, reference.images.length);
  assert.equal(asset.layers.length, reference.sprites.length);
  assert.deepEqual(
    asset.resources.map(({ id }) => id),
    reference.images.map(({ imageKey }) => imageKey)
  );
  assert.deepEqual(
    asset.resources.map(({ sizeBytes }) => sizeBytes),
    reference.images.map(({ bytes: imageBytes }) => imageBytes.byteLength)
  );
  assert.deepEqual(
    asset.resources.map(({ dimensions }) => dimensions),
    [
      { width: 300, height: 300 },
      { width: 48, height: 96 }
    ]
  );
  assert.deepEqual(
    asset.resources.map(({ metadata }) => metadata?.imageFormat),
    ["png", "png"]
  );
  assert.deepEqual(
    asset.resources.map(({ role }) => role),
    ["mask_or_matte", "static_image"]
  );
  assert.deepEqual(
    asset.resources.map(({ metadata }) => metadata?.roleEvidence),
    [["referenced_by_matteKey"], ["referenced_by_sprite"]]
  );
  assert.deepEqual(
    asset.layers.map(({ resourceIds }) => resourceIds),
    reference.sprites.map(({ imageKey }) => imageKey ? [imageKey] : [])
  );
  assert.deepEqual(
    asset.layers.map(({ metadata }) => metadata?.imageKey),
    reference.sprites.map(({ imageKey }) => imageKey)
  );
  assert.deepEqual(
    asset.layers.map(({ metadata }) => metadata?.frameCount),
    reference.sprites.map(({ frameCount }) => frameCount)
  );
  assert.deepEqual(
    asset.layers.map(({ metadata }) => metadata?.matteKey),
    reference.sprites.map(({ matteKey }) => matteKey)
  );
  assert.equal(asset.metadata?.version, reference.version);
  assert.equal(asset.metadata?.imageCount, reference.images.length);
  assert.equal(asset.metadata?.spriteCount, reference.sprites.length);
  assert.equal(asset.metadata?.audioCount, reference.audioCount);
  assert.equal(sha256(bytes), beforeHash, "inspection must not mutate source bytes");
});

test("SVGA FormatAdapter probe recognizes valid SVGA bytes", async () => {
  const bytes = await createSvgaFixture();
  const adapter = new SvgaFormatAdapter(new NodeProtobufSvgaInspector());
  const result = await adapter.probe(sourceFromBytes("fixture.svga", bytes));

  assert.equal(result.format, "svga");
  assert.equal(result.confidence, 1);
  assert.deepEqual(result.issues, []);
});

test("SVGA FormatAdapter accepts host-provided encoded resource hashes", async () => {
  const bytes = await createSvgaFixture();
  const inspector = new NodeProtobufSvgaInspector();
  const reference = await inspector.inspect(bytes);
  const adapter = new SvgaFormatAdapter(
    inspector,
    undefined,
    new Sha256ResourceHasher()
  );
  const result = await adapter.parse(sourceFromBytes("fixture.svga", bytes));

  assert.ok(result.value);
  assert.deepEqual(
    result.value.resources.map(({ contentHash }) => contentHash),
    reference.images.map(({ bytes: imageBytes }) => ({
      algorithm: "sha256",
      value: sha256(imageBytes),
      scope: "encoded_bytes"
    }))
  );
});

test("SVGA FormatAdapter exposes designer-named imageKeys as replaceable without promoting automatic or matte resources", async () => {
  const bytes = await createNamedReplaceableSvgaFixture();
  const adapter = new SvgaFormatAdapter(new NodeProtobufSvgaInspector());
  const result = await adapter.parse(sourceFromBytes("wide-replaceable.svga", bytes));

  assert.ok(result.value);
  assert.deepEqual(
    result.value.resources.map(({ id, replaceable }) => ({ id, replaceable: replaceable === true })),
    [
      { id: "profile_frame", replaceable: true },
      { id: "img_001", replaceable: false },
      { id: "designer_matte", replaceable: false },
      { id: "internal_unused_designer_badge", replaceable: false }
    ]
  );
});

test("SVGA FormatAdapter counts match the existing MVP SVGA validator", async () => {
  const bytes = await createSvgaFixture();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "auto-svga-adapter-"));
  const outputPath = path.join(tempDir, "fixture.svga");

  try {
    await writeFile(outputPath, bytes);
    const root = await protobuf.load(protoPath());
    const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
    const existingValidation = await validateMvpSvgaOutput(outputPath, MovieEntity);
    const adapter = new SvgaFormatAdapter(new NodeProtobufSvgaInspector());
    const result = await adapter.parse(sourceFromBytes("fixture.svga", bytes));

    assert.ok(result.value);
    assert.equal(result.value.resources.length, existingValidation.imageCount);
    assert.equal(result.value.layers.length, existingValidation.spriteCount);
    assert.equal(result.value.timing.frameCount, existingValidation.frameCount);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("SVGA FormatAdapter reports malformed input without throwing", async () => {
  const bytes = Uint8Array.from([1, 2, 3, 4]);
  const adapter = new SvgaFormatAdapter(new NodeProtobufSvgaInspector());
  const result = await adapter.parse(sourceFromBytes("broken.svga", bytes));

  assert.equal(result.value, undefined);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].code, "svga_parse_failed");
});

function sourceFromBytes(name: string, bytes: Uint8Array): MotionAssetSource {
  return {
    id: `memory:${name}`,
    name,
    sizeBytes: bytes.byteLength,
    mediaType: "application/octet-stream",
    async read() {
      return bytes;
    }
  };
}

async function createSvgaFixture(): Promise<Uint8Array> {
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
    images: {
      img_frame: encodeRgbaPng(createTransparentImage(300, 300)),
      img_sweep: encodeRgbaPng(createTransparentImage(48, 96))
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
    audios: []
  };
  const verificationError = MovieEntity.verify(payload);
  assert.equal(verificationError, null);
  return deflateSync(MovieEntity.encode(MovieEntity.create(payload)).finish());
}

async function createNamedReplaceableSvgaFixture(): Promise<Uint8Array> {
  const root = await protobuf.load(protoPath());
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const payload = {
    version: "2.0",
    params: {
      viewBoxWidth: 800,
      viewBoxHeight: 320,
      fps: 24,
      frames: 48
    },
    images: {
      profile_frame: encodeRgbaPng(createTransparentImage(300, 120)),
      img_001: encodeRgbaPng(createTransparentImage(48, 48)),
      designer_matte: encodeRgbaPng(createTransparentImage(300, 120)),
      internal_unused_designer_badge: encodeRgbaPng(createTransparentImage(64, 64))
    },
    sprites: [
      {
        imageKey: "profile_frame",
        frames: createFrames(48)
      },
      {
        imageKey: "img_001",
        matteKey: "designer_matte",
        frames: createFrames(24)
      }
    ],
    audios: []
  };
  const verificationError = MovieEntity.verify(payload);
  assert.equal(verificationError, null);
  return deflateSync(MovieEntity.encode(MovieEntity.create(payload)).finish());
}

function protoPath(): string {
  return fileURLToPath(new URL("../../proto/svga.proto", import.meta.url));
}

function createFrames(count: number): unknown[] {
  return Array.from({ length: count }, () => ({
    alpha: 1,
    layout: { x: 0, y: 0, width: 10, height: 10 },
    transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
    clipPath: "",
    shapes: []
  }));
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
