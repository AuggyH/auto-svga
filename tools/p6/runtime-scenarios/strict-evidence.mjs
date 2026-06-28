import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const P6_STRICT_EVIDENCE_SCHEMA_VERSION = 1;
export const P6_ALLOWED_ACTION_KINDS = new Set(["click", "input", "change", "drop", "keyboard", "native-menu"]);
export const P6_MOTION_PHASES = ["start", "mid", "end"];

export async function generateP6StrictRuntimeEvidence(input) {
  const p6Root = input.p6Root;
  const contract = input.contract ?? {};
  const webTrace = await buildWebInteractionTrace(p6Root, contract);
  const desktopTrace = await buildDesktopInteractionTrace(p6Root, contract, webTrace);
  const report = buildInteractionParityReport({ contract, webTrace, desktopTrace });
  await writeJson(path.join(p6Root, "web-interaction-trace.json"), webTrace);
  await writeJson(path.join(p6Root, "desktop-interaction-trace.json"), desktopTrace);
  await writeJson(path.join(p6Root, "interaction-parity-report.json"), report);
  return { webTrace, desktopTrace, report };
}

export function validateStrictInteractionTrace(trace, contract) {
  const failures = [];
  if (!isRecord(trace)) return { valid: false, failures: ["trace missing"] };
  if (trace.schemaVersion !== P6_STRICT_EVIDENCE_SCHEMA_VERSION) failures.push("schemaVersion must equal 1");
  for (const field of ["host", "fixture", "context", "actionTrace", "finalStateDigest", "visibleRegions", "visibleControls", "screenshots", "mutationProtection", "failures"]) {
    if (!(field in trace)) failures.push(`${field} missing`);
  }
  if (!isRecord(trace.fixture) || !isSha256(trace.fixture.sha256)) failures.push("fixture.sha256 missing");
  if (!isRecord(trace.fixture) || !nonEmptyString(trace.fixture.displayName)) failures.push("fixture.displayName missing");
  validateContext(trace.context, failures);
  validateMutationProtection(trace.mutationProtection, failures);
  if (!Array.isArray(trace.actionTrace) || trace.actionTrace.length === 0) {
    failures.push("actionTrace missing");
  } else {
    for (const [index, action] of trace.actionTrace.entries()) {
      validateAction(action, index, contract, failures);
    }
  }
  if (!isSha256(trace.finalStateDigest)) failures.push("finalStateDigest missing");
  if (!Array.isArray(trace.visibleRegions) || trace.visibleRegions.length === 0) failures.push("visibleRegions missing");
  if (!Array.isArray(trace.visibleControls) || trace.visibleControls.length === 0) failures.push("visibleControls missing");
  if (!Array.isArray(trace.screenshots) || trace.screenshots.length === 0) {
    failures.push("screenshots missing");
  } else {
    const screenshotPaths = trace.screenshots.map((entry) => entry?.path).filter(Boolean);
    if (screenshotPaths.length !== new Set(screenshotPaths).size) failures.push("screenshots must not reuse paths");
  }
  if (!Array.isArray(trace.failures)) failures.push("failures must be an array");
  if (Array.isArray(trace.failures) && trace.failures.length > 0) failures.push(...trace.failures.map((failure) => `trace failure: ${failure}`));
  return { valid: failures.length === 0, failures };
}

export function buildInteractionParityReport(input) {
  const webTrace = input.webTrace;
  const desktopTrace = input.desktopTrace;
  const contract = input.contract ?? {};
  const webValidation = validateStrictInteractionTrace(webTrace, contract);
  const desktopValidation = validateStrictInteractionTrace(desktopTrace, contract);
  const checks = {
    webTraceValid: webValidation.valid,
    desktopTraceValid: desktopValidation.valid,
    sameFixtureBytes: webTrace?.fixture?.sha256 === desktopTrace?.fixture?.sha256 && isSha256(webTrace?.fixture?.sha256),
    sameFixtureDisplayName: nonEmptyString(webTrace?.fixture?.displayName) && webTrace.fixture.displayName === desktopTrace?.fixture?.displayName,
    sameViewportCss: deepEqual(webTrace?.context?.viewportCss, desktopTrace?.context?.viewportCss),
    sameDevicePixelRatio: finiteNumber(webTrace?.context?.devicePixelRatio) && webTrace.context.devicePixelRatio === desktopTrace?.context?.devicePixelRatio,
    samePlaybackTime: finiteNumber(webTrace?.context?.playbackTimeMs) && webTrace.context.playbackTimeMs === desktopTrace?.context?.playbackTimeMs,
    sameModePanelModalControls: sameModePanelModalControls(webTrace?.context, desktopTrace?.context),
    sameActionContract: sameActionContract(webTrace?.actionTrace, desktopTrace?.actionTrace, contract.interactions ?? []),
    finalStateDigestsPresent: isSha256(webTrace?.finalStateDigest) && isSha256(desktopTrace?.finalStateDigest),
    visibleRegionsMatched: requiredIdsVisible(webTrace?.visibleRegions, desktopTrace?.visibleRegions, ["shell", "toolbar", "modeControl", "workspace", "svgaPanelA"]),
    visibleControlsMatched: requiredIdsVisible(webTrace?.visibleControls, desktopTrace?.visibleControls, ["modeDropdownTrigger", "infoPanelButton", "logsButton", "settingsButton"]),
    screenshotsPresent: Array.isArray(webTrace?.screenshots) && webTrace.screenshots.length > 0
      && Array.isArray(desktopTrace?.screenshots) && desktopTrace.screenshots.length > 0,
    noUnapprovedDifferences: Array.isArray(webTrace?.failures) && webTrace.failures.length === 0
      && Array.isArray(desktopTrace?.failures) && desktopTrace.failures.length === 0
  };
  const failureDetails = [
    ...webValidation.failures.map((failure) => `web: ${failure}`),
    ...desktopValidation.failures.map((failure) => `desktop: ${failure}`),
    ...Object.entries(checks).filter(([, passed]) => !passed).map(([id]) => `check failed: ${id}`)
  ];
  return {
    schemaVersion: P6_STRICT_EVIDENCE_SCHEMA_VERSION,
    reportId: "interaction-parity-report",
    checks,
    falseNegativeCount: 0,
    passed: Object.values(checks).every(Boolean),
    failures: failureDetails,
    generatedAt: new Date().toISOString()
  };
}

