import type { ShortTermHostActionState } from "./short-term-host-actions.js";
import type { ShortTermPersistedOutputKind } from "./short-term-save-state.js";

export const SHORT_TERM_HOST_LIFECYCLE_SCHEMA_VERSION = 1 as const;

export type ShortTermHostLifecycleRequestKind = "windowClose" | "appQuit";
export type ShortTermHostLifecycleDecisionRequestKind = ShortTermHostLifecycleRequestKind | "unsupported";
export type ShortTermHostLifecycleDecisionStatus = "allow" | "blocked";

export interface ShortTermHostLifecycleRequestInput {
  request: ShortTermHostLifecycleRequestKind;
  discardUnsavedChanges?: boolean;
}

export interface ShortTermHostLifecycleDecision {
  schemaVersion: typeof SHORT_TERM_HOST_LIFECYCLE_SCHEMA_VERSION;
  source: "short-term-host-lifecycle";
  prdIds: readonly ["S14"];
  request: ShortTermHostLifecycleDecisionRequestKind;
  status: ShortTermHostLifecycleDecisionStatus;
  canProceed: boolean;
  dirty: boolean;
  shouldPromptDiscard: boolean;
  pathRedacted: true;
  message: string;
  activeOutputKind?: ShortTermPersistedOutputKind;
  activeOutputSha256?: string;
  diagnostic?: {
    code: string;
    message: string;
  };
}

export function evaluateShortTermHostLifecycleRequest(
  state: ShortTermHostActionState,
  input: ShortTermHostLifecycleRequestInput
): ShortTermHostLifecycleDecision {
  const activeOutput = state.facade.model.activeOutput;
  const dirty = hasShortTermUnsavedHostOutput(state);
  const normalizedInput = normalizeShortTermHostLifecycleRequestInput(input);
  if (!normalizedInput.valid) {
    return decision("unsupported", "blocked", dirty, "生命周期请求不可用。", {
      activeOutputKind: activeOutput?.outputKind,
      activeOutputSha256: activeOutput?.outputSha256,
      shouldPromptDiscard: false,
      diagnostic: normalizedInput.diagnostic
    });
  }

  const confirmedDiscard = normalizedInput.discardUnsavedChanges === true;
  if (dirty && !confirmedDiscard) {
    return decision(normalizedInput.request, "blocked", dirty, "当前文件有未保存输出，退出前需要确认丢弃。", {
      activeOutputKind: activeOutput?.outputKind,
      activeOutputSha256: activeOutput?.outputSha256,
      diagnostic: {
        code: "lifecycle_requires_discard_confirmation",
        message: "Window close or app quit is blocked until the caller confirms discarding unsaved output."
      }
    });
  }

  return decision(normalizedInput.request, "allow", dirty, dirty
    ? "已确认丢弃未保存输出，可以继续退出。"
    : "当前没有未保存输出，可以继续退出。", {
    activeOutputKind: activeOutput?.outputKind,
    activeOutputSha256: activeOutput?.outputSha256
  });
}

export function hasShortTermUnsavedHostOutput(state: ShortTermHostActionState): boolean {
  return Boolean(state.activeOutputBytes || state.facade.model.activeOutput);
}

function decision(
  request: ShortTermHostLifecycleDecisionRequestKind,
  status: ShortTermHostLifecycleDecisionStatus,
  dirty: boolean,
  message: string,
  options: Partial<Pick<
    ShortTermHostLifecycleDecision,
    "activeOutputKind" | "activeOutputSha256" | "diagnostic" | "shouldPromptDiscard"
  >> = {}
): ShortTermHostLifecycleDecision {
  const shouldPromptDiscard = options.shouldPromptDiscard ?? status === "blocked";
  return {
    schemaVersion: SHORT_TERM_HOST_LIFECYCLE_SCHEMA_VERSION,
    source: "short-term-host-lifecycle",
    prdIds: ["S14"],
    request,
    status,
    canProceed: status === "allow",
    dirty,
    shouldPromptDiscard,
    pathRedacted: true,
    message,
    ...withoutUndefined(options)
  };
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

type NormalizedShortTermHostLifecycleRequestInput =
  | {
      valid: true;
      request: ShortTermHostLifecycleRequestKind;
      discardUnsavedChanges?: boolean;
    }
  | {
      valid: false;
      diagnostic: NonNullable<ShortTermHostLifecycleDecision["diagnostic"]>;
    };

function normalizeShortTermHostLifecycleRequestInput(
  input: ShortTermHostLifecycleRequestInput
): NormalizedShortTermHostLifecycleRequestInput {
  if (!isRecord(input)) {
    return invalidLifecycleInput("lifecycle_request_invalid", "Lifecycle request input must be an object.");
  }

  if (!isShortTermHostLifecycleRequestKind(input.request)) {
    return invalidLifecycleInput("lifecycle_request_kind_invalid", "Lifecycle request kind is missing or unsupported.");
  }

  if (
    Object.prototype.hasOwnProperty.call(input, "discardUnsavedChanges")
    && input.discardUnsavedChanges !== undefined
    && typeof input.discardUnsavedChanges !== "boolean"
  ) {
    return invalidLifecycleInput("lifecycle_discard_flag_invalid", "Lifecycle discard flag must be a boolean when provided.");
  }

  return {
    valid: true,
    request: input.request,
    ...(input.discardUnsavedChanges === true ? { discardUnsavedChanges: true } : {})
  };
}

function invalidLifecycleInput(
  code: string,
  message: string
): Extract<NormalizedShortTermHostLifecycleRequestInput, { valid: false }> {
  return {
    valid: false,
    diagnostic: {
      code,
      message
    }
  };
}

function isShortTermHostLifecycleRequestKind(value: unknown): value is ShortTermHostLifecycleRequestKind {
  return value === "windowClose" || value === "appQuit";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
