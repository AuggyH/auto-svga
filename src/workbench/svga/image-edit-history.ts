export type SvgaImageEditTransactionType = "replace_resource" | "reset_resource" | "reset_all";
export type SvgaImageEditExportState = "idle" | "exporting" | "exported" | "failed";

export interface SvgaImageEditResourceIdentity {
  resourceKey: string;
  originalSha256?: string;
}

export interface SvgaImageEditReplacementState {
  resourceKey: string;
  replacementSha256: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
}

export interface SvgaImageEditRevisionSnapshot {
  revision: number;
  digest: string;
  replacements: Readonly<Record<string, SvgaImageEditReplacementState>>;
}

export interface SvgaImageEditTransactionInput {
  transactionId: string;
  type: SvgaImageEditTransactionType;
  resourceKey?: string;
  affectedResourceKeys?: readonly string[];
  replacement?: SvgaImageEditReplacementState;
  source?: string;
}

export interface SvgaImageEditTransactionRecord {
  transactionId: string;
  type: SvgaImageEditTransactionType;
  resourceKey?: string;
  affectedResourceKeys: readonly string[];
  before: SvgaImageEditRevisionSnapshot;
  after: SvgaImageEditRevisionSnapshot;
  order: number;
  revision: number;
  source: string;
  discardedRedoBranch: boolean;
}

export interface SvgaImageEditHistoryState {
  sourceIdentity: string;
  originalResources: readonly SvgaImageEditResourceIdentity[];
  currentReplacements: Readonly<Record<string, SvgaImageEditReplacementState>>;
  selectedResourceKey?: string;
  history: readonly SvgaImageEditRevisionSnapshot[];
  historyCursor: number;
  savedRevision: number;
  savedRevisionDigest: string;
  currentRevision: number;
  dirty: boolean;
  previewOperationSequence: number;
  exportState: SvgaImageEditExportState;
  validationErrors: readonly string[];
  transactions: readonly SvgaImageEditTransactionRecord[];
  maxHistoryLength: number;
}

export interface CreateSvgaImageEditHistoryOptions {
  sourceIdentity: string;
  originalResources: readonly SvgaImageEditResourceIdentity[];
  selectedResourceKey?: string;
  maxHistoryLength?: number;
}

const defaultMaxHistoryLength = 50;

export function createSvgaImageEditHistory(
  options: CreateSvgaImageEditHistoryOptions
): SvgaImageEditHistoryState {
  const maxHistoryLength = Math.max(1, Math.floor(options.maxHistoryLength ?? defaultMaxHistoryLength));
  const initialSnapshot = createSnapshot(0, {});
  return {
    sourceIdentity: options.sourceIdentity,
    originalResources: cloneOriginalResources(options.originalResources),
    currentReplacements: {},
    selectedResourceKey: options.selectedResourceKey,
    history: [initialSnapshot],
    historyCursor: 0,
    savedRevision: 0,
    savedRevisionDigest: initialSnapshot.digest,
    currentRevision: 0,
    dirty: false,
    previewOperationSequence: 0,
    exportState: "idle",
    validationErrors: [],
    transactions: [],
    maxHistoryLength
  };
}

export function applySvgaImageEditTransaction(
  state: SvgaImageEditHistoryState,
  input: SvgaImageEditTransactionInput
): SvgaImageEditHistoryState {
  const resourceKeys = new Set(state.originalResources.map((resource) => resource.resourceKey));
  const before = currentSnapshot(state);
  const nextReplacements = cloneReplacements(state.currentReplacements);

  if (input.type === "replace_resource") {
    if (!input.resourceKey || !resourceKeys.has(input.resourceKey)) {
      return withValidationError(state, "resource_not_found");
    }
    if (!input.replacement || input.replacement.resourceKey !== input.resourceKey) {
      return withValidationError(state, "replacement_required");
    }
    nextReplacements[input.resourceKey] = cloneReplacement(input.replacement);
  }

  if (input.type === "reset_resource") {
    if (!input.resourceKey || !resourceKeys.has(input.resourceKey)) {
      return withValidationError(state, "resource_not_found");
    }
    delete nextReplacements[input.resourceKey];
  }

  if (input.type === "reset_all") {
    for (const resourceKey of Object.keys(nextReplacements)) {
      delete nextReplacements[resourceKey];
    }
  }

  const nextDigest = replacementDigest(nextReplacements);
  if (nextDigest === before.digest) {
    return {
      ...state,
      validationErrors: []
    };
  }

  const revision = state.currentRevision + 1;
  const after = createSnapshot(revision, nextReplacements);
  const discardedRedoBranch = state.historyCursor < state.history.length - 1;
  const branch = state.history.slice(0, state.historyCursor + 1);
  const cappedHistory = capHistory([...branch, after], state.maxHistoryLength);
  const historyCursor = cappedHistory.length - 1;
  const affectedResourceKeys = affectedKeysFor(input, before.replacements, after.replacements);
  const record: SvgaImageEditTransactionRecord = {
    transactionId: input.transactionId,
    type: input.type,
    resourceKey: input.resourceKey,
    affectedResourceKeys,
    before,
    after,
    order: state.transactions.length + 1,
    revision,
    source: input.source ?? "unknown",
    discardedRedoBranch
  };
  return normalizeState({
    ...state,
    currentReplacements: after.replacements,
    history: cappedHistory,
    historyCursor,
    currentRevision: revision,
    previewOperationSequence: state.previewOperationSequence + 1,
    exportState: "idle",
    validationErrors: [],
    transactions: [...state.transactions, record]
  });
}

