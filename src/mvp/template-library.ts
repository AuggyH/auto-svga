import { convertCanvasAnchorToLocal } from "./anchor.js";
import type { MotionEffect, MotionTemplateId, MvpConfig, MvpKeyframe, MvpPart, MvpProjectLayer } from "./types.js";

export interface TemplateContext {
  config: MvpConfig;
  frames: number;
}

export interface MotionTemplate {
  id: MotionTemplateId;
  supportedPartTypes: string[];
  requiredAnchorRole?: string;
  generatedAssets?: string[];
  expand: (effect: MotionEffect, part: MvpPart, context: TemplateContext) => MvpProjectLayer[];
}

export const templateLibrary: Record<MotionTemplateId, MotionTemplate> = {
  wing_flap: {
    id: "wing_flap",
    supportedPartTypes: ["wing"],
    requiredAnchorRole: "root_joint",
    expand: (effect, part, context) => [createPartLayer(part, effect.id, wingFlapKeyframes(part, context.frames))]
  },
  gem_twinkle: {
    id: "gem_twinkle",
    supportedPartTypes: ["gem"],
    expand: (effect, part, context) => [createPartLayer(part, effect.id, gemTwinkleKeyframes(context.frames))]
  },
  frame_breath: {
    id: "frame_breath",
    supportedPartTypes: ["base_frame"],
    generatedAssets: ["generated/glow_frame.png"],
    expand: (effect, part, context) => [{
      id: `${part.id}_breath_layer`,
      type: "image",
      source: "generated/glow_frame.png",
      role: "effect_placeholder",
      zIndex: part.zIndex + 1,
      keyframes: [
        { frame: 0, alpha: 0.12 },
        { frame: Math.round(context.frames / 2), alpha: 0.28 },
        { frame: context.frames, alpha: 0.12 }
      ],
      sourceEffect: effect.id,
      requiredGeneratedAsset: true
    }]
  },
  metal_sweep: {
    id: "metal_sweep",
    supportedPartTypes: ["base_frame", "metal_frame"],
    generatedAssets: ["generated/sweep_light.png"],
    expand: (effect, part, context) => [{
      id: `${part.id}_sweep_layer`,
      type: "image",
      source: "generated/sweep_light.png",
      role: "effect",
      zIndex: 20,
      keyframes: [
        { frame: 0, x: -160, y: 0, alpha: 0 },
        { frame: Math.round(context.frames / 3), x: context.config.canvas.width / 2, y: 0, alpha: 0.6 },
        { frame: Math.round((context.frames / 3) * 2), x: context.config.canvas.width + 160, y: 0, alpha: 0 },
        { frame: context.frames, x: -160, y: 0, alpha: 0 }
      ],
      sourceEffect: effect.id,
      requiredGeneratedAsset: true
    }]
  },
  pop_settle: {
    id: "pop_settle",
    supportedPartTypes: ["base_frame", "wing", "gem"],
    expand: () => []
  }
};

export function createStaticPartLayer(part: MvpPart): MvpProjectLayer {
  const [x, y] = part.bbox;
  return {
    id: `${part.id}_layer`,
    type: "image",
    source: part.source,
    role: "part",
    zIndex: part.zIndex,
    bbox: part.bbox,
    anchor: convertCanvasAnchorToLocal(part),
    keyframes: [
      { frame: 0, x, y, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1 }
    ],
    sourceEffect: "static_part"
  };
}

function createPartLayer(part: MvpPart, sourceEffect: string, keyframes: MvpKeyframe[]): MvpProjectLayer {
  return {
    ...createStaticPartLayer(part),
    sourceEffect,
    keyframes
  };
}

function wingFlapKeyframes(part: MvpPart, frames: number): MvpKeyframe[] {
  const [x, y] = part.bbox;
  const leftWing = isLeftWing(part);
  const rotations = leftWing ? [-2, 3, -2, 3, -2] : [2, -3, 2, -3, 2];
  return frameStops(frames, 4).map((frame, index) => ({
    frame,
    x,
    y,
    scaleX: 1,
    scaleY: 1,
    rotation: rotations[index],
    alpha: 1
  }));
}

function gemTwinkleKeyframes(frames: number): MvpKeyframe[] {
  return [
    { frame: 0, alpha: 0.85, scaleX: 1, scaleY: 1 },
    { frame: Math.min(8, frames), alpha: 1, scaleX: 1.08, scaleY: 1.08 },
    { frame: Math.min(16, frames), alpha: 0.75, scaleX: 1, scaleY: 1 },
    { frame: frames, alpha: 0.85, scaleX: 1, scaleY: 1 }
  ];
}

function frameStops(frames: number, divisions: number): number[] {
  return Array.from({ length: divisions + 1 }, (_, index) => Math.round((frames / divisions) * index));
}

function isLeftWing(part: MvpPart): boolean {
  const id = part.id.toLowerCase();
  if (id.includes("left")) return true;
  if (id.includes("right")) return false;
  const [x1, , x2] = part.bbox;
  return (x1 + x2) / 2 < 256;
}
