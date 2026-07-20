import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const artifactRoot = path.join(repoRoot, ".artifacts/product/NQ1");
const helperUrl = pathToFileURL(path.join(repoRoot, "dist/tests/helpers/nq1-history-model.js")).href;
const { runNq1HistoryModelValidation } = await import(helperUrl);

await mkdir(artifactRoot, { recursive: true });

const report = {
  ...runNq1HistoryModelValidation({
    seeds: 100,
    operationsPerSeed: 100,
    maxHistoryLength: 5
  }),
  generatedAt: new Date().toISOString()
};

await writeFile(path.join(artifactRoot, "model-based-history-report.json"), `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  reportPath: ".artifacts/product/NQ1/model-based-history-report.json",
  passed: report.passed,
  totalOperations: report.totalOperations,
  failureCount: report.failureCount
}));

if (!report.passed) {
  process.exitCode = 1;
}
