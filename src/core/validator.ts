import { access } from "node:fs/promises";
import path from "node:path";
import type { AssetConfig, TemplateId } from "../types/config.js";
import type { ValidationIssue } from "../types/report.js";
import type { LoadedAsset } from "./asset-loader.js";

const supportedTemplates = new Set<TemplateId>(["breathing_glow", "metal_edge_sweep", "gem_twinkle"]);

export async function validateInputDir(inputDir: string, config: unknown, asset?: LoadedAsset): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(config)) {
    return [{ level: "error", code: "CONFIG_NOT_OBJECT", message: "asset.config.json must be a JSON object." }];
  }

  if (config.assetType !== "avatar_frame") {
    issues.push({ level: "error", code: "UNSUPPORTED_ASSET_TYPE", message: "Only assetType avatar_frame is supported.", path: "assetType" });
  }

  if (typeof config.name !== "string" || config.name.trim().length === 0) {
    issues.push({ level: "error", code: "INVALID_NAME", message: "name is required.", path: "name" });
  }

  validateCanvas(config.canvas, issues);
  validateBakedSweep(config.bakedSweep, issues);
  await validateSource(inputDir, config.source, issues);
  validateGemGlints(config.gemGlints, config.canvas, config.templates, issues);
  validateTemplates(config.templates, issues);

  if (asset) {
    if (!asset.hasAlpha) {
      issues.push({ level: "warning", code: "PNG_NO_ALPHA", message: "PNG does not report an alpha channel. Avatar frame input is expected to be transparent." });
    }
    const canvas = config.canvas;
    if (isRecord(canvas) && (asset.width > Number(canvas.width) || asset.height > Number(canvas.height))) {
      issues.push({ level: "warning", code: "ASSET_LARGER_THAN_CANVAS", message: "Frame PNG is larger than the configured canvas." });
    }
  }

  return issues;
}

function validateBakedSweep(value: unknown, issues: ValidationIssue[]): void {
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    issues.push({ level: "error", code: "INVALID_BAKED_SWEEP", message: "bakedSweep must be an object.", path: "bakedSweep" });
    return;
  }
  if (value.frameStride !== undefined && ![1, 2, 3].includes(Number(value.frameStride))) {
    issues.push({ level: "error", code: "INVALID_BAKED_SWEEP_STRIDE", message: "bakedSweep.frameStride must be 1, 2, or 3.", path: "bakedSweep.frameStride" });
  }
  for (const key of ["enabled", "skipTransparentFrames", "dedupeIdenticalFrames"] as const) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") {
      issues.push({ level: "error", code: "INVALID_BAKED_SWEEP_BOOLEAN", message: `bakedSweep.${key} must be a boolean.`, path: `bakedSweep.${key}` });
    }
  }
}

function validateGemGlints(
  value: unknown,
  canvas: unknown,
  templates: unknown,
  issues: ValidationIssue[]
): void {
  const usesGemTemplate = Array.isArray(templates)
    && templates.some((template) => isRecord(template) && template.id === "gem_twinkle" && template.enabled !== false);
  if (!usesGemTemplate) {
    return;
  }

  if (!Array.isArray(value) || value.length === 0) {
    issues.push({
      level: "warning",
      code: "NO_GEM_GLINTS",
      message: "gem_twinkle is enabled but gemGlints is empty. No gem glint layers will be generated.",
      path: "gemGlints"
    });
    return;
  }

  const width = isRecord(canvas) ? Number(canvas.width) : Number.NaN;
  const height = isRecord(canvas) ? Number(canvas.height) : Number.NaN;

  value.forEach((point, index) => {
    if (!isRecord(point)) {
      issues.push({ level: "error", code: "INVALID_GEM_GLINT", message: "gemGlints item must be an object.", path: `gemGlints.${index}` });
      return;
    }
    if (typeof point.id !== "string" || point.id.trim().length === 0) {
      issues.push({ level: "error", code: "INVALID_GEM_GLINT_ID", message: "gemGlints item requires id.", path: `gemGlints.${index}.id` });
    }
    for (const key of ["x", "y", "delayFrame"] as const) {
      if (!Number.isFinite(Number(point[key]))) {
        issues.push({ level: "error", code: "INVALID_GEM_GLINT_VALUE", message: `gemGlints.${index}.${key} must be numeric.`, path: `gemGlints.${index}.${key}` });
      }
    }
    if (Number(point.x) < 0 || Number(point.x) > width || Number(point.y) < 0 || Number(point.y) > height) {
      issues.push({
        level: "warning",
        code: "GEM_GLINT_OUTSIDE_CANVAS",
        message: `gemGlints.${index} is outside the configured canvas.`,
        path: `gemGlints.${index}`
      });
    }
  });
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.level === "error");
}

