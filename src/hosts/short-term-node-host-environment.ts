import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import { createShortTermProductInspectionModel } from "../workbench/short-term-product-model.js";
import type { AvatarFrameInspectionReportService } from "../workbench/avatar-frame-inspection-report.js";
import type {
  ShortTermHostEnvironment,
  ShortTermHostInspectionInput,
  ShortTermHostReadResult
} from "../workbench/short-term-host-actions.js";
import { createAvatarFrameInspectionReportService } from "./avatar-frame-inspection.js";

export interface CreateShortTermNodeHostEnvironmentOptions {
  inspectionReportService?: AvatarFrameInspectionReportService;
}

export function createShortTermNodeHostEnvironment(
  options: CreateShortTermNodeHostEnvironmentOptions = {}
): ShortTermHostEnvironment {
  const inspectionReportService = options.inspectionReportService ?? createAvatarFrameInspectionReportService();
  return {
    async readLocalFile(localPath: string): Promise<ShortTermHostReadResult> {
      const bytes = await readFile(localPath);
      return {
        bytes: new Uint8Array(bytes),
        displayName: path.basename(localPath)
      };
    },
    async inspectSvga(input: ShortTermHostInspectionInput) {
      const bytes = new Uint8Array(input.bytes);
      const result = await inspectionReportService.inspect({
        id: `host:${input.displayName}`,
        name: input.displayName,
        sizeBytes: bytes.byteLength,
        mediaType: "application/octet-stream",
        async read() {
          return new Uint8Array(bytes);
        }
      });
      if (!result.value) {
        throw new Error(result.issues.map(({ message }) => message).join("; ") || "SVGA inspection failed.");
      }
      return createShortTermProductInspectionModel(result.value);
    },
    async writeLocalFile(localPath: string, bytes: Uint8Array): Promise<void> {
      await writeFile(localPath, new Uint8Array(bytes));
    },
    async readSavedFile(localPath: string): Promise<Uint8Array> {
      return new Uint8Array(await readFile(localPath));
    },
    async fileExists(localPath: string): Promise<boolean> {
      try {
        await access(localPath, constants.R_OK);
        return true;
      } catch {
        return false;
      }
    }
  };
}
