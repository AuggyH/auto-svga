"use strict";

const { execFile, execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { deflateSync } = require("node:zlib");
const { pathToFileURL } = require("node:url");

const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "../../../..");
const proofRoot = path.join(os.tmpdir(), `auto-svga-multiformat-runtime-selftest-${process.pid}`);
const proofOutputPath = path.join(proofRoot, "multiformat-runtime-selftest-proof.json");
const bootstrapPhasePath = path.join(proofRoot, "runtime-selftest-bootstrap-phases.jsonl");
const bootstrapFailurePath = path.join(proofRoot, "runtime-selftest-bootstrap-failure.json");
const userDataRoot = path.join(proofRoot, "userData");

writeBootstrapPhase("entrypoint_loaded");
installBootstrapFailureGuards();
writeBootstrapPhase("electron_require_begin");
let electronApi;
try {
  electronApi = require("electron");
  writeBootstrapPhase("electron_required");
} catch (error) {
  writeBootstrapFailure("electron_require_failed", error);
  throw error;
}
const { app, BrowserWindow, ipcMain, session } = electronApi;
const protobuf = require("protobufjs");
const {
  MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID,
  createMultiFormatDesktopPreviewSession
} = require("../multiformat-desktop-session.cjs");
const {
  createExternalImageLottieDocument,
  createFusionVapcDocument,
  sha256Text
} = require("./multiformat-task-runtime-fixtures.cjs");

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
const generatedArtifacts = {};
let server;
let windowRef;

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.setPath("userData", userDataRoot);

main().catch(async (error) => {
  writeBootstrapPhase("main_failed", { error: error instanceof Error ? error.message : String(error) });
  await writeProof({
    status: "failed",
    productMilestoneId: MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID,
    sourceHead: await gitHead(),
    error: error instanceof Error ? error.message : String(error),
    evidence: {
      generatedArtifacts: redactedArtifactEvidence(),
      lifecycle: previewSession.lifecycle,
      externalRequests,
      consoleMessages: consoleMessages.slice(-40),
      ipcEvents
    },
    boundaries: proofBoundaries()
  }).catch(() => {});
  await cleanup().catch(() => {});
  process.exitCode = 1;
});

async function main() {
  writeBootstrapPhase("main_begin");
  mkdirSync(proofRoot, { recursive: true });
  await createRuntimeFixtures();
  writeBootstrapPhase("fixtures_created");

  writeBootstrapPhase("app_when_ready_begin");
  await app.whenReady();
  writeBootstrapPhase("app_ready");
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
    reportToken: "multiformat-runtime-selftest",
    desktopArtifacts: undefined
  });
  installIpcHandlers();
  writeBootstrapPhase("ipc_handlers_installed");

  writeBootstrapPhase("browser_window_construct_begin");
  windowRef = new BrowserWindow({
    title: "Auto SVGA Multi-format Runtime Self-test",
    width: 720,
    height: 720,
    show: false,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      sandbox: true,
      preload: path.join(appRoot, "preload.cjs"),
      additionalArguments: [
        "--prototype-product-milestone=0.2-multiformat-preview",
        "--prototype-report-token=multiformat-runtime-selftest",
        "--prototype-host-boundary=formal"
      ]
    }
  });
  writeBootstrapPhase("browser_window_constructed");
  windowRef.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    consoleMessages.push({ level, message: redactString(message), line, source: redactString(sourceId) });
  });

  writeBootstrapPhase("load_url_begin");
  await windowRef.loadURL(`${server.origin}/`);
  writeBootstrapPhase("load_url_complete");
  await waitForPage("action bridge", (snapshot) =>
    snapshot.productMilestoneId === MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID
      && snapshot.actionBridgeReady === true
      && snapshot.bridgeReady === true
  );

  const svga = await exerciseFormatFlow({
    alias: "TASK-SVGA-REPLACEABLE-A",
    format: "svga",
    path: generatedArtifacts.svgaA.path,
    imageTarget: "profile_frame",
    textTarget: "nickname_text",
    replacementValue: "SVGA runtime text"
  });
  const lottie = await exerciseFormatFlow({
    alias: "TASK-LOTTIE-EXTERNAL-A",
    format: "lottie",
    path: generatedArtifacts.lottieA.path,
    imageTarget: "avatar",
    textTarget: "text:2",
    replacementValue: "Lottie runtime text"
  });
  const vap = await exerciseFormatFlow({
    alias: "TASK-VAP-FUSION-A",
    format: "vap",
    path: generatedArtifacts.vapA.path,
    imageTarget: "vap_fusion_avatar",
    textTarget: "vap_fusion_title",
    replacementValue: "VAP runtime text"
  });
  const reopenIsolation = await proveReopenIsolation();
  const failures = await proveTypedFailureRows();
  const narrowReachability = await proveNarrowWindowReachability();

  if (externalRequests.length > 0) {
    throw new Error(`Unexpected external requests: ${JSON.stringify(externalRequests)}`);
  }
  const severeConsole = consoleMessages.filter((entry) =>
    Number(entry.level) >= 3
      && !/No image replacement provided for VAP fusion tag/u.test(entry.message)
  );
  if (severeConsole.length > 0) {
    throw new Error(`Unexpected renderer console errors: ${JSON.stringify(severeConsole.slice(-8))}`);
  }

  const proof = {
    status: "passed",
    productMilestoneId: MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID,
    sourceHead: await gitHead(),
    fixtureIdentity: redactedArtifactEvidence(),
    evidence: {
      svga,
      lottie,
      vap,
      reopenIsolation,
      failures,
      narrowReachability,
      lifecycle: previewSession.lifecycle,
      externalRequests,
      consoleMessages: consoleMessages.slice(-20),
      ipcEvents
    },
    boundaries: proofBoundaries()
  };
  assertNoRawPathLeak(proof);
  await writeProof(proof);
  await cleanup();
}

async function exerciseFormatFlow(input) {
  const open = await openFileInProduct(input.path, input.alias);
  const playing = await waitForPage(`${input.alias} autoplay`, (snapshot) =>
    snapshot.modelFormat === input.format
      && snapshot.modelStatus === "playing"
      && snapshot.runtimeMountState === "loaded"
      && snapshot.runtimeFormat === input.format
      && rendererReady(input.format, snapshot)
      && !placeholderVisible(snapshot)
  );
  const firstPixels = await captureFormatPixels(input.format);
  await delay(450);
  const playingLater = await pageSnapshot();
  const secondPixels = await captureFormatPixels(input.format);
  assertPlaybackAdvanced(input.alias, input.format, playing, playingLater, firstPixels, secondPixels);

  await runInPage(`${input.alias} pause`, "window.__autoSvgaShortTermActions.playPause()");
  const paused = await waitForPage(`${input.alias} paused`, (snapshot) =>
    snapshot.modelFormat === input.format
      && snapshot.modelStatus === "paused"
      && rendererReady(input.format, snapshot)
  );
  const pausedFirstPixels = await captureFormatPixels(input.format);
  await delay(300);
  const pausedLater = await pageSnapshot();
  const pausedSecondPixels = await captureFormatPixels(input.format);
  assertPausedStable(input.alias, input.format, paused, pausedLater, pausedFirstPixels, pausedSecondPixels);

  await runInPage(`${input.alias} resume`, "window.__autoSvgaShortTermActions.playPause()");
  await waitForPage(`${input.alias} resumed`, (snapshot) =>
    snapshot.modelFormat === input.format && snapshot.modelStatus === "playing" && rendererReady(input.format, snapshot)
  );

  const imageReplacement = await applyImageAndReset(input);
  const textReplacement = await applyTextAndReset(input);
  const afterReset = await pageSnapshot();
  return {
    open,
    autoplay: compactSnapshot(playing),
    playingLater: compactSnapshot(playingLater),
    pause: compactSnapshot(paused),
    pauseStable: compactSnapshot(pausedLater),
    imageReplacement,
    textReplacement,
    afterReset: compactSnapshot(afterReset)
  };
}

