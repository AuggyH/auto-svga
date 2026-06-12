import type {
  MotionAssetInfo,
  MotionSpec,
  MotionSpecChecker,
  MotionSpecCheckReport,
  WorkbenchIssue,
  WorkbenchOperationContext
} from "../contracts.js";

export class SvgaMotionSpecChecker implements MotionSpecChecker {
  async check(
    asset: MotionAssetInfo,
    spec: MotionSpec,
    context?: WorkbenchOperationContext
  ): Promise<MotionSpecCheckReport> {
    context?.cancellation?.throwIfCancelled();
    const issues: WorkbenchIssue[] = [];

    if (asset.format !== "svga") {
      issues.push({
        severity: "error",
        code: "unsupported_motion_format",
        message: `SVGA specification checking does not support format "${asset.format}".`,
        path: "format",
        details: { actual: asset.format, expected: "svga" }
      });
      return report(spec.id, issues);
    }

    checkMaximum(
      issues,
      asset.sizeBytes,
      spec.maxFileSizeBytes,
      "file_size_exceeds_limit",
      "File size exceeds the specification limit.",
      "sizeBytes"
    );
    checkDimensions(issues, asset, spec);
    checkOptionalMaximum(
      issues,
      asset.timing.durationMs,
      spec.maxDurationMs,
      "duration_exceeds_limit",
      "Duration exceeds the specification limit.",
      "duration_unavailable",
      "Duration is unavailable for this asset.",
      "timing.durationMs"
    );
    checkOptionalMaximum(
      issues,
      asset.timing.fps,
      spec.maxFps,
      "fps_exceeds_limit",
      "FPS exceeds the specification limit.",
      "fps_unavailable",
      "FPS is unavailable for this asset.",
      "timing.fps"
    );
    checkMaximum(
      issues,
      asset.resources.length,
      spec.maxResourceCount,
      "resource_count_exceeds_limit",
      "Resource count exceeds the specification limit.",
      "resources.length"
    );

    context?.cancellation?.throwIfCancelled();
    return report(spec.id, issues);
  }
}

function checkDimensions(
  issues: WorkbenchIssue[],
  asset: MotionAssetInfo,
  spec: MotionSpec
): void {
  if (!spec.maxDimensions) {
    return;
  }
  if (!asset.dimensions) {
    issues.push({
      severity: "error",
      code: "dimensions_unavailable",
      message: "Dimensions are unavailable for this asset.",
      path: "dimensions",
      details: { maximum: spec.maxDimensions }
    });
    return;
  }
  if (
    asset.dimensions.width > spec.maxDimensions.width ||
    asset.dimensions.height > spec.maxDimensions.height
  ) {
    issues.push({
      severity: "error",
      code: "dimensions_exceed_limit",
      message: "Dimensions exceed the specification limit.",
      path: "dimensions",
      details: {
        actual: asset.dimensions,
        maximum: spec.maxDimensions
      }
    });
  }
}

function checkOptionalMaximum(
  issues: WorkbenchIssue[],
  actual: number | undefined,
  maximum: number | undefined,
  exceededCode: string,
  exceededMessage: string,
  unavailableCode: string,
  unavailableMessage: string,
  path: string
): void {
  if (maximum === undefined) {
    return;
  }
  if (actual === undefined) {
    issues.push({
      severity: "error",
      code: unavailableCode,
      message: unavailableMessage,
      path,
      details: { maximum }
    });
    return;
  }
  checkMaximum(issues, actual, maximum, exceededCode, exceededMessage, path);
}

function checkMaximum(
  issues: WorkbenchIssue[],
  actual: number,
  maximum: number | undefined,
  code: string,
  message: string,
  path: string
): void {
  if (maximum !== undefined && actual > maximum) {
    issues.push({
      severity: "error",
      code,
      message,
      path,
      details: { actual, maximum }
    });
  }
}

function report(specId: string, issues: readonly WorkbenchIssue[]): MotionSpecCheckReport {
  return {
    specId,
    passed: issues.length === 0,
    issues
  };
}
