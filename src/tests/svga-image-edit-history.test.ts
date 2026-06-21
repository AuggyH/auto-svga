import assert from "node:assert/strict";
import test from "node:test";
import {
  applySvgaImageEditTransaction,
  createSvgaImageEditHistory,
  markSvgaImageEditSaved,
  redoSvgaImageEditHistory,
  undoSvgaImageEditHistory
} from "../workbench/svga/index.js";

const resources = [
  { resourceKey: "img_frame_left", originalSha256: "left-original" },
  { resourceKey: "img_frame_right", originalSha256: "right-original" },
  { resourceKey: "img_unused_marker", originalSha256: "unused-original" }
];

test("SVGA image edit history tracks multi-resource replace, undo, redo, and dirty state", () => {
  let state = createSvgaImageEditHistory({
    sourceIdentity: "fixture-source",
    originalResources: resources,
    selectedResourceKey: "img_frame_left"
  });

  assert.equal(state.dirty, false);
  assert.equal(state.currentRevision, 0);
  assert.equal(state.savedRevision, 0);

  state = applySvgaImageEditTransaction(state, {
    transactionId: "tx-1",
    type: "replace_resource",
    resourceKey: "img_frame_left",
    replacement: replacement("img_frame_left", "replacement-a"),
    source: "test"
  });
  assert.equal(state.currentRevision, 1);
  assert.equal(state.dirty, true);
  assert.deepEqual(Object.keys(state.currentReplacements), ["img_frame_left"]);

  state = applySvgaImageEditTransaction(state, {
    transactionId: "tx-2",
    type: "replace_resource",
    resourceKey: "img_frame_right",
    replacement: replacement("img_frame_right", "replacement-b"),
    source: "test"
  });
  assert.equal(state.currentRevision, 2);
  assert.deepEqual(Object.keys(state.currentReplacements).sort(), ["img_frame_left", "img_frame_right"]);

  state = undoSvgaImageEditHistory(state);
  assert.equal(state.currentRevision, 1);
  assert.deepEqual(Object.keys(state.currentReplacements), ["img_frame_left"]);
  assert.equal(state.dirty, true);

  state = undoSvgaImageEditHistory(state);
  assert.equal(state.currentRevision, 0);
  assert.deepEqual(Object.keys(state.currentReplacements), []);
  assert.equal(state.dirty, false);

  state = redoSvgaImageEditHistory(state);
  assert.equal(state.currentRevision, 1);
  assert.deepEqual(Object.keys(state.currentReplacements), ["img_frame_left"]);
  assert.equal(state.dirty, true);
});

test("SVGA image edit history applies a P5 batch replacement as one atomic transaction", () => {
  let state = createSvgaImageEditHistory({
    sourceIdentity: "fixture-source",
    originalResources: resources
  });

  state = applySvgaImageEditTransaction(state, {
    transactionId: "batch-1",
    type: "batch_replace_resources",
    replacements: [
      replacement("img_frame_left", "replacement-a"),
      replacement("img_frame_right", "replacement-b")
    ],
    replacementSetDigest: "batch-digest",
    sourceFileIdentities: [
      { fileLabel: "left.png", sha256: "replacement-a", sizeBytes: 12, width: 6, height: 2 },
      { fileLabel: "right.png", sha256: "replacement-b", sizeBytes: 12, width: 6, height: 2 }
    ],
    mappings: [
      { fileLabel: "left.png", resourceKey: "img_frame_left", ruleId: "resource_key_exact", status: "exact_match", sha256: "replacement-a" },
      { fileLabel: "right.png", resourceKey: "img_frame_right", ruleId: "resource_key_exact", status: "exact_match", sha256: "replacement-b" }
    ],
    source: "p5-batch"
  });

  assert.equal(state.currentRevision, 1);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.transactions[0].type, "batch_replace_resources");
  assert.equal(state.transactions[0].replacementSetDigest, "batch-digest");
  assert.deepEqual(state.transactions[0].affectedResourceKeys, ["img_frame_left", "img_frame_right"]);
  assert.deepEqual(Object.keys(state.currentReplacements).sort(), ["img_frame_left", "img_frame_right"]);

  state = undoSvgaImageEditHistory(state);
  assert.equal(state.currentRevision, 0);
  assert.deepEqual(Object.keys(state.currentReplacements), []);

  state = redoSvgaImageEditHistory(state);
  assert.equal(state.currentRevision, 1);
  assert.deepEqual(Object.keys(state.currentReplacements).sort(), ["img_frame_left", "img_frame_right"]);
});

test("SVGA image edit history rejects duplicate resources inside a P5 batch transaction", () => {
  let state = createSvgaImageEditHistory({
    sourceIdentity: "fixture-source",
    originalResources: resources
  });

  state = applySvgaImageEditTransaction(state, {
    transactionId: "batch-invalid",
    type: "batch_replace_resources",
    replacements: [
      replacement("img_frame_left", "replacement-a"),
      replacement("img_frame_left", "replacement-b")
    ]
  });

  assert.equal(state.currentRevision, 0);
  assert.deepEqual(state.currentReplacements, {});
  assert.deepEqual(state.validationErrors, ["duplicate_resource_replacement"]);
});

