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
  type OwnerVisibleMultiFormatPreviewModel,
  type OwnerVisibleSvgaReplacementController
} from "../workbench/multiformat-owner-preview-candidate.js";
import {
  serializeOwnerRightPanelSnapshot,
  type OwnerRightPanelSnapshotV1
} from "../workbench/owner-right-panel-snapshot.js";
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

test("owner right-panel snapshot rejects unbranded live objects before property access", () => {
  let trapCalls = 0;
  const proxy = new Proxy({}, {
    get() {
      trapCalls += 1;
      return undefined;
    },
    getOwnPropertyDescriptor() {
      trapCalls += 1;
      return undefined;
    },
    ownKeys() {
      trapCalls += 1;
      return [];
    }
  });

  assert.throws(() => serializeOwnerRightPanelSnapshot(proxy as OwnerRightPanelSnapshotV1));
  assert.equal(trapCalls, 0);
});

test("owner right-panel snapshot carries only bounded display data and fixed copy", async () => {
  const localPath = "/Users/designer/private/card.json";
  const host = memoryHost({
    [localPath]: minimalLottie({
      assets: [{ id: "avatar", u: "images", p: "/Users/designer/private/hero.png", w: 20, h: 20 }],
      layers: [
        { ind: 1, ty: 2, nm: "layers.0.xp /Users/designer/private", refId: "avatar" },
        { ind: 2, ty: 5, nm: "Complete bounded JSON is required", t: { d: { k: [{ s: { t: "/Users/designer/private/name" } }] } } }
      ]
    }),
    [`${localPath}::images//Users/designer/private/hero.png`]: Uint8Array.from([1, 2, 3])
  });
  const session = createOwnerVisibleMultiFormatPreviewCandidate({
    host,
    lottieTarget: { container: {} },
    lottieRendererLoader: async () => fakeLottieRenderer()
  });

  const opened = await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "snapshot-open",
    source: "fileButton",
    localPath,
    displayName: localPath
  });

  const envelope = opened.ownerRightPanelSnapshotEnvelope;
  assert.equal(envelope.schemaVersion, 1);
  assert.equal(envelope.pathRedacted, true);
  assert.equal(envelope.sourceId, "");
  assert.equal(envelope.snapshotByteLength, textEncoder.encode(envelope.snapshotJson).byteLength);
  const snapshot = JSON.parse(envelope.snapshotJson);
  assert.equal(snapshot.pathRedacted, true);
  assert.equal(snapshot.schemaVersion, 1);
  assert.deepEqual(Object.keys(snapshot).sort(), [
    "assetInventory",
    "assets",
    "facts",
    "imageTargets",
    "issues",
    "pathRedacted",
    "schemaVersion",
    "textTargets",
    "unsupportedFeatures"
  ]);
  assert.doesNotMatch(envelope.snapshotJson, /\/Users|private|layers\.0\.xp|Complete bounded JSON/u);
  assertNoLocalPaths(opened);
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

  assert.equal(opened.status, "playing");
  assert.equal(opened.detectedFormat, "lottie");
  assert.equal(opened.productVersion, "0.2.0-alpha.2");
  assert.equal(opened.rightPanel.lottieTexts[0]?.initialText, "Hello");
  assert.equal(opened.rightPanel.assetInventory.summary.imageCount, 1);
  assert.equal(opened.rightPanel.assetInventory.summary.textCount, 1);
  assert.equal(opened.rightPanel.assetInventory.groups.some(({ id }) => id === "vap_fusion_images"), false);
  const ownerSnapshot = JSON.parse(opened.ownerRightPanelSnapshotEnvelope.snapshotJson);
  assert.deepEqual(ownerSnapshot.assetInventory.groups.map(({ id }: { id: string }) => id), [
    "image_resources",
    "text_candidates"
  ]);
  assert.deepEqual(ownerSnapshot.imageTargets.map(({ resourceId }: { resourceId: string }) => resourceId), ["avatar"]);
  assert.deepEqual(ownerSnapshot.textTargets.map(({ textKey }: { textKey: string }) => textKey), ["text:2"]);
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

test("owner-visible 0.2 candidate resets one Lottie target without clearing sibling replacements", async () => {
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

  await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "open-lottie-target-reset",
    source: "fileButton",
    localPath
  });
  await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "replace-lottie-text",
    targetId: "text:2",
    kind: "text",
    value: "Welcome"
  });
  await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "replace-lottie-image",
    targetId: "avatar",
    kind: "image",
    value: "data:image/png;base64,QUJD"
  });

  const textReset = await session.resetReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "reset-lottie-text-only",
    targetId: "text:2",
    kind: "text"
  } as Parameters<typeof session.resetReplacement>[0]);

  assert.equal(textReset.replacement.dirty, true);
  assert.equal(textReset.replacement.resetEnabled, true);
  assert.equal(textReset.replacement.active.length, 1);
  assert.equal(textReset.replacement.active[0]?.targetId, "avatar");
  assert.equal(textReset.replacement.playerAction, "reloadPreview");
  assert.equal(textReset.replacement.lastAction?.publicTargetId, "text:2");
  assert.equal(lottieText(loadCalls.at(-1)?.animationData, 2), "Hello");
  assert.equal(lottieAssetPath(loadCalls.at(-1)?.animationData, "avatar"), "data:image/png;base64,QUJD");

  const imageReset = await session.resetReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "reset-lottie-image-only",
    targetId: "avatar",
    kind: "image"
  } as Parameters<typeof session.resetReplacement>[0]);

  assert.equal(imageReset.replacement.dirty, false);
  assert.equal(imageReset.replacement.resetEnabled, false);
  assert.equal(imageReset.replacement.active.length, 0);
  assert.equal(imageReset.replacement.playerAction, "remountSource");
  assert.equal(lottieAssetPath(loadCalls.at(-1)?.animationData, "avatar"), "data:image/png;base64,AQID");
});

