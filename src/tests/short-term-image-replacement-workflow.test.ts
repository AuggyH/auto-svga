import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
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
  runShortTermImageReplacementWorkflow
} from "../workbench/short-term-image-replacement-workflow.js";
import { NodeProtobufSvgaInspector } from "../workbench/svga/node-protobuf-inspector.js";

test("short-term image replacement workflow produces persisted replacement output", async () => {
  const originalFrame = createColoredPng(16, 16, [255, 0, 0, 255]);
  const replacement = createColoredPng(16, 16, [0, 255, 0, 255]);
  const sourceBytes = await createSvgaFixture({
    images: {
      profile_frame: originalFrame,
      img_sweep: createColoredPng(8, 16, [0, 0, 255, 255])
    },
    sprites: [
      { imageKey: "profile_frame", frames: createFrames(4) },
      { imageKey: "img_sweep", matteKey: "profile_frame", frames: createFrames(4) }
    ]
  });
  const sourceSha256 = sha256(sourceBytes);

  const result = await runShortTermImageReplacementWorkflow(
    sourceBytes,
    { imageKey: "profile_frame", pngBytes: replacement },
    { sourceName: "replace.svga" }
  );

  assert.ok(result.replacedBytes);
  assert.equal(sha256(sourceBytes), sourceSha256);
  assert.notEqual(sha256(result.replacedBytes), sourceSha256);
  assert.equal(result.model.schemaVersion, 1);
  assert.deepEqual(result.model.prdIds, ["S12", "S14"]);
  assert.equal(result.model.status, "replaced");
  assert.equal(result.model.resultTitle, "已生成替换图片副本");
  assert.equal(result.model.imageKey, "profile_frame");
  assert.equal(result.model.replacement?.replacementSha256, sha256(replacement));
  assert.equal(result.model.validation.decodePassed, true);
  assert.equal(result.model.validation.reopenPassed, true);
  assert.equal(result.model.validation.sourceUnchanged, true);
  assert.equal(result.model.validation.roundTripPassed, true);
  assert.equal(result.model.validation.replacementApplied, true);
  assert.equal(result.model.validation.referenceClosurePassed, true);
  assert.equal(result.model.saveState.outputKind, "image_replacement_svga");
  assert.equal(result.model.saveState.outputAvailable, true);
  assert.equal(result.model.saveState.saveAsEnabled, true);
  assert.equal(result.model.persistedOutput?.outputKind, "image_replacement_svga");
  assert.equal(result.model.persistedOutput?.outputSha256, sha256(result.replacedBytes));
  assert.equal(result.roundTripReport?.passed, true);

  const inspected = await new NodeProtobufSvgaInspector().inspect(result.replacedBytes);
  assert.equal(
    sha256(inspected.images.find(({ imageKey }) => imageKey === "profile_frame")?.bytes ?? new Uint8Array()),
    sha256(replacement)
  );
  assert.deepEqual(
    inspected.sprites.map(({ imageKey, matteKey }) => ({ imageKey, matteKey })),
    [
      { imageKey: "profile_frame", matteKey: "" },
      { imageKey: "img_sweep", matteKey: "profile_frame" }
    ]
  );
});

test("short-term image replacement workflow accepts indexed PNG replacements", async () => {
  const replacement = createIndexedPng();
  const sourceBytes = await createSvgaFixture({
    images: {
      profile_frame: createColoredPng(2, 1, [255, 0, 0, 255]),
      img_sweep: createColoredPng(1, 1, [0, 0, 255, 255])
    },
    sprites: [
      { imageKey: "profile_frame", frames: createFrames(4) },
      { imageKey: "img_sweep", matteKey: "profile_frame", frames: createFrames(4) }
    ]
  });

  const result = await runShortTermImageReplacementWorkflow(
    sourceBytes,
    { imageKey: "profile_frame", pngBytes: replacement },
    { sourceName: "indexed-replace.svga" }
  );

  assert.ok(result.replacedBytes);
  assert.equal(result.model.status, "replaced");
  assert.equal(result.model.replacement?.replacementWidth, 2);
  assert.equal(result.model.replacement?.replacementHeight, 1);
  assert.equal(result.model.replacement?.replacementSha256, sha256(replacement));
  assert.equal(result.model.validation.replacementApplied, true);
  assert.equal(result.model.saveState.saveAsEnabled, true);

  const inspected = await new NodeProtobufSvgaInspector().inspect(result.replacedBytes);
  assert.equal(
    sha256(inspected.images.find(({ imageKey }) => imageKey === "profile_frame")?.bytes ?? new Uint8Array()),
    sha256(replacement)
  );
});

