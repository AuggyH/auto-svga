import { createHash } from "node:crypto";
import {
  optimizeSvgaImageResources,
  SvgaImageOptimizationError,
  type SvgaImageOptimizationAction,
  type SvgaImageOptimizationActionType,
  type SvgaImageOptimizationInvariantCheck,
  type SvgaImageOptimizationReport
} from "./svga/asset-optimizer.js";
import { NodeProtobufSvgaInspector } from "./svga/node-protobuf-inspector.js";
import {
  createShortTermOutputSaveState,
  createShortTermPersistedOutputRecord,
  type ShortTermPersistedOutputRecord,
  type ShortTermPersistedOutputSaveStateModel
} from "./short-term-save-state.js";
import { shortTermSourceNameFromPathLike } from "./short-term-path-display.js";
import {
  redactShortTermLocalPathsFromError,
  redactShortTermLocalPathsInValue
} from "./short-term-local-path-redaction.js";

export const SHORT_TERM_OPTIMIZATION_WORKFLOW_SCHEMA_VERSION = 1 as const;

export type ShortTermOptimizationRunStatus = "optimized" | "tradeoff" | "no-benefit" | "notApplicable" | "failed";
export type ShortTermOptimizationMethodDisposition =
  | "executed"
  | "availableButNoCandidate"
  | "reviewOnly"
  | "notImplemented";

export interface ShortTermOptimizationMetric {
  id: "fileSize" | "imageResourceCount" | "runtimeObjectCount" | "animationFrameRecordCount";
  label: string;
  before: string;
  after: string;
  delta: string;
  improved: boolean;
}

export interface ShortTermOptimizationActionItem {
  id: string;
  type: SvgaImageOptimizationActionType;
  title: string;
  summary: string;
  resourceKey: string;
  canonicalResourceKey?: string;
  originalSize: string;
  originalUsageCount: number;
  proofRefs: readonly string[];
}

export interface ShortTermOptimizationMethodItem {
  method:
    | "deduplicateEncodedImages"
    | "removeUnreferencedImages"
    | "allZeroRuntimeObjectPruning"
    | "imageCompression"
    | "transparentBoundsTrim"
    | "sequenceFrameProcessing"
    | "fpsAdjustment"
    | "canvasAdjustment";
  label: string;
  disposition: ShortTermOptimizationMethodDisposition;
  reason: string;
}

export interface ShortTermOptimizationValidationModel {
  decodePassed: boolean;
  reopenPassed: boolean;
  sourceUnchanged: boolean;
  invariantChecksPassed: boolean;
  referenceClosurePassed: boolean;
  optimizedSha256?: string;
  reopenedImageCount?: number;
  danglingReferences: readonly string[];
  failedInvariantCodes: readonly string[];
}

export type ShortTermOptimizationSaveStateModel = ShortTermPersistedOutputSaveStateModel;

export interface ShortTermOptimizationComparisonModel {
  schemaVersion: typeof SHORT_TERM_OPTIMIZATION_WORKFLOW_SCHEMA_VERSION;
  source: "short-term-optimization-workflow";
  prdIds: readonly ["S9", "S10", "S14", "S18"];
  status: ShortTermOptimizationRunStatus;
  sourceName: string;
  sourceSha256: string;
  resultTitle: string;
  resultSummary: string;
  metrics: readonly ShortTermOptimizationMetric[];
  actions: readonly ShortTermOptimizationActionItem[];
  methods: readonly ShortTermOptimizationMethodItem[];
  validation: ShortTermOptimizationValidationModel;
  saveState: ShortTermOptimizationSaveStateModel;
  persistedOutput?: ShortTermPersistedOutputRecord;
  diagnostic?: {
    code: string;
    message: string;
  };
}

export interface ShortTermOptimizationWorkflowResult {
  optimizedBytes?: Uint8Array;
  model: ShortTermOptimizationComparisonModel;
  report?: SvgaImageOptimizationReport;
}

export interface RunShortTermOptimizationWorkflowOptions {
  sourceName?: string;
  protoPath?: string;
}

