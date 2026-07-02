import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  createShortTermHostSession,
  toShortTermHostSessionRendererResult
} from "../workbench/short-term-host-session.js";
import {
  createShortTermHostActionState,
  openShortTermHostLocalFile,
  type ShortTermHostEnvironment
} from "../workbench/short-term-host-actions.js";
import type { ShortTermProductInspectionModel } from "../workbench/short-term-product-model.js";
import type { ShortTermHostLifecycleRequestInput } from "../workbench/short-term-host-lifecycle.js";
import type { ShortTermRecentFilesStore } from "../workbench/short-term-host-recent-persistence.js";
import {
  clearShortTermRecentFiles,
  createShortTermRecentFilesState,
  type ShortTermRecentFileInput,
  type ShortTermRecentFilesState
} from "../workbench/short-term-recent-files.js";
import {
  createShortTermColoredPng,
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

test("short-term host session starts with empty recents when recent storage load fails", async () => {
  const sourcePath = "/Users/designer/private/opened.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermSvgaFixture()
  });
  const store = createMemoryRecentFilesStore([], {
    loadError: () => new Error("Cannot read /Users/designer/private/recent.json")
  });
  const session = await createShortTermHostSession({ host, recentStore: store });

  assert.equal(session.getModel().recentFiles.launchRecentFiles.length, 0);

  const opened = await session.openLocalFile({
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });

  assert.equal(opened.actionResult?.status, "completed");
  assert.equal(opened.recentPersistence.status, "saved");
  assert.equal(store.snapshot().records[0].localPath, sourcePath);
  assert.equal(JSON.stringify(opened.model).includes("/Users/designer"), false);
});

test("short-term host session returns defensive state snapshots", async () => {
  const sourcePath = "/Users/designer/private/opened.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermSvgaFixture()
  });
  const session = await createShortTermHostSession({ host });

  const opened = await session.openLocalFile({
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });

  assert.equal(opened.model.appState.state, "previewReady");
  assert.equal(JSON.stringify(opened.model).includes("/Users/designer"), false);
  opened.model.activeWorkflow.message = "mutated action result model";
  opened.state.currentLocalPath = "/Users/designer/private/mutated-from-action.svga";

  const leakedModel = session.getModel();
  assert.equal(leakedModel.appState.state, "previewReady");
  assert.equal(JSON.stringify(leakedModel).includes("/Users/designer"), false);
  assert.notEqual(leakedModel.activeWorkflow.message, "mutated action result model");
  leakedModel.activeWorkflow.message = "mutated get model";

  const leakedGetState = session.getState();
  assert.ok(leakedGetState.facade.sourceBytes);
  const originalFirstByte = leakedGetState.facade.sourceBytes[0];
  leakedGetState.currentLocalPath = "/Users/designer/private/mutated-from-get-state.svga";
  leakedGetState.facade.sourceBytes[0] = (originalFirstByte + 1) % 256;

  assert.notEqual(session.getModel().activeWorkflow.message, "mutated get model");
  const current = session.getState();
  assert.equal(current.currentLocalPath, sourcePath);
  assert.equal(current.facade.sourceBytes?.[0], originalFirstByte);
  assert.equal(JSON.stringify(current.facade.model).includes("/Users/designer"), false);
});

test("short-term host session clones injected initial state", async () => {
  const sourcePath = "/Users/designer/private/opened.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermSvgaFixture()
  });
  const initialState = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });
  assert.ok(initialState.facade.sourceBytes);
  const originalFirstByte = initialState.facade.sourceBytes[0];

  const session = await createShortTermHostSession({ host, initialState });
  initialState.currentLocalPath = "/Users/designer/private/mutated-after-constructor.svga";
  initialState.facade.sourceBytes[0] = (originalFirstByte + 1) % 256;
  initialState.facade.model.activeWorkflow.message = "mutated external initial state";

  const current = session.getState();
  assert.equal(current.currentLocalPath, sourcePath);
  assert.equal(current.facade.sourceBytes?.[0], originalFirstByte);
  assert.notEqual(current.facade.model.activeWorkflow.message, "mutated external initial state");
  assert.equal(JSON.stringify(current.facade.model).includes("/Users/designer"), false);
});

