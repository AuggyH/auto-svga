import assert from "node:assert/strict";
import test from "node:test";

import {
  HIDDEN_VAP_PREVIEW_VERTICAL_GATE,
  createHiddenVapPreviewVerticalSession,
  type HiddenVapPreviewHost,
  type HiddenVapPreviewHostFileStat,
  type HiddenVapPreviewObjectUrl
} from "../workbench/vap-preview-vertical.js";
import type {
  VapRuntimeConfig,
  VapRuntimeConstructor,
  VapRuntimePlayer
} from "../workbench/vap-web-playback-adapter.js";

const textEncoder = new TextEncoder();

test("hidden VAP vertical requires the explicit gate before local host reads", async () => {
  const localPath = "/Users/designer/Secret Campaign/effect.mp4";
  const host = memoryHost({ [localPath]: validVapBytes() });
  const session = createHiddenVapPreviewVerticalSession({
    host,
    target: { container: {} },
    runtimeLoader: async () => fakeRuntime().constructor
  });

  const model = await session.openLocalCandidate({
    gate: "0.1",
    requestId: "open-1",
    source: "dragDrop",
    localPath
  });

  assert.equal(model.status, "failed");
  assert.equal(model.issues[0]?.code, "unsupported");
  assert.equal(model.issues[0]?.details?.reason, "gate_required");
  assert.equal(host.statCalls, 0);
  assertNoLocalPaths(model);
});

test("hidden VAP vertical inspects, binds fusion data, plays, seeks, loops, disposes, and revokes URLs", async () => {
  const localPath = "/Users/designer/Secret Campaign/fusion.mp4";
  const host = memoryHost({ [localPath]: validVapBytes(fusionConfig()) });
  const runtime = fakeRuntime();
  const session = createHiddenVapPreviewVerticalSession({
    host,
    target: { container: { id: "hidden-vap-target" } },
    hostReadiness: readyHost(),
    runtimeLoader: async () => runtime.constructor
  });

  const opened = await session.openLocalCandidate({
    gate: HIDDEN_VAP_PREVIEW_VERTICAL_GATE,
    requestId: "open-1",
    source: "dragDrop",
    localPath,
    displayName: localPath,
    fusionReplacements: {
      avatar: { kind: "image", value: "data:image/png;base64,AAAA" },
      nickname: { kind: "text", value: "Ada" }
    }
  });

  assert.equal(opened.status, "ready");
  assert.equal(opened.overview?.format, "vap");
  assert.equal(opened.overview?.dimensions, "720 x 405");
  assert.equal(opened.overview?.videoCodec, "avc1");
  assert.equal(opened.overview?.fusionElementCount, 2);
  assert.equal(opened.overview?.imageFusionCount, 1);
  assert.equal(opened.overview?.textFusionCount, 1);
  assert.deepEqual(opened.fusionElements.map(({ srcTag }) => srcTag), ["avatar", "nickname"]);
  assert.deepEqual(opened.fusionElements.map(({ replacementProvided }) => replacementProvided), [true, true]);
  assert.equal(opened.pathRedacted, true);
  assert.equal(opened.rendererHasFullPath, false);
  assert.ok(host.rangeReads.length >= 2);
  assert.equal(host.rangeReads.every(({ length }) => length <= 262_144), true);
  assert.equal(host.objectUrlCreates.length, 1);
  assert.equal(runtime.configs.length, 1);
  assert.equal(runtime.configs[0]?.src, "blob:vap/fusion.mp4");
  assert.equal(runtime.configs[0]?.precache, false);
  assert.equal(runtime.configs[0]?.config && typeof runtime.configs[0].config, "object");
  assert.equal(runtime.configs[0]?.avatar, "data:image/png;base64,AAAA");
  assert.equal(runtime.configs[0]?.nickname, "Ada");
  assertNoLocalPaths(opened);

  const playing = await session.play();
  assert.equal(playing.status, "playing");
  assert.equal(runtime.players[0]?.plays, 1);

  const paused = session.pause();
  assert.equal(paused.status, "paused");
  assert.equal(runtime.players[0]?.pauses, 1);

  const looped = session.setLoop(true);
  assert.equal(looped.playback.loop, true);
  assert.equal(runtime.players[0]?.playOptions.at(-1)?.loop, true);

  const seeked = session.seek(750);
  assert.equal(seeked.playback.currentTimeMs, 750);
  assert.deepEqual(runtime.players[0]?.seeks, [0.75]);

  const disposed = session.dispose();
  assert.equal(disposed.status, "disposed");
  assert.equal(runtime.players[0]?.destroys, 1);
  assert.deepEqual(host.revoked, ["blob:vap/fusion.mp4"]);
});