export async function runShortTermOptimizationWorkflow(
  sourceBytes: Uint8Array,
  options: RunShortTermOptimizationWorkflowOptions = {}
): Promise<ShortTermOptimizationWorkflowResult> {
  const sourceName = shortTermSourceNameFromPathLike(options.sourceName);
  const sourceSha256 = sha256(sourceBytes);

  try {
    const result = await optimizeSvgaImageResources(sourceBytes, {
      protoPath: options.protoPath,
      sourceName
    });
    const validation = await validateOptimizedBytes(result.optimizedBytes, result.report, options.protoPath);
    const model = optimizedModel({
      sourceBytes,
      sourceName,
      sourceSha256,
      optimizedBytes: result.optimizedBytes,
      report: result.report,
      validation
    });
    return {
      optimizedBytes: result.optimizedBytes,
      model,
      report: redactShortTermLocalPathsInValue(result.report)
    };
  } catch (error) {
    if (error instanceof SvgaImageOptimizationError && error.code === "optimization_not_applicable") {
      return {
        model: notApplicableModel({
          sourceName,
          sourceSha256,
          sourceSizeBytes: sourceBytes.byteLength,
          diagnostic: {
            code: error.code,
            message: "未发现可机械安全执行的优化项。"
          }
        })
      };
    }

    return {
      model: failedModel({
        sourceName,
        sourceSha256,
        sourceSizeBytes: sourceBytes.byteLength,
        diagnostic: diagnosticFromError(error)
      })
    };
  }
}

function optimizedModel(input: {
  sourceBytes: Uint8Array;
  sourceName: string;
  sourceSha256: string;
  optimizedBytes: Uint8Array;
  report: SvgaImageOptimizationReport;
  validation: ShortTermOptimizationValidationModel;
}): ShortTermOptimizationComparisonModel {
  const actualSavingsBytes = input.sourceBytes.byteLength - input.optimizedBytes.byteLength;
  const checksPassed = input.report.passed
    && input.validation.decodePassed
    && input.validation.reopenPassed
    && input.validation.sourceUnchanged
    && input.validation.invariantChecksPassed
    && input.validation.referenceClosurePassed;
  const structureImproved = input.report.optimizedSpriteCount < input.report.originalSpriteCount
    || input.report.optimizedFrameEntityCount < input.report.originalFrameEntityCount;
  const imageResourcesImproved = input.report.optimizedImageCount < input.report.originalImageCount;
  const targetMetricImproved = actualSavingsBytes > 0 || imageResourcesImproved || structureImproved;
  const status: ShortTermOptimizationRunStatus = !checksPassed
    ? "failed"
    : targetMetricImproved
      ? actualSavingsBytes < 0 ? "tradeoff" : "optimized"
      : "no-benefit";
  const outputSaveable = status === "optimized" || status === "tradeoff";
  const persistedOutput = outputSaveable
    ? createShortTermPersistedOutputRecord({
      outputKind: "optimized_svga",
      operationId: input.report.optimizationId,
      sourceName: input.sourceName,
      sourceSha256: input.sourceSha256,
      outputBytes: input.optimizedBytes,
      sourceUnchanged: input.validation.sourceUnchanged,
      validationPassed: outputSaveable,
      validationRefs: [
        "validation:decodePassed",
        "validation:reopenPassed",
        "validation:referenceClosurePassed",
        "validation:invariantChecksPassed"
      ]
    })
    : undefined;

  return redactShortTermLocalPathsInValue({
    schemaVersion: SHORT_TERM_OPTIMIZATION_WORKFLOW_SCHEMA_VERSION,
    source: "short-term-optimization-workflow",
    prdIds: ["S9", "S10", "S14", "S18"],
    status,
    sourceName: input.sourceName,
    sourceSha256: input.sourceSha256,
    resultTitle: resultTitle(status),
    resultSummary: resultSummary(status, input.report.actions.length, actualSavingsBytes, {
      imageResourcesImproved,
      structureImproved
    }),
    metrics: [
      metric("fileSize", "文件体积", input.sourceBytes.byteLength, input.optimizedBytes.byteLength),
      metric("imageResourceCount", "图片资源数", input.report.originalImageCount, input.report.optimizedImageCount),
      metric("runtimeObjectCount", "运行对象数", input.report.originalSpriteCount, input.report.optimizedSpriteCount),
      metric("animationFrameRecordCount", "动画帧记录数", input.report.originalFrameEntityCount, input.report.optimizedFrameEntityCount)
    ],
    actions: input.report.actions.map(actionItem),
    methods: methodItems(input.report.actions),
    validation: input.validation,
    saveState: persistedOutput?.saveState ?? saveState(false, input.validation.sourceUnchanged),
    ...(persistedOutput ? { persistedOutput } : {})
  });
}

