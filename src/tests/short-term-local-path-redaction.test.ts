import assert from "node:assert/strict";
import test from "node:test";
import {
  redactShortTermLocalPaths,
  redactShortTermLocalPathsFromError
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
