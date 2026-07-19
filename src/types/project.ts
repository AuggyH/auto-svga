import type { AssetType, TemplateId } from "./config.js";

export interface AvatarFrameProject {
  schemaVersion: "0.4.0";
  version: "0.4.0";
  projectId: string;
  assetType: AssetType;
  canvas: {
    width: number;
    height: number;
  };
  fps: number;
  durationFrames: number;
  loop: boolean;
  assets: ProjectAsset[];
  layers: ProjectLayer[];
  animations: ProjectAnimation[];
  bakedSweep?: {
    enabled: boolean;
    frameStride: number;
    skipTransparentFrames: boolean;
    dedupeIdenticalFrames: boolean;
    sampledFrameCount: number;
  };
  export: ProjectExport;
}

export interface ProjectAsset {
  id: string;
  type: "image";
  path: string;
  width: number;
  height: number;
  sha256: string;
  generated: boolean;
}

export interface ProjectLayer {
  id: string;
  type: "image";
  assetId: string;
  zIndex: number;
  visible: boolean;
  blendMode: "normal" | "screen" | "add";
  fallbackBlendMode: "normal";
  fallbackOpacityMultiplier: number;
  sourceTiming?: LayerSourceTiming;
  activeFrameRange?: FrameRange;
  mask?: LayerMask;
  anchor: Anchor;
  transform: LayerTransform;
  metadata?: {
    sweepBakedFrame?: {
      frameIndex: number;
      sampledFrame: number;
      frameStride: number;
      kind: "sweep_core" | "sweep_soft";
      exportAssetPath: string;
      imageHash: string;
      sharedAssetId: string;
      visibleFrameRange: {
        start: number;
        end: number;
      };
    };
  };
}

export interface FrameRange {
  start: number;
  end: number;
}

export interface LayerSourceTiming {
  unit: "seconds";
  frameBoundary: "in_inclusive_out_exclusive";
  frameBoundaryContract: FrameBoundaryContract;
  inPoint: number;
  outPoint: number;
  startTime: number;
  stretch: 100;
  timeRemapEnabled: false;
}

export interface FrameBoundaryContract {
  version: "frame_boundary_v1";
  arithmetic: "ieee754_binary64";
  framePosition: "seconds_times_fps";
  predicate: "abs(frame_position-round(frame_position))<=epsilon";
  epsilon: 1e-9;
  epsilonUnit: "frames";
  snap: "nearest_integer_within_epsilon";
  interval: "in_inclusive_out_exclusive";
}

export interface LayerMask {
  type: "alpha";
  sourceLayerId: string;
}

export interface Anchor {
  x: number;
  y: number;
}

export interface LayerTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
}

export interface ProjectAnimation {
  id: string;
  templateId: TemplateId;
  targetLayerId: string;
  keyframes: Keyframe[];
  easing: "linear" | "easeInOut" | "easeOut";
}

export interface Keyframe extends Partial<LayerTransform> {
  frame: number;
  debugTimeMs?: number;
}

export interface ProjectExport {
  format: "intermediate-json";
  exporter: "json-exporter";
  svgaExporter: {
    status: "stub";
    notes: string;
  };
}
