import { createHash } from "node:crypto";
import {
  runShortTermOptimizationWorkflow,
  type ShortTermOptimizationComparisonModel,
  type ShortTermOptimizationWorkflowResult
} from "./short-term-optimization-workflow.js";
import {
  createShortTermOutputSaveState,
  type ShortTermPersistedOutputRecord,
  type ShortTermPersistedOutputSaveStateModel
} from "./short-term-save-state.js";

export const SHORT_TERM_OPTIMIZATION_COMPARE_SESSION_SCHEMA_VERSION = 1 as const;

export type ShortTermOptimizationCompareSessionStatus =
  | "comparing"
  | "notApplicable"
  | "failed"
  | "cancelled";

export interface ShortTermOptimizationPreviewSide {
  role: "before" | "after";
  title: string;
  bytesSha256: string;
  sourceName: string;
}

export interface ShortTermOptimizationCompareSessionModel {
  schemaVersion: typeof SHORT_TERM_OPTIMIZATION_COMPARE_SESSION_SCHEMA_VERSION;
  source: "short-term-optimization-compare-session";
  prdIds: readonly ["S10", "S14"];
  mode: "optimizationComparison" | "preview";
  status: ShortTermOptimizationCompareSessionStatus;
  sourceName: string;
  sourceSha256: string;
  before: ShortTermOptimizationPreviewSide;
  after?: ShortTermOptimizationPreviewSide;
  playerAction: "showBeforeAfter" | "keepPreview" | "returnToPreview";
  saveState: ShortTermPersistedOutputSaveStateModel;
  persistedOutput?: ShortTermPersistedOutputRecord;
  workflow: ShortTermOptimizationComparisonModel;
  message: string;
}

export interface ShortTermOptimizationCompareSessionResult {
  sourceBytes: Uint8Array;
  optimizedBytes?: Uint8Array;
  model: ShortTermOptimizationCompareSessionModel;
  workflow: ShortTermOptimizationWorkflowResult;
}

export interface StartShortTermOptimizationCompareSessionOptions {
  sourceName?: string;
  protoPath?: string;
}

export async function startShortTermOptimizationCompareSession(
  sourceBytes: Uint8Array,
  options: StartShortTermOptimizationCompareSessionOptions = {}
): Promise<ShortTermOptimizationCompareSessionResult> {
  const sourceName = options.sourceName ?? "untitled.svga";
  const stableSourceBytes = new Uint8Array(sourceBytes);
  const sourceSha256 = sha256(stableSourceBytes);
  const workflow = await runShortTermOptimizationWorkflow(stableSourceBytes, options);
  const workflowModel = workflow.model;
  const optimizedBytes = workflow.optimizedBytes;
  const optimized = optimizedBytes !== undefined && workflowModel.status === "optimized";
  const status: ShortTermOptimizationCompareSessionStatus = optimized ? "comparing" : workflowModel.status === "failed" ? "failed" : "notApplicable";

  return {
    sourceBytes: stableSourceBytes,
    ...(optimized ? { optimizedBytes: new Uint8Array(optimizedBytes) } : {}),
    model: {
      schemaVersion: SHORT_TERM_OPTIMIZATION_COMPARE_SESSION_SCHEMA_VERSION,
      source: "short-term-optimization-compare-session",
      prdIds: ["S10", "S14"],
      mode: optimized ? "optimizationComparison" : "preview",
      status,
      sourceName,
      sourceSha256,
      before: {
        role: "before",
        title: "优化前",
        bytesSha256: sourceSha256,
        sourceName
      },
      ...(optimized ? {
        after: {
          role: "after" as const,
          title: "优化后",
          bytesSha256: sha256(optimizedBytes),
          sourceName
        }
      } : {}),
      playerAction: optimized ? "showBeforeAfter" : "keepPreview",
      saveState: workflowModel.saveState,
      ...(workflowModel.persistedOutput ? { persistedOutput: workflowModel.persistedOutput } : {}),
      workflow: workflowModel,
      message: optimized
        ? "已进入优化前后比较，保存动作绑定到已验证优化输出。"
        : "没有进入优化比较，当前预览保持不变。"
    },
    workflow
  };
}

export function cancelShortTermOptimizationCompareSession(
  session: ShortTermOptimizationCompareSessionResult
): ShortTermOptimizationCompareSessionResult {
  return {
    sourceBytes: new Uint8Array(session.sourceBytes),
    model: {
      ...session.model,
      mode: "preview",
      status: "cancelled",
      playerAction: "returnToPreview",
      saveState: createShortTermOutputSaveState("optimized_svga", false, true),
      persistedOutput: undefined,
      message: "已退出优化比较，预览回到源文件状态。"
    },
    workflow: session.workflow
  };
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
