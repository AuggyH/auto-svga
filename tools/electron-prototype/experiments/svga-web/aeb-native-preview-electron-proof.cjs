"use strict";

const { createHash } = require("node:crypto");
const { existsSync, lstatSync, realpathSync } = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual, types: utilTypes } = require("node:util");

const {
  readBytesMetadata,
  readJsonRecord,
  validateEvidenceStore,
  writeBytesRecord,
  writeJsonRecord
} = require("../../../aeb/registered-fixture-proof-evidence-store.cjs");

const PROOF_SCHEMA = "auto-svga-aeb-native-preview-electron-proof-v2";
const AEB_FIXTURE_LANDING_TASK_ROOT = "/private/tmp/auto-svga-aeb-d001-8594bcfa";
const RUNTIME_PACKAGE_TREE_OBSERVATION_SCHEMA = "auto-svga-aeb-runtime-package-tree-observation-v1";
const RUNTIME_PACKAGE_TREE_OBSERVATION_PHASE = "aeb-native-preview-session-pre-conversion";
const RUNTIME_PACKAGE_TREE_OBSERVATION_RECORD = "registered-package-tree-runtime-observed.json";

const defaultFileSystem = Object.freeze({ existsSync, lstatSync, realpathSync });

function resolveAebNativePreviewRuntimeRoot({ appIsPackaged, appRoot, repoRoot, proofMode }) {
  const sourceRuntimeRoot = path.resolve(repoRoot);
  if (proofMode) return sourceRuntimeRoot;
  return appIsPackaged ? path.join(path.resolve(appRoot), ".runtime") : sourceRuntimeRoot;
}

function createRuntimePackageTreeObservationState() {
  let observation;
  let failure;
  return Object.freeze({
    capture(callback) {
      if (observation || failure) throw proofError("electron_runtime_package_manifest_duplicate");
      try {
        observation = callback();
        return observation;
      } catch (error) {
        const code = typeof error?.code === "string" && (
          error.code.startsWith("electron_runtime_package_")
          || error.code === "registered_fixture_evidence_store_failed"
        )
          ? error.code
          : "electron_runtime_package_observer_failed";
        failure = proofError(code);
        throw failure;
      }
    },
    read() {
      if (failure) throw failure;
      return observation;
    }
  });
}

function assertAebProofJsonPublication(published, readback, expected, code) {
  if (
    !published
    || !readback
    || published.sha256 !== readback.sha256
    || !isDeepStrictEqual(readback.value, expected)
  ) throw proofError(code);
  return true;
}

function resolveAebProofTaskRoot(taskRoot, fileSystem = defaultFileSystem) {
  if (taskRoot !== AEB_FIXTURE_LANDING_TASK_ROOT) {
    throw proofError("electron_proof_task_root_invalid");
  }
  assertCanonicalDirectory(taskRoot, { requiredMode: 0o700 }, fileSystem);
  return taskRoot;
}

function resolveAebProofOwnedPath(value, purpose, taskRoot, fileSystem = defaultFileSystem) {
  const canonicalTaskRoot = resolveAebProofTaskRoot(taskRoot, fileSystem);
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    throw proofError(`electron_proof_${purpose}_path_invalid`);
  }
  const resolved = path.resolve(value);
  const relative = path.relative(canonicalTaskRoot, resolved);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw proofError(`electron_proof_${purpose}_path_out_of_root`);
  }
  return resolved;
}

function resolveAebProofEvidenceStore(environment = process.env) {
  if (!environment || typeof environment !== "object" || Array.isArray(environment) || utilTypes.isProxy(environment)) {
    throw proofError("electron_proof_evidence_store_environment_invalid");
  }
  const environmentDescriptors = Object.getOwnPropertyDescriptors(environment);
  const readEnvironmentString = (key) => {
    const descriptor = environmentDescriptors[key];
    if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set || typeof descriptor.value !== "string") {
      throw proofError("electron_proof_evidence_store_environment_invalid");
    }
    return descriptor.value;
  };
  const outputRoot = readEnvironmentString("AUTO_SVGA_AEB_PROOF_OUTPUT_ROOT");
  const encoded = readEnvironmentString("AUTO_SVGA_AEB_PROOF_EVIDENCE_BINDING_BASE64");
  const bindingSha256 = readEnvironmentString("AUTO_SVGA_AEB_PROOF_EVIDENCE_BINDING_SHA256");
  if (
    typeof outputRoot !== "string"
    || path.dirname(path.resolve(outputRoot)) !== AEB_FIXTURE_LANDING_TASK_ROOT
    || typeof encoded !== "string"
    || typeof bindingSha256 !== "string"
    || !/^[a-f0-9]{64}$/u.test(bindingSha256)
  ) throw proofError("electron_proof_evidence_store_environment_invalid");
  let binding;
  try {
    binding = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw proofError("electron_proof_evidence_store_environment_invalid");
  }
  if (!binding || typeof binding !== "object" || Array.isArray(binding) || utilTypes.isProxy(binding)) {
    throw proofError("electron_proof_evidence_store_environment_invalid");
  }
  const store = { outputRoot: path.resolve(outputRoot), binding, bindingSha256 };
  try {
    validateEvidenceStore(store);
  } catch {
    throw proofError("electron_proof_evidence_store_rejected");
  }
  return store;
}

