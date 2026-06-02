import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AvatarFrameProject, Keyframe, LayerTransform, ProjectAnimation, ProjectAsset, ProjectLayer } from "../types/project.js";
import type { AssetConfig } from "../types/config.js";
import { sha256 } from "../utils/hash.js";
import { decodeRgbaPng } from "../utils/png-reader.js";
import { createTransparentImage, encodeRgbaPng, type RgbaImage } from "../utils/png-writer.js";

export interface BakedSweepResult {
  project: AvatarFrameProject;
  files: Array<{
    id: string;
    path: string;
    sizeBytes: number;
  }>;
  frameCount: number;
  frameStride: number;
  rawFrameCount: number;
  sampledFrameCount: number;
  transparentFrameCount: number;
  uniqueAssetCount: number;
  dedupedCount: number;
  assetSizeBeforeDedup: number;
  assetSizeAfterDedup: number;
}

interface BakedSweepFrame {
  id: string;
  assetId: string;
  layerId: string;
  kind: "sweep_core" | "sweep_soft";
  frameIndex: number;
  sampledFrame: number;
  frameStride: number;
  visibleFrameRange: {
    start: number;
    end: number;
  };
  zIndex: number;
  fileName: string;
  relativePath: string;
  imageHash: string;
  sharedAssetId: string;
  opacity: number;
}

const sweepLayerIds = new Set(["sweep_core", "sweep_soft"]);

