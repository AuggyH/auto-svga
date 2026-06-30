import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

test("Web preview uses the shared product app and styles as thin entries", async () => {
  const [webScript, webStyles, webHtml, shellHtml, shellLoader] = await Promise.all([
    readRepoFile("tools/svga-player-preview/main.js"),
    readRepoFile("tools/svga-player-preview/styles.css"),
    readRepoFile("tools/svga-player-preview/index.html"),
    readRepoFile("tools/shared/product-frontend/product-shell.html"),
    readRepoFile("tools/shared/product-frontend/product-shell-loader.mjs")
  ]);
  const shellHash = createHash("sha256").update(shellHtml).digest("hex");

  assert.match(webScript, /mountProductShell/);
  assert.match(webScript, /product-shell-loader\.mjs/);
  assert.match(webScript, /product-app\.mjs/);
  assert.equal(webStyles.trim(), '@import url("../shared/product-frontend/product-styles.css");');
  assert.match(webHtml, /id="productShellMount"/);
  assert.match(webHtml, /data-product-shell-src="\.\.\/shared\/product-frontend\/product-shell\.html"/);
  assert.match(webHtml, new RegExp(`data-product-shell-sha256="${shellHash}"`));
  assert.doesNotMatch(webHtml, /<main class="shell"/);
  assert.match(shellHtml, /data-product-shell="canonical"/);
  assert.match(shellHtml, /id="workspace"/);
  assert.match(shellHtml, /id="floatingRoot"/);
  assert.match(shellLoader, /Product shell source hash mismatch/);
  assert.match(webHtml, /src="\.\/main\.js"/);
  assert.match(webHtml, /href="\.\/styles\.css"/);
});

