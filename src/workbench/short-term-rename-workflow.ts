import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";
import protobuf from "protobufjs";
import { SvgaImageResourceEditor } from "./svga/image-resource-editor.js";
import { NodeProtobufSvgaInspector } from "./svga/node-protobuf-inspector.js";

export const SHORT_TERM_RENAME_WORKFLOW_SCHEMA_VERSION = 1 as const;

export type ShortTermRenameRunStatus = "renamed" | "failed";

export interface ShortTermRenameReferenceUpdate {
  spriteIndex: number;
  field: "imageKey" | "matteKey";
  fromImageKey: string;
  toImageKey: string;
}

export interface ShortTermRenameValidationModel {
  decodePassed: boolean;
  reopenPassed: boolean;
  sourceUnchanged: boolean;
  referenceClosurePassed: boolean;
  oldKeyAbsent: boolean;
  newKeyPresent: boolean;
  imageBytesPreserved: boolean;
  danglingReferences: readonly string[];
  renamedSha256?: string;
  reopenedImageCount?: number;
}

export interface ShortTermRenameSaveStateModel {
  outputKind: "renamed_svga" | "none";
  dirty: boolean;
  outputAvailable: boolean;
  overwriteSaveEnabled: boolean;
  saveAsEnabled: boolean;
  autoWritePerformed: false;
  sourceUnchanged: boolean;
  validationRequiredBeforeWrite: true;
}

export interface ShortTermRenameWorkflowModel {
  schemaVersion: typeof SHORT_TERM_RENAME_WORKFLOW_SCHEMA_VERSION;
  source: "short-term-rename-workflow";
  prdIds: readonly ["S11", "S14"];
  status: ShortTermRenameRunStatus;
  sourceName: string;
  sourceSha256: string;
  fromImageKey: string;
  toImageKey: string;
  resultTitle: string;
  resultSummary: string;
  referenceUpdates: readonly ShortTermRenameReferenceUpdate[];
  changedFields: readonly string[];
  validation: ShortTermRenameValidationModel;
  saveState: ShortTermRenameSaveStateModel;
  diagnostic?: {
    code: string;
    message: string;
  };
}

export interface ShortTermRenameWorkflowResult {
  renamedBytes?: Uint8Array;
  model: ShortTermRenameWorkflowModel;
  report?: ShortTermRenameReport;
}

export interface ShortTermRenameReport {
  schemaVersion: typeof SHORT_TERM_RENAME_WORKFLOW_SCHEMA_VERSION;
  operationId: "svga-image-key-rename-v1";
  sourceSha256: string;
  sourceSha256AfterRename: string;
  renamedSha256: string;
  fromImageKey: string;
  toImageKey: string;
  imageBytesSha256: string;
  imageSizeBytes: number;
  referenceUpdates: readonly ShortTermRenameReferenceUpdate[];
  changedFields: readonly string[];
  validation: ShortTermRenameValidationModel;
  sourceUnchanged: boolean;
  saveAsRequired: boolean;
  passed: boolean;
}

export interface RunShortTermRenameWorkflowOptions {
  sourceName?: string;
  protoPath?: string;
}

interface KnownMoviePayload {
  version?: string;
  params?: {
    viewBoxWidth?: number;
    viewBoxHeight?: number;
    fps?: number;
    frames?: number;
  };
  images?: Record<string, Uint8Array>;
  sprites?: Array<{
    imageKey?: string;
    frames?: unknown[];
    matteKey?: string;
  }>;
  audios?: unknown[];
}

class ShortTermRenameWorkflowError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ShortTermRenameWorkflowError";
  }
}

