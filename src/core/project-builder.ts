import path from "node:path";
import type { AssetConfig } from "../types/config.js";
import type { AvatarFrameProject, ProjectAsset, ProjectLayer } from "../types/project.js";
import type { LoadedAsset } from "./asset-loader.js";
import type { AppliedTemplate } from "./template-engine.js";

export function buildProject(config: AssetConfig, asset: LoadedAsset, templates: AppliedTemplate[]): AvatarFrameProject {
  const frameCount = Math.round((config.canvas.durationMs / 1000) * config.canvas.fps);
  const layers: ProjectLayer[] = [
    {
      id: "frame.base",
      type: "image",
      assetId: "frame",
      blendMode: "normal",
      keyframes: [
        {
          timeMs: 0,
          props: {
            alpha: 1,
            x: 0,
            y: 0,
            scale: 1
          }
        }
      ]
    },
    ...templates.flatMap((template) => template.layers)
  ];

  const assets: ProjectAsset[] = [
    {
      id: "frame",
      type: "image",
      path: path.posix.join("assets", asset.outputFileName),
      width: asset.width,
      height: asset.height,
      sha256: asset.sha256
    }
  ];

  return {
    schemaVersion: "0.1.0",
    assetType: "avatar_frame",
    name: config.name,
    canvas: config.canvas,
    assets,
    layers,
    timeline: {
      frameCount,
      loop: true
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      templates: templates.map((template) => ({
        id: template.id,
        description: template.description,
        params: template.params
      }))
    }
  };
}
