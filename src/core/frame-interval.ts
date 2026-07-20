import type { FrameRange, FrameBoundaryContract } from "../types/project.js";

export const FRAME_BOUNDARY_CONTRACT: FrameBoundaryContract = Object.freeze({
  version: "frame_boundary_v1",
  arithmetic: "ieee754_binary64",
  framePosition: "seconds_times_fps",
  predicate: "abs(frame_position-round(frame_position))<=epsilon",
  epsilon: 1e-9,
  epsilonUnit: "frames",
  snap: "nearest_integer_within_epsilon",
  interval: "in_inclusive_out_exclusive"
});

export type FrameIntervalResult =
  | {
    ok: true;
    inPoint: number;
    outPoint: number;
    activeFrameRange: FrameRange;
    frameBoundaryContract: FrameBoundaryContract;
  }
  | {
    ok: false;
    reason: "invalid" | "no_sample";
  };

export function normalizeFrameInterval(input: {
  inPoint: number;
  outPoint: number;
  fps: number;
  durationFrames: number;
}): FrameIntervalResult {
  const { inPoint, outPoint, fps, durationFrames } = input;
  if (
    !Number.isFinite(inPoint)
    || !Number.isFinite(outPoint)
    || !Number.isFinite(fps)
    || fps <= 0
    || !Number.isInteger(durationFrames)
    || durationFrames <= 0
    || inPoint < 0
    || outPoint <= inPoint
  ) {
    return { ok: false, reason: "invalid" };
  }

  const normalizedIn = normalizeBoundary(inPoint, fps);
  const normalizedOut = normalizeBoundary(outPoint, fps);
  if (
    normalizedIn.framePosition < 0
    || normalizedIn.framePosition >= durationFrames
    || normalizedOut.framePosition > durationFrames
  ) {
    return { ok: false, reason: "invalid" };
  }

  const start = Math.ceil(normalizedIn.framePosition);
  const firstExcludedFrame = Math.ceil(normalizedOut.framePosition);
  const end = firstExcludedFrame - 1;
  if (firstExcludedFrame <= start) {
    return { ok: false, reason: "no_sample" };
  }
  if (start < 0 || start >= durationFrames || end < start || end >= durationFrames) {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: true,
    inPoint: normalizedIn.seconds,
    outPoint: normalizedOut.seconds,
    activeFrameRange: { start, end },
    frameBoundaryContract: { ...FRAME_BOUNDARY_CONTRACT }
  };
}

function normalizeBoundary(seconds: number, fps: number): { seconds: number; framePosition: number } {
  const framePosition = seconds * fps;
  const nearestFrame = Math.round(framePosition);
  if (isFrameBoundaryWithinSnapEpsilon(framePosition)) {
    return { seconds: nearestFrame / fps, framePosition: nearestFrame };
  }
  return { seconds, framePosition };
}

export function isFrameBoundaryWithinSnapEpsilon(framePosition: number): boolean {
  if (!Number.isFinite(framePosition)) return false;
  return Math.abs(framePosition - Math.round(framePosition)) <= FRAME_BOUNDARY_CONTRACT.epsilon;
}
