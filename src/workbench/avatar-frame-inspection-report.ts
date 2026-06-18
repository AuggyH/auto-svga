import type {
  MotionAssetInfo,
  MotionAssetMemoryEstimation,
  MotionAssetSource,
  RoleAwareMemoryDiagnostics,
  MotionSpecChecker,
  WorkbenchIssue,
  WorkbenchOperationContext,
  WorkbenchResult
} from "./contracts.js";
import { MotionAssetInspectionService } from "./inspection-service.js";
import { diagnoseMemoryByRole } from "./memory-diagnostics.js";
import { estimateDecodedMemory } from "./memory-estimation.js";
import {
  avatarFrameProductionProfile,
  avatarFrameProductionSpec
} from "./specs/index.js";

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
  memoryEstimation: MotionAssetMemoryEstimation;
  memoryDiagnostics: RoleAwareMemoryDiagnostics;
  specId: string;
  profileId: string;
  profileLabel: string;
  profilePurpose: string;
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
    const memoryEstimation = estimateDecodedMemory(asset.resources);
    return {
      value: {
        asset: summarize(asset),
        memoryEstimation,
        memoryDiagnostics: diagnoseMemoryByRole(memoryEstimation),
        specId: specReport.specId,
        profileId: avatarFrameProductionProfile.id,
        profileLabel: avatarFrameProductionProfile.label,
        profilePurpose: avatarFrameProductionProfile.purpose,
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
  const configuredNotes = avatarFrameProductionSpec.metadata?.calibrationNotes;
  return fields
    .filter((field): field is string => typeof field === "string")
    .map((field) => ({
      field,
      message: calibrationMessage(configuredNotes, field)
    }));
}

function calibrationMessage(value: unknown, field: string): string {
  if (value && typeof value === "object") {
    const message = (value as Record<string, unknown>)[field];
    if (typeof message === "string") {
      return message;
    }
  }
  return `${field} needs product calibration.`;
}
