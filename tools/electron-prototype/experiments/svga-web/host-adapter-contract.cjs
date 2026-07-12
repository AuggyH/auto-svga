"use strict";

const ELECTRON_HOST_ADAPTER_VERSION = 1;
const ELECTRON_HOST_BRIDGE_NAME = "autoSvgaElectronHost";
const LEGACY_PROTOTYPE_BRIDGE_NAME = "autoSvgaPrototype";
const MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID = "0.2-multiformat-preview";

const IPC_CHANNELS = Object.freeze({
  smokeResult: "svga-web-experiment:smoke-result",
  normalProofResult: "svga-web-experiment:normal-proof-result",
  auditResult: "svga-web-experiment:audit-result",
  captureArtifact: "svga-web-experiment:capture-artifact",
  performSmokeInput: "svga-web-experiment:perform-smoke-input",
  scanLatestArtifacts: "svga-web-experiment:scan-latest-artifacts",
  openSvgaFile: "svga-web-experiment:open-svga-file",
  openReferenceMediaFile: "svga-web-experiment:open-reference-media-file",
  getRecentSvgaFiles: "svga-web-experiment:get-recent-svga-files",
  openRecentSvgaFile: "svga-web-experiment:open-recent-svga-file",
  clearRecentSvgaFiles: "svga-web-experiment:clear-recent-svga-files",
  openMultiFormatFile: "svga-web-experiment:open-multiformat-file",
  openDroppedMultiFormatFile: "svga-web-experiment:open-dropped-multiformat-file",
  prepareMultiFormatRuntimePreview: "svga-web-experiment:prepare-multiformat-runtime-preview",
  controlMultiFormatPreview: "svga-web-experiment:control-multiformat-preview",
  applyMultiFormatReplacement: "svga-web-experiment:apply-multiformat-replacement",
  resetMultiFormatReplacement: "svga-web-experiment:reset-multiformat-replacement",
  multiFormatRendererReady: "svga-web-experiment:multiformat-renderer-ready",
  getAebIntakeReport: "svga-web-experiment:get-aeb-intake-report",
  writeClipboardText: "svga-web-experiment:write-clipboard-text",
  updateShortTermMenuState: "svga-web-experiment:update-short-term-menu-state",
  setShortTermWindowMode: "svga-web-experiment:set-short-term-window-mode",
  saveShortTermSvgaOutput: "svga-web-experiment:save-short-term-svga-output",
  saveEditedSvga: "svga-web-experiment:save-edited-svga",
  saveOptimizedSvga: "svga-web-experiment:save-optimized-svga",
  saveSequenceRepairSvga: "svga-web-experiment:save-sequence-repair-svga",
  p3EditResult: "svga-web-experiment:p3-edit-result",
  p4EditResult: "svga-web-experiment:p4-edit-result",
  p5BatchResult: "svga-web-experiment:p5-batch-result"
});

const DOCUMENT_TYPES = Object.freeze(["svga"]);
const MULTIFORMAT_DOCUMENT_TYPES = Object.freeze(["svga", "lottie-json", "vap-mp4"]);

function createSecureWebPreferences({ preloadPath, reportToken, productMilestoneId, hostBoundaryMode = "formal" }) {
  return {
    preload: preloadPath,
    additionalArguments: [
      `--prototype-report-token=${reportToken}`,
      `--prototype-product-milestone=${productMilestoneId}`,
      `--prototype-host-boundary=${hostBoundaryMode}`
    ],
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    backgroundThrottling: false,
    spellcheck: false
  };
}

function createShortTermProductPreloadApi(invoke, { reportToken, productMilestoneId }) {
  return freezePreloadApi({
    hostAdapterVersion: ELECTRON_HOST_ADAPTER_VERSION,
    productMilestoneId,
    reportToken,
    localOnly: true,
    telemetry: "disabled",
    capabilities: {
      documentTypes: DOCUMENT_TYPES,
      fileOpen: "host-dialog-svga-only",
      dragDrop: "renderer-file-api-no-path-authority",
      recentFiles: "host-user-data-redacted",
      clipboardWrite: "host-clipboard-write-text-only",
      finderDocumentAssociation: "not-declared",
      saveAs: "host-dialog-svga-only",
      overwriteSave: "host-source-path-from-file-picker-only",
      arbitraryFileSystemAccess: false,
      shellAccess: false,
      remoteNavigation: false,
      newWindows: false
    },
    openSvgaFile() {
      return invoke(IPC_CHANNELS.openSvgaFile);
    },
    getRecentSvgaFiles() {
      return invoke(IPC_CHANNELS.getRecentSvgaFiles);
    },
    openRecentSvgaFile(recentFileId) {
      return invoke(IPC_CHANNELS.openRecentSvgaFile, recentFileId);
    },
    clearRecentSvgaFiles() {
      return invoke(IPC_CHANNELS.clearRecentSvgaFiles);
    },
    writeClipboardText(text) {
      return invoke(IPC_CHANNELS.writeClipboardText, text);
    },
    updateShortTermMenuState(state) {
      return invoke(IPC_CHANNELS.updateShortTermMenuState, state);
    },
    setShortTermWindowMode(mode) {
      return invoke(IPC_CHANNELS.setShortTermWindowMode, mode);
    },
    saveShortTermSvgaOutput(input) {
      return invoke(IPC_CHANNELS.saveShortTermSvgaOutput, input);
    }
  });
}

