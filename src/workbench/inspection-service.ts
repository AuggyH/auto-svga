import type {
  FormatAdapter,
  MotionAssetInfo,
  MotionAssetSource,
  WorkbenchOperationContext,
  WorkbenchResult
} from "./contracts.js";

export class MotionAssetInspectionService {
  constructor(private readonly adapter: FormatAdapter) {}

  inspect(
    source: MotionAssetSource,
    context?: WorkbenchOperationContext
  ): Promise<WorkbenchResult<MotionAssetInfo>> {
    return this.adapter.parse(source, context);
  }
}
