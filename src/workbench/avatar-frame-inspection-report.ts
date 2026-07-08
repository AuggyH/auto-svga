import type {
  MotionAssetInfo,
  MotionAssetMemoryEstimation,
  MotionAssetSource,
  RoleAwareMemoryDiagnostics,
  SequenceFrameEvidence,
  SequenceResidencyDiagnostics,
  MotionSpecChecker,
  WorkbenchIssue,
  WorkbenchOperationContext,
  WorkbenchResult
} from "./contracts.js";
import { MotionAssetInspectionService } from "./inspection-service.js";
import { MOTION_ASSET_AUDIT_REPORT_CONTRACT_VERSION } from "./motion-asset-audit-report-contract.js";
import {
  createMotionAssetAuditPresentation,
  type MotionAssetAuditPresentation
} from "./motion-asset-audit-presentation.js";
import {
  createAssetIntelligenceReport,
  type AssetIntelligenceReport
} from "./asset-intelligence.js";
import {
  createMotionAssetAuditSummary,
  type MotionAssetAuditSummary
} from "./motion-asset-audit-summary.js";
import { diagnoseMemoryByRole } from "./memory-diagnostics.js";
import { estimateDecodedMemory } from "./memory-estimation.js";
import { diagnoseSequenceResidency } from "./sequence-residency-diagnostics.js";
import { collectSequenceFrameEvidence } from "./sequence-frame-evidence.js";
import {
  diagnoseRuntimeStructure,
  type RuntimeStructureDiagnostics
} from "./runtime-structure-diagnostics.js";
import {
  evaluateRoleAwareTransparentPadding,
  type RoleAwareTransparentPaddingPolicySummary
} from "./role-aware-transparent-padding.js";
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
  contractVersion: typeof MOTION_ASSET_AUDIT_REPORT_CONTRACT_VERSION;
  asset: MotionAssetSummary;
  memoryEstimation: MotionAssetMemoryEstimation;
  memoryDiagnostics: RoleAwareMemoryDiagnostics;
  runtimeStructureDiagnostics: RuntimeStructureDiagnostics;
  sequenceResidencyDiagnostics: SequenceResidencyDiagnostics;
  sequenceFrameEvidence: SequenceFrameEvidence;
  transparentPaddingPolicy?: RoleAwareTransparentPaddingPolicySummary;
  assetIntelligence: AssetIntelligenceReport;
  auditSummary: MotionAssetAuditSummary;
  auditPresentation: MotionAssetAuditPresentation;
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
    const memoryDiagnostics = diagnoseMemoryByRole(memoryEstimation);
    const runtimeStructureDiagnostics = diagnoseRuntimeStructure(asset);
    const sequenceResidencyDiagnostics = diagnoseSequenceResidency(
      asset.resources,
      memoryEstimation
    );
    const sequenceFrameEvidence = collectSequenceFrameEvidence(asset.resources);
    const transparentPaddingPolicy = avatarFrameProductionSpec.maxTransparentPaddingRatio === undefined
      ? undefined
      : evaluateRoleAwareTransparentPadding({
        resources: asset.resources,
        sequenceResidencyDiagnostics,
        maximumTransparentPaddingRatio: avatarFrameProductionSpec.maxTransparentPaddingRatio
      });
    const auditSummary = createMotionAssetAuditSummary({
      asset,
      issues: specReport.issues,
      memoryEstimation,
      sequenceResidencyDiagnostics,
      sequenceFrameEvidence
    });
    const assetIntelligence = createAssetIntelligenceReport({
      asset,
      issues: specReport.issues,
      memoryEstimation,
      runtimeStructureDiagnostics,
      sequenceResidencyDiagnostics,
      sequenceFrameEvidence
    });
    return {
      value: {
        contractVersion: MOTION_ASSET_AUDIT_REPORT_CONTRACT_VERSION,
        asset: summarize(asset),
        memoryEstimation,
        memoryDiagnostics,
        runtimeStructureDiagnostics,
        sequenceResidencyDiagnostics,
        sequenceFrameEvidence,
        transparentPaddingPolicy,
        assetIntelligence,
        auditSummary,
        auditPresentation: createMotionAssetAuditPresentation(auditSummary),
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
