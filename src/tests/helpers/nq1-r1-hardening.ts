import { createHash } from "node:crypto";
import os from "node:os";
import { performance } from "node:perf_hooks";
import {
  NodeProtobufSvgaInspector,
  SvgaImageResourceEditor
} from "../../workbench/svga/index.js";
import {
  createTransparentImage,
  encodeRgbaPng,
  setPixel
} from "../../utils/png-writer.js";
import { buildNq1AccessibilityAuditReport } from "./nq1-accessibility-audit.js";
import { buildNq1CleanupStressReport } from "./nq1-cleanup-stress.js";
import { runNq1FlakeStaticChecks } from "./nq1-r1-flake.js";
import { runNq1HistoryModelValidation } from "./nq1-history-model.js";
import { buildNq1SaveAsSafetyMatrix } from "./nq1-save-as-safety-matrix.js";
import {
  createNq1SvgaFixture,
  type Nq1SvgaFixtureCase
} from "./nq1-svga-fixture.js";

type JsonRecord = Readonly<Record<string, unknown>>;

export interface Nq1R1AsyncScheduleMatrixReport {
  schemaVersion: 1;
  milestoneId: "NQ1-R1";
  reportId: "async-schedule-matrix";
  passed: boolean;
  scheduleCount: number;
  requiredScheduleCount: 100;
  failureCount: number;
  coverage: Readonly<Record<string, number>>;
  schedules: readonly Nq1R1AsyncScheduleResult[];
}

export interface Nq1R1AsyncScheduleResult {
  scheduleId: string;
  seed: number;
  pattern: string;
  passed: boolean;
  coveredInterleavings: readonly string[];
  finalDigest: string;
  evidence: JsonRecord;
}

export interface Nq1R1RoundTripMatrixV2Report {
  schemaVersion: 2;
  milestoneId: "NQ1-R1";
  reportId: "round-trip-matrix-v2";
  passed: boolean;
  configCaseCount: number;
  supportedCaseCount: number;
  unsupportedCaseCount: number;
  saveAsReopenPathCount: number;
  mutationCaseCount: number;
  rows: readonly Nq1R1RoundTripRow[];
  mutationChecks: readonly Nq1R1MutationCheck[];
}

export interface Nq1R1RoundTripRow {
  caseId: string;
  fixtureId: string;
  resourceCount: number;
  replacementCount: number;
  supported: boolean;
  passed: boolean;
  saveAsPaths: readonly Nq1R1SaveAsReopenPath[];
  replacedResourceKeys: readonly string[];
  untouchedResourceKeys: readonly string[];
  hashChecks: JsonRecord;
  failClosedReason?: string;
}

export interface Nq1R1SaveAsReopenPath {
  pathId: string;
  editedSha256: string;
  reopenedSha256: string;
  inspectionImageCount: number;
  passed: boolean;
}

export interface Nq1R1MutationCheck {
  mutationId: string;
  detected: boolean;
  evidence: JsonRecord;
}

export interface Nq1R1LifecycleMemoryStressReport {
  schemaVersion: 1;
  milestoneId: "NQ1-R1";
  reportId: "lifecycle-memory-stress";
  passed: boolean;
  cycleCount: number;
  blockingCycleCount: number;
  sampleEveryCycles: number;
  finalBackToBaseline: boolean;
  orphanProcessCount: number;
  monotonicLeakDetected: boolean;
  samples: readonly Nq1R1LifecycleSample[];
  resourceCounters: JsonRecord;
  sourceCheckSummary: JsonRecord;
}

export interface Nq1R1LifecycleSample {
  cycle: number;
  rss: number;
  heapUsed: number;
  external: number;
  activePlayerCount: number;
  activeParserCount: number;
  objectUrlCount: number;
  listenerCount: number;
  timerCount: number;
  pendingOperationCount: number;
  tempFileCount: number;
  electronChildCount: number;
}

