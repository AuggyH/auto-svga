import { createHash } from "node:crypto";
import {
  createShortTermOutputSaveState,
  createShortTermPersistedOutputRecord,
  type ShortTermPersistedOutputRecord,
  type ShortTermPersistedOutputSaveStateModel
} from "./short-term-save-state.js";
import { isAutomaticImageKey } from "./short-term-product-model.js";
import {
  NodeProtobufSvgaInspector,
  SvgaImageEditError,
  SvgaImageResourceEditor,
  type SvgaRoundTripReport
} from "./svga/index.js";
import { shortTermSourceNameFromPathLike } from "./short-term-path-display.js";
import {
  redactShortTermLocalPathsFromError,
  redactShortTermLocalPathsInValue
} from "./short-term-local-path-redaction.js";

export const SHORT_TERM_IMAGE_REPLACEMENT_WORKFLOW_SCHEMA_VERSION = 1 as const;

export type ShortTermImageReplacementRunStatus = "replaced" | "failed";
export type ShortTermImageReplacementSaveStateModel = ShortTermPersistedOutputSaveStateModel;

export interface ShortTermImageReplacementInput {
  imageKey: string;
  pngBytes: Uint8Array;
}

export interface ShortTermImageReplacementSummary {
  imageKey: string;
  replacementSha256: string;
  replacementSize: string;
  replacementWidth: number;
  replacementHeight: number;
  dimensionWarning?: string;
}

export interface ShortTermImageReplacementValidationModel {
  decodePassed: boolean;
  reopenPassed: boolean;
  sourceUnchanged: boolean;
  roundTripPassed: boolean;
  replacementApplied: boolean;
  referenceClosurePassed: boolean;
  danglingReferences: readonly string[];
  editedSha256?: string;
  unexpectedChanges: readonly string[];
}

export interface ShortTermImageReplacementWorkflowModel {
  schemaVersion: typeof SHORT_TERM_IMAGE_REPLACEMENT_WORKFLOW_SCHEMA_VERSION;
  source: "short-term-image-replacement-workflow";
  prdIds: readonly ["S12", "S14"];
  status: ShortTermImageReplacementRunStatus;
  sourceName: string;
  sourceSha256: string;
  imageKey: string;
  resultTitle: string;
  resultSummary: string;
  replacement?: ShortTermImageReplacementSummary;
  changedFields: readonly string[];
  validation: ShortTermImageReplacementValidationModel;
  saveState: ShortTermImageReplacementSaveStateModel;
  persistedOutput?: ShortTermPersistedOutputRecord;
  diagnostic?: {
    code: string;
    message: string;
  };
}

export interface ShortTermImageReplacementWorkflowResult {
  replacedBytes?: Uint8Array;
  model: ShortTermImageReplacementWorkflowModel;
  roundTripReport?: SvgaRoundTripReport;
}

export interface RunShortTermImageReplacementWorkflowOptions {
  sourceName?: string;
  protoPath?: string;
}

export async function runShortTermImageReplacementWorkflow(
  sourceBytes: Uint8Array,
  replacement: ShortTermImageReplacementInput,
  options: RunShortTermImageReplacementWorkflowOptions = {}
): Promise<ShortTermImageReplacementWorkflowResult> {
  const sourceName = shortTermSourceNameFromPathLike(options.sourceName);
  const sourceSha256 = sha256(sourceBytes);
  const imageKey = replacement.imageKey.trim();

  try {
    validateReplacementInput(imageKey, replacement.pngBytes);
    const editor = new SvgaImageResourceEditor(options.protoPath);
    const result = await editor.replaceImages(
      sourceBytes,
      [{ resourceKey: imageKey, pngBytes: replacement.pngBytes }],
      sourceName,
      { milestoneId: "P3" }
    );
    const replacementSummary = result.session.replacements[imageKey];
    if (!replacementSummary) {
      throw new ShortTermImageReplacementWorkflowError(
        "replacement_summary_missing",
        "替换结果缺少资源摘要。"
      );
    }
    const validation = await validateReplacement({
      sourceBytes,
      sourceSha256,
      editedBytes: result.editedBytes,
      imageKey,
      replacementSha256: replacementSummary.replacementSha256,
      roundTripReport: result.roundTripReport,
      protoPath: options.protoPath
    });
    const model = replacedModel({
      sourceName,
      sourceSha256,
      imageKey,
      editedBytes: result.editedBytes,
      replacement: replacementSummary,
      validation,
      roundTripReport: result.roundTripReport
    });

    return {
      replacedBytes: model.status === "replaced" ? result.editedBytes : undefined,
      model,
      roundTripReport: redactShortTermLocalPathsInValue(result.roundTripReport)
    };
  } catch (error) {
    return {
      model: failedModel({
        sourceName,
        sourceSha256,
        imageKey,
        diagnostic: diagnosticFromError(error)
      })
    };
  }
}

