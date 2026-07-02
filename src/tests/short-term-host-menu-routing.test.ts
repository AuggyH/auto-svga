import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalShortTermHostMenuCommandId,
  classifyShortTermHostMenuCommand,
  isShortTermNativeDelegatedMenuCommand,
  shortTermRecentFileIdFromMenuCommandId
} from "../workbench/short-term-host-menu-routing.js";

test("short-term host menu routing classifies host, native, renderer, and unsupported commands", () => {
  assert.equal(classifyShortTermHostMenuCommand("openSvga"), "host");
  assert.equal(classifyShortTermHostMenuCommand("openRecent:recent-a"), "host");
  assert.equal(classifyShortTermHostMenuCommand("copy"), "native");
  assert.equal(classifyShortTermHostMenuCommand("minimize"), "native");
  assert.equal(classifyShortTermHostMenuCommand("playPause"), "renderer");
  assert.equal(classifyShortTermHostMenuCommand("toggleCompare"), "renderer");
  assert.equal(classifyShortTermHostMenuCommand("showLogs"), "unsupported");
});

test("short-term host menu routing parses recent submenu ids without treating empty rows as openable", () => {
  assert.equal(shortTermRecentFileIdFromMenuCommandId("openRecent:recent-a"), "recent-a");
  assert.equal(shortTermRecentFileIdFromMenuCommandId("openRecent: empty-id "), "empty-id");
  assert.equal(shortTermRecentFileIdFromMenuCommandId("openRecent:empty"), undefined);
  assert.equal(shortTermRecentFileIdFromMenuCommandId("openRecent:"), undefined);
  assert.equal(canonicalShortTermHostMenuCommandId("openRecent:recent-a"), "openRecent");
  assert.equal(canonicalShortTermHostMenuCommandId("openRecent:empty"), "openRecent:empty");
});

test("short-term host menu routing keeps native delegation explicit", () => {
  assert.equal(isShortTermNativeDelegatedMenuCommand("copy"), true);
  assert.equal(isShortTermNativeDelegatedMenuCommand("selectAll"), true);
  assert.equal(isShortTermNativeDelegatedMenuCommand("playPause"), false);
  assert.equal(isShortTermNativeDelegatedMenuCommand("openSvga"), false);
});
