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
    renameImageKey: "",
    activeOutput: undefined,
    primaryPlayback: undefined,
    compareAPlayback: undefined,
    compareBPlayback: undefined,
    editPlayback: undefined,
    textPreview: "",
    textPreviewValues: {},
    saveStatus: "idle",
    appearance: loadStoredAppearance(),
    resourceMenuReturnFocus: undefined,
    lastMenuStateSnapshot: ""
  };
}
