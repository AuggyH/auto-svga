import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import test from "node:test";
import protobuf from "protobufjs";
import { createTransparentImage, encodeRgbaPng } from "../../dist/utils/png-writer.js";
import {
  applyShortTermImageReplacementPreviewSessionBytes,
  createPreviewServer,
  inspectAvatarFrameBytes,
  inspectShortTermProductModelBytes,
  resetShortTermImageReplacementPreviewSessionBytes,
  runShortTermImageReplacementWorkflowBytes,
  runShortTermOptimizationWorkflowBytes,
  runShortTermRenameWorkflowBytes
} from "./server.mjs";

test("preview host returns the existing avatar-frame inspection report", async () => {
  const report = await inspectAvatarFrameBytes(
    await createSvgaFixture(301, 300, "opaque"),
    "oversized.svga"
  );

  assert.equal(report.asset.name, "oversized.svga");
  assert.deepEqual(report.asset.dimensions, { width: 301, height: 300 });
  assert.equal(report.specId, "avatar-frame-production");
  assert.equal(report.profileId, "production_target");
  assert.equal(report.profileLabel, "Avatar Frame Production Target");
  assert.match(report.profilePurpose, /new avatar-frame deliveries/i);
  assert.equal(report.passed, false);
  assert.deepEqual(
    report.issues.map(({ code }) => code),
    ["dimensions_exceed_limit"]
  );
  assert.deepEqual(
    report.calibrationNotes.map(({ field }) => field),
    ["maxFileSizeBytes", "maxResourceCount", "maxTransparentPaddingRatio"]
  );
});

test("preview host reports transparent padding from embedded PNG", async () => {
  const report = await inspectAvatarFrameBytes(
    await createSvgaFixture(300, 300, "padded"),
    "padded.svga"
  );

  assert.equal(report.passed, false);
  assert.equal(report.issues[0].code, "resource_transparent_padding_exceeds_limit");
  assert.equal(report.issues[0].path, "resources[0].alphaBounds");
});

test("preview host creates the short-term product inspection model", async () => {
  const model = await inspectShortTermProductModelBytes(
    await createSvgaFixture(300, 300, "opaque"),
    "short-term.svga"
  );

  assert.equal(model.schemaVersion, 1);
  assert.equal(model.source, "avatar-frame-inspection-report");
  assert.ok(model.prdIds.includes("S3"));
  assert.ok(model.prdIds.includes("S15"));
  assert.equal(model.overview.profileId, "production_target");
  assert.equal(model.overview.audioGroup.copy, "当前文件暂无音频资产");
  assert.equal(model.replaceableElements.targets.length, 0);
  assert.equal(model.replaceableElements.images.length, 0);
  assert.equal(model.assets.find(({ name }) => name === "img_frame")?.replaceable, false);
  assert.equal(model.assets.some(({ kind }) => kind === "audio"), true);
});

test("preview host creates the short-term optimization workflow model", async () => {
  const result = await runShortTermOptimizationWorkflowBytes(
    await createOptimizableSvgaFixture(),
    "optimizable.svga"
  );

  assert.ok(result.optimizedBytes);
  assert.equal(result.model.schemaVersion, 1);
  assert.equal(result.model.status, "optimized");
  assert.equal(result.model.actions.length, 2);
  assert.equal(result.model.validation.reopenPassed, true);
  assert.equal(result.model.saveState.saveAsEnabled, true);
});

test("preview host creates the short-term rename workflow model", async () => {
  const result = await runShortTermRenameWorkflowBytes(
    await createOptimizableSvgaFixture(),
    "img_frame",
    "profile_frame",
    "rename.svga"
  );

  assert.ok(result.renamedBytes);
  assert.equal(result.model.schemaVersion, 1);
  assert.equal(result.model.status, "renamed");
  assert.equal(result.model.referenceUpdates.length, 1);
  assert.equal(result.model.validation.newKeyPresent, true);
  assert.equal(result.model.saveState.saveAsEnabled, true);
});

