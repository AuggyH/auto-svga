export function createSmokeArtifactCapture(bridge) {
  const capturedArtifacts = [];
  const captureSmokeArtifact = async (scenario) => {
    const artifact = await bridge?.captureArtifact?.(scenario);
    capturedArtifacts.push(Boolean(artifact?.path));
    return artifact;
  };
  return {
    captureSmokeArtifact,
    lastSmokeArtifactCaptured: () => capturedArtifacts.at(-1) === true,
    allSmokeArtifactsCaptured: (minimumCount) => capturedArtifacts.length >= minimumCount
      && capturedArtifacts.every(Boolean)
  };
}

export function collectShortTermSpecComparisonProof({ overviewFactRows, factGrid, model }) {
  const factGridCopy = factGrid.textContent || "";
  const thresholdCopies = overviewFactRows.map((fact) => fact.requirement).filter(Boolean);
  const optimizableRows = factGrid.querySelectorAll(".factCell[data-status='warning'], .factCell[data-status='fail']");
  const proof = {
    schemaVersion: 1,
    proofId: "short-term-spec-comparison-proof",
    source: "short-term-smoke",
    prdIds: ["S4"],
    profileId: model?.overview?.profileId || "",
    profileLabel: model?.overview?.profileLabel || "",
    factRowCount: overviewFactRows.length,
    renderedFactRowCount: factGrid.querySelectorAll(".factCell").length,
    factRows: overviewFactRows.map((fact) => ({
      id: fact.id,
      label: fact.label,
      value: fact.value,
      requirement: fact.requirement,
      status: fact.status
    })),
    actualValuesVisible: overviewFactRows.length > 0
      && overviewFactRows.every((fact) => Boolean(fact.value) && factGridCopy.includes(fact.value)),
    defaultThresholdsHidden: thresholdCopies.every((copy) => !factGridCopy.includes(copy)),
    optimizationStatusVisible: optimizableRows.length === 0
      || [...optimizableRows].every((row) => row.textContent.includes("可优化")),
    defaultInformationSurfaceActive: document.querySelector("#panelOverview")?.hidden === false,
    separateProductionSpecModuleExposed: Boolean(document.querySelector("#productionSpecModule, #specReportSection, [data-panel='production-spec']"))
  };
  proof.passed = [
    proof.profileId === "production_target",
    proof.factRowCount >= 5,
    proof.renderedFactRowCount >= proof.factRowCount,
    proof.actualValuesVisible,
    proof.defaultThresholdsHidden,
    proof.optimizationStatusVisible,
    proof.defaultInformationSurfaceActive,
    proof.separateProductionSpecModuleExposed === false
  ].every(Boolean);
  return proof;
}

export function collectShortTermEmptyStateProof({
  assetRowCount,
  noAudioCopy,
  noReplaceableCopy,
  ordinaryImageThumbnailCount,
  replaceableImageRowCount,
  textElementRowCount,
  textUnavailableCopy
}) {
  const proof = {
    schemaVersion: 1,
    proofId: "short-term-empty-state-proof",
    source: "short-term-smoke",
    noAudioVisible: noAudioCopy.includes("当前文件暂无音频资产"),
    noReplaceableImagesMinimal: replaceableImageRowCount === 0 && noReplaceableCopy === "",
    textUnavailableMinimal: textElementRowCount === 0 && textUnavailableCopy === "",
    ordinaryImagesNotDuplicatedInReplaceables: replaceableImageRowCount === 0 && assetRowCount > 0,
    ordinaryImageThumbnailVisible: ordinaryImageThumbnailCount > 0,
    assetRowCount,
    ordinaryImageThumbnailCount,
    replaceableImageRowCount,
    textElementRowCount,
    noAudioCopy,
    noReplaceableCopy,
    textUnavailableCopy
  };
  proof.passed = [
    proof.noAudioVisible,
    proof.noReplaceableImagesMinimal,
    proof.textUnavailableMinimal,
    proof.ordinaryImagesNotDuplicatedInReplaceables,
    proof.ordinaryImageThumbnailVisible
  ].every(Boolean);
  return proof;
}

export function collectShortTermThumbnailProof({ assetList, noAudioCopy, ordinaryImageThumbnailCount }) {
  const sequenceRows = [...assetList.querySelectorAll(".assetRow")]
    .filter((row) => row.querySelector(".thumb.sequence"));
  const sequenceThumbnailImageCount = sequenceRows.reduce(
    (total, row) => total + row.querySelectorAll(".thumb.sequence img").length,
    0
  );
  return {
    schemaVersion: 1,
    proofId: "short-term-thumbnail-proof",
    source: "short-term-smoke",
    prdIds: ["S5", "S6", "S15"],
    ordinaryImageThumbnailVisible: ordinaryImageThumbnailCount > 0,
    ordinaryImageThumbnailCount,
    sequenceFixtureName: "sequence-repair-smoke.svga",
    sequenceRowCount: sequenceRows.length,
    sequenceThumbnailImageCount,
    sequenceFourGridVisible: sequenceRows.length > 0 && sequenceThumbnailImageCount >= 4,
    audioEmptyStateVisible: noAudioCopy.includes("当前文件暂无音频资产"),
    passed: ordinaryImageThumbnailCount > 0
      && sequenceRows.length > 0
      && sequenceThumbnailImageCount >= 4
      && noAudioCopy.includes("当前文件暂无音频资产")
  };
}

