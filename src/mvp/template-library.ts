import { convertCanvasAnchorToLocal } from "./anchor.js";
import { bakedFrameVisibilityKeyframes, sampledSweepFrames, sweepBakedFramePath, sweepFrameStride } from "./sweep-mask.js";
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
    generatedAssets: ["generated/glow_dot.png"],
    expand: (effect, part, context) => [
      createPartLayer(part, effect.id, gemTwinkleKeyframes(context.frames)),
      createGemGlintLayer(effect, part, context.frames, context.config.canvas.width)
    ]
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
      bbox: part.bbox,
      sourcePart: part.id,
      originalSource: part.originalSource ?? part.source,
      anchor: convertCanvasAnchorToLocal(part),
      keyframes: [
        { frame: 0, x: part.bbox[0], y: part.bbox[1], alpha: 0.12 },
        { frame: Math.round(context.frames / 2), x: part.bbox[0], y: part.bbox[1], alpha: 0.28 },
        { frame: context.frames, x: part.bbox[0], y: part.bbox[1], alpha: 0.12 }
      ],
      sourceEffect: effect.id,
      requiredGeneratedAsset: true
    }]
  },
  metal_sweep: {
    id: "metal_sweep",
    supportedPartTypes: ["base_frame", "metal_frame"],
    generatedAssets: ["generated/sweep_baked/*.png"],
    expand: (effect, part, context) => {
      const stride = sweepFrameStride(context.config.sweepFrameStride
        ?? (context.config.sweepQuality === "performance" ? 4 : context.config.sweepQuality === "high" ? 2 : 3));
      return sampledSweepFrames(context.frames, stride).map((frame) => ({
        id: `${part.id}_sweep_baked_${String(frame).padStart(3, "0")}`,
        type: "image" as const,
        source: sweepBakedFramePath(frame),
        role: "effect" as const,
        zIndex: part.zIndex + 2,
        bbox: [0, 0, context.config.canvas.width, context.config.canvas.height] as [number, number, number, number],
        keyframes: bakedFrameVisibilityKeyframes(frame, context.frames, stride),
        sourceEffect: effect.id,
        requiredGeneratedAsset: true,
        frameIndex: frame,
        visibleFrameRange: [frame, Math.min(context.frames - 1, frame + stride - 1)] as [number, number],
        maskSource: part.originalSource ?? part.source,
        maskMode: "baked_sweep_frames" as const
      }));
    }
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
    sourcePart: part.id,
    originalSource: part.originalSource ?? part.source,
    trimmedBbox: part.trimmedBbox,
    decodedBytes: part.decodedBytes,
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
  const amplitude = Math.max(0.1, part.motionProfile?.amplitudeDeg ?? 7.5);
  const phase = Math.max(0, Math.round(part.motionProfile?.phase ?? 0));
  const easing = part.motionProfile?.easing ?? "easeInOutSine";
  const rotations = leftWing
    ? [-amplitude, 0, amplitude, 0, -amplitude]
    : [amplitude, 0, -amplitude, 0, amplitude];
  return frameStops(frames, 4).map((frame, index) => ({
    frame: index === 0 ? 0 : Math.min(frames, frame + phase),
    x,
    y,
    scaleX: 1,
    scaleY: 1,
    rotation: rotations[index],
    alpha: 1,
    easing
  })).filter((keyframe, index, values) => index === 0 || keyframe.frame !== values[index - 1].frame);
}

function createGemGlintLayer(effect: MotionEffect, part: MvpPart, frames: number, canvasWidth: number): MvpProjectLayer {
  const size = Math.max(24, Math.round(canvasWidth * 0.107));
  const x = part.anchor.x - size / 2;
  const y = part.anchor.y - size / 2;
  return {
    id: `${part.id}_glint_layer`,
    type: "image",
    source: "generated/glow_dot.png",
    role: "effect",
    zIndex: part.zIndex + 1,
    bbox: [x, y, x + size, y + size],
    anchor: {
      canvasX: part.anchor.x,
      canvasY: part.anchor.y,
      localX: size / 2,
      localY: size / 2
    },
    keyframes: [
      { frame: 0, x, y, scaleX: 0.72, scaleY: 0.72, rotation: 0, alpha: 0 },
      { frame: Math.min(8, frames), x, y, scaleX: 1.1, scaleY: 1.1, rotation: 22, alpha: 0.85 },
      { frame: Math.min(16, frames), x, y, scaleX: 0.82, scaleY: 0.82, rotation: 45, alpha: 0 },
      { frame: frames, x, y, scaleX: 0.72, scaleY: 0.72, rotation: 0, alpha: 0 }
    ],
    sourceEffect: effect.id,
    requiredGeneratedAsset: true
  };
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
  return (x1 + x2) / 2 < part.anchor.x;
}
