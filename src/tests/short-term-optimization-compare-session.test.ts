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
  cancelShortTermOptimizationCompareSession,
  startShortTermOptimizationCompareSession
} from "../workbench/short-term-optimization-compare-session.js";

test("short-term optimization compare session enters before-after mode with save output", async () => {
  const sourceBytes = await createSvgaFixture({
    images: {
      img_frame: createColoredPng(16, 16, [255, 0, 0, 255]),
      img_frame_copy: createColoredPng(16, 16, [255, 0, 0, 255]),
      img_unused: createColoredPng(4, 4, [0, 0, 255, 255])
    },
    sprites: [
      { imageKey: "img_frame", frames: createFrames(4) },
      { imageKey: "img_frame_copy", frames: createFrames(4) }
    ]
  });

  const session = await startShortTermOptimizationCompareSession(sourceBytes, {
    sourceName: "optimizable.svga"
  });

  assert.ok(session.optimizedBytes);
  assert.equal(session.model.schemaVersion, 1);
  assert.deepEqual(session.model.prdIds, ["S10", "S14"]);
  assert.equal(session.model.mode, "optimizationComparison");
  assert.equal(session.model.status, "comparing");
  assert.equal(session.model.playerAction, "showBeforeAfter");
  assert.equal(session.model.before.bytesSha256, sha256(sourceBytes));
  assert.equal(session.model.after?.bytesSha256, sha256(session.optimizedBytes));
  assert.notEqual(session.model.after?.bytesSha256, session.model.before.bytesSha256);
  assert.equal(session.model.workflow.status, "optimized");
  assert.equal(session.model.saveState.saveAsEnabled, true);
  assert.equal(session.model.persistedOutput?.outputKind, "optimized_svga");
});

test("short-term optimization compare session does not enter compare mode without safe output", async () => {
  const sourceBytes = await createSvgaFixture();
  const session = await startShortTermOptimizationCompareSession(sourceBytes);

  assert.equal(session.optimizedBytes, undefined);
  assert.equal(session.model.mode, "preview");
  assert.equal(session.model.status, "notApplicable");
  assert.equal(session.model.after, undefined);
  assert.equal(session.model.playerAction, "keepPreview");
  assert.equal(session.model.saveState.saveAsEnabled, false);
  assert.equal(session.model.persistedOutput, undefined);
});

test("short-term optimization compare session can cancel back to source preview", async () => {
  const sourceBytes = await createSvgaFixture({
    images: {
      img_frame: createColoredPng(16, 16, [255, 0, 0, 255]),
      img_frame_copy: createColoredPng(16, 16, [255, 0, 0, 255])
    },
    sprites: [
      { imageKey: "img_frame", frames: createFrames(4) },
      { imageKey: "img_frame_copy", frames: createFrames(4) }
    ]
  });
  const session = await startShortTermOptimizationCompareSession(sourceBytes);
  const cancelled = cancelShortTermOptimizationCompareSession(session);

  assert.equal(cancelled.model.mode, "preview");
  assert.equal(cancelled.model.status, "cancelled");
  assert.equal(cancelled.model.playerAction, "returnToPreview");
  assert.equal(cancelled.model.before.bytesSha256, sha256(sourceBytes));
  assert.equal(cancelled.model.saveState.outputAvailable, false);
  assert.equal(cancelled.model.saveState.saveAsEnabled, false);
  assert.equal(cancelled.model.persistedOutput, undefined);
  assert.equal(cancelled.optimizedBytes, undefined);
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

function protoPath(): string {
  return fileURLToPath(new URL("../../proto/svga.proto", import.meta.url));
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
