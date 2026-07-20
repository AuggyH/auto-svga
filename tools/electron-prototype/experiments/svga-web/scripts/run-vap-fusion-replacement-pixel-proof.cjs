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
const boundedVapPath = requiredEvidencePath("AUTO_SVGA_VAP_FUSION_INPUT");
const sidecarVapcPath = requiredEvidencePath("AUTO_SVGA_VAP_FUSION_SIDECAR");
const expectedFixtureHashes = Object.freeze({
  [boundedVapPath]: "1d0e9ff1f51c82a39dbebc37b2fec59fd420bdbe31bb4976264f8effdd4c1fb8",
  [sidecarVapcPath]: "27e03ca25c914cb2697ac4492c9f4d7dfb1ade2797c846f81804b8b1068e2959"
});
const replacementPngPath = requiredEvidencePath("AUTO_SVGA_VAP_REPLACEMENT_INPUT");
const expectedReplacementPngSha256 = "840e365ce9074cf667f9aa093db7c33bbd460eee50457c62179af658af37e3f1";

const proofRoot = path.join(os.tmpdir(), `auto-svga-vap-fusion-replacement-pixel-proof-${process.pid}`);
const proofOutputPath = path.join(proofRoot, "vap-fusion-replacement-pixel-proof.json");
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
  const replacementSha256 = sha256File(replacementPngPath);
  if (replacementSha256 !== expectedReplacementPngSha256) {
    throw new Error(`Task-owned replacement image hash drift: ${replacementSha256}`);
  }

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
  await installVapDiagnosticConstructor();

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

  const sourceReadiness = await waitForVapRuntimeReady("source runtime", 1, false);
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
  const sourceFrame = await captureBoundVapFrame("source", 0);

  const imageTargetId = loadedSnapshot.hostModel?.model?.rightPanel?.vapFusionImages
    ?.find((entry) => entry.srcTag === "avatar")?.resourceId;
  const textTargetId = loadedSnapshot.hostModel?.model?.rightPanel?.vapFusionTexts
    ?.find((entry) => entry.srcTag === "title")?.resourceId;
  if (!imageTargetId || !textTargetId) {
    throw new Error("VAP target-isolation proof requires public avatar and title resource identities.");
  }

  await runInPage("apply VAP text replacement", `
    (() => {
      const input = document.querySelector('[data-text-input][data-text-key=${JSON.stringify(textTargetId)}]');
      if (!input) throw new Error("VAP title replacement input is unavailable.");
      input.value = "Runtime VAP title";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()
  `);
  const textReadiness = await waitForVapRuntimeReady("text replacement runtime", 2, { title: true });
  const textSnapshot = await waitForPage("VAP text replacement remounted", () => pageSnapshot(), (snapshot) =>
    snapshot.hostModel?.model?.replacement?.active?.length === 1
      && snapshot.hostModel.model.replacement.active[0]?.kind === "text"
      && snapshot.hostModel.model.replacement.active[0]?.targetId === "title"
      && snapshot.runtimeMountState === "loaded"
  );
  const textFrame = await captureBoundVapFrame("text-replacement", 0);

  const replacementAction = await runInPage("choose VAP replacement image through action bridge", `
    (async () => {
      const row = document.querySelector('[data-image-key=${JSON.stringify(imageTargetId)}][data-action="select-resource"]');
      if (!row) throw new Error("VAP avatar replacement row is unavailable.");
      row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await window.__autoSvgaShortTermActions.replaceImage();
      return window.autoSvgaElectronHost.controlMultiFormatPreview({ action: "model" });
    })()
  `);
  if (replacementAction?.model?.replacement?.dirty !== true) {
    throw new Error(`VAP host replacement picker action did not apply a dirty model: ${JSON.stringify(compactSnapshot({ hostModel: replacementAction }))}`);
  }
  const replacementReadiness = await waitForVapRuntimeReady("image and text replacement runtime", 3, { avatar: true, title: true });
  const replacementSnapshot = await waitForPage("VAP image and text replacements remounted", () => pageSnapshot(), (snapshot) =>
    snapshot.hostModel?.model?.replacement?.dirty === true
      && snapshot.hostModel?.model?.replacement?.active?.length === 2
      && snapshot.hostModel?.model?.replacement?.active?.some((entry) => entry.kind === "image")
      && snapshot.hostModel?.model?.replacement?.active?.some((entry) => entry.kind === "text")
      && snapshot.runtimeMountState === "loaded"
      && snapshot.runtimeCanvasCount > 0
      && snapshot.runtimeWebglCanvasCount > 0
      && snapshot.runtimeCanvasMaxWidth > 0
      && snapshot.runtimeCanvasMaxHeight > 0
      && snapshot.maxVideoReadyState >= 2
  );
  const replacementFrame = await captureBoundVapFrame("replacement", 0);
  await delay(180);
  const replacementPausedFrame = await captureBoundVapFrame("replacement-paused", 0);

  await runInPage("reset VAP text replacement", `window.__autoSvgaShortTermActions.resetTextPreview(${JSON.stringify(textTargetId)})`);
  const textResetReadiness = await waitForVapRuntimeReady("text reset runtime", 4, { avatar: true });
  const textResetSnapshot = await waitForPage("VAP text reset preserved image replacement", () => pageSnapshot(), (snapshot) =>
    snapshot.hostModel?.model?.replacement?.dirty === true
      && snapshot.hostModel?.model?.replacement?.resetEnabled === true
      && snapshot.hostModel?.model?.replacement?.active?.length === 1
      && snapshot.hostModel.model.replacement.active[0]?.kind === "image"
      && snapshot.hostModel.model.replacement.active[0]?.targetId === "avatar"
      && snapshot.runtimeMountState === "loaded"
      && snapshot.runtimeCanvasCount > 0
      && snapshot.runtimeWebglCanvasCount > 0
      && snapshot.maxVideoReadyState >= 2
  );
  const textResetFrame = await captureBoundVapFrame("text-reset", 0);
  await delay(180);
  const textResetPausedFrame = await captureBoundVapFrame("text-reset-paused", 0);

  await runInPage("reset VAP image replacement", `window.__autoSvgaShortTermActions.resetImageReplacement(${JSON.stringify(imageTargetId)})`);
  const resetReadiness = await waitForVapRuntimeReady("source reset runtime", 5, {});
  const resetSnapshot = await waitForPage("VAP source reset", () => pageSnapshot(), (snapshot) =>
    snapshot.hostModel?.model?.replacement?.dirty === false
      && snapshot.hostModel?.model?.replacement?.resetEnabled === false
      && snapshot.runtimeMountState === "loaded"
      && snapshot.runtimeCanvasCount > 0
      && snapshot.runtimeWebglCanvasCount > 0
      && snapshot.runtimeCanvasMaxWidth > 0
      && snapshot.runtimeCanvasMaxHeight > 0
      && snapshot.maxVideoReadyState >= 2
  );
  const resetFrame = await captureBoundVapFrame("reset", 0);

  const textPixelsChanged = sourceFrame.sha256 !== textFrame.sha256;
  const pixelsChanged = sourceFrame.sha256 !== replacementFrame.sha256;
  const textResetPreservedImage = sourceFrame.sha256 !== textResetFrame.sha256;
  const textResetRemovedText = replacementFrame.sha256 !== textResetFrame.sha256;
  const resetRestored = sourceFrame.sha256 === resetFrame.sha256;
  const pausedStable = replacementFrame.sha256 === replacementPausedFrame.sha256
    && textResetFrame.sha256 === textResetPausedFrame.sha256;
  const instanceChainBound = sourceReadiness.ready.instanceCount === 1
    && textReadiness.ready.instanceCount === 2
    && replacementReadiness.ready.instanceCount === 3
    && textResetReadiness.ready.instanceCount === 4
    && resetReadiness.ready.instanceCount === 5;
  const textFusionBound = textReadiness.ready.hasTitleOption
    && textReadiness.ready.sourceIds.includes("title")
    && textReadiness.ready.textureIds.includes("title")
    && textReadiness.ready.titleTextureIndex > 0
    && textReadiness.ready.titleImageReady
    && textReadiness.ready.frameZeroReferencesTitle;
  const replacementFusionBound = replacementReadiness.ready.hasAvatarOption
    && replacementReadiness.ready.hasTitleOption
    && replacementReadiness.ready.sourceIds.includes("avatar")
    && replacementReadiness.ready.sourceIds.includes("title")
    && replacementReadiness.ready.textureIds.includes("avatar")
    && replacementReadiness.ready.textureIds.includes("title")
    && replacementReadiness.ready.avatarTextureIndex > 0
    && replacementReadiness.ready.titleTextureIndex > 0
    && replacementReadiness.ready.avatarImageReady
    && replacementReadiness.ready.titleImageReady
    && replacementReadiness.ready.frameZeroReferencesAvatar;
  const targetedResetBound = textResetReadiness.ready.hasAvatarOption
    && !textResetReadiness.ready.hasTitleOption
    && textResetReadiness.ready.sourceIds.includes("avatar")
    && !textResetReadiness.ready.sourceIds.includes("title")
    && textResetReadiness.ready.textureIds.includes("avatar")
    && !textResetReadiness.ready.textureIds.includes("title")
    && textResetReadiness.ready.avatarTextureIndex > 0
    && textResetReadiness.ready.avatarImageReady
    && textResetReadiness.ready.frameZeroReferencesAvatar;
  const capturesFrameBound = [
    sourceFrame,
    textFrame,
    replacementFrame,
    replacementPausedFrame,
    textResetFrame,
    textResetPausedFrame,
    resetFrame
  ].every((frame) =>
    frame.expectedFrame === 0
      && frame.seekedEvents > 0
      && frame.videoFrameCallbacks > 0
  );
  const directPixelGate = {
    instanceChainBound,
    textFusionBound,
    replacementFusionBound,
    targetedResetBound,
    capturesFrameBound,
    textPixelsChanged,
    pixelsChanged,
    textResetPreservedImage,
    textResetRemovedText,
    resetRestored,
    pausedStable
  };
  await runInPage("dispose VAP proof runtime", "window.__autoSvgaShortTermActions.closeFile()");
  const finalLifecycle = await waitForBalancedLifecycle(5);
  const passed = Object.values(directPixelGate).every(Boolean);

  await writeProof({
    status: passed ? "passed" : "failed",
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
      sourceReadiness,
      sourceFrame,
      text: compactSnapshot(textSnapshot),
      textReadiness,
      textFrame,
      replacement: compactSnapshot(replacementSnapshot),
      replacementReadiness,
      replacementFrame,
      replacementPausedFrame,
      textReset: compactSnapshot(textResetSnapshot),
      textResetReadiness,
      textResetFrame,
      textResetPausedFrame,
      reset: compactSnapshot(resetSnapshot),
      resetReadiness,
      resetFrame,
      directPixelGate,
      lifecycle: finalLifecycle,
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
  if (!passed) {
    process.exitCode = 1;
  }
}

function installIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.openMultiFormatFile, async () => ({ status: "cancelled" }));
  ipcMain.handle(IPC_CHANNELS.openDroppedMultiFormatFile, async (_event, input) => previewSession.openDroppedFile(input));
  ipcMain.handle(IPC_CHANNELS.prepareMultiFormatRuntimePreview, async (_event, input) => {
    const runtimeValues = Array.isArray(input?.replacements?.runtimeValues)
      ? input.replacements.runtimeValues.map((entry) => ({
          kind: entry?.kind,
          targetIdHash: hashId(entry?.targetId),
          valueLength: typeof entry?.value === "string" ? entry.value.length : 0
        }))
      : [];
    const prepared = await previewSession.prepareRuntimePreview(input);
    ipcEvents.push({
      phase: "prepare_runtime_preview",
      format: input?.format,
      sourceIdHash: hashId(input?.sourceId),
      runtimeValues,
      fusionParamKeys: Object.keys(prepared?.fusionParams ?? {}).sort()
    });
    return prepared;
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
      replacementRuntimeValue: {
        kind: "image",
        targetId: acceptedRuntimeTargetId,
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
    const sourceId = String(input?.sourceId ?? "").trim();
    const targetId = String(input?.targetId ?? "").trim();
    const kind = input?.kind === "text" ? "text" : input?.kind === "image" ? "image" : "";
    const value = String(input?.value ?? "");
    if (!sourceId || !targetId || !kind || sourceId !== previewSession.activeSourceId) {
      return { status: "failed", code: "parse_precondition", message: "stale replacement request", pathRedacted: true };
    }
    const selection = await previewSession.resolveReplacementSelection({ targetId, kind });
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
      value
    });
    if (sourceId !== previewSession.activeSourceId) {
      return { status: "failed", code: "replacement_target_stale", message: "replacement target changed", pathRedacted: true };
    }
    if (result?.model?.replacement?.lastAction?.status !== "accepted") return result;
    const acceptedRuntimeTargetId = String(result.model.replacement.lastAction.runtimeTargetId ?? "").trim();
    if (!acceptedRuntimeTargetId || acceptedRuntimeTargetId !== selection.runtimeTargetId) {
      return { status: "failed", code: "replacement_target_malformed", message: "replacement binding changed", pathRedacted: true };
    }
    ipcEvents.push({
      phase: "apply_replacement_binding_accepted",
      kind,
      publicTargetIdHash: hashId(selection.publicTargetId),
      runtimeTargetIdHash: hashId(acceptedRuntimeTargetId)
    });
    return {
      ...result,
      replacementRuntimeValue: {
        kind,
        targetId: acceptedRuntimeTargetId,
        value
      }
    };
  });
  ipcMain.handle(IPC_CHANNELS.resetMultiFormatReplacement, async (_event, input) => {
    const sourceId = String(input?.sourceId ?? "").trim();
    const targetId = String(input?.targetId ?? "").trim();
    const kind = input?.kind === "text" ? "text" : input?.kind === "image" ? "image" : "";
    if (!sourceId || !targetId || !kind || sourceId !== previewSession.activeSourceId) {
      return { status: "failed", code: "parse_precondition", message: "stale reset request", pathRedacted: true };
    }
    const selection = await previewSession.resolveReplacementSelection({ targetId, kind });
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
    if (sourceId !== previewSession.activeSourceId) {
      return { status: "failed", code: "replacement_target_stale", message: "reset target changed", pathRedacted: true };
    }
    if (result?.model?.replacement?.lastAction?.status !== "accepted") return result;
    const resetReceipt = result.model.replacement.lastAction;
    const acceptedPublicTargetId = String(resetReceipt.publicTargetId ?? "").trim();
    const acceptedRuntimeTargetId = String(resetReceipt.runtimeTargetId ?? "").trim();
    const acceptedBindingToken = String(resetReceipt.bindingToken ?? "");
    if (
      resetReceipt.type !== "resetReplacement"
      || acceptedPublicTargetId !== selection.publicTargetId
      || acceptedRuntimeTargetId !== selection.runtimeTargetId
      || acceptedBindingToken !== selection.bindingToken
    ) {
      return { status: "failed", code: "replacement_target_malformed", message: "reset binding changed", pathRedacted: true };
    }
    ipcEvents.push({
      phase: "reset_binding_accepted",
      kind,
      publicTargetIdHash: hashId(selection.publicTargetId),
      runtimeTargetIdHash: hashId(acceptedRuntimeTargetId)
    });
    return result;
  });
  ipcMain.handle(IPC_CHANNELS.multiFormatRendererReady, async (_event, input) => {
    ipcEvents.push({ phase: String(input?.phase ?? "renderer_ready") });
    return { ok: true };
  });
  ipcMain.handle(IPC_CHANNELS.writeClipboardText, async () => false);
  ipcMain.handle(IPC_CHANNELS.updateShortTermMenuState, async () => true);
  ipcMain.handle(IPC_CHANNELS.setShortTermWindowMode, async () => true);
}

