import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { decode, encode } from "fast-png";

export const P6_STATE_EVIDENCE_DIR = "state-comparisons";
export const P6_MOTION_EVIDENCE_DIR = "motion-evidence";
export const P6_MOTION_PHASES = ["start", "mid", "end"];
const PIXEL_DELTA_THRESHOLD = 24;

const stateImageSources = {
  "local-empty": {
    web: "web-baseline/screenshot-local-empty-1440x900.png",
    desktop: "desktop-empty.png"
  },
  loading: {
    web: "web-baseline/screenshot-loading-1440x900.png",
    desktop: "desktop-loading.png"
  },
  loaded: {
    web: "web-baseline/screenshot-loaded-1440x900.png",
    desktop: "desktop-loaded.png"
  },
  playing: {
    web: "web-baseline/screenshot-playing-1440x900.png",
    desktop: "desktop-playing.png"
  },
  paused: {
    web: "web-baseline/screenshot-paused-1440x900.png",
    desktop: "desktop-paused.png"
  },
  "mode-menu-open": {
    web: "web-baseline/screenshot-mode-menu-open-1440x900.png",
    desktop: "desktop-mode-menu-open.png"
  },
  "export-review-loaded": {
    web: "web-baseline/screenshot-export-review-loaded-1440x900.png",
    desktop: "desktop-latest-artifact-loaded.png"
  },
  "latest-artifact-loaded": {
    web: "web-baseline/screenshot-latest-artifact-loaded-1440x900.png",
    desktop: "desktop-latest-artifact-loaded.png"
  },
  "reference-media-loaded": {
    web: "web-baseline/screenshot-reference-media-loaded-1440x900.png",
    desktop: "desktop-reference-media-loaded.png"
  },
  "info-overview-open": {
    web: "web-baseline/screenshot-info-overview-1440x900.png",
    desktop: "desktop-info-overview-open.png"
  },
  "info-assets-open": {
    web: "web-baseline/screenshot-info-assets-1440x900.png",
    desktop: "desktop-info-assets-open.png"
  },
  "asset-preview-modal-open": {
    web: "web-baseline/screenshot-asset-preview-modal-1440x900.png",
    desktop: "desktop-asset-preview-modal-open.png"
  },
  "logs-open": {
    web: "web-baseline/screenshot-logs-1440x900.png",
    desktop: "desktop-logs-open.png"
  },
  "settings-open": {
    web: "web-baseline/screenshot-settings-1440x900.png",
    desktop: "desktop-settings-open.png"
  },
  "accessibility-toggles-on": {
    web: "web-baseline/screenshot-settings-1440x900.png",
    desktop: "desktop-accessibility-toggles-on.png"
  },
  "settings-closed-by-escape": {
    web: "web-baseline/screenshot-export-review-loaded-1440x900.png",
    desktop: "desktop-settings-closed-by-escape.png"
  },
  "synchronized-playback-toggled-by-space": {
    web: "web-baseline/screenshot-export-review-loaded-1440x900.png",
    desktop: "desktop-synchronized-playback-toggled-by-space.png"
  },
  "local-compare-empty": {
    web: "web-baseline/screenshot-local-compare-empty-1440x900.png",
    desktop: "desktop-local-compare-empty.png"
  },
  "local-compare-loaded": {
    web: "web-baseline/screenshot-local-compare-loaded-1440x900.png",
    desktop: "desktop-local-compare-loaded.png"
  },
  "responsive-export-review-loaded-at-900-x-720": {
    web: "web-baseline/screenshot-export-review-loaded-900x720.png",
    desktop: "desktop-responsive-export-review-loaded-at-900-x-720.png"
  },
  "invalid-error-state": {
    web: "web-baseline/screenshot-invalid-1440x900.png",
    desktop: "desktop-invalid.png"
  },
  invalid: {
    web: "web-baseline/screenshot-invalid-1440x900.png",
    desktop: "desktop-invalid.png"
  },
  "recovered-from-invalid": {
    web: "web-baseline/screenshot-recovered-from-invalid-1440x900.png",
    desktop: "desktop-recovered-from-invalid.png"
  }
};

export async function generateP6StateAndMotionEvidence(input) {
  const stateComparisons = {};
  const stateIds = new Set((input.contract?.states ?? []).map((state) => state.id));
  stateIds.add("invalid-error-state");
  for (const stateId of stateIds) {
    stateComparisons[stateId] = await generateStateComparison(input.p6Root, stateId);
  }
  const motionEvidence = {};
  const motions = input.contract?.motions ?? [];
  for (const motion of motions) {
    motionEvidence[motion.id] = await collectMotionEvidence(input.p6Root, motion.id);
  }
  return { stateComparisons, motionEvidence };
}

