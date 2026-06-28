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
import {
  buildInteractionParityReport,
  generateP6StrictRuntimeEvidence,
  strictStateComparisonPassed
} from "./runtime-scenarios/strict-evidence.mjs";
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

test("state evidence rejects invalid semantic JSON paired with visually compare-like screenshot", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "p6-invalid-compare-screenshot-"));
  try {
    const blue = [0, 0, 255, 255];
    const red = [255, 0, 0, 255];
    const green = [0, 255, 0, 255];
    await writePng(path.join(root, "web-baseline/screenshot-invalid-1440x900.png"), blue, {
      width: 10,
      height: 10,
      changedPixels: Array.from({ length: 12 }, (_, index) => ({ index, rgba: red }))
    });
    await writePng(path.join(root, "desktop-invalid.png"), blue, {
      width: 10,
      height: 10,
      changedPixels: [{ index: 0, rgba: green }]
    });
    await writePng(path.join(root, "desktop-local-compare-loaded.png"), blue, { width: 10, height: 10 });
    await writePng(path.join(root, "desktop-local-compare-empty.png"), [32, 32, 32, 255], { width: 10, height: 10 });
    const invalidSnapshot = strictWebSnapshot("invalid", "localPreview", "none", "none");
    invalidSnapshot.regions.push({
      id: "errorBox",
      selector: "#errorBox",
      present: true,
      visible: true,
      rect: { x: 10, y: 10, width: 100, height: 40 }
    });
    await mkdir(path.join(root, "web-baseline"), { recursive: true });
    await writeFile(path.join(root, "web-baseline/dom-manifest.json"), JSON.stringify({
      snapshots: [invalidSnapshot]
    }, null, 2));
    await writeFile(path.join(root, "web-baseline/computed-styles-manifest.json"), JSON.stringify({
      selectors: [{ selector: ".shell", present: true }]
    }, null, 2));
    await writeFile(path.join(root, "desktop-state-render-proof.json"), JSON.stringify({
      states: {
        invalid: {
          state: "invalid",
          observedStateId: "invalid",
          passed: true,
          viewportCss: { width: 1440, height: 900 },
          devicePixelRatio: 1,
          stageRect: { x: 0, y: 0, width: 100, height: 100 },
          canvasRect: { x: 0, y: 0, width: 0, height: 0 },
          overlayRect: { x: 10, y: 10, width: 100, height: 40 },
          overlayDisplay: "block",
          canvasZIndex: "auto",
          visibleRegions: visibleRegionsForState("invalid"),
          visibleControls: visibleControlsForState(),
          productState: { mode: "localPreview", panel: "none", modal: "none", compareActive: false },
          sourceSlots: stateSourceSlots(false),
          topLevelRuntime: {
            loadedCanvasNonBlank: false,
            overlayVisible: false,
            errorVisible: true,
            parserStatus: "error",
            renderStatus: "error",
            statusAnnouncementText: "文件类型不支持：not-svga.txt。/ Unsupported file type."
          },
          stateSemantics: stateSemanticFixture("invalid")
        }
      }
    }, null, 2));

    const result = await generateStateComparison(root, "invalid-error-state");

    assert.equal(result.runtime.invalidContextMatched, false);
    assert.equal(result.passed, false);
    assert.ok(result.failures.some((failure) => failure.includes("invalid state context mismatch")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("state evidence helper prefers exact responsive snapshot before export-review aliases", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "p6-responsive-state-evidence-"));
  try {
    await writePng(path.join(root, "web-baseline/screenshot-export-review-loaded-900x720.png"), [255, 0, 0, 255], { width: 10, height: 10 });
    await writePng(path.join(root, "desktop-responsive-export-review-loaded-at-900-x-720.png"), [255, 0, 0, 255], {
      width: 10,
      height: 10,
      changedPixel: [254, 0, 0, 255]
    });
    const responsiveState = "responsive-export-review-loaded-at-900-x-720";
    const exportSnapshot = strictWebSnapshot("export-review-loaded", "exportReview", "none", "none");
    exportSnapshot.viewport = { width: 1440, height: 900 };
    const responsiveSnapshot = strictWebSnapshot(responsiveState, "exportReview", "none", "none");
    responsiveSnapshot.observedStateId = "export-review-loaded";
    responsiveSnapshot.viewport = { width: 900, height: 720 };
    responsiveSnapshot.sourceSlots = stateSourceSlots(true);
	    responsiveSnapshot.stateSemantics = {
	      ...stateSemanticFixture(responsiveState),
	      observedStateId: "export-review-loaded",
	      latestArtifactLoaded: true,
	      referenceMediaLoaded: true
	    };
	    responsiveSnapshot.topLevelRuntime = {
	      ...responsiveSnapshot.topLevelRuntime,
	      loadedCanvasNonBlank: true,
	      overlayVisible: false,
	      errorVisible: false,
	      parserStatus: "success",
	      renderStatus: "success",
	      statusAnnouncementText: "SVGA 加载完成：avatar_frame_basic.svga"
	    };
    await mkdir(path.join(root, "web-baseline"), { recursive: true });
    await writeFile(path.join(root, "web-baseline/dom-manifest.json"), JSON.stringify({
      snapshots: [exportSnapshot, responsiveSnapshot]
    }, null, 2));
    await writeFile(path.join(root, "web-baseline/computed-styles-manifest.json"), JSON.stringify({
      selectors: [{ selector: ".shell", present: true }]
    }, null, 2));
    await writeFile(path.join(root, "desktop-state-render-proof.json"), JSON.stringify({
      states: {
        [responsiveState]: {
          state: responsiveState,
          observedStateId: "export-review-loaded",
          passed: true,
          viewportCss: { width: 900, height: 720 },
          devicePixelRatio: 1,
          stageRect: { x: 0, y: 0, width: 100, height: 100 },
          canvasRect: { x: 0, y: 0, width: 100, height: 100 },
          overlayRect: { x: 0, y: 0, width: 0, height: 0 },
	          overlayDisplay: "none",
	          canvasZIndex: "auto",
		          visibleRegions: visibleRegionsForState(responsiveState),
		          visibleControls: visibleControlsForState(),
		          productState: { mode: "exportReview", panel: "none", modal: "none", compareActive: false },
		          sourceSlots: stateSourceSlots(true),
	          topLevelRuntime: {
	            loadedCanvasNonBlank: true,
	            overlayVisible: false,
	            errorVisible: false,
	            parserStatus: "success",
	            renderStatus: "success",
	            statusAnnouncementText: "SVGA 加载完成：avatar_frame_basic.svga"
	          },
	          stateSemantics: {
            ...stateSemanticFixture(responsiveState),
            observedStateId: "export-review-loaded",
            latestArtifactLoaded: true,
            referenceMediaLoaded: true
          }
        }
      }
    }, null, 2));

    const result = await generateStateComparison(root, responsiveState);

    assert.equal(result.passed, true, result.failures.join("; "));
    assert.equal(result.context.web.viewportCss.width, 900);
    assert.equal(result.runtime.webStateId, responsiveState);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("strict Web interaction evidence rejects legacy baseline trace without direct before/action/after/result fields", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "p6-strict-interaction-"));
  try {
    const fixtureSha256 = "a".repeat(64);
    const contract = {
      baselineCommit: "c".repeat(40),
      interactions: [{
        id: "open-settings-modal",
        trigger: "click",
        selector: "#settingsButton",
        initialState: "logs-open",
        expectedState: "settings-open"
      }]
    };
    await mkdir(path.join(root, "web-baseline"), { recursive: true });
    await writeFile(path.join(root, "web-baseline/dom-manifest.json"), JSON.stringify({
      snapshots: [
        strictWebSnapshot("logs-open", "exportReview", "logs", "none"),
        strictWebSnapshot("settings-open", "exportReview", "logs", "settings")
      ]
    }, null, 2));
    await writeFile(path.join(root, "web-baseline/interaction-trace.json"), JSON.stringify({
      schemaVersion: 1,
      actionTrace: [{
        id: "open-settings-modal",
        kind: "click",
        selector: "#settingsButton",
        initialState: "logs-open",
        expectedState: "settings-open",
        stateReached: "settings-open",
        source: "web-baseline-input"
      }]
    }, null, 2));
    await writeFile(path.join(root, "web-baseline/artifact-index.json"), JSON.stringify({
      fixture: { sha256: fixtureSha256, displayName: "avatar_frame_basic.svga", sizeBytes: 10 }
    }, null, 2));
    await writeFile(path.join(root, "desktop-interaction-trace.source.json"), JSON.stringify(strictTrace("desktop", fixtureSha256), null, 2));

    const result = await generateP6StrictRuntimeEvidence({ p6Root: root, contract });

    assert.equal(result.report.passed, false, "legacy trace must not be normalized into a pass");
    const webAction = result.webTrace.actionTrace[0];
    assert.equal(webAction.stateBefore, undefined);
    assert.ok(result.report.failures.some((failure) => failure.includes("stateBefore") || failure.includes("realAction")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("strict Web interaction evidence accepts direct runtime before/action/after/result fields", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "p6-strict-interaction-direct-"));
  try {
    const fixtureSha256 = "a".repeat(64);
    const contract = {
      baselineCommit: "c".repeat(40),
      interactions: [{
        id: "open-settings-modal",
        trigger: "click",
        selector: "#settingsButton",
        initialState: "logs-open",
        expectedState: "settings-open"
      }]
    };
    await mkdir(path.join(root, "web-baseline"), { recursive: true });
    await writeFile(path.join(root, "web-baseline/dom-manifest.json"), JSON.stringify({
      snapshots: [
        strictWebSnapshot("logs-open", "exportReview", "logs", "none"),
        strictWebSnapshot("settings-open", "exportReview", "logs", "settings")
      ]
    }, null, 2));
    await writeFile(path.join(root, "web-baseline/interaction-trace.json"), JSON.stringify(strictTrace("web", fixtureSha256), null, 2));
    await writeFile(path.join(root, "web-baseline/artifact-index.json"), JSON.stringify({
      fixture: { sha256: fixtureSha256, displayName: "avatar_frame_basic.svga", sizeBytes: 10 },
      headCommit: "c".repeat(40)
    }, null, 2));
    await writeFile(path.join(root, "desktop-interaction-trace.source.json"), JSON.stringify(strictTrace("desktop", fixtureSha256), null, 2));

    const result = await generateP6StrictRuntimeEvidence({ p6Root: root, contract });

    assert.equal(result.report.passed, true, result.report.failures.join("; "));
    const webAction = result.webTrace.actionTrace[0];
    assert.equal(webAction.stateBefore.stateId, "logs-open");
    assert.equal(webAction.realAction.inputKind, "click");
    assert.equal(webAction.stateAfter.stateId, "settings-open");
    assert.equal(webAction.focusOrVisibleResult.observedState, "settings-open");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("strict state comparison accepts canonicalized Web/Desktop runtime context with equivalent visible state", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "p6-state-context-"));
  try {
    await writePng(path.join(root, "web-baseline/screenshot-local-empty-1440x900.png"), [255, 0, 0, 255], { width: 10, height: 10 });
    await writePng(path.join(root, "desktop-empty.png"), [255, 0, 0, 255], {
      width: 10,
      height: 10,
      changedPixel: [254, 0, 0, 255]
    });
    await writeFile(path.join(root, "web-baseline/dom-manifest.json"), JSON.stringify({
      snapshots: [strictWebSnapshot("local-empty", "本地预览", "info", "none")]
    }, null, 2));
    await writeFile(path.join(root, "web-baseline/computed-styles-manifest.json"), JSON.stringify({
      selectors: [{ selector: ".shell", present: true }]
    }, null, 2));
    await writeFile(path.join(root, "desktop-state-render-proof.json"), JSON.stringify({
      states: {
        empty: {
          state: "empty",
          observedStateId: "empty",
          passed: true,
          viewportCss: { width: 1440, height: 900 },
          devicePixelRatio: 1,
          stageRect: { x: 0, y: 0, width: 100, height: 100 },
          overlayRect: { x: 10, y: 10, width: 40, height: 40 },
	          overlayDisplay: "flex",
	          canvasZIndex: "auto",
	          visibleRegions: visibleRegionsForState("local-empty"),
	          visibleControls: visibleControlsForState(),
	          productState: {
	            mode: "localPreview",
	            activeSidePanel: "info",
	            activeModal: null,
	            compareActive: false
	          },
	          sourceSlots: stateSourceSlots(false),
	          topLevelRuntime: {
	            loadedCanvasNonBlank: false,
	            overlayVisible: true,
	            errorVisible: false,
	            parserStatus: "empty",
	            renderStatus: "empty",
	            statusAnnouncementText: ""
	          },
	          stateSemantics: stateSemanticFixture("empty")
        }
      }
    }, null, 2));

    const result = await generateStateComparison(root, "local-empty");

    assert.equal(result.passed, true, result.failures.join("; "));
    assert.equal(strictStateComparisonPassed(result, "local-empty"), true);
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

test("WP5 normal App proof rejects proof-only launch targets", () => {
  const facts = goodFacts();
  facts.package.normalProof.launchTarget = "proof/smoke packaged path";
  facts.package.normalProof.normalVisibleStartup.actualLaunchCommand = "npm run desktop:dev -- --p2-normal-proof";

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

  const mismatchedFixtureLabel = goodFacts();
  mismatchedFixtureLabel.desktopInteractionTrace.fixture.displayName = "other-fixture.svga";
  mismatchedFixtureLabel.interactionParityReport = buildInteractionParityReport({
    contract: mismatchedFixtureLabel.contract,
    webTrace: mismatchedFixtureLabel.webInteractionTrace,
    desktopTrace: mismatchedFixtureLabel.desktopInteractionTrace
  });
  assert.ok(mismatchedFixtureLabel.interactionParityReport.failures.includes("check failed: sameFixtureDisplayName"));
  assertItemFailed(
    buildP6ParityReportFromRuntimeFacts(mismatchedFixtureLabel),
    "interactionParity",
    "open-settings-modal",
    "strict-interaction-parity"
  );
});

test("WP3 strict interaction gates reject missing before/action/after/result/binding evidence", () => {
  for (const [caseId, mutate] of [
    ["missing_state_before", (facts) => delete facts.webInteractionTrace.actionTrace[0].stateBefore],
    ["missing_real_action", (facts) => delete facts.webInteractionTrace.actionTrace[0].realAction],
    ["missing_state_after", (facts) => delete facts.webInteractionTrace.actionTrace[0].stateAfter],
    ["missing_focus_or_visible_result", (facts) => delete facts.webInteractionTrace.actionTrace[0].focusOrVisibleResult],
    ["missing_head_binding", (facts) => delete facts.webInteractionTrace.mutationProtection.headCommit],
    ["missing_artifact_binding", (facts) => delete facts.webInteractionTrace.mutationProtection.artifactCatalogDigest],
    ["fake_target_state", (facts) => {
      facts.webInteractionTrace.actionTrace[0].stateAfter.stateId = "settings-open-forged";
      facts.webInteractionTrace.actionTrace[0].focusOrVisibleResult.observedState = "settings-open-forged";
    }],
    ["caller_injected_expected_labels", (facts) => {
      facts.webInteractionTrace.actionTrace[0].stateReached = "settings-open";
      facts.webInteractionTrace.actionTrace[0].stateProofPassed = true;
      facts.webInteractionTrace.actionTrace[0].focusOrVisibleResult.visibleResultState = "settings-open";
      facts.webInteractionTrace.actionTrace[0].focusOrVisibleResult.visibleResultPassed = true;
    }],
    ["unexecuted_action_path", (facts) => {
      facts.webInteractionTrace.actionTrace[0].realAction.trustedPath = "legacy-snapshot-derived";
    }],
    ["no_op_unrelated_background_changes", (facts) => {
      facts.webInteractionTrace.actionTrace[0].stateAfter.stateId = facts.webInteractionTrace.actionTrace[0].stateBefore.stateId;
      facts.webInteractionTrace.actionTrace[0].stateAfter.digest = "d".repeat(64);
      facts.webInteractionTrace.actionTrace[0].focusOrVisibleResult.observedState = facts.webInteractionTrace.actionTrace[0].stateBefore.stateId;
    }],
    ["unchanged_before_after_digest", (facts) => {
      facts.webInteractionTrace.actionTrace[0].stateAfter.digest = facts.webInteractionTrace.actionTrace[0].stateBefore.digest;
    }],
    ["wrong_target_rect", (facts) => {
      facts.webInteractionTrace.actionTrace[0].realAction.targetRect = { x: 10, y: 10, width: 0, height: 32 };
      facts.webInteractionTrace.actionTrace[0].targetRect = { x: 10, y: 10, width: 0, height: 32 };
    }],
    ["offscreen_or_occluded_target", (facts) => {
      facts.webInteractionTrace.actionTrace[0].realAction.viewportIntersected = false;
      facts.webInteractionTrace.actionTrace[0].realAction.occlusionPassed = false;
    }],
    ["wrong_target_receives_event", (facts) => {
      facts.webInteractionTrace.actionTrace[0].realAction.eventReceipts[0].selector = "#otherButton";
      facts.webInteractionTrace.actionTrace[0].realAction.eventReceipts[0].targetMatches = false;
    }],
    ["untrusted_dom_receipt", (facts) => {
      facts.webInteractionTrace.actionTrace[0].realAction.eventReceipts[0].isTrusted = false;
    }],
    ["missing_event_receipt", (facts) => {
      facts.webInteractionTrace.actionTrace[0].realAction.eventReceipts = [];
    }],
    ["missing_event_timestamp", (facts) => {
      delete facts.webInteractionTrace.actionTrace[0].realAction.eventTimestampMs;
      delete facts.webInteractionTrace.actionTrace[0].realAction.eventReceipts[0].timestampMs;
    }],
    ["wrong_head_binding", (facts) => {
      facts.webInteractionTrace.mutationProtection.headCommit = "0".repeat(40);
    }],
    ["reused_screenshot_path", (facts) => {
      facts.webInteractionTrace.screenshots.push({
        ...facts.webInteractionTrace.screenshots[0],
        stateId: "settings-open-reused"
      });
    }]
  ]) {
    const facts = goodFacts();
    mutate(facts);
    facts.interactionParityReport = buildInteractionParityReport({
      contract: facts.contract,
      webTrace: facts.webInteractionTrace,
      desktopTrace: facts.desktopInteractionTrace
    });
    assertItemFailed(
      buildP6ParityReportFromRuntimeFacts(facts),
      "interactionParity",
      "open-settings-modal",
      "strict-interaction-parity"
    );
    assert.equal(facts.interactionParityReport.passed, false, `${caseId} must fail the strict report`);
  }
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

test("WP1 strict state gates reject requested-label and semantic context false positives", () => {
  for (const [caseId, itemId, mutate] of [
    ["loaded_canvas_empty_overlay_visible", "export-review-loaded", (facts) => {
      facts.stateComparisons["export-review-loaded"].runtime.webSemantic.primaryOverlayVisible = true;
    }],
    ["requested_loaded_observed_unknown", "export-review-loaded", (facts) => {
      facts.stateComparisons["export-review-loaded"].runtime.webObservedStateId = "unknown";
    }],
    ["different_fixture_context", "export-review-loaded", (facts) => {
      facts.stateComparisons["export-review-loaded"].context.desktop.fixture.sha256 = "b".repeat(64);
    }],
    ["different_source_slot_context", "export-review-loaded", (facts) => {
      facts.stateComparisons["export-review-loaded"].context.desktop.sourceSlots.primary.occupied = false;
    }],
    ["missing_desktop_visible_regions", "export-review-loaded", (facts) => {
      delete facts.stateComparisons["export-review-loaded"].runtime.desktopVisibleRegions;
      delete facts.stateComparisons["export-review-loaded"].context.desktop.visibleRegions;
    }],
    ["missing_desktop_visible_controls", "export-review-loaded", (facts) => {
      delete facts.stateComparisons["export-review-loaded"].runtime.desktopVisibleControls;
      delete facts.stateComparisons["export-review-loaded"].context.desktop.visibleControls;
    }],
    ["visible_regions_diverge_without_approval", "export-review-loaded", (facts) => {
      facts.stateComparisons["export-review-loaded"].runtime.desktopVisibleRegions =
        facts.stateComparisons["export-review-loaded"].runtime.desktopVisibleRegions.filter((id) => id !== "svgaPanelA");
      facts.stateComparisons["export-review-loaded"].context.desktop.visibleRegions =
        facts.stateComparisons["export-review-loaded"].context.desktop.visibleRegions.filter((id) => id !== "svgaPanelA");
    }],
    ["visible_controls_diverge_without_machine_approval", "export-review-loaded", (facts) => {
      facts.stateComparisons["export-review-loaded"].runtime.desktopVisibleControls.push("desktop-only-toast");
      facts.stateComparisons["export-review-loaded"].context.desktop.visibleControls.push("desktop-only-toast");
    }],
    ["responsive_empty_mislabeled_loaded", "responsive-export-review-loaded-at-900-x-720", (facts) => {
      facts.stateComparisons["responsive-export-review-loaded-at-900-x-720"] = stateComparison("responsive-export-review-loaded-at-900-x-720");
      facts.stateComparisons["responsive-export-review-loaded-at-900-x-720"].runtime.webObservedStateId = "local-empty";
      facts.stateComparisons["responsive-export-review-loaded-at-900-x-720"].runtime.webSemantic.loadedCanvasNonBlank = false;
      facts.stateComparisons["responsive-export-review-loaded-at-900-x-720"].runtime.webSemantic.primaryOverlayVisible = true;
      facts.contract.states.push({ id: "responsive-export-review-loaded-at-900-x-720", required: true });
    }],
    ["stale_invalid_metadata_canvas", "invalid-error-state", (facts) => {
      facts.stateComparisons["invalid-error-state"].runtime.desktopSemantic.staleMetadataCleared = false;
      facts.stateComparisons["invalid-error-state"].runtime.desktopSemantic.staleCanvasCleared = false;
    }],
    ["invalid_missing_visible_error_region", "invalid-error-state", (facts) => {
      facts.stateComparisons["invalid-error-state"].runtime.desktopVisibleRegions =
        facts.stateComparisons["invalid-error-state"].runtime.desktopVisibleRegions.filter((id) => id !== "errorBox");
      facts.stateComparisons["invalid-error-state"].context.desktop.visibleRegions =
        facts.stateComparisons["invalid-error-state"].context.desktop.visibleRegions.filter((id) => id !== "errorBox");
    }],
    ["invalid_compare_mode_runtime", "invalid-error-state", (facts) => {
      facts.stateComparisons["invalid-error-state"].runtime.invalidContextMatched = false;
      facts.stateComparisons["invalid-error-state"].runtime.desktopProductState.compareActive = true;
      facts.stateComparisons["invalid-error-state"].context.desktop.sourceSlots.secondary.occupied = true;
      facts.stateComparisons["invalid-error-state"].context.desktop.sourceSlots.secondary.canvasNonBlank = true;
    }],
    ["invalid_error_text_diff_without_machine_approval", "invalid-error-state", (facts) => {
      facts.stateComparisons["invalid-error-state"].runtime.webSemantic.statusAnnouncementText = "SVGA 文件加载失败：incorrect header check";
      facts.stateComparisons["invalid-error-state"].runtime.desktopSemantic.statusAnnouncementText = "文件类型不支持：not-svga.txt。/ Unsupported file type.";
      facts.stateComparisons["invalid-error-state"].runtime.webTopLevel.statusAnnouncementText = "SVGA 文件加载失败：incorrect header check";
      facts.stateComparisons["invalid-error-state"].runtime.desktopTopLevel.statusAnnouncementText = "文件类型不支持：not-svga.txt。/ Unsupported file type.";
      facts.stateComparisons["invalid-error-state"].context.web.stateSemantics.statusAnnouncementText = "SVGA 文件加载失败：incorrect header check";
      facts.stateComparisons["invalid-error-state"].context.desktop.stateSemantics.statusAnnouncementText = "文件类型不支持：not-svga.txt。/ Unsupported file type.";
      facts.stateComparisons["invalid-error-state"].context.web.topLevelRuntime.statusAnnouncementText = "SVGA 文件加载失败：incorrect header check";
      facts.stateComparisons["invalid-error-state"].context.desktop.topLevelRuntime.statusAnnouncementText = "文件类型不支持：not-svga.txt。/ Unsupported file type.";
    }],
    ["latest_artifact_shell_without_semantic", "latest-artifact-loaded", (facts) => {
      facts.contract.states.push({ id: "latest-artifact-loaded", required: true });
      facts.stateComparisons["latest-artifact-loaded"] = stateComparison("latest-artifact-loaded");
      facts.stateComparisons["latest-artifact-loaded"].runtime.webSemantic.latestArtifactLoaded = false;
      facts.stateComparisons["latest-artifact-loaded"].runtime.desktopSemantic.latestArtifactLoaded = false;
      facts.stateComparisons["latest-artifact-loaded"].context.web.stateSemantics.latestArtifactLoaded = false;
      facts.stateComparisons["latest-artifact-loaded"].context.desktop.stateSemantics.latestArtifactLoaded = false;
    }],
    ["reference_media_shell_without_semantic", "reference-media-loaded", (facts) => {
      facts.contract.states.push({ id: "reference-media-loaded", required: true });
      facts.stateComparisons["reference-media-loaded"] = stateComparison("reference-media-loaded");
      facts.stateComparisons["reference-media-loaded"].runtime.webSemantic.referenceMediaLoaded = false;
      facts.stateComparisons["reference-media-loaded"].runtime.desktopSemantic.referenceMediaLoaded = false;
      facts.stateComparisons["reference-media-loaded"].context.web.stateSemantics.referenceMediaLoaded = false;
      facts.stateComparisons["reference-media-loaded"].context.desktop.stateSemantics.referenceMediaLoaded = false;
    }],
    ["playing_loaded_shell_without_playback_semantic", "playing", (facts) => {
      facts.contract.states.push({ id: "playing", required: true });
      facts.stateComparisons.playing = stateComparison("playing");
      facts.stateComparisons.playing.runtime.webObservedStateId = "loaded";
      facts.stateComparisons.playing.runtime.desktopObservedStateId = "loaded";
      facts.stateComparisons.playing.runtime.webSemantic.primaryIsPlaying = false;
      facts.stateComparisons.playing.runtime.desktopSemantic.primaryIsPlaying = false;
      facts.stateComparisons.playing.context.web.observedStateId = "loaded";
      facts.stateComparisons.playing.context.desktop.observedStateId = "loaded";
    }],
    ["paused_loaded_shell_without_playback_semantic", "paused", (facts) => {
      facts.contract.states.push({ id: "paused", required: true });
      facts.stateComparisons.paused = stateComparison("paused");
      facts.stateComparisons.paused.runtime.webObservedStateId = "loaded";
      facts.stateComparisons.paused.runtime.desktopObservedStateId = "loaded";
      facts.stateComparisons.paused.runtime.webSemantic.primaryPlaybackEvidenceState = "loaded";
      facts.stateComparisons.paused.runtime.desktopSemantic.primaryPlaybackEvidenceState = "loaded";
      facts.stateComparisons.paused.context.web.observedStateId = "loaded";
      facts.stateComparisons.paused.context.desktop.observedStateId = "loaded";
    }],
	    ["desired_state_label_only", "export-review-loaded", (facts) => {
	      delete facts.stateComparisons["export-review-loaded"].runtime;
	      delete facts.stateComparisons["export-review-loaded"].context.web.fixture;
	      delete facts.stateComparisons["export-review-loaded"].context.desktop.fixture;
	      facts.stateComparisons["export-review-loaded"].stateSnapshotId = "caller-supplied-export-review-loaded";
	    }],
	    ["recovered_stale_status_announcement", "recovered-from-invalid", (facts) => {
	      facts.contract.states.push({ id: "recovered-from-invalid", required: true });
	      facts.stateComparisons["recovered-from-invalid"] = stateComparison("recovered-from-invalid");
	      const staleText = "文件类型不支持：not-svga.txt。/ Unsupported file type.";
	      facts.stateComparisons["recovered-from-invalid"].runtime.webSemantic.statusAnnouncementText = staleText;
	      facts.stateComparisons["recovered-from-invalid"].runtime.desktopSemantic.statusAnnouncementText = staleText;
	      facts.stateComparisons["recovered-from-invalid"].runtime.webTopLevel.statusAnnouncementText = staleText;
	      facts.stateComparisons["recovered-from-invalid"].runtime.desktopTopLevel.statusAnnouncementText = staleText;
	      facts.stateComparisons["recovered-from-invalid"].context.web.stateSemantics.statusAnnouncementText = staleText;
	      facts.stateComparisons["recovered-from-invalid"].context.desktop.stateSemantics.statusAnnouncementText = staleText;
	      facts.stateComparisons["recovered-from-invalid"].context.web.topLevelRuntime.statusAnnouncementText = staleText;
	      facts.stateComparisons["recovered-from-invalid"].context.desktop.topLevelRuntime.statusAnnouncementText = staleText;
	    }],
	    ["loaded_top_level_canvas_false", "export-review-loaded", (facts) => {
	      facts.stateComparisons["export-review-loaded"].runtime.webTopLevel.loadedCanvasNonBlank = false;
	      facts.stateComparisons["export-review-loaded"].context.web.topLevelRuntime.loadedCanvasNonBlank = false;
	    }],
	    ["observed_state_mismatch_hidden_by_requested_label", "export-review-loaded", (facts) => {
	      facts.stateComparisons["export-review-loaded"].context.web.topLevelRuntime.parserStatus = "empty";
	      facts.stateComparisons["export-review-loaded"].context.web.observedStateId = "local-empty";
	    }],
	    ["pixel_tolerance_only_with_context_mismatch", "export-review-loaded", (facts) => {
	      facts.stateComparisons["export-review-loaded"].comparison.pixelDifferenceRatio = 0.15;
	      facts.stateComparisons["export-review-loaded"].checks.noUnapprovedDifferences = true;
	      facts.stateComparisons["export-review-loaded"].context.desktop.topLevelRuntime.renderStatus = "empty";
	    }],
	    ["high_pixel_tolerance_cannot_force_pass", "export-review-loaded", (facts) => {
	      facts.stateComparisons["export-review-loaded"].comparison.pixelDifferenceRatio = 0.84;
	      facts.stateComparisons["export-review-loaded"].checks.noUnapprovedDifferences = true;
	    }]
	  ]) {
    const facts = goodFacts();
    mutate(facts);
    assertItemFailed(
      buildP6ParityReportFromRuntimeFacts(facts),
      "stateParity",
      itemId,
      "web-item-runtime"
    );
  }
});

test("WP1 strict state gates accept only machine-approved host differences", () => {
  const facts = goodFacts();
  const comparison = facts.stateComparisons["invalid-error-state"];
  comparison.runtime.webSemantic.statusAnnouncementText = "SVGA 文件加载失败：incorrect header check";
  comparison.runtime.desktopSemantic.statusAnnouncementText = "文件类型不支持：not-svga.txt。/ Unsupported file type.";
  comparison.runtime.webTopLevel.statusAnnouncementText = "SVGA 文件加载失败：incorrect header check";
  comparison.runtime.desktopTopLevel.statusAnnouncementText = "文件类型不支持：not-svga.txt。/ Unsupported file type.";
  comparison.context.web.stateSemantics.statusAnnouncementText = "SVGA 文件加载失败：incorrect header check";
  comparison.context.desktop.stateSemantics.statusAnnouncementText = "文件类型不支持：not-svga.txt。/ Unsupported file type.";
  comparison.context.web.topLevelRuntime.statusAnnouncementText = "SVGA 文件加载失败：incorrect header check";
  comparison.context.desktop.topLevelRuntime.statusAnnouncementText = "文件类型不支持：not-svga.txt。/ Unsupported file type.";
  comparison.hostDifferenceReview = {
    schemaVersion: 1,
    passed: true,
    approvedDifferences: [
      {
        approved: true,
        category: "invalid_error_text",
        reasonCode: "different_invalid_fixture_cause",
        basis: "Both hosts prove local invalid state with stale data cleared."
      }
    ],
    unapprovedDifferences: []
  };
  comparison.runtime.hostDifferenceReview = comparison.hostDifferenceReview;

  assert.equal(strictStateComparisonPassed(comparison, "invalid-error-state"), true);
});

test("WP4 visual evidence rejects inconsistent viewport and zero-pixel comparison coverage", () => {
  const facts = goodFacts();
  facts.stateComparisons["export-review-loaded"].context.desktop.viewportCss = { width: 900, height: 720 };
  facts.stateComparisons["export-review-loaded"].comparison = {
    sameDimensions: false,
    comparedPixels: 0,
    changedPixels: null,
    pixelDifferenceRatio: 0
  };

  assertItemFailed(
    buildP6ParityReportFromRuntimeFacts(facts),
    "stateParity",
    "export-review-loaded",
    "web-item-runtime"
  );
});

test("Repair 6 strict motion gates reject missing trigger, crop, and reduced-motion evidence", () => {
  for (const checkId of ["sameTriggerAndState", "cropCompared", "reducedMotionCompared"]) {
    const facts = goodFacts();
    facts.motionEvidence.cardEnter.checks[checkId] = false;
    facts.motionEvidence.cardEnter.passed = false;
    assertItemFailed(buildP6ParityReportFromRuntimeFacts(facts), "motionParity", "cardEnter", "web-item-runtime");
  }
});

test("WP4 motion evidence rejects identical normal-motion start/mid/end frames", () => {
  const facts = goodFacts();
  const sameFrameHash = "a".repeat(64);
  for (const phase of ["start", "mid", "end"]) {
    facts.motionEvidence.cardEnter.phases.web[phase].sha256 = sameFrameHash;
  }
  facts.motionEvidence.cardEnter.styleSamples = {
    web: { phaseHashesChanged: true }
  };

  assertItemFailed(buildP6ParityReportFromRuntimeFacts(facts), "motionParity", "cardEnter", "web-item-runtime");
});

test("WP4 reviewer support rejects generic PASS over category review-required verdicts", () => {
  const facts = goodFacts();
  facts.desktop.reviewerBEvidenceRequest.verdict = "PASS";
  facts.desktop.reviewerBEvidenceRequest.categories[0].requiredVerdict = "HUMAN_REQUIRED";

  const report = buildP6ParityReportFromRuntimeFacts(facts);

  assertItemFailed(report, "desktopRuntimeProof", "source-electron-smoke", "reviewer-generic-pass-consistent");
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
        categoryCount: 33,
        categories: [
          "productIdentity",
          "toolbarAndModes",
          "localPreview",
          "exportReview",
          "comparison",
          "referenceMedia",
          "playbackControls",
          "fitControls",
          "synchronizedPlayback",
          "inspectionOverview",
          "assetDetails",
          "motionAssetAudit",
          "runtimeLogs",
          "settings",
          "macOSWorkbenchLayoutSystem",
          "LeftSourceResourcesIA",
          "RightInspectorActionsIA",
          "LocalPreviewPrimaryWorkflow",
          "ResponsiveRuleCoverage",
          "macosVisualSystem",
          "macOSAppFoundation",
          "RoadmapCapacity",
          "theme",
          "accessibilitySettings",
          "interactionParity",
          "motionParity",
          "emptyState",
          "loadingState",
          "invalidState",
          "responsiveLayout",
          "normalMacApp",
          "bundleCompleteness",
          "bundlePrivacy"
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
  const loaded = [
    "export-review-loaded",
    "latest-artifact-loaded",
    "reference-media-loaded",
	    "loaded",
	    "playing",
	    "paused",
	    "responsive-export-review-loaded-at-900-x-720",
	    "recovered-from-invalid"
	  ].includes(stateId);
  const invalid = stateId === "invalid-error-state" || stateId === "invalid";
  const observedStateId = stateId === "invalid-error-state" ? "invalid"
    : ["latest-artifact-loaded", "reference-media-loaded"].includes(stateId) ? "export-review-loaded"
    : stateId === "responsive-export-review-loaded-at-900-x-720" ? "export-review-loaded"
      : stateId;
  const sourceSlots = {
    primary: {
      occupied: loaded,
      fixtureSha256: loaded ? "a".repeat(64) : null,
      fileName: loaded ? "avatar_frame_basic.svga" : null,
      canvasNonBlank: loaded,
      parseStatus: invalid ? "error" : loaded ? "success" : "empty",
      renderStatus: invalid ? "error" : loaded ? "success" : "empty",
      canvasChildCount: loaded ? 1 : 0
    },
    secondary: {
      occupied: false,
      fixtureSha256: null,
      canvasNonBlank: false,
      parseStatus: "empty",
      renderStatus: "empty",
      canvasChildCount: 0
    },
    reference: {
      occupied: [
        "export-review-loaded",
        "latest-artifact-loaded",
        "reference-media-loaded",
        "responsive-export-review-loaded-at-900-x-720"
      ].includes(stateId),
      fixtureSha256: null,
      canvasNonBlank: false
    }
  };
  const stateSemantics = {
    observedStateId,
    primaryOverlayVisible: !loaded && !invalid,
    loadingVisible: false,
    errorVisible: invalid,
    loadedCanvasNonBlank: loaded,
    primaryOccupied: loaded,
    primaryParserStatus: invalid ? "error" : loaded ? "success" : "empty",
    primaryRenderStatus: invalid ? "error" : loaded ? "success" : "empty",
    primaryCanvasChildCount: loaded ? 1 : 0,
    staleMetadataCleared: !loaded,
    staleInspectionCleared: !loaded,
    staleCanvasCleared: !loaded,
    staleFileBadgeCleared: !loaded,
    primaryIsPlaying: stateId === "playing",
    primaryPlaybackEvidenceState: stateId === "playing" ? "playing" : stateId === "paused" ? "paused" : loaded ? "loaded" : null,
    latestArtifactLoaded: stateId === "latest-artifact-loaded",
    referenceMediaLoaded: stateId === "reference-media-loaded",
    statusAnnouncementText: loaded ? "SVGA 加载完成：avatar_frame_basic.svga" : ""
  };
  const topLevelRuntime = {
    loadedCanvasNonBlank: loaded,
    overlayVisible: !loaded && !invalid,
    errorVisible: invalid,
    parserStatus: stateSemantics.primaryParserStatus,
    renderStatus: stateSemantics.primaryRenderStatus,
    statusAnnouncementText: stateSemantics.statusAnnouncementText
  };
	  const hostContext = {
    viewportCss: stateId === "responsive-export-review-loaded-at-900-x-720"
      ? { width: 900, height: 720 }
      : { width: 1440, height: 900 },
    devicePixelRatio: 1,
    mode: loaded ? "exportReview" : "localPreview",
    panel: "none",
    modal: "none",
	    observedStateId,
	    visibleRegions: visibleRegionsForState(stateId),
	    visibleControls: visibleControlsForState(),
	    fixture: {
      occupied: loaded,
      sha256: loaded ? "a".repeat(64) : null,
      fileName: loaded ? "avatar_frame_basic.svga" : null
    },
    sourceSlots,
    topLevelRuntime,
    stateSemantics
  };
  return {
    stateId,
    passed: true,
    stateSnapshotId: `snapshot-${stateId}`,
    context: {
      web: structuredClone(hostContext),
      desktop: structuredClone(hostContext)
    },
	    runtime: {
      webStateId: stateId,
      desktopStateId: stateId,
      webObservedStateId: observedStateId,
      desktopObservedStateId: observedStateId,
	      webSemantic: structuredClone(stateSemantics),
	      desktopSemantic: structuredClone(stateSemantics),
	      webTopLevel: structuredClone(topLevelRuntime),
	      desktopTopLevel: structuredClone(topLevelRuntime),
	      webVisibleRegions: visibleRegionsForState(stateId),
	      desktopVisibleRegions: visibleRegionsForState(stateId),
	      webVisibleControls: visibleControlsForState(),
	      desktopVisibleControls: visibleControlsForState(),
	      desktopProductState: {
	        mode: loaded ? "exportReview" : "localPreview",
	        panel: "none",
	        modal: "none",
	        compareActive: false
	      },
	      observedStateMatched: true,
	      fixtureContextMatched: true,
	      sourceSlotContextMatched: true,
	      semanticStatePredicatesMatched: true,
	      invalidContextMatched: invalid ? true : null
	    },
    comparison: {
      sameDimensions: true,
      comparedPixels: 100,
      changedPixels: 10,
      pixelDifferenceRatio: 0.1
    },
    checks: {
      webPresent: true,
      desktopPresent: true,
      bothNonBlank: true,
      notSameSourceHash: true,
      comparisonGenerated: true,
      stateSnapshotIdBound: true,
      observedStateMatched: true,
      fixtureContextMatched: true,
      sourceSlotContextMatched: true,
      semanticStatePredicatesMatched: true,
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

function visibleRegionsForState(stateId) {
  const regions = ["shell", "toolbar", "modeControl", "workspace", "svgaPanelA"];
  if (stateId === "invalid-error-state" || stateId === "invalid") regions.push("errorBox");
  return regions;
}

function visibleControlsForState() {
  return ["modeDropdownTrigger", "infoPanelButton", "logsButton", "settingsButton"];
}

function motionEvidence(motionId) {
  return {
    motionId,
    passed: true,
    phases: {
      web: {
        start: { sha256: "a".repeat(64) },
        mid: { sha256: "b".repeat(64) },
        end: { sha256: "c".repeat(64) }
      },
      desktop: {
        start: { sha256: "d".repeat(64) },
        mid: { sha256: "e".repeat(64) },
        end: { sha256: "f".repeat(64) }
      }
    },
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
  const actionState = (stateId) => ({
    stateId,
    mode: "exportReview",
    panel: stateId.includes("logs") ? "logs" : "none",
    modal: stateId.includes("settings") ? "settings" : "none",
    visibleRegions: ["shell", "toolbar", "modeControl", "workspace", "svgaPanelA"],
    visibleControls: ["modeDropdownTrigger", "infoPanelButton", "logsButton", "settingsButton"],
    digest: stateId.includes("logs") ? "b".repeat(64) : "c".repeat(64)
  });
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
        modeDropdownTrigger: { visible: true, disabled: false, checked: false },
        infoPanelButton: { visible: true, disabled: false, checked: false },
        logsButton: { visible: true, disabled: false, checked: false },
        settingsButton: { visible: true, disabled: false, checked: false }
      }
    },
    actionTrace: [{
      id: "open-settings-modal",
      kind: "click",
      selector: "#settingsButton",
      initialState: "logs-open",
      expectedState: "settings-open",
      stateBefore: actionState("logs-open"),
      realAction: {
        inputKind: "click",
        selector: "#settingsButton",
        trustedPath: host === "web" ? "browser-click" : "native-click",
        targetVisible: true,
        targetRect: { x: 10, y: 10, width: 44, height: 32 },
        actionablePoint: { x: 32, y: 26 },
        viewportIntersected: true,
        occlusionPassed: true,
        eventTimestampMs: 123456,
        eventReceipts: [{
          type: "click",
          selector: "#settingsButton",
          targetMatches: true,
          isTrusted: true,
          timestampMs: 123456,
          performanceTimeMs: 120,
          clientX: 32,
          clientY: 26,
          key: null,
          code: null,
          targetId: "settingsButton",
          targetText: "Settings"
        }]
      },
      stateAfter: actionState("settings-open"),
      source: host === "web" ? "browser-click" : "native-click",
      targetRect: { x: 10, y: 10, width: 44, height: 32 },
      controlValue: { visible: true, disabled: false, checked: false },
      focusOrVisibleResult: {
        activeElementId: "settingsButton",
        activeElementText: "Settings",
        observedState: "settings-open",
        visibleResultText: "Settings"
      },
      stateProofFailures: []
    }],
    finalStateDigest: fixtureSha256,
    visibleRegions: ["shell", "toolbar", "modeControl", "workspace", "svgaPanelA"],
    visibleControls: ["modeDropdownTrigger", "infoPanelButton", "logsButton", "settingsButton"],
    screenshots: [{ stateId: "settings-open", path: `${host}-settings-open.png`, sha256: fixtureSha256 }],
    mutationProtection: {
      headCommit: "c".repeat(40),
      artifactCatalogDigest: fixtureSha256,
      source: `${host}-strict-interaction-fixture`
    },
    failures: []
  };
}

function stateSourceSlots(loaded) {
  return {
    primary: {
      occupied: loaded,
      fixtureSha256: loaded ? "a".repeat(64) : null,
      fileName: loaded ? "avatar_frame_basic.svga" : null,
      canvasNonBlank: loaded,
      parseStatus: loaded ? "success" : "empty",
      renderStatus: loaded ? "success" : "empty",
      canvasChildCount: loaded ? 1 : 0
    },
    secondary: {
      occupied: false,
      fixtureSha256: null,
      canvasNonBlank: false,
      parseStatus: "empty",
      renderStatus: "empty",
      canvasChildCount: 0
    },
    reference: {
      occupied: false,
      fixtureSha256: null,
      canvasNonBlank: false
    }
  };
}

function stateSemanticFixture(stateId) {
  const loaded = [
    "loaded",
    "playing",
    "paused",
	    "export-review-loaded",
	    "latest-artifact-loaded",
	    "reference-media-loaded",
	    "responsive-export-review-loaded-at-900-x-720",
	    "recovered-from-invalid"
	  ].includes(stateId);
  const invalid = stateId === "invalid" || stateId === "invalid-error-state";
  return {
    observedStateId: stateId,
    primaryOverlayVisible: !loaded && !invalid,
    loadingVisible: stateId === "loading",
    errorVisible: invalid,
    loadedCanvasNonBlank: loaded,
    primaryOccupied: loaded,
    primaryParserStatus: invalid ? "error" : loaded ? "success" : stateId === "loading" ? "loading" : "empty",
    primaryRenderStatus: invalid ? "error" : loaded ? "success" : stateId === "loading" ? "loading" : "empty",
    primaryCanvasChildCount: loaded ? 1 : 0,
    staleMetadataCleared: !loaded,
    staleInspectionCleared: !loaded,
    staleCanvasCleared: !loaded,
    staleFileBadgeCleared: !loaded,
	    primaryIsPlaying: stateId === "playing",
	    primaryPlaybackEvidenceState: stateId === "playing" ? "playing" : stateId === "paused" ? "paused" : loaded ? "loaded" : null,
	    latestArtifactLoaded: stateId === "latest-artifact-loaded",
	    referenceMediaLoaded: stateId === "reference-media-loaded",
	    statusAnnouncementText: loaded ? "SVGA 加载完成：avatar_frame_basic.svga" : ""
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

function strictWebSnapshot(stateId, mode, panel, modal) {
  const stateSemantics = stateSemanticFixture(stateId);
  return {
    stateId,
    observedStateId: stateId,
    viewport: { width: 1440, height: 900 },
    devicePixelRatio: 1,
    playbackTimeMs: 1200,
    mode,
    panel,
    modal,
    fixture: null,
    sourceSlots: stateSourceSlots(stateSemantics.primaryOccupied === true),
    topLevelRuntime: {
      loadedCanvasNonBlank: stateSemantics.loadedCanvasNonBlank,
      overlayVisible: stateSemantics.primaryOverlayVisible,
      errorVisible: stateSemantics.errorVisible,
      parserStatus: stateSemantics.primaryParserStatus,
      renderStatus: stateSemantics.primaryRenderStatus,
      statusAnnouncementText: stateSemantics.statusAnnouncementText
    },
    stateSemantics,
    bodyTextSample: `${stateId} visible`,
    regions: ["shell", "toolbar", "modeControl", "workspace", "svgaPanelA"].map((id) => ({
      id,
      selector: id === "shell" ? ".shell" : `#${id}`,
      present: true,
      visible: true,
      rect: { x: 10, y: 10, width: 100, height: 100 }
    })),
    controls: ["modeDropdownTrigger", "infoPanelButton", "logsButton", "settingsButton"].map((id, index) => ({
      id,
      visible: true,
      disabled: false,
      checked: false,
      rect: { x: 10 + index * 40, y: 10, width: 32, height: 32 }
    }))
  };
}

async function writePng(filePath, rgba, options = {}) {
  const width = options.width ?? 1;
  const height = options.height ?? 1;
  const pixelCount = width * height;
  const data = new Uint8Array(pixelCount * 4);
  for (let index = 0; index < pixelCount; index += 1) {
    data.set(rgba, index * 4);
  }
  if (options.changedPixel) data.set(options.changedPixel, 0);
  if (Array.isArray(options.changedPixels)) {
    for (const change of options.changedPixels) {
      if (!change || !Array.isArray(change.rgba) || !Number.isInteger(change.index)) continue;
      if (change.index < 0 || change.index >= pixelCount) continue;
      data.set(change.rgba, change.index * 4);
    }
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, encode({
    width,
    height,
    data,
    channels: 4
  }));
}
