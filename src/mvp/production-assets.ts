import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { decodeRgbaPng } from "../utils/png-reader.js";
import { ensureDir } from "../utils/fs.js";
import { optimizeRgbaImage, resizeRgbaImage } from "./image-optimization.js";
import type { MvpConfig, MvpPart, MvpStructure } from "./types.js";

export interface ProductionAssetResult {
  structure: MvpStructure;
  generated: string[];
  warnings: string[];
}

export async function prepareMvpProductionAssets(
  jobDir: string,
  config: MvpConfig,
  structure: MvpStructure
): Promise<ProductionAssetResult> {
  const sourceCanvas = structure.sourceCanvas ?? config.sourceCanvas ?? structure.canvas;
  const scaleX = config.canvas.width / sourceCanvas.width;
  const scaleY = config.canvas.height / sourceCanvas.height;
  const outputDir = path.join(jobDir, "generated", "optimized");
  await rm(outputDir, { recursive: true, force: true });
  await ensureDir(outputDir);
  const generated: string[] = [];
  const warnings: string[] = [];
  const parts: MvpPart[] = [];

  for (const part of structure.parts) {
    const sourcePath = path.join(jobDir, part.source);
    try {
      const sourceImage = decodeRgbaPng(await readFile(sourcePath));
      const resized = resizeRgbaImage(
        sourceImage,
        Math.max(1, Math.round(sourceImage.width * scaleX)),
        Math.max(1, Math.round(sourceImage.height * scaleY))
      );
      const optimized = optimizeRgbaImage(resized);
      if (!optimized) {
        warnings.push(`Part ${part.id} is fully transparent after production scaling and was skipped.`);
        continue;
      }
      const relativeSource = `generated/optimized/${part.id}.png`;
      const outputPath = path.join(jobDir, relativeSource);
      await writeFile(outputPath, optimized.bytes);
      generated.push(outputPath);
      const originX = Math.round(part.bbox[0] * (structure.canvas.width === sourceCanvas.width ? scaleX : 1));
      const originY = Math.round(part.bbox[1] * (structure.canvas.height === sourceCanvas.height ? scaleY : 1));
      const trimmedX = originX + optimized.bounds.x;
      const trimmedY = originY + optimized.bounds.y;
      parts.push({
        ...part,
        source: relativeSource,
        originalSource: part.originalSource ?? part.source,
        bbox: [
          trimmedX,
          trimmedY,
          trimmedX + optimized.image.width,
          trimmedY + optimized.image.height
        ],
        anchor: {
          ...part.anchor,
          x: part.anchor.x * (structure.canvas.width === sourceCanvas.width ? scaleX : 1),
          y: part.anchor.y * (structure.canvas.height === sourceCanvas.height ? scaleY : 1)
        },
        layerMode: "cropped",
        trimmedBbox: [optimized.bounds.x, optimized.bounds.y, optimized.bounds.width, optimized.bounds.height],
        decodedBytes: optimized.image.width * optimized.image.height * 4
      });
    } catch (error) {
      warnings.push(`Part ${part.id} could not be optimized: ${String(error)}`);
      parts.push(part);
    }
  }

  const coordinatesNeedScaling = structure.canvas.width === sourceCanvas.width
    && structure.canvas.height === sourceCanvas.height;
  return {
    structure: {
      ...structure,
      sourceCanvas,
      canvas: { ...config.canvas },
      safeArea: {
        ...structure.safeArea,
        centerX: structure.safeArea.centerX * (coordinatesNeedScaling ? scaleX : 1),
        centerY: structure.safeArea.centerY * (coordinatesNeedScaling ? scaleY : 1),
        radius: structure.safeArea.radius * (coordinatesNeedScaling ? Math.min(scaleX, scaleY) : 1)
      },
      parts
    },
    generated,
    warnings
  };
}
