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
  runShortTermOptimizationWorkflow
} from "../workbench/short-term-optimization-workflow.js";

test("short-term optimization workflow produces product comparison and save model", async () => {
  const duplicateBytes = createColoredPng(16, 16, [255, 0, 0, 255]);
  const sweepBytes = createColoredPng(8, 16, [0, 255, 0, 255]);
  const unusedBytes = createColoredPng(4, 4, [0, 0, 255, 255]);
  const sourceBytes = await createSvgaFixture({
    images: {
      img_frame: duplicateBytes,
      img_frame_copy: duplicateBytes,
      img_sweep: sweepBytes,
      img_unused: unusedBytes
    },
    sprites: [
      { imageKey: "img_frame", frames: createFrames(4) },
      { imageKey: "img_frame_copy", matteKey: "img_sweep", frames: createFrames(4) }
    ]
  });
  const sourceSha256 = sha256(sourceBytes);

  const result = await runShortTermOptimizationWorkflow(sourceBytes, { sourceName: "fixture.svga" });

  assert.ok(result.optimizedBytes);
  assert.equal(sha256(sourceBytes), sourceSha256);
  assert.notEqual(sha256(result.optimizedBytes), sourceSha256);
  assert.equal(result.model.schemaVersion, 1);
  assert.deepEqual(result.model.prdIds, ["S9", "S10", "S14", "S18"]);
  assert.equal(result.model.status, "optimized");
  assert.equal(result.model.sourceName, "fixture.svga");
  assert.equal(result.model.sourceSha256, sourceSha256);
  assert.equal(result.model.resultTitle, "已生成优化副本");
  assert.deepEqual(
    result.model.actions.map(({ type, resourceKey, canonicalResourceKey, title }) => ({
      type,
      resourceKey,
      canonicalResourceKey,
      title
    })),
    [
      {
        type: "deduplicate_encoded_image",
        resourceKey: "img_frame_copy",
        canonicalResourceKey: "img_frame",
        title: "合并重复图片引用"
      },
      {
        type: "remove_unreferenced_image",
        resourceKey: "img_unused",
        canonicalResourceKey: undefined,
        title: "移除未引用图片"
      }
    ]
  );
  assert.deepEqual(
    result.model.methods.map(({ method, disposition }) => ({ method, disposition })),
    [
      { method: "deduplicateEncodedImages", disposition: "executed" },
      { method: "removeUnreferencedImages", disposition: "executed" },
      { method: "allZeroRuntimeObjectPruning", disposition: "availableButNoCandidate" },
      { method: "imageCompression", disposition: "notImplemented" },
      { method: "transparentBoundsTrim", disposition: "reviewOnly" },
      { method: "sequenceFrameProcessing", disposition: "reviewOnly" },
      { method: "fpsAdjustment", disposition: "reviewOnly" },
      { method: "canvasAdjustment", disposition: "reviewOnly" }
    ]
  );
  assert.equal(result.model.metrics.find(({ id }) => id === "imageResourceCount")?.delta, "减少 2");
  assert.equal(result.model.metrics.find(({ id }) => id === "runtimeObjectCount")?.delta, "无变化");
  assert.equal(result.model.metrics.find(({ id }) => id === "animationFrameRecordCount")?.delta, "无变化");
  assert.equal(result.model.validation.decodePassed, true);
  assert.equal(result.model.validation.reopenPassed, true);
  assert.equal(result.model.validation.sourceUnchanged, true);
  assert.equal(result.model.validation.invariantChecksPassed, true);
  assert.equal(result.model.validation.referenceClosurePassed, true);
  assert.deepEqual(result.model.validation.danglingReferences, []);
  assert.equal(result.model.saveState.outputKind, "optimized_svga");
  assert.equal(result.model.saveState.dirty, true);
  assert.equal(result.model.saveState.overwriteSaveEnabled, true);
  assert.equal(result.model.saveState.saveAsEnabled, true);
  assert.equal(result.model.saveState.autoWritePerformed, false);
  assert.equal(result.model.saveState.validationRequiredBeforeWrite, true);
  assert.equal(result.model.persistedOutput?.outputKind, "optimized_svga");
  assert.equal(result.model.persistedOutput?.saveState.outputAvailable, true);
  assert.equal(result.model.persistedOutput?.outputSha256, sha256(result.optimizedBytes));
});

