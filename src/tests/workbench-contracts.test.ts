import assert from "node:assert/strict";
import test from "node:test";
import { FORMAT_CAPABILITY_BASELINES, MOTION_FORMATS } from "../workbench/capabilities.js";

test("workbench format registry contains each planned format exactly once", () => {
  assert.deepEqual(MOTION_FORMATS, [
    "svga",
    "vap",
    "lottie",
    "animated_webp",
    "webm",
    "apng",
    "sprite_sequence"
  ]);
  assert.equal(new Set(MOTION_FORMATS).size, MOTION_FORMATS.length);
  assert.deepEqual(FORMAT_CAPABILITY_BASELINES.map(({ format }) => format), MOTION_FORMATS);
});

test("capability profiles cover the seven workbench capability categories", () => {
  const expected = [
    "playback",
    "parse",
    "replaceable_content",
    "convert",
    "export",
    "spec_check",
    "performance_check"
  ].sort();

  for (const profile of FORMAT_CAPABILITY_BASELINES) {
    assert.deepEqual(profile.assessments.map(({ capability }) => capability).sort(), expected, profile.format);
  }
});

test("only existing SVGA behavior is marked current", () => {
  const current = FORMAT_CAPABILITY_BASELINES.flatMap((profile) =>
    profile.assessments
      .filter(({ maturity }) => maturity === "current")
      .map(({ capability }) => `${profile.format}:${capability}`)
  );

  assert.deepEqual(current.sort(), ["svga:export", "svga:parse", "svga:playback"]);
});