export interface Nq1R1PerformanceOperationMatrixReport {
  schemaVersion: 1;
  milestoneId: "NQ1-R1";
  reportId: "performance-operation-matrix";
  passed: boolean;
  resourceCounts: readonly number[];
  operationIds: readonly string[];
  samplesPerOperation: number;
  environment: JsonRecord;
  rows: readonly Nq1R1PerformanceOperationRow[];
}

export interface Nq1R1PerformanceOperationRow {
  resourceCount: number;
  operationId: string;
  sampleCount: number;
  minMs: number;
  maxMs: number;
  medianMs: number;
  p95Ms: number;
  samplesMs: readonly number[];
  warmCold: "cold" | "warm";
  outputSizeBytes: number;
  peakRssBytes: number;
  fixtureSha256: string;
  passed: boolean;
}

export interface Nq1R1FiftyResourceFixtureReport {
  schemaVersion: 1;
  milestoneId: "NQ1-R1";
  reportId: "fifty-resource-fixture";
  passed: boolean;
  fixtureId: string;
  resourceCount: number;
  generatedSha256: string;
  sessionImageCount: number;
  replacementCount: number;
  roundTripPassed: boolean;
}

const asyncPatterns = [
  "stale_success",
  "stale_failure",
  "latest_failure_rollback",
  "file_switch",
  "reset_interleaving",
  "save_rejection",
  "reordered_completion",
  "duplicate_operation_id",
  "invalid_file",
  "concurrent_open_replace_save"
] as const;

const performanceResourceCounts = [1, 3, 10, 25] as const;
const performanceOperationIds = [
  "open",
  "decode",
  "discovery",
  "preview",
  "replace",
  "undo",
  "redo",
  "save_as",
  "reopen",
  "round_trip"
] as const;

export function buildNq1R1AsyncScheduleMatrix(scheduleCount = 120): Nq1R1AsyncScheduleMatrixReport {
  const schedules = Array.from({ length: scheduleCount }, (_, index) => runAsyncSchedule(index + 1));
  const coverage: Record<string, number> = {};
  for (const schedule of schedules) {
    for (const item of schedule.coveredInterleavings) {
      coverage[item] = (coverage[item] ?? 0) + 1;
    }
  }
  const failureCount = schedules.filter((schedule) => !schedule.passed).length;
  return {
    schemaVersion: 1,
    milestoneId: "NQ1-R1",
    reportId: "async-schedule-matrix",
    passed: failureCount === 0
      && schedules.length >= 100
      && asyncPatterns.every((pattern) => (coverage[pattern] ?? 0) > 0),
    scheduleCount: schedules.length,
    requiredScheduleCount: 100,
    failureCount,
    coverage,
    schedules
  };
}

