#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const slash = "/";
const windowsDrivePathTextPattern = "[A-Za-z]:\\\\+(?:Users\\\\+)?[^\\\\\\s\"'`]+";
const uncPathTextPattern = "\\\\{2,}[A-Za-z0-9_.-]{2,}\\\\+[A-Za-z0-9_.-]{2,}";
const localPathTextPattern = String.raw`(?:${slash}${"Users"}${slash}|${slash}private${slash}|${slash}var${slash}folders${slash}|${slash}tmp${slash}|${windowsDrivePathTextPattern}|${uncPathTextPattern})`;
const localPathPattern = new RegExp(String.raw`(?:^|[^A-Za-z0-9_.-])${localPathTextPattern}`);
const markdownLinkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
const zipNamePattern = /\.zip$/i;

const sealedFileNames = [
  "REVIEW_PACKET.md",
  "validation.json",
  "budget-check.json",
  "reviewer-a.json",
  "reviewer-b.json",
  "post-seal-verification.json"
];

function addError(errors, message) {
  if (!errors.includes(message)) errors.push(message);
}

async function fileSha256(filePath) {
  const data = await readFile(filePath);
  return createHash("sha256").update(data).digest("hex");
}

async function fileSize(filePath) {
  return (await stat(filePath)).size;
}

async function readTextIfExists(filePath) {
  if (!existsSync(filePath)) return "";
  return await readFile(filePath, "utf8");
}

async function walkFiles(root) {
  const entries = [];
  async function visit(current) {
    const stats = await lstat(current);
    if (stats.isDirectory()) {
      for (const entry of await readdir(current)) {
        await visit(path.join(current, entry));
      }
      return;
    }
    entries.push(current);
  }
  if (existsSync(root)) await visit(root);
  return entries;
}

function parseMarkdownLinks(text) {
  const links = [];
  for (const match of text.matchAll(markdownLinkPattern)) {
    links.push(match[1]);
  }
  return links;
}

function hasZip(files) {
  return files.some((filePath) => path.basename(filePath).endsWith(".zip"));
}

function isForbiddenZipEntryName(filePath) {
  return filePath.includes("__MACOSX") || path.basename(filePath) === ".DS_Store";
}

async function validateNoLocalPaths(folder, errors) {
  for (const filePath of await walkFiles(folder)) {
    if (!/\.(md|json|txt|patch|html|js|mjs|cjs|css)$/i.test(filePath)) continue;
    if (path.basename(filePath) === "FINAL_RESPONSE.txt") continue;
    const text = await readTextIfExists(filePath);
    if (localPathPattern.test(text)) {
      addError(errors, `visible handoff file contains a local absolute path: ${path.relative(folder, filePath)}`);
    }
  }
}

function zipEntries(zipPath) {
  const result = spawnSync("unzip", ["-Z1", zipPath], { encoding: "utf8" });
  if (result.status !== 0) return { status: "fail", entries: [], error: result.stderr || result.stdout };
  return { status: "pass", entries: result.stdout.split("\n").filter(Boolean).sort() };
}

function resolveVisibleLink(folder, link) {
  if (/^[a-z]+:/i.test(link)) return null;
  const cleanLink = link.split("#")[0].split("?")[0];
  const resolved = path.isAbsolute(cleanLink)
    ? path.resolve(cleanLink)
    : path.resolve(folder, cleanLink);
  const relative = path.relative(folder, resolved);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return resolved;
}

async function validateMarkdownLinkTargets(folder, finalResponse, errors) {
  for (const link of parseMarkdownLinks(finalResponse)) {
    const target = resolveVisibleLink(folder, link);
    if (!target || !existsSync(target)) {
      addError(errors, `FINAL_RESPONSE.txt link target is missing or outside visible folder: ${link}`);
    }
  }
}

async function validateZipPrivacy(zipPath, errors) {
  const result = zipEntries(zipPath);
  if (result.status !== "pass") {
    addError(errors, `unable to inspect ZIP entries: ${path.basename(zipPath)}`);
    return [];
  }
  for (const entry of result.entries) {
    if (entry.includes("__MACOSX") || path.basename(entry) === ".DS_Store") {
      addError(errors, `ZIP contains forbidden archive metadata: ${path.basename(zipPath)}:${entry}`);
    }
    if (new RegExp(localPathTextPattern).test(entry)) {
      addError(errors, `ZIP entry contains local absolute path text: ${path.basename(zipPath)}:${entry}`);
    }
  }
  return result.entries;
}

async function validateWorkerFolder(folder, errors) {
  const required = ["WORKER_HANDOFF.md", "README.md", "worker-result.json"];
  for (const fileName of required) {
    if (!existsSync(path.join(folder, fileName))) addError(errors, `worker folder missing ${fileName}.`);
  }
  for (const forbidden of ["REVIEW_PACKET.md", "FINAL_RESPONSE.txt", "changes.patch"]) {
    if (existsSync(path.join(folder, forbidden))) addError(errors, `worker folder must not contain ${forbidden}.`);
  }
  if (hasZip(await walkFiles(folder))) addError(errors, "worker folder must not contain owner upload ZIPs.");

  if (existsSync(path.join(folder, "worker-result.json"))) {
    const workerResult = JSON.parse(await readFile(path.join(folder, "worker-result.json"), "utf8"));
    for (const field of ["baseCommit", "headCommit", "branch", "changedFiles", "tests"]) {
      if (workerResult[field] === undefined) addError(errors, `worker-result.json missing ${field}.`);
    }
    if (workerResult.workspaceClean !== true) addError(errors, "worker-result.json must record workspaceClean: true.");
  }

  const handoffText = await readTextIfExists(path.join(folder, "WORKER_HANDOFF.md"));
  if (/milestone\s+PASS|milestoneOutcome:\s*PASS|P6\s+PASS/i.test(handoffText)) {
    addError(errors, "worker handoff must not claim milestone PASS.");
  }
}

