import { access } from "node:fs/promises";
import path from "node:path";
import type { AvatarFrameProject } from "../types/project.js";
import type { MvpProject } from "../mvp/types.js";
import { renderMvpPreviewGif, type MvpPreviewReport } from "../mvp/preview-renderer.js";
import { renderPreviewGif } from "../preview/preview-renderer.js";
import { readJsonFile, writeJsonFile } from "../utils/fs.js";

export type PreviewCommandResult =
  | {
    mode: "legacy";
    previewPath: string;
  }
  | {
    mode: "mvp";
    jobName: string;
    previewPath: string;
    reportPath: string;
    report: MvpPreviewReport;
  };

export async function previewCommand(inputDir: string, outputDir?: string): Promise<PreviewCommandResult> {
  const resolvedInputDir = path.resolve(inputDir);
  const mvpProjectPath = path.join(resolvedInputDir, "project", "project.json");
  if (await exists(mvpProjectPath)) {
    const project = await readJsonFile<MvpProject>(mvpProjectPath);
    const report = await renderMvpPreviewGif(resolvedInputDir, project);
    const reportPath = "output/preview-report.json";
    await writeJsonFile(path.join(resolvedInputDir, reportPath), report);
    return {
      mode: "mvp",
      jobName: path.basename(resolvedInputDir),
      previewPath: report.previewPath,
      reportPath,
      report
    };
  }

  const resolvedOutputDir = path.resolve(outputDir ?? path.join(resolvedInputDir, "output"));
  const project = await readJsonFile<AvatarFrameProject>(path.join(resolvedOutputDir, "project.json"));
  return {
    mode: "legacy",
    previewPath: await renderPreviewGif(project, resolvedOutputDir)
  };
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