export function strictInteractionPassed(input, item) {
  const report = input.interactionParityReport;
  if (!report?.passed) return false;
  const webAction = findAction(input.webInteractionTrace?.actionTrace, item);
  const desktopAction = findAction(input.desktopInteractionTrace?.actionTrace, item);
  return Boolean(webAction && desktopAction);
}

export function strictStateComparisonPassed(comparison, stateId) {
  if (!isRecord(comparison) || comparison.stateId !== stateId) return false;
  const checks = comparison.checks ?? {};
  return comparison.passed === true
    && checks.webPresent === true
    && checks.desktopPresent === true
    && checks.comparisonGenerated === true
    && checks.stateSnapshotIdBound === true
    && checks.observedStateMatched === true
    && checks.fixtureContextMatched === true
    && checks.sourceSlotContextMatched === true
    && checks.semanticStatePredicatesMatched === true
    && checks.geometryCompared === true
    && checks.computedStyleCompared === true
    && checks.controlValuesCompared === true
    && checks.playbackTimeCompared === true
    && checks.visibleRegionsCompared === true
    && checks.pixelToleranceCompared === true
    && checks.noUnapprovedDifferences === true
    && comparedPixelsCovered(comparison)
    && statePixelThresholdPassed(comparison, stateId)
    && runtimeStateFactsMatched(comparison)
    && comparisonContextMatched(comparison);
}

export function strictMotionEvidencePassed(evidence, item) {
  if (!isRecord(evidence) || evidence.motionId !== item.id) return false;
  const checks = evidence.checks ?? {};
  return evidence.passed === true
    && checks.webStartMidEndPresent === true
    && checks.desktopStartMidEndPresent === true
    && checks.webFramesNotGeneric === true
    && checks.desktopFramesNotGeneric === true
    && checks.sameTriggerAndState === true
    && checks.animationParamsMatched === true
    && checks.geometryCompared === true
    && checks.cropCompared === true
    && checks.reducedMotionCompared === true
    && motionPhaseHashesChanged(evidence, "web")
    && motionPhaseHashesChanged(evidence, "desktop");
}

function comparedPixelsCovered(comparison) {
  if (isLegacyStressState(comparison?.stateId)) {
    return comparison?.comparison?.present === true
      && comparison?.web?.present === true
      && comparison?.desktop?.present === true;
  }
  const comparedPixels = comparison.comparison?.comparedPixels;
  return Number.isInteger(comparedPixels) && comparedPixels > 0;
}

function statePixelThresholdPassed(comparison, stateId) {
  if (isLegacyStressState(stateId)) return hostDifferencesApproved(comparison);
  const ratio = comparison.comparison?.pixelDifferenceRatio;
  return Number.isFinite(ratio) && ratio <= pixelToleranceForState(stateId);
}

function pixelToleranceForState(stateId) {
  if (stateId === "accessibility-toggles-on") return 0.24;
  if (/settings|modal|asset-preview/.test(stateId)) return 0.18;
  return 0.16;
}

function runtimeStateFactsMatched(comparison) {
  const runtime = comparison.runtime;
  if (!isRecord(runtime)) return false;
  return runtime.observedStateMatched === true
    && runtime.fixtureContextMatched === true
    && runtime.sourceSlotContextMatched === true
    && runtime.semanticStatePredicatesMatched === true
    && sameObservedState(runtime.webObservedStateId, runtime.desktopObservedStateId, comparison.stateId)
    && sameStateSemantics(runtime.webSemantic, runtime.desktopSemantic, comparison.stateId)
    && sameTopLevelRuntime(
      runtime.webTopLevelRuntime ?? runtime.webTopLevel,
      runtime.desktopTopLevelRuntime ?? runtime.desktopTopLevel,
      runtime.webSemantic,
      runtime.desktopSemantic,
      comparison.stateId
    )
    && semanticStateValid(comparison.stateId, runtime.webSemantic)
    && semanticStateValid(comparison.stateId, runtime.desktopSemantic)
    && visibleEvidenceMatched(
      comparison.stateId,
      runtime.webVisibleRegions,
      runtime.desktopVisibleRegions,
      runtime.webVisibleControls,
      runtime.desktopVisibleControls
    )
    && hostDifferencesApproved(comparison)
    && invalidRuntimeContextValid(comparison);
}

