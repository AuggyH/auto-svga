import assert from "node:assert/strict";
import test from "node:test";
import { encode } from "fast-png";
import { decodeRgbaPng } from "../utils/png-reader.js";

test("decodeRgbaPng supports 8-bit indexed PNG palette and transparency", () => {
  const bytes = encode({
    width: 2,
    height: 1,
    data: Uint8Array.from([0, 1]),
    channels: 1,
    depth: 8,
    palette: [
      [0, 0, 0, 0],
      [255, 255, 255, 255]
    ]
  });

  const decoded = decodeRgbaPng(Buffer.from(bytes));

  assert.equal(decoded.width, 2);
  assert.equal(decoded.height, 1);
  assert.deepEqual([...decoded.pixels], [
    0, 0, 0, 0,
    255, 255, 255, 255
  ]);
});

test("decodeRgbaPng supports packed 4-bit indexed PNG palettes", () => {
  const bytes = encode({
    width: 4,
    height: 1,
    data: Uint8Array.from([0x01, 0x23]),
    channels: 1,
    depth: 4,
    palette: [
      [0, 0, 0, 255],
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 255]
    ]
  });

  const decoded = decodeRgbaPng(Buffer.from(bytes));

  assert.deepEqual([...decoded.pixels], [
    0, 0, 0, 255,
    255, 0, 0, 255,
    0, 255, 0, 255,
    0, 0, 255, 255
  ]);
});
