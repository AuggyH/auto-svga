import assert from "node:assert/strict";
import test from "node:test";
import {
  summarizePolicyDiagnostics,
  summarizeResources,
  summarizeSequenceGroups
} from "./calibrate-avatar-frame-alpha-bounds.mjs";

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
  assert.deepEqual(summary.roleCounts, {
    static_image: 2,
    sequence_frame: 1,
    baked_sweep_frame: 1,
    mask_or_matte: 1,
    unknown: 1
  });
  assert.deepEqual(summary.roleStats.sequence_frame, {
    resourceCount: 1,
    statusCounts: {
      known: 1,
      fullyTransparent: 0,
      opaqueOnly: 0,
      unknown: 0,
      unsupported: 0
    },
    knownAlphaBoundsCount: 1,
    unknownAlphaBoundsCount: 0,
    ratioStats: {
      count: 1,
      min: 0.75,
      max: 0.75,
      average: 0.75,
      median: 0.75
    },
    overThresholdCount: 1,
    fullyTransparentCount: 0
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

test("summarizes role-aware policy severity and uncertainty", () => {
  const summary = summarizePolicyDiagnostics([
    diagnostic("static_image", "error", "low", "static_padding"),
    diagnostic("sequence_frame", "warning", "medium", "sequence_padding"),
    diagnostic("sequence_frame", "advisory", "high", "sequence_review")
  ]);

  assert.deepEqual(summary.severityCounts, { error: 1, warning: 1, advisory: 1 });
  assert.deepEqual(summary.uncertaintyCounts, { low: 1, medium: 1, high: 1 });
  assert.equal(summary.byRole.sequence_frame.diagnosticCount, 2);
  assert.deepEqual(summary.byRole.sequence_frame.policyCodeCounts, {
    sequence_padding: 1,
    sequence_review: 1
  });
});

test("summarizes sequence group padding and policy counts", () => {
  const summary = summarizeSequenceGroups([
    sequenceGroup("one", 3, 0.75, "warning"),
    sequenceGroup("two", 5, 0.25, "advisory")
  ]);

  assert.equal(summary.groupCount, 2);
  assert.deepEqual(summary.framesPerGroup, {
    count: 2,
    min: 3,
    max: 5,
    average: 4,
    median: 4
  });
  assert.deepEqual(summary.highPaddingFrameRatio, {
    count: 2,
    min: 0.25,
    max: 0.75,
    average: 0.5,
    median: 0.5
  });
  assert.equal(summary.warningCount, 1);
  assert.equal(summary.advisoryCount, 1);
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
  const roles = {
    "known-low": "static_image",
    "known-high": "sequence_frame",
    opaque: "static_image",
    transparent: "baked_sweep_frame",
    unknown: "unknown",
    unsupported: "mask_or_matte"
  };
  return {
    samplePath: "fixture.svga",
    id,
    dimensions: { width: 300, height: 300 },
    sizeBytes: 100,
    role: roles[id],
    alphaBounds
  };
}

function diagnostic(role, severity, uncertainty, policyCode) {
  return { role, severity, uncertainty, policyCode };
}

function sequenceGroup(groupId, frameCount, highPaddingFrameRatio, severity) {
  return {
    groupId,
    role: "sequence_frame",
    frameCount,
    ratioStats: {
      count: frameCount,
      min: 0,
      max: 1,
      average: highPaddingFrameRatio,
      median: highPaddingFrameRatio
    },
    highPaddingFrameRatio,
    policySeverities: [severity]
  };
}