function resultTitle(status: ShortTermOptimizationRunStatus): string {
  if (status === "optimized") return "已生成优化副本";
  if (status === "tradeoff") return "已生成结构优化副本";
  if (status === "no-benefit") return "优化无正向收益";
  return "优化结果未通过验证";
}

function resultSummary(
  status: ShortTermOptimizationRunStatus,
  actionCount: number,
  fileSizeSavingsBytes: number,
  improvements: {
    imageResourcesImproved: boolean;
    structureImproved: boolean;
  }
): string {
  if (status === "failed") {
    return "优化器已产出候选 bytes，但重新打开或安全校验未全部通过，保存保持关闭。";
  }
  if (status === "no-benefit") {
    return "优化结果没有带来文件体积、图片资源数或运行时结构的正向收益，保存保持关闭。";
  }
  const targets = [
    ...(fileSizeSavingsBytes > 0 ? ["文件体积"] : []),
    ...(improvements.imageResourcesImproved ? ["图片资源数"] : []),
    ...(improvements.structureImproved ? ["运行时结构"] : [])
  ];
  const targetCopy = targets.length > 0 ? `；正向收益：${targets.join("、")}` : "";
  const tradeoffCopy = fileSizeSavingsBytes < 0
    ? "；文件体积有增加，但运行时结构指标改善"
    : "";
  return `执行 ${actionCount} 个安全优化动作，实际文件体积${formatDelta(fileSizeSavingsBytes)}${targetCopy}${tradeoffCopy}。`;
}

function notApplicableModel(input: {
  sourceName: string;
  sourceSha256: string;
  sourceSizeBytes: number;
  diagnostic: { code: string; message: string };
}): ShortTermOptimizationComparisonModel {
  return baseClosedModel({
    status: "notApplicable",
    sourceName: input.sourceName,
    sourceSha256: input.sourceSha256,
    sourceSizeBytes: input.sourceSizeBytes,
    resultTitle: "没有可安全执行的优化项",
    resultSummary: "当前文件没有未引用图片、可机械合并的重复图片或全零运行对象，未生成优化副本。",
    methods: methodItems([]),
    diagnostic: input.diagnostic
  });
}

function failedModel(input: {
  sourceName: string;
  sourceSha256: string;
  sourceSizeBytes: number;
  diagnostic: { code: string; message: string };
}): ShortTermOptimizationComparisonModel {
  return baseClosedModel({
    status: "failed",
    sourceName: input.sourceName,
    sourceSha256: input.sourceSha256,
    sourceSizeBytes: input.sourceSizeBytes,
    resultTitle: "优化失败",
    resultSummary: "优化流程已失败关闭，没有生成可保存输出。",
    methods: methodItems([]),
    diagnostic: input.diagnostic
  });
}

function baseClosedModel(input: {
  status: "notApplicable" | "failed";
  sourceName: string;
  sourceSha256: string;
  sourceSizeBytes: number;
  resultTitle: string;
  resultSummary: string;
  methods: readonly ShortTermOptimizationMethodItem[];
  diagnostic: { code: string; message: string };
}): ShortTermOptimizationComparisonModel {
  return redactShortTermLocalPathsInValue({
    schemaVersion: SHORT_TERM_OPTIMIZATION_WORKFLOW_SCHEMA_VERSION,
    source: "short-term-optimization-workflow",
    prdIds: ["S9", "S10", "S14", "S18"],
    status: input.status,
    sourceName: input.sourceName,
    sourceSha256: input.sourceSha256,
    resultTitle: input.resultTitle,
    resultSummary: input.resultSummary,
    metrics: [
      {
        id: "fileSize",
        label: "文件体积",
        before: formatBytes(input.sourceSizeBytes),
        after: "-",
        delta: "-",
        improved: false
      }
    ],
    actions: [],
    methods: input.methods,
    validation: {
      decodePassed: false,
      reopenPassed: false,
      sourceUnchanged: true,
      invariantChecksPassed: false,
      referenceClosurePassed: false,
      danglingReferences: [],
      failedInvariantCodes: []
    },
    saveState: saveState(false, true),
    diagnostic: input.diagnostic
  });
}

