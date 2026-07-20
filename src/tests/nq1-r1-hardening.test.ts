import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildNq1R1AsyncScheduleMatrix,
  buildNq1R1FiftyResourceFixtureReport,
  buildNq1R1LifecycleMemoryStressReport,
  buildNq1R1MutationDetectionReport,
  buildNq1R1PerformanceOperationMatrix,
  buildNq1R1ReserveModelHistoryReport,
  buildNq1R1RoundTripMatrixV2
} from "./helpers/nq1-r1-hardening.js";

test("NQ1-R1 async schedule matrix covers at least 100 deterministic schedules", () => {
  const report = buildNq1R1AsyncScheduleMatrix();

  assert.equal(report.milestoneId, "NQ1-R1");
  assert.equal(report.passed, true, JSON.stringify(report.schedules.filter((schedule) => !schedule.passed), null, 2));
  assert.ok(report.scheduleCount >= 100);
  assert.equal(report.failureCount, 0);
  for (const pattern of [
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
  ]) {
    assert.ok((report.coverage[pattern] ?? 0) > 0, pattern);
  }
});

test("NQ1-R1 round-trip matrix v2 covers supported, unsupported, save-as, and mutation cases", async () => {
  const report = await buildNq1R1RoundTripMatrixV2();
  const mutation = buildNq1R1MutationDetectionReport(report);

  assert.equal(report.schemaVersion, 2);
  assert.equal(report.passed, true, JSON.stringify(report.rows.filter((row) => !row.passed), null, 2));
  assert.ok(report.configCaseCount >= 12);
  assert.ok(report.saveAsReopenPathCount >= report.supportedCaseCount * 2);
  assert.equal(mutation.passed, true);
});

test("NQ1-R1 lifecycle stress records 30 semi-real cycles and cleanup counters", async () => {
  const report = buildNq1R1LifecycleMemoryStressReport({
    mainSource: await readFile("tools/electron-prototype/experiments/svga-web/main.cjs", "utf8"),
    rendererSource: await readFile("tools/electron-prototype/experiments/svga-web/web/prototype.js", "utf8")
  });

  assert.equal(report.passed, true);
  assert.equal(report.cycleCount, 30);
  assert.ok(report.samples.length >= 6);
  assert.equal(report.orphanProcessCount, 0);
});

test("NQ1-R1 performance matrix covers required resource counts and operations", async () => {
  const report = await buildNq1R1PerformanceOperationMatrix();

  assert.equal(report.passed, true);
  assert.deepEqual(report.resourceCounts, [1, 3, 10, 25]);
  assert.equal(report.rows.length, 4 * 10);
  assert.equal(report.rows.every((row) => row.sampleCount === 5), true);
});

test("NQ1-R1 reserve model history runs 1000 seeds x 100 operations", () => {
  const report = buildNq1R1ReserveModelHistoryReport();

  assert.equal(report.passed, true);
  assert.equal(report.seedCount, 1000);
  assert.equal(report.operationsPerSeed, 100);
  assert.equal(report.totalOperations, 100000);
});

test("NQ1-R1 50-resource fixture remains editable with round-trip proof", async () => {
  const report = await buildNq1R1FiftyResourceFixtureReport();

  assert.equal(report.passed, true);
  assert.equal(report.resourceCount, 50);
  assert.equal(report.sessionImageCount, 50);
});