test("hidden VAP vertical mounts base runtime while marking missing fusion replacements", async () => {
  let runtimeLoads = 0;
  const localPath = "/Users/designer/Secret Campaign/missing-fusion.mp4";
  const host = memoryHost({ [localPath]: validVapBytes(fusionConfig()) });
  const runtime = fakeRuntime();
  const session = createHiddenVapPreviewVerticalSession({
    host,
    target: { container: {} },
    hostReadiness: readyHost(),
    runtimeLoader: async () => {
      runtimeLoads += 1;
      return runtime.constructor;
    }
  });

  const model = await session.openLocalCandidate({
    gate: HIDDEN_VAP_PREVIEW_VERTICAL_GATE,
    requestId: "open-1",
    source: "fileButton",
    localPath
  });

  assert.equal(model.status, "ready");
  assert.equal(model.issues.some(({ code, details, severity }) =>
    code === "missing_resource" && details?.reason === "fusion_replacement_required" && severity === "warning"
  ), true);
  assert.equal(model.fusionElements.every(({ replacementRequired }) => replacementRequired), true);
  assert.equal(host.objectUrlCreates.length, 1);
  assert.equal(runtimeLoads, 1);
  assert.equal(runtime.configs.length, 1);
  assert.equal(runtime.configs[0]?.avatar, undefined);
  assert.equal(runtime.configs[0]?.nickname, undefined);
  assertNoLocalPaths(model);
});

test("hidden VAP vertical rejects network fusion image replacements before local reads", async () => {
  let runtimeLoads = 0;
  const localPath = "/Users/designer/Secret Campaign/network-fusion.mp4";
  const host = memoryHost({ [localPath]: validVapBytes(fusionConfig()) });
  const session = createHiddenVapPreviewVerticalSession({
    host,
    target: { container: {} },
    hostReadiness: readyHost(),
    runtimeLoader: async () => {
      runtimeLoads += 1;
      return fakeRuntime().constructor;
    }
  });

  const model = await session.openLocalCandidate({
    gate: HIDDEN_VAP_PREVIEW_VERTICAL_GATE,
    requestId: "open-1",
    source: "fileButton",
    localPath,
    fusionReplacements: {
      avatar: { kind: "image", value: "https://cdn.example.invalid/avatar.png" },
      nickname: { kind: "text", value: "Ada" }
    }
  });

  assert.equal(model.status, "failed");
  assert.equal(model.issues[0]?.code, "unsupported_feature");
  assert.equal(model.issues[0]?.details?.reason, "fusion_image_replacement_must_be_local");
  assert.equal(host.statCalls, 0);
  assert.equal(host.objectUrlCreates.length, 0);
  assert.equal(runtimeLoads, 0);
  assertNoLocalPaths(model);
});

test("hidden VAP vertical enforces H264-only readiness before runtime/object URL", async () => {
  let runtimeLoads = 0;
  const localPath = "/Users/designer/Secret Campaign/h265.mp4";
  const host = memoryHost({ [localPath]: validVapBytes(undefined, { videoCodec: "hvc1" }) });
  const session = createHiddenVapPreviewVerticalSession({
    host,
    target: { container: {} },
    hostReadiness: readyHost(),
    runtimeLoader: async () => {
      runtimeLoads += 1;
      return fakeRuntime().constructor;
    }
  });

  const model = await session.openLocalCandidate({
    gate: HIDDEN_VAP_PREVIEW_VERTICAL_GATE,
    requestId: "open-1",
    source: "fileButton",
    localPath
  });

  assert.equal(model.status, "playbackBlocked");
  assert.equal(model.issues.some(({ code, details }) =>
    code === "unsupported_feature" && details?.reason === "unsupported_video_codec" && details.codec === "hvc1"
  ), true);
  assert.equal(host.objectUrlCreates.length, 0);
  assert.equal(runtimeLoads, 0);
  assertNoLocalPaths(model);
});

