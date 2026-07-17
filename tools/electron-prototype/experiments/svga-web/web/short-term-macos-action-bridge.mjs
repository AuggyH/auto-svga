import { closeOpenDialog } from "./short-term-macos-dialog-model.mjs";

export function installShortTermActionBridge({
  windowRef = window,
  documentRef = document,
  bridge,
  state,
  handlers
}) {
  const actions = {
    openFromHostDialog: handlers.openFromHostDialog,
    openRecentFromMenu: handlers.openRecentFromMenu,
    clearRecentFiles: handlers.clearRecentFiles,
    closeFile: handlers.closeFile,
    save: () => handlers.saveActiveOutput("overwrite"),
    saveAs: () => handlers.saveActiveOutput("saveAs"),
    renameImageKey: handlers.renameSelectedImageKey,
    createSaveProofOutput: handlers.createSaveProofOutput,
    createSaveFailureProofOutput: handlers.createSaveFailureProofOutput,
    selectImageKey: handlers.selectImageKey,
    replaceImage: () => handlers.chooseReplacementImage(),
    applyReplacementFile: handlers.applyReplacementFile,
    resetImageReplacement: handlers.resetImageReplacement,
    selectTextKey: handlers.selectTextKey,
    editTextPreview: handlers.editRuntimeText,
    updateTextPreview: handlers.updateRuntimeText,
    resetTextPreview: handlers.resetRuntimeText,
    openSettings: handlers.openSettings,
    setAppearance: handlers.setAppearance,
    runOptimization: handlers.runOptimization,
    showOptimizationComparison: handlers.showOptimizationComparison,
    openCompareB: handlers.openCompareBFromHost,
    playPause: handlers.togglePrimaryPlayback,
    replay: handlers.replayPrimary,
    toggleLoop: handlers.togglePrimaryPlaybackLoop,
    previewMode: () => handlers.setMode("preview"),
    editMode: () => handlers.setMode("edit"),
    toggleCompare: () => (state.view === "compare" ? handlers.setMode("preview") : handlers.enterGeneralCompare()),
    overviewTab: () => handlers.openTab("overview"),
    optimizationTab: () => handlers.openTab("optimization"),
    replaceableTab: () => handlers.openTab("replaceable"),
    currentStateSummary: handlers.currentStateSummary,
    refreshRuntimePreviewFrame: handlers.refreshRuntimePreviewFrame,
    cancel: () => {
      closeOpenDialog(documentRef, "cancel");
      if (state.view === "compare") handlers.setMode("preview");
    },
    copyStateSummary: () => bridge?.writeClipboardText?.(handlers.currentStateSummary())
  };
  if (typeof handlers.beginHostFileOpen === "function") actions.beginHostFileOpen = handlers.beginHostFileOpen;
  if (typeof handlers.completeHostFileOpen === "function") actions.completeHostFileOpen = handlers.completeHostFileOpen;
  if (typeof handlers.failHostFileOpen === "function") actions.failHostFileOpen = handlers.failHostFileOpen;
  windowRef.__autoSvgaShortTermActions = Object.freeze(actions);
}
