#!/usr/bin/env node
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../../../..");
const defaultMaterialRoot = "/Users/huangtengxin/Downloads/auto-svga测试物料";
const materialRoot = process.argv[2] || defaultMaterialRoot;
const maxDepth = 3;
const maxFiles = 500;

const moduleUrl = pathToFileURL(
  path.join(repoRoot, "dist/workbench/multiformat-asset-qualification.js")
).href;
const { buildMultiFormatQualificationReadinessMatrix } = await import(moduleUrl);

const candidates = [];
let rootExists = false;
let scannedDirectories = 0;
let scanTruncated = false;

try {
  const stat = statSync(materialRoot);
  rootExists = stat.isDirectory();
  if (rootExists) scanDirectory(materialRoot, 0);
} catch {
  rootExists = false;
}

const matrix = buildMultiFormatQualificationReadinessMatrix(candidates);
console.log(JSON.stringify({
  schemaVersion: 1,
  source: "wp7-read-only-local-material-qualification-harness",
  materialRootRedacted: true,
  rootExists,
  scannedDirectories,
  scannedFileCount: candidates.length,
  scanTruncated,
  noContentRead: true,
  noAssetCopy: true,
  noMutation: true,
  foregroundRequired: false,
  matrix
}, null, 2));

function scanDirectory(directory, depth) {
  if (depth > maxDepth || candidates.length >= maxFiles) {
    scanTruncated = true;
    return;
  }
  scannedDirectories += 1;
  let entries = [];
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (candidates.length >= maxFiles) {
      scanTruncated = true;
      return;
    }
    if (entry.name.startsWith(".")) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(entryPath, depth + 1);
      continue;
    }
    if (!entry.isFile()) continue;
    let sizeBytes;
    try {
      sizeBytes = statSync(entryPath).size;
    } catch {
      sizeBytes = undefined;
    }
    candidates.push({
      displayName: entry.name,
      ...(Number.isFinite(sizeBytes) ? { sizeBytes } : {})
    });
  }
}
