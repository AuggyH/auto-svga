import assert from "node:assert/strict";
import test from "node:test";
import { runNq1RoundTripMatrixValidation } from "./helpers/nq1-round-trip-matrix.js";

test("NQ1 multi-resource round-trip matrix preserves replaced and untouched resource hashes", async () => {
  const report = await runNq1RoundTripMatrixValidation();

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.milestoneId, "NQ1");
  assert.equal(report.reportId, "multi-resource-round-trip-matrix");
  assert.equal(report.supportedFixtureCount, 6);
  assert.equal(report.unsupportedFixtureCount, 1);
  assert.equal(report.replacementAttemptCount, 15);
  assert.equal(report.failClosedCount, 1);
  assert.equal(report.rows.some((row) => row.milestoneId === "P3" && row.replacementCount === 1), true);
  assert.equal(report.rows.some((row) => row.milestoneId === "P4" && row.replacementCount >= 2), true);
  assert.equal(report.rows.every((row) => row.sourceUnchanged), true);
  assert.equal(report.rows.every((row) => row.replacedHashesMatch), true);
  assert.equal(report.rows.every((row) => row.untouchedHashesMatch), true);
  assert.equal(report.passed, true, JSON.stringify(report.rows.filter((row) => !row.passed), null, 2));
});