test("owner-visible 0.2 candidate rejects ambiguous Lottie image and text identities before mutation", async () => {
  const localPath = "/Users/designer/private/ambiguous-card.json";
  const loadCalls: LottieSvgLoadOptions[] = [];
  const session = createOwnerVisibleMultiFormatPreviewCandidate({
    host: memoryHost({
      [localPath]: minimalLottie({
        assets: [{ id: "text:1", p: "avatar.png", w: 20, h: 20 }],
        layers: [
          { ind: 2, ty: 2, nm: "Avatar", refId: "text:1" },
          { ind: 1, ty: 5, nm: "Title", t: { d: { k: [{ s: { t: "Hello" } }] } } }
        ]
      }),
      [`${localPath}::avatar.png`]: Uint8Array.from([1, 2, 3])
    }),
    lottieTarget: { container: { id: "lottie-target" } },
    lottieRendererLoader: async () => fakeLottieRenderer(loadCalls)
  });

  const opened = await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "open-lottie-cross-kind",
    source: "fileButton",
    localPath
  });
  assert.equal(opened.status, "playing");
  assert.equal(loadCalls.length, 1);

  for (const kind of ["image", "text"] as const) {
    const before = session.getModel();
    const blocked = await session.applyReplacement({
      gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
      requestId: `replace-cross-kind-${kind}`,
      targetId: "text:1",
      kind,
      value: kind === "image" ? "data:image/png;base64,QUJD" : "Welcome"
    });

    assert.equal(blocked.replacement.lastAction?.status, "blocked");
    assert.equal(blocked.replacement.lastAction?.diagnostic?.code, "replacement_target_ambiguous");
    assert.equal(blocked.replacement.revision, before.replacement.revision);
    assert.deepEqual(blocked.replacement.active, before.replacement.active);
    assert.equal(loadCalls.length, 1);
    assertNoLocalPaths(blocked);
  }
});

test("owner-visible 0.2 candidate rejects duplicate Lottie aliases and ambiguous reset without mutation", async () => {
  const localPath = "/Users/designer/private/duplicate-text-card.json";
  const loadCalls: LottieSvgLoadOptions[] = [];
  const session = createOwnerVisibleMultiFormatPreviewCandidate({
    host: memoryHost({
      [localPath]: minimalLottie({
        assets: [{ id: "avatar", p: "avatar.png", w: 20, h: 20 }],
        layers: [
          { ind: 3, ty: 2, nm: "Avatar", refId: "avatar" },
          { ind: 1, ty: 5, nm: "Same", t: { d: { k: [{ s: { t: "One" } }] } } },
          { ind: 2, ty: 5, nm: "Same", t: { d: { k: [{ s: { t: "Two" } }] } } }
        ]
      }),
      [`${localPath}::avatar.png`]: Uint8Array.from([1, 2, 3])
    }),
    lottieTarget: { container: { id: "lottie-target" } },
    lottieRendererLoader: async () => fakeLottieRenderer(loadCalls)
  });

  await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "open-lottie-duplicate-alias",
    source: "fileButton",
    localPath
  });
  const beforeAliasApply = session.getModel();
  const duplicateAlias = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "replace-lottie-duplicate-alias",
    targetId: "Same",
    kind: "text",
    value: "Blocked"
  });
  assert.equal(duplicateAlias.replacement.lastAction?.status, "blocked");
  assert.equal(duplicateAlias.replacement.lastAction?.diagnostic?.code, "replacement_target_ambiguous");
  assert.equal(duplicateAlias.replacement.revision, beforeAliasApply.replacement.revision);
  assert.deepEqual(duplicateAlias.replacement.active, beforeAliasApply.replacement.active);
  assert.equal(loadCalls.length, 1);

  const textApplied = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "replace-lottie-unique-text-id",
    targetId: "text:1",
    kind: "text",
    value: "Welcome"
  });
  assert.equal(textApplied.replacement.lastAction?.status, "accepted");
  const beforeDuplicateReset = session.getModel();
  const duplicateResetLoadCount = loadCalls.length;
  const duplicateAliasReset = await session.resetReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "reset-lottie-duplicate-alias",
    targetId: "Same",
    kind: "text"
  });
  assert.equal(duplicateAliasReset.replacement.lastAction?.status, "blocked");
  assert.equal(duplicateAliasReset.replacement.lastAction?.diagnostic?.code, "replacement_target_ambiguous");
  assert.equal(duplicateAliasReset.replacement.revision, beforeDuplicateReset.replacement.revision);
  assert.deepEqual(duplicateAliasReset.replacement.active, beforeDuplicateReset.replacement.active);
  assert.equal(loadCalls.length, duplicateResetLoadCount);

  const textReset = await session.resetReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "reset-lottie-unique-text-id",
    targetId: "text:1",
    kind: "text"
  });
  assert.equal(textReset.replacement.lastAction?.status, "accepted");

  const imageApplied = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "replace-lottie-image-before-ambiguous-reset",
    targetId: "avatar",
    kind: "image",
    value: "data:image/png;base64,QUJD"
  });
  assert.equal(imageApplied.replacement.lastAction?.status, "accepted");
  const internal = session as unknown as { model: OwnerVisibleMultiFormatPreviewModel };
  internal.model = {
    ...structuredClone(imageApplied),
    rightPanel: {
      ...structuredClone(imageApplied.rightPanel),
      lottieTexts: [{ id: "avatar", layerId: "1", name: "Collision", replaceable: true }]
    }
  };
  const beforeReset = session.getModel();
  const resetLoadCount = loadCalls.length;
  const blockedReset = await session.resetReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "reset-lottie-cross-kind",
    targetId: "avatar",
    kind: "image"
  });
  assert.equal(blockedReset.replacement.lastAction?.status, "blocked");
  assert.equal(blockedReset.replacement.lastAction?.diagnostic?.code, "replacement_target_ambiguous");
  assert.equal(blockedReset.replacement.revision, beforeReset.replacement.revision);
  assert.deepEqual(blockedReset.replacement.active, beforeReset.replacement.active);
  assert.equal(loadCalls.length, resetLoadCount);
  assertNoLocalPaths(blockedReset);
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
  assert.equal(opened.status, "playing");
  assert.equal(opened.rightPanel.vapFusionImages[0]?.srcTag, "avatar");
  assert.equal(opened.rightPanel.assetInventory.summary.imageCount, 1);
  assert.equal(opened.rightPanel.assetInventory.summary.audioVideoCount, 2);
  assert.equal(opened.rightPanel.assetInventory.groups.some(({ id }) => id === "text_candidates"), false);
  assert.equal(opened.rightPanel.issues.some((entry) =>
    entry.code === "missing_resource" && entry.message === "预览所需资源缺失。"
  ), true);
  assert.equal(runtime.configs.length, 1);
  assert.equal(runtime.configs[0]?.avatar, undefined);

  const applied = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "replace-vap",
    targetId: "vap_fusion_1",
    kind: "image",
    value: "data:image/png;base64,QUJD"
  });

  assert.equal(applied.status, "previewReady");
  assert.equal(applied.replacement.dirty, true);
  assert.equal(applied.replacement.active[0]?.targetId, "avatar");
  assert.equal(runtime.configs.length, 2);
  assert.equal(runtime.configs[1]?.src, "blob:vap/fusion.mp4");
  assert.equal(runtime.configs[1]?.avatar, "data:image/png;base64,QUJD");
  assert.equal(runtime.configs[1]?.precache, false);

  const reset = await session.resetReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "reset-vap"
  });
  assert.equal(reset.status, "previewReady");
  assert.equal(reset.replacement.dirty, false);
  assert.equal(reset.replacement.lastAction?.status, "accepted");
  assert.equal(reset.rightPanel.issues.some((entry) =>
    entry.code === "missing_resource" && entry.message === "预览所需资源缺失。"
  ), true);
  assert.equal(runtime.configs.length, 3);
  assert.equal(runtime.configs[2]?.avatar, undefined);
  assert.equal(host.revoked.includes("blob:vap/fusion.mp4"), true);
  assertNoLocalPaths(reset);
});

