import {
  applyModeButtons,
  applyViewState
} from "./short-term-macos-dom-state.mjs";
import { renderDiscardMessage } from "./short-term-macos-state-renderers.mjs";
import { inspectShortTermSvga } from "./short-term-macos-api-client.mjs";
import { confirmDiscardUnsavedOutput as confirmDiscardDialogOutput } from "./short-term-macos-dialog-model.mjs";
import { renderShortTermCommandSurface } from "./short-term-macos-command-surface.mjs";
import {
  clearShortTermRecentFiles,
  refreshShortTermRecentFiles
} from "./short-term-macos-recent-files-surface.mjs";
import {
  shortTermCurrentStateSummary,
  showShortTermFailure,
  showShortTermOperationFailure
} from "./short-term-macos-feedback-surface.mjs";
import {
  clearShortTermPlaybackCanvas,
  mountShortTermPlayback,
  replayShortTermPrimaryPlayback,
  stopAllShortTermPlayback,
  stopShortTermPlayback,
  toggleShortTermPrimaryPlayback
} from "./short-term-macos-playback-surface.mjs";
import {
  enterShortTermGeneralCompare,
  openShortTermCompareBFromHost,
  renderShortTermCompareInfo,
  renderShortTermCompareSlot
} from "./short-term-macos-compare-surface.mjs";
import {
  closeShortTermResourceMenu,
  handleShortTermResourceMenuKeydown,
  openShortTermKeyboardResourceMenu,
  openShortTermResourceMenu
} from "./short-term-macos-resource-menu-surface.mjs";
import {
  handleShortTermTabListKeydown,
  openShortTermTab,
  setShortTermTab
} from "./short-term-macos-navigation-surface.mjs";
import {
  applyShortTermReplacementFile,
  beginShortTermImageKeyRename,
  cancelShortTermInlineRename,
  chooseShortTermReplacementImage,
  confirmShortTermInlineRename,
  renderShortTermReplaceableImages,
  renderShortTermRuntimeTextElements,
  resetShortTermImageReplacement,
  selectShortTermImageKey,
  selectShortTermRuntimeTextElement,
  selectedShortTermRuntimeTextElement
} from "./short-term-macos-replaceable-surface.mjs";
import {
  clearShortTermTransientOutput,
  setShortTermActiveOutput,
  showShortTermOutputBanner
} from "./short-term-macos-output-surface.mjs";
import {
  closeShortTermSourceFile,
  loadShortTermDroppedFile,
  loadShortTermOpenedSource,
  openShortTermRecentSource,
  openShortTermSourceFromHostDialog
} from "./short-term-macos-file-surface.mjs";
import {
  createShortTermSaveFailureProofOutput,
  createShortTermSaveProofOutput,
  saveShortTermActiveOutput
} from "./short-term-macos-save-surface.mjs";
import {
  editShortTermRuntimeTextPreview,
  resetShortTermRuntimeTextPreview
} from "./short-term-macos-runtime-text-surface.mjs";
import {
  renderShortTermOptimization,
  runShortTermOptimizationWorkflow,
  showShortTermOptimizationComparison
} from "./short-term-macos-optimization-surface.mjs";
import {
  renderShortTermEditReserved,
  renderShortTermPreviewModel
} from "./short-term-macos-preview-surface.mjs";