async function installVapDiagnosticConstructor() {
  const installed = await runInPage("install VAP diagnostic constructor", `
    (async () => {
      const loadScript = (src, runtimeName) => new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-multiformat-runtime="' + runtimeName + '"]');
        if (existing?.dataset.loaded === "true") {
          resolve();
          return;
        }
        const script = existing || document.createElement("script");
        script.src = src;
        script.async = true;
        script.dataset.multiformatRuntime = runtimeName;
        script.addEventListener("load", () => {
          script.dataset.loaded = "true";
          resolve();
        }, { once: true });
        script.addEventListener("error", reject, { once: true });
        if (!existing) document.head.append(script);
      });
      await loadScript("/vap-regenerator-runtime-global-shim.js", "vap-regenerator-runtime-global");
      await loadScript("/runtime-node-modules/video-animation-player/dist/vap.js", "vap");
      const moduleValue = globalThis.Vap;
      const original = typeof moduleValue?.default === "function" ? moduleValue.default : undefined;
      if (!original) throw new Error("VAP diagnostic constructor could not bind the approved runtime.");
      const records = [];
      moduleValue.default = function diagnosticVapConstructor(options) {
        const player = original(options);
        records.push({ options, player, constructedAt: performance.now() });
        return player;
      };
      globalThis.__autoSvgaVapDiagnostic = { records };
      return true;
    })()
  `);
  if (installed !== true) throw new Error("VAP diagnostic constructor was not installed.");
}

