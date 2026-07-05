import { buildCommandState } from "./short-term-macos-command-state.mjs";
import { applyCommandState } from "./short-term-macos-dom-state.mjs";
import { syncShortTermMenuState } from "./short-term-macos-host-client.mjs";
import { hasOpenDialog } from "./short-term-macos-dialog-model.mjs";

export function renderShortTermCommandSurface({ bridge, documentRef = document, state, canEditText }) {
  const commandState = buildCommandState({
    view: state.view,
    mode: state.mode,
    tab: state.tab,
    hasFile: Boolean(state.sourceBytes),
    activeOutput: state.activeOutput,
    appearance: state.appearance,
    saveStatus: state.saveStatus,
    sourceId: state.sourceId,
    cleanSaveAsVisible: state.cleanSaveAsVisible,
    optimizationBatchActionEnabled: state.model?.optimization?.batchActionEnabled === true,
    selectedImageKey: state.selectedImageKey,
    canEditText: canEditText === true,
    textPreviewValues: state.textPreviewValues,
    primaryPlaybackPlaying: state.primaryPlayback?.playing === true,
    renameImageKey: state.renameImageKey,
    dialogOpen: hasOpenDialog(documentRef)
  });
  applyCommandState(commandState);
  return syncShortTermMenuState(
    bridge,
    commandState.menuState,
    state.lastMenuStateSnapshot
  );
}
