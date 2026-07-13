import assert from "node:assert/strict";
import test from "node:test";

import type { MotionAssetInfo, WorkbenchResult } from "../workbench/contracts.js";
import {
  VAP_WEB_APPROVED_DEPENDENCY,
  VAP_WEB_PLAYBACK_WP3C_GATE,
  VapWebPlaybackAdapter,
  loadDefaultVapRuntime,
  type VapRuntimeConfig,
  type VapRuntimePlayer,
  type VapWebPlaybackSource
} from "../workbench/vap-web-playback-adapter.js";

test("VAP Web adapter requires the explicit WP3C gate before constructing the runtime", async () => {
  let runtimeLoads = 0;
  const source = playbackSource();
  const session = new VapWebPlaybackAdapter({
    gate: "0.1",
    runtimeLoader: async () => {
      runtimeLoads += 1;
      return fakeRuntime().constructor;
    }
  }).createSession({ container: {}, hostReadiness: readyHost() });

  const result = await session.load(source);

  assert.equal(result.value, undefined);
  assert.equal(result.issues[0]?.code, "unsupported");
  assert.equal(result.issues[0]?.details?.reason, "gate_required");
  assert.equal(runtimeLoads, 0);
  assert.equal(source.releases, 1);
});

test("VAP Web adapter loads the approved runtime with local object URL config and controls lifecycle", async () => {
  const runtime = fakeRuntime();
  const source = playbackSource();
  const session = new VapWebPlaybackAdapter({
    gate: VAP_WEB_PLAYBACK_WP3C_GATE,
    runtimeLoader: async () => runtime.constructor
  }).createSession({ container: { id: "target" }, hostReadiness: readyHost() });

  const loaded = await session.load(source);
  assert.equal(loaded.value?.format, "vap");
  assert.equal(session.getState().status, "ready");
  assert.equal(runtime.configs.length, 1);
  assert.equal(runtime.configs[0]?.src, "blob:auto-svga-vap/effect");
  assert.equal(runtime.configs[0]?.config, source.vapConfig);
  assert.equal(runtime.configs[0]?.precache, false);
  assert.equal(runtime.configs[0]?.accurate, true);
  assert.equal(runtime.configs[0]?.avatar, "data:image/png;base64,AAAA");
  assert.equal(runtime.configs[0]?.nickname, "Codex");

  await session.play();
  assert.equal(runtime.players[0]?.plays, 1);
  assert.equal(session.getState().status, "playing");

  session.pause();
  assert.equal(runtime.players[0]?.pauses, 1);

  session.seek(750);
  assert.deepEqual(runtime.players[0]?.setTimes, [0.75]);

  session.setLoop(true);
  assert.equal(session.getState().loop, true);
  assert.equal(runtime.configs.at(-1)?.loop, true);

  session.dispose();
  assert.equal(runtime.players[0]?.destroys, 1);
  assert.equal(source.releases, 1);
  assert.equal(session.getState().status, "disposed");
  session.pause();
  session.setLoop(false);
  assert.equal(session.getState().status, "disposed");
});

test("VAP Web adapter mounts base video when fusion replacements are not provided", async () => {
  const runtime = fakeRuntime();
  const source = playbackSource({ fusionParams: {} });
  const session = new VapWebPlaybackAdapter({
    gate: VAP_WEB_PLAYBACK_WP3C_GATE,
    runtimeLoader: async () => runtime.constructor
  }).createSession({ container: { id: "target" }, hostReadiness: readyHost() });

  const loaded = await session.load(source);

  assert.equal(loaded.value?.format, "vap");
  assert.equal(session.getState().status, "ready");
  assert.equal(runtime.configs.length, 1);
  assert.equal(runtime.configs[0]?.avatar, undefined);
  assert.equal(runtime.configs[0]?.nickname, undefined);
  assert.equal(source.releases, 0);
});

test("VAP Web adapter maps missing dependency to typed feedback and revokes the object URL", async () => {
  const source = playbackSource();
  const session = new VapWebPlaybackAdapter({
    gate: VAP_WEB_PLAYBACK_WP3C_GATE,
    runtimeLoader: async () => {
      throw new Error("missing from /Users/designer/local/runtime.js");
    }
  }).createSession({ container: {}, hostReadiness: readyHost() });

  const result = await session.load(source);

  assert.equal(result.value, undefined);
  assert.equal(result.issues[0]?.code, "missing_dependency");
  assert.equal(result.issues[0]?.details?.dependency, VAP_WEB_APPROVED_DEPENDENCY);
  assert.equal(source.releases, 1);
  assertNoLocalPaths(result);
});