function createAebProductPreloadApi(invoke, { productMilestoneId }) {
  return freezePreloadApi({
    hostAdapterVersion: ELECTRON_HOST_ADAPTER_VERSION,
    productMilestoneId,
    localOnly: true,
    telemetry: "disabled",
    capabilities: {
      documentTypes: Object.freeze(["aeb-intake-report"]),
      aebIntakeReport: "host-read-normalized-redacted-json-from-launch-path",
      arbitraryFileSystemAccess: false,
      shellAccess: false,
      remoteNavigation: false,
      newWindows: false
    },
    getAebIntakeReport() {
      return invoke(IPC_CHANNELS.getAebIntakeReport);
    }
  });
}

function createMultiFormatDesktopProductPreloadApi(invoke, { reportToken, productMilestoneId }) {
  return freezePreloadApi({
    hostAdapterVersion: ELECTRON_HOST_ADAPTER_VERSION,
    productMilestoneId,
    reportToken,
    localOnly: true,
    telemetry: "disabled",
    capabilities: {
      documentTypes: MULTIFORMAT_DOCUMENT_TYPES,
      fileOpen: "host-dialog-svga-lottie-json-vap-mp4",
      dragDrop: "renderer-file-copy-to-session-temp-path-redacted",
      recentFiles: "not-enabled-for-0.2-candidate",
      clipboardWrite: "host-clipboard-write-text-only",
      finderDocumentAssociation: "not-declared",
      replacementPreview: "runtime-only-no-save-export",
      saveAs: false,
      overwriteSave: false,
      export: false,
      arbitraryFileSystemAccess: false,
      shellAccess: false,
      remoteNavigation: false,
      newWindows: false,
      supportClaim: false,
      visibleIn01: false
    },
    openMultiFormatFile() {
      return invoke(IPC_CHANNELS.openMultiFormatFile);
    },
    openDroppedMultiFormatFile(input) {
      return invoke(IPC_CHANNELS.openDroppedMultiFormatFile, input);
    },
    prepareMultiFormatRuntimePreview(input) {
      return invoke(IPC_CHANNELS.prepareMultiFormatRuntimePreview, input);
    },
    controlMultiFormatPreview(input) {
      return invoke(IPC_CHANNELS.controlMultiFormatPreview, input);
    },
    applyMultiFormatReplacement(input) {
      return invoke(IPC_CHANNELS.applyMultiFormatReplacement, input);
    },
    resetMultiFormatReplacement(input) {
      return invoke(IPC_CHANNELS.resetMultiFormatReplacement, input);
    },
    notifyMultiFormatRendererReady() {
      return invoke(IPC_CHANNELS.multiFormatRendererReady, { phase: "renderer_action_bridge_ready" });
    },
    writeClipboardText(text) {
      return invoke(IPC_CHANNELS.writeClipboardText, text);
    },
    updateShortTermMenuState(state) {
      return invoke(IPC_CHANNELS.updateShortTermMenuState, state);
    },
    setShortTermWindowMode(mode) {
      return invoke(IPC_CHANNELS.setShortTermWindowMode, mode);
    }
  });
}

function isAllowedHostUrl(url, expectedOrigin, options = {}) {
  if (typeof url !== "string" || typeof expectedOrigin !== "string" || expectedOrigin.length === 0) {
    return false;
  }
  if (options.allowDevtools && url.startsWith("devtools://")) return true;
  if (options.allowBlob && url.startsWith(`blob:${expectedOrigin}/`)) return true;
  try {
    const parsed = new URL(url);
    return parsed.origin === expectedOrigin && (url === expectedOrigin || url.startsWith(`${expectedOrigin}/`));
  } catch {
    return false;
  }
}

function isExpectedSenderUrl(url, expectedOrigin) {
  return isAllowedHostUrl(url, expectedOrigin);
}