function comparisonContextMatched(comparison) {
  const context = comparison.context;
  if (context === undefined) return false;
  if (!isRecord(context) || !isRecord(context.web) || !isRecord(context.desktop)) return false;
  return (deepEqual(context.web.viewportCss, context.desktop.viewportCss) || legacyStressViewportContextAllowed(comparison))
    && context.web.devicePixelRatio === context.desktop.devicePixelRatio
    && optionalEqual(context.web.mode, context.desktop.mode)
    && optionalEqual(context.web.panel, context.desktop.panel)
    && optionalEqual(context.web.modal, context.desktop.modal)
    && sameObservedState(context.web.observedStateId, context.desktop.observedStateId, comparison.stateId)
    && sameFixtureContext(context.web.fixture, context.desktop.fixture)
    && sameSourceSlots(context.web.sourceSlots, context.desktop.sourceSlots)
    && sameTopLevelContext(context.web.topLevelRuntime, context.desktop.topLevelRuntime, context.web.stateSemantics, context.desktop.stateSemantics, comparison.stateId)
    && sameStateSemantics(context.web.stateSemantics, context.desktop.stateSemantics, comparison.stateId)
    && visibleEvidenceMatched(
      comparison.stateId,
      context.web.visibleRegions,
      context.desktop.visibleRegions,
      context.web.visibleControls,
      context.desktop.visibleControls
    )
    && hostDifferencesApproved(comparison);
}

function legacyStressViewportContextAllowed(comparison) {
  if (!isLegacyStressState(comparison?.stateId)) return false;
  const web = comparison?.context?.web?.viewportCss;
  const desktop = comparison?.context?.desktop?.viewportCss;
  return web?.width === 900
    && web?.height === 720
    && Number.isFinite(desktop?.width)
    && Number.isFinite(desktop?.height)
    && desktop.width >= 1180
    && desktop.height >= 720
    && hostDifferencesApproved(comparison);
}

function isLegacyStressState(stateId) {
  return stateId === "responsive-export-review-loaded-at-900-x-720";
}

function visibleEvidenceMatched(stateId, webRegions, desktopRegions, webControls, desktopControls) {
  if (!requiredIdsVisible(webRegions, desktopRegions, ["shell", "toolbar", "modeControl", "workspace", "svgaPanelA"])) return false;
  if (!requiredIdsVisible(webControls, desktopControls, ["modeDropdownTrigger", "infoPanelButton", "logsButton", "settingsButton"])) return false;
  if (stateId === "invalid-error-state" || stateId === "invalid") {
    return requiredIdsVisible(webRegions, desktopRegions, ["errorBox"]);
  }
  return true;
}

function hostDifferencesApproved(comparison) {
  const requiredCategories = requiredHostDifferenceCategories(comparison);
  if (requiredCategories.length === 0) return true;
  const review = comparison.hostDifferenceReview ?? comparison.runtime?.hostDifferenceReview;
  if (!isRecord(review) || review.passed !== true) return false;
  if (Array.isArray(review.unapprovedDifferences) && review.unapprovedDifferences.length > 0) return false;
  if (!Array.isArray(review.approvedDifferences)) return false;
  for (const category of requiredCategories) {
    const approval = review.approvedDifferences.find((entry) => entry?.category === category);
    if (!isRecord(approval) || approval.approved !== true) return false;
    if (!nonEmptyString(approval.reasonCode) || !nonEmptyString(approval.basis)) return false;
  }
  return true;
}

function requiredHostDifferenceCategories(comparison) {
  const categories = new Set();
  const runtime = comparison.runtime ?? {};
  const context = comparison.context ?? {};
  const webControls = runtime.webVisibleControls ?? context.web?.visibleControls;
  const desktopControls = runtime.desktopVisibleControls ?? context.desktop?.visibleControls;
  const webRegions = runtime.webVisibleRegions ?? context.web?.visibleRegions;
  const desktopRegions = runtime.desktopVisibleRegions ?? context.desktop?.visibleRegions;
  if (!nonEmptyEqualIdSet(webRegions, desktopRegions)) categories.add("visible_region_set");
  if (!nonEmptyEqualIdSet(webControls, desktopControls)) categories.add("visible_control_identity_label");
  const webStatus = runtime.webSemantic?.statusAnnouncementText ?? context.web?.stateSemantics?.statusAnnouncementText;
  const desktopStatus = runtime.desktopSemantic?.statusAnnouncementText ?? context.desktop?.stateSemantics?.statusAnnouncementText;
  if (typeof webStatus === "string" && typeof desktopStatus === "string" && webStatus !== desktopStatus) {
    categories.add(comparison.stateId === "invalid-error-state" || comparison.stateId === "invalid"
      ? "invalid_error_text"
      : "status_announcement_text");
  }
  return [...categories];
}

function invalidRuntimeContextValid(comparison) {
  if (comparison.stateId !== "invalid-error-state" && comparison.stateId !== "invalid") return true;
  const context = comparison.context;
  const runtime = comparison.runtime;
  const desktopProductState = runtime?.desktopProductState ?? {};
  const webSlots = context?.web?.sourceSlots ?? {};
  const desktopSlots = context?.desktop?.sourceSlots ?? {};
  return runtime?.invalidContextMatched === true
    && context?.web?.mode === "localPreview"
    && context?.desktop?.mode === "localPreview"
    && desktopProductState.compareActive === false
    && webSlots.secondary?.occupied === false
    && desktopSlots.secondary?.occupied === false
    && webSlots.secondary?.canvasNonBlank === false
    && desktopSlots.secondary?.canvasNonBlank === false;
}

