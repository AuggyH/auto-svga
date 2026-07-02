import assert from "node:assert/strict";
import test from "node:test";
import {
  redactShortTermLocalPaths,
  redactShortTermLocalPathsFromError,
  redactShortTermLocalPathsInValue
} from "../workbench/short-term-local-path-redaction.js";

test("short-term local path redaction handles known paths with spaces exactly", () => {
  const path = "/Users/designer/My Documents/private/source file.svga";
  const redacted = redactShortTermLocalPaths(`Cannot read ${path}; retry later.`, [path]);

  assert.equal(redacted, "Cannot read [local path]; retry later.");
  assert.equal(redacted.includes("/Users/designer"), false);
  assert.equal(redacted.includes("My Documents/private"), false);
});

test("short-term local path redaction handles generic macOS and Windows paths", () => {
  const redacted = redactShortTermLocalPaths(
    "Cannot write /Volumes/Design Drive/private/out.svga; fallback C:\\Users\\designer\\Desktop\\out.svga."
  );

  assert.equal(redacted.includes("/Volumes/Design Drive"), false);
  assert.equal(redacted.includes("C:\\Users"), false);
  assert.match(redacted, /\[local path\]/u);
});

test("short-term local path redaction handles Error and string inputs", () => {
  assert.equal(
    redactShortTermLocalPathsFromError(
      new Error("Cannot inspect /Users/designer/private/broken.svga"),
      "fallback"
    ).includes("/Users/designer"),
    false
  );
  assert.equal(
    redactShortTermLocalPathsFromError(
      "Cannot persist /tmp/auto-svga/private/recent.json",
      "fallback"
    ).includes("/tmp/auto-svga"),
    false
  );
  assert.equal(redactShortTermLocalPathsFromError(undefined, "fallback"), "fallback");
});

test("short-term local path redaction clones nested renderer values", () => {
  const path = "/Users/designer/private/source.svga";
  const source = {
    label: `Loaded from ${path}`,
    nested: [{ message: "See C:\\Users\\designer\\Desktop\\source.svga" }],
    bytes: new Uint8Array([1, 2, 3])
  };

  const redacted = redactShortTermLocalPathsInValue(source, [path]);

  assert.equal(redacted.label, "Loaded from [local path]");
  assert.equal(redacted.nested[0].message.includes("C:\\Users"), false);
  assert.deepEqual([...redacted.bytes], [1, 2, 3]);
  redacted.nested[0].message = "mutated";
  redacted.bytes[0] = 9;
  assert.notEqual(source.nested[0].message, "mutated");
  assert.equal(source.bytes[0], 1);
});