async function validateByteIdentical({
  visibleFolder,
  canonicalFolder,
  companionRequired,
  errors
}) {
  const requiredSealedFiles = companionRequired
    ? [...sealedFileNames, "changes.patch"]
    : sealedFileNames;

  for (const fileName of requiredSealedFiles) {
    const visiblePath = path.join(visibleFolder, fileName);
    const canonicalPath = path.join(canonicalFolder, fileName);
    if (!existsSync(visiblePath) || !existsSync(canonicalPath)) continue;
    const [visibleSize, canonicalSize, visibleHash, canonicalHash] = await Promise.all([
      fileSize(visiblePath),
      fileSize(canonicalPath),
      fileSha256(visiblePath),
      fileSha256(canonicalPath)
    ]);
    if (visibleSize !== canonicalSize || visibleHash !== canonicalHash) {
      addError(errors, `${fileName} is not byte-identical to canonical sealed packet.`);
    }
  }
}

async function validateTerminalFolder(folder, errors) {
  for (const fileName of ["REVIEW_PACKET.md", "README.md", "FINAL_RESPONSE.txt", "MANIFEST.json"]) {
    if (!existsSync(path.join(folder, fileName))) addError(errors, `terminal folder missing ${fileName}.`);
  }

  const files = await walkFiles(folder);
  if (!hasZip(files)) addError(errors, "terminal folder must include an owner review ZIP.");
  const zipFiles = files.filter((filePath) => zipNamePattern.test(filePath));
  if (!zipFiles.some((filePath) => /^P6-[a-f0-9]+-review-upload\.zip$/i.test(path.basename(filePath)))) {
    addError(errors, "terminal folder must include a P6 owner review ZIP.");
  }
  if (!zipFiles.some((filePath) => /^Auto-SVGA-macOS-internal-[a-f0-9]+\.zip$/i.test(path.basename(filePath)))) {
    addError(errors, "terminal folder must include the macOS App ZIP.");
  }
  for (const filePath of files) {
    if (isForbiddenZipEntryName(filePath)) {
      addError(errors, `terminal folder contains forbidden archive metadata: ${path.relative(folder, filePath)}`);
    }
  }
  for (const zipPath of zipFiles) {
    await validateZipPrivacy(zipPath, errors);
  }

  let manifest = {};
  if (existsSync(path.join(folder, "MANIFEST.json"))) {
    manifest = JSON.parse(await readFile(path.join(folder, "MANIFEST.json"), "utf8"));
  }
  const companionRequired = manifest.companionRequired === true;
  if (companionRequired && !existsSync(path.join(folder, "changes.patch"))) {
    addError(errors, "companionRequired=true but changes.patch is missing.");
  }
  if (!companionRequired && existsSync(path.join(folder, "changes.patch"))) {
    addError(errors, "companionRequired=false but changes.patch exists.");
  }

  const finalResponse = await readTextIfExists(path.join(folder, "FINAL_RESPONSE.txt"));
  const links = parseMarkdownLinks(finalResponse);
  if (!links.some((link) => link.includes("REVIEW_PACKET.md"))) {
    addError(errors, "FINAL_RESPONSE.txt must include a clickable REVIEW_PACKET.md link.");
  }
  if (!links.some((link) => link.endsWith(".zip") || link.includes(".zip#") || link.includes(".zip?"))) {
    addError(errors, "FINAL_RESPONSE.txt must include a clickable owner ZIP link.");
  }
  if (companionRequired && !links.some((link) => link.includes("changes.patch"))) {
    addError(errors, "FINAL_RESPONSE.txt must include a clickable changes.patch link when companionRequired=true.");
  }
  if (finalResponse.includes(".artifacts/loop-handoff")) {
    addError(errors, "FINAL_RESPONSE.txt must not rely on hidden .artifacts/loop-handoff paths.");
  }
  await validateMarkdownLinkTargets(folder, finalResponse, errors);

  const canonicalFolder = manifest?.visibleHandoff?.canonicalPacketRoot;
  if (canonicalFolder) {
    await validateByteIdentical({
      visibleFolder: folder,
      canonicalFolder: path.resolve(folder, canonicalFolder),
      companionRequired,
      errors
    });
  }
}

export async function validateReviewVisibility({
  mode,
  folder
}) {
  const errors = [];
  const absoluteFolder = path.resolve(folder);
  if (!existsSync(absoluteFolder)) {
    errors.push(`handoff folder does not exist: ${folder}`);
    return { schemaVersion: 1, status: "fail", mode, errors };
  }

  if (mode === "worker") {
    await validateWorkerFolder(absoluteFolder, errors);
  } else if (mode === "terminal") {
    await validateTerminalFolder(absoluteFolder, errors);
  } else {
    errors.push("mode must be worker or terminal.");
  }

  await validateNoLocalPaths(absoluteFolder, errors);

  return {
    schemaVersion: 1,
    status: errors.length ? "fail" : "pass",
    mode,
    errors
  };
}

function argValue(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

export async function main() {
  const args = process.argv.slice(2);
  const mode = argValue(args, "--mode");
  const folder = argValue(args, "--folder");
  const result = await validateReviewVisibility({
    mode,
    folder: folder ? path.resolve(repoRoot, folder) : repoRoot
  });
  console.log(`AUTO_SVGA_REVIEW_VISIBILITY_CHECK_RESULT=${JSON.stringify(result)}`);
  process.exitCode = result.status === "pass" ? 0 : 1;
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
