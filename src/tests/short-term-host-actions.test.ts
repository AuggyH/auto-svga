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
  clearShortTermHostRecentFiles,
  classifyShortTermHostMenuCommand,
  cancelShortTermHostTransientWorkflow,
  createShortTermHostActionState,
  dispatchShortTermHostMenuAction,
  openShortTermHostLocalFile,
  openShortTermHostRecentFile,
  applyShortTermHostTextPreview,
  prepareShortTermHostTextPreview,
  reportShortTermHostPlaybackFailure,
  resetShortTermHostImageReplacement,
  resetShortTermHostTextPreview,
  runShortTermHostImageKeyRename,
  runShortTermHostImageReplacement,
  runShortTermHostOptimization,
  saveShortTermHostOutput,
  type ShortTermHostActionState,
  type ShortTermHostApplyTextPreviewInput,
  type ShortTermHostEnvironment,
  type ShortTermHostMenuActionInput,
  type ShortTermHostOpenLocalFileInput,
  type ShortTermHostOpenRecentFileInput,
  type ShortTermHostPlaybackFailureInput,
  type ShortTermHostPrepareTextPreviewInput,
  type ShortTermHostSaveInput
} from "../workbench/short-term-host-actions.js";
import {
  createShortTermCommandMenuModel,
  flattenShortTermCommandMenuItems
} from "../workbench/short-term-command-menu.js";
import type { ShortTermProductInspectionModel } from "../workbench/short-term-product-model.js";

test("short-term host actions open local files through the facade without exposing local paths", async () => {
  const sourceBytes = await createShortTermSvgaFixture();
  const host = createMemoryHost({
    "/Users/designer/private/opened.svga": sourceBytes
  });

  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "menuOpen",
    localPath: "/Users/designer/private/opened.svga",
    displayName: "/Users/designer/private/unsafe_display.svga"
  });

  assert.equal(opened.facade.model.appState.state, "previewReady");
  assert.equal(opened.currentLocalPath, "/Users/designer/private/opened.svga");
  assert.equal(opened.lastAction?.status, "completed");
  assert.equal(opened.facade.model.appState.currentFile?.displayName, "unsafe_display.svga");
  assert.equal(opened.facade.model.recentFiles.launchRecentFiles[0].displayName, "unsafe_display.svga");
  assert.equal(JSON.stringify(opened.facade.model).includes("/Users/designer"), false);
});

test("short-term host actions redact local paths returned by inspection models", async () => {
  const localPath = "/Users/designer/private/opened.svga";
  const host = createMemoryHost({
    [localPath]: await createShortTermSvgaFixture()
  }, {
    inspect: () => inspectionFixtureWithLocalPath(localPath)
  });

  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath
  });

  assert.equal(opened.facade.model.appState.state, "previewReady");
  assert.equal(opened.lastAction?.status, "completed");
  assert.equal(JSON.stringify(opened.facade.model).includes("/Users/designer"), false);
  assert.equal(
    opened.facade.model.appState.currentFile?.inspection.overview.profileLabel,
    "Loaded from [local path]"
  );
  assert.equal(
    opened.facade.model.appState.currentFile?.inspection.assets[0]?.name,
    "Image from [local path]"
  );
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

test("short-term host actions fail closed when recent availability checks throw", async () => {
  const recentPath = "/Users/designer/private/permission-denied.svga";
  const host = createMemoryHost({}, {
    exists: () => {
      throw new Error(`Cannot stat ${recentPath}`);
    },
    readError: () => {
      assert.fail("Failed availability checks must not continue to host file reads.");
    }
  });
  const state = createShortTermHostActionState({
    recentFiles: [
      {
        id: "recent-denied",
        localPath: recentPath,
        displayName: "permission-denied.svga",
        lastOpenedAt: "2026-07-02T00:00:00.000Z"
      }
    ]
  });

  const opened = await openShortTermHostRecentFile(state, host, {
    requestId: "recent-1",
    recentFileId: "recent-denied",
    source: "recentMenu"
  });

  assert.equal(opened.lastAction?.status, "failed");
  assert.equal(opened.lastAction?.diagnostic?.code, "recent_file_availability_check_failed");
  assert.equal(opened.facade.model.appState.state, "recentFileMissing");
  assert.equal(opened.currentLocalPath, undefined);
  assert.equal(opened.activeOutputBytes, undefined);
  assert.equal(opened.facade.model.recentFiles.menuRecentFiles[0].availability, "missing");
  assert.equal(JSON.stringify(opened.lastAction).includes("/Users/designer"), false);
  assert.equal(JSON.stringify(opened.facade.model).includes("/Users/designer"), false);
});

