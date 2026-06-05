import type { MotionEffect, MotionPlan, MotionTemplateId, MvpConfig, MvpPart, MvpStructure } from "./types.js";

export function planMotions(config: MvpConfig, structure: MvpStructure): MotionPlan {
  const effects: MotionEffect[] = [];
  const wingEffectByPart = new Map<string, string>();

  for (const part of structure.parts) {
    if (allows(part, "wing_flap") && part.type === "wing") {
      const mirrorOf = part.symmetryPair ? wingEffectByPart.get(part.symmetryPair) : undefined;
      const effect = createEffect(part, "wing_flap", 0.35, config.durationMs, mirrorOf);
      effects.push(effect);
      wingEffectByPart.set(part.id, effect.id);
    }
    if (allows(part, "gem_twinkle") && part.type === "gem") {
      effects.push(createEffect(part, "gem_twinkle", 0.55, Math.min(1600, config.durationMs)));
    }
    if (allows(part, "frame_breath") && part.type === "base_frame") {
      effects.push(createEffect(part, "frame_breath", 0.25, config.durationMs));
    }
    if (allows(part, "metal_sweep") && part.type === "base_frame") {
      effects.push(createEffect(part, "metal_sweep", 0.45, Math.min(2200, config.durationMs)));
    }
  }

  return {
    assetType: "avatar_frame",
    motionStyle: "luxury_subtle_loop",
    durationMs: config.durationMs,
    fps: config.fps,
    rules: {
      protectSafeArea: true,
      avoidLargeMotion: true,
      loopSeamless: true,
      smallSizeReadable: true
    },
    effects
  };
}

function createEffect(
  part: MvpPart,
  template: MotionTemplateId,
  intensity: number,
  durationMs: number,
  mirrorOf?: string
): MotionEffect {
  return {
    id: `${part.id}_${effectSuffix(template)}`,
    template,
    target: part.id,
    intensity,
    durationMs,
    ...(mirrorOf ? { mirrorOf } : {})
  };
}

function effectSuffix(template: MotionTemplateId): string {
  switch (template) {
    case "wing_flap":
      return "flap";
    case "gem_twinkle":
      return "twinkle";
    case "frame_breath":
      return "breath";
    case "metal_sweep":
      return "sweep";
    case "pop_settle":
      return "pop_settle";
  }
}

function allows(part: MvpPart, template: MotionTemplateId): boolean {
  return Array.isArray(part.motionAllowed) && part.motionAllowed.includes(template);
}
