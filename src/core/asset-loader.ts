import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import type { AssetConfig } from "../types/config.js";
import { sha256 } from "../utils/hash.js";
import { readPngInfo } from "../utils/png.js";

export interface LoadedAsset {
  id: "frame";
  sourcePath: string;
  outputFileName: string;
  width: number;
  height: number;
  hasAlpha: boolean;
  sha256: string;
}

export async function loadAvatarFrameAsset(inputDir: string, config: AssetConfig): Promise<LoadedAsset> {
  const sourcePath = path.resolve(inputDir, config.source.framePng);
  const buffer = await readFile(sourcePath);
  const info = readPngInfo(buffer);

  return {
    id: "frame",
    sourcePath,
    outputFileName: "frame.png",
    width: info.width,
    height: info.height,
    hasAlpha: info.hasAlpha,
    sha256: sha256(buffer)
  };
}

export async function copyGeneratedAssets(asset: LoadedAsset, outputAssetsDir: string): Promise<string> {
  const targetPath = path.join(outputAssetsDir, asset.outputFileName);
  await copyFile(asset.sourcePath, targetPath);
  return targetPath;
}
