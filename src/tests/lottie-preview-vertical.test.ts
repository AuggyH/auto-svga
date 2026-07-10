import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  HIDDEN_LOTTIE_PREVIEW_VERTICAL_GATE,
  createHiddenLottiePreviewVerticalSession,
  type HiddenLottiePreviewHost,
  type HiddenLottiePreviewHostFileStat,
  type HiddenLottiePreviewHostResourceRead
} from "../workbench/lottie-preview-vertical.js";
import {
  createLottiePreviewNodeHost
} from "../hosts/lottie-preview-node-host.js";
import type {
  LottieSvgAnimationItem,
  LottieSvgLoadOptions,
  LottieSvgRendererModule
} from "../workbench/lottie-svg-playback-adapter.js";

const textEncoder = new TextEncoder();
const tinyPngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
]);

test("hidden Lottie vertical requires the explicit gate before local host reads", async () => {
  const host = memoryHost({
    "/Users/designer/Secret Campaign/inline.json": minimalLottie()
  });
  const session = createHiddenLottiePreviewVerticalSession({
    host,
    target: { container: {} },
    rendererLoader: async () => fakeRenderer()
  });

  const model = await session.openLocalCandidate({
    gate: "0.1",
    requestId: "open-1",
    source: "dragDrop",
    localPath: "/Users/designer/Secret Campaign/inline.json"
  });

  assert.equal(model.status, "failed");
  assert.equal(model.issues[0]?.code, "unsupported");
  assert.equal(model.issues[0]?.details?.reason, "gate_required");
  assert.equal(host.statCalls, 0);
  assertNoLocalPaths(model);
});

test("hidden Lottie vertical opens, inspects, resolves adjacent images, plays, seeks, loops, disposes, and recovers", async () => {
  const loadCalls: LottieSvgLoadOptions[] = [];
  const animations: FakeAnimation[] = [];
  const localPath = "/Users/designer/Secret Campaign/hero.json";
  const host = memoryHost({
    [localPath]: lottieWithRelativeImageAndText(),
    [`${localPath}::images/hero.png`]: tinyPngBytes
  });
  const session = createHiddenLottiePreviewVerticalSession({
    host,
    target: { container: { id: "hidden-target" } },
    rendererLoader: async () => fakeRenderer(loadCalls, animations)
  });

  const opened = await session.openLocalCandidate({
    gate: HIDDEN_LOTTIE_PREVIEW_VERTICAL_GATE,
    requestId: "open-1",
    source: "dragDrop",
    localPath,
    displayName: localPath
  });

  assert.equal(opened.status, "ready");
  assert.equal(opened.overview?.format, "lottie");
  assert.equal(opened.overview?.version, "5.7.4");
  assert.equal(opened.overview?.imageAssetCount, 1);
  assert.equal(opened.overview?.textCandidateCount, 1);
  assert.equal(opened.layers.map(({ kind }) => kind).join(","), "image,text");
  assert.equal(opened.assets[0]?.resolutionStatus, "resolved");
  assert.equal(opened.assets[0]?.referencePath, "images/hero.png");
  assert.equal(opened.replaceable.images[0]?.id, "img_hero");
  assert.equal(opened.replaceable.texts[0]?.initialText, "Hello");
  assert.equal(host.fullReads, 0);
  assert.deepEqual(host.rangeReads.map(({ offset, length }) => [offset, length]), [
    [0, 262_144],
    [0, 262_144],
    [0, 262_144]
  ]);
  assert.deepEqual(host.resourceReads, [{
    sourceLocalPath: localPath,
    relativePath: "images/hero.png",
    maxBytes: 1_048_576
  }]);
  assert.equal(loadCalls.length, 1);
  assert.equal(loadCalls[0]?.renderer, "svg");
  assert.equal(loadCalls[0]?.autoplay, false);
  const animationData = loadCalls[0]?.animationData as { assets?: Array<{ p?: string; u?: string }> };
  assert.match(animationData.assets?.[0]?.p ?? "", /^data:image\/png;base64,/u);
  assert.equal(animationData.assets?.[0]?.u, "");
  assertNoLocalPaths(opened);

  const playing = await session.play();
  assert.equal(playing.status, "playing");
  assert.equal(animations[0]?.plays, 1);

  const paused = session.pause();
  assert.equal(paused.status, "paused");
  assert.equal(animations[0]?.pauses, 1);

  const looped = session.setLoop(true);
  assert.equal(looped.playback.loop, true);
  assert.equal(animations[0]?.loop, true);

  const seeked = session.seek(500);
  assert.equal(seeked.playback.currentTimeMs, 500);
  assert.deepEqual(animations[0]?.seeks.at(-1), [500, false]);

  animations[0]?.emit("data_failed");
  const recovered = await session.recoverPlayback();
  assert.equal(recovered.status, "ready");
  assert.equal(animations[0]?.destroys, 1);
  assert.equal(animations[1]?.destroys, 0);

  const disposed = session.dispose();
  assert.equal(disposed.status, "disposed");
  assert.equal(animations[1]?.destroys, 1);
});

