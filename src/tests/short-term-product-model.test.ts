import assert from "node:assert/strict";
import test from "node:test";
import type {
  AssetIntelligenceFinding,
  AssetIntelligenceResourceNode,
  AssetIntelligenceSummary
} from "../workbench/asset-intelligence.js";
import type { AvatarFrameInspectionReport } from "../workbench/avatar-frame-inspection-report.js";
import type { WorkbenchIssue } from "../workbench/contracts.js";
import type { RuntimeStructureDiagnostics } from "../workbench/runtime-structure-diagnostics.js";
import {
  createShortTermProductInspectionModel,
  isAutomaticImageKey,
  isReplaceableImageResource
} from "../workbench/short-term-product-model.js";

test("short-term product model exposes Overview facts and grouped assets", () => {
  const model = createShortTermProductInspectionModel(reportFixture());

  assert.equal(model.schemaVersion, 1);
  assert.deepEqual(model.prdIds, ["S3", "S4", "S5", "S6", "S7", "S8", "S9", "S13", "S15", "S17", "S18"]);
  assert.deepEqual(
    model.overview.facts.map(({ id, value, requirement, status }) => ({ id, value, requirement, status })),
    [
      { id: "fileSize", value: "640 KiB", requirement: "<= 512 KiB", status: "fail" },
      { id: "decodedMemory", value: "1.5 MiB", requirement: "低风险 <= 4 MiB", status: "pass" },
      { id: "runtimeStructure", value: "低风险 / 估算 4 KiB", requirement: "估算风险低", status: "pass" },
      { id: "runtimeObjectCount", value: "7", requirement: "数量越低越稳", status: "pass" },
      { id: "animationFrameRecordCount", value: "42", requirement: "按运行对象逐帧累计", status: "pass" },
      { id: "sequenceFanoutRisk", value: "1 组 / 峰值 4", requirement: "低风险", status: "pass" },
      { id: "runtimeVisibleDensity", value: "3 / 2.5", requirement: "按 alpha > 0 估算", status: "pass" },
      { id: "runtimeInvisibleRatio", value: "16.7%", requirement: "alpha = 0 记录占比", status: "pass" },
      { id: "canvas", value: "300 x 300", requirement: "<= 300 x 300", status: "pass" },
      { id: "fps", value: "30", requirement: "<= 24", status: "fail" },
      { id: "assetCount", value: "9", requirement: "<= 32", status: "pass" },
      { id: "duration", value: "2400 ms", requirement: "<= 3000 ms", status: "pass" }
    ]
  );
  assert.deepEqual(model.overview.assetSummary, {
    imageResourceCount: 9,
    sequenceGroupCount: 1,
    replaceableImageCount: 1,
    findingCount: 3
  });

  const sequence = model.assets.find(({ kind }) => kind === "sequence");
  assert.equal(sequence?.id, "sparkle");
  assert.equal(sequence?.thumbnail.type, "sequence-four-grid");
  assert.deepEqual(sequence?.thumbnail.resourceIds, ["sparkle_000", "sparkle_001", "sparkle_002", "sparkle_003"]);
  assert.equal(sequence?.fileSize, "2 KiB");

  const audio = model.assets.find(({ kind }) => kind === "audio");
  assert.equal(audio?.thumbnail.type, "audio-empty");
  assert.equal(model.overview.audioGroup.copy, "当前文件暂无音频资产");
});

test("short-term product model keeps replaceable elements separate from ordinary resources", () => {
  const model = createShortTermProductInspectionModel(reportFixture());

  assert.equal(isAutomaticImageKey("img_000"), true);
  assert.equal(isAutomaticImageKey("img-42"), true);
  assert.equal(isAutomaticImageKey("000"), true);
  assert.equal(isAutomaticImageKey("42"), true);
  assert.equal(isAutomaticImageKey("psd_xxxx"), true);
  assert.equal(isAutomaticImageKey("PSD-xxxx"), true);
  assert.equal(isAutomaticImageKey("psd xxxx"), true);
  assert.equal(isAutomaticImageKey("psd.xxxx"), true);
  assert.equal(isAutomaticImageKey("profile_frame_highlight"), false);
  assert.equal(isAutomaticImageKey("profile_42_frame"), false);
  assert.equal(isReplaceableImageResource(resource("sparkle_000", "sequence_frame")), false);
  assert.equal(isReplaceableImageResource(resource("mask_matte", "mask_or_matte")), false);
  assert.equal(isReplaceableImageResource(resource("profile_frame_highlight", "static_image")), true);

  assert.deepEqual(
    model.replaceableElements.images.map(({ index, imageKey, dimensions, fileSize, usageCount }) => ({
      index,
      imageKey,
      dimensions,
      fileSize,
      usageCount
    })),
    [{
      index: 1,
      imageKey: "profile_frame_highlight",
      dimensions: "256 x 256",
      fileSize: "4 KiB",
      usageCount: 1
    }]
  );
  assert.deepEqual(
    model.replaceableElements.texts.map(({ index, textKey, imageKey, displayName, initialText, supportedFields, anchorSource }) => ({
      index,
      textKey,
      imageKey,
      displayName,
      initialText,
      supportedFields,
      anchorSource
    })),
    [{
      index: 1,
      textKey: "nickname_text",
      imageKey: "nickname_text",
      displayName: "Nickname Text",
      initialText: "SVGA VIP",
      supportedFields: ["text"],
      anchorSource: "designerNamedImageKey"
    }]
  );
  assert.equal(model.replaceableElements.textPreviewCopy, "文本会叠加到对应 imageKey 的预览位置，不写入 SVGA 字节。");
  assert.deepEqual(
    model.replaceableElements.targets.map(({ imageKey, defaultPresentation, supportedPreviewActions }) => ({
      imageKey,
      defaultPresentation,
      supportedPreviewActions
    })),
    [{
      imageKey: "nickname_text",
      defaultPresentation: "text",
      supportedPreviewActions: ["image", "text"]
    }, {
      imageKey: "profile_frame_highlight",
      defaultPresentation: "image",
      supportedPreviewActions: ["image", "text"]
    }]
  );
});

