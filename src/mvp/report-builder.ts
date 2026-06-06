import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type {
  MotionEffect,
  MotionPlan,
  MvpConfig,
  MvpInputMode,
  MvpProject,
  MvpProjectLayer,
  MvpStructure
} from "./types.js";
import type { MvpPreviewReport } from "./preview-renderer.js";
import { isSupportedEasing, SUPPORTED_MVP_EASINGS } from "./easing.js";
import { decodeRgbaPng } from "../utils/png-reader.js";

export interface MvpReport {
  status: "success" | "warning";
  technicalStatus: "success" | "warning";
  visualStatus: "needs_review" | "accepted" | "rejected";
  assetType: MvpConfig["assetType"];
  jobName: string;
  inputMode: MvpInputMode;
  summary: {
    partCount: number;
    effectCount: number;
    projectLayerCount: number;
    generatedAssetCount: number;
  };
  output: {
    motionPlan: string;
    project: string;
    previewGif: string;
    previewFrames: string;
    previewWebm: string;
    previewMp4: string;
    previewReport: string;
    reviewContactSheet: string;
    report: string;
    svgaMap: string;
    svga?: string;
    deliveryZip?: string;
    acceptance?: string;
  };
  preview: {
    generated: boolean;
    path: string;
    sizeBytes: number;
    fps: number;
    frames: number;
    durationMs: number;
  };
  review: {
    primary: "svga";
    primaryPath: string;
    secondary: string[];
    gifPreviewDeprecated: true;
  };
  previewOutputs: {
    frames: string;
    webm: string;
    mp4: string;
    gif: string;
  };
  visualWarnings: {
    duplicateOverlayRisk: boolean;
    unmaskedSweepWarning: boolean;
    gifPreviewDeprecated: true;
    primaryReviewTarget: "svga";
    bakedSweepSizeWarning: boolean;
  };
  maskSystem: {
    sweepMaskEnabled: boolean;
    maskSource?: string;
    safeAreaExcluded: boolean;
    mode: "baked_sweep_frames" | "none";
    bakedFrameCount: number;
    usedBakedFrameCount: number;
    skippedTransparentFrameCount: number;
    skippedLowContributionFrameCount: number;
    dedupedFrameCount: number;
    sweepFrameStride: number;
    effectResolutionScale: number;
    trimBakedFrames: boolean;
  };
  assetOptimization: {
    trimTransparentPixels: true;
    allSvgaImagesTrimmed: boolean;
    sourceCanvas: string;
    productionCanvas: string;
  };
  memoryEstimate: {
    decodedImageBytes: number;
    decodedImageMB: number;
    budgetMB: number;
    recommendedBudgetMB: number;
    withinBudget: boolean;
    largestImages: Array<{ source: string; width: number; height: number; decodedBytes: number }>;
  };
  performanceWarnings: {
    decodedImageOverRecommendedBudget: boolean;
    decodedImageOverHardBudget: boolean;
  };
  optimizationActions: string[];
  animationSystem: {
    easingEnabled: true;
    supportedEasings: string[];
  };
  wingFlap: {
    mode: string;
    configuredAmplitudeDeg: number;
    resolvedAmplitudeDeg: number;
    peakToPeakDeg: number;
    easing: string;
    phaseEnabled: boolean;
    parts: Array<{
      partId: string;
      anchorRole: string;
      anchorLocalX?: number;
      anchorLocalY?: number;
      amplitudeDeg?: number;
      phase: number;
      easing: string;
      mode: string;
    }>;
  };
  validation: {
    canvasSize: string;
    transparentBackground: boolean;
    safeAreaProtected: boolean;
    loopSeamless: boolean;
    anchorTransformEnabled: boolean;
    svgaExported: boolean;
  };
  svga?: {
    path: string;
    sizeBytes: number;
    imageCount: number;
    spriteCount: number;
    frameCount: number;
  };
  delivery?: {
    sizeBytes: number;
    includedFiles: string[];
  };
  acceptance?: {
    status: "pending" | "accepted" | "rejected";
    notes: string;
    updatedAt: string;
  };
  appliedEffects: Array<{
    effectId: string;
    template: string;
    target: string;
    status: "applied" | "skipped";
  }>;
  warnings: string[];
}