export function createShortTermAppController({ bridge, nodes, state }) {
  function setView(view) {
    state.view = view;
    applyViewState(nodes.app, view);
    renderCommandState();
  }

  function setMode(mode) {
    state.mode = mode;
    applyModeButtons(mode);
    if (!state.sourceBytes) {
      setView("launch");
      return;
    }
    if (mode === "edit") {
      setView("edit");
      renderEditReserved();
      mountPlayback("edit", nodes.editCanvas, state.previewBytes ?? state.sourceBytes).catch(showFailure);
      return;
    }
    setView("preview");
    mountPlayback("primary", nodes.primaryCanvas, state.previewBytes ?? state.sourceBytes).catch(showFailure);
  }

  async function openFromHostDialog() {
    return openShortTermSourceFromHostDialog({
      bridge,
      confirmDiscardUnsavedOutput,
      loadOpenedSource,
      refreshRecentFiles,
      showFailure
    });
  }

  async function openRecentFromMenu(recentFileId) {
    return openShortTermRecentSource({
      bridge,
      nodes,
      state,
      recentFileId,
      confirmDiscardUnsavedOutput,
      setView,
      loadOpenedSource,
      refreshRecentFiles,
      showFailure
    });
  }

  async function openCompareBFromHost() {
    return openShortTermCompareBFromHost({
      bridge,
      nodes,
      state,
      openFromHostDialog,
      enterGeneralCompare,
      inspectShortTerm,
      mountPlayback,
      refreshRecentFiles
    });
  }

  async function loadDroppedFile(file) {
    return loadShortTermDroppedFile({
      file,
      confirmDiscardUnsavedOutput,
      loadOpenedSource
    });
  }

  async function loadOpenedSource({ bytes, displayName, sourceId }) {
    return loadShortTermOpenedSource({
      nodes,
      state,
      bytes,
      displayName,
      sourceId,
      clearTransientOutput,
      setView,
      inspectShortTerm,
      renderPreviewModel,
      mountPrimaryPlayback: (nextBytes) => mountPlayback("primary", nodes.primaryCanvas, nextBytes),
      stopAllPlayback,
      showFailure
    });
  }

  async function closeFile() {
    return closeShortTermSourceFile({
      nodes,
      state,
      confirmDiscardUnsavedOutput,
      stopAllPlayback,
      setTab,
      setView,
      refreshRecentFiles
    });
  }

  async function inspectShortTerm(bytes, name) {
    return inspectShortTermSvga({ bytes, name, reportToken: bridge?.reportToken });
  }

  async function runOptimization() {
    return runShortTermOptimizationWorkflow({
      bridge,
      nodes,
      state,
      confirmDiscardUnsavedOutput,
      setTab,
      setView,
      showSaveBanner,
      setActiveOutput,
      setCompareSlot,
      renderCompareInfo,
      mountPlayback,
      showOperationFailure
    });
  }

  async function renameSelectedImageKey() {
    return beginShortTermImageKeyRename({
      nodes,
      state,
      confirmDiscardUnsavedOutput,
      setMode,
      setTab
    });
  }

  async function confirmInlineRename() {
    return confirmShortTermInlineRename({
      bridge,
      nodes,
      state,
      inspectShortTerm,
      setActiveOutput,
      renderPreviewModel,
      mountPrimaryPlayback: (bytes) => mountPlayback("primary", nodes.primaryCanvas, bytes),
      showSaveBanner,
      showOperationFailure
    });
  }

  async function createSaveProofOutput(suffix) {
    return createShortTermSaveProofOutput({
      state,
      suffix,
      reportToken: bridge?.reportToken,
      inspectShortTerm,
      setActiveOutput,
      renderPreviewModel,
      mountPrimaryPlayback: (bytes) => mountPlayback("primary", nodes.primaryCanvas, bytes),
      showSaveBanner
    });
  }

  function createSaveFailureProofOutput() {
    createShortTermSaveFailureProofOutput({ state, setActiveOutput });
  }

  function cancelInlineRename() {
    cancelShortTermInlineRename({ nodes, state });
  }

  function chooseReplacementImage(imageKey = state.selectedImageKey) {
    chooseShortTermReplacementImage({ nodes, state, imageKey });
  }

  async function applyReplacementFile(file) {
    return applyShortTermReplacementFile({
      bridge,
      file,
      state,
      confirmDiscardUnsavedOutput,
      inspectShortTerm,
      setActiveOutput,
      renderPreviewModel,
      mountPrimaryPlayback: (bytes) => mountPlayback("primary", nodes.primaryCanvas, bytes),
      showSaveBanner,
      showOperationFailure
    });
  }

  async function resetImageReplacement() {
    return resetShortTermImageReplacement({
      state,
      inspectShortTerm,
      clearTransientOutput,
      renderPreviewModel,
      mountPrimaryPlayback: (bytes) => mountPlayback("primary", nodes.primaryCanvas, bytes)
    });
  }

  async function editRuntimeText() {
    await editShortTermRuntimeTextPreview({
      nodes,
      state,
      textElement: selectedTextElement(),
      showSaveBanner,
      renderTextElements,
      renderCommandState
    });
  }

  function resetRuntimeText() {
    resetShortTermRuntimeTextPreview({
      nodes,
      state,
      renderTextElements,
      renderCommandState
    });
  }

  async function saveActiveOutput(command) {
    return saveShortTermActiveOutput({
      bridge,
      command,
      state,
      inspectShortTerm,
      clearTransientOutput,
      renderPreviewModel,
      renderCommandState,
      mountPrimaryPlayback: (bytes) => mountPlayback("primary", nodes.primaryCanvas, bytes),
      refreshRecentFiles,
      showSaveBanner
    });
  }

  function setActiveOutput({ kind, bytes, suggestedName, title, summary, details }) {
    setShortTermActiveOutput({
      nodes,
      state,
      output: { kind, bytes, suggestedName, title, summary, details },
      onOutputStateChange: renderCommandState
    });
  }

  function clearTransientOutput() {
    clearShortTermTransientOutput({ nodes, state, onOutputStateChange: renderCommandState });
  }

  async function confirmDiscardUnsavedOutput(message) {
    return confirmDiscardDialogOutput({
      hasActiveOutput: Boolean(state.activeOutput),
      message,
      dialog: nodes.discardDialog,
      renderMessage: (copy) => renderDiscardMessage(nodes, copy),
      onDialogStateChange: renderCommandState
    });
  }

  function renderPreviewModel() {
    renderShortTermPreviewModel({ nodes, state });
  }

  function renderOptimization(model) {
    renderShortTermOptimization({ nodes, model });
  }

  function renderReplaceables(model) {
    renderShortTermReplaceableImages({ nodes, state, model });
  }

  function renderTextElements(model) {
    renderShortTermRuntimeTextElements({ nodes, state, model });
  }

  function selectTextKey(textKey) {
    selectShortTermRuntimeTextElement({ nodes, state, textKey });
  }

  function selectedTextElement() {
    return selectedShortTermRuntimeTextElement(state);
  }

  function selectImageKey(imageKey) {
    selectShortTermImageKey({ nodes, state, imageKey });
  }

  function openKeyboardResourceContextMenu(row) {
    openShortTermKeyboardResourceMenu({ nodes, state, row, selectImageKey });
  }

  function openResourceContextMenu(event, imageKey, returnFocus = undefined) {
    openShortTermResourceMenu({ nodes, state, event, imageKey, returnFocus, selectImageKey });
  }

  function closeResourceContextMenu({ restoreFocus = false } = {}) {
    closeShortTermResourceMenu({ nodes, state, restoreFocus });
  }

  function renderEditReserved() {
    renderShortTermEditReserved({ nodes, state });
  }

  async function showOptimizationComparison() {
    await showShortTermOptimizationComparison({
      nodes,
      state,
      setView,
      setCompareSlot,
      renderCompareInfo,
      mountPlayback
    });
  }

  function setCompareSlot(slot, title, model, fallbackMeta = "") {
    renderShortTermCompareSlot({ nodes, slot, title, model, fallbackMeta });
  }

  function renderCompareInfo(slot, title, model, displayName, actions = []) {
    renderShortTermCompareInfo({ nodes, slot, title, model, displayName, actions });
  }

  async function enterGeneralCompare() {
    return enterShortTermGeneralCompare({
      nodes,
      state,
      setView,
      mountPlayback,
      clearCanvas
    });
  }

  async function mountPlayback(key, canvas, bytes, options = {}) {
    return mountShortTermPlayback({
      state,
      key,
      canvas,
      bytes,
      options,
      onPlaybackStateChange: renderCommandState
    });
  }

  function stopPlayback(key) {
    stopShortTermPlayback({ state, key });
  }

  function stopAllPlayback() {
    stopAllShortTermPlayback(state);
  }

  function togglePrimaryPlayback() {
    toggleShortTermPrimaryPlayback({ state, onPlaybackStateChange: renderCommandState });
  }

  function replayPrimary() {
    replayShortTermPrimaryPlayback({ state, onPlaybackStateChange: renderCommandState });
  }

  function clearCanvas(canvas) {
    clearShortTermPlaybackCanvas(canvas);
  }

  function setTab(tab, options = {}) {
    setShortTermTab({ state, tab, options });
  }

  function handleTabListKeydown(event) {
    handleShortTermTabListKeydown({ event, setTab });
  }

  function handleResourceContextMenuKeydown(event) {
    handleShortTermResourceMenuKeydown({ nodes, event });
  }

  function openTab(tab) {
    openShortTermTab({ state, tab, setMode, setTab });
  }

  async function refreshRecentFiles() {
    await refreshShortTermRecentFiles({ bridge, nodes });
  }

  async function clearRecentFiles() {
    await clearShortTermRecentFiles({ bridge, nodes });
  }

  function renderCommandState() {
    state.lastMenuStateSnapshot = renderShortTermCommandSurface({
      bridge,
      state,
      canEditText: Boolean(selectedTextElement())
    });
  }

  function showSaveBanner(title, message, tone) {
    showShortTermOutputBanner({ nodes, title, message, tone });
  }

  function showFailure(error) {
    showShortTermFailure({ nodes, setView }, error);
  }

  function showOperationFailure(title, error) {
    showShortTermOperationFailure({ nodes, state, setMode, renderCommandState }, title, error);
  }

  function currentStateSummary() {
    return shortTermCurrentStateSummary({ nodes, state });
  }

  const handlers = {
    openFromHostDialog,
    openRecentFromMenu,
    clearRecentFiles,
    closeFile,
    enterGeneralCompare,
    setMode,
    togglePrimaryPlayback,
    replayPrimary,
    runOptimization,
    saveActiveOutput,
    openCompareBFromHost,
    selectImageKey,
    openResourceContextMenu,
    closeResourceContextMenu,
    selectTextKey,
    confirmInlineRename,
    cancelInlineRename,
    renameSelectedImageKey,
    chooseReplacementImage,
    resetImageReplacement,
    editRuntimeText,
    resetRuntimeText,
    openKeyboardResourceContextMenu,
    setTab,
    openTab,
    handleTabListKeydown,
    handleResourceContextMenuKeydown,
    applyReplacementFile,
    loadDroppedFile,
    loadOpenedSource,
    clearTransientOutput,
    showFailure,
    showOptimizationComparison,
    createSaveProofOutput,
    createSaveFailureProofOutput,
    currentStateSummary
  };

  function initialize() {
    refreshRecentFiles().catch(() => {});
    renderCommandState();
  }

  return {
    handlers,
    initialize
  };
}
