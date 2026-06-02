import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AssetConfig, TemplateConfig, TemplateDefinition, TemplateId } from "../types/config.js";
import type { ProjectLayer } from "../types/project.js";
import { readJsonFile } from "../utils/fs.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const templatesRoot = path.resolve(currentDir, "../../templates/avatar_frame");

export interface AppliedTemplate {
  id: TemplateId;
  description: string;
  params: Record<string, unknown>;
  layers: ProjectLayer[];
}

export async function applyTemplates(config: AssetConfig): Promise<AppliedTemplate[]> {
  const enabledTemplates = config.templates.filter((template) => template.enabled !== false);
  const applied: AppliedTemplate[] = [];

  for (const template of enabledTemplates) {
    const definition = await loadTemplateDefinition(template.id);
    const params = mergeTemplateParams(definition, template);
    applied.push({
      id: template.id,
      description: definition.description,
      params,
      layers: createLayersForTemplate(template.id, config, params)
    });
  }

  return applied;
}

export async function loadTemplateDefinition(id: TemplateId): Promise<TemplateDefinition> {
  return readJsonFile<TemplateDefinition>(path.join(templatesRoot, `${id}.template.json`));
}

function mergeTemplateParams(definition: TemplateDefinition, template: TemplateConfig): Record<string, unknown> {
  const defaults = Object.fromEntries(definition.parameters.map((parameter) => [parameter.name, parameter.default]));
  return { ...defaults, ...(template.params ?? {}) };
}

function createLayersForTemplate(
  id: TemplateId,
  config: AssetConfig,
  params: Record<string, unknown>
): ProjectLayer[] {
  switch (id) {
    case "breathing_glow":
      return [createBreathingGlowLayer(config, params)];
    case "metal_edge_sweep":
      return [createMetalEdgeSweepLayer(config, params)];
    case "gem_twinkle":
      return [createGemTwinkleLayer(config, params)];
  }
}

function createBreathingGlowLayer(config: AssetConfig, params: Record<string, unknown>): ProjectLayer {
  const duration = config.canvas.durationMs;
  return {
    id: "effect.breathing_glow",
    type: "effect",
    blendMode: "screen",
    keyframes: [
      { timeMs: 0, easing: "easeInOut", props: { alpha: params.minAlpha, scale: 1, color: params.color } },
      { timeMs: Math.round(duration / 2), easing: "easeInOut", props: { alpha: params.maxAlpha, scale: params.scale, color: params.color } },
      { timeMs: duration, easing: "easeInOut", props: { alpha: params.minAlpha, scale: 1, color: params.color } }
    ]
  };
}

function createMetalEdgeSweepLayer(config: AssetConfig, params: Record<string, unknown>): ProjectLayer {
  const duration = config.canvas.durationMs;
  const startAngle = Number(params.startAngle);
  return {
    id: "effect.metal_edge_sweep",
    type: "effect",
    blendMode: "add",
    keyframes: [
      { timeMs: 0, easing: "linear", props: { angle: startAngle, alpha: 0, width: params.width, color: params.color } },
      { timeMs: Math.round(duration * 0.18), easing: "linear", props: { angle: startAngle + 70, alpha: params.intensity, width: params.width, color: params.color } },
      { timeMs: Math.round(duration * 0.72), easing: "linear", props: { angle: startAngle + 300, alpha: params.intensity, width: params.width, color: params.color } },
      { timeMs: duration, easing: "linear", props: { angle: startAngle + 360, alpha: 0, width: params.width, color: params.color } }
    ]
  };
}

function createGemTwinkleLayer(config: AssetConfig, params: Record<string, unknown>): ProjectLayer {
  const duration = config.canvas.durationMs;
  const count = Math.max(1, Math.min(6, Math.round(Number(params.count))));
  const points = createGemPoints(count, config.canvas.width, config.canvas.height);

  return {
    id: "effect.gem_twinkle",
    type: "effect",
    blendMode: "add",
    keyframes: points.flatMap((point, index) => {
      const offset = Math.round((duration / count) * index);
      const peak = Math.min(duration, offset + Math.round(duration * 0.12));
      const end = Math.min(duration, offset + Math.round(duration * 0.24));
      return [
        { timeMs: offset, easing: "easeOut" as const, props: { point, alpha: 0, radius: params.radius, color: params.color } },
        { timeMs: peak, easing: "easeOut" as const, props: { point, alpha: params.intensity, radius: params.radius, color: params.color } },
        { timeMs: end, easing: "easeOut" as const, props: { point, alpha: 0, radius: params.radius, color: params.color } }
      ];
    })
  };
}

function createGemPoints(count: number, width: number, height: number): Array<{ x: number; y: number }> {
  const centerX = width / 2;
  const centerY = height / 2;
  const radiusX = width * 0.42;
  const radiusY = height * 0.42;
  const angles = [-55, 35, 145, 220, 285, 95];

  return angles.slice(0, count).map((angle) => {
    const radians = (angle / 180) * Math.PI;
    return {
      x: Math.round(centerX + Math.cos(radians) * radiusX),
      y: Math.round(centerY + Math.sin(radians) * radiusY)
    };
  });
}