test("hidden Lottie vertical fails closed for missing adjacent image resources without loading the renderer", async () => {
  let rendererLoads = 0;
  const localPath = "/Users/designer/Secret Campaign/missing-image.json";
  const session = createHiddenLottiePreviewVerticalSession({
    host: memoryHost({ [localPath]: lottieWithRelativeImageAndText() }),
    target: { container: {} },
    rendererLoader: async () => {
      rendererLoads += 1;
      return fakeRenderer();
    }
  });

  const model = await session.openLocalCandidate({
    gate: HIDDEN_LOTTIE_PREVIEW_VERTICAL_GATE,
    requestId: "open-1",
    source: "fileButton",
    localPath
  });

  assert.equal(model.status, "playbackBlocked");
  assert.equal(model.issues.some(({ code }) => code === "missing_resource"), true);
  assert.equal(model.assets[0]?.resolutionStatus, "missing");
  assert.equal(rendererLoads, 0);
  assertNoLocalPaths(model);
});

test("hidden Lottie vertical surfaces unsupported markers and blocks playback before the renderer", async () => {
  let rendererLoads = 0;
  const localPath = "/Users/designer/Secret Campaign/expression.json";
  const session = createHiddenLottiePreviewVerticalSession({
    host: memoryHost({
      [localPath]: minimalLottie({
        layers: [{ ind: 1, ty: 4, nm: "shape with expression", xp: "time*2" }]
      })
    }),
    target: { container: {} },
    rendererLoader: async () => {
      rendererLoads += 1;
      return fakeRenderer();
    }
  });

  const model = await session.openLocalCandidate({
    gate: HIDDEN_LOTTIE_PREVIEW_VERTICAL_GATE,
    requestId: "open-1",
    source: "menuOpen",
    localPath
  });

  assert.equal(model.status, "playbackBlocked");
  assert.deepEqual(model.unsupportedFeatures.map(({ feature }) => feature), ["expression"]);
  assert.equal(model.issues.some(({ code }) => code === "unsupported_feature"), true);
  assert.equal(rendererLoads, 0);
  assertNoLocalPaths(model);
});

test("hidden Lottie vertical maps renderer load failures to typed playback failure and can recover", async () => {
  let shouldFail = true;
  const localPath = "/Users/designer/Secret Campaign/inline.json";
  const animations: FakeAnimation[] = [];
  const session = createHiddenLottiePreviewVerticalSession({
    host: memoryHost({ [localPath]: minimalLottie({ layers: [{ ind: 1, ty: 4 }] }) }),
    target: { container: {} },
    rendererLoader: async () => ({
      loadAnimation(options) {
        if (shouldFail) throw new Error("renderer exploded at /Users/designer/local/renderer.js");
        return fakeRenderer([], animations).loadAnimation(options);
      }
    })
  });

  const failed = await session.openLocalCandidate({
    gate: HIDDEN_LOTTIE_PREVIEW_VERTICAL_GATE,
    requestId: "open-1",
    source: "fileButton",
    localPath
  });

  assert.equal(failed.status, "playbackFailed");
  assert.equal(failed.issues.some(({ code }) => code === "playback_failure"), true);
  assertNoLocalPaths(failed);

  shouldFail = false;
  const recovered = await session.recoverPlayback();
  assert.equal(recovered.status, "ready");
  assert.equal(animations.length, 1);
});