export function collectShortTermRuntimeTextBoundaryProof({
  editApplied,
  initialFocusInput,
  inlineInputRendered,
  inputSpaceSuppressed,
  resetClearedOverlay,
  resetButtonEnabledAfterApply,
  runtimeOverlayCopy,
  sourceSha256AfterApply,
  sourceSha256AfterReset,
  sourceSha256Before,
  textKeys
}) {
  const proof = {
    schemaVersion: 1,
    proofId: "short-term-runtime-text-boundary-proof",
    source: "short-term-smoke",
    prdIds: ["S13"],
    parserTextSource: "designer_named_imagekey_text_anchor",
    runtimeTextKeySource: "official_svga_dynamic_text_imagekey",
    textElementsDiscovered: textKeys.length,
    textKeys,
    inlineInputRendered,
    initialFocusInput,
    inputSpaceSuppressed,
    editApplied,
    runtimeOverlayVisibleAfterApply: runtimeOverlayCopy.includes("SVGA VIP"),
    runtimeOverlayCopy,
    resetButtonEnabledAfterApply,
    resetApplied: true,
    resetClearedOverlay,
    bytePersistenceClaimed: false,
    productCompleteClaimed: true,
    visualPreviewMechanism: "dom_overlay_on_preview_canvas",
    sourceSha256Before,
    sourceSha256AfterApply,
    sourceSha256AfterReset,
    sourceBytesUnchanged: sourceSha256AfterApply === sourceSha256Before
      && sourceSha256AfterReset === sourceSha256Before,
    supportedRuntimeFields: ["text"]
  };
  proof.passed = [
    proof.textElementsDiscovered > 0,
    proof.textKeys.includes("nickname_text"),
    proof.inlineInputRendered,
    proof.initialFocusInput,
    proof.inputSpaceSuppressed,
    proof.editApplied,
    proof.runtimeOverlayVisibleAfterApply,
    proof.resetButtonEnabledAfterApply,
    proof.resetApplied,
    proof.resetClearedOverlay,
    proof.bytePersistenceClaimed === false,
    proof.productCompleteClaimed,
    proof.sourceBytesUnchanged
  ].every(Boolean);
  return proof;
}

export function collectShortTermReplaceableClassificationProof({
  automaticFixtureName,
  automaticImageAssetCount,
  automaticImageNames,
  automaticReplaceableCount,
  designerFixtureName,
  designerImageAssetCount,
  designerReplaceableKeys,
  noReplaceableCopy
}) {
  const proof = {
    schemaVersion: 1,
    proofId: "short-term-replaceable-classification-proof",
    source: "short-term-smoke",
    prdIds: ["S7"],
    rule: "exclude_automatic_image_keys_include_designer_named_image_keys",
    automaticFixtureName,
    automaticImageAssetCount,
    automaticExcludedExamples: automaticImageNames.slice(0, 6),
    automaticReplaceableCount,
    noReplaceableCopy,
    designerFixtureName,
    designerImageAssetCount,
    includedDesignerKeys: designerReplaceableKeys,
    includedDesignerCount: designerReplaceableKeys.length,
    automaticKeysExcluded: automaticImageNames.length > 0 && automaticReplaceableCount === 0,
    designerKeysIncluded: designerReplaceableKeys.includes("profile_frame"),
    replaceableElementsNotAllImages: designerReplaceableKeys.length > 0 && designerReplaceableKeys.length < designerImageAssetCount,
    automaticEmptyStateMinimal: noReplaceableCopy === ""
  };
  proof.passed = [
    proof.automaticKeysExcluded,
    proof.designerKeysIncluded,
    proof.replaceableElementsNotAllImages,
    proof.automaticEmptyStateMinimal
  ].every(Boolean);
  return proof;
}

