import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createShortTermNodeHostSession } from "../hosts/short-term-node-host-session.js";
import { createShortTermSvgaFixture } from "./helpers/short-term-svga-fixtures.js";

test("short-term node host session opens real local files and restores recent records", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "auto-svga-node-session-"));
  const sourcePath = path.join(tempDir, "opened.svga");
  const storePath = path.join(tempDir, "state", "recent.json");

  try {
    await writeFile(sourcePath, await createShortTermSvgaFixture());
    const session = await createShortTermNodeHostSession({ recentStorePath: storePath });
    const opened = await session.openLocalFile({
      requestId: "open-1",
      source: "fileButton",
      localPath: sourcePath
    });

    assert.equal(opened.actionResult?.status, "completed");
    assert.equal(opened.recentPersistence.status, "saved");
    assert.equal(opened.state.facade.model.appState.currentFile?.displayName, "opened.svga");
    assert.equal(JSON.stringify(opened.state.facade.model).includes(tempDir), false);
    assert.equal((await readFile(storePath, "utf8")).includes(sourcePath), true);

    const restored = await createShortTermNodeHostSession({ recentStorePath: storePath });
    const recent = restored.getState().facade.model.recentFiles.launchRecentFiles[0];

    assert.equal(recent.displayName, "opened.svga");
    assert.equal(recent.pathRedacted, true);
    assert.equal(JSON.stringify(restored.getState().facade.model).includes(tempDir), false);

    const reopened = await restored.openRecentFile({
      requestId: "recent-1",
      recentFileId: recent.id,
      source: "recentMenu"
    });

    assert.equal(reopened.actionResult?.status, "completed");
    assert.equal(reopened.recentPersistence.status, "saved");
    assert.equal(reopened.state.facade.model.appState.currentFile?.displayName, "opened.svga");
    assert.equal(JSON.stringify(reopened.state.facade.model).includes(tempDir), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("short-term node host session can run without a configured recent store", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "auto-svga-node-session-no-store-"));
  const sourcePath = path.join(tempDir, "opened.svga");

  try {
    await writeFile(sourcePath, await createShortTermSvgaFixture());
    const session = await createShortTermNodeHostSession();
    const opened = await session.openLocalFile({
      requestId: "open-1",
      source: "menuOpen",
      localPath: sourcePath
    });

    assert.equal(opened.actionResult?.status, "completed");
    assert.equal(opened.recentPersistence.status, "notConfigured");
    assert.equal(JSON.stringify(opened.state.facade.model).includes(tempDir), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