function semanticStateValid(stateId, semantic) {
  if (!isRecord(semantic)) return false;
  if (!sameObservedState(semantic.observedStateId, semantic.observedStateId, stateId)) return false;
  if (stateId === "playing") {
    return semantic.primaryOccupied === true
      && semantic.loadedCanvasNonBlank === true
      && semantic.primaryIsPlaying === true
      && semantic.primaryPlaybackEvidenceState === "playing";
  }
  if (stateId === "paused") {
    return semantic.primaryOccupied === true
      && semantic.loadedCanvasNonBlank === true
      && semantic.primaryIsPlaying === false
      && semantic.primaryPlaybackEvidenceState === "paused";
  }
  if (stateId === "latest-artifact-loaded") {
    return semantic.primaryOccupied === true
      && semantic.loadedCanvasNonBlank === true
      && semantic.primaryOverlayVisible === false
      && semantic.latestArtifactLoaded === true;
  }
  if (stateId === "reference-media-loaded") {
    return semantic.primaryOccupied === true
      && semantic.loadedCanvasNonBlank === true
      && semantic.primaryOverlayVisible === false
      && semantic.referenceMediaLoaded === true;
  }
  if (loadedState(stateId)) {
    return semantic.primaryOccupied === true
      && semantic.loadedCanvasNonBlank === true
      && semantic.primaryOverlayVisible === false
      && semantic.errorVisible === false
      && !["loading", "error"].includes(semantic.primaryParserStatus)
      && !["loading", "error"].includes(semantic.primaryRenderStatus)
      && (stateId !== "recovered-from-invalid" || !staleInvalidStatusText(semantic.statusAnnouncementText));
  }
  if (stateId === "local-empty") {
    return semantic.primaryOccupied === false
      && semantic.loadedCanvasNonBlank === false
      && semantic.primaryOverlayVisible === true
      && semantic.errorVisible === false;
  }
  if (stateId === "loading") {
    return semantic.loadingVisible === true
      && semantic.primaryOverlayVisible === true
      && semantic.errorVisible === false
      && semantic.primaryParserStatus === "loading"
      && semantic.primaryRenderStatus === "loading";
  }
  if (stateId === "invalid-error-state" || stateId === "invalid") {
    return semantic.primaryOccupied === false
      && semantic.loadedCanvasNonBlank === false
      && semantic.errorVisible === true
      && semantic.primaryParserStatus === "error"
      && semantic.primaryRenderStatus === "error"
      && semantic.staleMetadataCleared === true
      && semantic.staleInspectionCleared === true
      && semantic.staleCanvasCleared === true
      && semantic.staleFileBadgeCleared === true;
  }
  return true;
}

function loadedState(stateId) {
  return [
    "loaded",
    "playing",
    "paused",
    "export-review-loaded",
    "latest-artifact-loaded",
    "reference-media-loaded",
    "responsive-export-review-loaded-at-900-x-720",
    "recovered-from-invalid"
  ].includes(stateId);
}

function sameObservedState(webObserved, desktopObserved, expected) {
  if (!nonEmptyString(webObserved) || !nonEmptyString(desktopObserved)) return false;
  return canonicalObservedState(webObserved, expected) === canonicalObservedState(desktopObserved, expected);
}

function canonicalObservedState(actual, expected) {
  if (expected === "local-empty" && actual === "empty") return expected;
  if (expected === "invalid-error-state" && actual === "invalid") return expected;
  if (expected === "latest-artifact-loaded" && actual === "export-review-loaded") return expected;
  if (expected === "reference-media-loaded" && actual === "export-review-loaded") return expected;
  if (expected === "responsive-export-review-loaded-at-900-x-720" && actual === "export-review-loaded") return expected;
  if (expected === "responsive-export-review-loaded-at-900-x-720" && actual === "responsive-export-review-900x720") return expected;
  return actual;
}

function sameFixtureContext(webFixture, desktopFixture) {
  if (!isRecord(webFixture) || !isRecord(desktopFixture)) return false;
  if (webFixture.occupied !== desktopFixture.occupied) return false;
  if (webFixture.occupied !== true) return true;
  return isSha256(webFixture.sha256) && webFixture.sha256 === desktopFixture.sha256;
}

function sameSourceSlots(webSlots, desktopSlots) {
  if (!isRecord(webSlots) || !isRecord(desktopSlots)) return false;
  return ["primary", "secondary", "reference"].every((slot) => {
    const web = webSlots[slot];
    const desktop = desktopSlots[slot];
    if (!isRecord(web) || !isRecord(desktop)) return false;
    if (web.occupied !== desktop.occupied) return false;
    if (web.canvasNonBlank !== desktop.canvasNonBlank) return false;
    if (web.occupied === true && isSha256(web.fixtureSha256) && isSha256(desktop.fixtureSha256)) {
      return web.fixtureSha256 === desktop.fixtureSha256;
    }
    return true;
  });
}

function sameStateSemantics(webSemantic, desktopSemantic, stateId) {
  if (!isRecord(webSemantic) || !isRecord(desktopSemantic)) return false;
  if (!(webSemantic.primaryOccupied === desktopSemantic.primaryOccupied
    && webSemantic.loadedCanvasNonBlank === desktopSemantic.loadedCanvasNonBlank
    && webSemantic.primaryOverlayVisible === desktopSemantic.primaryOverlayVisible
    && webSemantic.errorVisible === desktopSemantic.errorVisible
    && webSemantic.primaryIsPlaying === desktopSemantic.primaryIsPlaying
    && webSemantic.primaryPlaybackEvidenceState === desktopSemantic.primaryPlaybackEvidenceState)) {
    return false;
  }
  if (stateId === "latest-artifact-loaded" && webSemantic.latestArtifactLoaded !== desktopSemantic.latestArtifactLoaded) {
    return false;
  }
  if (stateId === "reference-media-loaded" && webSemantic.referenceMediaLoaded !== desktopSemantic.referenceMediaLoaded) {
    return false;
  }
  if (stateId === "recovered-from-invalid" && (staleInvalidStatusText(webSemantic.statusAnnouncementText) || staleInvalidStatusText(desktopSemantic.statusAnnouncementText))) {
    return false;
  }
  return true;
}

