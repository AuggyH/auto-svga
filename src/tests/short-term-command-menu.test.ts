import assert from "node:assert/strict";
import test from "node:test";

import {
  attachShortTermPersistedOutput,
  clearShortTermPersistedOutput,
  completeShortTermLocalOpen,
  createShortTermLaunchAppState,
  startShortTermLocalOpen,
  type ShortTermAppStateModel
} from "../workbench/short-term-app-state.js";
import {
  createShortTermCommandMenuModel,
  flattenShortTermCommandMenuItems
} from "../workbench/short-term-command-menu.js";
import type { ShortTermProductInspectionModel } from "../workbench/short-term-product-model.js";
import { createShortTermPersistedOutputRecord } from "../workbench/short-term-save-state.js";

test("short-term command menu covers app state commands and redacts recent paths", () => {
  const appState = createShortTermLaunchAppState({
    recentFiles: [
      {
        id: "recent-a",
        displayName: "/Users/designer/private/profile_frame.svga",
        lastOpenedAt: "2026-07-02T00:00:00.000Z"
      }
    ]
  });
  const menu = createShortTermCommandMenuModel(appState);
  const flatItems = flattenShortTermCommandMenuItems(menu);
  const sourceCommandIds = new Set(flatItems.map((item) => item.sourceCommandId).filter(Boolean));

  assert.deepEqual(menu.groups.map((group) => group.id), [
    "app",
    "file",
    "edit",
    "resource",
    "optimize",
    "playback",
    "view",
    "window",
    "help"
  ]);
  for (const command of appState.commands) {
    assert.equal(sourceCommandIds.has(command.id), true, `missing menu command ${command.id}`);
  }
  assert.equal(JSON.stringify(menu).includes("/Users/designer"), false);
  assert.equal(flatItems.find((item) => item.id === "openRecent:recent-a")?.label, "profile_frame.svga");
  assert.equal(flatItems.find((item) => item.id === "cut")?.role, "cut");
  assert.equal(flatItems.find((item) => item.id === "copy")?.role, "copy");
  assert.equal(flatItems.find((item) => item.id === "paste")?.role, "paste");
  assert.equal(flatItems.find((item) => item.id === "selectAll")?.role, "selectAll");
});

test("short-term command menu reflects save availability and macOS accelerators", () => {
  const ready = completeShortTermLocalOpen(
    startShortTermLocalOpen(createShortTermLaunchAppState(), {
      requestId: "open-1",
      source: "fileButton",
      displayName: "editable.svga"
    }),
    {
      requestId: "open-1",
      inspection: inspectionFixture()
    }
  );
  const output = createShortTermPersistedOutputRecord({
    outputKind: "optimized_svga",
    operationId: "opt-1",
    sourceName: "editable.svga",
    sourceSha256: "source",
    outputBytes: new Uint8Array([1, 2, 3]),
    sourceUnchanged: true,
    validationPassed: true
  });
  const dirty = attachShortTermPersistedOutput(ready, output);
  const menu = createShortTermCommandMenuModel(dirty);
  const flatItems = flattenShortTermCommandMenuItems(menu);

  assert.equal(flatItems.find((item) => item.id === "openSvga")?.accelerator, "Command+O");
  assert.equal(flatItems.find((item) => item.id === "save")?.accelerator, "Command+S");
  assert.equal(flatItems.find((item) => item.id === "saveAs")?.accelerator, "Shift+Command+S");
  assert.equal(flatItems.find((item) => item.id === "minimize")?.accelerator, "Command+M");
  assert.equal(flatItems.find((item) => item.id === "saveAs")?.enabled, true);

  const clean = createShortTermCommandMenuModel(clearShortTermPersistedOutput(dirty));
  assert.equal(flattenShortTermCommandMenuItems(clean).find((item) => item.id === "saveAs")?.enabled, false);
});

test("short-term command menu fails closed when app command contract drifts", () => {
  const appState = createShortTermLaunchAppState();
  const brokenState: ShortTermAppStateModel = {
    ...appState,
    commands: appState.commands.filter((command) => command.id !== "replaceImage")
  };

  assert.throws(
    () => createShortTermCommandMenuModel(brokenState),
    /Missing short-term command "replaceImage"/
  );
});

function inspectionFixture(): ShortTermProductInspectionModel {
  return {
    schemaVersion: 1,
    source: "avatar-frame-inspection-report",
    prdIds: ["S3", "S4", "S5", "S6", "S7", "S8", "S15"],
    overview: {
      profileId: "production_target",
      profileLabel: "Avatar Frame Production Target",
      facts: [],
      assetSummary: {
        imageResourceCount: 1,
        sequenceGroupCount: 0,
        replaceableImageCount: 1,
        findingCount: 0
      },
      audioGroup: {
        status: "empty",
        copy: "当前文件暂无音频资产",
        count: 0
      }
    },
    assets: [],
    replaceableElements: {
      images: [],
      texts: [],
      emptyCopy: "",
      textPreviewCopy: "短期版本仅支持运行时文本预览，不写入 SVGA 字节。"
    },
    optimization: {
      safeExecutableCount: 0,
      reviewOnlyCount: 0,
      unsupportedCount: 0,
      estimatedSafeFileSizeSavings: "0 B",
      estimatedSafeDecodedMemorySavings: "0 B",
      batchActionEnabled: false,
      batchActionLabel: "暂无可执行优化",
      items: []
    }
  };
}
