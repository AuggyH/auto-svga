import assert from "node:assert/strict";
import test from "node:test";
import type {
  FormatAdapter,
  MotionAssetInfo,
  MotionAssetSource
} from "../workbench/contracts.js";
import { MotionAssetInspectionService } from "../workbench/inspection-service.js";
import { avatarFrameProductionSpec } from "../workbench/specs/index.js";
import { SvgaMotionSpecChecker } from "../workbench/svga/index.js";

test("avatar-frame production preset contains the current production baseline", () => {
  assert.equal(avatarFrameProductionSpec.id, "avatar-frame-production");
  assert.equal(avatarFrameProductionSpec.label, "Avatar Frame Production");
  assert.deepEqual(avatarFrameProductionSpec.maxDimensions, {
    width: 300,
    height: 300
  });
  assert.equal(avatarFrameProductionSpec.maxFps, 24);
  assert.equal(avatarFrameProductionSpec.maxDurationMs, 3_000);
  assert.equal(avatarFrameProductionSpec.maxFileSizeBytes, 512 * 1024);
  assert.equal(avatarFrameProductionSpec.maxResourceCount, 32);
  assert.equal(avatarFrameProductionSpec.metadata?.assetType, "avatar_frame");
  assert.equal(avatarFrameProductionSpec.metadata?.target, "production");
  assert.equal(avatarFrameProductionSpec.metadata?.calibrationStatus, "provisional");
  assert.equal(avatarFrameProductionSpec.metadata?.calibrationSampleCount, 2);
  assert.deepEqual(
    avatarFrameProductionSpec.metadata?.needsProductCalibration,
    ["maxFileSizeBytes", "maxResourceCount"]
  );
});

test("avatar-frame calibrated file-size and resource limits pass exact boundaries", async () => {
  const result = await inspectAsset(asset(
    { width: 300, height: 300 },
    { sizeBytes: 512 * 1024, resourceCount: 32 }
  ));

  assert.ok(result.value);
  assert.equal(result.value.specReport.passed, true);
});

test("avatar-frame calibrated limits reject values above their boundaries", async () => {
  const result = await inspectAsset(asset(
    { width: 300, height: 300 },
    { sizeBytes: 512 * 1024 + 1, resourceCount: 33 }
  ));

  assert.ok(result.value);
  assert.deepEqual(
    result.value.specReport.issues.map(({ code }) => code),
    ["file_size_exceeds_limit", "resource_count_exceeds_limit"]
  );
});

test("avatar-frame production preset passes a 300x300 inspected asset", async () => {
  const result = await inspectAsset(asset({ width: 300, height: 300 }));

  assert.ok(result.value);
  assert.equal(result.value.specReport.passed, true);
  assert.deepEqual(result.value.specReport.issues, []);
});

test("avatar-frame production preset rejects an inspected asset over 300x300", async () => {
  const result = await inspectAsset(asset({ width: 301, height: 300 }));

  assert.ok(result.value);
  assert.equal(result.value.specReport.passed, false);
  assert.deepEqual(
    result.value.specReport.issues.map(({ code }) => code),
    ["dimensions_exceed_limit"]
  );
  assert.deepEqual(result.value.specReport.issues[0].details, {
    actual: { width: 301, height: 300 },
    maximum: { width: 300, height: 300 }
  });
});

async function inspectAsset(assetInfo: MotionAssetInfo) {
  const service = new MotionAssetInspectionService(adapterReturning(assetInfo));
  return service.inspectWithSpec(
    source(),
    avatarFrameProductionSpec,
    new SvgaMotionSpecChecker()
  );
}

function adapterReturning(assetInfo: MotionAssetInfo): FormatAdapter {
  return {
    format: "svga",
    async probe() {
      return { format: "svga", confidence: 1, issues: [] };
    },
    async parse() {
      return { value: assetInfo, issues: [] };
    }
  };
}

function asset(
  dimensions: { width: number; height: number },
  options: { sizeBytes?: number; resourceCount?: number } = {}
): MotionAssetInfo {
  return {
    format: "svga",
    name: "avatar-frame.svga",
    sizeBytes: options.sizeBytes ?? 120_000,
    dimensions,
    timing: {
      fps: 24,
      frameCount: 72,
      durationMs: 3_000
    },
    layers: [],
    resources: Array.from({ length: options.resourceCount ?? 0 }, (_, index) => ({
      id: `resource_${index}`,
      name: `resource_${index}`,
      kind: "image" as const
    }))
  };
}

function source(): MotionAssetSource {
  return {
    id: "memory:avatar-frame.svga",
    name: "avatar-frame.svga",
    sizeBytes: 0,
    async read() {
      return new Uint8Array();
    }
  };
}
