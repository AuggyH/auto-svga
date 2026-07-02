import assert from "node:assert/strict";
import test from "node:test";
import {
  completeShortTermSaveExecution,
  createShortTermSaveExecutionPlan,
  failShortTermSaveExecution,
  shortTermSaveExecutionHash
} from "../workbench/short-term-save-execution.js";
import { createShortTermPersistedOutputRecord } from "../workbench/short-term-save-state.js";

test("short-term save execution creates a redacted ready-to-write save-as plan", () => {
  const outputBytes = new Uint8Array([1, 2, 3, 4]);
  const record = outputRecord(outputBytes);
  const plan = createShortTermSaveExecutionPlan(record, "saveAs", {
    targetPath: "/Users/designer/private/output.svga"
  });

  assert.equal(plan.schemaVersion, 1);
  assert.deepEqual(plan.prdIds, ["S14"]);
  assert.equal(plan.status, "readyToWrite");
  assert.equal(plan.command, "saveAs");
  assert.equal(plan.outputId, record.outputId);
  assert.equal(plan.expectedOutputSha256, shortTermSaveExecutionHash(outputBytes));
  assert.equal(plan.expectedOutputSizeBytes, outputBytes.byteLength);
  assert.equal(plan.targetDisplayName, "output.svga");
  assert.equal(plan.targetPathRedacted, true);
  assert.equal(JSON.stringify(plan).includes("/Users/designer"), false);
  assert.equal(plan.autoWritePerformed, false);
  assert.equal(plan.dirty, true);
});

test("short-term save execution clears dirty after read-back bytes match", () => {
  const outputBytes = new Uint8Array([9, 8, 7]);
  const record = outputRecord(outputBytes, "renamed_svga");
  const plan = createShortTermSaveExecutionPlan(record, "overwrite");
  const result = completeShortTermSaveExecution(plan, record, outputBytes);

  assert.equal(result.status, "saveComplete");
  assert.equal(result.command, "overwrite");
  assert.equal(result.savedSha256, record.outputSha256);
  assert.equal(result.dirty, false);
  assert.equal(result.validation?.status, "saveComplete");
  assert.equal(result.diagnostic, undefined);
});

test("short-term save execution keeps dirty when read-back bytes do not match", () => {
  const record = outputRecord(new Uint8Array([9, 8, 7]), "image_replacement_svga");
  const plan = createShortTermSaveExecutionPlan(record, "saveAs");
  const result = completeShortTermSaveExecution(plan, record, new Uint8Array([1, 1, 1]));

  assert.equal(result.status, "saveFailed");
  assert.equal(result.dirty, true);
  assert.equal(result.validation?.status, "saveFailed");
  assert.equal(result.diagnostic?.code, "saved_bytes_mismatch");
});

test("short-term save execution blocks unavailable outputs", () => {
  const record = createShortTermPersistedOutputRecord({
    outputKind: "optimized_svga",
    operationId: "test-operation",
    sourceName: "source.svga",
    sourceSha256: "source-hash",
    outputBytes: new Uint8Array([1, 2, 3]),
    sourceUnchanged: true,
    validationPassed: false
  });
  const plan = createShortTermSaveExecutionPlan(record, "saveAs");
  const result = completeShortTermSaveExecution(plan, record, new Uint8Array([1, 2, 3]));

  assert.equal(plan.status, "blocked");
  assert.equal(plan.diagnostic?.code, "save_output_not_available");
  assert.equal(result.status, "saveFailed");
  assert.equal(result.diagnostic?.code, "save_plan_not_ready");
  assert.equal(result.dirty, true);
});

test("short-term save execution records host write failures without clearing dirty", () => {
  const record = outputRecord(new Uint8Array([4, 5, 6]));
  const plan = createShortTermSaveExecutionPlan(record, "overwrite", {
    targetDisplayName: "manual-output.svga"
  });
  const result = failShortTermSaveExecution(plan, new Error("permission denied"));

  assert.equal(result.status, "saveFailed");
  assert.equal(result.targetDisplayName, "manual-output.svga");
  assert.equal(result.dirty, true);
  assert.equal(result.diagnostic?.code, "save_write_failed");
  assert.match(result.diagnostic?.message ?? "", /permission denied/);
});

test("short-term save execution redacts local paths from direct write failures", () => {
  const record = outputRecord(new Uint8Array([4, 5, 6]));
  const plan = createShortTermSaveExecutionPlan(record, "saveAs", {
    targetPath: "/Users/designer/My Documents/private/manual-output.svga"
  });
  const result = failShortTermSaveExecution(
    plan,
    new Error("Cannot write /Users/designer/My Documents/private/manual-output.svga")
  );

  assert.equal(result.status, "saveFailed");
  assert.equal(result.diagnostic?.code, "save_write_failed");
  assert.equal(result.diagnostic?.message.includes("/Users/designer"), false);
  assert.equal(result.diagnostic?.message.includes("My Documents/private"), false);
  assert.equal(JSON.stringify(result).includes("/Users/designer"), false);
  assert.equal(result.dirty, true);
});

function outputRecord(
  outputBytes: Uint8Array,
  outputKind: "optimized_svga" | "renamed_svga" | "image_replacement_svga" = "optimized_svga"
) {
  return createShortTermPersistedOutputRecord({
    outputKind,
    operationId: "test-operation",
    sourceName: "source.svga",
    sourceSha256: "source-hash",
    outputBytes,
    sourceUnchanged: true,
    validationPassed: true,
    validationRefs: ["validation:reopenPassed"]
  });
}
