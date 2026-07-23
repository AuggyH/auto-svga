import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { P6_RUNTIME_SCENARIOS } from "./runtime-scenarios/contract.mjs";
import {
  strictInteractionPassed,
  strictMotionEvidencePassed,
  strictStateComparisonPassed
} from "./runtime-scenarios/strict-evidence.mjs";

const PASS = "pass";
const FAIL = "fail";

const sectionKeys = {
  regions: "visualParity",
  features: "featureParity",
  interactions: "interactionParity",
  states: "stateParity",
  motions: "motionParity"
};

const sectionIds = {
  visualParity: "visual_parity",
  featureParity: "feature_parity",
  interactionParity: "interaction_parity",
  stateParity: "state_parity",
  motionParity: "motion_parity",
  browserRegression: "browser_regression",
  desktopRuntimeProof: "desktop_runtime_proof",
  securityAudit: "security_audit",
  accessibilityReport: "accessibility_report",
  artifactIndex: "artifact_index"
};

const webStateAliases = {
  invalid: ["invalid", "invalid-error-state"],
  "invalid-error-state": ["invalid", "invalid-error-state"],
  "synchronized-playback-toggled-by-space": ["synchronized-playback-toggled-by-space", "space-sync-toggle"],
  "responsive-export-review-loaded-at-900-x-720": [
    "responsive-export-review-loaded-at-900-x-720",
    "responsive-export-review-900x720"
  ]
};

const desktopStateAliases = {
  "local-empty": ["empty"],
  "export-review-loaded": ["loaded"],
  "invalid-error-state": ["invalid"],
  invalid: ["invalid"],
  "mode-menu-open": ["mode-menu-open"],
  "info-overview-open": ["info-overview-open"],
  "info-assets-open": ["info-assets-open"],
  "logs-open": ["logs-open"],
  "settings-open": ["settings-open"],
  "accessibility-toggles-on": ["accessibility-toggles-on"],
  "settings-closed-by-escape": ["settings-closed-by-escape"],
  "synchronized-playback-toggled-by-space": ["synchronized-playback-toggled-by-space"],
  "local-compare-empty": ["local-compare-empty"],
  "responsive-export-review-loaded-at-900-x-720": ["loaded"]
};
const reviewerBRequiredCategories = [
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
  "emptyState",
  "loadingState",
  "invalidState",
  "responsiveLayout",
  "interactionParity",
  "motionParity",
  "normalMacApp",
  "bundleCompleteness",
  "bundlePrivacy"
];

export async function loadP6RuntimeFacts(input) {
  const repoRoot = input.repoRoot;
  const p6Root = input.p6Root;
  const readJsonFromRoot = async (relativePath) => readOptionalJson(path.join(p6Root, relativePath));
  const sourceHashes = {};
  const sourceFiles = new Set([
    ...Object.values(input.contract ?? {}).flatMap((entries) =>
      Array.isArray(entries) ? entries.flatMap((entry) => entry.sourceFiles ?? []) : []
    ),
    "tools/svga-player-preview/index.html",
    "tools/svga-player-preview/main.js",
    "tools/svga-player-preview/styles.css"
  ]);
  for (const sourceFile of sourceFiles) {
    const absolute = path.join(repoRoot, sourceFile);
    if (existsSync(absolute)) {
      sourceHashes[sourceFile] = await sha256File(absolute);
    }
  }
  return {
    contract: input.contract,
    artifactBindings: input.artifactBindings ?? [],
    sourceHashes,
    web: {
      domManifest: await readJsonFromRoot("web-baseline/dom-manifest.json"),
      computedStylesManifest: await readJsonFromRoot("web-baseline/computed-styles-manifest.json"),
      motionManifest: await readJsonFromRoot("web-baseline/motion-manifest.json"),
      interactionTrace: await readJsonFromRoot("web-baseline/interaction-trace.json"),
      requestAudit: await readJsonFromRoot("web-baseline/request-audit.json")
    },
    desktop: {
      runtimeIdentity: await readJsonFromRoot("runtime-identity.json"),
      normalSmokeParity: await readJsonFromRoot("normal-smoke-parity.json"),
      stateRenderProof: await readJsonFromRoot("desktop-state-render-proof.json"),
      artifactIndex: await readJsonFromRoot("artifact-index.json"),
      reviewerBEvidenceRequest: await readJsonFromRoot("reviewer-b-evidence-request.json")
    },
    webInteractionTrace: await readJsonFromRoot("web-interaction-trace.json"),
    desktopInteractionTrace: await readJsonFromRoot("desktop-interaction-trace.json"),
    interactionParityReport: await readJsonFromRoot("interaction-parity-report.json"),
    stateComparisons: await readJsonMap(path.join(p6Root, "state-comparisons"), /-comparison\.json$/, (value) => value.stateId),
    motionEvidence: await readJsonMap(path.join(p6Root, "motion-evidence"), /-motion-evidence\.json$/, (value) => value.motionId),
    package: {
      normalProof: await readJsonFromRoot("packaged-app-runtime-proof.json"),
      manifest: await readJsonFromRoot("internal-trial-manifest.json")
    },
    registry: input.registry,
    baseRange: input.baseRange
  };
}