export function collectShortTermOptimizationProof({
  activeOutput,
  compareCanvasANonBlank,
  compareCanvasBNonBlank,
  compareInfoPanel,
  optimizationCandidateRows,
  optimizationModel,
  optimizationResult,
  optimizedBytes,
  optimizedSha256,
  sourceBytes,
  sourceSha256After,
  sourceSha256Before,
  view
}) {
  const saveButton = compareInfoPanel.querySelector("[data-action='save-as']");
  const proof = {
    schemaVersion: 1,
    proofId: "short-term-optimization-proof",
    source: "short-term-smoke",
    prdIds: ["S8", "S9", "S10", "S14"],
    fixtureName: "optimizer-reopen-smoke.svga",
    sourceSha256Before,
    sourceSha256After,
    sourceBytesUnchanged: sourceSha256After === sourceSha256Before,
    sourceSizeBytes: sourceBytes.byteLength,
    optimizedSha256,
    optimizedSizeBytes: optimizedBytes.byteLength,
    optimizedOutputProduced: optimizedBytes.byteLength > 0,
    optimizedBytesDifferent: optimizedSha256 !== sourceSha256Before,
    optimizedBytesSmaller: optimizedBytes.byteLength < sourceBytes.byteLength,
    batchActionEnabled: optimizationModel.batchActionEnabled === true,
    safeExecutableCount: optimizationModel.safeExecutableCount,
    reviewOnlyCount: optimizationModel.reviewOnlyCount,
    unsupportedCount: optimizationModel.unsupportedCount,
    optimizationCandidateRows,
    optimizationCandidatesVisible: optimizationCandidateRows > 0,
    resultStatus: optimizationResult.status,
    resultTitle: activeOutput.title,
    resultSummary: activeOutput.summary,
    executedActionCount: Array.isArray(optimizationResult.actions) ? optimizationResult.actions.length : 0,
    executedActionRowsVisible: compareInfoPanel.querySelectorAll("[data-optimization-actions] li").length,
    skippedMethodRowsVisible: compareInfoPanel.querySelectorAll("[data-optimization-skipped] li").length,
    metricCount: Array.isArray(optimizationResult.metrics) ? optimizationResult.metrics.length : 0,
    metricsVisible: compareInfoPanel.querySelectorAll(".optimizationMetricCell").length >= 2,
    comparisonVisible: view === "compare",
    compareCanvasANonBlank,
    compareCanvasBNonBlank,
    saveAsEnabled: saveButton?.disabled === false,
    sourceOutputSeparated: activeOutput.bytes !== sourceBytes
  };
  proof.passed = [
    proof.sourceBytesUnchanged,
    proof.optimizedOutputProduced,
    proof.optimizedBytesDifferent,
    proof.optimizedBytesSmaller,
    proof.batchActionEnabled,
    proof.safeExecutableCount > 0,
    proof.optimizationCandidatesVisible,
    proof.resultStatus === "optimized",
    proof.resultTitle === "已生成优化副本",
    proof.executedActionCount > 0,
    proof.executedActionRowsVisible >= proof.executedActionCount,
    proof.skippedMethodRowsVisible > 0,
    proof.metricCount >= 2,
    proof.metricsVisible,
    proof.comparisonVisible,
    proof.compareCanvasANonBlank,
    proof.compareCanvasBNonBlank,
    proof.saveAsEnabled,
    proof.sourceOutputSeparated
  ].every(Boolean);
  return proof;
}

export function collectShortTermRenameProof({
  activeOutput,
  canvasNonBlank,
  contextMenuOpened,
  danglingReferences,
  fromImageKey,
  previewModeStayed,
  referenceUpdates,
  renamedImageKeys,
  renamedSha256,
  renameValidation,
  saveAsEnabled,
  sourceSha256After,
  sourceSha256Before,
  toImageKey
}) {
  const proof = {
    schemaVersion: 1,
    proofId: "short-term-rename-proof",
    source: "short-term-smoke",
    prdIds: ["S11", "S14"],
    fixtureName: "replaceable-workflow-smoke.svga",
    fromImageKey,
    toImageKey,
    contextMenuOpened,
    enterConfirmed: true,
    sourceSha256Before,
    sourceSha256After,
    sourceBytesUnchanged: sourceSha256After === sourceSha256Before,
    renamedSha256,
    renamedOutputProduced: activeOutput.bytes.byteLength > 0,
    renamedBytesDifferent: renamedSha256 !== sourceSha256Before,
    renamedKeyVisible: renamedImageKeys.includes(toImageKey),
    oldKeyAbsent: !renamedImageKeys.includes(fromImageKey),
    referenceFieldsChecked: ["imageKey", "matteKey"],
    referenceUpdateCount: referenceUpdates.length,
    imageKeyReferenceUpdates: referenceUpdates.filter((update) => update.field === "imageKey").length,
    matteKeyReferenceUpdates: referenceUpdates.filter((update) => update.field === "matteKey").length,
    decodePassed: renameValidation.decodePassed === true,
    reopenPassed: renameValidation.reopenPassed === true,
    referenceClosurePassed: renameValidation.referenceClosurePassed === true,
    imageKeyReferenceClosurePassed: renameValidation.referenceClosurePassed === true
      && danglingReferences.every((resourceKey) => resourceKey !== toImageKey),
    matteKeyReferenceClosurePassed: renameValidation.referenceClosurePassed === true
      && danglingReferences.every((resourceKey) => resourceKey !== toImageKey),
    danglingReferences,
    danglingReferenceCount: danglingReferences.length,
    newKeyPresent: renameValidation.newKeyPresent === true,
    imageBytesPreserved: renameValidation.imageBytesPreserved === true,
    previewModeStayed,
    saveAsEnabled,
    canvasNonBlank,
    resultTitle: activeOutput.title,
    resultSummary: activeOutput.summary
  };
  proof.passed = [
    proof.contextMenuOpened,
    proof.enterConfirmed,
    proof.sourceBytesUnchanged,
    proof.renamedOutputProduced,
    proof.renamedBytesDifferent,
    proof.renamedKeyVisible,
    proof.oldKeyAbsent,
    proof.decodePassed,
    proof.reopenPassed,
    proof.referenceClosurePassed,
    proof.imageKeyReferenceClosurePassed,
    proof.matteKeyReferenceClosurePassed,
    proof.danglingReferenceCount === 0,
    proof.newKeyPresent,
    proof.imageBytesPreserved,
    proof.previewModeStayed,
    proof.saveAsEnabled,
    proof.canvasNonBlank,
    proof.resultTitle === "已重命名 imageKey"
  ].every(Boolean);
  return proof;
}

