import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const artifactRoot = path.join(repoRoot, ".artifacts/product/NQ1");
const helperUrl = pathToFileURL(path.join(repoRoot, "dist/tests/helpers/nq1-cleanup-stress.js")).href;
const { buildNq1CleanupStressReport } = await import(helperUrl);

await mkdir(artifactRoot, { recursive: true });

const report = {
  ...buildNq1CleanupStressReport({
    mainSource: await readFile(path.join(repoRoot, "tools/electron-prototype/experiments/svga-web/main.cjs"), "utf8"),
    rendererSource: await readFile(path.join(repoRoot, "tools/electron-prototype/experiments/svga-web/web/prototype.js"), "utf8")
  }),
  generatedAt: new Date().toISOString()
};

await writeFile(path.join(artifactRoot, "resource-process-memory-cleanup-stress-report.json"), `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  reportPath: ".artifacts/product/NQ1/resource-process-memory-cleanup-stress-report.json",
  passed: report.passed,
  sourceCheckCount: report.sourceCheckCount,
  scenarioCount: report.scenarioCount,
  cleanupCount: report.cleanupCount,
  finalActiveResourceCount: report.finalActiveResourceCount
}));

if (!report.passed) {
  process.exitCode = 1;
}
