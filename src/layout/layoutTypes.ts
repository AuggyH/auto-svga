export type LayoutMode = "FULL_WORKBENCH" | "COMPACT_WORKBENCH" | "MINIMAL_WORKBENCH";

export type PanelRegion = "left" | "center" | "right";

export interface PanelLayout {
  readonly region: PanelRegion;
  readonly width: number;
  readonly collapsed: boolean;
  readonly minWidth: number;
  readonly maxWidth: number;
  readonly collapsedWidth: number;
  readonly expandedWidth: number;
}

export interface LayoutState {
  readonly width: number;
  readonly height: number;
  readonly mode: LayoutMode;
  readonly gap: number;
  readonly left: PanelLayout;
  readonly center: PanelLayout;
  readonly right: PanelLayout;
  readonly minTotal: number;
  readonly rightPresentation: "inline" | "drawer" | "overlay";
  readonly auxiliaryPanels: {
    readonly logs: {
      readonly width: number;
      readonly minWidth: number;
      readonly maxWidth: number;
    };
  };
  readonly contentRules: {
    readonly fileNamesSingleLine: boolean;
    readonly badgesNoWrap: boolean;
    readonly metricsWrapOnlyInInspector: boolean;
    readonly iconOnlyControlsAllowed: boolean;
  };
  readonly invariants: {
    readonly centerVisible: boolean;
    readonly noPanelOverlap: boolean;
    readonly noClippedInteractiveElements: boolean;
  };
}

export interface LayoutUserPreferences {
  readonly leftCollapsed?: boolean;
  readonly rightCollapsed?: boolean;
  readonly preferredLeftWidth?: number;
  readonly preferredRightWidth?: number;
  readonly preferredLogsWidth?: number;
}

export interface LayoutInput {
  readonly width: number;
  readonly height: number;
  readonly preferences?: LayoutUserPreferences;
}

export interface LayoutEngine {
  resolve(width: number, height: number, preferences?: LayoutUserPreferences): LayoutState;
}