function resolveAebProofRuntimePaths(store) {
  return {
    userData: path.join(store.outputRoot, "user-data"),
    sessionData: path.join(store.outputRoot, "session-data"),
    productSessionRoot: path.join(store.outputRoot, "session-data", "product-runtime")
  };
}

function publishAebProofJson(store, group, recordName, value) {
  return writeJsonRecord(store, group, recordName, value);
}

function publishAebProofBytes(store, group, recordName, bytes) {
  return writeBytesRecord(store, group, recordName, bytes);
}

function readAebProofBytesMetadata(store, group, recordName) {
  return readBytesMetadata(store, group, recordName);
}

function readAebProofJsonRecord(store, group, recordName) {
  return readJsonRecord(store, group, recordName);
}

function resolveAebProofUserDataPath(reportPath, taskRoot, fileSystem = defaultFileSystem) {
  if (typeof reportPath !== "string" || reportPath.length === 0 || reportPath.includes("\0")) {
    throw proofError("electron_proof_user_data_report_missing");
  }
  const canonicalTaskRoot = resolveAebProofTaskRoot(taskRoot, fileSystem);
  const resolvedReportPath = path.resolve(reportPath);
  const reportsRoot = path.dirname(resolvedReportPath);
  const outputRoot = path.dirname(reportsRoot);
  const relativeOutput = path.relative(canonicalTaskRoot, outputRoot);
  if (
    relativeOutput === ""
    || relativeOutput.startsWith("..")
    || path.isAbsolute(relativeOutput)
    || path.basename(reportsRoot) !== "reports"
  ) {
    throw proofError("electron_proof_user_data_report_out_of_root");
  }
  let current = canonicalTaskRoot;
  for (const part of relativeOutput.split(path.sep)) {
    current = path.join(current, part);
    assertCanonicalDirectory(current, {}, fileSystem);
  }
  assertCanonicalDirectory(reportsRoot, {}, fileSystem);
  const userDataPath = path.join(outputRoot, "electron-user-data");
  if (fileSystem.existsSync(userDataPath)) throw proofError("electron_proof_user_data_stale");
  return userDataPath;
}

function assertCanonicalDirectory(directory, options = {}, fileSystem = defaultFileSystem) {
  let stat;
  try {
    stat = fileSystem.lstatSync(directory);
  } catch {
    throw proofError("electron_proof_user_data_ancestor_missing");
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw proofError("electron_proof_user_data_alias_rejected");
  }
  if (options.requiredMode !== undefined && (stat.mode & 0o777) !== options.requiredMode) {
    throw proofError("electron_proof_task_root_mode_invalid");
  }
  try {
    if (fileSystem.realpathSync(directory) !== path.resolve(directory)) {
      throw proofError("electron_proof_user_data_alias_rejected");
    }
  } catch (error) {
    if (error?.code?.startsWith?.("electron_proof_")) throw error;
    throw proofError("electron_proof_user_data_alias_rejected");
  }
}

