import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  createShortTermColoredPng,
  createShortTermFrames,
  createShortTermOptimizableSvgaFixture,
  createShortTermSvgaFixture
} from "./helpers/short-term-svga-fixtures.js";
import {
  applyShortTermWorkbenchTextPreview,
  clearShortTermWorkbenchRecentFiles,
  closeShortTermWorkbenchFile,
  completeShortTermWorkbenchOpen,
  completeShortTermWorkbenchSave,
  createShortTermWorkbenchFacade,
  createShortTermWorkbenchSavePlan,
  createShortTermWorkbenchTextPreview,
  openShortTermWorkbenchRecentFile,
  recoverShortTermWorkbenchPlayback,
  reportShortTermWorkbenchPlaybackFailure,
  resetShortTermWorkbenchImageReplacementPreview,
  resetShortTermWorkbenchTextPreview,
  runShortTermWorkbenchImageReplacementPreview,
  runShortTermWorkbenchOptimizationCompare,
  runShortTermWorkbenchRenamePreview,
  startShortTermWorkbenchOpen
} from "../workbench/short-term-workbench-facade.js";
import type { ShortTermProductInspectionModel } from "../workbench/short-term-product-model.js";

test("short-term workbench facade creates path-redacted launch state from recent files", () => {
  const facade = createShortTermWorkbenchFacade({
    recentFiles: [
      {
        localPath: "/Users/designer/private/profile.svga",
        lastOpenedAt: "2026-07-02T00:00:00.000Z"
      }
    ]
  });

  assert.equal(facade.model.schemaVersion, 1);
  assert.equal(facade.model.source, "short-term-workbench-facade");
  assert.equal(facade.model.appState.state, "launch");
  assert.equal(facade.model.commandMenu.source, "short-term-command-menu");
  assert.deepEqual(facade.model.commandMenu.groups.map((group) => group.id), [
    "app",
    "file",
    "edit",
    "resource",
    "optimize",
    "playback",
    "view",
    "window",
    "help"
  ]);
  assert.equal(facade.model.recentFiles.launchRecentFiles.length, 1);
  assert.equal(facade.model.recentFiles.launchRecentFiles[0].displayName, "profile.svga");
  assert.equal(facade.model.recentFiles.launchRecentFiles[0].pathRedacted, true);
  assert.equal(JSON.stringify(facade.model).includes("/Users/designer"), false);
});

test("short-term workbench facade opens a file and records recent state", async () => {
  const sourceBytes = await createShortTermSvgaFixture();
  const loading = startShortTermWorkbenchOpen(createShortTermWorkbenchFacade(), {
    requestId: "open-1",
    source: "fileButton",
    localPath: "/Users/designer/private/opened.svga"
  });
  const opened = completeShortTermWorkbenchOpen(loading, {
    requestId: "open-1",
    inspection: inspectionFixture(),
    sourceBytes,
    localPath: "/Users/designer/private/opened.svga"
  });

  assert.equal(opened.model.appState.state, "previewReady");
  assert.equal(opened.model.currentSourceSha256, sha256(sourceBytes));
  assert.equal(opened.model.recentFiles.launchRecentFiles[0].displayName, "opened.svga");
  assert.equal(opened.model.appState.recentFiles[0].displayName, "opened.svga");
});

test("short-term workbench facade resolves missing recent files into recoverable app state", () => {
  const facade = createShortTermWorkbenchFacade({
    recentFiles: [
      {
        id: "missing-1",
        localPath: "/Users/designer/private/missing.svga",
        availability: "missing",
        lastOpenedAt: "2026-07-02T00:00:00.000Z"
      }
    ]
  });
  const result = openShortTermWorkbenchRecentFile(facade, "missing-1", "recentLaunch", "recent-open-1");

  assert.equal(result.resolution.status, "missing");
  assert.equal(result.state.model.appState.state, "recentFileMissing");
  assert.equal(result.state.model.activeWorkflow.kind, "recent");
  assert.equal(result.state.model.recentFiles.launchRecentFiles[0].availability, "missing");
});

test("short-term workbench facade runs optimization compare and clears save state after validated save", async () => {
  const sourceBytes = await createShortTermOptimizableSvgaFixture();
  const opened = completeShortTermWorkbenchOpen(
    startShortTermWorkbenchOpen(createShortTermWorkbenchFacade(), {
      requestId: "open-1",
      source: "menuOpen",
      displayName: "optimizable.svga"
    }),
    {
      requestId: "open-1",
      inspection: inspectionFixture(),
      sourceBytes
    }
  );
  const compared = await runShortTermWorkbenchOptimizationCompare(opened);
  const plan = createShortTermWorkbenchSavePlan(compared.state, "saveAs", {
    targetPath: "/Users/designer/private/optimized.svga"
  });

  assert.ok(compared.session.optimizedBytes);
  assert.equal(compared.state.model.activeWorkflow.kind, "optimizationCompare");
  assert.equal(compared.state.model.activeOutput?.outputKind, "optimized_svga");
  assert.equal(commandEnabled(compared.state.model.appState, "saveAs"), true);
  assert.equal(menuItemEnabled(compared.state.model, "saveAs"), true);
  assert.ok(plan);
  assert.equal(plan.targetDisplayName, "optimized.svga");

  const failedRename = await runShortTermWorkbenchRenamePreview(compared.state, "missing_key", "profile_frame");
  assert.equal(failedRename.session.model.status, "failed");
  assert.equal(failedRename.state.model.activeOutput, undefined);
  assert.equal(commandEnabled(failedRename.state.model.appState, "saveAs"), false);
  assert.equal(menuItemEnabled(failedRename.state.model, "saveAs"), false);

  const saved = completeShortTermWorkbenchSave(compared.state, plan, compared.session.optimizedBytes);
  assert.equal(saved.result.status, "saveComplete");
  assert.equal(saved.state.model.activeOutput, undefined);
  assert.equal(commandEnabled(saved.state.model.appState, "saveAs"), false);
  assert.equal(menuItemEnabled(saved.state.model, "saveAs"), false);
});