function validateCanvas(value: unknown, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ level: "error", code: "INVALID_CANVAS", message: "canvas is required.", path: "canvas" });
    return;
  }

  for (const key of ["width", "height", "fps"] as const) {
    if (!Number.isInteger(value[key])) {
      issues.push({ level: "error", code: "INVALID_CANVAS_VALUE", message: `canvas.${key} must be an integer.`, path: `canvas.${key}` });
    }
  }

  if (Number(value.width) < 64 || Number(value.height) < 64) {
    issues.push({ level: "error", code: "CANVAS_TOO_SMALL", message: "canvas width and height must be at least 64.", path: "canvas" });
  }

  if (Number(value.fps) < 12 || Number(value.fps) > 60) {
    issues.push({ level: "error", code: "FPS_OUT_OF_RANGE", message: "canvas.fps must be between 12 and 60.", path: "canvas.fps" });
  }

  const hasDurationFrames = Number.isInteger(value.durationFrames);
  const hasDurationSeconds = typeof value.durationSeconds === "number";
  const hasDurationMs = Number.isInteger(value.durationMs);
  if (!hasDurationFrames && !hasDurationSeconds && !hasDurationMs) {
    issues.push({ level: "error", code: "MISSING_DURATION", message: "canvas.durationFrames is preferred, or provide durationSeconds/durationMs.", path: "canvas.durationFrames" });
  }

  if (hasDurationFrames && Number(value.durationFrames) < 1) {
    issues.push({ level: "error", code: "DURATION_TOO_SHORT", message: "canvas.durationFrames must be at least 1.", path: "canvas.durationFrames" });
  }

  if (hasDurationSeconds && Number(value.durationSeconds) <= 0) {
    issues.push({ level: "error", code: "DURATION_TOO_SHORT", message: "canvas.durationSeconds must be positive.", path: "canvas.durationSeconds" });
  }

  if (hasDurationMs && Number(value.durationMs) < 500) {
    issues.push({ level: "error", code: "DURATION_TOO_SHORT", message: "canvas.durationMs must be at least 500.", path: "canvas.durationMs" });
  }
}

async function validateSource(inputDir: string, value: unknown, issues: ValidationIssue[]): Promise<void> {
  if (!isRecord(value) || typeof value.framePng !== "string") {
    issues.push({ level: "error", code: "INVALID_SOURCE", message: "source.framePng is required.", path: "source.framePng" });
    return;
  }

  const sourcePath = path.resolve(inputDir, value.framePng);
  await access(sourcePath).catch(() => {
    issues.push({ level: "error", code: "MISSING_FRAME_PNG", message: `Frame PNG does not exist: ${value.framePng}`, path: "source.framePng" });
  });
}

function validateTemplates(value: unknown, issues: ValidationIssue[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ level: "error", code: "NO_TEMPLATES", message: "templates must contain at least one template.", path: "templates" });
    return;
  }

  value.forEach((template, index) => {
    if (!isRecord(template) || typeof template.id !== "string") {
      issues.push({ level: "error", code: "INVALID_TEMPLATE", message: "template.id is required.", path: `templates.${index}.id` });
      return;
    }
    if (!supportedTemplates.has(template.id as TemplateId)) {
      issues.push({ level: "error", code: "UNSUPPORTED_TEMPLATE", message: `Unsupported template: ${template.id}`, path: `templates.${index}.id` });
    }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