export interface MvpSvgaMap {
  jobName: string;
  assetType: MvpConfig["assetType"];
  layers: Array<{
    projectLayerId: string;
    sourcePart?: string;
    sourceImage: string;
    role: MvpProjectLayer["role"];
    zIndex: number;
    sourceEffect?: string;
    futureSvgaSpriteId: string;
    futureSvgaImageKey: string;
    svgaSpriteId?: string;
    svgaImageKey?: string;
    frameIndex?: number;
    visibleFrameRange?: [number, number];
    maskSource?: string;
    maskMode?: string;
    trimmedBbox?: [number, number, number, number];
    decodedBytes?: number;
    imageHash?: string;
    reusedFrom?: string;
  }>;
  effects: Array<{
    effectId: string;
    template: string;
    targetPart: string;
    generatedLayers: string[];
    generatedAssets: string[];
  }>;
  assets: Array<{
    source: string;
    usedByLayers: string[];
    generated?: true;
    svgaImageKey?: string;
    trimmedBbox?: [number, number, number, number];
    decodedBytes?: number;
    imageHash?: string;
    reusedFrom?: string;
  }>;
}

export interface MvpReportBuildInput {
  jobDir: string;
  jobName: string;
  config: MvpConfig;
  structure: MvpStructure;
  motionPlan: MotionPlan;
  project: MvpProject;
  previewReport?: MvpPreviewReport;
  previewReportMissing?: boolean;
}

const OUTPUT_PATHS = {
  motionPlan: "project/motion-plan.json",
  project: "project/project.json",
  previewGif: "output/preview.gif",
  previewFrames: "output/preview_frames",
  previewWebm: "output/preview.webm",
  previewMp4: "output/preview.mp4",
  previewReport: "output/preview-report.json",
  reviewContactSheet: "output/review_frames_contact_sheet.png",
  report: "output/report.json",
  svgaMap: "output/svga-map.json"
} as const;

