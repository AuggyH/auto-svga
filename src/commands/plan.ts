import path from "node:path";
import { readFile } from "node:fs/promises";
import { ensureDir, writeJsonFile } from "../utils/fs.js";
import { hasErrors } from "../core/validator.js";
import { expandMotionPlan } from "../mvp/template-expander.js";
import { loadMvpJob } from "../mvp/job-loader.js";
import { planMotions } from "../mvp/motion-planner.js";
import { prepareMvpProductionAssets } from "../mvp/production-assets.js";
import { ensureMvpGeneratedAssets } from "../mvp/generated-assets.js";
import type { PlanningResult, ValidationIssue } from "../mvp/types.js";
import type { MvpProject } from "../mvp/types.js";
import { decodeRgbaPng } from "../utils/png-reader.js";

export async function planCommand(jobDir: string): Promise<PlanningResult> {
  const loaded = await loadMvpJob(jobDir);
  const projectDir = path.join(loaded.jobDir, "project");
  const generated: string[] = [];

  if (hasErrors(loaded.issues)) {
    return {
      jobName: loaded.jobName,
      jobDir: loaded.jobDir,
      config: loaded.config,
      structure: loaded.structure,
      motionPlan: emptyMotionPlan(loaded.config),
      project: emptyProject(loaded.config),
      issues: loaded.issues,
      generated
    };
  }

  const productionAssets = await prepareMvpProductionAssets(loaded.jobDir, loaded.config, loaded.structure);
  generated.push(...productionAssets.generated);
  const motionPlan = planMotions(loaded.config, productionAssets.structure);
  let resolvedConfig = { ...loaded.config };
  let expansion = expandMotionPlan(resolvedConfig, productionAssets.structure, motionPlan);
  let generatedAssets = await ensureMvpGeneratedAssets(loaded.jobDir, expansion.project);
  generated.push(...generatedAssets.generated);
  const optimizationActions: string[] = [];
  const budgetWarnings: string[] = [];
  const maxDecodedBytes = (loaded.config.maxDecodedImageMB ?? 8) * 1024 * 1024;
  let decodedBytes = await estimateDecodedBytes(loaded.jobDir, expansion.project);

  if (decodedBytes > maxDecodedBytes && (expansion.project.sweepFrameStride ?? 3) < 4) {
    const previousStride = expansion.project.sweepFrameStride ?? 3;
    resolvedConfig = { ...resolvedConfig, sweepFrameStride: 4 };
    optimizationActions.push(`sweepFrameStride changed from ${previousStride} to 4`);
    expansion = expandMotionPlan(resolvedConfig, productionAssets.structure, motionPlan);
    generatedAssets = await ensureMvpGeneratedAssets(loaded.jobDir, expansion.project);
    generated.push(...generatedAssets.generated);
    decodedBytes = await estimateDecodedBytes(loaded.jobDir, expansion.project);
  }
  if (decodedBytes > maxDecodedBytes && (expansion.project.effectResolutionScale ?? 1) > 0.5) {
    resolvedConfig = { ...resolvedConfig, effectResolutionScale: 0.5 };
    optimizationActions.push("effectResolutionScale changed to 0.5");
    expansion = expandMotionPlan(resolvedConfig, productionAssets.structure, motionPlan);
    generatedAssets = await ensureMvpGeneratedAssets(loaded.jobDir, expansion.project);
    generated.push(...generatedAssets.generated);
    decodedBytes = await estimateDecodedBytes(loaded.jobDir, expansion.project);
  }
  if (decodedBytes > maxDecodedBytes) {
    const sweepLayers = expansion.project.layers.filter((layer) => layer.maskMode === "baked_sweep_frames");
    expansion.project.layers = expansion.project.layers.filter((layer) => layer.maskMode !== "baked_sweep_frames")
      .concat(sweepLayers.filter((_, index) => index % 2 === 0))
      .sort((a, b) => a.zIndex - b.zIndex);
    optimizationActions.push("sweep visible frames reduced by half");
    decodedBytes = await estimateDecodedBytes(loaded.jobDir, expansion.project);
  }
  if (decodedBytes > maxDecodedBytes) {
    expansion.project.layers = expansion.project.layers.filter((layer) => layer.maskMode !== "baked_sweep_frames");
    optimizationActions.push("metal sweep disabled due to decoded image memory budget");
    budgetWarnings.push("metalSweepDisabledDueToMemoryBudget = true");
  }
  expansion.project.optimizationActions = optimizationActions;
  expansion.project.warnings = [...productionAssets.warnings, ...generatedAssets.warnings, ...budgetWarnings];
  const issues: ValidationIssue[] = [...loaded.issues, ...expansion.issues];

  if (!hasErrors(issues)) {
    await ensureDir(projectDir);
    const motionPlanPath = path.join(projectDir, "motion-plan.json");
    const projectPath = path.join(projectDir, "project.json");
    await writeJsonFile(motionPlanPath, motionPlan);
    await writeJsonFile(projectPath, expansion.project);
    generated.push(motionPlanPath, projectPath);
  }

  return {
    jobName: loaded.jobName,
    jobDir: loaded.jobDir,
    config: loaded.config,
    structure: productionAssets.structure,
    motionPlan,
    project: expansion.project,
    issues,
    generated
  };
}

async function estimateDecodedBytes(jobDir: string, project: MvpProject): Promise<number> {
  let total = 0;
  for (const source of new Set(project.layers.map((layer) => layer.source))) {
    try {
      const image = decodeRgbaPng(await readFile(path.join(jobDir, source)));
      total += image.width * image.height * 4;
    } catch {
      // Missing sources are reported by the generated asset and export stages.
    }
  }
  return total;
}

function emptyMotionPlan(config: { durationMs?: number; fps?: number }) {
  return {
    assetType: "avatar_frame" as const,
    motionStyle: "luxury_subtle_loop" as const,
    durationMs: Number(config.durationMs) || 0,
    fps: Number(config.fps) || 0,
    rules: {
      protectSafeArea: true,
      avoidLargeMotion: true,
      loopSeamless: true,
      smallSizeReadable: true
    },
    effects: []
  };
}

function emptyProject(config: { canvas?: { width?: number; height?: number }; fps?: number; durationMs?: number }) {
  return {
    version: "0.1.0" as const,
    assetType: "avatar_frame" as const,
    canvas: {
      width: Number(config.canvas?.width) || 0,
      height: Number(config.canvas?.height) || 0
    },
    fps: Number(config.fps) || 0,
    durationMs: Number(config.durationMs) || 0,
    frames: 0,
    layers: [],
    warnings: []
  };
}