test("VAP Web adapter blocks unsupported preparation states before runtime construction", async () => {
  let runtimeLoads = 0;
  const source = playbackSource({
    asset: validVapAsset({ videoCodec: "hvc1", displayWidth: 1600 })
  });
  const session = new VapWebPlaybackAdapter({
    gate: VAP_WEB_PLAYBACK_WP3C_GATE,
    runtimeLoader: async () => {
      runtimeLoads += 1;
      return fakeRuntime().constructor;
    }
  }).createSession({
    container: {},
    hostReadiness: {
      ...readyHost(),
      webglAvailable: false
    }
  });

  const result = await session.load(source);

  assert.equal(result.value, undefined);
  assert.ok(result.issues.some(({ code, details }) =>
    code === "capability" && details?.preparationDetails
  ));
  assert.ok(result.issues.some(({ code, details }) =>
    code === "unsupported_feature" && details?.preparationCode === "unsupported_feature"
  ));
  assert.equal(runtimeLoads, 0);
  assert.equal(source.releases, 1);
});

test("VAP Web adapter destroys and revokes on runtime error and ignores stale callbacks", async () => {
  const runtime = fakeRuntime();
  const first = playbackSource({ objectUrl: "blob:auto-svga-vap/first" });
  const second = playbackSource({ objectUrl: "blob:auto-svga-vap/second" });
  const session = new VapWebPlaybackAdapter({
    gate: VAP_WEB_PLAYBACK_WP3C_GATE,
    runtimeLoader: async () => runtime.constructor
  }).createSession({ container: {}, hostReadiness: readyHost() });

  await session.load(first);
  await session.load(second);

  assert.equal(first.releases, 1);
  assert.equal(runtime.players[0]?.destroys, 1);
  runtime.players[0]?.emit("error", new Error("old error"));
  assert.equal(session.getState().status, "ready");
  assert.equal(second.releases, 0);

  runtime.players[1]?.emit("error", new Error("active error"));
  assert.equal(session.getState().status, "error");
  assert.equal(second.releases, 1);
  assert.equal(runtime.players[1]?.destroys, 1);
});

test("VAP Web adapter checks cancellation immediately before runtime/container mutation", async () => {
  let runtimeLoads = 0;
  const source = playbackSource();
  const cancellation = {
    get cancelled() {
      return true;
    },
    throwIfCancelled() {
      throw new Error("cancelled before runtime");
    }
  };
  const session = new VapWebPlaybackAdapter({
    gate: VAP_WEB_PLAYBACK_WP3C_GATE,
    runtimeLoader: async () => {
      runtimeLoads += 1;
      return fakeRuntime().constructor;
    }
  }).createSession({ container: {}, hostReadiness: readyHost() });

  await assert.rejects(() => session.load(source, { cancellation }), /cancelled/u);
  assert.equal(runtimeLoads, 0);
  assert.equal(source.releases, 1);
});

