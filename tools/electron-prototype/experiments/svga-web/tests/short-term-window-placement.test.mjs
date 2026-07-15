import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const {
  isWindowContainedInWorkArea,
  normalizeWindowPlacementRecord,
  parseAcceptanceDisplayRequest,
  revalidateAcceptanceLaunchPlacement,
  resolveAcceptanceLaunchPlacement,
  resolveNormalLaunchPlacement,
  windowPlacementRecordFromBounds
} = require("../short-term-window-bounds-policy.cjs");
const {
  ACCEPTANCE_STARTUP_PLACEMENT_PROOF_FILE,
  buildAcceptanceStartupPlacementProof,
  writeAcceptanceStartupPlacementProof
} = require("../acceptance-startup-placement-proof.cjs");

const launchSize = { width: 640, height: 640 };
const minimumSize = { width: 640, height: 640 };
const primary = {
  id: 100,
  workArea: { x: 0, y: 24, width: 1440, height: 876 }
};
const secondary = {
  id: 200,
  workArea: { x: 1440, y: 0, width: 1920, height: 1080 }
};
const proofPrimary = {
  id: primary.id,
  bounds: { x: 0, y: 0, width: 1440, height: 900 },
  workArea: primary.workArea,
  scaleFactor: 2
};
const proofSecondary = {
  id: secondary.id,
  bounds: { x: 1440, y: 0, width: 1920, height: 1080 },
  workArea: secondary.workArea,
  scaleFactor: 2
};
const acceptedProofPlacement = {
  status: "accepted",
  mode: "acceptance",
  displayId: secondary.id,
  requestedDisplayId: secondary.id,
  executionId: "ASV-APR-20260715-089",
  bounds: { x: 2080, y: 220, width: 640, height: 640 },
  persist: false
};

function acceptedProofInput(overrides = {}) {
  return {
    artifactRoot: overrides.artifactRoot,
    placement: overrides.placement ?? acceptedProofPlacement,
    requestedDisplayId: overrides.requestedDisplayId ?? secondary.id,
    selectedDisplay: overrides.selectedDisplay ?? proofSecondary,
    primaryDisplay: overrides.primaryDisplay ?? proofPrimary,
    windowBounds: overrides.windowBounds ?? acceptedProofPlacement.bounds,
    runtimeInstanceId: "runtime-instance-proof",
    productMilestoneId: "0.2-multiformat-preview",
    headCommit: "57b8ef1f1ec55d872514766536f8b1c2df84156e",
    packagedRuntimeBuildInfo: {
      buildCommit: "57b8ef1f1ec55d872514766536f8b1c2df84156e",
      source: "package-internal-trial",
      productMilestoneId: "0.2-multiformat-preview",
      privatePath: "/must/not/appear"
    },
    generatedAt: "2026-07-15T08:00:00.000Z",
    ...overrides
  };
}