async function validateOptimizedBytes(
  optimizedBytes: Uint8Array,
  report: SvgaImageOptimizationReport,
  protoPath?: string
): Promise<ShortTermOptimizationValidationModel> {
  const inspector = new NodeProtobufSvgaInspector(protoPath);
  try {
    const reopened = await inspector.inspect(optimizedBytes);
    const imageKeys = new Set(reopened.images.map(({ imageKey }) => imageKey));
    const danglingReferences = [...new Set(reopened.sprites.flatMap(({ imageKey, matteKey }) => [
      imageKey,
      matteKey
    ]).filter((resourceKey) => resourceKey.length > 0 && !imageKeys.has(resourceKey)))].sort();
    return {
      decodePassed: report.decodePassed,
      reopenPassed: reopened.images.length === report.optimizedImageCount,
      sourceUnchanged: report.sourceUnchanged,
      invariantChecksPassed: report.invariantChecks.every(({ passed }) => passed),
      referenceClosurePassed: danglingReferences.length === 0,
      optimizedSha256: sha256(optimizedBytes),
      reopenedImageCount: reopened.images.length,
      danglingReferences,
      failedInvariantCodes: failedInvariantCodes(report.invariantChecks)
    };
  } catch {
    return {
      decodePassed: false,
      reopenPassed: false,
      sourceUnchanged: report.sourceUnchanged,
      invariantChecksPassed: report.invariantChecks.every(({ passed }) => passed),
      referenceClosurePassed: false,
      optimizedSha256: sha256(optimizedBytes),
      danglingReferences: [],
      failedInvariantCodes: failedInvariantCodes(report.invariantChecks)
    };
  }
}

function metric(
  id: ShortTermOptimizationMetric["id"],
  label: string,
  beforeValue: number,
  afterValue: number
): ShortTermOptimizationMetric {
  const delta = beforeValue - afterValue;
  return {
    id,
    label,
    before: formatMetricValue(id, beforeValue),
    after: formatMetricValue(id, afterValue),
    delta: id === "fileSize" ? formatDelta(delta) : formatCountDelta(delta),
    improved: delta > 0
  };
}

function formatMetricValue(id: ShortTermOptimizationMetric["id"], value: number): string {
  return id === "fileSize" ? formatBytes(value) : String(value);
}

function actionItem(action: SvgaImageOptimizationAction): ShortTermOptimizationActionItem {
  const title = actionTitle(action);
  const summary = actionSummary(action);
  return {
    id: `${action.type}:${action.resourceKey}`,
    type: action.type,
    title,
    summary,
    resourceKey: action.resourceKey,
    ...(action.canonicalResourceKey ? { canonicalResourceKey: action.canonicalResourceKey } : {}),
    originalSize: formatBytes(action.originalSizeBytes),
    originalUsageCount: action.originalUsageCount,
    proofRefs: [
      `resource:${action.resourceKey}`,
      `sha256:${action.originalSha256}`
    ]
  };
}

function actionTitle(action: SvgaImageOptimizationAction): string {
  if (action.type === "deduplicate_encoded_image") return "合并重复图片引用";
  if (action.type === "remove_all_zero_sprite") return "移除全零运行对象";
  return "移除未引用图片";
}

function actionSummary(action: SvgaImageOptimizationAction): string {
  if (action.type === "deduplicate_encoded_image") {
    return `${action.resourceKey} 与 ${action.canonicalResourceKey ?? ""} 的编码内容一致，引用已指向保留资源。`;
  }
  if (action.type === "remove_all_zero_sprite") {
    return `${action.resourceKey} 的运行对象全程不可见，已移除 ${action.removedFrameCount ?? 0} 条动画帧记录。`;
  }
  return `${action.resourceKey} 没有运行时引用，已从输出副本移除。`;
}