class ShortTermImageReplacementWorkflowError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ShortTermImageReplacementWorkflowError";
  }
}

function validateReplacementInput(imageKey: string, pngBytes: Uint8Array): void {
  if (!imageKey) {
    throw new ShortTermImageReplacementWorkflowError("replacement_image_key_required", "替换目标 imageKey 不能为空。");
  }
  if (isAutomaticImageKey(imageKey)) {
    throw new ShortTermImageReplacementWorkflowError(
      "replacement_image_key_not_short_term_replaceable",
      "自动命名图片资源不属于短期版本的可替换元素。"
    );
  }
  if (!(pngBytes instanceof Uint8Array) || pngBytes.byteLength === 0) {
    throw new ShortTermImageReplacementWorkflowError("replacement_png_required", "替换图片不能为空。");
  }
}

function replacedModel(input: {
  sourceName: string;
  sourceSha256: string;
  imageKey: string;
  editedBytes: Uint8Array;
  replacement: {
    replacementSha256: string;
    replacementSizeBytes: number;
    replacementWidth: number;
    replacementHeight: number;
    dimensionWarning?: string;
  };
  validation: ShortTermImageReplacementValidationModel;
  roundTripReport: SvgaRoundTripReport;
}): ShortTermImageReplacementWorkflowModel {
  const passed = input.validation.decodePassed
    && input.validation.reopenPassed
    && input.validation.sourceUnchanged
    && input.validation.roundTripPassed
    && input.validation.replacementApplied
    && input.validation.referenceClosurePassed;
  const persistedOutput = passed
    ? createShortTermPersistedOutputRecord({
      outputKind: "image_replacement_svga",
      operationId: "svga-image-replacement-v1",
      sourceName: input.sourceName,
      sourceSha256: input.sourceSha256,
      outputBytes: input.editedBytes,
      sourceUnchanged: input.validation.sourceUnchanged,
      validationPassed: passed,
      validationRefs: [
        "validation:decodePassed",
        "validation:reopenPassed",
        "validation:roundTripPassed",
        "validation:replacementApplied"
      ]
    })
    : undefined;
  const replacementSummary = {
    imageKey: input.imageKey,
    replacementSha256: input.replacement.replacementSha256,
    replacementSize: formatBytes(input.replacement.replacementSizeBytes),
    replacementWidth: input.replacement.replacementWidth,
    replacementHeight: input.replacement.replacementHeight,
    ...(input.replacement.dimensionWarning ? { dimensionWarning: input.replacement.dimensionWarning } : {})
  };

  return redactShortTermLocalPathsInValue({
    schemaVersion: SHORT_TERM_IMAGE_REPLACEMENT_WORKFLOW_SCHEMA_VERSION,
    source: "short-term-image-replacement-workflow",
    prdIds: ["S12", "S14"],
    status: passed ? "replaced" : "failed",
    sourceName: input.sourceName,
    sourceSha256: input.sourceSha256,
    imageKey: input.imageKey,
    resultTitle: passed ? "已生成替换图片副本" : "替换结果未通过验证",
    resultSummary: passed
      ? `${input.imageKey} 已替换为新的 PNG，输出副本已通过重新打开验证。`
      : "替换后的候选 bytes 未通过重新打开或 round-trip 验证，保存保持关闭。",
    replacement: replacementSummary,
    changedFields: input.roundTripReport.changedFields,
    validation: input.validation,
    saveState: persistedOutput?.saveState ?? saveState(false, input.validation.sourceUnchanged),
    ...(persistedOutput ? { persistedOutput } : {})
  });
}

