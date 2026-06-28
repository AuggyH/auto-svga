import { resolveLayoutMode } from "./breakpoints.js";
import { layoutMinTotal, layoutTokens } from "./layoutTokens.js";
import {
  resolveCenterWidth,
  resolveLeftPanel,
  resolveRightPanel,
  resolveRightPresentation
} from "./regionRules.js";
import type { LayoutEngine, LayoutState, LayoutUserPreferences } from "./layoutTypes.js";

function normalizeDimension(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.round(value);
}

export const layoutEngine: LayoutEngine = Object.freeze({
  resolve(width: number, height: number, preferences: LayoutUserPreferences = {}): LayoutState {
    const viewportWidth = normalizeDimension(width, layoutMinTotal);
    const viewportHeight = normalizeDimension(height, 760);
    const mode = resolveLayoutMode(viewportWidth);
    const left = resolveLeftPanel(mode, preferences);
    const right = resolveRightPanel(mode, preferences);
    const centerWidth = resolveCenterWidth(viewportWidth, left.width, right.width);
    return {
      width: viewportWidth,
      height: viewportHeight,
      mode,
      gap: layoutTokens.gap,
      left,
      center: {
        region: "center",
        width: centerWidth,
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

export function resolveWorkbenchLayout(width: number, height: number, preferences: LayoutUserPreferences = {}): LayoutState {
  return layoutEngine.resolve(width, height, preferences);
}

export type { LayoutState, LayoutUserPreferences };
