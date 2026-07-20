import {
  applySvgaImageEditTransaction,
  createSvgaImageEditHistory,
  markSvgaImageEditSaved,
  replacementDigest
} from "../../workbench/svga/index.js";
import type {
  SvgaImageEditHistoryState,
  SvgaImageEditReplacementState,
  SvgaImageEditResourceIdentity,
  SvgaImageEditTransactionInput
} from "../../workbench/svga/index.js";

export interface Nq1AsyncRaceValidationReport {
  schemaVersion: 1;
  milestoneId: "NQ1";
  reportId: "async-race-and-failure-injection";
  passed: boolean;
  scenarioCount: number;
  failureCount: number;
  failureInjectionCount: number;
  staleResultCount: number;
  rollbackCount: number;
  saveRejectionCount: number;
  scenarios: readonly Nq1AsyncRaceScenarioResult[];
}

export interface Nq1AsyncRaceScenarioResult {
  id: string;
  passed: boolean;
  evidence: Readonly<Record<string, unknown>>;
}

type PendingOperationType = "replace_resource" | "reset_all";

interface PendingOperation {
  sequence: number;
  type: PendingOperationType;
  beforeDigest: string;
  beforeReplacements: Readonly<Record<string, SvgaImageEditReplacementState>>;
  nextDigest: string;
  nextReplacements: Readonly<Record<string, SvgaImageEditReplacementState>>;
  transaction?: SvgaImageEditTransactionInput;
}

interface SaveOperation {
  sequence: number;
  replacementDigest: string;
}

interface CompletionResult {
  status: "committed" | "ignored_stale" | "rolled_back" | "saved" | "save_rejected";
  sequence: number;
}

const resources: readonly SvgaImageEditResourceIdentity[] = [
  { resourceKey: "img_frame", originalSha256: "frame-original" },
  { resourceKey: "img_sweep", originalSha256: "sweep-original" },
  { resourceKey: "img_particle", originalSha256: "particle-original" }
];

export function runNq1AsyncRaceValidation(): Nq1AsyncRaceValidationReport {
  const scenarios = [
    slowReplaceCannotOverwriteNewerReplace(),
    staleFailureDoesNotRollbackNewerSuccess(),
    latestFailureRollsBackToPreviousInputs(),
    resetAllWinsOverStaleReplace(),
    openNewFileInvalidatesPendingResult(),
    saveRejectsChangedSequence(),
    saveSuccessMarksCurrentRevisionClean()
  ];
  const passed = scenarios.every((scenario) => scenario.passed);

  return {
    schemaVersion: 1,
    milestoneId: "NQ1",
    reportId: "async-race-and-failure-injection",
    passed,
    scenarioCount: scenarios.length,
    failureCount: scenarios.filter((scenario) => !scenario.passed).length,
    failureInjectionCount: 2,
    staleResultCount: scenarios.reduce((total, scenario) => total + Number(scenario.evidence.staleResults ?? 0), 0),
    rollbackCount: scenarios.reduce((total, scenario) => total + Number(scenario.evidence.rollbacks ?? 0), 0),
    saveRejectionCount: scenarios.reduce((total, scenario) => total + Number(scenario.evidence.saveRejections ?? 0), 0),
    scenarios
  };
}

function slowReplaceCannotOverwriteNewerReplace(): Nq1AsyncRaceScenarioResult {
  const editor = new AsyncRaceEditor("source-a");
  const slow = editor.startReplace("img_frame", "slow-sha");
  const fast = editor.startReplace("img_frame", "fast-sha");
  const fastResult = editor.completeSuccess(fast);
  const slowResult = editor.completeSuccess(slow);
  const projection = editor.project();
  return scenario("slow_replace_cannot_overwrite_newer_replace", {
    fastResult,
    slowResult,
    projection,
    staleResults: editor.staleResultCount
  }, fastResult.status === "committed"
    && slowResult.status === "ignored_stale"
    && projection.replacements.img_frame?.replacementSha256 === "fast-sha"
    && projection.currentRevision === 1);
}

function staleFailureDoesNotRollbackNewerSuccess(): Nq1AsyncRaceScenarioResult {
  const editor = new AsyncRaceEditor("source-b");
  const stale = editor.startReplace("img_frame", "stale-sha");
  const current = editor.startReplace("img_frame", "current-sha");
  const currentResult = editor.completeSuccess(current);
  const staleFailure = editor.completeFailure(stale, "delayed_preview_failed");
  const projection = editor.project();
  return scenario("stale_failure_does_not_rollback_newer_success", {
    currentResult,
    staleFailure,
    projection,
    staleResults: editor.staleResultCount,
    rollbacks: editor.rollbackCount
  }, currentResult.status === "committed"
    && staleFailure.status === "ignored_stale"
    && projection.replacements.img_frame?.replacementSha256 === "current-sha"
    && projection.lastError === "");
}