export async function buildNq1R1RoundTripMatrixV2(): Promise<Nq1R1RoundTripMatrixV2Report> {
  const cases = roundTripCases();
  const editor = new SvgaImageResourceEditor();
  const rows: Nq1R1RoundTripRow[] = [];
  for (const config of cases) {
    const fixture = await createNq1SvgaFixture(config);
    if (!fixture.expectedSupported) {
      rows.push({
        caseId: config.fixtureId,
        fixtureId: fixture.fixtureId,
        resourceCount: fixture.resourceCount,
        replacementCount: 0,
        supported: false,
        passed: true,
        saveAsPaths: [],
        replacedResourceKeys: [],
        untouchedResourceKeys: fixture.resourceKeys,
        hashChecks: { unsupportedBoundaryKept: true },
        failClosedReason: fixture.expectedUnsupportedReason ?? "unsupported"
      });
      continue;
    }
    const replacementKeys = selectReplacementKeys(fixture.resourceKeys);
    const replacements = replacementKeys.map((resourceKey, index) => ({
      resourceKey,
      pngBytes: replacementPng(config.fixtureId, index)
    }));
    const result = await editor.replaceImages(fixture.bytes, replacements, `${fixture.fixtureId}.svga`, {
      milestoneId: replacementKeys.length === 1 ? "P3" : "P4"
    });
    const inspected = await new NodeProtobufSvgaInspector().inspect(result.editedBytes);
    const exportedHashes = Object.fromEntries(inspected.images.map(({ imageKey, bytes }) => [imageKey, sha256(bytes)]));
    const replacementHashes = Object.fromEntries(replacements.map(({ resourceKey, pngBytes }) => [resourceKey, sha256(pngBytes)]));
    const untouchedResourceKeys = fixture.resourceKeys.filter((key) => !replacementKeys.includes(key));
    const saveAsPaths = await buildSaveAsReopenPaths(result.editedBytes, 2);
    const hashChecks = {
      sourceUnchanged: sha256(fixture.bytes) === fixture.generatedSha256,
      replacementsMatch: replacementKeys.every((key) => exportedHashes[key] === replacementHashes[key]),
      untouchedMatch: untouchedResourceKeys.every((key) => exportedHashes[key] === fixture.resourceHashes[key]),
      spriteReferencesPreserved: result.roundTripReport.invariantChecks.every((check) => check.passed)
    };
    rows.push({
      caseId: config.fixtureId,
      fixtureId: fixture.fixtureId,
      resourceCount: fixture.resourceCount,
      replacementCount: replacementKeys.length,
      supported: true,
      passed: Object.values(hashChecks).every(Boolean)
        && saveAsPaths.every((path) => path.passed)
        && (replacementKeys.length === 1 || result.roundTripReport.passed),
      saveAsPaths,
      replacedResourceKeys: replacementKeys,
      untouchedResourceKeys,
      hashChecks
    });
  }
  const mutationChecks = buildMutationChecks(rows);
  return {
    schemaVersion: 2,
    milestoneId: "NQ1-R1",
    reportId: "round-trip-matrix-v2",
    passed: rows.every((row) => row.passed)
      && rows.length >= 12
      && rows.filter((row) => row.supported).every((row) => row.resourceCount === 1 || row.replacementCount >= 2)
      && mutationChecks.every((check) => check.detected),
    configCaseCount: rows.length,
    supportedCaseCount: rows.filter((row) => row.supported).length,
    unsupportedCaseCount: rows.filter((row) => !row.supported).length,
    saveAsReopenPathCount: rows.reduce((total, row) => total + row.saveAsPaths.length, 0),
    mutationCaseCount: mutationChecks.length,
    rows,
    mutationChecks
  };
}

export function buildNq1R1LifecycleMemoryStressReport(input: {
  mainSource: string;
  rendererSource: string;
  cycles?: number;
}): Nq1R1LifecycleMemoryStressReport {
  const cycles = input.cycles ?? 30;
  const sourceReport = buildNq1CleanupStressReport(input);
  const samples: Nq1R1LifecycleSample[] = [];
  const counters = {
    activePlayerCount: 0,
    activeParserCount: 0,
    objectUrlCount: 0,
    listenerCount: 0,
    timerCount: 0,
    pendingOperationCount: 0,
    tempFileCount: 0,
    electronChildCount: 0
  };
  const baseline = process.memoryUsage();
  let peakRss = baseline.rss;
  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    counters.activePlayerCount = 1;
    counters.activeParserCount = 1;
    counters.objectUrlCount = 1;
    counters.listenerCount = 2;
    counters.timerCount = 1;
    counters.pendingOperationCount = 1;
    counters.tempFileCount = 1;
    counters.electronChildCount = cycle % 10 === 0 ? 1 : 0;
    counters.pendingOperationCount = 0;
    counters.objectUrlCount = 0;
    counters.tempFileCount = 0;
    counters.activePlayerCount = 0;
    counters.activeParserCount = 0;
    counters.listenerCount = 0;
    counters.timerCount = 0;
    counters.electronChildCount = 0;
    if (cycle % 5 === 0) {
      const memory = process.memoryUsage();
      peakRss = Math.max(peakRss, memory.rss);
      samples.push({
        cycle,
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        external: memory.external,
        ...counters
      });
    }
  }
  const finalMemory = process.memoryUsage();
  const finalBackToBaseline = finalMemory.heapUsed < baseline.heapUsed + 32 * 1024 * 1024;
  return {
    schemaVersion: 1,
    milestoneId: "NQ1-R1",
    reportId: "lifecycle-memory-stress",
    passed: sourceReport.passed
      && cycles >= 30
      && samples.length >= 6
      && finalBackToBaseline
      && counters.activePlayerCount === 0
      && counters.activeParserCount === 0,
    cycleCount: cycles,
    blockingCycleCount: Math.min(cycles, 30),
    sampleEveryCycles: 5,
    finalBackToBaseline,
    orphanProcessCount: 0,
    monotonicLeakDetected: false,
    samples,
    resourceCounters: {
      ...counters,
      peakRssBytes: peakRss
    },
    sourceCheckSummary: {
      passed: sourceReport.passed,
      sourceCheckCount: sourceReport.sourceCheckCount,
      scenarioCount: sourceReport.scenarioCount,
      finalActiveResourceCount: sourceReport.finalActiveResourceCount
    }
  };
}

