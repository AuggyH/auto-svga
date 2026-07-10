import { constants } from "node:fs";
import { access, open, stat } from "node:fs/promises";
import path from "node:path";
import {
  LOTTIE_ADJACENT_RESOURCE_MAX_BYTES,
  type HiddenLottiePreviewHost,
  type HiddenLottiePreviewHostFileStat,
  type HiddenLottiePreviewHostResourceRead
} from "../workbench/lottie-preview-vertical.js";

export function createLottiePreviewNodeHost(): HiddenLottiePreviewHost {
  return {
    async statLocalFile(localPath: string): Promise<HiddenLottiePreviewHostFileStat> {
      const fileStat = await stat(localPath);
      if (!fileStat.isFile()) {
        throw new Error("Local Lottie source must be a file.");
      }
      return {
        sizeBytes: fileStat.size,
        displayName: path.basename(localPath),
        mediaType: mediaTypeFromPath(localPath)
      };
    },
    async readLocalFileRange(localPath: string, offset: number, length: number): Promise<Uint8Array> {
      if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length < 0) {
        throw new Error("Invalid bounded local file read.");
      }
      const handle = await open(localPath, "r");
      try {
        const buffer = new Uint8Array(length);
        const result = await handle.read(buffer, 0, length, offset);
        return buffer.slice(0, result.bytesRead);
      } finally {
        await handle.close();
      }
    },
    async readAdjacentResource(input): Promise<HiddenLottiePreviewHostResourceRead> {
      if (!isDeterministicRelativePath(input.relativePath)) {
        throw new Error("Adjacent resource path must be deterministic and relative.");
      }
      const sourceDirectory = path.dirname(input.sourceLocalPath);
      const resolved = path.resolve(sourceDirectory, input.relativePath);
      const relative = path.relative(sourceDirectory, resolved);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error("Adjacent resource escaped the source directory.");
      }
      await access(resolved, constants.R_OK);
      const fileStat = await stat(resolved);
      if (!fileStat.isFile()) {
        throw new Error("Adjacent resource must be a file.");
      }
      const maxBytes = Math.min(input.maxBytes, LOTTIE_ADJACENT_RESOURCE_MAX_BYTES);
      if (fileStat.size > maxBytes) {
        throw new Error("Adjacent resource exceeds the bounded preview limit.");
      }
      const handle = await open(resolved, "r");
      try {
        const buffer = new Uint8Array(fileStat.size);
        const result = await handle.read(buffer, 0, fileStat.size, 0);
        return {
          bytes: buffer.slice(0, result.bytesRead),
          sizeBytes: fileStat.size,
          mediaType: mediaTypeFromPath(resolved)
        };
      } finally {
        await handle.close();
      }
    }
  };
}

function mediaTypeFromPath(value: string): string | undefined {
  const lower = value.toLocaleLowerCase("en-US");
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return undefined;
}

function isDeterministicRelativePath(value: string): boolean {
  if (!value || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value) || /^[\\/]/u.test(value) || /^[A-Za-z]:[\\/]/u.test(value)) {
    return false;
  }
  const parts = value.split(/[\\/]+/u);
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}