async function vapDiagnosticSnapshot() {
  return runInPage("VAP diagnostic snapshot", `
    (() => {
      const records = globalThis.__autoSvgaVapDiagnostic?.records || [];
      const record = records.at(-1);
      const player = record?.player;
      const parser = player?.vapFrameParser;
      const avatar = parser?.srcData?.avatar;
      const title = parser?.srcData?.title;
      const mount = document.querySelector("#multiFormatRuntimeMount");
      const canvas = player?.canvas;
      return {
        instanceCount: records.length,
        mountState: mount?.dataset.runtimePreviewState || "",
        hasPlayer: !!player,
        hasAvatarOption: typeof record?.options?.avatar === "string",
        avatarOptionLength: typeof record?.options?.avatar === "string" ? record.options.avatar.length : 0,
        parserReady: !!parser,
        sourceIds: Object.keys(parser?.srcData || {}).sort(),
        textureIds: Object.keys(parser?.textureMap || {}).sort(),
        avatarTextureIndex: Number(parser?.textureMap?.avatar) || 0,
        avatarImageReady: !!avatar?.img && (Number(avatar.img.naturalWidth) > 0 || Number(avatar.img.width) > 0),
        avatarImageWidth: Number(avatar?.img?.naturalWidth) || Number(avatar?.img?.width) || 0,
        avatarImageHeight: Number(avatar?.img?.naturalHeight) || Number(avatar?.img?.height) || 0,
        frameZeroReferencesAvatar: !!parser?.config?.frame?.find((frame) => frame.i === 0)?.obj?.some((entry) => entry.srcId === "avatar"),
        hasTitleOption: typeof record?.options?.title === "string",
        titleOptionValue: typeof record?.options?.title === "string" ? record.options.title : "",
        titleTextureIndex: Number(parser?.textureMap?.title) || 0,
        titleImageReady: !!title?.img && (Number(title.img.naturalWidth) > 0 || Number(title.img.width) > 0),
        titleImageWidth: Number(title?.img?.naturalWidth) || Number(title?.img?.width) || 0,
        titleImageHeight: Number(title?.img?.naturalHeight) || Number(title?.img?.height) || 0,
        frameZeroReferencesTitle: !!parser?.config?.frame?.find((frame) => frame.i === 0)?.obj?.some((entry) => entry.srcId === "title"),
        canvasReady: !!canvas && Number(canvas.width) > 0 && Number(canvas.height) > 0,
        canvasWidth: Number(canvas?.width) || 0,
        canvasHeight: Number(canvas?.height) || 0,
        videoReadyState: Number(player?.video?.readyState) || 0,
        videoCurrentTime: Number(player?.video?.currentTime) || 0,
        videoPaused: player?.video?.paused
      };
    })()
  `);
}

