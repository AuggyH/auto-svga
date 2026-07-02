import assert from "node:assert/strict";
import test from "node:test";
import {
  attachShortTermPersistedOutput,
  completeShortTermLocalOpen,
  createShortTermLaunchAppState,
  failShortTermLocalOpen,
  markShortTermRecentFileMissing,
  recoverShortTermPlayback,
  reportShortTermPlaybackFailure,
  startShortTermLocalOpen,
  type ShortTermOpenSource
} from "../workbench/short-term-app-state.js";
import type { ShortTermProductInspectionModel } from "../workbench/short-term-product-model.js";
import { createShortTermPersistedOutputRecord } from "../workbench/short-term-save-state.js";

test("short-term app state starts at launch with file entry points enabled", () => {
  const state = createShortTermLaunchAppState({
    recentFiles: [
      { id: "recent-1", displayName: "/Users/designer/private/avatar.svga", lastOpenedAt: "2026-07-02T00:00:00.000Z" }
    ]
  });

  assert.equal(state.schemaVersion, 1);
  assert.deepEqual(state.prdIds, ["S1", "S2", "S16"]);
  assert.equal(state.state, "launch");
  assert.equal(state.staleFileDataCleared, true);
  assert.equal(state.recentFiles[0].displayName, "avatar.svga");
  assert.equal(commandEnabled(state, "openSvga"), true);
  assert.equal(commandEnabled(state, "openRecent"), true);
  assert.equal(commandEnabled(state, "playPause"), false);
  assert.equal(commandEnabled(state, "replaceImage"), false);
});

test("short-term app state sanitizes path-like display labels across platforms", () => {
  const launch = createShortTermLaunchAppState({
    recentFiles: [
      {
        id: "recent-win",
        displayName: "C:\\Users\\designer\\secret\\frame.svga",
        lastOpenedAt: "2026-07-02T00:00:00.000Z"
      }
    ]
  });
  const loadingFromDisplayName = startShortTermLocalOpen(launch, {
    requestId: "open-win-display",
    source: "menuOpen",
    displayName: "D:\\Users\\designer\\secret\\opened.svga"
  });
  const loadingFromLocalPath = startShortTermLocalOpen(launch, {
    requestId: "open-win-path",
    source: "menuOpen",
    localPath: "E:\\Users\\designer\\secret\\fallback.svga"
  });
  const missing = markShortTermRecentFileMissing(launch, "recent-win");

  assert.equal(launch.recentFiles[0].displayName, "frame.svga");
  assert.equal(loadingFromDisplayName.loading?.displayName, "opened.svga");
  assert.equal(loadingFromLocalPath.loading?.displayName, "fallback.svga");
  assert.equal(missing.failure?.title, "frame.svga 无法打开");
  assert.equal(JSON.stringify({ launch, loadingFromDisplayName, loadingFromLocalPath, missing }).includes("Users"), false);
});

test("short-term app state routes file button, drag, menu, and recent opens through loading", () => {
  for (const source of ["fileButton", "dragDrop", "menuOpen", "recentLaunch", "recentMenu"] as ShortTermOpenSource[]) {
    const state = startShortTermLocalOpen(
      createShortTermLaunchAppState(),
      {
        requestId: `request-${source}`,
        source,
        localPath: `/Users/designer/private/${source}.svga`,
        ...(source.startsWith("recent") ? { recentFileId: "recent-1" } : {})
      }
    );

    assert.equal(state.state, "loading");
    assert.equal(state.loading?.source, source);
    assert.equal(state.loading?.displayName, `${source}.svga`);
    assert.equal(state.currentFile, undefined);
    assert.equal(state.staleFileDataCleared, true);
  }
});

test("short-term app state completes loading with a redacted preview-ready file", () => {
  const loading = startShortTermLocalOpen(
    createShortTermLaunchAppState(),
    {
      requestId: "open-1",
      source: "menuOpen",
      localPath: "/Users/designer/private/profile.svga"
    }
  );

  const ready = completeShortTermLocalOpen(loading, {
    requestId: "open-1",
    inspection: inspectionFixture()
  });

  assert.equal(ready.state, "previewReady");
  assert.equal(ready.currentFile?.displayName, "profile.svga");
  assert.equal(ready.currentFile?.openedFrom, "menuOpen");
  assert.equal(ready.currentFile?.pathRedacted, true);
  assert.equal(ready.currentFile?.rendererHasFullPath, false);
  assert.equal(ready.loading, undefined);
  assert.equal(ready.failure, undefined);
  assert.equal(commandEnabled(ready, "playPause"), true);
  assert.equal(commandEnabled(ready, "renameImageKey"), true);
});