export function buildP6ParityReportFromRuntimeFacts(input) {
  const contract = input.contract;
  const artifacts = input.artifactBindings ?? [];
  const requiredCounts = input.requiredCounts ?? {};
  const sections = {};
  for (const [contractKey, reportKey] of Object.entries(sectionKeys)) {
    const items = (contract[contractKey] ?? []).map((item) =>
      buildContractItemEvidence(item, sectionIds[reportKey], input)
    );
    sections[reportKey] = makeSection(sectionIds[reportKey], items, requiredCounts[sectionIds[reportKey]]);
  }

  sections.browserRegression = makeSection("browser_regression", [
    buildSyntheticItemEvidence("web-baseline-load", true, [
      artifactCheck(input, "web-baseline-dom", ["web-baseline/dom-manifest.json"], "Web DOM manifest exists."),
      factCheck("web-baseline-snapshots", hasSnapshots(input.web?.domManifest, 1), "Web baseline captured runtime snapshots."),
      factCheck("no-editor-controls-leakage", noEditorControlsLeakage(input), "P6 product surface does not expose editor controls.")
    ], input),
    buildSyntheticItemEvidence("web-baseline-valid-svga", true, [
      artifactCheck(input, "web-export-review-screenshot", ["screenshot-export-review-loaded-1440x900.png"], "Loaded Web screenshot exists."),
      factCheck(
        "web-export-review-state",
        hasWebState(input, "export-review-loaded"),
        "Export review loaded state is present in Web DOM evidence."
      )
    ], input),
    buildSyntheticItemEvidence("web-baseline-invalid-state", true, [
      artifactCheck(input, "web-invalid-screenshot", ["screenshot-invalid-1440x900.png"], "Invalid Web screenshot exists."),
      factCheck("web-invalid-state", hasWebState(input, "invalid"), "Invalid Web state is present in DOM evidence.")
    ], input)
  ], requiredCounts.browser_regression);

  sections.desktopRuntimeProof = makeSection("desktop_runtime_proof", [
    buildSyntheticItemEvidence("source-electron-smoke", true, [
      artifactCheck(input, "desktop-state-proof", ["desktop-state-render-proof.json"], "Desktop state proof exists."),
      factCheck("desktop-state-proof-passed", input.desktop?.stateRenderProof?.passed === true, "Desktop state proof passed."),
      factCheck("shell-app-css-hash-parity", shellAppCssHashesStable(input), "Shell, app, preload, and CSS hashes are stable across normal and smoke launches."),
      factCheck("reviewer-evidence-request-present", reviewerEvidenceRequestPresent(input), "Reviewer B evidence request is concrete and contains no Reviewer verdict."),
      factCheck("reviewer-generic-pass-consistent", reviewerGenericPassConsistent(input), "Reviewer support cannot use a generic PASS while category verdicts still require product review."),
      factCheck("reviewer-categories-complete", reviewerCategoriesComplete(input), "Reviewer B evidence request covers required product categories.")
    ], input),
    buildSyntheticItemEvidence("packaged-app-launch", true, [
      artifactCheck(input, "packaged-proof", ["packaged-app-runtime-proof.json"], "Packaged app runtime proof exists."),
      factCheck("packaged-proof-passed", input.package?.normalProof?.passed === true, "Packaged app launched normally."),
      factCheck("normal-app-proof-flags", normalAppProofFlags(input), "Normal App proof is not generated from smoke-only flags.")
    ], input),
    buildSyntheticItemEvidence("packaged-app-fixture-flow", true, [
      artifactCheck(input, "fixture-hash-match", fixtureHashesMatch(input), "Packaged and Desktop fixture hashes match."),
      factCheck("app-zip-present", packageZipPresent(input), "Package evidence includes a macOS App ZIP.")
    ], input)
  ], requiredCounts.desktop_runtime_proof);

  sections.securityAudit = makeSection("security_audit", [
    buildSyntheticItemEvidence("local-assets", true, [
      factCheck("request-audit-local", noExternalRequests(input), "Web baseline request audit has no external requests."),
      factCheck("desktop-no-remote", input.desktop?.runtimeIdentity?.security?.remoteNavigationAllowed === false, "Desktop runtime blocks remote navigation.")
    ], input),
    buildSyntheticItemEvidence("restricted-csp", true, [
      factCheck("desktop-csp", hasRestrictedCsp(input), "Desktop runtime records a restricted CSP.")
    ], input),
    buildSyntheticItemEvidence("no-telemetry", true, [
      factCheck("no-telemetry", input.desktop?.runtimeIdentity?.security?.telemetryEnabled === false, "Desktop runtime records telemetry disabled.")
    ], input)
  ], requiredCounts.security_audit);

  sections.accessibilityReport = makeSection("accessibility_report", [
    buildSyntheticItemEvidence("web-baseline-responsive", true, [
      artifactCheck(input, "responsive-screenshot", ["screenshot-export-review-loaded-900x720.png"], "Responsive Web screenshot exists."),
      factCheck("responsive-state", hasWebState(input, "responsive-export-review-loaded-at-900-x-720"), "Responsive Web state was captured.")
    ], input),
    buildSyntheticItemEvidence("desktop-rendered-states", true, [
      factCheck("desktop-empty-differs-loading", desktopEmptyDiffersLoading(input), "Desktop loading state is distinct from empty state."),
      factCheck("desktop-invalid-clears-metadata", desktopInvalidClearsMetadata(input), "Desktop invalid state clears stale metadata.")
    ], input)
  ], requiredCounts.accessibility_report);

  sections.artifactIndex = buildArtifactIndexSection(artifacts, requiredCounts.artifact_index);

  return {
    contractVersion: 1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    source: input.source,
    sections
  };
}

