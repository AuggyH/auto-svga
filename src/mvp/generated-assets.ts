import { access, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { decodeRgbaPng } from "../utils/png-reader.js";
import { createTransparentImage, setPixel, writeRgbaPng, type RgbaImage } from "../utils/png-writer.js";
import { ensureDir, writeJsonFile } from "../utils/fs.js";
import type { MvpProject, MvpStructure } from "./types.js";
import { sweepActiveFrameCount, sweepBakedFramePath, sweepProgress } from "./sweep-mask.js";
import { optimizeRgbaImage, resizeRgbaImage } from "./image-optimization.js";

export interface GeneratedAssetResult {
  generated: string[];
  warnings: string[];
  sweep: {
    bakedFrameCount: number;
    usedBakedFrameCount: number;
    skippedTransparentFrameCount: number;
    skippedLowContributionFrameCount: number;
    dedupedFrameCount: number;
  };
}

export async function ensureMvpGeneratedAssets(jobDir: string, project: MvpProject): Promise<GeneratedAssetResult> {
  const generatedDir = path.join(jobDir, "generated");
  await ensureDir(generatedDir);

  const generated: string[] = [];
  const warnings: string[] = [];
  const sweep = {
    bakedFrameCount: 0,
    usedBakedFrameCount: 0,
    skippedTransparentFrameCount: 0,
    skippedLowContributionFrameCount: 0,
    dedupedFrameCount: 0
  };

  const baseFrame = await loadBaseFrame(jobDir, project, warnings);
  generated.push(...await writeOptimizedGenerated(path.join(generatedDir, "sweep_light.png"), createSweepLight(project.canvas.width, project.canvas.height)));
  generated.push(...await writeOptimizedGenerated(path.join(generatedDir, "glow_frame.png"), createGlowFrame(baseFrame.image)));
  generated.push(...await writeOptimizedGenerated(
    path.join(generatedDir, "glow_dot.png"),
    createGlowDot(Math.max(24, Math.round(project.canvas.width * 0.107)))
  ));
  await rm(path.join(generatedDir, "sweep_light_masked.png"), { force: true });

  const structure = await readOptionalStructure(jobDir);
  const sweepLayers = project.layers.filter((layer) => layer.maskMode === "baked_sweep_frames" && layer.frameIndex !== undefined);
  if (sweepLayers.length > 0) {
    sweep.bakedFrameCount = sweepActiveFrameCount(project.frames);
    const sweepDir = path.join(generatedDir, "sweep_baked");
    await ensureDir(sweepDir);
    const activeFrameCount = sweepActiveFrameCount(project.frames);
    const previousManifest = await readSweepManifest(sweepDir);
    const stride = Math.max(1, Math.round(
      sweepLayers[0]?.visibleFrameRange
        ? sweepLayers[0].visibleFrameRange[1] - sweepLayers[0].visibleFrameRange[0] + 1
        : 1
    ));
    const expectedSampleCount = Math.ceil(activeFrameCount / stride);
    const preservePriorSkipStats = sweepLayers.length < expectedSampleCount && previousManifest;
    const expectedNames = new Set<string>();
    const retainedLayers = [];
    const sourceByHash = new Map<string, string>();
    for (const layer of sweepLayers) {
      const frame = layer.frameIndex ?? 0;
      const relativePath = sweepBakedFramePath(frame);
      const baked = createBakedSweepFrame(
        baseFrame.image,
        baseFrame.originX,
        baseFrame.originY,
        project.canvas.width,
        project.canvas.height,
        frame,
        activeFrameCount,
        structure
      );
      const fullResolutionOptimized = optimizeRgbaImage(baked);
      const effectScale = Math.max(0.25, Math.min(1, project.effectResolutionScale ?? 1));
      const optimized = fullResolutionOptimized && effectScale < 1
        ? optimizeRgbaImage(resizeRgbaImage(
          fullResolutionOptimized.image,
          Math.max(1, Math.round(fullResolutionOptimized.image.width * effectScale)),
          Math.max(1, Math.round(fullResolutionOptimized.image.height * effectScale))
        ))
        : fullResolutionOptimized;
      if (!optimized) {
        sweep.skippedTransparentFrameCount += 1;
        continue;
      }
      if (optimized.bounds.visiblePixels < 64 || optimized.bounds.alphaSum < 5000) {
        sweep.skippedLowContributionFrameCount += 1;
        continue;
      }
      const reusedFrom = sourceByHash.get(optimized.hash);
      if (reusedFrom) {
        layer.source = reusedFrom;
        layer.reusedFrom = reusedFrom;
        sweep.dedupedFrameCount += 1;
      } else {
        const alreadyExisted = await exists(path.join(jobDir, relativePath));
        await writeFile(path.join(jobDir, relativePath), optimized.bytes);
        layer.source = relativePath;
        sourceByHash.set(optimized.hash, relativePath);
        expectedNames.add(path.basename(relativePath));
        if (!alreadyExisted) generated.push(path.join(jobDir, relativePath));
      }
      layer.imageHash = optimized.hash;
      layer.trimmedBbox = [
        fullResolutionOptimized?.bounds.x ?? optimized.bounds.x,
        fullResolutionOptimized?.bounds.y ?? optimized.bounds.y,
        fullResolutionOptimized?.bounds.width ?? optimized.bounds.width,
        fullResolutionOptimized?.bounds.height ?? optimized.bounds.height
      ];
      layer.decodedBytes = optimized.image.width * optimized.image.height * 4;
      layer.bbox = [
        fullResolutionOptimized?.bounds.x ?? optimized.bounds.x,
        fullResolutionOptimized?.bounds.y ?? optimized.bounds.y,
        (fullResolutionOptimized?.bounds.x ?? optimized.bounds.x) + (fullResolutionOptimized?.bounds.width ?? optimized.image.width),
        (fullResolutionOptimized?.bounds.y ?? optimized.bounds.y) + (fullResolutionOptimized?.bounds.height ?? optimized.image.height)
      ];
      layer.keyframes = layer.keyframes.map((keyframe) => ({
        ...keyframe,
        x: fullResolutionOptimized?.bounds.x ?? optimized.bounds.x,
        y: fullResolutionOptimized?.bounds.y ?? optimized.bounds.y,
        scaleX: 1 / effectScale,
        scaleY: 1 / effectScale
      }));
      retainedLayers.push(layer);
      sweep.usedBakedFrameCount += 1;
    }
    project.layers = project.layers
      .filter((layer) => layer.maskMode !== "baked_sweep_frames")
      .concat(retainedLayers)
      .sort((a, b) => a.zIndex - b.zIndex);
    if (preservePriorSkipStats) {
      sweep.skippedTransparentFrameCount = previousManifest.skippedTransparentFrameCount ?? 0;
      sweep.skippedLowContributionFrameCount = previousManifest.skippedLowContributionFrameCount ?? 0;
      sweep.dedupedFrameCount = previousManifest.dedupedFrameCount ?? 0;
    }
    await removeStaleSweepFrames(sweepDir, expectedNames);
    await writeJsonFile(path.join(sweepDir, "manifest.json"), {
      ...sweep,
      sweepFrameStride: stride,
      trimBakedFrames: true,
      minVisiblePixels: 64,
      minAlphaSum: 5000
    });
  }

  for (const layer of project.layers) {
    if (!layer.requiredGeneratedAsset) continue;
    const sourcePath = path.join(jobDir, layer.source);
    if (!await exists(sourcePath)) {
      warnings.push(`Required generated asset is still missing: ${layer.source}`);
    }
  }

  return { generated, warnings, sweep };
}

async function readSweepManifest(sweepDir: string): Promise<Partial<GeneratedAssetResult["sweep"]> | undefined> {
  try {
    return JSON.parse(await readFile(path.join(sweepDir, "manifest.json"), "utf8")) as Partial<GeneratedAssetResult["sweep"]>;
  } catch {
    return undefined;
  }
}

async function removeStaleSweepFrames(sweepDir: string, expectedNames: Set<string>): Promise<void> {
  let entries: string[] = [];
  try {
    entries = await readdir(sweepDir);
  } catch {
    return;
  }
  await Promise.all(entries
    .filter((name) => name.startsWith("sweep_") && name.endsWith(".png") && !expectedNames.has(name))
    .map((name) => rm(path.join(sweepDir, name), { force: true })));
}

async function writeGenerated(filePath: string, image: RgbaImage): Promise<string[]> {
  const alreadyExisted = await exists(filePath);
  await writeRgbaPng(filePath, image);
  return alreadyExisted ? [] : [filePath];
}

async function writeOptimizedGenerated(filePath: string, image: RgbaImage): Promise<string[]> {
  const optimized = optimizeRgbaImage(image);
  if (!optimized) return [];
  const alreadyExisted = await exists(filePath);
  await writeFile(filePath, optimized.bytes);
  return alreadyExisted ? [] : [filePath];
}

function createSweepLight(canvasWidth: number, canvasHeight: number): RgbaImage {
  const width = Math.round(canvasWidth * 1.4);
  const height = Math.round(canvasHeight * 1.1);
  const image = createTransparentImage(width, height);
  const bandWidth = Math.max(18, Math.round(canvasWidth * 0.08));
  const center = width * 0.48;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const diagonal = x - y * 0.38;
      const distance = Math.abs(diagonal - center);
      if (distance > bandWidth) continue;
      const t = 1 - distance / bandWidth;
      const alpha = Math.round(150 * t * t);
      setPixel(image, x, y, [255, 244, 196, alpha]);
    }
  }
  return image;
}

