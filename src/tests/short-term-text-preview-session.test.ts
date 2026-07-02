import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  applyShortTermTextPreview,
  createShortTermTextPreviewSession,
  resetShortTermTextPreview
} from "../workbench/short-term-text-preview-session.js";

test("short-term text preview session fails closed when parser exposes no text elements", () => {
  const sourceBytes = new Uint8Array([1, 2, 3]);
  const session = createShortTermTextPreviewSession(sourceBytes, { sourceName: "no-text.svga" });
  const applied = applyShortTermTextPreview(session, {
    textKey: "nickname",
    fields: { text: "Alice" }
  });

  assert.equal(session.model.schemaVersion, 1);
  assert.deepEqual(session.model.prdIds, ["S13"]);
  assert.equal(session.model.status, "noTextElements");
  assert.equal(session.model.bytePersistenceSupported, false);
  assert.equal(session.model.sourceBytesUnchanged, true);
  assert.equal(session.model.sourceSha256, sha256(sourceBytes));
  assert.equal(applied.model.status, "failed");
  assert.equal(applied.model.diagnostic?.code, "text_key_not_found");
  assert.equal(sha256(applied.sourceBytes), sha256(sourceBytes));
});

test("short-term text preview session applies only supported runtime fields", () => {
  const sourceBytes = new Uint8Array([4, 5, 6]);
  const session = createShortTermTextPreviewSession(sourceBytes, {
    sourceName: "text.svga",
    textElements: [
      {
        textKey: "nickname",
        displayName: "昵称",
        initialText: "Guest",
        supportedFields: ["text", "color", "offset"]
      }
    ]
  });
  const applied = applyShortTermTextPreview(session, {
    textKey: "nickname",
    fields: {
      text: "Alice",
      family: "Ignored",
      size: 18,
      color: "#ffffff",
      offset: { x: 2, y: -1 }
    }
  });

  assert.equal(session.model.status, "ready");
  assert.equal(applied.model.status, "applied");
  assert.equal(applied.model.playerAction, "applyRuntimeText");
  assert.equal(applied.model.bytePersistenceSupported, false);
  assert.deepEqual(applied.model.activeReplacement, {
    textKey: "nickname",
    fields: {
      text: "Alice",
      color: "#ffffff",
      offset: { x: 2, y: -1 }
    }
  });
  assert.equal(sha256(applied.sourceBytes), sha256(sourceBytes));
});

test("short-term text preview session rejects empty supported field updates", () => {
  const sourceBytes = new Uint8Array([7, 8, 9]);
  const session = createShortTermTextPreviewSession(sourceBytes, {
    textElements: [
      {
        textKey: "nickname",
        displayName: "昵称",
        supportedFields: ["text"]
      }
    ]
  });
  const applied = applyShortTermTextPreview(session, {
    textKey: "nickname",
    fields: {
      family: "Unsupported"
    }
  });

  assert.equal(applied.model.status, "failed");
  assert.equal(applied.model.playerAction, "keepPreview");
  assert.equal(applied.model.diagnostic?.code, "text_replacement_fields_empty");
});

test("short-term text preview session reset clears runtime replacement without changing bytes", () => {
  const sourceBytes = new Uint8Array([10, 11, 12]);
  const session = createShortTermTextPreviewSession(sourceBytes, {
    textElements: [
      {
        textKey: "nickname",
        displayName: "昵称",
        supportedFields: ["text"]
      }
    ]
  });
  const applied = applyShortTermTextPreview(session, {
    textKey: "nickname",
    fields: { text: "Alice" }
  });
  const reset = resetShortTermTextPreview(applied);

  assert.equal(reset.model.status, "reset");
  assert.equal(reset.model.playerAction, "clearRuntimeText");
  assert.equal(reset.model.activeReplacement, undefined);
  assert.equal(reset.model.diagnostic, undefined);
  assert.equal(reset.model.bytePersistenceSupported, false);
  assert.equal(sha256(reset.sourceBytes), sha256(sourceBytes));
});

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
