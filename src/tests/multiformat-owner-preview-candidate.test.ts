import assert from "node:assert/strict";
import test from "node:test";

import type {
  FormatAdapter,
  FormatProbeResult,
  MotionAssetInfo,
  MotionAssetSource,
  PlaybackAdapter,
  PlaybackSession,
  PlaybackState,
  WorkbenchOperationContext,
  WorkbenchResult
} from "../workbench/contracts.js";
import type {
  LottieSvgAnimationItem,
  LottieSvgLoadOptions,
  LottieSvgRendererModule
} from "../workbench/lottie-svg-playback-adapter.js";
import {
  OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
  createOwnerVisibleMultiFormatPreviewCandidate,
  type OwnerVisibleSvgaReplacementController
} from "../workbench/multiformat-owner-preview-candidate.js";
import type {
  HiddenMultiFormatPreviewHost
} from "../workbench/multiformat-preview-workspace.js";
import type {
  VapRuntimeConfig,
  VapRuntimeConstructor,
  VapRuntimePlayer
} from "../workbench/vap-web-playback-adapter.js";

const textEncoder = new TextEncoder();

test("owner-visible 0.2 candidate requires the explicit gate before host reads", async () => {
  const localPath = "/Users/designer/private/title.json";
  const host = memoryHost({ [localPath]: minimalLottie() });
  const session = createOwnerVisibleMultiFormatPreviewCandidate({
    host,
    lottieTarget: { container: {} },
    lottieRendererLoader: async () => fakeLottieRenderer()
  });

  const model = await session.openLocalCandidate({
    gate: "0.1",
    requestId: "open-1",
    source: "fileButton",
    localPath
  });

  assert.equal(model.status, "failed");
  assert.equal(model.visibleIn01, false);
  assert.equal(model.supportClaim, false);
  assert.equal(model.packageReadiness.packagePromotionAllowed, false);
  assert.equal(host.statCalls, 0);
  assertNoLocalPaths(model);
});

test("owner-visible 0.2 candidate applies and resets Lottie image and text runtime replacements", async () => {
  const localPath = "/Users/designer/private/card.json";
  const loadCalls: LottieSvgLoadOptions[] = [];
  const host = memoryHost({
    [localPath]: minimalLottie({
      assets: [{ id: "avatar", u: "images", p: "avatar.png", w: 20, h: 20 }],
      layers: [
        { ind: 1, ty: 2, nm: "Avatar", refId: "avatar" },
        { ind: 2, ty: 5, nm: "Title", t: { d: { k: [{ s: { t: "Hello" } }] } } }
      ]
    }),
    [`${localPath}::images/avatar.png`]: Uint8Array.from([1, 2, 3])
  });
  const session = createOwnerVisibleMultiFormatPreviewCandidate({
    host,
    lottieTarget: { container: { id: "lottie-target" } },
    lottieRendererLoader: async () => fakeLottieRenderer(loadCalls)
  });

  const opened = await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "open-lottie",
    source: "dragDrop",
    localPath,
    displayName: localPath
  });

  assert.equal(opened.status, "previewReady");
  assert.equal(opened.detectedFormat, "lottie");
  assert.equal(opened.productVersion, "0.2.0-alpha.2");
  assert.equal(opened.rightPanel.lottieTexts[0]?.initialText, "Hello");
  assert.equal(opened.rightPanel.assetInventory.summary.imageCount, 1);
  assert.equal(opened.rightPanel.assetInventory.summary.textCount, 1);
  assert.equal(opened.rightPanel.assetInventory.groups.find(({ id }) => id === "vap_fusion_images")?.status, "not_applicable");
  assert.equal(loadCalls.length, 1);

  const textApplied = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "replace-text",
    targetId: "text:2",
    kind: "text",
    value: "Welcome"
  });

  assert.equal(textApplied.status, "previewReady");
  assert.equal(textApplied.replacement.dirty, true);
  assert.equal(textApplied.replacement.active[0]?.targetId, "text:2");
  assert.equal(textApplied.replacement.lastAction?.status, "accepted");
  assert.equal(loadCalls.length, 2);
  assert.equal(lottieText(loadCalls[1]?.animationData, 2), "Welcome");

  const imageApplied = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "replace-image",
    targetId: "avatar",
    kind: "image",
    value: "data:image/png;base64,QUJD"
  });

  assert.equal(imageApplied.replacement.active.length, 2);
  assert.equal(imageApplied.replacement.playerAction, "reloadPreview");
  assert.equal(lottieAssetPath(loadCalls[2]?.animationData, "avatar"), "data:image/png;base64,QUJD");
  assert.equal(lottieText(loadCalls[2]?.animationData, 2), "Welcome");
  assertNoLocalPaths(imageApplied);

  const reset = await session.resetReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "reset-lottie"
  });

  assert.equal(reset.replacement.dirty, false);
  assert.equal(reset.replacement.resetEnabled, false);
  assert.equal(reset.replacement.playerAction, "remountSource");
  assert.equal(lottieText(loadCalls[3]?.animationData, 2), "Hello");
});