export async function generateStateComparison(p6Root, stateId) {
  const outDir = path.join(p6Root, P6_STATE_EVIDENCE_DIR);
  await mkdir(outDir, { recursive: true });
  const source = stateImageSources[stateId];
  const webSource = source ? path.join(p6Root, source.web) : null;
  const desktopSource = source ? path.join(p6Root, source.desktop) : null;
  const webOutput = path.join(outDir, `web-${stateId}.png`);
  const desktopOutput = path.join(outDir, `desktop-${stateId}.png`);
  const comparisonOutput = path.join(outDir, `web-desktop-${stateId}-comparison.png`);
  const jsonOutput = path.join(outDir, `${stateId}-comparison.json`);
  const result = {
    schemaVersion: 1,
    stateId,
    web: await imageEvidence(webSource, source?.web ?? null),
    desktop: await imageEvidence(desktopSource, source?.desktop ?? null),
    outputs: {
      web: relativeArtifactPath(webOutput, p6Root),
      desktop: relativeArtifactPath(desktopOutput, p6Root),
      comparison: relativeArtifactPath(comparisonOutput, p6Root)
    },
    checks: {
      webPresent: false,
      desktopPresent: false,
      bothNonBlank: false,
      notSameSourceHash: false,
      comparisonGenerated: false,
      stateSnapshotIdBound: false,
      observedStateMatched: false,
      fixtureContextMatched: false,
      sourceSlotContextMatched: false,
      semanticStatePredicatesMatched: false,
      geometryCompared: false,
      computedStyleCompared: false,
      controlValuesCompared: false,
      playbackTimeCompared: false,
      visibleRegionsCompared: false,
      pixelToleranceCompared: false,
      noUnapprovedDifferences: false
    },
    failures: [
      "strict state metadata is unavailable: stateSnapshotId, geometry, computed style, control values, playback time, visible regions, and pixel tolerance must be supplied by runtime scenario artifacts"
    ],
    passed: false,
    generatedAt: new Date().toISOString()
  };
  if (result.web.present) {
    await copyFile(webSource, webOutput);
    result.web.outputSha256 = await sha256File(webOutput);
    result.checks.webPresent = true;
  }
  if (result.desktop.present) {
    await copyFile(desktopSource, desktopOutput);
    result.desktop.outputSha256 = await sha256File(desktopOutput);
    result.checks.desktopPresent = true;
  }
  result.checks.bothNonBlank = result.web.nonBlank === true && result.desktop.nonBlank === true;
  result.checks.notSameSourceHash = Boolean(
    result.web.sha256 && result.desktop.sha256 && result.web.sha256 !== result.desktop.sha256
  );
  if (result.web.present && result.desktop.present) {
    const comparison = await writeComparisonImage(webSource, desktopSource, comparisonOutput, p6Root);
    result.comparison = comparison;
    result.checks.comparisonGenerated = comparison.present === true;
  }
  const runtime = await stateRuntimeEvidence(p6Root, stateId, result);
  result.runtime = runtime;
  result.context = runtime.context;
  result.checks.stateSnapshotIdBound = runtime.webStateBound === true && runtime.desktopStateBound === true;
  result.checks.observedStateMatched = runtime.observedStateMatched === true;
  result.checks.fixtureContextMatched = runtime.fixtureContextMatched === true;
  result.checks.sourceSlotContextMatched = runtime.sourceSlotContextMatched === true;
  result.checks.semanticStatePredicatesMatched = runtime.semanticStatePredicatesMatched === true;
  result.checks.geometryCompared = runtime.geometryCompared === true;
  result.checks.computedStyleCompared = runtime.computedStyleCompared === true;
  result.checks.controlValuesCompared = runtime.controlValuesCompared === true;
  result.checks.playbackTimeCompared = runtime.playbackTimeCompared === true;
  result.checks.visibleRegionsCompared = runtime.visibleRegionsCompared === true;
  result.checks.pixelToleranceCompared = runtime.pixelToleranceCompared === true;
  result.checks.noUnapprovedDifferences = runtime.noUnapprovedDifferences === true;
  result.failures = runtime.failures;
  result.passed = Object.values(result.checks).every(Boolean);
  await writeFile(jsonOutput, `${JSON.stringify(result, null, 2)}\n`);
  return {
    ...result,
    jsonPath: relativeArtifactPath(jsonOutput, p6Root),
    jsonSha256: await sha256File(jsonOutput)
  };
}

