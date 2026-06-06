import { execFile } from "node:child_process";
import { readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { ensureDir } from "../utils/fs.js";
import { decodeRgbaPng } from "../utils/png-reader.js";
import { createTransparentImage, setPixel, writeRgbaPng, type RgbaImage } from "../utils/png-writer.js";
import { nearestPaletteIndex, writeGif, type GifFrame } from "../preview/gif-encoder.js";
import { ensureMvpGeneratedAssets } from "./generated-assets.js";
import { interpolateLayerAtFrame } from "./interpolation.js";
import type { MvpProject, MvpProjectLayer } from "./types.js";
import { resizeRgbaImage } from "./image-optimization.js";

const execFileAsync = promisify(execFile);
const DARK_PREVIEW_BACKGROUND = "#111827";

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

interface VideoPreviewOutput {
  path: string;
  generated: boolean;
  sizeBytes: number;
  codec: string;
  error?: string;
  warning?: string;
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
  framesPath: string;
  frameCount: number;
  frameFormat: "png";
  frameColorMode: "rgba";
  reviewContactSheet: string;
  primaryReviewTarget: string;
  gifPreviewDeprecated: true;
  gifUsage: "fallback_only";
  compositing: {
    frames: "rgba_transparent";
    mp4Background: string;
    gifUsage: "fallback_only";
  };
  previewOutputs: {
    frames: {
      path: string;
      count: number;
      frameCount: number;
      format: "png";
      colorMode: "rgba";
    };
    webm: VideoPreviewOutput & {
      alpha: true;
    };
    mp4: VideoPreviewOutput & {
      background: string;
    };
    gif: {
      path: string;
      generated: boolean;
      sizeBytes: number;
      deprecated: true;
      usage: "fallback_only";
      colorMode: "dark_background";
    };
  };
}

export async function renderMvpPreviewGif(jobDir: string, project: MvpProject): Promise<MvpPreviewReport> {
  const outputDir = path.join(jobDir, "output");
  const framesDir = path.join(outputDir, "preview_frames");
  await ensureDir(outputDir);
  await rm(framesDir, { recursive: true, force: true });
  await ensureDir(framesDir);

  const generatedResult = await ensureMvpGeneratedAssets(jobDir, project);
  const warnings = [...generatedResult.warnings];
  const images = await loadLayerImages(jobDir, project.layers, warnings);
  const sortedLayers = [...project.layers].sort((a, b) => a.zIndex - b.zIndex);
  const rgbaFrames: RgbaImage[] = [];

  for (let frame = 0; frame < project.frames; frame += 1) {
    const image = drawMvpFrameRgba(project, sortedLayers, images, frame);
    rgbaFrames.push(image);
    await writeRgbaPng(path.join(framesDir, `frame_${String(frame).padStart(3, "0")}.png`), image);
  }

  const previewPath = path.join(outputDir, "preview.gif");
  const delayCs = Math.max(1, Math.round(100 / project.fps));
  const gifFrames: GifFrame[] = rgbaFrames.map((image) => ({
    width: image.width,
    height: image.height,
    delayCs,
    pixels: quantizeToGif(compositeOnDark(image.pixels), image.width, image.height)
  }));
  await writeGif(previewPath, gifFrames);
  const gifSizeBytes = (await stat(previewPath)).size;

  const webm = await encodeWebmPreview(outputDir, framesDir, project, warnings);
  const mp4 = await encodeMp4Preview(outputDir, framesDir, project, warnings);
  const reviewContactSheet = "output/review_frames_contact_sheet.png";
  await writeReviewContactSheet(path.join(jobDir, reviewContactSheet), rgbaFrames);
  const jobName = path.basename(jobDir);

  return {
    status: warnings.length > 0 ? "warning" : "success",
    projectPath: "project/project.json",
    previewPath: "output/preview.gif",
    sizeBytes: gifSizeBytes,
    canvas: project.canvas,
    fps: project.fps,
    durationMs: project.durationMs,
    frames: project.frames,
    layers: project.layers.length,
    generatedAssets: generatedResult.generated.map((file) => toJobRelativePath(jobDir, file)),
    warnings,
    framesPath: "output/preview_frames",
    frameCount: project.frames,
    frameFormat: "png",
    frameColorMode: "rgba",
    reviewContactSheet,
    primaryReviewTarget: `output/${jobName}.svga`,
    gifPreviewDeprecated: true,
    gifUsage: "fallback_only",
    compositing: {
      frames: "rgba_transparent",
      mp4Background: DARK_PREVIEW_BACKGROUND,
      gifUsage: "fallback_only"
    },
    previewOutputs: {
      frames: {
        path: "output/preview_frames",
        count: project.frames,
        frameCount: project.frames,
        format: "png",
        colorMode: "rgba"
      },
      webm: {
        ...webm,
        alpha: true
      },
      mp4: {
        ...mp4,
        background: DARK_PREVIEW_BACKGROUND
      },
      gif: {
        path: "output/preview.gif",
        generated: true,
        sizeBytes: gifSizeBytes,
        deprecated: true,
        usage: "fallback_only",
        colorMode: "dark_background"
      }
    }
  };
}

async function writeReviewContactSheet(outputPath: string, frames: RgbaImage[]): Promise<void> {
  const requested = [0, 8, 18, 24, 36, 48, 60, 71];
  const indices = requested.map((frame) => Math.min(frames.length - 1, frame));
  const thumbWidth = 150;
  const thumbHeight = 150;
  const labelHeight = 18;
  const columns = 4;
  const rows = 2;
  const output = createTransparentImage(columns * thumbWidth, rows * (thumbHeight + labelHeight));
  fillImage(output, [17, 24, 39, 255]);
  indices.forEach((frameIndex, index) => {
    const thumbnail = resizeRgbaImage(frames[frameIndex], thumbWidth, thumbHeight);
    const originX = (index % columns) * thumbWidth;
    const originY = Math.floor(index / columns) * (thumbHeight + labelHeight);
    compositeImage(output, thumbnail, originX, originY);
    drawTinyText(output, `FRAME ${String(frameIndex).padStart(3, "0")}`, originX + 6, originY + thumbHeight + 5);
  });
  await writeRgbaPng(outputPath, output);
}

function fillImage(image: RgbaImage, color: [number, number, number, number]): void {
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) setPixel(image, x, y, color);
  }
}

