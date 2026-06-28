import { layoutMinTotal, layoutTokens } from "./layoutTokens.js";
import type { LayoutMode, LayoutUserPreferences } from "./layoutTypes.js";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

export function resolveLeftPanel(mode: LayoutMode, preferences: LayoutUserPreferences = {}) {
  const forcedCollapsed = mode === "MINIMAL_WORKBENCH";
  const collapsed = forcedCollapsed || preferences.leftCollapsed === true;
  return {
    region: "left" as const,
    width: collapsed
      ? layoutTokens.left.collapsed
      : clamp(preferences.preferredLeftWidth ?? layoutTokens.left.default, layoutTokens.left.min, layoutTokens.left.max),
    collapsed,
    minWidth: collapsed ? layoutTokens.left.collapsed : layoutTokens.left.min,
    maxWidth: collapsed ? layoutTokens.left.collapsed : layoutTokens.left.max
  };
}

export function resolveRightPanel(mode: LayoutMode, preferences: LayoutUserPreferences = {}) {
  const forcedCollapsed = mode !== "FULL_WORKBENCH";
  const collapsed = forcedCollapsed || preferences.rightCollapsed === true;
  return {
    region: "right" as const,
    width: collapsed
      ? layoutTokens.right.collapsed
      : clamp(preferences.preferredRightWidth ?? layoutTokens.right.default, layoutTokens.right.min, layoutTokens.right.max),
    collapsed,
    minWidth: collapsed ? layoutTokens.right.collapsed : layoutTokens.right.min,
    maxWidth: collapsed ? layoutTokens.right.collapsed : layoutTokens.right.max
  };
}

export function resolveRightPresentation(mode: LayoutMode): "inline" | "drawer" | "overlay" {
  if (mode === "FULL_WORKBENCH") return "inline";
  if (mode === "COMPACT_WORKBENCH") return "drawer";
  return "overlay";
}

export function resolveCenterWidth(viewportWidth: number, leftWidth: number, rightWidth: number): number {
  const remaining = viewportWidth - leftWidth - rightWidth - layoutTokens.gap * 2;
  return Math.max(layoutTokens.center.min, Math.round(remaining));
}

export { layoutMinTotal };
