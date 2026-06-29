import type { LayoutEngine, LayoutState, LayoutUserPreferences } from "./layoutTypes.js";

const GAP = 16;
const WORKSPACE_PADDING_INLINE = 14;
const WORKSPACE_PADDING_BLOCK = 12;
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
const DEFAULT_HEIGHT = 760;

export const layoutMinTotal = LEFT_COLLAPSED + CENTER_MIN + RIGHT_COLLAPSED + GAP * 2 + WORKSPACE_PADDING_INLINE * 2;
export const layoutRuntimeCheckpoints = Object.freeze({
  compact: Object.freeze({ width: 1180, height: 760 }),
  minimal: Object.freeze({ width: 840, height: 720 })
});

function normalizeDimension(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.round(value);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function resolveLayoutMode(leftCollapsed: boolean, rightCollapsed: boolean): LayoutState["mode"] {
  if (!leftCollapsed && !rightCollapsed) return "FULL_WORKBENCH";
  if (!leftCollapsed && rightCollapsed) return "COMPACT_WORKBENCH";
  return "MINIMAL_WORKBENCH";
}

function resolveRightPresentation(leftCollapsed: boolean, rightCollapsed: boolean): LayoutState["rightPresentation"] {
  if (!rightCollapsed) return "inline";
  if (!leftCollapsed) return "drawer";
  return "overlay";
}

export const layoutEngine: LayoutEngine = Object.freeze({
  resolve(width: number, height: number, preferences: LayoutUserPreferences = {}): LayoutState {
    const viewportWidth = normalizeDimension(width, layoutMinTotal);
    const viewportHeight = normalizeDimension(height, DEFAULT_HEIGHT);
    const contentWidth = Math.max(CENTER_MIN, viewportWidth - WORKSPACE_PADDING_INLINE * 2);
    const contentHeight = Math.max(1, viewportHeight - WORKSPACE_PADDING_BLOCK * 2);
    const sidePanelBudget = Math.max(
      LEFT_COLLAPSED + RIGHT_COLLAPSED,
      contentWidth - CENTER_MIN - GAP * 2
    );
    const leftExpandedWidth = clamp(
      preferences.preferredLeftWidth ?? LEFT_DEFAULT,
      LEFT_MIN,
      Math.min(LEFT_MAX, Math.max(LEFT_MIN, sidePanelBudget - RIGHT_COLLAPSED))
    );
    const rightExpandedWidth = clamp(
      preferences.preferredRightWidth ?? RIGHT_DEFAULT,
      RIGHT_MIN,
      Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, sidePanelBudget - LEFT_COLLAPSED))
    );
    const logsWidth = clamp(preferences.preferredLogsWidth ?? LOGS_DEFAULT, LOGS_MIN, LOGS_MAX);
    let leftCollapsed = preferences.leftCollapsed === true;
    let rightCollapsed = preferences.rightCollapsed === true;
    if (!rightCollapsed && !leftCollapsed && leftExpandedWidth + rightExpandedWidth > sidePanelBudget) {
      rightCollapsed = true;
    }
    if (!leftCollapsed && leftExpandedWidth + (rightCollapsed ? RIGHT_COLLAPSED : rightExpandedWidth) > sidePanelBudget) {
      leftCollapsed = true;
    }
    if (!rightCollapsed && (leftCollapsed ? LEFT_COLLAPSED : leftExpandedWidth) + rightExpandedWidth > sidePanelBudget) {
      rightCollapsed = true;
    }
    const mode = resolveLayoutMode(leftCollapsed, rightCollapsed);
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
    const centerWidth = Math.max(CENTER_MIN, Math.round(contentWidth - left.width - right.width - GAP * 2));
    const floatingInfoDefaultWidth = clamp(RIGHT_DEFAULT, RIGHT_MIN, Math.min(RIGHT_MAX, contentWidth));
    const floatingInfoWidth = clamp(rightExpandedWidth, RIGHT_MIN, Math.min(RIGHT_MAX, contentWidth));
    const floatingLogsDefaultWidth = clamp(LOGS_DEFAULT, LOGS_MIN, Math.min(LOGS_MAX, contentWidth));
    const floatingLogsWidth = clamp(logsWidth, LOGS_MIN, Math.min(LOGS_MAX, contentWidth));
    return {
      width: viewportWidth,
      height: viewportHeight,
      mode,
      gap: GAP,
      paddingInline: WORKSPACE_PADDING_INLINE,
      paddingBlock: WORKSPACE_PADDING_BLOCK,
      contentWidth,
      contentHeight,
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
      rightPresentation: resolveRightPresentation(leftCollapsed, rightCollapsed),
      floatingPanels: {
        info: {
          width: floatingInfoWidth,
          defaultWidth: floatingInfoDefaultWidth,
          minWidth: Math.min(RIGHT_MIN, contentWidth),
          maxWidth: Math.min(RIGHT_MAX, contentWidth)
        },
        logs: {
          width: floatingLogsWidth,
          defaultWidth: floatingLogsDefaultWidth,
          minWidth: Math.min(LOGS_MIN, contentWidth),
          maxWidth: Math.min(LOGS_MAX, contentWidth)
        }
      },
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
