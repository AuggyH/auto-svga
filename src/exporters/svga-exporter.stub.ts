import type { AvatarFrameProject } from "../types/project.js";
import type { Exporter, ExportResult } from "./exporter.js";

export class SvgaExporterStub implements Exporter {
  async export(_project: AvatarFrameProject, _outputDir: string): Promise<ExportResult> {
    throw new Error("TODO: implement real SVGA binary exporter adapter.");
  }
}