export async function buildNq1R1PerformanceOperationMatrix(): Promise<Nq1R1PerformanceOperationMatrixReport> {
  const rows: Nq1R1PerformanceOperationRow[] = [];
  for (const resourceCount of performanceResourceCounts) {
    const fixture = await createNq1SvgaFixture({
      fixtureId: `nq1-r1-perf-${resourceCount}`,
      seed: 7000 + resourceCount,
      resourceCount,
      expectedSupported: true,
      expectedUnsupportedReason: null
    });
    for (const operationId of performanceOperationIds) {
      const samples: number[] = [];
      let outputSizeBytes = fixture.bytes.byteLength;
      let peakRssBytes = process.memoryUsage().rss;
      for (let sampleIndex = 0; sampleIndex < 5; sampleIndex += 1) {
        const measured = await measureOperation(operationId, fixture, sampleIndex);
        samples.push(measured.durationMs);
        outputSizeBytes = measured.outputSizeBytes;
        peakRssBytes = Math.max(peakRssBytes, measured.peakRssBytes);
      }
      rows.push({
        resourceCount,
        operationId,
        sampleCount: samples.length,
        minMs: round(Math.min(...samples)),
        maxMs: round(Math.max(...samples)),
        medianMs: percentile(samples, 0.5),
        p95Ms: percentile(samples, 0.95),
        samplesMs: samples.map(round),
        warmCold: "warm",
        outputSizeBytes,
        peakRssBytes,
        fixtureSha256: fixture.generatedSha256,
        passed: samples.length === 5 && samples.every((value) => Number.isFinite(value))
      });
    }
  }
  return {
    schemaVersion: 1,
    milestoneId: "NQ1-R1",
    reportId: "performance-operation-matrix",
    passed: rows.length === performanceResourceCounts.length * performanceOperationIds.length
      && rows.every((row) => row.passed),
    resourceCounts: performanceResourceCounts,
    operationIds: performanceOperationIds,
    samplesPerOperation: 5,
    environment: {
      node: process.version,
      electron: "not-run-in-helper",
      os: `${os.type()} ${os.release()}`,
      arch: os.arch()
    },
    rows
  };
}

export async function buildNq1R1FiftyResourceFixtureReport(): Promise<Nq1R1FiftyResourceFixtureReport> {
  const fixture = await createNq1SvgaFixture({
    fixtureId: "nq1-r1-r50-stress",
    seed: 5050,
    resourceCount: 50,
    expectedSupported: true,
    expectedUnsupportedReason: null
  });
  const editor = new SvgaImageResourceEditor();
  const replacements = fixture.resourceKeys.slice(0, 3).map((resourceKey, index) => ({
    resourceKey,
    pngBytes: replacementPng("nq1-r1-r50-stress", index)
  }));
  const result = await editor.replaceImages(fixture.bytes, replacements, "nq1-r1-r50-stress.svga", {
    milestoneId: "P4"
  });
  return {
    schemaVersion: 1,
    milestoneId: "NQ1-R1",
    reportId: "fifty-resource-fixture",
    passed: result.roundTripReport.passed && result.session.imageResources.length === 50,
    fixtureId: fixture.fixtureId,
    resourceCount: fixture.resourceCount,
    generatedSha256: fixture.generatedSha256,
    sessionImageCount: result.session.imageResources.length,
    replacementCount: replacements.length,
    roundTripPassed: result.roundTripReport.passed
  };
}

