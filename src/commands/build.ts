import path from "node:path";
import { rm } from "node:fs/promises";
import type { AssetConfig } from "../types/config.js";
import type { BuildReport } from "../types/report.js";
import { applyBakedSweepFrames } from "../core/baked-sweep.js";
import { generateAvatarFrameAssets } from "../core/generated-assets.js";
import { buildProject } from "../core/project-builder.js";
import { buildReport } from "../core/report-builder.js";
import { writeSvgaMap } from "../core/svga-map-builder.js";
import { expandTemplates } from "../core/template-engine.js";
import { hasErrors, validateInputDir } from "../core/validator.js";
import { JsonExporter } from "../exporters/index.js";
import { renderPreviewGif } from "../preview/preview-renderer.js";
import { loadAvatarFrameAsset } from "../core/asset-loader.js";
import { ensureDir, readJsonFile, writeJsonFile } from "../utils/fs.js";

export interface BuildCommandOptions {
  sweepStride?: 1 | 2 | 3;
}

export async function buildCommand(inputDir: string, outputDir?: string, options: BuildCommandOptions = {}): Promise<BuildReport> {
  const resolvedInputDir = path.resolve(inputDir);
  const resolvedOutputDir = path.resolve(outputDir ?? path.join(resolvedInputDir, "output"));
  const outputAssetsDir = path.join(resolvedOutputDir, "assets");
  const configPath = path.join(resolvedInputDir, "asset.config.json");
  await rm(resolvedOutputDir, { recursive: true, force: true });
  await ensureDir(resolvedOutputDir);
  await ensureDir(outputAssetsDir);

  const rawConfig = await readJsonFile<unknown>(configPath);
  const initialIssues = await validateInputDir(resolvedInputDir, rawConfig);

  if (hasErrors(initialIssues)) {
    const failedReport = await buildReport({
      inputDir: resolvedInputDir,
      outputDir: resolvedOutputDir,
      issues: initialIssues
    });
    await writeJsonFile(path.join(resolvedOutputDir, "report.json"), failedReport);
    return failedReport;
  }

  const config = applyBuildOverrides(rawConfig as AssetConfig, options);
  const sourceAsset = await loadAvatarFrameAsset(resolvedInputDir, config);
  const assetIssues = await validateInputDir(resolvedInputDir, config, sourceAsset);
  if (hasErrors(assetIssues)) {
    const failedReport = await buildReport({
      inputDir: resolvedInputDir,
      outputDir: resolvedOutputDir,
      sourceCanvas: { width: sourceAsset.width, height: sourceAsset.height },
      issues: assetIssues
    });
    await writeJsonFile(path.join(resolvedOutputDir, "report.json"), failedReport);
    return failedReport;
  }

  const generatedAssets = await generateAvatarFrameAssets(sourceAsset, outputAssetsDir, config.canvas);
  const expansions = await expandTemplates(config);
  const initialProject = buildProject(config, generatedAssets.assets, expansions);
  const bakedSweep = await applyBakedSweepFrames(initialProject, outputAssetsDir, config.bakedSweep);
  const project = bakedSweep.project;
  const exporter = new JsonExporter();
  const exportResult = await exporter.export(project, resolvedOutputDir);
  const svgaMapPath = await writeSvgaMap(project, resolvedOutputDir);
  const previewPath = await renderPreviewGif(project, resolvedOutputDir);
  const report = await buildReport({
    inputDir: resolvedInputDir,
    outputDir: resolvedOutputDir,
    sourceCanvas: { width: sourceAsset.width, height: sourceAsset.height },
    issues: assetIssues,
    project,
    generatedFiles: [...generatedAssets.files, ...bakedSweep.files],
    projectJsonPath: exportResult.outputPath,
    previewPath,
    svgaMapPath,
    bakedSweepFrameCount: bakedSweep.frameCount,
    bakedSweepFrameStride: bakedSweep.frameStride,
    bakedSweepRawFrameCount: bakedSweep.rawFrameCount,
    bakedSweepSampledFrameCount: bakedSweep.sampledFrameCount,
    bakedSweepTransparentFrameCount: bakedSweep.transparentFrameCount,
    bakedSweepUniqueAssetCount: bakedSweep.uniqueAssetCount,
    bakedSweepDedupedCount: bakedSweep.dedupedCount,
    bakedSweepAssetSizeBytes: bakedSweep.assetSizeAfterDedup,
    bakedSweepAssetSizeBeforeDedup: bakedSweep.assetSizeBeforeDedup,
    bakedSweepAssetSizeAfterDedup: bakedSweep.assetSizeAfterDedup
  });
  await writeJsonFile(path.join(resolvedOutputDir, "report.json"), report);
  return report;
}

function applyBuildOverrides(config: AssetConfig, options: BuildCommandOptions): AssetConfig {
  if (!options.sweepStride) {
    return config;
  }
  return {
    ...config,
    bakedSweep: {
      ...(config.bakedSweep ?? {}),
      frameStride: options.sweepStride
    }
  };
}
