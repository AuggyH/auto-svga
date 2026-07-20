import assert from "node:assert/strict";
import test from "node:test";
import type {
  ImageAlphaBounds,
  MotionResourceInfo,
  MotionResourceRole
} from "../workbench/contracts.js";
import {
  collectSequenceFrameEvidence,
  NEAR_EMPTY_TRANSPARENT_PADDING_RATIO
} from "../workbench/sequence-frame-evidence.js";

test("groups duplicate sequence frames by stable content hash", () => {
  const result = collectSequenceFrameEvidence([
    resource("frame_1", { hash: "same" }),
    resource("frame_2", { hash: "same" }),
    resource("frame_3", { hash: "different" })
  ]);

  assert.equal(result.duplicateEvidenceStatus, "known");
  assert.deepEqual(result.duplicateFrameGroups, [{
    key: "sha256:encoded_bytes:same",
    resourceIds: ["frame_1", "frame_2"]
  }]);
  assert.equal(result.evidenceConfidence, "high");
  assert.equal(result.uncertainty, "low");
});

test("does not guess duplicates without reliable hashes", () => {
  const result = collectSequenceFrameEvidence([
    resource("frame_1", { hash: undefined }),
    resource("frame_2", { hash: undefined })
  ]);

  assert.equal(result.duplicateEvidenceStatus, "insufficient_evidence");
  assert.deepEqual(result.duplicateFrameGroups, []);
  assert.deepEqual(result.missingContentHashResourceIds, ["frame_1", "frame_2"]);
});

test("reports fully transparent and provisional near-empty frames", () => {
  const result = collectSequenceFrameEvidence([
    resource("transparent", { alphaBounds: { status: "fullyTransparent" } }),
    resource("near-empty", {
      alphaBounds: {
        status: "known",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        transparentPaddingRatio: NEAR_EMPTY_TRANSPARENT_PADDING_RATIO
      }
    }),
    resource("unknown", { alphaBounds: { status: "unknown" } })
  ]);

  assert.deepEqual(result.fullyTransparentFrames, ["transparent"]);
  assert.deepEqual(result.emptyOrNearEmptyFrames, ["transparent", "near-empty"]);
  assert.ok(!result.emptyOrNearEmptyFrames.includes("unknown"));
  assert.deepEqual(result.missingAlphaBoundsResourceIds, ["unknown"]);
});

test("groups repeated alpha bounds and dimensions as separate evidence", () => {
  const alphaBounds: ImageAlphaBounds = {
    status: "known",
    x: 4,
    y: 6,
    width: 20,
    height: 30,
    transparentPaddingRatio: 0.5
  };
  const result = collectSequenceFrameEvidence([
    resource("frame_1", { alphaBounds }),
    resource("frame_2", { alphaBounds }),
    resource("frame_3", {
      dimensions: { width: 40, height: 50 },
      alphaBounds: { ...alphaBounds, x: 5 }
    })
  ]);

  assert.deepEqual(result.repeatedAlphaBoundsGroups[0].resourceIds, ["frame_1", "frame_2"]);
  assert.deepEqual(result.repeatedDimensionsGroups[0].resourceIds, ["frame_1", "frame_2"]);
});

test("ignores non-sequence resources", () => {
  const result = collectSequenceFrameEvidence([
    resource("static", { role: "static_image", hash: "same" }),
    resource("mask", { role: "mask_or_matte", hash: "same" })
  ]);

  assert.equal(result.analyzedResourceCount, 0);
  assert.equal(result.duplicateEvidenceStatus, "not_applicable");
  assert.equal(result.evidenceConfidence, "unknown");
  assert.equal(result.uncertainty, "high");
});

interface ResourceOptions {
  role?: MotionResourceRole;
  hash?: string;
  dimensions?: { width: number; height: number };
  alphaBounds?: ImageAlphaBounds;
}

function resource(id: string, options: ResourceOptions = {}): MotionResourceInfo {
  return {
    id,
    name: id,
    kind: "image",
    role: options.role ?? "sequence_frame",
    dimensions: options.dimensions ?? { width: 20, height: 30 },
    alphaBounds: options.alphaBounds ?? {
      status: "known",
      x: 0,
      y: 0,
      width: 20,
      height: 30,
      transparentPaddingRatio: 0
    },
    contentHash: options.hash === undefined
      ? undefined
      : { algorithm: "sha256", value: options.hash, scope: "encoded_bytes" }
  };
}
