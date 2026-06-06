import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { decodeRgbaPng } from "../utils/png-reader.js";
import { createTransparentImage, encodeRgbaPng, type RgbaImage } from "../utils/png-writer.js";

export interface AlphaBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  visiblePixels: number;
  alphaSum: number;
}

export interface OptimizedImage {
  image: RgbaImage;
  bounds: AlphaBounds;
  hash: string;
  bytes: Buffer;
}

export function resizeRgbaImage(source: RgbaImage, width: number, height: number): RgbaImage {
  const targetWidth = Math.max(1, Math.round(width));
  const targetHeight = Math.max(1, Math.round(height));
  if (source.width === targetWidth && source.height === targetHeight) return source;
  const output = createTransparentImage(targetWidth, targetHeight);
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(source.height - 1, Math.floor(((y + 0.5) * source.height) / targetHeight));
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor(((x + 0.5) * source.width) / targetWidth));
      const sourceOffset = (sourceY * source.width + sourceX) * 4;
      const targetOffset = (y * targetWidth + x) * 4;
      output.pixels[targetOffset] = source.pixels[sourceOffset];
      output.pixels[targetOffset + 1] = source.pixels[sourceOffset + 1];
      output.pixels[targetOffset + 2] = source.pixels[sourceOffset + 2];
      output.pixels[targetOffset + 3] = source.pixels[sourceOffset + 3];
    }
  }
  return output;
}

export function measureAlphaBounds(image: RgbaImage): AlphaBounds | undefined {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  let visiblePixels = 0;
  let alphaSum = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.pixels[(y * image.width + x) * 4 + 3];
      if (alpha === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      visiblePixels += 1;
      alphaSum += alpha;
    }
  }
  if (maxX < minX || maxY < minY) return undefined;
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    visiblePixels,
    alphaSum
  };
}

export function cropRgbaImage(image: RgbaImage, bounds: AlphaBounds): RgbaImage {
  const output = createTransparentImage(bounds.width, bounds.height);
  for (let y = 0; y < bounds.height; y += 1) {
    for (let x = 0; x < bounds.width; x += 1) {
      const sourceOffset = ((bounds.y + y) * image.width + bounds.x + x) * 4;
      const targetOffset = (y * bounds.width + x) * 4;
      output.pixels[targetOffset] = image.pixels[sourceOffset];
      output.pixels[targetOffset + 1] = image.pixels[sourceOffset + 1];
      output.pixels[targetOffset + 2] = image.pixels[sourceOffset + 2];
      output.pixels[targetOffset + 3] = image.pixels[sourceOffset + 3];
    }
  }
  return output;
}

export function optimizeRgbaImage(image: RgbaImage): OptimizedImage | undefined {
  const bounds = measureAlphaBounds(image);
  if (!bounds) return undefined;
  const cropped = cropRgbaImage(image, bounds);
  const bytes = encodeRgbaPng(cropped);
  return {
    image: cropped,
    bounds,
    hash: createHash("sha256").update(bytes).digest("hex"),
    bytes
  };
}

export async function inspectPng(filePath: string): Promise<{
  source: string;
  width: number;
  height: number;
  decodedBytes: number;
}> {
  const image = decodeRgbaPng(await readFile(filePath));
  return {
    source: filePath.split(path.sep).join("/"),
    width: image.width,
    height: image.height,
    decodedBytes: image.width * image.height * 4
  };
}