test("shared product app keeps host-specific capabilities behind the Web adapter", async () => {
  const [productApp, webAdapter] = await Promise.all([
    readRepoFile("tools/shared/product-frontend/product-app.mjs"),
    readRepoFile("tools/shared/product-frontend/web-host-adapter.mjs")
  ]);

  assert.match(productApp, /getProductHostAdapter/);
  assert.match(productApp, /const fetch = hostAdapter\.http\.fetch/);
  assert.match(productApp, /const URL = hostAdapter\.urls/);
  assert.match(productApp, /const localStorage = hostAdapter\.storage/);
  assert.match(productApp, /runProductSmoke/);
  assert.match(productApp, /electronBridge\.reportSmokeResult/);
  assert.match(productApp, /if \(isSmokeMode\)/);
  assert.match(productApp, /installStateProbe/);
  assert.match(productApp, /__autoSvgaDesktopStateProbe/);
  assert.match(productApp, /resetSlotMediaState/);
  assert.match(productApp, /setSlotInvalidState/);
  assert.match(productApp, /function writeClipboardText/);
  assert.match(productApp, /electronBridge\?\.writeClipboardText/);
  assert.match(productApp, /function runOptimizedReopenProof/);
  assert.match(productApp, /function runSequenceReviewProof/);
  assert.match(productApp, /function runSequenceRepairPreviewContractProof/);
  assert.match(productApp, /function runSequenceNoWriteSimulationProof/);
  assert.match(productApp, /function runSequenceBoundedRepairPrototypeProof/);
  assert.match(productApp, /function runSequencePrototypeRenderedBoundaryProof/);
  assert.match(productApp, /function runSequenceNoopRoundTripProof/);
  assert.match(productApp, /function runSequenceByteRepairCandidateProof/);
  assert.match(productApp, /function collectCanvasRenderDigest/);
  assert.match(productApp, /\/api\/svga-image-optimize/);
  assert.match(productApp, /data-save-optimized-svga/);
  assert.match(productApp, /saveOptimizedPrimarySvga/);
  assert.match(productApp, /data-optimization-result-summary/);
  assert.match(productApp, /function renderOptimizationResultSummary/);
  assert.match(productApp, /移除未引用资源/);
  assert.match(productApp, /复用/);
  assert.match(productApp, /原文件未改/);
  assert.match(productApp, /未改帧率、时长、图层时间线与保留图片字节/);
  assert.match(productApp, /autoSvgaSourceId/);
  assert.match(productApp, /optimizedReopenProof/);
  assert.match(productApp, /sequenceReviewProof/);
  assert.match(productApp, /sequenceRepairPreviewProof/);
  assert.match(productApp, /sequenceNoWriteSimulationProof/);
  assert.match(productApp, /sequenceBoundedRepairPrototypeProof/);
  assert.match(productApp, /sequencePrototypeRenderedBoundaryProof/);
  assert.match(productApp, /sequenceNoopRoundTripProof/);
  assert.match(productApp, /sequenceByteRepairProof/);
  assert.match(productApp, /\(\(frameIndex \+ 0\.5\) \/ frameCount\) \* 100/);
  assert.match(productApp, /return result && typeof result\.then === "function" \? result\.then\(\(\) => frame\) : Promise\.resolve\(frame\)/);
  assert.match(productApp, /const sampledFrameIndex = await seekSlot/);
  assert.match(productApp, /sampledFrameIndex: beforeFrame\.sampledFrameIndex/);
  assert.match(productApp, /samplePercent: Number\(percent\.toFixed\(4\)\)/);
  assert.match(productApp, /function runReplacementReadinessProof/);
  assert.match(productApp, /function runSingleReplacementPreviewProof/);
  assert.match(productApp, /function runReplacementUndoRedoProof/);
  assert.match(productApp, /function runMultiReplacementWorkbenchProof/);
  assert.match(productApp, /function runReplacementSaveAsProof/);
  assert.match(productApp, /function replaceSvgaImageResources/);
  assert.match(productApp, /\/api\/svga-image-edit-session/);
  assert.match(productApp, /\/api\/svga-image-replace/);
  assert.match(productApp, /replacementReadinessProof/);
  assert.match(productApp, /replacementPreviewProof/);
  assert.match(productApp, /replacementUndoRedoProof/);
  assert.match(productApp, /replacementSaveAsProof/);
  assert.match(productApp, /replacementMultiResourceProof/);
  assert.match(productApp, /data-sequence-review-summary/);
  assert.match(productApp, /data-sequence-repair-preview-contract/);
  assert.match(productApp, /data-sequence-no-write-simulation/);
  assert.match(productApp, /data-sequence-bounded-repair-prototype/);
  assert.match(productApp, /优化副本/);
  assert.match(productApp, /替换图片/);
  assert.match(productApp, /修复闪帧/);
  assert.match(productApp, /function showReplaceableResources/);
  assert.match(productApp, /function handleWorkbenchOperationClick/);
  assert.doesNotMatch(productApp, /function renderWorkbenchPhaseActions/);
  assert.doesNotMatch(productApp, /class="phaseWorkflowPanel"/);
  assert.match(productApp, /data-undo-replacement-preview/);
  assert.match(productApp, /data-redo-replacement-preview/);
  assert.match(productApp, /可替换/);
  assert.match(productApp, /function setSlotErrorFeedback/);
  assert.match(webAdapter, /hostKind: "web"/);
  assert.match(webAdapter, /editorIncubationDefaultVisible: false/);
});

test("shared product shell keeps loading distinct and editor incubation hidden by default", async () => {
  const [shellHtml, productApp, productStyles, p6Capture, stateEvidence, p6Evidence] = await Promise.all([
    readRepoFile("tools/shared/product-frontend/product-shell.html"),
    readRepoFile("tools/shared/product-frontend/product-app.mjs"),
    readRepoFile("tools/shared/product-frontend/product-styles.css"),
    readRepoFile("tools/p6/p6-web-baseline-capture.cjs"),
    readRepoFile("tools/p6/runtime-scenarios/state-evidence.mjs"),
    readRepoFile("tools/p6/generate-p6-evidence.mjs")
  ]);

  assert.match(shellHtml, /class="loadingPhaseList"/);
  for (const phase of ["file", "read", "parse", "check"]) {
    assert.match(shellHtml, new RegExp(`data-loading-phase="${phase}"`));
  }
  assert.match(productApp, /applyPrimaryLoadingCopy/);
  assert.match(productApp, /正在加载 SVGA 文件/);
  assert.match(productApp, /staleCanvasCleared/);
  assert.match(productApp, /staleFileBadgeCleared/);
  assert.match(productApp, /staleReportCleared/);
  assert.match(productStyles, /\.previewCard\.isLoading \.loadingPhaseList/);
  assert.match(productStyles, /\.previewCard\.hasSlotError/);
  assert.doesNotMatch(shellHtml, /batchPngInput|loadBatchPngFiles|svga-image-edit-session/);
});