test("short-term optimization workflow reports no-op files without enabling save", async () => {
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

  const result = await runShortTermOptimizationWorkflow(sourceBytes);

  assert.equal(result.optimizedBytes, undefined);
  assert.equal(result.report, undefined);
  assert.equal(result.model.status, "notApplicable");
  assert.equal(result.model.resultTitle, "没有可安全执行的优化项");
  assert.deepEqual(result.model.actions, []);
  assert.deepEqual(
    result.model.methods.slice(0, 3).map(({ method, disposition }) => ({ method, disposition })),
    [
      { method: "deduplicateEncodedImages", disposition: "availableButNoCandidate" },
      { method: "removeUnreferencedImages", disposition: "availableButNoCandidate" },
      { method: "allZeroRuntimeObjectPruning", disposition: "availableButNoCandidate" }
    ]
  );
  assert.equal(result.model.saveState.outputAvailable, false);
  assert.equal(result.model.saveState.overwriteSaveEnabled, false);
  assert.equal(result.model.saveState.saveAsEnabled, false);
  assert.equal(result.model.persistedOutput, undefined);
  assert.equal(result.model.diagnostic?.code, "optimization_not_applicable");
});

test("short-term optimization workflow exposes safe runtime-structure pruning metrics", async () => {
  const sourceBytes = await createSvgaFixture({
    images: {
      img_visible: createColoredPng(16, 16, [255, 0, 0, 255]),
      img_invisible: createColoredPng(8, 8, [0, 0, 0, 0])
    },
    sprites: [
      { imageKey: "img_visible", frames: createFrames(4) },
      { imageKey: "img_invisible", frames: createFrames(4, { alpha: 0 }) }
    ]
  });

  const result = await runShortTermOptimizationWorkflow(sourceBytes, { sourceName: "structure.svga" });

  assert.ok(result.optimizedBytes);
  assert.equal(result.model.status, "optimized");
  assert.equal(result.model.actions.some(({ type }) => type === "remove_all_zero_sprite"), true);
  assert.equal(result.model.actions.some(({ type }) => type === "remove_unreferenced_image"), true);
  assert.equal(result.model.metrics.find(({ id }) => id === "runtimeObjectCount")?.delta, "减少 1");
  assert.equal(result.model.metrics.find(({ id }) => id === "animationFrameRecordCount")?.delta, "减少 4");
  assert.equal(result.model.saveState.saveAsEnabled, true);
});

test("short-term optimization workflow fails closed on invalid SVGA bytes", async () => {
  const result = await runShortTermOptimizationWorkflow(new Uint8Array([1, 2, 3]), {
    sourceName: "broken.svga"
  });

  assert.equal(result.optimizedBytes, undefined);
  assert.equal(result.model.status, "failed");
  assert.equal(result.model.resultTitle, "优化失败");
  assert.equal(result.model.saveState.outputAvailable, false);
  assert.equal(result.model.saveState.overwriteSaveEnabled, false);
  assert.equal(result.model.saveState.saveAsEnabled, false);
  assert.ok(result.model.diagnostic?.code);
});

test("short-term optimization workflow redacts local paths from diagnostics", async () => {
  const sourceBytes = await createSvgaFixture();

  const result = await runShortTermOptimizationWorkflow(sourceBytes, {
    sourceName: "/Users/designer/private/optimizable.svga",
    protoPath: "/Users/designer/private/missing.proto"
  });

  assert.equal(result.optimizedBytes, undefined);
  assert.equal(result.model.status, "failed");
  assert.equal(result.model.sourceName, "optimizable.svga");
  assert.equal(JSON.stringify(result.model).includes("/Users/designer"), false);
  assert.equal(JSON.stringify(result.model).includes("private/missing.proto"), false);
});

test("short-term optimization workflow redacts path-like resource keys from models", async () => {
  const sourceBytes = await createSvgaFixture({
    images: {
      img_frame: createColoredPng(16, 16, [255, 0, 0, 255]),
      "/Users/designer/private/unused.png": createColoredPng(4, 4, [0, 0, 255, 255])
    },
    sprites: [
      { imageKey: "img_frame", frames: createFrames(4) }
    ]
  });

  const result = await runShortTermOptimizationWorkflow(sourceBytes, { sourceName: "optimizable.svga" });

  assert.ok(result.optimizedBytes);
  assert.equal(result.model.status, "optimized");
  assert.equal(JSON.stringify(result.model).includes("/Users/designer"), false);
  assert.equal(JSON.stringify(result.model).includes("private/unused.png"), false);
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

function createFrames(count: number, options: { alpha?: number } = {}): unknown[] {
  return Array.from({ length: count }, (_, index) => ({
    alpha: options.alpha ?? (index % 2 === 0 ? 1 : 0.8),
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
