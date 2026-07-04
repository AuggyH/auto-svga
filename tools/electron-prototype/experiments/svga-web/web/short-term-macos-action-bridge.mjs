import { closeOpenDialog } from "./short-term-macos-dialog-model.mjs";

export function installShortTermActionBridge({
  windowRef = window,
  documentRef = document,
  bridge,
  state,
  handlers
}) {
  windowRef.__autoSvgaShortTermActions = Object.freeze({
    openFromHostDialog: handlers.openFromHostDialog,
    openRecentFromMenu: handlers.openRecentFromMenu,
    clearRecentFiles: handlers.clearRecentFiles,
    closeFile: handlers.closeFile,
    save: () => handlers.saveActiveOutput("overwrite"),
    saveAs: () => handlers.saveActiveOutput("saveAs"),
    renameImageKey: handlers.renameSelectedImageKey,
    createSaveProofOutput: handlers.createSaveProofOutput,
    createSaveFailureProofOutput: handlers.createSaveFailureProofOutput,
    replaceImage: () => handlers.chooseReplacementImage(),
    resetImageReplacement: handlers.resetImageReplacement,
    editTextPreview: handlers.editRuntimeText,
    resetTextPreview: handlers.resetRuntimeText,
    runOptimization: handlers.runOptimization,
    showOptimizationComparison: handlers.showOptimizationComparison,
    openCompareB: handlers.openCompareBFromHost,
    playPause: handlers.togglePrimaryPlayback,
    replay: handlers.replayPrimary,
    previewMode: () => handlers.setMode("preview"),
    editMode: () => handlers.setMode("edit"),
    toggleCompare: () => (state.view === "compare" ? handlers.setMode("preview") : handlers.enterGeneralCompare()),
    overviewTab: () => handlers.openTab("overview"),
    optimizationTab: () => handlers.openTab("optimization"),
    replaceableTab: () => handlers.openTab("replaceable"),
    cancel: () => {
      closeOpenDialog(documentRef, "cancel");
      if (state.view === "compare") handlers.setMode("preview");
    },
    copyStateSummary: () => bridge?.writeClipboardText?.(handlers.currentStateSummary())
  });
}
