import { access, stat } from "node:fs/promises";
import path from "node:path";
import type { AvatarFrameProject } from "../types/project.js";
import type { BuildReport, ValidationIssue } from "../types/report.js";

interface ReportInput {
  inputDir: string;
  outputDir: string;
  sourceCanvas?: {
    width: number;
    height: number;
  };
  issues: ValidationIssue[];
  project?: AvatarFrameProject;
  generatedFiles?: Array<{
    id: string;
    path: string;
    sizeBytes: number;
  }>;
  projectJsonPath?: string;
  previewPath?: string;
  svgaMapPath?: string;
  svgaExport?: BuildReport["svgaExport"];
  bakedSweepFrameCount?: number;
  bakedSweepFrameStride?: number;
  bakedSweepRawFrameCount?: number;
  bakedSweepSampledFrameCount?: number;
  bakedSweepTransparentFrameCount?: number;
  bakedSweepUniqueAssetCount?: number;
  bakedSweepDedupedCount?: number;
  bakedSweepAssetSizeBytes?: number;
  bakedSweepAssetSizeBeforeDedup?: number;
  bakedSweepAssetSizeAfterDedup?: number;
}

export async function buildReport(input: ReportInput): Promise<BuildReport> {
  const warnings = input.issues.filter((issue) => issue.level === "warning");
  const errors = input.issues.filter((issue) => issue.level === "error");
  const missingAssets = input.project ? await findMissingAssets(input.project, input.outputDir) : [];
  const invalidLayerReferences = input.project ? findInvalidLayerReferences(input.project) : [];
  const invalidAnimationTargetReferences = input.project ? findInvalidAnimationTargets(input.project) : [];
  const hasBakedMaskAssets = input.project ? findMissingBakedMaskAssets(input.project).length === 0 : false;
  const hasBlendModeFallbacks = input.project ? hasFallbackForAllBlendModes(input.project) : false;
  const replaceableSprites: string[] = [];
  const exporterCompatibility = input.project
    ? buildExporterCompatibility(input.project, invalidLayerReferences, invalidAnimationTargetReferences)
    : emptyCompatibility();
  const maskWarnings = input.project && exporterCompatibility.usesMask && !hasBakedMaskAssets
    ? [{ level: "warning" as const, code: "MISSING_BAKED_MASK_ASSET", message: "A masked layer exists without a baked mask asset. Preview and exporter output may diverge." }]
    : [];
  const generatedAssets = input.generatedFiles?.map((file) => ({
    id: file.id,
    path: path.relative(input.outputDir, file.path).split(path.sep).join("/"),
    sizeBytes: file.sizeBytes
  })) ?? [];
  const generatedFileSize = generatedAssets.reduce((sum, asset) => sum + asset.sizeBytes, 0);
  const derivedErrors = [
    ...missingAssets.map((assetId) => ({ level: "error" as const, code: "MISSING_GENERATED_ASSET", message: `Missing generated asset: ${assetId}` })),
    ...invalidLayerReferences.map((layerId) => ({ level: "error" as const, code: "INVALID_LAYER_ASSET_REF", message: `Layer references a missing asset: ${layerId}` })),
    ...invalidAnimationTargetReferences.map((animationId) => ({ level: "error" as const, code: "INVALID_ANIMATION_TARGET", message: `Animation targets a missing layer: ${animationId}` }))
  ];
  const allErrors = [...errors, ...derivedErrors];
  const allWarnings = [...warnings, ...maskWarnings];
  const bakedSweepFrameCount = input.bakedSweepFrameCount ?? 0;
  const bakedSweepFrameStride = input.bakedSweepFrameStride ?? 1;
  const bakedSweepRawFrameCount = input.bakedSweepRawFrameCount ?? bakedSweepFrameCount;
  const bakedSweepSampledFrameCount = input.bakedSweepSampledFrameCount ?? bakedSweepFrameCount;
  const bakedSweepTransparentFrameCount = input.bakedSweepTransparentFrameCount ?? 0;
  const bakedSweepUniqueAssetCount = input.bakedSweepUniqueAssetCount ?? bakedSweepFrameCount;
  const bakedSweepDedupedCount = input.bakedSweepDedupedCount ?? Math.max(0, bakedSweepRawFrameCount - bakedSweepTransparentFrameCount - bakedSweepUniqueAssetCount);
  const bakedSweepAssetSizeBytes = input.bakedSweepAssetSizeBytes ?? input.bakedSweepAssetSizeAfterDedup ?? 0;
  const bakedSweepAssetSizeBeforeDedup = input.bakedSweepAssetSizeBeforeDedup ?? bakedSweepAssetSizeBytes;
  const bakedSweepAssetSizeAfterDedup = input.bakedSweepAssetSizeAfterDedup ?? bakedSweepAssetSizeBytes;
  const bakedSweepWarnings = bakedSweepFrameCount > 100
    ? [{ level: "warning" as const, code: "MANY_BAKED_SWEEP_FRAMES", message: `Generated ${bakedSweepFrameCount} baked sweep frame assets. Visual correctness is prioritized over file size in this MVP.` }]
    : [];

  return {
    status: allErrors.length === 0 ? "success" : "failed",
    generatedAt: new Date().toISOString(),
    inputDir: input.inputDir,
    outputDir: input.outputDir,
    assetType: input.project?.assetType,
    canvas: {
      expected: input.project?.canvas,
      actual: input.sourceCanvas
    },
    fps: input.project?.fps,
    durationFrames: input.project?.durationFrames,
    durationSeconds: input.project ? input.project.durationFrames / input.project.fps : undefined,
    coordinateConvention: {
      transformXY: "layer.transform.x/y is the layer anchor position in canvas coordinates.",
      anchorXY: "layer.anchor.x/y is the anchor position in the layer local coordinate system.",
      rotationAndScale: "rotation and scale are applied around anchor; preview and exporters must use this same convention."
    },
    preview: {
      frameCount: input.project?.durationFrames,
      durationFrames: input.project?.durationFrames,
      durationSeconds: input.project ? input.project.durationFrames / input.project.fps : undefined,
      path: input.previewPath ? path.relative(input.outputDir, input.previewPath).split(path.sep).join("/") : undefined
    },
    layerCount: input.project?.layers.length ?? 0,
    animationCount: input.project?.animations.length ?? 0,
    generatedAssets,
    totalGeneratedAssetSize: generatedFileSize,
    missingAssets,
    invalidLayerReferences,
    invalidAnimationTargetReferences,
    exporterCompatibility,
    hasBakedMaskAssets,
    hasBlendModeFallbacks,
    replaceableSprites,
    exporterReady: input.project ? isExporterReady({
      compatibility: exporterCompatibility,
      hasBakedMaskAssets,
      hasBlendModeFallbacks,
      replaceableSprites
    }) : false,
    sweepMaskStrategy: bakedSweepFrameCount > 0 ? "baked_per_frame_fixed_alpha_mask" : undefined,
    bakedSweepFrameCount,
    bakedSweepFrameStride,
    bakedSweepRawFrameCount,
    bakedSweepSampledFrameCount,
    bakedSweepTransparentFrameCount,
    bakedSweepUniqueAssetCount,
    bakedSweepDedupedCount,
    bakedSweepEstimatedQualityMode: qualityModeForStride(bakedSweepFrameStride),
    bakedSweepAssetSizeBytes,
    bakedSweepAssetSizeBeforeDedup,
    bakedSweepAssetSizeAfterDedup,
    runtimeMaskUsed: exporterCompatibility.usesMask,
    sweepExportMode: bakedSweepFrameCount > 0 ? "baked_frame_sprites" : undefined,
    svgaFileSizeBytes: input.svgaExport?.fileSizeBytes,
    frameLevelImageKeySupported: false,
    frameLevelImageKeyReason: "SVGA FrameEntity has no imageKey field; imageKey belongs to SpriteEntity.",
    svgaExport: input.svgaExport ?? {
      attempted: false,
      success: false,
      strategy: "not_attempted"
    },
    playbackTest: {
      attempted: false,
      manualRequired: true,
      automated: false,
      expectedPath: "examples/avatar_frame_basic/output/avatar_frame_basic.svga",
      instructions: [
        "Run pnpm preview:player from the repository root.",
        "Open http://localhost:4173/tools/svga-player-preview/.",
        "Confirm the right-side SVGA Player loads and loops the real .svga file.",
        "Compare motion timing, layer order, opacity, sweep movement, and gem twinkles against preview.gif."
      ],
      knownLimitations: [
        "This report records that playback validation is required; it does not claim visual playback success.",
        "The Web preview uses svgaplayerweb from jsDelivr, so first page load needs network access to the public player script.",
        "Automated browser pixel comparison is not implemented in this MVP round.",
        "Human visual confirmation is required before treating playback as visually accepted."
      ]
    },
    warnings: [...allWarnings, ...bakedSweepWarnings],
    errors: allErrors,
    outputs: {
      projectJson: input.projectJsonPath ? path.relative(input.outputDir, input.projectJsonPath).split(path.sep).join("/") : undefined,
      preview: input.previewPath ? path.relative(input.outputDir, input.previewPath).split(path.sep).join("/") : undefined,
      assets: generatedAssets.map((asset) => asset.path),
      reportJson: "report.json",
      svgaMap: input.svgaMapPath ? path.relative(input.outputDir, input.svgaMapPath).split(path.sep).join("/") : undefined
    }
  };
}

