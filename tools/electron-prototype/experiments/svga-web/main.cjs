const { randomBytes } = require("node:crypto");
const { mkdirSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, ipcMain, session } = require("electron");

const smokeMode = process.argv.includes("--smoke");
const appRoot = app.getAppPath();
const sessionRoot = path.join(os.tmpdir(), `auto-svga-svga-web-spike-${process.pid}`);
const reportToken = randomBytes(24).toString("hex");
let experimentServer;
let expectedOrigin;
let smokeFinished = false;
let cspViolationSeen = false;
let cleanedUp = false;

mkdirSync(sessionRoot, { recursive: true });
app.setPath("userData", path.join(sessionRoot, "user-data"));
app.setPath("sessionData", path.join(sessionRoot, "session-data"));

function isExpectedSender(event) {
  return typeof event.senderFrame?.url === "string"
    && event.senderFrame.url.startsWith(`${expectedOrigin}/`);
}

function validateSmokeResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const keys = [
    "localPage",
    "localOnly",
    "strictCsp",
    "noCspViolation",
    "playback",
    "canvasNonBlank",
    "inspectionReport",
    "auditPanel",
    "fileInput",
    "dragDrop",
    "errorFile",
    "playerLifecycle",
    "cleanup"
  ];
  if (!keys.every((key) => typeof value[key] === "boolean")) return undefined;
  return Object.fromEntries(keys.map((key) => [key, key === "noCspViolation" ? value[key] && !cspViolationSeen : value[key]]));
}

function redactLogMessage(value) {
  return String(value)
    .replaceAll(sessionRoot, "<svga-web-spike-session>")
    .replace(/(?:[A-Za-z]:\\|\/Users\/|\/home\/)[^\s"']+/g, "<local-path>");
}

async function finishSmoke(window, result) {
  if (smokeFinished) return;
  smokeFinished = true;
  const passed = Object.values(result).every(Boolean);
  console.log(`AUTO_SVGA_WEB_EXPERIMENT_SMOKE ${JSON.stringify({ ...result, passed })}`);
  await cleanupRuntime();
  window.destroy();
  app.exit(passed ? 0 : 1);
}

async function cleanupRuntime() {
  if (cleanedUp) return;
  cleanedUp = true;
  if (experimentServer) await experimentServer.close();
  rmSync(sessionRoot, { recursive: true, force: true });
}

async function createExperimentWindow() {
  const { startSvgaWebExperimentServer } = await import(
    pathToFileURL(path.join(appRoot, "server.mjs")).href
  );
  experimentServer = await startSvgaWebExperimentServer({ appRoot, reportToken });
  expectedOrigin = experimentServer.origin;

  const window = new BrowserWindow({
    width: 1120,
    height: 760,
    show: !smokeMode,
    webPreferences: {
      preload: path.join(appRoot, "preload.cjs"),
      additionalArguments: [`--prototype-report-token=${reportToken}`],
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false
    }
  });

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const allowed = details.url.startsWith(`${expectedOrigin}/`)
      || details.url.startsWith(`blob:${expectedOrigin}/`)
      || details.url.startsWith("devtools://");
    callback({ cancel: !allowed });
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("console-message", (event, ...legacyArguments) => {
    const message = event?.message
      ?? legacyArguments.find((value) => typeof value === "string")
      ?? "renderer message unavailable";
    if (/violates.+script-src|unsafe-eval|wasm-eval/i.test(String(message))) cspViolationSeen = true;
    console.log(`AUTO_SVGA_WEB_RENDERER ${redactLogMessage(message)}`);
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${expectedOrigin}/`)) event.preventDefault();
  });

  ipcMain.handle("svga-web-experiment:smoke-result", async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    const result = validateSmokeResult(input);
    if (!result) throw new Error("Invalid smoke result");
    if (smokeMode) await finishSmoke(window, result);
    return { accepted: true };
  });

  if (smokeMode) {
    setTimeout(() => {
      if (!smokeFinished) finishSmoke(window, {
        localPage: false,
        localOnly: false,
        strictCsp: false,
        noCspViolation: false,
        playback: false,
        canvasNonBlank: false,
        inspectionReport: false,
        auditPanel: false,
        fileInput: false,
        dragDrop: false,
        errorFile: false,
        playerLifecycle: false,
        cleanup: false
      });
    }, 20_000).unref();
  }

  await window.loadURL(`${expectedOrigin}/`);
}

app.whenReady().then(createExperimentWindow).catch((error) => {
  console.error(`AUTO_SVGA_WEB_EXPERIMENT_ERROR ${redactLogMessage(error instanceof Error ? error.message : error)}`);
  app.exit(1);
});

app.on("window-all-closed", async () => {
  await cleanupRuntime();
  app.quit();
});