test("shared product app exposes Repair 6 product states and invalid cleanup evidence", async () => {
  const [shellHtml, productApp, productStyles, p6Capture, stateEvidence, p6Evidence] = await Promise.all([
    readRepoFile("tools/shared/product-frontend/product-shell.html"),
    readRepoFile("tools/shared/product-frontend/product-app.mjs"),
    readRepoFile("tools/shared/product-frontend/product-styles.css"),
    readRepoFile("tools/p6/p6-web-baseline-capture.cjs"),
    readRepoFile("tools/p6/runtime-scenarios/state-evidence.mjs"),
    readRepoFile("tools/p6/generate-p6-evidence.mjs")
  ]);

  for (const stateId of [
    "loading",
    "loaded",
    "playing",
    "paused",
    "mode-menu-open",
    "local-compare-empty",
    "local-compare-loaded",
    "export-review-loaded",
    "latest-artifact-loaded",
    "reference-media-loaded",
    "info-overview-open",
    "info-assets-open",
    "logs-open",
    "settings-open",
    "accessibility-toggles-on",
    "settings-closed-by-escape",
    "synchronized-playback-toggled-by-space",
    "asset-preview-modal-open",
    "recovered-from-invalid",
    "responsive-export-review-loaded-at-900-x-720"
  ]) {
    assert.match(productApp, new RegExp(stateId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const smokeScenario of [
    "desktop-loading",
    "desktop-playing",
    "desktop-paused",
    "desktop-latest-artifact-loaded",
    "desktop-reference-media-loaded",
    "desktop-invalid",
    "desktop-recovered-from-invalid",
    "desktop-optimized-reopen-proof"
  ]) {
    assert.match(productApp, new RegExp(smokeScenario));
  }

  for (const cleanupEvidence of [
    "staleMetadataCleared",
    "staleInspectionCleared",
    "staleCanvasCleared",
    "staleFileBadgeCleared",
    "staleReportCleared",
    "staleReadyBadgeCleared"
  ]) {
    assert.match(productApp, new RegExp(cleanupEvidence));
  }

  for (const runtimeFlowEvidence of [
    "runWp1StateCorrectnessFlow",
    "loadValidSvgaForStateProbe",
    "loadInvalidSvgaForStateProbe",
    "runWp2MultiSourceAcceptanceFlow",
    "loadWp2DroppedSvga",
    "collectWp2MultiSourceSnapshot",
    "usedRuntimeLoadPath",
    "directStateInjection: false",
    "invalid parser status is not error",
    "invalid render status is not error",
    "secondSvgaLoaded",
    "referenceMediaLoaded",
    "latestArtifactRuntimeLoaded",
    "secondaryClearedAfterExport",
    "referenceClearedAfterManualSource",
    "latestArtifactClearedAfterManualSource",
    "stateBefore",
    "realAction",
    "stateAfter",
    "focusOrVisibleResult"
  ]) {
    assert.match(productApp, new RegExp(runtimeFlowEvidence));
  }
  assert.match(productApp, /p6BaselineFixtureDisplayName = "p6-web-baseline-fixture\.svga"/);
  assert.match(productApp, /p6RecoveredFixtureDisplayName = "p6-web-baseline-recovered-fixture\.svga"/);
  assert.match(productApp, /displayName: p6BaselineFixtureDisplayName/);
  assert.match(productApp, /fileName: p6BaselineFixtureDisplayName/);

  for (const loadingEvidence of [
    "loadingActivePhases",
    "loadingSourceLabel",
    "primaryHeaderActionVisible",
    "loading empty CTA should be hidden",
    "loading header change-file action not visible",
    "loadingHeaderActionText"
  ]) {
    assert.match(productApp, new RegExp(loadingEvidence));
  }

  for (const productEvidence of [
    "modeMenuVisible",
    "infoPanelVisible",
    "logsPanelVisible",
    "settingsVisible",
    "assetPreviewVisible",
    "comparePanelVisible",
    "referencePanelVisible",
    "syncBarVisible",
    "statusAnnouncementText",
    "latestArtifactLoaded",
    "referenceMediaLoaded",
    "recoveredFromInvalid"
  ]) {
    assert.match(productApp, new RegExp(productEvidence));
  }

	  for (const ownerGateUsabilityEvidence of [
	    "invalid slot-local error missing",
	    "invalid error state is outside preview card",
	    "invalid error state is occluded",
	    "function clearCurrentFile",
	    "clearCurrentFileAction",
	    "previewCardSingleFileConsistency",
	    "collectPreviewCardConsistencyProof",
	    "function focusTrapRoot",
	    "function trapFocusEvent",
	    "function runOwnerUsabilitySmoke",
	    "ownerUsability",
    "sidePanelReturnFocus",
    "SVGA A invalid drop rendered slot-local unsupported-file feedback",
    "Single-file preview card carries file name, status, metadata, controls, and replacement action consistently",
    "Enter opened settings dialog and moved focus inside it",
    "Tab stayed inside settings dialog while it was active",
    "finderDocumentAssociationNotClaimed",
    "日志已复制",
    "暂无日志可复制",
    "function isInternalDiagnosticLogMessage",
    "高级诊断",
    "userFacingLogMessage(log)",
    "function collectInspectionIssues",
    "function renderDiagnosticsIssueList",
    "function elementHasVisibleHitPoint",
    "diagnosticIssueList",
    "诊断问题列表",
    "inspector actions are not visible",
    "diagnostic details are not reachable",
    "local_preview_first",
    "localPreviewPrimary",
    "resourceRowsFocusable",
    "comfortableToolbarTargets",
    "comfortableResourceActions",
    "settings modal competes with side panel",
    "settings initial scroll is not at top",
    "sequence partial proof state is not distinguishable",
    "sequence blocked proof state is not distinguishable"
  ]) {
    assert.match(productApp, new RegExp(ownerGateUsabilityEvidence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(p6Evidence, /assertLocalPreviewWorkbenchRegionMap/);
  assert.match(productApp, /aside\[data-workbench-region='source-document'\]/);
  assert.match(productApp, /collectWorkbenchLayoutIntegrity/);
  assert.match(productApp, /source_document_maps_toolbar_instead_of_left_panel/);
  assert.match(productApp, /resource_action_collision/);
  assert.match(productApp, /resource_filter_vertical_wrap/);
  assert.match(productStyles, /\.assetFilters\s*\{[\s\S]*display:\s*flex/);
  assert.match(productStyles, /\.assetFilters button\s*\{[\s\S]*white-space:\s*nowrap/);
  assert.match(productStyles, /\.sequenceToggle\s*\{[\s\S]*position:\s*static/);
  assert.match(productStyles, /\.toolbar \.iconButton\s*\{[\s\S]*min-height:\s*36px/);
  assert.match(productStyles, /\.assetUnifiedRow:focus-visible\s*\{/);
  assert.match(productStyles, /\.proofStatePill\s*\{/);
  assert.match(p6Evidence, /owner_blocking_feedback_fixed_pending_product_owner_review/);
  assert.match(p6Evidence, /productOwnerHumanGateStillRequired/);
  assert.match(p6Evidence, /Default Activity\/Logs exposed internal workflow text/);

  assert.match(productApp, /announce\(errorBox\.textContent\)/);
	  assert.match(productApp, /announce\(message\)/);
	  assert.match(productApp, /announce\("同步播放已开始"\)/);
  assert.match(productApp, /announce\("已开启本地对比"\)/);
  assert.match(p6Capture, /browserPointClick\(window, "#reduceMotionToggle"\)/);
  assert.match(p6Capture, /browserPointClick\(window, "#reduceBlurToggle"\)/);
  assert.match(p6Capture, /reduceMotionToggle"\)\?\.checked === true && document\.querySelector\("#reduceBlurToggle"\)\?\.checked === true/);
  assert.match(stateEvidence, /screenshot-accessibility-toggles-on-1440x900\.png/);
  assert.match(shellHtml, /id="statusAnnouncer" class="srOnly" aria-live="polite"/);
	  assert.match(shellHtml, /id="svgaStatusA" class="statusPill"/);
	  assert.match(shellHtml, /id="clearCurrentFileButton"/);
	  assert.match(productStyles, /\.narrowWindowHint\s*\{[\s\S]*?display: none;/);
	  assert.doesNotMatch(productApp, /\["sprite", "精灵"\]/);
	  assert.doesNotMatch(productApp, /return "SUCC"|return "INFO"/);
	  assert.doesNotMatch(shellHtml, /batchPngInput|loadBatchPngFiles|svga-image-edit-session/);
	  for (const keyframe of ["fitMenuIn", "sidePanelEnter", "tabIn", "overlayIn", "modalIn", "drawerIn", "dropdownIn"]) {
	    assert.match(productStyles, new RegExp(`@keyframes\\s+${keyframe}`));
	  }
});

test("P6-R1 owner-visible visual system target is token-driven and auditable", async () => {
  const result = spawnSync(process.execPath, ["tools/p6/visual-system-audit.mjs", "--source-only"], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stdout || result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.passed, true);
  assert.equal(summary.target, "owner_visible_macos_local_preview_workbench");
  assert.equal(summary.sourceOnly, true);
  assert.ok(summary.metrics.requiredTokenCount >= 40);
  assert.ok(summary.metrics.requiredComponentClassCount >= 10);
});

test("P6-R1 Reviewer B category request and parity runner include macOS visual-system review", async () => {
  const [p6EvidenceGenerator, parityRunner] = await Promise.all([
    readRepoFile("tools/p6/generate-p6-evidence.mjs"),
    readRepoFile("tools/p6/parity-runner.mjs")
  ]);

  assert.match(p6EvidenceGenerator, /"macosVisualSystem"/);
  assert.match(parityRunner, /"macosVisualSystem"/);
});

test("Electron default renderer uses shared product source and hides editor incubation", async () => {
  const [electronHtml, electronStyles, electronEntry, prototypeSource, shellHtml] = await Promise.all([
    readRepoFile("tools/electron-prototype/experiments/svga-web/web/index.html"),
    readRepoFile("tools/electron-prototype/experiments/svga-web/web/styles.css"),
    readRepoFile("tools/electron-prototype/experiments/svga-web/web/desktop-product-entry.mjs"),
    readRepoFile("tools/electron-prototype/experiments/svga-web/web/prototype.js"),
    readRepoFile("tools/shared/product-frontend/product-shell.html")
  ]);
  const shellHash = createHash("sha256").update(shellHtml).digest("hex");

  assert.match(electronHtml, /id="productShellMount"/);
  assert.match(electronHtml, /data-product-shell-src="\/tools\/shared\/product-frontend\/product-shell\.html"/);
  assert.match(electronHtml, new RegExp(`data-product-shell-sha256="${shellHash}"`));
  assert.doesNotMatch(electronHtml, /<main class="shell"/);
  assert.match(electronHtml, /src="\/desktop-product-entry\.mjs"/);
  assert.doesNotMatch(electronHtml, /prototype\.js/);
  assert.equal(electronStyles.trim(), '@import url("/tools/shared/product-frontend/product-styles.css");');
  assert.match(electronEntry, /mountProductShell/);
  assert.match(electronEntry, /product-shell-loader\.mjs/);
  assert.match(electronEntry, /autoSvgaHostAdapter/);
  assert.match(electronEntry, /\/tools\/shared\/product-frontend\/product-app\.mjs/);
  assert.match(electronEntry, /installSvgaWebCompatibility/);
  assert.match(prototypeSource, /loadBatchPngFiles/);
});