test("short-term host session action result projection is independent", async () => {
  const sourcePath = "/Users/designer/private/optimizable.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermOptimizableSvgaFixture()
  });
  const session = await createShortTermHostSession({ host });
  await session.openLocalFile({
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });
  const optimized = await session.runOptimization();
  const originalActionMessage = optimized.actionResult?.message;

  assert.ok(optimized.actionResult);
  assert.ok(optimized.state.lastAction);
  optimized.actionResult.message = "mutated top-level action result";
  assert.equal(optimized.state.lastAction.message, originalActionMessage);

  optimized.state.lastAction.message = "mutated nested state action";
  assert.equal(optimized.actionResult.message, "mutated top-level action result");
  assert.notEqual(session.getState().lastAction?.message, "mutated nested state action");
});

test("short-term host session creates renderer-safe action results without host state", async () => {
  const sourcePath = "/Users/designer/private/optimizable.svga";
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
  const optimized = await session.runOptimization();
  assert.ok(optimized.state.activeOutputBytes);

  const rendererResult = toShortTermHostSessionRendererResult(optimized);
  const serialized = JSON.stringify(rendererResult);

  assert.equal(rendererResult.source, "short-term-host-session-renderer");
  assert.equal(rendererResult.model.activeOutput?.outputKind, "optimized_svga");
  assert.equal(rendererResult.actionResult?.status, "completed");
  assert.equal(rendererResult.recentPersistence.status, "unchanged");
  assert.equal(rendererResult.pathRedacted, true);
  assert.equal(rendererResult.hostStateIncluded, false);
  assert.equal(rendererResult.outputBytesIncluded, false);
  assert.equal("state" in rendererResult, false);
  assert.equal(serialized.includes(sourcePath), false);
  assert.equal(serialized.includes("/Users/designer"), false);
  assert.equal(serialized.includes("currentLocalPath"), false);
  assert.equal(serialized.includes("sourceBytes"), false);
  assert.equal(serialized.includes("activeOutputBytes"), false);

  rendererResult.model.activeWorkflow.message = "mutated renderer model";
  if (rendererResult.actionResult) {
    rendererResult.actionResult.message = "mutated renderer action";
  }
  rendererResult.recentPersistence.message = "mutated renderer persistence";

  assert.notEqual(optimized.model.activeWorkflow.message, "mutated renderer model");
  assert.notEqual(optimized.actionResult?.message, "mutated renderer action");
  assert.notEqual(optimized.recentPersistence.message, "mutated renderer persistence");
});