async function waitForVapRuntimeReady(label, expectedInstanceCount, requirements = {}) {
  const deadline = Date.now() + 20_000;
  const timeline = [];
  let lastSignature = "";
  let last;
  while (Date.now() < deadline) {
    last = await vapDiagnosticSnapshot();
    const signature = JSON.stringify(last);
    if (signature !== lastSignature) {
      timeline.push({ elapsedMs: 20_000 - (deadline - Date.now()), ...last });
      lastSignature = signature;
    }
    const baseReady = last.instanceCount >= expectedInstanceCount
      && last.parserReady
      && last.canvasReady
      && last.videoReadyState >= 2;
    const avatarReady = requirements.avatar !== true || (
      last.hasAvatarOption
        && last.sourceIds.includes("avatar")
        && last.textureIds.includes("avatar")
        && last.avatarTextureIndex > 0
        && last.avatarImageReady
        && last.frameZeroReferencesAvatar
    );
    const titleReady = requirements.title !== true || (
      last.hasTitleOption
        && last.titleOptionValue === "Runtime VAP title"
        && last.sourceIds.includes("title")
        && last.textureIds.includes("title")
        && last.titleTextureIndex > 0
        && last.titleImageReady
        && last.frameZeroReferencesTitle
    );
    if (baseReady && avatarReady && titleReady) return { timeline, ready: last };
    await delay(20);
  }
  throw new Error(`${label} did not reach parser/texture readiness: ${JSON.stringify(last)}`);
}