test("owner-visible 0.2 candidate fails Lottie reset closed when the original source cannot reopen", async () => {
  const localPath = "/Users/designer/private/card.json";
  const loadCalls: LottieSvgLoadOptions[] = [];
  const files: Record<string, Uint8Array> = {
    [localPath]: minimalLottie({
      assets: [{ id: "avatar", p: "avatar.png", w: 20, h: 20 }],
      layers: [{ ind: 1, ty: 2, nm: "Avatar", refId: "avatar" }]
    }),
    [`${localPath}::avatar.png`]: Uint8Array.from([1, 2, 3])
  };
  const session = createOwnerVisibleMultiFormatPreviewCandidate({
    host: memoryHost(files),
    lottieTarget: { container: {} },
    lottieRendererLoader: async () => fakeLottieRenderer(loadCalls)
  });

  await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "open-lottie",
    source: "fileButton",
    localPath
  });
  const applied = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "replace-lottie",
    targetId: "avatar",
    kind: "image",
    value: "data:image/png;base64,QUJD"
  });
  assert.equal(applied.replacement.dirty, true);
  assert.equal(loadCalls.length, 2);

  delete files[localPath];
  const reset = await session.resetReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "reset-missing-lottie"
  });

  assert.equal(reset.status, "previewReady");
  assert.equal(reset.replacement.status, "failed");
  assert.equal(reset.replacement.dirty, true);
  assert.equal(reset.replacement.resetEnabled, true);
  assert.equal(reset.replacement.active[0]?.targetId, "avatar");
  assert.equal(reset.replacement.lastAction?.type, "resetReplacement");
  assert.equal(reset.replacement.lastAction?.status, "failed");
  assert.equal(reset.replacement.lastAction?.diagnostic?.code, "parse_precondition");
  assert.equal(reset.replacement.playerAction, "keepCurrentPreview");
  assert.equal(loadCalls.length, 2);
  assert.equal(lottieAssetPath(loadCalls[1]?.animationData, "avatar"), "data:image/png;base64,QUJD");
  assertNoLocalPaths(reset);
});

test("owner-visible 0.2 candidate fails Lottie reset before renderer mutation when an adjacent resource is missing", async () => {
  const localPath = "/Users/designer/private/card.json";
  const loadCalls: LottieSvgLoadOptions[] = [];
  const rendererEvents: string[] = [];
  const files: Record<string, Uint8Array> = {
    [localPath]: minimalLottie({
      assets: [{ id: "avatar", p: "avatar.png", w: 20, h: 20 }],
      layers: [{ ind: 1, ty: 2, nm: "Avatar", refId: "avatar" }]
    }),
    [`${localPath}::avatar.png`]: Uint8Array.from([1, 2, 3])
  };
  const session = createOwnerVisibleMultiFormatPreviewCandidate({
    host: memoryHost(files),
    lottieTarget: { container: {} },
    lottieRendererLoader: async () => fakeLottieRenderer(loadCalls, rendererEvents)
  });

  await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "open-lottie",
    source: "fileButton",
    localPath
  });
  const applied = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "replace-lottie",
    targetId: "avatar",
    kind: "image",
    value: "data:image/png;base64,QUJD"
  });
  assert.equal(applied.replacement.dirty, true);
  assert.equal(loadCalls.length, 2);
  const rendererEventsBeforeReset = rendererEvents.length;

  delete files[`${localPath}::avatar.png`];
  const reset = await session.resetReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "reset-missing-adjacent"
  });

  assert.equal(reset.status, "previewReady");
  assert.equal(reset.replacement.status, "failed");
  assert.equal(reset.replacement.dirty, true);
  assert.equal(reset.replacement.resetEnabled, true);
  assert.equal(reset.replacement.active[0]?.targetId, "avatar");
  assert.equal(reset.replacement.lastAction?.type, "resetReplacement");
  assert.equal(reset.replacement.lastAction?.status, "failed");
  assert.equal(reset.replacement.lastAction?.diagnostic?.code, "missing_resource");
  assert.equal(reset.replacement.playerAction, "keepCurrentPreview");
  assert.equal(loadCalls.length, 2);
  assert.equal(rendererEvents.length, rendererEventsBeforeReset);
  assert.equal(lottieAssetPath(loadCalls[1]?.animationData, "avatar"), "data:image/png;base64,QUJD");
  assert.equal((await session.play()).status, "playing");
  assertNoLocalPaths(reset);
});