async function runAebNativePreviewElectronProof({ window, blockedExternalRequests, expected }) {
  assertExpected(expected);
  const boot = await waitForSnapshot(window, (snapshot) => (
    snapshot.productMilestoneId === "0.3.0-alpha.1"
    && snapshot.preloadBridgeReady === true
    && snapshot.rendererActionBridgeReady === true
  ), "electron_renderer_bridge_not_ready");

  await runInPage(window, "open AEB package through renderer action bridge", `
    window.__autoSvgaShortTermActions.openFromHostDialog()
  `);
  const runtimePackageTreeObservation = await waitForRuntimePackageTreeObservationOrRendererFailure(expected, {
    readRendererSnapshot: () => pageSnapshot(window)
  });
  const loaded = await waitForSnapshot(window, (snapshot) => (
    snapshot.summary?.status === "previewReady"
    && snapshot.summary?.format === "svga"
    && snapshot.runtimeMountState === "loaded"
    && snapshot.runtimeFormat === "svga"
    && snapshot.runtimePlayerReady === "svga-web"
    && snapshot.runtimeSvgaCanvasCount === 1
    && isProjectIdentity(snapshot.summary?.aebProjectIdentity)
  ), "electron_renderer_svga_mount_failed");
  assertEqual(loaded.summary.aebPackageSha256, expected.packageSha256, "electron_package_binding_failed");
  assertEqual(loaded.summary.generatedSvgaSha256, expected.generatedSvgaSha256, "electron_generated_svga_binding_failed");
  assertMinimum(loaded.factCount, 4, "electron_information_facts_missing");
  assertMinimum(loaded.assetCount, 1, "electron_asset_inventory_missing");
  assertMinimum(loaded.diagnosticCount, 1, "electron_diagnostics_missing");
  const ownerModelOracle = assertOwnerModelOracle(loaded.summary, expected);

  const loadedPixels = await captureSvgaPixels(window);
  assertRenderablePixels(loadedPixels, "loaded");

  await runInPage(window, "play through renderer controller", `
    window.__autoSvgaShortTermActions.playPause()
  `);
  await waitForSnapshot(window, (snapshot) => snapshot.summary?.status === "playing", "electron_play_state_failed");
  const playingSamples = [];
  for (let index = 0; index < 6; index += 1) {
    await delay(120);
    const snapshot = await pageSnapshot(window);
    const pixels = await captureSvgaPixels(window);
    assertRenderablePixels(pixels, `playing-${index + 1}`);
    playingSamples.push({
      frame: snapshot.runtimePlaybackFrame,
      frames: snapshot.runtimePlaybackFrames,
      pixelSha256: pixels.sha256
    });
  }
  assertCoupledPlayingEvidence(playingSamples);

  await runInPage(window, "pause through renderer controller", `
    window.__autoSvgaShortTermActions.playPause()
  `);
  await waitForSnapshot(window, (snapshot) => snapshot.summary?.status === "paused", "electron_pause_state_failed");
  await delay(150);
  const pausedFirstSnapshot = await pageSnapshot(window);
  const pausedFirstPixels = await captureSvgaPixels(window);
  await delay(250);
  const pausedSecondSnapshot = await pageSnapshot(window);
  const pausedSecondPixels = await captureSvgaPixels(window);
  assertPausedEvidence({
    playingSamples,
    pausedFirstSnapshot,
    pausedSecondSnapshot,
    pausedFirstPixels,
    pausedSecondPixels
  });

  const saveResult = await runInPage(window, "Save As through renderer and preload IPC", `
    window.__autoSvgaShortTermActions.saveAs()
  `);
  assertEqual(saveResult?.status, "saved", "electron_save_as_failed");
  assertEqual(saveResult?.sha256, expected.generatedSvgaSha256, "electron_save_as_hash_drift");
  assertEqual(saveResult?.sizeBytes, expected.generatedSvgaBytes, "electron_save_as_size_drift");
  if (blockedExternalRequests.length !== 0) throw proofError("electron_external_request_observed");

  return {
    schemaVersion: PROOF_SCHEMA,
    status: "pass",
    productMilestoneId: "0.3.0-alpha.1",
    source: { head: expected.sourceHead, trackedCleanBefore: true },
    execution: {
      actualElectronMainEntry: true,
      actualPreloadIpcRoundTrip: true,
      actualRendererController: true,
      actualRendererSvgaMount: true,
      rendererActionBridgeOpen: true,
      hiddenWindow: window.isVisible() === false,
      electronVersion: process.versions.electron,
      mainEntry: "main.cjs",
      preloadEntry: "preload.cjs",
      rendererEntry: "web/short-term-macos-app.mjs"
    },
    package: {
      alias: "AEB-PERMIT057-FINALIZED-PACKAGE",
      sha256: expected.packageSha256,
      expectedOuterManifest: {
        sha256: expected.packageTreeSha256,
        fileCount: expected.packageTreeFileCount,
        totalBytes: expected.packageTreeTotalBytes,
        pathRedacted: true
      },
      runtimeObservedOuterManifest: runtimePackageTreeObservation,
      outerManifest: {
        sha256: runtimePackageTreeObservation.sha256,
        fileCount: runtimePackageTreeObservation.fileCount,
        totalBytes: runtimePackageTreeObservation.totalBytes,
        unchangedAcrossElectronRuntime: true,
        pathRedacted: true
      },
      sourceImmutable: true,
      pathRedacted: true
    },
    fixture: {
      alias: "AEB-PERMIT057-TASK-OWNED-PNG",
      sha256: expected.fixtureSha256,
      pathRedacted: true
    },
    generatedSvga: {
      sha256: expected.generatedSvgaSha256,
      sizeBytes: expected.generatedSvgaBytes,
      rendererMounted: true,
      playbackLoadPrepared: true
    },
    projectIdentity: {
      projectId: loaded.summary.aebProjectIdentity.projectId,
      projectSha256: loaded.summary.aebProjectIdentity.projectSha256,
      mapSha256: loaded.summary.aebProjectIdentity.mapSha256,
      assetSetSha256: loaded.summary.aebProjectIdentity.assetSetSha256
    },
    ownerModelOracle,
    renderer: {
      bootState: boot.appState,
      loadedState: loaded.appState,
      view: loaded.view,
      informationFacts: loaded.factCount,
      assets: loaded.assetCount,
      diagnostics: loaded.diagnosticCount,
      runtimeCanvas: {
        width: loadedPixels.width,
        height: loadedPixels.height,
        source: loadedPixels.source,
        selector: loadedPixels.selector
      }
    },
    playback: {
      loadedPixelSha256: loadedPixels.sha256,
      playingSamples,
      changingPlayingPixels: true,
      paused: {
        frame: pausedSecondSnapshot.runtimePlaybackFrame,
        frames: pausedSecondSnapshot.runtimePlaybackFrames,
        firstPixelSha256: pausedFirstPixels.sha256,
        secondPixelSha256: pausedSecondPixels.sha256,
        stablePixels: pausedFirstPixels.sha256 === pausedSecondPixels.sha256,
        stableFrame: pausedFirstSnapshot.runtimePlaybackFrame === pausedSecondSnapshot.runtimePlaybackFrame
      }
    },
    save: {
      status: saveResult.status,
      sha256: saveResult.sha256,
      sizeBytes: saveResult.sizeBytes,
      byteExact: true,
      overwriteAllowed: false,
      dialogExecuted: false
    },
    network: {
      captureInstalled: true,
      captureSource: "session.defaultSession.webRequest.onBeforeRequest",
      observedExternalRequests: blockedExternalRequests.slice(),
      externalRequestCount: blockedExternalRequests.length
    },
    boundaries: {
      sourcePackageMutation: false,
      renderOrBakeExecuted: false,
      foregroundUsed: false,
      installedAppMutated: false,
      supportClaimAllowed: false,
      productOwnerAcceptanceClaimed: false,
      releaseClaimed: false
    }
  };
}