test("default VAP runtime loader resolves the approved package constructor without invoking it", async () => {
  const runtime = await loadDefaultVapRuntime();
  assert.equal(typeof runtime, "function");
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

function playbackSource(options: {
  objectUrl?: string;
  asset?: MotionAssetInfo;
  fusionParams?: Record<string, unknown>;
} = {}): VapWebPlaybackSource & { releases: number } {
  let releases = 0;
  const asset = options.asset ?? validVapAsset();
  return {
    id: "/Users/designer/Secret Campaign/effect.mp4",
    name: "/Users/designer/Secret Campaign/effect.mp4",
    sizeBytes: 4096,
    mediaType: "video/mp4",
    objectUrl: options.objectUrl ?? "blob:auto-svga-vap/effect",
    vapConfig: vapConfig(),
    inspection: { value: asset, issues: [] },
    fusionParams: options.fusionParams ?? {
      avatar: "data:image/png;base64,AAAA",
      nickname: "Codex"
    },
    async read() {
      throw new Error("adapter tests should not read full VAP bytes");
    },
    async releaseObjectUrl() {
      releases += 1;
    },
    get releases() {
      return releases;
    }
  };
}

function validVapAsset(options: {
  videoCodec?: string;
  displayWidth?: number;
} = {}): MotionAssetInfo {
  const displayWidth = options.displayWidth ?? 720;
  return {
    format: "vap",
    name: "effect.mp4",
    sizeBytes: 4096,
    dimensions: { width: displayWidth, height: 405 },
    timing: { fps: 30, frameCount: 60, durationMs: 2000 },
    resources: [
      {
        id: "vap_fusion_avatar",
        name: "avatar",
        kind: "image",
        role: "static_image",
        dimensions: { width: 120, height: 120 },
        replaceable: true,
        metadata: {
          vapResourceType: "fusion_source",
          srcId: "1",
          srcTag: "avatar",
          srcType: "image",
          fitType: "centerCrop"
        }
      },
      {
        id: "vap_fusion_name",
        name: "nickname",
        kind: "unknown",
        role: "unknown",
        replaceable: true,
        metadata: {
          vapResourceType: "fusion_source",
          srcId: "2",
          srcTag: "nickname",
          srcType: "text",
          style: "bold"
        }
      }
    ],
    layers: [
      {
        id: "vap_layer_avatar",
        name: "avatar",
        kind: "vap_fusion_image",
        resourceIds: ["vap_fusion_avatar"],
        replaceable: true,
        metadata: {
          placementCount: 1,
          placements: [{ frameIndex: 0, z: 3, frame: { x: 10, y: 20, w: 120, h: 120 } }],
          zValues: [3]
        }
      },
      {
        id: "vap_layer_name",
        name: "nickname",
        kind: "vap_fusion_text",
        resourceIds: ["vap_fusion_name"],
        replaceable: true,
        metadata: {
          placementCount: 1,
          placements: [{ frameIndex: 0, z: 4, frame: { x: 160, y: 20, w: 200, h: 40 } }],
          zValues: [4]
        }
      }
    ],
    metadata: {
      vap: {
        displayDimensions: { width: displayWidth, height: 405 },
        videoDimensions: { width: 720, height: 810 },
        frameCount: 60,
        fps: 30,
        durationMs: 2000,
        config: vapConfig(),
        container: {
          videoCodec: options.videoCodec ?? "avc1",
          audioPresent: false,
          videoPresent: true,
          boundedSampleTruncated: false
        }
      }
    }
  };
}

function vapConfig(): Record<string, unknown> {
  return {
    info: {
      v: 2,
      f: 60,
      w: 720,
      h: 405,
      videoW: 720,
      videoH: 810,
      fps: 30,
      aFrame: { x: 0, y: 405, w: 720, h: 405 },
      rgbFrame: { x: 0, y: 0, w: 720, h: 405 }
    },
    src: [
      { srcId: 1, srcType: "img", srcTag: "avatar", w: 120, h: 120 },
      { srcId: 2, srcType: "txt", srcTag: "nickname", w: 200, h: 40 }
    ],
    frame: []
  };
}

function fakeRuntime() {
  const configs: VapRuntimeConfig[] = [];
  const players: FakeVapPlayer[] = [];
  const constructor = (config?: VapRuntimeConfig): VapRuntimePlayer => {
    if (config) configs.push(config);
    const player = new FakeVapPlayer(configs);
    players.push(player);
    return player;
  };
  return { constructor, configs, players };
}

class FakeVapPlayer implements VapRuntimePlayer {
  readonly configs: VapRuntimeConfig[];
  readonly handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  plays = 0;
  pauses = 0;
  destroys = 0;
  setTimes: number[] = [];

  constructor(configs: VapRuntimeConfig[]) {
    this.configs = configs;
  }

  on(eventName: string, callback: (...args: unknown[]) => void): VapRuntimePlayer {
    const handlers = this.handlers.get(eventName) ?? [];
    handlers.push(callback);
    this.handlers.set(eventName, handlers);
    return this;
  }

  play(options?: VapRuntimeConfig): VapRuntimePlayer {
    this.plays += 1;
    if (options) this.configs.push(options);
    return this;
  }

  pause(): void {
    this.pauses += 1;
  }

  setTime(seconds: number): void {
    this.setTimes.push(seconds);
  }

  destroy(): void {
    this.destroys += 1;
  }

  emit(eventName: string, ...args: unknown[]): void {
    for (const handler of this.handlers.get(eventName) ?? []) handler(...args);
  }
}

function assertNoLocalPaths(value: WorkbenchResult<MotionAssetInfo>): void {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /\/Users\/designer|C:\\\\Users\\\\designer/u);
}
