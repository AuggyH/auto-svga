"use strict";

const { createHash } = require("node:crypto");
const { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, ipcMain, session } = require("electron");
const {
  MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID,
  createMultiFormatDesktopPreviewSession
} = require("../multiformat-desktop-session.cjs");

const IPC_CHANNELS = Object.freeze({
  openMultiFormatFile: "svga-web-experiment:open-multiformat-file",
  openDroppedMultiFormatFile: "svga-web-experiment:open-dropped-multiformat-file",
  prepareMultiFormatRuntimePreview: "svga-web-experiment:prepare-multiformat-runtime-preview",
  controlMultiFormatPreview: "svga-web-experiment:control-multiformat-preview",
  chooseMultiFormatReplacementImage: "svga-web-experiment:choose-multiformat-replacement-image",
  applyMultiFormatReplacement: "svga-web-experiment:apply-multiformat-replacement",
  resetMultiFormatReplacement: "svga-web-experiment:reset-multiformat-replacement",
  multiFormatRendererReady: "svga-web-experiment:multiformat-renderer-ready",
  writeClipboardText: "svga-web-experiment:write-clipboard-text",
  updateShortTermMenuState: "svga-web-experiment:update-short-term-menu-state",
  setShortTermWindowMode: "svga-web-experiment:set-short-term-window-mode"
});

const scriptRoot = __dirname;
const appRoot = path.resolve(scriptRoot, "..");
const repoRoot = path.resolve(appRoot, "../../../..");
const fixtureRoot = "/private/tmp/auto-svga-qa-multiformat-positive-20260713-016/bounded-vap";
const boundedVapPath = path.join(fixtureRoot, "bounded-vap.mp4");
const sidecarVapcPath = path.join(fixtureRoot, "vapc.json");
const expectedFixtureHashes = Object.freeze({
  [boundedVapPath]: "25ce657cf3de383e368c829bfcb9a17879d2bc7c7ebe151f66ebf5d64b73dd64",
  [sidecarVapcPath]: "d1e9160d3d7f9d25c6b789f39c077603ff8ef50abaa19ccaf9192052ff55dc77"
});
const tinyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR42mP8z8AABQMBgF7gywAAAABJRU5ErkJggg==";

const proofRoot = path.join(os.tmpdir(), `auto-svga-real-vap-runtime-proof-${process.pid}`);
const proofOutputPath = path.join(proofRoot, "real-vap-runtime-proof.json");
const replacementPngPath = path.join(proofRoot, "task-owned-vap-replacement.png");
const userDataRoot = path.join(proofRoot, "userData");
const sourceStore = new Map();
const previewSession = createMultiFormatDesktopPreviewSession({
  repoRoot,
  sessionRoot: proofRoot,
  sourceStore,
  openTimeoutMs: 15_000
});
const externalRequests = [];
const consoleMessages = [];
const ipcEvents = [];
let server;
let windowRef;

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.setPath("userData", userDataRoot);

main().catch(async (error) => {
  await writeProof({
    status: "failed",
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    evidence: {
      lifecycle: previewSession.lifecycle,
      externalRequests,
      consoleMessages: consoleMessages.slice(-10),
      ipcEvents
    }
  }).catch(() => {});
  await cleanup().catch(() => {});
  process.exitCode = 1;
});

