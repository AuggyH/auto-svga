const { contextBridge, ipcRenderer } = require("electron");

const tokenArgument = process.argv.find((value) => value.startsWith("--prototype-report-token="));
const reportToken = tokenArgument?.slice("--prototype-report-token=".length) ?? "";

contextBridge.exposeInMainWorld("autoSvgaPrototype", Object.freeze({
  reportToken,
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
  }
}));
