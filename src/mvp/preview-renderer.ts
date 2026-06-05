import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "../utils/fs.js";
import { decodeRgbaPng } from "../utils/png-reader.js";
import type { RgbaImage } from "../utils/png-writer.js";
import { nearestPaletteIndex, writeGif, type GifFrame } from "../preview/gif-encoder.js";
import { ensureMvpGeneratedAssets } from "./generated-assets.js";
import type { MvpKeyframe, MvpProject, MvpProjectLayer } from "./types.js";

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface LayerTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  alpha: number;
}

export interface MvpPreviewReport {
  status: "success" | "warning";
  projectPath: string;
  previewPath: string;
  sizeBytes: number;
  canvas: {
    width: number;
    height: number;
  };
  fps: number;
  durationMs: number;
  frames: number;
  layers: number;
  generatedAssets: string[];
  warnings: string[];
}

export async function renderMvpPreviewGif(jobDir: string, project: MvpProject): Promise<MvpPreviewReport> {
  const outputDir = path.join(jobDir, "output");
  await ensureDir(outputDir);

  const generatedResult = await ensureMvpGeneratedAssets(jobDir, project);
  const warnings = [...generatedResult.warnings];
  const images = await loadLayerImages(jobDir, project.layers, warnings);
  const sortedLayers = [...project.layers].sort((a, b) => a.zIndex - b.zIndex);
  const delayCs = Math.max(1, Math.round(100 / project.fps));
  const frames: GifFrame[] = [];

  for (let frame = 0; frame < project.frames; frame += 1) {
    frames.push({
      width: project.canvas.width,
      height: project.canvas.height,
      delayCs,
      pixels: drawMvpFrame(project, sortedLayers, images, frame)
    });
  }

  const previewPath = path.join(outputDir, "preview.gif");
  await writeGif(previewPath, frames);
  const previewStats = await stat(previewPath);

  return {
    status: warnings.length > 0 ? "warning" : "success",
    projectPath: "project/project.json",
    previewPath: "output/preview.gif",
    sizeBytes: previewStats.size,
    canvas: project.canvas,
    fps: project.fps,
    durationMs: project.durationMs,
    frames: project.frames,
    layers: project.layers.length,
    generatedAssets: generatedResult.generated.map((file) => toJobRelativePath(jobDir, file)),
    warnings
  };
}

function toJobRelativePath(jobDir: string, filePath: string): string {
  return path.relative(jobDir, filePath).split(path.sep).join("/");
}

export function transformAtFrame(layer: MvpProjectLayer, frame: number): LayerTransform {
  const [defaultX = 0, defaultY = 0] = layer.bbox ?? [0, 0, 0, 0];
  return {
    x: valueAtFrame(layer.keyframes, "x", frame, defaultX),
    y: valueAtFrame(layer.keyframes, "y", frame, defaultY),
    scaleX: valueAtFrame(layer.keyframes, "scaleX", frame, 1),
    scaleY: valueAtFrame(layer.keyframes, "scaleY", frame, 1),
    rotation: valueAtFrame(layer.keyframes, "rotation", frame, 0),
    alpha: valueAtFrame(layer.keyframes, "alpha", frame, 1)
  };
}

async function loadLayerImages(jobDir: string, layers: MvpProjectLayer[], warnings: string[]): Promise<Map<string, RgbaImage>> {
  const images = new Map<string, RgbaImage>();
  for (const layer of layers) {
    if (images.has(layer.source)) continue;
    const sourcePath = path.join(jobDir, layer.source);
    try {
      images.set(layer.source, decodeRgbaPng(await readFile(sourcePath)));
    } catch {
      warnings.push(`Layer source could not be loaded: ${layer.source}`);
    }
  }
  return images;
}

function drawMvpFrame(
  project: MvpProject,
  layers: MvpProjectLayer[],
  images: Map<string, RgbaImage>,
  frame: number
): Uint8Array {
  const rgba = new Uint8Array(project.canvas.width * project.canvas.height * 4);
  fillBackground(rgba, 18, 22, 28);

  for (const layer of layers) {
    const image = images.get(layer.source);
    if (!image) continue;
    const transform = transformAtFrame(layer, frame);
    if (transform.alpha <= 0) continue;
    drawLayer(rgba, project.canvas.width, project.canvas.height, image, layer, transform);
  }

  return quantizeToGif(rgba, project.canvas.width, project.canvas.height);
}