function latestFailureRollsBackToPreviousInputs(): Nq1AsyncRaceScenarioResult {
  const editor = new AsyncRaceEditor("source-c");
  editor.completeSuccess(editor.startReplace("img_frame", "stable-sha"));
  const failed = editor.startReplace("img_frame", "bad-sha");
  const failedResult = editor.completeFailure(failed, "replacement_png_decode_failed");
  const projection = editor.project();
  return scenario("latest_failure_rolls_back_to_previous_inputs", {
    failedResult,
    projection,
    rollbacks: editor.rollbackCount
  }, failedResult.status === "rolled_back"
    && projection.replacements.img_frame?.replacementSha256 === "stable-sha"
    && projection.currentRevision === 1
    && projection.lastError === "replacement_png_decode_failed");
}

function resetAllWinsOverStaleReplace(): Nq1AsyncRaceScenarioResult {
  const editor = new AsyncRaceEditor("source-d");
  editor.completeSuccess(editor.startReplace("img_frame", "stable-sha"));
  const staleReplace = editor.startReplace("img_sweep", "slow-sweep-sha");
  const reset = editor.startResetAll();
  const resetResult = editor.completeSuccess(reset);
  const staleResult = editor.completeSuccess(staleReplace);
  const projection = editor.project();
  return scenario("reset_all_wins_over_stale_replace", {
    resetResult,
    staleResult,
    projection,
    staleResults: editor.staleResultCount
  }, resetResult.status === "committed"
    && staleResult.status === "ignored_stale"
    && Object.keys(projection.replacements).length === 0
    && projection.currentRevision === 2);
}

function openNewFileInvalidatesPendingResult(): Nq1AsyncRaceScenarioResult {
  const editor = new AsyncRaceEditor("source-e");
  const pending = editor.startReplace("img_frame", "pending-sha");
  editor.openNewFile("source-e-next");
  const pendingResult = editor.completeSuccess(pending);
  const projection = editor.project();
  return scenario("open_new_file_invalidates_pending_result", {
    pendingResult,
    projection,
    staleResults: editor.staleResultCount
  }, pendingResult.status === "ignored_stale"
    && projection.sourceIdentity === "source-e-next"
    && Object.keys(projection.replacements).length === 0);
}

function saveRejectsChangedSequence(): Nq1AsyncRaceScenarioResult {
  const editor = new AsyncRaceEditor("source-f");
  editor.completeSuccess(editor.startReplace("img_frame", "saved-candidate-sha"));
  const save = editor.startSave();
  editor.completeSuccess(editor.startReplace("img_frame", "changed-before-save-sha"));
  const saveResult = editor.completeSave(save);
  const projection = editor.project();
  return scenario("save_rejects_changed_sequence", {
    saveResult,
    projection,
    saveRejections: editor.saveRejectionCount
  }, saveResult.status === "save_rejected"
    && projection.dirty
    && projection.replacements.img_frame?.replacementSha256 === "changed-before-save-sha");
}

function saveSuccessMarksCurrentRevisionClean(): Nq1AsyncRaceScenarioResult {
  const editor = new AsyncRaceEditor("source-g");
  editor.completeSuccess(editor.startReplace("img_frame", "clean-save-sha"));
  const save = editor.startSave();
  const saveResult = editor.completeSave(save);
  const projection = editor.project();
  return scenario("save_success_marks_current_revision_clean", {
    saveResult,
    projection
  }, saveResult.status === "saved"
    && !projection.dirty
    && projection.exportState === "exported"
    && projection.savedRevision === projection.currentRevision);
}

function scenario(
  id: string,
  evidence: Readonly<Record<string, unknown>>,
  passed: boolean
): Nq1AsyncRaceScenarioResult {
  return { id, passed, evidence: sanitizeEvidence(evidence) };
}

class AsyncRaceEditor {
  staleResultCount = 0;
  rollbackCount = 0;
  saveRejectionCount = 0;
  private state: SvgaImageEditHistoryState;
  private workingReplacements: Readonly<Record<string, SvgaImageEditReplacementState>> = {};
  private operationSequence = 0;
  private lastError = "";

  constructor(sourceIdentity: string) {
    this.state = createSvgaImageEditHistory({
      sourceIdentity,
      originalResources: resources,
      selectedResourceKey: resources[0].resourceKey
    });
  }

