import type {
  FormatAdapter,
  MotionAssetInfo,
  MotionAssetSource,
  MotionSpec,
  MotionSpecChecker,
  MotionSpecCheckReport,
  WorkbenchOperationContext,
  WorkbenchResult
} from "./contracts.js";

export interface MotionAssetInspectionWithSpec {
  asset: MotionAssetInfo;
  specReport: MotionSpecCheckReport;
}

export class MotionAssetInspectionService {
  constructor(private readonly adapter: FormatAdapter) {}

  inspect(
    source: MotionAssetSource,
    context?: WorkbenchOperationContext
  ): Promise<WorkbenchResult<MotionAssetInfo>> {
    return this.adapter.parse(source, context);
  }

  async inspectWithSpec(
    source: MotionAssetSource,
    spec: MotionSpec,
    checker: MotionSpecChecker,
    context?: WorkbenchOperationContext
  ): Promise<WorkbenchResult<MotionAssetInspectionWithSpec>> {
    const inspection = await this.inspect(source, context);
    if (!inspection.value) {
      return { issues: inspection.issues };
    }

    const specReport = await checker.check(inspection.value, spec, context);
    return {
      value: {
        asset: inspection.value,
        specReport
      },
      issues: inspection.issues
    };
  }
}