test("preview host creates the short-term image replacement workflow model", async () => {
  const result = await runShortTermImageReplacementWorkflowBytes(
    await createOptimizableSvgaFixture(),
    "img_frame",
    encodeRgbaPng(createFrameImage("padded")),
    "replace.svga"
  );

  assert.ok(result.replacedBytes);
  assert.equal(result.model.schemaVersion, 1);
  assert.equal(result.model.status, "replaced");
  assert.equal(result.model.validation.replacementApplied, true);
  assert.equal(result.model.saveState.saveAsEnabled, true);
});

test("preview host creates the short-term image replacement preview session model", async () => {
  const sourceBytes = await createOptimizableSvgaFixture();
  const result = await applyShortTermImageReplacementPreviewSessionBytes(
    sourceBytes,
    "img_frame",
    encodeRgbaPng(createFrameImage("padded")),
    "replace-preview.svga"
  );

  assert.equal(result.accepted, true);
  assert.equal(result.session.model.schemaVersion, 1);
  assert.equal(result.session.model.mode, "preview");
  assert.equal(result.session.model.status, "previewDirty");
  assert.equal(result.session.model.playerAction, "remountPreview");
  assert.equal(result.session.model.saveState.saveAsEnabled, true);
  assert.notEqual(Buffer.from(result.session.previewBytes).toString("base64"), Buffer.from(sourceBytes).toString("base64"));

  const reset = await resetShortTermImageReplacementPreviewSessionBytes(sourceBytes, "replace-preview.svga");
  assert.equal(reset.model.status, "ready");
  assert.equal(reset.model.playerAction, "remountSource");
  assert.equal(reset.model.saveState.saveAsEnabled, false);
  assert.equal(Buffer.from(reset.previewBytes).toString("base64"), Buffer.from(sourceBytes).toString("base64"));
});

