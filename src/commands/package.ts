import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { MvpReport } from "../mvp/report-builder.js";
import { pathExists } from "../mvp/report-builder.js";
import { ensurePendingAcceptance } from "./acceptance.js";
import { ensureDir, readJsonFile, writeJsonFile } from "../utils/fs.js";
import { writeZipFile, type ZipFileEntry } from "../utils/zip.js";

const REQUIRED_FILES = [
  "output/avatar_frame_test_001.svga",
  "output/report.json",
  "output/svga-map.json",
  "project/project.json",
  "project/motion-plan.json",
  "input/config.json",
  "input/structure.json"
] as const;

const OPTIONAL_FILES = [
  "output/preview.webm",
  "output/preview.mp4",
  "output/preview.gif",
  "output/preview-report.json",
  "output/review_frames_contact_sheet.png",
  "output/acceptance.json",
  "input/requirement.txt"
] as const;

export interface MvpPackageCommandResult {
  mode: "mvp";
  jobName: string;
  includedFiles: string[];
  deliveryPath: string;
  sizeBytes: number;
  reportPath: string;
  report: MvpReport;
}

export async function packageCommand(jobDir: string): Promise<MvpPackageCommandResult> {
  const resolvedJobDir = path.resolve(jobDir);
  await ensurePendingAcceptance(resolvedJobDir);
  const reportPath = "output/report.json";
  const report = await readJsonFile<MvpReport>(path.join(resolvedJobDir, reportPath));
  const svgaPath = report.output.svga ?? `output/${path.basename(resolvedJobDir)}.svga`;
  const requiredFiles = REQUIRED_FILES.map((file) => file.endsWith("avatar_frame_test_001.svga") ? svgaPath : file);
  await assertRequiredFiles(resolvedJobDir, requiredFiles);

  const includedFiles = [
    ...requiredFiles,
    ...await existingFiles(resolvedJobDir, OPTIONAL_FILES),
    ...await generatedPngFiles(resolvedJobDir)
  ].filter((file, index, values) => values.indexOf(file) === index);
  const deliveryPath = "output/delivery.zip";
  const absoluteDeliveryPath = path.join(resolvedJobDir, deliveryPath);
  await ensureDir(path.dirname(absoluteDeliveryPath));

  let updatedReport = {
    ...report,
    output: {
      ...report.output,
      deliveryZip: deliveryPath,
      acceptance: "output/acceptance.json"
    },
    delivery: {
      sizeBytes: 0,
      includedFiles
    }
  };
  await writeJsonFile(path.join(resolvedJobDir, reportPath), updatedReport);
  await writeZipFile(absoluteDeliveryPath, toZipEntries(resolvedJobDir, includedFiles));
  updatedReport.delivery.sizeBytes = (await stat(absoluteDeliveryPath)).size;
  await writeJsonFile(path.join(resolvedJobDir, reportPath), updatedReport);
  await writeZipFile(absoluteDeliveryPath, toZipEntries(resolvedJobDir, includedFiles));
  const sizeBytes = (await stat(absoluteDeliveryPath)).size;
  updatedReport.delivery.sizeBytes = sizeBytes;
  await writeJsonFile(path.join(resolvedJobDir, reportPath), updatedReport);

  return {
    mode: "mvp",
    jobName: path.basename(resolvedJobDir),
    includedFiles,
    deliveryPath,
    sizeBytes,
    reportPath,
    report: updatedReport
  };
}

async function assertRequiredFiles(jobDir: string, files: string[]): Promise<void> {
  for (const relativePath of files) {
    if (!await pathExists(path.join(jobDir, relativePath))) {
      throw new Error(`Required delivery file is missing: ${relativePath}`);
    }
  }
}

async function existingFiles(jobDir: string, files: readonly string[]): Promise<string[]> {
  const result: string[] = [];
  for (const relativePath of files) {
    if (await pathExists(path.join(jobDir, relativePath))) result.push(relativePath);
  }
  return result;
}

async function generatedPngFiles(jobDir: string): Promise<string[]> {
  const generatedDir = path.join(jobDir, "generated");
  if (!await pathExists(generatedDir)) return [];
  return collectGeneratedPngFiles(generatedDir, "generated");
}

async function collectGeneratedPngFiles(dir: string, relativeDir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...await collectGeneratedPngFiles(path.join(dir, entry.name), relativePath));
    } else if (entry.name.toLowerCase().endsWith(".png")) {
      files.push(relativePath);
    }
  }
  return files;
}

function toZipEntries(jobDir: string, files: string[]): ZipFileEntry[] {
  return files.map((archivePath) => ({
    sourcePath: path.join(jobDir, archivePath),
    archivePath
  }));
}
