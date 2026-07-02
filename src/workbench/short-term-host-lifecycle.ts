import type { ShortTermHostActionState } from "./short-term-host-actions.js";
import type { ShortTermPersistedOutputKind } from "./short-term-save-state.js";

export const SHORT_TERM_HOST_LIFECYCLE_SCHEMA_VERSION = 1 as const;

export type ShortTermHostLifecycleRequestKind = "windowClose" | "appQuit";
export type ShortTermHostLifecycleDecisionStatus = "allow" | "blocked";

export interface ShortTermHostLifecycleRequestInput {
  request: ShortTermHostLifecycleRequestKind;
  discardUnsavedChanges?: boolean;
}

export interface ShortTermHostLifecycleDecision {
  schemaVersion: typeof SHORT_TERM_HOST_LIFECYCLE_SCHEMA_VERSION;
  source: "short-term-host-lifecycle";
  prdIds: readonly ["S14"];
  request: ShortTermHostLifecycleRequestKind;
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
  const confirmedDiscard = input.discardUnsavedChanges === true;
  if (dirty && !confirmedDiscard) {
    return decision(input.request, "blocked", dirty, "当前文件有未保存输出，退出前需要确认丢弃。", {
      activeOutputKind: activeOutput?.outputKind,
      activeOutputSha256: activeOutput?.outputSha256,
      diagnostic: {
        code: "lifecycle_requires_discard_confirmation",
        message: "Window close or app quit is blocked until the caller confirms discarding unsaved output."
      }
    });
  }

  return decision(input.request, "allow", dirty, dirty
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
  request: ShortTermHostLifecycleRequestKind,
  status: ShortTermHostLifecycleDecisionStatus,
  dirty: boolean,
  message: string,
  options: Partial<Pick<ShortTermHostLifecycleDecision, "activeOutputKind" | "activeOutputSha256" | "diagnostic">> = {}
): ShortTermHostLifecycleDecision {
  return {
    schemaVersion: SHORT_TERM_HOST_LIFECYCLE_SCHEMA_VERSION,
    source: "short-term-host-lifecycle",
    prdIds: ["S14"],
    request,
    status,
    canProceed: status === "allow",
    dirty,
    shouldPromptDiscard: status === "blocked",
    pathRedacted: true,
    message,
    ...withoutUndefined(options)
  };
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
