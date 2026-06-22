import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildP6ParityReportFromRuntimeFacts,
  validateP6BaseRangeDiff,
  validateP6RuntimeScenarioContract,
  validateP6WorkerRegistryFreshness
} from "./parity-runner.mjs";
import { validateP6ParityReportV1 } from "../../dist/workbench/p6-parity-report-contract.js";

test("runtime fixture produces item-derived pass statuses", () => {
  const report = buildP6ParityReportFromRuntimeFacts(goodFacts());

  for (const section of Object.values(report.sections)) {
    assert.equal(section.status, "pass", `${section.id}: ${section.items.map((item) => `${item.id}=${item.status}[${item.failures.join(",")}]`).join("; ")}`);
    for (const item of section.items) {
      assert.equal(item.status, "pass");
      assert.equal(item.status, item.checks.every((check) => check.passed) ? "pass" : "fail");
      assert.deepEqual(item.failures, []);
    }
  }
});

test("missing Desktop controls fail item checks", () => {
  const facts = goodFacts();
  facts.desktop.stateRenderProof.states.loaded.passed = false;

  const report = buildP6ParityReportFromRuntimeFacts(facts);
  assertItemFailed(report, "featureParity", "reference-media-select", "desktop-item-runtime");
});

test("missing secondary, reference, logs, settings, and latest artifacts fail feature items", () => {
  const facts = goodFacts();
  facts.artifactBindings = facts.artifactBindings.filter((artifact) =>
    !artifact.path.includes("desktop-inspection.png") && !artifact.path.includes("artifact-index.json")
    && !artifact.path.includes("desktop-empty.png") && !artifact.path.includes("desktop-loaded.png")
  );

  const report = buildP6ParityReportFromRuntimeFacts(facts);

  for (const itemId of [
    "secondary-svga-file-select",
    "reference-media-select",
    "runtime-logs",
    "settings-modal",
    "latest-artifact-scan-and-load"
  ]) {
    assertItemFailed(report, "featureParity", itemId, "desktop-item-artifacts");
  }
});

test("editor controls leakage fails browser regression", () => {
  const facts = goodFacts();
  facts.web.domManifest.snapshots[0].bodyTextSample = "Timeline keyframe editor";

  const report = buildP6ParityReportFromRuntimeFacts(facts);
  assertItemFailed(report, "browserRegression", "web-baseline-load", "no-editor-controls-leakage");
});

test("shell, app, or CSS hash drift fails Desktop runtime proof", () => {
  const facts = goodFacts();
  facts.desktop.normalSmokeParity.checks[0].passed = false;

  const report = buildP6ParityReportFromRuntimeFacts(facts);
  assertItemFailed(report, "desktopRuntimeProof", "source-electron-smoke", "shell-app-css-hash-parity");
});

test("missing interaction traces, screenshots, and motion frames fail targeted items", () => {
  const noTrace = goodFacts();
  noTrace.web.interactionTrace.steps = [];
  assertItemFailed(
    buildP6ParityReportFromRuntimeFacts(noTrace),
    "interactionParity",
    "open-settings-modal",
    "web-item-runtime"
  );

  const noScreenshot = goodFacts();
  noScreenshot.artifactBindings = noScreenshot.artifactBindings.filter((artifact) =>
    !artifact.path.includes("screenshot-settings")
  );
  assertItemFailed(
    buildP6ParityReportFromRuntimeFacts(noScreenshot),
    "interactionParity",
    "open-settings-modal",
    "web-item-artifacts"
  );

  const noMotion = goodFacts();
  noMotion.web.motionManifest.keyframes = [];
  noMotion.web.motionManifest.sampledAnimations = [];
  assertItemFailed(buildP6ParityReportFromRuntimeFacts(noMotion), "motionParity", "cardEnter", "web-item-runtime");
});

