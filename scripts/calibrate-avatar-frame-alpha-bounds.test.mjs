import assert from "node:assert/strict";
import test from "node:test";
import { summarizeResources } from "./calibrate-avatar-frame-alpha-bounds.mjs";

test("summarizes alpha status counts, ratios and threshold exceptions", () => {
  const resources = [
    resource("known-low", { status: "known", transparentPaddingRatio: 0.25 }),
    resource("known-high", { status: "known", transparentPaddingRatio: 0.75 }),
    resource("opaque", { status: "opaqueOnly" }),
    resource("transparent", { status: "fullyTransparent" }),
    resource("unknown", { status: "unknown" }),
    resource("unsupported", { status: "unsupported" })
  ];

  const summary = summarizeResources(resources, 0.5);

  assert.equal(summary.resourceCount, 6);
  assert.deepEqual(summary.statusCounts, {
    known: 2,
    fullyTransparent: 1,
    opaqueOnly: 1,
    unknown: 1,
    unsupported: 1
  });
  assert.deepEqual(summary.ratioStats, {
    count: 3,
    min: 0,
    max: 0.75,
    average: 0.333333,
    median: 0.25
  });
  assert.deepEqual(
    summary.overThresholdResources.map(({ id }) => id),
    ["known-high"]
  );
  assert.deepEqual(
    summary.fullyTransparentResources.map(({ id }) => id),
    ["transparent"]
  );
});

test("returns empty ratio statistics when no measured resource is available", () => {
  const summary = summarizeResources([
    resource("unknown", { status: "unknown" }),
    resource("unsupported", { status: "unsupported" })
  ]);

  assert.deepEqual(summary.ratioStats, {
    count: 0,
    min: null,
    max: null,
    average: null,
    median: null
  });
});

function resource(id, alphaBounds) {
  return {
    samplePath: "fixture.svga",
    id,
    dimensions: { width: 300, height: 300 },
    sizeBytes: 100,
    alphaBounds
  };
}