test("hidden Lottie vertical ignores a stale slow open after a faster newer open wins", async () => {
  const slowPath = "/Users/designer/Secret Campaign/slow.json";
  const fastPath = "/Users/designer/Secret Campaign/fast.json";
  const host = memoryHost({
    [slowPath]: minimalLottie({ w: 111, h: 100, layers: [{ ind: 1, ty: 4, nm: "slow shape" }] }),
    [fastPath]: minimalLottie({ w: 222, h: 100, layers: [{ ind: 1, ty: 4, nm: "fast shape" }] })
  });
  const slowReadGate = deferred<void>();
  const originalReadRange = host.readLocalFileRange.bind(host);
  let slowReadBlocked = false;
  host.readLocalFileRange = async (localPath, offset, length) => {
    if (localPath === slowPath && !slowReadBlocked) {
      slowReadBlocked = true;
      await slowReadGate.promise;
    }
    return originalReadRange(localPath, offset, length);
  };
  const loadCalls: LottieSvgLoadOptions[] = [];
  const session = createHiddenLottiePreviewVerticalSession({
    host,
    target: { container: {} },
    rendererLoader: async () => fakeRenderer(loadCalls)
  });

  const slowOpen = session.openLocalCandidate({
    gate: HIDDEN_LOTTIE_PREVIEW_VERTICAL_GATE,
    requestId: "slow",
    source: "fileButton",
    localPath: slowPath
  });
  await waitUntil(() => slowReadBlocked);

  const fastModel = await session.openLocalCandidate({
    gate: HIDDEN_LOTTIE_PREVIEW_VERTICAL_GATE,
    requestId: "fast",
    source: "dragDrop",
    localPath: fastPath
  });

  assert.equal(fastModel.status, "ready");
  assert.equal(fastModel.requestId, "fast");
  assert.equal(fastModel.displayName, "fast.json");
  assert.equal(fastModel.overview?.dimensions, "222 x 100");

  slowReadGate.resolve();
  const staleReturn = await slowOpen;
  const finalModel = session.getModel();

  assert.equal(staleReturn.requestId, "fast");
  assert.equal(staleReturn.displayName, "fast.json");
  assert.equal(staleReturn.overview?.dimensions, "222 x 100");
  assert.equal(finalModel.requestId, "fast");
  assert.equal(finalModel.displayName, "fast.json");
  assert.equal(finalModel.overview?.dimensions, "222 x 100");
  assert.equal(loadCalls.length, 1);
  assertNoLocalPaths(finalModel);
});

test("hidden Lottie vertical prevents stale renderer loadAnimation after a newer open wins", async () => {
  const slowPath = "/Users/designer/Secret Campaign/slow-renderer.json";
  const fastPath = "/Users/designer/Secret Campaign/fast-renderer.json";
  const host = memoryHost({
    [slowPath]: minimalLottie({ w: 111, h: 100, layers: [{ ind: 1, ty: 4, nm: "slow renderer shape" }] }),
    [fastPath]: minimalLottie({ w: 222, h: 100, layers: [{ ind: 1, ty: 4, nm: "fast renderer shape" }] })
  });
  const rendererGate = deferred<void>();
  const target = { mutations: [] as string[] };
  const loadLabels: string[] = [];
  let rendererLoaderCalls = 0;
  let slowRendererBlocked = false;
  const session = createHiddenLottiePreviewVerticalSession({
    host,
    target: { container: target },
    rendererLoader: async () => {
      rendererLoaderCalls += 1;
      if (rendererLoaderCalls === 1) {
        slowRendererBlocked = true;
        await rendererGate.promise;
        return labeledRenderer("slow", loadLabels);
      }
      return labeledRenderer("fast", loadLabels);
    }
  });

  const slowOpen = session.openLocalCandidate({
    gate: HIDDEN_LOTTIE_PREVIEW_VERTICAL_GATE,
    requestId: "slow",
    source: "fileButton",
    localPath: slowPath
  });
  await waitUntil(() => slowRendererBlocked);

  const fastModel = await session.openLocalCandidate({
    gate: HIDDEN_LOTTIE_PREVIEW_VERTICAL_GATE,
    requestId: "fast",
    source: "dragDrop",
    localPath: fastPath
  });

  assert.equal(fastModel.status, "ready");
  assert.equal(fastModel.requestId, "fast");
  assert.equal(fastModel.displayName, "fast-renderer.json");
  assert.equal(fastModel.overview?.dimensions, "222 x 100");
  assert.deepEqual(loadLabels, ["fast"]);
  assert.deepEqual(target.mutations, ["fast"]);

  rendererGate.resolve();
  const staleReturn = await slowOpen;
  const finalModel = session.getModel();

  assert.equal(staleReturn.requestId, "fast");
  assert.equal(staleReturn.displayName, "fast-renderer.json");
  assert.equal(staleReturn.overview?.dimensions, "222 x 100");
  assert.equal(finalModel.requestId, "fast");
  assert.equal(finalModel.displayName, "fast-renderer.json");
  assert.equal(finalModel.overview?.dimensions, "222 x 100");
  assert.deepEqual(loadLabels, ["fast"]);
  assert.deepEqual(target.mutations, ["fast"]);
  assertNoLocalPaths(finalModel);
});

