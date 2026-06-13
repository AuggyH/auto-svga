import type { MotionSpec, MotionSpecProfile } from "../contracts.js";

export const avatarFrameProductionProfile: MotionSpecProfile = {
  id: "production_target",
  label: "Avatar Frame Production Target",
  purpose: "Gate new avatar-frame deliveries against the approved production target.",
  approvedForNewDelivery: true
};

export const avatarFrameProductionSpec: MotionSpec = {
  id: "avatar-frame-production",
  label: "Avatar Frame Production",
  profile: avatarFrameProductionProfile,
  maxFileSizeBytes: 512 * 1024,
  maxDimensions: {
    width: 300,
    height: 300
  },
  maxDurationMs: 3_000,
  maxFps: 24,
  maxResourceCount: 32,
  maxResourceDimensions: {
    width: 300,
    height: 300
  },
  maxTransparentPaddingRatio: 0.5,
  metadata: {
    assetType: "avatar_frame",
    target: "production_target",
    calibrationStatus: "provisional",
    calibrationSampleCount: 2,
    needsProductCalibration: [
      "maxFileSizeBytes",
      "maxResourceCount",
      "maxTransparentPaddingRatio"
    ],
    calibrationNotes: {
      maxFileSizeBytes: "Provisional 512 KiB recommendation based on two unique 300x300 repository outputs; needs product calibration with a larger delivery sample.",
      maxResourceCount: "Provisional 32-resource recommendation based on two unique 300x300 repository outputs containing 25 and 28 resources; needs product calibration with a larger delivery sample.",
      maxTransparentPaddingRatio: "Provisional 50% transparent-padding limit; needs product calibration after a host alpha analyzer is connected to representative delivery samples."
    },
    basis: {
      maxDimensions: "Current avatar-frame production canvas.",
      maxFps: "Current default avatar-frame export configuration.",
      maxDurationMs: "Current default 72-frame / 24-FPS loop.",
      maxFileSizeBytes: "Two unique 300x300 outputs measured 107,034 and 346,987 bytes; 512 KiB keeps 51% headroom above the larger current sample.",
      maxResourceCount: "Two unique 300x300 outputs contained 28 and 25 image resources; 32 keeps four resources of headroom above the larger current sample.",
      maxResourceDimensions: "Embedded avatar-frame image resources should stay within the 300x300 production canvas.",
      maxTransparentPaddingRatio: "A conservative provisional boundary for obvious texture waste; alpha-bound samples are not yet available."
    }
  }
};