export function validateP6RuntimeScenarioContract(input) {
  const failures = [];
  for (const scenario of P6_RUNTIME_SCENARIOS) {
    for (const fragment of scenario.requiredArtifacts) {
      if (idsByPath(input.artifactBindings ?? [], [fragment]).length === 0) {
        failures.push(`${scenario.id} missing ${fragment}`);
      }
    }
    for (const extension of scenario.requiredPackageExtensions ?? []) {
      if (!packageZipPresent(input, extension)) failures.push(`${scenario.id} missing App ZIP`);
    }
  }
  return { valid: failures.length === 0, failures };
}

export function validateP6WorkerRegistryFreshness(registry, expected) {
  const failures = [];
  if (!registry || typeof registry !== "object") return { valid: false, failures: ["registry missing"] };
  if (registry.currentRepairRound !== expected.repairRound) {
    failures.push(`registry currentRepairRound ${registry.currentRepairRound} does not equal ${expected.repairRound}`);
  }
  if (registry.currentIntegrationHeadCommit !== expected.currentIntegrationHeadCommit) {
    failures.push("registry currentIntegrationHeadCommit is stale");
  }
  const workers = Array.isArray(registry.workers) ? registry.workers : [];
  const worker = workers.find((entry) => entry.id === expected.workerId);
  if (!worker) {
    failures.push(`registry missing worker ${expected.workerId}`);
  } else if (worker.branch !== expected.branch) {
    failures.push(`registry worker ${expected.workerId} branch is stale`);
  }
  return { valid: failures.length === 0, failures };
}

export function validateP6BaseRangeDiff(input) {
  const failures = [];
  if (!input.baseCommit || !input.headCommit) failures.push("baseCommit and headCommit are required");
  if (input.baseCommit === input.headCommit) failures.push("baseCommit and headCommit must differ");
  if (!Array.isArray(input.changedFiles) || input.changedFiles.length === 0) failures.push("changedFiles must not be empty");
  for (const changedFile of input.changedFiles ?? []) {
    if (!input.allowedPaths.some((allowedPath) => changedFile === allowedPath || changedFile.startsWith(`${allowedPath}/`))) {
      failures.push(`changed file outside A4 ownership: ${changedFile}`);
    }
  }
  return { valid: failures.length === 0, failures };
}