test("owner-visible 0.2 candidate resets one VAP fusion target without clearing its sibling", async () => {
  const localPath = "/Users/designer/private/fusion-image-text.mp4";
  const runtime = fakeVapRuntime();
  const host = memoryHost({ [localPath]: validVapBytes(fusionImageTextConfig()) });
  const session = createOwnerVisibleMultiFormatPreviewCandidate({
    host,
    vapTarget: { id: "vap-target" },
    vapHostReadiness: readyVapHost(),
    vapRuntimeLoader: async () => runtime.constructor
  });

  const opened = await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "open-vap-image-text",
    source: "menuOpen",
    localPath
  });
  assert.equal(opened.status, "playing");
  const imageTargetId = opened.rightPanel.vapFusionImages[0]?.resourceId ?? "";
  const textTargetId = opened.rightPanel.vapFusionTexts[0]?.resourceId ?? "";
  assert.ok(imageTargetId);
  assert.ok(textTargetId);
  assert.notEqual(imageTargetId, textTargetId);
  assert.equal(opened.rightPanel.vapFusionImages.some((target) => target.resourceId === textTargetId), false);
  assert.equal(opened.rightPanel.vapFusionTexts.some((target) => target.resourceId === imageTargetId), false);
  const ownerSnapshot = JSON.parse(opened.ownerRightPanelSnapshotEnvelope.snapshotJson);
  assert.deepEqual(ownerSnapshot.assets, []);
  assert.deepEqual(ownerSnapshot.assetInventory.groups.map(({ id }: { id: string }) => id), [
    "vap_fusion_images",
    "vap_fusion_texts",
    "audio_video_media",
    "unsupported_or_missing"
  ]);
  assert.equal(ownerSnapshot.issues.length, 1);
  const replaceableInventoryIds = ownerSnapshot.assetInventory.groups
    .flatMap(({ items }: { items: Array<{ id: string; replaceable: boolean }> }) => items)
    .filter(({ replaceable }: { replaceable: boolean }) => replaceable)
    .map(({ id }: { id: string }) => id);
  assert.deepEqual(replaceableInventoryIds, [imageTargetId, textTargetId]);

  const textApplied = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "replace-vap-title",
    targetId: textTargetId,
    kind: "text",
    value: "Replacement title"
  });
  assert.equal(textApplied.replacement.lastAction?.runtimeTargetId, "title");
  const bothApplied = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "replace-vap-avatar",
    targetId: imageTargetId,
    kind: "image",
    value: "data:image/png;base64,QUJD"
  });
  assert.equal(bothApplied.replacement.lastAction?.runtimeTargetId, "avatar");
  assert.equal(bothApplied.replacement.active.length, 2);
  assert.equal(runtime.configs.at(-1)?.avatar, "data:image/png;base64,QUJD");
  assert.equal(runtime.configs.at(-1)?.title, "Replacement title");

  const titleReset = await session.resetReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "reset-vap-title",
    targetId: textTargetId,
    kind: "text"
  });
  assert.equal(titleReset.replacement.lastAction?.status, "accepted");
  assert.equal(titleReset.replacement.lastAction?.runtimeTargetId, "title");
  assert.equal(titleReset.replacement.dirty, true);
  assert.equal(titleReset.replacement.resetEnabled, true);
  assert.deepEqual(titleReset.replacement.active.map(({ targetId }) => targetId), ["avatar"]);
  assert.equal(runtime.configs.at(-1)?.avatar, "data:image/png;base64,QUJD");
  assert.equal(runtime.configs.at(-1)?.title, undefined);

  const beforeBlocked = session.getModel();
  const blocked = await session.resetReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "reset-vap-title-again",
    targetId: textTargetId,
    kind: "text"
  });
  assert.equal(blocked.replacement.lastAction?.status, "blocked");
  assert.equal(blocked.replacement.lastAction?.diagnostic?.code, "replacement_reset_not_needed");
  assert.equal(blocked.replacement.revision, beforeBlocked.replacement.revision);
  assert.deepEqual(blocked.replacement.active, beforeBlocked.replacement.active);
  assert.equal(runtime.configs.length, 4);

  const avatarReset = await session.resetReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "reset-vap-avatar",
    targetId: imageTargetId,
    kind: "image"
  });
  assert.equal(avatarReset.replacement.lastAction?.status, "accepted");
  assert.equal(avatarReset.replacement.dirty, false);
  assert.equal(avatarReset.replacement.resetEnabled, false);
  assert.deepEqual(avatarReset.replacement.active, []);
  assert.equal(runtime.configs.at(-1)?.avatar, undefined);
  assert.equal(runtime.configs.at(-1)?.title, undefined);
  assertNoLocalPaths(avatarReset);
});

