import type { LayoutState } from "./layoutTypes.js";

export interface WorkbenchLayoutProps {
  readonly cssVariables: Readonly<Record<string, string>>;
  readonly workspace: {
    readonly sourceCollapsed: boolean;
    readonly inspectorCollapsed: boolean;
  };
  readonly source: {
    readonly collapsed: boolean;
  };
  readonly inspector: {
    readonly collapsed: boolean;
  };
  readonly resize: {
    readonly infoPanel: {
      readonly width: number;
      readonly defaultWidth: number;
      readonly min: number;
      readonly max: number;
    };
    readonly logsPanel: {
      readonly width: number;
      readonly defaultWidth: number;
      readonly min: number;
      readonly max: number;
    };
  };
  readonly controls: {
    readonly sourceTogglePressed: boolean;
    readonly inspectorTogglePressed: boolean;
  };
}

export function toWorkbenchLayoutProps(state: LayoutState): WorkbenchLayoutProps {
  return {
    cssVariables: {
      "--layout-gap": `${state.gap}px`,
      "--layout-workspace-padding-inline": `${state.paddingInline}px`,
      "--layout-workspace-padding-block": `${state.paddingBlock}px`,
      "--layout-left-width": `${state.left.width}px`,
      "--layout-center-width": `${state.center.width}px`,
      "--layout-right-width": `${state.right.width}px`,
      "--layout-right-expanded-width": `${state.right.expandedWidth}px`,
      "--layout-left-collapsed-width": `${state.left.collapsedWidth}px`,
      "--layout-right-collapsed-width": `${state.right.collapsedWidth}px`,
      "--layout-info-panel-width": `${state.floatingPanels.info.width}px`,
      "--layout-info-panel-min-width": `${state.floatingPanels.info.minWidth}px`,
      "--layout-info-panel-max-width": `${state.floatingPanels.info.maxWidth}px`,
      "--layout-logs-panel-width": `${state.floatingPanels.logs.width}px`,
      "--layout-logs-panel-min-width": `${state.floatingPanels.logs.minWidth}px`,
      "--layout-logs-panel-max-width": `${state.floatingPanels.logs.maxWidth}px`
    },
    workspace: {
      sourceCollapsed: state.left.collapsed,
      inspectorCollapsed: state.right.collapsed
    },
    source: {
      collapsed: state.left.collapsed
    },
    inspector: {
      collapsed: state.right.collapsed
    },
    resize: {
      infoPanel: {
        width: state.floatingPanels.info.width,
        defaultWidth: state.floatingPanels.info.defaultWidth,
        min: state.floatingPanels.info.minWidth,
        max: state.floatingPanels.info.maxWidth
      },
      logsPanel: {
        width: state.floatingPanels.logs.width,
        defaultWidth: state.floatingPanels.logs.defaultWidth,
        min: state.floatingPanels.logs.minWidth,
        max: state.floatingPanels.logs.maxWidth
      }
    },
    controls: {
      sourceTogglePressed: state.left.collapsed,
      inspectorTogglePressed: state.right.collapsed
    }
  };
}
