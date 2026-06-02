import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AvatarFrameProject, LayerTransform, ProjectAnimation, ProjectAsset, ProjectLayer } from "../types/project.js";
import { ensureDir } from "../utils/fs.js";
import { decodeRgbaPng } from "../utils/png-reader.js";
import type { RgbaImage } from "../utils/png-writer.js";
import { nearestPaletteIndex, writeGif, type GifFrame } from "./gif-encoder.js";

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export async function renderPreviewGif(project: AvatarFrameProject, outputDir: string): Promise<string> {
  await ensureDir(outputDir);
  const width = project.canvas.width;
  const height = project.canvas.height;
  const delayCs = Math.max(1, Math.round(100 / project.fps));
  const sortedLayers = [...project.layers].filter((layer) => layer.visible).sort((a, b) => a.zIndex - b.zIndex);
  const assetImages = await loadAssetImages(project.assets, outputDir);
  const frames: GifFrame[] = [];

  for (let frame = 0; frame < project.durationFrames; frame += 1) {
    frames.push({
      width,
      height,
      delayCs,
      pixels: drawProjectFrame(project, sortedLayers, assetImages, frame)
    });
  }

  const previewPath = path.join(outputDir, "preview.gif");
  await writeGif(previewPath, frames);
  return previewPath;
}

async function loadAssetImages(assets: ProjectAsset[], outputDir: string): Promise<Map<string, RgbaImage>> {
  const images = new Map<string, RgbaImage>();
  for (const asset of assets) {
    images.set(asset.id, decodeRgbaPng(await readFile(path.join(outputDir, asset.path))));
  }
  return images;
}

function drawProjectFrame(
  project: AvatarFrameProject,
  layers: ProjectLayer[],
  assetImages: Map<string, RgbaImage>,
  frame: number
): Uint8Array {
  const pixels = new Uint8Array(project.canvas.width * project.canvas.height);
  const animationMap = groupAnimations(project.animations);
  const activeLayers = layers.flatMap((layer) => {
    const asset = assetImages.get(layer.assetId);
    if (!asset) {
      return [];
    }
    const transform = transformAtFrame(layer, animationMap.get(layer.id) ?? [], frame);
    return transform.opacity > 0 ? [{ layer, asset, transform }] : [];
  });

  for (let y = 0; y < project.canvas.height; y += 1) {
    for (let x = 0; x < project.canvas.width; x += 1) {
      let color: Rgba = { r: 18, g: 22, b: 28, a: 1 };
      for (const { layer, asset, transform } of activeLayers) {
        const sampled = sampleLayerAsset(asset, layer, transform, x, y);
        if (sampled.a <= 0) {
          continue;
        }
        color = blend(color, sampled, layer.blendMode);
      }
      pixels[y * project.canvas.width + x] = nearestPaletteIndex(color.r, color.g, color.b);
    }
  }

  return pixels;
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
  const rawT = (frame - previous.frame) / span;
  const t = animation.easing === "easeInOut" ? easeInOut(rawT) : animation.easing === "easeOut" ? easeOut(rawT) : rawT;
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

function keyframeTransform(keyframe: ProjectAnimation["keyframes"][number]): Partial<LayerTransform> {
  const result: Partial<LayerTransform> = {};
  for (const key of ["x", "y", "scaleX", "scaleY", "rotation", "opacity"] as const) {
    if (typeof keyframe[key] === "number") {
      result[key] = keyframe[key];
    }
  }
  return result;
}

function sampleLayerAsset(asset: RgbaImage, layer: ProjectLayer, transform: LayerTransform, x: number, y: number): Rgba {
  const radians = (-transform.rotation / 180) * Math.PI;
  const dx = x - transform.x;
  const dy = y - transform.y;
  const rotatedX = dx * Math.cos(radians) - dy * Math.sin(radians);
  const rotatedY = dx * Math.sin(radians) + dy * Math.cos(radians);
  const localX = layer.anchor.x + rotatedX / Math.max(0.001, transform.scaleX);
  const localY = layer.anchor.y + rotatedY / Math.max(0.001, transform.scaleY);

  if (localX < 0 || localY < 0 || localX >= asset.width || localY >= asset.height) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const sampled = sampleNearest(asset, localX, localY);
  return {
    r: sampled.r,
    g: sampled.g,
    b: sampled.b,
    a: sampled.a * transform.opacity
  };
}

function sampleNearest(image: RgbaImage, x: number, y: number): Rgba {
  const sx = Math.max(0, Math.min(image.width - 1, Math.round(x)));
  const sy = Math.max(0, Math.min(image.height - 1, Math.round(y)));
  const offset = (sy * image.width + sx) * 4;
  return {
    r: image.pixels[offset],
    g: image.pixels[offset + 1],
    b: image.pixels[offset + 2],
    a: image.pixels[offset + 3] / 255
  };
}

function blend(base: Rgba, source: Rgba, blendMode: ProjectLayer["blendMode"]): Rgba {
  const alpha = Math.max(0, Math.min(1, source.a));
  if (blendMode === "add") {
    return {
      r: clamp(base.r + source.r * alpha),
      g: clamp(base.g + source.g * alpha),
      b: clamp(base.b + source.b * alpha),
      a: 1
    };
  }

  if (blendMode === "screen") {
    return {
      r: clamp(base.r + (255 - base.r) * (source.r / 255) * alpha),
      g: clamp(base.g + (255 - base.g) * (source.g / 255) * alpha),
      b: clamp(base.b + (255 - base.b) * (source.b / 255) * alpha),
      a: 1
    };
  }

  return {
    r: clamp(base.r * (1 - alpha) + source.r * alpha),
    g: clamp(base.g * (1 - alpha) + source.g * alpha),
    b: clamp(base.b * (1 - alpha) + source.b * alpha),
    a: 1
  };
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