test("owner-visible 0.2 candidate resolves a VAP public resource identity without cross-namespace alias collisions", async () => {
  const localPath = "/Users/designer/private/colliding-fusion.mp4";
  const runtime = fakeVapRuntime();
  const host = memoryHost({ [localPath]: validVapBytes(collidingFusionImageConfig()) });
  const session = createOwnerVisibleMultiFormatPreviewCandidate({
    host,
    vapTarget: { id: "vap-target" },
    vapHostReadiness: readyVapHost(),
    vapRuntimeLoader: async () => runtime.constructor
  });

  const opened = await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "open-colliding-vap",
    source: "menuOpen",
    localPath
  });
  assert.equal(opened.rightPanel.vapFusionImages[0]?.srcTag, "vap_fusion_2");
  assert.equal(opened.rightPanel.vapFusionImages[1]?.resourceId, "vap_fusion_2");
  assert.equal(opened.rightPanel.vapFusionImages[1]?.srcTag, "badge");

  const applied = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "replace-colliding-vap",
    targetId: "vap_fusion_2",
    kind: "image",
    value: "data:image/png;base64,QUJD"
  });

  assert.equal(applied.replacement.lastAction?.status, "accepted");
  assert.equal(applied.replacement.lastAction?.publicTargetId, "vap_fusion_2");
  assert.equal(applied.replacement.lastAction?.runtimeTargetId, "badge");
  assert.equal(applied.replacement.active[0]?.targetId, "badge");
  assert.equal(runtime.configs.at(-1)?.badge, "data:image/png;base64,QUJD");
  assert.equal(runtime.configs.at(-1)?.vap_fusion_2, undefined);
  assertNoLocalPaths(applied);
});

test("owner-visible 0.2 candidate rejects invalid VAP selection authority without replacement mutation", async () => {
  const localPath = "/Users/designer/private/fusion-authority.mp4";
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
    requestId: "open-authority-vap",
    source: "menuOpen",
    localPath
  });
  const target = opened.rightPanel.vapFusionImages[0];
  assert.ok(target);
  const internal = session as unknown as { model: OwnerVisibleMultiFormatPreviewModel };
  const cases = [
    {
      name: "zero match",
      targetId: "missing-resource",
      targets: [target],
      code: "replacement_target_unavailable"
    },
    {
      name: "duplicate public resource identity",
      targetId: target.resourceId,
      targets: [target, { ...target, id: "2", srcId: "2", srcTag: "badge", runtimeBindingKey: "badge" }],
      code: "replacement_target_ambiguous"
    },
    {
      name: "duplicate canonical runtime identity",
      targetId: target.resourceId,
      targets: [target, {
        ...target,
        id: "2",
        resourceId: "vap_fusion_2",
        srcId: "2",
        srcTag: target.runtimeBindingKey,
        runtimeBindingKey: target.runtimeBindingKey
      }],
      code: "replacement_target_ambiguous"
    },
    {
      name: "blank canonical runtime key",
      targetId: target.resourceId,
      targets: [{ ...target, runtimeBindingKey: "   " }],
      code: "replacement_target_malformed"
    },
    {
      name: "malformed canonical runtime field",
      targetId: target.resourceId,
      targets: [{ ...target, srcTag: 17 as unknown as string }],
      code: "replacement_target_malformed"
    },
    {
      name: "nonreplaceable target",
      targetId: target.resourceId,
      targets: [{ ...target, replaceable: false }],
      code: "replacement_target_not_replaceable"
    }
  ] as const;

  for (const fixture of cases) {
    internal.model = {
      ...structuredClone(opened),
      rightPanel: {
        ...structuredClone(opened.rightPanel),
        vapFusionImages: fixture.targets
      }
    };
    const before = session.getModel();
    const blocked = await session.applyReplacement({
      gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
      requestId: `reject-${fixture.name}`,
      targetId: fixture.targetId,
      kind: "image",
      value: "data:image/png;base64,QUJD"
    });

    assert.equal(blocked.replacement.lastAction?.status, "blocked", fixture.name);
    assert.equal(blocked.replacement.lastAction?.diagnostic?.code, fixture.code, fixture.name);
    assert.equal(blocked.replacement.revision, before.replacement.revision, fixture.name);
    assert.equal(blocked.replacement.dirty, false, fixture.name);
    assert.deepEqual(blocked.replacement.active, [], fixture.name);
    assert.equal(runtime.configs.length, 1, fixture.name);
    assertNoLocalPaths(blocked);
  }
});