test("short-term host open actions fail closed for malformed runtime inputs", async () => {
  const host = createMemoryHost({}, {
    readError: () => {
      assert.fail("Malformed open input must not reach host file reads.");
    }
  });
  const state = createShortTermHostActionState();

  const invalidLocal = await openShortTermHostLocalFile(
    state,
    host,
    {
      requestId: "open-1",
      source: "unsupported-source",
      localPath: "/Users/designer/private/opened.svga"
    } as unknown as ShortTermHostOpenLocalFileInput
  );
  assert.equal(invalidLocal.lastAction?.status, "blocked");
  assert.equal(invalidLocal.lastAction?.commandId, "openSvga");
  assert.equal(invalidLocal.lastAction?.diagnostic?.code, "open_local_input_invalid");
  assert.equal(invalidLocal.facade.model.appState.state, "launch");
  assert.equal(invalidLocal.currentLocalPath, undefined);
  assert.equal(JSON.stringify(invalidLocal.lastAction).includes("/Users/designer"), false);

  const invalidRecent = await openShortTermHostRecentFile(
    state,
    host,
    {
      requestId: "recent-1",
      recentFileId: 42,
      source: "recentMenu"
    } as unknown as ShortTermHostOpenRecentFileInput
  );
  assert.equal(invalidRecent.lastAction?.status, "blocked");
  assert.equal(invalidRecent.lastAction?.commandId, "openRecent");
  assert.equal(invalidRecent.lastAction?.diagnostic?.code, "open_recent_input_invalid");
  assert.equal(invalidRecent.facade.model.appState.state, "launch");
  assert.equal(invalidRecent.currentLocalPath, undefined);
});

test("short-term host actions redact local paths from host error diagnostics", async () => {
  const localPath = "/Users/designer/My Documents/Frame's Folder/broken.svga";
  const host = createMemoryHost({}, {
    readError: () => new Error(`Cannot read ${localPath}`)
  });

  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath
  });

  assert.equal(opened.facade.model.appState.state, "loadFailed");
  assert.equal(opened.lastAction?.status, "failed");
  assert.equal(opened.lastAction?.diagnostic?.message.includes("/Users/designer"), false);
  assert.equal(opened.lastAction?.diagnostic?.message.includes("My Documents"), false);
  assert.equal(opened.facade.model.appState.failure?.message.includes("Frame's Folder"), false);
  assert.equal(JSON.stringify(opened.facade.model).includes("/Users/designer"), false);
});

test("short-term host actions redact local paths from visible inspection failures", async () => {
  const localPath = "/Users/designer/My Documents/Frame's Folder/invalid.svga";
  const host = createMemoryHost({
    [localPath]: new Uint8Array([1, 2, 3])
  }, {
    inspect: () => {
      throw new Error(`Cannot parse ${localPath}`);
    }
  });

  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath
  });

  assert.equal(opened.facade.model.appState.state, "loadFailed");
  assert.equal(opened.lastAction?.status, "failed");
  assert.equal(opened.lastAction?.diagnostic?.message.includes("/Users/designer"), false);
  assert.equal(opened.facade.model.appState.failure?.message.includes("Frame's Folder"), false);
  assert.equal(JSON.stringify(opened.facade.model).includes("/Users/designer"), false);
});

test("short-term host output actions fail closed without opened source bytes", async () => {
  const state = createShortTermHostActionState();
  const optimized = await runShortTermHostOptimization(state);
  const renamed = await runShortTermHostImageKeyRename(state, "img_frame", "profile_frame");
  const replaced = await runShortTermHostImageReplacement(
    state,
    "img_frame",
    createShortTermColoredPng(16, 16, [0, 255, 0, 255])
  );

  for (const result of [optimized, renamed, replaced]) {
    assert.equal(result.lastAction?.status, "blocked");
    assert.equal(result.lastAction?.diagnostic?.code, "operation_requires_open_file");
    assert.equal(result.facade.model.appState.state, "launch");
    assert.equal(result.activeOutputBytes, undefined);
  }
  assert.equal(optimized.lastAction?.action, "runOptimization");
  assert.equal(renamed.lastAction?.action, "renameImageKey");
  assert.equal(replaced.lastAction?.action, "replaceImage");
});

test("short-term host preview actions fail closed when opened source bytes are missing", async () => {
  const host = createMemoryHost({
    "/Users/designer/private/opened.svga": await createShortTermSvgaFixture()
  });
  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: "/Users/designer/private/opened.svga"
  });
  const inconsistent = {
    ...opened,
    facade: {
      ...opened.facade,
      sourceBytes: undefined
    }
  };

  const resetImage = resetShortTermHostImageReplacement(inconsistent);
  const preparedText = prepareShortTermHostTextPreview(inconsistent, {
    textElements: [{ textKey: "nickname", displayName: "昵称", supportedFields: ["text"] }]
  });
  const appliedText = applyShortTermHostTextPreview(inconsistent, {
    replacement: { textKey: "nickname", fields: { text: "Alice" } }
  });
  const resetText = resetShortTermHostTextPreview(inconsistent);

  for (const result of [resetImage, preparedText, appliedText, resetText]) {
    assert.equal(result.lastAction?.status, "blocked");
    assert.equal(result.lastAction?.diagnostic?.code, "preview_action_requires_open_file");
    assert.equal(result.facade.model.appState.state, "previewReady");
    assert.equal(result.activeOutputBytes, undefined);
  }
  assert.equal(resetImage.lastAction?.action, "resetImageReplacement");
  assert.equal(preparedText.lastAction?.action, "prepareTextPreview");
  assert.equal(appliedText.lastAction?.action, "applyTextPreview");
  assert.equal(resetText.lastAction?.action, "resetTextPreview");
});

