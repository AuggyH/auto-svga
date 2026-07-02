import assert from "node:assert/strict";
import path from "node:path";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import test from "node:test";
import protobuf from "protobufjs";
import {
  createTransparentImage,
  encodeRgbaPng,
  setPixel
} from "../utils/png-writer.js";
import {
  createShortTermHostActionState,
  dispatchShortTermHostMenuAction,
  openShortTermHostLocalFile,
  openShortTermHostRecentFile,
  type ShortTermHostEnvironment
} from "../workbench/short-term-host-actions.js";
import type { ShortTermProductInspectionModel } from "../workbench/short-term-product-model.js";

test("short-term host actions open local files through the facade without exposing local paths", async () => {
  const sourceBytes = await createSvgaFixture();
  const host = createMemoryHost({
    "/Users/designer/private/opened.svga": sourceBytes
  });

  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "menuOpen",
    localPath: "/Users/designer/private/opened.svga"
  });

  assert.equal(opened.facade.model.appState.state, "previewReady");
  assert.equal(opened.currentLocalPath, "/Users/designer/private/opened.svga");
  assert.equal(opened.lastAction?.status, "completed");
  assert.equal(opened.facade.model.recentFiles.launchRecentFiles[0].displayName, "opened.svga");
  assert.equal(JSON.stringify(opened.facade.model).includes("/Users/designer"), false);
});

test("short-term host actions mark unavailable recent files without stale source state", async () => {
  const host = createMemoryHost({}, {
    exists: () => false
  });
  const state = createShortTermHostActionState({
    recentFiles: [
      {
        id: "recent-missing",
        localPath: "/Users/designer/private/missing.svga",
        lastOpenedAt: "2026-07-02T00:00:00.000Z"
      }
    ]
  });

  const opened = await openShortTermHostRecentFile(state, host, {
    requestId: "recent-1",
    recentFileId: "recent-missing",
    source: "recentMenu"
  });

  assert.equal(opened.facade.model.appState.state, "recentFileMissing");
  assert.equal(opened.currentLocalPath, undefined);
  assert.equal(opened.activeOutputBytes, undefined);
  assert.equal(opened.lastAction?.status, "failed");
  assert.equal(opened.facade.model.recentFiles.menuRecentFiles[0].availability, "missing");
  assert.equal(JSON.stringify(opened.facade.model).includes("/Users/designer"), false);
});

test("short-term host actions redact local paths from host error diagnostics", async () => {
  const host = createMemoryHost({}, {
    readError: () => new Error("Cannot read /Users/designer/private/broken.svga")
  });

  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: "/Users/designer/private/broken.svga"
  });

  assert.equal(opened.facade.model.appState.state, "loadFailed");
  assert.equal(opened.lastAction?.status, "failed");
  assert.equal(opened.lastAction?.diagnostic?.message.includes("/Users/designer"), false);
  assert.equal(JSON.stringify(opened.facade.model).includes("/Users/designer"), false);
});

test("short-term host actions run optimization and Save As through write-read validation", async () => {
  const sourceBytes = await createOptimizableSvgaFixture();
  const host = createMemoryHost({
    "/Users/designer/private/optimizable.svga": sourceBytes
  });
  const opened = await dispatchShortTermHostMenuAction(createShortTermHostActionState(), host, {
    commandId: "openSvga",
    requestId: "open-1",
    localPath: "/Users/designer/private/optimizable.svga"
  });
  const optimized = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "runOptimization"
  });

  assert.equal(optimized.lastAction?.status, "completed");
  assert.ok(optimized.activeOutputBytes);
  assert.equal(commandEnabled(optimized, "saveAs"), true);
  assert.equal(menuItemEnabled(optimized, "saveAs"), true);

  const saved = await dispatchShortTermHostMenuAction(optimized, host, {
    commandId: "saveAs",
    targetPath: "/Users/designer/private/optimized.svga"
  });

  assert.equal(saved.lastAction?.status, "completed");
  assert.equal(saved.lastAction?.targetDisplayName, "optimized.svga");
  assert.equal(saved.activeOutputBytes, undefined);
  assert.equal(commandEnabled(saved, "saveAs"), false);
  assert.equal(menuItemEnabled(saved, "saveAs"), false);
  assert.equal(sha256(host.snapshot("/Users/designer/private/optimized.svga")), saved.lastAction?.outputSha256);
  assert.equal(JSON.stringify(saved.facade.model).includes("/Users/designer"), false);
});

test("short-term host actions keep dirty output when saved bytes fail read-back validation", async () => {
  const sourceBytes = await createOptimizableSvgaFixture();
  const host = createMemoryHost({
    "/Users/designer/private/optimizable.svga": sourceBytes
  }, {
    readSavedOverride: () => new Uint8Array([9, 9, 9])
  });
  const opened = await openShortTermHostLocalFile(createShortTermHostActionState(), host, {
    requestId: "open-1",
    source: "fileButton",
    localPath: "/Users/designer/private/optimizable.svga"
  });
  const optimized = await dispatchShortTermHostMenuAction(opened, host, {
    commandId: "runOptimization"
  });
  const saved = await dispatchShortTermHostMenuAction(optimized, host, {
    commandId: "saveAs",
    targetPath: "/Users/designer/private/optimized.svga"
  });

  assert.equal(saved.lastAction?.status, "failed");
  assert.match(saved.facade.model.activeWorkflow.message, /未匹配已验证输出/);
  assert.ok(saved.activeOutputBytes);
  assert.ok(saved.facade.model.activeOutput);
  assert.equal(commandEnabled(saved, "saveAs"), true);
});