async function applyImageAndReset(input) {
  const before = await captureFormatPixels(input.format);
  await applyOwnerVisibleImageReplacement(input);
  const replaced = await waitForPage(`${input.alias} image replacement`, (snapshot) =>
    snapshot.modelFormat === input.format
      && rendererReady(input.format, snapshot)
      && imageReplacementDirty(input.format, snapshot, input.imageTarget)
  );
  const replacedPixels = await captureFormatPixels(input.format);
  if (input.format === "vap" && before.sha256 === replacedPixels.sha256) {
    throw new Error(`${input.alias} image replacement did not change runtime pixels.`);
  }
  await resetImage(input.imageTarget);
  const reset = await waitForPage(`${input.alias} image reset`, (snapshot) =>
    snapshot.modelFormat === input.format
      && rendererReady(input.format, snapshot)
      && !imageReplacementDirty(input.format, snapshot, input.imageTarget)
  );
  const resetPixels = await captureFormatPixels(input.format);
  return {
    before,
    replaced: compactSnapshot(replaced),
    replacedPixels,
    reset: compactSnapshot(reset),
    resetPixels
  };
}

async function applyTextAndReset(input) {
  const before = await pageSnapshot();
  const apply = await setRuntimeText(input.textTarget, input.replacementValue);
  const changed = await waitForPage(`${input.alias} text replacement`, (snapshot) =>
    snapshot.modelFormat === input.format
      && textValueVisible(input.format, input.textTarget, input.replacementValue, snapshot)
  );
  await resetText(input.textTarget);
  const reset = await waitForPage(`${input.alias} text reset`, (snapshot) =>
    snapshot.modelFormat === input.format
      && !textValueVisible(input.format, input.textTarget, input.replacementValue, snapshot)
  );
  return {
    before: compactSnapshot(before),
    apply,
    changed: compactSnapshot(changed),
    reset: compactSnapshot(reset)
  };
}

async function proveReopenIsolation() {
  await openFileInProduct(generatedArtifacts.lottieA.path, "TASK-LOTTIE-REOPEN-A");
  await waitForPage("Lottie source A ready", (snapshot) => snapshot.modelFormat === "lottie" && snapshot.modelStatus === "playing");
  await clickOwnerVisibleReplaceButton("avatar");
  await setRuntimeText("text:2", "stale source A text");
  await waitForPage("Lottie source A dirty", (snapshot) =>
    snapshot.modelFormat === "lottie"
      && snapshot.replacementDirty === true
      && textValueVisible("lottie", "text:2", "stale source A text", snapshot)
  );

  const lottiePrepareStart = ipcEvents.length;
  await openFileInProduct(generatedArtifacts.lottieB.path, "TASK-LOTTIE-REOPEN-B");
  const lottieB = await waitForPage("Lottie source B clean", (snapshot) =>
    snapshot.modelFormat === "lottie"
      && snapshot.modelStatus === "playing"
      && snapshot.replacementDirty === false
      && !textValueVisible("lottie", "text:2", "stale source A text", snapshot)
  );
  assertNoReplacementPrepareAfter("lottie source B", lottiePrepareStart);

  await openFileInProduct(generatedArtifacts.vapA.path, "TASK-VAP-REOPEN-A");
  await waitForPage("VAP source A ready", (snapshot) => snapshot.modelFormat === "vap" && snapshot.modelStatus === "playing");
  const delayed = runInPage("VAP delayed text apply begins", `
    (() => {
      const host = window.autoSvgaElectronHost;
      const original = host.applyMultiFormatReplacement;
      let resolver;
      window.__autoSvgaDelayedApply = new Promise((resolve) => { resolver = resolve; });
      host.applyMultiFormatReplacement = async (input) => {
        await window.__autoSvgaDelayedApply;
        host.applyMultiFormatReplacement = original;
        return original(input);
      };
      const input = document.querySelector('[data-text-input][data-text-key="vap_fusion_title"]');
      input.value = "delayed source A text";
      input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: input.value }));
      window.__autoSvgaResolveDelayedApply = resolver;
      return true;
    })()
  `);
  await delayed;
  await delay(150);
  const vapPrepareStart = ipcEvents.length;
  await openFileInProduct(generatedArtifacts.vapB.path, "TASK-VAP-REOPEN-B");
  const beforeRelease = await waitForPage("VAP source B clean before delayed release", (snapshot) =>
    snapshot.modelFormat === "vap"
      && snapshot.modelStatus === "playing"
      && snapshot.replacementDirty === false
      && !textValueVisible("vap", "vap_fusion_title", "delayed source A text", snapshot)
  );
  assertNoReplacementPrepareAfter("VAP source B before delayed release", vapPrepareStart);
  await runInPage("release delayed VAP apply", "window.__autoSvgaResolveDelayedApply?.()");
  await delay(500);
  const afterRelease = await pageSnapshot();
  if (afterRelease.prepareCount > beforeRelease.prepareCount || textValueVisible("vap", "vap_fusion_title", "delayed source A text", afterRelease)) {
    throw new Error(`Delayed source A mutation leaked after source B Open: ${JSON.stringify({ before: compactSnapshot(beforeRelease), after: compactSnapshot(afterRelease) })}`);
  }
  assertNoReplacementPrepareAfter("VAP source B after delayed release", vapPrepareStart);

  return {
    lottieB: compactSnapshot(lottieB),
    vapBeforeRelease: compactSnapshot(beforeRelease),
    vapAfterRelease: compactSnapshot(afterRelease)
  };
}

async function proveTypedFailureRows() {
  const missingLottiePath = path.join(proofRoot, "missing-resource-lottie.json");
  const missingDoc = createExternalImageLottieDocument();
  missingDoc.assets[0].p = "missing.png";
  writeFileSync(missingLottiePath, `${JSON.stringify(missingDoc)}\n`, { mode: 0o600 });
  const malformedPath = path.join(proofRoot, "malformed-motion.json");
  writeFileSync(malformedPath, "{\"v\":", { mode: 0o600 });

  await openFileInProduct(missingLottiePath, "TASK-LOTTIE-MISSING");
  const missing = await waitForPage("missing Lottie typed failure", (snapshot) =>
    snapshot.modelFormat === "lottie"
      && snapshot.runtimeMountState !== "loaded"
      && snapshot.issueCodes.some((issue) => issue.code === "missing_resource")
  );
  await openFileInProduct(malformedPath, "TASK-MALFORMED-JSON");
  const malformed = await waitForPage("malformed JSON typed failure", (snapshot) =>
    (snapshot.modelStatus === "failed" || snapshot.modelStatus === "playbackBlocked")
      && snapshot.issueCodes.some((issue) => ["invalid_file", "parse_precondition", "open_failed"].includes(issue.code))
  );
  return {
    missingLottie: compactSnapshot(missing),
    malformed: compactSnapshot(malformed)
  };
}