test("short-term host preview and playback actions fail closed for malformed runtime payloads", async () => {
  const sourcePath = "/Users/designer/private/opened.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermSvgaFixture()
  });
  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });

  const badPrepare = prepareShortTermHostTextPreview(
    opened,
    { textElements: [{ textKey: 42, displayName: "昵称", supportedFields: ["text"] }] } as unknown as ShortTermHostPrepareTextPreviewInput
  );
  assert.equal(badPrepare.lastAction?.status, "blocked");
  assert.equal(badPrepare.lastAction?.action, "prepareTextPreview");
  assert.equal(badPrepare.lastAction?.diagnostic?.code, "text_preview_input_invalid");
  assert.equal(badPrepare.facade.model.appState.state, "previewReady");
  assert.equal(badPrepare.activeOutputBytes, undefined);

  const prepared = prepareShortTermHostTextPreview(opened, {
    textElements: [{ textKey: "nickname", displayName: "昵称", supportedFields: ["text", "size"] }]
  });
  const badApply = applyShortTermHostTextPreview(
    prepared,
    { replacement: { textKey: "nickname", fields: { size: "large" } } } as unknown as ShortTermHostApplyTextPreviewInput
  );
  assert.equal(badApply.lastAction?.status, "blocked");
  assert.equal(badApply.lastAction?.action, "applyTextPreview");
  assert.equal(badApply.lastAction?.diagnostic?.code, "text_preview_input_invalid");
  assert.equal(badApply.facade.textPreviewSession?.model.status, "ready");

  const badPlayback = reportShortTermHostPlaybackFailure(
    opened,
    { message: ["/Users/designer/private/opened.svga"] } as unknown as ShortTermHostPlaybackFailureInput
  );
  assert.equal(badPlayback.lastAction?.status, "blocked");
  assert.equal(badPlayback.lastAction?.action, "reportPlaybackFailure");
  assert.equal(badPlayback.lastAction?.diagnostic?.code, "playback_failure_input_invalid");
  assert.equal(badPlayback.facade.model.appState.state, "previewReady");
  assert.equal(JSON.stringify(badPlayback.lastAction).includes("/Users/designer"), false);
});

test("short-term host text reset only succeeds after an active runtime text preview", async () => {
  const sourcePath = "/Users/designer/private/opened.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermSvgaFixture()
  });
  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });

  const unopenedReset = resetShortTermHostTextPreview(opened);
  assert.equal(unopenedReset.lastAction?.status, "blocked");
  assert.equal(unopenedReset.lastAction?.diagnostic?.code, "text_preview_reset_not_needed");

  const prepared = prepareShortTermHostTextPreview(opened, {
    textElements: [{ textKey: "nickname", displayName: "昵称", supportedFields: ["text"] }]
  });
  const preparedReset = resetShortTermHostTextPreview(prepared);
  assert.equal(preparedReset.lastAction?.status, "blocked");
  assert.equal(preparedReset.lastAction?.diagnostic?.code, "text_preview_reset_not_needed");

  const applied = applyShortTermHostTextPreview(prepared, {
    replacement: { textKey: "nickname", fields: { text: "Alice" } }
  });
  const reset = await dispatchShortTermHostMenuAction(applied, host, {
    commandId: "resetTextPreview"
  });
  assert.equal(reset.lastAction?.status, "completed");
  assert.equal(reset.facade.textPreviewSession?.model.status, "reset");
  assert.equal(reset.facade.textPreviewSession?.model.activeReplacement, undefined);

  const resetAgain = resetShortTermHostTextPreview(reset);
  assert.equal(resetAgain.lastAction?.status, "blocked");
  assert.equal(resetAgain.lastAction?.diagnostic?.code, "text_preview_reset_not_needed");
});

test("short-term host output actions fail closed for malformed runtime payloads", async () => {
  const sourcePath = "/Users/designer/private/opened.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermSvgaFixture()
  });
  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });

  const renamed = await runShortTermHostImageKeyRename(
    opened,
    42 as unknown as string,
    "profile_frame"
  );
  assert.equal(renamed.lastAction?.status, "blocked");
  assert.equal(renamed.lastAction?.commandId, "renameImageKey");
  assert.equal(renamed.lastAction?.diagnostic?.code, "rename_input_invalid");
  assert.equal(renamed.facade.model.appState.state, "previewReady");
  assert.equal(renamed.currentLocalPath, sourcePath);
  assert.equal(renamed.activeOutputBytes, undefined);

  const replaced = await runShortTermHostImageReplacement(
    opened,
    "profile_frame",
    [1, 2, 3] as unknown as Uint8Array
  );
  assert.equal(replaced.lastAction?.status, "blocked");
  assert.equal(replaced.lastAction?.commandId, "replaceImage");
  assert.equal(replaced.lastAction?.diagnostic?.code, "replacement_input_invalid");
  assert.equal(replaced.facade.model.appState.state, "previewReady");
  assert.equal(replaced.currentLocalPath, sourcePath);
  assert.equal(replaced.activeOutputBytes, undefined);
});