test("normal launch restores a validated placement and falls back before first frame", () => {
  const fallback = resolveNormalLaunchPlacement({
    storedPlacement: undefined,
    displays: [secondary, primary],
    primaryDisplay: primary,
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(fallback.status, "primaryFallback");
  assert.deepEqual(fallback.bounds, { x: 400, y: 142, width: 640, height: 640 });
  assert.equal(fallback.displayId, primary.id);
  assert.equal(isWindowContainedInWorkArea(fallback.bounds, primary.workArea), true);

  const restored = resolveNormalLaunchPlacement({
    storedPlacement: {
      schemaVersion: 1,
      source: "owner-normal-window",
      displayId: 200,
      bounds: { x: 3000, y: 800, width: 900, height: 760 },
      savedAt: "2026-07-15T08:00:00.000Z"
    },
    displays: [primary, secondary],
    primaryDisplay: primary,
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(restored.status, "restored");
  assert.equal(restored.displayId, secondary.id);
  assert.equal(isWindowContainedInWorkArea(restored.bounds, secondary.workArea), true);
  assert.deepEqual(restored.bounds, { x: 2460, y: 320, width: 900, height: 760 });

  const stale = resolveNormalLaunchPlacement({
    storedPlacement: {
      schemaVersion: 1,
      source: "owner-normal-window",
      displayId: 200,
      bounds: { x: -9000, y: -9000, width: 900, height: 760 },
      savedAt: "2026-07-15T08:00:00.000Z"
    },
    displays: [primary, secondary],
    primaryDisplay: primary,
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(stale.status, "primaryFallback");
  assert.equal(stale.reason, "placement_offline");
  assert.equal(stale.displayId, primary.id);
});

test("normal placement uses maximum display intersection with a deterministic tie", () => {
  const left = { id: 20, workArea: { x: -1000, y: 0, width: 1000, height: 900 } };
  const right = { id: 10, workArea: { x: 0, y: 0, width: 1000, height: 900 } };
  const placement = {
    schemaVersion: 1,
    source: "owner-normal-window",
    displayId: 20,
    bounds: { x: -320, y: 100, width: 640, height: 640 },
    savedAt: "2026-07-15T08:00:00.000Z"
  };
  const resolved = resolveNormalLaunchPlacement({
    storedPlacement: placement,
    displays: [left, right],
    primaryDisplay: right,
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(resolved.status, "restored");
  assert.equal(resolved.displayId, 10);
  assert.equal(isWindowContainedInWorkArea(resolved.bounds, right.workArea), true);
});

test("normal placement rejects malformed and undersized display inputs", () => {
  const malformed = resolveNormalLaunchPlacement({
    storedPlacement: {
      schemaVersion: 1,
      source: "owner-normal-window",
      displayId: 100,
      bounds: { x: "120", y: 40, width: 640, height: 640 },
      savedAt: "2026-07-15T08:00:00.000Z"
    },
    displays: [primary],
    primaryDisplay: primary,
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(malformed.status, "primaryFallback");
  assert.equal(malformed.reason, "placement_malformed");

  const tooSmallPrimary = resolveNormalLaunchPlacement({
    storedPlacement: undefined,
    displays: [{ id: 1, workArea: { x: 0, y: 0, width: 800, height: 600 } }],
    primaryDisplay: { id: 1, workArea: { x: 0, y: 0, width: 800, height: 600 } },
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(tooSmallPrimary.status, "rejected");
  assert.equal(tooSmallPrimary.reason, "primary_display_too_small");
});

test("normal placement schema is exact, integer-bound, and contains the full native frame", () => {
  const valid = {
    schemaVersion: 1,
    source: "owner-normal-window",
    displayId: 20,
    bounds: { x: -940, y: -180, width: 800, height: 700 },
    savedAt: "2026-07-15T08:00:00.000Z"
  };
  assert.deepEqual(normalizeWindowPlacementRecord(valid), valid);
  for (const malformed of [
    { ...valid, unexpected: true },
    { ...valid, displayId: undefined },
    { ...valid, savedAt: undefined },
    { ...valid, savedAt: "2026-07-15" },
    { ...valid, bounds: { ...valid.bounds, width: 800.5 } },
    { ...valid, bounds: { ...valid.bounds, extra: 1 } }
  ]) {
    assert.equal(normalizeWindowPlacementRecord(malformed), undefined);
  }

  const negativeDisplay = { id: 20, workArea: { x: -1200, y: -200, width: 1200, height: 900 } };
  const restored = resolveNormalLaunchPlacement({
    storedPlacement: valid,
    displays: [primary, negativeDisplay],
    primaryDisplay: primary,
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(restored.status, "restored");
  assert.equal(restored.displayId, 20);
  assert.equal(isWindowContainedInWorkArea(restored.bounds, negativeDisplay.workArea), true);
  assert.ok(restored.bounds.y >= negativeDisplay.workArea.y, "native titlebar must remain in the work area");
});

test("acceptance display input is singular, internal-only, and execution-bound", () => {
  const absent = parseAcceptanceDisplayRequest({
    argv: ["Auto SVGA"],
    environment: {},
    internalCandidate: true
  });
  assert.equal(absent.status, "absent");

  for (const fixture of [
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id=200"],
      environment: {},
      internalCandidate: true,
      reason: "acceptance_execution_unbound"
    },
    {
      argv: ["Auto SVGA"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
      internalCandidate: true,
      reason: "acceptance_display_missing"
    },
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id=200", "--auto-svga-acceptance-display-id=100"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
      internalCandidate: true,
      reason: "acceptance_display_duplicate"
    },
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id=2.5"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
      internalCandidate: true,
      reason: "acceptance_display_malformed"
    },
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id=4294967296"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
      internalCandidate: true,
      reason: "acceptance_display_malformed"
    },
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id", "200"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
      internalCandidate: true,
      reason: "acceptance_argument_forbidden"
    },
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id==200"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
      internalCandidate: true,
      reason: "acceptance_display_malformed"
    },
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id=+200"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
      internalCandidate: true,
      reason: "acceptance_display_malformed"
    },
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id=0200"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
      internalCandidate: true,
      reason: "acceptance_display_malformed"
    },
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id=200", "--auto-svga-acceptance-x=1440"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
      internalCandidate: true,
      reason: "acceptance_argument_forbidden"
    },
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id=200"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "short" },
      internalCandidate: true,
      reason: "acceptance_execution_malformed"
    },
    {
      argv: ["Auto SVGA", "--auto-svga-acceptance-display-id=200"],
      environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
      internalCandidate: false,
      reason: "acceptance_channel_forbidden"
    }
  ]) {
    const result = parseAcceptanceDisplayRequest(fixture);
    assert.equal(result.status, "rejected");
    assert.equal(result.reason, fixture.reason);
  }
});

test("accepted display is resolved before construction and never persists", () => {
  const request = parseAcceptanceDisplayRequest({
    argv: ["Auto SVGA", "--auto-svga-acceptance-display-id=200"],
    environment: { AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-APR-20260715-001" },
    internalCandidate: true
  });
  assert.equal(request.status, "accepted");

  const resolved = resolveAcceptanceLaunchPlacement({
    request,
    displays: [primary, secondary],
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(resolved.status, "accepted");
  assert.equal(resolved.displayId, secondary.id);
  assert.equal(resolved.persist, false);
  assert.equal(resolved.executionId, "ASV-APR-20260715-001");
  assert.deepEqual(resolved.bounds, { x: 2080, y: 220, width: 640, height: 640 });
  assert.equal(isWindowContainedInWorkArea(resolved.bounds, secondary.workArea), true);

  const unknown = resolveAcceptanceLaunchPlacement({
    request: { ...request, displayId: 999 },
    displays: [primary, secondary],
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(unknown.status, "rejected");
  assert.equal(unknown.reason, "acceptance_display_unknown");

  const duplicate = resolveAcceptanceLaunchPlacement({
    request,
    displays: [secondary, { ...secondary, workArea: { x: 0, y: 0, width: 800, height: 800 } }],
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(duplicate.status, "rejected");
  assert.equal(duplicate.reason, "acceptance_display_ambiguous");

  const tooSmall = resolveAcceptanceLaunchPlacement({
    request,
    displays: [{ id: 200, workArea: { x: -900, y: -100, width: 600, height: 600 } }],
    defaultSize: launchSize,
    minimumSize
  });
  assert.equal(tooSmall.status, "rejected");
  assert.equal(tooSmall.reason, "acceptance_display_too_small");

  const stable = revalidateAcceptanceLaunchPlacement({
    placement: resolved,
    displays: [primary, secondary],
    minimumSize
  });
  assert.equal(stable.status, "accepted");
  assert.deepEqual(stable.bounds, resolved.bounds);

  for (const changedDisplays of [
    [primary],
    [primary, { ...secondary, workArea: { ...secondary.workArea, height: 1040 } }],
    [primary, secondary, { ...secondary }]
  ]) {
    const drifted = revalidateAcceptanceLaunchPlacement({
      placement: resolved,
      displays: changedDisplays,
      minimumSize
    });
    assert.equal(drifted.status, "rejected");
    assert.match(drifted.reason, /^acceptance_display_(?:unknown|ambiguous|set_changed)$/u);
  }
});

test("acceptance startup placement proof writes a bounded pre-input artifact", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "auto-svga-acceptance-proof-"));
  try {
    const result = writeAcceptanceStartupPlacementProof(acceptedProofInput({ artifactRoot: root }));
    assert.equal(result.status, "written");
    assert.equal(result.fileName, ACCEPTANCE_STARTUP_PLACEMENT_PROOF_FILE);
    const proofPath = path.join(root, ACCEPTANCE_STARTUP_PLACEMENT_PROOF_FILE);
    assert.equal(existsSync(proofPath), true);
    const proofText = readFileSync(proofPath, "utf8");
    const proof = JSON.parse(proofText);
    assert.equal(proof.status, "accepted");
    assert.equal(proof.executionId, "ASV-APR-20260715-089");
    assert.equal(proof.requestedDisplayId, secondary.id);
    assert.equal(proof.resolvedDisplayId, secondary.id);
    assert.equal(proof.mainDisplayId, primary.id);
    assert.deepEqual(proof.windowBounds, acceptedProofPlacement.bounds);
    assert.equal(proof.selectedDisplay.id, secondary.id);
    assert.equal(proof.primaryDisplay.id, primary.id);
    assert.equal(proof.containment, true);
    assert.equal(proof.disjointFromPrimary, true);
    assert.equal(proof.placementMode, "acceptance");
    assert.equal(proof.runtimeInstanceId, "runtime-instance-proof");
    assert.equal(proof.productIdentity.productMilestoneId, "0.2-multiformat-preview");
    assert.equal(proof.productIdentity.packagedRuntimeBuildInfo.buildCommit, "57b8ef1f1ec55d872514766536f8b1c2df84156e");
    assert.equal(proof.productIdentity.packagedRuntimeBuildInfo.privatePath, undefined);
    assert.equal(proof.privacy.pathRedacted, true);
    assert.equal(proof.privacy.screenshots, false);
    assert.equal(proof.privacy.axTree, false);
    assert.equal(proof.privacy.materialNames, false);
    assert.equal(proof.privacy.ownerPreferenceMutated, false);
    assert.equal(proof.passed, true);
    assert.equal(proofText.includes(root), false);
    assert.equal(proofText.includes("/must/not/appear"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("acceptance startup placement proof rejects unsafe or inexact launches before product input", () => {
  const rejectionCases = [
    {
      name: "missing execution id",
      input: acceptedProofInput({ placement: { ...acceptedProofPlacement, executionId: "" } }),
      reason: "acceptance_execution_unbound"
    },
    {
      name: "wrong requested display",
      input: acceptedProofInput({ requestedDisplayId: 201 }),
      reason: "acceptance_display_mismatch"
    },
    {
      name: "window bounds drift",
      input: acceptedProofInput({ windowBounds: { ...acceptedProofPlacement.bounds, x: acceptedProofPlacement.bounds.x + 1 } }),
      reason: "acceptance_window_bounds_drift"
    },
    {
      name: "selected display is primary",
      input: acceptedProofInput({
        placement: { ...acceptedProofPlacement, displayId: primary.id, requestedDisplayId: primary.id, bounds: { x: 400, y: 142, width: 640, height: 640 } },
        requestedDisplayId: primary.id,
        selectedDisplay: proofPrimary,
        windowBounds: { x: 400, y: 142, width: 640, height: 640 }
      }),
      reason: "acceptance_primary_overlap"
    },
    {
      name: "window is outside selected display",
      input: acceptedProofInput({
        placement: { ...acceptedProofPlacement, bounds: { x: 120, y: 120, width: 640, height: 640 } },
        windowBounds: { x: 120, y: 120, width: 640, height: 640 }
      }),
      reason: "acceptance_window_not_contained"
    },
    {
      name: "runtime identity missing",
      input: acceptedProofInput({ runtimeInstanceId: "" }),
      reason: "acceptance_runtime_instance_missing"
    }
  ];
  for (const fixture of rejectionCases) {
    const result = buildAcceptanceStartupPlacementProof(fixture.input);
    assert.equal(result.status, "rejected", fixture.name);
    assert.equal(result.reason, fixture.reason, fixture.name);
  }

  const invalidRoot = writeAcceptanceStartupPlacementProof(acceptedProofInput({ artifactRoot: "relative-artifacts" }));
  assert.equal(invalidRoot.status, "rejected");
  assert.equal(invalidRoot.reason, "acceptance_artifact_root_invalid");

  const root = mkdtempSync(path.join(os.tmpdir(), "auto-svga-acceptance-proof-collision-"));
  try {
    assert.equal(writeAcceptanceStartupPlacementProof(acceptedProofInput({ artifactRoot: root })).status, "written");
    const collision = writeAcceptanceStartupPlacementProof(acceptedProofInput({ artifactRoot: root }));
    assert.equal(collision.status, "rejected");
    assert.equal(collision.reason, "acceptance_placement_proof_exists");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("only normal owner bounds become a placement preference", () => {
  const saved = windowPlacementRecordFromBounds({
    bounds: { x: 1500, y: 80, width: 1280, height: 800 },
    displayId: 200,
    workArea: secondary.workArea,
    windowState: { minimized: false, fullscreen: false, maximized: false },
    launchMode: "normal",
    savedAt: "2026-07-15T08:00:00.000Z"
  });
  assert.equal(saved.status, "accepted");
  assert.equal(saved.record.source, "owner-normal-window");
  assert.equal(saved.record.displayId, 200);

  for (const input of [
    { launchMode: "acceptance", windowState: { minimized: false, fullscreen: false, maximized: false } },
    { launchMode: "proof", windowState: { minimized: false, fullscreen: false, maximized: false } },
    { launchMode: "smoke", windowState: { minimized: false, fullscreen: false, maximized: false } },
    { launchMode: "audit", windowState: { minimized: false, fullscreen: false, maximized: false } },
    { launchMode: "normal", windowState: { minimized: true, fullscreen: false, maximized: false } },
    { launchMode: "normal", windowState: { minimized: false, fullscreen: true, maximized: false } },
    { launchMode: "normal", windowState: { minimized: false, fullscreen: false, maximized: true } }
  ]) {
    const result = windowPlacementRecordFromBounds({
      bounds: { x: 0, y: 0, width: 640, height: 640 },
      displayId: 100,
      savedAt: "2026-07-15T08:00:00.000Z",
      ...input
    });
    assert.equal(result.status, "ignored");
  }

  const outsideTitlebarContainment = windowPlacementRecordFromBounds({
    bounds: { x: 1500, y: -20, width: 1280, height: 800 },
    displayId: 200,
    workArea: secondary.workArea,
    windowState: { minimized: false, fullscreen: false, maximized: false },
    launchMode: "normal",
    savedAt: "2026-07-15T08:00:00.000Z"
  });
  assert.deepEqual(outsideTitlebarContainment, {
    status: "rejected",
    reason: "placement_out_of_bounds"
  });
});

test("main resolves placement before BrowserWindow and persists only owner-driven normal bounds", async () => {
  const source = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const policySource = await readFile(path.join(experimentRoot, "short-term-window-bounds-policy.cjs"), "utf8");
  const storeSource = await readFile(path.join(experimentRoot, "short-term-window-placement-store.cjs"), "utf8");
  const resolverIndex = source.indexOf("resolveInitialMultiFormatWindowPlacement()");
  const displaysIndex = source.indexOf("screen.getAllDisplays()", resolverIndex);
  const browserWindowIndex = source.indexOf("new BrowserWindow", resolverIndex);
  const proofImportIndex = source.indexOf("acceptance-startup-placement-proof.cjs");
  const proofCallIndex = source.indexOf("requireAcceptanceStartupPlacementProof(window, initialPlacement)", browserWindowIndex);
  const loadUrlIndex = source.indexOf("window.loadURL(rendererUrl)", browserWindowIndex);
  assert.ok(resolverIndex >= 0, "missing initial placement resolver");
  assert.ok(displaysIndex > resolverIndex, "online displays must resolve inside the initial placement boundary");
  assert.ok(browserWindowIndex > displaysIndex, "display placement must resolve before BrowserWindow construction");
  assert.ok(proofImportIndex >= 0, "missing acceptance startup placement proof contract import");
  assert.ok(proofCallIndex > browserWindowIndex, "acceptance placement proof must run after BrowserWindow construction");
  assert.ok(proofCallIndex < loadUrlIndex, "acceptance placement proof must run before renderer load or product input");
  assert.equal(source.match(/new BrowserWindow\s*\(/gu)?.length, 1, "startup must have one BrowserWindow constructor");
  assert.match(source, /app\.whenReady\(\)\.then\(createExperimentWindow\)/u);
  assert.match(source.slice(resolverIndex, browserWindowIndex), /revalidateAcceptanceLaunchPlacement[\s\S]*screen\.getAllDisplays\(\)/u);
  assert.match(source.slice(browserWindowIndex, browserWindowIndex + 900), /x: launchBounds\.x,[\s\S]*y: launchBounds\.y/u);
  const createStart = source.indexOf("async function createExperimentWindow()");
  const ownershipIndex = source.indexOf("activeMainWindow = window", browserWindowIndex);
  const initialConstructionBody = source.slice(createStart, ownershipIndex);
  assert.doesNotMatch(initialConstructionBody, /\.(?:setBounds|setPosition|center)\s*\(/u);
  assert.match(source, /process\.env\.AUTO_SVGA_PRODUCT_ARTIFACTS/u);
  assert.match(source, /window\.destroy\(\)[\s\S]*window_placement_rejected/u);
  assert.match(source, /normal-window-placement-v1\.json/u);
  assert.match(source, /readWindowPlacementPreference/u);
  assert.match(source, /writeWindowPlacementPreference/u);
  assert.match(source, /activeWindowPlacementMode !== "normal"/u);
  assert.match(source, /window\.on\("will-move"/u);
  assert.match(source, /window\.on\("will-resize"/u);
  assert.match(source, /window\.isMinimized\(\)[\s\S]*window\.isFullScreen\(\)[\s\S]*window\.isMaximized\(\)/u);
  assert.match(source, /app\.isPackaged[\s\S]*normalVisibleStartupMode[\s\S]*isMultiFormatDesktopProduct[\s\S]*source === "package-internal-trial"/u);
  assert.match(policySource, /function parseAcceptanceDisplayRequest/u);
  assert.match(policySource, /AUTO_SVGA_ACCEPTANCE_EXECUTION_ID/u);
  assert.match(policySource, /function revalidateAcceptanceLaunchPlacement/u);
  assert.match(storeSource, /O_NOFOLLOW/u);
  assert.match(storeSource, /fstatSync/u);
  assert.match(storeSource, /linkSync/u);
  assert.doesNotMatch(source, /AUTO_SVGA_(?:WINDOW|PLACEMENT)_(?:PATH|FILE)/u);
  assert.doesNotMatch(source, /--auto-svga-acceptance-(?:x|y|width|height)=/u);
});
