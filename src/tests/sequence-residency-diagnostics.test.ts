import assert from "node:assert/strict";
import test from "node:test";
import type { MotionResourceInfo, MotionResourceRole } from "../workbench/contracts.js";
import { estimateDecodedMemory } from "../workbench/memory-estimation.js";
import { diagnoseSequenceResidency } from "../workbench/sequence-residency-diagnostics.js";

test("recognizes one continuous sequence group and conservative residency models", () => {
  const result = diagnostics([
    resource("spark_001", "sequence_frame", 20, 30),
    resource("spark_002", "sequence_frame", 20, 30),
    resource("spark_003", "sequence_frame", 20, 30)
  ]);

  assert.equal(result.sequenceGroupCount, 1);
  assert.deepEqual(result.framesPerGroup.map(({ frameCount }) => frameCount), [3]);
  assert.equal(result.totalSequenceFrameEstimatedDecodedBytes, 20 * 30 * 4 * 3);
  assert.ok(result.possibleResidencyModels.includes("all_frames_resident"));
  assert.ok(result.possibleResidencyModels.includes("group_resident"));
  assert.ok(result.possibleResidencyModels.includes("sprite_sheet_candidate"));
  assert.equal(result.uncertainty, "medium");
});

test("separates multiple numbered sequence groups", () => {
  const result = diagnostics([
    ...numberedGroup("spark", "sequence_frame", 3),
    ...numberedGroup("burst", "sequence_frame", 4)
  ]);

  assert.equal(result.sequenceGroupCount, 2);
  assert.deepEqual(
    result.framesPerGroup.map(({ frameCount }) => frameCount).sort(),
    [3, 4]
  );
});

test("groups baked sweep frames and enables windowed advisory for long groups", () => {
  const result = diagnostics(numberedGroup("sweep", "baked_sweep_frame", 8));

  assert.equal(result.sequenceGroupCount, 1);
  assert.equal(result.largestSequenceGroupsByDecodedBytes[0].role, "baked_sweep_frame");
  assert.ok(result.possibleResidencyModels.includes("windowed_or_streaming"));
});

test("uses explicit group metadata with low uncertainty", () => {
  const resources = [1, 2, 3].map((frame) => resource(
    `effect-${frame}`,
    "sequence_frame",
    20,
    30,
    { sequenceGroupId: "effect" }
  ));
  const result = diagnostics(resources);

  assert.equal(result.sequenceGroupCount, 1);
  assert.equal(result.uncertainty, "low");
  assert.ok(result.evidence.includes("known_sequence_group_metadata"));
});

test("returns unknown model and high uncertainty when grouping evidence is insufficient", () => {
  const result = diagnostics([
    resource("first", "sequence_frame", 20, 30),
    resource("second", "sequence_frame", 20, 30)
  ]);

  assert.equal(result.sequenceGroupCount, 0);
  assert.deepEqual(result.possibleResidencyModels, ["all_frames_resident", "unknown"]);
  assert.equal(result.uncertainty, "high");
  assert.deepEqual(result.ungroupedResourceIds, ["first", "second"]);
});

test("marks risk high when sequence frames dominate decoded memory", () => {
  const resources = [
    ...numberedGroup("sequence", "sequence_frame", 3, 1024, 1024),
    resource("static", "static_image", 10, 10)
  ];
  const result = diagnostics(resources);

  assert.equal(result.advisoryRiskLevel, "high");
});

test("keeps totals and risk unknown when a sequence frame lacks dimensions", () => {
  const resources: MotionResourceInfo[] = [
    resource("frame_001", "sequence_frame", 20, 30),
    resource("frame_002", "sequence_frame", 20, 30),
    { id: "frame_003", name: "frame_003", kind: "image", role: "sequence_frame" }
  ];
  const result = diagnostics(resources);

  assert.equal(result.totalSequenceFrameEstimatedDecodedBytes, null);
  assert.equal(result.advisoryRiskLevel, "unknown");
  assert.equal(result.uncertainty, "high");
});

function diagnostics(resources: readonly MotionResourceInfo[]) {
  return diagnoseSequenceResidency(resources, estimateDecodedMemory(resources));
}

function numberedGroup(
  prefix: string,
  role: "sequence_frame" | "baked_sweep_frame",
  count: number,
  width = 20,
  height = 30
): MotionResourceInfo[] {
  return Array.from({ length: count }, (_, index) => (
    resource(`${prefix}_${String(index + 1).padStart(3, "0")}`, role, width, height)
  ));
}

function resource(
  id: string,
  role: MotionResourceRole,
  width: number,
  height: number,
  metadata?: Readonly<Record<string, unknown>>
): MotionResourceInfo {
  return { id, name: id, kind: "image", role, dimensions: { width, height }, metadata };
}
