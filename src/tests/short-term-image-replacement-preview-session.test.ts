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
  applyShortTermImageReplacementPreview,
  createShortTermImageReplacementPreviewSession,
  resetShortTermImageReplacementPreview
} from "../workbench/short-term-image-replacement-preview-session.js";

test("short-term image replacement preview session starts from source bytes", async () => {
  const sourceBytes = await createSvgaFixture();
  const session = createShortTermImageReplacementPreviewSession(sourceBytes, {
    sourceName: "/Users/designer/private/preview.svga"
  });

  assert.equal(session.model.schemaVersion, 1);
  assert.deepEqual(session.model.prdIds, ["S12", "S14"]);
  assert.equal(session.model.mode, "preview");
  assert.equal(session.model.sourceName, "preview.svga");
  assert.equal(JSON.stringify(session.model).includes("/Users/designer"), false);
  assert.equal(session.model.status, "ready");
  assert.equal(session.model.dirty, false);
  assert.equal(session.model.resetEnabled, false);
  assert.equal(session.model.previewBytesSource, "source");
  assert.equal(session.model.playerAction, "loadSource");
  assert.equal(session.model.sourceSha256, sha256(sourceBytes));
  assert.equal(session.model.previewSha256, sha256(sourceBytes));
  assert.equal(session.model.saveState.saveAsEnabled, false);
  assert.equal(session.model.lastAction.type, "loadSource");
  assert.equal(session.model.lastAction.status, "accepted");
});

test("short-term image replacement preview session applies replacement without leaving preview mode", async () => {
  const sourceBytes = await createSvgaFixture();
  const session = createShortTermImageReplacementPreviewSession(sourceBytes, {
    sourceName: "/Users/designer/private/preview.svga"
  });
  const result = await applyShortTermImageReplacementPreview(
    session,
    { imageKey: "profile_frame", pngBytes: createColoredPng(16, 16, [0, 255, 0, 255]) }
  );

  assert.equal(result.accepted, true);
  assert.equal(result.workflow.status, "replaced");
  assert.equal(result.session.model.mode, "preview");
  assert.equal(result.session.model.status, "previewDirty");
  assert.equal(result.session.model.dirty, true);
  assert.equal(result.session.model.resetEnabled, true);
  assert.equal(result.session.model.previewBytesSource, "imageReplacementOutput");
  assert.equal(result.session.model.playerAction, "remountPreview");
  assert.equal(result.session.model.sourceUnchanged, true);
  assert.equal(result.session.model.activeReplacement?.imageKey, "profile_frame");
  assert.equal(result.session.model.sourceName, "preview.svga");
  assert.equal(result.session.model.persistedOutput?.sourceName, "preview.svga");
  assert.equal(JSON.stringify(result.session.model).includes("/Users/designer"), false);
  assert.equal(result.session.model.saveState.outputAvailable, true);
  assert.equal(result.session.model.saveState.saveAsEnabled, true);
  assert.equal(result.session.model.persistedOutput?.outputSha256, sha256(result.session.previewBytes));
  assert.equal(result.session.model.lastAction.type, "applyReplacement");
  assert.equal(result.session.model.lastAction.status, "accepted");
  assert.equal(sha256(result.session.sourceBytes), sha256(sourceBytes));
  assert.notEqual(sha256(result.session.previewBytes), sha256(sourceBytes));
});

test("short-term image replacement preview session resets to source bytes", async () => {
  const sourceBytes = await createSvgaFixture();
  const session = createShortTermImageReplacementPreviewSession(sourceBytes);
  const applied = await applyShortTermImageReplacementPreview(
    session,
    { imageKey: "profile_frame", pngBytes: createColoredPng(16, 16, [0, 255, 0, 255]) }
  );

  const reset = resetShortTermImageReplacementPreview(applied.session);

  assert.equal(reset.model.status, "ready");
  assert.equal(reset.model.dirty, false);
  assert.equal(reset.model.resetEnabled, false);
  assert.equal(reset.model.previewBytesSource, "source");
  assert.equal(reset.model.playerAction, "remountSource");
  assert.equal(reset.model.activeReplacement, undefined);
  assert.equal(reset.model.persistedOutput, undefined);
  assert.equal(reset.model.saveState.outputAvailable, false);
  assert.equal(reset.model.saveState.saveAsEnabled, false);
  assert.equal(reset.model.lastAction.type, "reset");
  assert.equal(reset.model.lastAction.status, "accepted");
  assert.equal(sha256(reset.previewBytes), sha256(sourceBytes));
  assert.equal(sha256(reset.sourceBytes), sha256(sourceBytes));
});

test("short-term image replacement preview session rejects unsafe replacement without changing preview bytes", async () => {
  const sourceBytes = await createSvgaFixture();
  const session = createShortTermImageReplacementPreviewSession(sourceBytes);
  const applied = await applyShortTermImageReplacementPreview(
    session,
    { imageKey: "profile_frame", pngBytes: createColoredPng(16, 16, [0, 255, 0, 255]) }
  );
  const previewSha256 = sha256(applied.session.previewBytes);
  const outputSha256 = applied.session.model.persistedOutput?.outputSha256;

  const rejected = await applyShortTermImageReplacementPreview(
    applied.session,
    { imageKey: "img_000", pngBytes: createColoredPng(16, 16, [255, 0, 255, 255]) }
  );

  assert.equal(rejected.accepted, false);
  assert.equal(rejected.workflow.status, "failed");
  assert.equal(rejected.session.model.status, "previewDirty");
  assert.equal(rejected.session.model.playerAction, "keepCurrentPreview");
  assert.equal(rejected.session.model.lastAction.status, "rejected");
  assert.equal(
    rejected.session.model.lastAction.diagnostic?.code,
    "replacement_image_key_not_short_term_replaceable"
  );
  assert.equal(sha256(rejected.session.previewBytes), previewSha256);
  assert.equal(rejected.session.model.persistedOutput?.outputSha256, outputSha256);
  assert.equal(rejected.session.model.saveState.saveAsEnabled, true);
});

async function createSvgaFixture(): Promise<Uint8Array> {
  const root = await protobuf.load(protoPath());
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const payload = {
    version: "2.0",
    params: {
      viewBoxWidth: 128,
      viewBoxHeight: 128,
      fps: 24,
      frames: 48
    },
    images: {
      profile_frame: createColoredPng(16, 16, [255, 0, 0, 255]),
      img_sweep: createColoredPng(8, 16, [0, 0, 255, 255])
    },
    sprites: [
      { imageKey: "profile_frame", frames: createFrames(4) },
      { imageKey: "img_sweep", matteKey: "profile_frame", frames: createFrames(4) }
    ],
    audios: []
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
