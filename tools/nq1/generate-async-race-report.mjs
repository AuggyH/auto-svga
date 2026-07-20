import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const artifactRoot = path.join(repoRoot, ".artifacts/product/NQ1");
const helperUrl = pathToFileURL(path.join(repoRoot, "dist/tests/helpers/nq1-async-race-harness.js")).href;
const { runNq1AsyncRaceValidation } = await import(helperUrl);

await mkdir(artifactRoot, { recursive: true });

const report = {
  ...runNq1AsyncRaceValidation(),
  generatedAt: new Date().toISOString()
};

await writeFile(path.join(artifactRoot, "async-race-and-failure-injection-report.json"), `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  reportPath: ".artifacts/product/NQ1/async-race-and-failure-injection-report.json",
  passed: report.passed,
  scenarioCount: report.scenarioCount,
  staleResultCount: report.staleResultCount,
  rollbackCount: report.rollbackCount,
  saveRejectionCount: report.saveRejectionCount
}));

if (!report.passed) {
  process.exitCode = 1;
}
