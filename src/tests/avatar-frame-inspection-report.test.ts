import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import test from "node:test";
import protobuf from "protobufjs";
import { inspectAvatarFrameCommand } from "../commands/inspect-avatar-frame.js";

test("avatar-frame inspection command returns a passing structured report", async () => {
  const report = await inspectFixture({ width: 300, height: 300 });

  assert.equal(report.asset.format, "svga");
  assert.deepEqual(report.asset.dimensions, { width: 300, height: 300 });
  assert.equal(report.asset.layerCount, 1);
  assert.equal(report.asset.resourceCount, 1);
  assert.equal(report.specId, "avatar-frame-production");
  assert.equal(report.passed, true);
  assert.deepEqual(report.issues, []);
});

test("avatar-frame inspection command reports dimensions over 300x300", async () => {
  const report = await inspectFixture({ width: 301, height: 300 });

  assert.equal(report.passed, false);
  assert.deepEqual(
    report.issues.map(({ code }) => code),
    ["dimensions_exceed_limit"]
  );
});

test("avatar-frame inspection command preserves calibration notes", async () => {
  const report = await inspectFixture({ width: 300, height: 300 });

  assert.deepEqual(
    report.calibrationNotes.map(({ field }) => field),
    ["maxFileSizeBytes", "maxResourceCount"]
  );
  assert.ok(report.calibrationNotes.every(({ message }) => message.includes("Provisional")));
  assert.ok(report.calibrationNotes.every(({ message }) => message.includes("needs product calibration")));
});

async function inspectFixture(dimensions: { width: number; height: number }) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "auto-svga-report-"));
  const inputPath = path.join(tempDir, "avatar-frame.svga");

  try {
    await writeFile(inputPath, await createSvgaFixture(dimensions));
    return await inspectAvatarFrameCommand(inputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function createSvgaFixture(dimensions: { width: number; height: number }): Promise<Uint8Array> {
  const root = await protobuf.load(protoPath());
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const payload = {
    version: "2.0",
    params: {
      viewBoxWidth: dimensions.width,
      viewBoxHeight: dimensions.height,
      fps: 24,
      frames: 72
    },
    images: {
      img_frame: Uint8Array.from([1, 2, 3])
    },
    sprites: [{
      imageKey: "img_frame",
      frames: createFrames(72)
    }],
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
