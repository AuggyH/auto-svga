import path from "node:path";
import type { AvatarFrameProject } from "../types/project.js";
import { ensureDir } from "../utils/fs.js";
import { nearestPaletteIndex, writeGif, type GifFrame } from "./gif-encoder.js";

export async function renderPreviewGif(project: AvatarFrameProject, outputDir: string): Promise<string> {
  await ensureDir(outputDir);
  const width = Math.min(256, project.canvas.width);
  const height = Math.min(256, project.canvas.height);
  const frameTotal = Math.min(24, Math.max(12, Math.round(project.timeline.frameCount / 2)));
  const delayCs = Math.max(3, Math.round(100 / project.canvas.fps));
  const frames: GifFrame[] = [];

  for (let frameIndex = 0; frameIndex < frameTotal; frameIndex += 1) {
    const progress = frameIndex / frameTotal;
    frames.push({
      width,
      height,
      delayCs,
      pixels: drawPreviewFrame(width, height, progress)
    });
  }

  const previewPath = path.join(outputDir, "preview.gif");
  await writeGif(previewPath, frames);
  return previewPath;
}

function drawPreviewFrame(width: number, height: number, progress: number): Uint8Array {
  const pixels = new Uint8Array(width * height);
  const centerX = width / 2;
  const centerY = height / 2;
  const outerRadius = Math.min(width, height) * 0.43;
  const innerRadius = Math.min(width, height) * 0.32;
  const glow = 0.5 + Math.sin(progress * Math.PI * 2) * 0.5;
  const sweepAngle = progress * Math.PI * 2 - Math.PI / 4;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const ring = distance > innerRadius && distance < outerRadius;
      const glowRing = distance > outerRadius && distance < outerRadius + 9;
      let color = 1;

      if (glowRing) {
        color = glow > 0.55 ? 4 : 3;
      }

      if (ring) {
        color = distance > outerRadius - 5 ? 4 : 2;
        const angleDistance = Math.abs(Math.atan2(Math.sin(angle - sweepAngle), Math.cos(angle - sweepAngle)));
        if (angleDistance < 0.24) {
          color = 5;
        }
      }

      const gem = gemColor(x, y, progress, width, height);
      if (gem !== undefined) {
        color = gem;
      }

      pixels[y * width + x] = color;
    }
  }

  return pixels;
}

function gemColor(x: number, y: number, progress: number, width: number, height: number): number | undefined {
  const points = [
    { x: width * 0.74, y: height * 0.18, offset: 0 },
    { x: width * 0.84, y: height * 0.62, offset: 0.34 },
    { x: width * 0.2, y: height * 0.7, offset: 0.68 }
  ];

  for (const point of points) {
    const pulse = 0.5 + Math.sin((progress + point.offset) * Math.PI * 2) * 0.5;
    const dx = x - point.x;
    const dy = y - point.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 3 + pulse * 3) {
      return pulse > 0.7 ? 6 : 7;
    }
  }

  return undefined;
}

export function colorToPaletteIndex(hex: string): number {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return nearestPaletteIndex(r, g, b);
}
