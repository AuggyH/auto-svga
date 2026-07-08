import { overviewTabView } from "./short-term-macos-overview-model.mjs";
import { sha256Hex } from "./short-term-macos-byte-model.mjs";
import { probeInvalidShortTermInspection } from "./short-term-macos-api-client.mjs";
import { shortTermPlayerPrototype } from "./short-term-macos-playback-surface.mjs";
import {
  collectShortTermDesignInteractionProof,
  collectShortTermEmptyStateProof,
  collectShortTermRuntimeTextBoundaryProof,
  collectShortTermSpecComparisonProof,
  collectShortTermRightSurfaceNavigationProof,
  collectShortTermRightSurfaceCaptureState,
  collectShortTermThumbnailProof,
  collectShortTermReplaceableClassificationProof,
  collectShortTermOptimizationProof,
  collectShortTermRenameProof,
  collectShortTermReplacementProof,
  collectShortTermOpenFlowProof,
  collectShortTermLoadFailureProof,
  createSmokeArtifactCapture,
  reportShortTermSmokeFailure,
  resourceEntriesAreLocalOnly,
  waitForCanvasPixels,
  waitForSmokeCondition,
  waitForSmokeFrame
} from "./short-term-macos-smoke-proof-model.mjs";

export async function runShortTermSmokeIfRequested({
  bridge,
  nodes,
  state,
  setTab,
  loadOpenedSource,
  runOptimization,
  clearTransientOutput,
  editRuntimeText,
  resetRuntimeText,
  selectImageKey,
  applyReplacementFile,
  closeResourceContextMenu,
  resetImageReplacement,
  enterGeneralCompare,
  setMode,
  openSettings,
  closeSettings,
  setAppearance,
  currentStateSummary,
  createSaveFailureProofOutput,
  loadDroppedFile
}) {
  if (new URLSearchParams(location.search).get("mode") !== "smoke") return;
  try {
    await runShortTermSmoke({
      bridge,
      nodes,
      state,
      setTab,
      loadOpenedSource,
      runOptimization,
      clearTransientOutput,
      editRuntimeText,
      resetRuntimeText,
      selectImageKey,
      applyReplacementFile,
      closeResourceContextMenu,
      resetImageReplacement,
      enterGeneralCompare,
      setMode,
      openSettings,
      closeSettings,
      setAppearance,
      currentStateSummary,
      createSaveFailureProofOutput,
      loadDroppedFile
    });
  } catch (error) {
    await reportShortTermSmokeFailure({ bridge, phase: "smoke-runner", error, nodes, state }).catch(() => {});
  }
}