function methodItems(actions: readonly SvgaImageOptimizationAction[]): ShortTermOptimizationMethodItem[] {
  const actionTypes = new Set(actions.map(({ type }) => type));
  return [
    {
      method: "deduplicateEncodedImages",
      label: "合并重复图片",
      disposition: actionTypes.has("deduplicate_encoded_image") ? "executed" : "availableButNoCandidate",
      reason: actionTypes.has("deduplicate_encoded_image")
        ? "只合并编码字节完全一致的图片，并保留引用闭合验证。"
        : "本次没有发现可机械合并的重复图片。"
    },
    {
      method: "removeUnreferencedImages",
      label: "移除未引用图片",
      disposition: actionTypes.has("remove_unreferenced_image") ? "executed" : "availableButNoCandidate",
      reason: actionTypes.has("remove_unreferenced_image")
        ? "只移除重定向和结构剪枝后仍然没有任何运行时引用的图片。"
        : "本次没有发现可安全移除的未引用图片。"
    },
    {
      method: "allZeroRuntimeObjectPruning",
      label: "移除全零运行对象",
      disposition: actionTypes.has("remove_all_zero_sprite") ? "executed" : "availableButNoCandidate",
      reason: actionTypes.has("remove_all_zero_sprite")
        ? "只移除全部动画帧 alpha 为 0 的运行对象，并重新验证引用闭合。"
        : "本次没有发现全程不可见、可机械移除的运行对象。"
    },
    {
      method: "imageCompression",
      label: "图片压缩",
      disposition: "notImplemented",
      reason: "当前主程服务尚未定义质量档位和视觉验收阈值，短期结果中不会伪称已压缩。"
    },
    {
      method: "transparentBoundsTrim",
      label: "透明边界裁剪",
      disposition: "reviewOnly",
      reason: "裁剪需要位移补偿和视觉对比，本轮只作为建议，不进入安全批量。"
    },
    {
      method: "sequenceFrameProcessing",
      label: "序列帧处理",
      disposition: "reviewOnly",
      reason: "序列帧闪帧修复属于中期能力；短期只允许机械安全的优化项。"
    },
    {
      method: "fpsAdjustment",
      label: "帧率调整",
      disposition: "reviewOnly",
      reason: "帧率会改变播放节奏，未进入当前自动优化执行范围。"
    },
    {
      method: "canvasAdjustment",
      label: "画布调整",
      disposition: "reviewOnly",
      reason: "画布变化会影响排版与终端展示，未进入当前自动优化执行范围。"
    }
  ];
}

function saveState(outputAvailable: boolean, sourceUnchanged: boolean): ShortTermOptimizationSaveStateModel {
  return createShortTermOutputSaveState("optimized_svga", outputAvailable, sourceUnchanged);
}

function failedInvariantCodes(checks: readonly SvgaImageOptimizationInvariantCheck[]): string[] {
  return checks.filter(({ passed }) => !passed).map(({ code }) => code);
}

function diagnosticFromError(error: unknown): { code: string; message: string } {
  if (error instanceof SvgaImageOptimizationError) {
    return {
      code: error.code,
      message: redactShortTermLocalPathsFromError(error, error.message)
    };
  }
  return {
    code: "optimization_unexpected_error",
    message: redactShortTermLocalPathsFromError(error, "优化流程出现未预期错误。")
  };
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 1024 * 1024) return `${trimNumber(value / (1024 * 1024))} MiB`;
  if (Math.abs(value) >= 1024) return `${trimNumber(value / 1024)} KiB`;
  return `${value} B`;
}

function formatDelta(value: number): string {
  if (value === 0) return "无变化";
  const prefix = value > 0 ? "减少" : "增加";
  return `${prefix} ${formatBytes(Math.abs(value))}`;
}

function formatCountDelta(value: number): string {
  if (value === 0) return "无变化";
  const prefix = value > 0 ? "减少" : "增加";
  return `${prefix} ${Math.abs(value)}`;
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
