export type ShortTermHostMenuCommandRoute = "host" | "native" | "renderer" | "unsupported";

const HOST_ROUTED_MENU_COMMANDS = new Set([
  "openSvga",
  "openRecent",
  "clearRecent",
  "closeFile",
  "save",
  "saveAs",
  "runOptimization",
  "renameImageKey",
  "replaceImage"
]);

const NATIVE_DELEGATED_MENU_COMMANDS = new Set([
  "about",
  "hide",
  "hideOthers",
  "unhide",
  "quit",
  "undo",
  "redo",
  "cut",
  "copy",
  "paste",
  "selectAll",
  "minimize",
  "zoom",
  "front"
]);

const RENDERER_DELEGATED_MENU_COMMANDS = new Set([
  "playPause",
  "replay",
  "toggleCompare",
  "editTextPreview",
  "help",
  "showLogs"
]);

export function classifyShortTermHostMenuCommand(commandId: string): ShortTermHostMenuCommandRoute {
  const canonicalCommandId = canonicalShortTermHostMenuCommandId(commandId);
  if (HOST_ROUTED_MENU_COMMANDS.has(canonicalCommandId)) return "host";
  if (NATIVE_DELEGATED_MENU_COMMANDS.has(canonicalCommandId)) return "native";
  if (RENDERER_DELEGATED_MENU_COMMANDS.has(canonicalCommandId)) return "renderer";
  return "unsupported";
}

export function canonicalShortTermHostMenuCommandId(commandId: string): string {
  return commandId.startsWith("openRecent:") ? "openRecent" : commandId;
}

export function shortTermRecentFileIdFromMenuCommandId(commandId: string): string | undefined {
  if (!commandId.startsWith("openRecent:")) return undefined;
  const recentFileId = commandId.slice("openRecent:".length).trim();
  return recentFileId && recentFileId !== "empty" ? recentFileId : undefined;
}

export function isShortTermNativeDelegatedMenuCommand(commandId: string): boolean {
  return NATIVE_DELEGATED_MENU_COMMANDS.has(commandId);
}