test("short-term host action results expose action-specific PRD ids", async () => {
  const sourcePath = "/Users/designer/private/optimizable.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermOptimizableSvgaFixture()
  });
  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });
  const optimized = await runShortTermHostOptimization(opened);
  const renamed = await runShortTermHostImageKeyRename(opened, "img_frame", "profile_frame");
  const replaced = await runShortTermHostImageReplacement(
    opened,
    "img_frame",
    createShortTermColoredPng(16, 16, [0, 255, 0, 255])
  );
  const textPrepared = prepareShortTermHostTextPreview(opened, {
    textElements: [{ textKey: "nickname", displayName: "昵称", supportedFields: ["text"] }]
  });
  const cancelled = cancelShortTermHostTransientWorkflow(optimized);
  const saved = await saveShortTermHostOutput(optimized, host, {
    command: "saveAs",
    targetPath: "/Users/designer/private/optimized.svga"
  });
  const clearedRecent = clearShortTermHostRecentFiles(opened);

  assert.deepEqual(opened.lastAction?.prdIds, ["S1", "S2"]);
  assert.deepEqual(optimized.lastAction?.prdIds, ["S8", "S9", "S10", "S14"]);
  assert.deepEqual(renamed.lastAction?.prdIds, ["S11", "S14"]);
  assert.deepEqual(replaced.lastAction?.prdIds, ["S12", "S14"]);
  assert.deepEqual(textPrepared.lastAction?.prdIds, ["S13"]);
  assert.deepEqual(cancelled.lastAction?.prdIds, ["S10", "S11", "S14"]);
  assert.deepEqual(saved.lastAction?.prdIds, ["S14"]);
  assert.deepEqual(clearedRecent.lastAction?.prdIds, ["S1", "S2", "S16"]);
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

test("short-term host actions block malformed save input without dropping dirty output", async () => {
  const sourcePath = "/Users/designer/private/optimizable.svga";
  const targetPath = "/Users/designer/private/optimized.svga";
  const sourceBytes = await createShortTermOptimizableSvgaFixture();
  const host = createMemoryHost({
    [sourcePath]: sourceBytes
  }, {
    writeError: () => {
      assert.fail("Malformed save input must not write.");
    }
  });
  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });
  const optimized = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "runOptimization"
  });

  const invalidCommand = await saveShortTermHostOutput(
    optimized,
    host,
    { command: "export" } as unknown as ShortTermHostSaveInput
  );

  assert.equal(invalidCommand.lastAction?.status, "blocked");
  assert.equal(invalidCommand.lastAction?.commandId, undefined);
  assert.equal(invalidCommand.lastAction?.diagnostic?.code, "save_input_invalid");
  assert.ok(invalidCommand.activeOutputBytes);
  assert.ok(invalidCommand.facade.model.activeOutput);

  const invalidTarget = await saveShortTermHostOutput(
    optimized,
    host,
    { command: "saveAs", targetPath: [targetPath] } as unknown as ShortTermHostSaveInput
  );

  assert.equal(invalidTarget.lastAction?.status, "blocked");
  assert.equal(invalidTarget.lastAction?.commandId, "saveAs");
  assert.equal(invalidTarget.lastAction?.diagnostic?.code, "save_input_invalid");
  assert.equal(JSON.stringify(invalidTarget.lastAction).includes("/Users/designer"), false);
  assert.ok(invalidTarget.activeOutputBytes);
  assert.ok(invalidTarget.facade.model.activeOutput);
  assert.throws(() => host.snapshot(targetPath), /missing snapshot/);
});

test("short-term host actions redact spaced local paths from save failures", async () => {
  const sourcePath = "/Users/designer/private/optimizable.svga";
  const outputPath = "/Users/designer/My Documents/private/optimized copy.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermOptimizableSvgaFixture()
  }, {
    writeError: (localPath) => new Error(`Cannot write ${localPath}`)
  });
  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });
  const optimized = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "runOptimization"
  });
  const saved = await dispatchShortTermHostMenuAction(optimized, host, {
    commandId: "saveAs",
    targetPath: outputPath
  });

  assert.equal(saved.lastAction?.status, "failed");
  assert.equal(saved.lastAction?.diagnostic?.code, "save_write_failed");
  assert.equal(saved.lastAction?.diagnostic?.message.includes("/Users/designer"), false);
  assert.equal(saved.lastAction?.diagnostic?.message.includes("My Documents/private"), false);
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

