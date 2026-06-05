import path from "node:path";
import { ensureDir, writeJsonFile } from "../utils/fs.js";
import { hasErrors } from "../core/validator.js";
import { expandMotionPlan } from "../mvp/template-expander.js";
import { loadMvpJob } from "../mvp/job-loader.js";
import { planMotions } from "../mvp/motion-planner.js";
import type { PlanningResult, ValidationIssue } from "../mvp/types.js";

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

  const motionPlan = planMotions(loaded.config, loaded.structure);
  const expansion = expandMotionPlan(loaded.config, loaded.structure, motionPlan);
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
    structure: loaded.structure,
    motionPlan,
    project: expansion.project,
    issues,
    generated
  };
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