export async function applyBakedSweepFrames(
  project: AvatarFrameProject,
  outputAssetsDir: string,
  config: AssetConfig["bakedSweep"] = {}
): Promise<BakedSweepResult> {
  const options = normalizeBakedSweepConfig(config);
  const frameAsset = project.assets.find((asset) => asset.id === "frame");
  const sweepAssets = new Map(project.assets
    .filter((asset) => sweepLayerIds.has(asset.id))
    .map((asset) => [asset.id, asset]));
  const sweepLayers = project.layers.filter((layer) => sweepLayerIds.has(layer.id));

  if (!options.enabled || !frameAsset || sweepLayers.length === 0) {
    return {
      project,
      files: [],
      frameCount: 0,
      frameStride: options.frameStride,
      rawFrameCount: 0,
      sampledFrameCount: 0,
      transparentFrameCount: 0,
      uniqueAssetCount: 0,
      dedupedCount: 0,
      assetSizeBeforeDedup: 0,
      assetSizeAfterDedup: 0
    };
  }

  const bakedDir = path.join(outputAssetsDir, "sweep_baked");
  await rm(bakedDir, { recursive: true, force: true });
  await mkdir(bakedDir, { recursive: true });

  const frameImage = decodeRgbaPng(await readFile(path.join(path.dirname(outputAssetsDir), frameAsset.path)));
  const animationMap = groupAnimations(project.animations);
  const bakedFrames: BakedSweepFrame[] = [];
  const bakedAssets: ProjectAsset[] = [];
  const bakedLayers: ProjectLayer[] = [];
  const bakedAnimations: ProjectAnimation[] = [];
  const files: BakedSweepResult["files"] = [];
  const uniqueAssetsByHash = new Map<string, ProjectAsset>();
  let assetSizeBeforeDedup = 0;
  let assetSizeAfterDedup = 0;
  let rawFrameCount = 0;
  let sampledFrameCount = 0;
  let transparentFrameCount = 0;

  for (const layer of sweepLayers) {
    const sourceAsset = sweepAssets.get(layer.assetId);
    if (!sourceAsset) {
      continue;
    }

    const sourceImage = decodeRgbaPng(await readFile(path.join(path.dirname(outputAssetsDir), sourceAsset.path)));
    const animations = animationMap.get(layer.id) ?? [];

    const effectiveFrames = effectiveSweepFrames(layer, animations, project.durationFrames);
    rawFrameCount += effectiveFrames.length;

    for (const range of strideRanges(effectiveFrames, options.frameStride)) {
      const sampledFrame = Math.round((range.start + range.end) / 2);
      sampledFrameCount += 1;
      const transform = transformAtFrame(layer, animations, sampledFrame);
      const id = `${layer.id}_baked_${padFrame(sampledFrame)}`;
      const fileName = `${layer.id}_${padFrame(sampledFrame)}.png`;
      const targetPath = path.join(bakedDir, fileName);
      const relativePath = `assets/sweep_baked/${fileName}`;
      const image = bakeSweepFrame({
        canvas: project.canvas,
        source: sourceImage,
        frameMask: frameImage,
        frameAsset,
        transform
      });
      if (options.skipTransparentFrames && isFullyTransparent(image)) {
        transparentFrameCount += 1;
        continue;
      }
      const buffer = encodeRgbaPng(image);
      const hash = sha256(buffer);
      const assetKey = options.dedupeIdenticalFrames ? hash : `${hash}:${id}`;
      assetSizeBeforeDedup += buffer.length;
      let asset = uniqueAssetsByHash.get(assetKey);
      if (!asset) {
        await writeFile(targetPath, buffer);
        assetSizeAfterDedup += buffer.length;
        files.push({ id, path: targetPath, sizeBytes: buffer.length });
        asset = {
          id,
          type: "image",
          path: relativePath,
          width: project.canvas.width,
          height: project.canvas.height,
          sha256: hash,
          generated: true
        };
        uniqueAssetsByHash.set(assetKey, asset);
        bakedAssets.push(asset);
      }
      bakedFrames.push({
        id,
        assetId: asset.id,
        layerId: id,
        kind: layer.id as "sweep_core" | "sweep_soft",
        frameIndex: range.start,
        sampledFrame,
        frameStride: options.frameStride,
        visibleFrameRange: range,
        zIndex: layer.zIndex,
        fileName,
        relativePath: asset.path,
        imageHash: asset.sha256,
        sharedAssetId: asset.id,
        opacity: 1
      });
    }
  }

  for (const bakedFrame of bakedFrames) {
    bakedLayers.push(createBakedLayer(bakedFrame, project.canvas));
    bakedAnimations.push(createSingleFrameVisibilityAnimation(bakedFrame, project.durationFrames));
  }

  return {
    project: {
      ...project,
      assets: [...project.assets, ...bakedAssets],
      layers: [
        ...project.layers.filter((layer) => !sweepLayerIds.has(layer.id)),
        ...bakedLayers
      ].sort((a, b) => a.zIndex - b.zIndex),
      animations: [
        ...project.animations.filter((animation) => !sweepLayerIds.has(animation.targetLayerId)),
        ...bakedAnimations
      ],
      bakedSweep: {
        enabled: options.enabled,
        frameStride: options.frameStride,
        skipTransparentFrames: options.skipTransparentFrames,
        dedupeIdenticalFrames: options.dedupeIdenticalFrames,
        sampledFrameCount
      }
    },
    files,
    frameCount: bakedFrames.length,
    frameStride: options.frameStride,
    rawFrameCount,
    sampledFrameCount,
    transparentFrameCount,
    uniqueAssetCount: uniqueAssetsByHash.size,
    dedupedCount: sampledFrameCount - transparentFrameCount - uniqueAssetsByHash.size,
    assetSizeBeforeDedup,
    assetSizeAfterDedup
  };
}

function normalizeBakedSweepConfig(config: AssetConfig["bakedSweep"]): {
  enabled: boolean;
  frameStride: 1 | 2 | 3;
  skipTransparentFrames: boolean;
  dedupeIdenticalFrames: boolean;
} {
  const rawStride = Number(config?.frameStride ?? 1);
  return {
    enabled: config?.enabled !== false,
    frameStride: rawStride === 2 || rawStride === 3 ? rawStride : 1,
    skipTransparentFrames: config?.skipTransparentFrames !== false,
    dedupeIdenticalFrames: config?.dedupeIdenticalFrames !== false
  };
}

function effectiveSweepFrames(layer: ProjectLayer, animations: ProjectAnimation[], durationFrames: number): number[] {
  const frames: number[] = [];
  for (let frame = 0; frame < durationFrames; frame += 1) {
    if (transformAtFrame(layer, animations, frame).opacity > 0.005) {
      frames.push(frame);
    }
  }
  return frames;
}

