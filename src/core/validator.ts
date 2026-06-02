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
  await validateSource(inputDir, config.source, issues);
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

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.level === "error");
}

function validateCanvas(value: unknown, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ level: "error", code: "INVALID_CANVAS", message: "canvas is required.", path: "canvas" });
    return;
  }

  for (const key of ["width", "height", "fps", "durationMs"] as const) {
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

  if (Number(value.durationMs) < 500) {
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
