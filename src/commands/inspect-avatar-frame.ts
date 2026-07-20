import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createAvatarFrameInspectionReportService } from "../hosts/avatar-frame-inspection.js";
import type { MotionAssetSource } from "../workbench/contracts.js";
import type { AvatarFrameInspectionReport } from "../workbench/avatar-frame-inspection-report.js";

export async function inspectAvatarFrameCommand(
  inputPath: string
): Promise<AvatarFrameInspectionReport> {
  const source = await fileSource(inputPath);
  const reportService = createAvatarFrameInspectionReportService();
  const result = await reportService.inspect(source);
  if (!result.value) {
    throw new Error(result.issues.map(({ message }) => message).join("; "));
  }
  return result.value;
}

async function fileSource(inputPath: string): Promise<MotionAssetSource> {
  const absolutePath = path.resolve(inputPath);
  const fileStats = await stat(absolutePath);
  return {
    id: `file:${absolutePath}`,
    name: path.basename(absolutePath),
    sizeBytes: fileStats.size,
    mediaType: "application/octet-stream",
    async read() {
      return readFile(absolutePath);
    }
  };
}
