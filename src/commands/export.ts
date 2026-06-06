import { access } from "node:fs/promises";
import path from "node:path";
import type { AssetConfig } from "../types/config.js";
import type { BuildReport } from "../types/report.js";
import { readJsonFile, writeJsonFile } from "../utils/fs.js";
import type { AvatarFrameProject } from "../types/project.js";
import type { MvpExportCommandResult } from "./export-mvp.js";

export interface ExportCommandOptions {
  sweepStride?: 1 | 2 | 3;
}

export type ExportCommandResult = BuildReport | MvpExportCommandResult;

export async function exportCommand(inputDir: string, outputDir?: string, options: ExportCommandOptions = {}): Promise<ExportCommandResult> {
  const resolvedInputDir = path.resolve(inputDir);
  if (await isMvpJob(resolvedInputDir)) {
    const { exportMvpCommand } = await import("./export-mvp.js");
    return exportMvpCommand(resolvedInputDir);
  }

  const { buildCommand } = await import("./build.js");
  const resolvedOutputDir = path.resolve(outputDir ?? path.join(resolvedInputDir, "output"));
  const report = await buildCommand(resolvedInputDir, resolvedOutputDir, { sweepStride: options.sweepStride });
  const reportPath = path.join(resolvedOutputDir, "report.json");

  if (report.status !== "success" || !report.exporterReady) {
    report.svgaExport = {
      attempted: true,
      success: false,
      strategy: "minimal_adapter",
      error: "Intermediate project is not exporterReady; SVGA export was not attempted."
    };
    await writeJsonFile(reportPath, report);
    return report;
  }

  const config = await readJsonFile<AssetConfig>(path.join(resolvedInputDir, "asset.config.json"));
  const project = await readJsonFile<AvatarFrameProject>(path.join(resolvedOutputDir, "project.json"));
  const expectedOutputPath = path.join(resolvedOutputDir, `${config.name}.svga`);

  try {
    const { SvgaExporter } = await import("../exporters/index.js");
    const exporter = new SvgaExporter();
    const result = await exporter.export(project, resolvedOutputDir) as SvgaExportResult;
    report.svgaExport = {
      attempted: true,
      success: true,
      outputPath: result.outputPath ?? expectedOutputPath,
      fileSizeBytes: result.fileSizeBytes,
      strategy: "protobuf_zlib",
      validation: result.validation,
      warnings: result.warnings
    };
    report.svgaFileSizeBytes = result.fileSizeBytes;
  } catch (error) {
    report.svgaExport = {
      attempted: true,
      success: false,
      outputPath: expectedOutputPath,
      strategy: "protobuf_zlib",
      error: error instanceof Error ? error.message : String(error)
    };
  }

  await writeJsonFile(reportPath, report);
  return report;
}

interface SvgaExportResult {
  outputPath?: string;
  fileSizeBytes: number;
  validation: {
    exists: boolean;
    inflated: boolean;
    decoded: boolean;
    imageCount: number;
    spriteCount: number;
    frameCount: number;
  };
  warnings: string[];
}

async function isMvpJob(inputDir: string): Promise<boolean> {
  return access(path.join(inputDir, "project", "project.json")).then(() => true, () => false);
}
