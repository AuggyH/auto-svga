import assert from "node:assert/strict";
import test from "node:test";

import {
  RECENT_STORAGE_KEY,
  addRecentFile,
  clearRecentFileRecords,
  createRecentFileRecord,
  createShortTermCommandModel,
  createShortTermMenuModel,
  getLaunchRecentFiles,
  getMenuRecentFiles,
  getRecentStatusCopy,
  normalizeRecentFiles,
  readRecentFilesFromStorage,
  writeRecentFilesToStorage
} from "./short-term-product-state.mjs";

test("recent file records redact full local paths and keep display-safe fields", () => {
  const record = createRecentFileRecord({
    path: "/Users/designer/Secret Project/profile_frame.svga",
    fullPath: "/should/not/be/exposed.svga",
    filePath: "/also/hidden.svga"
  }, { now: 100 });

  assert.deepEqual(record, {
    id: "secret-project-profile_frame.svga",
    sourceId: "secret-project-profile_frame.svga",
    name: "profile_frame.svga",
    parent: "Secret Project",
    time: "刚刚",
    lastOpenedAt: 100,
    missing: false
  });
  assert.equal(Object.hasOwn(record, "path"), false);
  assert.equal(Object.hasOwn(record, "fullPath"), false);
  assert.equal(Object.hasOwn(record, "filePath"), false);
});

test("recent file lists cap launch at five and menu at ten", () => {
  const files = Array.from({ length: 12 }, (_, index) => ({
    sourceId: `file-${index}`,
    name: `asset_${index}.svga`,
    parent: "Fixtures",
    time: "刚刚",
    lastOpenedAt: 100 - index
  }));
  const normalized = normalizeRecentFiles(files);

  assert.equal(normalized.length, 10);
  assert.equal(getLaunchRecentFiles(normalized).length, 5);
  assert.equal(getMenuRecentFiles(normalized).length, 10);
  assert.equal(getLaunchRecentFiles(normalized)[0].name, "asset_0.svga");
});

test("adding a recent file de-duplicates and promotes reopened files", () => {
  const files = normalizeRecentFiles([
    { sourceId: "a", name: "a.svga", parent: "A", time: "昨天", lastOpenedAt: 1 },
    { sourceId: "b", name: "b.svga", parent: "B", time: "昨天", lastOpenedAt: 2 }
  ]);
  const next = addRecentFile(files, { sourceId: "a", name: "a.svga", parent: "A", time: "昨天", lastOpenedAt: 1 }, { now: 200 });

  assert.equal(next.length, 2);
  assert.equal(next[0].sourceId, "a");
  assert.equal(next[0].time, "刚刚");
  assert.equal(next[0].lastOpenedAt, 200);
  assert.equal(next[1].sourceId, "b");
});

test("recent file storage round-trips sanitized data and supports explicit clear", () => {
  const storage = createMemoryStorage();
  const files = addRecentFile([], {
    path: "/Users/designer/Private/avatar.svga",
    sourceId: "opaque-host-id"
  }, { now: 300 });

  writeRecentFilesToStorage(storage, files);
  assert.equal(storage.getItem(RECENT_STORAGE_KEY).includes("/Users/designer"), false);
  assert.equal(readRecentFilesFromStorage(storage).length, 1);

  writeRecentFilesToStorage(storage, clearRecentFileRecords());
  assert.deepEqual(readRecentFilesFromStorage(storage, [{ name: "fallback.svga" }]), []);
});

test("recent status copy and command model expose product-safe disabled reasons", () => {
  assert.match(getRecentStatusCopy("ready"), /不展示完整本地路径/);
  assert.match(getRecentStatusCopy("missing"), /缺失或不可访问/);
  assert.match(getRecentStatusCopy("cleared"), /源文件不会被删除/);

  const emptyCommands = createShortTermCommandModel({ hasFile: false, recentFiles: [] });
  assert.equal(emptyCommands.openSvga.enabled, true);
  assert.equal(emptyCommands.compare.enabled, false);
  assert.equal(emptyCommands.clearRecent.enabled, false);
  assert.match(emptyCommands.saveAs.disabledReason, /没有可保存/);

  const dirtyCommands = createShortTermCommandModel({
    hasFile: true,
    selectedImageKey: "profile_frame",
    dirtyKind: "rename",
    saveStatus: "idle",
    recentFiles: [{ name: "a.svga", parent: "A" }],
    hasSafeOptimizationCandidates: true
  });
  assert.equal(dirtyCommands.renameImageKey.enabled, true);
  assert.equal(dirtyCommands.runOptimization.enabled, true);
  assert.equal(dirtyCommands.saveAs.enabled, true);
  assert.equal(dirtyCommands.overwriteSave.enabled, true);
});

test("short-term menu model covers allowed groups without deferred workflow commands", () => {
  const menuModel = createShortTermMenuModel({
    hasFile: true,
    selectedImageKey: "profile_frame",
    hasRuntimeReplacement: true,
    dirtyKind: "optimization",
    hasSafeOptimizationCandidates: true,
    hasOptimizationOutput: true,
    recentFiles: [{ sourceId: "recent-a", name: "recent_a.svga", parent: "A" }]
  });
  const labels = JSON.stringify(menuModel);

  assert.deepEqual(menuModel.map((menu) => menu.id), [
    "app",
    "file",
    "edit",
    "view",
    "playback",
    "resource",
    "optimize",
    "window",
    "help"
  ]);
  assert.match(labels, /打开 SVGA/);
  assert.match(labels, /最近打开 \(1\)/);
  assert.match(labels, /重命名 imageKey/);
  assert.match(labels, /执行安全优化/);
  assert.doesNotMatch(labels, /导出验收|Export Acceptance|sequence repair|Sequence Repair|批量替换|Batch Replacement|AI/);

  const flatItems = menuModel.flatMap((group) => group.items);
  assert.equal(flatItems.find((item) => item.id === "copy")?.shortcut, "Cmd+C");
  assert.equal(flatItems.find((item) => item.id === "saveAs")?.enabled, true);
  assert.equal(flatItems.find((item) => item.id === "runOptimization")?.enabled, true);
});

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(String(key)) ? values.get(String(key)) : null;
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
    removeItem(key) {
      values.delete(String(key));
    }
  };
}
