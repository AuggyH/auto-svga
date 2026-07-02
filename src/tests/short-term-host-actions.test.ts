import assert from "node:assert/strict";
import path from "node:path";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  createShortTermColoredPng,
  createShortTermOptimizableSvgaFixture,
  createShortTermSvgaFixture
} from "./helpers/short-term-svga-fixtures.js";
import {
  classifyShortTermHostMenuCommand,
  createShortTermHostActionState,
  dispatchShortTermHostMenuAction,
  openShortTermHostLocalFile,
  openShortTermHostRecentFile,
  resetShortTermHostImageReplacement,
  type ShortTermHostEnvironment,
  type ShortTermHostMenuActionInput
} from "../workbench/short-term-host-actions.js";
import { flattenShortTermCommandMenuItems } from "../workbench/short-term-command-menu.js";
import type { ShortTermProductInspectionModel } from "../workbench/short-term-product-model.js";

test("short-term host actions open local files through the facade without exposing local paths", async () => {
  const sourceBytes = await createShortTermSvgaFixture();
  const host = createMemoryHost({
    "/Users/designer/private/opened.svga": sourceBytes
  });

  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "menuOpen",
    localPath: "/Users/designer/private/opened.svga"
  });

  assert.equal(opened.facade.model.appState.state, "previewReady");
  assert.equal(opened.currentLocalPath, "/Users/designer/private/opened.svga");
  assert.equal(opened.lastAction?.status, "completed");
  assert.equal(opened.facade.model.recentFiles.launchRecentFiles[0].displayName, "opened.svga");
  assert.equal(JSON.stringify(opened.facade.model).includes("/Users/designer"), false);
});

test("short-term host actions mark unavailable recent files without stale source state", async () => {
  const host = createMemoryHost({}, {
    exists: () => false
  });
  const state = createShortTermHostActionState({
    recentFiles: [
      {
        id: "recent-missing",
        localPath: "/Users/designer/private/missing.svga",
        lastOpenedAt: "2026-07-02T00:00:00.000Z"
      }
    ]
  });

  const opened = await openShortTermHostRecentFile(state, host, {
    requestId: "recent-1",
    recentFileId: "recent-missing",
    source: "recentMenu"
  });

  assert.equal(opened.facade.model.appState.state, "recentFileMissing");
  assert.equal(opened.currentLocalPath, undefined);
  assert.equal(opened.activeOutputBytes, undefined);
  assert.equal(opened.lastAction?.status, "failed");
  assert.equal(opened.facade.model.recentFiles.menuRecentFiles[0].availability, "missing");
  assert.equal(JSON.stringify(opened.facade.model).includes("/Users/designer"), false);
});

test("short-term host actions redact local paths from host error diagnostics", async () => {
  const host = createMemoryHost({}, {
    readError: () => new Error("Cannot read /Users/designer/private/broken.svga")
  });

  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: "/Users/designer/private/broken.svga"
  });

  assert.equal(opened.facade.model.appState.state, "loadFailed");
  assert.equal(opened.lastAction?.status, "failed");
  assert.equal(opened.lastAction?.diagnostic?.message.includes("/Users/designer"), false);
  assert.equal(JSON.stringify(opened.facade.model).includes("/Users/designer"), false);
});

test("short-term host actions run optimization and Save As through write-read validation", async () => {
  const sourceBytes = await createShortTermOptimizableSvgaFixture();
  const host = createMemoryHost({
    "/Users/designer/private/optimizable.svga": sourceBytes
  });
  const opened = await dispatchShortTermHostMenuAction(createShortTermHostActionState(), host, {
    commandId: "openSvga",
    requestId: "open-1",
    localPath: "/Users/designer/private/optimizable.svga"
  });
  const optimized = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "runOptimization"
  });

  assert.equal(optimized.lastAction?.status, "completed");
  assert.ok(optimized.activeOutputBytes);
  assert.equal(commandEnabled(optimized, "saveAs"), true);
  assert.equal(menuItemEnabled(optimized, "saveAs"), true);

  const saved = await dispatchShortTermHostMenuAction(optimized, host, {
    commandId: "saveAs",
    targetPath: "/Users/designer/private/optimized.svga"
  });

  assert.equal(saved.lastAction?.status, "completed");
  assert.equal(saved.lastAction?.targetDisplayName, "optimized.svga");
  assert.equal(saved.activeOutputBytes, undefined);
  assert.equal(commandEnabled(saved, "saveAs"), false);
  assert.equal(menuItemEnabled(saved, "saveAs"), false);
  assert.equal(sha256(host.snapshot("/Users/designer/private/optimized.svga")), saved.lastAction?.outputSha256);
  assert.equal(JSON.stringify(saved.facade.model).includes("/Users/designer"), false);
});

