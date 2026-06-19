import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type {
  ImageAlphaBounds,
  MotionResourceInfo,
  MotionResourceRole
} from "../workbench/contracts.js";
import { estimateDecodedMemory } from "../workbench/memory-estimation.js";
import {
  evaluateRoleAwareTransparentPadding
} from "../workbench/role-aware-transparent-padding.js";
import { diagnoseSequenceResidency } from "../workbench/sequence-residency-diagnostics.js";

test("applies explicit static, mask, and unknown role semantics", () => {
  const result = evaluate([
    resource("static", "static_image", known(0.75)),
    resource("mask", "mask_or_matte", known(0.75)),
    resource("unknown", "unknown", known(0.75))
  ]);

  assert.deepEqual(
    result.diagnostics.map(({ role, severity, policyCode }) => ({ role, severity, policyCode })),
    [
      {
        role: "static_image",
        severity: "error",
        policyCode: "static_image_padding_exceeds_threshold"
      },
      {
        role: "mask_or_matte",
        severity: "info",
        policyCode: "mask_or_matte_padding_review"
      },
      {
        role: "unknown",
        severity: "unknown",
        policyCode: "unknown_role_padding_needs_review"
      }
    ]
  );
});

test("uses group-level sequence evidence instead of failing individual frames", () => {
  const result = evaluate([
    resource("spark_001", "sequence_frame", known(0.8)),
    resource("spark_002", "sequence_frame", known(0.7)),
    resource("spark_003", "sequence_frame", known(0.1))
  ]);

  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].severity, "warning");
  assert.equal(result.diagnostics[0].policyCode, "sequence_group_padding_majority_high");
  assert.match(result.diagnostics[0].groupId ?? "", /spark_/);
  assert.equal(result.diagnostics[0].resourceKey, undefined);
});

test("keeps baked sweep padding advisory even when most frames are padded", () => {
  const result = evaluate([
    resource("sweep_001", "baked_sweep_frame", known(0.9)),
    resource("sweep_002", "baked_sweep_frame", known(0.8)),
    resource("sweep_003", "baked_sweep_frame", known(0.7))
  ]);

  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].severity, "advisory");
  assert.equal(result.diagnostics[0].policyCode, "baked_sweep_group_padding_review");
});

test("retains role context for fully transparent resources", () => {
  const result = evaluate([
    resource("static", "static_image", { status: "fullyTransparent" }),
    resource("mask", "mask_or_matte", { status: "fullyTransparent" }),
    resource("unknown", "unknown", { status: "fullyTransparent" })
  ]);

  assert.deepEqual(
    result.diagnostics.map(({ role, severity, paddingRatio }) => ({
      role,
      severity,
      paddingRatio
    })),
    [
      { role: "static_image", severity: "error", paddingRatio: 1 },
      { role: "mask_or_matte", severity: "warning", paddingRatio: 1 },
      { role: "unknown", severity: "unknown", paddingRatio: 1 }
    ]
  );
});

test("marks missing alpha evidence unknown and ignores compliant padding", () => {
  const result = evaluate([
    resource("missing", "static_image"),
    resource("compliant", "static_image", known(0.5))
  ]);

  assert.equal(result.evaluatedResourceCount, 2);
  assert.deepEqual(result.diagnostics.map(({ resourceKey, severity, policyCode }) => ({
    resourceKey,
    severity,
    policyCode
  })), [{
    resourceKey: "missing",
    severity: "unknown",
    policyCode: "transparent_padding_unavailable"
  }]);
});

test("keeps the policy host-neutral and metadata-only", async () => {
  const source = await readFile(
    new URL("../../src/workbench/role-aware-transparent-padding.ts", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(
    source,
    /from\s+["']node:|document\.|window\.|HTMLCanvasElement|CanvasRenderingContext|filesystem|browser API/
  );
});

function evaluate(resources: readonly MotionResourceInfo[]) {
  const memory = estimateDecodedMemory(resources);
  return evaluateRoleAwareTransparentPadding({
    resources,
    sequenceResidencyDiagnostics: diagnoseSequenceResidency(resources, memory),
    maximumTransparentPaddingRatio: 0.5
  });
}

function resource(
  id: string,
  role: MotionResourceRole,
  alphaBounds?: ImageAlphaBounds
): MotionResourceInfo {
  return {
    id,
    name: id,
    kind: "image",
    role,
    dimensions: { width: 100, height: 100 },
    alphaBounds
  };
}

function known(transparentPaddingRatio: number): ImageAlphaBounds {
  return {
    status: "known",
    x: 10,
    y: 10,
    width: 80,
    height: 80,
    transparentPaddingRatio
  };
}
