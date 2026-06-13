export type MotionFormat =
  | "svga"
  | "vap"
  | "lottie"
  | "animated_webp"
  | "webm"
  | "apng"
  | "sprite_sequence";

export type CapabilityMaturity = "current" | "partial" | "planned" | "research" | "unsupported";

export type MotionCapability =
  | "playback"
  | "parse"
  | "replaceable_content"
  | "convert"
  | "export"
  | "spec_check"
  | "performance_check";

export interface MotionDimensions {
  width: number;
  height: number;
}

export interface MotionTiming {
  fps?: number;
  frameCount?: number;
  durationMs?: number;
  loop?: boolean;
}

export type ImageAlphaBoundsStatus =
  | "known"
  | "fullyTransparent"
  | "opaqueOnly"
  | "unknown"
  | "unsupported";

export interface ImageAlphaBounds {
  status: ImageAlphaBoundsStatus;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  transparentPaddingRatio?: number;
}

export type MotionResourceRole =
  | "static_image"
  | "sequence_frame"
  | "baked_sweep_frame"
  | "mask_or_matte"
  | "unknown";

export interface MotionResourceInfo {
  id: string;
  name: string;
  kind: "image" | "video" | "vector" | "audio" | "font" | "unknown";
  role?: MotionResourceRole;
  sizeBytes?: number;
  dimensions?: MotionDimensions;
  alphaBounds?: ImageAlphaBounds;
  replaceable?: boolean;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface MotionLayerInfo {
  id: string;
  name: string;
  kind: string;
  resourceIds: readonly string[];
  visible?: boolean;
  replaceable?: boolean;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface MotionAssetInfo {
  format: MotionFormat;
  name: string;
  sizeBytes: number;
  dimensions?: MotionDimensions;
  timing: MotionTiming;
  layers: readonly MotionLayerInfo[];
  resources: readonly MotionResourceInfo[];
  metadata?: Readonly<Record<string, unknown>>;
}

export interface MotionAssetSource {
  id: string;
  name: string;
  sizeBytes: number;
  mediaType?: string;
  read(): Promise<Uint8Array>;
}

export interface WorkbenchIssue {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  path?: string;
  details?: Readonly<Record<string, unknown>>;
}

export interface WorkbenchResult<T> {
  value?: T;
  issues: readonly WorkbenchIssue[];
}

export interface CancellationToken {
  readonly cancelled: boolean;
  throwIfCancelled(): void;
}

export interface ProgressUpdate {
  phase: string;
  completed: number;
  total?: number;
  message?: string;
}

export interface WorkbenchOperationContext {
  cancellation?: CancellationToken;
  onProgress?: (update: ProgressUpdate) => void;
}

export interface FormatProbeResult {
  format?: MotionFormat;
  confidence: number;
  issues: readonly WorkbenchIssue[];
}

export interface FormatAdapter {
  readonly format: MotionFormat;
  probe(source: MotionAssetSource, context?: WorkbenchOperationContext): Promise<FormatProbeResult>;
  parse(source: MotionAssetSource, context?: WorkbenchOperationContext): Promise<WorkbenchResult<MotionAssetInfo>>;
}

export interface PlaybackState {
  status: "idle" | "loading" | "ready" | "playing" | "paused" | "ended" | "error" | "disposed";
  currentTimeMs: number;
  durationMs?: number;
  loop: boolean;
}

export interface PlaybackSession {
  load(source: MotionAssetSource, context?: WorkbenchOperationContext): Promise<WorkbenchResult<MotionAssetInfo>>;
  play(): Promise<void>;
  pause(): void;
  seek(timeMs: number): void;
  replay(): Promise<void>;
  setLoop(loop: boolean): void;
  getState(): PlaybackState;
  dispose(): void;
}

export interface PlaybackAdapter<TTarget = unknown> {
  readonly format: MotionFormat;
  createSession(target: TTarget): PlaybackSession;
}

export interface MotionSpec {
  id: string;
  label: string;
  maxFileSizeBytes?: number;
  maxDimensions?: MotionDimensions;
  maxDurationMs?: number;
  maxFps?: number;
  maxResourceCount?: number;
  maxResourceDimensions?: MotionDimensions;
  maxTransparentPaddingRatio?: number;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface MotionSpecCheckReport {
  specId: string;
  passed: boolean;
  issues: readonly WorkbenchIssue[];
}

export interface MotionSpecChecker {
  check(asset: MotionAssetInfo, spec: MotionSpec, context?: WorkbenchOperationContext): Promise<MotionSpecCheckReport>;
}

export interface FormatRecommendationRequest {
  source: MotionAssetInfo;
  targetPlatforms: readonly string[];
  priorities: readonly ("quality" | "file_size" | "decode_cost" | "replaceability" | "compatibility")[];
  requiredCapabilities?: readonly MotionCapability[];
}

export interface FormatRecommendation {
  format: MotionFormat;
  score: number;
  reasons: readonly string[];
  warnings: readonly WorkbenchIssue[];
}

export interface FormatRecommendationEngine {
  recommend(
    request: FormatRecommendationRequest,
    context?: WorkbenchOperationContext
  ): Promise<readonly FormatRecommendation[]>;
}

export interface FrameSequenceFrame {
  index: number;
  durationMs: number;
  rgba: Uint8Array;
}

export interface FrameSequenceIntermediate {
  dimensions: MotionDimensions;
  frames: readonly FrameSequenceFrame[];
  loop: boolean;
  alphaMode: "straight" | "premultiplied" | "opaque";
  colorSpace?: "srgb";
}

export interface ExportRequest {
  targetFormat: MotionFormat;
  source: MotionAssetInfo | FrameSequenceIntermediate;
  outputName: string;
  options?: Readonly<Record<string, unknown>>;
}

export interface ExportArtifact {
  format: MotionFormat;
  name: string;
  mediaType: string;
  bytes: Uint8Array;
  asset: MotionAssetInfo;
}

export interface ExportPipeline {
  readonly targetFormat: MotionFormat;
  export(request: ExportRequest, context?: WorkbenchOperationContext): Promise<WorkbenchResult<ExportArtifact>>;
}

export interface CapabilityAssessment {
  capability: MotionCapability;
  maturity: CapabilityMaturity;
  boundary: string;
}

export interface FormatCapabilityProfile {
  format: MotionFormat;
  assessments: readonly CapabilityAssessment[];
}