export async function runShortTermRenameWorkflow(
  sourceBytes: Uint8Array,
  fromImageKey: string,
  toImageKey: string,
  options: RunShortTermRenameWorkflowOptions = {}
): Promise<ShortTermRenameWorkflowResult> {
  const sourceName = options.sourceName ?? "untitled.svga";
  const sourceSha256 = sha256(sourceBytes);
  const normalizedFrom = fromImageKey.trim();
  const normalizedTo = toImageKey.trim();

  try {
    validateRenameInput(normalizedFrom, normalizedTo);
    await new SvgaImageResourceEditor(options.protoPath).createSession(sourceBytes, sourceName);
    const MovieEntity = await loadMovieEntity(options.protoPath ?? defaultProtoPath());
    const payload = decodeMovie(MovieEntity, sourceBytes);
    const renamed = renamePayload(payload, normalizedFrom, normalizedTo);
    const verificationError = MovieEntity.verify(renamed.payload);
    if (verificationError) {
      throw new ShortTermRenameWorkflowError(
        "svga_rename_verify_failed",
        `重命名后的 SVGA 未通过 protobuf 校验：${verificationError}`
      );
    }
    const renamedBytes = deflateSync(MovieEntity.encode(MovieEntity.create(renamed.payload)).finish());
    const validation = await validateRenamedBytes({
      sourceBytes,
      sourceSha256,
      renamedBytes,
      fromImageKey: normalizedFrom,
      toImageKey: normalizedTo,
      imageBytesSha256: renamed.imageBytesSha256,
      protoPath: options.protoPath
    });
    const report = buildReport({
      sourceBytes,
      renamedBytes,
      fromImageKey: normalizedFrom,
      toImageKey: normalizedTo,
      imageBytesSha256: renamed.imageBytesSha256,
      imageSizeBytes: renamed.imageSizeBytes,
      referenceUpdates: renamed.referenceUpdates,
      validation
    });

    return {
      renamedBytes: report.passed ? renamedBytes : undefined,
      report,
      model: renamedModel({
        sourceName,
        sourceSha256,
        report
      })
    };
  } catch (error) {
    return {
      model: failedModel({
        sourceName,
        sourceSha256,
        fromImageKey: normalizedFrom,
        toImageKey: normalizedTo,
        diagnostic: diagnosticFromError(error)
      })
    };
  }
}

function validateRenameInput(fromImageKey: string, toImageKey: string): void {
  if (!fromImageKey) {
    throw new ShortTermRenameWorkflowError("rename_source_key_required", "原 imageKey 不能为空。");
  }
  if (!toImageKey) {
    throw new ShortTermRenameWorkflowError("rename_target_key_required", "新 imageKey 不能为空。");
  }
  if (fromImageKey === toImageKey) {
    throw new ShortTermRenameWorkflowError("rename_target_unchanged", "新 imageKey 与原 imageKey 相同。");
  }
  if (toImageKey.length > 120 || /[\u0000-\u001F\u007F/\\]/u.test(toImageKey)) {
    throw new ShortTermRenameWorkflowError("rename_target_key_invalid", "新 imageKey 不能包含控制字符、斜杠或反斜杠，且长度不能超过 120。");
  }
}

function renamePayload(
  payload: KnownMoviePayload,
  fromImageKey: string,
  toImageKey: string
): {
  payload: KnownMoviePayload;
  imageBytesSha256: string;
  imageSizeBytes: number;
  referenceUpdates: readonly ShortTermRenameReferenceUpdate[];
} {
  const images = normalizeImages(payload.images);
  if (!Object.hasOwn(images, fromImageKey)) {
    throw new ShortTermRenameWorkflowError("rename_source_key_not_found", "原 imageKey 不存在。");
  }
  if (Object.hasOwn(images, toImageKey)) {
    throw new ShortTermRenameWorkflowError("rename_target_key_exists", "新 imageKey 已存在，不能覆盖已有资源。");
  }

  const imageBytes = images[fromImageKey];
  const renamedImageEntries: Array<[string, Uint8Array]> = Object.entries(images)
    .map(([key, bytes]) => (
      key === fromImageKey ? [toImageKey, bytes] : [key, bytes]
    ));
  const renamedImages = Object.fromEntries(
    renamedImageEntries.sort(([left], [right]) => left.localeCompare(right))
  );
  const referenceUpdates: ShortTermRenameReferenceUpdate[] = [];
  const renamedSprites = (payload.sprites ?? []).map((sprite, spriteIndex) => {
    const next = { ...sprite };
    if (next.imageKey === fromImageKey) {
      next.imageKey = toImageKey;
      referenceUpdates.push({
        spriteIndex,
        field: "imageKey",
        fromImageKey,
        toImageKey
      });
    }
    if (next.matteKey === fromImageKey) {
      next.matteKey = toImageKey;
      referenceUpdates.push({
        spriteIndex,
        field: "matteKey",
        fromImageKey,
        toImageKey
      });
    }
    return next;
  });

  return {
    payload: {
      ...payload,
      images: renamedImages,
      sprites: renamedSprites
    },
    imageBytesSha256: sha256(imageBytes),
    imageSizeBytes: imageBytes.byteLength,
    referenceUpdates
  };
}