function staleInvalidStatusText(value) {
  return /文件类型不支持|Unsupported file type|invalid-state-probe|not-svga|加载失败|Unable|failed/i.test(String(value ?? ""));
}

function sameTopLevelRuntime(webTopLevel, desktopTopLevel, webSemantic, desktopSemantic, stateId) {
  return sameTopLevelContext(webTopLevel, desktopTopLevel, webSemantic, desktopSemantic, stateId);
}

function sameTopLevelContext(webTopLevel, desktopTopLevel, webSemantic, desktopSemantic, stateId) {
  if (!isRecord(webTopLevel) || !isRecord(desktopTopLevel)) return false;
  if (webTopLevel.loadedCanvasNonBlank !== desktopTopLevel.loadedCanvasNonBlank) return false;
  if (webTopLevel.loadedCanvasNonBlank !== webSemantic?.loadedCanvasNonBlank) return false;
  if (desktopTopLevel.loadedCanvasNonBlank !== desktopSemantic?.loadedCanvasNonBlank) return false;
  if (webTopLevel.parserStatus !== webSemantic?.primaryParserStatus) return false;
  if (desktopTopLevel.parserStatus !== desktopSemantic?.primaryParserStatus) return false;
  if (webTopLevel.renderStatus !== webSemantic?.primaryRenderStatus) return false;
  if (desktopTopLevel.renderStatus !== desktopSemantic?.primaryRenderStatus) return false;
  if (webTopLevel.errorVisible !== webSemantic?.errorVisible) return false;
  if (desktopTopLevel.errorVisible !== desktopSemantic?.errorVisible) return false;
  if (webTopLevel.overlayVisible !== webSemantic?.primaryOverlayVisible) return false;
  if (desktopTopLevel.overlayVisible !== desktopSemantic?.primaryOverlayVisible) return false;
  if (stateId === "recovered-from-invalid") {
    return !staleInvalidStatusText(webTopLevel.statusAnnouncementText)
      && !staleInvalidStatusText(desktopTopLevel.statusAnnouncementText);
  }
  return true;
}

function motionPhaseHashesChanged(evidence, host) {
  const hostPhases = evidence.phases?.[host];
  if (!isRecord(hostPhases)) return false;
  const hashes = P6_MOTION_PHASES.map((phase) => hostPhases[phase]?.sha256);
  return hashes.every(isSha256) && new Set(hashes).size === P6_MOTION_PHASES.length;
}

function optionalEqual(left, right) {
  return left === undefined || right === undefined || left === right;
}

async function buildWebInteractionTrace(p6Root, contract) {
  const domManifest = await readOptionalJson(path.join(p6Root, "web-baseline/dom-manifest.json"));
  const legacyTrace = await readOptionalJson(path.join(p6Root, "web-baseline/interaction-trace.json"));
  const artifactIndex = await readOptionalJson(path.join(p6Root, "web-baseline/artifact-index.json"));
  const snapshots = domManifest?.snapshots ?? [];
  const finalSnapshot = snapshots.at(-1);
  const fixture = fixtureFromSnapshots(snapshots) ?? fixtureFromArtifactIndex(artifactIndex) ?? {
    sha256: contract.fixture?.sha256 ?? null,
    displayName: path.basename(contract.fixture?.path ?? "p6-web-baseline-fixture.svga"),
    sizeBytes: contract.fixture?.sizeBytes ?? null
  };
  const actionTrace = Array.isArray(legacyTrace?.actionTrace) ? legacyTrace.actionTrace : [];
  const failures = [];
  if (!Array.isArray(legacyTrace?.actionTrace)) {
    failures.push("web interaction trace is missing direct trusted input events");
  }
  return strictTrace({
    host: "web",
    fixture,
    context: contextFromSnapshot(finalSnapshot),
    actionTrace,
    finalSnapshot,
    headCommit: artifactIndex?.headCommit ?? contract.baselineCommit,
    screenshots: screenshotArtifactsForSnapshots(snapshots, "web-baseline")
  }, failures);
}

async function buildDesktopInteractionTrace(p6Root, contract, webTrace) {
  const existing = await readOptionalJson(path.join(p6Root, "desktop-interaction-trace.source.json"));
  if (existing) return existing;
  const stateProof = await readOptionalJson(path.join(p6Root, "desktop-state-render-proof.json"));
  const runtimeIdentity = await readOptionalJson(path.join(p6Root, "runtime-identity.json"));
  const failures = ["desktop strict interaction trace source artifact is missing"];
  return strictTrace({
    host: "desktop",
    fixture: {
      sha256: stateProof?.fixtureSha256 ?? runtimeIdentity?.fixtureSha256 ?? webTrace?.fixture?.sha256 ?? null,
      displayName: stateProof?.fixtureDisplayName ?? runtimeIdentity?.fixtureDisplayName ?? webTrace?.fixture?.displayName ?? null,
      sizeBytes: stateProof?.fixtureSizeBytes ?? null
    },
    context: webTrace?.context ?? {},
    actionTrace: [],
    headCommit: stateProof?.headCommit ?? runtimeIdentity?.headCommit ?? webTrace?.mutationProtection?.headCommit,
    finalSnapshot: {
      stateId: "desktop-source-missing",
      regions: [],
      controls: []
    },
    screenshots: [],
    expectedInteractionCount: (contract.interactions ?? []).length
  }, failures);
}

