import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  createShortTermPersistedOutputRecord,
  validateShortTermSavedBytes
} from "../workbench/short-term-save-state.js";

test("short-term save state enables save only for validated persisted output", () => {
  const outputBytes = new Uint8Array([1, 2, 3, 4]);
  const record = createShortTermPersistedOutputRecord({
    outputKind: "optimized_svga",
    operationId: "svga-safe-image-optimizer-v1",
    sourceName: "/Users/designer/private/source.svga",
    sourceSha256: "source-hash",
    outputBytes,
    sourceUnchanged: true,
    validationPassed: true,
    validationRefs: ["validation:reopenPassed"]
  });

  assert.equal(record.schemaVersion, 1);
  assert.deepEqual(record.prdIds, ["S14"]);
  assert.equal(record.outputKind, "optimized_svga");
  assert.equal(record.sourceName, "source.svga");
  assert.equal(JSON.stringify(record).includes("/Users/designer"), false);
  assert.equal(record.outputSha256, sha256(outputBytes));
  assert.equal(record.dirty, true);
  assert.equal(record.saveState.outputAvailable, true);
  assert.equal(record.saveState.overwriteSaveEnabled, true);
  assert.equal(record.saveState.saveAsEnabled, true);
  assert.equal(record.saveState.autoWritePerformed, false);
});

test("short-term save validation clears dirty only when saved bytes match output", () => {
  const outputBytes = new Uint8Array([9, 8, 7]);
  const record = createShortTermPersistedOutputRecord({
    outputKind: "renamed_svga",
    operationId: "svga-image-key-rename-v1",
    sourceName: "source.svga",
    sourceSha256: "source-hash",
    outputBytes,
    sourceUnchanged: true,
    validationPassed: true
  });

  const saved = validateShortTermSavedBytes(record, outputBytes, "saveAs");
  assert.equal(saved.status, "saveComplete");
  assert.equal(saved.command, "saveAs");
  assert.equal(saved.dirty, false);

  const mismatched = validateShortTermSavedBytes(record, new Uint8Array([1, 1, 1]), "overwrite");
  assert.equal(mismatched.status, "saveFailed");
  assert.equal(mismatched.command, "overwrite");
  assert.equal(mismatched.dirty, true);
});

test("short-term save state blocks unvalidated outputs", () => {
  const record = createShortTermPersistedOutputRecord({
    outputKind: "image_replacement_svga",
    operationId: "svga-image-replacement-v1",
    sourceName: "source.svga",
    sourceSha256: "source-hash",
    outputBytes: new Uint8Array([1]),
    sourceUnchanged: true,
    validationPassed: false
  });

  assert.equal(record.validationPassed, false);
  assert.equal(record.dirty, false);
  assert.equal(record.saveState.outputAvailable, false);
  assert.equal(record.saveState.overwriteSaveEnabled, false);
  assert.equal(record.saveState.saveAsEnabled, false);
});

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