test("short-term workbench facade reports and recovers playback abnormal without clearing dirty output", async () => {
  const sourceBytes = await createShortTermOptimizableSvgaFixture();
  const opened = completeShortTermWorkbenchOpen(
    startShortTermWorkbenchOpen(createShortTermWorkbenchFacade(), {
      requestId: "open-1",
      source: "fileButton",
      displayName: "playback.svga"
    }),
    {
      requestId: "open-1",
      inspection: inspectionFixture(),
      sourceBytes
    }
  );
  const compared = await runShortTermWorkbenchOptimizationCompare(opened);
  const abnormal = reportShortTermWorkbenchPlaybackFailure(compared.state, "播放器首帧渲染失败。");

  assert.equal(abnormal.model.appState.state, "playbackAbnormal");
  assert.equal(abnormal.model.activeWorkflow.kind, "playback");
  assert.equal(abnormal.model.activeOutput?.outputKind, "optimized_svga");
  assert.equal(commandEnabled(abnormal.model.appState, "saveAs"), true);
  assert.equal(menuItemEnabled(abnormal.model, "saveAs"), true);
  assert.equal(abnormal.model.currentSourceSha256, sha256(sourceBytes));

  const recovered = recoverShortTermWorkbenchPlayback(abnormal);
  assert.equal(recovered.model.appState.state, "previewReady");
  assert.equal(recovered.model.activeWorkflow.kind, "playback");
  assert.equal(recovered.model.activeOutput?.outputKind, "optimized_svga");
  assert.equal(commandEnabled(recovered.model.appState, "saveAs"), true);
  assert.equal(recovered.model.currentSourceSha256, sha256(sourceBytes));
});

test("short-term workbench facade exposes rename, image replacement, and text preview entries", async () => {
  const sourceBytes = await createShortTermSvgaFixture({
    images: {
      img_frame: createShortTermColoredPng(16, 16, [255, 0, 0, 255]),
      img_sweep: createShortTermColoredPng(8, 16, [0, 255, 0, 255])
    },
    sprites: [
      { imageKey: "img_frame", frames: createShortTermFrames(4) },
      { imageKey: "img_sweep", frames: createShortTermFrames(4) }
    ]
  });
  const opened = completeShortTermWorkbenchOpen(
    startShortTermWorkbenchOpen(createShortTermWorkbenchFacade(), {
      requestId: "open-1",
      source: "dragDrop",
      displayName: "editable.svga"
    }),
    {
      requestId: "open-1",
      inspection: inspectionFixture(),
      sourceBytes
    }
  );

  const renamed = await runShortTermWorkbenchRenamePreview(opened, "img_frame", "profile_frame");
  assert.equal(renamed.session.model.status, "renameDirty");
  assert.equal(renamed.state.model.activeOutput?.outputKind, "renamed_svga");

  const replaced = await runShortTermWorkbenchImageReplacementPreview(
    opened,
    "img_frame",
    createShortTermColoredPng(16, 16, [0, 0, 255, 255])
  );
  assert.equal(replaced.session.model.status, "previewDirty");
  assert.equal(replaced.state.model.activeOutput?.outputKind, "image_replacement_svga");
  assert.equal(commandEnabled(replaced.state.model.appState, "resetImageReplacement"), true);
  assert.equal(menuItemEnabled(replaced.state.model, "resetImageReplacement"), true);
  const replacementReset = resetShortTermWorkbenchImageReplacementPreview(replaced.state);
  assert.equal(replacementReset.imageReplacementSession?.model.status, "ready");
  assert.equal(replacementReset.model.activeOutput, undefined);
  assert.equal(commandEnabled(replacementReset.model.appState, "saveAs"), false);
  assert.equal(commandEnabled(replacementReset.model.appState, "resetImageReplacement"), false);
  assert.equal(menuItemEnabled(replacementReset.model, "resetImageReplacement"), false);

  const textReady = createShortTermWorkbenchTextPreview(opened, [
    {
      textKey: "nickname",
      displayName: "昵称",
      supportedFields: ["text"]
    }
  ]);
  const textApplied = applyShortTermWorkbenchTextPreview(textReady, {
    textKey: "nickname",
    fields: { text: "Alice" }
  });
  const textReset = resetShortTermWorkbenchTextPreview(textApplied);
  assert.equal(textApplied.textPreviewSession?.model.status, "applied");
  assert.equal(textApplied.textPreviewSession?.model.bytePersistenceSupported, false);
  assert.equal(textApplied.textPreviewSession?.model.sourceBytesUnchanged, true);
  assert.equal(textApplied.model.activeOutput, undefined);
  assert.equal(textApplied.model.activeWorkflow.kind, "textPreview");
  assert.equal(commandEnabled(textApplied.model.appState, "resetTextPreview"), true);
  assert.equal(menuItemEnabled(textApplied.model, "resetTextPreview"), true);
  assert.equal(textReset.textPreviewSession?.model.status, "reset");
  assert.equal(textReset.textPreviewSession?.model.activeReplacement, undefined);
  assert.equal(commandEnabled(textReset.model.appState, "resetTextPreview"), false);
  assert.equal(menuItemEnabled(textReset.model, "resetTextPreview"), false);
});