export async function buildMvpReport(input: MvpReportBuildInput): Promise<MvpReport> {
  const warnings = await collectCurrentProjectWarnings(input.jobDir, input.project);
  if (input.previewReportMissing) {
    warnings.push("output/preview-report.json is missing; preview summary was generated from project defaults.");
  }
  if (input.previewReport) {
    warnings.push(...input.previewReport.warnings);
  }

  const appliedEffects = input.motionPlan.effects.map((effect) => {
    const generatedLayers = findEffectLayers(input.project, effect);
    if (generatedLayers.length === 0) {
      warnings.push(`Effect ${effect.id} did not generate any project layer.`);
    }
    return {
      effectId: effect.id,
      template: effect.template,
      target: effect.target,
      status: generatedLayers.length > 0 ? "applied" as const : "skipped" as const
    };
  });

  const previewSizeBytes = input.previewReport?.sizeBytes ?? await optionalFileSize(path.join(input.jobDir, OUTPUT_PATHS.previewGif));
  const duplicateOverlayRisk = hasDuplicateOverlayRisk(input.structure);
  const sweepLayers = input.project.layers.filter((layer) => layer.sourceEffect?.endsWith("_sweep"));
  const unmaskedSweepWarning = input.motionPlan.effects.some((effect) => effect.template === "metal_sweep")
    && sweepLayers.some((layer) => layer.maskMode !== "baked_sweep_frames");
  if (unmaskedSweepWarning) {
    warnings.push("Metal sweep is not using a masked generated asset.");
  }
  const primarySvgaPath = `output/${input.config.outputName}.svga`;
  for (const easing of collectUnknownEasings(input.project)) {
    warnings.push(`Unknown easing "${easing}" falls back to linear.`);
  }
  const maskSource = sweepLayers.find((layer) => layer.maskSource)?.maskSource;
  const sweepManifest = await readSweepManifest(input.jobDir);
  const memory = await estimateDecodedMemory(input.jobDir, input.project);
  const budgetMB = input.config.maxDecodedImageMB ?? 8;
  const recommendedBudgetMB = 6.5;
  const decodedImageOverRecommendedBudget = memory.decodedImageMB > recommendedBudgetMB;
  const decodedImageOverHardBudget = memory.decodedImageMB > budgetMB;
  if (decodedImageOverRecommendedBudget) {
    warnings.push(`Decoded SVGA image memory ${memory.decodedImageMB.toFixed(2)}MB exceeds the recommended ${recommendedBudgetMB}MB budget.`);
  }
  if (decodedImageOverHardBudget) {
    warnings.push(`Decoded SVGA image memory ${memory.decodedImageMB.toFixed(2)}MB exceeds the hard ${budgetMB}MB budget.`);
  }
  const wingParts = input.structure.parts
    .filter((part) => part.type === "wing" && part.motionAllowed?.includes("wing_flap"))
    .map((part) => {
      const layer = input.project.layers.find((candidate) => candidate.id === `${part.id}_layer`);
      return {
        partId: part.id,
        anchorRole: part.anchor.role,
        anchorLocalX: layer?.anchor?.localX,
        anchorLocalY: layer?.anchor?.localY,
        amplitudeDeg: part.motionProfile?.amplitudeDeg,
        phase: part.motionProfile?.phase ?? 0,
        easing: part.motionProfile?.easing ?? "easeInOutSine",
        mode: part.motionProfile?.mode ?? "flap"
      };
    });
  const configuredAmplitudeDeg = Math.max(0, ...wingParts.map((part) => part.amplitudeDeg ?? 0));
  const technicalStatus = warnings.length > 0 ? "warning" as const : "success" as const;
  const sourceCanvasLabel = `${input.config.sourceCanvas?.width ?? input.structure.sourceCanvas?.width ?? input.structure.canvas.width}x${input.config.sourceCanvas?.height ?? input.structure.sourceCanvas?.height ?? input.structure.canvas.height}`;
  const productionCanvasLabel = `${input.project.canvas.width}x${input.project.canvas.height}`;
  const optimizationActions = [
    ...(sourceCanvasLabel !== productionCanvasLabel ? [`sourceCanvas scaled from ${sourceCanvasLabel} to ${productionCanvasLabel}`] : []),
    "transparent pixels trimmed from SVGA image sources",
    `sweepFrameStride set to ${sweepManifest?.sweepFrameStride ?? input.project.sweepFrameStride ?? input.config.sweepFrameStride ?? 3}`,
    ...(input.project.optimizationActions ?? [])
  ];

  return {
    status: technicalStatus,
    technicalStatus,
    visualStatus: "needs_review",
    assetType: input.config.assetType,
    jobName: input.jobName,
    inputMode: input.structure.inputMode,
    summary: {
      partCount: input.structure.parts.length,
      effectCount: input.motionPlan.effects.length,
      projectLayerCount: input.project.layers.length,
      generatedAssetCount: await countGeneratedAssets(input.jobDir)
    },
    output: { ...OUTPUT_PATHS },
    preview: {
      generated: Boolean(input.previewReport) || previewSizeBytes > 0,
      path: OUTPUT_PATHS.previewGif,
      sizeBytes: previewSizeBytes,
      fps: input.previewReport?.fps ?? input.project.fps,
      frames: input.previewReport?.frames ?? input.project.frames,
      durationMs: input.previewReport?.durationMs ?? input.project.durationMs
    },
    review: {
      primary: "svga",
      primaryPath: input.previewReport?.primaryReviewTarget ?? primarySvgaPath,
      secondary: ["preview.webm", "preview.mp4", "preview_frames"],
      gifPreviewDeprecated: true
    },
    previewOutputs: {
      frames: OUTPUT_PATHS.previewFrames,
      webm: OUTPUT_PATHS.previewWebm,
      mp4: OUTPUT_PATHS.previewMp4,
      gif: OUTPUT_PATHS.previewGif
    },
    visualWarnings: {
      duplicateOverlayRisk,
      unmaskedSweepWarning,
      gifPreviewDeprecated: true,
      primaryReviewTarget: "svga",
      bakedSweepSizeWarning: (sweepManifest?.usedBakedFrameCount ?? sweepLayers.length) > 24
    },
    maskSystem: {
      sweepMaskEnabled: sweepLayers.length > 0 && !unmaskedSweepWarning,
      maskSource,
      safeAreaExcluded: sweepLayers.length > 0,
      mode: sweepLayers.length > 0 && !unmaskedSweepWarning ? "baked_sweep_frames" : "none",
      bakedFrameCount: sweepManifest?.bakedFrameCount ?? sweepLayers.length,
      usedBakedFrameCount: sweepManifest?.usedBakedFrameCount ?? sweepLayers.length,
      skippedTransparentFrameCount: sweepManifest?.skippedTransparentFrameCount ?? 0,
      skippedLowContributionFrameCount: sweepManifest?.skippedLowContributionFrameCount ?? 0,
      dedupedFrameCount: sweepManifest?.dedupedFrameCount ?? 0,
      sweepFrameStride: sweepManifest?.sweepFrameStride ?? input.config.sweepFrameStride ?? 3,
      effectResolutionScale: input.config.effectResolutionScale ?? 1,
      trimBakedFrames: true
    },
    assetOptimization: {
      trimTransparentPixels: true,
      allSvgaImagesTrimmed: memory.allTrimmed,
      sourceCanvas: sourceCanvasLabel,
      productionCanvas: productionCanvasLabel
    },
    memoryEstimate: {
      decodedImageBytes: memory.decodedImageBytes,
      decodedImageMB: memory.decodedImageMB,
      budgetMB,
      recommendedBudgetMB,
      withinBudget: !decodedImageOverHardBudget,
      largestImages: memory.largestImages
    },
    performanceWarnings: {
      decodedImageOverRecommendedBudget,
      decodedImageOverHardBudget
    },
    optimizationActions,
    animationSystem: {
      easingEnabled: true,
      supportedEasings: [...SUPPORTED_MVP_EASINGS]
    },
    wingFlap: {
      mode: wingParts[0]?.mode ?? "flap",
      configuredAmplitudeDeg,
      resolvedAmplitudeDeg: configuredAmplitudeDeg,
      peakToPeakDeg: configuredAmplitudeDeg * 2,
      easing: wingParts[0]?.easing ?? "easeInOutSine",
      phaseEnabled: wingParts.some((part) => part.phase !== 0),
      parts: wingParts
    },
    validation: {
      canvasSize: `${input.project.canvas.width}x${input.project.canvas.height}`,
      transparentBackground: true,
      safeAreaProtected: input.motionPlan.rules.protectSafeArea,
      loopSeamless: input.motionPlan.rules.loopSeamless,
      anchorTransformEnabled: input.project.layers.some((layer) => Boolean(layer.anchor)),
      svgaExported: false
    },
    appliedEffects,
    warnings
  };
}