test("owner-visible 0.2 candidate rolls back Lottie reset when renderer reload fails after preflight", async () => {
  const localPath = "/Users/designer/private/card.json";
  const loadCalls: LottieSvgLoadOptions[] = [];
  const rendererEvents: string[] = [];
  let rendererLoadCount = 0;
  const host = memoryHost({
    [localPath]: minimalLottie({
      assets: [{ id: "avatar", p: "avatar.png", w: 20, h: 20 }],
      layers: [{ ind: 1, ty: 2, nm: "Avatar", refId: "avatar" }]
    }),
    [`${localPath}::avatar.png`]: Uint8Array.from([1, 2, 3])
  });
  const session = createOwnerVisibleMultiFormatPreviewCandidate({
    host,
    lottieTarget: { container: {} },
    lottieRendererLoader: async () => ({
      loadAnimation(options) {
        rendererLoadCount += 1;
        loadCalls.push(options);
        if (rendererLoadCount === 3) {
          throw new Error("reset renderer failed");
        }
        return new FakeLottieAnimation(rendererEvents);
      }
    })
  });

  await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "open-lottie",
    source: "fileButton",
    localPath
  });
  const applied = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "replace-lottie",
    targetId: "avatar",
    kind: "image",
    value: "data:image/png;base64,QUJD"
  });
  assert.equal(applied.replacement.dirty, true);
  assert.equal(lottieAssetPath(loadCalls[1]?.animationData, "avatar"), "data:image/png;base64,QUJD");

  const reset = await session.resetReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "reset-renderer-fails"
  });

  assert.equal(reset.status, "previewReady");
  assert.equal(reset.replacement.status, "failed");
  assert.equal(reset.replacement.dirty, true);
  assert.equal(reset.replacement.resetEnabled, true);
  assert.equal(reset.replacement.active[0]?.targetId, "avatar");
  assert.equal(reset.replacement.lastAction?.type, "resetReplacement");
  assert.equal(reset.replacement.lastAction?.status, "failed");
  assert.equal(reset.replacement.lastAction?.diagnostic?.code, "playback_failure");
  assert.equal(reset.replacement.playerAction, "keepCurrentPreview");
  assert.equal(loadCalls.length, 4);
  assert.equal(lottieAssetPath(loadCalls[3]?.animationData, "avatar"), "data:image/png;base64,QUJD");
  assert.equal((await session.play()).status, "playing");
  assertNoLocalPaths(reset);
});

