#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const DEFAULT_REQUEST_PATH = "docs/research/fbp-full-archive-request-20260716.json";
const DEFAULT_VALIDATOR_PATH = "tools/figma-archive/validate-fbp-full-archive.mjs";
const RUN_FILE_MAP = [
  ["delivery", ["unattended-r12-delivery/latest/delivery.json"], "fbp/full-archive-delivery/latest/delivery.json"],
  ["hashes", ["unattended-r12-delivery/latest/hashes.json"], "fbp/full-archive-delivery/latest/hashes.json"],
  ["uiuxContextCallback", ["unattended-r12-delivery/latest/uiux-context-callback.json"], "fbp/full-archive-delivery/latest/uiux-context-callback.json"],
  ["progress", [
    "unattended-r12-delivery/latest/progress.json",
    "zero-touch-r12-orchestrator/latest/progress.json",
  ], "fbp/full-archive-delivery/latest/progress.json"],
];

function parseArgs(argv) {
  const args = {
    requestPath: DEFAULT_REQUEST_PATH,
    validatorPath: DEFAULT_VALIDATOR_PATH,
    candidateRunRoot: null,
    packageDir: null,
    apply: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--request") {
      args.requestPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--validator") {
      args.validatorPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--candidate-run-root") {
      args.candidateRunRoot = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--package-dir") {
      args.packageDir = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--apply") {
      args.apply = true;
      continue;
    }
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function usage() {
  return [
    "Usage: node tools/figma-archive/import-fbp-full-archive-candidate.mjs --candidate-run-root <path> [--apply] [--json]",
    "",
    "Dry-runs or imports a complete external FBP 29-target archive candidate into the stable frozen design archive root.",
    "Default mode is dry-run and writes nothing. --apply refuses partial candidates and refuses to overwrite existing stable archive files.",
  ].join("\n");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function existsDirectory(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function fileSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function fileByteLength(filePath) {
  return fs.statSync(filePath).size;
}

function listDirectories(directoryPath) {
  try {
    return fs.readdirSync(directoryPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function listFilesRecursive(rootPath) {
  const results = [];
  const visit = (directoryPath) => {
    for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }
      if (entry.isFile()) {
        results.push(entryPath);
      }
    }
  };
  visit(rootPath);
  return results.sort();
}

function findPackageZip(packageDir) {
  const zipPath = path.join(packageDir, "figma-handoff-package.zip");
  return existsFile(zipPath) ? zipPath : null;
}

function runZipTool(command, args) {
  const child = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (child.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${child.stderr || child.stdout}`);
  }
  return child.stdout;
}

function assertSafeZipEntry(entryPath) {
  if (!entryPath || entryPath.endsWith("/")) {
    throw new Error(`unsafe or directory zip entry: ${entryPath}`);
  }
  if (path.isAbsolute(entryPath) || /^[A-Za-z]:/u.test(entryPath) || entryPath.includes("\0")) {
    throw new Error(`unsafe absolute zip entry: ${entryPath}`);
  }
  const normalized = path.posix.normalize(entryPath);
  if (normalized !== entryPath || normalized.startsWith("../") || normalized === "..") {
    throw new Error(`unsafe traversing zip entry: ${entryPath}`);
  }
}

function listZipEntries(zipPath) {
  const stdout = runZipTool("zipinfo", ["-1", zipPath]);
  return stdout.split(/\r?\n/u).filter(Boolean).sort().map((entryPath) => {
    assertSafeZipEntry(entryPath);
    return entryPath;
  });
}

function zipEntryBytes(zipPath, entryPath) {
  assertSafeZipEntry(entryPath);
  const child = spawnSync("unzip", ["-p", zipPath, entryPath], {
    encoding: null,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (child.status !== 0) {
    throw new Error(`unzip -p failed for ${entryPath}: ${child.error?.message || String(child.stderr || child.stdout)}`);
  }
  return Buffer.from(child.stdout);
}

function packageSourceFiles(packageDir) {
  const zipPath = findPackageZip(packageDir);
  if (zipPath) {
    const zipBytes = fs.readFileSync(zipPath);
    return [{
      sourcePath: zipPath,
      zipPath: null,
      zipEntryPath: null,
      relPath: "figma-handoff-package.zip",
      sha256: crypto.createHash("sha256").update(zipBytes).digest("hex"),
      byteLength: zipBytes.byteLength,
    }, ...listZipEntries(zipPath).map((relPath) => {
      const bytes = zipEntryBytes(zipPath, relPath);
      return {
        sourcePath: `${zipPath}!/${relPath}`,
        zipPath,
        zipEntryPath: relPath,
        relPath,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
        byteLength: bytes.byteLength,
      };
    })];
  }
  return listFilesRecursive(packageDir).map((filePath) => ({
    sourcePath: filePath,
    zipPath: null,
    zipEntryPath: null,
    relPath: path.relative(packageDir, filePath),
    sha256: fileSha256(filePath),
    byteLength: fileByteLength(filePath),
  }));
}

function findDeliveryTargets(delivery) {
  return Array.isArray(delivery?.targets) ? delivery.targets : [];
}

function getTargetId(deliveryTarget) {
  const target = deliveryTarget?.target && typeof deliveryTarget.target === "object" ? deliveryTarget.target : {};
  for (const value of [
    deliveryTarget?.targetId,
    deliveryTarget?.targetSlug,
    deliveryTarget?.slug,
    target.targetId,
    target.targetSlug,
    target.slug,
  ]) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

function makeCopyPlan(request, candidateRunRoot, candidatePackageDir) {
  const errors = [];
  const warnings = [];
  const expectedSlugs = request.targets.map((target) => target.slug);
  const expectedSlugSet = new Set(expectedSlugs);

  if (!existsDirectory(candidateRunRoot)) {
    errors.push(`candidate run root missing: ${candidateRunRoot}`);
  }
  if (!existsDirectory(candidatePackageDir)) {
    errors.push(`candidate package directory missing: ${candidatePackageDir}`);
  }

  const runFiles = RUN_FILE_MAP.map(([key, sourceRelPaths, destRelPath]) => {
    const sourcePath = sourceRelPaths
      .map((relPath) => path.join(candidateRunRoot, relPath))
      .find((filePath) => existsFile(filePath))
      || path.join(candidateRunRoot, sourceRelPaths[0]);
    const destPath = path.join(request.archiveRoot, destRelPath);
    return {
      key,
      sourceRelPath: path.relative(candidateRunRoot, sourcePath),
      sourceRelPaths,
      destRelPath,
      sourcePath,
      destPath,
      sourceExists: existsFile(sourcePath),
      destExists: existsFile(destPath),
      sha256: existsFile(sourcePath) ? fileSha256(sourcePath) : null,
      byteLength: existsFile(sourcePath) ? fileByteLength(sourcePath) : null,
    };
  });

  for (const runFile of runFiles) {
    if (!runFile.sourceExists) {
      errors.push(`candidate run file missing: ${runFile.sourceRelPath}`);
    }
    if (runFile.destExists) {
      errors.push(`stable run file already exists: ${runFile.destRelPath}`);
    }
  }

  const packageDirs = listDirectories(candidatePackageDir);
  const unknownPackageDirs = packageDirs.filter((slug) => !expectedSlugSet.has(slug));
  if (unknownPackageDirs.length > 0) {
    errors.push(`candidate contains unlisted package directories: ${unknownPackageDirs.join(", ")}`);
  }

  let delivery = null;
  const deliveryPath = path.join(candidateRunRoot, "unattended-r12-delivery/latest/delivery.json");
  if (existsFile(deliveryPath)) {
    try {
      delivery = readJson(deliveryPath);
    } catch (error) {
      errors.push(`candidate delivery is invalid JSON: ${error.message}`);
    }
  }

  const deliveryTargetIds = findDeliveryTargets(delivery).map(getTargetId).filter(Boolean);
  const deliveryTargetSet = new Set(deliveryTargetIds);
  if (delivery && deliveryTargetIds.length !== expectedSlugs.length) {
    errors.push(`candidate delivery target count expected ${expectedSlugs.length} got ${deliveryTargetIds.length}`);
  }

  const packages = expectedSlugs.map((slug) => {
    const sourceDir = path.join(candidatePackageDir, slug);
    const destDir = path.join(request.archiveRoot, "fbp/packages", slug);
    const sourceExists = existsDirectory(sourceDir);
    const destExists = existsDirectory(destDir);
    const files = sourceExists ? packageSourceFiles(sourceDir).map((fileInfo) => ({
      ...fileInfo,
      destPath: path.join(destDir, fileInfo.relPath),
    })) : [];
    return {
      slug,
      sourceDir,
      destDir,
      sourceExists,
      destExists,
      deliveryTargetPresent: deliveryTargetSet.has(slug),
      fileCount: files.length,
      files,
    };
  });

  for (const packageUnit of packages) {
    if (!packageUnit.sourceExists) {
      errors.push(`candidate package directory missing: ${packageUnit.slug}`);
    }
    if (packageUnit.destExists) {
      errors.push(`stable package directory already exists: ${packageUnit.slug}`);
    }
    if (delivery && !packageUnit.deliveryTargetPresent) {
      errors.push(`candidate delivery missing target: ${packageUnit.slug}`);
    }
    if (packageUnit.sourceExists) {
      const fileRelPathSet = new Set(packageUnit.files.map((fileInfo) => fileInfo.relPath));
      for (const relPath of request.requiredOutputs.perTargetRequiredFiles) {
        if (!fileRelPathSet.has(relPath)) {
          errors.push(`candidate package ${packageUnit.slug}: required file missing ${relPath}`);
        }
      }
    }
  }

  if (!delivery) {
    warnings.push("candidate delivery JSON was not readable, so delivery target identity could not be fully checked");
  }

  const report = {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    mode: "dry-run",
    requestPath: request.__requestPath,
    archiveRoot: request.archiveRoot,
    candidateRunRoot,
    candidatePackageDir,
    expectedTargetCount: expectedSlugs.length,
    candidatePackageDirCount: packageDirs.length,
    runFiles,
    packageCount: packages.length,
    packages: packages.map((packageUnit) => ({
      slug: packageUnit.slug,
      sourceDir: packageUnit.sourceDir,
      destDir: packageUnit.destDir,
      sourceExists: packageUnit.sourceExists,
      destExists: packageUnit.destExists,
      deliveryTargetPresent: packageUnit.deliveryTargetPresent,
      fileCount: packageUnit.fileCount,
    })),
    totalPackageFileCount: packages.reduce((sum, packageUnit) => sum + packageUnit.fileCount, 0),
    errors,
    warnings,
    readyToApply: errors.length === 0,
  };
  Object.defineProperty(report, "packageFilePlan", {
    value: packages,
    enumerable: false,
  });
  return report;
}

function copyFileWithParents(sourcePath, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(sourcePath, destPath, fs.constants.COPYFILE_EXCL);
}

function writeFileWithParents(bytes, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, bytes, { flag: "wx", mode: 0o600 });
}

function applyPlan(plan) {
  const copied = [];
  try {
    for (const runFile of plan.runFiles) {
      copyFileWithParents(runFile.sourcePath, runFile.destPath);
      copied.push(runFile.destPath);
    }
    for (const packageUnit of plan.packages) {
      const filePlan = plan.packageFilePlan.find((item) => item.slug === packageUnit.slug);
      if (!filePlan) {
        throw new Error(`missing package file plan: ${packageUnit.slug}`);
      }
      for (const fileInfo of filePlan.files) {
        if (fileInfo.zipPath) {
          writeFileWithParents(zipEntryBytes(fileInfo.zipPath, fileInfo.zipEntryPath), fileInfo.destPath);
        } else {
          copyFileWithParents(fileInfo.sourcePath, fileInfo.destPath);
        }
        copied.push(fileInfo.destPath);
      }
    }
  } catch (error) {
    for (const filePath of copied.reverse()) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Best-effort rollback of files copied by this process only.
      }
    }
    throw error;
  }

  return copied;
}

function runValidator(requestPath, validatorPath) {
  const child = spawnSync(process.execPath, [path.resolve(validatorPath), "--request", path.resolve(requestPath), "--json"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  let result = null;
  try {
    result = child.stdout ? JSON.parse(child.stdout) : null;
  } catch {
    result = null;
  }
  return {
    status: child.status,
    stdout: child.stdout,
    stderr: child.stderr,
    result,
  };
}

function printHuman(report) {
  const lines = [];
  lines.push(`FBP full archive candidate import: ${report.readyToApply ? "READY" : "BLOCKED"}`);
  lines.push(`Mode: ${report.mode}`);
  lines.push(`Candidate packages: ${report.candidatePackageDirCount}/${report.expectedTargetCount}`);
  lines.push(`Package files: ${report.totalPackageFileCount}`);
  lines.push(`Run files present: ${report.runFiles.filter((file) => file.sourceExists).length}/${report.runFiles.length}`);
  if (report.errors.length > 0) {
    lines.push("");
    lines.push("Errors:");
    for (const error of report.errors) {
      lines.push(`- ${error}`);
    }
  }
  if (report.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
  }
  if (!report.applied) {
    lines.push("");
    lines.push("No files were copied. Re-run with --apply only after reviewing this dry-run.");
  } else {
    lines.push("");
    lines.push(`Copied files: ${report.copiedFileCount}`);
    lines.push(`Validator status: ${report.validator?.status}`);
    lines.push(`Validator complete: ${report.validator?.result?.complete === true ? "yes" : "no"}`);
  }
  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.candidateRunRoot) {
    throw new Error("--candidate-run-root is required");
  }

  const requestPath = path.resolve(args.requestPath);
  const request = readJson(requestPath);
  request.__requestPath = requestPath;
  const candidateRunRoot = path.resolve(args.candidateRunRoot);
  const candidatePackageDir = path.resolve(args.packageDir || path.join(candidateRunRoot, "zero-touch-r12-orchestrator/packages"));
  const report = makeCopyPlan(request, candidateRunRoot, candidatePackageDir);
  report.mode = args.apply ? "apply" : "dry-run";

  if (args.apply) {
    if (!report.readyToApply) {
      throw new Error("Refusing to apply an incomplete or unsafe FBP archive candidate.");
    }
    const copiedFiles = applyPlan(report);
    report.applied = true;
    report.copiedFileCount = copiedFiles.length;
    report.validator = runValidator(requestPath, args.validatorPath);
    if (report.validator?.result?.complete !== true) {
      throw new Error("Imported candidate failed stable archive validation. Inspect the stable archive before retrying.");
    }
  } else {
    report.applied = false;
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(printHuman(report));
  }
}

try {
  main();
} catch (error) {
  console.error(error?.stack || String(error));
  process.exit(2);
}