test("owner-visible oversized VAP remains playable with a truthful Canvas warning", async () => {
  const localPath = "/Users/designer/private/owner-oversized-vap.mp4";
  const runtime = fakeVapRuntime();
  const host = memoryHost({
    [localPath]: validVapBytes({
      info: {
        ...vapInfo(),
        w: 750,
        h: 1624,
        videoW: 1136,
        videoH: 1632
      }
    })
  });
  const session = createOwnerVisibleMultiFormatPreviewCandidate({
    host,
    vapTarget: { id: "vap-target" },
    vapHostReadiness: readyVapHost(),
    vapRuntimeLoader: async () => runtime.constructor
  });

  const opened = await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "open-owner-oversized-vap",
    source: "menuOpen",
    localPath
  });

  assert.equal(opened.status, "playing");
  assert.equal(opened.detectedFormat, "vap");
  assert.equal(opened.rightPanel.facts.find(({ id }) => id === "dimensions")?.value, "750 x 1624");
  assert.equal(opened.rightPanel.facts.find(({ id }) => id === "dimensions")?.status, "warning");
  assert.equal(opened.rightPanel.issues.filter(({ code, severity }) =>
    String(code) === "owner_issue" && severity === "warning"
  ).length, 1);
  assert.equal(runtime.configs.length, 1);
  assert.equal((await session.play()).status, "playing");
  assert.equal((await session.pause()).status, "paused");
  assertNoLocalPaths(opened);
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
    targetId: "vap_fusion_1",
    kind: "image",
    value: "data:image/png;base64,QUJD"
  });
  assert.equal(applied.replacement.dirty, true);
  assert.equal(runtime.configs.length, 2);

  const revokedBeforeReset = host.revoked.length;
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
  assert.equal(runtime.configs.length, 2);
  assert.equal(host.revoked.length, revokedBeforeReset);
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

  assert.equal(opened.status, "playing");
  assert.equal(opened.detectedFormat, "svga");
  assert.equal(opened.rightPanel.assets[0]?.id, "img_frame");
  assert.equal(opened.rightPanel.assetInventory.summary.imageCount, 1);
  assert.equal(opened.rightPanel.assetInventory.groups.some(({ id }) => id === "vap_fusion_images"), false);
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
    requestId: "reset-svga",
    targetId: "img_frame",
    kind: "image"
  });
  assert.equal(reset.replacement.dirty, false);
  assert.equal(reset.replacement.playerAction, "remountSource");
  assert.equal(reset.replacement.lastAction?.runtimeTargetId, "img_frame");
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

