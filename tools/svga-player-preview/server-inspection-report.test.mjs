import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import test from "node:test";
import protobuf from "protobufjs";
import { createTransparentImage, encodeRgbaPng } from "../../dist/utils/png-writer.js";
import { createPreviewServer, inspectAvatarFrameBytes } from "./server.mjs";

test("preview host returns the existing avatar-frame inspection report", async () => {
  const report = await inspectAvatarFrameBytes(
    await createSvgaFixture(301, 300, "opaque"),
    "oversized.svga"
  );

  assert.equal(report.asset.name, "oversized.svga");
  assert.deepEqual(report.asset.dimensions, { width: 301, height: 300 });
  assert.equal(report.specId, "avatar-frame-production");
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