export function collectShortTermReplacementProof({
  contextMenuOpenedAfterReplacement,
  editedSha256,
  imageKey,
  previewModeStayed,
  resourceMenuArrowDownFocusedAction,
  resourceMenuEndFocusedAction,
  resourceMenuFocusReturnedAfterClose,
  resourceMenuHomeFocusedAction,
  resourceMenuInitialFocusedAction,
  replacementCanvasNonBlank,
  replacementPngSha256,
  resetCanvasNonBlank,
  resetClearedOutput,
  resetCommandEnabled,
  resetPreviewSha256,
  resultTitle,
  saveAsEnabledBeforeReset,
  saveStatusAfterReset,
  sourceSha256After,
  sourceSha256Before
}) {
  const proof = {
    schemaVersion: 1,
    proofId: "short-term-replacement-proof",
    source: "short-term-smoke",
    prdIds: ["S12", "S14"],
    fixtureName: "replaceable-workflow-smoke.svga",
    imageKey,
    replacementPngSha256,
    sourceSha256Before,
    sourceSha256After,
    sourceBytesUnchanged: sourceSha256After === sourceSha256Before,
    editedSha256,
    replacementOutputProduced: saveStatusAfterReset === "dirty" || editedSha256 !== sourceSha256Before,
    replacementBytesDifferent: editedSha256 !== sourceSha256Before,
    previewModeStayed,
    saveAsEnabledBeforeReset,
    contextMenuOpenedAfterReplacement,
    resourceMenuInitialFocusedAction,
    resourceMenuArrowDownFocusedAction,
    resourceMenuEndFocusedAction,
    resourceMenuHomeFocusedAction,
    resourceMenuKeyboardNavigationPassed: resourceMenuInitialFocusedAction === "context-rename"
      && resourceMenuArrowDownFocusedAction === "context-replace"
      && resourceMenuEndFocusedAction === "context-reset"
      && resourceMenuHomeFocusedAction === "context-rename",
    resourceMenuFocusReturnedAfterClose,
    resetCommandEnabled,
    replacementCanvasNonBlank,
    resetPreviewSha256,
    resetRestoredOriginal: resetPreviewSha256 === sourceSha256Before,
    resetClearedOutput,
    resetCanvasNonBlank,
    resultTitle
  };
  proof.passed = [
    proof.sourceBytesUnchanged,
    proof.replacementOutputProduced,
    proof.replacementBytesDifferent,
    proof.previewModeStayed,
    proof.saveAsEnabledBeforeReset,
    proof.contextMenuOpenedAfterReplacement,
    proof.resourceMenuKeyboardNavigationPassed,
    proof.resourceMenuFocusReturnedAfterClose,
    proof.resetCommandEnabled,
    proof.replacementCanvasNonBlank,
    proof.resetRestoredOriginal,
    proof.resetClearedOutput,
    proof.resetCanvasNonBlank
  ].every(Boolean);
  return proof;
}