test("short-term host session serializes overlapping mutating actions", async () => {
  const slowPath = "/Users/designer/private/slow.svga";
  const fastPath = "/Users/designer/private/fast.svga";
  const slowRead = deferred<{ bytes: Uint8Array; displayName: string }>();
  const slowBytes = await createShortTermSvgaFixture();
  const fastBytes = await createShortTermSvgaFixture();
  let fastReadCount = 0;
  const host: ShortTermHostEnvironment = {
    async readLocalFile(localPath) {
      if (localPath === slowPath) return slowRead.promise;
      if (localPath === fastPath) {
        fastReadCount += 1;
        return {
          bytes: new Uint8Array(fastBytes),
          displayName: "fast.svga"
        };
      }
      throw new Error("File is missing.");
    },
    async inspectSvga() {
      return inspectionFixture();
    },
    async writeLocalFile() {},
    async readSavedFile() {
      return new Uint8Array();
    }
  };
  const store = createMemoryRecentFilesStore();
  const session = await createShortTermHostSession({ host, recentStore: store });

  const slowOpen = session.openLocalFile({
    requestId: "open-slow",
    source: "fileButton",
    localPath: slowPath
  });
  const fastOpen = session.openLocalFile({
    requestId: "open-fast",
    source: "fileButton",
    localPath: fastPath
  });

  await Promise.resolve();
  assert.equal(fastReadCount, 0);

  slowRead.resolve({
    bytes: new Uint8Array(slowBytes),
    displayName: "slow.svga"
  });
  const [slowResult, fastResult] = await Promise.all([slowOpen, fastOpen]);

  assert.equal(slowResult.actionResult?.status, "completed");
  assert.equal(fastResult.actionResult?.status, "completed");
  assert.equal(fastReadCount, 1);
  assert.equal(session.getState().currentLocalPath, fastPath);
  assert.equal(store.snapshot().records[0].localPath, fastPath);
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
    saveError: () => new Error("Cannot write /Users/designer/My Documents/private/recent.json")
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
  assert.equal(opened.recentPersistence.diagnostic?.message.includes("My Documents/private"), false);

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

  const unopenedOptimization = await session.runOptimization();
  assert.equal(unopenedOptimization.actionResult?.status, "blocked");
  assert.equal(unopenedOptimization.actionResult?.diagnostic?.code, "operation_requires_open_file");

  const unopenedRename = await session.renameImageKey("img_frame", "profile_frame");
  assert.equal(unopenedRename.actionResult?.status, "blocked");
  assert.equal(unopenedRename.actionResult?.diagnostic?.code, "operation_requires_open_file");

  const unopenedReplacement = await session.replaceImagePreview(
    "img_frame",
    createShortTermColoredPng(16, 16, [0, 255, 0, 255])
  );
  assert.equal(unopenedReplacement.actionResult?.status, "blocked");
  assert.equal(unopenedReplacement.actionResult?.diagnostic?.code, "operation_requires_open_file");

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

test("short-term host session blocks dirty open without mutating recent persistence", async () => {
  const sourcePath = "/Users/designer/private/optimizable.svga";
  const nextPath = "/Users/designer/private/next.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermOptimizableSvgaFixture(),
    [nextPath]: await createShortTermSvgaFixture()
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

  const blocked = await session.openLocalFile({
    requestId: "open-2",
    source: "fileButton",
    localPath: nextPath
  });

  assert.equal(blocked.actionResult?.status, "blocked");
  assert.equal(blocked.actionResult?.diagnostic?.code, "open_requires_discard_confirmation");
  assert.equal(blocked.recentPersistence.status, "unchanged");
  assert.equal(blocked.state.currentLocalPath, sourcePath);
  assert.ok(blocked.state.activeOutputBytes);
  assert.equal(store.snapshot().records[0].localPath, sourcePath);

  const reopened = await session.openLocalFile({
    requestId: "open-2",
    source: "fileButton",
    localPath: nextPath,
    discardUnsavedChanges: true
  });

  assert.equal(reopened.actionResult?.status, "completed");
  assert.equal(reopened.recentPersistence.status, "saved");
  assert.equal(reopened.state.currentLocalPath, nextPath);
  assert.equal(reopened.state.activeOutputBytes, undefined);
  assert.equal(store.snapshot().records[0].localPath, nextPath);
});

test("short-term host session evaluates lifecycle close and quit without mutating state", async () => {
  const sourcePath = "/Users/designer/private/optimizable.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermOptimizableSvgaFixture()
  });
  const store = createMemoryRecentFilesStore();
  const session = await createShortTermHostSession({ host, recentStore: store });

  const cleanDecision = session.evaluateLifecycleRequest({
    request: "appQuit"
  });

  assert.equal(cleanDecision.status, "allow");
  assert.equal(cleanDecision.canProceed, true);
  assert.equal(cleanDecision.dirty, false);
  assert.equal(cleanDecision.shouldPromptDiscard, false);

  await session.openLocalFile({
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });
  await session.dispatchMenuAction({
    commandId: "runOptimization"
  });
  const dirtyState = session.getState();

  const blocked = session.evaluateLifecycleRequest({
    request: "windowClose"
  });

  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.canProceed, false);
  assert.equal(blocked.dirty, true);
  assert.equal(blocked.shouldPromptDiscard, true);
  assert.equal(blocked.activeOutputKind, "optimized_svga");
  assert.equal(blocked.activeOutputSha256, dirtyState.facade.model.activeOutput?.outputSha256);
  assert.equal(blocked.diagnostic?.code, "lifecycle_requires_discard_confirmation");
  assert.equal(JSON.stringify(blocked).includes("/Users/designer"), false);
  assert.equal(session.getState().currentLocalPath, sourcePath);
  assert.ok(session.getState().activeOutputBytes);
  assert.equal(store.snapshot().records[0].localPath, sourcePath);

  const confirmed = session.evaluateLifecycleRequest({
    request: "appQuit",
    discardUnsavedChanges: true
  });

  assert.equal(confirmed.status, "allow");
  assert.equal(confirmed.canProceed, true);
  assert.equal(confirmed.dirty, true);
  assert.equal(confirmed.shouldPromptDiscard, false);
  assert.equal(confirmed.activeOutputKind, "optimized_svga");
  assert.equal(session.getState().currentLocalPath, sourcePath);
  assert.ok(session.getState().activeOutputBytes);

  const saved = await session.dispatchMenuAction({
    commandId: "saveAs",
    targetPath: "/Users/designer/private/optimized.svga"
  });
  assert.equal(saved.actionResult?.status, "completed");
  assert.equal(saved.state.activeOutputBytes, undefined);

  const savedDecision = session.evaluateLifecycleRequest({
    request: "windowClose"
  });
  assert.equal(savedDecision.status, "allow");
  assert.equal(savedDecision.canProceed, true);
  assert.equal(savedDecision.dirty, false);
  assert.equal(savedDecision.shouldPromptDiscard, false);
});

