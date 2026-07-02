import { createHash } from "node:crypto";
import path from "node:path";
import {
  validateShortTermSavedBytes,
  type ShortTermPersistedOutputRecord,
  type ShortTermSaveCommand,
  type ShortTermSaveValidationResult
} from "./short-term-save-state.js";

export const SHORT_TERM_SAVE_EXECUTION_SCHEMA_VERSION = 1 as const;

export type ShortTermSaveExecutionStatus =
  | "blocked"
  | "readyToWrite"
  | "saveComplete"
  | "saveFailed";

export interface ShortTermSaveExecutionPlan {
  schemaVersion: typeof SHORT_TERM_SAVE_EXECUTION_SCHEMA_VERSION;
  source: "short-term-save-execution";
  prdIds: readonly ["S14"];
  status: "blocked" | "readyToWrite";
  command: ShortTermSaveCommand;
  outputId: string;
  outputKind: ShortTermPersistedOutputRecord["outputKind"];
  sourceName: string;
  expectedOutputSha256: string;
  expectedOutputSizeBytes: number;
  targetDisplayName: string;
  targetPathRedacted: true;
  autoWritePerformed: false;
  dirty: boolean;
  message: string;
  diagnostic?: {
    code: string;
    message: string;
  };
}

export interface ShortTermSaveExecutionResult {
  schemaVersion: typeof SHORT_TERM_SAVE_EXECUTION_SCHEMA_VERSION;
  source: "short-term-save-execution";
  prdIds: readonly ["S14"];
  status: "saveComplete" | "saveFailed";
  command: ShortTermSaveCommand;
  outputId: string;
  outputKind: ShortTermPersistedOutputRecord["outputKind"];
  sourceName: string;
  expectedOutputSha256: string;
  savedSha256?: string;
  targetDisplayName: string;
  targetPathRedacted: true;
  dirty: boolean;
  message: string;
  validation?: ShortTermSaveValidationResult;
  diagnostic?: {
    code: string;
    message: string;
  };
}

export interface CreateShortTermSaveExecutionPlanOptions {
  targetPath?: string;
  targetDisplayName?: string;
}

export function createShortTermSaveExecutionPlan(
  record: ShortTermPersistedOutputRecord,
  command: ShortTermSaveCommand,
  options: CreateShortTermSaveExecutionPlanOptions = {}
): ShortTermSaveExecutionPlan {
  const commandEnabled = command === "overwrite"
    ? record.saveState.overwriteSaveEnabled
    : record.saveState.saveAsEnabled;
  const ready = record.validationPassed
    && record.saveState.outputAvailable
    && commandEnabled;
  return {
    schemaVersion: SHORT_TERM_SAVE_EXECUTION_SCHEMA_VERSION,
    source: "short-term-save-execution",
    prdIds: ["S14"],
    status: ready ? "readyToWrite" : "blocked",
    command,
    outputId: record.outputId,
    outputKind: record.outputKind,
    sourceName: record.sourceName,
    expectedOutputSha256: record.outputSha256,
    expectedOutputSizeBytes: record.outputSizeBytes,
    targetDisplayName: targetDisplayName(options, record),
    targetPathRedacted: true,
    autoWritePerformed: false,
    dirty: record.dirty,
    message: ready
      ? "保存前验证已就绪，等待主机写入并读回校验。"
      : "没有已验证的可保存输出，保存保持关闭。",
    ...(!ready ? {
      diagnostic: {
        code: "save_output_not_available",
        message: "保存输出不可用或对应保存命令未启用。"
      }
    } : {})
  };
}

export function completeShortTermSaveExecution(
  plan: ShortTermSaveExecutionPlan,
  record: ShortTermPersistedOutputRecord,
  savedBytes: Uint8Array
): ShortTermSaveExecutionResult {
  if (plan.status !== "readyToWrite" || plan.outputId !== record.outputId) {
    return failedResult(plan, {
      code: "save_plan_not_ready",
      message: "保存计划未就绪或与当前输出不匹配。"
    });
  }

  const validation = validateShortTermSavedBytes(record, savedBytes, plan.command);
  const passed = validation.status === "saveComplete";
  return {
    schemaVersion: SHORT_TERM_SAVE_EXECUTION_SCHEMA_VERSION,
    source: "short-term-save-execution",
    prdIds: ["S14"],
    status: passed ? "saveComplete" : "saveFailed",
    command: plan.command,
    outputId: plan.outputId,
    outputKind: plan.outputKind,
    sourceName: plan.sourceName,
    expectedOutputSha256: plan.expectedOutputSha256,
    savedSha256: validation.savedSha256,
    targetDisplayName: plan.targetDisplayName,
    targetPathRedacted: true,
    dirty: validation.dirty,
    message: validation.message,
    validation,
    ...(!passed ? {
      diagnostic: {
        code: "saved_bytes_mismatch",
        message: "写入后读回的文件与已验证输出不一致。"
      }
    } : {})
  };
}

export function failShortTermSaveExecution(
  plan: ShortTermSaveExecutionPlan,
  error: unknown
): ShortTermSaveExecutionResult {
  return failedResult(plan, {
    code: "save_write_failed",
    message: error instanceof Error ? error.message : String(error)
  });
}

function failedResult(
  plan: ShortTermSaveExecutionPlan,
  diagnostic: { code: string; message: string }
): ShortTermSaveExecutionResult {
  return {
    schemaVersion: SHORT_TERM_SAVE_EXECUTION_SCHEMA_VERSION,
    source: "short-term-save-execution",
    prdIds: ["S14"],
    status: "saveFailed",
    command: plan.command,
    outputId: plan.outputId,
    outputKind: plan.outputKind,
    sourceName: plan.sourceName,
    expectedOutputSha256: plan.expectedOutputSha256,
    targetDisplayName: plan.targetDisplayName,
    targetPathRedacted: true,
    dirty: true,
    message: "保存失败，保持未保存状态。",
    diagnostic
  };
}

function targetDisplayName(
  options: CreateShortTermSaveExecutionPlanOptions,
  record: ShortTermPersistedOutputRecord
): string {
  const explicit = options.targetDisplayName?.trim();
  if (explicit) return path.basename(explicit);
  const targetPath = options.targetPath?.trim();
  if (targetPath) return path.basename(targetPath);
  return record.sourceName;
}

export function shortTermSaveExecutionHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