test("short-term host actions cancel active optimization and rename previews only", async () => {
  const sourcePath = "/Users/designer/private/optimizable.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermOptimizableSvgaFixture()
  });
  const launchCancel = cancelShortTermHostTransientWorkflow(createShortTermHostActionState());
  assert.equal(launchCancel.lastAction?.status, "blocked");
  assert.equal(launchCancel.lastAction?.diagnostic?.code, "cancel_transient_requires_open_file");

  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });
  const idleCancel = cancelShortTermHostTransientWorkflow(opened);
  assert.equal(idleCancel.lastAction?.status, "blocked");
  assert.equal(idleCancel.lastAction?.diagnostic?.code, "transient_workflow_cancel_not_needed");

  const optimized = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "runOptimization"
  });
  const optimizationCancelled = await dispatchShortTermHostMenuAction(optimized, host, {
    commandId: "cancelTransientWorkflow"
  });
  assert.equal(optimizationCancelled.lastAction?.status, "completed");
  assert.equal(optimizationCancelled.lastAction?.action, "cancelTransientWorkflow");
  assert.equal(optimizationCancelled.facade.model.activeWorkflow.kind, "optimizationCompare");
  assert.equal(optimizationCancelled.facade.model.activeWorkflow.status, "cancelled");
  assert.equal(optimizationCancelled.facade.model.activeOutput, undefined);
  assert.equal(optimizationCancelled.activeOutputBytes, undefined);
  assert.equal(commandEnabled(optimizationCancelled, "saveAs"), false);
  assert.equal(commandEnabled(optimizationCancelled, "cancelTransientWorkflow"), false);

  const failedRename = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "renameImageKey",
    fromImageKey: "missing_key",
    toImageKey: "profile_frame"
  });
  const failedCancel = cancelShortTermHostTransientWorkflow(failedRename);
  assert.equal(failedCancel.lastAction?.status, "blocked");
  assert.equal(failedCancel.lastAction?.diagnostic?.code, "transient_workflow_cancel_not_needed");

  const renamed = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "renameImageKey",
    fromImageKey: "img_frame",
    toImageKey: "profile_frame"
  });
  const renameCancelled = await dispatchShortTermHostMenuAction(renamed, host, {
    commandId: "cancelTransientWorkflow"
  });
  assert.equal(renameCancelled.lastAction?.status, "completed");
  assert.equal(renameCancelled.facade.model.activeWorkflow.kind, "renamePreview");
  assert.equal(renameCancelled.facade.model.activeWorkflow.status, "cancelled");
  assert.equal(renameCancelled.facade.model.activeOutput, undefined);
  assert.equal(renameCancelled.activeOutputBytes, undefined);
  assert.equal(commandEnabled(renameCancelled, "saveAs"), false);
  assert.equal(commandEnabled(renameCancelled, "cancelTransientWorkflow"), false);
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
  const reset = await dispatchShortTermHostMenuAction(replaced, host, {
    commandId: "resetImageReplacement"
  });

  assert.equal(reset.lastAction?.status, "completed");
  assert.equal(reset.lastAction?.action, "resetImageReplacement");
  assert.equal(reset.facade.imageReplacementSession?.model.status, "ready");
  assert.equal(reset.facade.imageReplacementSession?.model.activeReplacement, undefined);
  assert.equal(reset.facade.model.activeOutput, undefined);
  assert.equal(reset.activeOutputBytes, undefined);
  assert.equal(commandEnabled(reset, "saveAs"), false);
  assert.equal(reset.currentLocalPath, sourcePath);
});