test("SVGA image edit history truncates redo branch after a new edit", () => {
  let state = createSvgaImageEditHistory({
    sourceIdentity: "fixture-source",
    originalResources: resources
  });

  state = applySvgaImageEditTransaction(state, {
    transactionId: "tx-1",
    type: "replace_resource",
    resourceKey: "img_frame_left",
    replacement: replacement("img_frame_left", "replacement-a")
  });
  state = applySvgaImageEditTransaction(state, {
    transactionId: "tx-2",
    type: "replace_resource",
    resourceKey: "img_frame_right",
    replacement: replacement("img_frame_right", "replacement-b")
  });
  state = undoSvgaImageEditHistory(state);
  state = applySvgaImageEditTransaction(state, {
    transactionId: "tx-3",
    type: "replace_resource",
    resourceKey: "img_unused_marker",
    replacement: replacement("img_unused_marker", "replacement-c")
  });

  assert.equal(state.historyCursor, state.history.length - 1);
  assert.equal(redoSvgaImageEditHistory(state), state);
  assert.equal(state.transactions.at(-1)?.discardedRedoBranch, true);
  assert.deepEqual(Object.keys(state.currentReplacements).sort(), ["img_frame_left", "img_unused_marker"]);
});

test("SVGA image edit history supports reset selected, reset all, and undo", () => {
  let state = createSvgaImageEditHistory({
    sourceIdentity: "fixture-source",
    originalResources: resources
  });

  state = applySvgaImageEditTransaction(state, {
    transactionId: "tx-1",
    type: "replace_resource",
    resourceKey: "img_frame_left",
    replacement: replacement("img_frame_left", "replacement-a")
  });
  state = applySvgaImageEditTransaction(state, {
    transactionId: "tx-2",
    type: "replace_resource",
    resourceKey: "img_frame_right",
    replacement: replacement("img_frame_right", "replacement-b")
  });
  state = applySvgaImageEditTransaction(state, {
    transactionId: "tx-3",
    type: "reset_resource",
    resourceKey: "img_frame_right"
  });
  assert.deepEqual(Object.keys(state.currentReplacements), ["img_frame_left"]);

  state = undoSvgaImageEditHistory(state);
  assert.deepEqual(Object.keys(state.currentReplacements).sort(), ["img_frame_left", "img_frame_right"]);

  state = applySvgaImageEditTransaction(state, {
    transactionId: "tx-4",
    type: "reset_all"
  });
  assert.deepEqual(Object.keys(state.currentReplacements), []);

  state = undoSvgaImageEditHistory(state);
  assert.deepEqual(Object.keys(state.currentReplacements).sort(), ["img_frame_left", "img_frame_right"]);
});

test("SVGA image edit history save point is independent from original source", () => {
  let state = createSvgaImageEditHistory({
    sourceIdentity: "fixture-source",
    originalResources: resources
  });

  state = applySvgaImageEditTransaction(state, {
    transactionId: "tx-1",
    type: "replace_resource",
    resourceKey: "img_frame_left",
    replacement: replacement("img_frame_left", "replacement-a")
  });
  state = markSvgaImageEditSaved(state);
  assert.equal(state.dirty, false);
  assert.equal(state.savedRevision, 1);

  state = applySvgaImageEditTransaction(state, {
    transactionId: "tx-2",
    type: "reset_all"
  });
  assert.equal(state.dirty, true);

  state = undoSvgaImageEditHistory(state);
  assert.equal(state.currentRevision, 1);
  assert.equal(state.dirty, false);
});

test("SVGA image edit history rejects invalid resources without advancing history", () => {
  let state = createSvgaImageEditHistory({
    sourceIdentity: "fixture-source",
    originalResources: resources
  });

  state = applySvgaImageEditTransaction(state, {
    transactionId: "tx-invalid",
    type: "replace_resource",
    resourceKey: "missing",
    replacement: replacement("missing", "replacement-x")
  });

  assert.equal(state.currentRevision, 0);
  assert.equal(state.history.length, 1);
  assert.equal(state.dirty, false);
  assert.deepEqual(state.validationErrors, ["resource_not_found"]);
});

test("SVGA image edit history cap removes oldest entries deterministically", () => {
  let state = createSvgaImageEditHistory({
    sourceIdentity: "fixture-source",
    originalResources: resources,
    maxHistoryLength: 3
  });

  for (let index = 1; index <= 5; index += 1) {
    state = applySvgaImageEditTransaction(state, {
      transactionId: `tx-${index}`,
      type: "replace_resource",
      resourceKey: "img_frame_left",
      replacement: replacement("img_frame_left", `replacement-${index}`)
    });
  }

  assert.equal(state.history.length, 3);
  assert.deepEqual(state.history.map(({ revision }) => revision), [3, 4, 5]);
  assert.equal(state.historyCursor, 2);
  assert.equal(state.currentRevision, 5);
});

function replacement(resourceKey: string, replacementSha256: string) {
  return {
    resourceKey,
    replacementSha256,
    sizeBytes: 12,
    width: 6,
    height: 2
  };
}
