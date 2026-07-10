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
  HIDDEN_MULTIFORMAT_PREVIEW_WORKSPACE_GATE,
  createHiddenMultiFormatPreviewWorkspace,
  type HiddenMultiFormatPreviewHost
} from "../workbench/multiformat-preview-workspace.js";
import type {
  VapRuntimeConfig,
  VapRuntimeConstructor,
  VapRuntimePlayer
} from "../workbench/vap-web-playback-adapter.js";

const textEncoder = new TextEncoder();

test("hidden multi-format workspace requires the explicit 0.2 gate before host reads", async () => {
  const localPath = "/Users/designer/Secret Campaign/inline.json";
  const host = memoryHost({ [localPath]: minimalLottie() });
  const workspace = createHiddenMultiFormatPreviewWorkspace({
    host,
    lottieTarget: { container: {} },
    lottieRendererLoader: async () => fakeLottieRenderer()
  });

  const model = await workspace.openLocalCandidate({
    gate: "0.1",
    requestId: "open-1",
    source: "dragDrop",
    localPath
  });

  assert.equal(model.status, "failed");
  assert.equal(model.issues[0]?.code, "unsupported");
  assert.equal(model.issues[0]?.details?.reason, "gate_required");
  assert.equal(model.visibleIn01, false);
  assert.equal(model.supportClaim, false);
  assert.equal(host.statCalls, 0);
  assertNoLocalPaths(model);
});

test("hidden multi-format workspace opens and controls Lottie through the approved vertical", async () => {
  const localPath = "/Users/designer/Secret Campaign/title.json";
  const loadCalls: LottieSvgLoadOptions[] = [];
  const animations: FakeLottieAnimation[] = [];
  const host = memoryHost({
    [localPath]: minimalLottie({
      layers: [{ ind: 1, ty: 5, nm: "Title", t: { d: { k: [{ s: { t: "Hello" } }] } } }]
    })
  });
  const workspace = createHiddenMultiFormatPreviewWorkspace({
    host,
    lottieTarget: { container: { id: "lottie-target" } },
    lottieRendererLoader: async () => fakeLottieRenderer(loadCalls, animations)
  });

  const opened = await workspace.openLocalCandidate({
    gate: HIDDEN_MULTIFORMAT_PREVIEW_WORKSPACE_GATE,
    requestId: "lottie-1",
    source: "fileButton",
    localPath,
    displayName: localPath
  });

  assert.equal(opened.status, "ready");
  assert.equal(opened.detectedFormat, "lottie");
  assert.equal(opened.overview?.format, "lottie");
  assert.equal(opened.overview?.dimensions, "320 x 180");
  assert.equal(opened.overview?.textCandidateCount, 1);
  assert.equal(opened.replaceable.texts[0]?.initialText, "Hello");
  assert.equal(opened.visibleIn01, false);
  assert.equal(opened.supportClaim, false);
  assert.equal(host.fullReads, 0);
  assert.equal(host.rangeReads.every(({ length }) => length <= 262_144), true);
  assert.equal(loadCalls.length, 1);
  assertNoLocalPaths(opened);

  assert.equal((await workspace.play()).status, "playing");
  assert.equal(animations[0]?.plays, 1);
  assert.equal(workspace.pause().status, "paused");
  assert.equal(animations[0]?.pauses, 1);
  assert.equal(workspace.setLoop(true).playback.loop, true);
  assert.equal(animations[0]?.loop, true);
  assert.equal(workspace.seek(500).playback.currentTimeMs, 500);
  assert.deepEqual(animations[0]?.seeks.at(-1), [500, false]);
});