function hasDuplicateOverlayRisk(structure: MvpStructure): boolean {
  const fullCanvasBase = structure.parts.some((part) => {
    if (part.type !== "base_frame") return false;
    if (part.layerMode === "full_canvas") return true;
    const [x1, y1, x2, y2] = part.bbox;
    return x1 === 0 && y1 === 0 && x2 === structure.canvas.width && y2 === structure.canvas.height;
  });
  return fullCanvasBase && structure.parts.some((part) => part.type !== "base_frame");
}

export function buildMvpSvgaMap(input: Pick<MvpReportBuildInput, "jobName" | "config" | "structure" | "motionPlan" | "project">): MvpSvgaMap {
  return {
    jobName: input.jobName,
    assetType: input.config.assetType,
    layers: input.project.layers.map((layer) => {
      const sourcePart = findSourcePart(input.structure, input.motionPlan, layer);
      return {
        projectLayerId: layer.id,
        sourcePart,
        sourceImage: layer.source,
        role: layer.role,
        zIndex: layer.zIndex,
        sourceEffect: layer.sourceEffect,
        futureSvgaSpriteId: `sprite_${sanitizeId(layer.id)}`,
        futureSvgaImageKey: `img_${sanitizeId(path.basename(layer.source, path.extname(layer.source)))}`,
        frameIndex: layer.frameIndex,
        visibleFrameRange: layer.visibleFrameRange,
        maskSource: layer.maskSource,
        maskMode: layer.maskMode,
        trimmedBbox: layer.trimmedBbox,
        decodedBytes: layer.decodedBytes,
        imageHash: layer.imageHash,
        reusedFrom: layer.reusedFrom
      };
    }),
    effects: input.motionPlan.effects.map((effect) => {
      const layers = findEffectLayers(input.project, effect);
      return {
        effectId: effect.id,
        template: effect.template,
        targetPart: effect.target,
        generatedLayers: layers.map((layer) => layer.id),
        generatedAssets: unique(layers.filter((layer) => isGeneratedPath(layer.source)).map((layer) => layer.source))
      };
    }),
    assets: buildAssetMappings(input.project)
  };
}

function findEffectLayers(project: MvpProject, effect: MotionEffect): MvpProjectLayer[] {
  return project.layers.filter((layer) => layer.sourceEffect === effect.id);
}

function findSourcePart(structure: MvpStructure, motionPlan: MotionPlan, layer: MvpProjectLayer): string | undefined {
  if (layer.sourcePart) return layer.sourcePart;
  const partBySource = structure.parts.find((part) => part.source === layer.source);
  if (partBySource) {
    return partBySource.id;
  }
  const effect = motionPlan.effects.find((candidate) => candidate.id === layer.sourceEffect);
  return effect?.target;
}

function buildAssetMappings(project: MvpProject): MvpSvgaMap["assets"] {
  const bySource = new Map<string, MvpProjectLayer[]>();
  for (const layer of project.layers) {
    const usedByLayers = bySource.get(layer.source) ?? [];
    usedByLayers.push(layer);
    bySource.set(layer.source, usedByLayers);
  }

  return [...bySource.entries()].map(([source, layers]) => ({
    source,
    usedByLayers: layers.map((layer) => layer.id),
    trimmedBbox: layers[0]?.trimmedBbox,
    decodedBytes: layers[0]?.decodedBytes,
    imageHash: layers[0]?.imageHash,
    reusedFrom: layers[0]?.reusedFrom,
    ...(isGeneratedPath(source) ? { generated: true as const } : {})
  }));
}