test("short-term host actions keep dirty output when saved bytes fail read-back validation", async () => {
  const sourceBytes = await createShortTermOptimizableSvgaFixture();
  const host = createMemoryHost({
    "/Users/designer/private/optimizable.svga": sourceBytes
  }, {
    readSavedOverride: () => new Uint8Array([9, 9, 9])
  });
  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: "/Users/designer/private/optimizable.svga"
  });
  const optimized = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "runOptimization"
  });
  const saved = await dispatchShortTermHostMenuAction(optimized, host, {
    commandId: "saveAs",
    targetPath: "/Users/designer/private/optimized.svga"
  });

  assert.equal(saved.lastAction?.status, "failed");
  assert.match(saved.facade.model.activeWorkflow.message, /未匹配已验证输出/);
  assert.ok(saved.activeOutputBytes);
  assert.ok(saved.facade.model.activeOutput);
  assert.equal(commandEnabled(saved, "saveAs"), true);
});

test("short-term host actions block same-source Save As and allow explicit overwrite save", async () => {
  const sourcePath = "/Users/designer/private/optimizable.svga";
  const sourceBytes = await createShortTermOptimizableSvgaFixture();
  const host = createMemoryHost({
    [sourcePath]: sourceBytes
  });
  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });
  const optimized = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "runOptimization"
  });
  assert.ok(optimized.activeOutputBytes);
  const optimizedHash = sha256(optimized.activeOutputBytes);

  const blockedSaveAs = await dispatchShortTermHostMenuAction(optimized, host, {
    commandId: "saveAs",
    targetPath: sourcePath
  });
  assert.equal(blockedSaveAs.lastAction?.status, "blocked");
  assert.equal(blockedSaveAs.lastAction?.diagnostic?.code, "save_as_target_matches_source");
  assert.ok(blockedSaveAs.activeOutputBytes);
  assert.equal(sha256(host.snapshot(sourcePath)), sha256(sourceBytes));
  assert.equal(commandEnabled(blockedSaveAs, "saveAs"), true);

  const overwritten = await dispatchShortTermHostMenuAction(blockedSaveAs, host, {
    commandId: "save"
  });
  assert.equal(overwritten.lastAction?.status, "completed");
  assert.equal(overwritten.lastAction?.commandId, "save");
  assert.equal(overwritten.activeOutputBytes, undefined);
  assert.equal(sha256(host.snapshot(sourcePath)), optimizedHash);
  assert.equal(commandEnabled(overwritten, "save"), false);
  assert.equal(commandEnabled(overwritten, "saveAs"), false);
});

test("short-term host actions block dirty local open until discard is confirmed", async () => {
  const sourcePath = "/Users/designer/private/optimizable.svga";
  const nextPath = "/Users/designer/private/next.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermOptimizableSvgaFixture(),
    [nextPath]: await createShortTermSvgaFixture()
  });
  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });
  const optimized = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "runOptimization"
  });

  assert.ok(optimized.activeOutputBytes);

  const blocked = await dispatchShortTermHostMenuAction(optimized, host, {
    commandId: "openSvga",
    requestId: "open-2",
    localPath: nextPath
  });

  assert.equal(blocked.lastAction?.status, "blocked");
  assert.equal(blocked.lastAction?.diagnostic?.code, "open_requires_discard_confirmation");
  assert.equal(blocked.facade.model.appState.state, "previewReady");
  assert.equal(blocked.currentLocalPath, sourcePath);
  assert.ok(blocked.activeOutputBytes);
  assert.ok(blocked.facade.model.activeOutput);

  const reopened = await dispatchShortTermHostMenuAction(optimized, host, {
    commandId: "openSvga",
    requestId: "open-2",
    localPath: nextPath,
    discardUnsavedChanges: true
  });

  assert.equal(reopened.lastAction?.status, "completed");
  assert.equal(reopened.facade.model.appState.state, "previewReady");
  assert.equal(reopened.currentLocalPath, nextPath);
  assert.equal(reopened.activeOutputBytes, undefined);
  assert.equal(reopened.facade.model.activeOutput, undefined);
});