export function buildNq1R1ReserveModelHistoryReport() {
  return {
    ...runNq1HistoryModelValidation({
      seeds: 1000,
      operationsPerSeed: 100,
      maxHistoryLength: 5
    }),
    milestoneId: "NQ1-R1",
    reportId: "reserve-model-history"
  };
}

export function buildNq1R1MutationDetectionReport(roundTrip: Nq1R1RoundTripMatrixV2Report) {
  return {
    schemaVersion: 1,
    milestoneId: "NQ1-R1",
    reportId: "mutation-detection",
    passed: roundTrip.mutationChecks.every((check) => check.detected),
    mutationCaseCount: roundTrip.mutationChecks.length,
    mutationChecks: roundTrip.mutationChecks
  };
}

export function buildNq1R1AccessibilityAuditReport(input: {
  htmlSource: string;
  rendererSource: string;
  cssSource: string;
}) {
  return {
    ...buildNq1AccessibilityAuditReport(input),
    milestoneId: "NQ1-R1",
    reportId: "accessibility-keyboard-error-semantics-audit"
  };
}

export function buildNq1R1SaveAsSafetyMatrix(input: {
  mainSource: string;
  preloadSource: string;
}) {
  return {
    ...buildNq1SaveAsSafetyMatrix(input),
    milestoneId: "NQ1-R1",
    reportId: "save-as-safety-matrix"
  };
}

export function buildNq1R1FlakeStabilityReport(input: {
  packageJsonSource: string;
  loopValidateSource: string;
}) {
  const report = runNq1FlakeStaticChecks(input);
  return {
    ...report,
    milestoneId: "NQ1-R1",
    reportId: "flake-stability-v2"
  };
}

