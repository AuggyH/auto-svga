import type { AssetConfig } from "../types/config.js";
import type { AvatarFrameProject, ProjectAsset } from "../types/project.js";
import { createBaseFrameLayer, type TemplateExpansion } from "./template-engine.js";

export function buildProject(
  config: AssetConfig,
  assets: ProjectAsset[],
  expansions: TemplateExpansion[]
): AvatarFrameProject {
  const durationFrames = durationFramesFor(config);

  return {
    schemaVersion: "0.4.0",
    version: "0.4.0",
    projectId: config.name,
    assetType: "avatar_frame",
    canvas: {
      width: config.canvas.width,
      height: config.canvas.height
    },
    fps: config.canvas.fps,
    durationFrames,
    loop: true,
    assets,
    layers: [
      createBaseFrameLayer(config.canvas, assets.find((asset) => asset.id === "frame") ?? { width: config.canvas.width, height: config.canvas.height }),
      ...expansions.flatMap((expansion) => expansion.layers)
    ].sort((a, b) => a.zIndex - b.zIndex),
    animations: expansions.flatMap((expansion) => expansion.animations),
    export: {
      format: "intermediate-json",
      exporter: "json-exporter",
      svgaExporter: {
        status: "stub",
        notes: "Real SVGA binary export is intentionally not implemented in the MVP."
      }
    }
  };
}

function durationFramesFor(config: AssetConfig): number {
  if (Number.isInteger(config.canvas.durationFrames)) {
    return Number(config.canvas.durationFrames);
  }
  if (typeof config.canvas.durationSeconds === "number") {
    return Math.round(config.canvas.durationSeconds * config.canvas.fps);
  }
  return Math.round((Number(config.canvas.durationMs) / 1000) * config.canvas.fps);
}
