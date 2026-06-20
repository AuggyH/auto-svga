import { performance } from "node:perf_hooks";
import {
  createNq1SvgaFixture,
  NQ1_FIXTURE_MATRIX_CASES
} from "./nq1-svga-fixture.js";
import { runNq1AsyncRaceValidation } from "./nq1-async-race-harness.js";
import { buildNq1CleanupStressReport } from "./nq1-cleanup-stress.js";
import { runNq1HistoryModelValidation } from "./nq1-history-model.js";
import { runNq1RoundTripMatrixValidation } from "./nq1-round-trip-matrix.js";

export interface Nq1PerformanceBaselineReport {
  schemaVersion: 1;
  milestoneId: "NQ1";
  reportId: "performance-baseline";
  passed: boolean;
  metricCount: number;
  totalDurationMs: number;
  hangGuardMs: number;
  metrics: readonly Nq1PerformanceMetric[];
}

export interface Nq1PerformanceMetric {
  id: string;
  status: "pass" | "fail";
  durationMs: number;
  hangGuardMs: number;
  evidence: Readonly<Record<string, unknown>>;
}

export async function runNq1PerformanceBaseline(input: {
  mainSource: string;
  rendererSource: string;
  hangGuardMs?: number;
}): Promise<Nq1PerformanceBaselineReport> {
  const hangGuardMs = input.hangGuardMs ?? 120_000;
  const metrics = [
    await measure("fixture_matrix_generation", hangGuardMs, async () => {
      const fixtures = [];
      for (const config of NQ1_FIXTURE_MATRIX_CASES) {
        fixtures.push(await createNq1SvgaFixture(config));
      }
      return {
        fixtureCount: fixtures.length,
        supportedFixtureCount: fixtures.filter((fixture) => fixture.expectedSupported).length,
        unsupportedFixtureCount: fixtures.filter((fixture) => !fixture.expectedSupported).length,
        totalBytes: fixtures.reduce((total, fixture) => total + fixture.bytes.byteLength, 0),
        resourceCounts: fixtures.map((fixture) => fixture.resourceCount)
      };
    }),
    await measure("multi_resource_round_trip_matrix", hangGuardMs, async () => {
      const report = await runNq1RoundTripMatrixValidation();
      return {
        passed: report.passed,
        supportedFixtureCount: report.supportedFixtureCount,
        unsupportedFixtureCount: report.unsupportedFixtureCount,
        replacementAttemptCount: report.replacementAttemptCount,
        failClosedCount: report.failClosedCount
      };
    }),
    await measure("history_model_10k_operations", hangGuardMs, async () => {
      const report = runNq1HistoryModelValidation({
        seeds: 100,
        operationsPerSeed: 100,
        maxHistoryLength: 5
      });
      return {
        passed: report.passed,
        totalOperations: report.totalOperations,
        failureCount: report.failureCount
      };
    }),
    await measure("async_race_failure_injection", hangGuardMs, async () => {
      const report = runNq1AsyncRaceValidation();
      return {
        passed: report.passed,
        scenarioCount: report.scenarioCount,
        staleResultCount: report.staleResultCount,
        rollbackCount: report.rollbackCount,
        saveRejectionCount: report.saveRejectionCount
      };
    }),
    await measure("cleanup_stress_model", hangGuardMs, async () => {
      const report = buildNq1CleanupStressReport({
        mainSource: input.mainSource,
        rendererSource: input.rendererSource
      });
      return {
        passed: report.passed,
        sourceCheckCount: report.sourceCheckCount,
        scenarioCount: report.scenarioCount,
        cleanupCount: report.cleanupCount,
        finalActiveResourceCount: report.finalActiveResourceCount
      };
    })
  ];
  const totalDurationMs = roundDuration(metrics.reduce((total, metric) => total + metric.durationMs, 0));
  const passed = metrics.every((metric) => metric.status === "pass" && metric.durationMs <= metric.hangGuardMs);
  return {
    schemaVersion: 1,
    milestoneId: "NQ1",
    reportId: "performance-baseline",
    passed,
    metricCount: metrics.length,
    totalDurationMs,
    hangGuardMs,
    metrics
  };
}

async function measure(
  id: string,
  hangGuardMs: number,
  run: () => Promise<Readonly<Record<string, unknown>>> | Readonly<Record<string, unknown>>
): Promise<Nq1PerformanceMetric> {
  const startedAt = performance.now();
  let evidence: Readonly<Record<string, unknown>>;
  let status: Nq1PerformanceMetric["status"] = "pass";
  try {
    evidence = await run();
    if (evidence.passed === false) status = "fail";
  } catch (error) {
    status = "fail";
    evidence = {
      error: error instanceof Error ? error.message : String(error)
    };
  }
  const durationMs = roundDuration(performance.now() - startedAt);
  if (durationMs > hangGuardMs) status = "fail";
  return {
    id,
    status,
    durationMs,
    hangGuardMs,
    evidence
  };
}

function roundDuration(value: number): number {
  return Number(value.toFixed(3));
}