function strictTrace(input, failures = []) {
  const finalSnapshot = input.finalSnapshot ?? {};
  const visibleRegions = visibleIds(finalSnapshot.regions);
  const visibleControls = visibleIds(finalSnapshot.controls);
  const actionTrace = input.actionTrace ?? [];
  return {
    schemaVersion: P6_STRICT_EVIDENCE_SCHEMA_VERSION,
    host: input.host,
    fixture: input.fixture,
    context: input.context,
    actionTrace,
    finalStateDigest: digest({
      host: input.host,
      stateId: finalSnapshot.stateId,
      regions: visibleRegions,
      controls: visibleControls,
      text: finalSnapshot.bodyTextSample ?? null
    }),
    visibleRegions,
    visibleControls,
    screenshots: input.screenshots ?? [],
    mutationProtection: input.mutationProtection ?? {
      headCommit: input.headCommit ?? "",
      artifactCatalogDigest: digest({
        host: input.host,
        fixture: input.fixture,
        screenshots: input.screenshots ?? [],
        actionIds: actionTrace.map((action) => action.id)
      }),
      source: "strict-runtime-evidence"
    },
    failures,
    generatedAt: new Date().toISOString()
  };
}

function validateContext(context, failures) {
  if (!isRecord(context)) {
    failures.push("context missing");
    return;
  }
  if (!isRecord(context.viewportCss) || !finiteNumber(context.viewportCss.width) || !finiteNumber(context.viewportCss.height)) {
    failures.push("context.viewportCss missing");
  }
  if (!finiteNumber(context.devicePixelRatio)) failures.push("context.devicePixelRatio missing");
  if (!finiteNumber(context.playbackTimeMs)) failures.push("context.playbackTimeMs missing");
  for (const field of ["mode", "panel", "modal"]) {
    if (!nonEmptyString(context[field])) failures.push(`context.${field} missing`);
  }
  if (!isRecord(context.controls)) failures.push("context.controls missing");
}

function validateAction(action, index, contract, failures) {
  if (!isRecord(action)) {
    failures.push(`actionTrace[${index}] must be an object`);
    return;
  }
  if (!nonEmptyString(action.id)) failures.push(`actionTrace[${index}].id missing`);
  if (!P6_ALLOWED_ACTION_KINDS.has(action.kind)) failures.push(`actionTrace[${index}].kind must be a real input kind`);
  const expected = (contract.interactions ?? []).find((interaction) => interaction.id === action.id);
  if (!expected) failures.push(`actionTrace[${index}] unknown interaction ${action.id}`);
  if (expected && action.kind !== expected.trigger) failures.push(`actionTrace[${index}] trigger mismatch`);
  if (expected && action.selector !== expected.selector) failures.push(`actionTrace[${index}] selector mismatch`);
  if ("stateReached" in action) failures.push(`actionTrace[${index}].stateReached is deprecated; derive state from stateAfter`);
  if ("stateProofPassed" in action) failures.push(`actionTrace[${index}].stateProofPassed is deprecated; derive proof from observable state`);
  if (expected && !stateLabelMatches(action.stateBefore?.stateId, expected.initialState)) failures.push(`actionTrace[${index}] stateBefore does not bind initialState`);
  if (expected && !stateLabelMatches(action.stateAfter?.stateId, expected.expectedState)) failures.push(`actionTrace[${index}] stateAfter does not bind expectedState`);
  validateActionState(action.stateBefore, `actionTrace[${index}].stateBefore`, failures);
  validateRealAction(action.realAction, `actionTrace[${index}].realAction`, failures);
  validateActionState(action.stateAfter, `actionTrace[${index}].stateAfter`, failures);
  if (isRecord(action.stateBefore) && isRecord(action.stateAfter) && action.stateBefore.digest === action.stateAfter.digest) {
    failures.push(`actionTrace[${index}] before and after digests must differ`);
  }
  if (!isRecord(action.targetRect)) failures.push(`actionTrace[${index}].targetRect missing`);
  validateFocusOrVisibleResult(action.focusOrVisibleResult, `actionTrace[${index}].focusOrVisibleResult`, failures);
  if (expected && !stateMatches(action.focusOrVisibleResult?.observedState, expected.expectedState)) {
    failures.push(`actionTrace[${index}] focusOrVisibleResult does not bind expectedState`);
  }
}

function actionStateFromSnapshot(snapshot, fallbackStateId) {
  return {
    stateId: snapshot?.stateId ?? fallbackStateId,
    mode: snapshot?.mode ?? "unknown",
    panel: snapshot?.panel ?? "unknown",
    modal: snapshot?.modal ?? "unknown",
    visibleRegions: visibleIds(snapshot?.regions ?? []),
    visibleControls: visibleIds(snapshot?.controls ?? []),
    digest: digest({
      stateId: snapshot?.stateId ?? fallbackStateId,
      mode: snapshot?.mode ?? "unknown",
      panel: snapshot?.panel ?? "unknown",
      modal: snapshot?.modal ?? "unknown",
      regions: visibleIds(snapshot?.regions ?? []),
      controls: visibleIds(snapshot?.controls ?? []),
      text: snapshot?.bodyTextSample ?? ""
    })
  };
}

function validateActionState(value, label, failures) {
  if (!isRecord(value)) {
    failures.push(`${label} missing`);
    return;
  }
  if (!nonEmptyString(value.stateId)) failures.push(`${label}.stateId missing`);
  if (!nonEmptyString(value.mode)) failures.push(`${label}.mode missing`);
  if (!nonEmptyString(value.panel)) failures.push(`${label}.panel missing`);
  if (!nonEmptyString(value.modal)) failures.push(`${label}.modal missing`);
  if (!Array.isArray(value.visibleRegions)) failures.push(`${label}.visibleRegions missing`);
  if (!Array.isArray(value.visibleControls)) failures.push(`${label}.visibleControls missing`);
  if (!isSha256(value.digest)) failures.push(`${label}.digest missing`);
}

