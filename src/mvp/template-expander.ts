import type { MotionPlan, MvpConfig, MvpProject, MvpProjectLayer, MvpStructure, ValidationIssue } from "./types.js";
import { createStaticPartLayer, templateLibrary } from "./template-library.js";

export interface ExpansionResult {
  project: MvpProject;
  issues: ValidationIssue[];
}

export function expandMotionPlan(config: MvpConfig, structure: MvpStructure, motionPlan: MotionPlan): ExpansionResult {
  const frames = Math.round((config.durationMs / 1000) * config.fps);
  const issues: ValidationIssue[] = [];
  const layersByPart = new Map<string, MvpProjectLayer>();

  for (const part of structure.parts) {
    layersByPart.set(part.id, createStaticPartLayer(part));
  }

  const effectLayers: MvpProjectLayer[] = [];
  for (const effect of motionPlan.effects) {
    const part = structure.parts.find((item) => item.id === effect.target);
    const template = templateLibrary[effect.template];
    if (!part || !template) {
      issues.push({
        level: "error",
        code: "EFFECT_TARGET_INVALID",
        message: `Effect target or template is invalid: ${effect.id}`,
        path: `motion-plan.effects.${effect.id}`
      });
      continue;
    }
    if (!template.supportedPartTypes.includes(part.type)) {
      issues.push({
        level: "error",
        code: "TEMPLATE_PART_TYPE_UNSUPPORTED",
        message: `${template.id} does not support part type ${part.type}.`,
        path: `motion-plan.effects.${effect.id}`
      });
      continue;
    }
    if (template.requiredAnchorRole && part.anchor.role !== template.requiredAnchorRole) {
      issues.push({
        level: "warning",
        code: "TEMPLATE_ANCHOR_ROLE_MISMATCH",
        message: `${template.id} expects anchor.role=${template.requiredAnchorRole}.`,
        path: `input/structure.json.parts.${part.id}.anchor.role`
      });
    }

    const expanded = template.expand(effect, part, { config, frames });
    const replacementPartLayer = expanded.find((layer) => layer.role === "part");
    if (replacementPartLayer) {
      layersByPart.set(part.id, replacementPartLayer);
    }
    effectLayers.push(...expanded.filter((layer) => layer !== replacementPartLayer));
  }

  const requiredSources = [...new Set(effectLayers
    .filter((layer) => layer.requiredGeneratedAsset)
    .map((layer) => layer.source.startsWith("generated/sweep_baked/") ? "generated/sweep_baked/*.png" : layer.source))];
  const warnings = requiredSources.map((source) => `${source} is required but not generated in this stage`);

  return {
    project: {
      version: "0.1.0",
      assetType: "avatar_frame",
      canvas: {
        width: config.canvas.width,
        height: config.canvas.height
      },
      fps: config.fps,
      durationMs: config.durationMs,
      frames,
      sweepFrameStride: config.sweepFrameStride
        ?? (config.sweepQuality === "performance" ? 4 : config.sweepQuality === "high" ? 2 : 3),
      effectResolutionScale: config.effectResolutionScale
        ?? (config.sweepQuality === "performance" ? 0.5 : 1),
      optimizationActions: [],
      layers: [...layersByPart.values(), ...effectLayers].sort((a, b) => a.zIndex - b.zIndex),
      warnings
    },
    issues
  };
}
