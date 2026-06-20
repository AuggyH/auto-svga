import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { buildNq1SaveAsSafetyMatrix } from "./helpers/nq1-save-as-safety-matrix.js";

test("NQ1 Save As safety matrix covers source checks and cross-platform path scenarios", async () => {
  const mainSource = await readFile(path.resolve("tools/electron-prototype/experiments/svga-web/main.cjs"), "utf8");
  const preloadSource = await readFile(path.resolve("tools/electron-prototype/experiments/svga-web/preload.cjs"), "utf8");
  const report = buildNq1SaveAsSafetyMatrix({ mainSource, preloadSource });

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.milestoneId, "NQ1");
  assert.equal(report.reportId, "cross-platform-save-as-safety-matrix");
  assert.equal(report.sourceCheckFailures.length, 0, JSON.stringify(report.sourceCheckFailures, null, 2));
  assert.equal(report.blockingScenarioCount, 0);
  assert.equal(report.deferredRiskCount, 1);
  assert.equal(report.scenarios.some((scenario) => scenario.id === "windows_case_variant_same_path_needs_runtime_review"), true);
  assert.equal(report.passed, true);
});
