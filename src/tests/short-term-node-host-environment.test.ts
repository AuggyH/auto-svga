import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import test from "node:test";
import protobuf from "protobufjs";
import {
  createTransparentImage,
  encodeRgbaPng,
  setPixel
} from "../utils/png-writer.js";
import { createShortTermNodeHostEnvironment } from "../hosts/short-term-node-host-environment.js";
import {
  createShortTermHostActionState,
  dispatchShortTermHostMenuAction,
  openShortTermHostLocalFile
} from "../workbench/short-term-host-actions.js";

test("short-term node host opens a real local SVGA through inspection without leaking paths", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "auto-svga-node-host-open-"));
  const inputPath = path.join(tempDir, "opened.svga");

  try {
    await writeFile(inputPath, await createSvgaFixture());
    const host = createShortTermNodeHostEnvironment();
    const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
      requestId: "open-1",
      source: "fileButton",
      localPath: inputPath
    });

    assert.equal(opened.facade.model.appState.state, "previewReady");
    assert.equal(opened.facade.model.appState.currentFile?.displayName, "opened.svga");
    assert.equal(opened.facade.model.appState.currentFile?.inspection.overview.assetSummary.imageResourceCount, 1);
    assert.equal(opened.lastAction?.status, "completed");
    assert.equal(JSON.stringify(opened.facade.model).includes(tempDir), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("short-term node host writes optimized Save As output and validates read-back bytes", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "auto-svga-node-host-save-"));
  const inputPath = path.join(tempDir, "optimizable.svga");
  const outputPath = path.join(tempDir, "optimized.svga");

  try {
    await writeFile(inputPath, await createOptimizableSvgaFixture());
    const host = createShortTermNodeHostEnvironment();
    const opened = await dispatchShortTermHostMenuAction(createShortTermHostActionState(), host, {
      commandId: "openSvga",
      requestId: "open-1",
      localPath: inputPath
    });
    const optimized = await dispatchShortTermHostMenuAction(opened, host, {
      commandId: "runOptimization"
    });
    const saved = await dispatchShortTermHostMenuAction(optimized, host, {
      commandId: "saveAs",
      targetPath: outputPath
    });
    const outputBytes = await readFile(outputPath);

    assert.equal(optimized.lastAction?.status, "completed");
    assert.equal(saved.lastAction?.status, "completed");
    assert.equal(saved.currentLocalPath, outputPath);
    assert.equal(saved.activeOutputBytes, undefined);
    assert.equal(sha256(outputBytes), saved.lastAction?.outputSha256);
    assert.equal(JSON.stringify(saved.facade.model).includes(tempDir), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

async function createOptimizableSvgaFixture(): Promise<Uint8Array> {
  return createSvgaFixture({
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
}

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
      img_frame: createColoredPng(16, 16, [255, 0, 0, 255])
    },
    sprites: overrides.sprites ?? [
      { imageKey: "img_frame", frames: createFrames(4) }
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