async function pageSnapshot(window) {
  return runInPage(window, "AEB renderer snapshot", `
    (async () => {
      const bridge = window.autoSvgaElectronHost;
      const actions = window.__autoSvgaShortTermActions;
      const mount = document.querySelector("#multiFormatRuntimeMount");
      let summary;
      try { summary = actions?.currentStateSummary ? JSON.parse(actions.currentStateSummary()) : undefined; } catch {}
      const runtimeCanvases = mount ? Array.from(mount.querySelectorAll("canvas")) : [];
      return {
        productMilestoneId: bridge?.productMilestoneId,
        preloadBridgeReady: typeof bridge?.openAebPackage === "function"
          && typeof bridge?.prepareAebPreview === "function"
          && typeof bridge?.controlAebPreview === "function",
        rendererActionBridgeReady: typeof actions?.openFromHostDialog === "function"
          && typeof actions?.playPause === "function"
          && typeof actions?.saveAs === "function"
          && typeof actions?.currentStateSummary === "function",
        appState: document.querySelector(".macApp")?.dataset.appState || "",
        view: document.querySelector(".view.isActive")?.dataset.view || "",
        summary,
        runtimeMountState: mount?.dataset.runtimePreviewState || "",
        runtimeFormat: mount?.dataset.runtimeFormat || "",
        runtimePlayerReady: mount?.dataset.runtimePlayerReady || "",
        runtimePlaybackFrame: Number(mount?.dataset.runtimePlaybackFrame) || 0,
        runtimePlaybackFrames: Number(mount?.dataset.runtimePlaybackFrames) || 0,
        runtimeSvgaCanvasCount: runtimeCanvases.filter((canvas) => canvas.dataset.runtimePlayer === "svga-web").length,
        factCount: document.querySelectorAll("#factGrid > *").length,
        assetCount: document.querySelectorAll("#assetList > *").length,
        diagnosticCount: document.querySelectorAll("#findingList > *").length,
        errorMessage: document.querySelector("#errorMessage")?.textContent || ""
      };
    })()
  `);
}

