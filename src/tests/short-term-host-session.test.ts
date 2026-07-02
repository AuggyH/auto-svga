import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createShortTermHostSession } from "../workbench/short-term-host-session.js";
import type { ShortTermHostEnvironment } from "../workbench/short-term-host-actions.js";
import type { ShortTermProductInspectionModel } from "../workbench/short-term-product-model.js";
import type { ShortTermRecentFilesStore } from "../workbench/short-term-host-recent-persistence.js";
import {
  clearShortTermRecentFiles,
  createShortTermRecentFilesState,
  type ShortTermRecentFileInput,
  type ShortTermRecentFilesState
} from "../workbench/short-term-recent-files.js";
import {
  createShortTermOptimizableSvgaFixture,
  createShortTermSvgaFixture
} from "./helpers/short-term-svga-fixtures.js";

test("short-term host session persists recent changes after open and clear actions", async () => {
  const sourcePath = "/Users/designer/private/opened.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermSvgaFixture()
  });
  const store = createMemoryRecentFilesStore();
  const session = await createShortTermHostSession({ host, recentStore: store });

  const opened = await session.openLocalFile({
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });

  assert.equal(opened.actionResult?.status, "completed");
  assert.equal(opened.recentPersistence.status, "saved");
  assert.equal(store.snapshot().records[0].localPath, sourcePath);
  assert.equal(JSON.stringify(opened.state.facade.model).includes("/Users/designer"), false);

  const cleared = await session.dispatchMenuAction({
    commandId: "clearRecent"
  });

  assert.equal(cleared.actionResult?.status, "completed");
  assert.equal(cleared.recentPersistence.status, "saved");
  assert.equal(store.snapshot().records.length, 0);
});

test("short-term host session records missing recent files and persists that state", async () => {
  const missingPath = "/Users/designer/private/missing.svga";
  const host = createMemoryHost({}, {
    exists: () => false
  });
  const store = createMemoryRecentFilesStore([{
    id: "recent-missing",
    localPath: missingPath,
    lastOpenedAt: "2026-07-02T00:00:00.000Z"
  }]);
  const session = await createShortTermHostSession({ host, recentStore: store });

  assert.equal(session.getState().facade.model.recentFiles.launchRecentFiles.length, 1);

  const opened = await session.openRecentFile({
    requestId: "recent-open-1",
    recentFileId: "recent-missing",
    source: "recentLaunch"
  });

  assert.equal(opened.actionResult?.status, "failed");
  assert.equal(opened.actionResult?.diagnostic?.code, "recent_file_missing");
  assert.equal(opened.recentPersistence.status, "saved");
  assert.equal(store.snapshot().records[0].availability, "missing");
  assert.equal(JSON.stringify(opened.state.facade.model).includes("/Users/designer"), false);
});

test("short-term host session leaves successful actions intact when recent persistence fails", async () => {
  const sourcePath = "/Users/designer/private/opened.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermSvgaFixture()
  });
  const store = createMemoryRecentFilesStore([], {
    saveError: () => new Error("Cannot write /Users/designer/private/recent.json")
  });
  const session = await createShortTermHostSession({ host, recentStore: store });

  const opened = await session.openLocalFile({
    requestId: "open-1",
    source: "menuOpen",
    localPath: sourcePath
  });

  assert.equal(opened.actionResult?.status, "completed");
  assert.equal(opened.state.facade.model.appState.state, "previewReady");
  assert.equal(opened.recentPersistence.status, "failed");
  assert.equal(opened.recentPersistence.diagnostic?.code, "recent_files_persist_failed");
  assert.equal(opened.recentPersistence.diagnostic?.message.includes("/Users/designer"), false);

  store.setSaveError(undefined);
  const retry = await session.persistRecentFiles();

  assert.equal(retry.status, "saved");
  assert.equal(store.snapshot().records[0].localPath, sourcePath);
});

test("short-term host session blocks dirty close and keeps session state until discard is confirmed", async () => {
  const sourcePath = "/Users/designer/private/opened.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermOptimizableSvgaFixture()
  });
  const store = createMemoryRecentFilesStore();
  const session = await createShortTermHostSession({ host, recentStore: store });

  await session.openLocalFile({
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });
  const optimized = await session.dispatchMenuAction({
    commandId: "runOptimization"
  });

  assert.equal(optimized.actionResult?.status, "completed");
  assert.ok(optimized.state.activeOutputBytes);

  const blocked = await session.dispatchMenuAction({
    commandId: "closeFile"
  });

  assert.equal(blocked.actionResult?.status, "blocked");
  assert.equal(blocked.actionResult?.diagnostic?.code, "close_requires_discard_confirmation");
  assert.equal(blocked.recentPersistence.status, "unchanged");
  assert.equal(blocked.state.facade.model.appState.state, "previewReady");
  assert.equal(blocked.state.currentLocalPath, sourcePath);
  assert.ok(blocked.state.activeOutputBytes);

  const closed = await session.dispatchMenuAction({
    commandId: "closeFile",
    discardUnsavedChanges: true
  });

  assert.equal(closed.actionResult?.status, "completed");
  assert.equal(closed.recentPersistence.status, "unchanged");
  assert.equal(closed.state.facade.model.appState.state, "launch");
  assert.equal(closed.state.currentLocalPath, undefined);
  assert.equal(closed.state.activeOutputBytes, undefined);
});

function createMemoryHost(
  initialFiles: Record<string, Uint8Array>,
  options: {
    exists?: (localPath: string) => boolean;
  } = {}
): ShortTermHostEnvironment {
  const files = new Map(Object.entries(initialFiles).map(([key, value]) => [key, new Uint8Array(value)]));
  return {
    async readLocalFile(localPath) {
      const bytes = files.get(localPath);
      if (!bytes) throw new Error("File is missing.");
      return {
        bytes: new Uint8Array(bytes),
        displayName: path.basename(localPath)
      };
    },
    async inspectSvga() {
      return inspectionFixture();
    },
    async writeLocalFile(localPath, bytes) {
      files.set(localPath, new Uint8Array(bytes));
    },
    async readSavedFile(localPath) {
      const bytes = files.get(localPath);
      if (!bytes) throw new Error("Saved file is missing.");
      return new Uint8Array(bytes);
    },
    async fileExists(localPath) {
      return options.exists ? options.exists(localPath) : files.has(localPath);
    }
  };
}

function createMemoryRecentFilesStore(
  initialRecords: readonly ShortTermRecentFileInput[] = [],
  options: { saveError?: () => Error } = {}
): ShortTermRecentFilesStore & {
  snapshot(): ShortTermRecentFilesState;
  setSaveError(saveError: (() => Error) | undefined): void;
} {
  let state = createShortTermRecentFilesState(initialRecords, {
    now: "2026-07-02T00:00:00.000Z"
  });
  let saveError = options.saveError;
  return {
    async load() {
      return state;
    },
    async save(nextState) {
      const error = saveError?.();
      if (error) throw error;
      state = nextState;
    },
    async clear() {
      state = clearShortTermRecentFiles({
        now: "2026-07-02T00:00:00.000Z"
      });
      return state;
    },
    snapshot() {
      return state;
    },
    setSaveError(nextSaveError) {
      saveError = nextSaveError;
    }
  };
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