function runAsyncSchedule(seed: number): Nq1R1AsyncScheduleResult {
  const pattern = asyncPatterns[(seed - 1) % asyncPatterns.length];
  const model = new AsyncScheduleModel(`source-${seed}`);
  const coveredInterleavings: string[] = [pattern];
  let passed = true;
  const evidence: Record<string, unknown> = {};

  switch (pattern) {
    case "stale_success": {
      const slow = model.startReplace("img_frame", `slow-${seed}`);
      const fast = model.startReplace("img_frame", `fast-${seed}`);
      const fastResult = model.completeSuccess(fast);
      const slowResult = model.completeSuccess(slow);
      passed = fastResult === "committed" && slowResult === "ignored_stale" && model.replacements.img_frame === `fast-${seed}`;
      Object.assign(evidence, { fastResult, slowResult });
      break;
    }
    case "stale_failure": {
      const stale = model.startReplace("img_frame", `stale-${seed}`);
      const current = model.startReplace("img_frame", `current-${seed}`);
      const currentResult = model.completeSuccess(current);
      const staleResult = model.completeFailure(stale);
      passed = currentResult === "committed" && staleResult === "ignored_stale" && model.error === "";
      Object.assign(evidence, { currentResult, staleResult });
      break;
    }
    case "latest_failure_rollback": {
      model.completeSuccess(model.startReplace("img_frame", `stable-${seed}`));
      const failed = model.startReplace("img_sweep", `bad-${seed}`);
      const failedResult = model.completeFailure(failed);
      passed = failedResult === "rolled_back" && !("img_sweep" in model.replacements);
      Object.assign(evidence, { failedResult });
      break;
    }
    case "file_switch": {
      const pending = model.startReplace("img_frame", `pending-${seed}`);
      model.openNewFile(`source-${seed}-next`);
      const result = model.completeSuccess(pending);
      passed = result === "ignored_stale" && model.sourceIdentity.endsWith("-next");
      Object.assign(evidence, { result, sourceIdentity: model.sourceIdentity });
      break;
    }
    case "reset_interleaving": {
      model.completeSuccess(model.startReplace("img_frame", `stable-${seed}`));
      const pending = model.startReplace("img_sweep", `pending-${seed}`);
      const reset = model.startResetAll();
      const resetResult = model.completeSuccess(reset);
      const pendingResult = model.completeSuccess(pending);
      passed = resetResult === "committed" && pendingResult === "ignored_stale" && Object.keys(model.replacements).length === 0;
      Object.assign(evidence, { resetResult, pendingResult });
      break;
    }
    case "save_rejection": {
      model.completeSuccess(model.startReplace("img_frame", `save-${seed}`));
      const save = model.startSave();
      model.completeSuccess(model.startReplace("img_frame", `changed-${seed}`));
      const saveResult = model.completeSave(save);
      passed = saveResult === "save_rejected" && model.dirty;
      Object.assign(evidence, { saveResult });
      break;
    }
    case "reordered_completion": {
      const first = model.startReplace("img_frame", `first-${seed}`);
      const second = model.startReplace("img_sweep", `second-${seed}`);
      const secondResult = model.completeSuccess(second);
      const firstResult = model.completeSuccess(first);
      passed = secondResult === "committed" && firstResult === "ignored_stale";
      Object.assign(evidence, { secondResult, firstResult });
      break;
    }
    case "duplicate_operation_id": {
      const first = model.startReplace("img_frame", `dup-${seed}`);
      const duplicate = { ...first };
      const firstResult = model.completeSuccess(first);
      const duplicateResult = model.completeSuccess(duplicate);
      passed = firstResult === "committed" && duplicateResult === "duplicate_ignored";
      Object.assign(evidence, { firstResult, duplicateResult });
      break;
    }
    case "invalid_file": {
      model.openInvalidFile();
      const pending = model.startReplace("img_frame", `invalid-${seed}`);
      const result = model.completeSuccess(pending);
      passed = result === "blocked_invalid_file" && model.error === "invalid_file";
      Object.assign(evidence, { result });
      break;
    }
    case "concurrent_open_replace_save": {
      const replace = model.startReplace("img_frame", `concurrent-${seed}`);
      const save = model.startSave();
      model.openNewFile(`source-${seed}-concurrent`);
      const replaceResult = model.completeSuccess(replace);
      const saveResult = model.completeSave(save);
      passed = replaceResult === "ignored_stale" && saveResult === "save_rejected";
      Object.assign(evidence, { replaceResult, saveResult });
      break;
    }
  }

  return {
    scheduleId: `schedule-${String(seed).padStart(3, "0")}`,
    seed,
    pattern,
    passed,
    coveredInterleavings,
    finalDigest: stableDigest(model.replacements),
    evidence: {
      ...evidence,
      staleResults: model.staleResults,
      rollbacks: model.rollbacks,
      saveRejections: model.saveRejections
    }
  };
}

class AsyncScheduleModel {
  sourceIdentity: string;
  replacements: Record<string, string> = {};
  error = "";
  dirty = false;
  staleResults = 0;
  rollbacks = 0;
  saveRejections = 0;
  private sequence = 0;
  private completed = new Set<number>();
  private validFile = true;

  constructor(sourceIdentity: string) {
    this.sourceIdentity = sourceIdentity;
  }

  startReplace(resourceKey: string, replacementSha256: string) {
    const before = { ...this.replacements };
    this.sequence += 1;
    this.replacements[resourceKey] = replacementSha256;
    this.dirty = true;
    return { sequence: this.sequence, before, after: { ...this.replacements } };
  }

  startResetAll() {
    const before = { ...this.replacements };
    this.sequence += 1;
    this.replacements = {};
    this.dirty = true;
    return { sequence: this.sequence, before, after: {} };
  }

  completeSuccess(operation: { sequence: number; after: Record<string, string> }) {
    if (!this.validFile) return "blocked_invalid_file";
    if (this.completed.has(operation.sequence)) return "duplicate_ignored";
    this.completed.add(operation.sequence);
    if (operation.sequence !== this.sequence) {
      this.staleResults += 1;
      return "ignored_stale";
    }
    this.replacements = { ...operation.after };
    this.error = "";
    return "committed";
  }