function failedModel(input: {
  sourceName: string;
  sourceSha256: string;
  imageKey: string;
  diagnostic: { code: string; message: string };
}): ShortTermImageReplacementWorkflowModel {
  return redactShortTermLocalPathsInValue({
    schemaVersion: SHORT_TERM_IMAGE_REPLACEMENT_WORKFLOW_SCHEMA_VERSION,
    source: "short-term-image-replacement-workflow",
    prdIds: ["S12", "S14"],
    status: "failed",
    sourceName: input.sourceName,
    sourceSha256: input.sourceSha256,
    imageKey: input.imageKey,
    resultTitle: "替换图片失败",
    resultSummary: "替换流程已失败关闭，没有生成可保存输出。",
    changedFields: [],
    validation: {
      decodePassed: false,
      reopenPassed: false,
      sourceUnchanged: true,
      roundTripPassed: false,
      replacementApplied: false,
      referenceClosurePassed: false,
      danglingReferences: [],
      unexpectedChanges: []
    },
    saveState: saveState(false, true),
    diagnostic: input.diagnostic
  });
}

async function validateReplacement(input: {
  sourceBytes: Uint8Array;
  sourceSha256: string;
  editedBytes: Uint8Array;
  imageKey: string;
  replacementSha256: string;
  roundTripReport: SvgaRoundTripReport;
  protoPath?: string;
}): Promise<ShortTermImageReplacementValidationModel> {
  try {
    const reopened = await new NodeProtobufSvgaInspector(input.protoPath).inspect(input.editedBytes);
    const imageKeys = new Set(reopened.images.map(({ imageKey }) => imageKey));
    const danglingReferences = [...new Set(reopened.sprites.flatMap(({ imageKey, matteKey }) => [
      imageKey,
      matteKey
    ]).filter((resourceKey) => resourceKey.length > 0 && !imageKeys.has(resourceKey)))].sort();
    const image = reopened.images.find(({ imageKey }) => imageKey === input.imageKey);
    return {
      decodePassed: input.roundTripReport.decodePassed,
      reopenPassed: true,
      sourceUnchanged: sha256(input.sourceBytes) === input.sourceSha256,
      roundTripPassed: input.roundTripReport.passed,
      replacementApplied: image ? sha256(image.bytes) === input.replacementSha256 : false,
      referenceClosurePassed: danglingReferences.length === 0,
      danglingReferences,
      editedSha256: sha256(input.editedBytes),
      unexpectedChanges: input.roundTripReport.unexpectedChanges
    };
  } catch {
    return {
      decodePassed: false,
      reopenPassed: false,
      sourceUnchanged: sha256(input.sourceBytes) === input.sourceSha256,
      roundTripPassed: false,
      replacementApplied: false,
      referenceClosurePassed: false,
      danglingReferences: [],
      editedSha256: sha256(input.editedBytes),
      unexpectedChanges: input.roundTripReport.unexpectedChanges
    };
  }
}

function saveState(outputAvailable: boolean, sourceUnchanged: boolean): ShortTermImageReplacementSaveStateModel {
  return createShortTermOutputSaveState("image_replacement_svga", outputAvailable, sourceUnchanged);
}

function diagnosticFromError(error: unknown): { code: string; message: string } {
  if (error instanceof ShortTermImageReplacementWorkflowError || error instanceof SvgaImageEditError) {
    return {
      code: error.code,
      message: redactShortTermLocalPathsFromError(error, error.message)
    };
  }
  return {
    code: "image_replacement_unexpected_error",
    message: redactShortTermLocalPathsFromError(error, "替换图片流程出现未预期错误。")
  };
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 1024 * 1024) return `${trimNumber(value / (1024 * 1024))} MiB`;
  if (Math.abs(value) >= 1024) return `${trimNumber(value / 1024)} KiB`;
  return `${value} B`;
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