async function captureSvgaPixels(window) {
  const pixels = await runInPage(window, "SVGA canvas backing-store pixels", `
    (() => {
      const canvas = document.querySelector('#multiFormatRuntimeMount canvas[data-runtime-player="svga-web"]');
      if (!canvas) return undefined;
      const width = Number(canvas.width) || 0;
      const height = Number(canvas.height) || 0;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context || width <= 0 || height <= 0) return { error: "canvas_unreadable", width, height };
      const data = context.getImageData(0, 0, width, height).data;
      let nonWhite = 0;
      let nonTransparent = 0;
      let channelDelta = 0;
      for (let index = 0; index < data.length; index += 4) {
        const r = data[index] || 0;
        const g = data[index + 1] || 0;
        const b = data[index + 2] || 0;
        const a = data[index + 3] || 0;
        if (a > 0) nonTransparent += 1;
        if (a > 0 && (r < 245 || g < 245 || b < 245)) nonWhite += 1;
        channelDelta += Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);
      }
      let binary = "";
      for (let index = 0; index < data.length; index += 8192) {
        binary += String.fromCharCode(...data.subarray(index, index + 8192));
      }
      return {
        source: "canvas-backing-store",
        selector: '#multiFormatRuntimeMount canvas[data-runtime-player="svga-web"]',
        width,
        height,
        nonWhite,
        nonTransparent,
        channelDelta,
        dataBase64: btoa(binary)
      };
    })()
  `);
  if (!pixels || pixels.error) throw proofError("electron_canvas_readback_failed");
  const bytes = Buffer.from(pixels.dataBase64, "base64");
  return {
    source: pixels.source,
    selector: pixels.selector,
    width: pixels.width,
    height: pixels.height,
    nonWhite: pixels.nonWhite,
    nonTransparent: pixels.nonTransparent,
    channelDelta: pixels.channelDelta,
    sha256: sha256(bytes)
  };
}

async function waitForSnapshot(window, predicate, code, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let latest;
  while (Date.now() < deadline) {
    latest = await pageSnapshot(window);
    if (visibleRendererErrorMessage(latest)) {
      const error = proofError("electron_renderer_error_visible");
      error.rendererSnapshot = rendererFailureSnapshot(latest);
      throw error;
    }
    if (predicate(latest)) return latest;
    await delay(100);
  }
  throw proofError(code);
}

function visibleRendererErrorMessage(snapshot) {
  if (snapshot?.view !== "failed") return "";
  return typeof snapshot.errorMessage === "string" ? snapshot.errorMessage : "";
}