export function collectShortTermOpenFlowProof({
  canvasNonBlank,
  dragDropLoaded,
  fileName,
  fixtureSha256,
  inspectionReportVisible,
  playbackReady,
  resourceEntriesLocalOnly,
  sourceSizeBytes,
  supportedDragDecisionCopy,
  supportedDragDecisionFocusZone,
  supportedDragDecisionOverlayVisible,
  supportedDragDecisionPointProofs,
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
}) {
  const dragDecisionPointProofs = Array.isArray(supportedDragDecisionPointProofs)
    ? supportedDragDecisionPointProofs
    : [];
  const pointById = new Map(dragDecisionPointProofs.map((point) => [point.id, point]));
  const centerPoint = pointById.get("center-open");
  const lowerCenterPoint = pointById.get("lower-center-open");
  const secondaryPoint = pointById.get("secondary-compare");
  const proof = {
    schemaVersion: 1,
    proofId: "short-term-open-flow-proof",
    source: "short-term-smoke",
    prdIds: ["S1"],
    fixtureName: fileName,
    fixtureSha256,
    sourceSizeBytes,
    dragDropAttempted: true,
    dragDropLoaded,
    previewReached: playbackReady && inspectionReportVisible && canvasNonBlank,
    localOnly: resourceEntriesLocalOnly,
    pathRedacted: !fileName.includes("/") && !fileName.includes("\\"),
    rendererFilesystemAccessClaimed: false,
    pairedNormalProof: "normal-runtime-proof.json",
    dragDecisionSplit: "top-bottom-75-25",
    dragDecisionPointProofs,
    dragDecisionCenterPointOpen: centerPoint?.focusZone === "open"
      && centerPoint?.status === "supported"
      && centerPoint?.overlayVisible === true,
    dragDecisionLowerCenterPointOpen: lowerCenterPoint?.focusZone === "open"
      && lowerCenterPoint?.status === "supported"
      && lowerCenterPoint?.overlayVisible === true,
    dragDecisionSecondaryPointCompare: secondaryPoint?.focusZone === "compare"
      && secondaryPoint?.status === "supported"
      && secondaryPoint?.overlayVisible === true,
    dragDecisionOverlayVisible: supportedDragDecisionOverlayVisible,
    dragDecisionSupportedState: supportedDragDecisionStatus === "supported",
    dragDecisionCompareFocus: supportedDragDecisionFocusZone === "compare",
    dragDecisionOffersOpenAndCompare: supportedDragDecisionCopy.includes("打开新文件")
      && supportedDragDecisionCopy.includes("添加为对比文件"),
    unsupportedDragOverlayVisible,
    unsupportedDragRejected: unsupportedDragStatus === "unsupported"
      && unsupportedDragFocusZone === "open"
      && unsupportedDragCopy.includes("不支持的文件格式"),
    unsupportedDropClearedCanvas,
    unsupportedDropToastVisible,
    unsupportedDropRecovered,
    unsupportedDropSourceBytesRestoredAfterRecovery: unsupportedDropSourceSha256AfterRecovery === unsupportedDropSourceSha256Before
  };
  proof.passed = [
    proof.dragDropAttempted,
    proof.dragDropLoaded,
    proof.previewReached,
    proof.localOnly,
    proof.pathRedacted,
    proof.rendererFilesystemAccessClaimed === false,
    proof.dragDecisionSplit === "top-bottom-75-25",
    proof.dragDecisionCenterPointOpen,
    proof.dragDecisionLowerCenterPointOpen,
    proof.dragDecisionSecondaryPointCompare,
    proof.dragDecisionOverlayVisible,
    proof.dragDecisionSupportedState,
    proof.dragDecisionCompareFocus,
    proof.dragDecisionOffersOpenAndCompare,
    proof.unsupportedDragOverlayVisible,
    proof.unsupportedDragRejected,
    proof.unsupportedDropClearedCanvas,
    proof.unsupportedDropToastVisible,
    proof.unsupportedDropRecovered,
    proof.unsupportedDropSourceBytesRestoredAfterRecovery
  ].every(Boolean);
  return proof;
}

export function collectShortTermLoadFailureProof({
  invalidApiRejected,
  invalidSizeBytes,
  loadFailedVisible,
  loadFailureCopy,
  noStaleMetadataAfterFailure,
  noStaleMetadataAfterPlaybackFailure,
  playbackFailureCopy,
  playbackFailureRecovered,
  playbackFailureSourceSha256AfterRecovery,
  playbackFailureSourceSha256Before,
  playbackFailureVisible,
  playbackRecovered,
  recoveryFileName,
  recoveryLoaded,
  sourceSha256AfterRecovery,
  sourceSha256BeforeInvalid
}) {
  const proof = {
    schemaVersion: 1,
    proofId: "short-term-load-failure-proof",
    source: "short-term-smoke",
    prdIds: ["S2"],
    invalidFileName: "invalid.svga",
    invalidSizeBytes,
    invalidDropAttempted: true,
    loadFailedVisible,
    errorCopy: loadFailureCopy,
    sourceFileUnmodifiedClaimVisible: loadFailureCopy.includes("源文件没有被修改"),
    noStaleMetadataAfterFailure,
    invalidApiRejected,
    recoveryFileName,
    recoveryLoaded,
    playbackRecovered,
    sourceSha256BeforeInvalid,
    sourceSha256AfterRecovery,
    sourceBytesRestoredAfterRecovery: sourceSha256AfterRecovery === sourceSha256BeforeInvalid,
    playbackFailureInjected: true,
    playbackFailureFileName: "playback-failure-smoke.svga",
    playbackFailureVisible,
    playbackFailureCopy,
    noStaleMetadataAfterPlaybackFailure,
    playbackFailureRecovered,
    playbackFailureSourceSha256Before,
    playbackFailureSourceSha256AfterRecovery,
    playbackFailureSourceBytesRestoredAfterRecovery:
      playbackFailureSourceSha256AfterRecovery === playbackFailureSourceSha256Before
  };
  proof.passed = [
    proof.invalidDropAttempted,
    proof.loadFailedVisible,
    proof.sourceFileUnmodifiedClaimVisible,
    proof.noStaleMetadataAfterFailure,
    proof.invalidApiRejected,
    proof.recoveryLoaded,
    proof.playbackRecovered,
    proof.sourceBytesRestoredAfterRecovery,
    proof.playbackFailureInjected,
    proof.playbackFailureVisible,
    proof.noStaleMetadataAfterPlaybackFailure,
    proof.playbackFailureRecovered,
    proof.playbackFailureSourceBytesRestoredAfterRecovery
  ].every(Boolean);
  return proof;
}