test("short-term product model classifies deterministic text imageKeys into text targets", () => {
  const base = reportFixture();
  const resources = [
    ...base.assetIntelligence.resources,
    resource("text1", "static_image", { width: 96, height: 32 }),
    resource("text2", "static_image", { width: 96, height: 32 }),
    resource("from", "static_image", { width: 96, height: 32 }),
    resource("to", "static_image", { width: 96, height: 32 }),
    resource("avatar", "static_image", { width: 96, height: 96 })
  ];
  const model = createShortTermProductInspectionModel({
    ...base,
    asset: {
      ...base.asset,
      resourceCount: resources.length
    },
    assetIntelligence: {
      ...base.assetIntelligence,
      resources
    }
  });

  assert.deepEqual(
    model.replaceableElements.texts.map(({ textKey }) => textKey),
    ["from", "nickname_text", "text1", "text2", "to"]
  );
  assert.equal(model.replaceableElements.images.some(({ imageKey }) => imageKey === "text1"), false);
  assert.equal(model.replaceableElements.images.some(({ imageKey }) => imageKey === "text2"), false);
  assert.equal(model.replaceableElements.images.some(({ imageKey }) => imageKey === "from"), false);
  assert.equal(model.replaceableElements.images.some(({ imageKey }) => imageKey === "to"), false);
  assert.equal(model.replaceableElements.images.some(({ imageKey }) => imageKey === "avatar"), true);
});

test("short-term product model confirms only deterministic designer intent and keeps one dual-capability SVGA target", () => {
  const base = reportFixture();
  const resources = [
    resource("psd_xxxx", "static_image"),
    resource("PSD-text1", "static_image"),
    resource("0042", "static_image"),
    resource("img_42", "static_image"),
    resource("avatar", "static_image"),
    resource("campaign-hero", "static_image"),
    resource("text1", "static_image"),
    resource("decoration", "static_image"),
    resource("frame_base", "static_image")
  ];
  const model = createShortTermProductInspectionModel({
    ...base,
    asset: { ...base.asset, resourceCount: resources.length },
    assetIntelligence: { ...base.assetIntelligence, resources }
  });

  assert.deepEqual(
    model.replaceableElements.targets.map(({ imageKey, defaultPresentation }) => ({ imageKey, defaultPresentation })),
    [
      { imageKey: "avatar", defaultPresentation: "image" },
      { imageKey: "campaign-hero", defaultPresentation: "image" },
      { imageKey: "text1", defaultPresentation: "text" }
    ]
  );
  assert.equal(model.replaceableElements.targets.every(({ supportedPreviewActions }) => (
    supportedPreviewActions.join(",") === "image,text"
  )), true);
  assert.equal(model.replaceableElements.images.some(({ imageKey }) => imageKey === "text1"), false);
  assert.equal(model.replaceableElements.texts.some(({ imageKey }) => imageKey === "text1"), true);
  assert.equal(new Set(model.replaceableElements.targets.map(({ imageKey }) => imageKey)).size, 3);
});