async function proveNarrowWindowReachability() {
  windowRef.setBounds({ width: 520, height: 640 });
  await delay(200);
  await openFileInProduct(generatedArtifacts.vapA.path, "TASK-VAP-NARROW");
  const snapshot = await waitForPage("narrow VAP reachable", (candidate) =>
    candidate.modelFormat === "vap"
      && candidate.modelStatus === "playing"
      && candidate.stageReachable === true
      && candidate.rightPanelReachable === true
      && candidate.textInputsReachable === true
  );
  windowRef.setBounds({ width: 720, height: 720 });
  return compactSnapshot(snapshot);
}

async function openFileInProduct(filePath, label) {
  const openResult = await previewSession.openLocalFilePath(filePath, "fileOpenEvent");
  const eventId = `${label.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}-open`;
  const action = await runInPage(`${label} complete host open`, `
    (async () => {
      const eventId = ${JSON.stringify(eventId)};
      const openResult = ${JSON.stringify(openResult)};
      if (openResult?.svgaSource?.bytes && !(openResult.svgaSource.bytes instanceof Uint8Array)) {
        openResult.svgaSource.bytes = Uint8Array.from(Object.values(openResult.svgaSource.bytes));
      }
      const begun = window.__autoSvgaShortTermActions.beginHostFileOpen({ eventId });
      const completed = await window.__autoSvgaShortTermActions.completeHostFileOpen({ eventId, result: openResult });
      return { begun, completed };
    })()
  `);
  if (action?.begun !== true || action?.completed !== true) {
    throw new Error(`${label} Open did not reach the product controller: ${JSON.stringify(action)}`);
  }
  return { ...action, alias: label };
}

function installIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.openMultiFormatFile, async () => ({ status: "cancelled" }));
  ipcMain.handle(IPC_CHANNELS.getRecentSvgaFiles, async () => []);
  ipcMain.handle(IPC_CHANNELS.openRecentSvgaFile, async () => ({ status: "missing", pathRedacted: true }));
  ipcMain.handle(IPC_CHANNELS.clearRecentSvgaFiles, async () => ({ status: "cleared", count: 0 }));
  ipcMain.handle(IPC_CHANNELS.openDroppedMultiFormatFile, async (_event, input) => previewSession.openDroppedFile(input));
  ipcMain.handle(IPC_CHANNELS.prepareMultiFormatRuntimePreview, async (_event, input) => {
    ipcEvents.push({ phase: "prepare_runtime_preview", format: input?.format, sourceIdHash: hashId(input?.sourceId), replacementCount: input?.replacements?.active?.length ?? 0 });
    return previewSession.prepareRuntimePreview(input);
  });
  ipcMain.handle(IPC_CHANNELS.controlMultiFormatPreview, async (_event, input) => {
    ipcEvents.push({ phase: "control", action: input?.action });
    return previewSession.control(input);
  });
  ipcMain.handle(IPC_CHANNELS.chooseMultiFormatReplacementImage, async (_event, input) => chooseReplacement(input));
  ipcMain.handle(IPC_CHANNELS.applyMultiFormatReplacement, async (_event, input) => applyReplacement(input));
  ipcMain.handle(IPC_CHANNELS.resetMultiFormatReplacement, async (_event, input) => resetReplacement(input));
  ipcMain.handle(IPC_CHANNELS.multiFormatRendererReady, async (_event, input) => {
    ipcEvents.push({ phase: String(input?.phase ?? "renderer_ready") });
    return { ok: true };
  });
  ipcMain.handle(IPC_CHANNELS.writeClipboardText, async () => false);
  ipcMain.handle(IPC_CHANNELS.updateShortTermMenuState, async () => true);
  ipcMain.handle(IPC_CHANNELS.setShortTermWindowMode, async () => true);
}

async function chooseReplacement(input) {
  const targetId = String(input?.targetId ?? "").trim();
  const sourceId = String(input?.sourceId ?? "").trim();
  if (!targetId || !sourceId || sourceId !== previewSession.activeSourceId) {
    return { status: "failed", code: "parse_precondition", message: "stale replacement request", pathRedacted: true };
  }
  const selection = await previewSession.resolveReplacementSelection({ targetId, kind: "image" });
  if (selection.status !== "accepted") {
    return {
      status: "failed",
      code: selection.diagnostic?.code || "replacement_target_unavailable",
      message: selection.diagnostic?.message || "replacement target unavailable",
      pathRedacted: true
    };
  }
  return applyReplacement({
    targetId: selection.publicTargetId,
    sourceId,
    kind: "image",
    value: dataUriForFile(generatedArtifacts.replacement.path)
  }, selection);
}

async function applyReplacement(input, preResolvedSelection = undefined) {
  const sourceId = String(input?.sourceId ?? "").trim();
  if (!sourceId || sourceId !== previewSession.activeSourceId) {
    return { status: "failed", code: "parse_precondition", message: "stale replacement request", pathRedacted: true };
  }
  const kind = input?.kind === "text" ? "text" : "image";
  const selection = preResolvedSelection ?? await previewSession.resolveReplacementSelection({
    targetId: input?.targetId,
    kind
  });
  if (selection.status !== "accepted") {
    return {
      status: "failed",
      code: selection.diagnostic?.code || "replacement_target_unavailable",
      message: selection.diagnostic?.message || "replacement target unavailable",
      pathRedacted: true
    };
  }
  const result = await previewSession.applyReplacement({
    targetId: selection.publicTargetId,
    kind,
    value: String(input?.value ?? "")
  });
  const acceptedRuntimeTargetId = String(result?.model?.replacement?.lastAction?.runtimeTargetId ?? "").trim();
  if (result?.model?.replacement?.lastAction?.status === "accepted" && acceptedRuntimeTargetId !== selection.runtimeTargetId) {
    return { status: "failed", code: "replacement_binding_mismatch", message: "replacement target binding changed", pathRedacted: true };
  }
  return {
    ...result,
    replacementRuntimeValue: result?.model?.replacement?.lastAction?.status === "accepted"
      ? { kind, targetId: selection.runtimeTargetId, value: String(input?.value ?? "") }
      : undefined
  };
}

