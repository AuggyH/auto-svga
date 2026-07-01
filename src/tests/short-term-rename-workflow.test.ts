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
  NodeProtobufSvgaInspector
} from "../workbench/svga/node-protobuf-inspector.js";
import {
  runShortTermRenameWorkflow
} from "../workbench/short-term-rename-workflow.js";

test("short-term rename workflow updates imageKey and matteKey references", async () => {
  const frameBytes = createColoredPng(16, 16, [255, 0, 0, 255]);
  const sweepBytes = createColoredPng(8, 16, [0, 255, 0, 255]);
  const sourceBytes = await createSvgaFixture({
    images: {
      img_frame: frameBytes,
      img_sweep: sweepBytes
    },
    sprites: [
      { imageKey: "img_frame", frames: createFrames(4) },
      { imageKey: "img_sweep", matteKey: "img_frame", frames: createFrames(4) }
    ]
  });
  const sourceSha256 = sha256(sourceBytes);

  const result = await runShortTermRenameWorkflow(
    sourceBytes,
    "img_frame",
    "profile_frame",
    { sourceName: "rename.svga" }
  );

  assert.ok(result.renamedBytes);
  assert.equal(sha256(sourceBytes), sourceSha256);
  assert.notEqual(sha256(result.renamedBytes), sourceSha256);
  assert.equal(result.model.schemaVersion, 1);
  assert.deepEqual(result.model.prdIds, ["S11", "S14"]);
  assert.equal(result.model.status, "renamed");
  assert.equal(result.model.resultTitle, "已重命名 imageKey");
  assert.equal(result.model.fromImageKey, "img_frame");
  assert.equal(result.model.toImageKey, "profile_frame");
  assert.deepEqual(result.model.referenceUpdates, [
    {
      spriteIndex: 0,
      field: "imageKey",
      fromImageKey: "img_frame",
      toImageKey: "profile_frame"
    },
    {
      spriteIndex: 1,
      field: "matteKey",
      fromImageKey: "img_frame",
      toImageKey: "profile_frame"
    }
  ]);
  assert.equal(result.model.validation.decodePassed, true);
  assert.equal(result.model.validation.reopenPassed, true);
  assert.equal(result.model.validation.referenceClosurePassed, true);
  assert.equal(result.model.validation.oldKeyAbsent, true);
  assert.equal(result.model.validation.newKeyPresent, true);
  assert.equal(result.model.validation.imageBytesPreserved, true);
  assert.equal(result.model.saveState.outputKind, "renamed_svga");
  assert.equal(result.model.saveState.dirty, true);
  assert.equal(result.model.saveState.overwriteSaveEnabled, true);
  assert.equal(result.model.saveState.saveAsEnabled, true);
  assert.equal(result.model.persistedOutput?.outputKind, "renamed_svga");
  assert.equal(result.model.persistedOutput?.saveState.outputAvailable, true);
  assert.equal(result.model.persistedOutput?.outputSha256, sha256(result.renamedBytes));
  assert.equal(result.report?.passed, true);
  assert.equal(result.report?.sourceSha256AfterRename, sourceSha256);

  const inspected = await new NodeProtobufSvgaInspector().inspect(result.renamedBytes);
  assert.deepEqual(
    inspected.images.map(({ imageKey }) => imageKey).sort(),
    ["img_sweep", "profile_frame"]
  );
  assert.deepEqual(
    inspected.sprites.map(({ imageKey, matteKey }) => ({ imageKey, matteKey })),
    [
      { imageKey: "profile_frame", matteKey: "" },
      { imageKey: "img_sweep", matteKey: "profile_frame" }
    ]
  );
  assert.equal(
    sha256(inspected.images.find(({ imageKey }) => imageKey === "profile_frame")?.bytes ?? new Uint8Array()),
    sha256(frameBytes)
  );
});

test("short-term rename workflow fails closed when target key already exists", async () => {
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

  const result = await runShortTermRenameWorkflow(sourceBytes, "img_frame", "img_sweep");

  assert.equal(result.renamedBytes, undefined);
  assert.equal(result.report, undefined);
  assert.equal(result.model.status, "failed");
  assert.equal(result.model.saveState.outputAvailable, false);
  assert.equal(result.model.saveState.overwriteSaveEnabled, false);
  assert.equal(result.model.saveState.saveAsEnabled, false);
  assert.equal(result.model.persistedOutput, undefined);
  assert.equal(result.model.diagnostic?.code, "rename_target_key_exists");
});

test("short-term rename workflow fails closed on unsafe target keys", async () => {
  const sourceBytes = await createSvgaFixture();

  const result = await runShortTermRenameWorkflow(sourceBytes, "img_frame", "folder/profile_frame");

  assert.equal(result.renamedBytes, undefined);
  assert.equal(result.model.status, "failed");
  assert.equal(result.model.saveState.outputAvailable, false);
  assert.equal(result.model.diagnostic?.code, "rename_target_key_invalid");
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
