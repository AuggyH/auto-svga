import assert from "node:assert/strict";
import test from "node:test";

import {
  LOTTIE_WEB_SVG_ENTRYPOINT,
  LOTTIE_WEB_SVG_NODE_NEXT_ENTRYPOINT,
  LOTTIE_SVG_PLAYBACK_WP2B_GATE,
  LottieSvgPlaybackAdapter,
  type LottieSvgAnimationItem,
  type LottieSvgLoadOptions,
  type LottieSvgRendererModule
} from "../workbench/lottie-svg-playback-adapter.js";
import type { MotionAssetSource } from "../workbench/contracts.js";

const textEncoder = new TextEncoder();

test("WP2B Lottie playback requires the explicit gate before reading or loading renderer", async () => {
  let reads = 0;
  let rendererLoads = 0;
  const adapter = new LottieSvgPlaybackAdapter({
    gate: "0.2-wp2a",
    rendererLoader: async () => {
      rendererLoads += 1;
      return fakeRenderer();
    }
  });
  const session = adapter.createSession({ container: {} });

  const result = await session.load(memorySource(
    "inline-shape.json",
    minimalLottie(),
    { onRead: () => { reads += 1; } }
  ));

  assert.equal(result.value, undefined);
  assert.equal(result.issues[0]?.code, "unsupported");
  assert.equal(result.issues[0]?.details?.reason, "gate_required");
  assert.equal(reads, 0);
  assert.equal(rendererLoads, 0);
});

test("loads inline animationData through the hidden SVG renderer and controls lifecycle", async () => {
  const loadCalls: LottieSvgLoadOptions[] = [];
  const animations: FakeAnimation[] = [];
  const renderer = fakeRenderer(loadCalls, animations);
  const adapter = new LottieSvgPlaybackAdapter({
    gate: LOTTIE_SVG_PLAYBACK_WP2B_GATE,
    rendererLoader: async () => renderer
  });
  const session = adapter.createSession({ container: { id: "target" } });

  const result = await session.load(memorySource("inline-shape.json", minimalLottie({
    layers: [{ ind: 1, ty: 4, nm: "shape" }]
  })));

  assert.equal(result.issues.length, 0);
  assert.equal(result.value?.format, "lottie");
  assert.equal(session.getState().status, "ready");
  assert.equal(session.getState().durationMs, 2000);
  assert.equal(loadCalls.length, 1);
  assert.equal(loadCalls[0]?.renderer, "svg");
  assert.equal(loadCalls[0]?.autoplay, false);
  assert.equal(loadCalls[0]?.loop, false);
  assert.ok(loadCalls[0]?.animationData);
  assert.equal("path" in (loadCalls[0] as unknown as Record<string, unknown>), false);

  await session.play();
  assert.equal(session.getState().status, "playing");
  assert.equal(animations[0]?.plays, 1);

  session.pause();
  assert.equal(session.getState().status, "paused");
  assert.equal(animations[0]?.pauses, 1);

  session.setLoop(true);
  assert.equal(session.getState().loop, true);
  assert.equal(animations[0]?.loop, true);

  session.seek(500);
  assert.equal(session.getState().currentTimeMs, 500);
  assert.deepEqual(animations[0]?.seeks.at(-1), [500, false]);

  await session.replay();
  assert.equal(session.getState().status, "playing");
  assert.deepEqual(animations[0]?.seeks.at(-1), [0, false]);

  session.dispose();
  assert.equal(session.getState().status, "disposed");
  assert.equal(animations[0]?.destroys, 1);
});

test("fails closed for unsupported Lottie features before renderer load", async () => {
  let rendererLoads = 0;
  const adapter = new LottieSvgPlaybackAdapter({
    gate: LOTTIE_SVG_PLAYBACK_WP2B_GATE,
    rendererLoader: async () => {
      rendererLoads += 1;
      return fakeRenderer();
    }
  });

  const result = await adapter.createSession({ container: {} }).load(memorySource(
    "expression.json",
    minimalLottie({
      layers: [{ ind: 1, ty: 4, nm: "expression shape", xp: "time*2" }]
    })
  ));

  assert.equal(result.value, undefined);
  assert.equal(result.issues[0]?.code, "unsupported_feature");
  assert.equal(result.issues[0]?.details?.reason, "unsupported_feature_precondition");
  assert.match(JSON.stringify(result.issues), /expression/);
  assert.equal(rendererLoads, 0);
});