test("Loading equals Empty and Invalid retains metadata fail accessibility checks", () => {
  const sameLoading = goodFacts();
  sameLoading.desktop.stateRenderProof.states.loading.renderedText = sameLoading.desktop.stateRenderProof.states.empty.renderedText;
  assertItemFailed(
    buildP6ParityReportFromRuntimeFacts(sameLoading),
    "accessibilityReport",
    "desktop-rendered-states",
    "desktop-empty-differs-loading"
  );

  const staleInvalid = goodFacts();
  staleInvalid.desktop.stateRenderProof.states.invalid.staleMetadataCleared = false;
  assertItemFailed(
    buildP6ParityReportFromRuntimeFacts(staleInvalid),
    "accessibilityReport",
    "desktop-rendered-states",
    "desktop-invalid-clears-metadata"
  );
});

test("fixture hash mismatch fails packaged fixture flow", () => {
  const facts = goodFacts();
  facts.package.normalProof.normalProof.fixtureSha256 = "b".repeat(64);

  const report = buildP6ParityReportFromRuntimeFacts(facts);
  assertItemFailed(report, "desktopRuntimeProof", "packaged-app-fixture-flow", "fixture-hash-match");
});

test("generic artifacts bound to every item are rejected by the report validator", () => {
  const report = buildP6ParityReportFromRuntimeFacts(goodFacts());
  const allArtifactIds = report.sections.artifactIndex.artifacts.map((artifact) => artifact.id);
  report.sections.featureParity.items[0].webEvidence.artifactIds = allArtifactIds;

  const validation = validateP6ParityReportV1(report);

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.includes("must not bind every artifact generically")));
});

test("empty reviewer observations fail Desktop runtime proof", () => {
  const facts = goodFacts();
  facts.desktop.reviewerB.categories[0].visualObservations = [];

  const report = buildP6ParityReportFromRuntimeFacts(facts);
  assertItemFailed(report, "desktopRuntimeProof", "source-electron-smoke", "reviewer-observations-present");
});

test("base-range diff failure is detected", () => {
  const validation = validateP6BaseRangeDiff({
    baseCommit: "a".repeat(40),
    headCommit: "a".repeat(40),
    changedFiles: ["docs/loop/LOOP_STATE.md"],
    allowedPaths: ["tools/p6", "src/workbench"]
  });

  assert.equal(validation.valid, false);
  assert.ok(validation.failures.includes("baseCommit and headCommit must differ"));
  assert.ok(validation.failures.includes("changed file outside A4 ownership: docs/loop/LOOP_STATE.md"));
});

test("stale Worker registry is detected", () => {
  const validation = validateP6WorkerRegistryFreshness({
    currentRepairRound: 3,
    currentIntegrationHeadCommit: "old",
    workers: [{ id: "A4", branch: "agent/codex/old" }]
  }, {
    repairRound: 4,
    currentIntegrationHeadCommit: "dbab38f",
    workerId: "A4",
    branch: "agent/codex/p6-r4-a4-parity-runtime"
  });

  assert.equal(validation.valid, false);
  assert.ok(validation.failures.includes("registry currentRepairRound 3 does not equal 4"));
  assert.ok(validation.failures.includes("registry currentIntegrationHeadCommit is stale"));
  assert.ok(validation.failures.includes("registry worker A4 branch is stale"));
});

test("missing App ZIP is detected by report and scenario contract", () => {
  const facts = goodFacts();
  facts.artifactBindings = facts.artifactBindings.filter((artifact) => !artifact.path.endsWith(".zip"));

  const report = buildP6ParityReportFromRuntimeFacts(facts);
  const scenarioValidation = validateP6RuntimeScenarioContract(facts);

  assertItemFailed(report, "desktopRuntimeProof", "packaged-app-fixture-flow", "app-zip-present");
  assert.equal(scenarioValidation.valid, false);
  assert.ok(scenarioValidation.failures.includes("packaged-runtime missing App ZIP"));
});

test("generator source does not use hard-coded status pass object fields", async () => {
  const source = await readFile(new URL("./generate-p6-evidence.mjs", import.meta.url), "utf8");

  assert.equal(source.includes('status: "pass"'), false);
});

