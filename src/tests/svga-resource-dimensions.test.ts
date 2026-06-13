import assert from "node:assert/strict";
import test from "node:test";
import type { MotionAssetInfo, MotionSpec } from "../workbench/contracts.js";
import {
  readEmbeddedImageMetadata,
  SvgaMotionSpecChecker
} from "../workbench/svga/index.js";

const spec: MotionSpec = {
  id: "avatar-frame-resource-dimensions",
  label: "Avatar frame resource dimensions",
  maxResourceDimensions: { width: 300, height: 300 }
};

test("embedded image metadata reports unknown without throwing", () => {
  assert.deepEqual(
    readEmbeddedImageMetadata(Uint8Array.from([1, 2, 3, 4])),
    { format: "unknown" }
  );
});

test("resource dimension check passes when all embedded images are within 300x300", async () => {
  const report = await check([
    image("frame", { width: 300, height: 300 }),
    image("glint", { width: 64, height: 64 })
  ]);

  assert.equal(report.passed, true);
  assert.deepEqual(report.issues, []);
});

test("resource dimension check reports an embedded image wider than 300", async () => {
  const report = await check([image("wide", { width: 301, height: 100 })]);

  assert.equal(report.passed, false);
  assert.deepEqual(report.issues[0], {
    severity: "error",
    code: "resource_dimensions_exceed_limit",
    message: "Embedded image dimensions exceed the specification limit.",
    path: "resources[0].dimensions",
    details: {
      resourceId: "wide",
      actual: { width: 301, height: 100 },
      maximum: { width: 300, height: 300 }
    }
  });
});

test("resource dimension check reports an embedded image taller than 300", async () => {
  const report = await check([image("tall", { width: 100, height: 301 })]);

  assert.equal(report.passed, false);
  assert.equal(report.issues[0].code, "resource_dimensions_exceed_limit");
  assert.deepEqual(report.issues[0].details?.actual, { width: 100, height: 301 });
});

test("resource dimension check warns when embedded image dimensions are unknown", async () => {
  const report = await check([image("unknown")]);

  assert.equal(report.passed, true);
  assert.deepEqual(report.issues[0], {
    severity: "warning",
    code: "resource_dimensions_unavailable",
    message: "Embedded image dimensions are unavailable.",
    path: "resources[0].dimensions",
    details: {
      resourceId: "unknown",
      maximum: { width: 300, height: 300 }
    }
  });
});

function check(resources: MotionAssetInfo["resources"]) {
  return new SvgaMotionSpecChecker().check({
    format: "svga",
    name: "fixture.svga",
    sizeBytes: 100,
    dimensions: { width: 300, height: 300 },
    timing: {},
    layers: [],
    resources
  }, spec);
}

function image(id: string, dimensions?: { width: number; height: number }) {
  return {
    id,
    name: id,
    kind: "image" as const,
    dimensions
  };
}
