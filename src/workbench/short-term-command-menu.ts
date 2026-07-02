import type { ShortTermAppStateModel, ShortTermCommandState } from "./short-term-app-state.js";

export const SHORT_TERM_COMMAND_MENU_SCHEMA_VERSION = 1 as const;

export type ShortTermCommandMenuGroupId =
  | "app"
  | "file"
  | "edit"
  | "resource"
  | "optimize"
  | "playback"
  | "view"
  | "window"
  | "help";

export type ShortTermCommandMenuItemKind = "command" | "separator" | "submenu";

export type ShortTermNativeRole =
  | "about"
  | "hide"
  | "hideOthers"
  | "unhide"
  | "quit"
  | "undo"
  | "redo"
  | "cut"
  | "copy"
  | "paste"
  | "selectAll"
  | "minimize"
  | "zoom"
  | "front";

export interface ShortTermCommandMenuModel {
  schemaVersion: typeof SHORT_TERM_COMMAND_MENU_SCHEMA_VERSION;
  source: "short-term-command-menu";
  prdIds: readonly ["S1", "S2", "S14", "S16"];
  groups: readonly ShortTermCommandMenuGroup[];
}

export interface ShortTermCommandMenuGroup {
  id: ShortTermCommandMenuGroupId;
  label: string;
  items: readonly ShortTermCommandMenuItem[];
}

export interface ShortTermCommandMenuItem {
  id: string;
  kind: ShortTermCommandMenuItemKind;
  label?: string;
  enabled?: boolean;
  accelerator?: string;
  role?: ShortTermNativeRole;
  sourceCommandId?: string;
  reason?: string;
  recentFileId?: string;
  items?: readonly ShortTermCommandMenuItem[];
}

export function createShortTermCommandMenuModel(
  appState: ShortTermAppStateModel
): ShortTermCommandMenuModel {
  const lookup = new Map(appState.commands.map((command) => [command.id, command]));
  return {
    schemaVersion: SHORT_TERM_COMMAND_MENU_SCHEMA_VERSION,
    source: "short-term-command-menu",
    prdIds: ["S1", "S2", "S14", "S16"],
    groups: [
      menu("app", "Auto SVGA", [
        nativeItem("about", "关于 Auto SVGA", "about"),
        separator("app-system-separator"),
        nativeItem("hide", "隐藏 Auto SVGA", "hide"),
        nativeItem("hideOthers", "隐藏其他", "hideOthers"),
        nativeItem("unhide", "全部显示", "unhide"),
        separator("app-quit-separator"),
        nativeItem("quit", "退出 Auto SVGA", "quit")
      ]),
      menu("file", "File", [
        commandItem(requiredCommand(lookup, "openSvga")),
        recentSubmenu(requiredCommand(lookup, "openRecent"), appState),
        commandItem(requiredCommand(lookup, "clearRecent")),
        commandItem(requiredCommand(lookup, "closeFile")),
        separator("file-save-separator"),
        commandItem(requiredCommand(lookup, "save")),
        commandItem(requiredCommand(lookup, "saveAs"))
      ]),
      menu("edit", "Edit", [
        nativeItem("undo", "撤销", "undo", "Cmd+Z"),
        nativeItem("redo", "重做", "redo", "Shift+Cmd+Z"),
        separator("edit-text-separator"),
        nativeItem("cut", "剪切", "cut", "Cmd+X"),
        commandItem(requiredCommand(lookup, "copy"), { role: "copy" }),
        nativeItem("paste", "粘贴", "paste", "Cmd+V"),
        commandItem(requiredCommand(lookup, "selectAll"), { role: "selectAll" })
      ]),
      menu("resource", "Resource", [
        commandItem(requiredCommand(lookup, "renameImageKey")),
        commandItem(requiredCommand(lookup, "replaceImage"))
      ]),
      menu("optimize", "Optimize", [
        commandItem(requiredCommand(lookup, "runOptimization"))
      ]),
      menu("playback", "Playback", [
        commandItem(requiredCommand(lookup, "playPause")),
        commandItem(requiredCommand(lookup, "replay"))
      ]),
      menu("view", "View", [
        commandItem(requiredCommand(lookup, "toggleCompare"))
      ]),
      menu("window", "Window", [
        commandItem(requiredCommand(lookup, "minimize"), { role: "minimize" }),
        nativeItem("zoom", "缩放", "zoom"),
        nativeItem("front", "全部置于前台", "front")
      ]),
      menu("help", "Help", [
        commandItem(requiredCommand(lookup, "help"))
      ])
    ]
  };
}

export function flattenShortTermCommandMenuItems(
  menuModel: ShortTermCommandMenuModel
): ShortTermCommandMenuItem[] {
  return menuModel.groups.flatMap((group) => flattenItems(group.items));
}

function flattenItems(items: readonly ShortTermCommandMenuItem[]): ShortTermCommandMenuItem[] {
  return items.flatMap((item) => [
    item,
    ...(item.items ? flattenItems(item.items) : [])
  ]);
}

function requiredCommand(lookup: Map<string, ShortTermCommandState>, id: string): ShortTermCommandState {
  const command = lookup.get(id);
  if (!command) throw new Error(`Missing short-term command "${id}".`);
  return command;
}

function menu(
  id: ShortTermCommandMenuGroupId,
  label: string,
  items: readonly ShortTermCommandMenuItem[]
): ShortTermCommandMenuGroup {
  return { id, label, items };
}

function commandItem(
  command: ShortTermCommandState,
  options: { role?: ShortTermNativeRole } = {}
): ShortTermCommandMenuItem {
  return {
    id: command.id,
    kind: "command",
    label: command.label,
    enabled: command.enabled,
    ...(command.shortcut ? { accelerator: normalizeMacShortcut(command.shortcut) } : {}),
    ...(options.role ? { role: options.role } : {}),
    sourceCommandId: command.id,
    ...(!command.enabled && command.reason ? { reason: command.reason } : {})
  };
}

function nativeItem(
  id: string,
  label: string,
  role: ShortTermNativeRole,
  accelerator?: string
): ShortTermCommandMenuItem {
  return {
    id,
    kind: "command",
    label,
    enabled: true,
    role,
    ...(accelerator ? { accelerator: normalizeMacShortcut(accelerator) } : {})
  };
}

function recentSubmenu(
  command: ShortTermCommandState,
  appState: ShortTermAppStateModel
): ShortTermCommandMenuItem {
  const recentItems = appState.recentFiles.map((record) => ({
    id: `openRecent:${record.id}`,
    kind: "command" as const,
    label: record.displayName,
    enabled: command.enabled,
    sourceCommandId: command.id,
    recentFileId: record.id,
    ...(!command.enabled && command.reason ? { reason: command.reason } : {})
  }));
  return {
    id: "openRecent",
    kind: "submenu",
    label: command.label,
    enabled: command.enabled,
    sourceCommandId: command.id,
    ...(!command.enabled && command.reason ? { reason: command.reason } : {}),
    items: recentItems.length > 0 ? recentItems : [
      {
        id: "openRecent:empty",
        kind: "command",
        label: "暂无最近打开记录",
        enabled: false,
        sourceCommandId: command.id,
        reason: command.reason ?? "没有最近文件"
      }
    ]
  };
}

function separator(id: string): ShortTermCommandMenuItem {
  return { id, kind: "separator" };
}

function normalizeMacShortcut(shortcut: string): string {
  return shortcut
    .replace(/^Cmd\+/u, "Command+")
    .replace(/\+Cmd\+/u, "+Command+")
    .replace(/^Shift\+Cmd\+/u, "Shift+Command+");
}
