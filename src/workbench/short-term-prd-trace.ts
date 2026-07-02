export type ShortTermPrdId =
  | "S1"
  | "S2"
  | "S3"
  | "S4"
  | "S5"
  | "S6"
  | "S7"
  | "S8"
  | "S9"
  | "S10"
  | "S11"
  | "S12"
  | "S13"
  | "S14"
  | "S15"
  | "S16";

export const SHORT_TERM_COMMAND_MENU_PRD_IDS: readonly ShortTermPrdId[] = [
  "S1",
  "S2",
  "S8",
  "S9",
  "S10",
  "S11",
  "S12",
  "S13",
  "S14",
  "S16"
];

export function shortTermPrdIdsForCommandMenuItem(commandId: string): readonly ShortTermPrdId[] {
  switch (canonicalShortTermPrdCommandId(commandId)) {
    case "openSvga":
      return ["S1", "S2"];
    case "openRecent":
      return ["S1", "S2", "S16"];
    case "clearRecent":
      return ["S16"];
    case "closeFile":
      return ["S1", "S14"];
    case "save":
    case "saveAs":
      return ["S14"];
    case "cancelTransientWorkflow":
      return ["S10", "S11", "S14"];
    case "toggleCompare":
      return ["S10"];
    case "playPause":
    case "replay":
      return ["S2"];
    case "renameImageKey":
      return ["S11", "S14"];
    case "replaceImage":
    case "resetImageReplacement":
      return ["S12", "S14"];
    case "editTextPreview":
    case "resetTextPreview":
      return ["S13"];
    case "runOptimization":
      return ["S8", "S9", "S10", "S14"];
    default:
      return [];
  }
}

export function shortTermPrdIdsForMenuDispatch(commandId: string): readonly ShortTermPrdId[] {
  switch (canonicalShortTermPrdCommandId(commandId)) {
    case "openSvga":
      return ["S1", "S2"];
    case "openRecent":
    case "clearRecent":
      return ["S1", "S2", "S16"];
    case "closeFile":
    case "quit":
      return ["S1", "S14"];
    case "save":
    case "saveAs":
      return ["S14"];
    case "cancelTransientWorkflow":
      return ["S10", "S11", "S14"];
    case "runOptimization":
      return ["S8", "S9", "S10", "S14"];
    case "renameImageKey":
      return ["S11", "S14"];
    case "replaceImage":
    case "resetImageReplacement":
      return ["S12", "S14"];
    case "editTextPreview":
    case "resetTextPreview":
      return ["S13"];
    case "playPause":
    case "replay":
      return ["S2"];
    case "toggleCompare":
      return ["S10"];
    default:
      return [];
  }
}

export function shortTermPrdIdsForHostAction(action: string): readonly ShortTermPrdId[] {
  switch (action) {
    case "openLocalFile":
      return ["S1", "S2"];
    case "openRecentFile":
    case "clearRecentFiles":
      return ["S1", "S2", "S16"];
    case "closeFile":
      return ["S1", "S14"];
    case "runOptimization":
      return ["S8", "S9", "S10", "S14"];
    case "renameImageKey":
      return ["S11", "S14"];
    case "replaceImage":
    case "resetImageReplacement":
      return ["S12", "S14"];
    case "prepareTextPreview":
    case "applyTextPreview":
    case "resetTextPreview":
      return ["S13"];
    case "reportPlaybackFailure":
    case "recoverPlayback":
      return ["S2"];
    case "save":
      return ["S14"];
    case "cancelTransientWorkflow":
      return ["S10", "S11", "S14"];
    case "menuDispatch":
      return ["S1", "S2", "S14", "S16"];
    default:
      return [];
  }
}

function canonicalShortTermPrdCommandId(commandId: string): string {
  return commandId.startsWith("openRecent:") ? "openRecent" : commandId;
}