test("owner-visible daily-use chain preserves facts, actions, replacement, reset, and reopen isolation across formats", async () => {
  const svgaPath = "/Users/designer/private/daily-frame.svga";
  const lottiePath = "/Users/designer/private/daily-card.json";
  const vapPath = "/Users/designer/private/daily-fusion.mp4";
  const lottieLoadCalls: LottieSvgLoadOptions[] = [];
  const lottiePlaybackEvents: string[] = [];
  const vapPlaybackEvents: string[] = [];
  const svgaPlaybackEvents: string[] = [];
  const vapRuntime = fakeVapRuntime(vapPlaybackEvents);
  const svgaControllerCalls: string[] = [];
  const session = createOwnerVisibleMultiFormatPreviewCandidate({
    host: memoryHost({
      [svgaPath]: svgaHintBytes(),
      [lottiePath]: minimalLottie({
        assets: [{ id: "avatar", p: "avatar.png", w: 20, h: 20 }],
        layers: [
          { ind: 1, ty: 2, nm: "Avatar", refId: "avatar" },
          { ind: 2, ty: 5, nm: "Title", t: { d: { k: [{ s: { t: "Hello" } }] } } }
        ]
      }),
      [`${lottiePath}::avatar.png`]: Uint8Array.from([1, 2, 3]),
      [vapPath]: validVapBytes(fusionImageTextConfig())
    }),
    lottieTarget: { container: { id: "lottie-daily" } },
    lottieRendererLoader: async () => fakeLottieRenderer(lottieLoadCalls, lottiePlaybackEvents),
    vapTarget: { id: "vap-daily" },
    vapHostReadiness: readyVapHost(),
    vapRuntimeLoader: async () => vapRuntime.constructor,
    svgaAdapter: new FakeSvgaAdapter(),
    svgaPlaybackAdapter: new FakePlaybackAdapter(svgaPlaybackEvents),
    svgaPlaybackTarget: { id: "svga-daily" },
    svgaReplacementController: {
      async applyImage(input) {
        svgaControllerCalls.push(`apply:${input.targetId}`);
        return {
          accepted: true,
          message: "SVGA replacement preview remounted.",
          playerAction: "remountPreview",
          playback: playbackState("ready", 2_000)
        };
      },
      async reset() {
        svgaControllerCalls.push("reset");
        return {
          accepted: true,
          message: "SVGA replacement preview reset.",
          playerAction: "remountSource",
          playback: playbackState("ready", 2_000)
        };
      }
    }
  });

  const svga = await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "daily-open-svga",
    source: "fileButton",
    localPath: svgaPath
  });
  assertDailyOpenSurface(svga, {
    format: "svga",
    factIds: ["format", "dimensions", "duration", "layers", "assets", "replaceable"],
    inventoryGroups: ["image_resources"],
    imageTargets: ["img_frame"],
    textTargets: []
  });
  assert.equal(svga.canvas.playback.status, "playing");
  assert.deepEqual(svgaPlaybackEvents, ["load", "play"]);
  const pausedSvga = session.pause();
  assert.equal(pausedSvga.status, "paused");
  assert.equal(pausedSvga.canvas.playback.status, "paused");
  assert.deepEqual(svgaPlaybackEvents, ["load", "play", "pause"]);
  const resumedSvga = await session.play();
  assert.equal(resumedSvga.status, "playing");
  assert.equal(resumedSvga.canvas.playback.status, "playing");
  assert.deepEqual(svgaPlaybackEvents, ["load", "play", "pause", "play"]);
  const svgaApplied = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "daily-svga-replace",
    targetId: "img_frame",
    kind: "image",
    value: "data:image/png;base64,QUJD"
  });
  assert.equal(svgaApplied.status, "playing");
  assert.equal(svgaApplied.canvas.playback.status, "ready");
  assert.equal(svgaApplied.replacement.dirty, true);
  assert.equal(svgaApplied.replacement.active[0]?.targetId, "img_frame");
  assert.equal(svgaPlaybackEvents.filter((event) => event === "play").length, 2);
  const svgaReset = await session.resetReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "daily-svga-reset",
    targetId: "img_frame",
    kind: "image"
  });
  assert.equal(svgaReset.status, "playing");
  assert.equal(svgaReset.canvas.playback.status, "ready");
  assert.equal(svgaReset.replacement.dirty, false);
  assert.equal(svgaPlaybackEvents.filter((event) => event === "play").length, 2);
  assert.deepEqual(svgaControllerCalls, ["apply:img_frame", "reset"]);

  const lottie = await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "daily-open-lottie",
    source: "dragDrop",
    localPath: lottiePath
  });
  assertDailyOpenSurface(lottie, {
    format: "lottie",
    factIds: ["format", "dimensions", "duration", "layers", "assets", "replaceable"],
    inventoryGroups: ["image_resources", "text_candidates"],
    imageTargets: ["avatar"],
    textTargets: ["text:2"]
  });
  assert.equal(lottie.replacement.dirty, false);
  assert.equal(lottie.canvas.playback.status, "playing");
  assert.deepEqual(lottiePlaybackEvents, ["play"]);
  const pausedLottie = session.pause();
  assert.equal(pausedLottie.status, "paused");
  assert.equal(pausedLottie.canvas.playback.status, "paused");
  assert.deepEqual(lottiePlaybackEvents, ["play", "pause"]);
  const resumedLottie = await session.play();
  assert.equal(resumedLottie.status, "playing");
  assert.equal(resumedLottie.canvas.playback.status, "playing");
  assert.deepEqual(lottiePlaybackEvents, ["play", "pause", "play"]);
  const lottiePlayCountBeforeReplacement = lottiePlaybackEvents.filter((event) => event === "play").length;
  const lottieTextApplied = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "daily-lottie-text",
    targetId: "text:2",
    kind: "text",
    value: "Welcome"
  });
  assert.equal(lottieTextApplied.status, "previewReady");
  assert.equal(lottieTextApplied.replacement.active[0]?.targetId, "text:2");
  const lottieImageApplied = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "daily-lottie-image",
    targetId: "avatar",
    kind: "image",
    value: "data:image/png;base64,QUJD"
  });
  assert.equal(lottieImageApplied.status, "previewReady");
  assert.deepEqual(lottieImageApplied.replacement.active.map(({ targetId }) => targetId), ["text:2", "avatar"]);
  assert.equal(lottiePlaybackEvents.filter((event) => event === "play").length, lottiePlayCountBeforeReplacement);
  const lottieTextReset = await session.resetReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "daily-lottie-reset-text",
    targetId: "text:2",
    kind: "text"
  });
  assert.equal(lottieTextReset.status, "previewReady");
  assert.deepEqual(lottieTextReset.replacement.active.map(({ targetId }) => targetId), ["avatar"]);
  const lottieImageReset = await session.resetReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "daily-lottie-reset-image",
    targetId: "avatar",
    kind: "image"
  });
  assert.equal(lottieImageReset.status, "previewReady");
  assert.equal(lottieImageReset.replacement.dirty, false);
  assert.equal(lottiePlaybackEvents.filter((event) => event === "play").length, lottiePlayCountBeforeReplacement);
  assert.equal(lottieText(lottieLoadCalls.at(-1)?.animationData, 2), "Hello");

  const vap = await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "daily-open-vap",
    source: "menuOpen",
    localPath: vapPath
  });
  assertDailyOpenSurface(vap, {
    format: "vap",
    factIds: ["format", "dimensions", "duration", "layers", "assets", "replaceable", "videoCodec", "audio"],
    inventoryGroups: ["vap_fusion_images", "vap_fusion_texts", "audio_video_media", "unsupported_or_missing"],
    imageTargets: ["vap_fusion_1"],
    textTargets: ["vap_fusion_2"]
  });
  assert.equal(vap.replacement.dirty, false);
  assert.equal(vap.canvas.playback.status, "playing");
  assert.deepEqual(vapPlaybackEvents, ["play"]);
  const pausedVap = session.pause();
  assert.equal(pausedVap.status, "paused");
  assert.equal(pausedVap.canvas.playback.status, "paused");
  assert.deepEqual(vapPlaybackEvents, ["play", "pause"]);
  const resumedVap = await session.play();
  assert.equal(resumedVap.status, "playing");
  assert.equal(resumedVap.canvas.playback.status, "playing");
  assert.deepEqual(vapPlaybackEvents, ["play", "pause", "play"]);
  const vapPlayCountBeforeReplacement = vapPlaybackEvents.filter((event) => event === "play").length;
  const vapTextApplied = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "daily-vap-text",
    targetId: "vap_fusion_2",
    kind: "text",
    value: "Replacement title"
  });
  assert.equal(vapTextApplied.status, "previewReady");
  assert.equal(vapTextApplied.replacement.lastAction?.runtimeTargetId, "title");
  const vapImageApplied = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "daily-vap-image",
    targetId: "vap_fusion_1",
    kind: "image",
    value: "data:image/png;base64,QUJD"
  });
  assert.equal(vapImageApplied.status, "previewReady");
  assert.deepEqual(vapImageApplied.replacement.active.map(({ targetId }) => targetId), ["title", "avatar"]);
  assert.equal(vapPlaybackEvents.filter((event) => event === "play").length, vapPlayCountBeforeReplacement);
  assert.equal(vapRuntime.configs.at(-1)?.title, "Replacement title");
  assert.equal(vapRuntime.configs.at(-1)?.avatar, "data:image/png;base64,QUJD");
  const vapTextReset = await session.resetReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "daily-vap-reset-text",
    targetId: "vap_fusion_2",
    kind: "text"
  });
  assert.equal(vapTextReset.status, "previewReady");
  assert.deepEqual(vapTextReset.replacement.active.map(({ targetId }) => targetId), ["avatar"]);
  assert.equal(vapRuntime.configs.at(-1)?.title, undefined);
  assert.equal(vapRuntime.configs.at(-1)?.avatar, "data:image/png;base64,QUJD");
  const vapImageReset = await session.resetReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "daily-vap-reset-image",
    targetId: "vap_fusion_1",
    kind: "image"
  });
  assert.equal(vapImageReset.status, "previewReady");
  assert.equal(vapImageReset.replacement.dirty, false);
  assert.equal(vapPlaybackEvents.filter((event) => event === "play").length, vapPlayCountBeforeReplacement);
  assert.equal(vapRuntime.configs.at(-1)?.avatar, undefined);
  assert.equal(vapRuntime.configs.at(-1)?.title, undefined);
  assertNoLocalPaths(vapImageReset);

  const playerEventsBeforeInvalidOpen = {
    svga: [...svgaPlaybackEvents],
    lottie: [...lottiePlaybackEvents],
    vap: [...vapPlaybackEvents]
  };
  const invalidOpen = await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "daily-invalid-open",
    source: "fileButton",
    localPath: ""
  });
  assert.equal(invalidOpen.status, "failed");
  assert.deepEqual(svgaPlaybackEvents, playerEventsBeforeInvalidOpen.svga);
  assert.deepEqual(lottiePlaybackEvents, playerEventsBeforeInvalidOpen.lottie);
  assert.deepEqual(vapPlaybackEvents, playerEventsBeforeInvalidOpen.vap);
});

