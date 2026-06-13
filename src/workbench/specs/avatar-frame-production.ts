import type { MotionSpec } from "../contracts.js";

export const avatarFrameProductionSpec: MotionSpec = {
  id: "avatar-frame-production",
  label: "Avatar Frame Production",
  maxFileSizeBytes: 500_000,
  maxDimensions: {
    width: 300,
    height: 300
  },
  maxDurationMs: 3_000,
  maxFps: 24,
  maxResourceCount: 64,
  metadata: {
    assetType: "avatar_frame",
    target: "production",
    needsProductCalibration: [
      "maxFileSizeBytes",
      "maxResourceCount"
    ],
    basis: {
      maxDimensions: "Current avatar-frame production canvas.",
      maxFps: "Current default avatar-frame export configuration.",
      maxDurationMs: "Current default 72-frame / 24-FPS loop.",
      maxFileSizeBytes: "Conservative placeholder pending product calibration.",
      maxResourceCount: "Conservative placeholder pending product calibration."
    }
  }
};
