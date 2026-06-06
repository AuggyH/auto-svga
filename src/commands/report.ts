import path from "node:path";
import type { MotionPlan, MvpConfig, MvpProject, MvpStructure } from "../mvp/types.js";
import { buildMvpReport, buildMvpSvgaMap, pathExists, type MvpReport, type MvpSvgaMap } from "../mvp/report-builder.js";
import type { MvpPreviewReport } from "../mvp/preview-renderer.js";
import { readJsonFile, writeJsonFile } from "../utils/fs.js";

export interface MvpReportCommandResult {
  jobName: string;
  assetType: string;
  inputMode: string;
  partCount: number;
  effectCount: number;
  projectLayerCount: number;
  generatedAssetCount: number;
  reportPath: string;
  svgaMapPath: string;
  report: MvpReport;
  svgaMap: MvpSvgaMap;
}

export async function reportCommand(jobDir: string): Promise<MvpReportCommandResult> {
  const resolvedJobDir = path.resolve(jobDir);
  const jobName = path.basename(resolvedJobDir);
  const config = await readJsonFile<MvpConfig>(path.join(resolvedJobDir, "input", "config.json"));
  const structure = await readJsonFile<MvpStructure>(path.join(resolvedJobDir, "input", "structure.json"));
  const motionPlan = await readRequiredJson<MotionPlan>(resolvedJobDir, "project/motion-plan.json");
  const project = await readRequiredJson<MvpProject>(resolvedJobDir, "project/project.json");
  const previewReportPath = path.join(resolvedJobDir, "output", "preview-report.json");
  const hasPreviewReport = await pathExists(previewReportPath);
  const previewReport = hasPreviewReport ? await readJsonFile<MvpPreviewReport>(previewReportPath) : undefined;

  const report = await buildMvpReport({
    jobDir: resolvedJobDir,
    jobName,
    config,
    structure,
    motionPlan,
    project,
    previewReport,
    previewReportMissing: !hasPreviewReport
  });
  const svgaMap = buildMvpSvgaMap({ jobName, config, structure, motionPlan, project });

  const reportPath = "output/report.json";
  const svgaMapPath = "output/svga-map.json";
  await writeJsonFile(path.join(resolvedJobDir, reportPath), report);
  await writeJsonFile(path.join(resolvedJobDir, svgaMapPath), svgaMap);

  return {
    jobName,
    assetType: report.assetType,
    inputMode: report.inputMode,
    partCount: report.summary.partCount,
    effectCount: report.summary.effectCount,
    projectLayerCount: report.summary.projectLayerCount,
    generatedAssetCount: report.summary.generatedAssetCount,
    reportPath,
    svgaMapPath,
    report,
    svgaMap
  };
}

async function readRequiredJson<T>(jobDir: string, relativePath: string): Promise<T> {
  const filePath = path.join(jobDir, relativePath);
  if (!await pathExists(filePath)) {
    throw new Error(`Required MVP file is missing: ${relativePath}`);
  }
  return readJsonFile<T>(filePath);
}
