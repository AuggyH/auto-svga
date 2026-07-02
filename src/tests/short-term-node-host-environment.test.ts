import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createShortTermOptimizableSvgaFixture,
  createShortTermSvgaFixture
} from "./helpers/short-term-svga-fixtures.js";
import { createShortTermNodeHostEnvironment } from "../hosts/short-term-node-host-environment.js";
import {
  createShortTermHostActionState,
  dispatchShortTermHostMenuAction,
  openShortTermHostLocalFile
} from "../workbench/short-term-host-actions.js";

test("short-term node host opens a real local SVGA through inspection without leaking paths", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "auto-svga-node-host-open-"));
  const inputPath = path.join(tempDir, "opened.svga");

  try {
    await writeFile(inputPath, await createShortTermSvgaFixture());
    const host = createShortTermNodeHostEnvironment();
    const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
      requestId: "open-1",
      source: "fileButton",
      localPath: inputPath
    });

    assert.equal(opened.facade.model.appState.state, "previewReady");
    assert.equal(opened.facade.model.appState.currentFile?.displayName, "opened.svga");
    assert.equal(opened.facade.model.appState.currentFile?.inspection.overview.assetSummary.imageResourceCount, 1);
    assert.equal(opened.lastAction?.status, "completed");
    assert.equal(JSON.stringify(opened.facade.model).includes(tempDir), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("short-term node host writes optimized Save As output and validates read-back bytes", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "auto-svga-node-host-save-"));
  const inputPath = path.join(tempDir, "optimizable.svga");
  const outputPath = path.join(tempDir, "optimized.svga");

  try {
    await writeFile(inputPath, await createShortTermOptimizableSvgaFixture());
    const host = createShortTermNodeHostEnvironment();
    const opened = await dispatchShortTermHostMenuAction(createShortTermHostActionState(), host, {
      commandId: "openSvga",
      requestId: "open-1",
      localPath: inputPath
    });
    const optimized = await dispatchShortTermHostMenuAction(opened, host, {
      commandId: "runOptimization"
    });
    const saved = await dispatchShortTermHostMenuAction(optimized, host, {
      commandId: "saveAs",
      targetPath: outputPath
    });
    const outputBytes = await readFile(outputPath);

    assert.equal(optimized.lastAction?.status, "completed");
    assert.equal(saved.lastAction?.status, "completed");
    assert.equal(saved.currentLocalPath, outputPath);
    assert.equal(saved.activeOutputBytes, undefined);
    assert.equal(sha256(outputBytes), saved.lastAction?.outputSha256);
    assert.equal(JSON.stringify(saved.facade.model).includes(tempDir), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
