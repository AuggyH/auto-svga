import type { AvatarFrameProject } from "../types/project.js";

export interface ExportResult {
  format: string;
  outputPath?: string;
}

export interface Exporter {
  export(project: AvatarFrameProject, outputDir: string): Promise<ExportResult>;
}
