export type AssetType = "avatar_frame";

export type TemplateId = "breathing_glow" | "metal_edge_sweep" | "gem_twinkle";

export interface AssetConfig {
  assetType: AssetType;
  name: string;
  source: {
    framePng: string;
  };
  canvas: {
    width: number;
    height: number;
    fps: number;
    durationFrames?: number;
    durationSeconds?: number;
    durationMs?: number;
  };
  bakedSweep?: {
    enabled?: boolean;
    frameStride?: 1 | 2 | 3;
    skipTransparentFrames?: boolean;
    dedupeIdenticalFrames?: boolean;
  };
  gemGlints?: GemGlintConfig[];
  templates: TemplateConfig[];
}

export interface GemGlintConfig {
  id: string;
  x: number;
  y: number;
  delayFrame: number;
}

export interface TemplateConfig {
  id: TemplateId;
  enabled?: boolean;
  params?: Record<string, unknown>;
}

export interface TemplateDefinition {
  id: TemplateId;
  assetType: AssetType;
  description: string;
  notes?: string;
  defaultDurationMs: number;
  parameters: TemplateParameter[];
}

export interface TemplateParameter {
  name: string;
  type: "number" | "color" | "string";
  default: string | number;
  description: string;
}
