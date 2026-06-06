import type { MvpEasing } from "./types.js";

export const SUPPORTED_MVP_EASINGS: MvpEasing[] = [
  "linear",
  "easeInSine",
  "easeOutSine",
  "easeInOutSine",
  "easeInQuad",
  "easeOutQuad",
  "easeInOutQuad",
  "easeOutBack"
];

export function applyEasing(name: string | undefined, progress: number): number {
  const t = Math.max(0, Math.min(1, progress));
  switch (name ?? "linear") {
    case "easeInSine":
      return 1 - Math.cos((t * Math.PI) / 2);
    case "easeOutSine":
      return Math.sin((t * Math.PI) / 2);
    case "easeInOutSine":
      return -(Math.cos(Math.PI * t) - 1) / 2;
    case "easeInQuad":
      return t * t;
    case "easeOutQuad":
      return 1 - (1 - t) * (1 - t);
    case "easeInOutQuad":
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case "easeOutBack": {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
    case "linear":
    default:
      return t;
  }
}

export function isSupportedEasing(value: string | undefined): value is MvpEasing {
  return value !== undefined && SUPPORTED_MVP_EASINGS.includes(value as MvpEasing);
}
