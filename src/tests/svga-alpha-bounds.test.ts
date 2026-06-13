import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type {
  ImageAlphaBounds,
  MotionAssetInfo,
  MotionSpec
} from "../workbench/contracts.js";
import type { EmbeddedImageAlphaAnalyzer } from "../workbench/image-alpha-analyzer.js";
import {
  SvgaFormatAdapter,
  SvgaMotionSpecChecker
} from "../workbench/svga/index.js";
import type { SvgaBinaryInspector } from "../workbench/svga/types.js";

const spec: MotionSpec = {
  id: "avatar-frame-alpha-bounds",
  label: "Avatar frame alpha bounds",
  maxTransparentPaddingRatio: 0.5
};

test("alpha-bound check passes known transparent padding within the limit", async () => {
  const report = await check(alpha("known", 0.5));

  assert.equal(report.passed, true);
  assert.deepEqual(report.issues, []);
});

test("alpha-bound check rejects known transparent padding over the limit", async () => {
  const report = await check(alpha("known", 0.51));

  assert.equal(report.passed, false);
  assert.deepEqual(report.issues[0], {
    severity: "error",
    code: "resource_transparent_padding_exceeds_limit",
    message: "Embedded image transparent padding exceeds the specification limit.",
    path: "resources[0].alphaBounds",
    details: {
      resourceId: "frame",
      actual: 0.51,
      maximum: 0.5,
      alphaBounds: {
        x: 10,
        y: 10,
        width: 80,
        height: 80
      }
    }
  });
});

test("alpha-bound check rejects fully transparent resources", async () => {
  const report = await check({ status: "fullyTransparent" });

  assert.equal(report.passed, false);
  assert.equal(report.issues[0].code, "resource_fully_transparent");
  assert.equal(report.issues[0].path, "resources[0].alphaBounds");
});

test("unknown and unsupported alpha bounds warn without blocking the report", async () => {
  const report = await new SvgaMotionSpecChecker().check(asset([
    image("unknown", { status: "unknown" }),
    image("unsupported", { status: "unsupported" }),
    image("opaque", { status: "opaqueOnly" })
  ]), spec);

  assert.equal(report.passed, true);
  assert.deepEqual(report.issues, [{
    severity: "warning",
    code: "resource_alpha_bounds_unavailable",
    message: "Alpha-bound metadata is unavailable for one or more embedded image resources.",
    path: "resources",
    details: {
      resources: [
        { resourceId: "unknown", status: "unknown" },
        { resourceId: "unsupported", status: "unsupported" }
      ],
      maximumTransparentPaddingRatio: 0.5
    }
  }]);
});

test("SVGA adapter accepts host-provided alpha metadata and survives analyzer failure", async () => {
  const knownAnalyzer: EmbeddedImageAlphaAnalyzer = {
    analyze() {
      return alpha("known", 0.25);
    }
  };
  const knownAdapter = new SvgaFormatAdapter(inspector(), knownAnalyzer);
  const knownResult = await knownAdapter.parse(source());

  assert.deepEqual(knownResult.value?.resources[0].alphaBounds, alpha("known", 0.25));

  const failingAdapter = new SvgaFormatAdapter(inspector(), {
    analyze() {
      throw new Error("decoder unavailable");
    }
  });
  const failingResult = await failingAdapter.parse(source());

  assert.ok(failingResult.value);
  assert.deepEqual(failingResult.value.resources[0].alphaBounds, { status: "unknown" });
  assert.deepEqual(failingResult.issues, []);
});

test("alpha-bound contract and spec checker do not import image decoding or host APIs", async () => {
  const sourceText = await Promise.all([
    readFile(new URL("../../src/workbench/image-alpha-analyzer.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/workbench/svga/spec-checker.ts", import.meta.url), "utf8")
  ]).then((files) => files.join("\n"));

  assert.doesNotMatch(
    sourceText,
    /from\s+["']node:|png-reader|document\.|window\.|HTMLCanvasElement|CanvasRenderingContext/
  );
});

function check(alphaBounds: ImageAlphaBounds) {
  return new SvgaMotionSpecChecker().check(asset([image("frame", alphaBounds)]), spec);
}

function asset(resources: MotionAssetInfo["resources"]): MotionAssetInfo {
  return {
    format: "svga",
    name: "fixture.svga",
    sizeBytes: 100,
    dimensions: { width: 300, height: 300 },
    timing: {},
    layers: [],
    resources
  };
}

function image(id: string, alphaBounds: ImageAlphaBounds) {
  return {
    id,
    name: id,
    kind: "image" as const,
    dimensions: { width: 100, height: 100 },
    alphaBounds
  };
}

function alpha(status: "known", transparentPaddingRatio: number): ImageAlphaBounds {
  return {
    status,
    x: 10,
    y: 10,
    width: 80,
    height: 80,
    transparentPaddingRatio
  };
}

function inspector(): SvgaBinaryInspector {
  return {
    async inspect() {
      return {
        version: "2.0",
        params: {
          viewBoxWidth: 300,
          viewBoxHeight: 300,
          fps: 24,
          frames: 72
        },
        images: [{
          imageKey: "img_frame",
          bytes: Uint8Array.from([
            137, 80, 78, 71, 13, 10, 26, 10,
            0, 0, 0, 13, 73, 72, 68, 82,
            0, 0, 0, 100, 0, 0, 0, 100
          ])
        }],
        sprites: [],
        audioCount: 0
      };
    }
  };
}

function source() {
  return {
    id: "memory:fixture.svga",
    name: "fixture.svga",
    sizeBytes: 1,
    async read() {
      return new Uint8Array([1]);
    }
  };
}