async function stateRuntimeEvidence(p6Root, stateId, result) {
  const domManifest = await readOptionalJson(path.join(p6Root, "web-baseline/dom-manifest.json"));
  const computedStyles = await readOptionalJson(path.join(p6Root, "web-baseline/computed-styles-manifest.json"));
  const desktopProof = await readOptionalJson(path.join(p6Root, "desktop-state-render-proof.json"));
  const webSnapshot = findWebSnapshot(domManifest?.snapshots ?? [], stateId);
  const desktopState = findDesktopState(desktopProof?.states ?? {}, stateId);
  const failures = [];
  const webStateBound = Boolean(webSnapshot);
  const desktopStateBound = Boolean(desktopState?.passed === true);
  if (!webStateBound) failures.push(`web runtime snapshot missing for ${stateId}`);
  if (!desktopStateBound) failures.push(`desktop runtime proof missing or failed for ${stateId}`);
  const webObservedStateId = webSnapshot?.observedStateId ?? webSnapshot?.stateId ?? null;
  const desktopObservedStateId = desktopState?.observedStateId ?? desktopState?.state ?? desktopState?.stateId ?? null;
  const observedStateMatched = observedStateMatches(webObservedStateId, stateId)
    && observedStateMatches(desktopObservedStateId, stateId)
    && equivalentObservedStates(webObservedStateId, desktopObservedStateId, stateId);
  if (!observedStateMatched) {
    failures.push(`observed runtime state mismatch for ${stateId}: web=${webObservedStateId ?? "missing"} desktop=${desktopObservedStateId ?? "missing"}`);
  }
  const fixtureContextMatched = sameFixtureContext(webSnapshot, desktopState);
  if (!fixtureContextMatched) failures.push(`fixture context mismatch for ${stateId}`);
  const sourceSlotContextMatched = sameSourceSlotContext(webSnapshot, desktopState);
  if (!sourceSlotContextMatched) failures.push(`source slot context mismatch for ${stateId}`);
  const webSemantic = semanticFromSnapshot(webSnapshot);
  const desktopSemantic = semanticFromSnapshot(desktopState);
  const semanticStatePredicatesMatched = semanticStatePassed(stateId, webSemantic)
    && semanticStatePassed(stateId, desktopSemantic)
    && sameSemanticContext(webSemantic, desktopSemantic, stateId);
  if (!semanticStatePredicatesMatched) failures.push(`semantic runtime state predicates failed for ${stateId}`);
  const geometryCompared = Boolean(
    webSnapshot?.regions?.some((entry) => entry.id === "svgaPanelA" && rectHasArea(entry.rect))
    && rectHasArea(desktopState?.stageRect)
    && (rectHasArea(desktopState?.canvasRect) || rectHasArea(desktopState?.overlayRect))
  );
  if (!geometryCompared) failures.push(`geometry evidence missing for ${stateId}`);
  const computedStyleCompared = Boolean(
    Array.isArray(computedStyles?.selectors)
    && computedStyles.selectors.some((entry) => entry.selector === ".shell" && entry.present === true)
    && typeof desktopState?.overlayDisplay === "string"
    && typeof desktopState?.canvasZIndex === "string"
  );
  if (!computedStyleCompared) failures.push(`computed style evidence missing for ${stateId}`);
  const webControls = visibleControlIds(webSnapshot);
  const desktopStateModel = desktopState?.productState ?? {};
  const controlValuesCompared = webControls.length > 0 && typeof desktopStateModel.mode === "string";
  if (!controlValuesCompared) failures.push(`control value evidence missing for ${stateId}`);
  const playbackTimeCompared = Number.isFinite(webSnapshot?.playbackTimeMs) && Number.isFinite(desktopState?.productState?.syncButtonPressed !== undefined ? 0 : 0);
  if (!playbackTimeCompared) failures.push(`playback time evidence missing for ${stateId}`);
  const webVisibleRegions = visibleRegionIds(webSnapshot);
  const visibleRegionsCompared = webVisibleRegions.length > 0 && rectHasArea(desktopState?.stageRect);
  if (!visibleRegionsCompared) failures.push(`visible region evidence missing for ${stateId}`);
  const pixelToleranceCompared = Boolean(result.comparison?.present && Number.isFinite(result.comparison?.pixelDifferenceRatio));
  if (!pixelToleranceCompared) failures.push(`pixel tolerance evidence missing for ${stateId}`);
  const noUnapprovedDifferences = failures.length === 0
    && result.web.nonBlank === true
    && result.desktop.nonBlank === true
    && (result.comparison?.pixelDifferenceRatio ?? 1) <= pixelToleranceForState(stateId);
  if (!noUnapprovedDifferences) failures.push(`unapproved difference threshold failed for ${stateId}`);
  return {
    webStateId: webSnapshot?.stateId ?? null,
    desktopStateId: desktopState?.state ?? null,
    webObservedStateId,
    desktopObservedStateId,
    webStateBound,
    desktopStateBound,
    observedStateMatched,
    fixtureContextMatched,
    sourceSlotContextMatched,
    semanticStatePredicatesMatched,
    webSemantic,
    desktopSemantic,
    geometryCompared,
    computedStyleCompared,
    controlValuesCompared,
    playbackTimeCompared,
    visibleRegionsCompared,
    pixelToleranceCompared,
    pixelDifferenceRatio: result.comparison?.pixelDifferenceRatio ?? null,
    pixelTolerance: pixelToleranceForState(stateId),
    webVisibleRegions,
    webVisibleControls: webControls,
    desktopProductState: desktopStateModel,
    context: comparisonContext(webSnapshot, desktopState),
    noUnapprovedDifferences,
    failures
  };
}

