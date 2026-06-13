import type { MotionDimensions } from "../contracts.js";

export interface EmbeddedImageMetadata {
  format: "png" | "unknown";
  dimensions?: MotionDimensions;
}

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function readEmbeddedImageMetadata(bytes: Uint8Array): EmbeddedImageMetadata {
  if (!isPng(bytes)) {
    return { format: "unknown" };
  }

  const width = readUint32Be(bytes, 16);
  const height = readUint32Be(bytes, 20);
  if (width <= 0 || height <= 0) {
    return { format: "png" };
  }

  return {
    format: "png",
    dimensions: { width, height }
  };
}

function isPng(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 24) {
    return false;
  }
  return pngSignature.every((value, index) => bytes[index] === value)
    && bytes[12] === 0x49
    && bytes[13] === 0x48
    && bytes[14] === 0x44
    && bytes[15] === 0x52;
}

function readUint32Be(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000
    + bytes[offset + 1] * 0x10000
    + bytes[offset + 2] * 0x100
    + bytes[offset + 3]
  ) >>> 0;
}
