import assert from "node:assert/strict";
import { link, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

const require = createRequire(import.meta.url);
const {
  WINDOW_PLACEMENT_MAX_BYTES,
  createWindowPlacementStore,
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

test("placement preference rejects hardlinks before read or publication", async () => {
  const { root, filePath } = await temporaryStore();
  const targetPath = path.join(root, "linked.json");
  await writeFile(targetPath, JSON.stringify({ safe: true }), { mode: 0o600 });
  await link(targetPath, filePath);
  assert.deepEqual(readWindowPlacementPreference(filePath), {
    status: "invalid",
    reason: "placement_store_unsafe_file"
  });
  assert.deepEqual(writeWindowPlacementPreference(filePath, { safe: false }), {
    status: "failed",
    reason: "placement_store_unsafe_file"
  });
});

test("placement preference rejects growth, path replacement, and ancestor swap during read", async () => {
  const fs = require("node:fs");
  const record = {
    schemaVersion: 1,
    source: "owner-normal-window",
    displayId: 200,
    bounds: { x: 1440, y: 80, width: 1280, height: 800 },
    savedAt: "2026-07-15T08:00:00.000Z"
  };

  for (const mutation of ["growth", "replacement", "ancestor"]) {
    const { root, filePath } = await temporaryStore();
    await writeFile(filePath, `${JSON.stringify(record)}\n`, { mode: 0o600 });
    const displacedRoot = `${root}-displaced`;
    let mutated = false;
    const store = createWindowPlacementStore(new Proxy(fs, {
      get(target, property) {
        if (property !== "readSync") return Reflect.get(target, property);
        return (...args) => {
          const count = target.readSync(...args);
          if (!mutated) {
            mutated = true;
            if (mutation === "growth") target.appendFileSync(filePath, " ");
            if (mutation === "replacement") {
              target.renameSync(filePath, `${filePath}.old`);
              target.writeFileSync(filePath, `${JSON.stringify(record)}\n`, { mode: 0o600 });
            }
            if (mutation === "ancestor") {
              target.renameSync(root, displacedRoot);
              target.mkdirSync(root, { mode: 0o700 });
              target.writeFileSync(filePath, `${JSON.stringify(record)}\n`, { mode: 0o600 });
            }
          }
          return count;
        };
      }
    }));
    if (mutation === "ancestor") temporaryRoots.push(displacedRoot);
    const result = store.readWindowPlacementPreference(filePath);
    assert.deepEqual(result, {
      status: "invalid",
      reason: "placement_store_changed_during_read"
    });
  }
});

test("placement preference completes bounded partial reads", async () => {
  const fs = require("node:fs");
  const { filePath } = await temporaryStore();
  const record = {
    schemaVersion: 1,
    source: "owner-normal-window",
    displayId: 200,
    bounds: { x: 1440, y: 80, width: 1280, height: 800 },
    savedAt: "2026-07-15T08:00:00.000Z"
  };
  await writeFile(filePath, `${JSON.stringify(record)}\n`, { mode: 0o600 });
  const store = createWindowPlacementStore(new Proxy(fs, {
    get(target, property) {
      if (property !== "readSync") return Reflect.get(target, property);
      return (descriptor, buffer, offset, length, position) => (
        target.readSync(descriptor, buffer, offset, Math.min(length, 7), position)
      );
    }
  }));
  assert.deepEqual(store.readWindowPlacementPreference(filePath), { status: "loaded", value: record });
});

test("placement preference rejects symlinked parent directories", async () => {
  const { root } = await temporaryStore();
  const actualParent = path.join(root, "actual");
  const linkedParent = path.join(root, "linked");
  await writeFile(path.join(root, "keep"), "owner", { mode: 0o600 });
  await require("node:fs/promises").mkdir(actualParent, { mode: 0o700 });
  await symlink(actualParent, linkedParent);
  const filePath = path.join(linkedParent, "normal-window-placement-v1.json");
  assert.deepEqual(readWindowPlacementPreference(filePath), {
    status: "invalid",
    reason: "placement_store_unsafe_parent"
  });
  assert.deepEqual(writeWindowPlacementPreference(filePath, { safe: false }), {
    status: "failed",
    reason: "placement_store_unsafe_parent"
  });
});

test("placement preference rejects target and parent identity changes during write", async () => {
  const fs = require("node:fs");
  const record = {
    schemaVersion: 1,
    source: "owner-normal-window",
    displayId: 200,
    bounds: { x: 1440, y: 80, width: 1280, height: 800 },
    savedAt: "2026-07-15T08:00:00.000Z"
  };
  for (const mutation of ["target", "ancestor", "temporary-growth"]) {
    const { root, filePath } = await temporaryStore();
    await writeFile(filePath, `${JSON.stringify(record)}\n`, { mode: 0o600 });
    const displacedRoot = `${root}-write-displaced`;
    let mutated = false;
    const store = createWindowPlacementStore(new Proxy(fs, {
      get(target, property) {
        if (property === "fsyncSync") {
          return (descriptor) => {
            const result = target.fsyncSync(descriptor);
            if (!mutated && mutation !== "temporary-growth") {
              mutated = true;
              if (mutation === "target") {
                target.renameSync(filePath, `${filePath}.old`);
                target.writeFileSync(filePath, "owner-existing-data", { mode: 0o600 });
              } else {
                target.renameSync(root, displacedRoot);
                target.mkdirSync(root, { mode: 0o700 });
                target.writeFileSync(filePath, "owner-existing-data", { mode: 0o600 });
              }
            }
            return result;
          };
        }
        if (property === "writeSync" && mutation === "temporary-growth") {
          return (descriptor, buffer, offset, length, position) => {
            const count = target.writeSync(descriptor, buffer, offset, length, position);
            if (!mutated) {
              mutated = true;
              target.writeSync(descriptor, Buffer.from("x"), 0, 1, null);
            }
            return count;
          };
        }
        return Reflect.get(target, property);
      }
    }));
    if (mutation === "ancestor") temporaryRoots.push(displacedRoot);
    const result = store.writeWindowPlacementPreference(filePath, { ...record, savedAt: "2026-07-15T09:00:00.000Z" });
    assert.equal(result.status, "failed");
    assert.match(result.reason, /^placement_store_(?:changed_during_write|write_failed)$/u);
    if (mutation !== "temporary-growth") assert.equal(await readFile(filePath, "utf8"), "owner-existing-data");
  }
});

test("placement preference never overwrites a target that appears during first publication", async () => {
  const fs = require("node:fs");
  const { filePath } = await temporaryStore();
  let injected = false;
  const store = createWindowPlacementStore(new Proxy(fs, {
    get(target, property) {
      if (property !== "linkSync") return Reflect.get(target, property);
      return (...args) => {
        if (!injected) {
          injected = true;
          target.writeFileSync(filePath, "owner-existing-data", { mode: 0o600 });
        }
        return target.linkSync(...args);
      };
    }
  }));
  const result = store.writeWindowPlacementPreference(filePath, {
    schemaVersion: 1,
    source: "owner-normal-window",
    displayId: 200,
    bounds: { x: 1440, y: 80, width: 1280, height: 800 },
    savedAt: "2026-07-15T08:00:00.000Z"
  });
  assert.deepEqual(result, {
    status: "failed",
    reason: "placement_store_changed_during_write"
  });
  assert.equal(await readFile(filePath, "utf8"), "owner-existing-data");
});