test("short-term host session blocks malformed lifecycle requests without mutating state", async () => {
  const sourcePath = "/Users/designer/private/optimizable.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermOptimizableSvgaFixture()
  });
  const session = await createShortTermHostSession({ host });

  await session.openLocalFile({
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });
  await session.dispatchMenuAction({
    commandId: "runOptimization"
  });
  const dirtyState = session.getState();

  const unsupported = session.evaluateLifecycleRequest({
    request: "forceQuit"
  } as unknown as ShortTermHostLifecycleRequestInput);

  assert.equal(unsupported.status, "blocked");
  assert.equal(unsupported.canProceed, false);
  assert.equal(unsupported.request, "unsupported");
  assert.equal(unsupported.dirty, true);
  assert.equal(unsupported.shouldPromptDiscard, false);
  assert.equal(unsupported.activeOutputKind, "optimized_svga");
  assert.equal(unsupported.activeOutputSha256, dirtyState.facade.model.activeOutput?.outputSha256);
  assert.equal(unsupported.diagnostic?.code, "lifecycle_request_kind_invalid");
  assert.equal(JSON.stringify(unsupported).includes("/Users/designer"), false);
  assert.equal(session.getState().currentLocalPath, sourcePath);
  assert.ok(session.getState().activeOutputBytes);

  const malformedDiscard = session.evaluateLifecycleRequest({
    request: "windowClose",
    discardUnsavedChanges: "yes"
  } as unknown as ShortTermHostLifecycleRequestInput);

  assert.equal(malformedDiscard.status, "blocked");
  assert.equal(malformedDiscard.canProceed, false);
  assert.equal(malformedDiscard.request, "unsupported");
  assert.equal(malformedDiscard.diagnostic?.code, "lifecycle_discard_flag_invalid");
  assert.equal(session.getState().currentLocalPath, sourcePath);
  assert.ok(session.getState().activeOutputBytes);
});

