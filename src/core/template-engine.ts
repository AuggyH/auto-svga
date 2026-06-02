import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AssetConfig, TemplateConfig, TemplateDefinition, TemplateId } from "../types/config.js";
import type { ProjectAnimation, ProjectLayer } from "../types/project.js";
import { readJsonFile } from "../utils/fs.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const templatesRoot = path.resolve(currentDir, "../../templates/avatar_frame");

export interface TemplateExpansion {
  templateId: TemplateId;
  description: string;
  params: Record<string, unknown>;
  layers: ProjectLayer[];
  animations: ProjectAnimation[];
}

export async function expandTemplates(config: AssetConfig): Promise<TemplateExpansion[]> {
  const enabledTemplates = config.templates.filter((template) => template.enabled !== false);
  const expansions: TemplateExpansion[] = [];

  for (const template of enabledTemplates) {
    const definition = await loadTemplateDefinition(template.id);
    const params = mergeTemplateParams(definition, template);
    expansions.push(expandTemplate(template.id, config, definition.description, params));
  }

  return expansions;
}

export async function loadTemplateDefinition(id: TemplateId): Promise<TemplateDefinition> {
  return readJsonFile<TemplateDefinition>(path.join(templatesRoot, `${id}.template.json`));
}

function expandTemplate(
  templateId: TemplateId,
  config: AssetConfig,
  description: string,
  params: Record<string, unknown>
): TemplateExpansion {
  switch (templateId) {
    case "breathing_glow":
      return expandBreathingGlow(config, description, params);
    case "metal_edge_sweep":
      return expandMetalEdgeSweep(config, description, params);
    case "gem_twinkle":
      return expandGemTwinkle(config, description, params);
  }
}

function mergeTemplateParams(definition: TemplateDefinition, template: TemplateConfig): Record<string, unknown> {
  const defaults = Object.fromEntries(definition.parameters.map((parameter) => [parameter.name, parameter.default]));
  return { ...defaults, ...(template.params ?? {}) };
}

function expandBreathingGlow(config: AssetConfig, description: string, params: Record<string, unknown>): TemplateExpansion {
  const durationFrames = durationFramesFor(config);
  const minOpacity = Number(params.minAlpha);
  const maxOpacity = Number(params.maxAlpha);
  const scale = Number(params.scale);
  const layer = createLayer("outer_glow", "outer_glow", 10, "screen", config.canvas.width, config.canvas.height, {
    x: config.canvas.width / 2,
    y: config.canvas.height / 2,
    opacity: minOpacity
  });

  return {
    templateId: "breathing_glow",
    description,
    params,
    layers: [layer],
    animations: [
      {
        id: "anim_outer_glow_breathing",
        templateId: "breathing_glow",
        targetLayerId: "outer_glow",
        easing: "easeInOut",
        keyframes: [
          { frame: 0, scaleX: 1, scaleY: 1, opacity: minOpacity },
          { frame: Math.round(durationFrames / 2), scaleX: scale, scaleY: scale, opacity: maxOpacity },
          { frame: durationFrames - 1, scaleX: 1, scaleY: 1, opacity: minOpacity }
        ]
      }
    ]
  };
}

function expandMetalEdgeSweep(config: AssetConfig, description: string, params: Record<string, unknown>): TemplateExpansion {
  const durationFrames = durationFramesFor(config);
  const intensity = Number(params.intensity);
  const sweepRotation = -20;
  const sweepPath = createSweepPath(config.canvas.width, config.canvas.height, durationFrames, sweepRotation, intensity);
  const core = createLayer("sweep_core", "sweep_core", 30, "add", config.canvas.width, config.canvas.height, {
    x: sweepPath[0].x,
    y: sweepPath[0].y,
    rotation: sweepRotation,
    opacity: 0
  });
  const soft = createLayer("sweep_soft", "sweep_soft", 20, "screen", config.canvas.width, config.canvas.height, {
    x: sweepPath[0].x,
    y: sweepPath[0].y,
    rotation: sweepRotation,
    opacity: 0
  });
  core.mask = { type: "alpha", sourceLayerId: "frame_base" };
  soft.mask = { type: "alpha", sourceLayerId: "frame_base" };

  return {
    templateId: "metal_edge_sweep",
    description,
    params,
    layers: [soft, core],
    animations: [
      {
        id: "anim_sweep_core",
        templateId: "metal_edge_sweep",
        targetLayerId: "sweep_core",
        easing: "linear",
        keyframes: sweepPath
      },
      {
        id: "anim_sweep_soft",
        templateId: "metal_edge_sweep",
        targetLayerId: "sweep_soft",
        easing: "linear",
        keyframes: sweepPath.map((keyframe) => ({
          ...keyframe,
          opacity: typeof keyframe.opacity === "number" ? keyframe.opacity * 0.65 : keyframe.opacity
        }))
      }
    ]
  };
}