async function main() {
  mkdirSync(proofRoot, { recursive: true });
  verifyFixtureHashes();
  const replacementBytes = Buffer.from(tinyPngBase64, "base64");
  writeFileSync(replacementPngPath, replacementBytes);
  const replacementSha256 = sha256File(replacementPngPath);

  await app.whenReady();
  app.hide?.();
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) && url.protocol !== "blob:" && url.protocol !== "data:") {
      externalRequests.push({
        scheme: url.protocol.replace(/:$/u, ""),
        hostHash: sha256Text(url.hostname).slice(0, 16)
      });
    }
    callback({});
  });

  const { startSvgaWebExperimentServer } = await import(pathToFileURL(path.join(appRoot, "server.mjs")).href);
  server = await startSvgaWebExperimentServer({
    appRoot,
    reportToken: "real-vap-runtime-proof",
    desktopArtifacts: undefined
  });
  installIpcHandlers();

  windowRef = new BrowserWindow({
    title: "Auto SVGA VAP Runtime Proof",
    width: 640,
    height: 640,
    show: false,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(appRoot, "preload.cjs"),
      additionalArguments: [
        "--prototype-product-milestone=0.2-multiformat-preview",
        "--prototype-report-token=real-vap-runtime-proof",
        "--prototype-host-boundary=formal"
      ]
    }
  });
  windowRef.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    consoleMessages.push({ level, message: redactString(message), line, source: redactString(sourceId) });
  });

  await windowRef.loadURL(`${server.origin}/`);
  await waitForPage("short-term action bridge", () => pageSnapshot(), (snapshot) =>
    snapshot.productMilestoneId === MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID
      && snapshot.actionBridgeReady === true
      && snapshot.bridgeReady === true
  );

  const openResult = await previewSession.openLocalFilePath(boundedVapPath, "fileOpenEvent");
  const openAction = await runInPage("complete VAP host file open", `
    (async () => {
      const actions = window.__autoSvgaShortTermActions;
      const eventId = "real-vap-runtime-open";
      const begun = actions.beginHostFileOpen({ eventId });
      const completed = await actions.completeHostFileOpen({ eventId, result: ${JSON.stringify(openResult)} });
      return { begun, completed };
    })()
  `);
  if (openAction?.begun !== true || openAction?.completed !== true) {
    throw new Error(`VAP host file-open action was not accepted: ${JSON.stringify(openAction)}`);
  }

  const loadedSnapshot = await waitForPage("VAP runtime mounted", () => pageSnapshot(), (snapshot) =>
    modelStatus(snapshot) === "previewReady"
      && modelFormat(snapshot) === "vap"
      && snapshot.runtimeMountState === "loaded"
      && snapshot.runtimeFormat === "vap"
      && snapshot.runtimeCanvasCount > 0
      && snapshot.runtimeWebglCanvasCount > 0
      && snapshot.runtimeCanvasMaxWidth > 0
      && snapshot.runtimeCanvasMaxHeight > 0
      && snapshot.maxVideoReadyState >= 2
      && snapshot.bodyTextIncludes.includes("VAP")
      && snapshot.bodyTextIncludes.includes("avatar")
  );

  await runInPage("play VAP runtime", "window.__autoSvgaShortTermActions.playPause()");
  const playingSnapshot = await waitForPage("VAP play state", () => pageSnapshot(), (snapshot) =>
    modelStatus(snapshot) === "playing"
      && snapshot.runtimeMountState === "loaded"
      && snapshot.anyVideoPaused === false
  );

  await runInPage("pause VAP runtime", "window.__autoSvgaShortTermActions.playPause()");
  const pausedSnapshot = await waitForPage("VAP pause state", () => pageSnapshot(), (snapshot) =>
    modelStatus(snapshot) === "paused"
      && snapshot.runtimeMountState === "loaded"
      && snapshot.runtimeWebglCanvasCount > 0
      && snapshot.maxVideoReadyState >= 2
      && snapshot.anyVideoPaused === true
  );

  const replacementAction = await runInPage("choose VAP replacement image through action bridge", `
    (async () => {
      await window.__autoSvgaShortTermActions.replaceImage();
      return window.autoSvgaElectronHost.controlMultiFormatPreview({ action: "model" });
    })()
  `);
  if (replacementAction?.model?.replacement?.dirty !== true) {
    throw new Error(`VAP host replacement picker action did not apply a dirty model: ${JSON.stringify(compactSnapshot({ hostModel: replacementAction }))}`);
  }
  const replacementSnapshot = await waitForPage("VAP image replacement remounted", () => pageSnapshot(), (snapshot) =>
    snapshot.hostModel?.model?.replacement?.dirty === true
      && snapshot.hostModel?.model?.replacement?.active?.some((entry) => entry.kind === "image")
      && snapshot.runtimeMountState === "loaded"
      && snapshot.runtimeCanvasCount > 0
      && snapshot.runtimeWebglCanvasCount > 0
      && snapshot.runtimeCanvasMaxWidth > 0
      && snapshot.runtimeCanvasMaxHeight > 0
      && snapshot.maxVideoReadyState >= 2
  );

  await runInPage("reset VAP image replacement", "window.__autoSvgaShortTermActions.resetImageReplacement()");
  const resetSnapshot = await waitForPage("VAP replacement reset", () => pageSnapshot(), (snapshot) =>
    snapshot.hostModel?.model?.replacement?.dirty === false
      && snapshot.hostModel?.model?.replacement?.resetEnabled === false
      && snapshot.runtimeMountState === "loaded"
      && snapshot.runtimeCanvasCount > 0
      && snapshot.runtimeWebglCanvasCount > 0
      && snapshot.runtimeCanvasMaxWidth > 0
      && snapshot.runtimeCanvasMaxHeight > 0
      && snapshot.maxVideoReadyState >= 2
  );

  await runInPage("choose VAP replacement image through row action", `
    (() => {
      const button = document.querySelector("[data-action='row-menu'][data-image-key]");
      if (!button) throw new Error("VAP replacement row action is unavailable.");
      button.click();
      return true;
    })()
  `);
  const rowReplacementSnapshot = await waitForPage("VAP row image replacement remounted", () => pageSnapshot(), (snapshot) =>
    snapshot.hostModel?.model?.replacement?.dirty === true
      && snapshot.hostModel?.model?.replacement?.active?.some((entry) => entry.kind === "image")
      && snapshot.runtimeMountState === "loaded"
      && snapshot.runtimeCanvasCount > 0
      && snapshot.runtimeWebglCanvasCount > 0
      && snapshot.runtimeCanvasMaxWidth > 0
      && snapshot.runtimeCanvasMaxHeight > 0
      && snapshot.maxVideoReadyState >= 2
  );

  await runInPage("reset VAP row image replacement", "window.__autoSvgaShortTermActions.resetImageReplacement()");
  const rowResetSnapshot = await waitForPage("VAP row replacement reset", () => pageSnapshot(), (snapshot) =>
    snapshot.hostModel?.model?.replacement?.dirty === false
      && snapshot.hostModel?.model?.replacement?.resetEnabled === false
      && snapshot.runtimeMountState === "loaded"
      && snapshot.runtimeCanvasCount > 0
      && snapshot.runtimeWebglCanvasCount > 0
      && snapshot.runtimeCanvasMaxWidth > 0
      && snapshot.runtimeCanvasMaxHeight > 0
      && snapshot.maxVideoReadyState >= 2
  );

  await writeProof({
    status: "passed",
    productMilestoneId: MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID,
    sourceHead: await gitHead(),
    input: {
      boundedVapSha256: expectedFixtureHashes[boundedVapPath],
      vapcSha256: expectedFixtureHashes[sidecarVapcPath],
      replacementPngSha256: replacementSha256,
      pathRedacted: true
    },
    evidence: {
      openAction,
      loaded: compactSnapshot(loadedSnapshot),
      playing: compactSnapshot(playingSnapshot),
      paused: compactSnapshot(pausedSnapshot),
      replacement: compactSnapshot(replacementSnapshot),
      reset: compactSnapshot(resetSnapshot),
      rowReplacement: compactSnapshot(rowReplacementSnapshot),
      rowReset: compactSnapshot(rowResetSnapshot),
      lifecycle: previewSession.lifecycle,
      externalRequests,
      consoleMessages: consoleMessages.slice(-10),
      ipcEvents
    },
    boundaries: {
      foreground: false,
      ownerInstalledAppMutated: false,
      productionAssetsCommitted: false,
      saveExportConversion: false
    }
  });
  await cleanup();
}

function installIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.openMultiFormatFile, async () => ({ status: "cancelled" }));
  ipcMain.handle(IPC_CHANNELS.openDroppedMultiFormatFile, async (_event, input) => previewSession.openDroppedFile(input));
  ipcMain.handle(IPC_CHANNELS.prepareMultiFormatRuntimePreview, async (_event, input) => {
    ipcEvents.push({ phase: "prepare_runtime_preview", format: input?.format, sourceIdHash: hashId(input?.sourceId) });
    return previewSession.prepareRuntimePreview(input);
  });
  ipcMain.handle(IPC_CHANNELS.controlMultiFormatPreview, async (_event, input) => {
    ipcEvents.push({ phase: "control", action: input?.action });
    return previewSession.control(input);
  });
  ipcMain.handle(IPC_CHANNELS.chooseMultiFormatReplacementImage, async (_event, input) => {
    const targetId = String(input?.targetId ?? "");
    const sourceId = String(input?.sourceId ?? "");
    if (sourceId && sourceId !== previewSession.activeSourceId) {
      return { status: "failed", code: "parse_precondition", message: "stale replacement request", pathRedacted: true };
    }
    const dataUri = `data:image/png;base64,${readFileSync(replacementPngPath).toString("base64")}`;
    ipcEvents.push({ phase: "choose_replacement_image", targetIdHash: hashId(targetId), sourceIdHash: hashId(sourceId), sha256: sha256File(replacementPngPath) });
    const result = await previewSession.applyReplacement({
      targetId,
      kind: "image",
      value: dataUri
    });
    return {
      ...result,
      replacementRuntimeValue: {
        kind: "image",
        targetId,
        value: dataUri
      },
      picker: {
        status: "opened",
        mediaType: "image/png",
        sha256: sha256File(replacementPngPath),
        pathRedacted: true
      }
    };
  });
  ipcMain.handle(IPC_CHANNELS.applyMultiFormatReplacement, async (_event, input) => {
    ipcEvents.push({ phase: "apply_replacement", kind: input?.kind, targetIdHash: hashId(input?.targetId) });
    return previewSession.applyReplacement(input);
  });
  ipcMain.handle(IPC_CHANNELS.resetMultiFormatReplacement, async (_event, input) => {
    ipcEvents.push({ phase: "reset_replacement", kind: input?.kind });
    return previewSession.resetReplacement(input);
  });
  ipcMain.handle(IPC_CHANNELS.multiFormatRendererReady, async (_event, input) => {
    ipcEvents.push({ phase: String(input?.phase ?? "renderer_ready") });
    return { ok: true };
  });
  ipcMain.handle(IPC_CHANNELS.writeClipboardText, async () => false);
  ipcMain.handle(IPC_CHANNELS.updateShortTermMenuState, async () => true);
  ipcMain.handle(IPC_CHANNELS.setShortTermWindowMode, async () => true);
}

