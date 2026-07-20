import assert from "node:assert/strict";
import test from "node:test";
import { createShortTermLaunchAppState } from "../workbench/short-term-app-state.js";
import {
  createShortTermCommandMenuModel,
  flattenShortTermCommandMenuItems
} from "../workbench/short-term-command-menu.js";
import {
  canonicalShortTermHostMenuCommandId,
  classifyShortTermHostMenuCommand,
  isShortTermNativeDelegatedMenuCommand,
  shortTermRecentFileIdFromMenuCommandId
} from "../workbench/short-term-host-menu-routing.js";

test("short-term host menu routing classifies host, native, renderer, and unsupported commands", () => {
  assert.equal(classifyShortTermHostMenuCommand("openSvga"), "host");
  assert.equal(classifyShortTermHostMenuCommand("openRecent:recent-a"), "host");
  assert.equal(classifyShortTermHostMenuCommand("openRecent:empty"), "host");
  assert.equal(classifyShortTermHostMenuCommand("cancelTransientWorkflow"), "host");
  assert.equal(classifyShortTermHostMenuCommand("resetImageReplacement"), "host");
  assert.equal(classifyShortTermHostMenuCommand("resetTextPreview"), "host");
  assert.equal(classifyShortTermHostMenuCommand("copy"), "native");
  assert.equal(classifyShortTermHostMenuCommand("minimize"), "native");
  assert.equal(classifyShortTermHostMenuCommand("playPause"), "renderer");
  assert.equal(classifyShortTermHostMenuCommand("toggleCompare"), "renderer");
  assert.equal(classifyShortTermHostMenuCommand("showLogs"), "renderer");
  assert.equal(classifyShortTermHostMenuCommand("unsupportedCommand"), "unsupported");
});

test("short-term host menu routing recognizes every command-menu item", () => {
  const menu = createShortTermCommandMenuModel(createShortTermLaunchAppState({
    recentFiles: [{
      id: "recent-a",
      displayName: "recent.svga",
      lastOpenedAt: "2026-07-02T00:00:00.000Z"
    }]
  }));
  const commands = flattenShortTermCommandMenuItems(menu).filter((item) => item.kind === "command");

  assert.deepEqual(
    commands.filter((item) => classifyShortTermHostMenuCommand(item.id) === "unsupported").map((item) => item.id),
    []
  );
  for (const item of commands) {
    if (!item.role) continue;
    assert.equal(classifyShortTermHostMenuCommand(item.id), "native", `${item.id} should stay native delegated`);
  }
});

test("short-term host menu routing recognizes empty recent placeholders as disabled recent commands", () => {
  const menu = createShortTermCommandMenuModel(createShortTermLaunchAppState());
  const commands = flattenShortTermCommandMenuItems(menu).filter((item) => item.kind === "command");

  assert.equal(commands.some((item) => item.id === "openRecent:empty"), true);
  assert.deepEqual(
    commands.filter((item) => classifyShortTermHostMenuCommand(item.id) === "unsupported").map((item) => item.id),
    []
  );
});

test("short-term host menu routing parses recent submenu ids without treating empty rows as openable", () => {
  assert.equal(shortTermRecentFileIdFromMenuCommandId("openRecent:recent-a"), "recent-a");
  assert.equal(shortTermRecentFileIdFromMenuCommandId("openRecent: empty-id "), "empty-id");
  assert.equal(shortTermRecentFileIdFromMenuCommandId("openRecent:empty"), undefined);
  assert.equal(shortTermRecentFileIdFromMenuCommandId("openRecent:"), undefined);
  assert.equal(canonicalShortTermHostMenuCommandId("openRecent:recent-a"), "openRecent");
  assert.equal(canonicalShortTermHostMenuCommandId("openRecent:empty"), "openRecent");
});

test("short-term host menu routing keeps native delegation explicit", () => {
  assert.equal(isShortTermNativeDelegatedMenuCommand("copy"), true);
  assert.equal(isShortTermNativeDelegatedMenuCommand("selectAll"), true);
  assert.equal(isShortTermNativeDelegatedMenuCommand("playPause"), false);
  assert.equal(isShortTermNativeDelegatedMenuCommand("openSvga"), false);
});