test("short-term product model classifies optimization findings for UI actions", () => {
  const model = createShortTermProductInspectionModel(reportFixture());

  assert.equal(model.optimization.safeExecutableCount, 1);
  assert.equal(model.optimization.reviewOnlyCount, 1);
  assert.equal(model.optimization.unsupportedCount, 1);
  assert.equal(model.optimization.batchActionEnabled, true);
  assert.equal(model.optimization.batchActionLabel, "执行安全优化");
  assert.equal(model.optimization.estimatedSafeFileSizeSavings, "3 KiB");
  assert.deepEqual(
    model.optimization.items.map(({ code, title, disposition, enabled }) => ({
      code,
      title,
      disposition,
      enabled
    })),
    [
      {
        code: "unreferenced_image_resource",
        title: "未引用图片可清理",
        disposition: "safeExecutable",
        enabled: true
      },
      {
        code: "excessive_transparent_padding",
        title: "透明留白需复核",
        disposition: "reviewOnly",
        enabled: false
      },
      {
        code: "sequence_frame_analysis_incomplete",
        title: "序列帧证据不足",
        disposition: "unsupported",
        enabled: false
      }
    ]
  );
  assert.match(model.optimization.items[1].summary, /短期不进入安全批量/);
  assert.match(model.optimization.items[2].summary, /自动优化保持关闭/);
});

function reportFixture(): AvatarFrameInspectionReport {
  const resources = [
    resource("img_000", "static_image", { sizeBytes: 2048, usageCount: 1 }),
    resource("profile_frame_highlight", "static_image", { sizeBytes: 4096, usageCount: 1 }),
    resource("nickname_text", "static_image", { sizeBytes: 2048, usageCount: 1 }),
    resource("sparkle_000", "sequence_frame", { sizeBytes: 512, width: 32, height: 32, usageCount: 1 }),
    resource("sparkle_001", "sequence_frame", { sizeBytes: 512, width: 32, height: 32, usageCount: 1 }),
    resource("sparkle_002", "sequence_frame", { sizeBytes: 512, width: 32, height: 32, usageCount: 1 }),
    resource("sparkle_003", "sequence_frame", { sizeBytes: 512, width: 32, height: 32, usageCount: 1 }),
    resource("mask_matte", "mask_or_matte", { sizeBytes: 1024, usageCount: 1 }),
    resource("img_999", "unknown", { sizeBytes: 3072, usageCount: 0, findingCodes: ["unreferenced_image_resource"] })
  ];
  const findings = [
    finding("unreferenced_image_resource", "未引用图片资源", "safe_auto_optimize", ["img_999"], 3072),
    finding("excessive_transparent_padding", "透明留白过多", "requires_visual_confirmation", ["profile_frame_highlight"], null),
    finding("sequence_frame_analysis_incomplete", "序列帧证据不足", "unsupported", ["sparkle_000"], null)
  ];
  return {
    contractVersion: 1,
    asset: {
      format: "svga",
      name: "avatar_frame.svga",
      sizeBytes: 640 * 1024,
      dimensions: { width: 300, height: 300 },
      timing: { fps: 30, frameCount: 72, durationMs: 2400 },
      layerCount: 7,
      resourceCount: resources.length
    },
    memoryEstimation: {
      bytesPerPixel: 4,
      resources: [],
      totalEstimatedDecodedResourceBytes: 1.5 * 1024 * 1024,
      largestResourcesByDecodedBytes: [],
      sequenceFrameEstimatedDecodedBytes: 16 * 1024,
      unknownResourceIds: [],
      memoryRiskLevel: "low"
    },
    memoryDiagnostics: {
      byRole: {} as AvatarFrameInspectionReport["memoryDiagnostics"]["byRole"],
      sequenceFrameEstimatedDecodedBytes: 16 * 1024
    },
    runtimeStructureDiagnostics: runtimeStructureDiagnostics(),
    sequenceResidencyDiagnostics: {
      sequenceGroupCount: 1,
      framesPerGroup: [{ groupId: "sparkle", frameCount: 4 }],
      totalSequenceFrameEstimatedDecodedBytes: 16 * 1024,
      largestSequenceGroupsByDecodedBytes: [],
      possibleResidencyModels: ["all_frames_resident"],
      advisoryRiskLevel: "low",
      evidence: [],
      uncertainty: "low",
      ungroupedResourceIds: []
    },
    sequenceFrameEvidence: {
      analyzedResourceCount: 4,
      duplicateEvidenceStatus: "known",
      duplicateFrameGroups: [],
      fullyTransparentFrames: [],
      emptyOrNearEmptyFrames: [],
      nearEmptyTransparentPaddingRatio: 0.96,
      repeatedAlphaBoundsGroups: [],
      repeatedDimensionsGroups: [],
      missingContentHashResourceIds: [],
      missingAlphaBoundsResourceIds: [],
      evidenceConfidence: "high",
      uncertainty: "low"
    },
    assetIntelligence: {
      schemaVersion: 1,
      assetName: "avatar_frame.svga",
      resources,
      findings,
      summary: summary(findings),
      supportedSortKeys: ["name", "compressedSizeBytes", "estimatedDecodedMemoryBytes", "dimensionsArea", "usageCount", "abnormalityLevel"]
    },
    auditSummary: {} as AvatarFrameInspectionReport["auditSummary"],
    auditPresentation: {} as AvatarFrameInspectionReport["auditPresentation"],
    specId: "avatar-frame-production",
    profileId: "production_target",
    profileLabel: "Avatar Frame Production Target",
    profilePurpose: "Gate new avatar-frame deliveries against the approved production target.",
    passed: false,
    issues: [{
      severity: "error",
      code: "file_size_exceeds_limit",
      message: "File size exceeds the active specification."
    }, {
      severity: "error",
      code: "fps_exceeds_limit",
      message: "FPS exceeds the active specification."
    }],
    calibrationNotes: []
  };
}