function expandGemTwinkle(config: AssetConfig, description: string, params: Record<string, unknown>): TemplateExpansion {
  const durationFrames = durationFramesFor(config);
  const intensity = Number(params.intensity);
  const points = config.gemGlints ?? [];

  const layers = points.map((point, index) =>
    createLayer(`gem_glint_${point.id}`, "gem_glint", 40 + index, "add", 48, 48, {
      x: Math.round(point.x),
      y: Math.round(point.y),
      opacity: 0
    })
  );

  return {
    templateId: "gem_twinkle",
    description,
    params,
    layers,
    animations: points.map((point) => {
      const start = Math.min(durationFrames - 1, point.delayFrame);
      const peak = Math.min(durationFrames - 1, start + Math.round(durationFrames * 0.1));
      const end = Math.min(durationFrames - 1, start + Math.round(durationFrames * 0.2));
      return {
        id: `anim_gem_glint_${point.id}`,
        templateId: "gem_twinkle",
        targetLayerId: `gem_glint_${point.id}`,
        easing: "easeOut",
        keyframes: [
          { frame: start, scaleX: 0.72, scaleY: 0.72, rotation: 0, opacity: 0 },
          { frame: peak, scaleX: 1.1, scaleY: 1.1, rotation: 12, opacity: intensity },
          { frame: end, scaleX: 0.84, scaleY: 0.84, rotation: 24, opacity: 0 }
        ]
      };
    })
  };
}

function createSweepPath(
  canvasWidth: number,
  canvasHeight: number,
  durationFrames: number,
  rotation: number,
  peakOpacity: number
): Array<{ frame: number; x: number; y: number; rotation: number; opacity: number }> {
  const lastFrame = durationFrames - 1;
  const frames = durationFrames === 72
    ? [12, 20, 40, 48]
    : [
      Math.min(lastFrame, Math.round(durationFrames * (12 / 72))),
      Math.min(lastFrame, Math.round(durationFrames * (20 / 72))),
      Math.min(lastFrame, Math.round(durationFrames * (40 / 72))),
      Math.min(lastFrame, Math.round(durationFrames * (48 / 72)))
    ];
  const y = Math.round(canvasHeight * 0);
  const centerY = Math.round(canvasHeight / 2);

  return [
    { frame: frames[0], x: Math.round(-canvasWidth * 0.75), y: centerY + y, rotation, opacity: 0 },
    { frame: frames[1], x: Math.round(-canvasWidth * 0.25), y: centerY + y, rotation, opacity: peakOpacity },
    { frame: frames[2], x: Math.round(canvasWidth * 0.45), y: centerY + y, rotation, opacity: peakOpacity },
    { frame: frames[3], x: Math.round(canvasWidth * 0.85), y: centerY + y, rotation, opacity: 0 }
  ];
}

export function createBaseFrameLayer(
  canvas: { width: number; height: number },
  asset: { width: number; height: number }
): ProjectLayer {
  return createLayer("frame_base", "frame", 0, "normal", asset.width, asset.height, {
    x: canvas.width / 2,
    y: canvas.height / 2
  });
}

function createLayer(
  id: string,
  assetId: string,
  zIndex: number,
  blendMode: ProjectLayer["blendMode"],
  width: number,
  height: number,
  transform: Partial<ProjectLayer["transform"]> = {}
): ProjectLayer {
  return {
    id,
    type: "image",
    assetId,
    zIndex,
    visible: true,
    blendMode,
    fallbackBlendMode: "normal",
    fallbackOpacityMultiplier: fallbackOpacityMultiplierFor(blendMode),
    anchor: {
      x: width / 2,
      y: height / 2
    },
    transform: {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
      ...transform
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

function fallbackOpacityMultiplierFor(blendMode: ProjectLayer["blendMode"]): number {
  if (blendMode === "add") {
    return 0.65;
  }
  if (blendMode === "screen") {
    return 0.75;
  }
  return 1;
}
