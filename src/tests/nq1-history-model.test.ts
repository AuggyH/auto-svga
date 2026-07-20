import assert from "node:assert/strict";
import test from "node:test";
import { runNq1HistoryModelValidation } from "./helpers/nq1-history-model.js";

test("NQ1 model-driven edit history validation matches the implementation", () => {
  const report = runNq1HistoryModelValidation({
    seeds: 100,
    operationsPerSeed: 100,
    maxHistoryLength: 5
  });

  assert.equal(report.seedCount, 100);
  assert.equal(report.operationsPerSeed, 100);
  assert.equal(report.totalOperations, 10_000);
  assert.equal(report.failureCount, 0, JSON.stringify(report.failures[0] ?? null, null, 2));
  assert.equal(report.passed, true, JSON.stringify(report.invariantCoverage, null, 2));
  assert.ok(report.operationCoverage.replace >= 100);
  assert.ok(report.operationCoverage.replace_same_again >= 100);
  assert.ok(report.operationCoverage.reset_selected >= 100);
  assert.ok(report.operationCoverage.reset_all >= 100);
  assert.ok(report.operationCoverage.undo >= 100);
  assert.ok(report.operationCoverage.redo >= 100);
  assert.ok(report.operationCoverage.save_point >= 100);
  assert.ok(report.operationCoverage.invalid_replace >= 100);
  assert.ok(report.operationCoverage.failed_preview >= 100);
  assert.ok(report.operationCoverage.open_new_file >= 100);
});