function strideRanges(frames: number[], frameStride: number): Array<{ start: number; end: number }> {
  if (frames.length === 0) {
    return [];
  }

  const ranges: Array<{ start: number; end: number }> = [];
  let sequenceStartIndex = 0;
  for (let index = 1; index <= frames.length; index += 1) {
    const sequenceEnded = index === frames.length || frames[index] !== frames[index - 1] + 1;
    if (!sequenceEnded) {
      continue;
    }

    const sequence = frames.slice(sequenceStartIndex, index);
    for (let offset = 0; offset < sequence.length; offset += frameStride) {
      const chunk = sequence.slice(offset, offset + frameStride);
      ranges.push({ start: chunk[0], end: chunk[chunk.length - 1] });
    }
    sequenceStartIndex = index;
  }

  return ranges;
}

function bakeSweepFrame(input: {
  canvas: { width: number; height: number };
  source: RgbaImage;
  frameMask: RgbaImage;
  frameAsset: ProjectAsset;
  transform: LayerTransform;
}): RgbaImage {
  const output = createTransparentImage(input.canvas.width, input.canvas.height);
  const maskOffsetX = Math.round((input.canvas.width - input.frameAsset.width) / 2);
  const maskOffsetY = Math.round((input.canvas.height - input.frameAsset.height) / 2);

  for (let y = 0; y < input.canvas.height; y += 1) {
    for (let x = 0; x < input.canvas.width; x += 1) {
      const maskX = x - maskOffsetX;
      const maskY = y - maskOffsetY;
      if (maskX < 0 || maskY < 0 || maskX >= input.frameMask.width || maskY >= input.frameMask.height) {
        continue;
      }

      const maskAlpha = input.frameMask.pixels[(maskY * input.frameMask.width + maskX) * 4 + 3] / 255;
      if (maskAlpha <= 0) {
        continue;
      }

      const local = canvasToLayerLocal(input.source, input.transform, x, y);
      if (!local) {
        continue;
      }

      const sample = sampleNearest(input.source, local.x, local.y);
      const sourceAlpha = sample[3] / 255;
      if (sourceAlpha <= 0) {
        continue;
      }

      const targetOffset = (y * output.width + x) * 4;
      output.pixels[targetOffset] = sample[0];
      output.pixels[targetOffset + 1] = sample[1];
      output.pixels[targetOffset + 2] = sample[2];
      output.pixels[targetOffset + 3] = Math.round(sample[3] * input.transform.opacity * maskAlpha);
    }
  }

  return output;
}

function canvasToLayerLocal(source: RgbaImage, transform: LayerTransform, x: number, y: number): { x: number; y: number } | undefined {
  const radians = (-transform.rotation / 180) * Math.PI;
  const dx = x - transform.x;
  const dy = y - transform.y;
  const rotatedX = dx * Math.cos(radians) - dy * Math.sin(radians);
  const rotatedY = dx * Math.sin(radians) + dy * Math.cos(radians);
  const localX = source.width / 2 + rotatedX / Math.max(0.001, transform.scaleX);
  const localY = source.height / 2 + rotatedY / Math.max(0.001, transform.scaleY);

  if (localX < 0 || localY < 0 || localX >= source.width || localY >= source.height) {
    return undefined;
  }

  return { x: localX, y: localY };
}

function sampleNearest(image: RgbaImage, x: number, y: number): [number, number, number, number] {
  const sx = Math.max(0, Math.min(image.width - 1, Math.round(x)));
  const sy = Math.max(0, Math.min(image.height - 1, Math.round(y)));
  const offset = (sy * image.width + sx) * 4;
  return [
    image.pixels[offset],
    image.pixels[offset + 1],
    image.pixels[offset + 2],
    image.pixels[offset + 3]
  ];
}

