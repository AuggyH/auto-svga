const layoutTokens = Object.freeze({
  gap: 16,
  left: Object.freeze({
    min: 240,
    max: 320,
    default: 288,
    collapsed: 56
  }),
  center: Object.freeze({
    min: 520
  }),
  right: Object.freeze({
    min: 280,
    max: 360,
    default: 336,
    collapsed: 56
  }),
  modes: Object.freeze({
    fullWorkbenchMinWidth: 1280,
    compactWorkbenchMinWidth: 1064
  })
});

const layoutMinTotal = layoutTokens.left.min
  + layoutTokens.center.min
  + layoutTokens.right.min
  + layoutTokens.gap * 2;

function resolveLayoutMode(width) {
  if (width >= layoutTokens.modes.fullWorkbenchMinWidth) return "FULL_WORKBENCH";
  if (width >= layoutTokens.modes.compactWorkbenchMinWidth) return "COMPACT_WORKBENCH";
  return "MINIMAL_WORKBENCH";
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function normalizeDimension(value, fallback) {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.round(value);
}

function resolveLeftPanel(mode, preferences = {}) {
  const collapsed = mode === "MINIMAL_WORKBENCH" || preferences.leftCollapsed === true;
  return {
    region: "left",
    width: collapsed
      ? layoutTokens.left.collapsed
      : clamp(preferences.preferredLeftWidth ?? layoutTokens.left.default, layoutTokens.left.min, layoutTokens.left.max),
    collapsed,
    minWidth: collapsed ? layoutTokens.left.collapsed : layoutTokens.left.min,
    maxWidth: collapsed ? layoutTokens.left.collapsed : layoutTokens.left.max
  };
}

function resolveRightPanel(mode, preferences = {}) {
  const collapsed = mode !== "FULL_WORKBENCH" || preferences.rightCollapsed === true;
  return {
    region: "right",
    width: collapsed
      ? layoutTokens.right.collapsed
      : clamp(preferences.preferredRightWidth ?? layoutTokens.right.default, layoutTokens.right.min, layoutTokens.right.max),
    collapsed,
    minWidth: collapsed ? layoutTokens.right.collapsed : layoutTokens.right.min,
    maxWidth: collapsed ? layoutTokens.right.collapsed : layoutTokens.right.max
  };
}

function resolveRightPresentation(mode) {
  if (mode === "FULL_WORKBENCH") return "inline";
  if (mode === "COMPACT_WORKBENCH") return "drawer";
  return "overlay";
}

function resolveCenterWidth(viewportWidth, leftWidth, rightWidth) {
  const remaining = viewportWidth - leftWidth - rightWidth - layoutTokens.gap * 2;
  return Math.max(layoutTokens.center.min, Math.round(remaining));
}

const layoutEngine = Object.freeze({
  resolve(width, height, preferences = {}) {
    const viewportWidth = normalizeDimension(width, layoutMinTotal);
    const viewportHeight = normalizeDimension(height, 760);
    const mode = resolveLayoutMode(viewportWidth);
    const left = resolveLeftPanel(mode, preferences);
    const right = resolveRightPanel(mode, preferences);
    return {
      width: viewportWidth,
      height: viewportHeight,
      mode,
      gap: layoutTokens.gap,
      left,
      center: {
        region: "center",
        width: resolveCenterWidth(viewportWidth, left.width, right.width),
        collapsed: false,
        minWidth: layoutTokens.center.min
      },
      right,
      minTotal: layoutMinTotal,
      rightPresentation: resolveRightPresentation(mode),
      contentRules: {
        fileNamesSingleLine: true,
        badgesNoWrap: true,
        metricsWrapOnlyInInspector: true,
        iconOnlyControlsAllowed: left.collapsed || right.collapsed
      },
      invariants: {
        centerVisible: true,
        noPanelOverlap: true,
        noClippedInteractiveElements: true
      }
    };
  }
});

export { layoutEngine, layoutMinTotal, layoutTokens, resolveLayoutMode };
