import assert from "node:assert/strict";
import test from "node:test";

import { createShortTermLaunchAppState } from "../workbench/short-term-app-state.js";
import {
  createShortTermCommandMenuModel,
  flattenShortTermCommandMenuItems
} from "../workbench/short-term-command-menu.js";
import { classifyShortTermHostMenuCommand } from "../workbench/short-term-host-menu-routing.js";
import {
  SHORT_TERM_COMMAND_MENU_PRD_IDS,
  shortTermPrdIdsForCommandMenuItem,
  shortTermPrdIdsForHostAction,
  shortTermPrdIdsForMenuDispatch
} from "../workbench/short-term-prd-trace.js";

test("short-term PRD trace centralizes command menu and host dispatch mappings", () => {
  assert.deepEqual(SHORT_TERM_COMMAND_MENU_PRD_IDS, ["S1", "S2", "S8", "S9", "S10", "S11", "S12", "S13", "S14", "S16"]);
  assert.deepEqual(shortTermPrdIdsForCommandMenuItem("openSvga"), ["S1", "S2"]);
  assert.deepEqual(shortTermPrdIdsForCommandMenuItem("openRecent:recent-a"), ["S1", "S2", "S16"]);
  assert.deepEqual(shortTermPrdIdsForCommandMenuItem("clearRecent"), ["S16"]);
  assert.deepEqual(shortTermPrdIdsForCommandMenuItem("cancelTransientWorkflow"), ["S10", "S11", "S14"]);
  assert.deepEqual(shortTermPrdIdsForCommandMenuItem("renameImageKey"), ["S11", "S14"]);
  assert.deepEqual(shortTermPrdIdsForCommandMenuItem("resetImageReplacement"), ["S12", "S14"]);
  assert.deepEqual(shortTermPrdIdsForCommandMenuItem("editTextPreview"), ["S13"]);
  assert.deepEqual(shortTermPrdIdsForCommandMenuItem("resetTextPreview"), ["S13"]);
  assert.deepEqual(shortTermPrdIdsForCommandMenuItem("showLogs"), []);

  assert.deepEqual(shortTermPrdIdsForMenuDispatch("openRecent:recent-a"), ["S1", "S2", "S16"]);
  assert.deepEqual(shortTermPrdIdsForMenuDispatch("clearRecent"), ["S1", "S2", "S16"]);
  assert.deepEqual(shortTermPrdIdsForMenuDispatch("quit"), ["S1", "S14"]);
  assert.deepEqual(shortTermPrdIdsForMenuDispatch("cancelTransientWorkflow"), ["S10", "S11", "S14"]);
  assert.deepEqual(shortTermPrdIdsForMenuDispatch("resetImageReplacement"), ["S12", "S14"]);
  assert.deepEqual(shortTermPrdIdsForMenuDispatch("editTextPreview"), ["S13"]);
  assert.deepEqual(shortTermPrdIdsForMenuDispatch("resetTextPreview"), ["S13"]);
  assert.deepEqual(shortTermPrdIdsForMenuDispatch("playPause"), ["S2"]);
  assert.deepEqual(shortTermPrdIdsForMenuDispatch("copy"), []);
  assert.deepEqual(shortTermPrdIdsForMenuDispatch("showLogs"), []);
});

test("short-term PRD trace covers host action result mappings", () => {
  assert.deepEqual(shortTermPrdIdsForHostAction("openLocalFile"), ["S1", "S2"]);
  assert.deepEqual(shortTermPrdIdsForHostAction("clearRecentFiles"), ["S1", "S2", "S16"]);
  assert.deepEqual(shortTermPrdIdsForHostAction("runOptimization"), ["S8", "S9", "S10", "S14"]);
  assert.deepEqual(shortTermPrdIdsForHostAction("renameImageKey"), ["S11", "S14"]);
  assert.deepEqual(shortTermPrdIdsForHostAction("replaceImage"), ["S12", "S14"]);
  assert.deepEqual(shortTermPrdIdsForHostAction("applyTextPreview"), ["S13"]);
  assert.deepEqual(shortTermPrdIdsForHostAction("cancelTransientWorkflow"), ["S10", "S11", "S14"]);
  assert.deepEqual(shortTermPrdIdsForHostAction("save"), ["S14"]);
  assert.deepEqual(shortTermPrdIdsForHostAction("unknownAction"), []);
});

test("short-term PRD trace covers every product-routed menu item", () => {
  const menu = createShortTermCommandMenuModel(createShortTermLaunchAppState({
    recentFiles: [{
      id: "recent-a",
      displayName: "recent.svga",
      lastOpenedAt: "2026-07-02T00:00:00.000Z"
    }]
  }));
  const allowedUntraced = new Set(["help", "showLogs"]);
  const missingTrace = flattenShortTermCommandMenuItems(menu)
    .filter((item) => item.kind === "command")
    .filter((item) => {
      if (allowedUntraced.has(item.id)) return false;
      const route = classifyShortTermHostMenuCommand(item.id);
      if (route === "native") return false;
      return (item.prdIds?.length ?? 0) === 0 || shortTermPrdIdsForMenuDispatch(item.id).length === 0;
    })
    .map((item) => item.id);

  assert.deepEqual(missingTrace, []);
});
