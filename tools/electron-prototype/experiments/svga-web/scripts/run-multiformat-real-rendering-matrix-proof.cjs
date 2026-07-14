"use strict";

const { execFile } = require("node:child_process");
const { createHash } = require("node:crypto");
const { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
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
  getRecentSvgaFiles: "svga-web-experiment:get-recent-svga-files",
  openRecentSvgaFile: "svga-web-experiment:open-recent-svga-file",
  clearRecentSvgaFiles: "svga-web-experiment:clear-recent-svga-files",
  writeClipboardText: "svga-web-experiment:write-clipboard-text",
  updateShortTermMenuState: "svga-web-experiment:update-short-term-menu-state",
  setShortTermWindowMode: "svga-web-experiment:set-short-term-window-mode"
});

const scriptRoot = __dirname;
const appRoot = path.resolve(scriptRoot, "..");
const repoRoot = path.resolve(appRoot, "../../../..");
const taskVapRoot = "/private/tmp/auto-svga-qa-multiformat-positive-20260713-016/bounded-vap";
const taskVapPath = path.join(taskVapRoot, "bounded-vap.mp4");
const taskVapcPath = path.join(taskVapRoot, "vapc.json");
const skipFusionFixture = process.env.AUTO_SVGA_SKIP_FUSION_FIXTURE === "1";
const expectedTaskFixtureHashes = Object.freeze({
  [taskVapPath]: "25ce657cf3de383e368c829bfcb9a17879d2bc7c7ebe151f66ebf5d64b73dd64",
  [taskVapcPath]: "d1e9160d3d7f9d25c6b789f39c077603ff8ef50abaa19ccaf9192052ff55dc77"
});
const ownerInputSpecs = Object.freeze({
  svga: {
    alias: "REAL-SVGA-SQUARE-A",
    env: "AUTO_SVGA_OWNER_SVGA_PATH",
    sha256: "da75da15150fb7d9bca0c3a5acafbcce9601438a2142afdd2c014b0c3d64449d"
  },
  lottie: {
    alias: "REAL-LOTTIE-EMBEDDED-A",
    env: "AUTO_SVGA_OWNER_LOTTIE_PATH",
    sha256: "4d415de7f6ec0a3742281e91f60a0dcc9e1c5574760e82e17a053eafc1d82eb1"
  },
  vap: {
    alias: "OWNER-VAP-A",
    env: "AUTO_SVGA_OWNER_VAP_PATH",
    sha256: "22cb7c516cba552ba5347e82aea7d17b8a3f988b68befbb7e6f69743b096de9d",
    sidecarSha256: "025378648238f3736228bdcbb5b1607f516daf4841fb525d94ece316f0dd96b7"
  }
});
const tinyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8BQz0AEYBxVSFIAAA7ABAPik4nGAAAAAElFTkSuQmCC";

const proofRoot = path.join(os.tmpdir(), `auto-svga-real-rendering-matrix-proof-${process.pid}`);
const proofOutputPath = path.join(proofRoot, "real-rendering-matrix-proof.json");
const replacementPngPath = path.join(proofRoot, "task-owned-vap-replacement.png");
const vapPath = path.join(proofRoot, "bounded-vap.mp4");
const vapcPath = path.join(proofRoot, "vapc.json");
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
let ownerInputs;

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
      consoleMessages: consoleMessages.slice(-20),
      ipcEvents
    }
  }).catch(() => {});
  await cleanup().catch(() => {});
  process.exitCode = 1;
});