test("hidden multi-format workspace opens and controls VAP fusion data through the approved vertical", async () => {
  const localPath = "/Users/designer/Secret Campaign/fusion.mp4";
  const runtime = fakeVapRuntime();
  const host = memoryHost({ [localPath]: validVapBytes(fusionConfig()) });
  const workspace = createHiddenMultiFormatPreviewWorkspace({
    host,
    vapTarget: { id: "vap-target" },
    vapHostReadiness: readyVapHost(),
    vapRuntimeLoader: async () => runtime.constructor
  });

  const opened = await workspace.openLocalCandidate({
    gate: HIDDEN_MULTIFORMAT_PREVIEW_WORKSPACE_GATE,
    requestId: "vap-1",
    source: "dragDrop",
    localPath,
    displayName: localPath,
    vapFusionReplacements: {
      avatar: { kind: "image", value: "data:image/png;base64,AAAA" },
      nickname: { kind: "text", value: "Ada" }
    }
  });

  assert.equal(opened.status, "ready");
  assert.equal(opened.detectedFormat, "vap");
  assert.equal(opened.overview?.format, "vap");
  assert.equal(opened.overview?.dimensions, "720 x 405");
  assert.equal(opened.overview?.videoCodec, "avc1");
  assert.equal(opened.overview?.fusionElementCount, 2);
  assert.deepEqual(opened.fusionElements.map(({ srcTag }) => srcTag), ["avatar", "nickname"]);
  assert.equal(opened.replaceable.fusionImages[0]?.srcTag, "avatar");
  assert.equal(opened.replaceable.fusionTexts[0]?.srcTag, "nickname");
  assert.equal(runtime.configs[0]?.src, "blob:vap/fusion.mp4");
  assert.equal(runtime.configs[0]?.precache, false);
  assert.equal(runtime.configs[0]?.avatar, "data:image/png;base64,AAAA");
  assert.equal(runtime.configs[0]?.nickname, "Ada");
  assert.equal(host.rangeReads.every(({ length }) => length <= 262_144), true);
  assertNoLocalPaths(opened);

  assert.equal((await workspace.play()).status, "playing");
  assert.equal(runtime.players[0]?.plays, 1);
  assert.equal(workspace.pause().status, "paused");
  assert.equal(runtime.players[0]?.pauses, 1);
  assert.equal(workspace.setLoop(true).playback.loop, true);
  assert.equal(runtime.players[0]?.playOptions.at(-1)?.loop, true);
  assert.equal(workspace.seek(750).playback.currentTimeMs, 750);
  assert.deepEqual(runtime.players[0]?.seeks, [0.75]);
});

test("hidden multi-format workspace normalizes SVGA inspection and optional playback binding without touching 0.1", async () => {
  const localPath = "/Users/designer/Secret Campaign/effect.svga";
  const svgaAdapter = new FakeSvgaAdapter();
  const playbackAdapter = new FakePlaybackAdapter("svga");
  const workspace = createHiddenMultiFormatPreviewWorkspace({
    host: memoryHost({ [localPath]: svgaHintBytes() }),
    svgaAdapter,
    svgaPlaybackAdapter: playbackAdapter,
    svgaPlaybackTarget: { id: "hidden-svga-target" }
  });

  const opened = await workspace.openLocalCandidate({
    gate: HIDDEN_MULTIFORMAT_PREVIEW_WORKSPACE_GATE,
    requestId: "svga-1",
    source: "menuOpen",
    localPath,
    displayName: localPath
  });

  assert.equal(opened.status, "ready");
  assert.equal(opened.detectedFormat, "svga");
  assert.equal(opened.overview?.format, "svga");
  assert.equal(opened.overview?.sourceMaturity, "current");
  assert.equal(opened.overview?.dimensions, "480 x 96");
  assert.equal(opened.overview?.imageResourceCount, 1);
  assert.equal(opened.assets[0]?.id, "img_frame");
  assert.equal(opened.layers[0]?.resourceIds[0], "img_frame");
  assert.equal(opened.replaceable.images[0]?.id, "img_frame");
  assert.equal(svgaAdapter.parseCalls, 1);
  assert.equal(playbackAdapter.sessions.length, 1);
  assert.equal(playbackAdapter.sessions[0]?.loads, 1);
  assertNoLocalPaths(opened);

  assert.equal((await workspace.play()).status, "playing");
  assert.equal(playbackAdapter.sessions[0]?.plays, 1);
  assert.equal(workspace.pause().status, "paused");
  assert.equal(playbackAdapter.sessions[0]?.pauses, 1);
  assert.equal(workspace.setLoop(true).playback.loop, true);
  assert.equal(workspace.seek(250).playback.currentTimeMs, 250);
});

