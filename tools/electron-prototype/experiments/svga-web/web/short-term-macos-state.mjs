import { loadStoredAppearance } from "./short-term-macos-appearance-model.mjs";

export function createShortTermInitialState() {
  return {
    view: "launch",
    tab: "overview",
    mode: "preview",
    sourceBytes: undefined,
    previewBytes: undefined,
    sourceId: "",
    displayName: "",
    model: undefined,
    selectedImageKey: "",
    selectedTextKey: "",
    assetFilter: "all",
    renameImageKey: "",
    renameSession: undefined,
    activeOutput: undefined,
    cleanSaveAsVisible: false,
    primaryPlaybackLooping: true,
    comparePlaybackLooping: true,
    editPlaybackLooping: true,
    primaryPlayback: undefined,
    compareAPlayback: undefined,
    compareBPlayback: undefined,
    compareBSource: undefined,
    editPlayback: undefined,
    textPreview: "",
    textPreviewValues: {},
    saveStatus: "idle",
    appearance: loadStoredAppearance(),
    resourceMenuReturnFocus: undefined,
    lastMenuStateSnapshot: "",
    lastWindowModeSnapshot: ""
  };
}