test("preview host exposes the inspection report through its HTTP boundary", async () => {
  const server = createPreviewServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/avatar-frame-inspection-report?name=passing.svga`,
      {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: await createSvgaFixture(300, 300, "opaque")
      }
    );
    const report = await response.json();

    assert.equal(response.status, 200);
    assert.equal(report.asset.name, "passing.svga");
    assert.equal(report.passed, true);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test("preview host exposes the short-term product model through its HTTP boundary", async () => {
  const server = createPreviewServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/short-term-product-inspection-model?name=short-term.svga`,
      {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: await createSvgaFixture(300, 300, "opaque")
      }
    );
    const model = await response.json();

    assert.equal(response.status, 200);
    assert.equal(model.schemaVersion, 1);
    assert.equal(model.overview.facts.find(({ id }) => id === "canvas")?.value, "300 x 300");
    assert.equal(model.assets.some(({ kind }) => kind === "audio"), true);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test("preview host exposes the short-term optimization workflow through its HTTP boundary", async () => {
  const server = createPreviewServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/short-term-product-optimization-workflow?name=optimizable.svga`,
      {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: await createOptimizableSvgaFixture()
      }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(typeof body.optimizedSvgaBase64, "string");
    assert.equal(body.optimization.status, "optimized");
    assert.equal(body.optimization.saveState.outputAvailable, true);
    assert.equal(body.optimization.actions.length, 2);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test("preview host exposes the short-term rename workflow through its HTTP boundary", async () => {
  const server = createPreviewServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/short-term-product-image-key-rename?name=rename.svga&from=img_frame&to=profile_frame`,
      {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: await createOptimizableSvgaFixture()
      }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(typeof body.renamedSvgaBase64, "string");
    assert.equal(body.rename.status, "renamed");
    assert.equal(body.rename.toImageKey, "profile_frame");
    assert.equal(body.rename.saveState.outputAvailable, true);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test("preview host exposes the short-term image replacement workflow through its HTTP boundary", async () => {
  const server = createPreviewServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/short-term-product-image-replacement-workflow`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "replace.svga",
          imageKey: "img_frame",
          svgaBase64: Buffer.from(await createOptimizableSvgaFixture()).toString("base64"),
          pngBase64: Buffer.from(encodeRgbaPng(createFrameImage("padded"))).toString("base64")
        })
      }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(typeof body.replacedSvgaBase64, "string");
    assert.equal(body.replacement.status, "replaced");
    assert.equal(body.replacement.imageKey, "img_frame");
    assert.equal(body.replacement.saveState.outputAvailable, true);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test("preview host exposes the short-term image replacement preview session through its HTTP boundary", async () => {
  const server = createPreviewServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const sourceBytes = await createOptimizableSvgaFixture();
    const applyResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/short-term-product-image-replacement-preview-session`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "apply",
          name: "replace-preview.svga",
          imageKey: "img_frame",
          svgaBase64: Buffer.from(sourceBytes).toString("base64"),
          pngBase64: Buffer.from(encodeRgbaPng(createFrameImage("padded"))).toString("base64")
        })
      }
    );
    const applyBody = await applyResponse.json();

    assert.equal(applyResponse.status, 200);
    assert.equal(applyBody.accepted, true);
    assert.equal(typeof applyBody.previewSvgaBase64, "string");
    assert.equal(applyBody.session.status, "previewDirty");
    assert.equal(applyBody.session.playerAction, "remountPreview");

    const resetResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/short-term-product-image-replacement-preview-session`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "reset",
          name: "replace-preview.svga",
          svgaBase64: Buffer.from(sourceBytes).toString("base64")
        })
      }
    );
    const resetBody = await resetResponse.json();

    assert.equal(resetResponse.status, 200);
    assert.equal(resetBody.accepted, true);
    assert.equal(resetBody.previewSvgaBase64, Buffer.from(sourceBytes).toString("base64"));
    assert.equal(resetBody.session.status, "ready");
    assert.equal(resetBody.session.playerAction, "remountSource");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

async function createSvgaFixture(width, height, imageMode) {
  const root = await protobuf.load(fileURLToPath(new URL("../../proto/svga.proto", import.meta.url)));
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const payload = MovieEntity.create({
    version: "2.0",
    params: { viewBoxWidth: width, viewBoxHeight: height, fps: 24, frames: 1 },
    images: { img_frame: encodeRgbaPng(createFrameImage(imageMode)) },
    sprites: [{
      imageKey: "img_frame",
      frames: [{
        alpha: 1,
        layout: { x: 0, y: 0, width: 10, height: 10 },
        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
        clipPath: "",
        shapes: []
      }]
    }],
    audios: []
  });
  return deflateSync(MovieEntity.encode(payload).finish());
}

async function createOptimizableSvgaFixture() {
  const root = await protobuf.load(fileURLToPath(new URL("../../proto/svga.proto", import.meta.url)));
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const duplicateBytes = encodeRgbaPng(createFrameImage("opaque"));
  const sweepBytes = encodeRgbaPng(createFrameImage("padded"));
  const unusedBytes = encodeRgbaPng(createFrameImage("opaque"));
  const payload = MovieEntity.create({
    version: "2.0",
    params: { viewBoxWidth: 300, viewBoxHeight: 300, fps: 24, frames: 1 },
    images: {
      img_frame: duplicateBytes,
      img_frame_copy: duplicateBytes,
      img_sweep: sweepBytes,
      img_unused: unusedBytes
    },
    sprites: [{
      imageKey: "img_frame",
      frames: [{
        alpha: 1,
        layout: { x: 0, y: 0, width: 10, height: 10 },
        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
        clipPath: "",
        shapes: []
      }]
    }, {
      imageKey: "img_frame_copy",
      matteKey: "img_sweep",
      frames: [{
        alpha: 1,
        layout: { x: 0, y: 0, width: 10, height: 10 },
        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
        clipPath: "",
        shapes: []
      }]
    }],
    audios: []
  });
  return deflateSync(MovieEntity.encode(payload).finish());
}

function createFrameImage(mode) {
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
