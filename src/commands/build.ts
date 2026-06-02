import path from "node:path";
import type { AssetConfig } from "../types/config.js";
import type { BuildReport } from "../types/report.js";
import { copyGeneratedAssets, loadAvatarFrameAsset } from "../core/asset-loader.js";
import { buildProject } from "../core/project-builder.js";
import { applyTemplates } from "../core/template-engine.js";
import { hasErrors, validateInputDir } from "../core/validator.js";
import { renderPreviewGif } from "../preview/preview-renderer.js";
import { ensureDir, readJsonFile, toPosixPath, writeJsonFile } from "../utils/fs.js";

export async function buildCommand(inputDir: string, outputDir?: string): Promise<BuildReport> {
  const resolvedInputDir = path.resolve(inputDir);
  const resolvedOutputDir = path.resolve(outputDir ?? path.join(resolvedInputDir, "output"));
  const configPath = path.join(resolvedInputDir, "asset.config.json");
  await ensureDir(resolvedOutputDir);
  await ensureDir(path.join(resolvedOutputDir, "assets"));

  const rawConfig = await readJsonFile<unknown>(configPath);
  const initialIssues = await validateInputDir(resolvedInputDir, rawConfig);

  const report: BuildReport = {
    ok: !hasErrors(initialIssues),
    generatedAt: new Date().toISOString(),
    inputDir: resolvedInputDir,
    outputDir: resolvedOutputDir,
    issues: initialIssues,
    outputs: {}
  };

  if (!report.ok) {
    await writeJsonFile(path.join(resolvedOutputDir, "report.json"), report);
    return report;
  }

  const config = rawConfig as AssetConfig;
  const asset = await loadAvatarFrameAsset(resolvedInputDir, config);
  const assetIssues = await validateInputDir(resolvedInputDir, config, asset);
  report.issues = assetIssues;
  report.ok = !hasErrors(assetIssues);
  if (!report.ok) {
    await writeJsonFile(path.join(resolvedOutputDir, "report.json"), report);
    return report;
  }

  const copiedAssetPath = await copyGeneratedAssets(asset, path.join(resolvedOutputDir, "assets"));
  const templates = await applyTemplates(config);
  const project = buildProject(config, asset, templates);
  const projectPath = path.join(resolvedOutputDir, "project.json");
  await writeJsonFile(projectPath, project);

  const previewPath = await renderPreviewGif(project, resolvedOutputDir);

  report.outputs = {
    projectJson: toPosixPath(path.relative(resolvedOutputDir, projectPath)),
    preview: toPosixPath(path.relative(resolvedOutputDir, previewPath)),
    assets: [toPosixPath(path.relative(resolvedOutputDir, copiedAssetPath))]
  };

  await writeJsonFile(path.join(resolvedOutputDir, "report.json"), report);
  return report;
}
