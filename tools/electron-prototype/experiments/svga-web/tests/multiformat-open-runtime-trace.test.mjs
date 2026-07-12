import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const {
  TRACE_MARKER_FILE,
  createMultiFormatOpenRuntimeTrace,
  resolveMultiFormatTraceRunId
} = require("../multiformat-open-runtime-trace.cjs");

test("multi-format runtime trace records only bounded path-redacted phase fields", async () => {
  const runId = `contract-${process.pid}-${Date.now()}`;
  const tracePath = `/private/tmp/auto-svga-multiformat-trace-${runId}.jsonl`;
  let timestamp = 1000;
  const trace = createMultiFormatOpenRuntimeTrace({ runId, clock: () => timestamp += 1 });

  try {
    assert.equal(trace.enabled, true);
    assert.equal(trace.record({
      phase: "open_file_received",
      eventId: "fileOpenEvent:1",
      requestId: "fileOpenEvent:1",
      format: "lottie",
      sourceId: "0123456789abcdef01234567",
      productMilestoneId: "0.2-multiformat-preview",
      formalRuntimeMode: true,
      queueDepth: 1,
      bridgeReady: false,
      modelStatus: "loading",
      issueCode: "parse_precondition",
      actionAccepted: false,
      filePath: "/Users/alice/Secret Campaign/owner.json",
      message: "secret local message",
      bytes: [1, 2, 3]
    }), true);

    const text = await readFile(tracePath, "utf8");
    const entry = JSON.parse(text.trim());
    assert.deepEqual(Object.keys(entry).sort(), [
      "actionAccepted",
      "bridgeReady",
      "eventId",
      "formalRuntimeMode",
      "format",
      "issueCode",
      "modelStatus",
      "phase",
      "productMilestoneId",
      "queueDepth",
      "requestId",
      "schemaVersion",
      "sourceId",
      "timestampMs"
    ]);
    assert.doesNotMatch(text, /\/Users|alice|Secret Campaign|owner\.json|secret local message|"bytes"/i);
  } finally {
    await rm(tracePath, { force: true });
  }
});

test("multi-format runtime trace enables only from an exact packaged marker or safe run id", async () => {
  const resourcesPath = await mkdtemp(path.join(os.tmpdir(), "auto-svga-trace-marker-"));
  try {
    await writeFile(path.join(resourcesPath, TRACE_MARKER_FILE), "runtime-discriminator-018\n");
    assert.equal(resolveMultiFormatTraceRunId({ isPackaged: true, resourcesPath }), "runtime-discriminator-018");
    assert.equal(resolveMultiFormatTraceRunId({ isPackaged: false, resourcesPath }), "");
    assert.equal(resolveMultiFormatTraceRunId({
      isPackaged: false,
      environment: { AUTO_SVGA_MULTIFORMAT_TRACE_RUN_ID: "source-contract-018" }
    }), "source-contract-018");

    await writeFile(path.join(resourcesPath, TRACE_MARKER_FILE), "../../Users/alice/private.json");
    assert.equal(resolveMultiFormatTraceRunId({ isPackaged: true, resourcesPath }), "");
    assert.equal(createMultiFormatOpenRuntimeTrace({ runId: "../../unsafe" }).enabled, false);
  } finally {
    await rm(resourcesPath, { recursive: true, force: true });
  }
});

test("packaged open-file trace covers A-D phases and waits for renderer-ready IPC before flush", async () => {
  const [main, preload, app] = await Promise.all([
    readFile(path.join(experimentRoot, "main.cjs"), "utf8"),
    readFile(path.join(experimentRoot, "preload.cjs"), "utf8"),
    readFile(path.join(experimentRoot, "web/short-term-macos-app.mjs"), "utf8")
  ]);

  for (const phase of [
    "open_file_received",
    "open_file_rejected_mode",
    "open_file_queued",
    "flush_deferred",
    "dispatch_started",
    "renderer_begin_result",
    "session_open_completed",
    "renderer_complete_result",
    "renderer_action_bridge_ready"
  ]) {
    assert.match(main, new RegExp(`phase: ["']${phase}["']`, "u"));
  }
  assert.match(preload, /notifyMultiFormatRendererReady/);
  assert.match(app, /installShortTermActionBridge[\s\S]*await bridge\?\.notifyMultiFormatRendererReady\?\.\(\)/);

  const loadIndex = main.indexOf("await window.loadURL(rendererUrl)");
  const rendererLoadCompletedIndex = main.indexOf('phase: "renderer_load_completed"', loadIndex);
  const normalVisibleStartupIndex = main.indexOf("if (normalVisibleStartupMode)", rendererLoadCompletedIndex);
  assert.ok(loadIndex >= 0 && rendererLoadCompletedIndex > loadIndex && normalVisibleStartupIndex > rendererLoadCompletedIndex);
  const rendererLoadCompletedSource = main.slice(rendererLoadCompletedIndex, normalVisibleStartupIndex);
  assert.doesNotMatch(rendererLoadCompletedSource, /multiFormatDesktopRendererReady\s*=\s*true/);
  assert.doesNotMatch(rendererLoadCompletedSource, /flushPendingMultiFormatOpenFileEvents\(\)/);

  const rendererReadyHandlerIndex = main.indexOf("ipcMain.handle(IPC_CHANNELS.multiFormatRendererReady");
  const nextIpcHandlerIndex = main.indexOf("ipcMain.handle(", rendererReadyHandlerIndex + 1);
  assert.ok(rendererReadyHandlerIndex >= 0 && nextIpcHandlerIndex > rendererReadyHandlerIndex);
  const rendererReadySource = main.slice(rendererReadyHandlerIndex, nextIpcHandlerIndex);
  assert.match(rendererReadySource, /input\?\.phase !== "renderer_action_bridge_ready"/);
  assert.match(rendererReadySource, /phase: "renderer_action_bridge_ready"/);
  assert.match(rendererReadySource, /multiFormatDesktopRendererReady\s*=\s*true/);
  assert.match(rendererReadySource, /await flushPendingMultiFormatOpenFileEvents\(\)/);
  assert.ok(
    rendererReadySource.indexOf("multiFormatDesktopRendererReady = true") < rendererReadySource.indexOf("await flushPendingMultiFormatOpenFileEvents()")
  );
});