test("hidden Lottie vertical keeps disposed sessions terminal for later public controls", async () => {
  const localPath = "/Users/designer/Secret Campaign/inline.json";
  const session = createHiddenLottiePreviewVerticalSession({
    host: memoryHost({ [localPath]: minimalLottie({ layers: [{ ind: 1, ty: 4 }] }) }),
    target: { container: {} },
    rendererLoader: async () => fakeRenderer()
  });

  const opened = await session.openLocalCandidate({
    gate: HIDDEN_LOTTIE_PREVIEW_VERTICAL_GATE,
    requestId: "open-1",
    source: "fileButton",
    localPath
  });
  assert.equal(opened.status, "ready");

  const disposed = session.dispose();
  assert.equal(disposed.status, "disposed");

  assert.equal((await session.play()).status, "disposed");
  assert.equal(session.pause().status, "disposed");
  assert.equal(session.seek(250).status, "disposed");
  assert.equal(session.setLoop(true).status, "disposed");
  assert.equal((await session.recoverPlayback()).status, "disposed");
  assert.equal(session.getModel().issues.some(({ code }) => code === "playback_failure"), false);
});

test("Node hidden Lottie host proves range reads and adjacent resource resolution on synthetic temp files", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "auto-svga-lottie-"));
  try {
    await mkdir(path.join(tempRoot, "images"));
    const localPath = path.join(tempRoot, "hero.json");
    await writeFile(localPath, lottieWithRelativeImageAndText());
    await writeFile(path.join(tempRoot, "images", "hero.png"), tinyPngBytes);

    const loadCalls: LottieSvgLoadOptions[] = [];
    const session = createHiddenLottiePreviewVerticalSession({
      host: createLottiePreviewNodeHost(),
      target: { container: {} },
      rendererLoader: async () => fakeRenderer(loadCalls)
    });

    const model = await session.openLocalCandidate({
      gate: HIDDEN_LOTTIE_PREVIEW_VERTICAL_GATE,
      requestId: "open-1",
      source: "fileButton",
      localPath
    });

    assert.equal(model.status, "ready");
    assert.equal(model.assets[0]?.resolutionStatus, "resolved");
    assert.match(
      ((loadCalls[0]?.animationData as { assets?: Array<{ p?: string }> }).assets?.[0]?.p) ?? "",
      /^data:image\/png;base64,/u
    );
    assertNoLocalPaths(model);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("hidden Lottie vertical keeps formal 0.1 visible command text SVGA-only", async () => {
  const source = await import("../workbench/short-term-command-menu.js");
  const appState = await import("../workbench/short-term-app-state.js");
  const flatItems = source.flattenShortTermCommandMenuItems(
    source.createShortTermCommandMenuModel(appState.createShortTermLaunchAppState())
  );
  const visibleCommandText = flatItems
    .flatMap((item) => [item.id, item.label, item.sourceCommandId])
    .filter((value): value is string => typeof value === "string")
    .join("\n");

  assert.doesNotMatch(visibleCommandText, /vap|lottie|format|import[-_ ]?package|格式|导入包/iu);
});

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

function lottieWithRelativeImageAndText(): Uint8Array {
  return minimalLottie({
    assets: [{ id: "img_hero", w: 16, h: 16, u: "images/", p: "hero.png" }],
    layers: [
      { ind: 1, ty: 2, nm: "Hero image", refId: "img_hero" },
      { ind: 2, ty: 5, nm: "Title text", t: { d: { k: [{ s: { t: "Hello" } }] } } }
    ]
  });
}

function memoryHost(files: Record<string, Uint8Array>): HiddenLottiePreviewHost & {
  statCalls: number;
  fullReads: number;
  rangeReads: Array<{ localPath: string; offset: number; length: number }>;
  resourceReads: Array<{ sourceLocalPath: string; relativePath: string; maxBytes: number }>;
} {
  const state = {
    statCalls: 0,
    fullReads: 0,
    rangeReads: [] as Array<{ localPath: string; offset: number; length: number }>,
    resourceReads: [] as Array<{ sourceLocalPath: string; relativePath: string; maxBytes: number }>
  };
  return {
    ...state,
    async statLocalFile(localPath: string): Promise<HiddenLottiePreviewHostFileStat> {
      state.statCalls += 1;
      this.statCalls = state.statCalls;
      const bytes = files[localPath];
      if (!bytes) throw new Error(`Cannot stat ${localPath}`);
      return {
        sizeBytes: bytes.byteLength,
        displayName: localPath.split(/[\\/]/u).at(-1),
        mediaType: localPath.endsWith(".json") ? "application/json" : undefined
      };
    },
    async readLocalFileRange(localPath: string, offset: number, length: number): Promise<Uint8Array> {
      state.rangeReads.push({ localPath, offset, length });
      this.rangeReads = state.rangeReads;
      const bytes = files[localPath];
      if (!bytes) throw new Error(`Cannot read ${localPath}`);
      return bytes.slice(offset, offset + length);
    },
    async readAdjacentResource(input): Promise<HiddenLottiePreviewHostResourceRead> {
      state.resourceReads.push(input);
      this.resourceReads = state.resourceReads;
      const bytes = files[`${input.sourceLocalPath}::${input.relativePath}`];
      if (!bytes) throw new Error(`Cannot read ${input.sourceLocalPath}/${input.relativePath}`);
      return {
        bytes,
        sizeBytes: bytes.byteLength,
        mediaType: input.relativePath.endsWith(".png") ? "image/png" : undefined
      };
    }
  };
}

function fakeRenderer(
  loadCalls: LottieSvgLoadOptions[] = [],
  animations: FakeAnimation[] = []
): LottieSvgRendererModule {
  return {
    loadAnimation(options) {
      loadCalls.push(options);
      const animation = new FakeAnimation();
      animations.push(animation);
      return animation;
    }
  };
}

function labeledRenderer(label: string, loadLabels: string[]): LottieSvgRendererModule {
  return {
    loadAnimation(options) {
      loadLabels.push(label);
      (options.container as { mutations?: string[] }).mutations?.push(label);
      return new FakeAnimation();
    }
  };
}

class FakeAnimation implements LottieSvgAnimationItem {
  plays = 0;
  pauses = 0;
  destroys = 0;
  loop = false;
  seeks: Array<[number, boolean | undefined]> = [];
  private readonly listeners = new Map<string, Array<() => void>>();

  play(): void {
    this.plays += 1;
  }

  pause(): void {
    this.pauses += 1;
  }

  destroy(): void {
    this.destroys += 1;
  }

  goToAndStop(frameOrTime: number, isFrame?: boolean): void {
    this.seeks.push([frameOrTime, isFrame]);
  }

  setLoop(loop: boolean): void {
    this.loop = loop;
  }

  addEventListener(eventName: string, handler: () => void): void {
    const handlers = this.listeners.get(eventName) ?? [];
    handlers.push(handler);
    this.listeners.set(eventName, handlers);
  }

  removeEventListener(eventName: string, handler: () => void): void {
    const handlers = this.listeners.get(eventName) ?? [];
    this.listeners.set(eventName, handlers.filter((entry) => entry !== handler));
  }

  emit(eventName: string): void {
    for (const handler of this.listeners.get(eventName) ?? []) handler();
  }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for asynchronous test condition.");
}

function assertNoLocalPaths(value: unknown): void {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /\/Users\/designer|Secret Campaign|[A-Za-z]:\\\\Users\\\\designer/u);
}
