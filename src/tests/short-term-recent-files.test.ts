import assert from "node:assert/strict";
import test from "node:test";
import {
  addShortTermRecentFile,
  clearShortTermRecentFiles,
  createShortTermRecentFilesState,
  createShortTermRecentFilesViewModel,
  markShortTermRecentFileMissing,
  parseShortTermRecentFilesStateJson,
  resolveShortTermRecentOpen,
  serializeShortTermRecentFilesState,
  SHORT_TERM_MAX_LAUNCH_RECENT_FILES,
  SHORT_TERM_MAX_MENU_RECENT_FILES,
  SHORT_TERM_RECENT_FILES_STORAGE_KEY
} from "../workbench/short-term-recent-files.js";
import {
  createShortTermLaunchAppState,
  markShortTermRecentFileMissing as markAppRecentFileMissing,
  startShortTermLocalOpen
} from "../workbench/short-term-app-state.js";

test("short-term recent files create path-redacted renderer view records", () => {
  const state = createShortTermRecentFilesState([
    {
      localPath: "/Users/designer/Secret Project/profile_frame.svga",
      lastOpenedAt: "2026-07-02T00:00:00.000Z"
    }
  ]);
  const view = createShortTermRecentFilesViewModel(state);

  assert.equal(SHORT_TERM_RECENT_FILES_STORAGE_KEY, "auto-svga.short-term.recent-files.v1");
  assert.equal(view.schemaVersion, 1);
  assert.deepEqual(view.prdIds, ["S16"]);
  assert.equal(view.launchRecentFiles.length, 1);
  assert.equal(view.launchRecentFiles[0].displayName, "profile_frame.svga");
  assert.equal(view.launchRecentFiles[0].parentDisplayName, "Secret Project");
  assert.equal(view.launchRecentFiles[0].pathRedacted, true);
  assert.equal(view.launchRecentFiles[0].rendererHasFullPath, false);
  assert.equal(JSON.stringify(view).includes("/Users/designer"), false);
});

test("short-term recent files sanitize path-like display inputs", () => {
  const state = createShortTermRecentFilesState([
    {
      localPath: "/Users/designer/Secret Project/profile_frame.svga",
      displayName: "/Users/designer/Secret Project/unsafe_display.svga",
      parentDisplayName: "/Users/designer/Secret Project",
      lastOpenedAt: "2026-07-02T00:00:00.000Z"
    }
  ]);
  const view = createShortTermRecentFilesViewModel(state);

  assert.equal(state.records[0].displayName, "unsafe_display.svga");
  assert.equal(state.records[0].parentDisplayName, "Secret Project");
  assert.equal(view.launchRecentFiles[0].displayName, "unsafe_display.svga");
  assert.equal(view.launchRecentFiles[0].parentDisplayName, "Secret Project");
  assert.equal(JSON.stringify(view).includes("/Users/designer"), false);
});

test("short-term recent files cap launch at five and menu at ten", () => {
  const state = createShortTermRecentFilesState(
    Array.from({ length: 12 }, (_, index) => ({
      localPath: `/Users/designer/frames/asset_${index}.svga`,
      lastOpenedAt: `2026-07-02T00:${String(index).padStart(2, "0")}:00.000Z`
    }))
  );
  const view = createShortTermRecentFilesViewModel(state);

  assert.equal(state.records.length, SHORT_TERM_MAX_MENU_RECENT_FILES);
  assert.equal(view.launchRecentFiles.length, SHORT_TERM_MAX_LAUNCH_RECENT_FILES);
  assert.equal(view.menuRecentFiles.length, SHORT_TERM_MAX_MENU_RECENT_FILES);
  assert.equal(view.launchRecentFiles[0].displayName, "asset_11.svga");
  assert.equal(view.menuRecentFiles.at(-1)?.displayName, "asset_2.svga");
});

