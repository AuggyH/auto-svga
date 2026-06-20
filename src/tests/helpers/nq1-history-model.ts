import {
  applySvgaImageEditTransaction,
  createSvgaImageEditHistory,
  markSvgaImageEditSaved,
  redoSvgaImageEditHistory,
  selectSvgaImageEditResource,
  undoSvgaImageEditHistory
} from "../../workbench/svga/index.js";
import type {
  SvgaImageEditHistoryState,
  SvgaImageEditReplacementState,
  SvgaImageEditResourceIdentity
} from "../../workbench/svga/index.js";

export interface Nq1HistoryModelOptions {
  seeds: number;
  operationsPerSeed: number;
  maxHistoryLength?: number;
}

export interface Nq1HistoryModelReport {
  schemaVersion: 1;
  milestoneId: "NQ1";
  reportId: "model-based-history";
  seedCount: number;
  operationsPerSeed: number;
  totalOperations: number;
  passed: boolean;
  failureCount: number;
  failures: readonly Nq1HistoryModelFailure[];
  operationCoverage: Readonly<Record<string, number>>;
  invariantCoverage: {
    undoToInitialClean: boolean;
    undoToSavePointClean: boolean;
    resetAllDirtyDependsOnSavePoint: boolean;
    redoBranchTruncated: boolean;
    invalidReplacementDidNotAdvance: boolean;
    failedPreviewDidNotAdvance: boolean;
    historyCapObserved: boolean;
    openNewFileClearedHistory: boolean;
    sameResourceReplacementOrdering: boolean;
  };
}

export interface Nq1HistoryModelFailure {
  seed: number;
  operationIndex: number;
  operation: Nq1HistoryOperation;
  operations: readonly Nq1HistoryOperation[];
  expected: unknown;
  actual: unknown;
}

type Nq1HistoryOperation =
  | { type: "replace"; resourceKey: string; replacementSha256: string }
  | { type: "replace_same_again"; resourceKey: string; replacementSha256: string }
  | { type: "reset_selected" }
  | { type: "reset_all" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "save_point" }
  | { type: "select"; resourceKey: string }
  | { type: "invalid_replace" }
  | { type: "failed_preview" }
  | { type: "open_new_file"; sourceIdentity: string };

interface ReferenceState {
  sourceIdentity: string;
  originalResources: readonly SvgaImageEditResourceIdentity[];
  currentReplacements: Record<string, SvgaImageEditReplacementState>;
  selectedResourceKey?: string;
  history: ReferenceSnapshot[];
  historyCursor: number;
  savedRevision: number;
  savedRevisionDigest: string;
  currentRevision: number;
  dirty: boolean;
  validationErrors: string[];
  maxHistoryLength: number;
}

interface ReferenceSnapshot {
  revision: number;
  digest: string;
  replacements: Record<string, SvgaImageEditReplacementState>;
}

const resources: readonly SvgaImageEditResourceIdentity[] = [
  { resourceKey: "img_frame_left", originalSha256: "left-original" },
  { resourceKey: "img_frame_right", originalSha256: "right-original" },
  { resourceKey: "img_unused_marker", originalSha256: "unused-original" }
];

