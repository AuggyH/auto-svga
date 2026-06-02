import path from "node:path";
import type { AssetConfig } from "../types/config.js";
import type { BuildReport } from "../types/report.js";
import { buildCommand } from "./build.js";
import { SvgaExporter } from "../exporters/index.js";
import type { SvgaExportResult } from "../exporters/svga-exporter.js";
import { readJsonFile, writeJsonFile } from "../utils/fs.js";
import type { AvatarFrameProject } from "../types/project.js";

export interface ExportCommandOptions {
  sweepStride?: 1 | 2 | 3;
}

export async function exportCommand(inputDir: string, outputDir?: string, options: ExportCommandOptions = {}): Promise<BuildReport> {
  const resolvedInputDir = path.resolve(inputDir);
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
