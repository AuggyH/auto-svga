import path from "node:path";
import type { AvatarFrameProject } from "../types/project.js";
import { renderPreviewGif } from "../preview/preview-renderer.js";
import { readJsonFile } from "../utils/fs.js";

export async function previewCommand(inputDir: string, outputDir?: string): Promise<string> {
  const resolvedInputDir = path.resolve(inputDir);
  const resolvedOutputDir = path.resolve(outputDir ?? path.join(resolvedInputDir, "output"));
  const project = await readJsonFile<AvatarFrameProject>(path.join(resolvedOutputDir, "project.json"));
  return renderPreviewGif(project, resolvedOutputDir);
}