test("short-term host actions block dirty recent open until discard is confirmed", async () => {
  const sourcePath = "/Users/designer/private/optimizable.svga";
  const recentPath = "/Users/designer/private/recent.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermOptimizableSvgaFixture(),
    [recentPath]: await createShortTermSvgaFixture()
  });
  const opened = await openShortTermHostLocalFile(createShortTermHostActionState({
    recentFiles: [
      {
        id: "recent-b",
        localPath: recentPath,
        displayName: "recent.svga",
        lastOpenedAt: "2026-07-02T00:00:00.000Z"
      }
    ]
  }), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });
  const optimized = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "runOptimization"
  });

  assert.ok(optimized.activeOutputBytes);

  const blocked = await dispatchShortTermHostMenuAction(optimized, host, {
    commandId: "openRecent",
    requestId: "recent-1",
    recentFileId: "recent-b"
  });

  assert.equal(blocked.lastAction?.status, "blocked");
  assert.equal(blocked.lastAction?.diagnostic?.code, "open_requires_discard_confirmation");
  assert.equal(blocked.facade.model.appState.state, "previewReady");
  assert.equal(blocked.currentLocalPath, sourcePath);
  assert.ok(blocked.activeOutputBytes);
  assert.ok(blocked.facade.model.activeOutput);

  const reopened = await dispatchShortTermHostMenuAction(optimized, host, {
    commandId: "openRecent",
    requestId: "recent-1",
    recentFileId: "recent-b",
    discardUnsavedChanges: true
  });

  assert.equal(reopened.lastAction?.status, "completed");
  assert.equal(reopened.facade.model.appState.state, "previewReady");
  assert.equal(reopened.currentLocalPath, recentPath);
  assert.equal(reopened.activeOutputBytes, undefined);
  assert.equal(reopened.facade.model.activeOutput, undefined);
});

test("short-term host actions block cross-workflow dirty operations until discard is confirmed", async () => {
  const sourcePath = "/Users/designer/private/optimizable.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermOptimizableSvgaFixture()
  });
  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });
  const optimized = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "runOptimization"
  });

  assert.equal(optimized.lastAction?.status, "completed");
  assert.equal(optimized.facade.model.activeOutput?.outputKind, "optimized_svga");

  const repeatedOptimization = await dispatchShortTermHostMenuAction(optimized, host, {
    commandId: "runOptimization"
  });
  assert.equal(repeatedOptimization.lastAction?.status, "blocked");
  assert.equal(repeatedOptimization.lastAction?.diagnostic?.code, "operation_requires_discard_confirmation");
  assert.equal(repeatedOptimization.facade.model.activeOutput?.outputKind, "optimized_svga");

  const renameBlocked = await dispatchShortTermHostMenuAction(optimized, host, {
    commandId: "renameImageKey",
    fromImageKey: "img_frame",
    toImageKey: "profile_frame"
  });
  assert.equal(renameBlocked.lastAction?.status, "blocked");
  assert.equal(renameBlocked.lastAction?.diagnostic?.code, "operation_requires_discard_confirmation");
  assert.equal(renameBlocked.facade.model.activeOutput?.outputKind, "optimized_svga");
  assert.ok(renameBlocked.activeOutputBytes);

  const renamed = await dispatchShortTermHostMenuAction(optimized, host, {
    commandId: "renameImageKey",
    fromImageKey: "img_frame",
    toImageKey: "profile_frame",
    discardUnsavedChanges: true
  });
  assert.equal(renamed.lastAction?.status, "completed");
  assert.equal(renamed.facade.model.activeOutput?.outputKind, "renamed_svga");
  assert.ok(renamed.activeOutputBytes);

  const replaceBlocked = await dispatchShortTermHostMenuAction(renamed, host, {
    commandId: "replaceImage",
    imageKey: "img_frame",
    pngBytes: createShortTermColoredPng(16, 16, [0, 0, 255, 255])
  });
  assert.equal(replaceBlocked.lastAction?.status, "blocked");
  assert.equal(replaceBlocked.lastAction?.diagnostic?.code, "operation_requires_discard_confirmation");
  assert.equal(replaceBlocked.facade.model.activeOutput?.outputKind, "renamed_svga");

  const replaced = await dispatchShortTermHostMenuAction(renamed, host, {
    commandId: "replaceImage",
    imageKey: "img_frame",
    pngBytes: createShortTermColoredPng(16, 16, [0, 0, 255, 255]),
    discardUnsavedChanges: true
  });
  assert.equal(replaced.lastAction?.status, "completed");
  assert.equal(replaced.facade.model.activeOutput?.outputKind, "image_replacement_svga");
});

