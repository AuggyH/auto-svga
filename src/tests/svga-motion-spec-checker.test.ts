import assert from "node:assert/strict";
import test from "node:test";
import type {
  MotionAssetInfo,
  MotionSpec
} from "../workbench/contracts.js";
import { SvgaMotionSpecChecker } from "../workbench/svga/index.js";

const deliverySpec: MotionSpec = {
  id: "avatar-frame-delivery",
  label: "Avatar frame delivery",
  maxFileSizeBytes: 200_000,
  maxDimensions: { width: 300, height: 300 },
  maxDurationMs: 3_000,
  maxFps: 30,
  maxResourceCount: 20
};

test("SVGA MotionSpecChecker passes assets within every limit", async () => {
  const report = await new SvgaMotionSpecChecker().check(asset(), deliverySpec);

  assert.equal(report.specId, deliverySpec.id);
  assert.equal(report.passed, true);
  assert.deepEqual(report.issues, []);
});

test("SVGA MotionSpecChecker reports a single exceeded limit", async () => {
  const report = await new SvgaMotionSpecChecker().check(
    asset({ sizeBytes: 200_001 }),
    deliverySpec
  );

  assert.equal(report.passed, false);
  assert.equal(report.issues.length, 1);
  assert.deepEqual(report.issues[0], {
    severity: "error",
    code: "file_size_exceeds_limit",
    message: "File size exceeds the specification limit.",
    path: "sizeBytes",
    details: { actual: 200_001, maximum: 200_000 }
  });
});

test("SVGA MotionSpecChecker reports multiple exceeded limits together", async () => {
  const report = await new SvgaMotionSpecChecker().check(
    asset({
      sizeBytes: 200_001,
      dimensions: { width: 301, height: 300 },
      timing: { fps: 31, frameCount: 120, durationMs: 3_001 },
      resources: resources(21)
    }),
    deliverySpec
  );

  assert.equal(report.passed, false);
  assert.deepEqual(
    report.issues.map(({ code }) => code),
    [
      "file_size_exceeds_limit",
      "dimensions_exceed_limit",
      "duration_exceeds_limit",
      "fps_exceeds_limit",
      "resource_count_exceeds_limit"
    ]
  );
  assert.ok(report.issues.every(({ severity, message }) => severity === "error" && message.length > 0));
});

test("SVGA MotionSpecChecker treats exact limit values as passing", async () => {
  const report = await new SvgaMotionSpecChecker().check(
    asset({
      sizeBytes: 200_000,
      dimensions: { width: 300, height: 300 },
      timing: { fps: 30, frameCount: 90, durationMs: 3_000 },
      resources: resources(20)
    }),
    deliverySpec
  );

  assert.equal(report.passed, true);
  assert.deepEqual(report.issues, []);
});

test("SVGA MotionSpecChecker reports required metadata that is unavailable", async () => {
  const report = await new SvgaMotionSpecChecker().check(
    asset({
      dimensions: undefined,
      timing: {}
    }),
    deliverySpec
  );

  assert.equal(report.passed, false);
  assert.deepEqual(
    report.issues.map(({ code }) => code),
    ["dimensions_unavailable", "duration_unavailable", "fps_unavailable"]
  );
});

function asset(overrides: Partial<MotionAssetInfo> = {}): MotionAssetInfo {
  return {
    format: "svga",
    name: "fixture.svga",
    sizeBytes: 120_000,
    dimensions: { width: 300, height: 300 },
    timing: {
      fps: 30,
      frameCount: 72,
      durationMs: 2_400
    },
    layers: [],
    resources: resources(6),
    ...overrides
  };
}

function resources(count: number): MotionAssetInfo["resources"] {
  return Array.from({ length: count }, (_, index) => ({
    id: `image_${index}`,
    name: `image_${index}`,
    kind: "image"
  }));
}
