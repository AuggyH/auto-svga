import path from "node:path";
import type { MotionPlan, MvpConfig, MvpProject, MvpStructure } from "../mvp/types.js";
import type { MvpReport, MvpSvgaMap } from "../mvp/report-builder.js";
import type { MvpSvgaExportResult, MvpSvgaExportValidation } from "../mvp/svga-exporter.js";
import { pathExists } from "../mvp/report-builder.js";
import { readJsonFile, writeJsonFile } from "../utils/fs.js";
import { reportCommand } from "./report.js";

export interface MvpExportCommandResult {
  mode: "mvp";
  jobName: string;
  projectPath: string;
  canvas: {
    width: number;
    height: number;
  };
  fps: number;
  frames: number;
  layers: number;
  images: number;
  sprites: number;
  svgaPath: string;
  sizeBytes: number;
  validation: MvpSvgaExportValidation;
  reportPath: string;
  svgaMapPath: string;
  report: MvpReport;
  svgaMap: MvpSvgaMap;
}

export async function exportMvpCommand(jobDir: string): Promise<MvpExportCommandResult> {
  const resolvedJobDir = path.resolve(jobDir);
  const jobName = path.basename(resolvedJobDir);
  const config = await readJsonFile<MvpConfig>(path.join(resolvedJobDir, "input", "config.json"));
  const structure = await readJsonFile<MvpStructure>(path.join(resolvedJobDir, "input", "structure.json"));
  await readRequiredJson<MotionPlan>(resolvedJobDir, "project/motion-plan.json");
  const project = await readRequiredJson<MvpProject>(resolvedJobDir, "project/project.json");

  await ensureReportArtifacts(resolvedJobDir);
  const { exportMvpSvga } = await importMvpExporter();
  const exportResult = await exportMvpSvga(resolvedJobDir, project, config.outputName || jobName);
  const reportPath = "output/report.json";
  const svgaMapPath = "output/svga-map.json";
  const report = await readJsonFile<MvpReport>(path.join(resolvedJobDir, reportPath));
  const svgaMap = await readJsonFile<MvpSvgaMap>(path.join(resolvedJobDir, svgaMapPath));
  const updatedReport = updateReport(report, exportResult);
  const updatedMap = updateSvgaMap(svgaMap, exportResult);

  await writeJsonFile(path.join(resolvedJobDir, reportPath), updatedReport);
  await writeJsonFile(path.join(resolvedJobDir, svgaMapPath), updatedMap);

  return {
    mode: "mvp",
    jobName,
    projectPath: "project/project.json",
    canvas: project.canvas,
    fps: project.fps,
    frames: project.frames,
    layers: project.layers.length,
    images: exportResult.imageCount,
    sprites: exportResult.spriteCount,
    svgaPath: exportResult.relativeOutputPath,
    sizeBytes: exportResult.fileSizeBytes,
    validation: exportResult.validation,
    reportPath,
    svgaMapPath,
    report: updatedReport,
    svgaMap: updatedMap
  };
}

async function ensureReportArtifacts(jobDir: string): Promise<void> {
  const reportPath = path.join(jobDir, "output", "report.json");
  const svgaMapPath = path.join(jobDir, "output", "svga-map.json");
  if (!await pathExists(reportPath) || !await pathExists(svgaMapPath)) {
    await reportCommand(jobDir);
  }
}

async function importMvpExporter(): Promise<typeof import("../mvp/svga-exporter.js")> {
  try {
    return await import("../mvp/svga-exporter.js");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("protobufjs")) {
      throw new Error("MVP SVGA export requires protobufjs. Run dependency installation before exporting.");
    }
    throw error;
  }
}

function updateReport(report: MvpReport, exportResult: MvpSvgaExportResult): MvpReport {
  return {
    ...report,
    output: {
      ...report.output,
      svga: exportResult.relativeOutputPath
    },
    validation: {
      ...report.validation,
      svgaExported: true
    },
    svga: {
      path: exportResult.relativeOutputPath,
      sizeBytes: exportResult.fileSizeBytes,
      imageCount: exportResult.imageCount,
      spriteCount: exportResult.spriteCount,
      frameCount: exportResult.frameCount
    }
  };
}

function updateSvgaMap(svgaMap: MvpSvgaMap, exportResult: MvpSvgaExportResult): MvpSvgaMap {
  const byLayer = new Map(exportResult.layerMappings.map((mapping) => [mapping.projectLayerId, mapping]));
  const byAsset = new Map(exportResult.assetMappings.map((mapping) => [mapping.source, mapping]));

  return {
    ...svgaMap,
    layers: svgaMap.layers.map((layer) => {
      const mapping = byLayer.get(layer.projectLayerId);
      return mapping ? {
        ...layer,
        svgaSpriteId: mapping.svgaSpriteId,
        svgaImageKey: mapping.svgaImageKey
      } : layer;
    }),
    assets: svgaMap.assets.map((asset) => {
      const mapping = byAsset.get(asset.source);
      return mapping ? {
        ...asset,
        svgaImageKey: mapping.svgaImageKey
      } : asset;
    })
  };
}

async function readRequiredJson<T>(jobDir: string, relativePath: string): Promise<T> {
  const filePath = path.join(jobDir, relativePath);
  if (!await pathExists(filePath)) {
    throw new Error(`Required MVP file is missing: ${relativePath}`);
  }
  return readJsonFile<T>(filePath);
}