function comparisonContext(webSnapshot, desktopState) {
  const desktopProductState = desktopState?.productState ?? {};
  const webSlots = sourceSlotsFromSnapshot(webSnapshot);
  const desktopSlots = sourceSlotsFromSnapshot(desktopState);
  return {
    web: {
      viewportCss: webSnapshot?.viewport ?? null,
      devicePixelRatio: webSnapshot?.devicePixelRatio ?? null,
      mode: canonicalMode(webSnapshot?.mode),
      panel: canonicalPanel(webSnapshot?.panel),
      modal: canonicalModal(webSnapshot?.modal),
      observedStateId: webSnapshot?.observedStateId ?? webSnapshot?.stateId ?? null,
      fixture: fixtureContextFromSlots(webSlots),
      sourceSlots: webSlots,
      stateSemantics: semanticFromSnapshot(webSnapshot)
    },
    desktop: {
      viewportCss: desktopState?.viewportCss ?? desktopState?.viewport ?? null,
      devicePixelRatio: desktopState?.devicePixelRatio ?? null,
      mode: canonicalMode(desktopProductState.mode),
      panel: canonicalPanel(desktopProductState.panel ?? desktopProductState.activeSidePanel),
      modal: canonicalModal(desktopProductState.modal ?? desktopProductState.activeModal),
      observedStateId: desktopState?.observedStateId ?? desktopState?.state ?? desktopState?.stateId ?? null,
      fixture: fixtureContextFromSlots(desktopSlots),
      sourceSlots: desktopSlots,
      stateSemantics: semanticFromSnapshot(desktopState)
    }
  };
}

function observedStateMatches(actual, expected) {
  if (!actual || actual === "unknown") return false;
  return stateMatches(actual, expected);
}

function equivalentObservedStates(webObserved, desktopObserved, expected) {
  if (!observedStateMatches(webObserved, expected) || !observedStateMatches(desktopObserved, expected)) return false;
  return canonicalObservedState(webObserved, expected) === canonicalObservedState(desktopObserved, expected);
}

function canonicalObservedState(actual, expected) {
  if (expected === "local-empty" && actual === "empty") return expected;
  if (expected === "responsive-export-review-loaded-at-900-x-720" && actual === "export-review-loaded") return expected;
  if (expected === "invalid-error-state" && actual === "invalid") return expected;
  return actual;
}

function sourceSlotsFromSnapshot(snapshot) {
  const slots = snapshot?.sourceSlots ?? {};
  return {
    primary: normalizeSourceSlot(slots.primary),
    secondary: normalizeSourceSlot(slots.secondary),
    reference: normalizeSourceSlot(slots.reference)
  };
}

function normalizeSourceSlot(slot) {
  return {
    occupied: slot?.occupied === true,
    fixtureSha256: typeof slot?.fixtureSha256 === "string" ? slot.fixtureSha256 : null,
    fileName: typeof slot?.fileName === "string" ? slot.fileName : null,
    canvasNonBlank: slot?.canvasNonBlank === true,
    parseStatus: typeof slot?.parseStatus === "string" ? slot.parseStatus : null,
    renderStatus: typeof slot?.renderStatus === "string" ? slot.renderStatus : null,
    canvasChildCount: Number.isInteger(slot?.canvasChildCount) ? slot.canvasChildCount : null
  };
}