function assertItemFailed(report, sectionKey, itemId, checkId) {
  const item = report.sections[sectionKey].items.find((candidate) => candidate.id === itemId);
  assert.ok(item, `missing item ${sectionKey}.${itemId}`);
  assert.equal(item.status, "fail");
  assert.ok(item.failures.includes(checkId), `expected ${itemId} to fail ${checkId}, got ${item.failures.join(", ")}`);
}

function goodFacts() {
  const fixtureSha256 = "a".repeat(64);
  return {
    generatedAt: "2026-06-22T00:00:00.000Z",
    source: {
      baseCommit: "dbab38f",
      headCommit: "c".repeat(40),
      branch: "agent/codex/p6-r4-a4-parity-runtime"
    },
    contract: {
      regions: [
        { id: "shell", selector: ".shell", visibleStates: ["local-empty", "export-review-loaded"], required: true, sourceFiles: ["tools/svga-player-preview/index.html"] }
      ],
      features: [
        { id: "secondary-svga-file-select", selectors: ["#secondaryFileInput"], required: true, sourceFiles: ["tools/svga-player-preview/index.html"] },
        { id: "reference-media-select", selectors: ["#referenceFileButton"], required: true, sourceFiles: ["tools/svga-player-preview/index.html"] },
        { id: "runtime-logs", selectors: ["#logsButton"], required: true, sourceFiles: ["tools/svga-player-preview/main.js"] },
        { id: "settings-modal", selectors: ["#settingsButton"], required: true, sourceFiles: ["tools/svga-player-preview/main.js"] },
        { id: "latest-artifact-scan-and-load", selectors: ["#rescanButton"], required: true, sourceFiles: ["tools/svga-player-preview/server.mjs"] }
      ],
      interactions: [
        { id: "open-settings-modal", selector: "#settingsButton", initialState: "logs-open", expectedState: "settings-open", required: true }
      ],
      states: [
        { id: "local-empty", required: true },
        { id: "export-review-loaded", required: true },
        { id: "invalid-error-state", required: true }
      ],
      motions: [
        { id: "cardEnter", selector: ".previewCard", animationName: "cardEnter", required: true }
      ]
    },
    sourceHashes: {
      "tools/svga-player-preview/index.html": fixtureSha256,
      "tools/svga-player-preview/main.js": fixtureSha256,
      "tools/svga-player-preview/server.mjs": fixtureSha256
    },
    artifactBindings: artifactBindings(),
    web: {
      domManifest: {
        snapshots: [
          snapshot("local-empty", ["shell"], ["primaryFileButton"]),
          snapshot("export-review-loaded", ["shell"], ["referenceFileButton", "logsButton", "settingsButton", "rescanButton"]),
          snapshot("local-compare-empty", ["shell"], ["secondaryFileInput"]),
          snapshot("logs-open", ["shell"], ["settingsButton"]),
          snapshot("settings-open", ["shell"], ["settingsButton"]),
          snapshot("invalid", ["shell"], ["errorBox"]),
          snapshot("responsive-export-review-900x720", ["shell"], ["referenceFileButton"])
        ]
      },
      computedStylesManifest: { selectors: [{ selector: ".shell", present: true }] },
      motionManifest: {
        keyframes: [{ name: "cardEnter" }],
        sampledAnimations: [{ selector: ".previewCard", animationName: "cardEnter" }]
      },
      interactionTrace: {
        steps: [
          { stateId: "settings-open", visibleControlCount: 3 },
          { stateId: "export-review-loaded", visibleControlCount: 4 }
        ]
      },
      requestAudit: { externalRequests: [] }
    },
    desktop: {
      runtimeIdentity: {
        rendererJsSha256: fixtureSha256,
        stylesCssSha256: fixtureSha256,
        mainSha256: fixtureSha256,
        preloadSha256: fixtureSha256,
        security: {
          remoteNavigationAllowed: false,
          telemetryEnabled: false,
          contentSecurityPolicy: "default-src 'self'; script-src 'self'"
        }
      },
      normalSmokeParity: {
        passed: true,
        checks: [{ id: "renderer-style-main-preload-hash-parity", passed: true }]
      },
      stateRenderProof: {
        passed: true,
        states: {
          empty: { passed: true, renderedText: "Empty" },
          loading: { passed: true, renderedText: "Loading" },
          loaded: { passed: true, renderedText: "Loaded" },
          invalid: { passed: true, staleMetadataCleared: true, staleInspectionCleared: true, renderedText: "Invalid" }
        }
      },
      artifactIndex: {
        fixtureHashes: { fixtureSha256 }
      },
      reviewerB: {
        categories: [{ id: "shell", visualObservations: ["Shell is visible."] }]
      }
    },
    package: {
      normalProof: {
        passed: true,
        normalProof: { fixtureSha256 }
      },
      manifest: { fixtureSha256 }
    }
  };
}

