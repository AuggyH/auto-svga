import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { ProjectAsset } from "../types/project.js";
import { sha256 } from "../utils/hash.js";
import { createTransparentImage, setPixel, writeRgbaPng, type RgbaImage } from "../utils/png-writer.js";
import type { LoadedAsset } from "./asset-loader.js";
import { copyGeneratedAssets } from "./asset-loader.js";

export interface GeneratedAssetResult {
  assets: ProjectAsset[];
  files: Array<{
    id: string;
    path: string;
    sizeBytes: number;
  }>;
}

export async function generateAvatarFrameAssets(
  sourceAsset: LoadedAsset,
  outputAssetsDir: string,
  canvas: { width: number; height: number }
): Promise<GeneratedAssetResult> {
  await mkdir(outputAssetsDir, { recursive: true });

  const files: GeneratedAssetResult["files"] = [];
  const assets: ProjectAsset[] = [];
  const framePath = await copyGeneratedAssets(sourceAsset, outputAssetsDir);
  const frameBuffer = await readFile(framePath);
  files.push({ id: "frame", path: framePath, sizeBytes: (await stat(framePath)).size });
  assets.push({
    id: "frame",
    type: "image",
    path: "assets/frame.png",
    width: sourceAsset.width,
    height: sourceAsset.height,
    sha256: sha256(frameBuffer),
    generated: false
  });

  const sweepCore = createSweep(canvas.width, canvas.height, 1);
  const sweepSoft = createSweep(canvas.width, canvas.height, 0.45);
  const generatedSpecs = [
    { id: "outer_glow", fileName: "outer_glow.png", image: createOuterGlow(canvas.width, canvas.height) },
    { id: "sweep_core", fileName: "sweep_core.png", image: sweepCore },
    { id: "sweep_soft", fileName: "sweep_soft.png", image: sweepSoft },
    { id: "gem_glint", fileName: "gem_glint.png", image: createGemGlint(48, 48) }
  ];

  for (const spec of generatedSpecs) {
    const targetPath = path.join(outputAssetsDir, spec.fileName);
    await writeRgbaPng(targetPath, spec.image);
    const buffer = await readFile(targetPath);
    const sizeBytes = (await stat(targetPath)).size;
    files.push({ id: spec.id, path: targetPath, sizeBytes });
    assets.push({
      id: spec.id,
      type: "image",
      path: `assets/${spec.fileName}`,
      width: spec.image.width,
      height: spec.image.height,
      sha256: sha256(buffer),
      generated: true
    });
  }

  return { assets, files };
}

function createOuterGlow(width: number, height: number): RgbaImage {
  const image = createTransparentImage(width, height);
  const cx = width / 2;
  const cy = height / 2;
  const inner = Math.min(width, height) * 0.36;
  const outer = Math.min(width, height) * 0.48;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const distance = Math.hypot(x - cx, y - cy);
      if (distance < inner || distance > outer) {
        continue;
      }
      const t = 1 - Math.abs(distance - (inner + outer) / 2) / ((outer - inner) / 2);
      setPixel(image, x, y, [191, 223, 255, Math.round(160 * Math.max(0, t))]);
    }
  }

  return image;
}

function createSweep(width: number, height: number, opacity: number): RgbaImage {
  const image = createTransparentImage(width, height);
  const centerX = width / 2;
  const slope = 0.36;
  const bandWidth = Math.max(5, width * 0.035);
  const softWidth = Math.max(bandWidth * 3, width * 0.12);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const bandCenter = centerX + (y - height / 2) * slope;
      const distance = Math.abs(x - bandCenter);
      if (distance > softWidth) {
        continue;
      }
      const core = Math.max(0, 1 - distance / bandWidth);
      const soft = Math.max(0, 1 - distance / softWidth) * 0.45;
      setPixel(image, x, y, [255, 236, 178, Math.round(220 * opacity * Math.max(core, soft))]);
    }
  }

  return image;
}

function createGemGlint(width: number, height: number): RgbaImage {
  const image = createTransparentImage(width, height);
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      const star = Math.max(0, 1 - Math.min(dx, dy) / 3) * Math.max(0, 1 - Math.max(dx, dy) / 20);
      const core = Math.max(0, 1 - Math.hypot(x - cx, y - cy) / 10);
      const alpha = Math.round(Math.max(star, core) * 230);
      if (alpha > 0) {
        setPixel(image, x, y, [255, 255, 255, alpha]);
      }
    }
  }

  return image;
}
