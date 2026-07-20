import assert from "node:assert/strict";
import test from "node:test";
import type { MotionResourceInfo } from "../workbench/contracts.js";
import {
  estimateDecodedMemory,
  HIGH_MEMORY_RISK_BYTES,
  MEDIUM_MEMORY_RISK_BYTES
} from "../workbench/memory-estimation.js";

test("estimates decoded and texture memory for one resource", () => {
  const result = estimateDecodedMemory([resource("frame", 300, 300)]);

  assert.equal(result.resources[0].estimatedDecodedBytes, 300 * 300 * 4);
  assert.equal(result.resources[0].estimatedTextureBytes, 300 * 300 * 4);
  assert.equal(result.totalEstimatedDecodedResourceBytes, 300 * 300 * 4);
  assert.equal(result.memoryRiskLevel, "low");
});

test("sums resources and ranks largest decoded allocations", () => {
  const result = estimateDecodedMemory([
    resource("small", 10, 10),
    resource("large", 100, 80),
    resource("medium", 50, 50)
  ]);

  assert.equal(result.totalEstimatedDecodedResourceBytes, (100 + 8_000 + 2_500) * 4);
  assert.deepEqual(
    result.largestResourcesByDecodedBytes.map(({ resourceId }) => resourceId),
    ["large", "medium", "small"]
  );
});

test("reports sequence-frame decoded memory subtotal", () => {
  const result = estimateDecodedMemory([
    resource("frame_1", 20, 30, "sequence_frame"),
    resource("frame_2", 20, 30, "sequence_frame"),
    resource("static", 100, 100, "static_image")
  ]);

  assert.equal(result.sequenceFrameEstimatedDecodedBytes, 20 * 30 * 4 * 2);
});

test("marks totals and risk unknown when resource dimensions are missing", () => {
  const result = estimateDecodedMemory([
    resource("known", 20, 30),
    { id: "unknown", name: "unknown", kind: "image", role: "sequence_frame" }
  ]);

  assert.equal(result.resources[1].estimatedDecodedBytes, null);
  assert.equal(result.resources[1].estimatedTextureBytes, null);
  assert.equal(result.totalEstimatedDecodedResourceBytes, null);
  assert.equal(result.sequenceFrameEstimatedDecodedBytes, null);
  assert.deepEqual(result.unknownResourceIds, ["unknown"]);
  assert.equal(result.memoryRiskLevel, "unknown");
});

test("uses deterministic advisory memory risk bands", () => {
  const medium = estimateDecodedMemory([resourceByDecodedBytes("medium", MEDIUM_MEMORY_RISK_BYTES + 4)]);
  const high = estimateDecodedMemory([resourceByDecodedBytes("high", HIGH_MEMORY_RISK_BYTES + 4)]);

  assert.equal(medium.memoryRiskLevel, "medium");
  assert.equal(high.memoryRiskLevel, "high");
});

function resource(
  id: string,
  width: number,
  height: number,
  role: MotionResourceInfo["role"] = "static_image"
): MotionResourceInfo {
  return { id, name: id, kind: "image", role, dimensions: { width, height } };
}

function resourceByDecodedBytes(id: string, bytes: number): MotionResourceInfo {
  return resource(id, bytes / 4, 1);
}
