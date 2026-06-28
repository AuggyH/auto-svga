import assert from "node:assert/strict";
import test from "node:test";
import { layoutEngine, layoutMinTotal } from "../layout/layoutEngine.js";
import { toWorkbenchLayoutProps } from "../layout/layoutAdapter.js";

test("macOS workbench layout modes are width driven and deterministic", () => {
  assert.equal(layoutEngine.resolve(1440, 900).mode, "FULL_WORKBENCH");
  assert.equal(layoutEngine.resolve(1280, 900).mode, "FULL_WORKBENCH");
  assert.equal(layoutEngine.resolve(1279, 900).mode, "COMPACT_WORKBENCH");
  assert.equal(layoutEngine.resolve(1064, 900).mode, "COMPACT_WORKBENCH");
  assert.equal(layoutEngine.resolve(1063, 900).mode, "MINIMAL_WORKBENCH");
});

test("layout min total uses left, center, right, and two gaps", () => {
  assert.equal(layoutMinTotal, 1072);
});

test("full workbench keeps left, center, and right visible", () => {
  const state = layoutEngine.resolve(1440, 900);
  assert.equal(state.mode, "FULL_WORKBENCH");
  assert.equal(state.left.collapsed, false);
  assert.equal(state.right.collapsed, false);
  assert.equal(state.center.collapsed, false);
  assert.equal(state.rightPresentation, "inline");
  assert.equal(state.left.width, 288);
  assert.equal(state.right.width, 336);
  assert.ok(state.center.width >= 520);
});

test("compact workbench collapses right panel before left panel", () => {
  const state = layoutEngine.resolve(1180, 760);
  assert.equal(state.mode, "COMPACT_WORKBENCH");
  assert.equal(state.left.collapsed, false);
  assert.equal(state.right.collapsed, true);
  assert.equal(state.right.width, 56);
  assert.equal(state.rightPresentation, "drawer");
  assert.ok(state.center.width >= 520);
});

test("minimal workbench keeps center visible and collapses both side panels", () => {
  const state = layoutEngine.resolve(900, 720);
  assert.equal(state.mode, "MINIMAL_WORKBENCH");
  assert.equal(state.left.collapsed, true);
  assert.equal(state.right.collapsed, true);
  assert.equal(state.left.width, 56);
  assert.equal(state.right.width, 56);
  assert.equal(state.rightPresentation, "overlay");
  assert.equal(state.invariants.centerVisible, true);
  assert.ok(state.center.width >= 520);
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
  assert.ok(state.center.width >= 520);
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

test("layout adapter only maps engine output to UI props", () => {
  const state = layoutEngine.resolve(1180, 760, { preferredRightWidth: 999 });
  const props = toWorkbenchLayoutProps(state);
  assert.equal(props.workspace.layoutMode, state.mode);
  assert.equal(props.workspace.sourceCollapsed, state.left.collapsed);
  assert.equal(props.workspace.inspectorCollapsed, state.right.collapsed);
  assert.equal(props.cssVariables["--layout-left-width"], `${state.left.width}px`);
  assert.equal(props.cssVariables["--layout-right-expanded-width"], `${state.right.expandedWidth}px`);
  assert.equal(props.resize.infoPanel.width, state.right.expandedWidth);
});
