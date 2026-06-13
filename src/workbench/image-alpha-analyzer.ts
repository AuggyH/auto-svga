import type {
  ImageAlphaBounds,
  MotionDimensions
} from "./contracts.js";

export interface EmbeddedImageAlphaAnalysisInput {
  bytes: Uint8Array;
  format: "png" | "unknown";
  dimensions?: MotionDimensions;
}

/**
 * Host boundary for image decoding. Core inspection and spec checking consume
 * the returned metadata without depending on Node, DOM, Canvas, or filesystem APIs.
 */
export interface EmbeddedImageAlphaAnalyzer {
  analyze(input: EmbeddedImageAlphaAnalysisInput): Promise<ImageAlphaBounds> | ImageAlphaBounds;
}
