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
  repairSvgaSequenceFrameFlicker,
  SvgaSequenceFrameRepairError
} from "../workbench/svga/index.js";

const protoPath = fileURLToPath(new URL("../../proto/svga.proto", import.meta.url));

test("sequence repair replaces one near-empty speck frame with transparent PNG", async () => {
  const sourceBytes = await createSequenceFixture({ speckKeys: ["seq_006"] });
  const sourceSha256 = sha256(sourceBytes);
  const result = await repairSvgaSequenceFrameFlicker(sourceBytes, {
    sourceName: "sequence-fixture.svga",
    headCommit: "sequence-test-head"
  });

  assert.equal(sha256(sourceBytes), sourceSha256, "source bytes must remain immutable");
  assert.notEqual(sha256(result.editedBytes), sourceSha256);
  assert.equal(result.report.passed, true);
  assert.equal(result.report.status, "repaired");
  assert.equal(result.report.productSaveAsEnabled, true);
  assert.equal(result.report.repairSuccessClaimed, true);
  assert.equal(result.report.manualVisualConfirmationRequired, false);
  assert.equal(result.report.sequenceGroup.resourceKeyCount, 12);
  assert.equal(result.report.sequenceGroup.repairedResourceKey, "seq_006");
  assert.deepEqual(result.report.sequenceGroup.targetVisibleFrames, [11, 12]);
  assert.equal(result.report.selectedRepair.beforeNonTransparentPixelCount, 4);
  assert.equal(result.report.selectedRepair.afterNonTransparentPixelCount, 0);
  assert.equal(result.report.invariantSummary.sourceUnchanged, true);
  assert.equal(result.report.invariantSummary.roundTripPassed, true);
  assert.equal(result.report.invariantSummary.onlySelectedResourceChanged, true);
  assert.equal(result.report.invariantSummary.spriteTimelineStable, true);
  assert.equal(result.report.roundTripReport.passed, true);

  const changed = result.report.sequenceGroup.fullAffectedFrameVisibilityAlphaProof
    .filter(({ changed }) => changed);
  assert.deepEqual(changed.map(({ resourceKey }) => resourceKey), ["seq_006"]);
  assert.equal(changed[0].afterSha256, sha256(result.transparentReplacementPng));
  assert.equal(result.report.sequenceGroup.fullAffectedFrameVisibilityAlphaProof.every(({ passed }) => passed), true);
});

test("sequence repair fails closed when no near-empty speck frame exists", async () => {
  const sourceBytes = await createSequenceFixture({ speckKeys: [] });
  await assert.rejects(
    repairSvgaSequenceFrameFlicker(sourceBytes, { sourceName: "no-speck.svga" }),
    (error) => error instanceof SvgaSequenceFrameRepairError
      && error.code === "sequence_near_empty_candidate_not_unique"
  );
});

test("sequence repair fails closed when near-empty candidates are not unique", async () => {
  const sourceBytes = await createSequenceFixture({ speckKeys: ["seq_005", "seq_006"] });
  await assert.rejects(
    repairSvgaSequenceFrameFlicker(sourceBytes, { sourceName: "two-specks.svga" }),
    (error) => error instanceof SvgaSequenceFrameRepairError
      && error.code === "sequence_near_empty_candidate_not_unique"
  );
});

async function createSequenceFixture(options: { speckKeys: readonly string[] }): Promise<Uint8Array> {
  const root = await protobuf.load(protoPath);
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const imageKeys = Array.from({ length: 12 }, (_, index) => `seq_${String(index + 1).padStart(3, "0")}`);
  const images = Object.fromEntries(imageKeys.map((resourceKey, index) => [
    resourceKey,
    options.speckKeys.includes(resourceKey)
      ? createSpeckPng(200, 200)
      : createColoredPng(200, 200, [
        (index * 17) % 255,
        (index * 31) % 255,
        (index * 47) % 255,
        255
      ])
  ]));
  const payload = {
    version: "2.0",
    params: {
      viewBoxWidth: 200,
      viewBoxHeight: 200,
      fps: 24,
      frames: 36
    },
    images,
    sprites: imageKeys.map((imageKey, index) => ({
      imageKey,
      frames: createTimelineFrames(36, [index * 2 + 1, index * 2 + 2])
    })),
    audios: []
  };
  const verificationError = MovieEntity.verify(payload);
  assert.equal(verificationError, null);
  return deflateSync(MovieEntity.encode(MovieEntity.create(payload)).finish());
}

function createTimelineFrames(count: number, visibleIndices: readonly number[]): unknown[] {
  const visible = new Set(visibleIndices);
  return Array.from({ length: count }, (_, index) => ({
    alpha: visible.has(index) ? 1 : 0,
    layout: { x: 0, y: 0, width: 200, height: 200 },
    transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
    clipPath: "",
    shapes: []
  }));
}

function createSpeckPng(width: number, height: number): Buffer {
  const image = createTransparentImage(width, height);
  setPixel(image, 80, 90, [255, 255, 255, 255]);
  setPixel(image, 81, 90, [255, 255, 255, 255]);
  setPixel(image, 80, 91, [255, 255, 255, 255]);
  setPixel(image, 81, 91, [255, 255, 255, 255]);
  return encodeRgbaPng(image);
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

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