test("hidden multi-format workspace fails closed for unsupported candidates and network VAP fusion images", async () => {
  const textPath = "/Users/designer/Secret Campaign/readme.txt";
  const vapPath = "/Users/designer/Secret Campaign/network-fusion.mp4";
  const unsupportedHost = memoryHost({ [textPath]: textEncoder.encode("not an animation") });
  const unsupportedWorkspace = createHiddenMultiFormatPreviewWorkspace({ host: unsupportedHost });

  const unsupported = await unsupportedWorkspace.openLocalCandidate({
    gate: HIDDEN_MULTIFORMAT_PREVIEW_WORKSPACE_GATE,
    requestId: "bad-1",
    source: "fileButton",
    localPath: textPath
  });

  assert.equal(unsupported.status, "playbackBlocked");
  assert.equal(unsupported.issues.some(({ code }) => code === "unsupported"), true);
  assertNoLocalPaths(unsupported);

  const runtime = fakeVapRuntime();
  const vapWorkspace = createHiddenMultiFormatPreviewWorkspace({
    host: memoryHost({ [vapPath]: validVapBytes(fusionConfig()) }),
    vapTarget: {},
    vapHostReadiness: readyVapHost(),
    vapRuntimeLoader: async () => runtime.constructor
  });
  const network = await vapWorkspace.openLocalCandidate({
    gate: HIDDEN_MULTIFORMAT_PREVIEW_WORKSPACE_GATE,
    requestId: "bad-vap",
    source: "dragDrop",
    localPath: vapPath,
    vapFusionReplacements: {
      avatar: { kind: "image", value: "https://cdn.example.invalid/avatar.png" },
      nickname: { kind: "text", value: "Ada" }
    }
  });

  assert.equal(network.status, "failed");
  assert.equal(network.issues[0]?.code, "unsupported_feature");
  assert.equal(network.issues[0]?.details?.reason, "fusion_image_replacement_must_be_local");
  assert.equal(runtime.configs.length, 0);
  assertNoLocalPaths(network);
});

test("hidden multi-format workspace prevents stale cross-format renderer mutation after a newer open wins", async () => {
  const slowLottiePath = "/Users/designer/Secret Campaign/slow.json";
  const fastSvgaPath = "/Users/designer/Secret Campaign/fast.svga";
  const rendererGate = deferred<void>();
  const loadLabels: string[] = [];
  let rendererBlocked = false;
  const svgaAdapter = new FakeSvgaAdapter();
  const workspace = createHiddenMultiFormatPreviewWorkspace({
    host: memoryHost({
      [slowLottiePath]: minimalLottie({
        w: 111,
        h: 100,
        layers: [{ ind: 1, ty: 4, nm: "slow shape" }]
      }),
      [fastSvgaPath]: svgaHintBytes()
    }),
    lottieTarget: { container: { mutations: [] as string[] } },
    lottieRendererLoader: async () => {
      rendererBlocked = true;
      await rendererGate.promise;
      return labeledLottieRenderer("slow", loadLabels);
    },
    svgaAdapter,
    svgaPlaybackAdapter: new FakePlaybackAdapter("svga")
  });

  const slowOpen = workspace.openLocalCandidate({
    gate: HIDDEN_MULTIFORMAT_PREVIEW_WORKSPACE_GATE,
    requestId: "slow",
    source: "fileButton",
    localPath: slowLottiePath
  });
  await waitUntil(() => rendererBlocked);

  const fastModel = await workspace.openLocalCandidate({
    gate: HIDDEN_MULTIFORMAT_PREVIEW_WORKSPACE_GATE,
    requestId: "fast",
    source: "dragDrop",
    localPath: fastSvgaPath
  });

  assert.equal(fastModel.status, "ready");
  assert.equal(fastModel.requestId, "fast");
  assert.equal(fastModel.detectedFormat, "svga");
  assert.equal(fastModel.displayName, "fast.svga");

  rendererGate.resolve();
  const staleReturn = await slowOpen;
  const finalModel = workspace.getModel();

  assert.equal(staleReturn.requestId, "fast");
  assert.equal(staleReturn.detectedFormat, "svga");
  assert.equal(finalModel.requestId, "fast");
  assert.equal(finalModel.detectedFormat, "svga");
  assert.deepEqual(loadLabels, []);
  assertNoLocalPaths(finalModel);
});

