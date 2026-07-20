import assert from "node:assert/strict";
import test from "node:test";
import { classifySvgaResources } from "../workbench/svga/resource-classifier.js";

test("classifies sprite-backed ordinary images as static", () => {
  const result = classify(["frame_base"], [
    sprite("frame_base")
  ]);

  assert.deepEqual(result.get("frame_base"), {
    role: "static_image",
    evidence: ["referenced_by_sprite"]
  });
});

test("classifies baked sweep names before generic sequence detection", () => {
  const result = classify(
    ["sweep_core_baked_001", "sweep_core_baked_002", "sweep_core_baked_003"],
    [
      sprite("sweep_core_baked_001"),
      sprite("sweep_core_baked_002"),
      sprite("sweep_core_baked_003")
    ]
  );

  assert.deepEqual(
    [...result.values()].map(({ role }) => role),
    ["baked_sweep_frame", "baked_sweep_frame", "baked_sweep_frame"]
  );
});

test("classifies same-size continuous numbered groups as sequence frames", () => {
  const result = classify(
    ["glint_4277", "glint_4276", "glint_4275", "other"],
    [
      sprite("glint_4277"),
      sprite("glint_4276"),
      sprite("glint_4275"),
      sprite("other")
    ]
  );

  assert.equal(result.get("glint_4275")?.role, "sequence_frame");
  assert.equal(result.get("glint_4276")?.role, "sequence_frame");
  assert.equal(result.get("glint_4277")?.role, "sequence_frame");
  assert.equal(result.get("other")?.role, "static_image");
});

test("does not group numbered resources with different dimensions", () => {
  const result = classifySvgaResources({
    images: [
      image("frame_001", 32, 32),
      image("frame_002", 64, 64),
      image("frame_003", 32, 32)
    ],
    sprites: [
      sprite("frame_001"),
      sprite("frame_002"),
      sprite("frame_003")
    ]
  });

  assert.ok([...result.values()].every(({ role }) => role === "static_image"));
});

test("does not infer a sequence when dimensions are unavailable", () => {
  const result = classifySvgaResources({
    images: [
      { imageKey: "frame_001", bytes: new Uint8Array() },
      { imageKey: "frame_002", bytes: new Uint8Array() },
      { imageKey: "frame_003", bytes: new Uint8Array() }
    ],
    sprites: [
      sprite("frame_001"),
      sprite("frame_002"),
      sprite("frame_003")
    ]
  });

  assert.ok([...result.values()].every(({ role }) => role === "static_image"));
});

test("classifies matte references and explicit mask names as mask or matte", () => {
  const result = classifySvgaResources({
    images: [
      image("frame_alpha", 32, 32),
      image("edge_mask_001", 32, 32),
      image("content", 32, 32)
    ],
    sprites: [
      sprite("content", "frame_alpha"),
      sprite("edge_mask_001")
    ]
  });

  assert.equal(result.get("frame_alpha")?.role, "mask_or_matte");
  assert.equal(result.get("edge_mask_001")?.role, "mask_or_matte");
});

test("keeps unreferenced resources unknown when evidence is insufficient", () => {
  const result = classify(["orphan"], []);

  assert.deepEqual(result.get("orphan"), {
    role: "unknown",
    evidence: ["insufficient_evidence"]
  });
});

function classify(imageKeys: string[], sprites: ReturnType<typeof sprite>[]) {
  return classifySvgaResources({
    images: imageKeys.map((imageKey) => image(imageKey, 32, 32)),
    sprites
  });
}

function image(imageKey: string, width: number, height: number) {
  return {
    imageKey,
    bytes: new Uint8Array(),
    dimensions: { width, height }
  };
}

function sprite(imageKey: string, matteKey = "") {
  return {
    index: 0,
    imageKey,
    matteKey,
    frameCount: 1
  };
}
