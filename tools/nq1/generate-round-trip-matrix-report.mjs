import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const artifactRoot = path.join(repoRoot, ".artifacts/product/NQ1");
const helperUrl = pathToFileURL(path.join(repoRoot, "dist/tests/helpers/nq1-round-trip-matrix.js")).href;
const { runNq1RoundTripMatrixValidation } = await import(helperUrl);

await mkdir(artifactRoot, { recursive: true });

const report = {
  ...await runNq1RoundTripMatrixValidation(),
  generatedAt: new Date().toISOString()
};

await writeFile(path.join(artifactRoot, "multi-resource-round-trip-matrix-report.json"), `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  reportPath: ".artifacts/product/NQ1/multi-resource-round-trip-matrix-report.json",
  passed: report.passed,
  supportedFixtureCount: report.supportedFixtureCount,
  unsupportedFixtureCount: report.unsupportedFixtureCount,
  replacementAttemptCount: report.replacementAttemptCount,
  failClosedCount: report.failClosedCount
}));

if (!report.passed) {
  process.exitCode = 1;
}
