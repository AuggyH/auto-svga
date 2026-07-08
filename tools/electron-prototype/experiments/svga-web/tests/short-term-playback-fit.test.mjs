import assert from "node:assert/strict";
import { test } from "node:test";
import { playbackCanvasFitSize } from "../web/short-term-macos-playback-fit-model.mjs";

test("short-term playback fit preserves a 981 x 360 wide movie ratio on load and resize", () => {
  const initial = playbackCanvasFitSize({
    containerWidth: 900,
    containerHeight: 720,
    movieWidth: 981,
    movieHeight: 360
  });
  const resized = playbackCanvasFitSize({
    containerWidth: 520,
    containerHeight: 420,
    movieWidth: 981,
    movieHeight: 360
  });
  const minimum = playbackCanvasFitSize({
    containerWidth: 360,
    containerHeight: 260,
    movieWidth: 981,
    movieHeight: 360
  });

  assert.equal(initial.width, 900);
  assert.equal(initial.height, 330);
  assert.equal(resized.width, 520);
  assert.equal(resized.height, 190);
  assert.equal(minimum.width, 360);
  assert.equal(minimum.height, 132);
  for (const fit of [initial, resized, minimum]) {
    assert.ok(fit.width <= 900);
    assert.ok(fit.height <= 720);
    assert.ok(Math.abs((fit.width / fit.height) - (981 / 360)) < 0.02);
  }
});
