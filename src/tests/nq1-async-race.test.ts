import assert from "node:assert/strict";
import test from "node:test";
import { runNq1AsyncRaceValidation } from "./helpers/nq1-async-race-harness.js";

test("NQ1 async race and failure injection ignores stale results and preserves latest state", () => {
  const report = runNq1AsyncRaceValidation();

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.milestoneId, "NQ1");
  assert.equal(report.reportId, "async-race-and-failure-injection");
  assert.equal(report.scenarioCount, 7);
  assert.equal(report.failureCount, 0, JSON.stringify(report.scenarios.filter((scenario) => !scenario.passed), null, 2));
  assert.equal(report.failureInjectionCount, 2);
  assert.ok(report.staleResultCount >= 4);
  assert.ok(report.rollbackCount >= 1);
  assert.ok(report.saveRejectionCount >= 1);
  assert.equal(report.passed, true);
});
