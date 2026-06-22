import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { encode } from "fast-png";

import {
  buildP6ParityReportFromRuntimeFacts,
  validateP6BaseRangeDiff,
  validateP6RuntimeScenarioContract,
  validateP6SourceDiffPrivacy,
  validateP6WorkerRegistryFreshness
} from "./parity-runner.mjs";
import { buildInteractionParityReport } from "./runtime-scenarios/strict-evidence.mjs";
import { generateStateComparison } from "./runtime-scenarios/state-evidence.mjs";
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

test("state evidence helper writes Web/Desktop/comparison triple and JSON", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "p6-state-evidence-"));
  try {
    await writePng(path.join(root, "web-baseline/screenshot-local-empty-1440x900.png"), [255, 0, 0, 255]);
    await writePng(path.join(root, "desktop-empty.png"), [0, 0, 255, 255]);

    const result = await generateStateComparison(root, "local-empty");

    assert.equal(result.passed, false);
    await readFile(path.join(root, "state-comparisons/web-local-empty.png"));
    await readFile(path.join(root, "state-comparisons/desktop-local-empty.png"));
    await readFile(path.join(root, "state-comparisons/web-desktop-local-empty-comparison.png"));
    const json = JSON.parse(await readFile(path.join(root, "state-comparisons/local-empty-comparison.json"), "utf8"));
    assert.equal(json.checks.notSameSourceHash, true);
    assert.equal(json.checks.geometryCompared, false);
  } finally {
    await rm(root, { recursive: true, force: true });
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

  const noDesktopMotionFrame = goodFacts();
  noDesktopMotionFrame.artifactBindings = noDesktopMotionFrame.artifactBindings.filter((artifact) =>
    !artifact.path.includes("desktop-motion-cardEnter-mid.png")
  );
  assertItemFailed(
    buildP6ParityReportFromRuntimeFacts(noDesktopMotionFrame),
    "motionParity",
    "cardEnter",
    "desktop-item-artifacts"
  );
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
  facts.package.normalProof.normalVisibleStartup.runtimeIdentity.fixtureSha256 = "b".repeat(64);

  const report = buildP6ParityReportFromRuntimeFacts(facts);
  assertItemFailed(report, "desktopRuntimeProof", "packaged-app-fixture-flow", "fixture-hash-match");
});

test("fake PASS status is rejected when checks fail", () => {
  const report = buildP6ParityReportFromRuntimeFacts(goodFacts());
  report.sections.stateParity.items[0].checks[0].passed = false;

  const validation = validateP6ParityReportV1(report);

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.includes("status must be derived from checks.every")));
});

test("generic artifacts bound to every item are rejected by the report validator", () => {
  const report = buildP6ParityReportFromRuntimeFacts(goodFacts());
  const allArtifactIds = report.sections.artifactIndex.artifacts.map((artifact) => artifact.id);
  report.sections.featureParity.items[0].webEvidence.artifactIds = allArtifactIds;

  const validation = validateP6ParityReportV1(report);

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.includes("must not bind every artifact generically")));
});

test("generic screenshots and Web-only evidence fail state triples", () => {
  const generic = goodFacts();
  generic.stateComparisons["local-empty"].checks.notSameSourceHash = false;
  generic.stateComparisons["local-empty"].passed = false;
  assertItemFailed(buildP6ParityReportFromRuntimeFacts(generic), "stateParity", "local-empty", "web-item-runtime");

  const webOnly = goodFacts();
  delete webOnly.stateComparisons["local-empty"];
  webOnly.artifactBindings = webOnly.artifactBindings.filter((artifact) =>
    !artifact.path.includes("state-comparisons/desktop-local-empty.png")
      && !artifact.path.includes("state-comparisons/web-desktop-local-empty-comparison.png")
  );
  assertItemFailed(buildP6ParityReportFromRuntimeFacts(webOnly), "stateParity", "local-empty", "web-item-runtime");
});

test("reviewer verdict-shaped evidence fails Desktop runtime proof", () => {
  const facts = goodFacts();
  facts.desktop.reviewerBEvidenceRequest.categories[0].verdict = "PASS";

  const report = buildP6ParityReportFromRuntimeFacts(facts);
  assertItemFailed(report, "desktopRuntimeProof", "source-electron-smoke", "reviewer-evidence-request-present");
});

