import assert from "node:assert/strict";
import test from "node:test";

import {
  LOTTIE_JSON_INSPECTION_WP2A_GATE,
  LottieJsonInspectionService,
  type LottieJsonInspectionSource
} from "../workbench/lottie-json-inspection.js";

const textEncoder = new TextEncoder();

test("WP2A Lottie inspection requires the explicit gate before reading", async () => {
  let reads = 0;
  const result = await service().inspect(memorySource("motion.json", minimalLottie(), {
    onRead: () => { reads += 1; }
  }), { gate: "0.2-wp1" });

  assert.equal(result.value, undefined);
  assert.equal(result.issues[0]?.code, "unsupported");
  assert.equal(result.issues[0]?.details?.reason, "gate_required");
  assert.equal(reads, 0);
});

test("normalizes inline Lottie shape timing dimensions and layer metadata", async () => {
  const result = await service().inspect(
    memorySource("inline-shape.json", minimalLottie({
      layers: [{ ind: 1, ty: 4, nm: "sparkle shape" }]
    })),
    { gate: LOTTIE_JSON_INSPECTION_WP2A_GATE }
  );

  assert.equal(result.issues.length, 0);
  assert.equal(result.value?.format, "lottie");
  assert.equal(lottieMetadata(result).version, "5.7.4");
  assert.deepEqual(result.value?.dimensions, { width: 320, height: 180 });
  assert.deepEqual(result.value?.timing, { fps: 30, frameCount: 60, durationMs: 2000 });
  assert.equal(result.value?.layers.length, 1);
  assert.equal(result.value?.layers[0]?.kind, "shape");
  assert.equal(lottieMetadata(result).layerCount, 1);
});

test("normalizes relative image metadata precomps text candidates and fonts without reading assets", async () => {
  const result = await service().inspect(
    memorySource("assets.json", minimalLottie({
      assets: [
        { id: "img_0", w: 128, h: 64, u: "images/", p: "hero.png" },
        { id: "pre_0", layers: [{ ind: 20, ty: 4, nm: "inner" }] }
      ],
      fonts: {
        list: [{ fName: "Inter-Regular", fFamily: "Inter", fStyle: "Regular" }]
      },
      layers: [
        { ind: 1, ty: 2, nm: "Hero image", refId: "img_0" },
        { ind: 2, ty: 0, nm: "Nested animation", refId: "pre_0" },
        { ind: 3, ty: 5, nm: "Title text", t: { d: { k: [{ s: { t: "Hello" } }] } } }
      ]
    })),
    { gate: LOTTIE_JSON_INSPECTION_WP2A_GATE }
  );

  assert.equal(result.issues.length, 0);
  assert.equal(result.value?.resources.length, 3);
  assert.deepEqual(result.value?.resources.map(({ kind }) => kind), ["image", "vector", "font"]);
  assert.equal(result.value?.resources[0]?.metadata?.referencePath, "images/hero.png");
  assert.deepEqual(result.value?.resources[0]?.dimensions, { width: 128, height: 64 });
  assert.equal(result.value?.resources[0]?.replaceable, true);
  assert.deepEqual(result.value?.layers.map(({ kind }) => kind), ["image", "precomp", "text"]);
  assert.equal(result.value?.layers[2]?.replaceable, true);
  assert.equal(result.value?.layers[2]?.metadata?.text, "Hello");
  assert.equal(lottieMetadata(result).imageAssetCount, 1);
  assert.equal(lottieMetadata(result).precompAssetCount, 1);
  assert.equal(lottieMetadata(result).textCandidateCount, 1);
  assert.equal(lottieMetadata(result).fontCount, 1);
});

test("reports unsupported Lottie features without rejecting metadata inspection", async () => {
  const result = await service().inspect(
    memorySource("unsupported.json", minimalLottie({
      layers: [{
        ind: 1,
        ty: 4,
        nm: "masked 3d shape",
        ddd: 1,
        hasMask: true,
        masksProperties: [{}],
        ef: [{}],
        tm: { k: 0 },
        xp: "time*2"
      }]
    })),
    { gate: LOTTIE_JSON_INSPECTION_WP2A_GATE }
  );

  assert.ok(result.value);
  assert.deepEqual(result.issues.map(({ code }) => code), [
    "unsupported_feature",
    "unsupported_feature",
    "unsupported_feature",
    "unsupported_feature",
    "unsupported_feature"
  ]);
  assert.deepEqual(
    result.issues.map(({ details }) => details?.feature),
    ["3d_layer", "mask", "effect", "time_remap", "expression"]
  );
  assert.equal((lottieMetadata(result).unsupportedFeatures as unknown[]).length, 5);
});

test("reports unsupported features nested inside precomp assets", async () => {
  const result = await service().inspect(
    memorySource("precomp-unsupported.json", minimalLottie({
      assets: [{
        id: "pre_masked",
        layers: [{
          ind: 10,
          ty: 4,
          nm: "masked nested shape",
          hasMask: true,
          masksProperties: [{}],
          ef: [{}]
        }]
      }],
      layers: [{ ind: 1, ty: 0, nm: "Precomp layer", refId: "pre_masked" }]
    })),
    { gate: LOTTIE_JSON_INSPECTION_WP2A_GATE }
  );

  assert.ok(result.value);
  assert.deepEqual(
    result.issues.map(({ details }) => details?.feature),
    ["mask", "effect"]
  );
  assert.deepEqual(
    result.issues.map(({ details }) => details?.path),
    ["assets.0.layers.0.masksProperties", "assets.0.layers.0.ef"]
  );
  assert.deepEqual(
    (lottieMetadata(result).unsupportedFeatures as Array<{ path: string }>).map(({ path }) => path),
    ["assets.0.layers.0.masksProperties", "assets.0.layers.0.ef"]
  );
});