test("short-term host session records and recovers playback failure without clearing dirty output", async () => {
  const sourcePath = "/Users/designer/private/optimizable.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermOptimizableSvgaFixture()
  });
  const store = createMemoryRecentFilesStore();
  const session = await createShortTermHostSession({ host, recentStore: store });

  const blocked = await session.reportPlaybackFailure({
    message: "播放器首帧渲染失败。"
  });
  assert.equal(blocked.actionResult?.status, "blocked");
  assert.equal(blocked.actionResult?.diagnostic?.code, "playback_failure_requires_open_file");

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

  const abnormal = await session.reportPlaybackFailure({
    message: `播放器无法读取 ${sourcePath}`
  });
  assert.equal(abnormal.actionResult?.status, "completed");
  assert.equal(abnormal.actionResult?.action, "reportPlaybackFailure");
  assert.equal(abnormal.recentPersistence.status, "unchanged");
  assert.equal(abnormal.state.facade.model.appState.state, "playbackAbnormal");
  assert.equal(abnormal.state.facade.model.appState.failure?.message, "播放器无法读取 [local path]");
  assert.equal(abnormal.actionResult?.message, "播放器无法读取 [local path]");
  assert.equal(JSON.stringify(abnormal.model).includes("/Users/designer"), false);
  assert.equal(abnormal.state.currentLocalPath, sourcePath);
  assert.ok(abnormal.state.activeOutputBytes);
  assert.equal(abnormal.state.facade.model.activeOutput?.outputKind, "optimized_svga");

  const recovered = await session.recoverPlayback();
  assert.equal(recovered.actionResult?.status, "completed");
  assert.equal(recovered.actionResult?.action, "recoverPlayback");
  assert.equal(recovered.recentPersistence.status, "unchanged");
  assert.equal(recovered.state.facade.model.appState.state, "previewReady");
  assert.equal(recovered.state.currentLocalPath, sourcePath);
  assert.ok(recovered.state.activeOutputBytes);
  assert.equal(recovered.state.facade.model.activeOutput?.outputKind, "optimized_svga");
  assert.equal(JSON.stringify(recovered.state.facade.model).includes("/Users/designer"), false);
});

test("short-term host session applies and resets runtime text preview without writing bytes", async () => {
  const sourcePath = "/Users/designer/private/optimizable.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermOptimizableSvgaFixture()
  });
  const store = createMemoryRecentFilesStore();
  const session = await createShortTermHostSession({ host, recentStore: store });

  const blocked = await session.prepareTextPreview({
    textElements: [{
      textKey: "nickname",
      displayName: "昵称",
      supportedFields: ["text"]
    }]
  });
  assert.equal(blocked.actionResult?.status, "blocked");
  assert.equal(blocked.actionResult?.diagnostic?.code, "preview_action_requires_open_file");

  await session.openLocalFile({
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });
  const optimized = await session.dispatchMenuAction({
    commandId: "runOptimization"
  });
  assert.equal(optimized.actionResult?.status, "completed");
  assert.equal(optimized.state.facade.model.activeOutput?.outputKind, "optimized_svga");
  assert.ok(optimized.state.activeOutputBytes);

  const prepared = await session.prepareTextPreview({
    textElements: [{
      textKey: " nickname ",
      displayName: " 昵称 ",
      initialText: "Guest",
      supportedFields: ["text", "color", "text"]
    }]
  });
  assert.equal(prepared.actionResult?.status, "completed");
  assert.equal(prepared.actionResult?.action, "prepareTextPreview");
  assert.equal(prepared.recentPersistence.status, "unchanged");
  assert.equal(prepared.state.facade.textPreviewSession?.model.status, "ready");
  assert.equal(prepared.state.facade.textPreviewSession?.model.textElements[0].textKey, "nickname");
  assert.equal(prepared.state.facade.model.activeOutput?.outputKind, "optimized_svga");
  assert.ok(prepared.state.activeOutputBytes);

  const invalid = await session.applyTextPreview({
    replacement: {
      textKey: "missing",
      fields: { text: "Alice" }
    }
  });
  assert.equal(invalid.actionResult?.status, "failed");
  assert.equal(invalid.actionResult?.diagnostic?.code, "text_key_not_found");
  assert.equal(invalid.state.facade.model.activeOutput?.outputKind, "optimized_svga");
  assert.ok(invalid.state.activeOutputBytes);

  const applied = await session.applyTextPreview({
    replacement: {
      textKey: "nickname",
      fields: {
        text: "Alice",
        size: 20,
        color: "#ffffff"
      }
    }
  });
  assert.equal(applied.actionResult?.status, "completed");
  assert.equal(applied.actionResult?.action, "applyTextPreview");
  assert.deepEqual(applied.state.facade.textPreviewSession?.model.activeReplacement, {
    textKey: "nickname",
    fields: {
      text: "Alice",
      color: "#ffffff"
    }
  });
  assert.equal(applied.state.facade.textPreviewSession?.model.bytePersistenceSupported, false);
  assert.equal(applied.state.facade.textPreviewSession?.model.sourceBytesUnchanged, true);
  assert.equal(applied.state.facade.model.activeOutput?.outputKind, "optimized_svga");
  assert.ok(applied.state.activeOutputBytes);

  const reset = await session.resetTextPreview();
  assert.equal(reset.actionResult?.status, "completed");
  assert.equal(reset.actionResult?.action, "resetTextPreview");
  assert.equal(reset.state.facade.textPreviewSession?.model.status, "reset");
  assert.equal(reset.state.facade.textPreviewSession?.model.activeReplacement, undefined);
  assert.equal(reset.state.facade.model.activeOutput?.outputKind, "optimized_svga");
  assert.ok(reset.state.activeOutputBytes);
  assert.equal(JSON.stringify(reset.state.facade.model).includes("/Users/designer"), false);
});