async function captureBoundVapFrame(label, timeSeconds) {
  const stabilized = await runInPage(`${label} bound frame`, `
    (async () => {
      const record = globalThis.__autoSvgaVapDiagnostic?.records?.at(-1);
      const player = record?.player;
      if (!player?.canvas || !player?.video || !player?.vapFrameParser) {
        throw new Error("VAP bound-frame capture requires a ready player.");
      }
      const video = player.video;
      const targetTime = ${JSON.stringify(timeSeconds)};
      let seekedEvents = 0;
      let videoFrameCallbacks = 0;
      const seekTo = (nextTime) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          video.removeEventListener("seeked", onSeeked);
          reject(new Error("VAP frame seek did not complete."));
        }, 2_000);
        const onSeeked = () => {
          clearTimeout(timer);
          seekedEvents += 1;
          resolve();
        };
        video.addEventListener("seeked", onSeeked, { once: true });
        player.setTime(nextTime);
      });
      player.pause();
      if (Math.abs((Number(video.currentTime) || 0) - targetTime) < 0.0005) {
        const fps = Number(player.options?.fps) || 30;
        const duration = Number(video.duration) || (targetTime + (1 / fps));
        const nudgeTime = Math.min(Math.max(targetTime + (1 / fps), 1 / fps), Math.max(0, duration - 0.001));
        if (Math.abs(nudgeTime - targetTime) >= 0.0005) await seekTo(nudgeTime);
      }
      if (typeof video.requestVideoFrameCallback !== "function") {
        throw new Error("VAP frame capture requires requestVideoFrameCallback.");
      }
      const targetFramePresented = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("VAP frame callback did not complete.")), 2_000);
        video.requestVideoFrameCallback(() => {
          clearTimeout(timer);
          videoFrameCallbacks += 1;
          resolve();
        });
      });
      await Promise.all([seekTo(targetTime), targetFramePresented]);
      player.drawFrame(null, null);
      player.pause();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const rect = player.canvas.getBoundingClientRect();
      return {
        videoCurrentTime: Number(video.currentTime) || 0,
        videoPaused: video.paused,
        expectedFrame: Math.round((Number(video.currentTime) || 0) * (Number(player.options?.fps) || 30)),
        seekedEvents,
        videoFrameCallbacks,
        backingWidth: Number(player.canvas.width) || 0,
        backingHeight: Number(player.canvas.height) || 0,
        rect: {
          x: Math.floor(rect.x),
          y: Math.floor(rect.y),
          width: Math.max(1, Math.round(rect.width)),
          height: Math.max(1, Math.round(rect.height))
        }
      };
    })()
  `);
  const image = await windowRef.webContents.capturePage(stabilized.rect);
  const bitmap = image.toBitmap();
  let nonTransparentPixels = 0;
  let nonBlackPixels = 0;
  for (let index = 0; index + 3 < bitmap.length; index += 4) {
    const blue = bitmap[index];
    const green = bitmap[index + 1];
    const red = bitmap[index + 2];
    const alpha = bitmap[index + 3];
    if (alpha > 0) nonTransparentPixels += 1;
    if (red > 0 || green > 0 || blue > 0) nonBlackPixels += 1;
  }
  return {
    label,
    ...stabilized,
    captureWidth: image.getSize().width,
    captureHeight: image.getSize().height,
    byteLength: bitmap.byteLength,
    sha256: createHash("sha256").update(bitmap).digest("hex"),
    nonTransparentPixels,
    nonBlackPixels
  };
}

async function waitForBalancedLifecycle(expectedVapLoads) {
  const deadline = Date.now() + 5_000;
  let lifecycle;
  while (Date.now() < deadline) {
    lifecycle = { ...previewSession.lifecycle };
    if (lifecycle.vapLoads === expectedVapLoads
      && lifecycle.vapDestroys === expectedVapLoads
      && lifecycle.objectUrlsCreated === expectedVapLoads
      && lifecycle.objectUrlsRevoked === expectedVapLoads) {
      return lifecycle;
    }
    await delay(20);
  }
  throw new Error(`VAP lifecycle did not balance after disposal: ${JSON.stringify(lifecycle)}`);
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

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
    await previewSession.control({ action: "dispose" }).catch(() => {});
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

function requiredEvidencePath(name) {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required local evidence binding: ${name}`);
  }
  return value;
}

function redactString(value) {
  return String(value ?? "")
    .replace(/\/Users\/[^/\s]+(?:\/[^\s:]*)?/gu, "[local path]")
    .replace(/[A-Za-z]:\\Users\\[^\\\s]+(?:\\[^\s:]*)?/gu, "[local path]")
    .slice(0, 300);
}
