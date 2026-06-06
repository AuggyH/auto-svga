import type { MvpKeyframe } from "./types.js";

export const SWEEP_BAKED_DIR = "generated/sweep_baked";

export function sweepBakedFramePath(frame: number): string {
  return `${SWEEP_BAKED_DIR}/sweep_${String(frame).padStart(3, "0")}.png`;
}

export function sweepFrameStride(value: number | undefined): number {
  return Math.max(1, Math.round(value ?? 3));
}

export function sampledSweepFrames(totalFrames: number, strideValue?: number): number[] {
  const activeFrames = sweepActiveFrameCount(totalFrames);
  const stride = sweepFrameStride(strideValue);
  return Array.from({ length: Math.ceil(activeFrames / stride) }, (_, index) => index * stride)
    .filter((frame) => frame < activeFrames);
}

export function sweepActiveFrameCount(totalFrames: number): number {
  return Math.max(1, Math.min(totalFrames, Math.round(totalFrames * (2 / 3)) + 1));
}

export function sweepProgress(frame: number, activeFrameCount: number): number {
  return activeFrameCount <= 1 ? 0 : frame / (activeFrameCount - 1);
}

export function bakedFrameVisibilityKeyframes(frame: number, totalFrames: number, strideValue = 1): MvpKeyframe[] {
  const stride = sweepFrameStride(strideValue);
  const visibleEnd = Math.min(totalFrames - 1, frame + stride - 1);
  const keyframes: MvpKeyframe[] = [{ frame: 0, alpha: frame === 0 ? 1 : 0 }];
  if (frame > 0) {
    keyframes.push({ frame: Math.max(0, frame - 1), alpha: 0 });
    keyframes.push({ frame, alpha: 1 });
  }
  if (visibleEnd > frame) {
    keyframes.push({ frame: visibleEnd, alpha: 1 });
  }
  if (visibleEnd + 1 <= totalFrames) {
    keyframes.push({ frame: visibleEnd + 1, alpha: 0 });
  }
  if (keyframes.at(-1)?.frame !== totalFrames) {
    keyframes.push({ frame: totalFrames, alpha: 0 });
  }
  return dedupeFrameKeyframes(keyframes);
}

function dedupeFrameKeyframes(keyframes: MvpKeyframe[]): MvpKeyframe[] {
  const byFrame = new Map<number, MvpKeyframe>();
  for (const keyframe of keyframes) byFrame.set(keyframe.frame, keyframe);
  return [...byFrame.values()].sort((a, b) => a.frame - b.frame);
}