test("short-term host actions allow repeated image replacement preview without discard confirmation", async () => {
  const sourcePath = "/Users/designer/private/editable.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermSvgaFixture()
  });
  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });
  const first = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "replaceImage",
    imageKey: "img_frame",
    pngBytes: createShortTermColoredPng(16, 16, [0, 0, 255, 255])
  });

  assert.equal(first.lastAction?.status, "completed");
  assert.equal(first.facade.model.activeOutput?.outputKind, "image_replacement_svga");
  assert.ok(first.activeOutputBytes);

  const second = await dispatchShortTermHostMenuAction(first, host, {
    commandId: "replaceImage",
    imageKey: "img_frame",
    pngBytes: createShortTermColoredPng(16, 16, [0, 255, 0, 255])
  });

  assert.equal(second.lastAction?.status, "completed");
  assert.equal(second.facade.model.activeOutput?.outputKind, "image_replacement_svga");
  assert.ok(second.activeOutputBytes);
});

test("short-term host actions reset image replacement without clearing other dirty output kinds", async () => {
  const sourcePath = "/Users/designer/private/editable.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermOptimizableSvgaFixture()
  });
  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });
  const optimized = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "runOptimization"
  });
  const blocked = resetShortTermHostImageReplacement(optimized);

  assert.equal(blocked.lastAction?.status, "blocked");
  assert.equal(blocked.lastAction?.diagnostic?.code, "operation_requires_discard_confirmation");
  assert.equal(blocked.facade.model.activeOutput?.outputKind, "optimized_svga");
  assert.ok(blocked.activeOutputBytes);

  const replaced = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "replaceImage",
    imageKey: "img_frame",
    pngBytes: createShortTermColoredPng(16, 16, [0, 0, 255, 255])
  });
  const reset = resetShortTermHostImageReplacement(replaced);

  assert.equal(reset.lastAction?.status, "completed");
  assert.equal(reset.lastAction?.action, "resetImageReplacement");
  assert.equal(reset.facade.imageReplacementSession?.model.status, "ready");
  assert.equal(reset.facade.imageReplacementSession?.model.activeReplacement, undefined);
  assert.equal(reset.facade.model.activeOutput, undefined);
  assert.equal(reset.activeOutputBytes, undefined);
  assert.equal(commandEnabled(reset, "saveAs"), false);
  assert.equal(reset.currentLocalPath, sourcePath);
});

test("short-term host actions block disabled or unrouted menu commands", async () => {
  const host = createMemoryHost({});
  const state = createShortTermHostActionState();

  const clearBlocked = await dispatchShortTermHostMenuAction(state, host, {
    commandId: "clearRecent"
  });
  assert.equal(clearBlocked.lastAction?.status, "blocked");
  assert.equal(clearBlocked.lastAction?.diagnostic?.code, "menu_command_disabled");

  const unknownBlocked = await dispatchShortTermHostMenuAction(state, host, {
    commandId: "showLogs"
  });
  assert.equal(unknownBlocked.lastAction?.status, "blocked");
  assert.equal(unknownBlocked.lastAction?.diagnostic?.code, "menu_command_disabled");
});