test("owner-visible 0.2 candidate applies and resets VAP fusion runtime replacements", async () => {
  const localPath = "/Users/designer/private/fusion.mp4";
  const runtime = fakeVapRuntime();
  const host = memoryHost({ [localPath]: validVapBytes(fusionImageConfig()) });
  const session = createOwnerVisibleMultiFormatPreviewCandidate({
    host,
    vapTarget: { id: "vap-target" },
    vapHostReadiness: readyVapHost(),
    vapRuntimeLoader: async () => runtime.constructor
  });

  const opened = await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "open-vap",
    source: "menuOpen",
    localPath
  });

  assert.equal(opened.detectedFormat, "vap");
  assert.equal(opened.status, "playbackBlocked");
  assert.equal(opened.rightPanel.vapFusionImages[0]?.srcTag, "avatar");
  assert.equal(opened.rightPanel.assetInventory.summary.imageCount, 1);
  assert.equal(opened.rightPanel.assetInventory.summary.audioVideoCount, 2);
  assert.equal(opened.rightPanel.assetInventory.groups.find(({ id }) => id === "text_candidates")?.status, "not_applicable");
  assert.equal(runtime.configs.length, 0);

  const applied = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "replace-vap",
    targetId: "avatar",
    kind: "image",
    value: "data:image/png;base64,QUJD"
  });

  assert.equal(applied.status, "previewReady");
  assert.equal(applied.replacement.dirty, true);
  assert.equal(applied.replacement.active[0]?.targetId, "avatar");
  assert.equal(runtime.configs[0]?.src, "blob:vap/fusion.mp4");
  assert.equal(runtime.configs[0]?.avatar, "data:image/png;base64,QUJD");
  assert.equal(runtime.configs[0]?.precache, false);

  const reset = await session.resetReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "reset-vap"
  });
  assert.equal(reset.status, "playbackBlocked");
  assert.equal(reset.replacement.dirty, false);
  assert.equal(reset.replacement.lastAction?.status, "accepted");
  assert.equal(reset.rightPanel.issues.some((entry) =>
    entry.code === "missing_resource" && entry.details?.reason === "fusion_replacement_required"
  ), true);
  assert.equal(host.revoked.includes("blob:vap/fusion.mp4"), true);
  assertNoLocalPaths(reset);
});

test("owner-visible 0.2 candidate fails VAP reset closed when the original source cannot reopen", async () => {
  const localPath = "/Users/designer/private/fusion.mp4";
  const runtime = fakeVapRuntime();
  const files: Record<string, Uint8Array> = {
    [localPath]: validVapBytes(fusionImageConfig())
  };
  const host = memoryHost(files);
  const session = createOwnerVisibleMultiFormatPreviewCandidate({
    host,
    vapTarget: {},
    vapHostReadiness: readyVapHost(),
    vapRuntimeLoader: async () => runtime.constructor
  });

  await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "open-vap",
    source: "menuOpen",
    localPath
  });
  const applied = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "replace-vap",
    targetId: "avatar",
    kind: "image",
    value: "data:image/png;base64,QUJD"
  });
  assert.equal(applied.replacement.dirty, true);
  assert.equal(runtime.configs.length, 1);

  delete files[localPath];
  const reset = await session.resetReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "reset-missing-vap"
  });

  assert.equal(reset.status, "previewReady");
  assert.equal(reset.replacement.status, "failed");
  assert.equal(reset.replacement.dirty, true);
  assert.equal(reset.replacement.resetEnabled, true);
  assert.equal(reset.replacement.active[0]?.targetId, "avatar");
  assert.equal(reset.replacement.lastAction?.type, "resetReplacement");
  assert.equal(reset.replacement.lastAction?.status, "failed");
  assert.equal(reset.replacement.lastAction?.diagnostic?.code, "parse_precondition");
  assert.equal(reset.replacement.playerAction, "keepCurrentPreview");
  assert.equal(runtime.configs.length, 1);
  assert.equal(host.revoked.includes("blob:vap/fusion.mp4"), false);
  assertNoLocalPaths(reset);
});