test("plays standard masks while keeping AE effects as reduced-fidelity advisories", async () => {
  let rendererLoads = 0;
  const adapter = new LottieSvgPlaybackAdapter({
    gate: LOTTIE_SVG_PLAYBACK_WP2B_GATE,
    rendererLoader: async () => {
      rendererLoads += 1;
      return fakeRenderer();
    }
  });
  const session = adapter.createSession({ container: {} });

  const result = await session.load(memorySource(
    "masked-effect.json",
    minimalLottie({
      layers: [{
        ind: 1,
        ty: 4,
        nm: "masked effect shape",
        hasMask: true,
        masksProperties: [{ mode: "a" }],
        ef: [{ ty: 5, mn: "ADBE WRPMESH" }]
      }]
    })
  ));

  assert.ok(result.value);
  assert.equal(session.getState().status, "ready");
  assert.equal(rendererLoads, 1);
  assert.deepEqual(result.issues.map(({ details }) => details?.playbackDisposition), ["advisory"]);
  assert.match(JSON.stringify(result.issues), /effect/);
  assert.doesNotMatch(JSON.stringify(result.issues), /\"feature\":\"mask\"/);
});

test("fails closed for external image and font resources in the animationData-only spike", async () => {
  let rendererLoads = 0;
  const adapter = new LottieSvgPlaybackAdapter({
    gate: LOTTIE_SVG_PLAYBACK_WP2B_GATE,
    rendererLoader: async () => {
      rendererLoads += 1;
      return fakeRenderer();
    }
  });
  const result = await adapter.createSession({ container: {} }).load(memorySource(
    "asset-font.json",
    minimalLottie({
      assets: [{ id: "img_0", w: 10, h: 10, u: "images/", p: "safe.png" }],
      fonts: { list: [{ fName: "Inter-Regular", fFamily: "Inter" }] },
      layers: [{ ind: 1, ty: 2, nm: "image", refId: "img_0" }]
    })
  ));

  assert.equal(result.value, undefined);
  assert.equal(result.issues[0]?.code, "parse_precondition");
  assert.equal(result.issues[0]?.details?.reason, "external_resources_deferred");
  assert.deepEqual(result.issues[0]?.details?.resourceKinds, ["image", "font"]);
  assert.equal(rendererLoads, 0);
});

test("maps malformed JSON and unsafe inspection paths to redacted typed preconditions", async () => {
  const adapter = new LottieSvgPlaybackAdapter({
    gate: LOTTIE_SVG_PLAYBACK_WP2B_GATE,
    rendererLoader: async () => fakeRenderer()
  });
  const result = await adapter.createSession({ container: {} }).load(memorySource(
    "/Users/designer/Secret Campaign/broken.json",
    textEncoder.encode("{\"v\":\"5.7.4\"")
  ));

  assert.equal(result.value, undefined);
  assert.equal(result.issues[0]?.code, "parse_precondition");
  assert.equal(result.issues[0]?.path, "[local path]");
  assert.doesNotMatch(JSON.stringify(result), /\/Users\/designer/);
});

test("maps missing renderer dependency to typed feedback", async () => {
  const adapter = new LottieSvgPlaybackAdapter({
    gate: LOTTIE_SVG_PLAYBACK_WP2B_GATE,
    rendererLoader: async () => {
      throw new Error("Cannot find /Users/designer/local/lottie_svg.js");
    }
  });
  const result = await adapter.createSession({ container: {} }).load(memorySource(
    "inline-shape.json",
    minimalLottie({ layers: [{ ind: 1, ty: 4 }] })
  ));

  assert.equal(result.value, undefined);
  assert.equal(result.issues[0]?.code, "missing_dependency");
  assert.equal(result.issues[0]?.details?.dependency, "lottie-web@5.13.0");
  assert.equal(result.issues[0]?.details?.entryPoint, "lottie-web/build/player/lottie_svg");
  assert.doesNotMatch(JSON.stringify(result), /\/Users\/designer/);
});

test("default loader uses the approved SVG entry point and fails typed in a non-DOM test host", async () => {
  const adapter = new LottieSvgPlaybackAdapter({
    gate: LOTTIE_SVG_PLAYBACK_WP2B_GATE
  });
  const result = await adapter.createSession({ container: {} }).load(memorySource(
    "inline-shape.json",
    minimalLottie({ layers: [{ ind: 1, ty: 4 }] })
  ));

  assert.equal(LOTTIE_WEB_SVG_ENTRYPOINT, "lottie-web/build/player/lottie_svg");
  assert.equal(LOTTIE_WEB_SVG_NODE_NEXT_ENTRYPOINT, "lottie-web/build/player/lottie_svg.js");
  assert.equal(result.value, undefined);
  assert.equal(result.issues[0]?.code, "missing_dependency");
  assert.equal(result.issues[0]?.details?.entryPoint, LOTTIE_WEB_SVG_ENTRYPOINT);
});

test("maps renderer load failures and data_failed callbacks to error state", async () => {
  const adapter = new LottieSvgPlaybackAdapter({
    gate: LOTTIE_SVG_PLAYBACK_WP2B_GATE,
    rendererLoader: async () => ({
      loadAnimation() {
        throw new Error("bad animation payload");
      }
    })
  });
  const failed = await adapter.createSession({ container: {} }).load(memorySource(
    "inline-shape.json",
    minimalLottie({ layers: [{ ind: 1, ty: 4 }] })
  ));

  assert.equal(failed.value, undefined);
  assert.equal(failed.issues[0]?.code, "renderer_failure");

  const animations: FakeAnimation[] = [];
  const session = new LottieSvgPlaybackAdapter({
    gate: LOTTIE_SVG_PLAYBACK_WP2B_GATE,
    rendererLoader: async () => fakeRenderer([], animations)
  }).createSession({ container: {} });
  const loaded = await session.load(memorySource("inline-shape.json", minimalLottie({
    layers: [{ ind: 1, ty: 4 }]
  })));

  assert.ok(loaded.value);
  animations[0]?.emit("data_failed");
  assert.equal(session.getState().status, "error");
  assert.equal(animations[0]?.destroys, 1);
});

test("ignores a stale renderer failure callback after session disposal", async () => {
  const animations: FakeAnimation[] = [];
  const session = new LottieSvgPlaybackAdapter({
    gate: LOTTIE_SVG_PLAYBACK_WP2B_GATE,
    rendererLoader: async () => fakeRenderer([], animations)
  }).createSession({ container: {} });

  await session.load(memorySource("first.json", minimalLottie()));
  const staleFailure = animations[0]?.snapshotHandlers("data_failed")[0];
  session.dispose();
  staleFailure?.();

  assert.equal(session.getState().status, "disposed");
  assert.equal(animations[0]?.destroys, 1);
});

test("ignores a stale renderer failure callback after loading a newer animation", async () => {
  const animations: FakeAnimation[] = [];
  const session = new LottieSvgPlaybackAdapter({
    gate: LOTTIE_SVG_PLAYBACK_WP2B_GATE,
    rendererLoader: async () => fakeRenderer([], animations)
  }).createSession({ container: {} });

  await session.load(memorySource("first.json", minimalLottie()));
  const staleFailure = animations[0]?.snapshotHandlers("error")[0];
  await session.load(memorySource("second.json", minimalLottie()));
  staleFailure?.();

  assert.equal(session.getState().status, "ready");
  assert.equal(animations[0]?.destroys, 1);
  assert.equal(animations[1]?.destroys, 0);
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

function memorySource(
  name: string,
  bytes: Uint8Array,
  options: { onRead?: () => void } = {}
): MotionAssetSource {
  return {
    id: name,
    name,
    sizeBytes: bytes.byteLength,
    mediaType: "application/json",
    async read() {
      options.onRead?.();
      return new Uint8Array(bytes);
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

  snapshotHandlers(eventName: string): Array<() => void> {
    return [...(this.listeners.get(eventName) ?? [])];
  }
}