async function pageSnapshot() {
  return runInPage("page snapshot", `
    (async () => {
      const bridge = window.autoSvgaElectronHost;
      const actions = window.__autoSvgaShortTermActions;
      const mount = document.querySelector("#multiFormatRuntimeMount");
      const videos = Array.from(document.querySelectorAll("video"));
      const runtimeCanvases = mount ? Array.from(mount.querySelectorAll("canvas")) : [];
      const runtimeCanvasDetails = runtimeCanvases.map((canvas) => {
        let webgl = false;
        let experimentalWebgl = false;
        let webgl2 = false;
        try {
          webgl = !!canvas.getContext("webgl");
        } catch {}
        try {
          experimentalWebgl = !!canvas.getContext("experimental-webgl");
        } catch {}
        try {
          webgl2 = !!canvas.getContext("webgl2");
        } catch {}
        return {
          width: Number(canvas.width) || 0,
          height: Number(canvas.height) || 0,
          clientWidth: Number(canvas.clientWidth) || 0,
          clientHeight: Number(canvas.clientHeight) || 0,
          webgl,
          experimentalWebgl,
          webgl2
        };
      });
      let summary;
      try {
        summary = actions?.currentStateSummary ? JSON.parse(actions.currentStateSummary()) : undefined;
      } catch {}
      let hostModel;
      try {
        hostModel = bridge?.controlMultiFormatPreview ? await bridge.controlMultiFormatPreview({ action: "model" }) : undefined;
      } catch {}
      const bodyText = document.body?.innerText || "";
      return {
        productMilestoneId: bridge?.productMilestoneId,
        bridgeReady: !!bridge?.prepareMultiFormatRuntimePreview,
        actionBridgeReady: !!actions?.completeHostFileOpen,
        appState: document.querySelector(".macApp")?.dataset.appState,
        view: document.querySelector(".view.isActive")?.dataset.view,
        summary,
        hostModel,
        runtimeMountState: mount?.dataset.runtimePreviewState || "",
        runtimeFormat: mount?.dataset.runtimeFormat || "",
        runtimeCanvasCount: runtimeCanvases.length,
        runtimeWebglCanvasCount: runtimeCanvasDetails.filter((canvas) =>
          canvas.width > 0 && canvas.height > 0 && (canvas.webgl || canvas.experimentalWebgl || canvas.webgl2)
        ).length,
        runtimeCanvasMaxWidth: runtimeCanvasDetails.reduce((max, canvas) => Math.max(max, canvas.width), 0),
        runtimeCanvasMaxHeight: runtimeCanvasDetails.reduce((max, canvas) => Math.max(max, canvas.height), 0),
        runtimeCanvasDetails,
        videoCount: videos.length,
        maxVideoReadyState: videos.reduce((max, video) => Math.max(max, video.readyState || 0), 0),
        anyVideoPaused: videos.length > 0 ? videos.some((video) => video.paused) : undefined,
        playbackTime: document.querySelector(".playbackTime")?.textContent || "",
        errorMessage: document.querySelector("#errorMessage")?.textContent || "",
        bodyTextIncludes: ["VAP", "avatar", "120", "160", "avc1", "资产", "播放"].filter((token) => bodyText.includes(token))
      };
    })()
  `);
}