test("short-term host session resets image replacement preview and clears only replacement output", async () => {
  const sourcePath = "/Users/designer/private/editable.svga";
  const host = createMemoryHost({
    [sourcePath]: await createShortTermSvgaFixture()
  });
  const store = createMemoryRecentFilesStore();
  const session = await createShortTermHostSession({ host, recentStore: store });

  const blocked = await session.resetImageReplacementPreview();
  assert.equal(blocked.actionResult?.status, "blocked");
  assert.equal(blocked.actionResult?.diagnostic?.code, "preview_action_requires_open_file");

  await session.openLocalFile({
    requestId: "open-1",
    source: "fileButton",
    localPath: sourcePath
  });
  const notNeeded = await session.resetImageReplacementPreview();
  assert.equal(notNeeded.actionResult?.status, "blocked");
  assert.equal(notNeeded.actionResult?.diagnostic?.code, "image_replacement_reset_not_needed");

  const replaced = await session.dispatchMenuAction({
    commandId: "replaceImage",
    imageKey: "img_frame",
    pngBytes: createShortTermColoredPng(16, 16, [0, 0, 255, 255])
  });
  assert.equal(replaced.actionResult?.status, "completed");
  assert.equal(replaced.state.facade.model.activeOutput?.outputKind, "image_replacement_svga");
  assert.ok(replaced.state.activeOutputBytes);
  assert.equal(replaced.state.facade.imageReplacementSession?.model.resetEnabled, true);

  const reset = await session.resetImageReplacementPreview();
  assert.equal(reset.actionResult?.status, "completed");
  assert.equal(reset.actionResult?.action, "resetImageReplacement");
  assert.equal(reset.recentPersistence.status, "unchanged");
  assert.equal(reset.state.currentLocalPath, sourcePath);
  assert.equal(reset.state.activeOutputBytes, undefined);
  assert.equal(reset.state.facade.model.activeOutput, undefined);
  assert.equal(reset.state.facade.imageReplacementSession?.model.status, "ready");
  assert.equal(reset.state.facade.imageReplacementSession?.model.resetEnabled, false);
  assert.equal(reset.state.facade.imageReplacementSession?.model.activeReplacement, undefined);
  assert.equal(JSON.stringify(reset.state.facade.model).includes("/Users/designer"), false);
});