function rendererFailureSnapshot(snapshot) {
  const safeText = visibleRendererErrorMessage(snapshot)
    .replace(/(?:file:\/\/)?\/Users\/[^\s"'<>)]*/giu, "<local-path>")
    .replace(/[A-Za-z]:\\[^\s"'<>)]*/gu, "<local-path>")
    .slice(0, 240);
  return {
    errorMessage: safeText,
    appState: String(snapshot?.appState || "").slice(0, 80),
    view: String(snapshot?.view || "").slice(0, 80),
    runtimeMountState: String(snapshot?.runtimeMountState || "").slice(0, 80),
    runtimeFormat: String(snapshot?.runtimeFormat || "").slice(0, 40),
    runtimePlayerReady: String(snapshot?.runtimePlayerReady || "").slice(0, 80),
    summaryStatus: String(snapshot?.summary?.status || "").slice(0, 80),
    summaryFormat: String(snapshot?.summary?.format || "").slice(0, 40),
    aebFirstIssueCode: typeof snapshot?.summary?.aebFirstIssueCode === "string"
      && /^aeb\.[a-z0-9_.-]{1,120}$/u.test(snapshot.summary.aebFirstIssueCode)
      ? snapshot.summary.aebFirstIssueCode
      : undefined,
  };
}

function assertRenderablePixels(pixels, phase) {
  if (
    pixels.source !== "canvas-backing-store"
    || pixels.width <= 1
    || pixels.height <= 1
    || pixels.nonWhite <= 10
    || pixels.nonTransparent <= 10
  ) throw proofError(`electron_${phase}_pixels_blank`);
  const total = pixels.width * pixels.height;
  if (pixels.nonTransparent / total > 0.98 && pixels.nonWhite / total < 0.08) {
    throw proofError(`electron_${phase}_pixels_placeholder`);
  }
}

function assertCoupledPlayingEvidence(samples) {
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    if (frameAdvanced(previous, current) && previous.pixelSha256 !== current.pixelSha256) return;
  }
  throw proofError("electron_playing_pixels_static");
}

function assertPausedEvidence({ playingSamples, pausedFirstSnapshot, pausedSecondSnapshot, pausedFirstPixels, pausedSecondPixels }) {
  assertRenderablePixels(pausedFirstPixels, "paused_first");
  assertRenderablePixels(pausedSecondPixels, "paused_second");
  if (pausedFirstPixels.sha256 !== pausedSecondPixels.sha256) throw proofError("electron_paused_pixels_changed");
  if (
    pausedFirstSnapshot.runtimePlaybackFrames !== pausedSecondSnapshot.runtimePlaybackFrames
    || circularFrameDistance(pausedFirstSnapshot, pausedSecondSnapshot) > 0.25
  ) throw proofError("electron_paused_frame_changed");
  const lastPlaying = playingSamples[playingSamples.length - 1];
  if (lastPlaying.frames !== pausedFirstSnapshot.runtimePlaybackFrames) throw proofError("electron_pause_frame_count_drift");
  const pauseDistance = circularFrameDistance(lastPlaying, {
    runtimePlaybackFrame: pausedFirstSnapshot.runtimePlaybackFrame,
    runtimePlaybackFrames: pausedFirstSnapshot.runtimePlaybackFrames
  });
  if (pauseDistance > 1.25) throw proofError("electron_pause_frame_jump");
}

function frameAdvanced(previous, current) {
  if (previous.frames <= 0 || current.frames !== previous.frames) return false;
  const delta = current.frame >= previous.frame
    ? current.frame - previous.frame
    : previous.frames - previous.frame + current.frame;
  return delta > 0.05 && delta < previous.frames * 0.75;
}

function circularFrameDistance(first, second) {
  const total = Number(first?.frames ?? first?.runtimePlaybackFrames) || 0;
  const left = Number(first?.frame ?? first?.runtimePlaybackFrame) || 0;
  const right = Number(second?.frame ?? second?.runtimePlaybackFrame) || 0;
  const direct = Math.abs(left - right);
  return total > 0 ? Math.min(direct, Math.max(0, total - direct)) : direct;
}

function runInPage(window, label, source) {
  return window.webContents.executeJavaScript(source, true).catch(() => {
    throw proofError(`electron_page_${label.replace(/[^a-z0-9]+/giu, "_").toLowerCase()}_failed`);
  });
}

function assertExpected(value) {
  if (!value || !/^[a-f0-9]{40}$/u.test(value.sourceHead || "")) throw proofError("electron_expected_source_invalid");
  for (const field of ["packageSha256", "packageTreeSha256", "fixtureSha256", "generatedSvgaSha256"]) {
    if (!/^[a-f0-9]{64}$/u.test(value[field] || "")) throw proofError(`electron_expected_${field}_invalid`);
  }
  if (!Number.isInteger(value.packageTreeFileCount) || value.packageTreeFileCount <= 0) {
    throw proofError("electron_expected_package_tree_count_invalid");
  }
  if (!Number.isInteger(value.packageTreeTotalBytes) || value.packageTreeTotalBytes <= 0) {
    throw proofError("electron_expected_package_tree_size_invalid");
  }
  if (!Number.isInteger(value.generatedSvgaBytes) || value.generatedSvgaBytes <= 0) throw proofError("electron_expected_size_invalid");
}

function createRuntimePackageTreeObservation({ snapshot, environment, store }) {
  assertRuntimePackageTreeSnapshot(snapshot);
  if (!environment || typeof environment !== "object" || Array.isArray(environment) || utilTypes.isProxy(environment)) {
    throw proofError("electron_runtime_package_environment_invalid");
  }
  const descriptors = Object.getOwnPropertyDescriptors(environment);
  const read = (key, code) => {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set || typeof descriptor.value !== "string" || descriptor.value.length === 0) {
      throw proofError(code);
    }
    const value = descriptor.value;
    return value;
  };
  const observation = {
    schema: RUNTIME_PACKAGE_TREE_OBSERVATION_SCHEMA,
    phase: RUNTIME_PACKAGE_TREE_OBSERVATION_PHASE,
    observationSource: "aeb-native-preview-session",
    packageRootAlias: "proof-package-root",
    sourceHead: read("AUTO_SVGA_AEB_PROOF_SOURCE_HEAD", "electron_runtime_package_source_invalid"),
    requestId: read("AUTO_SVGA_AEB_PROOF_REQUEST_ID", "electron_runtime_package_request_invalid"),
    requestSha256: read("AUTO_SVGA_AEB_PROOF_REQUEST_SHA256", "electron_runtime_package_request_invalid"),
    permitId: read("AUTO_SVGA_AEB_PROOF_PERMIT_ID", "electron_runtime_package_permit_invalid"),
    executionId: read("AUTO_SVGA_AEB_PROOF_EXECUTION_ID", "electron_runtime_package_execution_invalid"),
    d001PermitId: read("AUTO_SVGA_AEB_PROOF_D001_PERMIT_ID", "electron_runtime_package_d001_invalid"),
    d001ExecutionId: read("AUTO_SVGA_AEB_PROOF_D001_EXECUTION_ID", "electron_runtime_package_d001_invalid"),
    d001PacketHead: read("AUTO_SVGA_AEB_PROOF_D001_PACKET_HEAD", "electron_runtime_package_d001_invalid"),
    evidenceBindingSha256: store?.bindingSha256,
    sha256: snapshot.sha256,
    fileCount: snapshot.fileCount,
    totalBytes: snapshot.totalBytes,
    pathRedacted: true
  };
  read("AUTO_SVGA_AEB_PROOF_PACKAGE_TREE_SHA256", "electron_runtime_package_manifest_hash_invalid");
  read("AUTO_SVGA_AEB_PROOF_PACKAGE_TREE_FILE_COUNT", "electron_runtime_package_manifest_count_invalid");
  read("AUTO_SVGA_AEB_PROOF_PACKAGE_TREE_TOTAL_BYTES", "electron_runtime_package_manifest_size_invalid");
  return Object.freeze(observation);
}

function assertRuntimePackageTreeSnapshot(snapshot) {
  if (
    !snapshot
    || typeof snapshot !== "object"
    || !/^[a-f0-9]{64}$/u.test(snapshot.sha256 || "")
    || !Number.isInteger(snapshot.fileCount)
    || snapshot.fileCount <= 0
    || !Number.isInteger(snapshot.totalBytes)
    || snapshot.totalBytes <= 0
  ) throw proofError("electron_runtime_package_manifest_missing");
  return snapshot;
}

function assertRuntimePackageTreeObservation(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw proofError("electron_runtime_package_manifest_missing");
  if (value.schema !== RUNTIME_PACKAGE_TREE_OBSERVATION_SCHEMA) throw proofError("electron_runtime_package_manifest_schema_invalid");
  if (value.phase !== RUNTIME_PACKAGE_TREE_OBSERVATION_PHASE) throw proofError("electron_runtime_package_manifest_phase_invalid");
  if (value.observationSource !== "aeb-native-preview-session") throw proofError("electron_runtime_package_manifest_source_invalid");
  if (value.packageRootAlias !== "proof-package-root" || value.pathRedacted !== true) {
    throw proofError("electron_runtime_package_manifest_path_leak");
  }
  if (value.sha256 !== expected.packageTreeSha256) throw proofError("electron_runtime_package_manifest_hash_invalid");
  if (value.fileCount !== expected.packageTreeFileCount) throw proofError("electron_runtime_package_manifest_count_invalid");
  if (value.totalBytes !== expected.packageTreeTotalBytes) throw proofError("electron_runtime_package_manifest_size_invalid");
  for (const field of ["requestSha256", "evidenceBindingSha256"]) {
    if (expected[field] !== undefined && value[field] !== expected[field]) {
      throw proofError("electron_runtime_package_manifest_identity_invalid");
    }
  }
  for (const field of ["sourceHead", "requestId", "permitId", "executionId", "d001PermitId", "d001ExecutionId", "d001PacketHead"]) {
    if (expected[field] !== undefined && value[field] !== expected[field]) {
      throw proofError("electron_runtime_package_manifest_identity_invalid");
    }
  }
  return value;
}

async function waitForRuntimePackageTreeObservation(expected, options = {}) {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const pollIntervalMs = options.pollIntervalMs ?? 100;
  const sleep = options.sleep ?? delay;
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const observation = typeof expected.readRuntimePackageTreeObservation === "function"
      ? expected.readRuntimePackageTreeObservation()
      : expected.runtimePackageTreeObservation;
    if (observation !== undefined && observation !== null) {
      return assertRuntimePackageTreeObservation(observation, expected);
    }
    if (Date.now() >= deadline) throw proofError("electron_runtime_package_manifest_missing");
    await sleep(Math.min(pollIntervalMs, Math.max(1, deadline - Date.now())));
  }
}

async function waitForRuntimePackageTreeObservationOrRendererFailure(expected, options = {}) {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const pollIntervalMs = options.pollIntervalMs ?? 100;
  const sleep = options.sleep ?? delay;
  const readRendererSnapshot = options.readRendererSnapshot;
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const observation = typeof expected.readRuntimePackageTreeObservation === "function"
      ? expected.readRuntimePackageTreeObservation()
      : expected.runtimePackageTreeObservation;
    if (observation !== undefined && observation !== null) {
      return assertRuntimePackageTreeObservation(observation, expected);
    }
    if (typeof readRendererSnapshot === "function") {
      const snapshot = await readRendererSnapshot();
      if (snapshot?.view === "failed" || snapshot?.summary?.status === "failed") {
        const issueCode = snapshot?.summary?.aebFirstIssueCode;
        if (typeof issueCode === "string" && /^aeb\.[a-z0-9_.-]{1,120}$/u.test(issueCode)) {
          throw proofError(issueCode);
        }
        const error = proofError("electron_renderer_error_visible");
        error.rendererSnapshot = rendererFailureSnapshot(snapshot);
        throw error;
      }
    }
    if (Date.now() >= deadline) throw proofError("electron_runtime_package_manifest_missing");
    await sleep(Math.min(pollIntervalMs, Math.max(1, deadline - Date.now())));
  }
}