function buildReport(input: {
  sourceBytes: Uint8Array;
  renamedBytes: Uint8Array;
  fromImageKey: string;
  toImageKey: string;
  imageBytesSha256: string;
  imageSizeBytes: number;
  referenceUpdates: readonly ShortTermRenameReferenceUpdate[];
  validation: ShortTermRenameValidationModel;
}): ShortTermRenameReport {
  const changedFields = [
    `images.${input.fromImageKey}->${input.toImageKey}`,
    ...input.referenceUpdates.map(({ spriteIndex, field }) => `sprites.${spriteIndex}.${field}`),
    "zlib_bytes",
    "protobuf_serialization"
  ];
  const sourceSha256 = sha256(input.sourceBytes);
  const passed = input.validation.decodePassed
    && input.validation.reopenPassed
    && input.validation.sourceUnchanged
    && input.validation.referenceClosurePassed
    && input.validation.oldKeyAbsent
    && input.validation.newKeyPresent
    && input.validation.imageBytesPreserved;
  return {
    schemaVersion: SHORT_TERM_RENAME_WORKFLOW_SCHEMA_VERSION,
    operationId: "svga-image-key-rename-v1",
    sourceSha256,
    sourceSha256AfterRename: sha256(input.sourceBytes),
    renamedSha256: sha256(input.renamedBytes),
    fromImageKey: input.fromImageKey,
    toImageKey: input.toImageKey,
    imageBytesSha256: input.imageBytesSha256,
    imageSizeBytes: input.imageSizeBytes,
    referenceUpdates: input.referenceUpdates,
    changedFields,
    validation: input.validation,
    sourceUnchanged: input.validation.sourceUnchanged,
    saveAsRequired: true,
    passed
  };
}

function renamedModel(input: {
  sourceName: string;
  sourceSha256: string;
  report: ShortTermRenameReport;
}): ShortTermRenameWorkflowModel {
  const passed = input.report.passed;
  return {
    schemaVersion: SHORT_TERM_RENAME_WORKFLOW_SCHEMA_VERSION,
    source: "short-term-rename-workflow",
    prdIds: ["S11", "S14"],
    status: passed ? "renamed" : "failed",
    sourceName: input.sourceName,
    sourceSha256: input.sourceSha256,
    fromImageKey: input.report.fromImageKey,
    toImageKey: input.report.toImageKey,
    resultTitle: passed ? "已重命名 imageKey" : "重命名结果未通过验证",
    resultSummary: passed
      ? `${input.report.fromImageKey} 已重命名为 ${input.report.toImageKey}，同步更新 ${input.report.referenceUpdates.length} 处引用。`
      : "重命名后的候选 bytes 未通过重新打开或引用闭合验证，保存保持关闭。",
    referenceUpdates: input.report.referenceUpdates,
    changedFields: input.report.changedFields,
    validation: input.report.validation,
    saveState: saveState(passed, input.report.sourceUnchanged)
  };
}

function failedModel(input: {
  sourceName: string;
  sourceSha256: string;
  fromImageKey: string;
  toImageKey: string;
  diagnostic: { code: string; message: string };
}): ShortTermRenameWorkflowModel {
  return {
    schemaVersion: SHORT_TERM_RENAME_WORKFLOW_SCHEMA_VERSION,
    source: "short-term-rename-workflow",
    prdIds: ["S11", "S14"],
    status: "failed",
    sourceName: input.sourceName,
    sourceSha256: input.sourceSha256,
    fromImageKey: input.fromImageKey,
    toImageKey: input.toImageKey,
    resultTitle: "重命名失败",
    resultSummary: "重命名流程已失败关闭，没有生成可保存输出。",
    referenceUpdates: [],
    changedFields: [],
    validation: {
      decodePassed: false,
      reopenPassed: false,
      sourceUnchanged: true,
      referenceClosurePassed: false,
      oldKeyAbsent: false,
      newKeyPresent: false,
      imageBytesPreserved: false,
      danglingReferences: []
    },
    saveState: saveState(false, true),
    diagnostic: input.diagnostic
  };
}