function createGlowFrame(base: RgbaImage): RgbaImage {
  const glow = createTransparentImage(base.width, base.height);
  for (let index = 0; index < base.pixels.length; index += 4) {
    const alpha = base.pixels[index + 3];
    if (alpha <= 0) continue;
    glow.pixels[index] = 188;
    glow.pixels[index + 1] = 218;
    glow.pixels[index + 2] = 246;
    glow.pixels[index + 3] = Math.min(120, Math.round(alpha * 0.35));
  }
  return glow;
}

function createBakedSweepFrame(
  base: RgbaImage,
  baseOriginX: number,
  baseOriginY: number,
  canvasWidth: number,
  canvasHeight: number,
  frame: number,
  activeFrameCount: number,
  structure: MvpStructure | undefined
): RgbaImage {
  const image = createTransparentImage(canvasWidth, canvasHeight);
  const bandWidth = Math.max(20, Math.round(canvasWidth * 0.09));
  const progress = sweepProgress(frame, activeFrameCount);
  const center = -canvasWidth * 0.2 + progress * canvasWidth * 1.4;
  const envelope = Math.sin(Math.PI * progress);
  for (let y = 0; y < canvasHeight; y += 1) {
    for (let x = 0; x < canvasWidth; x += 1) {
      const baseX = x - baseOriginX;
      const baseY = y - baseOriginY;
      if (baseX < 0 || baseY < 0 || baseX >= base.width || baseY >= base.height) continue;
      const baseAlpha = base.pixels[(baseY * base.width + baseX) * 4 + 3] / 255;
      if (baseAlpha <= 0) continue;
      const distance = Math.abs(x - y * 0.38 - center);
      if (distance > bandWidth) continue;
      const strength = 1 - distance / bandWidth;
      const safeAreaFactor = safeAreaExclusionFactor(x, y, structure);
      const alpha = Math.round(150 * strength * strength * baseAlpha * safeAreaFactor * envelope);
      setPixel(image, x, y, [255, 246, 205, alpha]);
    }
  }
  return image;
}