function assertEqual(actual, expected, code) {
  if (actual !== expected) throw proofError(code);
}

function assertMinimum(actual, minimum, code) {
  if (!Number.isInteger(actual) || actual < minimum) throw proofError(code);
}

function isProjectIdentity(value) {
  return value
    && typeof value.projectId === "string"
    && /^[A-Za-z0-9._-]{1,180}$/u.test(value.projectId)
    && [value.projectSha256, value.mapSha256, value.assetSetSha256]
      .every((digest) => /^[a-f0-9]{64}$/u.test(digest || ""));
}

function assertOwnerModelOracle(summary, expected) {
  const compatibility = summary?.aebCompatibility;
  const authority = summary?.aebPackageAuthority;
  const counts = compatibility?.counts;
  const resources = authority?.resources;
  const layers = authority?.layers;
  if (
    summary?.aebPackageReadOnly !== true
    || summary?.saveExportSupported !== true
    || compatibility?.schemaVersion !== "auto-svga-aeb-compatibility-v1"
    || counts?.native !== 1
    || counts?.bake_required !== 0
    || counts?.blocked !== 0
    || counts?.suggestion_only !== 0
    || compatibility?.blockingCount !== 0
    || compatibility?.outputAllowed !== true
    || authority?.schemaVersion !== "auto-svga-aeb-owner-authority-v1"
    || authority?.resourceCount !== 1
    || authority?.layerCount !== 1
    || !Array.isArray(resources)
    || resources.length !== 1
    || !Array.isArray(layers)
    || layers.length !== 1
  ) throw proofError("electron_owner_model_oracle_failed");
  const resource = resources[0];
  const layer = layers[0];
  if (
    resource?.assetId !== "asset-task-fixture-0001"
    || resource?.sha256 !== expected.fixtureSha256
    || resource?.hashVerified !== true
    || resource?.pathRedacted !== true
    || layer?.layerId !== "layer-task-fixture-0001"
    || layer?.assetId !== resource.assetId
    || layer?.outcome !== "native"
    || layer?.hostAuthorityBound !== true
    || layer?.resourceAuthorityBound !== true
    || layer?.visible !== true
  ) throw proofError("electron_owner_model_oracle_failed");
  return {
    schema: "auto-svga-aeb-owner-model-product-oracle-v1",
    nativeCount: counts.native,
    bakeRequiredCount: counts.bake_required,
    blockedCount: counts.blocked,
    suggestionOnlyCount: counts.suggestion_only,
    outputAllowed: compatibility.outputAllowed,
    readOnly: summary.aebPackageReadOnly,
    resourceAuthorityExact: true,
    layerAuthorityExact: true,
    saveExportSupported: summary.saveExportSupported
  };
}

function proofError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

module.exports = {
  AEB_FIXTURE_LANDING_TASK_ROOT,
  PROOF_SCHEMA,
  RUNTIME_PACKAGE_TREE_OBSERVATION_RECORD,
  RUNTIME_PACKAGE_TREE_OBSERVATION_SCHEMA,
  assertAebProofJsonPublication,
  assertRuntimePackageTreeObservation,
  createRuntimePackageTreeObservationState,
  createRuntimePackageTreeObservation,
  publishAebProofBytes,
  publishAebProofJson,
  readAebProofBytesMetadata,
  readAebProofJsonRecord,
  resolveAebProofEvidenceStore,
  resolveAebProofOwnedPath,
  resolveAebProofRuntimePaths,
  resolveAebProofTaskRoot,
  resolveAebProofUserDataPath,
  resolveAebNativePreviewRuntimeRoot,
  runAebNativePreviewElectronProof,
  waitForRuntimePackageTreeObservation,
  waitForRuntimePackageTreeObservationOrRendererFailure,
  visibleRendererErrorMessage
};
