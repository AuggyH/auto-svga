import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createShortTermNodeHostEnvironment } from "../hosts/short-term-node-host-environment.js";
import { createShortTermNodeRecentFilesStore } from "../hosts/short-term-node-recent-files-store.js";
import {
  createShortTermHostActionStateFromRecentStore,
  persistShortTermHostRecentFiles
} from "../workbench/short-term-host-recent-persistence.js";
import {
  createShortTermHostActionState,
  openShortTermHostLocalFile
} from "../workbench/short-term-host-actions.js";
import {
  createShortTermRecentFilesState,
  parseShortTermRecentFilesStateJson
} from "../workbench/short-term-recent-files.js";
import { createShortTermSvgaFixture } from "./helpers/short-term-svga-fixtures.js";

test("short-term node recent store persists host recent files across sessions", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "auto-svga-recent-store-"));
  const sourcePath = path.join(tempDir, "opened.svga");
  const storePath = path.join(tempDir, "state", "recent.json");

  try {
    await writeFile(sourcePath, await createShortTermSvgaFixture());
    const host = createShortTermNodeHostEnvironment();
    const store = createShortTermNodeRecentFilesStore({ filePath: storePath });
    const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
      requestId: "open-1",
      source: "fileButton",
      localPath: sourcePath
    });
    await persistShortTermHostRecentFiles(opened, store);

    const restored = await createShortTermHostActionStateFromRecentStore(store);
    const rawStore = await readFile(storePath, "utf8");

    assert.equal(restored.facade.model.recentFiles.launchRecentFiles.length, 1);
    assert.equal(restored.facade.model.recentFiles.launchRecentFiles[0].displayName, "opened.svga");
    assert.equal(restored.facade.model.recentFiles.launchRecentFiles[0].pathRedacted, true);
    assert.equal(JSON.stringify(restored.facade.model).includes(tempDir), false);
    assert.equal(rawStore.includes(sourcePath), true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("short-term node recent store clears persisted paths and fails soft on invalid json", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "auto-svga-recent-store-clear-"));
  const storePath = path.join(tempDir, "state", "recent.json");
  const sourcePath = path.join(tempDir, "opened.svga");

  try {
    const store = createShortTermNodeRecentFilesStore({ filePath: storePath });
    await mkdir(path.dirname(storePath), { recursive: true });
    await writeFile(storePath, "{ not json");
    const fallback = await createShortTermHostActionStateFromRecentStore(store);
    assert.equal(fallback.facade.model.recentFiles.launchRecentFiles.length, 0);

    await store.save(createShortTermRecentFilesState([{
      id: "recent-a",
      localPath: sourcePath,
      displayName: "opened.svga",
      parentDisplayName: path.basename(tempDir),
      lastOpenedAt: "2026-07-02T00:00:00.000Z",
      availability: "available"
    }], {
      now: "2026-07-02T00:00:00.000Z"
    }));
    assert.equal((await readFile(storePath, "utf8")).includes(sourcePath), true);

    const cleared = await store.clear();
    const clearedRaw = await readFile(storePath, "utf8");
    const restored = await createShortTermHostActionStateFromRecentStore(store);

    assert.equal(cleared.records.length, 0);
    assert.equal(restored.facade.model.recentFiles.launchRecentFiles.length, 0);
    assert.equal(clearedRaw.includes(sourcePath), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("short-term recent parser skips malformed records and normalizes availability", () => {
  const parsed = parseShortTermRecentFilesStateJson(JSON.stringify({
    schemaVersion: 1,
    records: [
      null,
      {
        localPath: "/tmp/auto-svga/a.svga",
        displayName: "A",
        availability: "deleted",
        lastOpenedAt: "2026-07-02T00:00:00.000Z"
      },
      {
        localPath: "/tmp/auto-svga/b.svga",
        displayName: "B",
        availability: "missing",
        lastOpenedAt: "2026-07-02T00:01:00.000Z"
      },
      {
        localPath: 42,
        displayName: "bad"
      }
    ]
  }));

  assert.equal(parsed.records.length, 2);
  assert.equal(parsed.records[0].displayName, "B");
  assert.equal(parsed.records[0].availability, "missing");
  assert.equal(parsed.records[1].displayName, "A");
  assert.equal(parsed.records[1].availability, "available");
});