async function findMissingAssets(project: AvatarFrameProject, outputDir: string): Promise<string[]> {
  const missing: string[] = [];
  for (const asset of project.assets) {
    const assetPath = path.join(outputDir, asset.path);
    const exists = await access(assetPath).then(() => true, () => false);
    if (!exists) {
      missing.push(asset.id);
      continue;
    }
    const assetStat = await stat(assetPath);
    if (assetStat.size <= 0) {
      missing.push(asset.id);
    }
  }
  return missing;
}

function findInvalidLayerReferences(project: AvatarFrameProject): string[] {
  const assetIds = new Set(project.assets.map((asset) => asset.id));
  return project.layers.filter((layer) => !assetIds.has(layer.assetId)).map((layer) => layer.id);
}

function findInvalidAnimationTargets(project: AvatarFrameProject): string[] {
  const layerIds = new Set(project.layers.map((layer) => layer.id));
  return project.animations.filter((animation) => !layerIds.has(animation.targetLayerId)).map((animation) => animation.id);
}

function buildExporterCompatibility(
  project: AvatarFrameProject,
  invalidLayerReferences: string[],
  invalidAnimationTargetReferences: string[]
): BuildReport["exporterCompatibility"] {
  const unsupportedLayerTypes = project.layers.filter((layer) => layer.type !== "image").map((layer) => `${layer.id}:${layer.type}`);
  const layerIds = new Set(project.layers.map((layer) => layer.id));
  const blendModesRequiringSupport = [...new Set(project.layers
    .filter((layer) => layer.blendMode !== "normal")
    .map((layer) => layer.blendMode))];
  const unsupportedBlendModeFallbacks = project.layers
    .filter((layer) => layer.blendMode !== "normal")
    .filter((layer) => layer.fallbackBlendMode !== "normal" || layer.fallbackOpacityMultiplier <= 0)
    .map((layer) => layer.id);
  const maskLayerIds = project.layers.filter((layer) => layer.mask).map((layer) => layer.id);
  const outOfRangeKeyframes = project.animations.flatMap((animation) =>
    animation.keyframes
      .filter((keyframe) => keyframe.frame < 0 || keyframe.frame >= project.durationFrames)
      .map((keyframe) => ({ animationId: animation.id, frame: keyframe.frame }))
  );

  return {
    unsupportedLayerTypes,
    templateOnlyAnimations: project.animations
      .filter((animation) => !layerIds.has(animation.targetLayerId))
      .map((animation) => animation.id),
    blendModesRequiringSupport,
    unsupportedBlendModeFallbacks,
    hasFallbackForAllBlendModes: unsupportedBlendModeFallbacks.length === 0,
    usesMask: maskLayerIds.length > 0,
    maskLayerIds,
    allAnimationTargetsExist: invalidAnimationTargetReferences.length === 0,
    allLayerAssetsExist: invalidLayerReferences.length === 0,
    keyframesInRange: outOfRangeKeyframes.length === 0,
    outOfRangeKeyframes
  };
}