function runtimeStructureDiagnostics(): RuntimeStructureDiagnostics {
  return {
    schemaVersion: 1,
    spriteCount: 7,
    frameEntityCount: 42,
    alphaPositiveFrameCount: 35,
    zeroAlphaFrameCount: 7,
    lowAlphaFrameCount: 0,
    targetPlayerVisibleFrameCount: null,
    invisibleFrameRatio: 7 / 42,
    lowAlphaFrameRatio: 0,
    perFrameVisibleSpritePeak: 3,
    perFrameVisibleSpriteAverage: 2.5,
    estimatedRuntimeStructureBytes: 4096,
    estimatedRuntimeStructureMiB: 4096 / (1024 * 1024),
    riskLevel: "low",
    allZeroSpriteCount: 0,
    allZeroFrameEntityCount: 0,
    allZeroSpriteResourceIds: [],
    sequenceFrameFanout: {
      groupCount: 1,
      totalSpriteReferences: 4,
      maxSpriteReferencesInGroup: 4,
      groups: [{
        groupId: "sparkle",
        resourceIds: ["sparkle_000", "sparkle_001", "sparkle_002", "sparkle_003"],
        spriteReferenceCount: 4,
        estimatedInstanceCount: 1
      }]
    },
    evidence: [
      "spriteCount=7",
      "frameEntityCount=42"
    ],
    limitations: [
      "target_player_low_alpha_visibility_profile_not_configured"
    ]
  };
}

function resource(
  name: string,
  role: AssetIntelligenceResourceNode["role"],
  options: {
    sizeBytes?: number;
    width?: number;
    height?: number;
    usageCount?: number;
    findingCodes?: readonly string[];
  } = {}
): AssetIntelligenceResourceNode {
  return {
    resourceId: name,
    name,
    kind: "image",
    role,
    concepts: ["图片资源"],
    usageCount: options.usageCount ?? 1,
    usedByLayerIds: options.usageCount === 0 ? [] : [`layer:${name}`],
    compressedSizeBytes: options.sizeBytes ?? 4096,
    estimatedDecodedMemoryBytes: (options.width ?? 256) * (options.height ?? 256) * 4,
    dimensions: { width: options.width ?? 256, height: options.height ?? 256 },
    contentHashKey: null,
    replaceable: false,
    abnormalityLevel: options.findingCodes?.length ? "medium" : "none",
    findingCodes: options.findingCodes ?? []
  };
}

function finding(
  code: string,
  title: string,
  disposition: AssetIntelligenceFinding["optimizationDisposition"],
  affectedResourceIds: readonly string[],
  fileSizeImpact: number | null
): AssetIntelligenceFinding {
  return {
    code,
    title,
    reason: title,
    severity: disposition === "unsupported" ? "info" : "warning",
    confidence: "high",
    evidenceRefs: affectedResourceIds.map((id) => `resource:${id}`),
    affectedResourceIds,
    estimatedFileSizeImpactBytes: fileSizeImpact,
    estimatedDecodedMemoryImpactBytes: null,
    optimizationDisposition: disposition,
    safeToAutoOptimize: disposition === "safe_auto_optimize",
    roundTripRequired: disposition === "safe_auto_optimize"
  };
}

function summary(findings: readonly AssetIntelligenceFinding[]): AssetIntelligenceSummary {
  return {
    resourceCount: 9,
    findingCount: findings.length,
    severityCounts: {
      info: findings.filter(({ severity }) => severity === "info").length,
      warning: findings.filter(({ severity }) => severity === "warning").length,
      error: findings.filter(({ severity }) => severity === "error").length
    },
    safeAutoOptimizeFindingCount: findings.filter(({ safeToAutoOptimize }) => safeToAutoOptimize).length,
    estimatedSafeFileSizeSavingsBytes: 3072,
    estimatedSafeDecodedMemorySavingsBytes: null,
    unsupportedFindingCount: findings.filter(({ optimizationDisposition }) => optimizationDisposition === "unsupported").length
  };
}
