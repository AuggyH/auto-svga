import type { LayoutMode } from "./layoutTypes.js";
import { layoutTokens } from "./layoutTokens.js";

export function resolveLayoutMode(width: number): LayoutMode {
  if (width >= layoutTokens.modes.fullWorkbenchMinWidth) return "FULL_WORKBENCH";
  if (width >= layoutTokens.modes.compactWorkbenchMinWidth) return "COMPACT_WORKBENCH";
  return "MINIMAL_WORKBENCH";
}