test("owner-visible 0.2 candidate delegates SVGA imageKey replacement without changing 0.1 surfaces", async () => {
  const localPath = "/Users/designer/private/frame.svga";
  const controllerCalls: string[] = [];
  const controller: OwnerVisibleSvgaReplacementController = {
    async applyImage(input) {
      controllerCalls.push(`apply:${input.targetId}`);
      return {
        accepted: true,
        message: "SVGA replacement preview remounted.",
        playerAction: "remountPreview",
        playback: playbackState("ready", 2_000)
      };
    },
    async reset() {
      controllerCalls.push("reset");
      return {
        accepted: true,
        message: "SVGA replacement preview reset.",
        playerAction: "remountSource",
        playback: playbackState("ready", 2_000)
      };
    }
  };
  const session = createOwnerVisibleMultiFormatPreviewCandidate({
    host: memoryHost({ [localPath]: svgaHintBytes() }),
    svgaAdapter: new FakeSvgaAdapter(),
    svgaPlaybackAdapter: new FakePlaybackAdapter(),
    svgaPlaybackTarget: { id: "svga-target" },
    svgaReplacementController: controller
  });

  const opened = await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "open-svga",
    source: "fileButton",
    localPath
  });

  assert.equal(opened.status, "previewReady");
  assert.equal(opened.detectedFormat, "svga");
  assert.equal(opened.rightPanel.assets[0]?.id, "img_frame");
  assert.equal(opened.rightPanel.assetInventory.summary.imageCount, 1);
  assert.equal(opened.rightPanel.assetInventory.groups.find(({ id }) => id === "vap_fusion_images")?.status, "not_applicable");
  assert.equal((await session.play()).status, "playing");
  assert.equal(session.pause().status, "paused");
  assert.equal(session.seek(500).canvas.playback.currentTimeMs, 500);
  assert.equal(session.setLoop(true).canvas.playback.loop, true);

  const applied = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "replace-svga",
    targetId: "img_frame",
    kind: "image",
    value: "data:image/png;base64,QUJD"
  });

  assert.equal(applied.replacement.dirty, true);
  assert.equal(applied.replacement.playerAction, "remountPreview");
  assert.deepEqual(controllerCalls, ["apply:img_frame"]);

  const reset = await session.resetReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "reset-svga"
  });
  assert.equal(reset.replacement.dirty, false);
  assert.equal(reset.replacement.playerAction, "remountSource");
  assert.deepEqual(controllerCalls, ["apply:img_frame", "reset"]);

  const commandMenu = await import("../workbench/short-term-command-menu.js");
  const appState = await import("../workbench/short-term-app-state.js");
  const commandText = commandMenu.flattenShortTermCommandMenuItems(
    commandMenu.createShortTermCommandMenuModel(appState.createShortTermLaunchAppState())
  ).flatMap((item) => [item.id, item.label, item.sourceCommandId])
    .filter((value): value is string => typeof value === "string")
    .join("\n");
  assert.doesNotMatch(commandText, /vap|lottie|format|import[-_ ]?package|格式|导入包/iu);
});

test("owner-visible 0.2 candidate blocks unsafe replacement values without renderer mutation", async () => {
  const localPath = "/Users/designer/private/card.json";
  const loadCalls: LottieSvgLoadOptions[] = [];
  const session = createOwnerVisibleMultiFormatPreviewCandidate({
    host: memoryHost({
      [localPath]: minimalLottie({
        assets: [{ id: "avatar", p: "avatar.png", w: 20, h: 20 }],
        layers: [{ ind: 1, ty: 2, nm: "Avatar", refId: "avatar" }]
      }),
      [`${localPath}::avatar.png`]: Uint8Array.from([1, 2, 3])
    }),
    lottieTarget: { container: {} },
    lottieRendererLoader: async () => fakeLottieRenderer(loadCalls)
  });

  await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "open-lottie",
    source: "fileButton",
    localPath
  });
  const blocked = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "unsafe",
    targetId: "avatar",
    kind: "image",
    value: "https://cdn.example.invalid/avatar.png"
  });

  assert.equal(blocked.replacement.status, "blocked");
  assert.equal(blocked.replacement.lastAction?.diagnostic?.code, "unsupported_feature");
  assert.equal(loadCalls.length, 1);
  assertNoLocalPaths(blocked);
});