async function main() {
  mkdirSync(proofRoot, { recursive: true });
  prepareFixtures();

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
    reportToken: "real-rendering-matrix-proof",
    desktopArtifacts: undefined
  });
  installIpcHandlers();

  windowRef = new BrowserWindow({
    title: "Auto SVGA Real Rendering Matrix Proof",
    width: 720,
    height: 720,
    show: false,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(appRoot, "preload.cjs"),
      additionalArguments: [
        "--prototype-product-milestone=0.2-multiformat-preview",
        "--prototype-report-token=real-rendering-matrix-proof",
        "--prototype-host-boundary=formal"
      ]
    }
  });
  windowRef.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    consoleMessages.push({ level, message: redactString(message), line, source: redactString(sourceId) });
  });

  await windowRef.loadURL(`${server.origin}/`);
  await waitForPage("0.2 action bridge", () => pageSnapshot(), (snapshot) =>
    snapshot.productMilestoneId === MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID
      && snapshot.actionBridgeReady === true
      && snapshot.bridgeReady === true
  );

  const svgaEvidence = await provePlayableFormat({
    label: ownerInputs.svga.alias,
    format: "svga",
    filePath: ownerInputs.svga.filePath,
    expectedCanvas: "primary"
  });
  const lottieEvidence = await provePlayableFormat({
    label: ownerInputs.lottie.alias,
    format: "lottie",
    filePath: ownerInputs.lottie.filePath,
    expectedCanvas: "runtime",
    expectedImageCount: 2
  });
  const vapEvidence = await provePlayableFormat({
    label: ownerInputs.vap.alias,
    format: "vap",
    filePath: ownerInputs.vap.filePath,
    expectedCanvas: "runtime",
    requireVideo: true,
    requireWebgl: true,
    requireCanvasRisk: true,
    expectedBacking: { width: 750, height: 1624 }
  });
  const boundedVapEvidence = skipFusionFixture
    ? { status: "notRun", reason: "task_owned_fusion_fixture_unavailable" }
    : await provePlayableFormat({
        label: "VAP-FUSION-BOUNDED",
        format: "vap",
        filePath: vapPath,
        expectedCanvas: "runtime",
        requireVideo: true,
        requireWebgl: true,
        expectedBacking: { width: 120, height: 80 }
      });
  const vapReplacementEvidence = skipFusionFixture
    ? { status: "notRun", reason: "task_owned_fusion_fixture_unavailable" }
    : await proveVapReplacementAndReset();
  const invalidLottieEvidence = await proveMissingLottieAssetFailure();
  const placeholderRegression = provePlaceholderSuccessGateRejectsSourceSideContract();
  const pauseRegression = provePauseGateRejectsNonzeroReset();
  const svgaIdentityRegression = proveSvgaIdentityGateRejectsGenericCanvas();
  const svgaPixelRegression = proveSvgaPixelGateRejectsBlankCanvas();
  const svgaOpaquePlaceholderRegression = proveSvgaPixelGateRejectsOpaquePlaceholderCanvas();
  const svgaCoupledPlaybackRegressions = proveSvgaCoupledPlaybackGateRejectsFalsePositives();
  const lottieChildPixelRegression = proveRuntimeChildPixelGateRejectsStaticOrBlankChild("lottie");
  const vapChildPixelRegression = proveRuntimeChildPixelGateRejectsStaticOrBlankChild("vap");
  const vapAspectRatioRegression = proveVapAspectRatioGateRejectsSquareCssRect();
  const vapClippedChildRegression = proveVapVisibilityGateRejectsClippedChild();

  if (externalRequests.length > 0) {
    throw new Error(`Unexpected external requests during real-rendering proof: ${JSON.stringify(externalRequests)}`);
  }
  const severeConsole = consoleMessages.filter((entry) =>
    entry.level >= 3
      && !/No image replacement provided for VAP fusion tag/u.test(entry.message)
  );
  if (severeConsole.length > 0) {
    throw new Error(`Unexpected renderer console errors: ${JSON.stringify(severeConsole.slice(-5))}`);
  }

  await writeProof({
    status: "passed",
    productMilestoneId: MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID,
    sourceHead: await gitHead(),
    input: {
      ownerSvga: ownerInputEvidence(ownerInputs.svga),
      ownerLottie: ownerInputEvidence(ownerInputs.lottie),
      ownerVap: ownerInputEvidence(ownerInputs.vap),
      ...(skipFusionFixture ? {} : {
        boundedVapSha256: expectedTaskFixtureHashes[taskVapPath],
        vapcSha256: expectedTaskFixtureHashes[taskVapcPath],
        replacementPngSha256: sha256File(replacementPngPath)
      }),
      pathRedacted: true
    },
    evidence: {
      svga: svgaEvidence,
      lottie: lottieEvidence,
      vap: vapEvidence,
      boundedVap: boundedVapEvidence,
      vapReplacement: vapReplacementEvidence,
      invalidLottie: invalidLottieEvidence,
      placeholderRegression,
      pauseRegression,
      svgaIdentityRegression,
      svgaPixelRegression,
      svgaOpaquePlaceholderRegression,
      svgaCoupledPlaybackRegressions,
      lottieChildPixelRegression,
      vapChildPixelRegression,
      vapAspectRatioRegression,
      vapClippedChildRegression,
      lifecycle: previewSession.lifecycle,
      externalRequests,
      consoleMessages: consoleMessages.slice(-20),
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

async function provePlayableFormat(input) {
  const openAction = await openFileInProduct(input.filePath, input.label);
  const loadedSnapshot = await waitForPage(`${input.label} mounted`, () => pageSnapshot(), (snapshot) =>
    modelStatus(snapshot) === "previewReady"
      && modelFormat(snapshot) === input.format
      && snapshot.runtimeMountState === "loaded"
      && snapshot.runtimeFormat === input.format
      && snapshot.errorMessage === ""
      && visiblePlaybackTimeMatchesRuntime(snapshot)
      && successfulRendererIdentity(input, snapshot)
      && (input.expectedCanvas !== "runtime" || snapshot.runtimeRenderableCount > 0)
      && (input.expectedCanvas !== "primary" || snapshot.primaryCanvasVisible === true)
      && (input.requireVideo !== true || snapshot.maxVideoReadyState >= 2)
      && (input.requireWebgl !== true || snapshot.runtimeWebglCanvasCount > 0)
  );
  assertSuccessfulPlayableSnapshot(input.label, "loaded", input, loadedSnapshot);
  assertExpectedOwnerFacts(input, loadedSnapshot);
  const loadedPixels = await captureRuntimePixels(input.format);
  assertRenderablePixels(input.label, "loaded", loadedPixels, { requireBackingStore: input.format === "svga" });

  await runInPage(`${input.label} play`, "window.__autoSvgaShortTermActions.playPause()");
  const playingFirst = await waitForPage(`${input.label} playing first sample`, () => pageSnapshot(), (snapshot) =>
    modelStatus(snapshot) === "playing"
      && modelFormat(snapshot) === input.format
      && snapshot.runtimeMountState === "loaded"
      && snapshot.errorMessage === ""
      && visiblePlaybackTimeMatchesRuntime(snapshot)
      && successfulRendererIdentity(input, snapshot)
      && Number(snapshot.runtimePlaybackProgress) >= 0
      && (input.requireVideo !== true || snapshot.anyVideoPaused === false)
  );
  const playingFirstPixels = await captureRuntimePixels(input.format);
  const playingSamples = [{ snapshot: playingFirst, pixels: playingFirstPixels }];
  for (const intervalMs of [275, 425, 350]) {
    await delay(intervalMs);
    const snapshot = await pageSnapshot();
    const pixels = await captureRuntimePixels(input.format);
    playingSamples.push({ snapshot, pixels });
  }
  for (const [index, sample] of playingSamples.entries()) {
    const phase = `playing-${index + 1}`;
    assertSuccessfulPlayableSnapshot(input.label, phase, input, sample.snapshot);
    assertRenderablePixels(input.label, phase, sample.pixels, { requireBackingStore: input.format === "svga" });
  }
  assertCoupledPlayingSampleSequence(input.label, playingSamples);
  const playingSecond = playingSamples.at(-1).snapshot;
  const playingSecondPixels = playingSamples.at(-1).pixels;

  const playingBeforePause = await pageSnapshot();
  assertSuccessfulPlayableSnapshot(input.label, "playing-before-pause", input, playingBeforePause);
  await runInPage(`${input.label} pause`, "window.__autoSvgaShortTermActions.playPause()");
  const pausedFirst = await waitForPage(`${input.label} paused first sample`, () => pageSnapshot(), (snapshot) =>
    modelStatus(snapshot) === "paused"
      && modelFormat(snapshot) === input.format
      && snapshot.runtimeMountState === "loaded"
      && snapshot.errorMessage === ""
      && visiblePlaybackTimeMatchesRuntime(snapshot)
      && successfulRendererIdentity(input, snapshot)
      && (input.requireVideo !== true || snapshot.anyVideoPaused === true)
  );
  const pausedFirstPixels = await captureRuntimePixels(input.format);
  await delay(500);
  const pausedSecond = await pageSnapshot();
  const pausedSecondPixels = await captureRuntimePixels(input.format);
  assertSuccessfulPlayableSnapshot(input.label, "paused-first", input, pausedFirst);
  assertSuccessfulPlayableSnapshot(input.label, "paused-second", input, pausedSecond);
  assertRenderablePixels(input.label, "paused-first", pausedFirstPixels, { requireBackingStore: input.format === "svga" });
  assertRenderablePixels(input.label, "paused-second", pausedSecondPixels, { requireBackingStore: input.format === "svga" });
  assertPausePreservedAdvancedFrame(input.label, playingBeforePause, pausedFirst, pausedSecond);
  if (input.format === "svga") {
    assertSvgaCanvasEvidence(input.label, {
      loadedPixels,
      playingSamples,
      pausedFirstPixels,
      pausedSecondPixels,
      loadedSnapshot,
      pausedFirstSnapshot: pausedFirst,
      pausedSecondSnapshot: pausedSecond
    });
  } else if (input.format === "lottie" || input.format === "vap") {
    assertRuntimeChildAnimationPixels(input.label, input.format, {
      loadedPixels,
      playingSamples,
      pausedFirstPixels,
      pausedSecondPixels
    }, { expectedBacking: input.expectedBacking });
  }

  return {
    openAction,
    loaded: compactSnapshot(loadedSnapshot),
    loadedPixels,
    playingFirst: compactSnapshot(playingFirst),
    playingSecond: compactSnapshot(playingSecond),
    playingSamples: playingSamples.map((sample) => ({
      snapshot: compactSnapshot(sample.snapshot),
      pixels: sample.pixels
    })),
    playingBeforePause: compactSnapshot(playingBeforePause),
    playingFirstPixels,
    playingSecondPixels,
    pausedFirst: compactSnapshot(pausedFirst),
    pausedSecond: compactSnapshot(pausedSecond),
    pausedFirstPixels,
    pausedSecondPixels
  };
}

async function proveVapReplacementAndReset() {
  const replaceAction = await runInPage("VAP replacement via action bridge", `
    (async () => {
      await window.__autoSvgaShortTermActions.replaceImage();
      return window.autoSvgaElectronHost.controlMultiFormatPreview({ action: "model" });
    })()
  `);
  if (replaceAction?.model?.replacement?.dirty !== true) {
    throw new Error(`VAP replacement did not become dirty: ${JSON.stringify(compactSnapshot({ hostModel: replaceAction }))}`);
  }
  const replacement = await waitForPage("VAP replacement remounted", () => pageSnapshot(), (snapshot) =>
    modelFormat(snapshot) === "vap"
      && snapshot.hostModel?.model?.replacement?.dirty === true
      && snapshot.hostModel?.model?.replacement?.active?.some((entry) => entry.kind === "image")
      && snapshot.runtimeMountState === "loaded"
      && snapshot.runtimeWebglCanvasCount > 0
      && snapshot.maxVideoReadyState >= 2
  );
  const replacementPixels = await captureRuntimePixels("vap");
  assertRenderablePixels("VAP-A", "replacement", replacementPixels);

  await runInPage("VAP replacement reset", "window.__autoSvgaShortTermActions.resetImageReplacement()");
  const reset = await waitForPage("VAP reset remounted", () => pageSnapshot(), (snapshot) =>
    modelFormat(snapshot) === "vap"
      && snapshot.hostModel?.model?.replacement?.dirty === false
      && snapshot.hostModel?.model?.replacement?.resetEnabled === false
      && snapshot.runtimeMountState === "loaded"
      && snapshot.runtimeWebglCanvasCount > 0
      && snapshot.maxVideoReadyState >= 2
  );
  const resetPixels = await captureRuntimePixels("vap");
  assertRenderablePixels("VAP-A", "reset", resetPixels);
  return {
    replacement: compactSnapshot(replacement),
    replacementPixels,
    reset: compactSnapshot(reset),
    resetPixels
  };
}

async function proveMissingLottieAssetFailure() {
  const missingPath = path.join(proofRoot, "missing-asset-lottie.json");
  writeFileSync(missingPath, JSON.stringify(createTaskOwnedLottieDocument("images/missing.png")));
  const openAction = await openFileInProduct(missingPath, "LOTTIE-MISSING-ASSET");
  const snapshot = await waitForPage("Lottie missing asset typed failure", () => pageSnapshot(), (candidate) =>
    modelFormat(candidate) === "lottie"
      && ["failed", "playbackBlocked"].includes(candidate.hostModel?.model?.status)
      && candidate.hostModel?.model?.rightPanel?.issues?.some((issue) => issue.code === "missing_resource")
  );
  if (snapshot.runtimeFormat === "lottie" && snapshot.runtimeMountState === "loaded") {
    throw new Error("Missing-resource Lottie reached runtime mount instead of typed failure.");
  }
  return { openAction, snapshot: compactSnapshot(snapshot) };
}

async function openFileInProduct(filePath, label) {
  const openResult = await previewSession.openLocalFilePath(filePath, "fileOpenEvent");
  const eventId = `${label.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}-open`;
  const openAction = await runInPage(`${label} host file-open`, `
    (async () => {
      const actions = window.__autoSvgaShortTermActions;
      const eventId = ${JSON.stringify(eventId)};
      const openResult = ${JSON.stringify(openResult)};
      if (openResult?.svgaSource?.bytes && !(openResult.svgaSource.bytes instanceof Uint8Array)) {
        openResult.svgaSource.bytes = Uint8Array.from(Object.values(openResult.svgaSource.bytes));
      }
      const begun = actions.beginHostFileOpen({ eventId });
      const completed = await actions.completeHostFileOpen({ eventId, result: openResult });
      return { begun, completed };
    })()
  `);
  if (openAction?.begun !== true || openAction?.completed !== true) {
    throw new Error(`${label} host file-open action was not accepted: ${JSON.stringify(openAction)}`);
  }
  return openAction;
}

function installIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.openMultiFormatFile, async () => ({ status: "cancelled" }));
  ipcMain.handle(IPC_CHANNELS.getRecentSvgaFiles, async () => []);
  ipcMain.handle(IPC_CHANNELS.openRecentSvgaFile, async () => ({ status: "missing", pathRedacted: true }));
  ipcMain.handle(IPC_CHANNELS.clearRecentSvgaFiles, async () => ({ status: "cleared", count: 0 }));
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
    const targetId = String(input?.targetId ?? "").trim();
    const sourceId = String(input?.sourceId ?? "").trim();
    if (!targetId || !sourceId || sourceId !== previewSession.activeSourceId) {
      return { status: "failed", code: "parse_precondition", message: "stale replacement request", pathRedacted: true };
    }
    const selectionBeforeRead = await previewSession.resolveReplacementSelection({ targetId, kind: "image" });
    if (selectionBeforeRead.status !== "accepted") {
      return {
        status: "failed",
        code: selectionBeforeRead.diagnostic?.code || "replacement_target_unavailable",
        message: selectionBeforeRead.diagnostic?.message || "replacement target unavailable",
        pathRedacted: true
      };
    }
    const dataUri = `data:image/png;base64,${readFileSync(replacementPngPath).toString("base64")}`;
    const selectionAfterRead = await previewSession.resolveReplacementSelection({ targetId, kind: "image" });
    if (
      selectionAfterRead.status !== "accepted"
      || selectionAfterRead.bindingToken !== selectionBeforeRead.bindingToken
    ) {
      return { status: "failed", code: "replacement_target_stale", message: "replacement target changed", pathRedacted: true };
    }
    ipcEvents.push({ phase: "choose_replacement_image", targetIdHash: hashId(targetId), sourceIdHash: hashId(sourceId), sha256: sha256File(replacementPngPath) });
    const result = await previewSession.applyReplacement({
      targetId: selectionAfterRead.publicTargetId,
      kind: "image",
      value: dataUri
    });
    const acceptedRuntimeTargetId = String(result?.model?.replacement?.lastAction?.runtimeTargetId ?? "").trim();
    if (!acceptedRuntimeTargetId || acceptedRuntimeTargetId !== selectionAfterRead.runtimeTargetId) {
      return {
        status: "failed",
        code: "replacement_target_malformed",
        message: "replacement did not return its accepted runtime target",
        pathRedacted: true
      };
    }
    ipcEvents.push({
      phase: "replacement_binding_accepted",
      publicTargetIdHash: hashId(selectionAfterRead.publicTargetId),
      runtimeTargetIdHash: hashId(acceptedRuntimeTargetId)
    });
    return {
      ...result,
      replacementRuntimeValue: { kind: "image", targetId: acceptedRuntimeTargetId, value: dataUri },
      picker: {
        status: "opened",
        mediaType: "image/png",
        sha256: sha256File(replacementPngPath),
        pathRedacted: true
      }
    };
  });
  ipcMain.handle(IPC_CHANNELS.applyMultiFormatReplacement, async (_event, input) => previewSession.applyReplacement(input));
  ipcMain.handle(IPC_CHANNELS.resetMultiFormatReplacement, async (_event, input) => previewSession.resetReplacement(input));
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
        try { webgl = !!canvas.getContext("webgl"); } catch {}
        try { experimentalWebgl = !!canvas.getContext("experimental-webgl"); } catch {}
        try { webgl2 = !!canvas.getContext("webgl2"); } catch {}
        return {
          width: Number(canvas.width) || 0,
          height: Number(canvas.height) || 0,
          clientWidth: Number(canvas.clientWidth) || 0,
          clientHeight: Number(canvas.clientHeight) || 0,
          runtimePlayer: canvas.dataset.runtimePlayer || "",
          webgl,
          experimentalWebgl,
          webgl2
        };
      });
      let summary;
      try { summary = actions?.currentStateSummary ? JSON.parse(actions.currentStateSummary()) : undefined; } catch {}
      let hostModel;
      try { hostModel = bridge?.controlMultiFormatPreview ? await bridge.controlMultiFormatPreview({ action: "model" }) : undefined; } catch {}
      const bodyText = document.body?.innerText || "";
      const primaryCanvas = document.querySelector("#primaryCanvas");
      const primarySvgaReady = primaryCanvas?.dataset.runtimePlayer === "svga-web"
        && primaryCanvas?.dataset.runtimePlayerReady === "true";
      const lottieSvg = mount?.querySelector("svg");
      const lottieDomState = lottieSvg
        ? Array.from(lottieSvg.querySelectorAll("g,image,path")).slice(0, 32).map((element) => {
            return {
              tag: element.tagName,
              transform: element.getAttribute("transform") || "",
              style: element.getAttribute("style") || "",
              opacity: element.getAttribute("opacity") || "",
              display: element.getAttribute("display") || ""
            };
          })
        : [];
      return {
        productMilestoneId: bridge?.productMilestoneId,
        bridgeReady: !!bridge?.prepareMultiFormatRuntimePreview,
        actionBridgeReady: !!actions?.completeHostFileOpen,
        appState: document.querySelector(".macApp")?.dataset.appState,
        view: document.querySelector(".view.isActive")?.dataset.view,
        summary,
        hostModel,
        primaryCanvasVisible: !!primaryCanvas && primaryCanvas.style.visibility !== "hidden",
        primaryCanvasWidth: Number(primaryCanvas?.width) || 0,
        primaryCanvasHeight: Number(primaryCanvas?.height) || 0,
        runtimeMountState: primarySvgaReady ? "loaded" : mount?.dataset.runtimePreviewState || "",
        runtimeFormat: primarySvgaReady ? "svga" : mount?.dataset.runtimeFormat || "",
        runtimePlayerReady: primarySvgaReady ? "svga-web" : mount?.dataset.runtimePlayerReady || "",
        runtimePlaybackState: primarySvgaReady ? primaryCanvas.dataset.runtimePlaybackState || "" : "",
        runtimePlaybackProgress: Number(primarySvgaReady ? primaryCanvas.dataset.runtimePlaybackProgress : mount?.dataset.runtimePlaybackProgress) || 0,
        runtimePlaybackFrame: Number(primarySvgaReady ? primaryCanvas.dataset.runtimePlaybackFrame : mount?.dataset.runtimePlaybackFrame) || 0,
        runtimePlaybackFrames: Number(primarySvgaReady ? primaryCanvas.dataset.runtimePlaybackFrames : mount?.dataset.runtimePlaybackFrames) || 0,
        runtimePlaybackTimeCopy: primarySvgaReady ? primaryCanvas.dataset.runtimePlaybackTimeCopy || "" : mount?.dataset.runtimePlaybackTimeCopy || "",
        runtimeCanvasCount: runtimeCanvases.length,
        runtimeSvgaCanvasCount: primarySvgaReady ? 1 : runtimeCanvasDetails.filter((canvas) => canvas.runtimePlayer === "svga-web").length,
        runtimeRenderableCount: runtimeCanvases.length + (mount?.querySelectorAll("svg").length || 0),
        runtimeSvgCount: mount?.querySelectorAll("svg").length || 0,
        lottieDomState,
        runtimeWebglCanvasCount: runtimeCanvasDetails.filter((canvas) =>
          canvas.width > 0 && canvas.height > 0 && (canvas.webgl || canvas.experimentalWebgl || canvas.webgl2)
        ).length,
        runtimeCanvasMaxWidth: runtimeCanvasDetails.reduce((max, canvas) => Math.max(max, canvas.width), 0),
        runtimeCanvasMaxHeight: runtimeCanvasDetails.reduce((max, canvas) => Math.max(max, canvas.height), 0),
        runtimeCanvasDetails,
        videoCount: videos.length,
        maxVideoReadyState: videos.reduce((max, video) => Math.max(max, video.readyState || 0), 0),
        anyVideoPaused: videos.length > 0 ? videos.some((video) => video.paused) : undefined,
        maxVideoCurrentTime: videos.reduce((max, video) => Math.max(max, Number(video.currentTime) || 0), 0),
        playbackTime: document.querySelector("#playbackTime")?.textContent || "",
        errorMessage: document.querySelector('.view[data-view="failed"].isActive #errorMessage')?.textContent || "",
        bodyTextIncludes: ["SVGA", "LOTTIE", "VAP", "avatar", "image_0", "播放受限", "source-side preview contract"].filter((token) => bodyText.includes(token))
      };
    })()
  `);
}

async function captureRuntimePixels(format) {
  if (format === "svga") {
    return captureSvgaCanvasBackingStorePixels();
  }
  const rect = await runInPage(`${format} runtime child rect`, `
    (() => {
      const mount = document.querySelector("#multiFormatRuntimeMount");
      let element;
      if (${JSON.stringify(format)} === "lottie") {
        element = mount?.querySelector("svg");
      } else if (${JSON.stringify(format)} === "vap") {
        element = Array.from(mount?.querySelectorAll("canvas") || []).find((canvas) => {
          try {
            return !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl") || canvas.getContext("webgl2"));
          } catch {
            return false;
          }
        });
      } else {
        element = mount;
      }
      if (!element) return undefined;
      const rect = element.getBoundingClientRect();
      const viewportWidths = [
        Number(globalThis.visualViewport?.width),
        Number(document.documentElement?.clientWidth),
        Number(globalThis.innerWidth)
      ].filter((value) => Number.isFinite(value) && value > 0);
      const viewportHeights = [
        Number(globalThis.visualViewport?.height),
        Number(document.documentElement?.clientHeight),
        Number(globalThis.innerHeight)
      ].filter((value) => Number.isFinite(value) && value > 0);
      const viewportWidth = viewportWidths.length > 0 ? Math.min(...viewportWidths) : rect.right;
      const viewportHeight = viewportHeights.length > 0 ? Math.min(...viewportHeights) : rect.bottom;
      const intersectionLeft = Math.max(0, rect.left);
      const intersectionTop = Math.max(0, rect.top);
      const intersectionRight = Math.min(viewportWidth, rect.right);
      const playbackRect = mount?.parentElement?.querySelector?.(".playbackBar")?.getBoundingClientRect?.();
      const playbackTop = Number(playbackRect?.top);
      const visibleBottomBoundary = Number.isFinite(playbackTop) && playbackTop > intersectionTop
        ? Math.min(viewportHeight, playbackTop)
        : viewportHeight;
      const intersectionBottom = Math.min(visibleBottomBoundary, rect.bottom);
      return {
        selector: ${JSON.stringify(format)} === "lottie" ? "#multiFormatRuntimeMount svg" : ${JSON.stringify(format)} === "vap" ? "#multiFormatRuntimeMount canvas[webgl]" : "#multiFormatRuntimeMount",
        backingWidth: Number(element.width) || 0,
        backingHeight: Number(element.height) || 0,
        cssWidth: rect.width,
        cssHeight: rect.height,
        cssLeft: rect.left,
        cssTop: rect.top,
        cssRight: rect.right,
        cssBottom: rect.bottom,
        viewportWidth,
        viewportHeight,
        playbackTop: Number.isFinite(playbackTop) ? playbackTop : undefined,
        visibleWidth: Math.max(0, intersectionRight - intersectionLeft),
        visibleHeight: Math.max(0, intersectionBottom - intersectionTop),
        fullyVisible: intersectionLeft <= rect.left + 0.5
          && intersectionTop <= rect.top + 0.5
          && intersectionRight >= rect.right - 0.5
          && intersectionBottom >= rect.bottom - 0.5,
        deviceScaleFactor: Number(globalThis.devicePixelRatio) || 1,
        x: Math.max(0, Math.floor(rect.x)),
        y: Math.max(0, Math.floor(rect.y)),
        width: Math.max(1, Math.ceil(rect.width)),
        height: Math.max(1, Math.ceil(rect.height))
      };
    })()
  `);
  if (!rect || rect.width <= 1 || rect.height <= 1) {
    throw new Error(`${format} runtime child element did not have a capturable rectangle.`);
  }
  if (typeof windowRef.webContents.invalidate === "function") windowRef.webContents.invalidate();
  await delay(50);
  const image = await windowRef.webContents.capturePage(rect);
  const size = image.getSize();
  const bitmap = image.toBitmap();
  let nonWhite = 0;
  let nonTransparent = 0;
  let channels = 0;
  for (let index = 0; index < bitmap.length; index += 4) {
    const b = bitmap[index] ?? 0;
    const g = bitmap[index + 1] ?? 0;
    const r = bitmap[index + 2] ?? 0;
    const a = bitmap[index + 3] ?? 255;
    if (a > 0) nonTransparent += 1;
    if (a > 0 && (r < 245 || g < 245 || b < 245)) nonWhite += 1;
    channels += Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);
  }
  return {
    source: "compositor-capture",
    selector: rect.selector,
    width: size.width,
    height: size.height,
    backingWidth: rect.backingWidth,
    backingHeight: rect.backingHeight,
    cssWidth: rect.cssWidth,
    cssHeight: rect.cssHeight,
    cssLeft: rect.cssLeft,
    cssTop: rect.cssTop,
    cssRight: rect.cssRight,
    cssBottom: rect.cssBottom,
    viewportWidth: rect.viewportWidth,
    viewportHeight: rect.viewportHeight,
    playbackTop: rect.playbackTop,
    visibleWidth: rect.visibleWidth,
    visibleHeight: rect.visibleHeight,
    fullyVisible: rect.fullyVisible,
    deviceScaleFactor: rect.deviceScaleFactor,
    effectiveScaleX: rect.cssWidth > 0 ? size.width / rect.cssWidth : 0,
    effectiveScaleY: rect.cssHeight > 0 ? size.height / rect.cssHeight : 0,
    backingAspectRatio: rect.backingHeight > 0 ? rect.backingWidth / rect.backingHeight : 0,
    cssAspectRatio: rect.cssHeight > 0 ? rect.cssWidth / rect.cssHeight : 0,
    captureAspectRatio: size.height > 0 ? size.width / size.height : 0,
    nonWhite,
    nonTransparent,
    channelDelta: channels,
    sha256: createHash("sha256").update(bitmap).digest("hex")
  };
}

async function captureSvgaCanvasBackingStorePixels() {
  const pixels = await runInPage("svga runtime canvas backing store pixels", `
    (() => {
      const canvas = document.querySelector('#primaryCanvas[data-runtime-player="svga-web"], #multiFormatRuntimeMount canvas[data-runtime-player="svga-web"]');
      if (!canvas) return undefined;
      const width = Number(canvas.width) || 0;
      const height = Number(canvas.height) || 0;
      if (width <= 0 || height <= 0) return { source: "canvas-backing-store", selector: '#primaryCanvas[data-runtime-player="svga-web"], #multiFormatRuntimeMount canvas[data-runtime-player="svga-web"]', width, height, error: "empty_canvas" };
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return { source: "canvas-backing-store", selector: '#primaryCanvas[data-runtime-player="svga-web"], #multiFormatRuntimeMount canvas[data-runtime-player="svga-web"]', width, height, error: "missing_2d_context" };
      const image = context.getImageData(0, 0, width, height);
      const data = image.data;
      let nonWhite = 0;
      let nonTransparent = 0;
      let channelDelta = 0;
      for (let index = 0; index < data.length; index += 4) {
        const r = data[index] ?? 0;
        const g = data[index + 1] ?? 0;
        const b = data[index + 2] ?? 0;
        const a = data[index + 3] ?? 0;
        if (a > 0) nonTransparent += 1;
        if (a > 0 && (r < 245 || g < 245 || b < 245)) nonWhite += 1;
        channelDelta += Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);
      }
      let binary = "";
      const chunkSize = 8192;
      for (let index = 0; index < data.length; index += chunkSize) {
        binary += String.fromCharCode(...data.subarray(index, index + chunkSize));
      }
      return {
        source: "canvas-backing-store",
        selector: canvas.id === "primaryCanvas" ? '#primaryCanvas[data-runtime-player="svga-web"]' : '#multiFormatRuntimeMount canvas[data-runtime-player="svga-web"]',
        width,
        height,
        nonWhite,
        nonTransparent,
        channelDelta,
        dataBase64: btoa(binary)
      };
    })()
  `);
  if (!pixels) {
    throw new Error("SVGA runtime canvas was unavailable for backing-store readback.");
  }
  if (pixels.error) {
    throw new Error(`SVGA runtime canvas backing-store readback failed: ${pixels.error}`);
  }
  const rawPixels = Buffer.from(String(pixels.dataBase64 ?? ""), "base64");
  return {
    source: "canvas-backing-store",
    selector: pixels.selector,
    width: Number(pixels.width) || 0,
    height: Number(pixels.height) || 0,
    nonWhite: Number(pixels.nonWhite) || 0,
    nonTransparent: Number(pixels.nonTransparent) || 0,
    channelDelta: Number(pixels.channelDelta) || 0,
    sha256: createHash("sha256").update(rawPixels).digest("hex")
  };
}

function assertRenderablePixels(label, phase, pixels, options = {}) {
  if (options.requireBackingStore === true && pixels?.source !== "canvas-backing-store") {
    throw new Error(`${label} ${phase} did not use direct canvas backing-store pixel proof: ${JSON.stringify(pixels)}`);
  }
  if (!pixels || pixels.width <= 1 || pixels.height <= 1 || pixels.nonWhite <= 10 || pixels.nonTransparent <= 10) {
    throw new Error(`${label} ${phase} did not expose nonblank rendered pixels: ${JSON.stringify(pixels)}`);
  }
}

function assertSvgaCanvasEvidence(label, evidence) {
  const {
    loadedPixels,
    playingSamples,
    pausedFirstPixels,
    pausedSecondPixels,
    loadedSnapshot,
    pausedFirstSnapshot,
    pausedSecondSnapshot
  } = evidence;
  const phasePixels = {
    loaded: loadedPixels,
    ...Object.fromEntries(playingSamples.map((sample, index) => [`playing${index + 1}`, sample.pixels])),
    pausedFirst: pausedFirstPixels,
    pausedSecond: pausedSecondPixels
  };
  for (const [phase, pixels] of Object.entries(phasePixels)) {
    assertRenderablePixels(label, phase, pixels, { requireBackingStore: true });
    assertSvgaCanvasNotOpaquePlaceholder(label, phase, pixels);
  }
  const sizes = Object.values(phasePixels).map((pixels) => `${pixels.width}x${pixels.height}`);
  if (new Set(sizes).size !== 1) {
    throw new Error(`${label} SVGA backing-store dimensions changed across play/pause: ${JSON.stringify({ sizes, loaded: compactSnapshot(loadedSnapshot), playing: playingSamples.map((sample) => compactSnapshot(sample.snapshot)), pausedFirst: compactSnapshot(pausedFirstSnapshot), pausedSecond: compactSnapshot(pausedSecondSnapshot) })}`);
  }
  assertSvgaCoupledPlaybackEvidence(label, {
    playingSamples,
    pausedFirstSnapshot,
    pausedSecondSnapshot,
    pausedFirstPixels,
    pausedSecondPixels
  });
}

function assertSvgaCoupledPlaybackEvidence(label, evidence) {
  const playingSamples = evidence.playingSamples ?? [
    { snapshot: evidence.playingFirstSnapshot, pixels: evidence.playingFirstPixels },
    { snapshot: evidence.playingSecondSnapshot, pixels: evidence.playingSecondPixels }
  ];
  assertCoupledPlayingSampleSequence(label, playingSamples);
  assertPausePreservedAdvancedFrame(label, playingSamples.at(-1).snapshot, evidence.pausedFirstSnapshot, evidence.pausedSecondSnapshot);
  if (evidence.pausedFirstPixels.sha256 !== evidence.pausedSecondPixels.sha256) {
    throw new Error(`${label} SVGA rendered pixels changed between paused samples: ${JSON.stringify({ pausedFirst: compactSnapshot(evidence.pausedFirstSnapshot), pausedSecond: compactSnapshot(evidence.pausedSecondSnapshot), pausedFirstPixels: evidence.pausedFirstPixels, pausedSecondPixels: evidence.pausedSecondPixels })}`);
  }
}

function assertSvgaCanvasNotOpaquePlaceholder(label, phase, pixels) {
  const totalPixels = Math.max(1, Number(pixels?.width || 0) * Number(pixels?.height || 0));
  const opaqueRatio = Number(pixels?.nonTransparent || 0) / totalPixels;
  const nonWhiteRatio = Number(pixels?.nonWhite || 0) / totalPixels;
  if (opaqueRatio > 0.98 && nonWhiteRatio < 0.08) {
    throw new Error(`${label} ${phase} backing-store pixels match an opaque placeholder-card shape, not decoded SVGA artwork: ${JSON.stringify(pixels)}`);
  }
}

function assertRuntimeChildAnimationPixels(label, format, evidence, options = {}) {
  const playingSamples = evidence.playingSamples ?? [
    { snapshot: evidence.playingFirstSnapshot, pixels: evidence.playingFirstPixels },
    { snapshot: evidence.playingSecondSnapshot, pixels: evidence.playingSecondPixels }
  ];
  const loadedPixels = evidence.loadedPixels;
  const pausedFirstPixels = evidence.pausedFirstPixels ?? playingSamples.at(-1).pixels;
  const pausedSecondPixels = evidence.pausedSecondPixels ?? pausedFirstPixels;
  const phasePixels = {
    loaded: loadedPixels,
    ...Object.fromEntries(playingSamples.map((sample, index) => [`playing${index + 1}`, sample.pixels])),
    pausedFirst: pausedFirstPixels,
    pausedSecond: pausedSecondPixels
  };
  for (const [phase, pixels] of Object.entries(phasePixels)) {
    assertRenderablePixels(label, phase, pixels);
    const expectedBacking = options.expectedBacking;
    if (format === "vap" && expectedBacking
      && (Number(pixels.backingWidth) !== expectedBacking.width || Number(pixels.backingHeight) !== expectedBacking.height)) {
      throw new Error(`${label} ${phase} VAP pixels are not bound to the expected ${expectedBacking.width}x${expectedBacking.height} WebGL child backing store: ${JSON.stringify(pixels)}`);
    }
    if (format === "vap") assertVapRuntimeAspectRatio(label, phase, pixels);
  }
  assertCoupledPlayingSampleSequence(label, playingSamples);
  if (pausedFirstPixels.sha256 !== pausedSecondPixels.sha256) {
    throw new Error(`${label} ${format} child pixels changed between paused samples: ${JSON.stringify({ pausedFirstPixels, pausedSecondPixels })}`);
  }
}

function assertExpectedOwnerFacts(input, snapshot) {
  const model = snapshot?.hostModel?.model;
  if (Number.isFinite(input.expectedImageCount)
    && model?.rightPanel?.assetInventory?.summary?.imageCount !== input.expectedImageCount) {
    throw new Error(`${input.label} did not expose the expected image inventory: ${JSON.stringify(compactSnapshot(snapshot))}`);
  }
  if (input.requireCanvasRisk === true) {
    const canvasFact = model?.rightPanel?.facts?.find((fact) => fact.id === "dimensions");
    const riskIssues = model?.rightPanel?.issues?.filter((issue) => issue.details?.reason === "vap_dimensions_over_1504") ?? [];
    if (canvasFact?.status !== "warning" || canvasFact.value !== "750 x 1624" || riskIssues.length !== 1 || riskIssues[0]?.severity !== "warning") {
      throw new Error(`${input.label} did not preserve one truthful oversized Canvas risk while playing: ${JSON.stringify({ canvasFact, riskIssues, snapshot: compactSnapshot(snapshot) })}`);
    }
  }
}

function assertVapRuntimeAspectRatio(label, phase, pixels) {
  const backingRatio = Number(pixels?.backingWidth) / Number(pixels?.backingHeight);
  const cssRatio = Number(pixels?.cssWidth) / Number(pixels?.cssHeight);
  const captureRatio = Number(pixels?.width) / Number(pixels?.height);
  const tolerance = 0.005;
  const deviceScaleFactor = Number(pixels?.deviceScaleFactor);
  const expectedCaptureWidth = Number(pixels?.cssWidth) * deviceScaleFactor;
  const expectedCaptureHeight = Number(pixels?.cssHeight) * deviceScaleFactor;
  const captureTolerance = 2;
  if (![backingRatio, cssRatio, captureRatio].every(Number.isFinite)
    || backingRatio <= 0
    || Math.abs(cssRatio - backingRatio) > tolerance
    || Math.abs(captureRatio - backingRatio) > tolerance
    || pixels?.fullyVisible !== true
    || !Number.isFinite(deviceScaleFactor)
    || Math.abs(Number(pixels?.width) - expectedCaptureWidth) > captureTolerance
    || Math.abs(Number(pixels?.height) - expectedCaptureHeight) > captureTolerance) {
    throw new Error(`${label} ${phase} VAP child is distorted or clipped relative to its backing store: ${JSON.stringify({ backingRatio, cssRatio, captureRatio, expectedCaptureWidth, expectedCaptureHeight, pixels })}`);
  }
}

function assertSuccessfulPlayableSnapshot(label, phase, input, snapshot) {
  const blockedTokens = snapshot?.bodyTextIncludes?.filter((token) =>
    token === "source-side preview contract" || token === "播放受限"
  ) ?? [];
  if (blockedTokens.length > 0) {
    throw new Error(`${label} ${phase} still exposes placeholder or limited-copy tokens: ${JSON.stringify({ blockedTokens, snapshot: compactSnapshot(snapshot) })}`);
  }
  if (snapshot?.errorMessage) {
    throw new Error(`${label} ${phase} exposed an error while claiming playable success: ${JSON.stringify(compactSnapshot(snapshot))}`);
  }
  if (!successfulRendererIdentity(input, snapshot)) {
    throw new Error(`${label} ${phase} did not expose the required renderer identity: ${JSON.stringify(compactSnapshot(snapshot))}`);
  }
}

function successfulRendererIdentity(input, snapshot) {
  if (!snapshot || snapshot.runtimeMountState !== "loaded" || snapshot.runtimeFormat !== input.format) return false;
  if (input.format === "svga") {
    return Number(snapshot.runtimeSvgaCanvasCount) === 1
      && snapshot.runtimePlayerReady === "svga-web";
  }
  if (input.format === "lottie") {
    return Number(snapshot.runtimeSvgCount) > 0;
  }
  if (input.format === "vap") {
    return Number(snapshot.runtimeWebglCanvasCount) > 0
      && Number(snapshot.maxVideoReadyState) >= 2;
  }
  return false;
}

function assertCoupledPlayingSampleSequence(label, samples) {
  if (!Array.isArray(samples) || samples.length < 2) {
    throw new Error(`${label} requires at least two paired playing samples.`);
  }
  let temporalAdvanceObserved = false;
  let pixelChangeObserved = false;
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    const temporalAdvanced = playbackPositionAdvanced(previous.snapshot, current.snapshot);
    const pixelsChanged = previous.pixels?.sha256 !== current.pixels?.sha256;
    temporalAdvanceObserved ||= temporalAdvanced;
    pixelChangeObserved ||= pixelsChanged;
    if (temporalAdvanced && pixelsChanged) return;
  }
  throw new Error(`${label} did not produce one paired transition with both playback advance and rendered-pixel change: ${JSON.stringify({ temporalAdvanceObserved, pixelChangeObserved, samples: samples.map((sample) => ({ snapshot: compactSnapshot(sample.snapshot), pixels: sample.pixels })) })}`);
}

function playbackPositionAdvanced(first, second) {
  const firstFrames = Number(first?.runtimePlaybackFrames) || 0;
  const secondFrames = Number(second?.runtimePlaybackFrames) || 0;
  if (firstFrames > 0 && secondFrames === firstFrames) {
    const firstFrame = Number(first?.runtimePlaybackFrame) || 0;
    const secondFrame = Number(second?.runtimePlaybackFrame) || 0;
    const delta = secondFrame >= firstFrame
      ? secondFrame - firstFrame
      : (firstFrames - firstFrame) + secondFrame;
    return delta > 0.05 && delta < firstFrames * 0.75;
  }
  const firstVideoTime = Number(first?.maxVideoCurrentTime) || 0;
  const secondVideoTime = Number(second?.maxVideoCurrentTime) || 0;
  if (secondVideoTime > firstVideoTime + 0.01) return true;
  const firstProgress = Number(first?.runtimePlaybackProgress) || 0;
  const secondProgress = Number(second?.runtimePlaybackProgress) || 0;
  if (secondProgress > firstProgress) return true;
  return firstProgress > 75 && secondProgress < 25;
}

function assertPausePreservedAdvancedFrame(label, playing, firstPaused, secondPaused) {
  const totalFrames = Number(playing?.runtimePlaybackFrames) || 0;
  if (totalFrames > 0
    && Number(firstPaused?.runtimePlaybackFrames) === totalFrames
    && Number(secondPaused?.runtimePlaybackFrames) === totalFrames) {
    const playingFrame = Number(playing?.runtimePlaybackFrame) || 0;
    const firstFrame = Number(firstPaused?.runtimePlaybackFrame) || 0;
    const secondFrame = Number(secondPaused?.runtimePlaybackFrame) || 0;
    const circularDistance = (left, right) => {
      const direct = Math.abs(left - right);
      return Math.min(direct, Math.max(0, totalFrames - direct));
    };
    if (circularDistance(playingFrame, firstFrame) > 1.25) {
      throw new Error(`${label} pause jumped away from the last playing frame: ${JSON.stringify({ playing: compactSnapshot(playing), firstPaused: compactSnapshot(firstPaused), secondPaused: compactSnapshot(secondPaused) })}`);
    }
    if (circularDistance(firstFrame, secondFrame) > 0.25) {
      throw new Error(`${label} playback frame did not remain stable after pause: ${JSON.stringify({ playing: compactSnapshot(playing), firstPaused: compactSnapshot(firstPaused), secondPaused: compactSnapshot(secondPaused) })}`);
    }
    return;
  }
  const playingProgress = Number(playing?.runtimePlaybackProgress) || 0;
  const firstProgress = Number(firstPaused?.runtimePlaybackProgress) || 0;
  const secondProgress = Number(secondPaused?.runtimePlaybackProgress) || 0;
  const playingVideoTime = Number(playing?.maxVideoCurrentTime) || 0;
  const firstVideoTime = Number(firstPaused?.maxVideoCurrentTime) || 0;
  const secondVideoTime = Number(secondPaused?.maxVideoCurrentTime) || 0;
  const advancedProgress = firstProgress > 1 || firstVideoTime > 0.2;
  const advancedFromPlaying = playingProgress > 1 || playingVideoTime > 0.2;
  if (!advancedProgress || !advancedFromPlaying) {
    throw new Error(`${label} pause did not preserve a nonzero advanced frame: ${JSON.stringify({ playing: compactSnapshot(playing), firstPaused: compactSnapshot(firstPaused), secondPaused: compactSnapshot(secondPaused) })}`);
  }
  if (Math.abs(firstProgress - playingProgress) > 3 || Math.abs(firstVideoTime - playingVideoTime) > 0.25) {
    throw new Error(`${label} pause jumped away from the last playing frame: ${JSON.stringify({ playing: compactSnapshot(playing), firstPaused: compactSnapshot(firstPaused), secondPaused: compactSnapshot(secondPaused) })}`);
  }
  if (Math.abs(secondProgress - firstProgress) > 1 || Math.abs(secondVideoTime - firstVideoTime) > 0.2) {
    throw new Error(`${label} playback did not remain stable after pause: ${JSON.stringify({ playing: compactSnapshot(playing), firstPaused: compactSnapshot(firstPaused), secondPaused: compactSnapshot(secondPaused) })}`);
  }
}

function provePlaceholderSuccessGateRejectsSourceSideContract() {
  const snapshot = {
    runtimeMountState: "loaded",
    runtimeFormat: "lottie",
    runtimeSvgCount: 1,
    errorMessage: "",
    bodyTextIncludes: ["source-side preview contract"],
    hostModel: { model: { status: "previewReady", detectedFormat: "lottie" } }
  };
  try {
    assertSuccessfulPlayableSnapshot("PLACEHOLDER-REGRESSION", "loaded", { format: "lottie" }, snapshot);
  } catch (error) {
    return { status: "passed", rejected: true, message: error instanceof Error ? error.message : String(error) };
  }
  throw new Error("Placeholder regression was accepted as playable success.");
}

function provePauseGateRejectsNonzeroReset() {
  const playing = { runtimePlaybackProgress: 90, maxVideoCurrentTime: 0 };
  const firstPaused = { runtimePlaybackProgress: 2, maxVideoCurrentTime: 0 };
  const secondPaused = { runtimePlaybackProgress: 2, maxVideoCurrentTime: 0 };
  try {
    assertPausePreservedAdvancedFrame("PAUSE-REGRESSION", playing, firstPaused, secondPaused);
  } catch (error) {
    return { status: "passed", rejected: true, message: error instanceof Error ? error.message : String(error) };
  }
  throw new Error("Pause regression was accepted even though pause reset to a different nonzero frame.");
}

function proveSvgaIdentityGateRejectsGenericCanvas() {
  const snapshot = {
    runtimeMountState: "loaded",
    runtimeFormat: "svga",
    primaryCanvasVisible: true,
    primaryCanvasWidth: 320,
    primaryCanvasHeight: 300,
    runtimeSvgaCanvasCount: 0,
    runtimePlayerReady: "",
    errorMessage: "",
    bodyTextIncludes: []
  };
  if (successfulRendererIdentity({ format: "svga" }, snapshot)) {
    throw new Error("SVGA identity regression accepted a generic visible canvas without svga-web player identity.");
  }
  return { status: "passed", rejected: true };
}

function proveSvgaCoupledPlaybackGateRejectsFalsePositives() {
  const basePixels = {
    source: "canvas-backing-store",
    selector: '#multiFormatRuntimeMount canvas[data-runtime-player="svga-web"]',
    width: 300,
    height: 300,
    nonWhite: 20000,
    nonTransparent: 40000,
    channelDelta: 1000
  };
  const cases = [
    {
      id: "time-only",
      evidence: {
        playingFirstSnapshot: { runtimePlaybackProgress: 10 },
        playingSecondSnapshot: { runtimePlaybackProgress: 20 },
        playingFirstPixels: { ...basePixels, sha256: sha256Text("same-frame") },
        playingSecondPixels: { ...basePixels, sha256: sha256Text("same-frame") },
        pausedFirstSnapshot: { runtimePlaybackProgress: 20 },
        pausedSecondSnapshot: { runtimePlaybackProgress: 20 },
        pausedFirstPixels: { ...basePixels, sha256: sha256Text("same-frame") },
        pausedSecondPixels: { ...basePixels, sha256: sha256Text("same-frame") }
      }
    },
    {
      id: "pixel-only",
      evidence: {
        playingFirstSnapshot: { runtimePlaybackProgress: 20 },
        playingSecondSnapshot: { runtimePlaybackProgress: 20 },
        playingFirstPixels: { ...basePixels, sha256: sha256Text("frame-a") },
        playingSecondPixels: { ...basePixels, sha256: sha256Text("frame-b") },
        pausedFirstSnapshot: { runtimePlaybackProgress: 20 },
        pausedSecondSnapshot: { runtimePlaybackProgress: 20 },
        pausedFirstPixels: { ...basePixels, sha256: sha256Text("frame-b") },
        pausedSecondPixels: { ...basePixels, sha256: sha256Text("frame-b") }
      }
    },
    {
      id: "paused-pixel-drift",
      evidence: {
        playingFirstSnapshot: { runtimePlaybackProgress: 10 },
        playingSecondSnapshot: { runtimePlaybackProgress: 20 },
        playingFirstPixels: { ...basePixels, sha256: sha256Text("frame-a") },
        playingSecondPixels: { ...basePixels, sha256: sha256Text("frame-b") },
        pausedFirstSnapshot: { runtimePlaybackProgress: 20 },
        pausedSecondSnapshot: { runtimePlaybackProgress: 20 },
        pausedFirstPixels: { ...basePixels, sha256: sha256Text("frame-b") },
        pausedSecondPixels: { ...basePixels, sha256: sha256Text("frame-c") }
      }
    }
  ];
  return cases.map(({ id, evidence }) => {
    try {
      assertSvgaCoupledPlaybackEvidence(`SVGA-${id.toUpperCase()}-REGRESSION`, evidence);
    } catch (error) {
      return { id, status: "passed", rejected: true, message: error instanceof Error ? error.message : String(error) };
    }
    throw new Error(`SVGA ${id} false-positive regression was accepted.`);
  });
}

function proveSvgaPixelGateRejectsBlankCanvas() {
  const pixels = {
    source: "canvas-backing-store",
    selector: "#primaryCanvas",
    width: 320,
    height: 300,
    nonWhite: 0,
    nonTransparent: 0,
    channelDelta: 0,
    sha256: sha256Text("blank-transparent-canvas")
  };
  try {
    assertRenderablePixels("SVGA-BLANK-REGRESSION", "loaded", pixels, { requireBackingStore: true });
  } catch (error) {
    return { status: "passed", rejected: true, message: error instanceof Error ? error.message : String(error) };
  }
  throw new Error("SVGA blank-canvas regression was accepted as rendered artwork.");
}

function proveSvgaPixelGateRejectsOpaquePlaceholderCanvas() {
  const pixels = {
    source: "canvas-backing-store",
    selector: "#primaryCanvas",
    width: 320,
    height: 300,
    nonWhite: 3234,
    nonTransparent: 96000,
    channelDelta: 475900,
    sha256: sha256Text("opaque-source-side-placeholder-card")
  };
  try {
    assertSvgaCanvasNotOpaquePlaceholder("SVGA-OPAQUE-PLACEHOLDER-REGRESSION", "paused", pixels);
  } catch (error) {
    return { status: "passed", rejected: true, message: error instanceof Error ? error.message : String(error) };
  }
  throw new Error("SVGA opaque placeholder-card regression was accepted as decoded artwork.");
}

function proveRuntimeChildPixelGateRejectsStaticOrBlankChild(format) {
  const blank = {
    source: "compositor-capture",
    selector: format === "lottie" ? "#multiFormatRuntimeMount svg" : "#multiFormatRuntimeMount canvas[webgl]",
    width: format === "vap" ? 240 : 100,
    height: format === "vap" ? 160 : 100,
    backingWidth: format === "vap" ? 120 : 0,
    backingHeight: format === "vap" ? 80 : 0,
    cssWidth: format === "vap" ? 120 : 100,
    cssHeight: format === "vap" ? 80 : 100,
    nonWhite: 0,
    nonTransparent: 0,
    channelDelta: 0,
    sha256: sha256Text(`${format}-blank-child`)
  };
  try {
    assertRuntimeChildAnimationPixels(`${format.toUpperCase()}-BLANK-CHILD-REGRESSION`, format, {
      loadedPixels: blank,
      playingFirstPixels: blank,
      playingSecondPixels: blank
    });
  } catch (error) {
    const staticPixels = {
      ...blank,
      nonWhite: 400,
      nonTransparent: format === "vap" ? 9600 : 10000,
      channelDelta: 1200,
      sha256: sha256Text(`${format}-static-child`)
    };
    try {
      assertRuntimeChildAnimationPixels(`${format.toUpperCase()}-STATIC-CHILD-REGRESSION`, format, {
        loadedPixels: staticPixels,
        playingFirstPixels: staticPixels,
        playingSecondPixels: staticPixels
      });
    } catch (staticError) {
      return {
        status: "passed",
        rejected: true,
        blankMessage: error instanceof Error ? error.message : String(error),
        staticMessage: staticError instanceof Error ? staticError.message : String(staticError)
      };
    }
    throw new Error(`${format} static child-pixel regression was accepted as animated renderer evidence.`);
  }
  throw new Error(`${format} blank child-pixel regression was accepted as renderer evidence.`);
}

function proveVapAspectRatioGateRejectsSquareCssRect() {
  const pixels = {
    source: "compositor-capture",
    selector: "#multiFormatRuntimeMount canvas[webgl]",
    width: 240,
    height: 240,
    backingWidth: 120,
    backingHeight: 80,
    cssWidth: 120,
    cssHeight: 120,
    visibleWidth: 120,
    visibleHeight: 120,
    fullyVisible: true,
    deviceScaleFactor: 2,
    nonWhite: 57600,
    nonTransparent: 57600,
    channelDelta: 1200,
    sha256: sha256Text("vap-square-css-distortion")
  };
  try {
    assertVapRuntimeAspectRatio("VAP-ASPECT-REGRESSION", "loaded", pixels);
  } catch (error) {
    return { status: "passed", rejected: true, message: error instanceof Error ? error.message : String(error) };
  }
  throw new Error("VAP aspect-ratio regression accepted a square CSS child for a 120x80 backing store.");
}

function proveVapVisibilityGateRejectsClippedChild() {
  const pixels = {
    source: "compositor-capture",
    selector: "#multiFormatRuntimeMount canvas[webgl]",
    width: 616,
    height: 1292,
    backingWidth: 750,
    backingHeight: 1624,
    cssWidth: 308,
    cssHeight: 668,
    visibleWidth: 308,
    visibleHeight: 646,
    fullyVisible: false,
    deviceScaleFactor: 2,
    nonWhite: 795300,
    nonTransparent: 795872,
    channelDelta: 86912,
    sha256: sha256Text("vap-bottom-clipped-under-loose-aspect-tolerance")
  };
  try {
    assertVapRuntimeAspectRatio("VAP-CLIPPED-CHILD-REGRESSION", "loaded", pixels);
  } catch (error) {
    return { status: "passed", rejected: true, message: error instanceof Error ? error.message : String(error) };
  }
  throw new Error("VAP clipped-child regression was accepted by the aspect/visibility gate.");
}

function visiblePlaybackTimeMatchesRuntime(snapshot) {
  return !snapshot?.runtimePlaybackTimeCopy || snapshot.playbackTime === snapshot.runtimePlaybackTimeCopy;
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
    await delay(100);
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
    canvasFact: snapshot?.hostModel?.model?.rightPanel?.facts?.find((fact) => fact.id === "dimensions"),
    assetSummary: snapshot?.hostModel?.model?.rightPanel?.assetInventory?.summary,
    runtimeMountState: snapshot?.runtimeMountState,
    runtimeFormat: snapshot?.runtimeFormat,
    runtimePlayerReady: snapshot?.runtimePlayerReady,
    runtimePlaybackState: snapshot?.runtimePlaybackState,
    runtimePlaybackProgress: snapshot?.runtimePlaybackProgress,
    runtimePlaybackFrame: snapshot?.runtimePlaybackFrame,
    runtimePlaybackFrames: snapshot?.runtimePlaybackFrames,
    runtimePlaybackTimeCopy: snapshot?.runtimePlaybackTimeCopy,
    runtimeCanvasCount: snapshot?.runtimeCanvasCount,
    runtimeSvgaCanvasCount: snapshot?.runtimeSvgaCanvasCount,
    runtimeRenderableCount: snapshot?.runtimeRenderableCount,
    runtimeSvgCount: snapshot?.runtimeSvgCount,
    lottieDomState: snapshot?.lottieDomState,
    runtimeWebglCanvasCount: snapshot?.runtimeWebglCanvasCount,
    runtimeCanvasMaxWidth: snapshot?.runtimeCanvasMaxWidth,
    runtimeCanvasMaxHeight: snapshot?.runtimeCanvasMaxHeight,
    primaryCanvasVisible: snapshot?.primaryCanvasVisible,
    primaryCanvasWidth: snapshot?.primaryCanvasWidth,
    primaryCanvasHeight: snapshot?.primaryCanvasHeight,
    videoCount: snapshot?.videoCount,
    maxVideoReadyState: snapshot?.maxVideoReadyState,
    maxVideoCurrentTime: snapshot?.maxVideoCurrentTime,
    anyVideoPaused: snapshot?.anyVideoPaused,
    playbackTime: snapshot?.playbackTime,
    errorMessage: snapshot?.errorMessage,
    bodyTextIncludes: snapshot?.bodyTextIncludes
  };
}

function modelStatus(snapshot) {
  if (snapshot?.runtimeFormat === "svga" && snapshot?.runtimePlaybackState) {
    return snapshot.runtimePlaybackState;
  }
  return snapshot?.summary?.status ?? snapshot?.hostModel?.model?.status;
}

function modelFormat(snapshot) {
  return snapshot?.summary?.format ?? snapshot?.hostModel?.model?.detectedFormat;
}

function prepareFixtures() {
  ownerInputs = resolveOwnerInputs();
  if (skipFusionFixture) return;
  for (const [filePath, expected] of Object.entries(expectedTaskFixtureHashes)) {
    if (!existsSync(filePath)) throw new Error(`Required task-owned fixture is missing: ${path.basename(filePath)}`);
    const actual = sha256File(filePath);
    if (actual !== expected) throw new Error(`Fixture hash drift for ${path.basename(filePath)}: ${actual}`);
  }
  const pngBytes = Buffer.from(tinyPngBase64, "base64");
  writeFileSync(replacementPngPath, pngBytes);
  copyFileSync(taskVapPath, vapPath);
  copyFileSync(taskVapcPath, vapcPath);
}

function resolveOwnerInputs() {
  const resolved = {};
  for (const [key, spec] of Object.entries(ownerInputSpecs)) {
    const filePath = String(process.env[spec.env] ?? "").trim();
    if (!filePath || !path.isAbsolute(filePath) || !existsSync(filePath)) {
      throw new Error(`Required ${spec.alias} input is unavailable through ${spec.env}.`);
    }
    const actual = sha256File(filePath);
    if (actual !== spec.sha256) {
      throw new Error(`${spec.alias} hash drift: ${actual}`);
    }
    const entry = { ...spec, filePath };
    if (key === "vap") {
      const sidecarCandidates = [
        path.join(path.dirname(filePath), `${path.basename(filePath, path.extname(filePath))}.json`),
        path.join(path.dirname(filePath), "vapc.json")
      ];
      const sidecarPath = sidecarCandidates.find((candidate) =>
        existsSync(candidate) && sha256File(candidate) === spec.sidecarSha256
      );
      if (!sidecarPath) {
        throw new Error(`${spec.alias} sidecar identity is unavailable or drifted.`);
      }
      entry.sidecarPath = sidecarPath;
    }
    resolved[key] = entry;
  }
  return resolved;
}

function ownerInputEvidence(input) {
  return {
    alias: input.alias,
    sha256: input.sha256,
    ...(input.sidecarSha256 ? { sidecarSha256: input.sidecarSha256 } : {}),
    pathRedacted: true
  };
}

function createTaskOwnedLottieDocument(imagePath) {
  return {
    v: "5.7.4",
    fr: 30,
    ip: 0,
    op: 60,
    w: 120,
    h: 80,
    assets: [
      {
        id: "image_0",
        w: 2,
        h: 2,
        u: path.posix.dirname(imagePath) === "." ? "" : `${path.posix.dirname(imagePath)}/`,
        p: path.posix.basename(imagePath),
        e: 0
      }
    ],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 2,
        nm: "image_0",
        refId: "image_0",
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 0, k: 0 },
          p: {
            a: 1,
            k: [
              { t: 0, s: [20, 40, 0], e: [98, 40, 0], i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] } },
              { t: 59, s: [98, 40, 0] }
            ]
          },
          a: { a: 0, k: [1, 1, 0] },
          s: { a: 0, k: [1200, 1200, 100] }
        },
        ip: 0,
        op: 60,
        st: 0,
        bm: 0
      }
    ]
  };
}

async function writeProof(value) {
  mkdirSync(proofRoot, { recursive: true });
  writeFileSync(proofOutputPath, `${JSON.stringify(value, null, 2)}\n`);
  const sha256 = sha256File(proofOutputPath);
  process.stdout.write(JSON.stringify({ proofOutputPath, sha256, status: value.status }) + "\n");
}

async function cleanup() {
  try { windowRef?.destroy(); } catch {}
  try { await server?.close?.(); } catch {}
  try { await previewSession.control({ action: "dispose" }); } catch {}
  try { app.quit(); } catch {}
}

async function gitHead() {
  return new Promise((resolve) => {
    execFile("git", ["rev-parse", "HEAD"], { cwd: repoRoot }, (error, stdout) => {
      resolve(error ? "" : stdout.trim());
    });
  });
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
