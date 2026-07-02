import { createHash } from "node:crypto";

export const SHORT_TERM_TEXT_PREVIEW_SESSION_SCHEMA_VERSION = 1 as const;

export type ShortTermRuntimeTextField = "text" | "family" | "size" | "color" | "offset";
export type ShortTermTextPreviewStatus = "noTextElements" | "ready" | "applied" | "failed" | "reset";

export interface ShortTermRuntimeTextElement {
  textKey: string;
  displayName: string;
  initialText?: string;
  supportedFields: readonly ShortTermRuntimeTextField[];
}

export interface ShortTermRuntimeTextReplacement {
  textKey: string;
  fields: {
    text?: string;
    family?: string;
    size?: number;
    color?: string;
    offset?: {
      x: number;
      y: number;
    };
  };
}

export interface ShortTermTextPreviewSessionModel {
  schemaVersion: typeof SHORT_TERM_TEXT_PREVIEW_SESSION_SCHEMA_VERSION;
  source: "short-term-text-preview-session";
  prdIds: readonly ["S13"];
  mode: "preview";
  status: ShortTermTextPreviewStatus;
  sourceName: string;
  sourceSha256: string;
  textElements: readonly ShortTermRuntimeTextElement[];
  activeReplacement?: ShortTermRuntimeTextReplacement;
  playerAction: "keepPreview" | "applyRuntimeText" | "clearRuntimeText";
  sourceBytesUnchanged: true;
  bytePersistenceSupported: false;
  message: string;
  diagnostic?: {
    code: string;
    message: string;
  };
}

export interface ShortTermTextPreviewSessionState {
  sourceBytes: Uint8Array;
  model: ShortTermTextPreviewSessionModel;
}

export interface CreateShortTermTextPreviewSessionOptions {
  sourceName?: string;
  textElements?: readonly ShortTermRuntimeTextElement[];
}

export function createShortTermTextPreviewSession(
  sourceBytes: Uint8Array,
  options: CreateShortTermTextPreviewSessionOptions = {}
): ShortTermTextPreviewSessionState {
  const textElements = normalizeTextElements(options.textElements ?? []);
  return {
    sourceBytes: new Uint8Array(sourceBytes),
    model: {
      schemaVersion: SHORT_TERM_TEXT_PREVIEW_SESSION_SCHEMA_VERSION,
      source: "short-term-text-preview-session",
      prdIds: ["S13"],
      mode: "preview",
      status: textElements.length > 0 ? "ready" : "noTextElements",
      sourceName: options.sourceName ?? "untitled.svga",
      sourceSha256: sha256(sourceBytes),
      textElements,
      playerAction: "keepPreview",
      sourceBytesUnchanged: true,
      bytePersistenceSupported: false,
      message: textElements.length > 0
        ? "已发现可运行时预览的文本元素。"
        : "当前解析层未发现可运行时预览的文本元素。"
    }
  };
}

export function applyShortTermTextPreview(
  session: ShortTermTextPreviewSessionState,
  replacement: ShortTermRuntimeTextReplacement
): ShortTermTextPreviewSessionState {
  const textKey = replacement.textKey.trim();
  const element = session.model.textElements.find((item) => item.textKey === textKey);
  if (!element) {
    return failedSession(session, {
      code: "text_key_not_found",
      message: "目标 textKey 不存在，运行时文本预览保持不变。"
    });
  }

  const fields = normalizeReplacementFields(replacement.fields, element.supportedFields);
  if (Object.keys(fields).length === 0) {
    return failedSession(session, {
      code: "text_replacement_fields_empty",
      message: "没有可应用的受支持文本字段。"
    });
  }

  return {
    sourceBytes: new Uint8Array(session.sourceBytes),
    model: {
      ...session.model,
      status: "applied",
      activeReplacement: {
        textKey,
        fields
      },
      playerAction: "applyRuntimeText",
      sourceBytesUnchanged: true,
      bytePersistenceSupported: false,
      message: "运行时文本替换已应用到预览状态，不写入 SVGA 字节。"
    }
  };
}

export function resetShortTermTextPreview(
  session: ShortTermTextPreviewSessionState
): ShortTermTextPreviewSessionState {
  const modelWithoutReplacement = { ...session.model };
  delete modelWithoutReplacement.activeReplacement;
  delete modelWithoutReplacement.diagnostic;

  return {
    sourceBytes: new Uint8Array(session.sourceBytes),
    model: {
      ...modelWithoutReplacement,
      status: session.model.textElements.length > 0 ? "reset" : "noTextElements",
      playerAction: "clearRuntimeText",
      sourceBytesUnchanged: true,
      bytePersistenceSupported: false,
      message: "运行时文本预览已重置，源 SVGA 字节保持不变。"
    }
  };
}

function failedSession(
  session: ShortTermTextPreviewSessionState,
  diagnostic: { code: string; message: string }
): ShortTermTextPreviewSessionState {
  return {
    sourceBytes: new Uint8Array(session.sourceBytes),
    model: {
      ...session.model,
      status: "failed",
      playerAction: "keepPreview",
      sourceBytesUnchanged: true,
      bytePersistenceSupported: false,
      message: diagnostic.message,
      diagnostic
    }
  };
}

function normalizeTextElements(elements: readonly ShortTermRuntimeTextElement[]): ShortTermRuntimeTextElement[] {
  const seen = new Set<string>();
  const normalized: ShortTermRuntimeTextElement[] = [];
  for (const element of elements) {
    const textKey = element.textKey.trim();
    if (!textKey || seen.has(textKey)) continue;
    seen.add(textKey);
    normalized.push({
      textKey,
      displayName: element.displayName.trim() || textKey,
      ...(element.initialText !== undefined ? { initialText: element.initialText } : {}),
      supportedFields: [...new Set(element.supportedFields)].filter(isSupportedField)
    });
  }
  return normalized;
}

function normalizeReplacementFields(
  fields: ShortTermRuntimeTextReplacement["fields"],
  supportedFields: readonly ShortTermRuntimeTextField[]
): ShortTermRuntimeTextReplacement["fields"] {
  const supported = new Set(supportedFields);
  return {
    ...(supported.has("text") && typeof fields.text === "string" ? { text: fields.text } : {}),
    ...(supported.has("family") && typeof fields.family === "string" && fields.family.trim() ? { family: fields.family.trim() } : {}),
    ...(supported.has("size") && Number.isFinite(fields.size) && Number(fields.size) > 0 ? { size: Number(fields.size) } : {}),
    ...(supported.has("color") && typeof fields.color === "string" && fields.color.trim() ? { color: fields.color.trim() } : {}),
    ...(supported.has("offset") && fields.offset && Number.isFinite(fields.offset.x) && Number.isFinite(fields.offset.y)
      ? { offset: { x: Number(fields.offset.x), y: Number(fields.offset.y) } }
      : {})
  };
}

function isSupportedField(value: string): value is ShortTermRuntimeTextField {
  return ["text", "family", "size", "color", "offset"].includes(value);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