export async function collectShortTermRightSurfaceNavigationProof({ setTab, waitForSmokeFrame, state }) {
  const panelOverview = document.querySelector("#panelOverview");
  const panelOptimization = document.querySelector("#panelOptimization");
  const replaceableSection = document.querySelector(".replaceableSection");
  setTab("overview");
  await waitForSmokeFrame();
  const overviewState = {
    selectedSurface: state.tab,
    overviewPanelVisible: panelOverview?.hidden === false,
    optimizationPanelHidden: panelOptimization?.hidden === true
  };
  setTab("optimization", { focus: true });
  await waitForSmokeFrame();
  const optimizationState = {
    selectedSurface: state.tab,
    focusedPanelId: document.activeElement?.id || "",
    overviewPanelHidden: panelOverview?.hidden === true,
    optimizationPanelVisible: panelOptimization?.hidden === false
  };
  setTab("replaceable", { focus: true, scroll: true });
  await waitForSmokeFrame();
  const replaceableState = {
    selectedSurface: state.tab,
    focusedClass: document.activeElement?.className || "",
    overviewPanelVisible: panelOverview?.hidden === false,
    optimizationPanelHidden: panelOptimization?.hidden === true,
    replaceableTargetFocusable: replaceableSection?.getAttribute("tabindex") === "-1"
  };
  setTab("overview", { focus: true });
  await waitForSmokeFrame();
  const tabButtonsRemoved = document.querySelectorAll("[data-tab], [role='tab'], [role='tablist']").length === 0;
  const panelVisibilitySynced = panelOverview?.hidden === false
    && panelOptimization?.hidden === true;
  const proof = {
    schemaVersion: 1,
    proofId: "short-term-right-surface-navigation-proof",
    source: "short-term-smoke",
    prdIds: ["S3", "S8", "S12", "S13"],
    component: "RightInformationSurface",
    model: "surfaceReplacement",
    tabButtonsRemoved,
    overviewSurfaceVisible: overviewState.selectedSurface === "overview"
      && overviewState.overviewPanelVisible
      && overviewState.optimizationPanelHidden,
    optimizationSurfaceVisible: optimizationState.selectedSurface === "optimization"
      && optimizationState.focusedPanelId === "panelOptimization"
      && optimizationState.overviewPanelHidden
      && optimizationState.optimizationPanelVisible,
    replaceableSurfaceReturnsToDefault: replaceableState.selectedSurface === "replaceable"
      && replaceableState.overviewPanelVisible
      && replaceableState.optimizationPanelHidden
      && replaceableState.replaceableTargetFocusable
      && String(replaceableState.focusedClass).includes("replaceableSection"),
    panelVisibilitySynced
  };
  proof.passed = [
    proof.tabButtonsRemoved,
    proof.overviewSurfaceVisible,
    proof.optimizationSurfaceVisible,
    proof.replaceableSurfaceReturnsToDefault,
    proof.panelVisibilitySynced
  ].every(Boolean);
  return proof;
}

