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
  cancelShortTermRenamePreviewSession,
  startShortTermRenamePreviewSession
} from "../workbench/short-term-rename-preview-session.js";

test("short-term rename preview session applies renamed bytes in Preview mode", async () => {
  const sourceBytes = await createSvgaFixture({
    images: {
      img_frame: createColoredPng(16, 16, [255, 0, 0, 255]),
      img_sweep: createColoredPng(8, 16, [0, 255, 0, 255])
    },
    sprites: [
      { imageKey: "img_frame", frames: createFrames(4) },
      { imageKey: "img_sweep", matteKey: "img_frame", frames: createFrames(4) }
    ]
  });

  const session = await startShortTermRenamePreviewSession(
    sourceBytes,
    "img_frame",
    "profile_frame",
    { sourceName: "rename.svga" }
  );

  assert.ok(session.renamedBytes);
  assert.equal(session.model.schemaVersion, 1);
  assert.deepEqual(session.model.prdIds, ["S11", "S14"]);
  assert.equal(session.model.mode, "preview");
  assert.equal(session.model.status, "renameDirty");
  assert.equal(session.model.playerAction, "remountPreview");
  assert.equal(session.model.dirty, true);
  assert.equal(session.model.sourceSha256, sha256(sourceBytes));
  assert.equal(session.model.previewSha256, sha256(session.renamedBytes));
  assert.notEqual(session.model.previewSha256, session.model.sourceSha256);
  assert.equal(session.model.workflow.status, "renamed");
  assert.equal(session.model.saveState.saveAsEnabled, true);
  assert.equal(session.model.persistedOutput?.outputKind, "renamed_svga");
});

test("short-term rename preview session fails without changing preview bytes", async () => {
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

  const session = await startShortTermRenamePreviewSession(sourceBytes, "img_frame", "img_sweep");

  assert.equal(session.renamedBytes, undefined);
  assert.equal(session.model.status, "failed");
  assert.equal(session.model.playerAction, "keepPreview");
  assert.equal(session.model.dirty, false);
  assert.equal(sha256(session.previewBytes), sha256(sourceBytes));
  assert.equal(session.model.saveState.saveAsEnabled, false);
  assert.equal(session.model.workflow.diagnostic?.code, "rename_target_key_exists");
});

test("short-term rename preview session cancels back to source preview", async () => {
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
  const session = await startShortTermRenamePreviewSession(sourceBytes, "img_frame", "profile_frame");
  const cancelled = cancelShortTermRenamePreviewSession(session);

  assert.equal(cancelled.model.status, "cancelled");
  assert.equal(cancelled.model.playerAction, "returnToPreview");
  assert.equal(cancelled.model.dirty, false);
  assert.equal(cancelled.model.previewSha256, sha256(sourceBytes));
  assert.equal(cancelled.model.saveState.outputAvailable, false);
  assert.equal(cancelled.model.persistedOutput, undefined);
  assert.equal(cancelled.renamedBytes, undefined);
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
