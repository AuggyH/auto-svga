import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createAvatarFrameInspectionService } from "../dist/hosts/avatar-frame-inspection.js";

const DEFAULT_THRESHOLD = 0.5;
const STATUSES = ["known", "fullyTransparent", "opaqueOnly", "unknown", "unsupported"];
const ROLES = [
  "static_image",
  "sequence_frame",
  "baked_sweep_frame",
  "mask_or_matte",
  "unknown"
];

export async function calibrateAvatarFrameAlphaBounds(
  inputPaths,
  { cwd = process.cwd(), threshold = DEFAULT_THRESHOLD } = {}
) {
  if (inputPaths.length === 0) {
    throw new Error("Provide at least one avatar-frame .svga path.");
  }

  const uniqueInputs = [];
  const duplicateInputs = [];
  const seenHashes = new Map();

  for (const inputPath of inputPaths) {
    const absolutePath = path.resolve(cwd, inputPath);
    const bytes = await readFile(absolutePath);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const normalizedPath = normalizePath(path.relative(cwd, absolutePath));
    const originalPath = seenHashes.get(sha256);
    if (originalPath) {
      duplicateInputs.push({ path: normalizedPath, duplicateOf: originalPath, sha256 });
      continue;
    }
    seenHashes.set(sha256, normalizedPath);
    uniqueInputs.push({ absolutePath, path: normalizedPath, bytes, sha256 });
  }

  const service = createAvatarFrameInspectionService();
  const samples = [];
  for (const input of uniqueInputs) {
    const fileStats = await stat(input.absolutePath);
    const result = await service.inspect({
      id: `file:${input.path}`,
      name: path.basename(input.path),
      sizeBytes: fileStats.size,
      mediaType: "application/octet-stream",
      async read() {
        return input.bytes;
      }
    });
    if (!result.value) {
      throw new Error(
        `Inspection failed for ${input.path}: ${result.issues.map(({ message }) => message).join("; ")}`
      );
    }
    samples.push(summarizeSample(input.path, input.sha256, result.value, threshold));
  }

  return {
    threshold,
    inputCount: inputPaths.length,
    uniqueSampleCount: samples.length,
    duplicateInputs,
    aggregate: summarizeResources(samples.flatMap(({ resources }) => resources), threshold),
    samples
  };
}

export function summarizeResources(resources, threshold = DEFAULT_THRESHOLD) {
  const statusCounts = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  const ratios = [];
  const overThresholdResources = [];
  const fullyTransparentResources = [];

  for (const resource of resources) {
    const status = resource.alphaBounds?.status ?? "unknown";
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    if (status === "known" && Number.isFinite(resource.alphaBounds.transparentPaddingRatio)) {
      const ratio = resource.alphaBounds.transparentPaddingRatio;
      ratios.push(ratio);
      if (ratio > threshold) {
        overThresholdResources.push(resource);
      }
    } else if (status === "opaqueOnly") {
      ratios.push(0);
    } else if (status === "fullyTransparent") {
      fullyTransparentResources.push(resource);
    }
  }

  return {
    resourceCount: resources.length,
    statusCounts,
    roleCounts: countRoles(resources),
    roleStats: summarizeRoles(resources, threshold),
    ratioStats: ratioStats(ratios),
    overThresholdResources: overThresholdResources.map(resourceSummary),
    fullyTransparentResources: fullyTransparentResources.map(resourceSummary)
  };
}

function summarizeSample(samplePath, sha256, asset, threshold) {
  const resources = asset.resources.map((resource) => ({
    samplePath,
    id: resource.id,
    name: resource.name,
    role: resource.role ?? "unknown",
    sizeBytes: resource.sizeBytes,
    dimensions: resource.dimensions,
    alphaBounds: resource.alphaBounds ?? { status: "unknown" }
  }));
  return {
    path: samplePath,
    sha256,
    sizeBytes: asset.sizeBytes,
    dimensions: asset.dimensions,
    timing: asset.timing,
    ...summarizeResources(resources, threshold),
    resources
  };
}

function countRoles(resources) {
  const counts = Object.fromEntries(ROLES.map((role) => [role, 0]));
  for (const resource of resources) {
    const role = resource.role ?? "unknown";
    counts[role] = (counts[role] ?? 0) + 1;
  }
  return counts;
}

function summarizeRoles(resources, threshold) {
  return Object.fromEntries(ROLES.map((role) => {
    const roleResources = resources.filter((resource) => (resource.role ?? "unknown") === role);
    const ratios = roleResources.flatMap((resource) => {
      if (resource.alphaBounds?.status === "opaqueOnly") {
        return [0];
      }
      const ratio = resource.alphaBounds?.transparentPaddingRatio;
      return resource.alphaBounds?.status === "known" && Number.isFinite(ratio)
        ? [ratio]
        : [];
    });
    return [role, {
      resourceCount: roleResources.length,
      ratioStats: ratioStats(ratios),
      overThresholdCount: roleResources.filter((resource) => (
        resource.alphaBounds?.status === "known"
        && resource.alphaBounds.transparentPaddingRatio > threshold
      )).length,
      fullyTransparentCount: roleResources.filter((resource) => (
        resource.alphaBounds?.status === "fullyTransparent"
      )).length
    }];
  }));
}

function ratioStats(values) {
  if (values.length === 0) {
    return { count: 0, min: null, max: null, average: null, median: null };
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
  return {
    count: sorted.length,
    min: round(sorted[0]),
    max: round(sorted.at(-1)),
    average: round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
    median: round(median)
  };
}

function resourceSummary(resource) {
  return {
    samplePath: resource.samplePath,
    id: resource.id,
    role: resource.role ?? "unknown",
    dimensions: resource.dimensions,
    sizeBytes: resource.sizeBytes,
    alphaBounds: resource.alphaBounds
  };
}

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function round(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

async function main() {
  const report = await calibrateAvatarFrameAlphaBounds(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