test("hidden VAP vertical revokes stale object URLs and prevents stale runtime construction", async () => {
  const slowPath = "/Users/designer/Secret Campaign/slow.mp4";
  const fastPath = "/Users/designer/Secret Campaign/fast.mp4";
  const objectUrlGate = deferred<void>();
  let slowObjectUrlBlocked = false;
  const host = memoryHost({
    [slowPath]: validVapBytes({ info: vapInfo({ w: 111, h: 100 }) }),
    [fastPath]: validVapBytes({ info: vapInfo({ w: 222, h: 100 }) })
  }, {
    async onCreateObjectUrl(localPath) {
      if (localPath === slowPath && !slowObjectUrlBlocked) {
        slowObjectUrlBlocked = true;
        await objectUrlGate.promise;
      }
    }
  });
  const runtime = fakeRuntime();
  const session = createHiddenVapPreviewVerticalSession({
    host,
    target: { container: {} },
    hostReadiness: readyHost(),
    runtimeLoader: async () => runtime.constructor
  });

  const slowOpen = session.openLocalCandidate({
    gate: HIDDEN_VAP_PREVIEW_VERTICAL_GATE,
    requestId: "slow",
    source: "fileButton",
    localPath: slowPath
  });
  await waitUntil(() => slowObjectUrlBlocked);

  const fastModel = await session.openLocalCandidate({
    gate: HIDDEN_VAP_PREVIEW_VERTICAL_GATE,
    requestId: "fast",
    source: "dragDrop",
    localPath: fastPath
  });

  assert.equal(fastModel.status, "ready");
  assert.equal(fastModel.requestId, "fast");
  assert.equal(fastModel.displayName, "fast.mp4");
  assert.equal(fastModel.overview?.dimensions, "222 x 100");
  assert.deepEqual(runtime.configs.map(({ src }) => src), ["blob:vap/fast.mp4"]);

  objectUrlGate.resolve();
  const staleReturn = await slowOpen;
  const finalModel = session.getModel();

  assert.equal(staleReturn.requestId, "fast");
  assert.equal(staleReturn.displayName, "fast.mp4");
  assert.equal(staleReturn.overview?.dimensions, "222 x 100");
  assert.equal(finalModel.requestId, "fast");
  assert.equal(finalModel.displayName, "fast.mp4");
  assert.equal(finalModel.overview?.dimensions, "222 x 100");
  assert.deepEqual(runtime.configs.map(({ src }) => src), ["blob:vap/fast.mp4"]);
  assert.deepEqual(host.revoked, ["blob:vap/slow.mp4"]);
  assertNoLocalPaths(finalModel);
});

test("hidden VAP vertical repeated open destroys the previous runtime before loading the next source", async () => {
  const firstPath = "/Users/designer/Secret Campaign/first.mp4";
  const secondPath = "/Users/designer/Secret Campaign/second.mp4";
  const host = memoryHost({
    [firstPath]: validVapBytes({ info: vapInfo({ w: 300, h: 100 }) }),
    [secondPath]: validVapBytes({ info: vapInfo({ w: 400, h: 100 }) })
  });
  const runtime = fakeRuntime();
  const session = createHiddenVapPreviewVerticalSession({
    host,
    target: { container: {} },
    hostReadiness: readyHost(),
    runtimeLoader: async () => runtime.constructor
  });

  const first = await session.openLocalCandidate({
    gate: HIDDEN_VAP_PREVIEW_VERTICAL_GATE,
    requestId: "first",
    source: "fileButton",
    localPath: firstPath
  });
  assert.equal(first.status, "ready");

  const second = await session.openLocalCandidate({
    gate: HIDDEN_VAP_PREVIEW_VERTICAL_GATE,
    requestId: "second",
    source: "menuOpen",
    localPath: secondPath
  });

  assert.equal(second.status, "ready");
  assert.equal(second.requestId, "second");
  assert.equal(second.overview?.dimensions, "400 x 100");
  assert.equal(runtime.players[0]?.destroys, 1);
  assert.equal(runtime.players[1]?.destroys, 0);
  assert.deepEqual(host.revoked, ["blob:vap/first.mp4"]);
  assert.deepEqual(runtime.configs.map(({ src }) => src), ["blob:vap/first.mp4", "blob:vap/second.mp4"]);
  assertNoLocalPaths(second);
});

test("hidden VAP vertical maps runtime error cleanup through the next public control", async () => {
  const localPath = "/Users/designer/Secret Campaign/runtime-error.mp4";
  const host = memoryHost({ [localPath]: validVapBytes() });
  const runtime = fakeRuntime();
  const session = createHiddenVapPreviewVerticalSession({
    host,
    target: { container: {} },
    hostReadiness: readyHost(),
    runtimeLoader: async () => runtime.constructor
  });

  const opened = await session.openLocalCandidate({
    gate: HIDDEN_VAP_PREVIEW_VERTICAL_GATE,
    requestId: "open-1",
    source: "fileButton",
    localPath
  });
  assert.equal(opened.status, "ready");

  runtime.players[0]?.emit("error", new Error("runtime failed at /Users/designer/private/runtime.js"));
  assert.equal(runtime.players[0]?.destroys, 1);
  assert.deepEqual(host.revoked, ["blob:vap/runtime-error.mp4"]);

  const failed = await session.play();
  assert.equal(failed.status, "playbackFailed");
  assert.equal(failed.issues.some(({ code }) => code === "playback_failure"), true);
  assertNoLocalPaths(failed);

  const recovered = await session.recoverPlayback();
  assert.equal(recovered.status, "ready");
  assert.equal(recovered.requestId, "open-1:recover");
  assert.equal(runtime.configs.length, 2);
});