async function runInPage(label, source) {
  if (!windowRef || windowRef.isDestroyed()) throw new Error(`Cannot run ${label}; proof window is unavailable.`);
  return windowRef.webContents.executeJavaScript(source, true);
}

async function waitForPage(label, snapshotFn, predicate, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await snapshotFn();
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${label} did not reach expected state: ${JSON.stringify(compactSnapshot(last))}`);
}

function compactSnapshot(snapshot) {
  return {
    appState: snapshot?.appState,
    view: snapshot?.view,
    summary: snapshot?.summary,
    modelStatus: snapshot?.hostModel?.model?.status,
    modelFormat: snapshot?.hostModel?.model?.detectedFormat,
    replacement: snapshot?.hostModel?.model?.replacement,
    issueCodes: snapshot?.hostModel?.model?.rightPanel?.issues?.map((issue) => ({
      code: issue.code,
      severity: issue.severity,
      reason: issue.details?.reason
    })),
    runtimeMountState: snapshot?.runtimeMountState,
    runtimeFormat: snapshot?.runtimeFormat,
    runtimeCanvasCount: snapshot?.runtimeCanvasCount,
    runtimeWebglCanvasCount: snapshot?.runtimeWebglCanvasCount,
    runtimeCanvasMaxWidth: snapshot?.runtimeCanvasMaxWidth,
    runtimeCanvasMaxHeight: snapshot?.runtimeCanvasMaxHeight,
    videoCount: snapshot?.videoCount,
    maxVideoReadyState: snapshot?.maxVideoReadyState,
    anyVideoPaused: snapshot?.anyVideoPaused,
    playbackTime: snapshot?.playbackTime,
    errorMessage: snapshot?.errorMessage,
    bodyTextIncludes: snapshot?.bodyTextIncludes
  };
}

function modelStatus(snapshot) {
  return snapshot?.summary?.status ?? snapshot?.hostModel?.model?.status;
}

function modelFormat(snapshot) {
  return snapshot?.summary?.format ?? snapshot?.hostModel?.model?.detectedFormat;
}

function verifyFixtureHashes() {
  for (const [filePath, expected] of Object.entries(expectedFixtureHashes)) {
    if (!existsSync(filePath)) throw new Error(`Required task-owned VAP fixture is missing: ${path.basename(filePath)}`);
    const actual = sha256File(filePath);
    if (actual !== expected) {
      throw new Error(`Task-owned VAP fixture hash drift for ${path.basename(filePath)}: ${actual}`);
    }
  }
}

async function writeProof(value) {
  mkdirSync(proofRoot, { recursive: true });
  writeFileSync(proofOutputPath, `${JSON.stringify(value, null, 2)}\n`);
  const sha256 = sha256File(proofOutputPath);
  process.stdout.write(JSON.stringify({ proofOutputPath, sha256, status: value.status }) + "\n");
}

async function cleanup() {
  try {
    windowRef?.destroy();
  } catch {}
  try {
    await server?.close?.();
  } catch {}
  try {
    previewSession.control({ action: "dispose" }).catch(() => {});
  } catch {}
  try {
    app.quit();
  } catch {}
}

async function gitHead() {
  try {
    const { execFile } = require("node:child_process");
    return await new Promise((resolve) => {
      execFile("git", ["rev-parse", "HEAD"], { cwd: repoRoot }, (error, stdout) => {
        resolve(error ? "" : stdout.trim());
      });
    });
  } catch {
    return "";
  }
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function sha256Text(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function hashId(value) {
  return typeof value === "string" && value.length > 0 ? sha256Text(value).slice(0, 16) : "";
}

function redactString(value) {
  return String(value ?? "")
    .replace(/\/Users\/[^/\s]+(?:\/[^\s:]*)?/gu, "[local path]")
    .replace(/[A-Za-z]:\\Users\\[^\\\s]+(?:\\[^\s:]*)?/gu, "[local path]")
    .slice(0, 300);
}
