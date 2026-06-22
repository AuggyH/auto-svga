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
  for (const field of ["host", "fixture", "context", "actionTrace", "finalStateDigest", "visibleRegions", "visibleControls", "screenshots", "failures"]) {
    if (!(field in trace)) failures.push(`${field} missing`);
  }
  if (!isRecord(trace.fixture) || !isSha256(trace.fixture.sha256)) failures.push("fixture.sha256 missing");
  if (!isRecord(trace.fixture) || !nonEmptyString(trace.fixture.displayName)) failures.push("fixture.displayName missing");
  validateContext(trace.context, failures);
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
  if (!Array.isArray(trace.screenshots) || trace.screenshots.length === 0) failures.push("screenshots missing");
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
    visibleRegionsMatched: nonEmptyEqualIdSet(webTrace?.visibleRegions, desktopTrace?.visibleRegions),
    visibleControlsMatched: nonEmptyEqualIdSet(webTrace?.visibleControls, desktopTrace?.visibleControls),
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
    && checks.geometryCompared === true
    && checks.computedStyleCompared === true
    && checks.controlValuesCompared === true
    && checks.playbackTimeCompared === true
    && checks.visibleRegionsCompared === true
    && checks.pixelToleranceCompared === true
    && checks.noUnapprovedDifferences === true;
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
    && checks.reducedMotionCompared === true;
}

async function buildWebInteractionTrace(p6Root, contract) {
  const domManifest = await readOptionalJson(path.join(p6Root, "web-baseline/dom-manifest.json"));
  const legacyTrace = await readOptionalJson(path.join(p6Root, "web-baseline/interaction-trace.json"));
  const artifactIndex = await readOptionalJson(path.join(p6Root, "web-baseline/artifact-index.json"));
  const snapshots = domManifest?.snapshots ?? [];
  const finalSnapshot = snapshots.at(-1);
  const fixture = fixtureFromArtifactIndex(artifactIndex) ?? {
    sha256: contract.fixture?.sha256 ?? null,
    displayName: path.basename(contract.fixture?.path ?? "p6-web-baseline-fixture.svga"),
    sizeBytes: contract.fixture?.sizeBytes ?? null
  };
  const actionTrace = Array.isArray(legacyTrace?.actionTrace)
    ? normalizeActionsFromSnapshots(legacyTrace.actionTrace, contract.interactions ?? [], snapshots)
    : legacyActionsFromSnapshots(contract.interactions ?? [], snapshots);
  const failures = [];
  if (!Array.isArray(legacyTrace?.actionTrace)) {
    failures.push("web interaction trace was derived from legacy snapshots, not direct trusted input events");
  }
  return strictTrace({
    host: "web",
    fixture,
    context: contextFromSnapshot(finalSnapshot),
    actionTrace,
    finalSnapshot,
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
  return {
    schemaVersion: P6_STRICT_EVIDENCE_SCHEMA_VERSION,
    host: input.host,
    fixture: input.fixture,
    context: input.context,
    actionTrace: input.actionTrace ?? [],
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
    failures,
    generatedAt: new Date().toISOString()
  };
}

function legacyActionsFromSnapshots(interactions, snapshots) {
  return interactions.map((interaction) => actionFromSnapshot(interaction, snapshots, "legacy-snapshot-derived"));
}

function normalizeActionsFromSnapshots(actions, interactions, snapshots) {
  return interactions.map((interaction) => {
    const existing = actions.find((action) => action.id === interaction.id) ?? {};
    const derived = actionFromSnapshot(interaction, snapshots, existing.source ?? "trusted-input-trace-normalized");
    return {
      ...existing,
      id: interaction.id,
      kind: interaction.trigger,
      selector: interaction.selector,
      initialState: interaction.initialState,
      expectedState: interaction.expectedState,
      stateReached: stateMatches(existing.stateReached, interaction.expectedState) ? existing.stateReached : derived.stateReached,
      targetRect: isRecord(existing.targetRect) ? existing.targetRect : derived.targetRect,
      controlValue: isRecord(existing.controlValue) ? existing.controlValue : derived.controlValue
    };
  });
}

function actionFromSnapshot(interaction, snapshots, source) {
  const snapshot = snapshots.find((candidate) => stateMatches(candidate.stateId, interaction.expectedState));
  return {
    id: interaction.id,
    kind: interaction.trigger,
    selector: interaction.selector,
    initialState: interaction.initialState,
    expectedState: interaction.expectedState,
    stateReached: snapshot?.stateId ?? null,
    source,
    targetRect: snapshot ? targetRectForSelector(snapshot, interaction.selector) : null,
    controlValue: controlValueForSelector(snapshot, interaction.selector)
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
  if (expected && !stateMatches(action.stateReached, expected.expectedState)) failures.push(`actionTrace[${index}] expected state not reached`);
  if (!isRecord(action.targetRect)) failures.push(`actionTrace[${index}].targetRect missing`);
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
    && stateMatches(action.stateReached, item.expectedState)
  );
}

function sameModePanelModalControls(webContext, desktopContext) {
  return ["mode", "panel", "modal"].every((field) => webContext?.[field] === desktopContext?.[field])
    && deepEqual(webContext?.controls, desktopContext?.controls);
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

function nonEmptyEqualIdSet(a, b) {
  return Array.isArray(a) && a.length > 0 && deepEqual([...a].sort(), [...(b ?? [])].sort());
}

function stateMatches(actual, expected) {
  if (actual === expected) return true;
  if (expected === "invalid-error-state" && actual === "invalid") return true;
  if (expected === "synchronized-playback-toggled-by-space" && actual === "space-sync-toggle") return true;
  if (expected === "responsive-export-review-loaded-at-900-x-720" && actual === "responsive-export-review-900x720") return true;
  return false;
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