function safeAreaExclusionFactor(x: number, y: number, structure: MvpStructure | undefined): number {
  if (!structure || structure.safeArea.type !== "circle") return 1;
  const dx = x - structure.safeArea.centerX;
  const dy = y - structure.safeArea.centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const excludedRadius = structure.safeArea.radius + 8;
  const feather = 12;
  if (distance <= excludedRadius) return 0;
  if (distance >= excludedRadius + feather) return 1;
  return (distance - excludedRadius) / feather;
}

async function loadBaseFrame(
  jobDir: string,
  project: MvpProject,
  warnings: string[]
): Promise<{ source?: string; image: RgbaImage; originX: number; originY: number }> {
  const structure = await readOptionalStructure(jobDir);
  const basePart = structure?.parts
    .filter((part) => part.type === "base_frame")
    .sort((a, b) => {
      const aFull = a.layerMode === "full_canvas" || a.id.toLowerCase().includes("full") ? 0 : 1;
      const bFull = b.layerMode === "full_canvas" || b.id.toLowerCase().includes("full") ? 0 : 1;
      return aFull - bFull || a.zIndex - b.zIndex;
    })[0];
  const projectBase = project.layers.find((layer) => layer.sourcePart === basePart?.id)
    ?? project.layers.find((layer) => layer.role === "part" && layer.sourcePart?.includes("base_frame"));
  const projectFallback = project.layers
    .filter((layer) => layer.role === "part")
    .sort((a, b) => {
      const aArea = bboxArea(a.bbox);
      const bArea = bboxArea(b.bbox);
      return bArea - aArea || a.zIndex - b.zIndex;
    })[0]?.source;
  const source = projectBase?.source ?? basePart?.source ?? projectFallback ?? "input/base_frame.png";
  const originX = projectBase?.bbox?.[0] ?? basePart?.bbox[0] ?? 0;
  const originY = projectBase?.bbox?.[1] ?? basePart?.bbox[1] ?? 0;
  const basePath = path.join(jobDir, source);
  if (!await exists(basePath)) {
    warnings.push(`${source} is missing; generated glow and masked sweep use transparent placeholders.`);
    return { source, image: createTransparentImage(project.canvas.width, project.canvas.height), originX: 0, originY: 0 };
  }
  try {
    return { source, image: decodeRgbaPng(await readFile(basePath)), originX, originY };
  } catch (error) {
    warnings.push(`${source} could not be decoded; generated glow and masked sweep use transparent placeholders: ${String(error)}`);
    return { source, image: createTransparentImage(project.canvas.width, project.canvas.height), originX: 0, originY: 0 };
  }
}

async function readOptionalStructure(jobDir: string): Promise<MvpStructure | undefined> {
  try {
    return JSON.parse(await readFile(path.join(jobDir, "input", "structure.json"), "utf8")) as MvpStructure;
  } catch {
    return undefined;
  }
}

function bboxArea(bbox: [number, number, number, number] | undefined): number {
  if (!bbox) return 0;
  return Math.max(0, bbox[2] - bbox[0]) * Math.max(0, bbox[3] - bbox[1]);
}

function createGlowDot(size: number): RgbaImage {
  const image = createTransparentImage(size, size);
  const center = (size - 1) / 2;
  const radius = size * 0.42;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - center;
      const dy = y - center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const radial = Math.max(0, 1 - distance / radius);
      const cross = Math.max(0, 1 - Math.min(Math.abs(dx), Math.abs(dy)) / 2.2) * Math.max(0, 1 - distance / (radius * 1.15));
      const alpha = Math.round(Math.max(radial * radial * 220, cross * 160));
      if (alpha > 0) {
        setPixel(image, x, y, [255, 255, 255, alpha]);
      }
    }
  }
  return image;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