test("short-term host menu dispatch executes every host-routed command-menu item", async () => {
  const editablePath = "/Users/designer/private/editable.svga";
  const optimizablePath = "/Users/designer/private/optimizable.svga";
  const saveSourcePath = "/Users/designer/private/save-source.svga";
  const saveAsSourcePath = "/Users/designer/private/save-as-source.svga";
  const recentPath = "/Users/designer/private/recent.svga";
  const saveAsTargetPath = "/Users/designer/private/saved-copy.svga";
  const host = createMemoryHost({
    [editablePath]: await createShortTermSvgaFixture(),
    [optimizablePath]: await createShortTermOptimizableSvgaFixture(),
    [saveSourcePath]: await createShortTermOptimizableSvgaFixture(),
    [saveAsSourcePath]: await createShortTermOptimizableSvgaFixture(),
    [recentPath]: await createShortTermSvgaFixture()
  });
  const launchWithRecent = createShortTermHostActionState({
    recentFiles: [{
      id: "recent-a",
      localPath: recentPath,
      displayName: "recent.svga",
      lastOpenedAt: "2026-07-02T00:00:00.000Z"
    }]
  });
  const hostMenuCommandIds = Array.from(new Set(
    flattenShortTermCommandMenuItems(createShortTermCommandMenuModel(launchWithRecent.facade.model.appState))
      .filter((item) => item.kind === "command" && classifyShortTermHostMenuCommand(item.id) === "host")
      .map((item) => item.id)
  )).sort();

  const openEditable = () => openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-editable",
    source: "fileButton",
    localPath: editablePath
  });
  const openOptimizable = (localPath = optimizablePath) => openShortTermHostLocalFile(
    createShortTermHostActionState(),
    host,
    {
      requestId: `open-${path.basename(localPath)}`,
      source: "fileButton",
      localPath
    }
  );
  const optimize = async (localPath = optimizablePath) => dispatchShortTermHostMenuAction(
    await openOptimizable(localPath),
    host,
    { commandId: "runOptimization" }
  );
  const replace = async () => dispatchShortTermHostMenuAction(
    await openEditable(),
    host,
    {
      commandId: "replaceImage",
      imageKey: "img_frame",
      pngBytes: createShortTermColoredPng(16, 16, [0, 0, 255, 255])
    }
  );
  const applyTextPreview = async () => {
    const opened = await openEditable();
    const prepared = prepareShortTermHostTextPreview(opened, {
      textElements: [{ textKey: "nickname", displayName: "昵称", supportedFields: ["text"] }]
    });
    return applyShortTermHostTextPreview(prepared, {
      replacement: { textKey: "nickname", fields: { text: "Alice" } }
    });
  };

  const scenarios: Record<string, () => Promise<ShortTermHostActionState>> = {
    openSvga: () => dispatchShortTermHostMenuAction(createShortTermHostActionState(), host, {
      commandId: "openSvga",
      requestId: "open-menu",
      localPath: editablePath
    }),
    "openRecent:recent-a": () => dispatchShortTermHostMenuAction(launchWithRecent, host, {
      commandId: "openRecent:recent-a"
    }),
    clearRecent: () => dispatchShortTermHostMenuAction(launchWithRecent, host, {
      commandId: "clearRecent"
    }),
    closeFile: async () => dispatchShortTermHostMenuAction(await openEditable(), host, {
      commandId: "closeFile"
    }),
    save: async () => dispatchShortTermHostMenuAction(await optimize(saveSourcePath), host, {
      commandId: "save"
    }),
    saveAs: async () => dispatchShortTermHostMenuAction(await optimize(saveAsSourcePath), host, {
      commandId: "saveAs",
      targetPath: saveAsTargetPath
    }),
    cancelTransientWorkflow: async () => dispatchShortTermHostMenuAction(await optimize(), host, {
      commandId: "cancelTransientWorkflow"
    }),
    runOptimization: async () => dispatchShortTermHostMenuAction(await openOptimizable(), host, {
      commandId: "runOptimization"
    }),
    renameImageKey: async () => dispatchShortTermHostMenuAction(await openEditable(), host, {
      commandId: "renameImageKey",
      fromImageKey: "img_frame",
      toImageKey: "profile_frame"
    }),
    replaceImage: replace,
    resetImageReplacement: async () => dispatchShortTermHostMenuAction(await replace(), host, {
      commandId: "resetImageReplacement"
    }),
    resetTextPreview: async () => dispatchShortTermHostMenuAction(await applyTextPreview(), host, {
      commandId: "resetTextPreview"
    })
  };
  const expectedActions: Record<string, string> = {
    openSvga: "openLocalFile",
    "openRecent:recent-a": "openRecentFile",
    clearRecent: "clearRecentFiles",
    closeFile: "closeFile",
    save: "save",
    saveAs: "save",
    cancelTransientWorkflow: "cancelTransientWorkflow",
    runOptimization: "runOptimization",
    renameImageKey: "renameImageKey",
    replaceImage: "replaceImage",
    resetImageReplacement: "resetImageReplacement",
    resetTextPreview: "resetTextPreview"
  };

  assert.deepEqual(hostMenuCommandIds, Object.keys(scenarios).sort());

  for (const commandId of hostMenuCommandIds) {
    const result = await scenarios[commandId]();
    assert.equal(result.lastAction?.status, "completed", commandId);
    assert.equal(result.lastAction?.action, expectedActions[commandId], commandId);
    assert.notEqual(result.lastAction?.diagnostic?.code, "menu_command_not_routed", commandId);
  }
});