test("short-term host actions block disabled or unrouted menu commands", async () => {
  const host = createMemoryHost({});
  const state = createShortTermHostActionState();

  const clearBlocked = await dispatchShortTermHostMenuAction(state, host, {
    commandId: "clearRecent"
  });
  assert.equal(clearBlocked.lastAction?.status, "blocked");
  assert.equal(clearBlocked.lastAction?.diagnostic?.code, "menu_command_disabled");

  const unknownBlocked = await dispatchShortTermHostMenuAction(state, host, {
    commandId: "showLogs"
  });
  assert.equal(unknownBlocked.lastAction?.status, "blocked");
  assert.equal(unknownBlocked.lastAction?.diagnostic?.code, "menu_command_disabled");
});

function createMemoryHost(
  initialFiles: Record<string, Uint8Array>,
  options: {
    exists?: (localPath: string) => boolean;
    readError?: (localPath: string) => Error;
    inspect?: (input: { bytes: Uint8Array; displayName: string; localPath?: string }) => ShortTermProductInspectionModel;
    readSavedOverride?: (localPath: string) => Uint8Array;
  } = {}
): ShortTermHostEnvironment & { snapshot(localPath: string): Uint8Array } {
  const files = new Map(Object.entries(initialFiles).map(([key, value]) => [key, new Uint8Array(value)]));
  return {
    async readLocalFile(localPath) {
      const readError = options.readError?.(localPath);
      if (readError) throw readError;
      const bytes = files.get(localPath);
      if (!bytes) throw new Error("File is missing.");
      return {
        bytes: new Uint8Array(bytes),
        displayName: path.basename(localPath)
      };
    },
    async inspectSvga(input) {
      return options.inspect?.(input) ?? inspectionFixture();
    },
    async writeLocalFile(localPath, bytes) {
      files.set(localPath, new Uint8Array(bytes));
    },
    async readSavedFile(localPath) {
      const override = options.readSavedOverride?.(localPath);
      if (override) return new Uint8Array(override);
      const bytes = files.get(localPath);
      if (!bytes) throw new Error("Saved file is missing.");
      return new Uint8Array(bytes);
    },
    async fileExists(localPath) {
      return options.exists ? options.exists(localPath) : files.has(localPath);
    },
    snapshot(localPath) {
      const bytes = files.get(localPath);
      assert.ok(bytes, `missing snapshot ${localPath}`);
      return new Uint8Array(bytes);
    }
  };
}

async function createOptimizableSvgaFixture(): Promise<Uint8Array> {
  return createSvgaFixture({
    images: {
      img_frame: createColoredPng(16, 16, [255, 0, 0, 255]),
      img_frame_copy: createColoredPng(16, 16, [255, 0, 0, 255]),
      img_unused: createColoredPng(4, 4, [0, 0, 255, 255])
    },
    sprites: [
      { imageKey: "img_frame", frames: createFrames(4) },
      { imageKey: "img_frame_copy", frames: createFrames(4) }
    ]
  });
}

async function createSvgaFixture(overrides: Partial<{
  version: string;
  params: {
    viewBoxWidth: number;
    viewBoxHeight: number;
    fps: number;
    frames: number;
  };
  images: Record<string, Uint8Array>;
  sprites: Array<{
    imageKey?: string;
    frames?: unknown[];
    matteKey?: string;
  }>;
  audios: unknown[];
}> = {}): Promise<Uint8Array> {
  const root = await protobuf.load(protoPath());
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const payload = {
    version: overrides.version ?? "2.0",
    params: overrides.params ?? {
      viewBoxWidth: 128,
      viewBoxHeight: 128,
      fps: 24,
      frames: 48
    },
    images: overrides.images ?? {
      img_frame: createColoredPng(16, 16, [255, 0, 0, 255])
    },
    sprites: overrides.sprites ?? [
      { imageKey: "img_frame", frames: createFrames(4) }
    ],
    audios: overrides.audios ?? []
  };
  const verificationError = MovieEntity.verify(payload);
  assert.equal(verificationError, null);
  return deflateSync(MovieEntity.encode(MovieEntity.create(payload)).finish());
}

function createFrames(count: number): unknown[] {
  return Array.from({ length: count }, (_, index) => ({
    alpha: index % 2 === 0 ? 1 : 0.8,
    layout: { x: 1, y: 2, width: 10, height: 11 },
    transform: { a: 1, b: 0, c: 0, d: 1, tx: index, ty: index + 1 },
    clipPath: "",
    shapes: []
  }));
}

function createColoredPng(width: number, height: number, rgba: [number, number, number, number]): Buffer {
  const image = createTransparentImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(image, x, y, rgba);
    }
  }
  return encodeRgbaPng(image);
}

function commandEnabled(state: { facade: { model: { appState: { commands: readonly { id: string; enabled: boolean }[] } } } }, id: string): boolean {
  const command = state.facade.model.appState.commands.find((item) => item.id === id);
  assert.ok(command, `missing command ${id}`);
  return command.enabled;
}

function menuItemEnabled(
  state: { facade: { model: { commandMenu: { groups: readonly { items: readonly { id: string; enabled?: boolean; items?: readonly { id: string; enabled?: boolean }[] }[] }[] } } } },
  id: string
): boolean | undefined {
  const items = state.facade.model.commandMenu.groups.flatMap((group) => group.items.flatMap((item) => [
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

function protoPath(): string {
  return fileURLToPath(new URL("../../proto/svga.proto", import.meta.url));
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