test("short-term image replacement workflow rejects automatic image keys", async () => {
  const sourceBytes = await createSvgaFixture({
    images: {
      img_000: createColoredPng(16, 16, [255, 0, 0, 255])
    },
    sprites: [
      { imageKey: "img_000", frames: createFrames(4) }
    ]
  });

  const result = await runShortTermImageReplacementWorkflow(
    sourceBytes,
    { imageKey: "img_000", pngBytes: createColoredPng(16, 16, [0, 255, 0, 255]) }
  );

  assert.equal(result.replacedBytes, undefined);
  assert.equal(result.roundTripReport, undefined);
  assert.equal(result.model.status, "failed");
  assert.equal(result.model.saveState.outputAvailable, false);
  assert.equal(result.model.persistedOutput, undefined);
  assert.equal(result.model.diagnostic?.code, "replacement_image_key_not_short_term_replaceable");
});

test("short-term image replacement workflow fails closed on invalid PNG input", async () => {
  const sourceBytes = await createSvgaFixture();

  const result = await runShortTermImageReplacementWorkflow(
    sourceBytes,
    { imageKey: "profile_frame", pngBytes: new Uint8Array([1, 2, 3]) }
  );

  assert.equal(result.replacedBytes, undefined);
  assert.equal(result.model.status, "failed");
  assert.equal(result.model.saveState.saveAsEnabled, false);
  assert.equal(result.model.diagnostic?.code, "replacement_not_png");
});

test("short-term image replacement workflow redacts local paths from diagnostics", async () => {
  const sourceBytes = await createSvgaFixture();

  const result = await runShortTermImageReplacementWorkflow(
    sourceBytes,
    { imageKey: "profile_frame", pngBytes: createColoredPng(16, 16, [0, 255, 0, 255]) },
    {
      sourceName: "/Users/designer/private/replace.svga",
      protoPath: "/Users/designer/private/missing.proto"
    }
  );

  assert.equal(result.replacedBytes, undefined);
  assert.equal(result.model.status, "failed");
  assert.equal(result.model.sourceName, "replace.svga");
  assert.equal(JSON.stringify(result.model).includes("/Users/designer"), false);
  assert.equal(JSON.stringify(result.model).includes("private/missing.proto"), false);
});

test("short-term image replacement workflow redacts path-like image keys from failed models", async () => {
  const sourceBytes = await createSvgaFixture();

  const result = await runShortTermImageReplacementWorkflow(
    sourceBytes,
    {
      imageKey: "/Users/designer/private/profile_frame",
      pngBytes: createColoredPng(16, 16, [0, 255, 0, 255])
    },
    { sourceName: "replace.svga" }
  );

  assert.equal(result.replacedBytes, undefined);
  assert.equal(result.model.status, "failed");
  assert.equal(JSON.stringify(result.model).includes("/Users/designer"), false);
  assert.equal(JSON.stringify(result.model).includes("private/profile_frame"), false);
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
      profile_frame: createColoredPng(16, 16, [255, 0, 0, 255]),
      img_sweep: createColoredPng(8, 16, [0, 255, 0, 255])
    },
    sprites: overrides.sprites ?? [
      { imageKey: "profile_frame", frames: createFrames(4) },
      { imageKey: "img_sweep", frames: createFrames(4) }
    ],
    audios: overrides.audios ?? []
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

function protoPath(): string {
  return fileURLToPath(new URL("../../proto/svga.proto", import.meta.url));
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
