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
    saveStatus: "idle",
    resourceMenuReturnFocus: undefined,
    lastMenuStateSnapshot: ""
  };
}