function createBakedLayer(frame: BakedSweepFrame, canvas: { width: number; height: number }): ProjectLayer {
  return {
    id: frame.layerId,
    type: "image",
    assetId: frame.assetId,
    zIndex: frame.zIndex,
    visible: true,
    blendMode: "normal",
    fallbackBlendMode: "normal",
    fallbackOpacityMultiplier: 1,
    anchor: {
      x: canvas.width / 2,
      y: canvas.height / 2
    },
    transform: {
      x: canvas.width / 2,
      y: canvas.height / 2,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 0
    },
    metadata: {
      sweepBakedFrame: {
        frameIndex: frame.frameIndex,
        sampledFrame: frame.sampledFrame,
        frameStride: frame.frameStride,
        kind: frame.kind,
        exportAssetPath: frame.relativePath,
        imageHash: frame.imageHash,
        sharedAssetId: frame.sharedAssetId,
        visibleFrameRange: frame.visibleFrameRange
      }
    }
  };
}

function isFullyTransparent(image: RgbaImage): boolean {
  for (let offset = 3; offset < image.pixels.length; offset += 4) {
    if (image.pixels[offset] > 0) {
      return false;
    }
  }
  return true;
}

function createSingleFrameVisibilityAnimation(frame: BakedSweepFrame, durationFrames: number): ProjectAnimation {
  const keyframes: Keyframe[] = [];
  if (frame.visibleFrameRange.start > 0) {
    keyframes.push({ frame: frame.visibleFrameRange.start - 1, opacity: 0 });
  }
  keyframes.push({ frame: frame.visibleFrameRange.start, opacity: frame.opacity });
  if (frame.visibleFrameRange.end > frame.visibleFrameRange.start) {
    keyframes.push({ frame: frame.visibleFrameRange.end, opacity: frame.opacity });
  }
  if (frame.visibleFrameRange.end < durationFrames - 1) {
    keyframes.push({ frame: frame.visibleFrameRange.end + 1, opacity: 0 });
  }

  return {
    id: `anim_${frame.layerId}`,
    templateId: "metal_edge_sweep",
    targetLayerId: frame.layerId,
    easing: "linear",
    keyframes
  };
}

function groupAnimations(animations: ProjectAnimation[]): Map<string, ProjectAnimation[]> {
  const groups = new Map<string, ProjectAnimation[]>();
  for (const animation of animations) {
    groups.set(animation.targetLayerId, [...(groups.get(animation.targetLayerId) ?? []), animation]);
  }
  return groups;
}

function transformAtFrame(layer: ProjectLayer, animations: ProjectAnimation[], frame: number): LayerTransform {
  let transform = { ...layer.transform };
  for (const animation of animations) {
    transform = {
      ...transform,
      ...interpolateAnimation(animation, frame)
    };
  }
  return transform;
}

function interpolateAnimation(animation: ProjectAnimation, frame: number): Partial<LayerTransform> {
  const keyframes = [...animation.keyframes].sort((a, b) => a.frame - b.frame);
  if (keyframes.length === 0) {
    return {};
  }
  if (frame <= keyframes[0].frame) {
    return keyframeTransform(keyframes[0]);
  }
  if (frame >= keyframes[keyframes.length - 1].frame) {
    return keyframeTransform(keyframes[keyframes.length - 1]);
  }

  const nextIndex = keyframes.findIndex((keyframe) => keyframe.frame >= frame);
  const previous = keyframes[nextIndex - 1];
  const next = keyframes[nextIndex];
  const span = Math.max(1, next.frame - previous.frame);
  const t = (frame - previous.frame) / span;
  const result: Partial<LayerTransform> = {};

  for (const key of ["x", "y", "scaleX", "scaleY", "rotation", "opacity"] as const) {
    const a = previous[key];
    const b = next[key];
    if (typeof a === "number" && typeof b === "number") {
      result[key] = a + (b - a) * t;
    } else if (typeof b === "number") {
      result[key] = b;
    } else if (typeof a === "number") {
      result[key] = a;
    }
  }

  return result;
}

function keyframeTransform(keyframe: Keyframe): Partial<LayerTransform> {
  const result: Partial<LayerTransform> = {};
  for (const key of ["x", "y", "scaleX", "scaleY", "rotation", "opacity"] as const) {
    if (typeof keyframe[key] === "number") {
      result[key] = keyframe[key];
    }
  }
  return result;
}

function padFrame(frame: number): string {
  return String(frame).padStart(3, "0");
}