test("keeps referenced embedded image assets from producing dangling layer resources", async () => {
  const result = await service().inspect(
    memorySource("embedded-image.json", minimalLottie({
      assets: [{ id: "img_embedded", w: 64, h: 64, e: 1, p: "data:image/png;base64,AA==" }],
      layers: [{ ind: 1, ty: 2, nm: "Embedded image", refId: "img_embedded" }]
    })),
    { gate: LOTTIE_JSON_INSPECTION_WP2A_GATE }
  );

  assert.ok(result.value);
  assert.deepEqual(result.issues.map(({ details }) => details?.feature), ["embedded_image_asset"]);
  assert.equal(result.value.resources.length, 1);
  assert.equal(result.value.resources[0]?.id, "img_embedded");
  assert.equal(result.value.resources[0]?.replaceable, false);
  assert.equal(result.value.resources[0]?.metadata?.embedded, true);
  assert.deepEqual(result.value.layers[0]?.resourceIds, ["img_embedded"]);
  const resourceIds = new Set(result.value.resources.map(({ id }) => id));
  assert.ok(result.value.layers[0]?.resourceIds.every((id) => resourceIds.has(id)));
});

test("fails closed for malformed JSON and redacts local source paths", async () => {
  const result = await service().inspect(
    memorySource("/Users/designer/Secret Campaign/broken.json", textEncoder.encode("{\"v\":\"5.7.4\"")),
    { gate: LOTTIE_JSON_INSPECTION_WP2A_GATE }
  );

  assert.equal(result.value, undefined);
  assert.equal(result.issues[0]?.code, "parse_precondition");
  assert.equal(result.issues[0]?.path, "[local path]");
  assertRedacted(result);
});

test("fails closed for unsafe or missing external image references", async () => {
  for (const [asset, reason] of [
    [{ id: "img_abs", p: "/Users/designer/asset.png" }, "unsafe_image_reference"],
    [{ id: "img_parent", u: "images", p: "../asset.png" }, "unsafe_image_reference"],
    [{ id: "img_file", p: "file:///Users/designer/asset.png" }, "unsafe_image_reference"],
    [{ id: "img_missing", u: "images/" }, "missing_image_reference"]
  ] as const) {
    const result = await service().inspect(
      memorySource("unsafe-image.json", minimalLottie({ assets: [asset] })),
      { gate: LOTTIE_JSON_INSPECTION_WP2A_GATE }
    );

    assert.equal(result.value, undefined);
    assert.equal(result.issues[0]?.code, "asset_reference_precondition");
    assert.equal(result.issues[0]?.details?.reason, reason);
    assertRedacted(result);
  }
});

test("fails closed for ambiguous asset ids and missing layer references", async () => {
  for (const document of [
    minimalLottie({
      assets: [
        { id: "dup", p: "images/a.png" },
        { id: "dup", p: "images/b.png" }
      ]
    }),
    minimalLottie({
      assets: [{ id: "img_0", p: "images/a.png" }],
      layers: [{ ind: 1, ty: 2, refId: "missing" }]
    })
  ]) {
    const result = await service().inspect(
      memorySource("ambiguous.json", document),
      { gate: LOTTIE_JSON_INSPECTION_WP2A_GATE }
    );

    assert.equal(result.value, undefined);
    assert.equal(result.issues[0]?.code, "asset_reference_precondition");
  }
});

test("uses bounded range reads when available and keeps full reads at zero", async () => {
  const bytes = minimalLottie();
  const ranges: Array<[number, number]> = [];
  let fullReads = 0;
  const source: LottieJsonInspectionSource = {
    id: "range-lottie",
    name: "range.json",
    sizeBytes: 1,
    mediaType: "application/json",
    async read() {
      fullReads += 1;
      return textEncoder.encode("{}");
    },
    async readRange(offset, length) {
      ranges.push([offset, length]);
      return bytes.slice(offset, offset + length);
    }
  };
  const result = await service().inspect(source, { gate: LOTTIE_JSON_INSPECTION_WP2A_GATE });

  assert.ok(result.value);
  assert.equal(fullReads, 0);
  assert.deepEqual(ranges, [[0, 262_144]]);
});

function service(): LottieJsonInspectionService {
  return new LottieJsonInspectionService();
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

function memorySource(
  name: string,
  bytes: Uint8Array,
  options: {
    id?: string;
    mediaType?: string;
    onRead?: () => void;
  } = {}
): LottieJsonInspectionSource {
  return {
    id: options.id ?? name,
    name,
    sizeBytes: bytes.byteLength,
    mediaType: options.mediaType,
    async read() {
      options.onRead?.();
      return new Uint8Array(bytes);
    }
  };
}

function assertRedacted(value: unknown): void {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /\/Users\/designer|C:\\\\Users\\\\designer/);
}

function lottieMetadata(result: Awaited<ReturnType<LottieJsonInspectionService["inspect"]>>): Record<string, unknown> {
  const metadata = result.value?.metadata?.lottie;
  assert.ok(metadata && typeof metadata === "object" && !Array.isArray(metadata));
  return metadata as Record<string, unknown>;
}
