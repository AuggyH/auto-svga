import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { buildNq1CleanupStressReport } from "./helpers/nq1-cleanup-stress.js";

test("NQ1 cleanup stress covers process, runtime, and renderer resource boundaries", async () => {
  const mainSource = await readFile(path.resolve("tools/electron-prototype/experiments/svga-web/main.cjs"), "utf8");
  const rendererSource = await readFile(path.resolve("tools/electron-prototype/experiments/svga-web/web/prototype.js"), "utf8");
  const report = buildNq1CleanupStressReport({ mainSource, rendererSource });

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.milestoneId, "NQ1");
  assert.equal(report.reportId, "resource-process-memory-cleanup-stress");
  assert.equal(report.sourceCheckFailures.length, 0, JSON.stringify(report.sourceCheckFailures, null, 2));
  assert.equal(report.scenarioFailureCount, 0);
  assert.equal(report.finalActiveResourceCount, 0);
  assert.equal(report.maxActiveResourceCount, 2);
  assert.equal(report.playerDestroyCount, report.parserDestroyCount);
  assert.ok(report.cleanupCount >= 120);
  assert.ok(report.localDestroyCount > 0);
  assert.equal(report.passed, true);
});