test("owner-visible open autoplay failure revokes prior replacement authority and recovers on the new source", async () => {
  const lottiePath = "/Users/designer/private/prior-card.json";
  const svgaPath = "/Users/designer/private/recovery-frame.svga";
  const lottieLoadCalls: LottieSvgLoadOptions[] = [];
  const failingAdapter = new OneShotPlayRejectingPlaybackAdapter();
  const session = createOwnerVisibleMultiFormatPreviewCandidate({
    host: memoryHost({
      [lottiePath]: minimalLottie({
        assets: [{ id: "avatar", p: "avatar.png", w: 20, h: 20 }],
        layers: [{ ind: 1, ty: 2, nm: "Avatar", refId: "avatar" }]
      }),
      [`${lottiePath}::avatar.png`]: Uint8Array.from([1, 2, 3]),
      [svgaPath]: svgaHintBytes()
    }),
    lottieTarget: { container: { id: "prior-lottie" } },
    lottieRendererLoader: async () => fakeLottieRenderer(lottieLoadCalls),
    svgaAdapter: new FakeSvgaAdapter(),
    svgaPlaybackAdapter: failingAdapter,
    svgaPlaybackTarget: { id: "new-svga" }
  });

  await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "open-prior-lottie",
    source: "fileButton",
    localPath: lottiePath
  });
  const priorReplacement = await session.applyReplacement({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "prior-replace",
    targetId: "avatar",
    kind: "image",
    value: "data:image/png;base64,QUJD"
  });
  assert.equal(priorReplacement.replacement.dirty, true);

  const failedOpen = await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "open-svga-play-fails",
    source: "fileOpenEvent",
    localPath: svgaPath
  });

  assert.equal(failedOpen.status, "playbackFailed");
  assert.equal(failedOpen.requestId, "open-svga-play-fails");
  assert.equal(failedOpen.detectedFormat, "svga");
  assert.equal(failedOpen.commands.play, false);
  assert.equal(failedOpen.commands.recover, true);
  assert.equal(failedOpen.commands.replace, true);
  assert.equal(failedOpen.replacement.dirty, false);
  assert.equal(failedOpen.replacement.resetEnabled, false);
  assert.deepEqual(failedOpen.replacement.active, []);
  assert.equal(failedOpen.rightPanel.issues.at(-1)?.code, "playback_failure");
  assert.equal(failedOpen.rightPanel.issues.at(-1)?.message, "文件预览播放出现问题。");
  assertNoLocalPaths(failedOpen);

  const recovered = await session.recoverPlayback();
  assert.equal(recovered.status, "previewReady");
  assert.equal(recovered.detectedFormat, "svga");
  assert.equal(recovered.replacement.dirty, false);
  const resumed = await session.play();
  assert.equal(resumed.status, "playing");
  assert.equal(resumed.detectedFormat, "svga");
  assert.equal(lottieLoadCalls.length, 2);
  assertNoLocalPaths(resumed);
});

