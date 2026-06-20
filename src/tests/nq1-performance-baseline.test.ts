import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { runNq1PerformanceBaseline } from "./helpers/nq1-performance-baseline.js";

test("NQ1 performance baseline records bounded local timings for hardening primitives", async () => {
  const mainSource = await readFile(path.resolve("tools/electron-prototype/experiments/svga-web/main.cjs"), "utf8");
  const rendererSource = await readFile(path.resolve("tools/electron-prototype/experiments/svga-web/web/prototype.js"), "utf8");
  const report = await runNq1PerformanceBaseline({ mainSource, rendererSource });

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.milestoneId, "NQ1");
  assert.equal(report.reportId, "performance-baseline");
  assert.equal(report.metricCount, 5);
  assert.equal(report.metrics.every((metric) => metric.status === "pass"), true);
  assert.equal(report.metrics.every((metric) => metric.durationMs >= 0), true);
  assert.equal(report.metrics.every((metric) => metric.durationMs <= metric.hangGuardMs), true);
  assert.ok(report.totalDurationMs >= 0);
  assert.equal(report.passed, true);
});
