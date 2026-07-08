import assert from "node:assert/strict";
import test from "node:test";
import type { MotionAssetInfo } from "../workbench/contracts.js";
import { diagnoseRuntimeStructure } from "../workbench/runtime-structure-diagnostics.js";

test("diagnoses runtime structure counts with friendly metric sources", () => {
  const diagnostics = diagnoseRuntimeStructure(assetFixture());

  assert.equal(diagnostics.spriteCount, 3);
  assert.equal(diagnostics.frameEntityCount, 12);
  assert.equal(diagnostics.alphaPositiveFrameCount, 4);
  assert.equal(diagnostics.zeroAlphaFrameCount, 8);
  assert.equal(diagnostics.allZeroSpriteCount, 1);
  assert.equal(diagnostics.allZeroFrameEntityCount, 4);
  assert.deepEqual(diagnostics.allZeroSpriteResourceIds, ["seq_003"]);
  assert.equal(diagnostics.perFrameVisibleSpritePeak, 2);
  assert.equal(diagnostics.perFrameVisibleSpriteAverage, 1);
  assert.equal(diagnostics.invisibleFrameRatio, 8 / 12);
  assert.equal(diagnostics.sequenceFrameFanout.groupCount, 1);
  assert.equal(diagnostics.sequenceFrameFanout.maxSpriteReferencesInGroup, 3);
  assert.ok(diagnostics.evidence.some((item) => item === "spriteCount=3"));
  assert.ok(diagnostics.evidence.some((item) => item === "frameEntityCount=12"));
});

function assetFixture(): MotionAssetInfo {
  return {
    format: "svga",
    name: "runtime-structure.svga",
    sizeBytes: 1024,
    dimensions: { width: 300, height: 300 },
    timing: { fps: 24, frameCount: 4, durationMs: 167 },
    resources: [
      resource("seq_001"),
      resource("seq_002"),
      resource("seq_003")
    ],
    layers: [
      layer("sprite_0", "seq_001", [1, 1, 0, 0]),
      layer("sprite_1", "seq_002", [0, 1, 1, 0]),
      layer("sprite_2", "seq_003", [0, 0, 0, 0])
    ]
  };
}

function resource(id: string): MotionAssetInfo["resources"][number] {
  return {
    id,
    name: id,
    kind: "image",
    role: "sequence_frame",
    sizeBytes: 10,
    dimensions: { width: 10, height: 10 }
  };
}

function layer(
  id: string,
  resourceId: string,
  frameAlphas: readonly number[]
): MotionAssetInfo["layers"][number] {
  return {
    id,
    name: id,
    kind: "sprite",
    resourceIds: [resourceId],
    metadata: {
      frameCount: frameAlphas.length,
      frameAlphas
    }
  };
}