interface SweepManifest {
  bakedFrameCount: number;
  usedBakedFrameCount: number;
  skippedTransparentFrameCount: number;
  skippedLowContributionFrameCount: number;
  dedupedFrameCount: number;
  sweepFrameStride: number;
}

async function readSweepManifest(jobDir: string): Promise<SweepManifest | undefined> {
  try {
    return JSON.parse(await readFile(path.join(jobDir, "generated", "sweep_baked", "manifest.json"), "utf8")) as SweepManifest;
  } catch {
    return undefined;
  }
}

async function estimateDecodedMemory(jobDir: string, project: MvpProject): Promise<{
  decodedImageBytes: number;
  decodedImageMB: number;
  largestImages: Array<{ source: string; width: number; height: number; decodedBytes: number }>;
  allTrimmed: boolean;
}> {
  const largestImages: Array<{ source: string; width: number; height: number; decodedBytes: number }> = [];
  let allTrimmed = true;
  for (const source of unique(project.layers.map((layer) => layer.source))) {
    try {
      const image = decodeRgbaPng(await readFile(path.join(jobDir, source)));
      largestImages.push({
        source,
        width: image.width,
        height: image.height,
        decodedBytes: image.width * image.height * 4
      });
      allTrimmed = allTrimmed && alphaTouchesEveryEdge(image);
    } catch {
      allTrimmed = false;
    }
  }
  largestImages.sort((a, b) => b.decodedBytes - a.decodedBytes);
  const decodedImageBytes = largestImages.reduce((sum, image) => sum + image.decodedBytes, 0);
  return {
    decodedImageBytes,
    decodedImageMB: Math.round((decodedImageBytes / 1024 / 1024) * 100) / 100,
    largestImages: largestImages.slice(0, 10),
    allTrimmed
  };
}

function alphaTouchesEveryEdge(image: { width: number; height: number; pixels: Uint8Array }): boolean {
  const rowHasAlpha = (y: number) => {
    for (let x = 0; x < image.width; x += 1) {
      if (image.pixels[(y * image.width + x) * 4 + 3] > 0) return true;
    }
    return false;
  };
  const columnHasAlpha = (x: number) => {
    for (let y = 0; y < image.height; y += 1) {
      if (image.pixels[(y * image.width + x) * 4 + 3] > 0) return true;
    }
    return false;
  };
  return rowHasAlpha(0) && rowHasAlpha(image.height - 1)
    && columnHasAlpha(0) && columnHasAlpha(image.width - 1);
}

async function countGeneratedAssets(jobDir: string): Promise<number> {
  const generatedDir = path.join(jobDir, "generated");
  try {
    return await countPngFiles(generatedDir);
  } catch {
    return 0;
  }
}

async function countPngFiles(dir: string): Promise<number> {
  const entries = await readdir(dir, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += await countPngFiles(path.join(dir, entry.name));
    } else if (entry.name.toLowerCase().endsWith(".png")) {
      count += 1;
    }
  }
  return count;
}

function collectUnknownEasings(project: MvpProject): string[] {
  return unique(project.layers
    .flatMap((layer) => layer.keyframes.map((keyframe) => keyframe.easing))
    .filter((easing): easing is string => typeof easing === "string" && !isSupportedEasing(easing)));
}

async function collectCurrentProjectWarnings(jobDir: string, project: MvpProject): Promise<string[]> {
  const warnings: string[] = [];
  for (const warning of project.warnings) {
    const generatedSource = warning.match(/(generated\/[^\s]+) is required but not generated/)?.[1];
    if (generatedSource) {
      if (generatedSource.endsWith("/*.png")) {
        const dir = path.join(jobDir, generatedSource.slice(0, -"/*.png".length));
        try {
          if ((await readdir(dir)).some((name) => name.toLowerCase().endsWith(".png"))) continue;
        } catch {
          // Keep the warning when the generated directory is unavailable.
        }
      } else if (await pathExists(path.join(jobDir, generatedSource))) {
        continue;
      }
    }
    warnings.push(warning);
  }
  return warnings;
}

async function optionalFileSize(filePath: string): Promise<number> {
  try {
    const stats = await stat(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isGeneratedPath(source: string): boolean {
  return source.startsWith("generated/");
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
