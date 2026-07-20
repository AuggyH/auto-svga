import { decode, type DecodedPng } from "fast-png";
import type {
  ImageAlphaBounds,
  MotionDimensions
} from "../workbench/contracts.js";
import type {
  EmbeddedImageAlphaAnalysisInput,
  EmbeddedImageAlphaAnalyzer
} from "../workbench/image-alpha-analyzer.js";
import { readEmbeddedImageMetadata } from "../workbench/svga/image-metadata.js";

export interface FastPngAlphaAnalyzerOptions {
  maxInputBytes?: number;
  maxPixels?: number;
  maxDecodedBytes?: number;
  maxWidth?: number;
  maxHeight?: number;
}

const defaultOptions: Required<FastPngAlphaAnalyzerOptions> = {
  maxInputBytes: 25 * 1024 * 1024,
  maxPixels: 4_000_000,
  maxDecodedBytes: 32 * 1024 * 1024,
  maxWidth: 4_096,
  maxHeight: 4_096
};

export class FastPngAlphaAnalyzer implements EmbeddedImageAlphaAnalyzer {
  private readonly limits: Required<FastPngAlphaAnalyzerOptions>;

  constructor(options: FastPngAlphaAnalyzerOptions = {}) {
    this.limits = { ...defaultOptions, ...options };
  }

  analyze(input: EmbeddedImageAlphaAnalysisInput): ImageAlphaBounds {
    if (input.format !== "png") {
      return { status: "unsupported" };
    }
    if (input.bytes.byteLength > this.limits.maxInputBytes) {
      return { status: "unsupported" };
    }

    const dimensions = readEmbeddedImageMetadata(input.bytes).dimensions;
    if (!dimensions) {
      return { status: "unknown" };
    }
    if (exceedsLimits(dimensions, this.limits)) {
      return { status: "unsupported" };
    }
    if (
      input.dimensions
      && (
        input.dimensions.width !== dimensions.width
        || input.dimensions.height !== dimensions.height
      )
    ) {
      return { status: "unknown" };
    }

    try {
      const decoded = decode(input.bytes, { checkCrc: true });
      if (
        decoded.width !== dimensions.width
        || decoded.height !== dimensions.height
        || decoded.width * decoded.height > this.limits.maxPixels
      ) {
        return { status: "unknown" };
      }
      return scanAlpha(decoded);
    } catch {
      return { status: "unknown" };
    }
  }
}

function exceedsLimits(
  dimensions: MotionDimensions,
  limits: Required<FastPngAlphaAnalyzerOptions>
): boolean {
  return dimensions.width <= 0
    || dimensions.height <= 0
    || dimensions.width > limits.maxWidth
    || dimensions.height > limits.maxHeight
    || dimensions.width * dimensions.height > limits.maxPixels
    || dimensions.width * dimensions.height * 8 > limits.maxDecodedBytes;
}

function scanAlpha(decoded: DecodedPng): ImageAlphaBounds {
  const pixelCount = decoded.width * decoded.height;
  if (pixelCount <= 0) {
    return { status: "unknown" };
  }

  let minX = decoded.width;
  let minY = decoded.height;
  let maxX = -1;
  let maxY = -1;
  let opaquePixels = 0;

  for (let index = 0; index < pixelCount; index += 1) {
    if (alphaAt(decoded, index) === 0) {
      continue;
    }
    opaquePixels += 1;
    const x = index % decoded.width;
    const y = Math.floor(index / decoded.width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (opaquePixels === 0) {
    return { status: "fullyTransparent" };
  }
  if (opaquePixels === pixelCount) {
    return { status: "opaqueOnly" };
  }

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  return {
    status: "known",
    x: minX,
    y: minY,
    width,
    height,
    transparentPaddingRatio: 1 - (width * height) / pixelCount
  };
}

function alphaAt(decoded: DecodedPng, pixelIndex: number): number {
  if (decoded.palette) {
    const paletteIndex = Number(decoded.data[pixelIndex]);
    return decoded.palette[paletteIndex]?.[3] ?? 255;
  }

  const offset = pixelIndex * decoded.channels;
  if (decoded.channels === 2 || decoded.channels === 4) {
    return Number(decoded.data[offset + decoded.channels - 1]);
  }

  if (decoded.transparency && decoded.transparency.length > 0) {
    if (decoded.channels === 1) {
      return Number(decoded.data[offset]) === decoded.transparency[0] ? 0 : 255;
    }
    if (
      decoded.channels === 3
      && Number(decoded.data[offset]) === decoded.transparency[0]
      && Number(decoded.data[offset + 1]) === decoded.transparency[1]
      && Number(decoded.data[offset + 2]) === decoded.transparency[2]
    ) {
      return 0;
    }
  }

  return 255;
}