async function resetReplacement(input) {
  const sourceId = String(input?.sourceId ?? "").trim();
  if (!sourceId || sourceId !== previewSession.activeSourceId) {
    return { status: "failed", code: "parse_precondition", message: "stale reset request", pathRedacted: true };
  }
  const kind = input?.kind === "text" ? "text" : "image";
  const selection = await previewSession.resolveReplacementSelection({ targetId: input?.targetId, kind });
  if (selection.status !== "accepted") {
    return {
      status: "failed",
      code: selection.diagnostic?.code || "replacement_target_unavailable",
      message: selection.diagnostic?.message || "replacement target unavailable",
      pathRedacted: true
    };
  }
  const result = await previewSession.resetReplacement({
    targetId: selection.publicTargetId,
    kind
  });
  if (
    result?.model?.replacement?.lastAction?.status === "accepted"
    && result.model.replacement.lastAction.runtimeTargetId !== selection.runtimeTargetId
  ) {
    return { status: "failed", code: "replacement_binding_mismatch", message: "reset target binding changed", pathRedacted: true };
  }
  return result;
}

async function pageSnapshot() {
  return runInPage("page snapshot", `
    (async () => {
      const bridge = window.autoSvgaElectronHost;
      const actions = window.__autoSvgaShortTermActions;
      const mount = document.querySelector("#multiFormatRuntimeMount");
      const primaryCanvas = document.querySelector("#primaryCanvas");
      const primarySvgaReady = primaryCanvas?.dataset.runtimePlayer === "svga-web"
        && primaryCanvas?.dataset.runtimePlayerReady === "true";
      const runtimeCanvases = mount ? Array.from(mount.querySelectorAll("canvas")) : [];
      const videos = Array.from(document.querySelectorAll("video"));
      let summary;
      let summaryText = "";
      try {
        summaryText = actions?.currentStateSummary ? String(actions.currentStateSummary() || "") : "";
        summary = summaryText.startsWith("{") ? JSON.parse(summaryText) : undefined;
      } catch {}
      let hostModel;
      try { hostModel = bridge?.controlMultiFormatPreview ? await bridge.controlMultiFormatPreview({ action: "model" }) : undefined; } catch {}
      const bodyText = document.body?.innerText || "";
      const textInputs = Array.from(document.querySelectorAll("[data-text-input]")).map((input) => ({
        key: input.dataset.textKey || "",
        value: input.value || "",
        disabled: input.disabled === true,
        resetDisabled: input.closest(".textElementRow")?.querySelector("[data-action='runtime-text-reset']")?.disabled === true
      }));
      const imageRows = Array.from(document.querySelectorAll("[data-image-key]")).map((row) => ({
        key: row.dataset.imageKey || "",
        replacementState: row.dataset.replacementState || "",
        text: row.textContent || ""
      }));
      const runtimeCanvasDetails = runtimeCanvases.map((canvas) => {
        let webgl = false;
        try { webgl = !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl") || canvas.getContext("webgl2")); } catch {}
        return {
          width: Number(canvas.width) || 0,
          height: Number(canvas.height) || 0,
          clientWidth: Number(canvas.clientWidth) || 0,
          clientHeight: Number(canvas.clientHeight) || 0,
          webgl,
          runtimePlayer: canvas.dataset.runtimePlayer || ""
        };
      });
      const rectOk = (selector) => {
        const node = document.querySelector(selector);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0;
      };
      let ownerSnapshot;
      try {
        ownerSnapshot = hostModel?.model?.ownerRightPanelSnapshotEnvelope?.snapshotJson
          ? JSON.parse(hostModel.model.ownerRightPanelSnapshotEnvelope.snapshotJson)
          : undefined;
      } catch {
        ownerSnapshot = undefined;
      }
      return {
        productMilestoneId: bridge?.productMilestoneId,
        actionBridgeReady: !!actions?.completeHostFileOpen,
        bridgeReady: !!bridge?.prepareMultiFormatRuntimePreview,
        appState: document.querySelector(".macApp")?.dataset.appState || "",
        view: document.querySelector(".view.isActive")?.dataset.view || "",
        summary,
        summaryText,
        hostModel,
        modelStatus: primarySvgaReady ? primaryCanvas.dataset.runtimePlaybackState || summary?.status : summary?.status ?? hostModel?.model?.status,
        modelFormat: summary?.format ?? hostModel?.model?.detectedFormat,
        replacementDirty: hostModel?.model?.replacement?.dirty === true
          || summaryText.includes("未保存输出：")
          || !!document.querySelector('[data-replacement-state="preview"], .textElementRow[data-replacement-state="preview"]'),
        issueCodes: hostModel?.model?.rightPanel?.issues?.map((issue) => ({ code: issue.code, severity: issue.severity, reason: issue.details?.reason })) ?? [],
        assetSummary: hostModel?.model?.rightPanel?.assetInventory?.summary,
        imageTargets: ownerSnapshot?.imageTargets || [],
        textTargets: ownerSnapshot?.textTargets || [],
        runtimeMountState: primarySvgaReady ? "loaded" : mount?.dataset.runtimePreviewState || "",
        runtimeFormat: primarySvgaReady ? "svga" : mount?.dataset.runtimeFormat || "",
        runtimePlayerReady: primarySvgaReady ? "svga-web" : mount?.dataset.runtimePlayerReady || "",
        runtimePlaybackProgress: Number(primarySvgaReady ? primaryCanvas.dataset.runtimePlaybackProgress : mount?.dataset.runtimePlaybackProgress) || 0,
        runtimePlaybackFrame: Number(primarySvgaReady ? primaryCanvas.dataset.runtimePlaybackFrame : mount?.dataset.runtimePlaybackFrame) || 0,
        runtimePlaybackFrames: Number(primarySvgaReady ? primaryCanvas.dataset.runtimePlaybackFrames : mount?.dataset.runtimePlaybackFrames) || 0,
        runtimeSvgCount: mount?.querySelectorAll("svg").length || 0,
        runtimeWebglCanvasCount: runtimeCanvasDetails.filter((canvas) => canvas.webgl && canvas.width > 0 && canvas.height > 0).length,
        runtimeCanvasDetails,
        primaryCanvasWidth: Number(primaryCanvas?.width) || 0,
        primaryCanvasHeight: Number(primaryCanvas?.height) || 0,
        videoCount: videos.length,
        maxVideoReadyState: videos.reduce((max, video) => Math.max(max, video.readyState || 0), 0),
        anyVideoPaused: videos.length > 0 ? videos.some((video) => video.paused) : undefined,
        maxVideoCurrentTime: videos.reduce((max, video) => Math.max(max, Number(video.currentTime) || 0), 0),
        playbackTime: document.querySelector("#playbackTime")?.textContent || "",
        textInputs,
        imageRows,
        prepareCount: window.__autoSvgaRuntimeSelftestPrepareCount || 0,
        stageReachable: rectOk("#previewStagePanel"),
        rightPanelReachable: rectOk("#factGrid") && rectOk("#assetList"),
        textInputsReachable: document.querySelectorAll("[data-text-input]").length === 0 || rectOk("#textElementList"),
        bodyTokens: ["source-side preview contract", "播放受限", "打开文件", "SVGA", "LOTTIE", "VAP"].filter((token) => bodyText.includes(token))
      };
    })()
  `);
}

async function captureFormatPixels(format) {
  if (format === "svga") return captureCanvasBackingPixels('#primaryCanvas[data-runtime-player="svga-web"]');
  if (format === "lottie") return captureElementPixels("#multiFormatRuntimeMount svg", "lottie-svg");
  return captureWebglBackingPixels("#multiFormatRuntimeMount canvas");
}