export function undoSvgaImageEditHistory(state: SvgaImageEditHistoryState): SvgaImageEditHistoryState {
  if (state.historyCursor <= 0) return state;
  const historyCursor = state.historyCursor - 1;
  const snapshot = state.history[historyCursor];
  return normalizeState({
    ...state,
    currentReplacements: snapshot.replacements,
    historyCursor,
    currentRevision: snapshot.revision,
    previewOperationSequence: state.previewOperationSequence + 1,
    exportState: "idle",
    validationErrors: []
  });
}

export function redoSvgaImageEditHistory(state: SvgaImageEditHistoryState): SvgaImageEditHistoryState {
  if (state.historyCursor >= state.history.length - 1) return state;
  const historyCursor = state.historyCursor + 1;
  const snapshot = state.history[historyCursor];
  return normalizeState({
    ...state,
    currentReplacements: snapshot.replacements,
    historyCursor,
    currentRevision: snapshot.revision,
    previewOperationSequence: state.previewOperationSequence + 1,
    exportState: "idle",
    validationErrors: []
  });
}

export function markSvgaImageEditSaved(state: SvgaImageEditHistoryState): SvgaImageEditHistoryState {
  const snapshot = currentSnapshot(state);
  return normalizeState({
    ...state,
    savedRevision: snapshot.revision,
    savedRevisionDigest: snapshot.digest,
    exportState: "exported",
    validationErrors: []
  });
}

export function selectSvgaImageEditResource(
  state: SvgaImageEditHistoryState,
  resourceKey: string
): SvgaImageEditHistoryState {
  if (!state.originalResources.some((resource) => resource.resourceKey === resourceKey)) {
    return withValidationError(state, "resource_not_found");
  }
  return {
    ...state,
    selectedResourceKey: resourceKey,
    validationErrors: []
  };
}

export function replacementDigest(
  replacements: Readonly<Record<string, SvgaImageEditReplacementState>>
): string {
  return JSON.stringify(Object.values(replacements)
    .map((replacement) => ({
      resourceKey: replacement.resourceKey,
      replacementSha256: replacement.replacementSha256,
      sizeBytes: replacement.sizeBytes ?? null,
      width: replacement.width ?? null,
      height: replacement.height ?? null
    }))
    .sort((left, right) => left.resourceKey.localeCompare(right.resourceKey)));
}

function normalizeState(state: SvgaImageEditHistoryState): SvgaImageEditHistoryState {
  const digest = replacementDigest(state.currentReplacements);
  return {
    ...state,
    currentReplacements: cloneReplacements(state.currentReplacements),
    dirty: digest !== state.savedRevisionDigest
  };
}

function withValidationError(state: SvgaImageEditHistoryState, code: string): SvgaImageEditHistoryState {
  return {
    ...state,
    validationErrors: [...state.validationErrors, code]
  };
}

function currentSnapshot(state: SvgaImageEditHistoryState): SvgaImageEditRevisionSnapshot {
  return createSnapshot(state.currentRevision, state.currentReplacements);
}

function createSnapshot(
  revision: number,
  replacements: Readonly<Record<string, SvgaImageEditReplacementState>>
): SvgaImageEditRevisionSnapshot {
  const cloned = cloneReplacements(replacements);
  return {
    revision,
    digest: replacementDigest(cloned),
    replacements: cloned
  };
}

function capHistory(
  history: readonly SvgaImageEditRevisionSnapshot[],
  maxHistoryLength: number
): readonly SvgaImageEditRevisionSnapshot[] {
  if (history.length <= maxHistoryLength) return history;
  return history.slice(history.length - maxHistoryLength);
}

function affectedKeysFor(
  input: SvgaImageEditTransactionInput,
  before: Readonly<Record<string, SvgaImageEditReplacementState>>,
  after: Readonly<Record<string, SvgaImageEditReplacementState>>
): readonly string[] {
  if (input.affectedResourceKeys) return [...input.affectedResourceKeys].sort();
  if (input.resourceKey) return [input.resourceKey];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].sort();
}

function cloneOriginalResources(
  resources: readonly SvgaImageEditResourceIdentity[]
): readonly SvgaImageEditResourceIdentity[] {
  return resources.map((resource) => ({ ...resource }));
}

function cloneReplacements(
  replacements: Readonly<Record<string, SvgaImageEditReplacementState>>
): Record<string, SvgaImageEditReplacementState> {
  return Object.fromEntries(Object.entries(replacements).map(([resourceKey, replacement]) => [
    resourceKey,
    cloneReplacement(replacement)
  ]));
}

function cloneReplacement(replacement: SvgaImageEditReplacementState): SvgaImageEditReplacementState {
  return { ...replacement };
}