test("short-term host actions block disabled or unrouted menu commands", async () => {
  const host = createMemoryHost({});
  const state = createShortTermHostActionState();

  const missingOpenContext = await dispatchShortTermHostMenuAction(state, host, {
    commandId: "openSvga"
  });
  assert.equal(missingOpenContext.lastAction?.status, "blocked");
  assert.equal(missingOpenContext.lastAction?.commandId, "openSvga");
  assert.deepEqual(missingOpenContext.lastAction?.prdIds, ["S1", "S2"]);
  assert.equal(missingOpenContext.lastAction?.diagnostic?.code, "menu_command_context_missing");
  assert.equal(missingOpenContext.facade.model.appState.state, "launch");

  const clearBlocked = await dispatchShortTermHostMenuAction(state, host, {
    commandId: "clearRecent"
  });
  assert.equal(clearBlocked.lastAction?.status, "blocked");
  assert.deepEqual(clearBlocked.lastAction?.prdIds, ["S1", "S2", "S16"]);
  assert.equal(clearBlocked.lastAction?.diagnostic?.code, "menu_command_disabled");

  const emptyRecentBlocked = await dispatchShortTermHostMenuAction(state, host, {
    commandId: "openRecent:empty"
  });
  assert.equal(emptyRecentBlocked.lastAction?.status, "blocked");
  assert.equal(emptyRecentBlocked.lastAction?.commandId, "openRecent:empty");
  assert.deepEqual(emptyRecentBlocked.lastAction?.prdIds, ["S1", "S2", "S16"]);
  assert.equal(emptyRecentBlocked.lastAction?.diagnostic?.code, "menu_command_disabled");

  const unknownBlocked = await dispatchShortTermHostMenuAction(state, host, {
    commandId: "unsupportedCommand"
  });
  assert.equal(unknownBlocked.lastAction?.status, "blocked");
  assert.deepEqual(unknownBlocked.lastAction?.prdIds, []);
  assert.equal(unknownBlocked.lastAction?.diagnostic?.code, "menu_command_disabled");
});

test("short-term host actions sanitize menu command ids before returning results", async () => {
  const host = createMemoryHost({});
  const state = createShortTermHostActionState();

  const unsafeUnknown = await dispatchShortTermHostMenuAction(state, host, {
    commandId: "/Users/designer/private/showLogs"
  });
  assert.equal(unsafeUnknown.lastAction?.status, "blocked");
  assert.equal(unsafeUnknown.lastAction?.commandId, "unsupported");
  assert.equal(JSON.stringify(unsafeUnknown.lastAction).includes("/Users/designer"), false);
  assert.equal(JSON.stringify(unsafeUnknown.lastAction).includes("designer"), false);

  const unsafeRecent = await dispatchShortTermHostMenuAction(state, host, {
    commandId: "openRecent:/Users/designer/private/recent.svga"
  });
  assert.equal(unsafeRecent.lastAction?.status, "blocked");
  assert.equal(unsafeRecent.lastAction?.commandId, "openRecent");
  assert.equal(JSON.stringify(unsafeRecent.lastAction).includes("/Users/designer"), false);
  assert.equal(JSON.stringify(unsafeRecent.lastAction).includes("designer"), false);
});