function compositeImage(target: RgbaImage, source: RgbaImage, originX: number, originY: number): void {
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourceOffset = (y * source.width + x) * 4;
      const alpha = source.pixels[sourceOffset + 3] / 255;
      if (alpha <= 0) continue;
      const targetOffset = ((originY + y) * target.width + originX + x) * 4;
      target.pixels[targetOffset] = Math.round(source.pixels[sourceOffset] * alpha + target.pixels[targetOffset] * (1 - alpha));
      target.pixels[targetOffset + 1] = Math.round(source.pixels[sourceOffset + 1] * alpha + target.pixels[targetOffset + 1] * (1 - alpha));
      target.pixels[targetOffset + 2] = Math.round(source.pixels[sourceOffset + 2] * alpha + target.pixels[targetOffset + 2] * (1 - alpha));
      target.pixels[targetOffset + 3] = 255;
    }
  }
}

const TINY_FONT: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"], "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"], "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"], "9": ["111", "101", "111", "001", "111"],
  "F": ["111", "100", "110", "100", "100"], "R": ["110", "101", "110", "101", "101"],
  "A": ["010", "101", "111", "101", "101"], "M": ["101", "111", "111", "101", "101"],
  "E": ["111", "100", "110", "100", "111"], " ": ["000", "000", "000", "000", "000"]
};

function drawTinyText(image: RgbaImage, text: string, originX: number, originY: number): void {
  let cursor = originX;
  for (const character of text) {
    const glyph = TINY_FONT[character] ?? TINY_FONT[" "];
    glyph.forEach((row, y) => [...row].forEach((pixel, x) => {
      if (pixel === "1") setPixel(image, cursor + x, originY + y, [203, 213, 225, 255]);
    }));
    cursor += 4;
  }
}

function toJobRelativePath(jobDir: string, filePath: string): string {
  return path.relative(jobDir, filePath).split(path.sep).join("/");
}