  startReplace(resourceKey: string, replacementSha256: string): PendingOperation {
    const beforeReplacements = cloneReplacements(this.workingReplacements);
    const nextReplacements = {
      ...beforeReplacements,
      [resourceKey]: replacement(resourceKey, replacementSha256)
    };
    const sequence = ++this.operationSequence;
    this.workingReplacements = cloneReplacements(nextReplacements);
    this.lastError = "";
    return {
      sequence,
      type: "replace_resource",
      beforeDigest: replacementDigest(beforeReplacements),
      beforeReplacements,
      nextDigest: replacementDigest(nextReplacements),
      nextReplacements,
      transaction: {
        transactionId: `tx-${sequence}-${resourceKey}`,
        type: "replace_resource",
        resourceKey,
        replacement: replacement(resourceKey, replacementSha256),
        source: "nq1-async-race"
      }
    };
  }

  startResetAll(): PendingOperation {
    const beforeReplacements = cloneReplacements(this.workingReplacements);
    const nextReplacements = {};
    const sequence = ++this.operationSequence;
    this.workingReplacements = nextReplacements;
    this.lastError = "";
    return {
      sequence,
      type: "reset_all",
      beforeDigest: replacementDigest(beforeReplacements),
      beforeReplacements,
      nextDigest: replacementDigest(nextReplacements),
      nextReplacements,
      transaction: {
        transactionId: `tx-${sequence}-reset-all`,
        type: "reset_all",
        source: "nq1-async-race"
      }
    };
  }

  completeSuccess(operation: PendingOperation): CompletionResult {
    if (operation.sequence !== this.operationSequence) {
      this.staleResultCount += 1;
      return { status: "ignored_stale", sequence: operation.sequence };
    }
    if (operation.transaction) {
      this.state = applySvgaImageEditTransaction(this.state, operation.transaction);
    }
    this.workingReplacements = cloneReplacements(operation.nextReplacements);
    this.lastError = "";
    return { status: "committed", sequence: operation.sequence };
  }

  completeFailure(operation: PendingOperation, code: string): CompletionResult {
    if (operation.sequence !== this.operationSequence) {
      this.staleResultCount += 1;
      return { status: "ignored_stale", sequence: operation.sequence };
    }
    this.workingReplacements = cloneReplacements(operation.beforeReplacements);
    this.lastError = code;
    this.rollbackCount += 1;
    return { status: "rolled_back", sequence: operation.sequence };
  }

  openNewFile(sourceIdentity: string): void {
    this.operationSequence += 1;
    this.state = createSvgaImageEditHistory({
      sourceIdentity,
      originalResources: resources,
      selectedResourceKey: resources[0].resourceKey
    });
    this.workingReplacements = {};
    this.lastError = "";
  }

  startSave(): SaveOperation {
    return {
      sequence: this.operationSequence,
      replacementDigest: replacementDigest(this.workingReplacements)
    };
  }

  completeSave(save: SaveOperation): CompletionResult {
    if (
      save.sequence !== this.operationSequence
      || save.replacementDigest !== replacementDigest(this.workingReplacements)
    ) {
      this.saveRejectionCount += 1;
      return { status: "save_rejected", sequence: save.sequence };
    }
    this.state = markSvgaImageEditSaved(this.state);
    return { status: "saved", sequence: save.sequence };
  }

  project() {
    return {
      sourceIdentity: this.state.sourceIdentity,
      currentRevision: this.state.currentRevision,
      savedRevision: this.state.savedRevision,
      dirty: this.state.dirty,
      exportState: this.state.exportState,
      historyLength: this.state.history.length,
      historyCursor: this.state.historyCursor,
      operationSequence: this.operationSequence,
      replacements: cloneReplacements(this.workingReplacements),
      replacementDigest: replacementDigest(this.workingReplacements),
      stateReplacementDigest: replacementDigest(this.state.currentReplacements),
      lastError: this.lastError
    };
  }
}

function replacement(resourceKey: string, replacementSha256: string): SvgaImageEditReplacementState {
  return {
    resourceKey,
    replacementSha256,
    sizeBytes: replacementSha256.length,
    width: 12,
    height: 12
  };
}

function cloneReplacements(
  replacements: Readonly<Record<string, SvgaImageEditReplacementState>>
): Record<string, SvgaImageEditReplacementState> {
  return Object.fromEntries(
    Object.entries(replacements).map(([resourceKey, value]) => [resourceKey, { ...value }])
  );
}

function sanitizeEvidence(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
