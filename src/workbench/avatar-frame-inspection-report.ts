import type {
  MotionAssetInfo,
  MotionAssetSource,
  MotionSpecChecker,
  WorkbenchIssue,
  WorkbenchOperationContext,
  WorkbenchResult
} from "./contracts.js";
import { MotionAssetInspectionService } from "./inspection-service.js";
import { avatarFrameProductionSpec } from "./specs/index.js";

export interface MotionAssetSummary {
  format: MotionAssetInfo["format"];
  name: string;
  sizeBytes: number;
  dimensions?: MotionAssetInfo["dimensions"];
  timing: MotionAssetInfo["timing"];
  layerCount: number;
  resourceCount: number;
}

export interface SpecCalibrationNote {
  field: string;
  message: string;
}

export interface AvatarFrameInspectionReport {
  asset: MotionAssetSummary;
  specId: string;
  passed: boolean;
  issues: readonly WorkbenchIssue[];
  calibrationNotes: readonly SpecCalibrationNote[];
}

export class AvatarFrameInspectionReportService {
  constructor(
    private readonly inspectionService: MotionAssetInspectionService,
    private readonly checker: MotionSpecChecker
  ) {}

  async inspect(
    source: MotionAssetSource,
    context?: WorkbenchOperationContext
  ): Promise<WorkbenchResult<AvatarFrameInspectionReport>> {
    const result = await this.inspectionService.inspectWithSpec(
      source,
      avatarFrameProductionSpec,
      this.checker,
      context
    );
    if (!result.value) {
      return { issues: result.issues };
    }

    const { asset, specReport } = result.value;
    return {
      value: {
        asset: summarize(asset),
        specId: specReport.specId,
        passed: specReport.passed,
        issues: specReport.issues,
        calibrationNotes: calibrationNotes()
      },
      issues: result.issues
    };
  }
}

function summarize(asset: MotionAssetInfo): MotionAssetSummary {
  return {
    format: asset.format,
    name: asset.name,
    sizeBytes: asset.sizeBytes,
    dimensions: asset.dimensions,
    timing: asset.timing,
    layerCount: asset.layers.length,
    resourceCount: asset.resources.length
  };
}

function calibrationNotes(): readonly SpecCalibrationNote[] {
  const fields = avatarFrameProductionSpec.metadata?.needsProductCalibration;
  if (!Array.isArray(fields)) {
    return [];
  }
  return fields
    .filter((field): field is string => typeof field === "string")
    .map((field) => ({
      field,
      message: `${field} uses a placeholder threshold and needs product calibration.`
    }));
}