export function runNq1HistoryModelValidation(
  options: Nq1HistoryModelOptions
): Nq1HistoryModelReport {
  const maxHistoryLength = options.maxHistoryLength ?? 12;
  const failures: Nq1HistoryModelFailure[] = [];
  const operationCoverage: Record<string, number> = {};
  const invariantCoverage = {
    undoToInitialClean: false,
    undoToSavePointClean: false,
    resetAllDirtyDependsOnSavePoint: false,
    redoBranchTruncated: false,
    invalidReplacementDidNotAdvance: false,
    failedPreviewDidNotAdvance: false,
    historyCapObserved: false,
    openNewFileClearedHistory: false,
    sameResourceReplacementOrdering: false
  };

  for (let seed = 1; seed <= options.seeds; seed += 1) {
    let actual = createActualState(seed, maxHistoryLength);
    let expected = createReferenceState(seed, maxHistoryLength);
    const operations: Nq1HistoryOperation[] = [];

    for (let operationIndex = 0; operationIndex < options.operationsPerSeed; operationIndex += 1) {
      const operation = operationFor(seed, operationIndex, actual.selectedResourceKey ?? resources[0].resourceKey);
      operations.push(operation);
      operationCoverage[operation.type] = (operationCoverage[operation.type] ?? 0) + 1;

      const beforeActual = projectActual(actual);
      const beforeExpected = projectReference(expected);
      actual = applyActualOperation(actual, operation);
      expected = applyReferenceOperation(expected, operation, maxHistoryLength);

      const actualProjection = projectActual(actual);
      const expectedProjection = projectReference(expected);
      if (stableStringify(actualProjection) !== stableStringify(expectedProjection)) {
        failures.push({
          seed,
          operationIndex,
          operation,
          operations: operations.slice(),
          expected: expectedProjection,
          actual: actualProjection
        });
        break;
      }
      updateCoverage(invariantCoverage, operation, beforeActual, actualProjection, beforeExpected, expectedProjection);
    }
  }

  return {
    schemaVersion: 1,
    milestoneId: "NQ1",
    reportId: "model-based-history",
    seedCount: options.seeds,
    operationsPerSeed: options.operationsPerSeed,
    totalOperations: options.seeds * options.operationsPerSeed,
    passed: failures.length === 0 && Object.values(invariantCoverage).every(Boolean),
    failureCount: failures.length,
    failures,
    operationCoverage,
    invariantCoverage
  };
}

function createActualState(seed: number, maxHistoryLength: number): SvgaImageEditHistoryState {
  return createSvgaImageEditHistory({
    sourceIdentity: `fixture-source-${seed}`,
    originalResources: resources,
    selectedResourceKey: resources[0].resourceKey,
    maxHistoryLength
  });
}

function createReferenceState(seed: number, maxHistoryLength: number): ReferenceState {
  const initial = createReferenceSnapshot(0, {});
  return {
    sourceIdentity: `fixture-source-${seed}`,
    originalResources: resources.map((resource) => ({ ...resource })),
    currentReplacements: {},
    selectedResourceKey: resources[0].resourceKey,
    history: [initial],
    historyCursor: 0,
    savedRevision: 0,
    savedRevisionDigest: initial.digest,
    currentRevision: 0,
    dirty: false,
    validationErrors: [],
    maxHistoryLength
  };
}

function operationFor(seed: number, index: number, selectedResourceKey: string): Nq1HistoryOperation {
  const key = resources[(seed + index) % resources.length].resourceKey;
  const otherKey = resources[(seed + index + 1) % resources.length].resourceKey;
  const replacementSha256 = `seed-${seed}-op-${index}-${key}`;
  switch (index % 19) {
    case 0:
      return { type: "select", resourceKey: key };
    case 1:
      return { type: "replace", resourceKey: key, replacementSha256 };
    case 2:
      return { type: "undo" };
    case 3:
      return { type: "redo" };
    case 4:
      return { type: "replace_same_again", resourceKey: key, replacementSha256: `${replacementSha256}-again` };
    case 5:
      return { type: "replace", resourceKey: otherKey, replacementSha256 };
    case 6:
      return { type: "replace", resourceKey: selectedResourceKey, replacementSha256: `${replacementSha256}-cap-a` };
    case 7:
      return { type: "replace", resourceKey: otherKey, replacementSha256: `${replacementSha256}-cap-b` };
    case 8:
      return { type: "save_point" };
    case 9:
      return { type: "reset_selected" };
    case 10:
      return { type: "undo" };
    case 11:
      return { type: "reset_all" };
    case 12:
      return { type: "undo" };
    case 13:
      return { type: "replace", resourceKey: selectedResourceKey, replacementSha256: `${replacementSha256}-branch` };
    case 14:
      return { type: "invalid_replace" };
    case 15:
      return { type: "failed_preview" };
    case 16:
      return { type: "undo" };
    case 17:
      return { type: "open_new_file", sourceIdentity: `fixture-source-${seed}-open-${index}` };
    case 18:
      return { type: "replace", resourceKey: key, replacementSha256: `${replacementSha256}-after-open` };
    default:
      return { type: "failed_preview" };
  }
}