test("owner-visible 0.2 candidate prevents stale replacement renderer mutation after a newer open wins", async () => {
  const lottiePath = "/Users/designer/private/card.json";
  const svgaPath = "/Users/designer/private/frame.svga";
  const rendererGate = deferred<void>();
  const loadLabels: string[] = [];
  let loaderCalls = 0;
  let staleLoaderBlocked = false;
  const session = createOwnerVisibleMultiFormatPreviewCandidate({
    host: memoryHost({
      [lottiePath]: minimalLottie({
        assets: [{ id: "avatar", p: "avatar.png", w: 20, h: 20 }],
        layers: [{ ind: 1, ty: 2, nm: "Avatar", refId: "avatar" }]
      }),
      [`${lottiePath}::avatar.png`]: Uint8Array.from([1, 2, 3]),
      [svgaPath]: svgaHintBytes()
    }),
    lottieTarget: { container: {} },
    lottieRendererLoader: async () => {
      loaderCalls += 1;
      if (loaderCalls === 2) {
        staleLoaderBlocked = true;
        await rendererGate.promise;
        return labeledLottieRenderer("stale-replacement", loadLabels);
      }
      return labeledLottieRenderer("initial", loadLabels);
    },
    svgaAdapter: new FakeSvgaAdapter(),
    svgaPlaybackAdapter: new FakePlaybackAdapter(),
    svgaPlaybackTarget: {}
  });

  const opened = await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "open-lottie",
    source: "fileButton",
    localPath: lottiePath
  });
  assert.equal(opened.detectedFormat, "lottie");
  assert.deepEqual(loadLabels, ["initial"]);

  const staleReplacement = session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "replace-stale",
    targetId: "avatar",
    kind: "image",
    value: "data:image/png;base64,QUJD"
  });
  await waitUntil(() => staleLoaderBlocked);

  const fastOpen = await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "open-svga",
    source: "dragDrop",
    localPath: svgaPath
  });
  assert.equal(fastOpen.detectedFormat, "svga");
  assert.equal(fastOpen.replacement.dirty, false);

  rendererGate.resolve();
  const staleReturn = await staleReplacement;
  const finalModel = session.getModel();

  assert.equal(staleReturn.requestId, "open-svga");
  assert.equal(finalModel.requestId, "open-svga");
  assert.equal(finalModel.detectedFormat, "svga");
  assert.equal(finalModel.replacement.dirty, false);
  assert.deepEqual(loadLabels, ["initial"]);
  assertNoLocalPaths(finalModel);
});

interface MemoryHost extends HiddenMultiFormatPreviewHost {
  statCalls: number;
  rangeReads: Array<{ localPath: string; offset: number; length: number }>;
  resourceReads: Array<{ sourceLocalPath: string; relativePath: string; maxBytes: number }>;
  objectUrlCreates: string[];
  revoked: string[];
}

function memoryHost(files: Record<string, Uint8Array>): MemoryHost {
  const host: MemoryHost = {
    statCalls: 0,
    rangeReads: [],
    resourceReads: [],
    objectUrlCreates: [],
    revoked: [],
    async statLocalFile(localPath) {
      host.statCalls += 1;
      const bytes = files[localPath];
      if (!bytes) throw new Error(`Cannot stat ${localPath}`);
      return {
        sizeBytes: bytes.byteLength,
        displayName: localPath.split(/[\\/]/u).at(-1),
        mediaType: mediaTypeFromPath(localPath)
      };
    },
    async readLocalFileRange(localPath, offset, length) {
      host.rangeReads.push({ localPath, offset, length });
      const bytes = files[localPath];
      if (!bytes) throw new Error(`Cannot read ${localPath}`);
      return bytes.slice(offset, offset + length);
    },
    async readAdjacentResource(input) {
      host.resourceReads.push(input);
      const bytes = files[`${input.sourceLocalPath}::${input.relativePath}`];
      if (!bytes) throw new Error(`Cannot read ${input.sourceLocalPath}/${input.relativePath}`);
      return {
        bytes,
        sizeBytes: bytes.byteLength,
        mediaType: mediaTypeFromPath(input.relativePath)
      };
    },
    async createLocalObjectUrl(input) {
      host.objectUrlCreates.push(input.localPath);
      const objectUrl = `blob:vap/${input.localPath.split(/[\\/]/u).at(-1) ?? "effect.mp4"}`;
      return {
        objectUrl,
        revoke() {
          host.revoked.push(objectUrl);
        }
      };
    }
  };
  return host;
}

function fakeLottieRenderer(
  loadCalls: LottieSvgLoadOptions[] = [],
  events: string[] = []
): LottieSvgRendererModule {
  return {
    loadAnimation(options) {
      loadCalls.push(options);
      return new FakeLottieAnimation(events);
    }
  };
}

function labeledLottieRenderer(label: string, loadLabels: string[]): LottieSvgRendererModule {
  return {
    loadAnimation() {
      loadLabels.push(label);
      return new FakeLottieAnimation();
    }
  };
}