async function captureCanvasBackingPixels(selector) {
  const pixels = await runInPage("canvas backing pixels", `
    (() => {
      const canvas = document.querySelector(${JSON.stringify(selector)});
      if (!canvas) return undefined;
      const width = Number(canvas.width) || 0;
      const height = Number(canvas.height) || 0;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context || width <= 0 || height <= 0) return undefined;
      const data = context.getImageData(0, 0, width, height).data;
      let nonWhite = 0;
      let nonTransparent = 0;
      let binary = "";
      for (let index = 0; index < data.length; index += 4) {
        const r = data[index] ?? 0;
        const g = data[index + 1] ?? 0;
        const b = data[index + 2] ?? 0;
        const a = data[index + 3] ?? 0;
        if (a > 0) nonTransparent += 1;
        if (a > 0 && (r < 245 || g < 245 || b < 245)) nonWhite += 1;
      }
      const chunkSize = 8192;
      for (let index = 0; index < data.length; index += chunkSize) {
        binary += String.fromCharCode(...data.subarray(index, index + chunkSize));
      }
      return { source: "canvas-backing-store", selector: ${JSON.stringify(selector)}, width, height, nonWhite, nonTransparent, dataBase64: btoa(binary) };
    })()
  `);
  if (!pixels) throw new Error(`Missing canvas backing pixels for ${selector}`);
  const bytes = Buffer.from(String(pixels.dataBase64 || ""), "base64");
  return {
    source: pixels.source,
    selector: pixels.selector,
    width: Number(pixels.width) || 0,
    height: Number(pixels.height) || 0,
    nonWhite: Number(pixels.nonWhite) || 0,
    nonTransparent: Number(pixels.nonTransparent) || 0,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}

async function captureWebglBackingPixels(selector) {
  const pixels = await runInPage("webgl backing pixels", `
    (() => {
      const canvas = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find((candidate) => {
        try {
          const rect = candidate.getBoundingClientRect();
          return rect.width > 1 && rect.height > 1 && (candidate.getContext("webgl") || candidate.getContext("experimental-webgl"));
        } catch {
          return false;
        }
      });
      if (!canvas) return undefined;
      const refreshResult = window.__autoSvgaShortTermActions?.refreshRuntimePreviewFrame?.();
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) return undefined;
      const width = Number(gl.drawingBufferWidth) || Number(canvas.width) || 0;
      const height = Number(gl.drawingBufferHeight) || Number(canvas.height) || 0;
      if (width <= 0 || height <= 0) return undefined;
      const data = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
      let nonWhite = 0;
      let nonTransparent = 0;
      let binary = "";
      for (let index = 0; index < data.length; index += 4) {
        const r = data[index] ?? 0;
        const g = data[index + 1] ?? 0;
        const b = data[index + 2] ?? 0;
        const a = data[index + 3] ?? 0;
        if (a > 0) nonTransparent += 1;
        if (a > 0 && (r < 245 || g < 245 || b < 245)) nonWhite += 1;
      }
      const chunkSize = 8192;
      for (let index = 0; index < data.length; index += chunkSize) {
        binary += String.fromCharCode(...data.subarray(index, index + chunkSize));
      }
      const rect = canvas.getBoundingClientRect();
      return {
        source: "webgl-backing-store",
        selector: ${JSON.stringify(selector)},
        width,
        height,
        cssWidth: rect.width,
        cssHeight: rect.height,
        backingWidth: Number(canvas.width) || 0,
        backingHeight: Number(canvas.height) || 0,
        nonWhite,
        nonTransparent,
        refreshResult,
        dataBase64: btoa(binary)
      };
    })()
  `);
  if (!pixels) throw new Error(`Missing WebGL backing pixels for ${selector}`);
  const bytes = Buffer.from(String(pixels.dataBase64 || ""), "base64");
  return {
    source: pixels.source,
    selector: pixels.selector,
    width: Number(pixels.width) || 0,
    height: Number(pixels.height) || 0,
    cssWidth: Number(pixels.cssWidth) || 0,
    cssHeight: Number(pixels.cssHeight) || 0,
    backingWidth: Number(pixels.backingWidth) || 0,
    backingHeight: Number(pixels.backingHeight) || 0,
    nonWhite: Number(pixels.nonWhite) || 0,
    nonTransparent: Number(pixels.nonTransparent) || 0,
    refreshResult: pixels.refreshResult,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}

async function captureElementPixels(selector, label) {
  const rect = await runInPage(`${label} rect`, `
    (() => {
      const element = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1;
      });
      if (!element) return undefined;
      const rect = element.getBoundingClientRect();
      return {
        x: Math.max(0, Math.floor(rect.x)),
        y: Math.max(0, Math.floor(rect.y)),
        width: Math.max(1, Math.ceil(rect.width)),
        height: Math.max(1, Math.ceil(rect.height)),
        cssWidth: rect.width,
        cssHeight: rect.height,
        backingWidth: Number(element.width) || 0,
        backingHeight: Number(element.height) || 0,
        markup: ${JSON.stringify(label)} === "lottie-svg" ? element.outerHTML : ""
      };
    })()
  `);
  if (!rect) throw new Error(`Missing capturable ${label} element.`);
  await delay(40);
  const image = await windowRef.webContents.capturePage(rect);
  const size = image.getSize();
  const bitmap = image.toBitmap();
  let nonWhite = 0;
  let nonTransparent = 0;
  for (let index = 0; index < bitmap.length; index += 4) {
    const b = bitmap[index] ?? 0;
    const g = bitmap[index + 1] ?? 0;
    const r = bitmap[index + 2] ?? 0;
    const a = bitmap[index + 3] ?? 255;
    if (a > 0) nonTransparent += 1;
    if (a > 0 && (r < 245 || g < 245 || b < 245)) nonWhite += 1;
  }
  return {
    source: "compositor-child-capture",
    selector,
    width: size.width,
    height: size.height,
    cssWidth: rect.cssWidth,
    cssHeight: rect.cssHeight,
    backingWidth: rect.backingWidth,
    backingHeight: rect.backingHeight,
    nonWhite,
    nonTransparent,
    sha256: createHash("sha256").update(bitmap).digest("hex"),
    markupSha256: rect.markup ? createHash("sha256").update(String(rect.markup)).digest("hex") : undefined
  };
}

async function selectRendererImageTarget(targetId) {
  await runInPage(`select ${targetId}`, `
    (() => {
      const actions = window.__autoSvgaShortTermActions;
      if (typeof actions?.selectImageKey !== "function") {
        throw new Error("select image action missing");
      }
      const targetId = ${JSON.stringify(targetId)};
      actions.selectImageKey(targetId);
      return true;
    })()
  `);
}

async function applyOwnerVisibleImageReplacement(input) {
  if (input.format === "svga") {
    await selectRendererImageTarget(input.imageTarget);
    await applyRendererReplacementFile(generatedArtifacts.replacement.path, "image/png");
    return;
  }
  await clickOwnerVisibleReplaceButton(input.imageTarget);
}

async function clickOwnerVisibleReplaceButton(targetId) {
  await runInPage(`replace ${targetId} through owner row`, `
    (() => {
      const targetId = ${JSON.stringify(targetId)};
      const selector = '.replaceImageButton[data-image-key="' + CSS.escape(targetId) + '"]';
      const button = document.querySelector(selector);
      if (!button || button.disabled) throw new Error("owner replacement action unavailable:" + targetId);
      button.click();
      return true;
    })()
  `);
}

async function applyRendererReplacementFile(filePath, mediaType) {
  const bytesBase64 = readFileSync(filePath).toString("base64");
  await runInPage("apply SVGA replacement file through renderer action bridge", `
    (async () => {
      const actions = window.__autoSvgaShortTermActions;
      if (typeof actions?.applyReplacementFile !== "function") {
        throw new Error("replacement file action missing");
      }
      const binary = atob(${JSON.stringify(bytesBase64)});
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      const file = new File([bytes], "task-replacement.png", { type: ${JSON.stringify(mediaType)} });
      await actions.applyReplacementFile(file);
      return true;
    })()
  `);
}

async function setRuntimeText(textKey, value) {
  return runInPage(`set runtime text ${textKey}`, `
    (() => {
      const actions = window.__autoSvgaShortTermActions;
      if (typeof actions?.selectTextKey !== "function" || typeof actions?.updateTextPreview !== "function") {
        throw new Error("runtime text action missing:" + ${JSON.stringify(textKey)});
      }
      const input = document.querySelector('[data-text-input][data-text-key=${JSON.stringify(textKey)}]');
      if (!input) throw new Error("runtime text input missing:" + ${JSON.stringify(textKey)});
      input.focus();
      input.value = ${JSON.stringify(value)};
      actions.selectTextKey(${JSON.stringify(textKey)});
      actions.updateTextPreview(${JSON.stringify(textKey)}, ${JSON.stringify(value)});
      return { textKey: input.dataset.textKey, value: input.value };
    })()
  `);
}

async function resetText(textKey) {
  await runInPage(`reset runtime text ${textKey}`, `
    (() => {
      const actions = window.__autoSvgaShortTermActions;
      if (typeof actions?.resetTextPreview !== "function") {
        throw new Error("runtime text reset action missing:" + ${JSON.stringify(textKey)});
      }
      actions.resetTextPreview(${JSON.stringify(textKey)});
      return true;
    })()
  `);
}

async function resetImage(targetId) {
  await runInPage(`reset image ${targetId}`, `
    (() => {
      const row = Array.from(document.querySelectorAll("[data-image-key]")).find((candidate) => candidate.dataset.imageKey === ${JSON.stringify(targetId)});
      row?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return window.__autoSvgaShortTermActions.resetImageReplacement();
    })()
  `);
}

async function runInPage(label, source) {
  if (!windowRef || windowRef.isDestroyed()) throw new Error(`Cannot run ${label}; window unavailable.`);
  return windowRef.webContents.executeJavaScript(source, true);
}

async function waitForPage(label, predicate, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await pageSnapshot();
    if (predicate(last)) return last;
    await delay(100);
  }
  throw new Error(`${label} timed out: ${JSON.stringify(compactSnapshot(last))}`);
}

function rendererReady(format, snapshot) {
  if (snapshot.runtimeMountState !== "loaded" || snapshot.runtimeFormat !== format) return false;
  if (format === "svga") return snapshot.runtimePlayerReady === "svga-web";
  if (format === "lottie") return snapshot.runtimeSvgCount > 0;
  if (format === "vap") return snapshot.runtimeWebglCanvasCount > 0 && snapshot.maxVideoReadyState >= 2;
  return false;
}

function assertPlaybackAdvanced(label, format, first, second, firstPixels, secondPixels) {
  assertPixels(label, "playing first", firstPixels);
  assertPixels(label, "playing second", secondPixels);
  const advanced = playbackPositionAdvanced(first, second);
  if (!advanced) {
    throw new Error(`${label} playback did not advance: ${JSON.stringify({ first: compactSnapshot(first), second: compactSnapshot(second) })}`);
  }
  if (format === "lottie") return;
  if (firstPixels.sha256 === secondPixels.sha256 && firstPixels.markupSha256 === secondPixels.markupSha256) {
    throw new Error(`${label} rendered pixels did not change during playback: ${JSON.stringify({
      first: compactSnapshot(first),
      second: compactSnapshot(second),
      firstPixels,
      secondPixels
    })}`);
  }
}

function assertPausedStable(label, format, first, second, firstPixels, secondPixels) {
  assertPixels(label, "paused first", firstPixels);
  assertPixels(label, "paused second", secondPixels);
  if (!pausePositionStable(first, second)) {
    throw new Error(`${label} playback position moved while paused: ${JSON.stringify({ first: compactSnapshot(first), second: compactSnapshot(second) })}`);
  }
  if (format === "lottie") return;
  if (
    firstPixels.sha256 !== secondPixels.sha256
    || firstPixels.markupSha256 !== secondPixels.markupSha256
  ) {
    throw new Error(`${label} pixels changed while paused.`);
  }
}

function assertPixels(label, phase, pixels) {
  if (!pixels || pixels.width <= 1 || pixels.height <= 1 || pixels.nonWhite <= 10 || pixels.nonTransparent <= 10) {
    throw new Error(`${label} ${phase} did not expose meaningful pixels: ${JSON.stringify(pixels)}`);
  }
}

function playbackPositionAdvanced(first, second) {
  const firstFrames = Number(first?.runtimePlaybackFrames) || 0;
  const secondFrames = Number(second?.runtimePlaybackFrames) || 0;
  if (firstFrames > 0 && firstFrames === secondFrames) {
    const left = Number(first.runtimePlaybackFrame) || 0;
    const right = Number(second.runtimePlaybackFrame) || 0;
    const delta = right >= left ? right - left : (firstFrames - left) + right;
    if (delta > 0 && delta < firstFrames * 0.8) return true;
  }
  if (Number(second?.maxVideoCurrentTime) > Number(first?.maxVideoCurrentTime) + 0.01) return true;
  const leftProgress = Number(first?.runtimePlaybackProgress) || 0;
  const rightProgress = Number(second?.runtimePlaybackProgress) || 0;
  return rightProgress > leftProgress || (leftProgress > 80 && rightProgress < 30);
}

function pausePositionStable(first, second) {
  const frames = Number(first?.runtimePlaybackFrames) || 0;
  if (frames > 0 && frames === Number(second?.runtimePlaybackFrames)) {
    return Math.abs((Number(first.runtimePlaybackFrame) || 0) - (Number(second.runtimePlaybackFrame) || 0)) <= 1;
  }
  return Math.abs((Number(first?.runtimePlaybackProgress) || 0) - (Number(second?.runtimePlaybackProgress) || 0)) <= 1
    && Math.abs((Number(first?.maxVideoCurrentTime) || 0) - (Number(second?.maxVideoCurrentTime) || 0)) <= 0.2;
}

function imageReplacementDirty(format, snapshot, targetId) {
  if (format === "svga") {
    return snapshot.summaryText?.includes("未保存输出：") === true;
  }
  return snapshot.hostModel?.model?.replacement?.dirty === true
    && snapshot.hostModel.model.replacement.active?.some((entry) => entry.kind === "image");
}

function textValueVisible(format, textKey, value, snapshot) {
  const input = snapshot.textInputs.find((entry) => entry.key === textKey);
  if (input?.value === value) return true;
  if (format === "svga") return false;
  return snapshot.hostModel?.model?.replacement?.active?.some((entry) =>
    entry.kind === "text" && entry.valuePreview === value
  ) === true;
}

function assertNoReplacementPrepareAfter(label, startIndex) {
  const leaked = ipcEvents.slice(startIndex).filter((event) =>
    event.phase === "prepare_runtime_preview" && Number(event.replacementCount) > 0
  );
  if (leaked.length > 0) {
    throw new Error(`${label} prepared runtime with stale replacement values: ${JSON.stringify(leaked)}`);
  }
}

function placeholderVisible(snapshot) {
  return snapshot.bodyTokens.includes("source-side preview contract") || snapshot.bodyTokens.includes("播放受限");
}

function compactSnapshot(snapshot) {
  return {
    appState: snapshot?.appState,
    view: snapshot?.view,
    summaryText: snapshot?.summaryText,
    modelStatus: snapshot?.modelStatus,
    modelFormat: snapshot?.modelFormat,
    replacementDirty: snapshot?.replacementDirty,
    replacement: snapshot?.hostModel?.model?.replacement,
    issueCodes: snapshot?.issueCodes,
    assetSummary: snapshot?.assetSummary,
    imageTargets: snapshot?.imageTargets?.map((target) => target.resourceId ?? target.imageKey),
    textTargets: snapshot?.textTargets?.map((target) => target.textKey ?? target.resourceId),
    runtimeMountState: snapshot?.runtimeMountState,
    runtimeFormat: snapshot?.runtimeFormat,
    runtimePlayerReady: snapshot?.runtimePlayerReady,
    runtimePlaybackProgress: snapshot?.runtimePlaybackProgress,
    runtimePlaybackFrame: snapshot?.runtimePlaybackFrame,
    runtimePlaybackFrames: snapshot?.runtimePlaybackFrames,
    runtimeSvgCount: snapshot?.runtimeSvgCount,
    runtimeWebglCanvasCount: snapshot?.runtimeWebglCanvasCount,
    primaryCanvasWidth: snapshot?.primaryCanvasWidth,
    primaryCanvasHeight: snapshot?.primaryCanvasHeight,
    videoCount: snapshot?.videoCount,
    maxVideoReadyState: snapshot?.maxVideoReadyState,
    maxVideoCurrentTime: snapshot?.maxVideoCurrentTime,
    anyVideoPaused: snapshot?.anyVideoPaused,
    playbackTime: snapshot?.playbackTime,
    textInputs: snapshot?.textInputs,
    imageRows: snapshot?.imageRows,
    prepareCount: snapshot?.prepareCount,
    bodyTokens: snapshot?.bodyTokens,
    stageReachable: snapshot?.stageReachable,
    rightPanelReachable: snapshot?.rightPanelReachable,
    textInputsReachable: snapshot?.textInputsReachable
  };
}

async function createRuntimeFixtures() {
  const fixtureRoot = path.join(proofRoot, "fixtures");
  mkdirSync(fixtureRoot, { recursive: true });
  const replacementPath = path.join(fixtureRoot, "replacement.png");
  writeFileSync(replacementPath, createSolidPngBytes(40, 40, [44, 188, 98, 255]), { mode: 0o600 });

  const svgaA = path.join(fixtureRoot, "replaceable-a.svga");
  const svgaB = path.join(fixtureRoot, "replaceable-b.svga");
  writeFileSync(svgaA, await createSvgaFixtureBytes([185, 68, 214, 255]), { mode: 0o600 });
  writeFileSync(svgaB, await createSvgaFixtureBytes([40, 140, 220, 255]), { mode: 0o600 });

  const lottieRoot = path.join(fixtureRoot, "lottie");
  const lottieA = await writeLottieFixture(lottieRoot, "a", "Task title A", [255, 80, 80, 255]);
  const lottieB = await writeLottieFixture(lottieRoot, "b", "Task title B", [80, 160, 255, 255]);

  const vapRoot = path.join(fixtureRoot, "vap");
  mkdirSync(vapRoot, { recursive: true });
  const vapA = path.join(vapRoot, "fusion-a.mp4");
  const vapB = path.join(vapRoot, "fusion-b.mp4");
  const vapcA = path.join(vapRoot, "fusion-a.json");
  const vapcB = path.join(vapRoot, "fusion-b.json");
  createPlayableVapMp4(vapA, "testsrc2=size=120x160:rate=30:duration=2");
  createPlayableVapMp4(vapB, "smptebars=size=120x160:rate=30:duration=2");
  writeFileSync(vapcA, `${JSON.stringify(createFusionVapcDocument())}\n`, { mode: 0o600 });
  writeFileSync(vapcB, `${JSON.stringify(createFusionVapcDocument())}\n`, { mode: 0o600 });

  Object.assign(generatedArtifacts, {
    replacement: fileEvidence("TASK-REPLACEMENT-A", replacementPath),
    svgaA: fileEvidence("TASK-SVGA-REPLACEABLE-A", svgaA),
    svgaB: fileEvidence("TASK-SVGA-REPLACEABLE-B", svgaB),
    lottieA: fileEvidence("TASK-LOTTIE-EXTERNAL-A", lottieA.path),
    lottieB: fileEvidence("TASK-LOTTIE-EXTERNAL-B", lottieB.path),
    lottieAImage: fileEvidence("TASK-LOTTIE-EXTERNAL-A-IMAGE", lottieA.imagePath),
    lottieBImage: fileEvidence("TASK-LOTTIE-EXTERNAL-B-IMAGE", lottieB.imagePath),
    vapA: fileEvidence("TASK-VAP-FUSION-A", vapA),
    vapB: fileEvidence("TASK-VAP-FUSION-B", vapB),
    vapASidecar: fileEvidence("TASK-VAP-FUSION-A-SIDECAR", vapcA),
    vapBSidecar: fileEvidence("TASK-VAP-FUSION-B-SIDECAR", vapcB)
  });
}

async function writeLottieFixture(root, suffix, text, rgba) {
  const directory = path.join(root, suffix);
  const imageDirectory = path.join(directory, "images");
  mkdirSync(imageDirectory, { recursive: true });
  const imagePath = path.join(imageDirectory, "avatar.png");
  const lottiePath = path.join(directory, "external-image-lottie.json");
  const document = createExternalImageLottieDocument();
  document.nm = `Task-owned external-image Lottie ${suffix}`;
  document.layers.unshift(createLottieMotionProofLayer());
  const textLayer = document.layers.find((layer) => layer.ty === 5);
  if (textLayer?.t?.d?.k?.[0]?.s) textLayer.t.d.k[0].s.t = text;
  writeFileSync(imagePath, createSolidPngBytes(32, 32, rgba), { mode: 0o600 });
  writeFileSync(lottiePath, `${JSON.stringify(document)}\n`, { mode: 0o600 });
  return { path: lottiePath, imagePath };
}

function createLottieMotionProofLayer() {
  return {
    ddd: 0,
    ind: 30,
    ty: 4,
    nm: "Runtime self-test motion proof",
    ip: 0,
    op: 60,
    st: 0,
    ks: {
      o: { a: 0, k: 100 },
      r: { a: 0, k: 0 },
      p: {
        a: 1,
        k: [
          lottieMotionKeyframe(0, [24, 22, 0], [176, 22, 0]),
          lottieMotionKeyframe(30, [176, 22, 0], [24, 22, 0]),
          { t: 60, s: [24, 22, 0] }
        ]
      },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] }
    },
    shapes: [
      { ty: "rc", d: 1, s: { a: 0, k: [36, 24] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 4 }, nm: "Motion proof rectangle" },
      { ty: "fl", c: { a: 0, k: [0.08, 0.95, 0.36, 1] }, o: { a: 0, k: 100 }, r: 1, nm: "Motion proof fill" }
    ]
  };
}

