import assert from "node:assert/strict";
import test from "node:test";
import {
  sanitizeShortTermDisplayPart,
  shortTermDisplayNameFromPathLike,
  shortTermParentDisplayNameFromPathLike
} from "../workbench/short-term-path-display.js";

test("short-term path display extracts only safe basename text", () => {
  assert.equal(
    shortTermDisplayNameFromPathLike("/Users/designer/Secret Project/profile frame.svga"),
    "profile frame.svga"
  );
  assert.equal(
    shortTermDisplayNameFromPathLike("C:\\Users\\designer\\Secret Project\\profile frame.svga"),
    "profile frame.svga"
  );
  assert.equal(shortTermDisplayNameFromPathLike(" profile frame.svga "), "profile frame.svga");
});

test("short-term path display extracts a safe parent label", () => {
  assert.equal(
    shortTermParentDisplayNameFromPathLike("/Users/designer/Secret Project/profile frame.svga"),
    "Secret Project"
  );
  assert.equal(
    shortTermParentDisplayNameFromPathLike("C:\\Users\\designer\\Secret Project\\profile frame.svga"),
    "Secret Project"
  );
});

test("short-term display part sanitizes separators and control characters", () => {
  assert.equal(sanitizeShortTermDisplayPart(" bad/name\\with\u0000control "), "bad name with control");
});
