import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNq1FlakeStabilityReport,
  buildNq1FlakeStaticChecks,
  type Nq1RepeatedRunGroup
} from "./helpers/nq1-flake-stability.js";

const passingSnapshot = {
  loopValidateSource: [
    'server.listen(0, "127.0.0.1", resolveListen);',
    "} finally {",
    "server.close((error) => error ? rejectClose(error) : resolveClose());",
    "const activeChildren = new Set();",
    "activeChildren?.add(child);",
    "if (!child.killed) child.kill();"
  ].join("\n"),
  launcherSource: [
    "probeAutoSvgaPreview();",
    "waitForAutoSvgaPreview();",
    'child.kill("SIGTERM");'
  ].join("\n"),
  launcherTestSource: 'server.listen(0, "127.0.0.1");',
  svgaWebMainSource: "",
  svgaWebServerSource: 'server.listen(0, "127.0.0.1", resolve);',
  svgaWebRendererSource: [
    "waitForVisibleCanvasSamples();",
    "visibleCanvas.sampleCount >= 3;",
    "timeoutMs"
  ].join("\n"),
  svgaWebPrepareSource: [
    "await rm(runtimeRoot, { recursive: true, force: true });",
    "await mkdir(runtimeRoot, { recursive: true });"
  ].join("\n"),
  packageJsonSource: [
    '"desktop:smoke": "run smoke"',
    '"desktop:dev": "run dev"',
    '"test": "npm run test:all"'
  ].join("\n")
};

test("NQ1 flake static checks cover ports, readiness, cleanup, and visual waits", () => {
  const checks = buildNq1FlakeStaticChecks(passingSnapshot);

  assert.equal(checks.length, 10);
  assert.equal(checks.every(({ status }) => status === "pass"), true, JSON.stringify(checks, null, 2));
  assert.equal(checks.some(({ id }) => id === "loop_validate_uses_random_loopback_port"), true);
  assert.equal(checks.some(({ id }) => id === "renderer_screenshot_smoke_waits_for_visible_canvas"), true);
});

test("NQ1 flake report fails closed when repeated runs are missing or failed", () => {
  const repeatedRunGroups: Nq1RepeatedRunGroup[] = [
    {
      id: "core-targeted-tests",
      command: "node --test dist/tests/nq1-history-model.test.js",
      expectedRepetitions: 5,
      actualRepetitions: 5,
      passCount: 5,
      failCount: 0,
      durationsMs: [1, 1, 1, 1, 1]
    },
    {
      id: "electron-smoke",
      command: "npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test",
      expectedRepetitions: 3,
      actualRepetitions: 2,
      passCount: 2,
      failCount: 0,
      durationsMs: [10, 10]
    }
  ];

  const report = buildNq1FlakeStabilityReport({
    staticChecks: buildNq1FlakeStaticChecks(passingSnapshot),
    repeatedRunGroups,
    developerDocs: [
      "docs/product/EDITOR_TEST_MATRIX.md",
      "docs/product/EDITOR_TROUBLESHOOTING.md",
      "docs/product/SUPPORTED_EDITABLE_SVGA_BOUNDARY.md"
    ]
  });

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.milestoneId, "NQ1");
  assert.equal(report.reportId, "flake-stability");
  assert.equal(report.passed, false);
});