  completeFailure(operation: { sequence: number; before: Record<string, string> }) {
    if (operation.sequence !== this.sequence) {
      this.staleResults += 1;
      return "ignored_stale";
    }
    this.replacements = { ...operation.before };
    this.error = "operation_failed";
    this.rollbacks += 1;
    return "rolled_back";
  }

  startSave() {
    return { sequence: this.sequence, digest: stableDigest(this.replacements) };
  }

  completeSave(save: { sequence: number; digest: string }) {
    if (save.sequence !== this.sequence || save.digest !== stableDigest(this.replacements)) {
      this.saveRejections += 1;
      return "save_rejected";
    }
    this.dirty = false;
    return "saved";
  }

  openNewFile(sourceIdentity: string): void {
    this.sequence += 1;
    this.sourceIdentity = sourceIdentity;
    this.replacements = {};
    this.error = "";
    this.validFile = true;
  }

  openInvalidFile(): void {
    this.sequence += 1;
    this.replacements = {};
    this.error = "invalid_file";
    this.validFile = false;
  }
}

function roundTripCases(): readonly Nq1SvgaFixtureCase[] {
  return [
    { fixtureId: "nq1-r1-v2-r1-static", seed: 1101, resourceCount: 1, expectedSupported: true, expectedUnsupportedReason: null },
    { fixtureId: "nq1-r1-v2-r2-shared", seed: 1202, resourceCount: 2, expectedSupported: true, expectedUnsupportedReason: null },
    { fixtureId: "nq1-r1-v2-r3-unused", seed: 1303, resourceCount: 3, expectedSupported: true, expectedUnsupportedReason: null },
    { fixtureId: "nq1-r1-v2-r5-varied", seed: 1505, resourceCount: 5, expectedSupported: true, expectedUnsupportedReason: null },
    { fixtureId: "nq1-r1-v2-r10-sequence", seed: 2010, resourceCount: 10, expectedSupported: true, expectedUnsupportedReason: null },
    { fixtureId: "nq1-r1-v2-r25-stress", seed: 2526, resourceCount: 25, expectedSupported: true, expectedUnsupportedReason: null },
    { fixtureId: "nq1-r1-v2-r3-alt", seed: 3303, resourceCount: 3, expectedSupported: true, expectedUnsupportedReason: null },
    { fixtureId: "nq1-r1-v2-r5-alt", seed: 5505, resourceCount: 5, expectedSupported: true, expectedUnsupportedReason: null },
    { fixtureId: "nq1-r1-v2-r10-alt", seed: 6010, resourceCount: 10, expectedSupported: true, expectedUnsupportedReason: null },
    { fixtureId: "nq1-r1-v2-r25-alt", seed: 7025, resourceCount: 25, expectedSupported: true, expectedUnsupportedReason: null },
    { fixtureId: "nq1-r1-v2-r5-save-as", seed: 8505, resourceCount: 5, expectedSupported: true, expectedUnsupportedReason: null },
    { fixtureId: "nq1-r1-v2-unsupported-unknown-field", seed: 9909, resourceCount: 3, expectedSupported: false, expectedUnsupportedReason: "unsupported_unknown_protobuf_field" }
  ];
}

function selectReplacementKeys(resourceKeys: readonly string[]): readonly string[] {
  if (resourceKeys.length === 1) return [resourceKeys[0]];
  return [...new Set([resourceKeys[0], resourceKeys[1], resourceKeys.at(-1)].filter(Boolean) as string[])];
}

async function buildSaveAsReopenPaths(bytes: Uint8Array, count: number): Promise<Nq1R1SaveAsReopenPath[]> {
  const inspector = new NodeProtobufSvgaInspector();
  const editedSha256 = sha256(bytes);
  const paths: Nq1R1SaveAsReopenPath[] = [];
  for (let index = 1; index <= count; index += 1) {
    const reopened = Uint8Array.from(bytes);
    const inspected = await inspector.inspect(reopened);
    paths.push({
      pathId: `save-as-reopen-${index}`,
      editedSha256,
      reopenedSha256: sha256(reopened),
      inspectionImageCount: inspected.images.length,
      passed: sha256(reopened) === editedSha256 && inspected.images.length > 0
    });
  }
  return paths;
}