test("reviewer category gaps fail Desktop runtime proof", () => {
  const facts = goodFacts();
  facts.desktop.reviewerBEvidenceRequest.categories = facts.desktop.reviewerBEvidenceRequest.categories.filter((category) => category.category !== "motionParity");

  const report = buildP6ParityReportFromRuntimeFacts(facts);
  assertItemFailed(report, "desktopRuntimeProof", "source-electron-smoke", "reviewer-categories-complete");
});

test("normal App proof flags fail when proof is smoke flavored", () => {
  const facts = goodFacts();
  facts.package.normalProof.normalVisibleStartup.noSmokeMode = false;
  facts.package.normalProof.normalVisibleStartup.environmentOverrides = { AUTO_SVGA_PRODUCT_SMOKE: "1" };

  const report = buildP6ParityReportFromRuntimeFacts(facts);
  assertItemFailed(report, "desktopRuntimeProof", "packaged-app-launch", "normal-app-proof-flags");
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

test("source diff privacy literals are detected", () => {
  const sampleUserPath = ["", "Users", "alice", "private", "P6"].join("/");
  const validation = validateP6SourceDiffPrivacy({
    diffText: `+ artifactRoot = ${sampleUserPath}\n+ AUTO_SVGA_API_TOKEN=secret`
  });

  assert.equal(validation.valid, false);
  assert.ok(validation.failures.some((failure) => failure.includes("privacy literal")));
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

test("Repair 6 strict interaction gates reject synthetic, Web-only, and mismatched context evidence", () => {
  const synthetic = goodFacts();
  synthetic.webInteractionTrace.actionTrace[0].kind = "script";
  synthetic.interactionParityReport = buildInteractionParityReport({
    contract: synthetic.contract,
    webTrace: synthetic.webInteractionTrace,
    desktopTrace: synthetic.desktopInteractionTrace
  });
  assertItemFailed(
    buildP6ParityReportFromRuntimeFacts(synthetic),
    "interactionParity",
    "open-settings-modal",
    "web-item-runtime"
  );

  const webOnly = goodFacts();
  webOnly.desktopInteractionTrace.actionTrace = [];
  webOnly.interactionParityReport = buildInteractionParityReport({
    contract: webOnly.contract,
    webTrace: webOnly.webInteractionTrace,
    desktopTrace: webOnly.desktopInteractionTrace
  });
  assertItemFailed(
    buildP6ParityReportFromRuntimeFacts(webOnly),
    "interactionParity",
    "open-settings-modal",
    "strict-interaction-parity"
  );

  const mismatchedContext = goodFacts();
  mismatchedContext.desktopInteractionTrace.context.viewportCss.width = 900;
  mismatchedContext.interactionParityReport = buildInteractionParityReport({
    contract: mismatchedContext.contract,
    webTrace: mismatchedContext.webInteractionTrace,
    desktopTrace: mismatchedContext.desktopInteractionTrace
  });
  assert.equal(mismatchedContext.interactionParityReport.falseNegativeCount, 0);
  assertItemFailed(
    buildP6ParityReportFromRuntimeFacts(mismatchedContext),
    "interactionParity",
    "open-settings-modal",
    "strict-interaction-parity"
  );
});

test("Repair 6 strict state gates reject hash-only, stale invalid, and split loading snapshots", () => {
  const hashOnly = goodFacts();
  hashOnly.stateComparisons["local-empty"].checks.geometryCompared = false;
  hashOnly.stateComparisons["local-empty"].passed = false;
  assertItemFailed(buildP6ParityReportFromRuntimeFacts(hashOnly), "stateParity", "local-empty", "web-item-runtime");

  const staleInvalid = goodFacts();
  staleInvalid.stateComparisons["invalid-error-state"].checks.controlValuesCompared = false;
  staleInvalid.stateComparisons["invalid-error-state"].passed = false;
  assertItemFailed(buildP6ParityReportFromRuntimeFacts(staleInvalid), "stateParity", "invalid-error-state", "web-item-runtime");

  const splitLoading = goodFacts();
  splitLoading.stateComparisons["export-review-loaded"].checks.stateSnapshotIdBound = false;
  splitLoading.stateComparisons["export-review-loaded"].passed = false;
  assertItemFailed(buildP6ParityReportFromRuntimeFacts(splitLoading), "stateParity", "export-review-loaded", "web-item-runtime");
});

test("Repair 6 strict motion gates reject missing trigger, crop, and reduced-motion evidence", () => {
  for (const checkId of ["sameTriggerAndState", "cropCompared", "reducedMotionCompared"]) {
    const facts = goodFacts();
    facts.motionEvidence.cardEnter.checks[checkId] = false;
    facts.motionEvidence.cardEnter.passed = false;
    assertItemFailed(buildP6ParityReportFromRuntimeFacts(facts), "motionParity", "cardEnter", "web-item-runtime");
  }
});

test("generator source does not use hard-coded status pass object fields", async () => {
  const source = await readFile(new URL("./generate-p6-evidence.mjs", import.meta.url), "utf8");

  assert.equal(source.includes('status: "pass"'), false);
  assert.equal(source.includes("reviewer-b-product-categories.json"), false);
  assert.equal(source.includes("verdict:"), false);
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
        { id: "open-settings-modal", trigger: "click", selector: "#settingsButton", initialState: "logs-open", expectedState: "settings-open", required: true }
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
    webInteractionTrace: strictTrace("web", fixtureSha256),
    desktopInteractionTrace: strictTrace("desktop", fixtureSha256),
    interactionParityReport: {
      schemaVersion: 1,
      reportId: "interaction-parity-report",
      passed: true,
      falseNegativeCount: 0,
      checks: {
        webTraceValid: true,
        desktopTraceValid: true,
        sameFixtureBytes: true,
        sameFixtureDisplayName: true,
        sameViewportCss: true,
        sameDevicePixelRatio: true,
        samePlaybackTime: true,
        sameModePanelModalControls: true,
        sameActionContract: true,
        finalStateDigestsPresent: true,
        visibleRegionsMatched: true,
        visibleControlsMatched: true,
        screenshotsPresent: true,
        noUnapprovedDifferences: true
      },
      failures: []
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
          "settings-open": { passed: true, renderedText: "Settings" },
          "local-compare-empty": { passed: true, renderedText: "Compare Empty" },
          invalid: { passed: true, staleMetadataCleared: true, staleInspectionCleared: true, renderedText: "Invalid" }
        }
      },
      artifactIndex: {
        fixtureHashes: { fixtureSha256 }
      },
      reviewerBEvidenceRequest: {
        categories: [
          "comparison",
          "referenceMedia",
          "interactionParity",
          "motionParity",
          "emptyState",
          "loadingState",
          "invalidState",
          "normalMacApp",
          "bundleCompleteness"
        ].map((category) => ({
          category,
          request: `${category} evidence requested.`,
          evidenceNeeded: [{ path: `.artifacts/product/P6/${category}.json`, present: true }]
        }))
      }
    },
    package: {
      normalProof: {
        passed: true,
        normalVisibleStartup: {
          normalVisibleStartup: true,
          windowShown: true,
          noProofMode: true,
          noSmokeMode: true,
          noProofArguments: true,
          rendererQuery: "",
          environmentOverrides: {},
          actualArgvSanitized: ["Auto SVGA"],
          runtimeIdentity: { fixtureSha256 }
        },
        runtimeIdentity: { fixtureSha256 }
      },
      manifest: { fixtureSha256 }
    },
    stateComparisons: {
      "local-empty": stateComparison("local-empty"),
      "export-review-loaded": stateComparison("export-review-loaded"),
      "invalid-error-state": stateComparison("invalid-error-state")
    },
    motionEvidence: {
      cardEnter: motionEvidence("cardEnter")
    }
  };
}

function artifactBindings() {
  const fragments = [
    ".artifacts/product/P6/web-baseline/dom-manifest.json",
    ".artifacts/product/P6/web-baseline/computed-styles-manifest.json",
    ".artifacts/product/P6/web-baseline/motion-manifest.json",
    ".artifacts/product/P6/web-baseline/interaction-trace.json",
    ".artifacts/product/P6/web-interaction-trace.json",
    ".artifacts/product/P6/desktop-interaction-trace.json",
    ".artifacts/product/P6/interaction-parity-report.json",
    ".artifacts/product/P6/web-baseline/request-audit.json",
    ".artifacts/product/P6/web-baseline/screenshot-export-review-loaded-1440x900.png",
    ".artifacts/product/P6/web-baseline/screenshot-export-review-loaded-900x720.png",
    ".artifacts/product/P6/web-baseline/screenshot-local-empty-1440x900.png",
    ".artifacts/product/P6/web-baseline/screenshot-mode-menu-open-1440x900.png",
    ".artifacts/product/P6/web-baseline/screenshot-local-compare-empty-1440x900.png",
    ".artifacts/product/P6/web-baseline/screenshot-invalid-1440x900.png",
    ".artifacts/product/P6/web-baseline/screenshot-settings-1440x900.png",
    ".artifacts/product/P6/web-baseline/screenshot-logs-1440x900.png",
    ".artifacts/product/P6/state-comparisons/web-local-empty.png",
    ".artifacts/product/P6/state-comparisons/desktop-local-empty.png",
    ".artifacts/product/P6/state-comparisons/web-desktop-local-empty-comparison.png",
    ".artifacts/product/P6/state-comparisons/local-empty-comparison.json",
    ".artifacts/product/P6/state-comparisons/web-export-review-loaded.png",
    ".artifacts/product/P6/state-comparisons/desktop-export-review-loaded.png",
    ".artifacts/product/P6/state-comparisons/web-desktop-export-review-loaded-comparison.png",
    ".artifacts/product/P6/state-comparisons/export-review-loaded-comparison.json",
    ".artifacts/product/P6/state-comparisons/web-invalid-error-state.png",
    ".artifacts/product/P6/state-comparisons/desktop-invalid-error-state.png",
    ".artifacts/product/P6/state-comparisons/web-desktop-invalid-error-state-comparison.png",
    ".artifacts/product/P6/state-comparisons/invalid-error-state-comparison.json",
    ".artifacts/product/P6/motion-evidence/web-motion-cardEnter-start.png",
    ".artifacts/product/P6/motion-evidence/web-motion-cardEnter-mid.png",
    ".artifacts/product/P6/motion-evidence/web-motion-cardEnter-end.png",
    ".artifacts/product/P6/motion-evidence/desktop-motion-cardEnter-start.png",
    ".artifacts/product/P6/motion-evidence/desktop-motion-cardEnter-mid.png",
    ".artifacts/product/P6/motion-evidence/desktop-motion-cardEnter-end.png",
    ".artifacts/product/P6/motion-evidence/cardEnter-motion-evidence.json",
    ".artifacts/product/P6/runtime-identity.json",
    ".artifacts/product/P6/normal-smoke-parity.json",
    ".artifacts/product/P6/desktop-state-render-proof.json",
    ".artifacts/product/P6/artifact-index.json",
    ".artifacts/product/P6/reviewer-b-evidence-request.json",
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

function stateComparison(stateId) {
  return {
    stateId,
    passed: true,
    stateSnapshotId: `snapshot-${stateId}`,
    checks: {
      webPresent: true,
      desktopPresent: true,
      bothNonBlank: true,
      notSameSourceHash: true,
      comparisonGenerated: true,
      stateSnapshotIdBound: true,
      geometryCompared: true,
      computedStyleCompared: true,
      controlValuesCompared: true,
      playbackTimeCompared: true,
      visibleRegionsCompared: true,
      pixelToleranceCompared: true,
      noUnapprovedDifferences: true
    }
  };
}

function motionEvidence(motionId) {
  return {
    motionId,
    passed: true,
    checks: {
      webStartMidEndPresent: true,
      desktopStartMidEndPresent: true,
      webFramesNotGeneric: true,
      desktopFramesNotGeneric: true,
      sameTriggerAndState: true,
      animationParamsMatched: true,
      geometryCompared: true,
      cropCompared: true,
      reducedMotionCompared: true
    }
  };
}

function strictTrace(host, fixtureSha256) {
  return {
    schemaVersion: 1,
    host,
    fixture: {
      sha256: fixtureSha256,
      displayName: "avatar_frame_basic.svga",
      sizeBytes: 107034
    },
    context: {
      viewportCss: { width: 1440, height: 900 },
      devicePixelRatio: 1,
      playbackTimeMs: 1200,
      mode: "exportReview",
      panel: "logs",
      modal: "settings",
      controls: {
        settingsButton: { visible: true, disabled: false, checked: false }
      }
    },
    actionTrace: [{
      id: "open-settings-modal",
      kind: "click",
      selector: "#settingsButton",
      initialState: "logs-open",
      expectedState: "settings-open",
      stateReached: "settings-open",
      source: host === "web" ? "browser-click" : "native-click",
      targetRect: { x: 10, y: 10, width: 44, height: 32 },
      controlValue: { visible: true, disabled: false, checked: false }
    }],
    finalStateDigest: fixtureSha256,
    visibleRegions: ["shell"],
    visibleControls: ["settingsButton"],
    screenshots: [{ stateId: "settings-open", path: `${host}-settings-open.png`, sha256: fixtureSha256 }],
    failures: []
  };
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

async function writePng(filePath, rgba) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, encode({
    width: 1,
    height: 1,
    data: Uint8Array.from(rgba),
    channels: 4
  }));
}
