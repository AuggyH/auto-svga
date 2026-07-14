import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const {
  isWindowContainedInWorkArea,
  parseAcceptanceDisplayRequest,
  resolveAcceptanceLaunchPlacement,
  resolveNormalLaunchPlacement,
  windowPlacementRecordFromBounds
} = require("../short-term-window-bounds-policy.cjs");

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
      bounds: { x: 3000, y: 800, width: 900, height: 760 }
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
      bounds: { x: -9000, y: -9000, width: 900, height: 760 }
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
    bounds: { x: -320, y: 100, width: 640, height: 640 }
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
      bounds: { x: "120", y: 40, width: 640, height: 640 }
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
  const resolverIndex = source.indexOf("resolveInitialMultiFormatWindowPlacement()");
  const displaysIndex = source.indexOf("screen.getAllDisplays()", resolverIndex);
  const browserWindowIndex = source.indexOf("new BrowserWindow", resolverIndex);
  assert.ok(resolverIndex >= 0, "missing initial placement resolver");
  assert.ok(displaysIndex > resolverIndex, "online displays must resolve inside the initial placement boundary");
  assert.ok(browserWindowIndex > displaysIndex, "display placement must resolve before BrowserWindow construction");
  assert.match(source.slice(browserWindowIndex, browserWindowIndex + 900), /x: launchBounds\.x,[\s\S]*y: launchBounds\.y/u);
  assert.match(source, /normal-window-placement-v1\.json/u);
  assert.match(source, /readWindowPlacementPreference/u);
  assert.match(source, /writeWindowPlacementPreference/u);
  assert.match(source, /activeWindowPlacementMode !== "normal"/u);
  assert.match(source, /window\.on\("will-move"/u);
  assert.match(source, /window\.on\("will-resize"/u);
  assert.match(source, /window\.isMinimized\(\)[\s\S]*window\.isFullScreen\(\)[\s\S]*window\.isMaximized\(\)/u);
  assert.match(source, /app\.isPackaged[\s\S]*normalVisibleStartupMode[\s\S]*isMultiFormatDesktopProduct[\s\S]*source === "package-internal-trial"/u);
  assert.doesNotMatch(source, /AUTO_SVGA_(?:WINDOW|PLACEMENT)_(?:PATH|FILE)/u);
  assert.doesNotMatch(source, /--auto-svga-acceptance-(?:x|y|width|height)=/u);
});