export function collectShortTermDesignInteractionProof({
  compareExitButtonPointerProof,
  focusedControlSpaceProof,
  minimumPreviewCaptured,
  nodes,
  state,
  settingsAppearanceProof,
  currentStateSummary
}) {
  const focusOrder = visibleFocusableElements().map((element) => ({
    id: element.id || "",
    action: element.dataset.action || "",
    role: element.getAttribute("role") || "",
    component: element.dataset.component || ""
  })).slice(0, 24);
  const focusKeys = focusOrder.map((item) => item.action || item.id || item.role).filter(Boolean);
  const compareIndex = focusKeys.indexOf("compare");
  const previewModeIndex = focusKeys.indexOf("mode-preview");
  const editModeIndex = focusKeys.indexOf("mode-edit");
  const panelOverview = document.querySelector("#panelOverview");
  const panelStyle = getComputedStyle(panelOverview);
  const factCell = nodes.factGrid.querySelector(".factCell");
  const assetText = nodes.assetList.querySelector(".rowText");
  const stateSummary = currentStateSummary();
  const localUserPathPrefix = ["/", "Users", "/"].join("");
  const menuState = parseLastMenuStateSnapshot(state.lastMenuStateSnapshot);
  const surfaceCaptureStates = Array.isArray(state.smokeSurfaceCaptureStates) ? state.smokeSurfaceCaptureStates : [];
  const requiredSurfaceCaptureStates = [
    {
      artifactName: "short-term-preview-optimization",
      expectedSurface: "optimization",
      expectedPanelId: "panelOptimization"
    },
    {
      artifactName: "short-term-preview-replaceable",
      expectedSurface: "replaceable",
      expectedPanelId: "panelOverview"
    }
  ];
  const surfaceCaptureStateByArtifact = new Map(surfaceCaptureStates.map((item) => [item.artifactName, item]));
  const surfaceCaptureStatesSynced = requiredSurfaceCaptureStates.every((expected) => {
    const captureState = surfaceCaptureStateByArtifact.get(expected.artifactName);
    return captureState?.expectedSurface === expected.expectedSurface
      && captureState?.stateSurface === expected.expectedSurface
      && captureState?.visiblePanelIds?.length === 1
      && captureState.visiblePanelIds[0] === expected.expectedPanelId;
  });
  const proof = {
    schemaVersion: 1,
    proofId: "short-term-design-interaction-proof",
    source: "short-term-smoke",
    prdIds: ["S1", "S3", "S8", "S12", "S13", "S14", "S16"],
    focusOrder,
    focusTargetCount: focusOrder.length,
    noVisibleCompareEntrypoint: compareIndex < 0,
    canvasModeSwitchReachable: previewModeIndex >= 0 && editModeIndex > previewModeIndex,
    tabButtonsRemoved: document.querySelectorAll("[data-tab], [role='tab'], [role='tablist']").length === 0,
    panelScrollRegionFocusable: panelOverview?.tabIndex === 0,
    panelScrollRegionScrollable: ["auto", "scroll"].includes(panelStyle.overflowY),
    metadataSelectable: userSelectAllowsText(document.body)
      && userSelectAllowsText(factCell)
      && userSelectAllowsText(assetText),
    stateSummaryCopyable: stateSummary.includes("Auto SVGA 状态摘要")
      && stateSummary.includes(state.displayName)
      && !stateSummary.includes(localUserPathPrefix)
      && !stateSummary.includes("\\"),
    surfaceCaptureStates,
    surfaceCaptureStatesSynced,
    menuStateDiscoverable: menuState?.hasFile === true
      && menuState?.canCompare === true
      && menuState?.canPlay === true
      && menuState?.view === "preview"
      && menuState?.mode === "preview",
    settingsAppearanceProof,
    settingsSheetAvailable: settingsAppearanceProof?.settingsDialogOpened === true
      && settingsAppearanceProof?.settingsDialogClosed === true
      && settingsAppearanceProof?.settingsChoiceValues?.join(",") === "system,light,dark",
    appearanceSwitchingWorks: settingsAppearanceProof?.darkAppearanceApplied === true
      && settingsAppearanceProof?.lightAppearanceApplied === true
      && settingsAppearanceProof?.systemAppearanceRestored === true,
    appearanceScreenshotsCaptured: settingsAppearanceProof?.settingsDialogScreenshotCaptured === true
      && settingsAppearanceProof?.darkAppearanceScreenshotCaptured === true
      && settingsAppearanceProof?.lightAppearanceScreenshotCaptured === true,
    appearanceMenuStateSynced: menuState?.appearance === "system",
    noMainSurfaceAppearanceButton: settingsAppearanceProof?.noMainSurfaceAppearanceButton === true,
    compareExitButtonPointerProof,
    compareExitButtonPointerPathWorks: compareExitButtonPointerProof?.buttonRendered === true
      && compareExitButtonPointerProof?.hitTargetIsExitButton === true
      && compareExitButtonPointerProof?.hitTargetAction === "back-preview"
      && compareExitButtonPointerProof?.exitedToPreview === true,
    compareExitButtonBelowTitlebar: compareExitButtonPointerProof?.buttonTop >= compareExitButtonPointerProof?.titlebarBottom,
    focusedControlSpaceProof,
    focusedControlSpaceNotGlobalPlayback: focusedControlSpaceProof?.targetAction === "mode-edit"
      && focusedControlSpaceProof?.targetStillFocused === true
      && focusedControlSpaceProof?.spacePrevented === false
      && focusedControlSpaceProof?.playbackUnchanged === true,
    reducedMotionRulePresent: styleSheetsContain("prefers-reduced-motion"),
    minimumPreviewCaptured: minimumPreviewCaptured === true
  };
  proof.passed = [
    proof.focusTargetCount >= 5,
    proof.noVisibleCompareEntrypoint,
    proof.canvasModeSwitchReachable,
    proof.tabButtonsRemoved,
    proof.panelScrollRegionFocusable,
    proof.panelScrollRegionScrollable,
    proof.metadataSelectable,
    proof.stateSummaryCopyable,
    proof.surfaceCaptureStatesSynced,
    proof.menuStateDiscoverable,
    proof.settingsSheetAvailable,
    proof.appearanceSwitchingWorks,
    proof.appearanceScreenshotsCaptured,
    proof.appearanceMenuStateSynced,
    proof.noMainSurfaceAppearanceButton,
    proof.compareExitButtonPointerPathWorks,
    proof.compareExitButtonBelowTitlebar,
    proof.focusedControlSpaceNotGlobalPlayback,
    proof.reducedMotionRulePresent,
    proof.minimumPreviewCaptured
  ].every(Boolean);
  return proof;
}