test("short-term host actions delegate native and renderer-owned menu commands", async () => {
  const sourcePath = "/Users/designer/private/opened.svga";
  const sourceBytes = await createShortTermSvgaFixture();
  const host = createMemoryHost({
    [sourcePath]: sourceBytes
  });
  const launch = createShortTermHostActionState();

  const copied = await dispatchShortTermHostMenuAction(launch, host, {
    commandId: "copy"
  });
  assert.equal(copied.lastAction?.status, "delegated");
  assert.equal(copied.lastAction?.diagnostic?.code, "menu_command_delegated_to_native");
  assert.equal(copied.facade.model.appState.state, "launch");

  const help = await dispatchShortTermHostMenuAction(launch, host, {
    commandId: "help"
  });
  assert.equal(help.lastAction?.status, "delegated");
  assert.equal(help.lastAction?.diagnostic?.code, "menu_command_delegated_to_renderer");

  const playBlocked = await dispatchShortTermHostMenuAction(launch, host, {
    commandId: "playPause"
  });
  assert.equal(playBlocked.lastAction?.status, "blocked");
  assert.equal(playBlocked.lastAction?.diagnostic?.code, "menu_command_disabled");

  const opened = await openShortTermHostLocalFile(launch, host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });
  const played = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "playPause"
  });
  assert.equal(played.lastAction?.status, "delegated");
  assert.equal(played.lastAction?.diagnostic?.code, "menu_command_delegated_to_renderer");
  assert.equal(played.currentLocalPath, sourcePath);

  const minimized = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "minimize"
  });
  assert.equal(minimized.lastAction?.status, "delegated");
  assert.equal(minimized.lastAction?.diagnostic?.code, "menu_command_delegated_to_native");
  assert.equal(minimized.currentLocalPath, sourcePath);
});

test("short-term host actions guard quit menu dispatch against dirty output", async () => {
  const sourcePath = "/Users/designer/private/opened.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermOptimizableSvgaFixture()
  });
  const launch = createShortTermHostActionState();

  const cleanQuit = await dispatchShortTermHostMenuAction(launch, host, {
    commandId: "quit"
  });
  assert.equal(cleanQuit.lastAction?.status, "delegated");
  assert.equal(cleanQuit.lastAction?.diagnostic?.code, "menu_command_delegated_to_native_after_lifecycle_check");

  const opened = await openShortTermHostLocalFile(launch, host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });
  const optimized = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "runOptimization"
  });

  const blockedQuit = await dispatchShortTermHostMenuAction(optimized, host, {
    commandId: "quit"
  });
  assert.equal(blockedQuit.lastAction?.status, "blocked");
  assert.equal(blockedQuit.lastAction?.commandId, "quit");
  assert.equal(blockedQuit.lastAction?.diagnostic?.code, "lifecycle_requires_discard_confirmation");
  assert.equal(blockedQuit.currentLocalPath, sourcePath);
  assert.ok(blockedQuit.activeOutputBytes);
  assert.equal(JSON.stringify(blockedQuit.lastAction).includes("/Users/designer"), false);

  const confirmedQuit = await dispatchShortTermHostMenuAction(optimized, host, {
    commandId: "quit",
    discardUnsavedChanges: true
  });
  assert.equal(confirmedQuit.lastAction?.status, "delegated");
  assert.equal(confirmedQuit.lastAction?.commandId, "quit");
  assert.equal(confirmedQuit.lastAction?.diagnostic?.code, "menu_command_delegated_to_native_after_lifecycle_check");
  assert.equal(confirmedQuit.currentLocalPath, sourcePath);
  assert.ok(confirmedQuit.activeOutputBytes);
});

