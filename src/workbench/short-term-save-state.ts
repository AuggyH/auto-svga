import { createHash } from "node:crypto";

export const SHORT_TERM_SAVE_STATE_SCHEMA_VERSION = 1 as const;

export type ShortTermPersistedOutputKind =
  | "optimized_svga"
  | "renamed_svga"
  | "image_replacement_svga";

export type ShortTermSaveCommand = "overwrite" | "saveAs";
export type ShortTermSaveValidationStatus = "saveComplete" | "saveFailed";

export interface ShortTermPersistedOutputSaveStateModel {
  outputKind: ShortTermPersistedOutputKind | "none";
  dirty: boolean;
  outputAvailable: boolean;
  overwriteSaveEnabled: boolean;
  saveAsEnabled: boolean;
  autoWritePerformed: false;
  sourceUnchanged: boolean;
  validationRequiredBeforeWrite: true;
}

export interface ShortTermPersistedOutputRecord {
  schemaVersion: typeof SHORT_TERM_SAVE_STATE_SCHEMA_VERSION;
  prdIds: readonly ["S14"];
  outputId: string;
  outputKind: ShortTermPersistedOutputKind;
  operationId: string;
  sourceName: string;
  sourceSha256: string;
  outputSha256: string;
  outputSizeBytes: number;
  validationPassed: boolean;
  dirty: boolean;
  saveState: ShortTermPersistedOutputSaveStateModel;
  validationRefs: readonly string[];
}

export interface ShortTermPersistedOutputInput {
  outputKind: ShortTermPersistedOutputKind;
  operationId: string;
  sourceName: string;
  sourceSha256: string;
  outputBytes: Uint8Array;
  sourceUnchanged: boolean;
  validationPassed: boolean;
  validationRefs?: readonly string[];
}

export interface ShortTermSaveValidationResult {
  schemaVersion: typeof SHORT_TERM_SAVE_STATE_SCHEMA_VERSION;
  prdIds: readonly ["S14"];
  status: ShortTermSaveValidationStatus;
  command: ShortTermSaveCommand;
  outputId: string;
  outputSha256: string;
  savedSha256: string;
  dirty: boolean;
  message: string;
}

export function createShortTermOutputSaveState(
  outputKind: ShortTermPersistedOutputKind,
  outputAvailable: boolean,
  sourceUnchanged: boolean
): ShortTermPersistedOutputSaveStateModel {
  return {
    outputKind: outputAvailable ? outputKind : "none",
    dirty: outputAvailable,
    outputAvailable,
    overwriteSaveEnabled: outputAvailable,
    saveAsEnabled: outputAvailable,
    autoWritePerformed: false,
    sourceUnchanged,
    validationRequiredBeforeWrite: true
  };
}

export function createShortTermPersistedOutputRecord(
  input: ShortTermPersistedOutputInput
): ShortTermPersistedOutputRecord {
  const outputSha256 = sha256(input.outputBytes);
  const outputAvailable = input.validationPassed && input.sourceUnchanged;
  const outputId = `${input.outputKind}:${outputSha256.slice(0, 16)}`;
  return {
    schemaVersion: SHORT_TERM_SAVE_STATE_SCHEMA_VERSION,
    prdIds: ["S14"],
    outputId,
    outputKind: input.outputKind,
    operationId: input.operationId,
    sourceName: input.sourceName,
    sourceSha256: input.sourceSha256,
    outputSha256,
    outputSizeBytes: input.outputBytes.byteLength,
    validationPassed: input.validationPassed,
    dirty: outputAvailable,
    saveState: createShortTermOutputSaveState(input.outputKind, outputAvailable, input.sourceUnchanged),
    validationRefs: input.validationRefs ?? []
  };
}

export function validateShortTermSavedBytes(
  record: ShortTermPersistedOutputRecord,
  savedBytes: Uint8Array,
  command: ShortTermSaveCommand
): ShortTermSaveValidationResult {
  const savedSha256 = sha256(savedBytes);
  const matched = record.validationPassed
    && record.saveState.outputAvailable
    && savedSha256 === record.outputSha256;
  return {
    schemaVersion: SHORT_TERM_SAVE_STATE_SCHEMA_VERSION,
    prdIds: ["S14"],
    status: matched ? "saveComplete" : "saveFailed",
    command,
    outputId: record.outputId,
    outputSha256: record.outputSha256,
    savedSha256,
    dirty: !matched,
    message: matched
      ? "保存后的文件与已验证输出一致。"
      : "保存后的文件未匹配已验证输出，保持未保存状态。"
  };
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
