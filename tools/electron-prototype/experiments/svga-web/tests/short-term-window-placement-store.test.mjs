import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

const require = createRequire(import.meta.url);
const {
  WINDOW_PLACEMENT_MAX_BYTES,
  readWindowPlacementPreference,
  writeWindowPlacementPreference
} = require("../short-term-window-placement-store.cjs");

const temporaryRoots = [];

async function temporaryStore() {
  const root = await mkdtemp(path.join(os.tmpdir(), "auto-svga-window-placement-"));
  temporaryRoots.push(root);
  return {
    root,
    filePath: path.join(root, "normal-window-placement-v1.json")
  };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test("placement preference uses a bounded mode-0600 atomic file", async () => {
  const { root, filePath } = await temporaryStore();
  const record = {
    schemaVersion: 1,
    source: "owner-normal-window",
    displayId: 200,
    bounds: { x: 1440, y: 80, width: 1280, height: 800 },
    savedAt: "2026-07-15T08:00:00.000Z"
  };
  const saved = writeWindowPlacementPreference(filePath, record);
  assert.deepEqual(saved, { status: "saved" });
  assert.equal((await stat(filePath)).mode & 0o777, 0o600);
  assert.deepEqual(readWindowPlacementPreference(filePath), { status: "loaded", value: record });
  assert.deepEqual(await readdir(root), ["normal-window-placement-v1.json"]);
});

test("placement preference rejects malformed and oversized content without path leakage", async () => {
  const { root, filePath } = await temporaryStore();
  await writeFile(filePath, "{not-json", { mode: 0o600 });
  const malformed = readWindowPlacementPreference(filePath);
  assert.deepEqual(malformed, { status: "invalid", reason: "placement_store_malformed" });
  assert.doesNotMatch(JSON.stringify(malformed), new RegExp(root.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")));

  await writeFile(filePath, Buffer.alloc(WINDOW_PLACEMENT_MAX_BYTES + 1, 0x20), { mode: 0o600 });
  const oversized = readWindowPlacementPreference(filePath);
  assert.deepEqual(oversized, { status: "invalid", reason: "placement_store_oversized" });
  assert.doesNotMatch(JSON.stringify(oversized), new RegExp(root.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")));
});

test("placement preference rejects symlink reads and writes", async () => {
  const { root, filePath } = await temporaryStore();
  const targetPath = path.join(root, "target.json");
  await writeFile(targetPath, "owner-data", { mode: 0o600 });
  await symlink(targetPath, filePath);

  const readResult = readWindowPlacementPreference(filePath);
  assert.deepEqual(readResult, { status: "invalid", reason: "placement_store_unsafe_file" });
  const writeResult = writeWindowPlacementPreference(filePath, {
    schemaVersion: 1,
    source: "owner-normal-window",
    bounds: { x: 0, y: 0, width: 640, height: 640 }
  });
  assert.deepEqual(writeResult, { status: "failed", reason: "placement_store_unsafe_file" });
  assert.equal(await readFile(targetPath, "utf8"), "owner-data");
});