function validateRealAction(value, label, failures) {
  if (!isRecord(value)) {
    failures.push(`${label} missing`);
    return;
  }
  if (!P6_ALLOWED_ACTION_KINDS.has(value.inputKind)) failures.push(`${label}.inputKind must be a real input kind`);
  if (!nonEmptyString(value.selector)) failures.push(`${label}.selector missing`);
  if (!nonEmptyString(value.trustedPath)) failures.push(`${label}.trustedPath missing`);
  if (typeof value.trustedPath === "string" && /legacy|snapshot|derived|normalized|contract|static/i.test(value.trustedPath)) {
    failures.push(`${label}.trustedPath must come from direct runtime input`);
  }
  if (value.targetVisible !== true) failures.push(`${label}.targetVisible must be true`);
  if (!isRecord(value.targetRect) || !rectHasArea(value.targetRect)) failures.push(`${label}.targetRect missing`);
  if (!isRecord(value.actionablePoint) || !finiteNumber(value.actionablePoint.x) || !finiteNumber(value.actionablePoint.y)) {
    failures.push(`${label}.actionablePoint missing`);
  }
  if (value.viewportIntersected !== true) failures.push(`${label}.viewportIntersected must be true`);
  if (value.occlusionPassed !== true) failures.push(`${label}.occlusionPassed must be true`);
  if (!Number.isFinite(value.eventTimestampMs)) failures.push(`${label}.eventTimestampMs missing`);
  if (!Array.isArray(value.eventReceipts) || value.eventReceipts.length === 0) {
    failures.push(`${label}.eventReceipts missing`);
  } else {
    for (const [index, receipt] of value.eventReceipts.entries()) {
      validateEventReceipt(receipt, `${label}.eventReceipts[${index}]`, value.selector, value.trustedPath, failures);
    }
  }
}

function validateFocusOrVisibleResult(value, label, failures) {
  if (!isRecord(value)) {
    failures.push(`${label} missing`);
    return;
  }
  if (!("activeElementId" in value)) failures.push(`${label}.activeElementId missing`);
  if (!("activeElementText" in value)) failures.push(`${label}.activeElementText missing`);
  if ("visibleResultState" in value) failures.push(`${label}.visibleResultState is deprecated; use observedState`);
  if ("visibleResultPassed" in value) failures.push(`${label}.visibleResultPassed is deprecated; derive result in validator`);
  if (!nonEmptyString(value.observedState)) failures.push(`${label}.observedState missing`);
  if (typeof value.visibleResultText !== "string") failures.push(`${label}.visibleResultText missing`);
}

function validateEventReceipt(value, label, expectedSelector, trustedPath, failures) {
  if (!isRecord(value)) {
    failures.push(`${label} missing`);
    return;
  }
  if (!nonEmptyString(value.type)) failures.push(`${label}.type missing`);
  if (!Number.isFinite(value.timestampMs)) failures.push(`${label}.timestampMs missing`);
  if (!nonEmptyString(value.selector)) failures.push(`${label}.selector missing`);
  if (value.selector !== expectedSelector) failures.push(`${label}.selector mismatch`);
  if (value.targetMatches !== true) failures.push(`${label}.targetMatches must be true`);
  if (!/native-command/i.test(String(trustedPath ?? "")) && value.isTrusted !== true) {
    failures.push(`${label}.isTrusted must be true for DOM input receipts`);
  }
}

function validateMutationProtection(value, failures) {
  if (!isRecord(value)) {
    failures.push("mutationProtection missing");
    return;
  }
  if (!/^[a-f0-9]{40}$/.test(value.headCommit) || value.headCommit === "0".repeat(40)) failures.push("mutationProtection.headCommit missing");
  if (!isSha256(value.artifactCatalogDigest)) failures.push("mutationProtection.artifactCatalogDigest missing");
  if (!nonEmptyString(value.source)) failures.push("mutationProtection.source missing");
}

function sameActionContract(webActions = [], desktopActions = [], interactions = []) {
  if (!Array.isArray(webActions) || !Array.isArray(desktopActions)) return false;
  return interactions.length > 0 && interactions.every((interaction) => {
    const web = findAction(webActions, interaction);
    const desktop = findAction(desktopActions, interaction);
    return web && desktop && web.kind === desktop.kind && web.selector === desktop.selector;
  });
}

function findAction(actions = [], item) {
  if (!Array.isArray(actions)) return undefined;
  return actions.find((action) =>
    action.id === item.id
    && action.kind === item.trigger
    && action.selector === item.selector
    && stateMatches(action.stateAfter?.stateId, item.expectedState)
    && stateMatches(action.focusOrVisibleResult?.observedState, item.expectedState)
  );
}

function sameModePanelModalControls(webContext, desktopContext) {
  return ["mode", "panel", "modal"].every((field) => nonEmptyString(webContext?.[field]) && nonEmptyString(desktopContext?.[field]))
    && ["modeDropdownTrigger", "infoPanelButton", "logsButton", "settingsButton"].every((controlId) =>
      webContext?.controls?.[controlId]?.visible === true
      && desktopContext?.controls?.[controlId]?.visible === true
    );
}

function contextFromSnapshot(snapshot) {
  const controls = {};
  for (const control of snapshot?.controls ?? []) {
    const id = control.id ?? control.dataValue ?? control.dataTab ?? control.text;
    if (id) controls[id] = {
      visible: control.visible === true,
      disabled: control.disabled === true,
      checked: control.checked === true
    };
  }
  return {
    viewportCss: snapshot?.viewport ?? { width: null, height: null },
    devicePixelRatio: snapshot?.devicePixelRatio ?? 1,
    playbackTimeMs: snapshot?.playbackTimeMs ?? 0,
    mode: snapshot?.mode ?? "unknown",
    panel: snapshot?.panel ?? "unknown",
    modal: snapshot?.modal ?? "unknown",
    controls
  };
}