test("short-term recent files de-duplicate by local path and promote reopened files", () => {
  const state = createShortTermRecentFilesState([
    {
      localPath: "/Users/designer/frames/a.svga",
      lastOpenedAt: "2026-07-02T00:00:00.000Z"
    },
    {
      localPath: "/Users/designer/frames/b.svga",
      lastOpenedAt: "2026-07-02T00:01:00.000Z"
    }
  ]);
  const next = addShortTermRecentFile(
    state,
    {
      localPath: "/Users/designer/frames/a.svga",
      lastOpenedAt: "2026-07-02T00:02:00.000Z"
    }
  );

  assert.equal(next.records.length, 2);
  assert.equal(next.records[0].displayName, "a.svga");
  assert.equal(next.records[0].lastOpenedAt, "2026-07-02T00:02:00.000Z");
  assert.equal(next.records[1].displayName, "b.svga");
});

test("short-term recent files resolve recent open requests for the shared loading flow", () => {
  const state = createShortTermRecentFilesState([
    {
      id: "recent-profile",
      localPath: "/Users/designer/private/profile.svga",
      lastOpenedAt: "2026-07-02T00:00:00.000Z"
    }
  ]);
  const resolved = resolveShortTermRecentOpen(state, "recent-profile", "recentMenu", "request-1");
  assert.equal(resolved.status, "ready");
  assert.equal(resolved.request.source, "recentMenu");
  assert.equal(resolved.request.displayName, "profile.svga");
  assert.equal(resolved.request.localPath, "/Users/designer/private/profile.svga");

  const appState = startShortTermLocalOpen(
    createShortTermLaunchAppState({
      recentFiles: createShortTermRecentFilesViewModel(state).launchRecentFiles
    }),
    resolved.request
  );

  assert.equal(appState.state, "loading");
  assert.equal(appState.loading?.source, "recentMenu");
  assert.equal(appState.loading?.recentFileId, "recent-profile");
  assert.equal(appState.loading?.displayName, "profile.svga");
});

test("short-term recent files surface missing records without stale file metadata", () => {
  const state = createShortTermRecentFilesState([
    {
      id: "missing-profile",
      localPath: "/Users/designer/private/missing.svga",
      lastOpenedAt: "2026-07-02T00:00:00.000Z"
    }
  ]);
  const missingState = markShortTermRecentFileMissing(state, "missing-profile");
  const view = createShortTermRecentFilesViewModel(missingState, "missing");
  const resolved = resolveShortTermRecentOpen(missingState, "missing-profile", "recentLaunch", "request-2");

  assert.equal(view.launchRecentFiles[0].availability, "missing");
  assert.match(view.statusCopy, /缺失或不可访问/);
  assert.equal(resolved.status, "missing");
  assert.equal(resolved.displayName, "missing.svga");

  const appState = markAppRecentFileMissing(
    createShortTermLaunchAppState({ recentFiles: view.launchRecentFiles }),
    "missing-profile"
  );
  assert.equal(appState.state, "recentFileMissing");
  assert.equal(appState.currentFile, undefined);
  assert.equal(appState.staleFileDataCleared, true);
});

test("short-term recent files clear records without touching source-file metadata", () => {
  const state = createShortTermRecentFilesState([
    {
      localPath: "/Users/designer/private/profile.svga",
      lastOpenedAt: "2026-07-02T00:00:00.000Z"
    }
  ]);
  const cleared = clearShortTermRecentFiles();
  const view = createShortTermRecentFilesViewModel(cleared, "cleared");

  assert.equal(state.records.length, 1);
  assert.equal(cleared.records.length, 0);
  assert.equal(view.clearActionEnabled, false);
  assert.match(view.statusCopy, /源文件不会被删除/);
});

test("short-term recent files storage round-trips host state and keeps view payload redacted", () => {
  const state = createShortTermRecentFilesState([
    {
      localPath: "/Users/designer/private/profile.svga",
      lastOpenedAt: "2026-07-02T00:00:00.000Z"
    }
  ]);
  const serialized = serializeShortTermRecentFilesState(state);
  const parsed = parseShortTermRecentFilesStateJson(serialized);
  const fallback = parseShortTermRecentFilesStateJson("{", [
    {
      localPath: "/Users/designer/fallback/fallback.svga",
      lastOpenedAt: "2026-07-02T00:01:00.000Z"
    }
  ]);

  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].localPath, "/Users/designer/private/profile.svga");
  assert.equal(fallback.records[0].displayName, "fallback.svga");
  assert.equal(JSON.stringify(createShortTermRecentFilesViewModel(parsed)).includes("/Users/designer"), false);
});
