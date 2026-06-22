const { contextBridge, ipcRenderer } = require("electron");

const ELECTRON_HOST_BRIDGE_NAME = "autoSvgaElectronHost";
const LEGACY_PROTOTYPE_BRIDGE_NAME = "autoSvgaPrototype";
const IPC_CHANNELS = Object.freeze({
  smokeResult: "svga-web-experiment:smoke-result",
  normalProofResult: "svga-web-experiment:normal-proof-result",
  auditResult: "svga-web-experiment:audit-result",
  captureArtifact: "svga-web-experiment:capture-artifact",
  scanLatestArtifacts: "svga-web-experiment:scan-latest-artifacts",
  openSvgaFile: "svga-web-experiment:open-svga-file",
  openReferenceMediaFile: "svga-web-experiment:open-reference-media-file",
  saveEditedSvga: "svga-web-experiment:save-edited-svga",
  p3EditResult: "svga-web-experiment:p3-edit-result",
  p4EditResult: "svga-web-experiment:p4-edit-result",
  p5BatchResult: "svga-web-experiment:p5-batch-result"
});

const tokenArgument = process.argv.find((value) => value.startsWith("--prototype-report-token="));
const reportToken = tokenArgument?.slice("--prototype-report-token=".length) ?? "";
const milestoneArgument = process.argv.find((value) => value.startsWith("--prototype-product-milestone="));
const productMilestoneId = milestoneArgument?.slice("--prototype-product-milestone=".length) ?? "P2";

function invoke(channel, input) {
  return input === undefined ? ipcRenderer.invoke(channel) : ipcRenderer.invoke(channel, input);
}

const hostApi = Object.freeze({
  hostAdapterVersion: 1,
  productMilestoneId,
  reportToken,
  localOnly: true,
  telemetry: "disabled",
  capabilities: Object.freeze({
    documentTypes: Object.freeze(["svga"]),
    fileOpen: "host-dialog-svga-only",
    dragDrop: "renderer-file-api-no-path-authority",
    referenceMediaOpen: "host-dialog-mp4-webm-gif-only",
    saveAs: "host-dialog-svga-only",
    arbitraryFileSystemAccess: false,
    shellAccess: false,
    remoteNavigation: false,
    newWindows: false
  }),
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
  scanLatestArtifacts() {
    return invoke(IPC_CHANNELS.scanLatestArtifacts);
  },
  openSvgaFile() {
    return invoke(IPC_CHANNELS.openSvgaFile);
  },
  openReferenceMediaFile() {
    return invoke(IPC_CHANNELS.openReferenceMediaFile);
  },
  saveEditedSvga(input) {
    return invoke(IPC_CHANNELS.saveEditedSvga, input);
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
});

contextBridge.exposeInMainWorld(ELECTRON_HOST_BRIDGE_NAME, hostApi);
contextBridge.exposeInMainWorld(LEGACY_PROTOTYPE_BRIDGE_NAME, hostApi);
