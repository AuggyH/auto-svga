const { contextBridge, ipcRenderer } = require("electron");

const tokenArgument = process.argv.find((value) => value.startsWith("--prototype-report-token="));
const reportToken = tokenArgument?.slice("--prototype-report-token=".length) ?? "";
const milestoneArgument = process.argv.find((value) => value.startsWith("--prototype-product-milestone="));
const productMilestoneId = milestoneArgument?.slice("--prototype-product-milestone=".length) ?? "P2";

contextBridge.exposeInMainWorld("autoSvgaPrototype", Object.freeze({
  reportToken,
  productMilestoneId,
  reportSmokeResult(result) {
    return ipcRenderer.invoke("svga-web-experiment:smoke-result", result);
  },
  reportNormalProofResult(result) {
    return ipcRenderer.invoke("svga-web-experiment:normal-proof-result", result);
  },
  reportAuditResult(result) {
    return ipcRenderer.invoke("svga-web-experiment:audit-result", result);
  },
  captureArtifact(scenario) {
    return ipcRenderer.invoke("svga-web-experiment:capture-artifact", scenario);
  },
  openSvgaFile() {
    return ipcRenderer.invoke("svga-web-experiment:open-svga-file");
  },
  saveEditedSvga(input) {
    return ipcRenderer.invoke("svga-web-experiment:save-edited-svga", input);
  },
  reportP3EditResult(result) {
    return ipcRenderer.invoke("svga-web-experiment:p3-edit-result", result);
  }
}));