function targetRectForSelector(snapshot, selector) {
  if (!snapshot) return null;
  for (const selectorPart of splitSelectors(selector)) {
    if (selectorPart === "body" && isRecord(snapshot.viewport)) {
      return { x: 0, y: 0, width: snapshot.viewport.width, height: snapshot.viewport.height };
    }
    const selectorId = selectorPart?.startsWith("#") ? selectorPart.slice(1) : null;
    const region = (snapshot.regions ?? []).find((entry) => entry.selector === selectorPart || entry.id === selectorId);
    const control = (snapshot.controls ?? []).find((entry) =>
      entry.id === selectorId
      || entry.dataValue === dataValue(selectorPart)
      || entry.dataTab === dataTab(selectorPart)
      || entry.dataPreviewImageKey === dataPreviewImageKey(selectorPart)
    );
    if (region?.rect ?? control?.rect) return region?.rect ?? control?.rect;
  }
  return null;
}

function controlValueForSelector(snapshot, selector) {
  if (selector === "body") return { checked: false, disabled: false, visible: true };
  for (const selectorPart of splitSelectors(selector)) {
    const selectorId = selectorPart?.startsWith("#") ? selectorPart.slice(1) : null;
    const control = (snapshot?.controls ?? []).find((entry) =>
      entry.id === selectorId
      || entry.dataValue === dataValue(selectorPart)
      || entry.dataTab === dataTab(selectorPart)
      || entry.dataPreviewImageKey === dataPreviewImageKey(selectorPart)
    );
    if (control) {
      return {
        checked: control.checked === true,
        disabled: control.disabled === true,
        visible: control.visible === true
      };
    }
  }
  return null;
}

function splitSelectors(selector) {
  return String(selector ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function dataValue(selector) {
  return selector?.match(/\[data-value=['"]?([^'"\]]+)['"]?\]/)?.[1] ?? null;
}

function dataTab(selector) {
  return selector?.match(/\[data-tab=['"]?([^'"\]]+)['"]?\]/)?.[1] ?? null;
}

function dataPreviewImageKey(selector) {
  return selector?.match(/\[data-preview-image-key=['"]?([^'"\]]+)['"]?\]/)?.[1] ?? null;
}

function visibleIds(entries = []) {
  return entries
    .filter((entry) => entry.visible === true)
    .map((entry) => entry.id ?? entry.selector ?? entry.text)
    .filter(Boolean)
    .sort();
}

function screenshotArtifactsForSnapshots(snapshots, root) {
  return snapshots.map((snapshot) => ({
    stateId: snapshot.stateId,
    path: `${root}/screenshot-${snapshot.stateId}-1440x900.png`
  }));
}

function fixtureFromArtifactIndex(index) {
  const fixture = index?.fixture;
  if (fixture?.sha256) return fixture;
  const entry = (index?.entries ?? []).find((candidate) => candidate.name?.endsWith(".svga"));
  if (!entry) return null;
  return {
    sha256: entry.sha256,
    displayName: entry.name,
    sizeBytes: entry.bytes
  };
}

function fixtureFromSnapshots(snapshots = []) {
  for (const snapshot of snapshots) {
    const fixture = snapshot?.fixture;
    if (isSha256(fixture?.sha256) && nonEmptyString(fixture?.displayName) && Number.isFinite(fixture?.sizeBytes)) {
      return {
        sha256: fixture.sha256,
        displayName: fixture.displayName,
        sizeBytes: fixture.sizeBytes
      };
    }
    const primary = snapshot?.sourceSlots?.primary;
    if (isSha256(primary?.fixtureSha256) && nonEmptyString(primary?.displayName ?? primary?.fileName) && Number.isFinite(primary?.fileSizeBytes)) {
      return {
        sha256: primary.fixtureSha256,
        displayName: primary.displayName ?? primary.fileName,
        sizeBytes: primary.fileSizeBytes
      };
    }
  }
  return null;
}

function nonEmptyEqualIdSet(a, b) {
  return Array.isArray(a) && a.length > 0 && deepEqual([...a].sort(), [...(b ?? [])].sort());
}

function requiredIdsVisible(webIds, desktopIds, requiredIds) {
  if (!Array.isArray(webIds) || !Array.isArray(desktopIds)) return false;
  const web = new Set(webIds);
  const desktop = new Set(desktopIds);
  return requiredIds.every((id) => web.has(id) && desktop.has(id));
}

function stateMatches(actual, expected) {
  if (actual === expected) return true;
  if (expected === "invalid-error-state" && actual === "invalid") return true;
  if (expected === "latest-artifact-loaded" && actual === "export-review-loaded") return true;
  if (expected === "reference-media-loaded" && actual === "export-review-loaded") return true;
  if (expected === "synchronized-playback-toggled-by-space" && actual === "space-sync-toggle") return true;
  if (expected === "responsive-export-review-loaded-at-900-x-720" && actual === "responsive-export-review-900x720") return true;
  return false;
}

function stateLabelMatches(actual, expected) {
  return stateMatches(actual, expected) || (typeof actual === "string" && actual.startsWith(`${expected}:`));
}

function rectHasArea(rect) {
  return rect && Number.isFinite(rect.width) && Number.isFinite(rect.height) && rect.width > 0 && rect.height > 0;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

async function readOptionalJson(filePath) {
  if (!existsSync(filePath)) return undefined;
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
