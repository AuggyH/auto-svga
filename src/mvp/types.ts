export type MvpAssetType = "avatar_frame";
export type MvpInputMode = "layered";
export type MotionTemplateId = "wing_flap" | "gem_twinkle" | "metal_sweep" | "frame_breath" | "pop_settle";

export interface MvpConfig {
  assetType: MvpAssetType;
  canvas: {
    width: number;
    height: number;
  };
  fps: number;
  durationMs: number;
  outputName: string;
  export?: {
    previewGif?: boolean;
    svga?: boolean;
    report?: boolean;
    deliveryZip?: boolean;
  };
}

export interface MvpStructure {
  assetType: MvpAssetType;
  inputMode: MvpInputMode;
  canvas: {
    width: number;
    height: number;
  };
  safeArea: {
    type: string;
    centerX: number;
    centerY: number;
    radius: number;
  };
  parts: MvpPart[];
}

export interface MvpPart {
  id: string;
  type: string;
  source: string;
  bbox: [number, number, number, number];
  anchor: {
    x: number;
    y: number;
    space: "canvas";
    role: string;
    confidence?: number;
  };
  zIndex: number;
  motionAllowed?: MotionTemplateId[];
  symmetryPair?: string;
}

export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  path?: string;
}

export interface AnchorConversion {
  canvasX: number;
  canvasY: number;
  localX: number;
  localY: number;
}

export interface MotionEffect {
  id: string;
  template: MotionTemplateId;
  target: string;
  intensity: number;
  durationMs: number;
  mirrorOf?: string;
}

export interface MotionPlan {
  assetType: MvpAssetType;
  motionStyle: "luxury_subtle_loop";
  durationMs: number;
  fps: number;
  rules: {
    protectSafeArea: boolean;
    avoidLargeMotion: boolean;
    loopSeamless: boolean;
    smallSizeReadable: boolean;
  };
  effects: MotionEffect[];
}

export interface MvpProject {
  version: "0.1.0";
  assetType: MvpAssetType;
  canvas: {
    width: number;
    height: number;
  };
  fps: number;
  durationMs: number;
  frames: number;
  layers: MvpProjectLayer[];
  warnings: string[];
}

export interface MvpProjectLayer {
  id: string;
  type: "image";
  source: string;
  role: "part" | "effect" | "effect_placeholder";
  zIndex: number;
  bbox?: [number, number, number, number];
  anchor?: AnchorConversion;
  keyframes: MvpKeyframe[];
  sourceEffect?: string;
  requiredGeneratedAsset?: boolean;
}

export interface MvpKeyframe {
  frame: number;
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  alpha?: number;
}

export interface PlanningResult {
  jobName: string;
  jobDir: string;
  config: MvpConfig;
  structure: MvpStructure;
  motionPlan: MotionPlan;
  project: MvpProject;
  issues: ValidationIssue[];
  generated: string[];
}
