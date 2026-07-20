import assert from "node:assert/strict";
import test from "node:test";
import { layoutEngine, layoutMinTotal, layoutRuntimeCheckpoints } from "../layout/layoutEngine.js";
import { toWorkbenchLayoutProps } from "../layout/layoutAdapter.js";

test("macOS workbench layout modes are constraint driven and deterministic", () => {
  assert.equal(layoutEngine.resolve(1440, 900).mode, "FULL_WORKBENCH");
  assert.equal(layoutEngine.resolve(1280, 900).mode, "FULL_WORKBENCH");
  assert.equal(layoutEngine.resolve(1204, 900).mode, "FULL_WORKBENCH");
  assert.equal(layoutEngine.resolve(1203, 900).mode, "FULL_WORKBENCH");
  assert.equal(layoutEngine.resolve(1180, 900).mode, "FULL_WORKBENCH");
  assert.equal(layoutEngine.resolve(900, 900).mode, "FULL_WORKBENCH");
  assert.equal(layoutEngine.resolve(840, 900).mode, "FULL_WORKBENCH");
});

test("layout min total uses persistent sidebars, center, gaps, and padding", () => {
  assert.equal(layoutMinTotal, 1100);
});

test("full workbench keeps left, center, and right visible", () => {
  const state = layoutEngine.resolve(1440, 900);
  assert.equal(state.mode, "FULL_WORKBENCH");
  assert.equal(state.left.collapsed, false);
  assert.equal(state.right.collapsed, false);
  assert.equal(state.center.collapsed, false);
  assert.equal(state.rightPresentation, "inline");
  assert.equal(state.left.width, 336);
  assert.equal(state.right.width, 336);
  assert.ok(state.center.width >= 520);
});

test("minimum supported workbench keeps inspector visible without clipping", () => {
  const state = layoutEngine.resolve(1180, 760);
  assert.equal(state.mode, "FULL_WORKBENCH");
  assert.equal(state.left.collapsed, false);
  assert.equal(state.right.collapsed, false);
  assert.equal(state.left.width, 320);
  assert.equal(state.right.width, 280);
  assert.equal(state.rightPresentation, "inline");
  assert.ok(state.center.width >= 520);
});

test("legacy narrow workbench normalizes to the minimum persistent three-column layout", () => {
  const state = layoutEngine.resolve(840, 720);
  assert.equal(state.mode, "FULL_WORKBENCH");
  assert.equal(state.width, layoutMinTotal);
  assert.equal(state.left.collapsed, false);
  assert.equal(state.right.collapsed, false);
  assert.equal(state.left.width, 240);
  assert.equal(state.right.width, 280);
  assert.equal(state.rightPresentation, "inline");
  assert.equal(state.invariants.centerVisible, true);
  assert.ok(state.center.width >= 520);
});

test("user collapse requests are ignored because sidebars are persistent", () => {
  const state = layoutEngine.resolve(1440, 900, {
    leftCollapsed: true,
    rightCollapsed: true,
    preferredLeftWidth: 999,
    preferredRightWidth: 999
  });
  assert.equal(state.left.collapsed, false);
  assert.equal(state.right.collapsed, false);
  assert.equal(state.center.collapsed, false);
  assert.ok(state.center.width >= 520);
});

test("content invariants are explicit in every layout state", () => {
  for (const width of [1440, 1280, 1204, 1203, 1180, 900, 876, 875, 840]) {
    const state = layoutEngine.resolve(width, 800);
    assert.equal(state.contentRules.fileNamesSingleLine, true);
    assert.equal(state.contentRules.badgesNoWrap, true);
    assert.equal(state.contentRules.metricsWrapOnlyInInspector, true);
    assert.equal(state.invariants.noPanelOverlap, true);
    assert.equal(state.invariants.noClippedInteractiveElements, true);
  }
});

test("layout columns, gap, and padding close over the resolved viewport", () => {
  for (const width of [1440, 1280, 1204, 1203, 1180, 900, 876, 875, 840]) {
    const state = layoutEngine.resolve(width, 800);
    const occupiedWidth = state.left.width
      + state.center.width
      + state.right.width
      + state.gap * 2
      + state.paddingInline * 2;
    assert.equal(occupiedWidth, state.width);
    assert.equal(state.contentWidth, state.width - state.paddingInline * 2);
    assert.ok(state.center.width >= state.center.minWidth);
  }
});

test("supported and legacy stress widths keep both sidebars visible", () => {
  const compact = layoutEngine.resolve(
    layoutRuntimeCheckpoints.compact.width,
    layoutRuntimeCheckpoints.compact.height
  );
  assert.equal(compact.left.collapsed, false);
  assert.equal(compact.right.collapsed, false);
  assert.equal(compact.left.width, 320);
  assert.equal(compact.right.width, 280);
  assert.equal(compact.mode, "FULL_WORKBENCH");

  const minimal = layoutEngine.resolve(
    900,
    layoutRuntimeCheckpoints.minimal.height
  );
  assert.equal(minimal.left.collapsed, false);
  assert.equal(minimal.right.collapsed, false);
  assert.equal(minimal.width, layoutMinTotal);
  assert.equal(minimal.mode, "FULL_WORKBENCH");
});

test("runtime validation checkpoints stay owned by the layout engine", () => {
  assert.deepEqual(Object.keys(layoutRuntimeCheckpoints), ["compact", "minimal"]);
  const compact = layoutEngine.resolve(
    layoutRuntimeCheckpoints.compact.width,
    layoutRuntimeCheckpoints.compact.height
  );
  const minimal = layoutEngine.resolve(
    layoutRuntimeCheckpoints.minimal.width,
    layoutRuntimeCheckpoints.minimal.height
  );
  assert.equal(compact.mode, "FULL_WORKBENCH");
  assert.equal(compact.left.collapsed, false);
  assert.equal(compact.right.collapsed, false);
  assert.ok(compact.center.width >= compact.center.minWidth);
  assert.equal(minimal.mode, "FULL_WORKBENCH");
  assert.equal(minimal.left.collapsed, false);
  assert.equal(minimal.right.collapsed, false);
});

test("preferred panel widths are clamped before they can squeeze the center", () => {
  const state = layoutEngine.resolve(1204, 760, {
    preferredLeftWidth: 999,
    preferredRightWidth: 999
  });
  assert.equal(state.left.collapsed, false);
  assert.equal(state.right.collapsed, false);
  assert.equal(state.left.width, 344);
  assert.equal(state.right.width, 280);
  assert.ok(state.center.width >= state.center.minWidth);
});

test("layout adapter only maps engine output to UI props", () => {
  const state = layoutEngine.resolve(1180, 760, { preferredRightWidth: 999 });
  const props = toWorkbenchLayoutProps(state);
  assert.equal(props.workspace.sourceCollapsed, state.left.collapsed);
  assert.equal(props.workspace.inspectorCollapsed, state.right.collapsed);
  assert.equal(props.cssVariables["--layout-left-width"], `${state.left.width}px`);
  assert.equal(props.cssVariables["--layout-center-width"], `${state.center.width}px`);
  assert.equal(props.cssVariables["--layout-workspace-padding-inline"], `${state.paddingInline}px`);
  assert.equal(props.cssVariables["--layout-info-panel-width"], `${state.floatingPanels.info.width}px`);
  assert.equal(props.resize.infoPanel.width, state.floatingPanels.info.width);
  assert.equal(props.resize.infoPanel.defaultWidth, state.floatingPanels.info.defaultWidth);
});
