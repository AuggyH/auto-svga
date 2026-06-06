import { applyEasing } from "./easing.js";
import type { MvpKeyframe, MvpProjectLayer } from "./types.js";

export type InterpolatedProperty = "x" | "y" | "scaleX" | "scaleY" | "rotation" | "alpha";

export interface MvpInterpolatedTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  alpha: number;
}

export function interpolateLayerAtFrame(layer: MvpProjectLayer, frame: number): MvpInterpolatedTransform {
  const [defaultX = 0, defaultY = 0] = layer.bbox ?? [0, 0, 0, 0];
  return {
    x: interpolateProperty(layer.keyframes, "x", frame, defaultX),
    y: interpolateProperty(layer.keyframes, "y", frame, defaultY),
    scaleX: interpolateProperty(layer.keyframes, "scaleX", frame, 1),
    scaleY: interpolateProperty(layer.keyframes, "scaleY", frame, 1),
    rotation: interpolateProperty(layer.keyframes, "rotation", frame, 0),
    alpha: interpolateProperty(layer.keyframes, "alpha", frame, 1)
  };
}

export function interpolateProperty(
  keyframes: MvpKeyframe[],
  key: InterpolatedProperty,
  frame: number,
  fallback: number
): number {
  const points = keyframes
    .filter((keyframe) => typeof keyframe[key] === "number")
    .sort((a, b) => a.frame - b.frame);
  if (points.length === 0) return fallback;
  if (frame <= points[0].frame) return Number(points[0][key]);
  if (frame >= points[points.length - 1].frame) return Number(points[points.length - 1][key]);

  const nextIndex = points.findIndex((point) => point.frame >= frame);
  const previous = points[nextIndex - 1];
  const next = points[nextIndex];
  const progress = (frame - previous.frame) / Math.max(1, next.frame - previous.frame);
  const easedProgress = applyEasing(next.easing, progress);
  return Number(previous[key]) + (Number(next[key]) - Number(previous[key])) * easedProgress;
}