export function transformAtFrame(layer: MvpProjectLayer, frame: number): LayerTransform {
  return interpolateLayerAtFrame(layer, frame);
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

export function drawMvpFrameRgba(
  project: MvpProject,
  layers: MvpProjectLayer[],
  images: Map<string, RgbaImage>,
  frame: number
): RgbaImage {
  const pixels = new Uint8Array(project.canvas.width * project.canvas.height * 4);
  for (const layer of layers) {
    const image = images.get(layer.source);
    if (!image) continue;
    const transform = transformAtFrame(layer, frame);
    if (transform.alpha <= 0) continue;
    drawLayer(pixels, project.canvas.width, project.canvas.height, image, layer, transform);
  }
  return {
    width: project.canvas.width,
    height: project.canvas.height,
    pixels
  };
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
  if (localPoint.x < 0 || localPoint.y < 0 || localPoint.x >= image.width || localPoint.y >= image.height) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  const sampled = sampleNearest(image, localPoint.x, localPoint.y);
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
  return {
    x: localAnchorX + rotatedX / Math.max(0.001, transform.scaleX),
    y: localAnchorY + rotatedY / Math.max(0.001, transform.scaleY)
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

function blendPixel(target: Uint8Array, offset: number, source: Rgba): void {
  const sourceAlpha = Math.max(0, Math.min(1, source.a));
  const targetAlpha = target[offset + 3] / 255;
  const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
  if (outputAlpha <= 0) return;
  target[offset] = clamp((source.r * sourceAlpha + target[offset] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
  target[offset + 1] = clamp((source.g * sourceAlpha + target[offset + 1] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
  target[offset + 2] = clamp((source.b * sourceAlpha + target[offset + 2] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
  target[offset + 3] = clamp(outputAlpha * 255);
}

function compositeOnDark(rgba: Uint8Array): Uint8Array {
  const output = new Uint8Array(rgba.length);
  const background = [17, 24, 39];
  for (let index = 0; index < rgba.length; index += 4) {
    const alpha = rgba[index + 3] / 255;
    output[index] = clamp(rgba[index] * alpha + background[0] * (1 - alpha));
    output[index + 1] = clamp(rgba[index + 1] * alpha + background[1] * (1 - alpha));
    output[index + 2] = clamp(rgba[index + 2] * alpha + background[2] * (1 - alpha));
    output[index + 3] = 255;
  }
  return output;
}

function quantizeToGif(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const indices = new Uint8Array(width * height);
  for (let pixel = 0; pixel < indices.length; pixel += 1) {
    const offset = pixel * 4;
    indices[pixel] = nearestPaletteIndex(rgba[offset], rgba[offset + 1], rgba[offset + 2]);
  }
  return indices;
}

async function encodeWebmPreview(
  outputDir: string,
  framesDir: string,
  project: MvpProject,
  warnings: string[]
): Promise<VideoPreviewOutput> {
  const outputPath = path.join(outputDir, "preview.webm");
  const relativePath = "output/preview.webm";
  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-loglevel", "error",
      "-framerate", String(project.fps),
      "-i", path.join(framesDir, "frame_%03d.png"),
      "-c:v", "libvpx-vp9",
      "-pix_fmt", "yuva420p",
      "-auto-alt-ref", "0",
      "-an",
      outputPath
    ]);
    return { path: relativePath, generated: true, sizeBytes: (await stat(outputPath)).size, codec: "vp9" };
  } catch (error) {
    await rm(outputPath, { force: true });
    const message = `Transparent WebM preview could not be generated: ${formatProcessError(error)}`;
    warnings.push(message);
    return { path: relativePath, generated: false, sizeBytes: 0, codec: "vp9", error: message, warning: message };
  }
}

async function encodeMp4Preview(
  outputDir: string,
  framesDir: string,
  project: MvpProject,
  warnings: string[]
): Promise<VideoPreviewOutput> {
  const outputPath = path.join(outputDir, "preview.mp4");
  const relativePath = "output/preview.mp4";
  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-loglevel", "error",
      "-framerate", String(project.fps),
      "-i", path.join(framesDir, "frame_%03d.png"),
      "-f", "lavfi",
      "-i", `color=c=${DARK_PREVIEW_BACKGROUND}:s=${project.canvas.width}x${project.canvas.height}:r=${project.fps}`,
      "-filter_complex", "[1:v][0:v]overlay=shortest=1:format=auto,format=yuv420p",
      "-c:v", "libx264",
      "-movflags", "+faststart",
      "-an",
      outputPath
    ]);
    return { path: relativePath, generated: true, sizeBytes: (await stat(outputPath)).size, codec: "h264" };
  } catch (error) {
    await rm(outputPath, { force: true });
    const message = `Dark-background MP4 preview could not be generated: ${formatProcessError(error)}`;
    warnings.push(message);
    return { path: relativePath, generated: false, sizeBytes: 0, codec: "h264", error: message, warning: message };
  }
}

function formatProcessError(error: unknown): string {
  if (error && typeof error === "object") {
    const stderr = "stderr" in error ? String(error.stderr).trim() : "";
    if (stderr) return stderr.split("\n").at(-1) ?? stderr;
    if ("message" in error) return String(error.message);
  }
  return String(error);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