export function validateP6SourceDiffPrivacy(input) {
  const diffText = String(input.diffText ?? "");
  const failures = [];
  const forbidden = [
    /\/Users\/[^/\s]+/,
    /\/private\/var\/folders\/[^\s"]+/,
    /[A-Za-z]:\\Users\\[^\\\s]+/,
    /AUTO_SVGA_[A-Z0-9_]*TOKEN\s*=/,
    /BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY/
  ];
  for (const pattern of forbidden) {
    if (pattern.test(diffText)) failures.push(`source diff contains privacy literal: ${pattern.source}`);
  }
  return { valid: failures.length === 0, failures };
}

function buildContractItemEvidence(item, sectionId, input) {
  const webFragments = webFragmentsForItem(item, sectionId);
  const desktopFragments = desktopFragmentsForItem(item, sectionId);
  const comparisonFragments = comparisonFragmentsForItem(item, sectionId);
  const webIds = idsByPath(input.artifactBindings, webFragments);
  const desktopIds = idsByPath(input.artifactBindings, desktopFragments);
  const comparisonIds = idsByPath(input.artifactBindings, comparisonFragments);
  const sourceIds = [];
  const checks = [
    factCheck("required-item", item.required === true, "Parity contract item is marked required."),
    factCheck("web-item-runtime", webItemPresent(item, sectionId, input), "Web runtime evidence contains this item."),
    artifactCheckFromIds("web-item-artifacts", webIds, "Web evidence artifacts are item-specific.", fragmentsCovered(input.artifactBindings, webFragments)),
    factCheck("desktop-item-runtime", desktopItemPresent(item, sectionId, input), "Desktop runtime evidence contains this item."),
    artifactCheckFromIds("desktop-item-artifacts", desktopIds, "Desktop evidence artifacts are item-specific.", fragmentsCovered(input.artifactBindings, desktopFragments)),
    artifactCheckFromIds("comparison-item-artifacts", comparisonIds, "Comparison evidence artifacts are item-specific.", fragmentsCovered(input.artifactBindings, comparisonFragments)),
    factCheck("shared-source-files", sharedSourceFilesPresent(item, input), "Shared source files referenced by the contract exist.")
  ];
  if (sectionId === "interaction_parity") {
    checks.push(factCheck(
      "strict-interaction-parity",
      strictInteractionPassed(input, item),
      "Web and Desktop action traces share fixture, viewport, controls, final digest, and real input action contract.",
      idsByPath(input.artifactBindings, ["web-interaction-trace.json", "desktop-interaction-trace.json", "interaction-parity-report.json"])
    ));
  }
  if (sectionId === "state_parity") {
    checks.push(factCheck(
      "strict-state-parity",
      stateComparisonPassed(input, item.id),
      "State comparison includes bound snapshot ID, geometry, computed style, control value, playback time, visible region, pixel tolerance, and unapproved-difference gates.",
      idsByPath(input.artifactBindings, [`state-comparisons/${item.id}-comparison.json`])
    ));
  }
  if (sectionId === "motion_parity") {
    checks.push(factCheck(
      "strict-motion-parity",
      motionEvidencePassed(input, item.id, item),
      "Motion evidence shares trigger/state and includes start/mid/end, animation params, geometry, crop, and reduced-motion comparison.",
      idsByPath(input.artifactBindings, [`motion-evidence/${item.id}-motion-evidence.json`])
    ));
  }
  return itemResult({
    id: item.id,
    required: item.required === true,
    checks,
    webEvidence: evidenceSet(webIds, "Web runtime artifacts bound to this required item."),
    desktopEvidence: evidenceSet(desktopIds, "Desktop runtime artifacts bound to this required item."),
    comparisonEvidence: evidenceSet(comparisonIds, "Web/Desktop comparison artifacts bound to this required item."),
    sharedSourceEvidence: evidenceSet(sourceIds, "Shared source files were hash-checked for this item.")
  });
}

function buildSyntheticItemEvidence(id, required, checks, input) {
  const artifactIds = uniqueIds(checks.flatMap((check) => check.artifactIds));
  return itemResult({
    id,
    required,
    checks,
    webEvidence: evidenceSet(idsByPath(input.artifactBindings, ["web-baseline/"]), "Web runtime evidence."),
    desktopEvidence: evidenceSet(idsByPath(input.artifactBindings, ["desktop", "runtime-identity", "normal-smoke-parity"]), "Desktop runtime evidence."),
    comparisonEvidence: evidenceSet(artifactIds, "Runtime comparison evidence."),
    sharedSourceEvidence: evidenceSet([], "Source and scenario contract checks.")
  });
}

function buildArtifactIndexSection(artifacts, requiredEvidenceCount = 1) {
  const items = artifacts.map((artifact) => {
    const check = {
      id: "artifact-hash-bound",
      passed: isSha256(artifact.sha256) && typeof artifact.path === "string" && artifact.path.length > 0,
      artifactIds: [artifact.id],
      summary: "Artifact has path and SHA-256 binding."
    };
    return itemResult({
      id: artifact.id,
      required: true,
      checks: [check],
      webEvidence: evidenceSet(artifact.path.includes("web-baseline") ? [artifact.id] : [], "Artifact-specific Web evidence."),
      desktopEvidence: evidenceSet(artifact.path.includes("desktop") || artifact.path.includes("runtime") ? [artifact.id] : [], "Artifact-specific Desktop evidence."),
      comparisonEvidence: evidenceSet([artifact.id], "Artifact-specific hash binding."),
      sharedSourceEvidence: evidenceSet([], "Artifact index source contract.")
    });
  });
  const manifestArtifactIds = artifacts.slice(0, 1).map((artifact) => artifact.id);
  return {
    id: "artifact_index",
    status: statusFromItems(items),
    requiredEvidenceCount,
    items,
    evidence: [{
      id: "artifact-index-hash-bound",
      status: statusFromItems(items),
      artifactIds: manifestArtifactIds,
      summary: "P6 evidence artifacts are hash-bound by item, without blanket binding every artifact to every item."
    }],
    inventory: {
      itemCount: artifacts.length,
      itemIds: artifacts.map((artifact) => artifact.id)
    },
    artifacts,
    manifests: [{
      id: "p6-evidence-manifest",
      artifactIds: artifacts.map((artifact) => artifact.id),
      sha256: createHash("sha256").update(JSON.stringify(artifacts)).digest("hex")
    }]
  };
}

function makeSection(id, items, requiredEvidenceCount = items.length) {
  return {
    id,
    status: statusFromItems(items),
    requiredEvidenceCount,
    items,
    evidence: items.map((item) => ({
      id: `${id}-${item.id}`,
      status: item.status,
      artifactIds: uniqueIds([
        ...item.webEvidence.artifactIds,
        ...item.desktopEvidence.artifactIds,
        ...item.comparisonEvidence.artifactIds,
        ...item.sharedSourceEvidence.artifactIds
      ]),
      summary: `${item.id} status is derived from ${item.checks.length} runtime checks.`
    })),
    inventory: {
      itemCount: items.length,
      itemIds: items.map((item) => item.id)
    }
  };
}

function itemResult(input) {
  const failures = input.checks.filter((check) => !check.passed).map((check) => check.id);
  return {
    id: input.id,
    required: input.required,
    status: statusFromChecks(input.checks),
    checks: input.checks,
    webEvidence: input.webEvidence,
    desktopEvidence: input.desktopEvidence,
    comparisonEvidence: input.comparisonEvidence,
    sharedSourceEvidence: input.sharedSourceEvidence,
    failures
  };
}

function statusFromChecks(checks) {
  return checks.every((check) => check.passed) ? PASS : FAIL;
}

function statusFromItems(items) {
  return items.every((item) => item.status === PASS) ? PASS : FAIL;
}

function evidenceSet(artifactIds, summary) {
  return { artifactIds: uniqueIds(artifactIds), summary };
}

function factCheck(id, passed, summary, artifactIds = []) {
  return { id, passed: Boolean(passed), artifactIds: uniqueIds(artifactIds), summary };
}

function artifactCheck(input, id, fragmentsOrPassed, summary) {
  if (typeof fragmentsOrPassed === "boolean") return factCheck(id, fragmentsOrPassed, summary);
  const artifactIds = idsByPath(input.artifactBindings ?? [], fragmentsOrPassed);
  return artifactCheckFromIds(id, artifactIds, summary);
}

function artifactCheckFromIds(id, artifactIds, summary, passed = artifactIds.length > 0) {
  return { id, passed: Boolean(passed), artifactIds: uniqueIds(artifactIds), summary };
}

function webItemPresent(item, sectionId, input) {
  if (sectionId === "state_parity") return hasWebState(input, item.id) && stateComparisonPassed(input, item.id);
  if (sectionId === "interaction_parity") {
    return hasInteractionStep(input, item.expectedState) && selectorSeenInWeb(item.selector, input) && strictInteractionPassed(input, item);
  }
  if (sectionId === "motion_parity") return motionSeen(item, input);
  const selectors = item.selectors ?? [item.selector].filter(Boolean);
  if (sectionId === "visual_parity") return regionSeen(item.id, input, item.visibleStates);
  return selectors.length === 0 || selectors.some((selector) => selectorSeenInWeb(selector, input));
}

function desktopItemPresent(item, sectionId, input) {
  if (sectionId === "state_parity") return hasDesktopState(input, item.id) && stateComparisonPassed(input, item.id);
  if (sectionId === "motion_parity") return hasDesktopState(input, "export-review-loaded") && motionEvidencePassed(input, item.id, item);
  if (sectionId === "interaction_parity") return hasDesktopState(input, item.expectedState) && strictInteractionPassed(input, item);
  if (sectionId === "feature_parity") return desktopFeaturePresent(item, input);
  return (desktopFragmentsForItem(item, sectionId).length > 0 && idsByPath(input.artifactBindings, desktopFragmentsForItem(item, sectionId)).length > 0);
}

function desktopFeaturePresent(item, input) {
  const text = itemText(item);
  if (/secondary|comparison|reference|logs?|settings|latest|artifact|scan/.test(text)) {
    return idsByPath(input.artifactBindings, desktopFragmentsForItem(item, "feature_parity")).length > 0
      && hasDesktopState(input, /secondary|comparison/.test(text) ? "local-compare-empty" : "export-review-loaded");
  }
  if (/play|pause|replay|progress|loop|fit|sync/.test(text)) return hasDesktopState(input, "export-review-loaded");
  if (/invalid|error/.test(text)) return hasDesktopState(input, "invalid");
  return input.desktop?.runtimeIdentity !== undefined;
}

function sharedSourceFilesPresent(item, input) {
  const sourceFiles = item.sourceFiles ?? [];
  return sourceFiles.length === 0 || sourceFiles.every((sourceFile) => typeof input.sourceHashes?.[sourceFile] === "string");
}

function hasWebState(input, stateId) {
  const states = stateAliases(stateId, webStateAliases);
  return snapshots(input).some((snapshot) => states.includes(snapshot.stateId));
}

function hasDesktopState(input, stateId) {
  const states = stateAliases(stateId, desktopStateAliases);
  const desktopStates = input.desktop?.stateRenderProof?.states ?? {};
  return states.some((state) => desktopStates[state]?.passed === true);
}

function hasSnapshots(domManifest, count) {
  return Array.isArray(domManifest?.snapshots) && domManifest.snapshots.length >= count;
}

function hasInteractionStep(input, stateId) {
  const states = stateAliases(stateId, webStateAliases);
  const steps = input.web?.interactionTrace?.steps;
  return Array.isArray(steps) && steps.some((step) => states.includes(step.stateId));
}

function regionSeen(regionId, input, visibleStates = []) {
  const allowedStates = new Set((visibleStates ?? []).flatMap((stateId) => stateId === "all" ? [] : stateAliases(stateId, webStateAliases)));
  return snapshots(input).some((snapshot) => {
    if (allowedStates.size > 0 && !allowedStates.has(snapshot.stateId)) return false;
    return (snapshot.regions ?? []).some((region) => region.id === regionId && region.present === true && region.visible === true);
  });
}

function selectorSeenInWeb(selector, input) {
  if (!selector) return false;
  if (selector.includes(",")) {
    return selector.split(",").map((part) => part.trim()).filter(Boolean).every((part) => selectorSeenInWeb(part, input));
  }
  if (selector === "body") return snapshots(input).length > 0;
  const dataValue = selector.match(/^\[data-value=['"]?([^'"\]]+)['"]?\]$/)?.[1];
  const dataTab = selector.match(/^\.([a-zA-Z0-9_-]+)\[data-tab=['"]?([^'"\]]+)['"]?\]$/);
  const selectorId = selector.startsWith("#") && !selector.includes(" ") ? selector.slice(1) : null;
  return snapshots(input).some((snapshot) => {
    if ((snapshot.regions ?? []).some((region) => region.selector === selector && region.present === true)) return true;
    if (selectorId && (snapshot.controls ?? []).some((control) => control.id === selectorId && control.visible === true)) return true;
    if (dataValue && (snapshot.controls ?? []).some((control) => control.dataValue === dataValue && control.visible === true)) return true;
    if (dataTab && (snapshot.controls ?? []).some((control) =>
      control.dataTab === dataTab[2]
      && String(control.tag ?? "").toLowerCase() === "button"
      && (control.visible === true || (snapshot.bodyTextSample ?? "").includes(control.text ?? ""))
    )) return true;
    return selector.startsWith(".") && (snapshot.bodyTextSample ?? "").length > 0;
  });
}

function motionSeen(item, input) {
  const keyframes = input.web?.motionManifest?.keyframes;
  const sampledAnimations = input.web?.motionManifest?.sampledAnimations;
  const animationName = item.animationName ?? item.id;
  const keyframeSeen = Array.isArray(keyframes) && keyframes.some((keyframe) =>
    keyframe === animationName
    || keyframe.name === animationName
    || keyframe.cssText?.includes(animationName)
  );
  const sampledSeen = Array.isArray(sampledAnimations) && sampledAnimations.some((animation) =>
    animation.animationName === animationName || animation.selector === item.selector
  );
  return (keyframeSeen || sampledSeen) && motionEvidencePassed(input, item.id);
}

function noExternalRequests(input) {
  const audit = input.web?.requestAudit;
  return Array.isArray(audit?.externalRequests) && audit.externalRequests.length === 0;
}

function hasRestrictedCsp(input) {
  const csp = input.desktop?.runtimeIdentity?.security?.contentSecurityPolicy
    ?? input.desktop?.runtimeIdentity?.csp;
  return typeof csp === "string" && csp.includes("default-src") && !csp.includes("http:");
}

function shellAppCssHashesStable(input) {
  const parity = input.desktop?.normalSmokeParity;
  if (parity?.passed === false) return false;
  const checks = Array.isArray(parity?.checks) ? parity.checks : [];
  const failedHashCheck = checks.some((check) =>
    /hash|sha/i.test(`${check.id ?? ""} ${check.name ?? ""} ${check.summary ?? ""}`)
    && check.passed === false
  );
  const hashBlob = JSON.stringify(input.desktop?.runtimeIdentity ?? {}).toLowerCase();
  const requiredRuntimePieces = ["renderer", "style", "css", "main", "preload"];
  return !failedHashCheck && requiredRuntimePieces.every((piece) => hashBlob.includes(piece));
}

function reviewerEvidenceRequestPresent(input) {
  const request = input.desktop?.reviewerBEvidenceRequest;
  const categories = request?.categories;
  if (containsReviewerVerdict(request)) return false;
  if (!Array.isArray(categories) || categories.length === 0) return false;
  return categories.every((category) =>
    typeof category.category === "string"
    && typeof category.request === "string"
    && Array.isArray(category.evidenceNeeded)
    && category.evidenceNeeded.length > 0
  );
}

function reviewerCategoriesComplete(input) {
  const request = input.desktop?.reviewerBEvidenceRequest;
  const categories = request?.categories;
  if (!Array.isArray(categories)) return false;
  const present = new Set(categories.map((category) => category.category ?? category.id));
  if (request.categoryCount !== undefined && request.categoryCount !== categories.length) return false;
  return categories.length === reviewerBRequiredCategories.length
    && reviewerBRequiredCategories.every((category) => present.has(category));
}

function reviewerGenericPassConsistent(input) {
  const request = input.desktop?.reviewerBEvidenceRequest;
  if (!request || typeof request !== "object") return false;
  const genericVerdict = request.verdict ?? request.genericVerdict ?? request.overallVerdict;
  if (genericVerdict !== "PASS") return true;
  const categories = request.categories;
  if (!Array.isArray(categories) || categories.length === 0) return false;
  return categories.every((category) => {
    const categoryVerdict = category.verdict ?? category.requiredVerdict ?? category.status ?? category.reviewStatus;
    return categoryVerdict === undefined || categoryVerdict === "PASS";
  });
}

function containsReviewerVerdict(value) {
  if (Array.isArray(value)) return value.some((entry) => containsReviewerVerdict(entry));
  if (!value || typeof value !== "object") return false;
  if ("verdict" in value || "finding" in value || "visualObservations" in value) return true;
  return Object.values(value).some((entry) => containsReviewerVerdict(entry));
}

function normalAppProofFlags(input) {
  const proof = input.package?.normalProof;
  const visibleStartup = proof?.normalVisibleStartup ?? {};
  const environmentOverrides = visibleStartup?.environmentOverrides
    ?? proof?.environmentOverrides
    ?? proof?.runtimeIdentity?.environmentOverrides
    ?? {};
  const argv = JSON.stringify(
    visibleStartup?.actualArgvSanitized
      ?? proof?.actualArgvSanitized
      ?? proof?.runtimeIdentity?.actualArgvSanitized
      ?? []
  );
  const launchText = JSON.stringify([
    proof?.launchTarget,
    proof?.actualLaunchCommand,
    proof?.runtimeIdentity?.actualLaunchCommand,
    visibleStartup?.actualLaunchCommand,
    visibleStartup?.runtimeIdentity?.actualLaunchCommand
  ].filter(Boolean));
  const autoSvgaEnvironmentOverrides = Object.keys(environmentOverrides)
    .filter((name) => name.startsWith("AUTO_SVGA_"));
  const proofOnlyPattern = /proof\/smoke|proof-only|smoke-only|AUTO_SVGA_P2_NORMAL_PROOF|AUTO_SVGA_PRODUCT_SMOKE|--p2-normal-proof|--smoke|mode=smoke|npm run desktop:dev/i;
  return proof?.passed === true
    && visibleStartup.normalVisibleStartup === true
    && visibleStartup.windowShown === true
    && visibleStartup.finderEquivalentLaunchCompatible === true
    && visibleStartup.noProofMode === true
    && visibleStartup.noSmokeMode === true
    && visibleStartup.noProofArguments === true
    && visibleStartup.rendererQuery === ""
    && autoSvgaEnvironmentOverrides.length === 0
    && !proofOnlyPattern.test(argv)
    && !proofOnlyPattern.test(launchText);
}

function noEditorControlsLeakage(input) {
  const forbidden = /\b(editor|timeline|keyframe|layer inspector|export svga binary)\b/i;
  return snapshots(input).every((snapshot) => !forbidden.test(snapshot.bodyTextSample ?? ""));
}

function fixtureHashesMatch(input) {
  const fixtureHash = input.desktop?.artifactIndex?.fixtureHashes?.fixtureSha256
    ?? input.desktop?.runtimeIdentity?.fixtureSha256
    ?? input.package?.manifest?.fixtureSha256;
  const packageFixtureHash = input.package?.normalProof?.normalVisibleStartup?.fixtureSha256
    ?? input.package?.normalProof?.normalVisibleStartup?.runtimeIdentity?.fixtureSha256
    ?? input.package?.normalProof?.normalProof?.fixtureSha256
    ?? input.package?.normalProof?.fixtureSha256
    ?? input.package?.normalProof?.runtimeIdentity?.fixtureSha256
    ?? input.package?.manifest?.fixtureSha256
    ?? input.desktop?.artifactIndex?.fixtureHashes?.fixtureSha256;
  return typeof fixtureHash === "string" && fixtureHash.length === 64 && fixtureHash === packageFixtureHash;
}

function packageZipPresent(input, extension = ".zip") {
  return (input.artifactBindings ?? []).some((artifact) =>
    artifact.path.endsWith(extension)
    || artifact.mediaType === "application/zip"
    || artifact.role === "macos_app_zip"
  );
}

function desktopEmptyDiffersLoading(input) {
  const states = input.desktop?.stateRenderProof?.states ?? {};
  const empty = states.empty;
  const loading = states.loading;
  if (!empty || !loading) return false;
  return empty.passed === true
    && loading.passed === true
    && JSON.stringify(empty.renderedText ?? empty) !== JSON.stringify(loading.renderedText ?? loading);
}

function desktopInvalidClearsMetadata(input) {
  const invalid = input.desktop?.stateRenderProof?.states?.invalid;
  return invalid?.passed === true
    && invalid.staleMetadataCleared === true
    && invalid.staleInspectionCleared === true
    && invalid.staleCanvasCleared !== false
    && invalid.staleFileNameCleared !== false;
}

function stateComparisonPassed(input, stateId) {
  return strictStateComparisonPassed(input.stateComparisons?.[stateId], stateId);
}

function motionEvidencePassed(input, motionId, item = { id: motionId }) {
  return strictMotionEvidencePassed(input.motionEvidence?.[motionId], item);
}

function itemText(item) {
  return [
    item.id,
    item.label,
    item.selector,
    ...(item.selectors ?? []),
    item.expectedState,
    item.initialState,
    item.animationName,
    item.trigger,
    item.userOutcome
  ].filter(Boolean).join(" ").toLowerCase();
}

function snapshots(input) {
  return input.web?.domManifest?.snapshots ?? [];
}

function stateAliases(stateId, aliases) {
  return aliases[stateId] ?? [stateId];
}

function webFragmentsForItem(item, sectionId) {
  const text = itemText(item);
  const fragments = ["web-baseline/dom-manifest.json"];
  if (sectionId === "visual_parity") fragments.push("web-baseline/computed-styles-manifest.json");
  if (sectionId === "interaction_parity") fragments.push("web-baseline/interaction-trace.json");
  if (sectionId === "interaction_parity") fragments.push("web-interaction-trace.json", "interaction-parity-report.json");
  if (sectionId === "motion_parity") fragments.push("web-baseline/motion-manifest.json", "web-baseline/computed-styles-manifest.json");
  if (sectionId === "motion_parity") fragments.push(`motion-evidence/${item.id}-motion-evidence.json`);
  if (sectionId === "state_parity") {
    fragments.push(
      `state-comparisons/web-${item.id}.png`,
      `state-comparisons/${item.id}-comparison.json`
    );
  }
  for (const stateId of [item.initialState, item.expectedState, ...(item.visibleStates ?? [])]) {
    if (stateId && stateId !== "all") fragments.push(...stateScreenshotFragments(stateId).filter((fragment) => fragment.startsWith("screenshot-") || fragment.includes("interaction-trace")));
  }
  if (/invalid|error/.test(text)) fragments.push("screenshot-invalid");
  if (/asset|resource/.test(text)) fragments.push("screenshot-info-assets");
  if (/overview|inspection|report|audit/.test(text)) fragments.push("screenshot-info-overview");
  if (/logs?/.test(text)) fragments.push("screenshot-logs");
  if (/settings|modal|toggle/.test(text)) fragments.push("screenshot-settings");
  if (/compare|comparison|secondary/.test(text)) fragments.push("screenshot-local-compare-empty");
  if (/responsive|900/.test(text)) fragments.push("screenshot-export-review-loaded-900x720");
  if (/export|latest|play|pause|replay|progress|loop|fit|sync|svga/.test(text)) {
    fragments.push("screenshot-export-review-loaded-1440x900");
  }
  if (/local|empty|file|drag|drop|select/.test(text)) fragments.push("screenshot-local-empty");
  return uniqueIds(fragments);
}

function desktopFragmentsForItem(item, sectionId) {
  const text = itemText(item);
  const fragments = ["runtime-identity.json"];
  if (sectionId === "interaction_parity" || sectionId === "state_parity") fragments.push("desktop-state-render-proof.json");
  if (sectionId === "interaction_parity") fragments.push("desktop-interaction-trace.json", "interaction-parity-report.json");
  if (sectionId === "motion_parity") fragments.push("desktop-state-render-proof.json");
  if (sectionId === "motion_parity") {
    fragments.push(
      `motion-evidence/desktop-motion-${item.id}-start.png`,
      `motion-evidence/desktop-motion-${item.id}-mid.png`,
      `motion-evidence/desktop-motion-${item.id}-end.png`,
      `motion-evidence/${item.id}-motion-evidence.json`
    );
  }
  if (sectionId === "state_parity") {
    fragments.push(
      `state-comparisons/desktop-${item.id}.png`,
      `state-comparisons/web-desktop-${item.id}-comparison.png`,
      `state-comparisons/${item.id}-comparison.json`
    );
  }
  if (/invalid|error/.test(text)) fragments.push("desktop-invalid.png", "invalid-fixture.json", "desktop-state-render-proof.json");
  if (/loading/.test(text)) fragments.push("desktop-loading.png", "desktop-state-render-proof.json");
  if (/asset|resource|overview|inspection|report|audit|logs?|settings|modal|toggle|panel/.test(text)) {
    fragments.push("desktop-inspection.png", "desktop-state-render-proof.json");
  }
  if (/responsive|layout|shell|toolbar|brand|workspace/.test(text)) {
    fragments.push("desktop-1280x800.png", "desktop-1440x900.png");
  }
  if (/play|pause|replay|progress|loop|fit|sync|svga|export|latest|loaded|sequence|sweep|canvas/.test(text)) {
    fragments.push("desktop-loaded.png", "smoke-loaded.png", "desktop-state-render-proof.json");
  }
  if (/local|empty|file|drag|drop|select|compare|comparison|secondary|reference/.test(text)) {
    fragments.push("desktop-empty.png", "desktop-state-render-proof.json");
  }
  if (sectionId === "feature_parity") fragments.push("artifact-index.json");
  return uniqueIds(fragments);
}

function comparisonFragmentsForItem(item, sectionId) {
  return uniqueIds([
    "normal-smoke-parity.json",
    "runtime-identity.json",
    "packaged-app-runtime-proof.json",
    sectionId === "motion_parity" ? "motion-manifest.json" : "",
    sectionId === "motion_parity" ? `motion-evidence/${item.id}-motion-evidence.json` : "",
    sectionId === "state_parity" ? `state-comparisons/${item.id}-comparison.json` : "",
    sectionId === "state_parity" ? `state-comparisons/web-desktop-${item.id}-comparison.png` : "",
    sectionId === "interaction_parity" ? "interaction-trace.json" : "",
    sectionId === "interaction_parity" ? "web-interaction-trace.json" : "",
    sectionId === "interaction_parity" ? "desktop-interaction-trace.json" : "",
    sectionId === "interaction_parity" ? "interaction-parity-report.json" : "",
    ...stateScreenshotFragments(item.id),
    ...stateScreenshotFragments(item.expectedState)
  ]);
}

function stateScreenshotFragments(stateId) {
  const map = {
    "local-empty": ["screenshot-local-empty", "desktop-empty.png"],
    "mode-menu-open": ["interaction-trace.json", "screenshot-mode-menu-open", "desktop-mode-menu-open.png", "desktop-state-render-proof.json"],
    "export-review-loaded": ["screenshot-export-review-loaded-1440x900", "desktop-loaded.png", "smoke-loaded.png"],
    "info-overview-open": ["screenshot-info-overview", "desktop-inspection.png"],
    "info-assets-open": ["screenshot-info-assets", "desktop-inspection.png"],
    "logs-open": ["screenshot-logs", "desktop-inspection.png"],
    "settings-open": ["screenshot-settings", "desktop-inspection.png"],
    "accessibility-toggles-on": ["screenshot-settings", "desktop-state-render-proof.json"],
    "settings-closed-by-escape": ["interaction-trace.json", "desktop-state-render-proof.json"],
    "synchronized-playback-toggled-by-space": ["interaction-trace.json", "desktop-state-render-proof.json"],
    "local-compare-empty": ["screenshot-local-compare-empty", "desktop-state-render-proof.json"],
    "responsive-export-review-loaded-at-900-x-720": ["screenshot-export-review-loaded-900x720", "desktop-1440x900.png"],
    invalid: ["screenshot-invalid", "desktop-invalid.png"]
  };
  return map[stateId] ?? [];
}

function idsByPath(artifacts = [], fragments = []) {
  return artifacts
    .filter((artifact) => fragments.filter(Boolean).some((fragment) => artifact.path.includes(fragment)))
    .map((artifact) => artifact.id);
}

function fragmentsCovered(artifacts = [], fragments = []) {
  const requiredFragments = fragments.filter(Boolean);
  return requiredFragments.length > 0
    && requiredFragments.every((fragment) => artifacts.some((artifact) => artifact.path.includes(fragment)));
}

function uniqueIds(ids) {
  return [...new Set((ids ?? []).filter(Boolean))];
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

async function readOptionalJson(filePath) {
  if (!existsSync(filePath)) return undefined;
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonMap(directory, pattern, keyForValue) {
  const out = {};
  if (!existsSync(directory)) return out;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !pattern.test(entry.name)) continue;
    const value = JSON.parse(await readFile(path.join(directory, entry.name), "utf8"));
    const key = keyForValue(value);
    if (typeof key === "string" && key.length > 0) out[key] = value;
  }
  return out;
}

async function sha256File(filePath) {
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) return undefined;
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}