function applyActualOperation(
  state: SvgaImageEditHistoryState,
  operation: Nq1HistoryOperation
): SvgaImageEditHistoryState {
  switch (operation.type) {
    case "replace":
    case "replace_same_again":
      return applySvgaImageEditTransaction(state, {
        transactionId: `tx-${operation.type}-${operation.replacementSha256}`,
        type: "replace_resource",
        resourceKey: operation.resourceKey,
        replacement: replacement(operation.resourceKey, operation.replacementSha256),
        source: "nq1-model"
      });
    case "reset_selected":
      return applySvgaImageEditTransaction(state, {
        transactionId: "tx-reset-selected",
        type: "reset_resource",
        resourceKey: state.selectedResourceKey,
        source: "nq1-model"
      });
    case "reset_all":
      return applySvgaImageEditTransaction(state, {
        transactionId: "tx-reset-all",
        type: "reset_all",
        source: "nq1-model"
      });
    case "undo":
      return undoSvgaImageEditHistory(state);
    case "redo":
      return redoSvgaImageEditHistory(state);
    case "save_point":
      return markSvgaImageEditSaved(state);
    case "select":
      return selectSvgaImageEditResource(state, operation.resourceKey);
    case "invalid_replace":
      return applySvgaImageEditTransaction(state, {
        transactionId: "tx-invalid",
        type: "replace_resource",
        resourceKey: "missing",
        replacement: replacement("missing", "missing-replacement"),
        source: "nq1-model"
      });
    case "open_new_file":
      return createSvgaImageEditHistory({
        sourceIdentity: operation.sourceIdentity,
        originalResources: resources,
        selectedResourceKey: resources[0].resourceKey,
        maxHistoryLength: state.maxHistoryLength
      });
    case "failed_preview":
      return state;
  }
}

function applyReferenceOperation(
  state: ReferenceState,
  operation: Nq1HistoryOperation,
  maxHistoryLength: number
): ReferenceState {
  switch (operation.type) {
    case "replace":
    case "replace_same_again":
      return applyReferenceTransaction(state, operation.resourceKey, replacement(operation.resourceKey, operation.replacementSha256), maxHistoryLength);
    case "reset_selected":
      return state.selectedResourceKey
        ? applyReferenceTransaction(state, state.selectedResourceKey, undefined, maxHistoryLength)
        : withReferenceError(state, "resource_not_found");
    case "reset_all":
      return applyReferenceResetAll(state, maxHistoryLength);
    case "undo":
      return referenceUndo(state);
    case "redo":
      return referenceRedo(state);
    case "save_point":
      return normalizeReference({
        ...state,
        savedRevision: state.currentRevision,
        savedRevisionDigest: referenceDigest(state.currentReplacements),
        validationErrors: []
      });
    case "select":
      return state.originalResources.some(({ resourceKey }) => resourceKey === operation.resourceKey)
        ? { ...state, selectedResourceKey: operation.resourceKey, validationErrors: [] }
        : withReferenceError(state, "resource_not_found");
    case "invalid_replace":
      return withReferenceError(state, "resource_not_found");
    case "open_new_file":
      return {
        ...createReferenceState(0, maxHistoryLength),
        sourceIdentity: operation.sourceIdentity
      };
    case "failed_preview":
      return state;
  }
}