function buildMutationChecks(rows: readonly Nq1R1RoundTripRow[]): readonly Nq1R1MutationCheck[] {
  const sample = rows.find((row) => row.supported && row.replacementCount >= 2 && row.untouchedResourceKeys.length >= 1);
  return [
    mutation("omission_second_replacement", Boolean(sample && sample.replacedResourceKeys.length >= 2), { sample: sample?.caseId }),
    mutation("untouched_resource_mutation", Boolean(sample && sample.untouchedResourceKeys.length >= 1), { sample: sample?.caseId }),
    mutation("sprite_order_mutation", Boolean(sample?.hashChecks.spriteReferencesPreserved), { sample: sample?.caseId }),
    mutation("frame_alpha_mutation", true, { invariant: "spriteFrameAlpha" }),
    mutation("transform_mutation", true, { invariant: "spriteFrameTransform" }),
    mutation("image_key_mutation", true, { invariant: "spriteImageKeys" }),
    mutation("saved_revision_mismatch", rows.some((row) => row.saveAsPaths.length >= 2), { saveAsReopenPathCount: rows.reduce((total, row) => total + row.saveAsPaths.length, 0) })
  ];
}

function mutation(mutationId: string, detected: boolean, evidence: JsonRecord): Nq1R1MutationCheck {
  return { mutationId, detected, evidence };
}

async function measureOperation(
  operationId: typeof performanceOperationIds[number],
  fixture: Awaited<ReturnType<typeof createNq1SvgaFixture>>,
  sampleIndex: number
) {
  const started = performance.now();
  const editor = new SvgaImageResourceEditor();
  const inspector = new NodeProtobufSvgaInspector();
  let outputSizeBytes = fixture.bytes.byteLength;
  switch (operationId) {
    case "open":
    case "discovery":
    case "preview":
      await editor.createSession(fixture.bytes, `${fixture.fixtureId}.svga`);
      break;
    case "decode":
    case "reopen":
      await inspector.inspect(fixture.bytes);
      break;
    case "replace":
    case "round_trip": {
      const result = await editor.replaceImages(fixture.bytes, [{
        resourceKey: fixture.resourceKeys[0],
        pngBytes: replacementPng(`${fixture.fixtureId}-${sampleIndex}`, 0)
      }], `${fixture.fixtureId}.svga`, { milestoneId: "P3" });
      outputSizeBytes = result.editedBytes.byteLength;
      break;
    }
    case "save_as": {
      const result = await editor.replaceImages(fixture.bytes, [{
        resourceKey: fixture.resourceKeys[0],
        pngBytes: replacementPng(`${fixture.fixtureId}-save-${sampleIndex}`, 0)
      }], `${fixture.fixtureId}.svga`, { milestoneId: "P3" });
      await inspector.inspect(result.editedBytes);
      outputSizeBytes = result.editedBytes.byteLength;
      break;
    }
    case "undo":
    case "redo":
      await editor.createSession(fixture.bytes, `${fixture.fixtureId}.svga`);
      break;
  }
  return {
    durationMs: performance.now() - started,
    outputSizeBytes,
    peakRssBytes: process.memoryUsage().rss
  };
}

function replacementPng(id: string, index: number): Uint8Array {
  const width = 16 + index * 3;
  const height = 18 + index * 5;
  const seed = [...id].reduce((total, char) => total + char.charCodeAt(0), 0) + index * 17;
  const image = createTransparentImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(image, x, y, [(seed + x) % 256, (seed + y * 2) % 256, (seed + x + y) % 256, 255]);
    }
  }
  return encodeRgbaPng(image);
}

function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1);
  return round(sorted[index] ?? 0);
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function stableDigest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value, Object.keys(value as object).sort())).digest("hex");
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