test("short-term host session exposes first-class methods for formal short-term actions", async () => {
  const sourcePath = "/Users/designer/private/optimizable.svga";
  const outputPath = "/Users/designer/private/optimized-copy.svga";
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

  const optimized = await session.runOptimization();
  assert.equal(optimized.actionResult?.status, "completed");
  assert.equal(optimized.actionResult?.action, "runOptimization");
  assert.equal(optimized.state.facade.model.activeOutput?.outputKind, "optimized_svga");
  assert.ok(optimized.state.activeOutputBytes);

  const blockedRename = await session.renameImageKey("img_frame", "profile_frame");
  assert.equal(blockedRename.actionResult?.status, "blocked");
  assert.equal(blockedRename.actionResult?.diagnostic?.code, "operation_requires_discard_confirmation");
  assert.equal(blockedRename.state.facade.model.activeOutput?.outputKind, "optimized_svga");
  assert.ok(blockedRename.state.activeOutputBytes);

  const saved = await session.saveOutput({
    command: "saveAs",
    targetPath: outputPath
  });
  assert.equal(saved.actionResult?.status, "completed");
  assert.equal(saved.actionResult?.action, "save");
  assert.equal(saved.state.currentLocalPath, outputPath);
  assert.equal(saved.state.activeOutputBytes, undefined);
  assert.equal(saved.state.facade.model.activeOutput, undefined);

  const replaced = await session.replaceImagePreview(
    "img_frame",
    createShortTermColoredPng(16, 16, [0, 255, 0, 255])
  );
  assert.equal(replaced.actionResult?.status, "completed");
  assert.equal(replaced.actionResult?.action, "replaceImage");
  assert.equal(replaced.state.facade.model.activeOutput?.outputKind, "image_replacement_svga");
  assert.ok(replaced.state.activeOutputBytes);

  const blockedOptimization = await session.runOptimization();
  assert.equal(blockedOptimization.actionResult?.status, "blocked");
  assert.equal(blockedOptimization.actionResult?.diagnostic?.code, "operation_requires_discard_confirmation");
  assert.equal(blockedOptimization.state.facade.model.activeOutput?.outputKind, "image_replacement_svga");

  const reset = await session.resetImageReplacementPreview();
  assert.equal(reset.actionResult?.status, "completed");
  assert.equal(reset.state.activeOutputBytes, undefined);
  assert.equal(reset.state.facade.model.activeOutput, undefined);

  const renamed = await session.renameImageKey("img_frame", "profile_frame");
  assert.equal(renamed.actionResult?.status, "completed");
  assert.equal(renamed.actionResult?.action, "renameImageKey");
  assert.equal(renamed.state.facade.model.activeOutput?.outputKind, "renamed_svga");
  assert.ok(renamed.state.activeOutputBytes);

  const closeBlocked = await session.closeFile();
  assert.equal(closeBlocked.actionResult?.status, "blocked");
  assert.equal(closeBlocked.actionResult?.diagnostic?.code, "close_requires_discard_confirmation");
  assert.equal(closeBlocked.state.facade.model.activeOutput?.outputKind, "renamed_svga");

  const closed = await session.closeFile({ discardUnsavedChanges: true });
  assert.equal(closed.actionResult?.status, "completed");
  assert.equal(closed.state.facade.model.appState.state, "launch");
  assert.equal(closed.state.currentLocalPath, undefined);
  assert.equal(closed.state.activeOutputBytes, undefined);

  const cleared = await session.clearRecentFiles();
  assert.equal(cleared.actionResult?.status, "completed");
  assert.equal(cleared.recentPersistence.status, "saved");
  assert.equal(store.snapshot().records.length, 0);
  assert.equal(JSON.stringify(cleared.state.facade.model).includes("/Users/designer"), false);
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
  options: { loadError?: () => Error; saveError?: () => Error } = {}
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
      const error = options.loadError?.();
      if (error) throw error;
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

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
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