function applyReferenceTransaction(
  state: ReferenceState,
  resourceKey: string,
  nextReplacement: SvgaImageEditReplacementState | undefined,
  maxHistoryLength: number
): ReferenceState {
  if (!state.originalResources.some((resource) => resource.resourceKey === resourceKey)) {
    return withReferenceError(state, "resource_not_found");
  }
  const nextReplacements = cloneReplacements(state.currentReplacements);
  if (nextReplacement) {
    nextReplacements[resourceKey] = { ...nextReplacement };
  } else {
    delete nextReplacements[resourceKey];
  }
  return appendReferenceSnapshot(state, nextReplacements, maxHistoryLength);
}

function applyReferenceResetAll(state: ReferenceState, maxHistoryLength: number): ReferenceState {
  return appendReferenceSnapshot(state, {}, maxHistoryLength);
}

function appendReferenceSnapshot(
  state: ReferenceState,
  nextReplacements: Record<string, SvgaImageEditReplacementState>,
  maxHistoryLength: number
): ReferenceState {
  const beforeDigest = referenceDigest(state.currentReplacements);
  const nextDigest = referenceDigest(nextReplacements);
  if (beforeDigest === nextDigest) {
    return {
      ...state,
      validationErrors: []
    };
  }
  const revision = state.currentRevision + 1;
  const snapshot = createReferenceSnapshot(revision, nextReplacements);
  const branch = state.history.slice(0, state.historyCursor + 1);
  const history = capReferenceHistory([...branch, snapshot], maxHistoryLength);
  return normalizeReference({
    ...state,
    currentReplacements: cloneReplacements(snapshot.replacements),
    history,
    historyCursor: history.length - 1,
    currentRevision: revision,
    validationErrors: []
  });
}

function referenceUndo(state: ReferenceState): ReferenceState {
  if (state.historyCursor <= 0) return state;
  const historyCursor = state.historyCursor - 1;
  const snapshot = state.history[historyCursor];
  return normalizeReference({
    ...state,
    historyCursor,
    currentRevision: snapshot.revision,
    currentReplacements: cloneReplacements(snapshot.replacements),
    validationErrors: []
  });
}

function referenceRedo(state: ReferenceState): ReferenceState {
  if (state.historyCursor >= state.history.length - 1) return state;
  const historyCursor = state.historyCursor + 1;
  const snapshot = state.history[historyCursor];
  return normalizeReference({
    ...state,
    historyCursor,
    currentRevision: snapshot.revision,
    currentReplacements: cloneReplacements(snapshot.replacements),
    validationErrors: []
  });
}

function withReferenceError(state: ReferenceState, code: string): ReferenceState {
  return {
    ...state,
    validationErrors: [...state.validationErrors, code]
  };
}

function createReferenceSnapshot(
  revision: number,
  replacements: Readonly<Record<string, SvgaImageEditReplacementState>>
): ReferenceSnapshot {
  const cloned = cloneReplacements(replacements);
  return {
    revision,
    digest: referenceDigest(cloned),
    replacements: cloned
  };
}

function capReferenceHistory(history: ReferenceSnapshot[], maxHistoryLength: number): ReferenceSnapshot[] {
  if (history.length <= maxHistoryLength) return history;
  return history.slice(history.length - maxHistoryLength);
}

function normalizeReference(state: ReferenceState): ReferenceState {
  return {
    ...state,
    currentReplacements: cloneReplacements(state.currentReplacements),
    dirty: referenceDigest(state.currentReplacements) !== state.savedRevisionDigest
  };
}

function projectActual(state: SvgaImageEditHistoryState): Record<string, unknown> {
  const digest = referenceDigest(state.currentReplacements);
  return {
    sourceIdentity: state.sourceIdentity,
    replacements: simpleReplacements(state.currentReplacements),
    selectedResourceKey: state.selectedResourceKey ?? null,
    historyCursor: state.historyCursor,
    historyRevisions: state.history.map(({ revision }) => revision),
    currentRevision: state.currentRevision,
    savedRevision: state.savedRevision,
    savedRevisionDigest: state.savedRevisionDigest,
    dirty: state.dirty,
    undoEnabled: state.historyCursor > 0,
    redoEnabled: state.historyCursor < state.history.length - 1,
    currentStateDigest: digest,
    validationErrors: state.validationErrors
  };
}

