import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const artifactRoot = path.join(repoRoot, ".artifacts/product/NQ1");
const helperUrl = pathToFileURL(path.join(repoRoot, "dist/tests/helpers/nq1-save-as-safety-matrix.js")).href;
const { buildNq1SaveAsSafetyMatrix } = await import(helperUrl);

await mkdir(artifactRoot, { recursive: true });

const report = {
  ...buildNq1SaveAsSafetyMatrix({
    mainSource: await readFile(path.join(repoRoot, "tools/electron-prototype/experiments/svga-web/main.cjs"), "utf8"),
    preloadSource: await readFile(path.join(repoRoot, "tools/electron-prototype/experiments/svga-web/preload.cjs"), "utf8")
  }),
  generatedAt: new Date().toISOString()
};

await writeFile(path.join(artifactRoot, "save-as-safety-matrix-report.json"), `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  reportPath: ".artifacts/product/NQ1/save-as-safety-matrix-report.json",
  passed: report.passed,
  sourceCheckCount: report.sourceCheckCount,
  scenarioCount: report.scenarioCount,
  deferredRiskCount: report.deferredRiskCount
}));

if (!report.passed) {
  process.exitCode = 1;
}
