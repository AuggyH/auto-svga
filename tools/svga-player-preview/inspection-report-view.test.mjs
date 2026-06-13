import assert from "node:assert/strict";
import test from "node:test";
import { renderAvatarFrameInspectionReport } from "./inspection-report-view.mjs";

function report(overrides = {}) {
  return {
    asset: {
      format: "svga",
      name: "avatar-frame.svga",
      sizeBytes: 10240,
      dimensions: { width: 300, height: 300 },
      timing: { fps: 24, frameCount: 72, durationMs: 3000 },
      layerCount: 4,
      resourceCount: 6
    },
    specId: "avatar-frame-production",
    passed: true,
    issues: [],
    calibrationNotes: [
      {
        field: "maxFileSizeBytes",
        message: "Provisional 512 KiB recommendation based on a limited sample; needs product calibration."
      },
      {
        field: "maxResourceCount",
        message: "Provisional 32-resource recommendation based on a limited sample; needs product calibration."
      },
      {
        field: "maxTransparentPaddingRatio",
        message: "Provisional transparent-padding recommendation; needs product calibration."
      }
    ],
    ...overrides
  };
}

test("renders passing report, asset summary, and calibration notes", () => {
  const html = renderAvatarFrameInspectionReport(report(), "success");

  assert.match(html, /通过/);
  assert.match(html, /avatar-frame-production/);
  assert.match(html, /300 × 300/);
  assert.match(html, /24 fps/);
  assert.match(html, /待产品校准/);
  assert.match(html, /当前为有限样本建议值/);
  assert.match(html, /maxFileSizeBytes/);
  assert.match(html, /maxResourceCount/);
  assert.match(html, /maxTransparentPaddingRatio/);
});

test("renders failed issues with severity, code, and escaped message", () => {
  const html = renderAvatarFrameInspectionReport(report({
    passed: false,
    issues: [{
      severity: "error",
      code: "dimensions_exceed_limit",
      message: "Canvas < 301 is invalid."
    }]
  }), "success");

  assert.match(html, /未通过/);
  assert.match(html, /错误/);
  assert.match(html, /dimensions_exceed_limit/);
  assert.match(html, /画布尺寸超过 300 × 300 生产上限/);
  assert.match(html, /Canvas &lt; 301 is invalid\./);
  assert.doesNotMatch(html, /Canvas < 301/);
});

test("renders a non-blocking error state", () => {
  const html = renderAvatarFrameInspectionReport(undefined, "error");

  assert.match(html, /暂不可用/);
  assert.match(html, /不影响当前播放/);
});

test("renders embedded resource dimension issues from the report", () => {
  const html = renderAvatarFrameInspectionReport(report({
    passed: false,
    issues: [{
      severity: "error",
      code: "resource_dimensions_exceed_limit",
      message: "Embedded image dimensions exceed the specification limit."
    }, {
      severity: "warning",
      code: "resource_dimensions_unavailable",
      message: "Embedded image dimensions are unavailable."
    }]
  }), "success");

  assert.match(html, /内嵌图片资源尺寸超过 300 × 300 上限/);
  assert.match(html, /无法识别内嵌图片资源尺寸/);
});

test("renders embedded resource alpha-bound issues from the report", () => {
  const html = renderAvatarFrameInspectionReport(report({
    passed: false,
    issues: [{
      severity: "error",
      code: "resource_transparent_padding_exceeds_limit",
      message: "Embedded image transparent padding exceeds the specification limit."
    }, {
      severity: "error",
      code: "resource_fully_transparent",
      message: "Embedded image resource is fully transparent."
    }, {
      severity: "warning",
      code: "resource_alpha_bounds_unavailable",
      message: "Alpha-bound metadata is unavailable."
    }]
  }), "success");

  assert.match(html, /内嵌图片资源存在过多透明空白/);
  assert.match(html, /内嵌图片资源完全透明/);
  assert.match(html, /部分内嵌图片暂时无法分析透明边界/);
});
