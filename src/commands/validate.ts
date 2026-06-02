import path from "node:path";
import type { AssetConfig } from "../types/config.js";
import type { ValidationIssue } from "../types/report.js";
import { readJsonFile } from "../utils/fs.js";
import { loadAvatarFrameAsset } from "../core/asset-loader.js";
import { validateInputDir } from "../core/validator.js";

export async function validateCommand(inputDir: string): Promise<ValidationIssue[]> {
  const resolvedInputDir = path.resolve(inputDir);
  const config = await readJsonFile<AssetConfig>(path.join(resolvedInputDir, "asset.config.json"));
  const initialIssues = await validateInputDir(resolvedInputDir, config);

  if (initialIssues.some((issue) => issue.level === "error")) {
    return initialIssues;
  }

  const asset = await loadAvatarFrameAsset(resolvedInputDir, config);
  return validateInputDir(resolvedInputDir, config, asset);
}
