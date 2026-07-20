import assert from "node:assert/strict";
import test from "node:test";
import { encode } from "fast-png";
import { FastPngAlphaAnalyzer } from "../hosts/fast-png-alpha-analyzer.js";

const analyzer = new FastPngAlphaAnalyzer();

test("fast-png host analyzer finds RGBA transparent padding", () => {
  const data = new Uint8Array(4 * 4 * 4);
  for (const [x, y] of [[1, 1], [2, 1], [1, 2], [2, 2]]) {
    data[(y * 4 + x) * 4 + 3] = 255;
  }

  assert.deepEqual(analyze(encode({ width: 4, height: 4, data, channels: 4 })), {
    status: "known",
    x: 1,
    y: 1,
    width: 2,
    height: 2,
    transparentPaddingRatio: 0.75
  });
});

test("fast-png host analyzer reports fully transparent RGBA", () => {
  assert.deepEqual(
    analyze(encode({
      width: 2,
      height: 2,
      data: new Uint8Array(2 * 2 * 4),
      channels: 4
    })),
    { status: "fullyTransparent" }
  );
});

test("fast-png host analyzer reports opaque alpha and RGB images", () => {
  const rgba = new Uint8Array(2 * 2 * 4);
  for (let index = 3; index < rgba.length; index += 4) {
    rgba[index] = 255;
  }
  const rgb = new Uint8Array(2 * 2 * 3).fill(127);

  assert.deepEqual(
    analyze(encode({ width: 2, height: 2, data: rgba, channels: 4 })),
    { status: "opaqueOnly" }
  );
  assert.deepEqual(
    analyze(encode({ width: 2, height: 2, data: rgb, channels: 3 })),
    { status: "opaqueOnly" }
  );
});

test("fast-png host analyzer supports grayscale alpha", () => {
  const data = Uint8Array.from([
    127, 0,
    127, 255,
    127, 0
  ]);

  assert.deepEqual(
    analyze(encode({ width: 3, height: 1, data, channels: 2 })),
    {
      status: "known",
      x: 1,
      y: 0,
      width: 1,
      height: 1,
      transparentPaddingRatio: 1 - 1 / 3
    }
  );
});

test("fast-png host analyzer supports indexed transparency", () => {
  const bytes = encode({
    width: 3,
    height: 1,
    data: Uint8Array.from([0, 1, 0]),
    channels: 1,
    depth: 8,
    palette: [
      [0, 0, 0, 0],
      [255, 255, 255, 255]
    ]
  });

  assert.deepEqual(analyze(bytes), {
    status: "known",
    x: 1,
    y: 0,
    width: 1,
    height: 1,
    transparentPaddingRatio: 1 - 1 / 3
  });
});

test("fast-png host analyzer maps malformed decode to unknown", () => {
  assert.deepEqual(
    analyzer.analyze({
      bytes: Uint8Array.from([
        137, 80, 78, 71, 13, 10, 26, 10,
        0, 0, 0, 13, 73, 72, 68, 82,
        0, 0, 0, 1, 0, 0, 0, 1
      ]),
      format: "png",
      dimensions: { width: 1, height: 1 }
    }),
    { status: "unknown" }
  );
});

test("fast-png host analyzer rejects oversized images before decode", () => {
  const limited = new FastPngAlphaAnalyzer({
    maxPixels: 4,
    maxDecodedBytes: 32,
    maxWidth: 4,
    maxHeight: 4
  });
  const bytes = encode({
    width: 3,
    height: 3,
    data: new Uint8Array(3 * 3 * 4),
    channels: 4
  });

  assert.deepEqual(
    limited.analyze({
      bytes,
      format: "png",
      dimensions: { width: 3, height: 3 }
    }),
    { status: "unsupported" }
  );
});

test("fast-png host analyzer does not trust caller dimensions for allocation limits", () => {
  const limited = new FastPngAlphaAnalyzer({
    maxPixels: 4,
    maxDecodedBytes: 32,
    maxWidth: 4,
    maxHeight: 4
  });
  const bytes = encode({
    width: 3,
    height: 3,
    data: new Uint8Array(3 * 3 * 4),
    channels: 4
  });

  assert.deepEqual(
    limited.analyze({
      bytes,
      format: "png",
      dimensions: { width: 1, height: 1 }
    }),
    { status: "unsupported" }
  );
});

test("fast-png host analyzer rejects oversized compressed inputs before decode", () => {
  const limited = new FastPngAlphaAnalyzer({
    maxInputBytes: 3
  });

  assert.deepEqual(
    limited.analyze({
      bytes: new Uint8Array(4),
      format: "png",
      dimensions: { width: 1, height: 1 }
    }),
    { status: "unsupported" }
  );
});

test("fast-png host analyzer maps non-PNG formats to unsupported", () => {
  assert.deepEqual(
    analyzer.analyze({
      bytes: new Uint8Array(),
      format: "unknown"
    }),
    { status: "unsupported" }
  );
});

function analyze(bytes: Uint8Array) {
  return analyzer.analyze({
    bytes,
    format: "png"
  });
}