function projectReference(state: ReferenceState): Record<string, unknown> {
  const digest = referenceDigest(state.currentReplacements);
  return {
    sourceIdentity: state.sourceIdentity,
    replacements: simpleReplacements(state.currentReplacements),
    selectedResourceKey: state.selectedResourceKey ?? null,
    historyCursor: state.historyCursor,
    historyRevisions: state.history.map(({ revision }) => revision),
    currentRevision: state.currentRevision,
    savedRevision: state.savedRevision,
    savedRevisionDigest: state.savedRevisionDigest,
    dirty: state.dirty,
    undoEnabled: state.historyCursor > 0,
    redoEnabled: state.historyCursor < state.history.length - 1,
    currentStateDigest: digest,
    validationErrors: state.validationErrors
  };
}

function updateCoverage(
  coverage: Nq1HistoryModelReport["invariantCoverage"],
  operation: Nq1HistoryOperation,
  beforeActual: Record<string, unknown>,
  afterActual: Record<string, unknown>,
  beforeExpected: Record<string, unknown>,
  afterExpected: Record<string, unknown>
): void {
  if (operation.type === "undo" && afterActual.currentRevision === 0 && afterActual.dirty === false) {
    coverage.undoToInitialClean = true;
  }
  if (operation.type === "undo" && afterActual.currentRevision === afterActual.savedRevision && afterActual.dirty === false) {
    coverage.undoToSavePointClean = true;
  }
  if (operation.type === "reset_all" && beforeActual.savedRevision !== 0 && afterActual.dirty === true) {
    coverage.resetAllDirtyDependsOnSavePoint = true;
  }
  if (operation.type === "replace" && beforeActual.redoEnabled === true && afterActual.redoEnabled === false) {
    coverage.redoBranchTruncated = true;
  }
  if (operation.type === "invalid_replace" && beforeActual.currentRevision === afterActual.currentRevision) {
    coverage.invalidReplacementDidNotAdvance = true;
  }
  if (operation.type === "failed_preview" && stableStringify(beforeActual) === stableStringify(afterActual)) {
    coverage.failedPreviewDidNotAdvance = true;
  }
  if (Array.isArray(afterActual.historyRevisions) && afterActual.historyRevisions[0] !== 0) {
    coverage.historyCapObserved = true;
  }
  if (operation.type === "open_new_file" && afterActual.currentRevision === 0 && afterActual.dirty === false) {
    coverage.openNewFileClearedHistory = true;
  }
  if (operation.type === "replace_same_again" && beforeExpected.currentStateDigest !== afterExpected.currentStateDigest) {
    coverage.sameResourceReplacementOrdering = true;
  }
}

function replacement(resourceKey: string, replacementSha256: string): SvgaImageEditReplacementState {
  return {
    resourceKey,
    replacementSha256,
    sizeBytes: replacementSha256.length,
    width: 6 + (replacementSha256.length % 7),
    height: 2 + (replacementSha256.length % 5)
  };
}

function referenceDigest(
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

function simpleReplacements(
  replacements: Readonly<Record<string, SvgaImageEditReplacementState>>
): Record<string, string> {
  return Object.fromEntries(Object.entries(replacements)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => [key, value.replacementSha256]));
}

function cloneReplacements(
  replacements: Readonly<Record<string, SvgaImageEditReplacementState>>
): Record<string, SvgaImageEditReplacementState> {
  return Object.fromEntries(Object.entries(replacements).map(([key, value]) => [key, { ...value }]));
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}
