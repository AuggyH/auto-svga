import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { buildNq1AccessibilityAuditReport } from "./helpers/nq1-accessibility-audit.js";

test("NQ1 accessibility audit records keyboard and error semantics without claiming full manual coverage", async () => {
  const htmlSource = await readFile(path.resolve("tools/electron-prototype/experiments/svga-web/web/index.html"), "utf8");
  const rendererSource = [
    await readFile(path.resolve("tools/electron-prototype/experiments/svga-web/web/desktop-product-entry.mjs"), "utf8"),
    await readFile(path.resolve("tools/shared/product-frontend/product-app.mjs"), "utf8")
  ].join("\n");
  const cssSource = await readFile(path.resolve("tools/electron-prototype/experiments/svga-web/web/styles.css"), "utf8");
  const sharedCssSource = await readFile(path.resolve("tools/shared/product-frontend/product-styles.css"), "utf8");
  const report = buildNq1AccessibilityAuditReport({
    htmlSource,
    rendererSource,
    cssSource: `${cssSource}\n${sharedCssSource}`
  });

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.milestoneId, "NQ1");
  assert.equal(report.reportId, "accessibility-keyboard-error-semantics-audit");
  assert.equal(report.sourceCheckFailures.length, 0, JSON.stringify(report.sourceCheckFailures, null, 2));
  assert.equal(report.advisories.some((advisory) => advisory.id === "axe_and_screen_reader_not_run"), true);
  assert.equal(report.advisoryCount >= 1, true);
  assert.equal(report.passed, true);
});