function drawLayer(
  target: Uint8Array,
  canvasWidth: number,
  canvasHeight: number,
  image: RgbaImage,
  layer: MvpProjectLayer,
  transform: LayerTransform
): void {
  for (let y = 0; y < canvasHeight; y += 1) {
    for (let x = 0; x < canvasWidth; x += 1) {
      const sample = sampleLayer(image, layer, transform, x, y);
      if (sample.a <= 0) continue;
      blendPixel(target, (y * canvasWidth + x) * 4, sample);
    }
  }
}

function sampleLayer(image: RgbaImage, layer: MvpProjectLayer, transform: LayerTransform, canvasX: number, canvasY: number): Rgba {
  const localPoint = canvasPointToLayerLocal(layer, transform, canvasX, canvasY);
  const localX = localPoint.x;
  const localY = localPoint.y;

  if (localX < 0 || localY < 0 || localX >= image.width || localY >= image.height) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const sampled = sampleNearest(image, localX, localY);
  return {
    r: sampled.r,
    g: sampled.g,
    b: sampled.b,
    a: sampled.a * transform.alpha
  };
}

export function canvasPointToLayerLocal(
  layer: MvpProjectLayer,
  transform: LayerTransform,
  canvasX: number,
  canvasY: number
): { x: number; y: number } {
  const localAnchorX = layer.anchor?.localX ?? 0;
  const localAnchorY = layer.anchor?.localY ?? 0;
  const pivotX = transform.x + localAnchorX;
  const pivotY = transform.y + localAnchorY;
  const radians = (-transform.rotation / 180) * Math.PI;
  const dx = canvasX - pivotX;
  const dy = canvasY - pivotY;
  const rotatedX = dx * Math.cos(radians) - dy * Math.sin(radians);
  const rotatedY = dx * Math.sin(radians) + dy * Math.cos(radians);
  const localX = localAnchorX + rotatedX / Math.max(0.001, transform.scaleX);
  const localY = localAnchorY + rotatedY / Math.max(0.001, transform.scaleY);
  return { x: localX, y: localY };
}

function valueAtFrame(
  keyframes: MvpKeyframe[],
  key: Exclude<keyof MvpKeyframe, "frame">,
  frame: number,
  fallback: number
): number {
  const points = keyframes
    .filter((keyframe) => typeof keyframe[key] === "number")
    .sort((a, b) => a.frame - b.frame);
  if (points.length === 0) return fallback;
  if (frame <= points[0].frame) return Number(points[0][key]);
  if (frame >= points[points.length - 1].frame) return Number(points[points.length - 1][key]);

  const nextIndex = points.findIndex((point) => point.frame >= frame);
  const previous = points[nextIndex - 1];
  const next = points[nextIndex];
  const span = Math.max(1, next.frame - previous.frame);
  const t = (frame - previous.frame) / span;
  return Number(previous[key]) + (Number(next[key]) - Number(previous[key])) * t;
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

function fillBackground(pixels: Uint8Array, r: number, g: number, b: number): void {
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = r;
    pixels[index + 1] = g;
    pixels[index + 2] = b;
    pixels[index + 3] = 255;
  }
}

function blendPixel(target: Uint8Array, offset: number, source: Rgba): void {
  const alpha = Math.max(0, Math.min(1, source.a));
  target[offset] = clamp(target[offset] * (1 - alpha) + source.r * alpha);
  target[offset + 1] = clamp(target[offset + 1] * (1 - alpha) + source.g * alpha);
  target[offset + 2] = clamp(target[offset + 2] * (1 - alpha) + source.b * alpha);
  target[offset + 3] = 255;
}

function quantizeToGif(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const indices = new Uint8Array(width * height);
  for (let pixel = 0; pixel < indices.length; pixel += 1) {
    const offset = pixel * 4;
    indices[pixel] = nearestPaletteIndex(rgba[offset], rgba[offset + 1], rgba[offset + 2]);
  }
  return indices;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
