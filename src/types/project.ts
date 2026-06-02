import type { AssetType, TemplateId } from "./config.js";

export interface AvatarFrameProject {
  schemaVersion: "0.1.0";
  assetType: AssetType;
  name: string;
  canvas: {
    width: number;
    height: number;
    fps: number;
    durationMs: number;
  };
  assets: ProjectAsset[];
  layers: ProjectLayer[];
  timeline: {
    frameCount: number;
    loop: true;
  };
  metadata: {
    generatedAt: string;
    templates: Array<{
      id: TemplateId;
      description: string;
      params: Record<string, unknown>;
    }>;
  };
}

export interface ProjectAsset {
  id: string;
  type: "image";
  path: string;
  width: number;
  height: number;
  sha256: string;
}

export interface ProjectLayer {
  id: string;
  type: "image" | "effect";
  assetId?: string;
  blendMode: "normal" | "screen" | "add";
  keyframes: Keyframe[];
}

export interface Keyframe {
  timeMs: number;
  props: Record<string, unknown>;
  easing?: "linear" | "easeInOut" | "easeOut";
}
