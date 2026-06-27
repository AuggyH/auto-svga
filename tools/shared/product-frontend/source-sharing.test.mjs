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
  assert.match(productApp, /function setSlotErrorFeedback/);
  assert.match(webAdapter, /hostKind: "web"/);
  assert.match(webAdapter, /editorIncubationDefaultVisible: false/);
});

test("shared product shell keeps loading distinct and editor incubation hidden by default", async () => {
  const [shellHtml, productApp, productStyles, p6Capture, stateEvidence] = await Promise.all([
    readRepoFile("tools/shared/product-frontend/product-shell.html"),
    readRepoFile("tools/shared/product-frontend/product-app.mjs"),
    readRepoFile("tools/shared/product-frontend/product-styles.css"),
    readRepoFile("tools/p6/p6-web-baseline-capture.cjs"),
    readRepoFile("tools/p6/runtime-scenarios/state-evidence.mjs")
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
  const [shellHtml, productApp, productStyles, p6Capture, stateEvidence] = await Promise.all([
    readRepoFile("tools/shared/product-frontend/product-shell.html"),
    readRepoFile("tools/shared/product-frontend/product-app.mjs"),
    readRepoFile("tools/shared/product-frontend/product-styles.css"),
    readRepoFile("tools/p6/p6-web-baseline-capture.cjs"),
    readRepoFile("tools/p6/runtime-scenarios/state-evidence.mjs")
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
    "desktop-local-compare-loaded",
    "desktop-invalid",
    "desktop-recovered-from-invalid"
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
    "loading header choose button should be hidden"
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
	    "previewCardBothLoadedConsistency",
	    "collectPreviewCardConsistencyProof",
	    "function focusTrapRoot",
	    "function trapFocusEvent",
	    "function runOwnerUsabilitySmoke",
	    "ownerUsability",
    "sidePanelReturnFocus",
    "SVGA A invalid drop rendered slot-local unsupported-file feedback",
    "SVGA B invalid drop rendered slot-local unsupported-file feedback",
    "Enter opened settings dialog and moved focus inside it",
    "Tab stayed inside settings dialog while it was active",
    "finderDocumentAssociationNotClaimed",
    "日志已复制",
    "暂无日志可复制"
  ]) {
    assert.match(productApp, new RegExp(ownerGateUsabilityEvidence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

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
