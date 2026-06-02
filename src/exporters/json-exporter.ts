import path from "node:path";
import type { AvatarFrameProject } from "../types/project.js";
import { writeJsonFile } from "../utils/fs.js";
import type { Exporter, ExportResult } from "./exporter.js";

export class JsonExporter implements Exporter {
  async export(project: AvatarFrameProject, outputDir: string): Promise<ExportResult> {
    const outputPath = path.join(outputDir, "project.json");
    await writeJsonFile(outputPath, project);
    return {
      format: "intermediate-json",
      outputPath
    };
  }
}
