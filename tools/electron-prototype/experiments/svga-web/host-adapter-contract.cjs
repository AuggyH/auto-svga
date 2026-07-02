"use strict";

const ELECTRON_HOST_ADAPTER_VERSION = 1;
const ELECTRON_HOST_BRIDGE_NAME = "autoSvgaElectronHost";
const LEGACY_PROTOTYPE_BRIDGE_NAME = "autoSvgaPrototype";

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
  writeClipboardText: "svga-web-experiment:write-clipboard-text",
  updateShortTermMenuState: "svga-web-experiment:update-short-term-menu-state",
  saveShortTermSvgaOutput: "svga-web-experiment:save-short-term-svga-output",
  saveEditedSvga: "svga-web-experiment:save-edited-svga",
  saveOptimizedSvga: "svga-web-experiment:save-optimized-svga",
  saveSequenceRepairSvga: "svga-web-experiment:save-sequence-repair-svga",
  p3EditResult: "svga-web-experiment:p3-edit-result",
  p4EditResult: "svga-web-experiment:p4-edit-result",
  p5BatchResult: "svga-web-experiment:p5-batch-result"
});

const DOCUMENT_TYPES = Object.freeze(["svga"]);

function createSecureWebPreferences({ preloadPath, reportToken, productMilestoneId }) {
  return {
    preload: preloadPath,
    additionalArguments: [
      `--prototype-report-token=${reportToken}`,
      `--prototype-product-milestone=${productMilestoneId}`
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
  const api = createBasePreloadApi(invoke, options);
  if (options.productMilestoneId === "short-term") {
    return freezePreloadApi(withShortTermProductApi(api, invoke));
  }
  return freezePreloadApi(withDeferredWorkbenchApi(api, invoke));
}

function createLegacyPrototypePreloadApi(invoke, options) {
  const api = createBasePreloadApi(invoke, options);
  return freezePreloadApi(withDeferredWorkbenchApi(api, invoke));
}

function createPreloadApi(invoke, options) {
  return createLegacyPrototypePreloadApi(invoke, options);
}

module.exports = {
  DOCUMENT_TYPES,
  ELECTRON_HOST_ADAPTER_VERSION,
  ELECTRON_HOST_BRIDGE_NAME,
  IPC_CHANNELS,
  LEGACY_PROTOTYPE_BRIDGE_NAME,
  createLegacyPrototypePreloadApi,
  createPreloadApi,
  createProductPreloadApi,
  createSecureWebPreferences,
  isAllowedHostUrl,
  isExpectedSenderUrl
};