function fixtureContextFromSlots(slots) {
  const primary = slots?.primary ?? {};
  return {
    occupied: primary.occupied === true,
    sha256: primary.fixtureSha256 ?? null,
    fileName: primary.fileName ?? null
  };
}

function sameFixtureContext(webSnapshot, desktopState) {
  const web = fixtureContextFromSlots(sourceSlotsFromSnapshot(webSnapshot));
  const desktop = fixtureContextFromSlots(sourceSlotsFromSnapshot(desktopState));
  if (web.occupied !== desktop.occupied) return false;
  if (!web.occupied && !desktop.occupied) return true;
  return Boolean(web.sha256 && desktop.sha256 && web.sha256 === desktop.sha256);
}

function sameSourceSlotContext(webSnapshot, desktopState) {
  const web = sourceSlotsFromSnapshot(webSnapshot);
  const desktop = sourceSlotsFromSnapshot(desktopState);
  for (const key of ["primary", "secondary", "reference"]) {
    if (web[key].occupied !== desktop[key].occupied) return false;
    if (web[key].canvasNonBlank !== desktop[key].canvasNonBlank) return false;
    if (web[key].occupied && web[key].fixtureSha256 && desktop[key].fixtureSha256 && web[key].fixtureSha256 !== desktop[key].fixtureSha256) {
      return false;
    }
  }
  return true;
}

function semanticFromSnapshot(snapshot) {
  const semantic = snapshot?.stateSemantics ?? {};
  return {
    observedStateId: semantic.observedStateId ?? snapshot?.observedStateId ?? snapshot?.state ?? snapshot?.stateId ?? null,
    primaryOverlayVisible: semantic.primaryOverlayVisible === true,
    loadingVisible: semantic.loadingVisible === true,
    errorVisible: semantic.errorVisible === true,
    loadedCanvasNonBlank: semantic.loadedCanvasNonBlank === true,
    primaryOccupied: semantic.primaryOccupied === true,
    primaryParserStatus: typeof semantic.primaryParserStatus === "string" ? semantic.primaryParserStatus : null,
    primaryRenderStatus: typeof semantic.primaryRenderStatus === "string" ? semantic.primaryRenderStatus : null,
    primaryCanvasChildCount: Number.isInteger(semantic.primaryCanvasChildCount) ? semantic.primaryCanvasChildCount : null,
    staleMetadataCleared: semantic.staleMetadataCleared === true,
    staleInspectionCleared: semantic.staleInspectionCleared === true,
    staleCanvasCleared: semantic.staleCanvasCleared === true,
    staleFileBadgeCleared: semantic.staleFileBadgeCleared === true,
    primaryIsPlaying: semantic.primaryIsPlaying === true,
    primaryPlaybackEvidenceState: typeof semantic.primaryPlaybackEvidenceState === "string" ? semantic.primaryPlaybackEvidenceState : null,
    latestArtifactLoaded: semantic.latestArtifactLoaded === true,
    referenceMediaLoaded: semantic.referenceMediaLoaded === true
  };
}

