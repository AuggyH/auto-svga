export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  path?: string;
}

export interface BuildReport {
  status: "success" | "failed";
  generatedAt: string;
  inputDir: string;
  outputDir: string;
  assetType?: string;
  canvas: {
    expected?: {
      width: number;
      height: number;
    };
    actual?: {
      width: number;
      height: number;
    };
  };
  fps?: number;
  durationFrames?: number;
  durationSeconds?: number;
  coordinateConvention: {
    transformXY: string;
    anchorXY: string;
    rotationAndScale: string;
  };
  preview: {
    frameCount?: number;
    durationFrames?: number;
    durationSeconds?: number;
    path?: string;
  };
  layerCount: number;
  animationCount: number;
  generatedAssets: Array<{
    id: string;
    path: string;
    sizeBytes: number;
  }>;
  totalGeneratedAssetSize: number;
  missingAssets: string[];
  invalidLayerReferences: string[];
  invalidAnimationTargetReferences: string[];
  exporterCompatibility: ExporterCompatibilityReport;
  hasBakedMaskAssets: boolean;
  hasBlendModeFallbacks: boolean;
  replaceableSprites: string[];
  exporterReady: boolean;
  sweepMaskStrategy?: "baked_per_frame_fixed_alpha_mask";
  bakedSweepFrameCount: number;
  bakedSweepFrameStride: number;
  bakedSweepRawFrameCount: number;
  bakedSweepSampledFrameCount: number;
  bakedSweepTransparentFrameCount: number;
  bakedSweepUniqueAssetCount: number;
  bakedSweepDedupedCount: number;
  bakedSweepEstimatedQualityMode: "full" | "balanced" | "compact";
  bakedSweepAssetSizeBytes: number;
  bakedSweepAssetSizeBeforeDedup: number;
  bakedSweepAssetSizeAfterDedup: number;
  runtimeMaskUsed: boolean;
  sweepExportMode?: "baked_frame_sprites";
  svgaFileSizeBytes?: number;
  frameLevelImageKeySupported: false;
  frameLevelImageKeyReason: string;
  svgaExport: SvgaExportReport;
  playbackTest: PlaybackTestReport;
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
  outputs: {
    projectJson?: string;
    preview?: string;
    assets?: string[];
    reportJson?: string;
    svgaMap?: string;
  };
}

export interface SvgaExportReport {
  attempted: boolean;
  success: boolean;
  outputPath?: string;
  fileSizeBytes?: number;
  error?: string;
  strategy: "not_attempted" | "minimal_adapter" | "unsupported_missing_binary_schema" | "protobuf_zlib";
  validation?: {
    exists: boolean;
    inflated: boolean;
    decoded: boolean;
    imageCount: number;
    spriteCount: number;
    frameCount: number;
  };
  warnings?: string[];
}

export interface PlaybackTestReport {
  attempted: boolean;
  manualRequired: boolean;
  automated: boolean;
  expectedPath: string;
  instructions: string[];
  knownLimitations: string[];
}

export interface ExporterCompatibilityReport {
  unsupportedLayerTypes: string[];
  templateOnlyAnimations: string[];
  blendModesRequiringSupport: string[];
  unsupportedBlendModeFallbacks: string[];
  hasFallbackForAllBlendModes: boolean;
  usesMask: boolean;
  maskLayerIds: string[];
  allAnimationTargetsExist: boolean;
  allLayerAssetsExist: boolean;
  keyframesInRange: boolean;
  outOfRangeKeyframes: Array<{
    animationId: string;
    frame: number;
  }>;
}