test("short-term workbench facade snapshots derived state objects", async () => {
  const sourceBytes = await createShortTermSvgaFixture();
  const opened = completeShortTermWorkbenchOpen(
    startShortTermWorkbenchOpen(createShortTermWorkbenchFacade(), {
      requestId: "open-1",
      source: "fileButton",
      displayName: "snapshot.svga"
    }),
    {
      requestId: "open-1",
      inspection: inspectionFixture(),
      sourceBytes
    }
  );
  const textReady = createShortTermWorkbenchTextPreview(opened, [
    {
      textKey: "nickname",
      displayName: "昵称",
      supportedFields: ["text"]
    }
  ]);

  (opened.model.appState as { state: string }).state = "mutated-outside-facade";
  opened.model.activeWorkflow.message = "mutated source workflow";
  if (opened.sourceBytes) opened.sourceBytes[0] = (opened.sourceBytes[0] + 1) % 256;

  assert.equal(textReady.model.appState.state, "previewReady");
  assert.equal(textReady.model.activeWorkflow.message, "已发现可运行时预览的文本元素。");
  assert.equal(textReady.model.currentSourceSha256, sha256(sourceBytes));
  assert.equal(JSON.stringify(textReady.model).includes("mutated-outside-facade"), false);
});

test("short-term workbench facade clears recent files without touching source bytes", async () => {
  const sourceBytes = await createShortTermSvgaFixture();
  const opened = completeShortTermWorkbenchOpen(
    startShortTermWorkbenchOpen(createShortTermWorkbenchFacade(), {
      requestId: "open-1",
      source: "fileButton",
      localPath: "/Users/designer/private/opened.svga"
    }),
    {
      requestId: "open-1",
      inspection: inspectionFixture(),
      sourceBytes,
      localPath: "/Users/designer/private/opened.svga"
    }
  );
  const cleared = clearShortTermWorkbenchRecentFiles(opened);

  assert.equal(cleared.model.recentFiles.launchRecentFiles.length, 0);
  assert.equal(cleared.model.appState.recentFiles.length, 0);
  assert.equal(cleared.model.currentSourceSha256, sha256(sourceBytes));
});

test("short-term workbench facade closes current file while keeping recent records", async () => {
  const sourceBytes = await createShortTermSvgaFixture();
  const opened = completeShortTermWorkbenchOpen(
    startShortTermWorkbenchOpen(createShortTermWorkbenchFacade(), {
      requestId: "open-1",
      source: "menuOpen",
      localPath: "/Users/designer/private/opened.svga"
    }),
    {
      requestId: "open-1",
      inspection: inspectionFixture(),
      sourceBytes,
      localPath: "/Users/designer/private/opened.svga"
    }
  );
  const closed = closeShortTermWorkbenchFile(opened);

  assert.equal(closed.model.appState.state, "launch");
  assert.equal(closed.model.activeWorkflow.kind, "none");
  assert.equal(closed.sourceBytes, undefined);
  assert.equal(closed.model.activeOutput, undefined);
  assert.equal(closed.model.currentSourceSha256, undefined);
  assert.equal(closed.model.recentFiles.launchRecentFiles[0].displayName, "opened.svga");
  assert.equal(commandEnabled(closed.model.appState, "closeFile"), false);
  assert.equal(JSON.stringify(closed.model).includes("/Users/designer"), false);
});

function commandEnabled(state: { commands: readonly { id: string; enabled: boolean }[] }, id: string): boolean {
  const command = state.commands.find((item) => item.id === id);
  assert.ok(command, `missing command ${id}`);
  return command.enabled;
}

function menuItemEnabled(
  model: { commandMenu: { groups: readonly { items: readonly { id: string; enabled?: boolean; items?: readonly { id: string; enabled?: boolean }[] }[] }[] } },
  id: string
): boolean | undefined {
  const items = model.commandMenu.groups.flatMap((group) => group.items.flatMap((item) => [
    item,
    ...(item.items ?? [])
  ]));
  const item = items.find((entry) => entry.id === id);
  assert.ok(item, `missing menu item ${id}`);
  return item.enabled;
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

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
