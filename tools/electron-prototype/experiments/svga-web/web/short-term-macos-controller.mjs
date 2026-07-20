import {
  applyModeButtons,
  applyViewState
} from "./short-term-macos-dom-state.mjs";
import {
  captureViewTransitionFocus,
  focusModeViewTransition,
  hidePlaybackFailureRecovery,
  renderDiscardMessage,
  showPlaybackFailureRecovery
} from "./short-term-macos-state-renderers.mjs";
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
  replayShortTermPlaybackGroup,
  replayShortTermPlayback,
  renderShortTermPlaybackProgress,
  shortTermActivePlaybackKeys,
  stopAllShortTermPlayback,
  stopShortTermPlayback,
  toggleShortTermPlaybackGroup,
  toggleShortTermPlayback,
  toggleShortTermPlaybackLoopGroup,
  toggleShortTermPlaybackLoop
} from "./short-term-macos-playback-surface.mjs";
import {
  enterShortTermGeneralCompare,
  loadShortTermCompareAFromDroppedFile,
  loadShortTermCompareBFromDroppedFile,
  openShortTermCompareAFromHost,
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
  openShortTermSourceFromHostDialog,
  resetShortTermLaunchSurface,
  showShortTermUnsupportedDropState
} from "./short-term-macos-file-surface.mjs";
import {
  createShortTermSaveFailureProofOutput,
  createShortTermSaveProofOutput,
  saveShortTermActiveOutput
} from "./short-term-macos-save-surface.mjs";
import {
  applyShortTermRuntimeTextPreview,
  focusShortTermRuntimeTextPreviewInput,
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
import {
  dragActionForDecision,
  unsupportedDropDisposition,
} from "./short-term-macos-drag-decision-model.mjs";
import {
  dragDecisionForEvent,
  hideShortTermCanvasToast,
  hideShortTermDragDecisionOverlays,
  showShortTermDragDecisionOverlay
} from "./short-term-macos-drag-decision-surface.mjs";
import {
  applyShortTermAppearance,
  closeShortTermSettings,
  openShortTermSettings
} from "./short-term-macos-settings-surface.mjs";
import { syncShortTermWindowMode } from "./short-term-macos-host-client.mjs";

export function createShortTermAppController({ bridge, nodes, state }) {
  let playbackProgressFrame = 0;
  let sourceAuthorityEpoch = 0;

  function beginSourceAuthority() {
    const epoch = ++sourceAuthorityEpoch;
    return () => epoch === sourceAuthorityEpoch;
  }

  function currentSourceAuthority() {
    const epoch = sourceAuthorityEpoch;
    const sourceId = state.sourceId || "";
    const sourceBytes = state.sourceBytes;
    return () => epoch === sourceAuthorityEpoch
      && sourceId === (state.sourceId || "")
      && sourceBytes === state.sourceBytes;
  }

  async function mountPrimaryWithAuthority(bytes, authorityIsCurrent, options = {}) {
    const playback = await mountPlayback("primary", nodes.primaryCanvas, bytes, options);
    if (!authorityIsCurrent()) {
      stopPlayback("primary");
      return undefined;
    }
    return playback;
  }

  function renderPlaybackProgress() {
    renderShortTermPlaybackProgress(nodes, state.primaryPlayback);
    renderShortTermPlaybackProgress({
      playbackProgress: nodes.editPlaybackProgress,
      playbackTime: nodes.editPlaybackTime
    }, state.editPlayback);
    renderShortTermPlaybackProgress({
      playbackProgress: nodes.comparePlaybackProgress,
      playbackTime: nodes.comparePlaybackTime
    }, state.compareAPlayback ?? state.compareBPlayback);
  }

  function hasMountedPlayback() {
    return Boolean(
      state.primaryPlayback
      || state.editPlayback
      || state.compareAPlayback
      || state.compareBPlayback
    );
  }

  function stopPlaybackProgressLoop() {
    if (playbackProgressFrame) cancelAnimationFrame(playbackProgressFrame);
    playbackProgressFrame = 0;
    renderPlaybackProgress();
  }

  function startPlaybackProgressLoop() {
    if (playbackProgressFrame) return;
    const tick = () => {
      renderPlaybackProgress();
      playbackProgressFrame = hasMountedPlayback() ? requestAnimationFrame(tick) : 0;
    };
    tick();
  }

  function setView(view) {
    state.view = view;
    applyViewState(nodes.app, view);
    const windowMode = view === "launch" || (view === "failed" && !state.sourceBytes)
      ? "launch"
      : "workbench";
    state.lastWindowModeSnapshot = syncShortTermWindowMode(
      bridge,
      windowMode,
      state.lastWindowModeSnapshot
    );
    renderCommandState();
  }

  function setMode(mode) {
    const focusContext = captureViewTransitionFocus(nodes);
    const leavingCompare = state.view === "compare";
    state.mode = mode;
    applyModeButtons(mode);
    if (leavingCompare) {
      stopPlayback("compareA");
      stopPlayback("compareB");
      state.compareBSource = undefined;
    }
    if (!state.sourceBytes) {
      setView("launch");
      return;
    }
    if (mode === "edit") {
      stopPlayback("primary");
      stopPlayback("compareA");
      stopPlayback("compareB");
      setView("edit");
      renderEditReserved();
      focusModeViewTransition(nodes, mode, focusContext);
      mountPlayback("edit", nodes.editCanvas, state.previewBytes ?? state.sourceBytes).catch(showPlaybackFailure);
      return;
    }
    stopPlayback("edit");
    stopPlayback("compareA");
    stopPlayback("compareB");
    setTab("overview");
    setView("preview");
    focusModeViewTransition(nodes, mode, focusContext);
    mountPlayback("primary", nodes.primaryCanvas, state.previewBytes ?? state.sourceBytes).catch(showPlaybackFailure);
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
    const actionCopy = state.compareBSource ? "替换" : "打开";
    if (!(await confirmDiscardUnsavedOutput(`${actionCopy}对比文件 B 会放弃当前未保存的 SVGA 输出。`))) return false;
    return openShortTermCompareBFromHost({
      bridge,
      nodes,
      state,
      enterGeneralCompare,
      inspectShortTerm,
      mountPlayback,
      refreshRecentFiles
    });
  }

  async function openCompareAFromHost() {
    const actionCopy = state.sourceBytes ? "替换" : "打开";
    if (!(await confirmDiscardUnsavedOutput(`${actionCopy}对比文件 A 会放弃当前未保存的 SVGA 输出。`))) return false;
    return openShortTermCompareAFromHost({
      bridge,
      state,
      loadOpenedSource,
      enterGeneralCompare,
      refreshRecentFiles
    });
  }

  async function loadDroppedFile(file) {
    hideShortTermCanvasToast(nodes);
    return loadShortTermDroppedFile({
      file,
      confirmDiscardUnsavedOutput,
      loadOpenedSource
    });
  }

  async function loadDroppedCompareFile(file, slot = "B") {
    hideShortTermCanvasToast(nodes);
    if (slot === "A") {
      return loadShortTermCompareAFromDroppedFile({
        file,
        state,
        loadOpenedSource,
        enterGeneralCompare
      });
    }
    return loadShortTermCompareBFromDroppedFile({
      file,
      nodes,
      state,
      enterGeneralCompare,
      inspectShortTerm,
      mountPlayback
    });
  }

  async function loadOpenedSource({ bytes, displayName, sourceId, startPlayback = true }, options = {}) {
    const authorityIsCurrent = beginSourceAuthority();
    hideShortTermCanvasToast(nodes);
    if (options.preserveComparePeer !== true) state.compareBSource = undefined;
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
      mountPrimaryPlayback: (nextBytes) => mountPrimaryWithAuthority(nextBytes, authorityIsCurrent, { start: startPlayback }),
      stopAllPlayback,
      showFailure,
      showPlaybackFailure,
      authorityIsCurrent
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

  function showCanvasDragDecision(event, target, overlay) {
    const decision = dragDecisionForEvent(target, event, {
      view: state.view,
      compareSlots: {
        A: state.sourceBytes ? "loaded" : "empty",
        B: state.compareBSource?.bytes?.byteLength ? "loaded" : "empty"
      }
    });
    showShortTermDragDecisionOverlay(overlay, decision);
    return decision;
  }

  function hideCanvasDragDecision() {
    hideShortTermDragDecisionOverlays(nodes);
  }

  async function dropCanvasFile(event, target, overlay, providedDecision) {
    const decision = providedDecision ?? showCanvasDragDecision(event, target, overlay);
    hideCanvasDragDecision();
    if (!decision.file) return;
    const action = dragActionForDecision(decision);
    if (action === "reject-compare") {
      showShortTermCanvasToast(nodes, "当前格式不支持对比");
      return;
    }
    if (action === "reject-file" && state.view === "compare") {
      showShortTermCanvasToast(nodes, "不支持的文件格式");
      return;
    }
    if (action === "reject-file" && unsupportedDropDisposition(state) === "preserve") {
      showShortTermCanvasToast(nodes, "不支持的文件格式");
      return;
    }
    if (action === "reject-file") {
      showShortTermUnsupportedDropState({
        nodes,
        state,
        stopAllPlayback,
        setView
      });
      renderCommandState();
      return;
    }
    if (action === "replace-compare-a" || action === "replace-compare-b") {
      const slot = action === "replace-compare-a" ? "A" : "B";
      const loaded = slot === "A" ? Boolean(state.sourceBytes) : Boolean(state.compareBSource);
      const actionCopy = loaded ? "替换" : "打开";
      if (!(await confirmDiscardUnsavedOutput(`${actionCopy}对比文件 ${slot} 会放弃当前未保存的 SVGA 输出。`))) return;
      await loadDroppedCompareFile(decision.file, slot);
      return;
    }
    await loadDroppedFile(decision.file);
  }

  async function inspectShortTerm(bytes, name) {
    return inspectShortTermSvga({ bytes, name, reportToken: bridge?.reportToken });
  }

  async function runOptimization() {
    const authorityIsCurrent = currentSourceAuthority();
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
      mountPlayback: async (key, canvas, bytes, options) => {
        const playback = await mountPlayback(key, canvas, bytes, options);
        if (!authorityIsCurrent()) {
          stopPlayback(key);
          return undefined;
        }
        return playback;
      },
      showOperationFailure,
      authorityIsCurrent
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
    const authorityIsCurrent = currentSourceAuthority();
    return confirmShortTermInlineRename({
      bridge,
      nodes,
      state,
      inspectShortTerm,
      setActiveOutput,
      renderPreviewModel,
      mountPrimaryPlayback: (bytes) => mountPrimaryWithAuthority(bytes, authorityIsCurrent),
      showSaveBanner,
      showOperationFailure,
      authorityIsCurrent
    });
  }

  async function createSaveProofOutput(suffix) {
    const authorityIsCurrent = currentSourceAuthority();
    return createShortTermSaveProofOutput({
      state,
      suffix,
      reportToken: bridge?.reportToken,
      inspectShortTerm,
      setActiveOutput,
      renderPreviewModel,
      mountPrimaryPlayback: (bytes) => mountPrimaryWithAuthority(bytes, authorityIsCurrent),
      showSaveBanner,
      authorityIsCurrent
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
    const authorityIsCurrent = currentSourceAuthority();
    return applyShortTermReplacementFile({
      bridge,
      file,
      state,
      confirmDiscardUnsavedOutput,
      inspectShortTerm,
      setActiveOutput,
      renderPreviewModel,
      mountPrimaryPlayback: (bytes) => mountPrimaryWithAuthority(bytes, authorityIsCurrent),
      showSaveBanner,
      showOperationFailure,
      authorityIsCurrent
    });
  }

  async function resetImageReplacement() {
    const authorityIsCurrent = currentSourceAuthority();
    return resetShortTermImageReplacement({
      state,
      inspectShortTerm,
      clearTransientOutput,
      renderPreviewModel,
      mountPrimaryPlayback: (bytes) => mountPrimaryWithAuthority(bytes, authorityIsCurrent),
      authorityIsCurrent
    });
  }

  function editRuntimeText() {
    focusShortTermRuntimeTextPreviewInput({
      nodes,
      state,
      textElement: selectedTextElement(),
      showSaveBanner
    });
  }

  function updateRuntimeText(textKey, value) {
    applyShortTermRuntimeTextPreview({
      nodes,
      state,
      textKey,
      value,
      renderCommandState
    });
  }

  function resetRuntimeText(textKey) {
    resetShortTermRuntimeTextPreview({
      nodes,
      state,
      textKey,
      renderTextElements,
      renderCommandState
    });
  }

  async function saveActiveOutput(command) {
    const authorityIsCurrent = currentSourceAuthority();
    return saveShortTermActiveOutput({
      bridge,
      command,
      state,
      inspectShortTerm,
      clearTransientOutput,
      renderPreviewModel,
      renderCommandState,
      mountPrimaryPlayback: (bytes) => mountPrimaryWithAuthority(bytes, authorityIsCurrent),
      refreshRecentFiles,
      showSaveBanner,
      authorityIsCurrent
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

  function deactivateForMultiFormat() {
    sourceAuthorityEpoch += 1;
    resetShortTermLaunchSurface({
      nodes,
      state,
      stopAllPlayback,
      setTab,
      setView,
      refreshRecentFiles
    });
  }

  function renderPreviewModel() {
    renderShortTermPreviewModel({ nodes, state });
  }

  function setAssetFilter(assetFilter) {
    state.assetFilter = assetFilter || "all";
    renderPreviewModel();
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

  function selectTextKey(textKey, options = {}) {
    selectShortTermRuntimeTextElement({
      nodes,
      state,
      textKey,
      rerender: options.rerender !== false
    });
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
    stopPlayback("primary");
    stopPlayback("edit");
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
    stopPlayback("primary");
    stopPlayback("edit");
    return enterShortTermGeneralCompare({
      nodes,
      state,
      setView,
      mountPlayback,
      clearCanvas
    });
  }

  async function mountPlayback(key, canvas, bytes, options = {}) {
    const playback = await mountShortTermPlayback({
      state,
      key,
      canvas,
      bytes,
      options,
      onPlaybackStateChange: renderCommandState
    });
    if (key === "primary") {
      hidePlaybackFailureRecovery(nodes);
    }
    startPlaybackProgressLoop();
    return playback;
  }

  async function reloadPrimaryPlayback() {
    if (!state.sourceBytes) return;
    try {
      await mountPlayback("primary", nodes.primaryCanvas, state.previewBytes ?? state.sourceBytes);
    } catch (error) {
      showPlaybackFailure(error);
    }
  }

  function stopPlayback(key) {
    stopShortTermPlayback({ state, key });
    if (!hasMountedPlayback()) stopPlaybackProgressLoop();
  }

  function stopAllPlayback() {
    stopAllShortTermPlayback(state);
    stopPlaybackProgressLoop();
  }

  function togglePrimaryPlayback() {
    const keys = shortTermActivePlaybackKeys(state);
    if (keys.length > 1) {
      toggleShortTermPlaybackGroup({ state, keys, onPlaybackStateChange: renderCommandState });
      return;
    }
    if (keys[0]) toggleShortTermPlayback({ state, key: keys[0], onPlaybackStateChange: renderCommandState });
  }

  function replayPrimary() {
    const keys = shortTermActivePlaybackKeys(state);
    if (keys.length > 1) {
      replayShortTermPlaybackGroup({ state, keys, onPlaybackStateChange: renderCommandState });
      return;
    }
    if (keys[0]) replayShortTermPlayback({ state, key: keys[0], onPlaybackStateChange: renderCommandState });
  }

  function togglePrimaryPlaybackLoop() {
    const keys = shortTermActivePlaybackKeys(state);
    if (state.view === "compare" && keys.length) {
      toggleShortTermPlaybackLoopGroup({
        state,
        keys: ["compareA", "compareB"],
        groupKey: "compare",
        onPlaybackStateChange: renderCommandState
      });
      return;
    }
    if (!keys[0]) return;
    toggleShortTermPlaybackLoop({
      state,
      key: keys[0],
      onPlaybackStateChange: renderCommandState
    });
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

  function setAppearance(appearance, options = {}) {
    applyShortTermAppearance({
      nodes,
      state,
      appearance,
      persist: options.persist === true
    });
    renderCommandState();
  }

  function openSettings() {
    openShortTermSettings({ nodes, state, renderCommandState });
  }

  function closeSettings() {
    closeShortTermSettings({ nodes, renderCommandState });
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

  function showPlaybackFailure() {
    stopAllPlayback();
    clearCanvas(nodes.primaryCanvas);
    state.mode = "preview";
    applyModeButtons("preview");
    setView("preview");
    showPlaybackFailureRecovery(nodes);
    renderCommandState();
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
    refreshRecentFiles,
    clearRecentFiles,
    closeFile,
    enterGeneralCompare,
    setMode,
    togglePrimaryPlayback,
    replayPrimary,
    reloadPrimaryPlayback,
    togglePrimaryPlaybackLoop,
    runOptimization,
    saveActiveOutput,
    openCompareAFromHost,
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
    updateRuntimeText,
    resetRuntimeText,
    openSettings,
    closeSettings,
    setAppearance,
    openKeyboardResourceContextMenu,
    setAssetFilter,
    setTab,
    openTab,
    handleTabListKeydown,
    handleResourceContextMenuKeydown,
    applyReplacementFile,
    loadDroppedFile,
    loadDroppedCompareFile,
    showCanvasDragDecision,
    hideCanvasDragDecision,
    dropCanvasFile,
    loadOpenedSource,
    confirmDiscardUnsavedOutput,
    deactivateForMultiFormat,
    clearTransientOutput,
    showFailure,
    showOptimizationComparison,
    createSaveProofOutput,
    createSaveFailureProofOutput,
    currentStateSummary,
    renderCommandState
  };

  function initialize() {
    setAppearance(state.appearance);
    refreshRecentFiles().catch(() => {});
  }

  return {
    handlers,
    initialize
  };
}