test("short-term host actions open recent submenu item ids directly", async () => {
  const sourcePath = "/Users/designer/private/recent.svga";
  const sourceBytes = await createShortTermSvgaFixture();
  const host = createMemoryHost({
    [sourcePath]: sourceBytes
  });
  const state = createShortTermHostActionState({
    recentFiles: [
      {
        id: "recent-a",
        localPath: sourcePath,
        displayName: "recent.svga",
        lastOpenedAt: "2026-07-02T00:00:00.000Z"
      }
    ]
  });

  const opened = await dispatchShortTermHostMenuAction(state, host, {
    commandId: "openRecent:recent-a"
  });

  assert.equal(opened.lastAction?.status, "completed");
  assert.equal(opened.facade.model.appState.state, "previewReady");
  assert.equal(opened.currentLocalPath, sourcePath);
  assert.equal(JSON.stringify(opened.facade.model).includes("/Users/designer"), false);
});

test("short-term host actions block contextual resource menu commands without renderer payload", async () => {
  const sourcePath = "/Users/designer/private/opened.svga";
  const sourceBytes = await createShortTermSvgaFixture();
  const host = createMemoryHost({
    [sourcePath]: sourceBytes
  });
  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });

  const renameBlocked = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "renameImageKey"
  } as unknown as ShortTermHostMenuActionInput);

  assert.equal(renameBlocked.lastAction?.status, "blocked");
  assert.equal(renameBlocked.lastAction?.commandId, "renameImageKey");
  assert.equal(renameBlocked.lastAction?.diagnostic?.code, "menu_command_context_missing");
  assert.equal(renameBlocked.facade.model.appState.state, "previewReady");
  assert.equal(renameBlocked.currentLocalPath, sourcePath);
  assert.equal(renameBlocked.activeOutputBytes, undefined);

  const replaceBlocked = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "replaceImage",
    imageKey: "img_frame"
  } as unknown as ShortTermHostMenuActionInput);

  assert.equal(replaceBlocked.lastAction?.status, "blocked");
  assert.equal(replaceBlocked.lastAction?.commandId, "replaceImage");
  assert.equal(replaceBlocked.lastAction?.diagnostic?.code, "menu_command_context_missing");
  assert.equal(replaceBlocked.facade.model.appState.state, "previewReady");
  assert.equal(replaceBlocked.currentLocalPath, sourcePath);
  assert.equal(replaceBlocked.activeOutputBytes, undefined);
});

test("short-term host menu command classification covers enabled menu item ids", async () => {
  const sourcePath = "/Users/designer/private/opened.svga";
  const sourceBytes = await createShortTermSvgaFixture();
  const host = createMemoryHost({
    [sourcePath]: sourceBytes
  });
  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "menuOpen",
    localPath: sourcePath
  });
  const enabledCommandIds = flattenShortTermCommandMenuItems(opened.facade.model.commandMenu)
    .filter((item) => item.kind === "command" && item.enabled !== false)
    .map((item) => item.id);

  assert.ok(enabledCommandIds.length > 0);
  for (const commandId of enabledCommandIds) {
    assert.notEqual(classifyShortTermHostMenuCommand(commandId), "unsupported", commandId);
  }
});

test("short-term host actions block dirty close until discard is confirmed", async () => {
  const sourcePath = "/Users/designer/private/opened.svga";
  const sourceBytes = await createShortTermOptimizableSvgaFixture();
  const host = createMemoryHost({
    [sourcePath]: sourceBytes
  });
  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });
  const optimized = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "runOptimization"
  });
  const blocked = await dispatchShortTermHostMenuAction(optimized, host, {
    commandId: "closeFile"
  });

  assert.equal(blocked.lastAction?.status, "blocked");
  assert.equal(blocked.lastAction?.commandId, "closeFile");
  assert.equal(blocked.lastAction?.diagnostic?.code, "close_requires_discard_confirmation");
  assert.equal(blocked.facade.model.appState.state, "previewReady");
  assert.equal(blocked.currentLocalPath, sourcePath);
  assert.ok(blocked.activeOutputBytes);
  assert.ok(blocked.facade.model.activeOutput);

  const closed = await dispatchShortTermHostMenuAction(optimized, host, {
    commandId: "closeFile",
    discardUnsavedChanges: true
  });

  assert.equal(closed.lastAction?.status, "completed");
  assert.equal(closed.lastAction?.commandId, "closeFile");
  assert.equal(closed.facade.model.appState.state, "launch");
  assert.equal(closed.currentLocalPath, undefined);
  assert.equal(closed.activeOutputBytes, undefined);
  assert.equal(closed.facade.model.activeOutput, undefined);
  assert.equal(closed.facade.model.recentFiles.launchRecentFiles[0].displayName, "opened.svga");
  assert.equal(commandEnabled(closed, "closeFile"), false);
  assert.equal(JSON.stringify(closed.facade.model).includes("/Users/designer"), false);
});