test("short-term host actions fail closed for malformed runtime menu command ids", async () => {
  const host = createMemoryHost({});
  const state = createShortTermHostActionState();

  const missing = await dispatchShortTermHostMenuAction(
    state,
    host,
    {} as unknown as ShortTermHostMenuActionInput
  );
  assert.equal(missing.lastAction?.status, "blocked");
  assert.equal(missing.lastAction?.commandId, "unsupported");
  assert.equal(missing.lastAction?.diagnostic?.code, "menu_command_id_invalid");
  assert.equal(missing.facade.model.appState.state, "launch");

  const nullInput = await dispatchShortTermHostMenuAction(
    state,
    host,
    null as unknown as ShortTermHostMenuActionInput
  );
  assert.equal(nullInput.lastAction?.status, "blocked");
  assert.equal(nullInput.lastAction?.commandId, "unsupported");
  assert.equal(nullInput.lastAction?.diagnostic?.code, "menu_command_id_invalid");
  assert.equal(nullInput.facade.model.appState.state, "launch");

  const undefinedInput = await dispatchShortTermHostMenuAction(
    state,
    host,
    undefined as unknown as ShortTermHostMenuActionInput
  );
  assert.equal(undefinedInput.lastAction?.status, "blocked");
  assert.equal(undefinedInput.lastAction?.commandId, "unsupported");
  assert.equal(undefinedInput.lastAction?.diagnostic?.code, "menu_command_id_invalid");
  assert.equal(undefinedInput.facade.model.appState.state, "launch");

  const nonString = await dispatchShortTermHostMenuAction(
    state,
    host,
    { commandId: 42 } as unknown as ShortTermHostMenuActionInput
  );
  assert.equal(nonString.lastAction?.status, "blocked");
  assert.equal(nonString.lastAction?.commandId, "unsupported");
  assert.equal(nonString.lastAction?.diagnostic?.code, "menu_command_id_invalid");

  const trimmedValid = await dispatchShortTermHostMenuAction(state, host, {
    commandId: " copy "
  });
  assert.equal(trimmedValid.lastAction?.status, "delegated");
  assert.equal(trimmedValid.lastAction?.commandId, "copy");
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
  assert.deepEqual(copied.lastAction?.prdIds, []);
  assert.equal(copied.lastAction?.diagnostic?.code, "menu_command_delegated_to_native");
  assert.equal(copied.facade.model.appState.state, "launch");

  const help = await dispatchShortTermHostMenuAction(launch, host, {
    commandId: "help"
  });
  assert.equal(help.lastAction?.status, "delegated");
  assert.deepEqual(help.lastAction?.prdIds, []);
  assert.equal(help.lastAction?.diagnostic?.code, "menu_command_delegated_to_renderer");

  const logs = await dispatchShortTermHostMenuAction(launch, host, {
    commandId: "showLogs"
  });
  assert.equal(logs.lastAction?.status, "delegated");
  assert.deepEqual(logs.lastAction?.prdIds, []);
  assert.equal(logs.lastAction?.diagnostic?.code, "menu_command_delegated_to_renderer");

  const playBlocked = await dispatchShortTermHostMenuAction(launch, host, {
    commandId: "playPause"
  });
  assert.equal(playBlocked.lastAction?.status, "blocked");
  assert.deepEqual(playBlocked.lastAction?.prdIds, ["S2"]);
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
  assert.deepEqual(played.lastAction?.prdIds, ["S2"]);
  assert.equal(played.lastAction?.diagnostic?.code, "menu_command_delegated_to_renderer");
  assert.equal(played.currentLocalPath, sourcePath);

  const textPreview = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "editTextPreview"
  });
  assert.equal(textPreview.lastAction?.status, "delegated");
  assert.deepEqual(textPreview.lastAction?.prdIds, ["S13"]);
  assert.equal(textPreview.lastAction?.diagnostic?.code, "menu_command_delegated_to_renderer");
  assert.equal(textPreview.currentLocalPath, sourcePath);

  const minimized = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "minimize"
  });
  assert.equal(minimized.lastAction?.status, "delegated");
  assert.deepEqual(minimized.lastAction?.prdIds, []);
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
    commandId: "openRecent:recent-a",
    requestId: 42,
    source: "unsupported-source"
  });

  assert.equal(opened.lastAction?.status, "completed");
  assert.equal(opened.facade.model.appState.state, "previewReady");
  assert.equal(opened.facade.model.appState.currentFile?.openedFrom, "recentMenu");
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
  });

  assert.equal(renameBlocked.lastAction?.status, "blocked");
  assert.equal(renameBlocked.lastAction?.commandId, "renameImageKey");
  assert.deepEqual(renameBlocked.lastAction?.prdIds, ["S11", "S14"]);
  assert.equal(renameBlocked.lastAction?.diagnostic?.code, "menu_command_context_missing");
  assert.equal(renameBlocked.facade.model.appState.state, "previewReady");
  assert.equal(renameBlocked.currentLocalPath, sourcePath);
  assert.equal(renameBlocked.activeOutputBytes, undefined);

  const replaceBlocked = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "replaceImage",
    imageKey: "img_frame"
  });

  assert.equal(replaceBlocked.lastAction?.status, "blocked");
  assert.equal(replaceBlocked.lastAction?.commandId, "replaceImage");
  assert.deepEqual(replaceBlocked.lastAction?.prdIds, ["S12", "S14"]);
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
    writeError?: (localPath: string) => Error;
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
      const writeError = options.writeError?.(localPath);
      if (writeError) throw writeError;
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

function inspectionFixtureWithLocalPath(localPath: string): ShortTermProductInspectionModel {
  return {
    ...inspectionFixture(),
    overview: {
      ...inspectionFixture().overview,
      profileLabel: `Loaded from ${localPath}`,
      facts: [{
        id: "fileSize",
        label: "文件大小",
        value: `Source ${localPath}`,
        requirement: `<= ${localPath}`,
        status: "pass",
        copyable: true
      }],
      audioGroup: {
        status: "detected",
        copy: `Audio source ${localPath}`,
        count: 1
      }
    },
    assets: [{
      id: "img_frame",
      kind: "image",
      name: `Image from ${localPath}`,
      role: "static_image",
      thumbnail: {
        type: "image",
        resourceIds: ["img_frame"]
      },
      dimensions: "256 x 256",
      fileSize: "1 KiB",
      usageCount: 1,
      replaceable: true,
      findingCodes: [`from-${localPath}`]
    }],
    replaceableElements: {
      images: [{
        index: 0,
        imageKey: `key-${localPath}`,
        resourceId: "img_frame",
        dimensions: "256 x 256",
        fileSize: "1 KiB",
        usageCount: 1
      }],
      texts: [],
      emptyCopy: `Empty ${localPath}`,
      textPreviewCopy: `Preview ${localPath}`
    },
    optimization: {
      ...inspectionFixture().optimization,
      batchActionLabel: `Optimize ${localPath}`,
      items: [{
        code: `code-${localPath}`,
        title: `Title ${localPath}`,
        summary: `Summary ${localPath}`,
        disposition: "safeExecutable",
        enabled: true,
        estimatedFileSizeImpact: "1 KiB",
        estimatedDecodedMemoryImpact: "2 KiB",
        affectedResourceIds: [`affected-${localPath}`],
        evidenceRefs: [`evidence-${localPath}`]
      }]
    }
  };
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
