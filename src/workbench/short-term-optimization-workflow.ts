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

export const SHORT_TERM_OPTIMIZATION_WORKFLOW_SCHEMA_VERSION = 1 as const;

export type ShortTermOptimizationRunStatus = "optimized" | "notApplicable" | "failed";
export type ShortTermOptimizationMethodDisposition =
  | "executed"
  | "availableButNoCandidate"
  | "reviewOnly"
  | "notImplemented";

export interface ShortTermOptimizationMetric {
  id: "fileSize" | "imageResourceCount";
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

export interface ShortTermOptimizationSaveStateModel {
  outputKind: "optimized_svga" | "none";
  dirty: boolean;
  outputAvailable: boolean;
  overwriteSaveEnabled: boolean;
  saveAsEnabled: boolean;
  autoWritePerformed: false;
  sourceUnchanged: boolean;
  validationRequiredBeforeWrite: true;
}

export interface ShortTermOptimizationComparisonModel {
  schemaVersion: typeof SHORT_TERM_OPTIMIZATION_WORKFLOW_SCHEMA_VERSION;
  source: "short-term-optimization-workflow";
  prdIds: readonly ["S9", "S10", "S14"];
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
  const sourceName = options.sourceName ?? "untitled.svga";
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
      report: result.report
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
  const passed = input.report.passed
    && input.validation.decodePassed
    && input.validation.reopenPassed
    && input.validation.sourceUnchanged
    && input.validation.invariantChecksPassed
    && input.validation.referenceClosurePassed;

  return {
    schemaVersion: SHORT_TERM_OPTIMIZATION_WORKFLOW_SCHEMA_VERSION,
    source: "short-term-optimization-workflow",
    prdIds: ["S9", "S10", "S14"],
    status: passed ? "optimized" : "failed",
    sourceName: input.sourceName,
    sourceSha256: input.sourceSha256,
    resultTitle: passed ? "已生成优化副本" : "优化结果未通过验证",
    resultSummary: passed
      ? `执行 ${input.report.actions.length} 个安全优化动作，实际文件体积${formatDelta(actualSavingsBytes)}。`
      : "优化器已产出候选 bytes，但重新打开或安全校验未全部通过，保存保持关闭。",
    metrics: [
      metric("fileSize", "文件体积", input.sourceBytes.byteLength, input.optimizedBytes.byteLength),
      metric("imageResourceCount", "图片资源数", input.report.originalImageCount, input.report.optimizedImageCount)
    ],
    actions: input.report.actions.map(actionItem),
    methods: methodItems(input.report.actions),
    validation: input.validation,
    saveState: saveState(passed, input.validation.sourceUnchanged)
  };
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
    resultSummary: "当前文件没有未引用图片或可机械合并的重复图片，未生成优化副本。",
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
  return {
    schemaVersion: SHORT_TERM_OPTIMIZATION_WORKFLOW_SCHEMA_VERSION,
    source: "short-term-optimization-workflow",
    prdIds: ["S9", "S10", "S14"],
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
  };
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
    before: id === "fileSize" ? formatBytes(beforeValue) : String(beforeValue),
    after: id === "fileSize" ? formatBytes(afterValue) : String(afterValue),
    delta: id === "fileSize" ? formatDelta(delta) : formatCountDelta(delta),
    improved: delta > 0
  };
}

function actionItem(action: SvgaImageOptimizationAction): ShortTermOptimizationActionItem {
  const title = action.type === "deduplicate_encoded_image"
    ? "合并重复图片引用"
    : "移除未引用图片";
  const summary = action.type === "deduplicate_encoded_image"
    ? `${action.resourceKey} 与 ${action.canonicalResourceKey ?? ""} 的编码内容一致，引用已指向保留资源。`
    : `${action.resourceKey} 没有图层引用，已从输出副本移除。`;
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
        ? "只移除重定向后仍然没有任何 imageKey 或 matteKey 引用的图片。"
        : "本次没有发现可安全移除的未引用图片。"
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
  return {
    outputKind: outputAvailable ? "optimized_svga" : "none",
    dirty: outputAvailable,
    outputAvailable,
    overwriteSaveEnabled: outputAvailable,
    saveAsEnabled: outputAvailable,
    autoWritePerformed: false,
    sourceUnchanged,
    validationRequiredBeforeWrite: true
  };
}

function failedInvariantCodes(checks: readonly SvgaImageOptimizationInvariantCheck[]): string[] {
  return checks.filter(({ passed }) => !passed).map(({ code }) => code);
}

function diagnosticFromError(error: unknown): { code: string; message: string } {
  if (error instanceof SvgaImageOptimizationError) {
    return {
      code: error.code,
      message: error.message
    };
  }
  return {
    code: "optimization_unexpected_error",
    message: error instanceof Error ? error.message : String(error)
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