function emptyCompatibility(): BuildReport["exporterCompatibility"] {
  return {
    unsupportedLayerTypes: [],
    templateOnlyAnimations: [],
    blendModesRequiringSupport: [],
    unsupportedBlendModeFallbacks: [],
    hasFallbackForAllBlendModes: true,
    usesMask: false,
    maskLayerIds: [],
    allAnimationTargetsExist: true,
    allLayerAssetsExist: true,
    keyframesInRange: true,
    outOfRangeKeyframes: []
  };
}

function findMissingBakedMaskAssets(project: AvatarFrameProject): string[] {
  const assetIds = new Set(project.assets.map((asset) => asset.id));
  return project.layers
    .filter((layer) => layer.mask)
    .filter((layer) => !assetIds.has(`${layer.assetId}_masked`))
    .map((layer) => layer.id);
}

function hasFallbackForAllBlendModes(project: AvatarFrameProject): boolean {
  return project.layers
    .filter((layer) => layer.blendMode !== "normal")
    .every((layer) => layer.fallbackBlendMode === "normal" && layer.fallbackOpacityMultiplier > 0);
}

function isExporterReady(input: {
  compatibility: BuildReport["exporterCompatibility"];
  hasBakedMaskAssets: boolean;
  hasBlendModeFallbacks: boolean;
  replaceableSprites: string[];
}): boolean {
  return input.compatibility.unsupportedLayerTypes.length === 0
    && input.compatibility.templateOnlyAnimations.length === 0
    && input.compatibility.allAnimationTargetsExist
    && input.compatibility.allLayerAssetsExist
    && input.compatibility.keyframesInRange
    && input.hasBlendModeFallbacks
    && input.replaceableSprites.length === 0
    && (!input.compatibility.usesMask || input.hasBakedMaskAssets);
}

function qualityModeForStride(frameStride: number): "full" | "balanced" | "compact" {
  if (frameStride <= 1) {
    return "full";
  }
  if (frameStride === 2) {
    return "balanced";
  }
  return "compact";
}
