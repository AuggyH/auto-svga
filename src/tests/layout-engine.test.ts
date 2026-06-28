import assert from "node:assert/strict";
import test from "node:test";
import { layoutEngine } from "../layout/layoutEngine.js";
import { layoutMinTotal, layoutTokens } from "../layout/layoutTokens.js";
import { resolveLayoutMode } from "../layout/breakpoints.js";

test("macOS workbench layout modes are width driven and deterministic", () => {
  assert.equal(resolveLayoutMode(1440), "FULL_WORKBENCH");
  assert.equal(resolveLayoutMode(1280), "FULL_WORKBENCH");
  assert.equal(resolveLayoutMode(1279), "COMPACT_WORKBENCH");
  assert.equal(resolveLayoutMode(1064), "COMPACT_WORKBENCH");
  assert.equal(resolveLayoutMode(1063), "MINIMAL_WORKBENCH");
});

test("layout min total uses left, center, right, and two gaps", () => {
  assert.equal(
    layoutMinTotal,
    layoutTokens.left.min + layoutTokens.center.min + layoutTokens.right.min + layoutTokens.gap * 2
  );
  assert.equal(layoutMinTotal, 1072);
});

test("full workbench keeps left, center, and right visible", () => {
  const state = layoutEngine.resolve(1440, 900);
  assert.equal(state.mode, "FULL_WORKBENCH");
  assert.equal(state.left.collapsed, false);
  assert.equal(state.right.collapsed, false);
  assert.equal(state.center.collapsed, false);
  assert.equal(state.rightPresentation, "inline");
  assert.ok(state.left.width >= layoutTokens.left.min);
  assert.ok(state.right.width >= layoutTokens.right.min);
  assert.ok(state.center.width >= layoutTokens.center.min);
});

test("compact workbench collapses right panel before left panel", () => {
  const state = layoutEngine.resolve(1180, 760);
  assert.equal(state.mode, "COMPACT_WORKBENCH");
  assert.equal(state.left.collapsed, false);
  assert.equal(state.right.collapsed, true);
  assert.equal(state.right.width, layoutTokens.right.collapsed);
  assert.equal(state.rightPresentation, "drawer");
  assert.ok(state.center.width >= layoutTokens.center.min);
});

test("minimal workbench keeps center visible and collapses both side panels", () => {
  const state = layoutEngine.resolve(900, 720);
  assert.equal(state.mode, "MINIMAL_WORKBENCH");
  assert.equal(state.left.collapsed, true);
  assert.equal(state.right.collapsed, true);
  assert.equal(state.left.width, layoutTokens.left.collapsed);
  assert.equal(state.right.width, layoutTokens.right.collapsed);
  assert.equal(state.rightPresentation, "overlay");
  assert.equal(state.invariants.centerVisible, true);
  assert.ok(state.center.width >= layoutTokens.center.min);
});

test("user collapse requests cannot collapse the center region", () => {
  const state = layoutEngine.resolve(1440, 900, {
    leftCollapsed: true,
    rightCollapsed: true,
    preferredLeftWidth: 999,
    preferredRightWidth: 999
  });
  assert.equal(state.left.collapsed, true);
  assert.equal(state.right.collapsed, true);
  assert.equal(state.center.collapsed, false);
  assert.ok(state.center.width >= layoutTokens.center.min);
});

test("content invariants are explicit in every layout state", () => {
  for (const width of [1440, 1280, 1180, 1064, 900]) {
    const state = layoutEngine.resolve(width, 800);
    assert.equal(state.contentRules.fileNamesSingleLine, true);
    assert.equal(state.contentRules.badgesNoWrap, true);
    assert.equal(state.contentRules.metricsWrapOnlyInInspector, true);
    assert.equal(state.invariants.noPanelOverlap, true);
    assert.equal(state.invariants.noClippedInteractiveElements, true);
  }
});