test("short-term host actions close clean files without discard confirmation", async () => {
  const sourcePath = "/Users/designer/private/opened.svga";
  const sourceBytes = await createShortTermSvgaFixture();
  const host = createMemoryHost({
    [sourcePath]: sourceBytes
  });
  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });
  const closed = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "closeFile"
  });

  assert.equal(closed.lastAction?.status, "completed");
  assert.equal(closed.facade.model.appState.state, "launch");
  assert.equal(closed.currentLocalPath, undefined);
  assert.equal(closed.activeOutputBytes, undefined);
  assert.equal(closed.facade.model.recentFiles.launchRecentFiles[0].displayName, "opened.svga");
});

function createMemoryHost(
  initialFiles: Record<string, Uint8Array>,
  options: {
    exists?: (localPath: string) => boolean;
    readError?: (localPath: string) => Error;
    inspect?: (input: { bytes: Uint8Array; displayName: string; localPath?: string }) => ShortTermProductInspectionModel;
    readSavedOverride?: (localPath: string) => Uint8Array;
  } = {}
): ShortTermHostEnvironment & { snapshot(localPath: string): Uint8Array } {
  const files = new Map(Object.entries(initialFiles).map(([key, value]) => [key, new Uint8Array(value)]));
  return {
    async readLocalFile(localPath) {
      const readError = options.readError?.(localPath);
      if (readError) throw readError;
      const bytes = files.get(localPath);
      if (!bytes) throw new Error("File is missing.");
      return {
        bytes: new Uint8Array(bytes),
        displayName: path.basename(localPath)
      };
    },
    async inspectSvga(input) {
      return options.inspect?.(input) ?? inspectionFixture();
    },
    async writeLocalFile(localPath, bytes) {
      files.set(localPath, new Uint8Array(bytes));
    },
    async readSavedFile(localPath) {
      const override = options.readSavedOverride?.(localPath);
      if (override) return new Uint8Array(override);
      const bytes = files.get(localPath);
      if (!bytes) throw new Error("Saved file is missing.");
      return new Uint8Array(bytes);
    },
    async fileExists(localPath) {
      return options.exists ? options.exists(localPath) : files.has(localPath);
    },
    snapshot(localPath) {
      const bytes = files.get(localPath);
      assert.ok(bytes, `missing snapshot ${localPath}`);
      return new Uint8Array(bytes);
    }
  };
}

function commandEnabled(state: { facade: { model: { appState: { commands: readonly { id: string; enabled: boolean }[] } } } }, id: string): boolean {
  const command = state.facade.model.appState.commands.find((item) => item.id === id);
  assert.ok(command, `missing command ${id}`);
  return command.enabled;
}

function menuItemEnabled(
  state: { facade: { model: { commandMenu: { groups: readonly { items: readonly { id: string; enabled?: boolean; items?: readonly { id: string; enabled?: boolean }[] }[] }[] } } } },
  id: string
): boolean | undefined {
  const items = state.facade.model.commandMenu.groups.flatMap((group) => group.items.flatMap((item) => [
    item,
    ...(item.items ?? [])
  ]));
  const item = items.find((entry) => entry.id === id);
  assert.ok(item, `missing menu item ${id}`);
  return item.enabled;
}

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
        imageResourceCount: 2,
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

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
