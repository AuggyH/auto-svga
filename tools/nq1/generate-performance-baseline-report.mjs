import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const artifactRoot = path.join(repoRoot, ".artifacts/product/NQ1");
const helperUrl = pathToFileURL(path.join(repoRoot, "dist/tests/helpers/nq1-performance-baseline.js")).href;
const { runNq1PerformanceBaseline } = await import(helperUrl);

await mkdir(artifactRoot, { recursive: true });

const report = {
  ...await runNq1PerformanceBaseline({
    mainSource: await readFile(path.join(repoRoot, "tools/electron-prototype/experiments/svga-web/main.cjs"), "utf8"),
    rendererSource: await readFile(path.join(repoRoot, "tools/electron-prototype/experiments/svga-web/web/prototype.js"), "utf8")
  }),
  generatedAt: new Date().toISOString()
};

await writeFile(path.join(artifactRoot, "performance-baseline-report.json"), `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  reportPath: ".artifacts/product/NQ1/performance-baseline-report.json",
  passed: report.passed,
  metricCount: report.metricCount,
  totalDurationMs: report.totalDurationMs,
  hangGuardMs: report.hangGuardMs
}));

if (!report.passed) {
  process.exitCode = 1;
}