test("hidden multi-format workspace keeps disposed sessions terminal for later public controls", async () => {
  const localPath = "/Users/designer/Secret Campaign/inline.json";
  const workspace = createHiddenMultiFormatPreviewWorkspace({
    host: memoryHost({ [localPath]: minimalLottie({ layers: [{ ind: 1, ty: 4 }] }) }),
    lottieTarget: { container: {} },
    lottieRendererLoader: async () => fakeLottieRenderer()
  });

  const opened = await workspace.openLocalCandidate({
    gate: HIDDEN_MULTIFORMAT_PREVIEW_WORKSPACE_GATE,
    requestId: "open-1",
    source: "fileButton",
    localPath
  });
  assert.equal(opened.status, "ready");

  assert.equal(workspace.dispose().status, "disposed");
  assert.equal((await workspace.play()).status, "disposed");
  assert.equal(workspace.pause().status, "disposed");
  assert.equal(workspace.seek(250).status, "disposed");
  assert.equal(workspace.setLoop(true).status, "disposed");
  assert.equal((await workspace.recoverPlayback()).status, "disposed");
  assert.equal(workspace.getModel().issues.some(({ code }) => code === "playback_failure"), false);
});

test("hidden multi-format workspace keeps formal 0.1 visible command text SVGA-only", async () => {
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

interface MemoryHost extends HiddenMultiFormatPreviewHost {
  statCalls: number;
  fullReads: number;
  rangeReads: Array<{ localPath: string; offset: number; length: number }>;
  resourceReads: Array<{ sourceLocalPath: string; relativePath: string; maxBytes: number }>;
  objectUrlCreates: string[];
  revoked: string[];
}

function memoryHost(files: Record<string, Uint8Array>): MemoryHost {
  const host: MemoryHost = {
    statCalls: 0,
    fullReads: 0,
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

class FakeSvgaAdapter implements FormatAdapter {
  readonly format = "svga" as const;
  parseCalls = 0;

  async probe(): Promise<FormatProbeResult> {
    return { format: "svga", confidence: 1, issues: [] };
  }

  async parse(source: MotionAssetSource, context?: WorkbenchOperationContext): Promise<WorkbenchResult<MotionAssetInfo>> {
    this.parseCalls += 1;
    context?.cancellation?.throwIfCancelled();
    await source.read();
    context?.cancellation?.throwIfCancelled();
    return {
      value: {
        format: "svga",
        name: source.name,
        sizeBytes: source.sizeBytes,
        dimensions: { width: 480, height: 96 },
        timing: { fps: 24, frameCount: 48, durationMs: 2_000 },
        resources: [{
          id: "img_frame",
          name: "Frame",
          kind: "image",
          role: "static_image",
          dimensions: { width: 480, height: 96 },
          replaceable: true
        }],
        layers: [{
          id: "sprite_0",
          name: "Frame sprite",
          kind: "sprite",
          resourceIds: ["img_frame"],
          replaceable: true
        }],
        metadata: {
          version: "2.0",
          sourceId: source.id
        }
      },
      issues: []
    };
  }
}

class FakePlaybackAdapter implements PlaybackAdapter<unknown> {
  readonly format: "svga";
  readonly sessions: FakePlaybackSession[] = [];

  constructor(format: "svga") {
    this.format = format;
  }

  createSession(): PlaybackSession {
    const session = new FakePlaybackSession();
    this.sessions.push(session);
    return session;
  }
}

class FakePlaybackSession implements PlaybackSession {
  loads = 0;
  plays = 0;
  pauses = 0;
  destroys = 0;
  private state: PlaybackState = playbackState("idle");

  async load(source: MotionAssetSource, context?: WorkbenchOperationContext): Promise<WorkbenchResult<MotionAssetInfo>> {
    this.loads += 1;
    context?.cancellation?.throwIfCancelled();
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
    this.plays += 1;
    this.state = { ...this.state, status: "playing" };
  }

  pause(): void {
    this.pauses += 1;
    this.state = { ...this.state, status: "paused" };
  }

  seek(timeMs: number): void {
    this.state = { ...this.state, status: "paused", currentTimeMs: timeMs };
  }

  async replay(): Promise<void> {
    this.state = { ...this.state, status: "playing", currentTimeMs: 0 };
  }

  setLoop(loop: boolean): void {
    this.state = { ...this.state, loop };
  }

  getState(): PlaybackState {
    return { ...this.state };
  }

  dispose(): void {
    this.destroys += 1;
    this.state = { ...this.state, status: "disposed" };
  }
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

function svgaHintBytes(): Uint8Array {
  return Uint8Array.from([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01]);
}

function fakeLottieRenderer(
  loadCalls: LottieSvgLoadOptions[] = [],
  animations: FakeLottieAnimation[] = []
): LottieSvgRendererModule {
  return {
    loadAnimation(options) {
      loadCalls.push(options);
      const animation = new FakeLottieAnimation();
      animations.push(animation);
      return animation;
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

interface FakeVapRuntime {
  constructor: VapRuntimeConstructor;
  configs: VapRuntimeConfig[];
  players: FakeVapPlayer[];
}

function fakeVapRuntime(): FakeVapRuntime {
  const runtime: FakeVapRuntime = {
    configs: [],
    players: [],
    constructor(options) {
      if (!options) throw new Error("VAP runtime config is required.");
      runtime.configs.push(options);
      const player = new FakeVapPlayer();
      runtime.players.push(player);
      return player;
    }
  };
  return runtime;
}

class FakeVapPlayer implements VapRuntimePlayer {
  plays = 0;
  pauses = 0;
  destroys = 0;
  seeks: number[] = [];
  playOptions: VapRuntimeConfig[] = [];
  private readonly listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  on(eventName: string, callback: (...args: unknown[]) => void): VapRuntimePlayer {
    const entries = this.listeners.get(eventName) ?? [];
    entries.push(callback);
    this.listeners.set(eventName, entries);
    return this;
  }

  destroy(): void {
    this.destroys += 1;
    this.listeners.clear();
  }

  pause(): void {
    this.pauses += 1;
  }

  play(options?: VapRuntimeConfig): VapRuntimePlayer {
    this.plays += 1;
    if (options) this.playOptions.push(options);
    return this;
  }

  setTime(seconds: number): void {
    this.seeks.push(seconds);
  }
}

function validVapBytes(
  vapcOverrides: Record<string, unknown> | undefined = undefined
): Uint8Array {
  return concatBytes(
    ftypBox(),
    moovBox(),
    mp4Box("vapc", vapcPayload({
      info: vapInfo(),
      ...vapcOverrides
    }))
  );
}

function fusionConfig(): Record<string, unknown> {
  return {
    src: [
      { srcId: 1, srcType: "img", srcTag: "avatar", w: 120, h: 120, fitType: "centerCrop" },
      { srcId: 2, srcType: "txt", srcTag: "nickname", color: "#ffffff", style: "bold" }
    ],
    frame: [{
      i: 0,
      obj: [
        { srcId: 1, z: 3, frame: { x: 10, y: 20, w: 120, h: 120 }, mFrame: { x: 0, y: 0, w: 120, h: 120 }, mt: 0 },
        { srcId: 2, z: 4, frame: { x: 160, y: 20, w: 200, h: 40 }, mFrame: { x: 0, y: 0, w: 200, h: 40 }, mt: 0 }
      ]
    }]
  };
}

function vapInfo(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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
    rgbFrame: { x: 0, y: 0, w: 720, h: 405 },
    ...overrides
  };
}

function vapcPayload(document: Record<string, unknown>): Uint8Array {
  return textEncoder.encode(JSON.stringify(document));
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
    durationMs,
    loop: false
  };
}

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function waitUntil(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Condition was not met.");
}

function assertNoLocalPaths(value: unknown): void {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /\/Users\/designer|C:\\\\Users\\\\designer|Secret Campaign/u);
}
