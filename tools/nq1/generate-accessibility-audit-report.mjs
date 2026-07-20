import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const artifactRoot = path.join(repoRoot, ".artifacts/product/NQ1");
const helperUrl = pathToFileURL(path.join(repoRoot, "dist/tests/helpers/nq1-accessibility-audit.js")).href;
const { buildNq1AccessibilityAuditReport } = await import(helperUrl);

await mkdir(artifactRoot, { recursive: true });

const report = {
  ...buildNq1AccessibilityAuditReport({
    htmlSource: await readFile(path.join(repoRoot, "tools/electron-prototype/experiments/svga-web/web/index.html"), "utf8"),
    rendererSource: await readFile(path.join(repoRoot, "tools/electron-prototype/experiments/svga-web/web/prototype.js"), "utf8"),
    cssSource: await readFile(path.join(repoRoot, "tools/electron-prototype/experiments/svga-web/web/styles.css"), "utf8")
  }),
  generatedAt: new Date().toISOString()
};

await writeFile(path.join(artifactRoot, "accessibility-keyboard-error-semantics-audit-report.json"), `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  reportPath: ".artifacts/product/NQ1/accessibility-keyboard-error-semantics-audit-report.json",
  passed: report.passed,
  sourceCheckCount: report.sourceCheckCount,
  advisoryCount: report.advisoryCount
}));

if (!report.passed) {
  process.exitCode = 1;
}