function lottieMotionKeyframe(time, start, end) {
  return {
    t: time,
    s: start,
    e: end,
    i: { x: [0.667], y: [1] },
    o: { x: [0.333], y: [0] }
  };
}

async function createSvgaFixtureBytes(rgba) {
  const root = await protobuf.load(path.join(repoRoot, "proto/svga.proto"));
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const frameImage = createSolidPngBytes(56, 56, rgba);
  const textAnchorImage = createSolidPngBytes(64, 20, [255, 255, 255, 12]);
  const matteImage = createSolidPngBytes(56, 56, [40, 48, 78, 220]);
  const payload = {
    version: "2.0",
    params: { viewBoxWidth: 128, viewBoxHeight: 128, fps: 24, frames: 24 },
    images: {
      profile_frame: frameImage,
      nickname_text: textAnchorImage,
      img_000: matteImage
    },
    sprites: [
      { imageKey: "profile_frame", frames: createSvgaFrames(24, 36, 32, 56, 56) },
      { imageKey: "nickname_text", frames: createSvgaFrames(24, 32, 78, 64, 20) },
      { imageKey: "img_000", frames: createSvgaFrames(24, 38, 34, 56, 56) }
    ],
    audios: []
  };
  const verificationError = MovieEntity.verify(payload);
  if (verificationError) throw new Error(`SVGA fixture verification failed: ${verificationError}`);
  return deflateSync(MovieEntity.encode(MovieEntity.create(payload)).finish());
}