async function runShortTermSmoke({
  bridge,
  nodes,
  state,
  setTab,
  loadOpenedSource,
  runOptimization,
  clearTransientOutput,
  editRuntimeText,
  resetRuntimeText,
  selectImageKey,
  applyReplacementFile,
  closeResourceContextMenu,
  resetImageReplacement,
  enterGeneralCompare,
  setMode,
  openSettings,
  closeSettings,
  setAppearance,
  currentStateSummary,
  createSaveFailureProofOutput,
  loadDroppedFile
}) {
  const smokeArtifactCapture = createSmokeArtifactCapture(bridge);
  const { captureSmokeArtifact } = smokeArtifactCapture;
  state.smokeSurfaceCaptureStates = [];
  const setSmokeSurface = async (surface, artifactName = "") => {
    setTab(surface, { focus: true, scroll: true });
    const expectedPanel = surface === "optimization" ? "optimization" : "overview";
    await waitForSmokeCondition(() => (
      state.tab === surface
      && document.querySelector(`[data-panel="${expectedPanel}"]`)?.hidden === false
    ), 2_000);
    await waitForSmokeFrame();
    if (artifactName) {
      state.smokeSurfaceCaptureStates.push(collectShortTermRightSurfaceCaptureState({
        artifactName,
        expectedSurface: surface,
        stateSurface: state.tab
      }));
      document.activeElement?.blur?.();
      await waitForSmokeFrame();
    }
  };
  await waitForSmokeFrame();
  await captureSmokeArtifact("short-term-launch");
  const fixtureResponse = await fetch("/fixture/avatar-frame-smoke.svga");
  const fixtureBytes = new Uint8Array(await fixtureResponse.arrayBuffer());
  const file = new File([fixtureBytes], "avatar-frame-smoke.svga", { type: "application/octet-stream" });
  const transfer = new DataTransfer();
  transfer.items.add(file);
  nodes.dropZone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  await waitForSmokeCondition(() => state.view === "preview" && Boolean(state.primaryPlayback) && Boolean(state.model), 8_000);
  const canvasNonBlank = await waitForCanvasPixels(nodes.primaryCanvas, 2_500);
  await captureSmokeArtifact("short-term-preview-overview");
  const supportedDragTransfer = new DataTransfer();
  supportedDragTransfer.items.add(file);
  const previewStageRect = nodes.previewStagePanel.getBoundingClientRect();
  nodes.previewStagePanel.dispatchEvent(new DragEvent("dragover", {
    bubbles: true,
    cancelable: true,
    clientX: previewStageRect.left + previewStageRect.width * 0.75,
    clientY: previewStageRect.top + previewStageRect.height / 2,
    dataTransfer: supportedDragTransfer
  }));
  await waitForSmokeFrame();
  const supportedDragDecisionOverlayVisible = nodes.previewDragOverlay.hidden === false;
  const supportedDragDecisionStatus = nodes.previewDragOverlay.dataset.status;
  const supportedDragDecisionFocusZone = nodes.previewDragOverlay.dataset.focusZone;
  const supportedDragDecisionCopy = nodes.previewDragOverlay.textContent.trim();
  nodes.previewStagePanel.dispatchEvent(new DragEvent("dragleave", {
    bubbles: true,
    cancelable: true,
    dataTransfer: supportedDragTransfer
  }));
  await waitForSmokeFrame();
  const overviewFactRows = overviewTabView(state.model).facts;
  const shortTermSpecComparisonProof = collectShortTermSpecComparisonProof({
    overviewFactRows,
    factGrid: nodes.factGrid,
    model: state.model
  });
  const noAudioCopy = [...nodes.assetList.querySelectorAll(".assetRow")]
    .map((row) => row.textContent.trim())
    .find((text) => text.includes("当前文件暂无音频资产")) || "";
  const shortTermRightSurfaceNavigationProof = await collectShortTermRightSurfaceNavigationProof({ setTab, waitForSmokeFrame, state });
  await setSmokeSurface("optimization", "short-term-preview-optimization");
  await captureSmokeArtifact("short-term-preview-optimization");
  await setSmokeSurface("replaceable", "short-term-preview-replaceable");
  await captureSmokeArtifact("short-term-preview-replaceable");
  const replaceableImageRowCount = nodes.replaceableList.querySelectorAll(".replaceableRow").length;
  const textElementRowCount = nodes.textElementList.querySelectorAll(".textElementRow").length;
  const noReplaceableCopy = nodes.replaceableList.textContent.trim();
  const textUnavailableCopy = nodes.textElementList.textContent.trim();
  const ordinaryImageThumbnailCount = nodes.assetList.querySelectorAll(".assetRow .thumb img").length;
  const automaticImageNames = (state.model?.assets ?? [])
    .filter((asset) => asset.kind === "image" && /^img[_-]?\d+$/i.test(asset.name))
    .map((asset) => asset.name);
  const automaticFixtureImageAssetCount = (state.model?.assets ?? []).filter((asset) => asset.kind === "image").length;
  const shortTermEmptyStateProof = collectShortTermEmptyStateProof({
    assetRowCount: nodes.assetList.children.length,
    noAudioCopy,
    noReplaceableCopy,
    ordinaryImageThumbnailCount,
    replaceableImageRowCount,
    textElementRowCount,
    textUnavailableCopy
  });
  const sequenceResponse = await fetch("/fixture/sequence-repair-smoke.svga");
  const sequenceBytes = new Uint8Array(await sequenceResponse.arrayBuffer());
  await loadOpenedSource({
    bytes: sequenceBytes,
    displayName: "sequence-repair-smoke.svga",
    sourceId: ""
  });
  await waitForSmokeCondition(() => state.view === "preview" && Boolean(state.primaryPlayback) && Boolean(state.model), 8_000);
  setTab("overview");
  await waitForSmokeFrame();
  await captureSmokeArtifact("short-term-sequence-thumbnails");
  const shortTermThumbnailProof = collectShortTermThumbnailProof({
    assetList: nodes.assetList,
    noAudioCopy,
    ordinaryImageThumbnailCount
  });
  const optimizationResponse = await fetch("/fixture/optimizer-reopen-smoke.svga");
  const optimizationBytes = new Uint8Array(await optimizationResponse.arrayBuffer());
  await loadOpenedSource({
    bytes: optimizationBytes,
    displayName: "optimizer-reopen-smoke.svga",
    sourceId: ""
  });
  await waitForSmokeCondition(() => state.view === "preview" && Boolean(state.primaryPlayback) && Boolean(state.model?.optimization), 8_000);
  setTab("optimization");
  await waitForSmokeFrame();
  const optimizationModel = state.model.optimization;
  const optimizationCandidateRows = nodes.findingList.querySelectorAll(".findingRow").length;
  const optimizationSourceSha256Before = await sha256Hex(state.sourceBytes);
  await runOptimization();
  await waitForSmokeCondition(() => state.view === "compare" && state.activeOutput?.kind === "optimization", 8_000);
  const optimizedBytes = state.activeOutput.bytes;
  const optimizationSourceSha256After = await sha256Hex(state.sourceBytes);
  const optimizedSha256 = await sha256Hex(optimizedBytes);
  const optimizationCompareANonBlank = await waitForCanvasPixels(nodes.compareCanvasA, 2_500);
  const optimizationCompareBNonBlank = await waitForCanvasPixels(nodes.compareCanvasB, 2_500);
  await captureSmokeArtifact("short-term-optimization-result");
  const optimizationResult = state.activeOutput.details ?? {};
  const shortTermOptimizationProof = collectShortTermOptimizationProof({
    activeOutput: state.activeOutput,
    compareCanvasANonBlank: optimizationCompareANonBlank,
    compareCanvasBNonBlank: optimizationCompareBNonBlank,
    compareInfoPanel: nodes.compareInfoB,
    optimizationCandidateRows,
    optimizationModel,
    optimizationResult,
    optimizedBytes,
    optimizedSha256,
    sourceBytes: state.sourceBytes,
    sourceSha256After: optimizationSourceSha256After,
    sourceSha256Before: optimizationSourceSha256Before,
    view: state.view
  });
  clearTransientOutput();
  const replaceableResponse = await fetch("/fixture/replaceable-workflow-smoke.svga");
  const replaceableBytes = new Uint8Array(await replaceableResponse.arrayBuffer());
  const replacementPngResponse = await fetch("/fixture/replacement-preview-green.png");
  const replacementPngBytes = new Uint8Array(await replacementPngResponse.arrayBuffer());
  await loadOpenedSource({
    bytes: replaceableBytes,
    displayName: "replaceable-workflow-smoke.svga",
    sourceId: ""
  });
  await waitForSmokeCondition(() => (
    state.view === "preview"
    && Boolean(state.primaryPlayback)
    && (state.model?.replaceableElements?.images?.length ?? 0) > 0
  ), 8_000);
  setTab("replaceable");
  await waitForSmokeFrame();
  const designerReplaceableKeys = (state.model?.replaceableElements?.images ?? []).map((item) => item.imageKey);
  const designerRuntimeTextKeys = (state.model?.replaceableElements?.texts ?? []).map((item) => item.textKey);
  const designerImageAssetCount = (state.model?.assets ?? []).filter((asset) => asset.kind === "image").length;
  const runtimeTextSourceSha256Before = await sha256Hex(state.sourceBytes);
  const runtimeTextInput = nodes.textElementList.querySelector("[data-text-input][data-text-key='nickname_text']")
    || nodes.textElementList.querySelector("[data-text-input]");
  const runtimeTextInlineInputRendered = Boolean(runtimeTextInput);
  runtimeTextInput?.focus();
  const runtimeTextInitialFocusInput = document.activeElement === runtimeTextInput;
  const runtimeTextPlaybackBeforeSpace = state.primaryPlayback?.playing === true;
  runtimeTextInput?.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
  await waitForSmokeFrame();
  const runtimeTextPlaybackAfterSpace = state.primaryPlayback?.playing === true;
  runtimeTextInput.value = "SVGA VIP";
  runtimeTextInput.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "SVGA VIP" }));
  await waitForSmokeCondition(() => !nodes.runtimeTextOverlay.hidden && nodes.runtimeTextOverlay.textContent.includes("SVGA VIP"), 2_000);
  await waitForSmokeFrame();
  const runtimeTextSourceSha256AfterApply = await sha256Hex(state.sourceBytes);
  const runtimeTextOverlayCopy = nodes.runtimeTextOverlay.textContent.trim();
  const runtimeTextApplied = state.textPreview === "SVGA VIP";
  const runtimeTextResetButton = runtimeTextInput.closest(".textElementRow")?.querySelector("[data-action='runtime-text-reset']");
  const runtimeTextResetButtonEnabled = runtimeTextResetButton?.disabled === false;
  await captureSmokeArtifact("short-term-runtime-text-applied");
  runtimeTextResetButton?.click();
  await waitForSmokeFrame();
  const runtimeTextSourceSha256AfterReset = await sha256Hex(state.sourceBytes);
  const shortTermRuntimeTextBoundaryProof = collectShortTermRuntimeTextBoundaryProof({
    editApplied: runtimeTextApplied,
    initialFocusInput: runtimeTextInitialFocusInput,
    inlineInputRendered: runtimeTextInlineInputRendered,
    inputSpaceSuppressed: runtimeTextPlaybackAfterSpace === runtimeTextPlaybackBeforeSpace,
    resetClearedOverlay: nodes.runtimeTextOverlay.hidden && !nodes.runtimeTextOverlay.textContent.trim(),
    resetButtonEnabledAfterApply: runtimeTextResetButtonEnabled,
    runtimeOverlayCopy: runtimeTextOverlayCopy,
    sourceSha256AfterApply: runtimeTextSourceSha256AfterApply,
    sourceSha256AfterReset: runtimeTextSourceSha256AfterReset,
    sourceSha256Before: runtimeTextSourceSha256Before,
    textKeys: designerRuntimeTextKeys
  });
  const shortTermReplaceableClassificationProof = collectShortTermReplaceableClassificationProof({
    automaticFixtureName: file.name,
    automaticImageAssetCount: automaticFixtureImageAssetCount,
    automaticImageNames,
    automaticReplaceableCount: replaceableImageRowCount,
    designerFixtureName: "replaceable-workflow-smoke.svga",
    designerImageAssetCount,
    designerReplaceableKeys,
    noReplaceableCopy
  });
  const renameRow = nodes.replaceableList.querySelector(".replaceableRow");
  const renameFromImageKey = renameRow?.dataset.imageKey || state.model.replaceableElements.images[0]?.imageKey || "";
  const renameToImageKey = `${renameFromImageKey}_renamed`;
  const renameSourceSha256Before = await sha256Hex(state.sourceBytes);
  const renameContextEvent = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: renameRow?.getBoundingClientRect().left ?? 240,
    clientY: renameRow?.getBoundingClientRect().top ?? 240
  });
  renameRow?.dispatchEvent(renameContextEvent);
  await waitForSmokeFrame();
  const renameContextMenuOpened = nodes.resourceContextMenu.hidden === false;
  nodes.resourceContextMenu.querySelector("[data-action='context-rename']")?.click();
  await waitForSmokeCondition(() => state.renameImageKey === renameFromImageKey && Boolean(nodes.replaceableList.querySelector("[data-rename-input]")), 2_000);
  const renameInput = nodes.replaceableList.querySelector("[data-rename-input]");
  renameInput.value = renameToImageKey;
  renameInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  await waitForSmokeCondition(() => state.activeOutput?.kind === "rename" && state.selectedImageKey === renameToImageKey, 8_000);
  const renameSourceSha256After = await sha256Hex(state.sourceBytes);
  const renamedSha256 = await sha256Hex(state.activeOutput.bytes);
  const renameCanvasNonBlank = await waitForCanvasPixels(nodes.primaryCanvas, 2_500);
  await captureSmokeArtifact("short-term-rename-dirty");
  const renamedImageKeys = (state.model?.replaceableElements?.images ?? []).map((item) => item.imageKey);
  const renameWorkflow = state.activeOutput.details ?? {};
  const renameValidation = renameWorkflow.validation ?? {};
  const referenceUpdates = Array.isArray(renameWorkflow.referenceUpdates) ? renameWorkflow.referenceUpdates : [];
  const danglingReferences = Array.isArray(renameValidation.danglingReferences) ? renameValidation.danglingReferences : [];
  const shortTermRenameProof = collectShortTermRenameProof({
    activeOutput: state.activeOutput,
    canvasNonBlank: renameCanvasNonBlank,
    contextMenuOpened: renameContextMenuOpened,
    danglingReferences,
    fromImageKey: renameFromImageKey,
    previewModeStayed: state.view === "preview" && state.mode === "preview",
    referenceUpdates,
    renamedImageKeys,
    renamedSha256,
    renameValidation,
    saveAsEnabled: document.querySelector("[data-action='save-as']")?.disabled === false,
    sourceSha256After: renameSourceSha256After,
    sourceSha256Before: renameSourceSha256Before,
    toImageKey: renameToImageKey
  });
  clearTransientOutput();
  await loadOpenedSource({
    bytes: replaceableBytes,
    displayName: "replaceable-workflow-smoke.svga",
    sourceId: ""
  });
  await waitForSmokeCondition(() => (
    state.view === "preview"
    && Boolean(state.primaryPlayback)
    && (state.model?.replaceableElements?.images?.length ?? 0) > 0
  ), 8_000);
  setTab("replaceable");
  await waitForSmokeFrame();
  const replacementImageKey = state.model.replaceableElements.images[0]?.imageKey || "";
  const replacementSourceSha256Before = await sha256Hex(state.sourceBytes);
  selectImageKey(replacementImageKey);
  await applyReplacementFile(new File([replacementPngBytes], "replacement-preview-green.png", { type: "image/png" }));
  await waitForSmokeCondition(() => state.activeOutput?.kind === "replacement", 8_000);
  const replacementSourceSha256After = await sha256Hex(state.sourceBytes);
  const replacementEditedSha256 = await sha256Hex(state.activeOutput.bytes);
  const replacementPngSha256 = await sha256Hex(replacementPngBytes);
  const replacementSaveAsEnabledBeforeReset = document.querySelector("[data-action='save-as']")?.disabled === false;
  const replacementResultTitle = state.activeOutput.title;
  const replacementCanvasNonBlank = await waitForCanvasPixels(nodes.primaryCanvas, 2_500);
  const replacementRow = nodes.replaceableList.querySelector(`[data-image-key='${CSS.escape(replacementImageKey)}']`) || nodes.replaceableList.querySelector(".replaceableRow");
  replacementRow?.dispatchEvent(new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: replacementRow?.getBoundingClientRect().left ?? 240,
    clientY: replacementRow?.getBoundingClientRect().top ?? 240
  }));
  await waitForSmokeFrame();
  const replacementContextMenuOpened = nodes.resourceContextMenu.hidden === false;
  const resetCommandEnabled = nodes.resourceContextMenu.querySelector("[data-action='context-reset']")?.disabled === false;
  const resourceMenuInitialFocusedAction = document.activeElement?.dataset.action || "";
  document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
  const resourceMenuArrowDownFocusedAction = document.activeElement?.dataset.action || "";
  document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
  const resourceMenuEndFocusedAction = document.activeElement?.dataset.action || "";
  document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
  const resourceMenuHomeFocusedAction = document.activeElement?.dataset.action || "";
  closeResourceContextMenu({ restoreFocus: true });
  const resourceMenuFocusReturnedAfterClose = document.activeElement === replacementRow;
  await captureSmokeArtifact("short-term-replacement-dirty");
  await resetImageReplacement();
  await waitForSmokeCondition(() => !state.activeOutput && state.saveStatus === "idle", 4_000);
  const resetPreviewSha256 = await sha256Hex(state.previewBytes);
  const resetCanvasNonBlank = await waitForCanvasPixels(nodes.primaryCanvas, 2_500);
  await captureSmokeArtifact("short-term-replacement-reset");
  const shortTermReplacementProof = collectShortTermReplacementProof({
    contextMenuOpenedAfterReplacement: replacementContextMenuOpened,
    editedSha256: replacementEditedSha256,
    imageKey: replacementImageKey,
    previewModeStayed: state.view === "preview" && state.mode === "preview",
    resourceMenuArrowDownFocusedAction,
    resourceMenuEndFocusedAction,
    resourceMenuFocusReturnedAfterClose,
    resourceMenuHomeFocusedAction,
    resourceMenuInitialFocusedAction,
    replacementCanvasNonBlank,
    replacementPngSha256,
    resetCanvasNonBlank,
    resetClearedOutput: !state.activeOutput && state.saveStatus === "idle",
    resetCommandEnabled,
    resetPreviewSha256,
    resultTitle: replacementResultTitle,
    saveAsEnabledBeforeReset: replacementSaveAsEnabledBeforeReset,
    saveStatusAfterReset: state.saveStatus,
    sourceSha256After: replacementSourceSha256After,
    sourceSha256Before: replacementSourceSha256Before
  });
  await loadOpenedSource({
    bytes: fixtureBytes,
    displayName: file.name,
    sourceId: ""
  });
  await waitForSmokeCondition(() => state.view === "preview" && Boolean(state.primaryPlayback) && Boolean(state.model), 8_000);
  setTab("overview");
  await waitForSmokeFrame();
  await enterGeneralCompare();
  await waitForSmokeCondition(() => state.view === "compare", 2_000);
  await waitForCanvasPixels(nodes.compareCanvasA, 2_500);
  await captureSmokeArtifact("short-term-general-compare");
  const compareExitButton = nodes.compareInfoB?.querySelector("[data-action='back-preview']");
  const compareExitButtonRect = compareExitButton?.getBoundingClientRect();
  const compareTitlebarRect = document.querySelector(".titlebar")?.getBoundingClientRect();
  const compareExitHitX = compareExitButtonRect ? compareExitButtonRect.left + compareExitButtonRect.width / 2 : 0;
  const compareExitHitY = compareExitButtonRect ? compareExitButtonRect.top + compareExitButtonRect.height / 2 : 0;
  const compareExitHitElement = compareExitButtonRect
    ? document.elementFromPoint(compareExitHitX, compareExitHitY)
    : null;
  const compareExitButtonPointerHit = Boolean(
    compareExitButton
      && compareExitHitElement
      && compareExitButton.contains(compareExitHitElement)
  );
  compareExitHitElement?.dispatchEvent(new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    clientX: compareExitHitX,
    clientY: compareExitHitY
  }));
  await waitForSmokeCondition(() => state.view === "preview", 2_000);
  const compareExitButtonPointerProof = {
    buttonRendered: Boolean(compareExitButton),
    buttonTop: Math.round(compareExitButtonRect?.top ?? -1),
    titlebarBottom: Math.round(compareTitlebarRect?.bottom ?? 0),
    hitX: Math.round(compareExitHitX),
    hitY: Math.round(compareExitHitY),
    hitTargetTag: compareExitHitElement?.tagName?.toLowerCase() || "",
    hitTargetAction: compareExitHitElement?.closest?.("[data-action]")?.dataset.action || "",
    hitTargetIsExitButton: compareExitButtonPointerHit,
    exitedToPreview: state.view === "preview"
  };
  setMode("edit");
  await waitForSmokeCondition(() => state.view === "edit", 2_000);
  await waitForCanvasPixels(nodes.editCanvas, 2_500);
  await waitForSmokeFrame();
  await captureSmokeArtifact("short-term-edit-reserved");
  setMode("preview");
  await waitForSmokeCondition(() => state.view === "preview", 2_000);
  setTab("overview");
  await waitForSmokeFrame();
  await captureSmokeArtifact("short-term-preview-minimum");
  openSettings();
  await waitForSmokeCondition(() => nodes.settingsDialog.open === true, 2_000);
  const settingsChoiceValues = nodes.appearanceChoices.map((input) => input.value);
  const settingsDialogOpened = nodes.settingsDialog.open === true;
  const settingsDialogArtifact = await captureSmokeArtifact("short-term-settings-dialog");
  setAppearance("dark");
  await waitForSmokeFrame();
  const darkAppearanceApplied = document.documentElement.dataset.appearance === "dark"
    && document.documentElement.style.colorScheme === "dark"
    && nodes.appearanceChoices.find((input) => input.value === "dark")?.checked === true;
  setAppearance("light");
  await waitForSmokeFrame();
  const lightAppearanceApplied = document.documentElement.dataset.appearance === "light"
    && document.documentElement.style.colorScheme === "light"
    && nodes.appearanceChoices.find((input) => input.value === "light")?.checked === true;
  setAppearance("system");
  await waitForSmokeFrame();
  const systemAppearanceRestored = document.documentElement.dataset.appearance === "system"
    && document.documentElement.style.colorScheme === "light dark"
    && nodes.appearanceChoices.find((input) => input.value === "system")?.checked === true;
  closeSettings();
  await waitForSmokeCondition(() => nodes.settingsDialog.open === false, 2_000);
  await waitForSmokeFrame();
  setAppearance("dark");
  await waitForSmokeFrame();
  const darkAppearanceArtifact = await captureSmokeArtifact("short-term-appearance-dark");
  setAppearance("light");
  await waitForSmokeFrame();
  const lightAppearanceArtifact = await captureSmokeArtifact("short-term-appearance-light");
  setAppearance("system");
  await waitForSmokeFrame();
  const settingsAppearanceProof = {
    settingsDialogOpened,
    settingsChoiceValues,
    settingsDialogScreenshotCaptured: Boolean(settingsDialogArtifact?.path),
    darkAppearanceApplied,
    lightAppearanceApplied,
    systemAppearanceRestored,
    darkAppearanceScreenshotCaptured: Boolean(darkAppearanceArtifact?.path),
    lightAppearanceScreenshotCaptured: Boolean(lightAppearanceArtifact?.path),
    settingsDialogClosed: nodes.settingsDialog.open === false,
    noMainSurfaceAppearanceButton: !document.querySelector("[data-action='open-settings']")
  };
  const focusedControlForSpace = document.querySelector("[data-action='mode-edit']");
  focusedControlForSpace?.focus();
  const focusedControlPlaybackBeforeSpace = state.primaryPlayback?.playing === true;
  const focusedControlSpacePrevented = focusedControlForSpace
    ? !focusedControlForSpace.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }))
    : true;
  await waitForSmokeFrame();
  const focusedControlSpaceProof = {
    targetAction: focusedControlForSpace?.dataset.action || "",
    targetStillFocused: document.activeElement === focusedControlForSpace,
    spacePrevented: focusedControlSpacePrevented,
    playbackUnchanged: (state.primaryPlayback?.playing === true) === focusedControlPlaybackBeforeSpace
  };
  const shortTermDesignInteractionProof = collectShortTermDesignInteractionProof({
    compareExitButtonPointerProof,
    focusedControlSpaceProof,
    minimumPreviewCaptured: smokeArtifactCapture.lastSmokeArtifactCaptured(),
    nodes,
    state,
    settingsAppearanceProof,
    currentStateSummary
  });
  createSaveFailureProofOutput();
  await waitForSmokeCondition(() => state.activeOutput && state.saveStatus === "dirty", 2_000);
  try {
    await window.__autoSvgaShortTermActions.saveAs();
  } catch {
    // Expected: smoke-only invalid bytes must fail the post-write reopen validation.
  }
  await waitForSmokeCondition(() => (
    state.saveStatus === "failed"
    && !nodes.saveBanner.hidden
    && nodes.saveBanner.textContent.includes("保存失败")
    && state.view === "preview"
    && Boolean(state.sourceBytes)
  ), 4_000);
  await waitForSmokeFrame();
  await captureSmokeArtifact("short-term-save-failed");
  const saveFailedVisible = state.saveStatus === "failed"
    && nodes.saveBanner.textContent.includes("保存失败")
    && state.view === "preview";
  const playbackReady = Boolean(state.primaryPlayback);
  const inspectionReportVisible = Boolean(state.model && nodes.assetList.children.length > 0);
  const auditPanelVisible = Boolean(nodes.factGrid.children.length > 0);
  const dragDropLoaded = state.displayName === file.name;
  const playerLifecycleOk = Boolean(state.primaryPlayback);
  const unsupportedDropSourceSha256Before = await sha256Hex(state.sourceBytes);
  const unsupportedFile = new File([new Uint8Array([1, 2, 3])], "unsupported.txt", { type: "text/plain" });
  const unsupportedDragTransfer = new DataTransfer();
  unsupportedDragTransfer.items.add(unsupportedFile);
  const unsupportedPreviewStageRect = nodes.previewStagePanel.getBoundingClientRect();
  nodes.previewStagePanel.dispatchEvent(new DragEvent("dragover", {
    bubbles: true,
    cancelable: true,
    clientX: unsupportedPreviewStageRect.left + unsupportedPreviewStageRect.width * 0.25,
    clientY: unsupportedPreviewStageRect.top + unsupportedPreviewStageRect.height / 2,
    dataTransfer: unsupportedDragTransfer
  }));
  await waitForSmokeFrame();
  const unsupportedDragOverlayVisible = nodes.previewDragOverlay.hidden === false;
  const unsupportedDragStatus = nodes.previewDragOverlay.dataset.status;
  const unsupportedDragFocusZone = nodes.previewDragOverlay.dataset.focusZone;
  const unsupportedDragCopy = nodes.previewDragOverlay.textContent.trim();
  nodes.previewStagePanel.dispatchEvent(new DragEvent("drop", {
    bubbles: true,
    cancelable: true,
    clientX: unsupportedPreviewStageRect.left + unsupportedPreviewStageRect.width * 0.25,
    clientY: unsupportedPreviewStageRect.top + unsupportedPreviewStageRect.height / 2,
    dataTransfer: unsupportedDragTransfer
  }));
  await waitForSmokeCondition(() => (
    state.view === "launch"
    && !state.sourceBytes
    && nodes.canvasToast.textContent.includes("不支持的文件格式")
  ), 2_000);
  await waitForSmokeFrame();
  const unsupportedDropClearedCanvas = state.view === "launch" && !state.sourceBytes && !state.model;
  const unsupportedDropToastVisible = nodes.canvasToast.hidden === false
    && nodes.canvasToast.textContent.includes("不支持的文件格式");
  await loadOpenedSource({
    bytes: fixtureBytes,
    displayName: file.name,
    sourceId: ""
  });
  await waitForSmokeCondition(() => state.view === "preview" && Boolean(state.primaryPlayback) && Boolean(state.model), 8_000);
  const unsupportedDropRecovered = state.view === "preview" && Boolean(state.sourceBytes);
  const unsupportedDropSourceSha256AfterRecovery = await sha256Hex(state.sourceBytes);
  const shortTermOpenFlowProof = collectShortTermOpenFlowProof({
    canvasNonBlank,
    dragDropLoaded,
    fileName: file.name,
    fixtureSha256: await sha256Hex(fixtureBytes),
    inspectionReportVisible,
    playbackReady,
    resourceEntriesLocalOnly: resourceEntriesAreLocalOnly(),
    sourceSizeBytes: fixtureBytes.byteLength,
    supportedDragDecisionCopy,
    supportedDragDecisionFocusZone,
    supportedDragDecisionOverlayVisible,
    supportedDragDecisionStatus,
    unsupportedDragCopy,
    unsupportedDragFocusZone,
    unsupportedDragOverlayVisible,
    unsupportedDragStatus,
    unsupportedDropClearedCanvas,
    unsupportedDropRecovered,
    unsupportedDropSourceSha256AfterRecovery,
    unsupportedDropSourceSha256Before,
    unsupportedDropToastVisible
  });
  clearTransientOutput();
  const recoverySourceSha256Before = await sha256Hex(state.sourceBytes);
  const invalidBytes = new Uint8Array([0, 1, 2, 3, 4]);
  await loadDroppedFile(new File([invalidBytes], "invalid.svga", { type: "application/octet-stream" }));
  await waitForSmokeCondition(() => state.view === "failed" && nodes.errorMessage.textContent.includes("源文件没有被修改"), 4_000);
  await waitForSmokeFrame();
  await captureSmokeArtifact("short-term-load-failed");
  const loadFailedVisible = state.view === "failed"
    && nodes.errorMessage.textContent.includes("源文件没有被修改");
  const loadFailureCopy = nodes.errorMessage.textContent.trim();
  const noStaleMetadataAfterFailure = !state.sourceBytes
    && !state.model
    && !state.activeOutput
    && nodes.errorMessage.textContent.includes("源文件没有被修改");
  await loadOpenedSource({
    bytes: fixtureBytes,
    displayName: file.name,
    sourceId: ""
  });
  await waitForSmokeCondition(() => state.view === "preview" && Boolean(state.primaryPlayback) && Boolean(state.model), 8_000);
  const recoverySourceSha256After = await sha256Hex(state.sourceBytes);
  const playbackFailureSourceSha256Before = await sha256Hex(state.sourceBytes);
  const playerPrototype = shortTermPlayerPrototype();
  const originalPlayerMount = playerPrototype.mount;
  try {
    playerPrototype.mount = async function playbackFailureSmokeProbe() {
      throw new Error("播放失败：播放器挂载失败。");
    };
    await loadOpenedSource({
      bytes: fixtureBytes,
      displayName: "playback-failure-smoke.svga",
      sourceId: ""
    });
  } finally {
    playerPrototype.mount = originalPlayerMount;
  }
  await waitForSmokeCondition(() => state.view === "failed" && nodes.errorMessage.textContent.includes("播放失败"), 4_000);
  await waitForSmokeFrame();
  await captureSmokeArtifact("short-term-playback-failed");
  const playbackFailureVisible = state.view === "failed"
    && nodes.errorMessage.textContent.includes("播放失败")
    && nodes.errorMessage.textContent.includes("源文件没有被修改");
  const playbackFailureCopy = nodes.errorMessage.textContent.trim();
  const noStaleMetadataAfterPlaybackFailure = !state.sourceBytes
    && !state.model
    && !state.activeOutput
    && nodes.errorMessage.textContent.includes("源文件没有被修改");
  await loadOpenedSource({
    bytes: fixtureBytes,
    displayName: file.name,
    sourceId: ""
  });
  await waitForSmokeCondition(() => state.view === "preview" && Boolean(state.primaryPlayback) && Boolean(state.model), 8_000);
  const playbackFailureSourceSha256AfterRecovery = await sha256Hex(state.sourceBytes);
  const invalidResponse = await probeInvalidShortTermInspection({
    reportToken: bridge?.reportToken
  });
  const shortTermLoadFailureProof = collectShortTermLoadFailureProof({
    invalidApiRejected: invalidResponse.ok === false,
    invalidSizeBytes: invalidBytes.byteLength,
    loadFailedVisible,
    loadFailureCopy,
    noStaleMetadataAfterFailure,
    noStaleMetadataAfterPlaybackFailure,
    playbackFailureCopy,
    playbackFailureSourceSha256AfterRecovery,
    playbackFailureSourceSha256Before,
    playbackFailureVisible,
    playbackFailureRecovered: state.view === "preview" && Boolean(state.primaryPlayback),
    playbackRecovered: Boolean(state.primaryPlayback),
    recoveryFileName: file.name,
    recoveryLoaded: state.view === "preview" && Boolean(state.model),
    sourceSha256AfterRecovery: recoverySourceSha256After,
    sourceSha256BeforeInvalid: recoverySourceSha256Before
  });
  if (state.primaryPlayback) {
    state.primaryPlayback.player.pause();
    state.primaryPlayback.player.start();
  }
  await bridge?.reportSmokeResult?.({
    localPage: location.origin.startsWith("http://127.0.0.1:"),
    localOnly: resourceEntriesAreLocalOnly(),
    strictCsp: Boolean(document.querySelector('meta[name="auto-svga-csp"]')),
    noCspViolation: true,
    playback: playbackReady,
    canvasNonBlank,
    inspectionReport: inspectionReportVisible,
    auditPanel: auditPanelVisible,
    fileInput: Boolean(file.name && fixtureBytes.byteLength > 0),
    dragDrop: dragDropLoaded,
    errorFile: invalidResponse.ok === false,
    playerLifecycle: playerLifecycleOk,
    shortTermOpenFlowProof,
    shortTermScreenshots: smokeArtifactCapture.allSmokeArtifactsCaptured(9),
    shortTermSaveFailed: saveFailedVisible,
    shortTermLoadFailed: loadFailedVisible,
    shortTermLoadFailureProof,
    shortTermSpecComparisonProof,
    shortTermRightSurfaceNavigationProof,
    shortTermEmptyStateProof,
    shortTermRuntimeTextBoundaryProof,
    shortTermThumbnailProof,
    shortTermOptimizationProof,
    shortTermReplaceableClassificationProof,
    shortTermRenameProof,
    shortTermReplacementProof,
    shortTermDesignInteractionProof,
    cleanup: true
  });
}