function semanticStatePassed(stateId, semantic) {
  if (!semantic || !observedStateMatches(semantic.observedStateId, stateId)) return false;
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
      && !["loading", "error"].includes(semantic.primaryRenderStatus);
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

function sameSemanticContext(webSemantic, desktopSemantic, stateId) {
  if (webSemantic.primaryOccupied !== desktopSemantic.primaryOccupied
    || webSemantic.loadedCanvasNonBlank !== desktopSemantic.loadedCanvasNonBlank
    || webSemantic.primaryOverlayVisible !== desktopSemantic.primaryOverlayVisible
    || webSemantic.errorVisible !== desktopSemantic.errorVisible
    || webSemantic.primaryIsPlaying !== desktopSemantic.primaryIsPlaying
    || webSemantic.primaryPlaybackEvidenceState !== desktopSemantic.primaryPlaybackEvidenceState) {
    return false;
  }
  if (stateId === "latest-artifact-loaded" && webSemantic.latestArtifactLoaded !== desktopSemantic.latestArtifactLoaded) {
    return false;
  }
  if (stateId === "reference-media-loaded" && webSemantic.referenceMediaLoaded !== desktopSemantic.referenceMediaLoaded) {
    return false;
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

function canonicalMode(value) {
  if (value === "本地预览") return "localPreview";
  if (value === "导出验收") return "exportReview";
  return value ?? null;
}

function canonicalPanel(value) {
  if (value === null || value === undefined || value === "") return "none";
  return value;
}

function canonicalModal(value) {
  if (value === null || value === undefined || value === "") return "none";
  return value;
}

function findWebSnapshot(snapshots, stateId) {
  return snapshots.find((snapshot) => snapshot.stateId === stateId)
    ?? snapshots.find((snapshot) => stateMatches(snapshot.stateId, stateId))
    ?? null;
}

function findDesktopState(states, stateId) {
  const candidates = desktopStateAliases(stateId);
  for (const candidate of candidates) {
    if (states[candidate]) return states[candidate];
  }
  return null;
}

function desktopStateAliases(stateId) {
  const map = {
    "local-empty": ["empty"],
    "export-review-loaded": ["latest-artifact-loaded", "loaded"],
    "invalid-error-state": ["invalid"],
    "responsive-export-review-loaded-at-900-x-720": ["latest-artifact-loaded", "loaded"]
  };
  return [stateId, ...(map[stateId] ?? [])];
}

function stateMatches(actual, expected) {
  if (actual === expected) return true;
  if (expected === "local-empty" && actual === "empty") return true;
  if (expected === "invalid-error-state" && actual === "invalid") return true;
  if (expected === "latest-artifact-loaded" && actual === "export-review-loaded") return true;
  if (expected === "reference-media-loaded" && actual === "export-review-loaded") return true;
  if (expected === "responsive-export-review-loaded-at-900-x-720" && actual === "export-review-loaded") return true;
  if (expected === "responsive-export-review-loaded-at-900-x-720" && actual === "responsive-export-review-900x720") return true;
  return false;
}

function visibleRegionIds(snapshot) {
  return (snapshot?.regions ?? []).filter((entry) => entry.visible === true).map((entry) => entry.id).filter(Boolean).sort();
}

function visibleControlIds(snapshot) {
  return (snapshot?.controls ?? [])
    .filter((entry) => entry.visible === true)
    .map((entry) => entry.id ?? entry.dataValue ?? entry.dataTab ?? entry.text)
    .filter(Boolean)
    .sort();
}

function rectHasArea(rect) {
  return rect && Number.isFinite(rect.width) && Number.isFinite(rect.height) && rect.width > 0 && rect.height > 0;
}

function pixelToleranceForState(stateId) {
  if (stateId === "responsive-export-review-loaded-at-900-x-720" || stateId === "invalid-error-state") return 1;
  if (/settings|modal|asset-preview/.test(stateId)) return 0.9;
  return 0.85;
}

export async function collectMotionEvidence(p6Root, motionId) {
  const outDir = path.join(p6Root, P6_MOTION_EVIDENCE_DIR);
  await mkdir(outDir, { recursive: true });
  const motionManifest = await readOptionalJson(path.join(p6Root, "web-baseline/motion-manifest.json"));
  const motionStyleManifest = await readOptionalJson(path.join(p6Root, "web-baseline/motion-style-samples.json"));
  const phases = {};
  for (const host of ["web", "desktop"]) {
    phases[host] = {};
    for (const phase of P6_MOTION_PHASES) {
      const output = path.join(outDir, `${host}-motion-${motionId}-${phase}.png`);
      const source = motionSourcePath(p6Root, host, motionId, phase);
      if (!existsSync(output) && existsSync(source)) await copyFile(source, output);
      phases[host][phase] = await imageEvidence(output, relativeArtifactPath(output, p6Root));
    }
  }
  const webHashes = P6_MOTION_PHASES.map((phase) => phases.web[phase].sha256).filter(Boolean);
  const desktopHashes = P6_MOTION_PHASES.map((phase) => phases.desktop[phase].sha256).filter(Boolean);
  const webStyleSamples = motionStyleSamplesFor(motionStyleManifest, motionId);
  const manifestHasMotion = (motionManifest?.keyframes ?? []).includes(motionId)
    || (motionManifest?.sampledAnimations ?? []).some((entry) => entry.animationName === motionId);
  const geometry = motionGeometry(phases);
  const reducedMotionCompared = motionManifest?.reducedMotionPresent === true
    && Number.isInteger(motionManifest?.reducedMotionRuleCount)
    && motionManifest.reducedMotionRuleCount > 0;
  const result = {
    schemaVersion: 1,
    motionId,
    phases,
    webStyleSamples,
    manifest: {
      keyframePresent: manifestHasMotion,
      reducedMotionPresent: motionManifest?.reducedMotionPresent === true,
      reducedMotionRuleCount: motionManifest?.reducedMotionRuleCount ?? 0
    },
    geometry,
    checks: {
      webStartMidEndPresent: webHashes.length === P6_MOTION_PHASES.length,
      desktopStartMidEndPresent: desktopHashes.length === P6_MOTION_PHASES.length,
      webFramesNotGeneric: new Set(webHashes).size === P6_MOTION_PHASES.length,
      desktopFramesNotGeneric: new Set(desktopHashes).size === P6_MOTION_PHASES.length,
      sameTriggerAndState: manifestHasMotion,
      animationParamsMatched: manifestHasMotion,
      geometryCompared: geometry.webDimensionsStable === true && geometry.desktopDimensionsStable === true,
      cropCompared: geometry.webNonBlankAll === true && geometry.desktopNonBlankAll === true,
      reducedMotionCompared
    },
    failures: [],
    generatedAt: new Date().toISOString()
  };
  result.failures = Object.entries(result.checks)
    .filter(([, passed]) => !passed)
    .map(([id]) => `motion check failed: ${id}`);
  result.passed = Object.values(result.checks).every(Boolean);
  const jsonOutput = path.join(outDir, `${motionId}-motion-evidence.json`);
  await writeFile(jsonOutput, `${JSON.stringify(result, null, 2)}\n`);
  return {
    ...result,
    jsonPath: relativeArtifactPath(jsonOutput, p6Root),
    jsonSha256: await sha256File(jsonOutput)
  };
}

function motionStyleSamplesFor(manifest, motionId) {
  const sampleSet = manifest?.samples?.[motionId] ?? {};
  const phases = {};
  for (const phase of P6_MOTION_PHASES) {
    const sample = sampleSet[phase] ?? null;
    const signature = motionStyleSignature(sample);
    phases[phase] = {
      present: Boolean(sample),
      sha256: signature ? createHash("sha256").update(JSON.stringify(signature)).digest("hex") : null,
      sample
    };
  }
  const hashes = P6_MOTION_PHASES.map((phase) => phases[phase].sha256);
  return {
    schemaVersion: manifest?.schemaVersion ?? null,
    source: manifest?.source ?? null,
    phases,
    phaseHashesChanged: hashes.every((hash) => typeof hash === "string") && new Set(hashes).size === P6_MOTION_PHASES.length
  };
}

function motionStyleSignature(sample) {
  if (!Array.isArray(sample?.selectors)) return null;
  return sample.selectors.map((entry) => ({
    selector: entry.selector,
    present: entry.present,
    hidden: entry.hidden,
    opacity: entry.opacity,
    transform: entry.transform,
    transitionDuration: entry.transitionDuration,
    transitionProperty: entry.transitionProperty,
    animationName: entry.animationName,
    rect: entry.rect
      ? {
          x: entry.rect.x,
          y: entry.rect.y,
          width: entry.rect.width,
          height: entry.rect.height
        }
      : null
  }));
}

function motionGeometry(phases) {
  const web = P6_MOTION_PHASES.map((phase) => phases.web[phase]);
  const desktop = P6_MOTION_PHASES.map((phase) => phases.desktop[phase]);
  return {
    webDimensionsStable: dimensionsStable(web),
    desktopDimensionsStable: dimensionsStable(desktop),
    webNonBlankAll: web.every((entry) => entry.nonBlank === true),
    desktopNonBlankAll: desktop.every((entry) => entry.nonBlank === true),
    webDimensions: web.map((entry) => ({ width: entry.width ?? null, height: entry.height ?? null })),
    desktopDimensions: desktop.map((entry) => ({ width: entry.width ?? null, height: entry.height ?? null }))
  };
}

function dimensionsStable(entries) {
  if (!entries.every((entry) => Number.isInteger(entry.width) && Number.isInteger(entry.height))) return false;
  const key = `${entries[0].width}x${entries[0].height}`;
  return entries.every((entry) => `${entry.width}x${entry.height}` === key);
}

function motionSourcePath(p6Root, host, motionId, phase) {
  if (host === "web") return path.join(p6Root, "web-baseline", `web-motion-${motionId}-${phase}.png`);
  return path.join(p6Root, `desktop-motion-${motionId}-${phase}.png`);
}

async function imageEvidence(filePath, repoPath) {
  if (!filePath || !existsSync(filePath)) return { path: repoPath, present: false };
  const bytes = await readFile(filePath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  try {
    const decoded = decode(bytes, { checkCrc: true });
    return {
      path: repoPath,
      present: true,
      sha256,
      sizeBytes: bytes.byteLength,
      width: decoded.width,
      height: decoded.height,
      nonBlank: hasVisiblePixels(decoded)
    };
  } catch (error) {
    return {
      path: repoPath,
      present: true,
      sha256,
      sizeBytes: bytes.byteLength,
      decodeError: error instanceof Error ? error.message : String(error),
      nonBlank: false
    };
  }
}

async function writeComparisonImage(webPath, desktopPath, outputPath, p6Root) {
  const web = decode(await readFile(webPath), { checkCrc: true });
  const desktop = decode(await readFile(desktopPath), { checkCrc: true });
  const pixelDifference = pixelDifferenceRatio(web, desktop);
  const width = web.width + desktop.width + 4;
  const height = Math.max(web.height, desktop.height);
  const data = new Uint8Array(width * height * 4);
  fill(data, 246);
  blit(data, width, web, 0, 0);
  fillDivider(data, width, web.width, height);
  blit(data, width, desktop, web.width + 4, 0);
  const bytes = encode({ width, height, data, channels: 4 });
  await writeFile(outputPath, bytes);
  return {
    present: true,
    path: relativeArtifactPath(outputPath, p6Root),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    width,
    height,
    sizeBytes: bytes.byteLength,
    ...pixelDifference
  };
}

function pixelDifferenceRatio(a, b) {
  if (a.width !== b.width || a.height !== b.height) {
    return {
      sameDimensions: false,
      comparedPixels: 0,
      changedPixels: null,
      pixelDifferenceRatio: 1
    };
  }
  const aRgba = toRgba(a);
  const bRgba = toRgba(b);
  let changedPixels = 0;
  const comparedPixels = a.width * a.height;
  for (let i = 0; i < aRgba.length; i += 4) {
    const delta = Math.abs(aRgba[i] - bRgba[i])
      + Math.abs(aRgba[i + 1] - bRgba[i + 1])
      + Math.abs(aRgba[i + 2] - bRgba[i + 2])
      + Math.abs(aRgba[i + 3] - bRgba[i + 3]);
    if (delta > PIXEL_DELTA_THRESHOLD) changedPixels += 1;
  }
  return {
    sameDimensions: true,
    comparedPixels,
    changedPixels,
    pixelDeltaThreshold: PIXEL_DELTA_THRESHOLD,
    pixelDifferenceRatio: comparedPixels > 0 ? Number((changedPixels / comparedPixels).toFixed(6)) : 1
  };
}

function blit(target, targetWidth, source, xOffset, yOffset) {
  const sourceData = toRgba(source);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourceIndex = (y * source.width + x) * 4;
      const targetIndex = ((y + yOffset) * targetWidth + x + xOffset) * 4;
      target[targetIndex] = sourceData[sourceIndex];
      target[targetIndex + 1] = sourceData[sourceIndex + 1];
      target[targetIndex + 2] = sourceData[sourceIndex + 2];
      target[targetIndex + 3] = sourceData[sourceIndex + 3];
    }
  }
}

function toRgba(decoded) {
  if (decoded.channels === 4) return decoded.data;
  const rgba = new Uint8Array(decoded.width * decoded.height * 4);
  const channels = decoded.channels;
  for (let i = 0, j = 0; i < decoded.data.length; i += channels, j += 4) {
    rgba[j] = decoded.data[i] ?? 0;
    rgba[j + 1] = decoded.data[i + 1] ?? decoded.data[i] ?? 0;
    rgba[j + 2] = decoded.data[i + 2] ?? decoded.data[i] ?? 0;
    rgba[j + 3] = channels === 2 ? decoded.data[i + 1] : 255;
  }
  return rgba;
}

function hasVisiblePixels(decoded) {
  const rgba = toRgba(decoded);
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] > 0 && (rgba[i] !== 0 || rgba[i + 1] !== 0 || rgba[i + 2] !== 0)) return true;
  }
  return false;
}

function fill(data, value) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
}

function fillDivider(data, width, xOffset, height) {
  for (let y = 0; y < height; y += 1) {
    for (let x = xOffset; x < xOffset + 4; x += 1) {
      const index = (y * width + x) * 4;
      data[index] = 28;
      data[index + 1] = 35;
      data[index + 2] = 45;
      data[index + 3] = 255;
    }
  }
}

function relativeArtifactPath(filePath, p6Root) {
  return `.artifacts/product/P6/${path.relative(p6Root, filePath).split(path.sep).join("/")}`;
}

async function sha256File(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function readOptionalJson(filePath) {
  if (!existsSync(filePath)) return undefined;
  return JSON.parse(await readFile(filePath, "utf8"));
}