test("owner-visible open catches a rejected workspace.play without leaking stale source authority", async () => {
  const lottiePath = "/Users/designer/private/autoplay-reject-card.json";
  const loadCalls: LottieSvgLoadOptions[] = [];
  const session = createOwnerVisibleMultiFormatPreviewCandidate({
    host: memoryHost({
      [lottiePath]: minimalLottie({
        assets: [{ id: "avatar", p: "avatar.png", w: 20, h: 20 }],
        layers: [{ ind: 1, ty: 2, nm: "Avatar", refId: "avatar" }]
      }),
      [`${lottiePath}::avatar.png`]: Uint8Array.from([1, 2, 3])
    }),
    lottieTarget: { container: { id: "autoplay-reject" } },
    lottieRendererLoader: async () => fakeLottieRenderer(loadCalls)
  });
  const internal = session as unknown as {
    workspace: {
      play(): Promise<unknown>;
      recoverPlayback(): Promise<unknown>;
    };
  };
  const originalPlay = internal.workspace.play.bind(internal.workspace);
  internal.workspace.play = async () => {
    throw new Error("Autoplay rejected for /Users/designer/private/autoplay-reject-card.json");
  };

  const failed = await session.openLocalCandidate({
    gate: OWNER_VISIBLE_MULTIFORMAT_PREVIEW_WP5_GATE,
    requestId: "open-workspace-play-reject",
    source: "fileOpenEvent",
    localPath: lottiePath
  });

  assert.equal(failed.status, "playbackFailed");
  assert.equal(failed.detectedFormat, "lottie");
  assert.equal(failed.requestId, "open-workspace-play-reject");
  assert.equal(failed.commands.play, false);
  assert.equal(failed.commands.recover, true);
  assert.equal(failed.replacement.dirty, false);
  assert.deepEqual(failed.replacement.active, []);
  assert.equal(failed.rightPanel.issues.at(-1)?.code, "playback_failure");
  assert.equal(failed.rightPanel.issues.at(-1)?.message, "文件预览播放出现问题。");
  assert.equal(loadCalls.length, 1);
  assertNoLocalPaths(failed);

  internal.workspace.play = originalPlay;
  const recovered = await session.recoverPlayback();
  assert.equal(recovered.status, "previewReady");
  assert.equal(recovered.detectedFormat, "lottie");
  const resumed = await session.play();
  assert.equal(resumed.status, "playing");
  assert.equal(resumed.replacement.dirty, false);
  assertNoLocalPaths(resumed);
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

  play(): void {
    this.events.push("play");
  }
  pause(): void {
    this.events.push("pause");
  }
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

  constructor(private readonly events: string[] = []) {}

  createSession(): PlaybackSession {
    return new FakePlaybackSession({}, this.events);
  }
}

class FakePlaybackSession implements PlaybackSession {
  private state: PlaybackState = playbackState("idle");

  constructor(
    private readonly options: { rejectPlay?: boolean } = {},
    private readonly events: string[] = []
  ) {}

  async load(source: MotionAssetSource): Promise<WorkbenchResult<MotionAssetInfo>> {
    this.events.push("load");
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
    if (this.options.rejectPlay) {
      throw new Error("SVGA playback rejected during open.");
    }
    this.events.push("play");
    this.state = { ...this.state, status: "playing" };
  }

  pause(): void {
    this.events.push("pause");
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
    this.events.push("destroy");
    this.state = { ...this.state, status: "disposed" };
  }
}

class OneShotPlayRejectingPlaybackAdapter implements PlaybackAdapter<unknown> {
  readonly format = "svga" as const;
  private remainingFailures = 1;

  createSession(): PlaybackSession {
    const shouldRejectPlay = this.remainingFailures > 0;
    if (shouldRejectPlay) this.remainingFailures -= 1;
    return new FakePlaybackSession({ rejectPlay: shouldRejectPlay });
  }
}

interface FakeVapRuntime {
  constructor: VapRuntimeConstructor;
  configs: VapRuntimeConfig[];
  events: string[];
}

function fakeVapRuntime(events: string[] = []): FakeVapRuntime {
  const runtime: FakeVapRuntime = {
    configs: [],
    events,
    constructor(options) {
      if (!options) throw new Error("VAP runtime config is required.");
      runtime.configs.push(options);
      return new FakeVapPlayer(runtime.events);
    }
  };
  return runtime;
}

class FakeVapPlayer implements VapRuntimePlayer {
  constructor(private readonly events: string[] = []) {}

  on(): VapRuntimePlayer {
    return this;
  }
  destroy(): void {
    this.events.push("destroy");
  }
  pause(): void {
    this.events.push("pause");
  }
  play(): VapRuntimePlayer {
    this.events.push("play");
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

function fusionImageTextConfig(): Record<string, unknown> {
  return {
    src: [
      { srcId: 1, srcType: "img", srcTag: "avatar", w: 120, h: 120, fitType: "centerCrop" },
      { srcId: 2, srcType: "text", srcTag: "title", color: "#ffffff", style: "bold" }
    ],
    frame: [{
      i: 0,
      obj: [
        { srcId: 1, z: 3, frame: { x: 10, y: 20, w: 120, h: 120 }, mFrame: { x: 0, y: 0, w: 120, h: 120 }, mt: 0 },
        { srcId: 2, z: 4, frame: { x: 140, y: 20, w: 200, h: 40 }, mFrame: { x: 120, y: 0, w: 200, h: 40 }, mt: 0 }
      ]
    }]
  };
}

function collidingFusionImageConfig(): Record<string, unknown> {
  return {
    src: [
      { srcId: 1, srcType: "img", srcTag: "vap_fusion_2", w: 120, h: 120, fitType: "centerCrop" },
      { srcId: 2, srcType: "img", srcTag: "badge", w: 80, h: 80, fitType: "centerCrop" }
    ],
    frame: [{
      i: 0,
      obj: [
        { srcId: 1, z: 3, frame: { x: 10, y: 20, w: 120, h: 120 }, mFrame: { x: 0, y: 0, w: 120, h: 120 }, mt: 0 },
        { srcId: 2, z: 4, frame: { x: 140, y: 20, w: 80, h: 80 }, mFrame: { x: 120, y: 0, w: 80, h: 80 }, mt: 0 }
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

function assertDailyOpenSurface(
  model: OwnerVisibleMultiFormatPreviewModel,
  expected: {
    format: "svga" | "lottie" | "vap";
    factIds: string[];
    inventoryGroups: string[];
    imageTargets: string[];
    textTargets: string[];
  }
): void {
  assert.equal(model.status, "playing");
  assert.equal(model.detectedFormat, expected.format);
  assert.equal(model.commands.pause, true);
  assert.equal(model.commands.play, false);
  assert.equal(model.commands.replace, true);
  assert.equal(model.commands.resetReplacement, false);
  assert.equal(model.saveExportSupported, false);
  assert.equal(model.pathRedacted, true);
  assert.deepEqual(model.rightPanel.facts.map(({ id }) => id), expected.factIds);
  assert.deepEqual(
    model.rightPanel.assetInventory.groups.map(({ id }) => id),
    expected.inventoryGroups
  );
  const snapshot = JSON.parse(model.ownerRightPanelSnapshotEnvelope.snapshotJson) as {
    imageTargets: Array<{ resourceId?: string; imageKey?: string }>;
    textTargets: Array<{ textKey?: string; resourceId?: string }>;
  };
  assert.deepEqual(
    snapshot.imageTargets.map(({ resourceId, imageKey }) => resourceId ?? imageKey),
    expected.imageTargets
  );
  assert.deepEqual(
    snapshot.textTargets.map(({ textKey, resourceId }) => textKey ?? resourceId),
    expected.textTargets
  );
  assertNoLocalPaths(model);
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