async function validateRenamedBytes(input: {
  sourceBytes: Uint8Array;
  sourceSha256: string;
  renamedBytes: Uint8Array;
  fromImageKey: string;
  toImageKey: string;
  imageBytesSha256: string;
  protoPath?: string;
}): Promise<ShortTermRenameValidationModel> {
  try {
    const reopened = await new NodeProtobufSvgaInspector(input.protoPath).inspect(input.renamedBytes);
    const imageKeys = new Set(reopened.images.map(({ imageKey }) => imageKey));
    const danglingReferences = [...new Set(reopened.sprites.flatMap(({ imageKey, matteKey }) => [
      imageKey,
      matteKey
    ]).filter((resourceKey) => resourceKey.length > 0 && !imageKeys.has(resourceKey)))].sort();
    const renamedImage = reopened.images.find(({ imageKey }) => imageKey === input.toImageKey);
    return {
      decodePassed: true,
      reopenPassed: true,
      sourceUnchanged: sha256(input.sourceBytes) === input.sourceSha256,
      referenceClosurePassed: danglingReferences.length === 0,
      oldKeyAbsent: !imageKeys.has(input.fromImageKey),
      newKeyPresent: imageKeys.has(input.toImageKey),
      imageBytesPreserved: renamedImage ? sha256(renamedImage.bytes) === input.imageBytesSha256 : false,
      danglingReferences,
      renamedSha256: sha256(input.renamedBytes),
      reopenedImageCount: reopened.images.length
    };
  } catch {
    return {
      decodePassed: false,
      reopenPassed: false,
      sourceUnchanged: sha256(input.sourceBytes) === input.sourceSha256,
      referenceClosurePassed: false,
      oldKeyAbsent: false,
      newKeyPresent: false,
      imageBytesPreserved: false,
      danglingReferences: [],
      renamedSha256: sha256(input.renamedBytes)
    };
  }
}

function saveState(outputAvailable: boolean, sourceUnchanged: boolean): ShortTermRenameSaveStateModel {
  return {
    outputKind: outputAvailable ? "renamed_svga" : "none",
    dirty: outputAvailable,
    outputAvailable,
    overwriteSaveEnabled: outputAvailable,
    saveAsEnabled: outputAvailable,
    autoWritePerformed: false,
    sourceUnchanged,
    validationRequiredBeforeWrite: true
  };
}

async function loadMovieEntity(protoPath: string): Promise<protobuf.Type> {
  const root = await protobuf.load(protoPath);
  return root.lookupType("com.opensource.svga.MovieEntity");
}

function decodeMovie(MovieEntity: protobuf.Type, bytes: Uint8Array): KnownMoviePayload {
  try {
    const decoded = MovieEntity.decode(inflateSync(bytes));
    const payload = MovieEntity.toObject(decoded, {
      bytes: Buffer,
      defaults: true
    }) as KnownMoviePayload;
    if (!payload.params || !payload.images || !payload.sprites) {
      throw new Error("SVGA MovieEntity is missing params, images, or sprites.");
    }
    return {
      ...payload,
      images: normalizeImages(payload.images)
    };
  } catch (error) {
    throw new ShortTermRenameWorkflowError(
      "svga_decode_failed",
      `SVGA 无法 inflate 或 protobuf decode：${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function normalizeImages(images: KnownMoviePayload["images"]): Record<string, Uint8Array> {
  return Object.fromEntries(
    Object.entries(images ?? {}).map(([key, value]) => [key, toUint8Array(value)])
  );
}

function toUint8Array(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    return value.slice();
  }
  if (Array.isArray(value)) {
    return Uint8Array.from(value);
  }
  throw new ShortTermRenameWorkflowError("svga_invalid_image_bytes", "SVGA 图片资源 bytes 不可读取。");
}

function diagnosticFromError(error: unknown): { code: string; message: string } {
  if (error instanceof ShortTermRenameWorkflowError) {
    return {
      code: error.code,
      message: error.message
    };
  }
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return {
      code: error.code,
      message: error.message
    };
  }
  return {
    code: "rename_unexpected_error",
    message: error instanceof Error ? error.message : String(error)
  };
}

function defaultProtoPath(): string {
  return fileURLToPath(new URL("../../proto/svga.proto", import.meta.url));
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