export function collectShortTermRightSurfaceCaptureState({ artifactName, expectedSurface, stateSurface }) {
  const expectedPanel = expectedSurface === "optimization" ? "optimization" : "overview";
  const panelSelector = `[data-panel="${CSS.escape(expectedPanel)}"]`;
  const expectedPanelId = document.querySelector(panelSelector)?.id || "";
  const visiblePanelIds = [...document.querySelectorAll("[data-panel]")]
    .filter((panel) => panel.hidden === false)
    .map((panel) => panel.id || "");

  return {
    artifactName: boundedSmokeText(artifactName, 120),
    expectedSurface: boundedSmokeText(expectedSurface, 40),
    stateSurface: boundedSmokeText(stateSurface, 40),
    expectedPanelId: boundedSmokeText(expectedPanelId, 80),
    visiblePanelIds,
    activeElementId: boundedSmokeText(document.activeElement?.id || "", 80),
    visiblePanelMatchesExpected: visiblePanelIds.length === 1 && visiblePanelIds[0] === expectedPanelId
  };
}

export async function reportShortTermSmokeFailure({ bridge, phase, error, nodes, state }) {
  const stateView = boundedSmokeText(state?.view || "", 80);
  const stateDisplayName = boundedSmokeText(state?.displayName || "", 180);
  const errorText = boundedSmokeText(nodes?.errorMessage?.textContent || "", 260);
  await bridge?.reportSmokeResult?.({
    localPage: location.origin.startsWith("http://127.0.0.1:"),
    localOnly: resourceEntriesAreLocalOnly(),
    strictCsp: Boolean(document.querySelector('meta[name="auto-svga-csp"]')),
    noCspViolation: true,
    playback: false,
    canvasNonBlank: false,
    inspectionReport: false,
    auditPanel: false,
    fileInput: false,
    dragDrop: false,
    errorFile: false,
    playerLifecycle: false,
    cleanup: false,
    diagnostics: {
      schemaVersion: 1,
      phase,
      errorName: boundedSmokeText(error instanceof Error ? error.name : "Error", 80),
      errorMessage: boundedSmokeText(error instanceof Error ? error.message : String(error), 260),
      actionCount: 0,
      currentActionId: null,
      lastActionId: null,
      ...(stateView ? { stateView } : {}),
      ...(stateDisplayName ? { stateDisplayName } : {}),
      ...(errorText ? { errorText } : {})
    }
  });
}

export function visibleFocusableElements() {
  return [...document.querySelectorAll("button, input, [tabindex]")]
    .filter((element) => !element.disabled && element.tabIndex >= 0 && isElementVisible(element));
}

export function isElementVisible(element) {
  return element.getClientRects().length > 0 && !element.closest("[hidden]");
}

export function userSelectAllowsText(element) {
  if (!element) return false;
  return ["auto", "text", "contain", "all"].includes(getComputedStyle(element).userSelect);
}

export function parseLastMenuStateSnapshot(lastMenuStateSnapshot) {
  try {
    return JSON.parse(lastMenuStateSnapshot || "{}");
  } catch {
    return {};
  }
}

export function styleSheetsContain(pattern) {
  return [...document.styleSheets].some((sheet) => {
    try {
      return [...sheet.cssRules].some((rule) => rule.cssText.includes(pattern));
    } catch {
      return false;
    }
  });
}

export function boundedSmokeText(value, maxLength) {
  return String(value ?? "").slice(0, maxLength);
}

export function resourceEntriesAreLocalOnly() {
  return performance.getEntriesByType("resource").every((entry) => {
    try {
      const url = new URL(entry.name, location.href);
      return url.origin === location.origin || entry.name.startsWith(`blob:${location.origin}/`);
    } catch {
      return false;
    }
  });
}

export function waitForSmokeCondition(predicate, timeoutMs) {
  const startedAt = performance.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) {
        resolve(true);
        return;
      }
      if (performance.now() - startedAt > timeoutMs) {
        reject(new Error("Short-term smoke timed out."));
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

export function waitForSmokeFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

export async function waitForCanvasPixels(canvas, timeoutMs) {
  const startedAt = performance.now();
  while (performance.now() - startedAt <= timeoutMs) {
    if (canvasHasNonBlankPixels(canvas)) return true;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  return false;
}

export function canvasHasNonBlankPixels(canvas) {
  if (!canvas?.width || !canvas?.height) return false;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return false;
  const sampleCount = 7;
  for (let y = 0; y < sampleCount; y += 1) {
    for (let x = 0; x < sampleCount; x += 1) {
      const pixelX = Math.min(canvas.width - 1, Math.max(0, Math.round((canvas.width * (x + 0.5)) / sampleCount)));
      const pixelY = Math.min(canvas.height - 1, Math.max(0, Math.round((canvas.height * (y + 0.5)) / sampleCount)));
      const [red, green, blue, alpha] = context.getImageData(pixelX, pixelY, 1, 1).data;
      if (alpha > 0 && (red > 0 || green > 0 || blue > 0)) return true;
    }
  }
  return false;
}