function artifactBindings() {
  const fragments = [
    ".artifacts/product/P6/web-baseline/dom-manifest.json",
    ".artifacts/product/P6/web-baseline/computed-styles-manifest.json",
    ".artifacts/product/P6/web-baseline/motion-manifest.json",
    ".artifacts/product/P6/web-baseline/interaction-trace.json",
    ".artifacts/product/P6/web-baseline/request-audit.json",
    ".artifacts/product/P6/web-baseline/screenshot-export-review-loaded-1440x900.png",
    ".artifacts/product/P6/web-baseline/screenshot-export-review-loaded-900x720.png",
    ".artifacts/product/P6/web-baseline/screenshot-local-empty-1440x900.png",
    ".artifacts/product/P6/web-baseline/screenshot-local-compare-empty-1440x900.png",
    ".artifacts/product/P6/web-baseline/screenshot-invalid-1440x900.png",
    ".artifacts/product/P6/web-baseline/screenshot-settings-1440x900.png",
    ".artifacts/product/P6/web-baseline/screenshot-logs-1440x900.png",
    ".artifacts/product/P6/runtime-identity.json",
    ".artifacts/product/P6/normal-smoke-parity.json",
    ".artifacts/product/P6/desktop-state-render-proof.json",
    ".artifacts/product/P6/artifact-index.json",
    ".artifacts/product/P6/reviewer-b-product-categories.json",
    ".artifacts/product/P6/desktop-inspection.png",
    ".artifacts/product/P6/desktop-1280x800.png",
    ".artifacts/product/P6/desktop-1440x900.png",
    ".artifacts/product/P6/desktop-loaded.png",
    ".artifacts/product/P6/smoke-loaded.png",
    ".artifacts/product/P6/desktop-empty.png",
    ".artifacts/product/P6/desktop-invalid.png",
    ".artifacts/product/P6/invalid-fixture.json",
    ".artifacts/product/P6/packaged-app-runtime-proof.json",
    ".artifacts/product/P6/internal-trial-manifest.json",
    ".artifacts/product/P6/Auto-SVGA.zip"
  ];
  return fragments.map((path, index) => ({
    id: `artifact-${index}`,
    path,
    role: path.endsWith(".zip") ? "macos_app_zip" : "p6_evidence",
    sha256: `${String(index).padStart(2, "0")}`.repeat(32).slice(0, 64).replace(/g/g, "a"),
    sizeBytes: 10,
    mediaType: path.endsWith(".zip") ? "application/zip" : "application/json"
  }));
}

function snapshot(stateId, regionIds, controlIds) {
  return {
    stateId,
    bodyTextSample: "Auto SVGA product preview",
    regions: regionIds.map((id) => ({
      id,
      selector: id === "shell" ? ".shell" : `#${id}`,
      present: true,
      visible: true
    })),
    controls: controlIds.map((id) => ({
      id,
      visible: true,
      disabled: false
    }))
  };
}
