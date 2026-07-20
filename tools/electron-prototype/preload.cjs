const { contextBridge, ipcRenderer } = require("electron");

const tokenArgument = process.argv.find((value) => value.startsWith("--prototype-report-token="));
const reportToken = tokenArgument?.slice("--prototype-report-token=".length) ?? "";

contextBridge.exposeInMainWorld("autoSvgaPrototype", Object.freeze({
  reportToken,
  reportSmokeResult(result) {
    return ipcRenderer.invoke("prototype:smoke-result", result);
  }
}));
