import type { LayoutEngine, LayoutState, LayoutUserPreferences } from "./layoutTypes.js";

const GAP = 16;
const LEFT_MIN = 240;
const LEFT_MAX = 320;
const LEFT_DEFAULT = 288;
const LEFT_COLLAPSED = 56;
const CENTER_MIN = 520;
const RIGHT_MIN = 280;
const RIGHT_MAX = 360;
const RIGHT_DEFAULT = 336;
const RIGHT_COLLAPSED = 56;
const LOGS_MIN = 320;
const LOGS_MAX = 480;
const LOGS_DEFAULT = 440;
const FULL_WORKBENCH_MIN_WIDTH = 1280;
const COMPACT_WORKBENCH_MIN_WIDTH = 1064;
const DEFAULT_HEIGHT = 760;

export const layoutMinTotal = LEFT_MIN + CENTER_MIN + RIGHT_MIN + GAP * 2;

function normalizeDimension(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.round(value);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function resolveLayoutMode(width: number) {
  if (width >= FULL_WORKBENCH_MIN_WIDTH) return "FULL_WORKBENCH";
  if (width >= COMPACT_WORKBENCH_MIN_WIDTH) return "COMPACT_WORKBENCH";
  return "MINIMAL_WORKBENCH";
}

function resolveRightPresentation(mode: LayoutState["mode"]): LayoutState["rightPresentation"] {
  if (mode === "FULL_WORKBENCH") return "inline";
  if (mode === "COMPACT_WORKBENCH") return "drawer";
  return "overlay";
}

export const layoutEngine: LayoutEngine = Object.freeze({
  resolve(width: number, height: number, preferences: LayoutUserPreferences = {}): LayoutState {
    const viewportWidth = normalizeDimension(width, layoutMinTotal);
    const viewportHeight = normalizeDimension(height, DEFAULT_HEIGHT);
    const mode = resolveLayoutMode(viewportWidth);
    const leftExpandedWidth = clamp(preferences.preferredLeftWidth ?? LEFT_DEFAULT, LEFT_MIN, LEFT_MAX);
    const rightExpandedWidth = clamp(preferences.preferredRightWidth ?? RIGHT_DEFAULT, RIGHT_MIN, RIGHT_MAX);
    const logsWidth = clamp(preferences.preferredLogsWidth ?? LOGS_DEFAULT, LOGS_MIN, LOGS_MAX);
    const leftCollapsed = mode === "MINIMAL_WORKBENCH" || preferences.leftCollapsed === true;
    const rightCollapsed = mode !== "FULL_WORKBENCH" || preferences.rightCollapsed === true;
    const left = {
      region: "left" as const,
      width: leftCollapsed ? LEFT_COLLAPSED : leftExpandedWidth,
      collapsed: leftCollapsed,
      minWidth: leftCollapsed ? LEFT_COLLAPSED : LEFT_MIN,
      maxWidth: leftCollapsed ? LEFT_COLLAPSED : LEFT_MAX,
      collapsedWidth: LEFT_COLLAPSED,
      expandedWidth: leftExpandedWidth
    };
    const right = {
      region: "right" as const,
      width: rightCollapsed ? RIGHT_COLLAPSED : rightExpandedWidth,
      collapsed: rightCollapsed,
      minWidth: rightCollapsed ? RIGHT_COLLAPSED : RIGHT_MIN,
      maxWidth: rightCollapsed ? RIGHT_COLLAPSED : RIGHT_MAX,
      collapsedWidth: RIGHT_COLLAPSED,
      expandedWidth: rightExpandedWidth
    };
    const centerWidth = Math.max(CENTER_MIN, Math.round(viewportWidth - left.width - right.width - GAP * 2));
    return {
      width: viewportWidth,
      height: viewportHeight,
      mode,
      gap: GAP,
      left,
      center: {
        region: "center",
        width: centerWidth,
        collapsed: false,
        minWidth: CENTER_MIN,
        maxWidth: centerWidth,
        collapsedWidth: CENTER_MIN,
        expandedWidth: centerWidth
      },
      right,
      minTotal: layoutMinTotal,
      rightPresentation: resolveRightPresentation(mode),
      auxiliaryPanels: {
        logs: {
          width: logsWidth,
          minWidth: LOGS_MIN,
          maxWidth: LOGS_MAX
        }
      },
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
