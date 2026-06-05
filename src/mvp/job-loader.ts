import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { MvpConfig, MvpStructure, ValidationIssue } from "./types.js";
import { readJsonFile } from "../utils/fs.js";

export interface LoadedMvpJob {
  jobDir: string;
  jobName: string;
  config: MvpConfig;
  structure: MvpStructure;
  requirement?: string;
  issues: ValidationIssue[];
}

export async function loadMvpJob(jobDir: string): Promise<LoadedMvpJob> {
  const resolvedJobDir = path.resolve(jobDir);
  const configPath = path.join(resolvedJobDir, "input", "config.json");
  const structurePath = path.join(resolvedJobDir, "input", "structure.json");
  const requirementPath = path.join(resolvedJobDir, "input", "requirement.txt");
  const issues: ValidationIssue[] = [];

  const config = await readJsonFile<unknown>(configPath);
  const structure = await readJsonFile<unknown>(structurePath);
  const requirement = await readOptionalText(requirementPath);

  issues.push(...validateConfig(config));
  issues.push(...await validateStructure(structure, resolvedJobDir));

  if (isRecord(config) && isRecord(structure)) {
    const configCanvas = config.canvas;
    const structureCanvas = structure.canvas;
    if (isRecord(configCanvas) && isRecord(structureCanvas)
      && (configCanvas.width !== structureCanvas.width || configCanvas.height !== structureCanvas.height)) {
      issues.push({
        level: "warning",
        code: "CANVAS_MISMATCH",
        message: "structure.canvas differs from config.canvas.",
        path: "input/structure.json.canvas"
      });
    }
  }

  return {
    jobDir: resolvedJobDir,
    jobName: path.basename(resolvedJobDir),
    config: config as MvpConfig,
    structure: structure as MvpStructure,
    requirement,
    issues
  };
}

export function validateConfig(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return [{ level: "error", code: "CONFIG_INVALID", message: "config.json must be an object.", path: "input/config.json" }];
  }
  if (value.assetType !== "avatar_frame") {
    issues.push({ level: "error", code: "CONFIG_ASSET_TYPE", message: "assetType must be avatar_frame.", path: "input/config.json.assetType" });
  }
  if (!isPositiveNumber(readPath(value, ["canvas", "width"]))) {
    issues.push({ level: "error", code: "CONFIG_CANVAS_WIDTH", message: "canvas.width must be a positive number.", path: "input/config.json.canvas.width" });
  }
  if (!isPositiveNumber(readPath(value, ["canvas", "height"]))) {
    issues.push({ level: "error", code: "CONFIG_CANVAS_HEIGHT", message: "canvas.height must be a positive number.", path: "input/config.json.canvas.height" });
  }
  if (!isPositiveNumber(value.fps)) {
    issues.push({ level: "error", code: "CONFIG_FPS", message: "fps must be a positive number.", path: "input/config.json.fps" });
  }
  if (!isPositiveNumber(value.durationMs)) {
    issues.push({ level: "error", code: "CONFIG_DURATION", message: "durationMs must be a positive number.", path: "input/config.json.durationMs" });
  }
  if (typeof value.outputName !== "string" || value.outputName.length === 0) {
    issues.push({ level: "error", code: "CONFIG_OUTPUT_NAME", message: "outputName must exist.", path: "input/config.json.outputName" });
  }
  return issues;
}

export async function validateStructure(value: unknown, jobDir: string): Promise<ValidationIssue[]> {
  const issues = validateStructureShape(value);
  if (!isRecord(value) || !Array.isArray(value.parts)) {
    return issues;
  }
  await Promise.all(value.parts.map(async (part, index) => {
    if (!isRecord(part) || typeof part.source !== "string") return;
    try {
      await access(path.join(jobDir, part.source));
    } catch {
      issues.push({
        level: "warning",
        code: "PART_SOURCE_MISSING",
        message: `part.source does not exist: ${part.source}`,
        path: `input/structure.json.parts[${index}].source`
      });
    }
  }));
  return issues;
}

export function validateStructureShape(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return [{ level: "error", code: "STRUCTURE_INVALID", message: "structure.json must be an object.", path: "input/structure.json" }];
  }
  if (value.assetType !== "avatar_frame") {
    issues.push({ level: "error", code: "STRUCTURE_ASSET_TYPE", message: "assetType must be avatar_frame.", path: "input/structure.json.assetType" });
  }
  if (value.inputMode !== "layered") {
    issues.push({ level: "error", code: "STRUCTURE_INPUT_MODE", message: "inputMode currently only supports layered.", path: "input/structure.json.inputMode" });
  }
  if (!isRecord(value.safeArea)) {
    issues.push({ level: "error", code: "STRUCTURE_SAFE_AREA", message: "safeArea must exist.", path: "input/structure.json.safeArea" });
  }
  if (!Array.isArray(value.parts)) {
    issues.push({ level: "error", code: "STRUCTURE_PARTS", message: "parts must be an array.", path: "input/structure.json.parts" });
    return issues;
  }

  value.parts.forEach((part, index) => {
    const basePath = `input/structure.json.parts[${index}]`;
    if (!isRecord(part)) {
      issues.push({ level: "error", code: "PART_INVALID", message: "part must be an object.", path: basePath });
      return;
    }
    for (const key of ["id", "type", "source"]) {
      if (typeof part[key] !== "string" || part[key].length === 0) {
        issues.push({ level: "error", code: "PART_REQUIRED", message: `part.${key} is required.`, path: `${basePath}.${key}` });
      }
    }
    if (!isValidBbox(part.bbox)) {
      issues.push({ level: "error", code: "PART_BBOX", message: "bbox must be [x1, y1, x2, y2].", path: `${basePath}.bbox` });
    }
    if (!isRecord(part.anchor)) {
      issues.push({ level: "error", code: "PART_ANCHOR", message: "anchor is required.", path: `${basePath}.anchor` });
    } else {
      if (!isPositiveOrZeroNumber(part.anchor.x) || !isPositiveOrZeroNumber(part.anchor.y)) {
        issues.push({ level: "error", code: "PART_ANCHOR_COORDS", message: "anchor.x and anchor.y must be numbers.", path: `${basePath}.anchor` });
      }
      if (part.anchor.space !== "canvas") {
        issues.push({ level: "error", code: "PART_ANCHOR_SPACE", message: "anchor.space currently only supports canvas.", path: `${basePath}.anchor.space` });
      }
    }
    if (typeof part.zIndex !== "number") {
      issues.push({ level: "error", code: "PART_Z_INDEX", message: "zIndex is required.", path: `${basePath}.zIndex` });
    }
  });
  return issues;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isPositiveOrZeroNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isValidBbox(value: unknown): value is [number, number, number, number] {
  return Array.isArray(value) && value.length === 4 && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

function readPath(value: Record<string, unknown>, keys: string[]): unknown {
  let current: unknown = value;
  for (const key of keys) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

async function readOptionalText(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}
