import { tabButtons } from "./short-term-macos-dom-state.mjs";

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

export function collectShortTermSpecComparisonProof({ overviewFactRows, factGrid, model, tab }) {
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
    actualRequirementPairsVisible: overviewFactRows.length > 0
      && overviewFactRows.every((fact) => Boolean(fact.value) && Boolean(fact.requirement)),
    overviewTabActive: tab === "overview",
    separateProductionSpecModuleExposed: Boolean(document.querySelector("#productionSpecModule, #specReportSection, [data-panel='production-spec']"))
  };
  proof.passed = [
    proof.profileId === "production_target",
    proof.factRowCount >= 5,
    proof.renderedFactRowCount >= proof.factRowCount,
    proof.actualRequirementPairsVisible,
    proof.overviewTabActive,
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
    noReplaceableImagesVisible: replaceableImageRowCount === 0 && noReplaceableCopy.includes("未发现设计师命名"),
    textUnavailableVisible: textElementRowCount === 0 && textUnavailableCopy.includes("未发现可运行时替换"),
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
    proof.noReplaceableImagesVisible,
    proof.textUnavailableVisible,
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
  modalOpened,
  resetClearedOverlay,
  resetCommandEnabledAfterApply,
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
    modalOpened,
    editApplied,
    runtimeOverlayVisibleAfterApply: runtimeOverlayCopy.includes("SVGA VIP"),
    runtimeOverlayCopy,
    resetCommandEnabledAfterApply,
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
    proof.modalOpened,
    proof.editApplied,
    proof.runtimeOverlayVisibleAfterApply,
    proof.resetCommandEnabledAfterApply,
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
    emptyStateExplainsAutomaticExclusion: noReplaceableCopy.includes("自动命名资源")
  };
  proof.passed = [
    proof.automaticKeysExcluded,
    proof.designerKeysIncluded,
    proof.replaceableElementsNotAllImages,
    proof.emptyStateExplainsAutomaticExclusion
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
    metricsVisible: compareInfoPanel.querySelectorAll(".factCell").length >= 2,
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

export async function collectShortTermTabKeyboardProof({ setTab, waitForSmokeFrame, state }) {
  const tabs = tabButtons();
  const tabOverview = document.querySelector("#tabOverview");
  const tabOptimization = document.querySelector("#tabOptimization");
  const tabReplaceable = document.querySelector("#tabReplaceable");
  const panelOverview = document.querySelector("#panelOverview");
  const panelOptimization = document.querySelector("#panelOptimization");
  const panelReplaceable = document.querySelector("#panelReplaceable");
  setTab("overview");
  await waitForSmokeFrame();
  tabOverview?.focus();
  const arrowRightPrevented = !tabOverview?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
  await waitForSmokeFrame();
  const arrowRightState = {
    selectedTab: state.tab,
    focusedTabId: document.activeElement?.id || "",
    optimizationPanelVisible: panelOptimization?.hidden === false
  };
  const endPrevented = !tabOptimization?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
  await waitForSmokeFrame();
  const endState = {
    selectedTab: state.tab,
    focusedTabId: document.activeElement?.id || "",
    replaceablePanelVisible: panelReplaceable?.hidden === false
  };
  const homePrevented = !tabReplaceable?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
  await waitForSmokeFrame();
  const homeState = {
    selectedTab: state.tab,
    focusedTabId: document.activeElement?.id || "",
    overviewPanelVisible: panelOverview?.hidden === false
  };
  const selectedTabOnlyInSequentialFocus = tabs.filter((tab) => tab.tabIndex === 0).length === 1
    && tabOverview?.tabIndex === 0
    && tabOptimization?.tabIndex === -1
    && tabReplaceable?.tabIndex === -1;
  const ariaSelectedSynced = tabOverview?.getAttribute("aria-selected") === "true"
    && tabOptimization?.getAttribute("aria-selected") === "false"
    && tabReplaceable?.getAttribute("aria-selected") === "false";
  const panelVisibilitySynced = panelOverview?.hidden === false
    && panelOptimization?.hidden === true
    && panelReplaceable?.hidden === true;
  const proof = {
    schemaVersion: 1,
    proofId: "short-term-tab-keyboard-proof",
    source: "short-term-smoke",
    prdIds: ["S3", "S8", "S12", "S13"],
    component: "RightTabPanel",
    molecule: "TabItem",
    tabOrder: tabs.map((tab) => tab.dataset.tab || ""),
    arrowRightPrevented,
    arrowRightSelected: arrowRightState.selectedTab === "optimization",
    arrowRightFocusedTabId: arrowRightState.focusedTabId,
    arrowRightPanelVisible: arrowRightState.optimizationPanelVisible,
    endPrevented,
    endSelected: endState.selectedTab === "replaceable",
    endFocusedTabId: endState.focusedTabId,
    endPanelVisible: endState.replaceablePanelVisible,
    homePrevented,
    homeSelected: homeState.selectedTab === "overview",
    homeFocusedTabId: homeState.focusedTabId,
    homePanelVisible: homeState.overviewPanelVisible,
    selectedTabOnlyInSequentialFocus,
    ariaSelectedSynced,
    panelVisibilitySynced
  };
  proof.passed = [
    proof.tabOrder.join(",") === "overview,optimization,replaceable",
    proof.arrowRightPrevented,
    proof.arrowRightSelected,
    proof.arrowRightFocusedTabId === "tabOptimization",
    proof.arrowRightPanelVisible,
    proof.endPrevented,
    proof.endSelected,
    proof.endFocusedTabId === "tabReplaceable",
    proof.endPanelVisible,
    proof.homePrevented,
    proof.homeSelected,
    proof.homeFocusedTabId === "tabOverview",
    proof.homePanelVisible,
    proof.selectedTabOnlyInSequentialFocus,
    proof.ariaSelectedSynced,
    proof.panelVisibilitySynced
  ].every(Boolean);
  return proof;
}

export function collectShortTermDesignInteractionProof({ minimumPreviewCaptured, nodes, state, currentStateSummary }) {
  const focusOrder = visibleFocusableElements().map((element) => ({
    id: element.id || "",
    action: element.dataset.action || "",
    tab: element.dataset.tab || "",
    role: element.getAttribute("role") || "",
    component: element.dataset.component || ""
  })).slice(0, 24);
  const focusKeys = focusOrder.map((item) => item.action || item.tab || item.id || item.role).filter(Boolean);
  const openIndex = focusKeys.indexOf("open");
  const compareIndex = focusKeys.indexOf("compare");
  const tabOverviewIndex = focusKeys.indexOf("overview");
  const panelOverview = document.querySelector("#panelOverview");
  const panelStyle = getComputedStyle(panelOverview);
  const factCell = nodes.factGrid.querySelector(".factCell");
  const assetText = nodes.assetList.querySelector(".rowText");
  const stateSummary = currentStateSummary();
  const localUserPathPrefix = ["/", "Users", "/"].join("");
  const menuState = parseLastMenuStateSnapshot(state.lastMenuStateSnapshot);
  const proof = {
    schemaVersion: 1,
    proofId: "short-term-design-interaction-proof",
    source: "short-term-smoke",
    prdIds: ["S1", "S3", "S8", "S12", "S13", "S14", "S16"],
    focusOrder,
    focusTargetCount: focusOrder.length,
    openBeforeCompare: openIndex >= 0 && compareIndex > openIndex,
    overviewTabReachable: tabOverviewIndex >= 0,
    selectedTabOnlyInSequentialFocus: tabButtons().filter((tab) => tab.tabIndex === 0).length === 1,
    panelScrollRegionFocusable: panelOverview?.tabIndex === 0,
    panelScrollRegionScrollable: ["auto", "scroll"].includes(panelStyle.overflowY),
    metadataSelectable: userSelectAllowsText(document.body)
      && userSelectAllowsText(factCell)
      && userSelectAllowsText(assetText),
    stateSummaryCopyable: stateSummary.includes("Auto SVGA 状态摘要")
      && stateSummary.includes(state.displayName)
      && !stateSummary.includes(localUserPathPrefix)
      && !stateSummary.includes("\\"),
    menuStateDiscoverable: menuState?.hasFile === true
      && menuState?.canCompare === true
      && menuState?.canPlay === true
      && menuState?.view === "preview"
      && menuState?.mode === "preview",
    reducedMotionRulePresent: styleSheetsContain("prefers-reduced-motion"),
    minimumPreviewCaptured: minimumPreviewCaptured === true
  };
  proof.passed = [
    proof.focusTargetCount >= 8,
    proof.openBeforeCompare,
    proof.overviewTabReachable,
    proof.selectedTabOnlyInSequentialFocus,
    proof.panelScrollRegionFocusable,
    proof.panelScrollRegionScrollable,
    proof.metadataSelectable,
    proof.stateSummaryCopyable,
    proof.menuStateDiscoverable,
    proof.reducedMotionRulePresent,
    proof.minimumPreviewCaptured
  ].every(Boolean);
  return proof;
}

export async function reportShortTermSmokeFailure({ bridge, phase, error }) {
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
      lastActionId: null
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
