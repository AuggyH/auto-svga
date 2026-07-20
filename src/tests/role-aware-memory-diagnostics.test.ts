import assert from "node:assert/strict";
import test from "node:test";
import type { MotionResourceInfo, MotionResourceRole } from "../workbench/contracts.js";
import { diagnoseMemoryByRole } from "../workbench/memory-diagnostics.js";
import { estimateDecodedMemory } from "../workbench/memory-estimation.js";

test("aggregates memory for every supported resource role", () => {
  const result = diagnostics([
    resource("static", "static_image", 100, 50),
    resource("sequence_1", "sequence_frame", 20, 30),
    resource("sequence_2", "sequence_frame", 20, 30),
    resource("sweep", "baked_sweep_frame", 40, 10),
    resource("mask", "mask_or_matte", 30, 30),
    resource("unclassified", "unknown", 10, 10)
  ]);

  assertRole(result.byRole.static_image, 1, 100 * 50 * 4);
  assertRole(result.byRole.sequence_frame, 2, 20 * 30 * 4 * 2);
  assertRole(result.byRole.baked_sweep_frame, 1, 40 * 10 * 4);
  assertRole(result.byRole.mask_or_matte, 1, 30 * 30 * 4);
  assertRole(result.byRole.unknown, 1, 10 * 10 * 4);
  assert.equal(result.sequenceFrameEstimatedDecodedBytes, 20 * 30 * 4 * 2);
});

test("maps missing role to unknown without guessing", () => {
  const result = diagnostics([{
    id: "missing-role",
    name: "missing-role",
    kind: "image",
    dimensions: { width: 10, height: 20 }
  }]);

  assertRole(result.byRole.unknown, 1, 10 * 20 * 4);
  assert.equal(result.byRole.static_image.resourceCount, 0);
});

test("keeps role totals unknown when dimensions are unavailable", () => {
  const result = diagnostics([
    resource("known", "sequence_frame", 20, 30),
    { id: "unknown", name: "unknown", kind: "image", role: "sequence_frame" }
  ]);
  const sequence = result.byRole.sequence_frame;

  assert.equal(sequence.resourceCount, 2);
  assert.equal(sequence.knownMemoryCount, 1);
  assert.equal(sequence.unknownMemoryCount, 1);
  assert.equal(sequence.totalEstimatedDecodedBytes, null);
  assert.equal(sequence.totalEstimatedTextureBytes, null);
  assert.equal(result.sequenceFrameEstimatedDecodedBytes, null);
});

test("ranks largest known resources within each role", () => {
  const result = diagnostics([
    resource("small", "static_image", 10, 10),
    resource("large", "static_image", 100, 80),
    resource("medium", "static_image", 50, 50),
    { id: "unknown", name: "unknown", kind: "image", role: "static_image" }
  ]);

  assert.deepEqual(
    result.byRole.static_image.largestResourcesByDecodedBytes.map(
      ({ resourceId }) => resourceId
    ),
    ["large", "medium", "small"]
  );
});

function diagnostics(resources: readonly MotionResourceInfo[]) {
  return diagnoseMemoryByRole(estimateDecodedMemory(resources));
}

function resource(
  id: string,
  role: MotionResourceRole,
  width: number,
  height: number
): MotionResourceInfo {
  return { id, name: id, kind: "image", role, dimensions: { width, height } };
}

function assertRole(
  diagnostic: ReturnType<typeof diagnostics>["byRole"][MotionResourceRole],
  count: number,
  bytes: number
): void {
  assert.equal(diagnostic.resourceCount, count);
  assert.equal(diagnostic.knownMemoryCount, count);
  assert.equal(diagnostic.unknownMemoryCount, 0);
  assert.equal(diagnostic.totalEstimatedDecodedBytes, bytes);
  assert.equal(diagnostic.totalEstimatedTextureBytes, bytes);
}