function createBasePreloadApi(invoke, { reportToken, productMilestoneId }) {
  return {
    hostAdapterVersion: ELECTRON_HOST_ADAPTER_VERSION,
    productMilestoneId,
    reportToken,
    localOnly: true,
    telemetry: "disabled",
    capabilities: {
      documentTypes: DOCUMENT_TYPES,
      fileOpen: "host-dialog-svga-only",
      dragDrop: "renderer-file-api-no-path-authority",
      referenceMediaOpen: "host-dialog-mp4-webm-gif-only",
      recentFiles: "host-user-data-redacted",
      clipboardWrite: "host-clipboard-write-text-only",
      finderDocumentAssociation: "not-declared",
      saveAs: "host-dialog-svga-only",
      overwriteSave: "host-source-path-from-file-picker-only",
      arbitraryFileSystemAccess: false,
      shellAccess: false,
      remoteNavigation: false,
      newWindows: false
    },
    reportSmokeResult(result) {
      return invoke(IPC_CHANNELS.smokeResult, result);
    },
    reportNormalProofResult(result) {
      return invoke(IPC_CHANNELS.normalProofResult, result);
    },
    reportAuditResult(result) {
      return invoke(IPC_CHANNELS.auditResult, result);
    },
    captureArtifact(scenario) {
      return invoke(IPC_CHANNELS.captureArtifact, scenario);
    },
    performSmokeInput(input) {
      return invoke(IPC_CHANNELS.performSmokeInput, input);
    },
    scanLatestArtifacts() {
      return invoke(IPC_CHANNELS.scanLatestArtifacts);
    },
    openSvgaFile() {
      return invoke(IPC_CHANNELS.openSvgaFile);
    },
    openReferenceMediaFile() {
      return invoke(IPC_CHANNELS.openReferenceMediaFile);
    },
    getRecentSvgaFiles() {
      return invoke(IPC_CHANNELS.getRecentSvgaFiles);
    },
    openRecentSvgaFile(recentFileId) {
      return invoke(IPC_CHANNELS.openRecentSvgaFile, recentFileId);
    },
    clearRecentSvgaFiles() {
      return invoke(IPC_CHANNELS.clearRecentSvgaFiles);
    },
    writeClipboardText(text) {
      return invoke(IPC_CHANNELS.writeClipboardText, text);
    },
    updateShortTermMenuState(state) {
      return invoke(IPC_CHANNELS.updateShortTermMenuState, state);
    },
    setShortTermWindowMode(mode) {
      return invoke(IPC_CHANNELS.setShortTermWindowMode, mode);
    }
  };
}

function freezePreloadApi(api) {
  return Object.freeze({
    ...api,
    capabilities: Object.freeze(api.capabilities)
  });
}

function withShortTermProductApi(api, invoke) {
  return {
    ...api,
    saveShortTermSvgaOutput(input) {
      return invoke(IPC_CHANNELS.saveShortTermSvgaOutput, input);
    }
  };
}

function withDeferredWorkbenchApi(api, invoke) {
  api.capabilities = {
    ...api.capabilities,
    sequenceRepairSaveAs: "host-dialog-svga-only"
  };
  return {
    ...api,
    saveEditedSvga(input) {
      return invoke(IPC_CHANNELS.saveEditedSvga, input);
    },
    saveOptimizedSvga(input) {
      return invoke(IPC_CHANNELS.saveOptimizedSvga, input);
    },
    saveSequenceRepairSvga(input) {
      return invoke(IPC_CHANNELS.saveSequenceRepairSvga, input);
    },
    reportP3EditResult(result) {
      return invoke(IPC_CHANNELS.p3EditResult, result);
    },
    reportP4EditResult(result) {
      return invoke(IPC_CHANNELS.p4EditResult, result);
    },
    reportP5BatchResult(result) {
      return invoke(IPC_CHANNELS.p5BatchResult, result);
    }
  };
}

function createProductPreloadApi(invoke, options) {
  if (options.productMilestoneId === "aeb") {
    return createAebProductPreloadApi(invoke, options);
  }
  if (options.productMilestoneId === MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID) {
    return createMultiFormatDesktopProductPreloadApi(invoke, options);
  }
  if (options.productMilestoneId === "short-term") {
    if ((options.hostBoundaryMode ?? "formal") === "formal") {
      return createShortTermProductPreloadApi(invoke, options);
    }
    return freezePreloadApi(withShortTermProductApi(createBasePreloadApi(invoke, options), invoke));
  }
  const api = createBasePreloadApi(invoke, options);
  return freezePreloadApi(withDeferredWorkbenchApi(api, invoke));
}

function createLegacyPrototypePreloadApi(invoke, options) {
  const api = createBasePreloadApi(invoke, options);
  return freezePreloadApi(withDeferredWorkbenchApi(api, invoke));
}

function createPreloadApi(invoke, options) {
  return createLegacyPrototypePreloadApi(invoke, options);
}

function rejectFormalShortTermHostCapability(productMilestoneId, hostBoundaryMode, capabilityName) {
  if (productMilestoneId === "short-term" && (hostBoundaryMode ?? "formal") === "formal") {
    throw new Error(`Formal short-term product runtime cannot use ${capabilityName}`);
  }
}

function rejectAebProductCapability(productMilestoneId, capabilityName) {
  if (productMilestoneId === "aeb") {
    throw new Error(`AEB product surface cannot use ${capabilityName}`);
  }
}

module.exports = {
  DOCUMENT_TYPES,
  ELECTRON_HOST_ADAPTER_VERSION,
  ELECTRON_HOST_BRIDGE_NAME,
  IPC_CHANNELS,
  LEGACY_PROTOTYPE_BRIDGE_NAME,
  MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID,
  MULTIFORMAT_DOCUMENT_TYPES,
  createAebProductPreloadApi,
  createLegacyPrototypePreloadApi,
  createMultiFormatDesktopProductPreloadApi,
  createPreloadApi,
  createProductPreloadApi,
  createSecureWebPreferences,
  createShortTermProductPreloadApi,
  isAllowedHostUrl,
  isExpectedSenderUrl,
  rejectAebProductCapability,
  rejectFormalShortTermHostCapability
};
