import {
  AvatarFrameInspectionReportService
} from "../workbench/avatar-frame-inspection-report.js";
import { MotionAssetInspectionService } from "../workbench/inspection-service.js";
import {
  NodeProtobufSvgaInspector,
  SvgaFormatAdapter,
  SvgaMotionSpecChecker
} from "../workbench/svga/index.js";
import { FastPngAlphaAnalyzer } from "./fast-png-alpha-analyzer.js";
import { Sha256ResourceHasher } from "./sha256-resource-hasher.js";

export function createAvatarFrameInspectionService(): MotionAssetInspectionService {
  const adapter = new SvgaFormatAdapter(
    new NodeProtobufSvgaInspector(),
    new FastPngAlphaAnalyzer(),
    new Sha256ResourceHasher()
  );
  return new MotionAssetInspectionService(adapter);
}

export function createAvatarFrameInspectionReportService(): AvatarFrameInspectionReportService {
  return new AvatarFrameInspectionReportService(
    createAvatarFrameInspectionService(),
    new SvgaMotionSpecChecker()
  );
}
