import type { LayoutState } from "./layoutTypes.js";

export interface WorkbenchLayoutProps {
  readonly cssVariables: Readonly<Record<string, string>>;
  readonly workspace: {
    readonly layoutMode: LayoutState["mode"];
    readonly rightPresentation: LayoutState["rightPresentation"];
    readonly sourceCollapsed: boolean;
    readonly inspectorCollapsed: boolean;
  };
  readonly source: {
    readonly collapsed: boolean;
  };
  readonly inspector: {
    readonly collapsed: boolean;
    readonly presentation: LayoutState["rightPresentation"];
  };
  readonly resize: {
    readonly infoPanel: {
      readonly width: number;
      readonly min: number;
      readonly max: number;
    };
    readonly logsPanel: {
      readonly width: number;
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
      "--layout-left-width": `${state.left.width}px`,
      "--layout-center-min-width": `${state.center.minWidth}px`,
      "--layout-right-width": `${state.right.width}px`,
      "--layout-right-expanded-width": `${state.right.expandedWidth}px`,
      "--layout-left-collapsed-width": `${state.left.collapsedWidth}px`,
      "--layout-right-collapsed-width": `${state.right.collapsedWidth}px`
    },
    workspace: {
      layoutMode: state.mode,
      rightPresentation: state.rightPresentation,
      sourceCollapsed: state.left.collapsed,
      inspectorCollapsed: state.right.collapsed
    },
    source: {
      collapsed: state.left.collapsed
    },
    inspector: {
      collapsed: state.right.collapsed,
      presentation: state.rightPresentation
    },
    resize: {
      infoPanel: {
        width: state.right.expandedWidth,
        min: state.right.minWidth,
        max: state.right.maxWidth
      },
      logsPanel: {
        width: state.auxiliaryPanels.logs.width,
        min: state.auxiliaryPanels.logs.minWidth,
        max: state.auxiliaryPanels.logs.maxWidth
      }
    },
    controls: {
      sourceTogglePressed: state.left.collapsed,
      inspectorTogglePressed: state.right.collapsed
    }
  };
}
