import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import test from "node:test";
import protobuf from "protobufjs";
import { inspectAvatarFrameCommand } from "../commands/inspect-avatar-frame.js";
import { createTransparentImage, encodeRgbaPng } from "../utils/png-writer.js";

test("avatar-frame inspection command returns a passing structured report", async () => {
  const report = await inspectFixture({ width: 300, height: 300 }, "opaque");

  assert.equal(report.asset.format, "svga");
  assert.deepEqual(report.asset.dimensions, { width: 300, height: 300 });
  assert.equal(report.asset.layerCount, 1);
  assert.equal(report.asset.resourceCount, 1);
  assert.equal(report.memoryEstimation.bytesPerPixel, 4);
  assert.equal(report.memoryEstimation.totalEstimatedDecodedResourceBytes, 300 * 300 * 4);
  assert.equal(report.memoryEstimation.largestResourcesByDecodedBytes[0].resourceId, "img_frame");
  assert.equal(report.memoryEstimation.memoryRiskLevel, "low");
  assert.equal(report.memoryDiagnostics.byRole.static_image.resourceCount, 1);
  assert.equal(
    report.memoryDiagnostics.byRole.static_image.totalEstimatedDecodedBytes,
    300 * 300 * 4
  );
  assert.equal(report.memoryDiagnostics.sequenceFrameEstimatedDecodedBytes, 0);
  assert.equal(report.sequenceResidencyDiagnostics.sequenceGroupCount, 0);
  assert.equal(report.sequenceResidencyDiagnostics.totalSequenceFrameEstimatedDecodedBytes, 0);
  assert.deepEqual(report.sequenceResidencyDiagnostics.possibleResidencyModels, ["unknown"]);
  assert.equal(report.sequenceFrameEvidence.analyzedResourceCount, 0);
  assert.equal(report.sequenceFrameEvidence.duplicateEvidenceStatus, "not_applicable");
  assert.equal(report.specId, "avatar-frame-production");
  assert.equal(report.profileId, "production_target");
  assert.equal(report.profileLabel, "Avatar Frame Production Target");
  assert.match(report.profilePurpose, /new avatar-frame deliveries/i);
  assert.equal(report.passed, true);
  assert.deepEqual(report.issues, []);
});

test("avatar-frame inspection command reports dimensions over 300x300", async () => {
  const report = await inspectFixture({ width: 301, height: 300 }, "opaque");

  assert.equal(report.passed, false);
  assert.deepEqual(
    report.issues.map(({ code }) => code),
    ["dimensions_exceed_limit"]
  );
});

test("avatar-frame inspection command reports transparent padding from embedded PNG", async () => {
  const report = await inspectFixture({ width: 300, height: 300 }, "padded");

  assert.equal(report.passed, false);
  assert.equal(report.issues[0].code, "resource_transparent_padding_exceeds_limit");
  assert.equal(report.issues[0].path, "resources[0].alphaBounds");
  assert.deepEqual(report.issues[0].details?.alphaBounds, {
    x: 100,
    y: 100,
    width: 100,
    height: 100
  });
});

test("avatar-frame inspection command preserves calibration notes", async () => {
  const report = await inspectFixture({ width: 300, height: 300 }, "opaque");

  assert.deepEqual(
    report.calibrationNotes.map(({ field }) => field),
    ["maxFileSizeBytes", "maxResourceCount", "maxTransparentPaddingRatio"]
  );
  assert.ok(report.calibrationNotes.every(({ message }) => message.includes("Provisional")));
  assert.ok(report.calibrationNotes.every(({ message }) => message.includes("needs product calibration")));
});

async function inspectFixture(
  dimensions: { width: number; height: number },
  imageMode: "opaque" | "padded"
) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "auto-svga-report-"));
  const inputPath = path.join(tempDir, "avatar-frame.svga");

  try {
    await writeFile(inputPath, await createSvgaFixture(dimensions, imageMode));
    return await inspectAvatarFrameCommand(inputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function createSvgaFixture(
  dimensions: { width: number; height: number },
  imageMode: "opaque" | "padded"
): Promise<Uint8Array> {
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
      img_frame: encodeRgbaPng(createFrameImage(imageMode))
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

function createFrameImage(mode: "opaque" | "padded") {
  const image = createTransparentImage(300, 300);
  const start = mode === "opaque" ? 0 : 100;
  const end = mode === "opaque" ? 300 : 200;
  for (let y = start; y < end; y += 1) {
    for (let x = start; x < end; x += 1) {
      image.pixels[(y * image.width + x) * 4 + 3] = 255;
    }
  }
  return image;
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