class FakeLottieAnimation implements LottieSvgAnimationItem {
  constructor(private readonly events: string[] = []) {}

  play(): void {}
  pause(): void {}
  destroy(): void {
    this.events.push("destroy");
  }
  goToAndStop(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}
}

class FakeSvgaAdapter implements FormatAdapter {
  readonly format = "svga" as const;

  async probe(): Promise<FormatProbeResult> {
    return { format: "svga", confidence: 1, issues: [] };
  }

  async parse(source: MotionAssetSource, context?: WorkbenchOperationContext): Promise<WorkbenchResult<MotionAssetInfo>> {
    context?.cancellation?.throwIfCancelled();
    await source.read();
    return {
      value: {
        format: "svga",
        name: source.name,
        sizeBytes: source.sizeBytes,
        dimensions: { width: 480, height: 96 },
        timing: { fps: 24, frameCount: 48, durationMs: 2_000 },
        resources: [{
          id: "img_frame",
          name: "img_frame",
          kind: "image",
          role: "static_image",
          dimensions: { width: 480, height: 96 },
          replaceable: true
        }],
        layers: [{
          id: "sprite_0",
          name: "Frame",
          kind: "sprite",
          resourceIds: ["img_frame"],
          replaceable: true
        }]
      },
      issues: []
    };
  }
}

class FakePlaybackAdapter implements PlaybackAdapter<unknown> {
  readonly format = "svga" as const;

  createSession(): PlaybackSession {
    return new FakePlaybackSession();
  }
}

class FakePlaybackSession implements PlaybackSession {
  private state: PlaybackState = playbackState("idle");

  async load(source: MotionAssetSource): Promise<WorkbenchResult<MotionAssetInfo>> {
    this.state = playbackState("ready", 2_000);
    return {
      value: {
        format: "svga",
        name: source.name,
        sizeBytes: source.sizeBytes,
        dimensions: { width: 480, height: 96 },
        timing: { fps: 24, frameCount: 48, durationMs: 2_000 },
        resources: [],
        layers: []
      },
      issues: []
    };
  }

  async play(): Promise<void> {
    this.state = { ...this.state, status: "playing" };
  }

  pause(): void {
    this.state = { ...this.state, status: "paused" };
  }

  seek(timeMs: number): void {
    this.state = { ...this.state, currentTimeMs: timeMs, status: "paused" };
  }

  async replay(): Promise<void> {
    this.state = { ...this.state, currentTimeMs: 0, status: "playing" };
  }

  setLoop(loop: boolean): void {
    this.state = { ...this.state, loop };
  }

  getState(): PlaybackState {
    return { ...this.state };
  }

  dispose(): void {
    this.state = { ...this.state, status: "disposed" };
  }
}

interface FakeVapRuntime {
  constructor: VapRuntimeConstructor;
  configs: VapRuntimeConfig[];
}

function fakeVapRuntime(): FakeVapRuntime {
  const runtime: FakeVapRuntime = {
    configs: [],
    constructor(options) {
      if (!options) throw new Error("VAP runtime config is required.");
      runtime.configs.push(options);
      return new FakeVapPlayer();
    }
  };
  return runtime;
}

class FakeVapPlayer implements VapRuntimePlayer {
  on(): VapRuntimePlayer {
    return this;
  }
  destroy(): void {}
  pause(): void {}
  play(): VapRuntimePlayer {
    return this;
  }
  setTime(): void {}
}

function readyVapHost() {
  return {
    webglAvailable: true,
    h264Mp4DecodeAvailable: true,
    localObjectUrlAvailable: true,
    cspAllowsBlobMedia: true,
    gpuCompositingAvailable: true
  };
}

function minimalLottie(overrides: Record<string, unknown> = {}): Uint8Array {
  return textEncoder.encode(JSON.stringify({
    v: "5.7.4",
    fr: 30,
    ip: 0,
    op: 60,
    w: 320,
    h: 180,
    layers: [],
    ...overrides
  }));
}

function lottieAssetPath(animationData: unknown, assetId: string): string | undefined {
  const record = animationData as { assets?: Array<{ id?: string; p?: string }> };
  return record.assets?.find(({ id }) => id === assetId)?.p;
}

