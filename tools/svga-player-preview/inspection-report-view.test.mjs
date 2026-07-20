import assert from "node:assert/strict";
import test from "node:test";
import { renderAvatarFrameInspectionReport } from "./inspection-report-view.mjs";

function report(overrides = {}) {
  return {
    contractVersion: 1,
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
    profileId: "production_target",
    profileLabel: "Avatar Frame Production Target",
    profilePurpose: "Gate new avatar-frame deliveries against the approved production target.",
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
	assert.doesNotMatch(html, /avatar-frame-production/);
	assert.match(html, /头像框生产目标/);
	assert.match(html, /生产目标/);
	assert.match(html, /用于检查新的头像框交付是否符合当前生产目标/);
	assert.doesNotMatch(html, /Avatar Frame Production Target/);
	assert.doesNotMatch(html, /production_target/);
	assert.doesNotMatch(html, /Gate new avatar-frame deliveries/);
	assert.match(html, /300 × 300/);
	assert.match(html, /24 fps/);
	assert.match(html, /待产品校准/);
  assert.match(html, /当前为有限样本建议值/);
  assert.match(html, /文件体积阈值/);
  assert.match(html, /资源数量阈值/);
  assert.match(html, /透明留白阈值/);
  assert.doesNotMatch(html, /maxFileSizeBytes/);
  assert.doesNotMatch(html, /maxResourceCount/);
  assert.doesNotMatch(html, /maxTransparentPaddingRatio/);
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
  assert.match(html, /画布尺寸超过 300 × 300 生产上限/);
  assert.doesNotMatch(html, /dimensions_exceed_limit/);
  assert.doesNotMatch(html, /Canvas &lt; 301 is invalid\./);
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

test("renders the read-only Motion Asset Audit presentation", () => {
  const html = renderAvatarFrameInspectionReport(report({
    auditPresentation: auditPresentation()
  }), "success");

  assert.match(html, /动效资产诊断/);
  assert.match(html, /资产需要检查/);
  assert.match(html, /解码内存存在风险/);
  assert.match(html, /资源解码内存估算存在建议检查的风险/);
  assert.match(html, /主要发现/);
  assert.match(html, /建议评估/);
  assert.match(html, /仅供检查/);
  assert.match(html, /证据 2 项/);
  assert.match(html, /当前证据不足/);
  assert.doesNotMatch(html, /<button/i);
});

test("falls back to report text or stable keys when audit labels are missing", () => {
  const presentation = auditPresentation();
  presentation.summaryTitle = "audit.summary.custom.title";
  presentation.summaryDescription = "audit.summary.custom.description";
  presentation.findingCards[0].title = "audit.finding.custom.title";
  presentation.findingCards[0].descriptionKey = "audit.finding.custom.description";
  presentation.findingCards[0].description = "Raw report finding description.";

  const html = renderAvatarFrameInspectionReport(report({ auditPresentation: presentation }), "success");

  assert.match(html, /audit\.summary\.custom\.title/);
  assert.match(html, /audit\.summary\.custom\.description/);
  assert.match(html, /audit\.finding\.custom\.title/);
  assert.match(html, /Raw report finding description\./);
});

test("keeps the existing spec report when auditPresentation is absent", () => {
  const html = renderAvatarFrameInspectionReport(report(), "success");

  assert.match(html, /生产规范/);
  assert.doesNotMatch(html, /avatar-frame-production/);
  assert.doesNotMatch(html, /auditReportSection/);
});

test("rejects unsupported report versions without rendering audit content", () => {
  const html = renderAvatarFrameInspectionReport(report({
    contractVersion: 2,
    auditPresentation: auditPresentation()
  }), "success");

	assert.match(html, /报告版本/);
	assert.match(html, /不支持/);
	assert.match(html, /contractVersion/);
	assert.doesNotMatch(html, /Report Contract/);
	assert.doesNotMatch(html, /动效资产诊断/);
});

test("omits evidence labels when presentation cards have no evidence refs", () => {
  const presentation = auditPresentation();
  delete presentation.findingCards[0].evidenceRefs;
  delete presentation.opportunityCards[0].evidenceRefs;

  const html = renderAvatarFrameInspectionReport(report({ auditPresentation: presentation }), "success");

	assert.match(html, /动效资产诊断/);
	assert.doesNotMatch(html, /Evidence ×/);
	assert.doesNotMatch(html, /Motion Asset Audit/);
});

function auditPresentation() {
  return {
    statusLabel: "audit.status.needs_review",
    severityLevel: "error",
    severityLabel: "audit.severity.error",
    summaryTitle: "audit.summary.needs_review.title",
    summaryDescription: "audit.summary.needs_review.description",
    findingCards: [{
      code: "decoded_memory_risk",
      title: "audit.finding.decoded_memory_risk.title",
      descriptionKey: "audit.finding.decoded_memory_risk.description",
      description: "Estimated decoded resource memory has advisory risk.",
      severity: "warning",
      severityLabel: "audit.severity.warning",
      category: "memory",
      categoryLabel: "audit.category.memory",
      evidenceRefs: ["memory.totalEstimatedDecodedBytes", "memory.largestResources[0]"]
    }],
    opportunityCards: [{
      code: "review_large_resources",
      title: "audit.opportunity.review_large_resources.title",
      descriptionKey: "audit.opportunity.review_large_resources.description",
      description: "Review the largest decoded resources.",
      category: "memory",
      categoryLabel: "audit.category.memory",
      evidenceRefs: ["memory.largestResources[0]"],
      actionType: "review_only",
      actionTypeLabel: "audit.action.review_only"
    }],
    uncertaintyNotes: ["audit.uncertainty.insufficient_evidence"],
    evidenceRefs: ["memory.totalEstimatedDecodedBytes"]
  };
}