test("short-term app state shows parse failure without stale file data and recovers through new loading", () => {
  const loading = startShortTermLocalOpen(createShortTermLaunchAppState(), {
    requestId: "bad-1",
    source: "dragDrop",
    displayName: "broken.svga"
  });
  const failed = failShortTermLocalOpen(loading, {
    requestId: "bad-1",
    kind: "parse",
    message: "无法解析 SVGA。"
  });

  assert.equal(failed.state, "loadFailed");
  assert.equal(failed.currentFile, undefined);
  assert.equal(failed.failure?.title, "SVGA 解析失败");
  assert.deepEqual(failed.failure?.recoveryActions, ["openFile", "dragFile", "menuOpen"]);
  assert.equal(failed.staleFileDataCleared, true);

  const retry = startShortTermLocalOpen(failed, {
    requestId: "good-1",
    source: "fileButton",
    displayName: "good.svga"
  });

  assert.equal(retry.state, "loading");
  assert.equal(retry.loading?.displayName, "good.svga");
});

test("short-term app state ignores stale load failures after a newer preview is ready", () => {
  const loading = startShortTermLocalOpen(createShortTermLaunchAppState(), {
    requestId: "old-open",
    source: "fileButton",
    displayName: "old.svga"
  });
  const ready = completeShortTermLocalOpen(loading, {
    requestId: "old-open",
    inspection: inspectionFixture()
  });
  const staleFailure = failShortTermLocalOpen(ready, {
    requestId: "old-open",
    kind: "read",
    message: "旧请求失败。"
  });

  assert.equal(staleFailure, ready);
  assert.equal(staleFailure.state, "previewReady");
  assert.ok(staleFailure.currentFile);
});

test("short-term app state keeps canvas context for playback abnormal and returns to ready", () => {
  const ready = completeShortTermLocalOpen(
    startShortTermLocalOpen(createShortTermLaunchAppState(), {
      requestId: "open-1",
      source: "fileButton",
      displayName: "play.svga"
    }),
    {
      requestId: "open-1",
      inspection: inspectionFixture()
    }
  );
  const abnormal = reportShortTermPlaybackFailure(ready, { message: "播放器首帧渲染失败。" });

  assert.equal(abnormal.state, "playbackAbnormal");
  assert.equal(abnormal.currentFile?.displayName, "play.svga");
  assert.equal(abnormal.failure?.kind, "playback");
  assert.equal(commandEnabled(abnormal, "replay"), true);
  assert.equal(commandEnabled(abnormal, "playPause"), false);

  const recovered = recoverShortTermPlayback(abnormal);
  assert.equal(recovered.state, "previewReady");
  assert.equal(recovered.currentFile?.displayName, "play.svga");
  assert.equal(recovered.failure, undefined);
});

test("short-term app state marks missing recent files without exposing stale metadata", () => {
  const launch = createShortTermLaunchAppState({
    recentFiles: [
      { id: "missing-1", displayName: "/Users/designer/private/missing.svga", lastOpenedAt: "2026-07-02T00:00:00.000Z" }
    ]
  });
  const missing = markShortTermRecentFileMissing(launch, "missing-1");

  assert.equal(missing.state, "recentFileMissing");
  assert.equal(missing.failure?.kind, "missing");
  assert.equal(missing.failure?.title, "missing.svga 无法打开");
  assert.equal(missing.currentFile, undefined);
  assert.equal(missing.staleFileDataCleared, true);
  assert.equal(commandEnabled(missing, "openRecent"), true);
});

test("short-term app state derives save menu availability from persisted output", () => {
  const ready = completeShortTermLocalOpen(
    startShortTermLocalOpen(createShortTermLaunchAppState(), {
      requestId: "open-1",
      source: "fileButton",
      displayName: "save.svga"
    }),
    {
      requestId: "open-1",
      inspection: inspectionFixture()
    }
  );
  const persistedOutput = createShortTermPersistedOutputRecord({
    outputKind: "image_replacement_svga",
    operationId: "test-output",
    sourceName: "save.svga",
    sourceSha256: "source-hash",
    outputBytes: new Uint8Array([1, 2, 3, 4]),
    sourceUnchanged: true,
    validationPassed: true
  });

  assert.equal(commandEnabled(ready, "save"), false);
  assert.equal(commandEnabled(ready, "saveAs"), false);

  const dirty = attachShortTermPersistedOutput(ready, persistedOutput);
  assert.equal(dirty.persistedOutput?.outputKind, "image_replacement_svga");
  assert.equal(commandEnabled(dirty, "save"), true);
  assert.equal(commandEnabled(dirty, "saveAs"), true);

  persistedOutput.saveState.saveAsEnabled = false;
  persistedOutput.validationRefs = ["validation:mutatedAfterAttach"];
  assert.equal(dirty.persistedOutput?.saveState.saveAsEnabled, true);
  assert.deepEqual(dirty.persistedOutput?.validationRefs, []);

  const nextOpen = startShortTermLocalOpen(dirty, {
    requestId: "open-2",
    source: "menuOpen",
    displayName: "next.svga"
  });
  assert.equal(nextOpen.persistedOutput, undefined);
  assert.equal(commandEnabled(nextOpen, "save"), false);
});

function commandEnabled(state: { commands: readonly { id: string; enabled: boolean }[] }, id: string): boolean {
  const command = state.commands.find((item) => item.id === id);
  assert.ok(command, `missing command ${id}`);
  return command.enabled;
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