function createSvgaFrames(count, tx, ty, width, height) {
  return Array.from({ length: count }, (_unused, frameIndex) => ({
    alpha: 1,
    layout: { x: 0, y: 0, width, height },
    transform: { a: 1, b: 0, c: 0, d: 1, tx: tx + Math.sin(frameIndex / 2) * 2, ty },
    clipPath: "",
    shapes: []
  }));
}

function createSolidPngBytes(width, height, rgba) {
  const rowStride = width * 4;
  const raw = Buffer.alloc((rowStride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (rowStride + 1);
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = rowOffset + 1 + x * 4;
      raw[pixelOffset] = rgba[0];
      raw[pixelOffset + 1] = rgba[1];
      raw[pixelOffset + 2] = rgba[2];
      raw[pixelOffset + 3] = rgba[3];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", concatBuffers(u32(width), u32(height), Buffer.from([8, 6, 0, 0, 0]))),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const payload = concatBuffers(typeBytes, data);
  return concatBuffers(u32(data.byteLength), payload, u32(crc32(payload)));
}

function u32(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(value >>> 0, 0);
  return bytes;
}

function concatBuffers(...parts) {
  return Buffer.concat(parts.map((part) => Buffer.from(part)));
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPlayableVapMp4(filePath, sourceFilter) {
  const ffmpeg = process.env.FFMPEG_BINARY || "/opt/homebrew/bin/ffmpeg";
  if (!existsSync(ffmpeg)) throw new Error("ffmpeg is required for the task-owned real VAP runtime fixture.");
  execFileSync(ffmpeg, [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    sourceFilter,
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    filePath
  ], { stdio: "pipe" });
}

function fileEvidence(alias, filePath) {
  const bytes = readFileSync(filePath);
  return {
    alias,
    path: filePath,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteLength: bytes.byteLength
  };
}

function redactedArtifactEvidence() {
  return Object.fromEntries(Object.entries(generatedArtifacts).map(([key, value]) => [key, {
    alias: value.alias,
    sha256: value.sha256,
    byteLength: value.byteLength,
    pathRedacted: true
  }]));
}

function dataUriForFile(filePath) {
  return `data:image/png;base64,${readFileSync(filePath).toString("base64")}`;
}

function assertNoRawPathLeak(value) {
  const serialized = JSON.stringify(value);
  if (serialized.includes(proofRoot) || /\/Users\/huangtengxin/u.test(serialized)) {
    throw new Error("Runtime self-test proof leaked a raw local path.");
  }
}

function installBootstrapFailureGuards() {
  process.once("uncaughtException", (error) => {
    writeBootstrapFailure("uncaught_exception", error);
    process.exitCode = 1;
    throw error;
  });
  process.once("unhandledRejection", (reason) => {
    writeBootstrapFailure("unhandled_rejection", reason);
    process.exitCode = 1;
  });
}

function writeBootstrapPhase(phase, details = undefined) {
  try {
    mkdirSync(proofRoot, { recursive: true });
    appendFileSync(bootstrapPhasePath, `${JSON.stringify({
      phase,
      pid: process.pid,
      timestamp: new Date().toISOString(),
      details
    })}\n`, { mode: 0o600 });
  } catch {
    // Bootstrap diagnostics are best-effort and must not mask the runtime result.
  }
}

function writeBootstrapFailure(phase, error) {
  try {
    mkdirSync(proofRoot, { recursive: true });
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : "";
    writeFileSync(bootstrapFailurePath, `${JSON.stringify({
      status: "failed",
      phase,
      productMilestoneId: MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID,
      sourceHead: "",
      error: redactString(message),
      stack: redactString(stack),
      boundaries: proofBoundaries()
    }, null, 2)}\n`, { mode: 0o600 });
    writeBootstrapPhase(phase, { error: redactString(message) });
  } catch {
    // Bootstrap diagnostics are best-effort and must not mask the original failure.
  }
}

async function writeProof(value) {
  mkdirSync(proofRoot, { recursive: true });
  writeFileSync(proofOutputPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  const sha256 = createHash("sha256").update(readFileSync(proofOutputPath)).digest("hex");
  process.stdout.write(`${JSON.stringify({ status: value.status, proofOutputPath, sha256 })}\n`);
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

function hashId(value) {
  return typeof value === "string" && value.length > 0 ? sha256Text(value).slice(0, 16) : "";
}

function redactString(value) {
  return String(value ?? "")
    .replace(/\/Users\/[^/\s]+(?:\/[^\s:]*)?/gu, "[local path]")
    .replace(new RegExp(proofRoot.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "gu"), "[task-runtime-root]")
    .slice(0, 300);
}

function proofBoundaries() {
  return {
    foreground: false,
    installedAppMutated: false,
    packaging: false,
    qaRoute: false,
    ownerMaterial: false,
    saveExportConversion: false,
    pathRedacted: true
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