test("hidden VAP vertical keeps disposed sessions terminal for later public controls", async () => {
  const localPath = "/Users/designer/Secret Campaign/dispose.mp4";
  const runtime = fakeRuntime();
  const session = createHiddenVapPreviewVerticalSession({
    host: memoryHost({ [localPath]: validVapBytes() }),
    target: { container: {} },
    hostReadiness: readyHost(),
    runtimeLoader: async () => runtime.constructor
  });

  const opened = await session.openLocalCandidate({
    gate: HIDDEN_VAP_PREVIEW_VERTICAL_GATE,
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

test("hidden VAP vertical keeps formal 0.1 visible command text SVGA-only", async () => {
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

function readyHost() {
  return {
    webglAvailable: true,
    h264Mp4DecodeAvailable: true,
    localObjectUrlAvailable: true,
    cspAllowsBlobMedia: true,
    gpuCompositingAvailable: true
  };
}

interface MemoryVapHost extends HiddenVapPreviewHost {
  statCalls: number;
  rangeReads: Array<{ localPath: string; offset: number; length: number }>;
  objectUrlCreates: string[];
  revoked: string[];
}

function memoryHost(
  files: Record<string, Uint8Array>,
  options: {
    sizeBytes?: Record<string, number>;
    onCreateObjectUrl?(localPath: string): Promise<void> | void;
  } = {}
): MemoryVapHost {
  const host: MemoryVapHost = {
    statCalls: 0,
    rangeReads: [],
    objectUrlCreates: [],
    revoked: [],
    async statLocalFile(localPath: string): Promise<HiddenVapPreviewHostFileStat> {
      host.statCalls += 1;
      const bytes = files[localPath];
      if (!bytes) throw new Error(`Cannot stat ${localPath}`);
      return {
        sizeBytes: options.sizeBytes?.[localPath] ?? bytes.byteLength,
        displayName: localPath.split(/[\\/]/u).at(-1),
        mediaType: "video/mp4"
      };
    },
    async readLocalFileRange(localPath: string, offset: number, length: number): Promise<Uint8Array> {
      host.rangeReads.push({ localPath, offset, length });
      const bytes = files[localPath];
      if (!bytes) throw new Error(`Cannot read ${localPath}`);
      return bytes.slice(offset, offset + length);
    },
    async createLocalObjectUrl(input): Promise<HiddenVapPreviewObjectUrl> {
      host.objectUrlCreates.push(input.localPath);
      await options.onCreateObjectUrl?.(input.localPath);
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

interface FakeRuntime {
  constructor: VapRuntimeConstructor;
  configs: VapRuntimeConfig[];
  players: FakeVapPlayer[];
}

function fakeRuntime(): FakeRuntime {
  const runtime: FakeRuntime = {
    configs: [],
    players: [],
    constructor(options) {
      assert.ok(options);
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

  emit(eventName: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(eventName) ?? []) listener(...args);
  }
}

function validVapBytes(
  vapcOverrides: Record<string, unknown> | undefined = undefined,
  mp4Options: { videoCodec?: string; audio?: boolean } = {}
): Uint8Array {
  return concatBytes(
    ftypBox(),
    moovBox(mp4Options),
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

function moovBox(options: { videoCodec?: string; audio?: boolean } = {}): Uint8Array {
  const tracks = [trackBox("vide", options.videoCodec ?? "avc1")];
  if (options.audio) tracks.push(trackBox("soun", "mp4a"));
  return mp4Box("moov", concatBytes(
    mvhdBox(1_000, 2_000),
    ...tracks
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
  assert.equal(handler.length, 4);
  const payload = new Uint8Array(12);
  payload.set(textEncoder.encode(handler), 8);
  return mp4Box("hdlr", payload);
}

function stsdBox(sampleEntry: string): Uint8Array {
  assert.equal(sampleEntry.length, 4);
  const payload = new Uint8Array(16);
  const view = new DataView(payload.buffer);
  view.setUint32(4, 1);
  view.setUint32(8, 8);
  payload.set(textEncoder.encode(sampleEntry), 12);
  return mp4Box("stsd", payload);
}

function mp4Box(type: string, payload: Uint8Array): Uint8Array {
  assert.equal(type.length, 4);
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
