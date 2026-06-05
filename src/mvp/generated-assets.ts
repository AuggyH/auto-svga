import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { decodeRgbaPng } from "../utils/png-reader.js";
import { createTransparentImage, setPixel, writeRgbaPng, type RgbaImage } from "../utils/png-writer.js";
import { ensureDir } from "../utils/fs.js";
import type { MvpProject } from "./types.js";

export interface GeneratedAssetResult {
  generated: string[];
  warnings: string[];
}

export async function ensureMvpGeneratedAssets(jobDir: string, project: MvpProject): Promise<GeneratedAssetResult> {
  const generatedDir = path.join(jobDir, "generated");
  await ensureDir(generatedDir);

  const generated: string[] = [];
  const warnings: string[] = [];

  generated.push(...await writeIfMissing(path.join(generatedDir, "sweep_light.png"), () => createSweepLight(project.canvas.width, project.canvas.height)));
  generated.push(...await writeIfMissing(path.join(generatedDir, "glow_frame.png"), async () => createGlowFrame(jobDir, warnings)));
  generated.push(...await writeIfMissing(path.join(generatedDir, "glow_dot.png"), () => createGlowDot(64)));

  for (const layer of project.layers) {
    if (!layer.requiredGeneratedAsset) continue;
    const sourcePath = path.join(jobDir, layer.source);
    if (!await exists(sourcePath)) {
      warnings.push(`Required generated asset is still missing: ${layer.source}`);
    }
  }

  return { generated, warnings };
}

async function writeIfMissing(filePath: string, createImage: () => RgbaImage | Promise<RgbaImage>): Promise<string[]> {
  if (await exists(filePath)) {
    return [];
  }
  await writeRgbaPng(filePath, await createImage());
  return [filePath];
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

async function createGlowFrame(jobDir: string, warnings: string[]): Promise<RgbaImage> {
  const basePath = path.join(jobDir, "input", "base_frame.png");
  if (!await exists(basePath)) {
    warnings.push("input/base_frame.png is missing; generated/glow_frame.png uses transparent placeholder.");
    return createTransparentImage(512, 512);
  }

  const base = decodeRgbaPng(await readFile(basePath));
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