function lottieText(animationData: unknown, layerId: number): string | undefined {
  const record = animationData as { layers?: Array<{ ind?: number; t?: { d?: { k?: Array<{ s?: { t?: string } }> } } }> };
  return record.layers?.find(({ ind }) => ind === layerId)?.t?.d?.k?.[0]?.s?.t;
}

function svgaHintBytes(): Uint8Array {
  return Uint8Array.from([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01]);
}

function validVapBytes(vapcOverrides: Record<string, unknown>): Uint8Array {
  return concatBytes(
    ftypBox(),
    moovBox(),
    mp4Box("vapc", textEncoder.encode(JSON.stringify({
      info: vapInfo(),
      ...vapcOverrides
    })))
  );
}

function fusionImageConfig(): Record<string, unknown> {
  return {
    src: [
      { srcId: 1, srcType: "img", srcTag: "avatar", w: 120, h: 120, fitType: "centerCrop" }
    ],
    frame: [{
      i: 0,
      obj: [
        { srcId: 1, z: 3, frame: { x: 10, y: 20, w: 120, h: 120 }, mFrame: { x: 0, y: 0, w: 120, h: 120 }, mt: 0 }
      ]
    }]
  };
}

function vapInfo(): Record<string, unknown> {
  return {
    v: 2,
    f: 60,
    w: 720,
    h: 405,
    videoW: 720,
    videoH: 810,
    fps: 30,
    isVapx: false,
    aFrame: { x: 0, y: 405, w: 720, h: 405 },
    rgbFrame: { x: 0, y: 0, w: 720, h: 405 }
  };
}

function ftypBox(): Uint8Array {
  return mp4Box("ftyp", concatBytes(
    textEncoder.encode("isom"),
    u32(512),
    textEncoder.encode("isom"),
    textEncoder.encode("mp42")
  ));
}

function moovBox(): Uint8Array {
  return mp4Box("moov", concatBytes(
    mvhdBox(1_000, 2_000),
    trackBox("vide", "avc1")
  ));
}

function trackBox(handler: "vide" | "soun", sampleEntry: string): Uint8Array {
  return mp4Box("trak", mp4Box("mdia", concatBytes(
    hdlrBox(handler),
    mp4Box("minf", mp4Box("stbl", stsdBox(sampleEntry)))
  )));
}

function mvhdBox(timescale: number, duration: number): Uint8Array {
  const payload = new Uint8Array(20);
  const view = new DataView(payload.buffer);
  view.setUint32(12, timescale);
  view.setUint32(16, duration);
  return mp4Box("mvhd", payload);
}

function hdlrBox(handler: string): Uint8Array {
  const payload = new Uint8Array(12);
  payload.set(textEncoder.encode(handler), 8);
  return mp4Box("hdlr", payload);
}

function stsdBox(sampleEntry: string): Uint8Array {
  const payload = new Uint8Array(16);
  const view = new DataView(payload.buffer);
  view.setUint32(4, 1);
  view.setUint32(8, 8);
  payload.set(textEncoder.encode(sampleEntry), 12);
  return mp4Box("stsd", payload);
}

function mp4Box(type: string, payload: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(8 + payload.byteLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, bytes.byteLength);
  bytes.set(textEncoder.encode(type), 4);
  bytes.set(payload, 8);
  return bytes;
}

function u32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function mediaTypeFromPath(pathValue: string): string | undefined {
  if (/\.json$/iu.test(pathValue)) return "application/json";
  if (/\.(mp4|vap)$/iu.test(pathValue)) return "video/mp4";
  if (/\.svga$/iu.test(pathValue)) return "application/x-svga";
  if (/\.png$/iu.test(pathValue)) return "image/png";
  return undefined;
}

function playbackState(status: PlaybackState["status"], durationMs?: number): PlaybackState {
  return {
    status,
    currentTimeMs: 0,
    ...(durationMs !== undefined ? { durationMs } : {}),
    loop: false
  };
}

function assertNoLocalPaths(value: unknown): void {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes("/Users/designer"), false, serialized);
  assert.equal(serialized.includes("private"), false, serialized);
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let attempts = 0; attempts < 50; attempts += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.fail("Condition was not reached before timeout.");
}
