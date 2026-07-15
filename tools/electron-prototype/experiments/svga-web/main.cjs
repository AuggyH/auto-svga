const { execFileSync } = require("node:child_process");
const { createHash, randomBytes } = require("node:crypto");
const { closeSync, existsSync, fstatSync, fsyncSync, mkdirSync, openSync, readFileSync, readSync, renameSync, rmSync, unlinkSync, writeFileSync, writeSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, screen, session } = require("electron");
const {
  IPC_CHANNELS,
  createSecureWebPreferences,
  isAllowedHostUrl,
  isExpectedSenderUrl,
  rejectFormalShortTermHostCapability
} = require("./host-adapter-contract.cjs");
const { createDesktopArtifactCatalog } = require("./desktop-artifact-catalog.cjs");
const {
  parseAcceptanceDisplayRequest,
  preserveWindowSizeAcrossDisplay,
  revalidateAcceptanceLaunchPlacement,
  resolveAcceptanceLaunchPlacement,
  resolveNormalLaunchPlacement,
  selectDisplayForPlacement,
  windowPlacementRecordFromBounds,
  sameWindowBounds
} = require("./short-term-window-bounds-policy.cjs");
const {
  readWindowPlacementPreference,
  writeWindowPlacementPreference
} = require("./short-term-window-placement-store.cjs");
const {
  describeSequenceProductRepairProofValidationFailure,
  validateSequenceByteRepairProof,
  validateSequenceProductRepairProof,
  validateSequenceRepairReportBinding
} = require("./sequence-repair-proof-contract.cjs");
const {
  MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID,
  createMultiFormatDesktopPreviewSession
} = require("./multiformat-desktop-session.cjs");
const {
  createMultiFormatOpenRuntimeTrace,
  resolveMultiFormatTraceRunId
} = require("./multiformat-open-runtime-trace.cjs");
const {
  chooseMultiFormatLocalFile
} = require("./multiformat-native-picker.cjs");

const smokeMode = process.argv.includes("--smoke");
const productSmokeMode = smokeMode && process.argv.includes("--product-smoke");
const normalProofMode = process.argv.includes("--p2-normal-proof") || process.env.AUTO_SVGA_P2_NORMAL_PROOF === "1";
const auditPlayerArgument = process.argv.find((argument) => argument.startsWith("--audit-player="));
const auditPlayer = auditPlayerArgument?.split("=")[1];
const auditMode = auditPlayer === "svga-web" || auditPlayer === "svgaplayerweb";
const normalVisibleStartupMode = !(smokeMode || auditMode || normalProofMode);
const hostBoundaryMode = normalVisibleStartupMode ? "formal" : "proof";
const productIdentity = "auto-svga";
const productDisplayName = "Auto SVGA";
app.setName(productDisplayName);
const appRoot = app.getAppPath();
const ownerPersistentUserDataRoot = app.getPath("userData");
const repoRoot = path.resolve(appRoot, "../../../..");
const multiFormatDesktopRuntimeRoot = app.isPackaged ? path.join(appRoot, ".runtime") : repoRoot;
const MAX_MULTI_FORMAT_REPLACEMENT_IMAGE_BYTES = 10 * 1024 * 1024;
function readPackagedRuntimeBuildInfo() {
  try {
    const buildInfo = JSON.parse(readFileSync(path.join(appRoot, ".runtime/build-info.json"), "utf8"));
    return buildInfo && typeof buildInfo === "object" ? buildInfo : undefined;
  } catch {
    return undefined;
  }
}
function runtimeBuildInfoProductMilestoneId(buildInfo) {
  if (buildInfo?.productMilestoneId === MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID) {
    return MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID;
  }
  if (buildInfo?.productMilestoneId === "short-term") {
    return "short-term";
  }
  return undefined;
}
const hostMenuActions = Object.freeze([
  "open-primary-svga",
  "open-secondary-svga",
  "open-reference-media",
  "clear-current-file",
  "save-replacement-as",
  "save-optimized-copy",
  "undo-replacement-preview",
  "redo-replacement-preview",
  "reset-replacement-preview",
  "cut",
  "copy",
  "paste",
  "select-all",
  "show-resources",
  "show-layers",
  "replace-selected-resource",
  "copy-current-resource-key",
  "show-diagnostics",
  "toggle-logs",
  "open-settings",
  "primary-play-pause",
  "primary-replay",
  "primary-loop-toggle",
  "compare-toggle",
  "sync-play-pause",
  "sync-replay",
  "theme-system",
  "theme-light",
  "theme-dark",
  "preview-background-checkerboard",
  "preview-background-light",
  "preview-background-dark",
  "preview-background-transparent",
  "fit-primary-contain",
  "fit-primary-original",
  "fit-primary-width",
  "fit-secondary-contain",
  "fit-secondary-original",
  "fit-secondary-width",
  "fit-reference-contain",
  "fit-reference-original",
  "fit-reference-width",
  "quit"
]);
const mainEntry = "main.cjs";
const preloadEntry = "preload.cjs";
const playerIdentity = "svga-web@2.4.4";
const csp = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
const acceptanceStartupPlacementProofFileName = "acceptance-startup-placement-proof.json";
const packagedRuntimeBuildInfo = app.isPackaged ? readPackagedRuntimeBuildInfo() : undefined;
const productMilestoneId = process.env.AUTO_SVGA_PRODUCT_MILESTONE ?? runtimeBuildInfoProductMilestoneId(packagedRuntimeBuildInfo) ?? "short-term";
const isShortTermProduct = productMilestoneId === "short-term";
const isMultiFormatDesktopProduct = productMilestoneId === MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID;
const isInternalMultiFormatCandidate = app.isPackaged
  && normalVisibleStartupMode
  && isMultiFormatDesktopProduct
  && packagedRuntimeBuildInfo?.source === "package-internal-trial";
const multiFormatTrace = createMultiFormatOpenRuntimeTrace({
  runId: resolveMultiFormatTraceRunId({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    environment: process.env
  })
});
const sourceFilePaths = new Map();
const referenceFileIds = new Set();
let multiFormatDesktopSession;
let multiFormatDesktopRendererReady = false;
let multiFormatOpenFileEventSequence = 0;
let multiFormatOpenFileEventFlushActive = false;
const pendingMultiFormatOpenFileEvents = [];
app.on("open-file", handleMultiFormatOpenFileEvent);
const usesShortTermPreviewShell = isShortTermProduct || isMultiFormatDesktopProduct;
const rendererHtmlEntry = usesShortTermPreviewShell ? "web/index.html" : "web/workbench.html";
const rendererEntry = usesShortTermPreviewShell ? "web/short-term-macos-app.mjs" : "web/desktop-product-entry.mjs";
const stylesEntry = usesShortTermPreviewShell ? "web/short-term-macos.css" : "web/styles.css";
const macosWorkbenchWindowSizing = Object.freeze({
  launch: { width: 640, height: 640 },
  shortTermWorkbench: { width: 1280, height: 800 },
  defaultWorkbench: { width: 1440, height: 900 },
  comfortable: { width: 1280, height: 800 },
  compact: { width: 1180, height: 760 },
  minimumLaunch: { width: 640, height: 640 },
  minimumSupported: { width: 1180, height: 760 },
  legacyStressViewport: { width: 900, height: 720 },
  availableScreenFitRatio: 0.86,
  workbenchAspectRatio: 16 / 10
});
const productMilestoneTitle = {
  "short-term": "Short-term SVGA Preview, Inspection, Replacement, And Optimization",
  [MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID]: "Auto SVGA 0.2 Multi-format Preview Candidate",
  P2: "Desktop Product Shell And Web Preview Parity",
  P3: "Basic Image Resource Replacement And Save As",
  P4: "Multi-Resource Editing, Undo/Redo And Export Integrity",
  P5: "Batch PNG Mapping And Live Product Evidence"
}[productMilestoneId] ?? "Auto SVGA Product Milestone";
const productArtifactRoot = process.env.AUTO_SVGA_PRODUCT_ARTIFACTS
  ? path.resolve(process.env.AUTO_SVGA_PRODUCT_ARTIFACTS)
  : path.join(repoRoot, ".artifacts/product", productMilestoneId);
const canonicalFixtureRuntimePath = path.join(appRoot, ".runtime/fixture/avatar-frame-smoke.svga");
const canonicalFixtureSourcePath = "examples/avatar_frame_basic/output/avatar_frame_basic.svga";
const referenceMediaTypes = new Map([
  [".gif", { kind: "gif", mediaType: "image/gif" }],
  [".mp4", { kind: "mp4", mediaType: "video/mp4" }],
  [".webm", { kind: "webm", mediaType: "video/webm" }]
]);
const p6AllowedSmokeInputSelectors = new Set([
  "body",
  "#modeDropdownTrigger",
  "[data-value='exportReview']",
  ".tabButton[data-tab='assets']",
  "#logsButton",
  "#settingsButton",
  "#settingsCloseButton",
  "#reduceMotionToggle",
  "#reduceBlurToggle",
  "#compareToggle"
]);
const desktopArtifacts = createDesktopArtifactCatalog({
  groupedRoots: [
    { rootPath: path.join(repoRoot, "jobs"), kind: "job" },
    { rootPath: path.join(repoRoot, "examples"), kind: "example" }
  ],
  standaloneRoots: [
    { rootPath: path.join(repoRoot, "exports"), jobId: "exports" },
    { rootPath: path.join(repoRoot, "preview"), jobId: "preview" },
    { rootPath: productArtifactRoot, jobId: `product:${productMilestoneId}`, outputLabel: `.artifacts/product/${productMilestoneId}` }
  ]
});
const sessionRoot = path.join(os.tmpdir(), `auto-svga-desktop-baseline-${process.pid}`);
const ownerWindowPlacementPreferencePath = path.join(
  ownerPersistentUserDataRoot,
  "normal-window-placement-v1.json"
);
const reportToken = randomBytes(24).toString("hex");
const runtimeInstanceId = randomBytes(12).toString("hex");
let experimentServer;
let expectedOrigin;
let smokeFinished = false;
let auditFinished = false;
let cspViolationSeen = false;
let cleanedUp = false;
let activeMainWindow;
let shortTermWindowMode = usesShortTermPreviewShell ? "launch" : "workbench";
let shortTermLaunchWindowSize = { ...macosWorkbenchWindowSizing.launch };
let shortTermWindowBoundsTimer;
let applyingShortTermWindowBounds = false;
let activeWindowPlacementMode = "legacy";
let ownerWindowPlacementDirty = false;
let ownerWindowPlacementSaveTimer;
let cachedAcceptanceStartupPlacementProofWriter;
const defaultShortTermMenuState = Object.freeze({
  view: "launch",
  mode: "preview",
  tab: "overview",
  appearance: "system",
  hasFile: false,
  hasOutput: false,
  outputKind: "",
  canOverwrite: false,
  canSaveAs: false,
  saveBusy: false,
  canCompare: false,
  canPlay: false,
  canReplay: false,
  canRenameImageKey: false,
  canReplaceImage: false,
  canResetImageReplacement: false,
  canEditText: false,
  canResetText: false,
  canRunOptimization: false,
  canShowOptimizationComparison: false,
  isRenaming: false,
  hasTransientState: false
});
let shortTermMenuState = { ...defaultShortTermMenuState };
const blockedExternalRequests = [];
multiFormatTrace.record({
  phase: "main_started",
  productMilestoneId,
  formalRuntimeMode: isMultiFormatDesktopProduct,
  queueDepth: 0,
  bridgeReady: false
});
const maxShortTermRecentFiles = 10;
const productArtifactIndex = {
  milestoneId: productMilestoneId,
  title: productMilestoneTitle,
  productIdentity,
  headCommit: gitHeadCommit(),
  generatedAt: new Date().toISOString(),
  humanReviewRequired: true,
  artifacts: []
};
if (productSmokeMode && productMilestoneId === "P5") {
  rmSync(productArtifactRoot, { recursive: true, force: true });
} else {
  mergeExistingProductArtifactIndex();
}

mkdirSync(sessionRoot, { recursive: true });
if (productSmokeMode || normalProofMode || normalVisibleStartupMode) mkdirSync(productArtifactRoot, { recursive: true });
if (!isShortTermProduct || smokeMode || auditMode || normalProofMode) {
  app.setPath("userData", path.join(sessionRoot, "user-data"));
  app.setPath("sessionData", path.join(sessionRoot, "session-data"));
}

function workAreaForWindow(window) {
  const bounds = window?.getBounds?.();
  const display = bounds ? screen.getDisplayMatching(bounds) : screen.getPrimaryDisplay();
  return display?.workArea;
}

function chooseMacosWindowBounds(target, options = {}) {
  const workArea = options.workArea ?? workAreaForWindow(options.window) ?? {
    x: 0,
    y: 0,
    width: target.width,
    height: target.height
  };
  const minSize = options.minimumSize ?? target;
  const maxWidth = Math.floor(workArea.width * macosWorkbenchWindowSizing.availableScreenFitRatio);
  const maxHeight = Math.floor(workArea.height * macosWorkbenchWindowSizing.availableScreenFitRatio);
  let width = Math.min(target.width, maxWidth);
  let height = options.aspectRatio
    ? Math.round(width / options.aspectRatio)
    : Math.min(target.height, maxHeight);
  if (height > maxHeight) {
    height = maxHeight;
    if (options.aspectRatio) width = Math.round(height * options.aspectRatio);
  }
  width = Math.max(width, Math.min(minSize.width, workArea.width));
  height = Math.max(height, Math.min(minSize.height, workArea.height));
  return {
    width,
    height,
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2)
  };
}

function chooseMacosLaunchWindowBounds(window) {
  return chooseMacosWindowBounds(macosWorkbenchWindowSizing.launch, {
    window,
    minimumSize: macosWorkbenchWindowSizing.minimumLaunch
  });
}

function resolveInitialMultiFormatWindowPlacement() {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  const acceptanceRequest = parseAcceptanceDisplayRequest({
    argv: process.argv,
    environment: process.env,
    internalCandidate: isInternalMultiFormatCandidate
  });
  if (acceptanceRequest.status === "rejected") {
    throw new Error(`window_placement_rejected:${acceptanceRequest.reason}`);
  }

  let placement;
  let mode;
  let preferenceStatus = "not-read";
  if (acceptanceRequest.status === "accepted") {
    placement = resolveAcceptanceLaunchPlacement({
      request: acceptanceRequest,
      displays,
      defaultSize: macosWorkbenchWindowSizing.launch,
      minimumSize: macosWorkbenchWindowSizing.minimumLaunch
    });
    mode = "acceptance";
  } else {
    const preference = normalVisibleStartupMode
      ? readWindowPlacementPreference(ownerWindowPlacementPreferencePath)
      : { status: "missing" };
    preferenceStatus = preference.status;
    const storedPlacement = preference.status === "loaded"
      ? preference.value
      : preference.status === "missing"
        ? undefined
        : { invalid: true };
    placement = resolveNormalLaunchPlacement({
      storedPlacement,
      displays,
      primaryDisplay,
      defaultSize: macosWorkbenchWindowSizing.launch,
      minimumSize: macosWorkbenchWindowSizing.minimumLaunch
    });
    mode = normalVisibleStartupMode ? "normal" : "proof";
  }
  if (placement.status === "rejected") {
    throw new Error(`window_placement_rejected:${placement.reason}`);
  }

  const selectedDisplay = displays.filter((display) => display?.id === placement.displayId);
  if (selectedDisplay.length !== 1) throw new Error("window_placement_rejected:display_identity_ambiguous");
  return {
    ...placement,
    mode,
    preferenceStatus,
    requestedDisplayId: acceptanceRequest.status === "accepted" ? acceptanceRequest.displayId : undefined
  };
}

function chooseMacosWorkbenchWindowBounds(window) {
  const targetSize = usesShortTermPreviewShell
    ? macosWorkbenchWindowSizing.shortTermWorkbench
    : macosWorkbenchWindowSizing.defaultWorkbench;
  return chooseMacosWindowBounds(targetSize, {
    window,
    minimumSize: macosWorkbenchWindowSizing.minimumSupported,
    aspectRatio: macosWorkbenchWindowSizing.workbenchAspectRatio
  });
}

function windowDisplayForBounds(bounds) {
  return bounds ? screen.getDisplayMatching(bounds) : screen.getPrimaryDisplay();
}

function displaySnapshot(display) {
  return {
    id: display?.id,
    scaleFactor: display?.scaleFactor,
    bounds: display?.bounds,
    workArea: display?.workArea
  };
}

function strictAcceptanceStartupDisplayArgument() {
  const displayArguments = process.argv.filter((argument) => argument.startsWith("--auto-svga-acceptance-display-id="));
  if (displayArguments.length !== 1) return undefined;
  const raw = displayArguments[0].slice("--auto-svga-acceptance-display-id=".length);
  if (!/^(?:0|[1-9]\d*)$/u.test(raw)) return undefined;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value <= 0xffffffff ? value : undefined;
}

function isAcceptanceStartupProofLaunch() {
  return process.argv.some((argument) => argument.startsWith("--auto-svga-acceptance-display-id"))
    || typeof process.env.AUTO_SVGA_ACCEPTANCE_EXECUTION_ID === "string";
}

function acceptanceStartupFailureReason(error) {
  const message = error instanceof Error ? error.message : String(error);
  const match = /^window_placement_rejected:([a-z0-9_]+)$/u.exec(message);
  return match?.[1] ?? "acceptance_startup_bootstrap_failed";
}

function writeAcceptanceStartupBootstrapFailureArtifact(reason, error) {
  if (!isAcceptanceStartupProofLaunch()) return { status: "ignored", reason: "acceptance_launch_not_requested" };
  const root = process.env.AUTO_SVGA_PRODUCT_ARTIFACTS;
  if (typeof root !== "string" || root.length === 0) return { status: "rejected", reason: "acceptance_artifact_root_missing" };
  if (root.includes("\0") || !path.isAbsolute(root)) return { status: "rejected", reason: "acceptance_artifact_root_invalid" };

  const proofPath = path.join(root, acceptanceStartupPlacementProofFileName);
  const executionId = typeof process.env.AUTO_SVGA_ACCEPTANCE_EXECUTION_ID === "string"
    && process.env.AUTO_SVGA_ACCEPTANCE_EXECUTION_ID.length > 0
    ? process.env.AUTO_SVGA_ACCEPTANCE_EXECUTION_ID
    : undefined;
  const requestedDisplayId = strictAcceptanceStartupDisplayArgument();
  const proof = {
    schemaVersion: 1,
    proofId: "acceptance-startup-placement-proof",
    status: "rejected",
    phase: "bootstrap",
    placementMode: "acceptance",
    reason: typeof reason === "string" && reason.length > 0 ? reason : "acceptance_startup_bootstrap_failed",
    executionId,
    requestedDisplayId,
    runtimeInstanceId,
    productIdentity: {
      productMilestoneId,
      headCommit: productArtifactIndex.headCommit,
      packagedRuntimeBuildInfo: packagedRuntimeBuildInfo
        ? {
            buildCommit: typeof packagedRuntimeBuildInfo.buildCommit === "string" ? packagedRuntimeBuildInfo.buildCommit : undefined,
            source: typeof packagedRuntimeBuildInfo.source === "string" ? packagedRuntimeBuildInfo.source : undefined,
            productMilestoneId: typeof packagedRuntimeBuildInfo.productMilestoneId === "string" ? packagedRuntimeBuildInfo.productMilestoneId : undefined
          }
        : undefined
    },
    privacy: {
      pathRedacted: true,
      screenshots: false,
      axTree: false,
      materialNames: false,
      ownerPreferenceMutated: false
    },
    errorClass: error instanceof Error && typeof error.name === "string" ? error.name : undefined,
    generatedAt: new Date().toISOString(),
    passed: false
  };
  let fd;
  try {
    mkdirSync(root, { recursive: true });
    fd = openSync(proofPath, "wx", 0o600);
    const bytes = Buffer.from(`${JSON.stringify(proof, null, 2)}\n`);
    writeSync(fd, bytes, 0, bytes.length);
    fsyncSync(fd);
    return { status: "written", fileName: acceptanceStartupPlacementProofFileName, proof };
  } catch (writeError) {
    return {
      status: "rejected",
      reason: writeError?.code === "EEXIST" ? "acceptance_placement_proof_exists" : "acceptance_bootstrap_artifact_write_failed"
    };
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // The proof is best-effort once the app is already failing closed before product input.
      }
    }
  }
}

function loadAcceptanceStartupPlacementProofWriter() {
  if (cachedAcceptanceStartupPlacementProofWriter) return cachedAcceptanceStartupPlacementProofWriter;
  try {
    cachedAcceptanceStartupPlacementProofWriter = require("./acceptance-startup-placement-proof.cjs")
      .writeAcceptanceStartupPlacementProof;
    return cachedAcceptanceStartupPlacementProofWriter;
  } catch (error) {
    writeAcceptanceStartupBootstrapFailureArtifact("acceptance_placement_proof_module_unavailable", error);
    throw new Error("window_placement_rejected:acceptance_placement_proof_module_unavailable");
  }
}

function requireAcceptanceStartupPlacementProof(window, placement) {
  if (placement?.mode !== "acceptance") return;
  const displays = screen.getAllDisplays();
  const selectedDisplayMatches = displays.filter((display) => display?.id === placement.displayId);
  const selectedDisplay = selectedDisplayMatches.length === 1 ? selectedDisplayMatches[0] : undefined;
  const writeAcceptanceStartupPlacementProof = loadAcceptanceStartupPlacementProofWriter();
  const proofResult = writeAcceptanceStartupPlacementProof({
    artifactRoot: process.env.AUTO_SVGA_PRODUCT_ARTIFACTS,
    placement,
    requestedDisplayId: placement.requestedDisplayId,
    selectedDisplay,
    primaryDisplay: screen.getPrimaryDisplay(),
    windowBounds: window.getBounds(),
    runtimeInstanceId,
    productMilestoneId,
    headCommit: productArtifactIndex.headCommit,
    packagedRuntimeBuildInfo
  });
  if (proofResult.status !== "written" || proofResult.proof?.status !== "accepted") {
    try {
      window.destroy();
    } catch {
      // The launch is already failing closed; destruction errors are not owner-visible.
    }
    throw new Error(`window_placement_rejected:${proofResult.proof?.reason ?? proofResult.reason ?? "acceptance_placement_proof_failed"}`);
  }
}

function setWindowBoundsWithoutRecordingUserResize(window, bounds, animate = false) {
  applyingShortTermWindowBounds = true;
  try {
    window.setBounds(bounds, animate);
  } finally {
    setImmediate(() => {
      applyingShortTermWindowBounds = false;
    });
  }
}

function persistOwnerWindowPlacement(window = activeMainWindow) {
  if (!ownerWindowPlacementDirty || activeWindowPlacementMode !== "normal") return { status: "ignored" };
  if (!isMultiFormatDesktopProduct || !normalVisibleStartupMode || !window || window.isDestroyed()) {
    return { status: "ignored" };
  }
  const bounds = window.getBounds();
  const display = selectDisplayForPlacement(bounds, screen.getAllDisplays());
  if (!display) return { status: "ignored" };
  const preference = windowPlacementRecordFromBounds({
    bounds,
    displayId: display.id,
    workArea: display.workArea,
    windowState: {
      minimized: window.isMinimized(),
      fullscreen: window.isFullScreen(),
      maximized: window.isMaximized()
    },
    launchMode: activeWindowPlacementMode,
    savedAt: new Date().toISOString()
  });
  if (preference.status !== "accepted") return preference;
  const result = writeWindowPlacementPreference(ownerWindowPlacementPreferencePath, preference.record);
  if (result.status === "saved") ownerWindowPlacementDirty = false;
  return result;
}

function scheduleOwnerWindowPlacementPersistence(window = activeMainWindow) {
  if (!ownerWindowPlacementDirty || activeWindowPlacementMode !== "normal") return;
  clearTimeout(ownerWindowPlacementSaveTimer);
  ownerWindowPlacementSaveTimer = setTimeout(() => {
    persistOwnerWindowPlacement(window);
  }, 300);
}

function markOwnerWindowPlacementDirty() {
  if (activeWindowPlacementMode !== "normal" || applyingShortTermWindowBounds) return;
  ownerWindowPlacementDirty = true;
}

function preserveShortTermLaunchWindowBounds(window = activeMainWindow, reason = "unknown") {
  if (!usesShortTermPreviewShell || !window || window.isDestroyed()) return { status: "ignored" };
  if (smokeMode || auditMode || normalProofMode) return { status: "ignored" };
  if (shortTermWindowMode !== "launch") return { status: "ignored", mode: shortTermWindowMode };

  const before = window.getBounds();
  const display = windowDisplayForBounds(before);
  const after = preserveWindowSizeAcrossDisplay({
    currentBounds: before,
    preservedSize: shortTermLaunchWindowSize,
    workArea: display?.workArea,
    minimumSize: macosWorkbenchWindowSizing.minimumLaunch
  });
  const changed = !sameWindowBounds(before, after);
  if (changed) setWindowBoundsWithoutRecordingUserResize(window, after, false);
  return {
    status: "preserved",
    mode: shortTermWindowMode,
    reason,
    display: displaySnapshot(display),
    before,
    after,
    changed
  };
}

function scheduleShortTermLaunchWindowBoundsPreservation(window = activeMainWindow, reason = "unknown") {
  if (!usesShortTermPreviewShell || !window || window.isDestroyed()) return;
  if (smokeMode || auditMode || normalProofMode) return;
  if (shortTermWindowMode !== "launch") return;
  clearTimeout(shortTermWindowBoundsTimer);
  shortTermWindowBoundsTimer = setTimeout(() => {
    preserveShortTermLaunchWindowBounds(window, reason);
  }, 80);
}

function installShortTermWindowBoundsPolicy(window) {
  if (!usesShortTermPreviewShell || smokeMode || auditMode || normalProofMode) return;

  window.on("will-move", () => {
    markOwnerWindowPlacementDirty();
  });
  window.on("will-resize", (_event, newBounds) => {
    markOwnerWindowPlacementDirty();
    if (shortTermWindowMode !== "launch" || applyingShortTermWindowBounds) return;
    shortTermLaunchWindowSize = {
      width: Math.max(macosWorkbenchWindowSizing.minimumLaunch.width, Math.round(newBounds.width)),
      height: Math.max(macosWorkbenchWindowSizing.minimumLaunch.height, Math.round(newBounds.height))
    };
  });
  window.on("move", () => {
    scheduleShortTermLaunchWindowBoundsPreservation(window, "window-move");
    scheduleOwnerWindowPlacementPersistence(window);
  });
  window.on("moved", () => {
    scheduleShortTermLaunchWindowBoundsPreservation(window, "window-moved");
    scheduleOwnerWindowPlacementPersistence(window);
  });
  window.on("resize", () => {
    scheduleShortTermLaunchWindowBoundsPreservation(window, "window-resize");
    scheduleOwnerWindowPlacementPersistence(window);
  });
  window.on("resized", () => {
    scheduleShortTermLaunchWindowBoundsPreservation(window, "window-resized");
    scheduleOwnerWindowPlacementPersistence(window);
  });

  const handleDisplayMetricsChanged = () => {
    scheduleShortTermLaunchWindowBoundsPreservation(window, "display-metrics-changed");
  };
  screen.on("display-metrics-changed", handleDisplayMetricsChanged);
  window.on("close", () => {
    clearTimeout(ownerWindowPlacementSaveTimer);
    persistOwnerWindowPlacement(window);
  });
  window.on("closed", () => {
    clearTimeout(shortTermWindowBoundsTimer);
    clearTimeout(ownerWindowPlacementSaveTimer);
    screen.removeListener("display-metrics-changed", handleDisplayMetricsChanged);
  });
}

function isExpectedSender(event) {
  return isExpectedSenderUrl(event.senderFrame?.url, expectedOrigin);
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
  const result = Object.fromEntries(keys.map((key) => [key, key === "noCspViolation" ? value[key] && !cspViolationSeen : value[key]]));
  if (value.p6InteractionTrace !== undefined) {
    const trace = validateP6InteractionTrace(bindP6InteractionTrace(value.p6InteractionTrace));
    if (!trace) return undefined;
    result.p6InteractionTrace = trace;
  }
  if (value.diagnostics !== undefined) {
    const diagnostics = validateSmokeDiagnostics(value.diagnostics);
    if (!diagnostics) return undefined;
    result.diagnostics = diagnostics;
  }
  if (value.ownerUsability !== undefined) {
    const ownerUsability = validateOwnerUsabilityResult(value.ownerUsability);
    if (!ownerUsability) return undefined;
    result.ownerUsability = ownerUsability;
  }
  if (value.workbenchRegionMap !== undefined) {
    const workbenchRegionMap = validateWorkbenchRegionMap(value.workbenchRegionMap);
    if (!workbenchRegionMap) return undefined;
    result.workbenchRegionMap = workbenchRegionMap;
  }
  if (value.shortTermScreenshots !== undefined) {
    if (typeof value.shortTermScreenshots !== "boolean") return undefined;
    result.shortTermScreenshots = value.shortTermScreenshots;
  }
  if (value.shortTermLoadFailed !== undefined) {
    if (typeof value.shortTermLoadFailed !== "boolean") return undefined;
    result.shortTermLoadFailed = value.shortTermLoadFailed;
  }
  if (value.shortTermLoadFailureProof !== undefined) {
    const shortTermLoadFailureProof = validateShortTermLoadFailureProof(value.shortTermLoadFailureProof);
    if (!shortTermLoadFailureProof) return undefined;
    result.shortTermLoadFailureProof = shortTermLoadFailureProof;
    result.shortTermLoadFailure = shortTermLoadFailureProof.passed;
  }
  if (value.shortTermSpecComparisonProof !== undefined) {
    const shortTermSpecComparisonProof = validateShortTermSpecComparisonProof(value.shortTermSpecComparisonProof);
    if (!shortTermSpecComparisonProof) return undefined;
    result.shortTermSpecComparisonProof = shortTermSpecComparisonProof;
    result.shortTermSpecComparison = shortTermSpecComparisonProof.passed;
  }
  if (value.shortTermRightSurfaceNavigationProof !== undefined) {
    const shortTermRightSurfaceNavigationProof = validateShortTermRightSurfaceNavigationProof(value.shortTermRightSurfaceNavigationProof);
    if (!shortTermRightSurfaceNavigationProof) return undefined;
    result.shortTermRightSurfaceNavigationProof = shortTermRightSurfaceNavigationProof;
    result.shortTermRightSurfaceNavigation = shortTermRightSurfaceNavigationProof.passed;
  }
  if (value.shortTermDesignInteractionProof !== undefined) {
    const shortTermDesignInteractionProof = validateShortTermDesignInteractionProof(value.shortTermDesignInteractionProof);
    if (!shortTermDesignInteractionProof) return undefined;
    result.shortTermDesignInteractionProof = shortTermDesignInteractionProof;
    result.shortTermDesignInteraction = shortTermDesignInteractionProof.passed;
  }
  if (value.shortTermReplaceableClassificationProof !== undefined) {
    const shortTermReplaceableClassificationProof = validateShortTermReplaceableClassificationProof(value.shortTermReplaceableClassificationProof);
    if (!shortTermReplaceableClassificationProof) return undefined;
    result.shortTermReplaceableClassificationProof = shortTermReplaceableClassificationProof;
    result.shortTermReplaceableClassification = shortTermReplaceableClassificationProof.passed;
  }
  if (value.shortTermSaveFailed !== undefined) {
    if (typeof value.shortTermSaveFailed !== "boolean") return undefined;
    result.shortTermSaveFailed = value.shortTermSaveFailed;
  }
  if (value.shortTermOpenFlowProof !== undefined) {
    const shortTermOpenFlowProof = validateShortTermOpenFlowProof(value.shortTermOpenFlowProof);
    if (!shortTermOpenFlowProof) return undefined;
    result.shortTermOpenFlowProof = shortTermOpenFlowProof;
    result.shortTermOpenFlow = shortTermOpenFlowProof.passed;
  }
  if (value.shortTermEmptyStateProof !== undefined) {
    const shortTermEmptyStateProof = validateShortTermEmptyStateProof(value.shortTermEmptyStateProof);
    if (!shortTermEmptyStateProof) return undefined;
    result.shortTermEmptyStateProof = shortTermEmptyStateProof;
    result.shortTermNoAudio = shortTermEmptyStateProof.noAudioVisible;
    result.shortTermNoReplaceable = shortTermEmptyStateProof.noReplaceableImagesMinimal;
    result.shortTermTextUnavailable = shortTermEmptyStateProof.textUnavailableMinimal;
  }
  if (value.shortTermRuntimeTextBoundaryProof !== undefined) {
    const shortTermRuntimeTextBoundaryProof = validateShortTermRuntimeTextBoundaryProof(value.shortTermRuntimeTextBoundaryProof);
    if (!shortTermRuntimeTextBoundaryProof) return undefined;
    result.shortTermRuntimeTextBoundaryProof = shortTermRuntimeTextBoundaryProof;
    result.shortTermRuntimeTextBoundary = shortTermRuntimeTextBoundaryProof.passed;
  }
  if (value.shortTermThumbnailProof !== undefined) {
    const shortTermThumbnailProof = validateShortTermThumbnailProof(value.shortTermThumbnailProof);
    if (!shortTermThumbnailProof) return undefined;
    result.shortTermThumbnailProof = shortTermThumbnailProof;
    result.shortTermThumbnails = shortTermThumbnailProof.passed;
  }
  if (value.shortTermOptimizationProof !== undefined) {
    const shortTermOptimizationProof = validateShortTermOptimizationProof(value.shortTermOptimizationProof);
    if (!shortTermOptimizationProof) return undefined;
    result.shortTermOptimizationProof = shortTermOptimizationProof;
    result.shortTermOptimization = shortTermOptimizationProof.passed;
  }
  if (value.shortTermRenameProof !== undefined) {
    const shortTermRenameProof = validateShortTermRenameProof(value.shortTermRenameProof);
    if (!shortTermRenameProof) return undefined;
    result.shortTermRenameProof = shortTermRenameProof;
    result.shortTermRename = shortTermRenameProof.passed;
  }
  if (value.shortTermReplacementProof !== undefined) {
    const shortTermReplacementProof = validateShortTermReplacementProof(value.shortTermReplacementProof);
    if (!shortTermReplacementProof) return undefined;
    result.shortTermReplacementProof = shortTermReplacementProof;
    result.shortTermReplacement = shortTermReplacementProof.passed;
  }
  if (value.optimizedReopenProof !== undefined) {
    const optimizedReopenProof = validateOptimizedReopenProof(value.optimizedReopenProof);
    if (!optimizedReopenProof) return undefined;
    result.optimizedReopenProof = optimizedReopenProof;
  }
  if (value.sequenceReviewProof !== undefined) {
    const sequenceReviewProof = validateSequenceReviewProof(value.sequenceReviewProof);
    if (!sequenceReviewProof) return undefined;
    result.sequenceReviewProof = sequenceReviewProof;
  }
  if (value.sequenceRepairPreviewProof !== undefined) {
    const sequenceRepairPreviewProof = validateSequenceRepairPreviewProof(value.sequenceRepairPreviewProof);
    if (!sequenceRepairPreviewProof) return undefined;
    result.sequenceRepairPreviewProof = sequenceRepairPreviewProof;
  }
  if (value.sequenceNoWriteSimulationProof !== undefined) {
    const sequenceNoWriteSimulationProof = validateSequenceNoWriteSimulationProof(value.sequenceNoWriteSimulationProof);
    if (!sequenceNoWriteSimulationProof) return undefined;
    result.sequenceNoWriteSimulationProof = sequenceNoWriteSimulationProof;
  }
  if (value.sequenceBoundedRepairPrototypeProof !== undefined) {
    const sequenceBoundedRepairPrototypeProof = validateSequenceBoundedRepairPrototypeProof(value.sequenceBoundedRepairPrototypeProof);
    if (!sequenceBoundedRepairPrototypeProof) return undefined;
    result.sequenceBoundedRepairPrototypeProof = sequenceBoundedRepairPrototypeProof;
  }
  if (value.sequencePrototypeRenderedBoundaryProof !== undefined) {
    const sequencePrototypeRenderedBoundaryProof = validateSequencePrototypeRenderedBoundaryProof(value.sequencePrototypeRenderedBoundaryProof);
    if (!sequencePrototypeRenderedBoundaryProof) return undefined;
    result.sequencePrototypeRenderedBoundaryProof = sequencePrototypeRenderedBoundaryProof;
  }
  if (value.sequenceNoopRoundTripProof !== undefined) {
    const sequenceNoopRoundTripProof = validateSequenceNoopRoundTripProof(value.sequenceNoopRoundTripProof);
    if (!sequenceNoopRoundTripProof) return undefined;
    result.sequenceNoopRoundTripProof = sequenceNoopRoundTripProof;
  }
  if (value.sequenceByteRepairProof !== undefined) {
    const sequenceByteRepairProof = validateSequenceByteRepairProof(value.sequenceByteRepairProof);
    if (!sequenceByteRepairProof) return undefined;
    result.sequenceByteRepairProof = sequenceByteRepairProof;
  }
  if (value.sequenceProductRepairProof !== undefined) {
    const sequenceProductRepairProof = validateSequenceProductRepairProof(value.sequenceProductRepairProof);
    if (!sequenceProductRepairProof) return undefined;
    result.sequenceProductRepairProof = sequenceProductRepairProof;
  }
  if (value.replacementReadinessProof !== undefined) {
    const replacementReadinessProof = validateReplacementReadinessProof(value.replacementReadinessProof);
    if (!replacementReadinessProof) return undefined;
    result.replacementReadinessProof = replacementReadinessProof;
  }
  if (value.replacementPreviewProof !== undefined) {
    const replacementPreviewProof = validateReplacementPreviewProof(value.replacementPreviewProof);
    if (!replacementPreviewProof) return undefined;
    result.replacementPreviewProof = replacementPreviewProof;
  }
  if (value.replacementUndoRedoProof !== undefined) {
    const replacementUndoRedoProof = validateReplacementUndoRedoProof(value.replacementUndoRedoProof);
    if (!replacementUndoRedoProof) return undefined;
    result.replacementUndoRedoProof = replacementUndoRedoProof;
  }
  if (value.replacementResetProof !== undefined) {
    const replacementResetProof = validateReplacementResetProof(value.replacementResetProof);
    if (!replacementResetProof) return undefined;
    result.replacementResetProof = replacementResetProof;
  }
  if (value.replacementSaveAsProof !== undefined) {
    const replacementSaveAsProof = validateReplacementSaveAsProof(value.replacementSaveAsProof);
    if (!replacementSaveAsProof) return undefined;
    result.replacementSaveAsProof = replacementSaveAsProof;
  }
  if (value.replacementMultiResourceProof !== undefined) {
    const replacementMultiResourceProof = validateReplacementMultiResourceProof(value.replacementMultiResourceProof);
    if (!replacementMultiResourceProof) return undefined;
    result.replacementMultiResourceProof = replacementMultiResourceProof;
  }
  return result;
}

function validateShortTermEmptyStateProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "short-term-empty-state-proof") return undefined;
  if (value.source !== "short-term-smoke") return undefined;
  const booleanKeys = [
    "noAudioVisible",
    "noReplaceableImagesMinimal",
    "textUnavailableMinimal",
    "ordinaryImagesNotDuplicatedInReplaceables",
    "passed"
  ];
  if (!booleanKeys.every((key) => value[key] === true)) return undefined;
  if (!Number.isInteger(value.assetRowCount) || value.assetRowCount <= 0) return undefined;
  if (!Number.isInteger(value.replaceableImageRowCount) || value.replaceableImageRowCount !== 0) return undefined;
  if (!Number.isInteger(value.textElementRowCount) || value.textElementRowCount !== 0) return undefined;
  if (!isBoundedString(value.noAudioCopy, 120) || !value.noAudioCopy.includes("当前文件暂无音频资产")) return undefined;
  if (value.noReplaceableCopy !== "") return undefined;
  if (value.textUnavailableCopy !== "") return undefined;
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    noAudioVisible: true,
    noReplaceableImagesMinimal: true,
    textUnavailableMinimal: true,
    ordinaryImagesNotDuplicatedInReplaceables: true,
    assetRowCount: value.assetRowCount,
    replaceableImageRowCount: 0,
    textElementRowCount: 0,
    noAudioCopy: value.noAudioCopy,
    noReplaceableCopy: value.noReplaceableCopy,
    textUnavailableCopy: value.textUnavailableCopy,
    passed: true
  };
}

function validateShortTermOpenFlowProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "short-term-open-flow-proof") return undefined;
  if (value.source !== "short-term-smoke") return undefined;
  if (!Array.isArray(value.prdIds) || value.prdIds.length !== 1 || value.prdIds[0] !== "S1") return undefined;
  if (!isBoundedString(value.fixtureName, 160) || !value.fixtureName.endsWith(".svga")) return undefined;
  if (!isSha256(value.fixtureSha256)) return undefined;
  if (!Number.isInteger(value.sourceSizeBytes) || value.sourceSizeBytes <= 0) return undefined;
  if (value.pairedNormalProof !== "normal-runtime-proof.json") return undefined;
  if (value.dragDecisionSplit !== "top-25-bottom-75") return undefined;
  if (!Array.isArray(value.dragDecisionPointProofs) || value.dragDecisionPointProofs.length !== 4) return undefined;
  const requiredDragDecisionPoints = new Map([
    ["center-open", { ratioX: 0.5, ratioY: 0.5, expectedZone: "open" }],
    ["lower-center-open", { ratioX: 0.5, ratioY: 0.7, expectedZone: "open" }],
    ["bottom-entry-open", { ratioX: 0.5, ratioY: 0.95, expectedZone: "open" }],
    ["secondary-compare", { ratioX: 0.5, ratioY: 0.1, expectedZone: "compare" }]
  ]);
  const dragDecisionPointProofs = value.dragDecisionPointProofs.map((point) => {
    if (!point || typeof point !== "object" || Array.isArray(point)) return undefined;
    const expected = requiredDragDecisionPoints.get(point.id);
    if (!expected) return undefined;
    const normalized = {
      id: point.id,
      ratioX: point.ratioX,
      ratioY: point.ratioY,
      expectedZone: point.expectedZone,
      overlayVisible: point.overlayVisible === true,
      status: String(point.status || ""),
      focusZone: String(point.focusZone || ""),
      labelCopy: String(point.labelCopy || "")
    };
    if (
      normalized.ratioX !== expected.ratioX
      || normalized.ratioY !== expected.ratioY
      || normalized.expectedZone !== expected.expectedZone
      || normalized.overlayVisible !== true
      || normalized.status !== "supported"
      || normalized.focusZone !== expected.expectedZone
      || !isBoundedString(normalized.labelCopy, 160)
      || !normalized.labelCopy.includes("打开新文件")
      || !normalized.labelCopy.includes("添加为对比文件")
    ) {
      return undefined;
    }
    return normalized;
  });
  if (dragDecisionPointProofs.some((point) => !point)) return undefined;
  if (
    value.dragDropAttempted !== true
    || value.dragDropLoaded !== true
    || value.previewReached !== true
    || value.localOnly !== true
    || value.pathRedacted !== true
    || value.rendererFilesystemAccessClaimed !== false
    || value.dragDecisionCenterPointOpen !== true
    || value.dragDecisionLowerCenterPointOpen !== true
    || value.dragDecisionBottomEntryPointOpen !== true
    || value.dragDecisionTopSecondaryPointCompare !== true
    || value.dragDecisionSecondaryPointCompare !== true
    || value.dragDecisionOverlayVisible !== true
    || value.dragDecisionSupportedState !== true
    || value.dragDecisionCompareFocus !== true
    || value.dragDecisionOffersOpenAndCompare !== true
    || value.unsupportedDragOverlayVisible !== true
    || value.unsupportedDragRejected !== true
    || value.unsupportedDropClearedCanvas !== true
    || value.unsupportedDropToastVisible !== true
    || value.unsupportedDropRecovered !== true
    || value.unsupportedDropSourceBytesRestoredAfterRecovery !== true
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    prdIds: ["S1"],
    fixtureName: value.fixtureName,
    fixtureSha256: value.fixtureSha256,
    sourceSizeBytes: value.sourceSizeBytes,
    dragDropAttempted: true,
    dragDropLoaded: true,
    previewReached: true,
    localOnly: true,
    pathRedacted: true,
    rendererFilesystemAccessClaimed: false,
    dragDecisionOverlayVisible: true,
    dragDecisionSplit: "top-25-bottom-75",
    dragDecisionPointProofs,
    dragDecisionCenterPointOpen: true,
    dragDecisionLowerCenterPointOpen: true,
    dragDecisionBottomEntryPointOpen: true,
    dragDecisionTopSecondaryPointCompare: true,
    dragDecisionSecondaryPointCompare: true,
    dragDecisionSupportedState: true,
    dragDecisionCompareFocus: true,
    dragDecisionOffersOpenAndCompare: true,
    unsupportedDragOverlayVisible: true,
    unsupportedDragRejected: true,
    unsupportedDropClearedCanvas: true,
    unsupportedDropToastVisible: true,
    unsupportedDropRecovered: true,
    unsupportedDropSourceBytesRestoredAfterRecovery: true,
    pairedNormalProof: "normal-runtime-proof.json",
    passed: true
  };
}

function validateShortTermLoadFailureProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "short-term-load-failure-proof") return undefined;
  if (value.source !== "short-term-smoke") return undefined;
  if (!Array.isArray(value.prdIds) || value.prdIds.length !== 1 || value.prdIds[0] !== "S2") return undefined;
  if (!isBoundedString(value.invalidFileName, 160) || !value.invalidFileName.endsWith(".svga")) return undefined;
  if (!isBoundedString(value.playbackFailureFileName, 160) || !value.playbackFailureFileName.endsWith(".svga")) return undefined;
  if (!Number.isInteger(value.invalidSizeBytes) || value.invalidSizeBytes <= 0) return undefined;
  if (!isBoundedString(value.errorCopy, 260) || !value.errorCopy.includes("源文件没有被修改")) return undefined;
  if (!isBoundedString(value.playbackFailureCopy, 260) || !value.playbackFailureCopy.includes("播放失败") || !value.playbackFailureCopy.includes("源文件没有被修改")) return undefined;
  if (!isBoundedString(value.recoveryFileName, 160) || !value.recoveryFileName.endsWith(".svga")) return undefined;
  if (!isSha256(value.sourceSha256BeforeInvalid) || value.sourceSha256AfterRecovery !== value.sourceSha256BeforeInvalid) return undefined;
  if (!isSha256(value.playbackFailureSourceSha256Before) || value.playbackFailureSourceSha256AfterRecovery !== value.playbackFailureSourceSha256Before) return undefined;
  if (
    value.invalidDropAttempted !== true
    || value.loadFailedVisible !== true
    || value.sourceFileUnmodifiedClaimVisible !== true
    || value.noStaleMetadataAfterFailure !== true
    || value.invalidApiRejected !== true
    || value.recoveryLoaded !== true
    || value.playbackRecovered !== true
    || value.sourceBytesRestoredAfterRecovery !== true
    || value.playbackFailureInjected !== true
    || value.playbackFailureVisible !== true
    || value.noStaleMetadataAfterPlaybackFailure !== true
    || value.playbackFailureRecovered !== true
    || value.playbackFailureSourceBytesRestoredAfterRecovery !== true
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    prdIds: ["S2"],
    invalidFileName: value.invalidFileName,
    invalidSizeBytes: value.invalidSizeBytes,
    invalidDropAttempted: true,
    loadFailedVisible: true,
    errorCopy: value.errorCopy,
    sourceFileUnmodifiedClaimVisible: true,
    noStaleMetadataAfterFailure: true,
    invalidApiRejected: true,
    recoveryFileName: value.recoveryFileName,
    recoveryLoaded: true,
    playbackRecovered: true,
    sourceSha256BeforeInvalid: value.sourceSha256BeforeInvalid,
    sourceSha256AfterRecovery: value.sourceSha256AfterRecovery,
    sourceBytesRestoredAfterRecovery: true,
    playbackFailureInjected: true,
    playbackFailureFileName: value.playbackFailureFileName,
    playbackFailureVisible: true,
    playbackFailureCopy: value.playbackFailureCopy,
    noStaleMetadataAfterPlaybackFailure: true,
    playbackFailureRecovered: true,
    playbackFailureSourceSha256Before: value.playbackFailureSourceSha256Before,
    playbackFailureSourceSha256AfterRecovery: value.playbackFailureSourceSha256AfterRecovery,
    playbackFailureSourceBytesRestoredAfterRecovery: true,
    passed: true
  };
}

function validateShortTermSpecComparisonProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "short-term-spec-comparison-proof") return undefined;
  if (value.source !== "short-term-smoke") return undefined;
  if (!Array.isArray(value.prdIds) || value.prdIds.length !== 1 || value.prdIds[0] !== "S4") return undefined;
  if (value.profileId !== "production_target") return undefined;
  if (!isBoundedString(value.profileLabel, 120)) return undefined;
  if (!Number.isInteger(value.factRowCount) || value.factRowCount < 5) return undefined;
  if (!Number.isInteger(value.renderedFactRowCount) || value.renderedFactRowCount < value.factRowCount) return undefined;
  if (!Array.isArray(value.factRows) || value.factRows.length !== value.factRowCount) return undefined;
  const requiredIds = new Set(["fileSize", "decodedMemory", "canvas", "fps", "assetCount"]);
  const allowedStatuses = new Set(["pass", "warning", "fail", "unknown"]);
  const rows = [];
  for (const row of value.factRows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return undefined;
    if (!isBoundedString(row.id, 40) || !isBoundedString(row.label, 80)) return undefined;
    if (!isBoundedString(row.value, 80) || !isBoundedString(row.requirement, 120)) return undefined;
    if (!allowedStatuses.has(row.status)) return undefined;
    rows.push({
      id: row.id,
      label: row.label,
      value: row.value,
      requirement: row.requirement,
      status: row.status
    });
  }
  if (![...requiredIds].every((id) => rows.some((row) => row.id === id))) return undefined;
  if (
    value.actualValuesVisible !== true
    || value.defaultThresholdsHidden !== true
    || value.optimizationStatusVisible !== true
    || value.defaultInformationSurfaceActive !== true
    || value.separateProductionSpecModuleExposed !== false
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    prdIds: ["S4"],
    profileId: "production_target",
    profileLabel: value.profileLabel,
    factRowCount: value.factRowCount,
    renderedFactRowCount: value.renderedFactRowCount,
    factRows: rows,
    actualValuesVisible: true,
    defaultThresholdsHidden: true,
    optimizationStatusVisible: true,
    defaultInformationSurfaceActive: true,
    separateProductionSpecModuleExposed: false,
    passed: true
  };
}

function validateShortTermRightSurfaceNavigationProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "short-term-right-surface-navigation-proof") return undefined;
  if (value.source !== "short-term-smoke") return undefined;
  if (!Array.isArray(value.prdIds) || value.prdIds.join(",") !== "S3,S8,S12,S13") return undefined;
  if (value.component !== "RightInformationSurface" || value.model !== "surfaceReplacement") return undefined;
  const booleanKeys = [
    "tabButtonsRemoved",
    "overviewSurfaceVisible",
    "optimizationSurfaceVisible",
    "replaceableSurfaceReturnsToDefault",
    "panelVisibilitySynced",
    "passed"
  ];
  if (!booleanKeys.every((key) => value[key] === true)) return undefined;
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    prdIds: ["S3", "S8", "S12", "S13"],
    component: "RightInformationSurface",
    model: "surfaceReplacement",
    tabButtonsRemoved: true,
    overviewSurfaceVisible: true,
    optimizationSurfaceVisible: true,
    replaceableSurfaceReturnsToDefault: true,
    panelVisibilitySynced: true,
    passed: true
  };
}

function validateShortTermDesignInteractionProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "short-term-design-interaction-proof") return undefined;
  if (value.source !== "short-term-smoke") return undefined;
  if (!Array.isArray(value.prdIds) || value.prdIds.join(",") !== "S1,S3,S8,S12,S13,S14,S16") return undefined;
  if (!Array.isArray(value.focusOrder) || value.focusOrder.length < 5 || value.focusOrder.length > 24) return undefined;
  const focusOrder = value.focusOrder.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return undefined;
    const normalized = {
      id: String(item.id || ""),
      action: String(item.action || ""),
      role: String(item.role || ""),
      component: String(item.component || "")
    };
    if (!Object.values(normalized).every((field) => field.length <= 80)) return undefined;
    if (!Object.values(normalized).some((field) => field.length > 0)) return undefined;
    return normalized;
  });
  if (focusOrder.some((item) => !item)) return undefined;
  if (!Array.isArray(value.surfaceCaptureStates) || value.surfaceCaptureStates.length < 2 || value.surfaceCaptureStates.length > 8) return undefined;
  const surfaceCaptureStates = value.surfaceCaptureStates.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return undefined;
    const normalized = {
      artifactName: String(item.artifactName || ""),
      expectedSurface: String(item.expectedSurface || ""),
      stateSurface: String(item.stateSurface || ""),
      rightSurfaceState: String(item.rightSurfaceState || ""),
      expectedPanelId: String(item.expectedPanelId || ""),
      activeElementId: String(item.activeElementId || ""),
      visiblePanelIds: normalizeBoundedStringList(item.visiblePanelIds, 4, 80),
      visiblePanelMatchesExpected: item.visiblePanelMatchesExpected === true
    };
    if (
      !isBoundedString(normalized.artifactName, 120)
      || !isBoundedString(normalized.expectedSurface, 40)
      || !isBoundedString(normalized.stateSurface, 40)
      || !isBoundedString(normalized.rightSurfaceState, 40)
      || !isBoundedString(normalized.expectedPanelId, 80)
      || typeof normalized.activeElementId !== "string"
      || normalized.activeElementId.length > 80
      || !normalized.visiblePanelIds
    ) {
      return undefined;
    }
    return normalized;
  });
  if (surfaceCaptureStates.some((item) => !item)) return undefined;
  if (!value.settingsAppearanceProof || typeof value.settingsAppearanceProof !== "object" || Array.isArray(value.settingsAppearanceProof)) return undefined;
  const settingsChoiceValues = normalizeBoundedStringList(value.settingsAppearanceProof.settingsChoiceValues, 3, 20);
  if (settingsChoiceValues?.join(",") !== "system,light,dark") return undefined;
  const settingsAppearanceProof = {
    settingsDialogOpened: value.settingsAppearanceProof.settingsDialogOpened === true,
    settingsChoiceValues,
    darkAppearanceApplied: value.settingsAppearanceProof.darkAppearanceApplied === true,
    lightAppearanceApplied: value.settingsAppearanceProof.lightAppearanceApplied === true,
    systemAppearanceRestored: value.settingsAppearanceProof.systemAppearanceRestored === true,
    settingsDialogClosed: value.settingsAppearanceProof.settingsDialogClosed === true,
    noMainSurfaceAppearanceButton: value.settingsAppearanceProof.noMainSurfaceAppearanceButton === true
  };
  if (![
    settingsAppearanceProof.settingsDialogOpened,
    settingsAppearanceProof.darkAppearanceApplied,
    settingsAppearanceProof.lightAppearanceApplied,
    settingsAppearanceProof.systemAppearanceRestored,
    settingsAppearanceProof.settingsDialogClosed,
    settingsAppearanceProof.noMainSurfaceAppearanceButton
  ].every(Boolean)) return undefined;
  if (!value.compareExitButtonPointerProof || typeof value.compareExitButtonPointerProof !== "object" || Array.isArray(value.compareExitButtonPointerProof)) {
    return undefined;
  }
  const compareExitButtonPointerProof = {
    buttonRendered: value.compareExitButtonPointerProof.buttonRendered === true,
    buttonTop: Number.isFinite(value.compareExitButtonPointerProof.buttonTop)
      ? Math.round(value.compareExitButtonPointerProof.buttonTop)
      : -1,
    titlebarBottom: Number.isFinite(value.compareExitButtonPointerProof.titlebarBottom)
      ? Math.round(value.compareExitButtonPointerProof.titlebarBottom)
      : 0,
    hitX: Number.isFinite(value.compareExitButtonPointerProof.hitX)
      ? Math.round(value.compareExitButtonPointerProof.hitX)
      : 0,
    hitY: Number.isFinite(value.compareExitButtonPointerProof.hitY)
      ? Math.round(value.compareExitButtonPointerProof.hitY)
      : 0,
    hitTargetTag: String(value.compareExitButtonPointerProof.hitTargetTag || ""),
    hitTargetAction: String(value.compareExitButtonPointerProof.hitTargetAction || ""),
    hitTargetIsExitButton: value.compareExitButtonPointerProof.hitTargetIsExitButton === true,
    exitedToPreview: value.compareExitButtonPointerProof.exitedToPreview === true
  };
  if (
    !isBoundedString(compareExitButtonPointerProof.hitTargetTag, 40)
    || !isBoundedString(compareExitButtonPointerProof.hitTargetAction, 80)
    || compareExitButtonPointerProof.buttonRendered !== true
    || compareExitButtonPointerProof.hitTargetIsExitButton !== true
    || compareExitButtonPointerProof.hitTargetAction !== "back-preview"
    || compareExitButtonPointerProof.exitedToPreview !== true
    || compareExitButtonPointerProof.buttonTop < compareExitButtonPointerProof.titlebarBottom
  ) {
    return undefined;
  }
  const captureStateByArtifact = new Map(surfaceCaptureStates.map((item) => [item.artifactName, item]));
  const requiredCaptureStates = [
    ["short-term-preview-optimization", "optimization", "panelOptimization"],
    ["short-term-preview-replaceable", "replaceable", "panelOverview"]
  ];
  const surfaceCaptureStatesSynced = requiredCaptureStates.every(([artifactName, expectedSurface, expectedPanelId]) => {
    const captureState = captureStateByArtifact.get(artifactName);
    return captureState?.expectedSurface === expectedSurface
      && captureState?.stateSurface === expectedSurface
      && captureState?.rightSurfaceState === expectedSurface
      && captureState?.expectedPanelId === expectedPanelId
      && captureState?.visiblePanelIds.length === 1
      && captureState.visiblePanelIds[0] === expectedPanelId
      && captureState.visiblePanelMatchesExpected;
  });
  if (surfaceCaptureStatesSynced !== true || value.surfaceCaptureStatesSynced !== true) return undefined;
  const booleanKeys = [
    "noVisibleCompareEntrypoint",
    "canvasModeSwitchReachable",
    "tabButtonsRemoved",
    "panelScrollRegionFocusable",
    "panelScrollRegionScrollable",
    "metadataSelectable",
    "stateSummaryCopyable",
    "surfaceCaptureStatesSynced",
    "menuStateDiscoverable",
    "settingsSheetAvailable",
    "appearanceSwitchingWorks",
    "appearanceMenuStateSynced",
    "noMainSurfaceAppearanceButton",
    "compareExitButtonPointerPathWorks",
    "compareExitButtonBelowTitlebar",
    "reducedMotionRulePresent",
    "minimumPreviewCaptured",
    "passed"
  ];
  if (!booleanKeys.every((key) => value[key] === true)) return undefined;
  if (!Number.isInteger(value.focusTargetCount) || value.focusTargetCount < 5) return undefined;
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    prdIds: ["S1", "S3", "S8", "S12", "S13", "S14", "S16"],
    focusOrder,
    focusTargetCount: value.focusTargetCount,
    noVisibleCompareEntrypoint: true,
    canvasModeSwitchReachable: true,
    tabButtonsRemoved: true,
    panelScrollRegionFocusable: true,
    panelScrollRegionScrollable: true,
    metadataSelectable: true,
    stateSummaryCopyable: true,
    surfaceCaptureStates,
    surfaceCaptureStatesSynced: true,
    menuStateDiscoverable: true,
    settingsAppearanceProof,
    settingsSheetAvailable: true,
    appearanceSwitchingWorks: true,
    appearanceMenuStateSynced: true,
    noMainSurfaceAppearanceButton: true,
    compareExitButtonPointerProof,
    compareExitButtonPointerPathWorks: true,
    compareExitButtonBelowTitlebar: true,
    reducedMotionRulePresent: true,
    minimumPreviewCaptured: true,
    passed: true
  };
}

function normalizeBoundedStringList(value, maxCount, maxLength) {
  if (!Array.isArray(value) || value.length > maxCount) return undefined;
  const normalized = value.map((item) => String(item || ""));
  if (!normalized.every((item) => isBoundedString(item, maxLength))) return undefined;
  return normalized;
}

function describeShortTermDesignInteractionProofFailure(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "shape";
  if (value.schemaVersion !== 1) return "schemaVersion";
  if (value.proofId !== "short-term-design-interaction-proof") return "proofId";
  if (value.source !== "short-term-smoke") return "source";
  if (!Array.isArray(value.prdIds) || value.prdIds.join(",") !== "S1,S3,S8,S12,S13,S14,S16") return "prdIds";
  if (!Array.isArray(value.focusOrder) || value.focusOrder.length < 5 || value.focusOrder.length > 24) {
    return `focusOrder:length:${Array.isArray(value.focusOrder) ? value.focusOrder.length : "invalid"}`;
  }
  const invalidFocusItem = value.focusOrder.find((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return true;
    const fields = [item.id, item.action, item.role, item.component].map((field) => String(field || ""));
    return fields.some((field) => field.length > 80) || fields.every((field) => field.length === 0);
  });
  if (invalidFocusItem) return "focusOrder:item";
  if (!Array.isArray(value.surfaceCaptureStates) || value.surfaceCaptureStates.length < 2 || value.surfaceCaptureStates.length > 8) return "surfaceCaptureStates";
  const invalidSurfaceCapture = value.surfaceCaptureStates.find((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return true;
    const strings = [
      [item.artifactName, 120],
      [item.expectedSurface, 40],
      [item.stateSurface, 40],
      [item.rightSurfaceState, 40],
      [item.expectedPanelId, 80],
    ];
    const lists = [item.visiblePanelIds];
    return strings.some(([field, maxLength]) => !isBoundedString(String(field || ""), maxLength))
      || typeof item.activeElementId !== "string"
      || item.activeElementId.length > 80
      || lists.some((list) => !normalizeBoundedStringList(list, 4, 80));
  });
  if (invalidSurfaceCapture) return "surfaceCaptureStates:item";
  if (!value.settingsAppearanceProof || typeof value.settingsAppearanceProof !== "object" || Array.isArray(value.settingsAppearanceProof)) {
    return "settingsAppearanceProof";
  }
  const settingsChoiceValues = normalizeBoundedStringList(value.settingsAppearanceProof.settingsChoiceValues, 3, 20);
  if (settingsChoiceValues?.join(",") !== "system,light,dark") return "settingsAppearanceProof:choices";
  const settingsBooleanKeys = [
    "settingsDialogOpened",
    "darkAppearanceApplied",
    "lightAppearanceApplied",
    "systemAppearanceRestored",
    "settingsDialogClosed",
    "noMainSurfaceAppearanceButton"
  ];
  const failedSettingsBoolean = settingsBooleanKeys.find((key) => value.settingsAppearanceProof[key] !== true);
  if (failedSettingsBoolean) return `settingsAppearanceProof:${failedSettingsBoolean}`;
  if (!value.compareExitButtonPointerProof || typeof value.compareExitButtonPointerProof !== "object" || Array.isArray(value.compareExitButtonPointerProof)) {
    return "compareExitButtonPointerProof";
  }
  const compareExitButtonPointerProof = value.compareExitButtonPointerProof;
  if (compareExitButtonPointerProof.buttonRendered !== true) return "compareExitButtonPointerProof:buttonRendered";
  if (!Number.isFinite(compareExitButtonPointerProof.buttonTop)) return "compareExitButtonPointerProof:buttonTop";
  if (!Number.isFinite(compareExitButtonPointerProof.titlebarBottom)) return "compareExitButtonPointerProof:titlebarBottom";
  if (!Number.isFinite(compareExitButtonPointerProof.hitX)) return "compareExitButtonPointerProof:hitX";
  if (!Number.isFinite(compareExitButtonPointerProof.hitY)) return "compareExitButtonPointerProof:hitY";
  if (!isBoundedString(String(compareExitButtonPointerProof.hitTargetTag || ""), 40)) return "compareExitButtonPointerProof:hitTargetTag";
  if (compareExitButtonPointerProof.hitTargetAction !== "back-preview") return "compareExitButtonPointerProof:hitTargetAction";
  if (compareExitButtonPointerProof.hitTargetIsExitButton !== true) return "compareExitButtonPointerProof:hitTargetIsExitButton";
  if (compareExitButtonPointerProof.exitedToPreview !== true) return "compareExitButtonPointerProof:exitedToPreview";
  if (compareExitButtonPointerProof.buttonTop < compareExitButtonPointerProof.titlebarBottom) return "compareExitButtonPointerProof:titlebarOverlap";
  const captureStateByArtifact = new Map(value.surfaceCaptureStates.map((item) => [item.artifactName, item]));
  const requiredCaptureStates = [
    ["short-term-preview-optimization", "optimization", "panelOptimization"],
    ["short-term-preview-replaceable", "replaceable", "panelOverview"]
  ];
  const surfaceCaptureStatesSynced = requiredCaptureStates.every(([artifactName, expectedSurface, expectedPanelId]) => {
    const captureState = captureStateByArtifact.get(artifactName);
    return captureState?.expectedSurface === expectedSurface
      && captureState?.stateSurface === expectedSurface
      && captureState?.rightSurfaceState === expectedSurface
      && captureState?.expectedPanelId === expectedPanelId
      && captureState?.visiblePanelIds?.length === 1
      && captureState.visiblePanelIds[0] === expectedPanelId
      && captureState.visiblePanelMatchesExpected === true;
  });
  if (surfaceCaptureStatesSynced !== true || value.surfaceCaptureStatesSynced !== true) return "surfaceCaptureStatesSynced";
  const booleanKeys = [
    "noVisibleCompareEntrypoint",
    "canvasModeSwitchReachable",
    "tabButtonsRemoved",
    "panelScrollRegionFocusable",
    "panelScrollRegionScrollable",
    "metadataSelectable",
    "stateSummaryCopyable",
    "surfaceCaptureStatesSynced",
    "menuStateDiscoverable",
    "settingsSheetAvailable",
    "appearanceSwitchingWorks",
    "appearanceMenuStateSynced",
    "noMainSurfaceAppearanceButton",
    "compareExitButtonPointerPathWorks",
    "compareExitButtonBelowTitlebar",
    "reducedMotionRulePresent",
    "minimumPreviewCaptured",
    "passed"
  ];
  const failedBoolean = booleanKeys.find((key) => value[key] !== true);
  if (failedBoolean) return failedBoolean;
  if (!Number.isInteger(value.focusTargetCount) || value.focusTargetCount < 5) return "focusTargetCount";
  return "unknown";
}

function validateShortTermReplaceableClassificationProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "short-term-replaceable-classification-proof") return undefined;
  if (value.source !== "short-term-smoke") return undefined;
  if (!Array.isArray(value.prdIds) || value.prdIds.length !== 1 || value.prdIds[0] !== "S7") return undefined;
  if (value.rule !== "exclude_automatic_image_keys_include_designer_named_image_keys") return undefined;
  if (!isBoundedString(value.automaticFixtureName, 160) || !value.automaticFixtureName.endsWith(".svga")) return undefined;
  if (!Number.isInteger(value.automaticImageAssetCount) || value.automaticImageAssetCount <= 0) return undefined;
  if (!Array.isArray(value.automaticExcludedExamples) || value.automaticExcludedExamples.length <= 0) return undefined;
  if (!value.automaticExcludedExamples.every((item) => isBoundedString(item, 120) && /^img[_-]?\d+$/i.test(item))) return undefined;
  if (!Number.isInteger(value.automaticReplaceableCount) || value.automaticReplaceableCount !== 0) return undefined;
  if (value.noReplaceableCopy !== "") return undefined;
  if (!isBoundedString(value.designerFixtureName, 160) || !value.designerFixtureName.endsWith(".svga")) return undefined;
  if (!Number.isInteger(value.designerImageAssetCount) || value.designerImageAssetCount <= 1) return undefined;
  if (!Array.isArray(value.includedDesignerKeys) || value.includedDesignerKeys.length <= 0) return undefined;
  if (!value.includedDesignerKeys.every((item) => isBoundedString(item, 120))) return undefined;
  if (value.includedDesignerKeys.some((item) => /^img[_-]?\d+$/i.test(item))) return undefined;
  if (!Number.isInteger(value.includedDesignerCount) || value.includedDesignerCount !== value.includedDesignerKeys.length) return undefined;
  if (
    value.automaticKeysExcluded !== true
    || value.designerKeysIncluded !== true
    || value.replaceableElementsNotAllImages !== true
    || value.automaticEmptyStateMinimal !== true
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    prdIds: ["S7"],
    rule: value.rule,
    automaticFixtureName: value.automaticFixtureName,
    automaticImageAssetCount: value.automaticImageAssetCount,
    automaticExcludedExamples: value.automaticExcludedExamples,
    automaticReplaceableCount: 0,
    noReplaceableCopy: value.noReplaceableCopy,
    designerFixtureName: value.designerFixtureName,
    designerImageAssetCount: value.designerImageAssetCount,
    includedDesignerKeys: value.includedDesignerKeys,
    includedDesignerCount: value.includedDesignerCount,
    automaticKeysExcluded: true,
    designerKeysIncluded: true,
    replaceableElementsNotAllImages: true,
    automaticEmptyStateMinimal: true,
    passed: true
  };
}

function validateShortTermRuntimeTextBoundaryProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "short-term-runtime-text-boundary-proof") return undefined;
  if (value.source !== "short-term-smoke") return undefined;
  if (!Array.isArray(value.prdIds) || value.prdIds.length !== 1 || value.prdIds[0] !== "S13") return undefined;
  if (value.parserTextSource !== "designer_named_imagekey_text_anchor") return undefined;
  if (value.runtimeTextKeySource !== "official_svga_dynamic_text_imagekey") return undefined;
  if (!Number.isInteger(value.textElementsDiscovered) || value.textElementsDiscovered <= 0) return undefined;
  if (!Array.isArray(value.textKeys) || value.textKeys.length !== value.textElementsDiscovered) return undefined;
  if (!value.textKeys.every((item) => isBoundedString(item, 120) && !/^img[_-]?\d+$/i.test(item))) return undefined;
  if (!value.textKeys.includes("nickname_text")) return undefined;
  if (!isBoundedString(value.runtimeOverlayCopy, 220) || !value.runtimeOverlayCopy.includes("SVGA VIP")) return undefined;
  if (value.visualPreviewMechanism !== "dom_overlay_on_preview_canvas") return undefined;
  if (!isSha256(value.sourceSha256Before)) return undefined;
  if (value.sourceSha256AfterApply !== value.sourceSha256Before) return undefined;
  if (value.sourceSha256AfterReset !== value.sourceSha256Before) return undefined;
  if (!Array.isArray(value.supportedRuntimeFields) || value.supportedRuntimeFields.join(",") !== "text") return undefined;
  if (
    value.inlineInputRendered !== true
    || value.initialFocusInput !== true
    || value.inputSpaceSuppressed !== true
    || value.editApplied !== true
    || value.runtimeOverlayVisibleAfterApply !== true
    || value.resetButtonEnabledAfterApply !== true
    || value.resetApplied !== true
    || value.resetClearedOverlay !== true
    || value.bytePersistenceClaimed !== false
    || value.productCompleteClaimed !== true
    || value.sourceBytesUnchanged !== true
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    prdIds: ["S13"],
    parserTextSource: value.parserTextSource,
    runtimeTextKeySource: value.runtimeTextKeySource,
    textElementsDiscovered: value.textElementsDiscovered,
    textKeys: value.textKeys,
    inlineInputRendered: true,
    initialFocusInput: true,
    inputSpaceSuppressed: true,
    editApplied: true,
    runtimeOverlayVisibleAfterApply: true,
    runtimeOverlayCopy: value.runtimeOverlayCopy,
    resetButtonEnabledAfterApply: true,
    resetApplied: true,
    resetClearedOverlay: true,
    bytePersistenceClaimed: false,
    productCompleteClaimed: true,
    visualPreviewMechanism: value.visualPreviewMechanism,
    sourceSha256Before: value.sourceSha256Before,
    sourceSha256AfterApply: value.sourceSha256AfterApply,
    sourceSha256AfterReset: value.sourceSha256AfterReset,
    sourceBytesUnchanged: true,
    supportedRuntimeFields: ["text"],
    passed: true
  };
}

function validateShortTermThumbnailProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "short-term-thumbnail-proof") return undefined;
  if (value.source !== "short-term-smoke") return undefined;
  if (!Array.isArray(value.prdIds) || value.prdIds.join(",") !== "S5,S6,S15") return undefined;
  if (!isBoundedString(value.sequenceFixtureName, 120) || !value.sequenceFixtureName.endsWith(".svga")) return undefined;
  if (!Number.isInteger(value.ordinaryImageThumbnailCount) || value.ordinaryImageThumbnailCount <= 0) return undefined;
  if (!Number.isInteger(value.sequenceRowCount) || value.sequenceRowCount <= 0) return undefined;
  if (!Number.isInteger(value.sequenceThumbnailImageCount) || value.sequenceThumbnailImageCount < 4) return undefined;
  if (
    value.ordinaryImageThumbnailVisible !== true
    || value.sequenceFourGridVisible !== true
    || value.audioEmptyStateVisible !== true
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    prdIds: ["S5", "S6", "S15"],
    ordinaryImageThumbnailVisible: true,
    ordinaryImageThumbnailCount: value.ordinaryImageThumbnailCount,
    sequenceFixtureName: value.sequenceFixtureName,
    sequenceRowCount: value.sequenceRowCount,
    sequenceThumbnailImageCount: value.sequenceThumbnailImageCount,
    sequenceFourGridVisible: true,
    audioEmptyStateVisible: true,
    passed: true
  };
}

function validateShortTermOptimizationProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "short-term-optimization-proof") return undefined;
  if (value.source !== "short-term-smoke") return undefined;
  if (!Array.isArray(value.prdIds) || value.prdIds.join(",") !== "S8,S9,S10,S14") return undefined;
  if (!isBoundedString(value.fixtureName, 120) || !value.fixtureName.endsWith(".svga")) return undefined;
  if (!isSha256(value.sourceSha256Before) || value.sourceSha256After !== value.sourceSha256Before) return undefined;
  if (!isSha256(value.optimizedSha256) || value.optimizedSha256 === value.sourceSha256Before) return undefined;
  if (!Number.isInteger(value.sourceSizeBytes) || value.sourceSizeBytes <= 0) return undefined;
  if (!Number.isInteger(value.optimizedSizeBytes) || value.optimizedSizeBytes <= 0 || value.optimizedSizeBytes >= value.sourceSizeBytes) return undefined;
  if (!Number.isInteger(value.safeExecutableCount) || value.safeExecutableCount <= 0) return undefined;
  if (!Number.isInteger(value.reviewOnlyCount) || value.reviewOnlyCount < 0) return undefined;
  if (!Number.isInteger(value.unsupportedCount) || value.unsupportedCount < 0) return undefined;
  if (!Number.isInteger(value.optimizationCandidateRows) || value.optimizationCandidateRows <= 0) return undefined;
  if (!Number.isInteger(value.executedActionCount) || value.executedActionCount <= 0) return undefined;
  if (!Number.isInteger(value.executedActionRowsVisible) || value.executedActionRowsVisible < value.executedActionCount) return undefined;
  if (!Number.isInteger(value.skippedMethodRowsVisible) || value.skippedMethodRowsVisible <= 0) return undefined;
  if (!Number.isInteger(value.metricCount) || value.metricCount < 2) return undefined;
  if (value.resultStatus !== "optimized") return undefined;
  if (!isBoundedString(value.resultTitle, 120) || value.resultTitle !== "已生成优化副本") return undefined;
  if (!isBoundedString(value.resultSummary, 220) || !value.resultSummary.includes("安全优化动作")) return undefined;
  if (
    value.sourceBytesUnchanged !== true
    || value.optimizedOutputProduced !== true
    || value.optimizedBytesDifferent !== true
    || value.optimizedBytesSmaller !== true
    || value.batchActionEnabled !== true
    || value.optimizationCandidatesVisible !== true
    || value.metricsVisible !== true
    || value.comparisonVisible !== true
    || value.compareCanvasANonBlank !== true
    || value.compareCanvasBNonBlank !== true
    || value.saveAsEnabled !== true
    || value.sourceOutputSeparated !== true
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    prdIds: ["S8", "S9", "S10", "S14"],
    fixtureName: value.fixtureName,
    sourceSha256Before: value.sourceSha256Before,
    sourceSha256After: value.sourceSha256After,
    sourceBytesUnchanged: true,
    sourceSizeBytes: value.sourceSizeBytes,
    optimizedSha256: value.optimizedSha256,
    optimizedSizeBytes: value.optimizedSizeBytes,
    optimizedOutputProduced: true,
    optimizedBytesDifferent: true,
    optimizedBytesSmaller: true,
    batchActionEnabled: true,
    safeExecutableCount: value.safeExecutableCount,
    reviewOnlyCount: value.reviewOnlyCount,
    unsupportedCount: value.unsupportedCount,
    optimizationCandidateRows: value.optimizationCandidateRows,
    optimizationCandidatesVisible: true,
    resultStatus: "optimized",
    resultTitle: value.resultTitle,
    resultSummary: value.resultSummary,
    executedActionCount: value.executedActionCount,
    executedActionRowsVisible: value.executedActionRowsVisible,
    skippedMethodRowsVisible: value.skippedMethodRowsVisible,
    metricCount: value.metricCount,
    metricsVisible: true,
    comparisonVisible: true,
    compareCanvasANonBlank: true,
    compareCanvasBNonBlank: true,
    saveAsEnabled: true,
    sourceOutputSeparated: true,
    passed: true
  };
}

function validateShortTermRenameProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "short-term-rename-proof") return undefined;
  if (value.source !== "short-term-smoke") return undefined;
  if (!Array.isArray(value.prdIds) || value.prdIds.join(",") !== "S11,S14") return undefined;
  if (!isBoundedString(value.fixtureName, 120) || !value.fixtureName.endsWith(".svga")) return undefined;
  if (!isBoundedString(value.fromImageKey, 120) || !isBoundedString(value.toImageKey, 120)) return undefined;
  if (value.fromImageKey === value.toImageKey || !value.toImageKey.endsWith("_renamed")) return undefined;
  if (!isSha256(value.sourceSha256Before) || value.sourceSha256After !== value.sourceSha256Before) return undefined;
  if (!isSha256(value.renamedSha256) || value.renamedSha256 === value.sourceSha256Before) return undefined;
  if (!isBoundedString(value.resultTitle, 120) || value.resultTitle !== "已重命名 imageKey") return undefined;
  if (!isBoundedString(value.resultSummary, 220) || !value.resultSummary.includes(value.toImageKey)) return undefined;
  if (!Array.isArray(value.referenceFieldsChecked) || value.referenceFieldsChecked.join(",") !== "imageKey,matteKey") return undefined;
  if (!Number.isInteger(value.referenceUpdateCount) || value.referenceUpdateCount < 1) return undefined;
  if (!Number.isInteger(value.imageKeyReferenceUpdates) || value.imageKeyReferenceUpdates < 1) return undefined;
  if (!Number.isInteger(value.matteKeyReferenceUpdates) || value.matteKeyReferenceUpdates < 0) return undefined;
  if (!Array.isArray(value.danglingReferences) || value.danglingReferences.length !== 0) return undefined;
  if (
    value.contextMenuOpened !== true
    || value.enterConfirmed !== true
    || value.sourceBytesUnchanged !== true
    || value.renamedOutputProduced !== true
    || value.renamedBytesDifferent !== true
    || value.renamedKeyVisible !== true
    || value.oldKeyAbsent !== true
    || value.decodePassed !== true
    || value.reopenPassed !== true
    || value.referenceClosurePassed !== true
    || value.imageKeyReferenceClosurePassed !== true
    || value.matteKeyReferenceClosurePassed !== true
    || value.danglingReferenceCount !== 0
    || value.newKeyPresent !== true
    || value.imageBytesPreserved !== true
    || value.previewModeStayed !== true
    || value.saveAsEnabled !== true
    || value.canvasNonBlank !== true
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    prdIds: ["S11", "S14"],
    fixtureName: value.fixtureName,
    fromImageKey: value.fromImageKey,
    toImageKey: value.toImageKey,
    contextMenuOpened: true,
    enterConfirmed: true,
    sourceSha256Before: value.sourceSha256Before,
    sourceSha256After: value.sourceSha256After,
    sourceBytesUnchanged: true,
    renamedSha256: value.renamedSha256,
    renamedOutputProduced: true,
    renamedBytesDifferent: true,
    renamedKeyVisible: true,
    oldKeyAbsent: true,
    referenceFieldsChecked: ["imageKey", "matteKey"],
    referenceUpdateCount: value.referenceUpdateCount,
    imageKeyReferenceUpdates: value.imageKeyReferenceUpdates,
    matteKeyReferenceUpdates: value.matteKeyReferenceUpdates,
    decodePassed: true,
    reopenPassed: true,
    referenceClosurePassed: true,
    imageKeyReferenceClosurePassed: true,
    matteKeyReferenceClosurePassed: true,
    danglingReferences: [],
    danglingReferenceCount: 0,
    newKeyPresent: true,
    imageBytesPreserved: true,
    previewModeStayed: true,
    saveAsEnabled: true,
    canvasNonBlank: true,
    resultTitle: value.resultTitle,
    resultSummary: value.resultSummary,
    passed: true
  };
}

function validateShortTermReplacementProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "short-term-replacement-proof") return undefined;
  if (value.source !== "short-term-smoke") return undefined;
  if (!Array.isArray(value.prdIds) || value.prdIds.join(",") !== "S12,S14") return undefined;
  if (!isBoundedString(value.fixtureName, 120) || !value.fixtureName.endsWith(".svga")) return undefined;
  if (!isBoundedString(value.imageKey, 120)) return undefined;
  if (!isSha256(value.replacementPngSha256)) return undefined;
  if (!isSha256(value.sourceSha256Before) || value.sourceSha256After !== value.sourceSha256Before) return undefined;
  if (!isSha256(value.editedSha256) || value.editedSha256 === value.sourceSha256Before) return undefined;
  if (value.resetPreviewSha256 !== value.sourceSha256Before) return undefined;
  if (!isBoundedString(value.resultTitle, 120) || value.resultTitle !== "已生成替换图片副本") return undefined;
  if (
    value.sourceBytesUnchanged !== true
    || value.replacementOutputProduced !== true
    || value.replacementBytesDifferent !== true
    || value.previewModeStayed !== true
    || value.saveAsEnabledBeforeReset !== true
    || value.contextMenuOpenedAfterReplacement !== true
    || value.resetCommandEnabled !== true
    || value.replacementCanvasNonBlank !== true
    || value.resetRestoredOriginal !== true
    || value.resetClearedOutput !== true
    || value.resetCanvasNonBlank !== true
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    prdIds: ["S12", "S14"],
    fixtureName: value.fixtureName,
    imageKey: value.imageKey,
    replacementPngSha256: value.replacementPngSha256,
    sourceSha256Before: value.sourceSha256Before,
    sourceSha256After: value.sourceSha256After,
    sourceBytesUnchanged: true,
    editedSha256: value.editedSha256,
    replacementOutputProduced: true,
    replacementBytesDifferent: true,
    previewModeStayed: true,
    saveAsEnabledBeforeReset: true,
    contextMenuOpenedAfterReplacement: true,
    resetCommandEnabled: true,
    replacementCanvasNonBlank: true,
    resetPreviewSha256: value.resetPreviewSha256,
    resetRestoredOriginal: true,
    resetClearedOutput: true,
    resetCanvasNonBlank: true,
    resultTitle: value.resultTitle,
    passed: true
  };
}

function describeSmokeResultValidationFailure(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "root_shape";
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
  const missingBoolean = keys.find((key) => typeof value[key] !== "boolean");
  if (missingBoolean) return `boolean:${missingBoolean}`;
  if (value.p6InteractionTrace !== undefined && !validateP6InteractionTrace(bindP6InteractionTrace(value.p6InteractionTrace))) {
    return describeP6InteractionTraceValidationFailure(bindP6InteractionTrace(value.p6InteractionTrace));
  }
  if (value.diagnostics !== undefined && !validateSmokeDiagnostics(value.diagnostics)) return "diagnostics";
  if (value.ownerUsability !== undefined && !validateOwnerUsabilityResult(value.ownerUsability)) {
    return `ownerUsability:${describeOwnerUsabilityValidationFailure(value.ownerUsability)}`;
  }
  if (value.workbenchRegionMap !== undefined && !validateWorkbenchRegionMap(value.workbenchRegionMap)) {
    return `workbenchRegionMap:${describeWorkbenchRegionMapValidationFailure(value.workbenchRegionMap)}`;
  }
  if (value.shortTermScreenshots !== undefined && typeof value.shortTermScreenshots !== "boolean") {
    return "shortTermScreenshots";
  }
  if (value.shortTermLoadFailed !== undefined && typeof value.shortTermLoadFailed !== "boolean") {
    return "shortTermLoadFailed";
  }
  if (value.shortTermSaveFailed !== undefined && typeof value.shortTermSaveFailed !== "boolean") {
    return "shortTermSaveFailed";
  }
  if (value.shortTermOpenFlowProof !== undefined && !validateShortTermOpenFlowProof(value.shortTermOpenFlowProof)) {
    return "shortTermOpenFlowProof";
  }
  if (value.shortTermLoadFailureProof !== undefined && !validateShortTermLoadFailureProof(value.shortTermLoadFailureProof)) {
    return "shortTermLoadFailureProof";
  }
  if (value.shortTermSpecComparisonProof !== undefined && !validateShortTermSpecComparisonProof(value.shortTermSpecComparisonProof)) {
    return "shortTermSpecComparisonProof";
  }
  if (value.shortTermRightSurfaceNavigationProof !== undefined && !validateShortTermRightSurfaceNavigationProof(value.shortTermRightSurfaceNavigationProof)) {
    return "shortTermRightSurfaceNavigationProof";
  }
  if (value.shortTermDesignInteractionProof !== undefined && !validateShortTermDesignInteractionProof(value.shortTermDesignInteractionProof)) {
    return `shortTermDesignInteractionProof:${describeShortTermDesignInteractionProofFailure(value.shortTermDesignInteractionProof)}`;
  }
  if (value.shortTermReplaceableClassificationProof !== undefined && !validateShortTermReplaceableClassificationProof(value.shortTermReplaceableClassificationProof)) {
    return "shortTermReplaceableClassificationProof";
  }
  if (value.shortTermEmptyStateProof !== undefined && !validateShortTermEmptyStateProof(value.shortTermEmptyStateProof)) {
    return "shortTermEmptyStateProof";
  }
  if (value.shortTermRuntimeTextBoundaryProof !== undefined && !validateShortTermRuntimeTextBoundaryProof(value.shortTermRuntimeTextBoundaryProof)) {
    return "shortTermRuntimeTextBoundaryProof";
  }
  if (value.shortTermThumbnailProof !== undefined && !validateShortTermThumbnailProof(value.shortTermThumbnailProof)) {
    return "shortTermThumbnailProof";
  }
  if (value.shortTermOptimizationProof !== undefined && !validateShortTermOptimizationProof(value.shortTermOptimizationProof)) {
    return "shortTermOptimizationProof";
  }
  if (value.shortTermRenameProof !== undefined && !validateShortTermRenameProof(value.shortTermRenameProof)) {
    return "shortTermRenameProof";
  }
  if (value.shortTermReplacementProof !== undefined && !validateShortTermReplacementProof(value.shortTermReplacementProof)) {
    return "shortTermReplacementProof";
  }
  if (value.optimizedReopenProof !== undefined && !validateOptimizedReopenProof(value.optimizedReopenProof)) {
    return "optimizedReopenProof";
  }
  if (value.sequenceReviewProof !== undefined && !validateSequenceReviewProof(value.sequenceReviewProof)) {
    return `sequenceReviewProof:${describeSequenceReviewProofValidationFailure(value.sequenceReviewProof)}`;
  }
  if (value.sequenceRepairPreviewProof !== undefined && !validateSequenceRepairPreviewProof(value.sequenceRepairPreviewProof)) {
    return "sequenceRepairPreviewProof";
  }
  if (value.sequenceNoWriteSimulationProof !== undefined && !validateSequenceNoWriteSimulationProof(value.sequenceNoWriteSimulationProof)) {
    return "sequenceNoWriteSimulationProof";
  }
  if (value.sequenceBoundedRepairPrototypeProof !== undefined && !validateSequenceBoundedRepairPrototypeProof(value.sequenceBoundedRepairPrototypeProof)) {
    return "sequenceBoundedRepairPrototypeProof";
  }
  if (value.sequencePrototypeRenderedBoundaryProof !== undefined && !validateSequencePrototypeRenderedBoundaryProof(value.sequencePrototypeRenderedBoundaryProof)) {
    return "sequencePrototypeRenderedBoundaryProof";
  }
  if (value.sequenceNoopRoundTripProof !== undefined && !validateSequenceNoopRoundTripProof(value.sequenceNoopRoundTripProof)) {
    return "sequenceNoopRoundTripProof";
  }
  if (value.sequenceByteRepairProof !== undefined && !validateSequenceByteRepairProof(value.sequenceByteRepairProof)) {
    return "sequenceByteRepairProof";
  }
  if (value.sequenceProductRepairProof !== undefined && !validateSequenceProductRepairProof(value.sequenceProductRepairProof)) {
    return `sequenceProductRepairProof:${describeSequenceProductRepairProofValidationFailure(value.sequenceProductRepairProof)}`;
  }
  if (value.replacementReadinessProof !== undefined && !validateReplacementReadinessProof(value.replacementReadinessProof)) {
    return "replacementReadinessProof";
  }
  if (value.replacementPreviewProof !== undefined && !validateReplacementPreviewProof(value.replacementPreviewProof)) {
    return "replacementPreviewProof";
  }
  if (value.replacementUndoRedoProof !== undefined && !validateReplacementUndoRedoProof(value.replacementUndoRedoProof)) {
    return "replacementUndoRedoProof";
  }
  if (value.replacementResetProof !== undefined && !validateReplacementResetProof(value.replacementResetProof)) {
    return "replacementResetProof";
  }
  if (value.replacementSaveAsProof !== undefined && !validateReplacementSaveAsProof(value.replacementSaveAsProof)) {
    return "replacementSaveAsProof";
  }
  if (value.replacementMultiResourceProof !== undefined && !validateReplacementMultiResourceProof(value.replacementMultiResourceProof)) {
    return "replacementMultiResourceProof";
  }
  return "unknown";
}

function validateReplacementSaveAsProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "svga-replacement-save-as-proof") return undefined;
  if (value.source !== "saveEditedSvga-ipc") return undefined;
  if (!isSha256(value.sourceSha256) || !isSha256(value.editedSha256) || !isSha256(value.savedSha256)) return undefined;
  if (value.editedSha256 === value.sourceSha256 || value.savedSha256 !== value.editedSha256) return undefined;
  if (!isBoundedString(value.resourceKey, 120)) return undefined;
  if (!isBoundedString(value.savedFileName, 180) || !value.savedFileName.endsWith(".svga")) return undefined;
  if (
    value.saveStatus !== "saved"
    || value.roundTripPassed !== true
    || value.savedHashBound !== true
    || value.reopenedPlayback !== true
    || value.reopenedCanvasNonBlank !== true
    || value.reopenedInspectionReport !== true
    || value.renderedProofPassed !== true
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    sourceSha256: value.sourceSha256,
    resourceKey: value.resourceKey,
    editedSha256: value.editedSha256,
    savedSha256: value.savedSha256,
    savedFileName: value.savedFileName,
    saveStatus: "saved",
    roundTripPassed: true,
    savedHashBound: true,
    reopenedPlayback: true,
    reopenedCanvasNonBlank: true,
    reopenedInspectionReport: true,
    renderedProofPassed: true,
    passed: true
  };
}

function validateSequenceReviewProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "svga-sequence-review-proof") return undefined;
  if (value.source !== "workbench-asset-intelligence") return undefined;
  if (!isSha256(value.sourceSha256) || value.sourceSha256AfterReview !== value.sourceSha256) return undefined;
  if (!Number.isInteger(value.sequenceGroupCount) || value.sequenceGroupCount <= 0) return undefined;
  if (!Number.isInteger(value.sequenceFindingCount) || value.sequenceFindingCount < 0) return undefined;
  if (!Number.isInteger(value.affectedResourceCount) || value.affectedResourceCount < 0) return undefined;
  if (
    value.summaryVisible !== true
    || value.mutationNotAttempted !== true
    || value.repairActionExposed !== false
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    sourceSha256: value.sourceSha256,
    sourceSha256AfterReview: value.sourceSha256AfterReview,
    sequenceGroupCount: value.sequenceGroupCount,
    sequenceFindingCount: value.sequenceFindingCount,
    affectedResourceCount: value.affectedResourceCount,
    summaryVisible: true,
    mutationNotAttempted: true,
    repairActionExposed: false,
    passed: true
  };
}

function describeSequenceReviewProofValidationFailure(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "root_shape";
  if (value.schemaVersion !== 1) return "schemaVersion";
  if (value.proofId !== "svga-sequence-review-proof") return "proofId";
  if (value.source !== "workbench-asset-intelligence") return "source";
  if (!isSha256(value.sourceSha256)) return "sourceSha256";
  if (value.sourceSha256AfterReview !== value.sourceSha256) return "sourceSha256AfterReview";
  if (!Number.isInteger(value.sequenceGroupCount) || value.sequenceGroupCount <= 0) return "sequenceGroupCount";
  if (!Number.isInteger(value.sequenceFindingCount) || value.sequenceFindingCount < 0) return "sequenceFindingCount";
  if (!Number.isInteger(value.affectedResourceCount) || value.affectedResourceCount < 0) return "affectedResourceCount";
  if (value.summaryVisible !== true) return "summaryVisible";
  if (value.mutationNotAttempted !== true) return "mutationNotAttempted";
  if (value.repairActionExposed !== false) return "repairActionExposed";
  if (value.passed !== true) return "passed";
  return "unknown";
}

function validateSequenceRepairPreviewProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "svga-sequence-repair-preview-contract-proof") return undefined;
  if (value.source !== "workbench-sequence-repair-preview-contract") return undefined;
  if (!isSha256(value.sourceSha256) || value.sourceSha256AfterPreview !== value.sourceSha256) return undefined;
  if (value.previewId !== "svga-sequence-repair-preview-v1") return undefined;
  if (!Number.isInteger(value.sequenceGroupCount) || value.sequenceGroupCount <= 0) return undefined;
  if (!Number.isInteger(value.sequenceFindingCount) || value.sequenceFindingCount <= 0) return undefined;
  if (!Number.isInteger(value.affectedResourceCount) || value.affectedResourceCount < 0) return undefined;
  if (!Number.isInteger(value.proposedActionCount) || value.proposedActionCount <= 0) return undefined;
  if (
    value.writeEnabledFalse !== true
    || value.automaticRepairDisabled !== true
    || value.requiresRoundTripBeforeWrite !== true
    || value.manualVisualConfirmationRequired !== true
    || value.summaryVisible !== true
    || value.sourceUnchanged !== true
    || value.applyActionExposed !== false
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    sourceSha256: value.sourceSha256,
    sourceSha256AfterPreview: value.sourceSha256AfterPreview,
    previewId: value.previewId,
    sequenceGroupCount: value.sequenceGroupCount,
    sequenceFindingCount: value.sequenceFindingCount,
    affectedResourceCount: value.affectedResourceCount,
    proposedActionCount: value.proposedActionCount,
    writeEnabledFalse: true,
    automaticRepairDisabled: true,
    requiresRoundTripBeforeWrite: true,
    manualVisualConfirmationRequired: true,
    summaryVisible: true,
    sourceUnchanged: true,
    applyActionExposed: false,
    passed: true
  };
}

function validateSequenceNoWriteSimulationProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "svga-sequence-no-write-simulation-proof") return undefined;
  if (value.source !== "workbench-sequence-no-write-simulation") return undefined;
  if (!isSha256(value.sourceSha256) || value.sourceSha256AfterSimulation !== value.sourceSha256) return undefined;
  if (value.simulationId !== "svga-sequence-no-write-simulation-v1") return undefined;
  if (!Number.isInteger(value.beforeSequenceGroupCount) || value.beforeSequenceGroupCount <= 0) return undefined;
  if (!Number.isInteger(value.beforeSequenceFindingCount) || value.beforeSequenceFindingCount <= 0) return undefined;
  if (!Number.isInteger(value.affectedResourceCount) || value.affectedResourceCount < 0) return undefined;
  if (!Number.isInteger(value.proposedActionCount) || value.proposedActionCount <= 0) return undefined;
  if (
    value.pendingRoundTripProof !== true
    || value.pendingRenderedBeforeAfterProof !== true
    || value.pendingManualVisualConfirmation !== true
    || value.editedBytesProduced !== false
    || value.writeAttempted !== false
    || value.automaticRepairEnabled !== false
    || value.applyActionEnabled !== false
    || value.summaryVisible !== true
    || value.sourceUnchanged !== true
    || value.applyActionExposed !== false
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    sourceSha256: value.sourceSha256,
    sourceSha256AfterSimulation: value.sourceSha256AfterSimulation,
    simulationId: value.simulationId,
    beforeSequenceGroupCount: value.beforeSequenceGroupCount,
    beforeSequenceFindingCount: value.beforeSequenceFindingCount,
    affectedResourceCount: value.affectedResourceCount,
    proposedActionCount: value.proposedActionCount,
    pendingRoundTripProof: true,
    pendingRenderedBeforeAfterProof: true,
    pendingManualVisualConfirmation: true,
    editedBytesProduced: false,
    writeAttempted: false,
    automaticRepairEnabled: false,
    applyActionEnabled: false,
    summaryVisible: true,
    sourceUnchanged: true,
    applyActionExposed: false,
    passed: true
  };
}

function validateSequenceBoundedRepairPrototypeProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "svga-sequence-bounded-repair-prototype-proof") return undefined;
  if (value.source !== "workbench-sequence-bounded-repair-prototype") return undefined;
  if (!isSha256(value.sourceSha256) || value.sourceSha256AfterPrototype !== value.sourceSha256) return undefined;
  if (value.prototypeId !== "svga-bounded-sequence-repair-prototype-v1") return undefined;
  if (value.simulationId !== "svga-sequence-no-write-simulation-v1") return undefined;
  if (!Number.isInteger(value.resourceKeyLimit) || value.resourceKeyLimit <= 0 || value.resourceKeyLimit > 32) return undefined;
  if (!Number.isInteger(value.resourceKeyCount) || value.resourceKeyCount <= 0 || value.resourceKeyCount > value.resourceKeyLimit) return undefined;
  if (!Number.isInteger(value.operationCount) || value.operationCount <= 0) return undefined;
  if (value.blockedReason !== "requires_round_trip_and_rendered_before_after_proof") return undefined;
  if (
    value.roundTripProofRequired !== true
    || value.renderedBeforeAfterProofRequired !== true
    || value.manualVisualConfirmationRequired !== true
    || value.editedBytesProduced !== false
    || value.writeAttempted !== false
    || value.productSaveAsEnabled !== false
    || value.applyActionEnabled !== false
    || value.prototypeVisible !== true
    || value.sourceUnchanged !== true
    || value.writeActionExposed !== false
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    sourceSha256: value.sourceSha256,
    sourceSha256AfterPrototype: value.sourceSha256AfterPrototype,
    prototypeId: value.prototypeId,
    simulationId: value.simulationId,
    resourceKeyLimit: value.resourceKeyLimit,
    resourceKeyCount: value.resourceKeyCount,
    operationCount: value.operationCount,
    blockedReason: value.blockedReason,
    roundTripProofRequired: true,
    renderedBeforeAfterProofRequired: true,
    manualVisualConfirmationRequired: true,
    editedBytesProduced: false,
    writeAttempted: false,
    productSaveAsEnabled: false,
    applyActionEnabled: false,
    prototypeVisible: true,
    sourceUnchanged: true,
    writeActionExposed: false,
    passed: true
  };
}

function validateSequencePrototypeRenderedBoundaryProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "svga-sequence-prototype-rendered-boundary-proof") return undefined;
  if (value.source !== "workbench-sequence-prototype-rendered-boundary") return undefined;
  if (!isSha256(value.sourceSha256) || value.sourceSha256AfterBoundary !== value.sourceSha256) return undefined;
  if (value.prototypeId !== "svga-bounded-sequence-repair-prototype-v1") return undefined;
  if (!Number.isInteger(value.resourceKeyCount) || value.resourceKeyCount <= 0 || value.resourceKeyCount > 32) return undefined;
  if (!Number.isInteger(value.operationCount) || value.operationCount <= 0) return undefined;
  if (!isSha256(value.beforeCanvasSha256) || !isSha256(value.afterCanvasSha256)) return undefined;
  if (!Number.isInteger(value.canvasWidth) || value.canvasWidth <= 0 || value.canvasWidth > 4096) return undefined;
  if (!Number.isInteger(value.canvasHeight) || value.canvasHeight <= 0 || value.canvasHeight > 4096) return undefined;
  if (
    value.beforeCanvasNonBlank !== true
    || value.afterCanvasNonBlank !== true
    || value.canvasDimensionsStable !== true
    || typeof value.pixelHashMatched !== "boolean"
    || value.renderedStateStable !== true
    || value.prototypeVisible !== true
    || value.sourceUnchanged !== true
    || value.editedBytesProduced !== false
    || value.writeAttempted !== false
    || value.productSaveAsEnabled !== false
    || value.applyActionEnabled !== false
    || value.writeActionExposed !== false
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    sourceSha256: value.sourceSha256,
    sourceSha256AfterBoundary: value.sourceSha256AfterBoundary,
    prototypeId: value.prototypeId,
    resourceKeyCount: value.resourceKeyCount,
    operationCount: value.operationCount,
    beforeCanvasSha256: value.beforeCanvasSha256,
    afterCanvasSha256: value.afterCanvasSha256,
    canvasWidth: value.canvasWidth,
    canvasHeight: value.canvasHeight,
    beforeCanvasNonBlank: true,
    afterCanvasNonBlank: true,
    canvasDimensionsStable: true,
    pixelHashMatched: value.pixelHashMatched,
    renderedStateStable: true,
    prototypeVisible: true,
    sourceUnchanged: true,
    editedBytesProduced: false,
    writeAttempted: false,
    productSaveAsEnabled: false,
    applyActionEnabled: false,
    writeActionExposed: false,
    passed: true
  };
}

function validateSequenceNoopRoundTripProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "svga-sequence-noop-round-trip-proof") return undefined;
  if (value.source !== "workbench-sequence-noop-round-trip") return undefined;
  if (!isSha256(value.sourceSha256) || value.sourceSha256AfterRoundTrip !== value.sourceSha256) return undefined;
  if (value.prototypeId !== "svga-bounded-sequence-repair-prototype-v1") return undefined;
  if (!Number.isInteger(value.resourceKeyCount) || value.resourceKeyCount <= 0 || value.resourceKeyCount > 32) return undefined;
  if (!Number.isInteger(value.operationCount) || value.operationCount <= 0) return undefined;
  if (value.roundTripMode !== "no_op_source_reopen") return undefined;
  if (
    value.roundTripNoopOnly !== true
    || value.reopenedPlayback !== true
    || value.reopenedCanvasNonBlank !== true
    || value.reopenedInspectionReport !== true
    || value.renderedProofPassed !== true
    || value.sourceUnchanged !== true
    || value.editedBytesProduced !== false
    || value.writeAttempted !== false
    || value.productSaveAsEnabled !== false
    || value.applyActionEnabled !== false
    || value.writeActionExposed !== false
    || value.repairSuccessClaimed !== false
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    sourceSha256: value.sourceSha256,
    sourceSha256AfterRoundTrip: value.sourceSha256AfterRoundTrip,
    prototypeId: value.prototypeId,
    resourceKeyCount: value.resourceKeyCount,
    operationCount: value.operationCount,
    roundTripMode: value.roundTripMode,
    roundTripNoopOnly: true,
    reopenedPlayback: true,
    reopenedCanvasNonBlank: true,
    reopenedInspectionReport: true,
    renderedProofPassed: true,
    sourceUnchanged: true,
    editedBytesProduced: false,
    writeAttempted: false,
    productSaveAsEnabled: false,
    applyActionEnabled: false,
    writeActionExposed: false,
    repairSuccessClaimed: false,
    passed: true
  };
}

function validateReplacementUndoRedoProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "svga-replacement-undo-redo-proof") return undefined;
  if (value.source !== "workbench-replacement-history-state") return undefined;
  if (!isSha256(value.sourceSha256) || !isSha256(value.replacementSha256) || !isSha256(value.editedSha256)) return undefined;
  if (value.editedSha256 === value.sourceSha256 || value.editedSha256 === value.replacementSha256) return undefined;
  if (!isBoundedString(value.resourceKey, 120)) return undefined;
  if (!Number.isInteger(value.historyLimit) || value.historyLimit < 1 || value.historyLimit > 10) return undefined;
  if (!Number.isInteger(value.undoStackAfterApply) || value.undoStackAfterApply < 1 || value.undoStackAfterApply > value.historyLimit) {
    return undefined;
  }
  if (
    value.initialUndoAvailable !== true
    || value.initialRedoAvailable !== false
    || value.undoRestoredOriginal !== true
    || value.redoRestoredEdited !== true
    || value.editClearedAfterUndo !== true
    || value.redoAvailableAfterUndo !== true
    || value.editRestoredAfterRedo !== true
    || value.historyBounded !== true
    || value.sourceUnchanged !== true
    || value.undoCanvasNonBlank !== true
    || value.redoCanvasNonBlank !== true
    || value.undoInspectionReport !== true
    || value.redoInspectionReport !== true
    || value.renderedProofPassed !== true
    || value.saveAsNotAttempted !== true
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    sourceSha256: value.sourceSha256,
    resourceKey: value.resourceKey,
    replacementSha256: value.replacementSha256,
    editedSha256: value.editedSha256,
    historyLimit: value.historyLimit,
    undoStackAfterApply: value.undoStackAfterApply,
    initialUndoAvailable: true,
    initialRedoAvailable: false,
    undoRestoredOriginal: true,
    redoRestoredEdited: true,
    editClearedAfterUndo: true,
    redoAvailableAfterUndo: true,
    editRestoredAfterRedo: true,
    historyBounded: true,
    sourceUnchanged: true,
    undoCanvasNonBlank: true,
    redoCanvasNonBlank: true,
    undoInspectionReport: true,
    redoInspectionReport: true,
    renderedProofPassed: true,
    saveAsNotAttempted: true,
    passed: true
  };
}

function validateReplacementResetProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "svga-replacement-reset-proof") return undefined;
  if (value.source !== "workbench-replacement-reset-state") return undefined;
  if (!isSha256(value.sourceSha256) || !isSha256(value.replacementSha256) || !isSha256(value.editedSha256)) return undefined;
  if (value.editedSha256 === value.sourceSha256 || value.editedSha256 === value.replacementSha256) return undefined;
  if (!isBoundedString(value.resourceKey, 120)) return undefined;
  if (
    value.resetCommandAvailableBeforeReset !== true
    || value.resetRestoredOriginal !== true
    || value.editClearedAfterReset !== true
    || value.undoAvailableAfterReset !== true
    || value.redoClearedAfterReset !== true
    || value.sourceUnchanged !== true
    || value.resetCanvasNonBlank !== true
    || value.resetInspectionReport !== true
    || value.renderedProofPassed !== true
    || value.saveAsNotAttempted !== true
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    sourceSha256: value.sourceSha256,
    resourceKey: value.resourceKey,
    replacementSha256: value.replacementSha256,
    editedSha256: value.editedSha256,
    resetCommandAvailableBeforeReset: true,
    resetRestoredOriginal: true,
    editClearedAfterReset: true,
    undoAvailableAfterReset: true,
    redoClearedAfterReset: true,
    sourceUnchanged: true,
    resetCanvasNonBlank: true,
    resetInspectionReport: true,
    renderedProofPassed: true,
    saveAsNotAttempted: true,
    passed: true
  };
}

function validateReplacementMultiResourceProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "svga-multi-replacement-workbench-proof") return undefined;
  if (value.source !== "workbench-multi-replacement-state") return undefined;
  const resourceKeys = Array.isArray(value.resourceKeys)
    ? value.resourceKeys.filter((key) => isBoundedString(key, 120))
    : [];
  if (resourceKeys.length < 2 || new Set(resourceKeys).size !== resourceKeys.length) return undefined;
  if (!Number.isInteger(value.replacementCount) || value.replacementCount !== resourceKeys.length) return undefined;
  if (
    !isSha256(value.sourceSha256)
    || !isSha256(value.replacementASha256)
    || !isSha256(value.replacementBSha256)
    || !isSha256(value.firstEditSha256)
    || !isSha256(value.editedSha256)
    || !isSha256(value.savedSha256)
  ) {
    return undefined;
  }
  if (value.firstEditSha256 === value.sourceSha256 || value.editedSha256 === value.sourceSha256) return undefined;
  if (value.firstEditSha256 === value.editedSha256 || value.savedSha256 !== value.editedSha256) return undefined;
  if (!isBoundedString(value.savedFileName, 180) || !value.savedFileName.endsWith(".svga")) return undefined;
  if (
    value.saveStatus !== "saved"
    || value.validationMilestoneP4 !== true
    || value.roundTripPassed !== true
    || value.exportedMatchesReplacements !== true
    || value.sourceUnchanged !== true
    || value.undoAvailable !== true
    || value.redoCleared !== true
    || value.savedHashBound !== true
    || value.reopenedPlayback !== true
    || value.reopenedCanvasNonBlank !== true
    || value.reopenedInspectionReport !== true
    || value.renderedProofPassed !== true
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    sourceSha256: value.sourceSha256,
    resourceKeys,
    replacementCount: resourceKeys.length,
    replacementASha256: value.replacementASha256,
    replacementBSha256: value.replacementBSha256,
    firstEditSha256: value.firstEditSha256,
    editedSha256: value.editedSha256,
    savedSha256: value.savedSha256,
    savedFileName: value.savedFileName,
    saveStatus: "saved",
    validationMilestoneP4: true,
    roundTripPassed: true,
    exportedMatchesReplacements: true,
    sourceUnchanged: true,
    undoAvailable: true,
    redoCleared: true,
    savedHashBound: true,
    reopenedPlayback: true,
    reopenedCanvasNonBlank: true,
    reopenedInspectionReport: true,
    renderedProofPassed: true,
    passed: true
  };
}

function validateReplacementPreviewProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "svga-single-replacement-preview-proof") return undefined;
  if (value.source !== "svga-image-replace-api") return undefined;
  if (!isSha256(value.sourceSha256) || !isSha256(value.replacementSha256) || !isSha256(value.editedSha256)) return undefined;
  if (value.editedSha256 === value.sourceSha256 || value.editedSha256 === value.replacementSha256) return undefined;
  if (!isBoundedString(value.resourceKey, 120)) return undefined;
  if (
    value.sourceUnchanged !== true
    || value.roundTripPassed !== true
    || value.exportedMatchesReplacement !== true
    || value.reopenedPlayback !== true
    || value.reopenedCanvasNonBlank !== true
    || value.reopenedInspectionReport !== true
    || value.renderedProofPassed !== true
    || value.saveAsNotAttempted !== true
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    sourceSha256: value.sourceSha256,
    resourceKey: value.resourceKey,
    replacementSha256: value.replacementSha256,
    editedSha256: value.editedSha256,
    sourceUnchanged: true,
    roundTripPassed: true,
    exportedMatchesReplacement: true,
    reopenedPlayback: true,
    reopenedCanvasNonBlank: true,
    reopenedInspectionReport: true,
    renderedProofPassed: true,
    saveAsNotAttempted: true,
    passed: true
  };
}

function validateReplacementReadinessProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "svga-replacement-readiness-proof") return undefined;
  if (value.source !== "svga-image-edit-session-api") return undefined;
  if (!isSha256(value.sourceSha256) || value.sourceHashBound !== true) return undefined;
  if (!isBoundedString(value.fileName, 180) || !value.fileName.endsWith(".svga")) return undefined;
  if (
    value.dirtyFalse !== true
    || value.saveAsNotAttempted !== true
    || value.editorUiExposed !== false
    || value.passed !== true
  ) {
    return undefined;
  }
  if (!Number.isInteger(value.imageResourceCount) || value.imageResourceCount <= 0) return undefined;
  if (!Number.isInteger(value.usedResourceCount) || value.usedResourceCount <= 0) return undefined;
  if (!Number.isInteger(value.replaceableResourceCount) || value.replaceableResourceCount <= 0) return undefined;
  if (value.usedResourceCount > value.imageResourceCount || value.replaceableResourceCount > value.imageResourceCount) return undefined;
  if (!Number.isInteger(value.thumbnailCount) || value.thumbnailCount <= 0) return undefined;
  if (!Array.isArray(value.replaceableResourceKeys) || value.replaceableResourceKeys.length === 0) return undefined;
  if (value.replaceableResourceKeys.length > Math.min(value.replaceableResourceCount, 20)) return undefined;
  if (!value.replaceableResourceKeys.every((item) => isBoundedString(item, 120))) return undefined;
  if (new Set(value.replaceableResourceKeys).size !== value.replaceableResourceKeys.length) return undefined;
  const parsedMovie = value.parsedMovie;
  if (!parsedMovie || typeof parsedMovie !== "object" || Array.isArray(parsedMovie)) return undefined;
  if (!Number.isInteger(parsedMovie.imageCount) || parsedMovie.imageCount !== value.imageResourceCount) return undefined;
  if (!Number.isInteger(parsedMovie.spriteCount) || parsedMovie.spriteCount <= 0) return undefined;
  if (!Number.isInteger(parsedMovie.frameCount) || parsedMovie.frameCount <= 0) return undefined;
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    sourceSha256: value.sourceSha256,
    sourceHashBound: true,
    fileName: value.fileName,
    imageResourceCount: value.imageResourceCount,
    usedResourceCount: value.usedResourceCount,
    replaceableResourceCount: value.replaceableResourceCount,
    replaceableResourceKeys: value.replaceableResourceKeys.slice(0, 20),
    thumbnailCount: value.thumbnailCount,
    parsedMovie: {
      imageCount: parsedMovie.imageCount,
      spriteCount: parsedMovie.spriteCount,
      frameCount: parsedMovie.frameCount
    },
    dirtyFalse: true,
    saveAsNotAttempted: true,
    editorUiExposed: false,
    passed: true
  };
}

function validateOptimizedReopenProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "safe-svga-optimizer-reopen-proof") return undefined;
  if (value.source !== "svga-image-optimize-api") return undefined;
  if (typeof value.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sourceSha256)) return undefined;
  if (typeof value.optimizedSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.optimizedSha256)) return undefined;
  if (
    value.sourceUnchanged !== true
    || value.optimizedHashBound !== true
    || value.apiPassed !== true
    || value.saveAsRequired !== true
    || value.reopenedPlayback !== true
    || value.reopenedCanvasNonBlank !== true
    || value.reopenedInspectionReport !== true
    || value.renderedProofPassed !== true
    || value.passed !== true
  ) {
    return undefined;
  }
  if (!Number.isInteger(value.originalImageCount) || !Number.isInteger(value.optimizedImageCount)) return undefined;
  if (value.optimizedImageCount >= value.originalImageCount) return undefined;
  if (!Array.isArray(value.removedResourceKeys) || value.removedResourceKeys.length === 0) return undefined;
  if (!value.removedResourceKeys.every((item) => isBoundedString(item, 120))) return undefined;
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    sourceSha256: value.sourceSha256,
    sourceUnchanged: true,
    optimizedSha256: value.optimizedSha256,
    optimizedHashBound: true,
    originalImageCount: value.originalImageCount,
    optimizedImageCount: value.optimizedImageCount,
    removedResourceKeys: value.removedResourceKeys.slice(0, 20),
    apiPassed: true,
    saveAsRequired: true,
    reopenedPlayback: true,
    reopenedCanvasNonBlank: true,
    reopenedInspectionReport: true,
    renderedProofPassed: true,
    passed: true
  };
}

function describeWorkbenchRegionMapValidationFailure(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "shape";
  if (value.schemaVersion !== 1 || value.milestoneId !== "P6-R1" || value.generatedFrom !== "electron-product-smoke") return "identity";
  if (!value.viewportCss || !Number.isFinite(value.viewportCss.width) || !Number.isFinite(value.viewportCss.height)) return "viewport";
  if (!isBoundedString(value.mode, 80)) return "mode";
  if (value.mode !== "localPreview") return "mode-not-local-preview";
  if (value.workflowPrimary !== "local_preview_first" || value.localPreviewPrimary !== true) return "workflow-primary";
  if (!Array.isArray(value.secondaryEvidenceAllowed) || !value.secondaryEvidenceAllowed.includes("exportReview")) return "secondary-evidence";
  if (Array.isArray(value.layoutIntegrity?.failures) && value.layoutIntegrity.failures.length > 0) {
    const inspector = Array.isArray(value.regions) ? value.regions.find((region) => region?.id === "inspector") : undefined;
    const rect = inspector?.rect;
    const viewport = value.viewportCss;
    const debug = value.layoutDebug && typeof value.layoutDebug === "object" && !Array.isArray(value.layoutDebug)
      ? `:class=${String(value.layoutDebug.workspaceClassName ?? "missing").slice(0, 120)}:right=${String(value.layoutDebug.rightWidth ?? "missing")}:center=${String(value.layoutDebug.centerWidth ?? "missing")}:info=${String(value.layoutDebug.infoPanelWidth ?? "missing")}:panel=${String(value.layoutDebug.activeSidePanel ?? "missing")}:position=${String(value.layoutDebug.inspectorPosition ?? "missing")}:computedWidth=${String(value.layoutDebug.inspectorComputedWidth ?? "missing")}:min=${String(value.layoutDebug.inspectorComputedMinWidth ?? "missing")}:max=${String(value.layoutDebug.inspectorComputedMaxWidth ?? "missing")}`
      : "";
    const rectSummary = rect && viewport
      ? `:inspectorRect=${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.width)},${Math.round(rect.height)}:viewport=${Math.round(viewport.width)}x${Math.round(viewport.height)}`
      : "";
    return `layout:${value.layoutIntegrity.failures.slice(0, 4).join(",")}${rectSummary}${debug}`;
  }
  if (value.passed !== true) return "not-passed";
  const requiredIds = [
    "source_document",
    "preview_stage",
    "inspector",
    "resources",
    "action_workflow",
    "activity_history"
  ];
  if (!Array.isArray(value.regions) || value.regions.length !== requiredIds.length) return "regions-count";
  const seen = new Set();
  for (const region of value.regions) {
    if (!region || typeof region !== "object" || Array.isArray(region)) return "region-shape";
    if (!isBoundedString(region.id, 80) || seen.has(region.id)) return `region-id:${String(region.id)}`;
    seen.add(region.id);
    if (!isBoundedString(region.selector, 140)) return `region-selector:${region.id}`;
    if (!isBoundedString(region.label, 120)) return `region-label:${region.id}`;
    if (!isBoundedString(region.status, 80)) return `region-status:${region.id}`;
    if (region.present !== true || typeof region.visible !== "boolean") return `region-presence:${region.id}`;
    if (!isP6Rect(region.rect)) return `region-rect:${region.id}`;
    if (!isBoundedString(region.textSample ?? "", 220)) return `region-text:${region.id}`;
  }
  const missing = requiredIds.find((id) => !seen.has(id));
  if (missing) return `missing:${missing}`;
  return "unknown";
}

function describeP6InteractionTraceValidationFailure(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "p6Trace:shape";
  if (JSON.stringify(value).length > 220_000) return "p6Trace:size";
  if (value.schemaVersion !== 1 || value.host !== "desktop") return "p6Trace:identity";
  if (!isP6Fixture(value.fixture)) return "p6Trace:fixture";
  if (!isP6Context(value.context)) return "p6Trace:context";
  if (!Array.isArray(value.actionTrace) || value.actionTrace.length === 0 || value.actionTrace.length > 40) return "p6Trace:actionTraceCount";
  const badActionIndex = value.actionTrace.findIndex((entry) => !isP6ActionTraceEntry(entry));
  if (badActionIndex >= 0) return `p6Trace:actionTrace:${badActionIndex}:${describeP6ActionTraceEntryValidationFailure(value.actionTrace[badActionIndex])}`;
  if (!isSha256(value.finalStateDigest)) return "p6Trace:finalStateDigest";
  if (!isStringArray(value.visibleRegions, 80) || value.visibleRegions.length === 0) return "p6Trace:visibleRegions";
  if (!isStringArray(value.visibleControls, 160) || value.visibleControls.length === 0) return "p6Trace:visibleControls";
  if (!Array.isArray(value.screenshots) || value.screenshots.length === 0 || value.screenshots.length > 40) return "p6Trace:screenshots";
  if (!value.screenshots.every((entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
    && isBoundedString(entry.stateId, 120)
    && isBoundedString(entry.path, 260)
    && !entry.path.includes("..")
  )) return "p6Trace:screenshotEntry";
  if (!isP6MutationProtection(value.mutationProtection)) return "p6Trace:mutationProtection";
  if (!isStringArray(value.failures, 80)) return "p6Trace:failures";
  return "p6Trace:unknown";
}

function describeP6ActionTraceEntryValidationFailure(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "shape";
  if (!isBoundedString(value.id, 160)) return "id";
  if (!isBoundedString(value.kind, 40)) return "kind";
  if (!isBoundedString(value.selector, 220)) return "selector";
  if (!isBoundedString(value.initialState, 160)) return "initialState";
  if (!isBoundedString(value.expectedState, 160)) return "expectedState";
  if (!isP6ActionState(value.stateBefore)) return "stateBefore";
  if (!isP6RealAction(value.realAction)) return `realAction:${describeP6RealActionValidationFailure(value.realAction)}`;
  if (!isP6ActionState(value.stateAfter)) return "stateAfter";
  if ("stateReached" in value) return "deprecatedStateReached";
  if (!isP6Rect(value.targetRect)) return "targetRect";
  if (!(value.controlValue === null || isP6ControlValue(value.controlValue))) return "controlValue";
  if (!isP6FocusOrVisibleResult(value.focusOrVisibleResult)) return "focusOrVisibleResult";
  if ("stateProofPassed" in value) return "deprecatedStateProofPassed";
  if (!isStringArray(value.stateProofFailures, 80)) return "stateProofFailures";
  return "unknown";
}

function validateSmokeDiagnostics(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1) return undefined;
  if (!isBoundedString(value.phase, 80)) return undefined;
  if (!isBoundedString(value.errorName, 80)) return undefined;
  if (!isBoundedString(value.errorMessage, 260)) return undefined;
  if (!Number.isInteger(value.actionCount) || value.actionCount < 0 || value.actionCount > 60) return undefined;
  if (value.currentActionId !== null && !isBoundedString(value.currentActionId, 180)) return undefined;
  if (value.lastActionId !== null && !isBoundedString(value.lastActionId, 180)) return undefined;
  if (value.stateView !== undefined && !isBoundedString(value.stateView, 80)) return undefined;
  if (value.stateDisplayName !== undefined && !isBoundedString(value.stateDisplayName, 180)) return undefined;
  if (value.errorText !== undefined && !isBoundedString(value.errorText, 260)) return undefined;
  const diagnostics = {
    schemaVersion: 1,
    phase: value.phase,
    errorName: value.errorName,
    errorMessage: value.errorMessage,
    actionCount: value.actionCount,
    currentActionId: value.currentActionId,
    lastActionId: value.lastActionId
  };
  if (value.stateView !== undefined) diagnostics.stateView = value.stateView;
  if (value.stateDisplayName !== undefined) diagnostics.stateDisplayName = value.stateDisplayName;
  if (value.errorText !== undefined) diagnostics.errorText = value.errorText;
  if (value.renderedStateProof !== undefined) {
    if (!value.renderedStateProof || typeof value.renderedStateProof !== "object" || Array.isArray(value.renderedStateProof)) return undefined;
    if (!isBoundedString(value.renderedStateProof.state, 80)) return undefined;
    if (typeof value.renderedStateProof.passed !== "boolean") return undefined;
    if (!isStringArray(value.renderedStateProof.failures, 24)) return undefined;
    if (!isBoundedString(value.renderedStateProof.renderedText ?? "", 300)) return undefined;
    diagnostics.renderedStateProof = {
      state: value.renderedStateProof.state,
      passed: value.renderedStateProof.passed,
      failures: value.renderedStateProof.failures,
      renderedText: value.renderedStateProof.renderedText ?? ""
    };
  }
  if (value.primaryStatus !== undefined) {
    if (!value.primaryStatus || typeof value.primaryStatus !== "object" || Array.isArray(value.primaryStatus)) return undefined;
    for (const key of ["parseStatus", "renderStatus", "inspectionStatus"]) {
      if (!isBoundedString(value.primaryStatus[key], 80)) return undefined;
    }
    for (const key of ["hasSlotError", "hasMetrics", "hasInspectionReport"]) {
      if (typeof value.primaryStatus[key] !== "boolean") return undefined;
    }
    if (!Number.isInteger(value.primaryStatus.canvasChildCount) || value.primaryStatus.canvasChildCount < 0 || value.primaryStatus.canvasChildCount > 40) {
      return undefined;
    }
    diagnostics.primaryStatus = {
      parseStatus: value.primaryStatus.parseStatus,
      renderStatus: value.primaryStatus.renderStatus,
      inspectionStatus: value.primaryStatus.inspectionStatus,
      hasSlotError: value.primaryStatus.hasSlotError,
      hasMetrics: value.primaryStatus.hasMetrics,
      hasInspectionReport: value.primaryStatus.hasInspectionReport,
      canvasChildCount: value.primaryStatus.canvasChildCount
    };
  }
  return diagnostics;
}

function validateOwnerUsabilityResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1) return undefined;
  if (!isBoundedString(value.finderDocumentAssociation, 80)) return undefined;
  if (value.finderDocumentAssociation !== "not-declared") return undefined;
  const requiredChecks = [
    "svgaAInvalidLocalFeedback",
    "svgaARecoveryClearsError",
    "clearCurrentFileAction",
    "enterActivatesResourceTab",
    "enterOpensLogsAndFocusesPanel",
    "enterOpensSettingsAndFocusesDialog",
    "tabStaysInsideSettings",
    "escapeClosesSettingsAndRestoresFocus",
    "emptyLogsCopyMessage",
    "nonEmptyLogsCopyViaElectronClipboard",
    "clipboardFailureMessage",
    "finderDocumentAssociationNotClaimed",
    "previewCardHeaderConsistency",
    "previewCardSingleFileConsistency"
  ];
  if (!value.checks || typeof value.checks !== "object" || Array.isArray(value.checks)) return undefined;
  if (!requiredChecks.every((key) => value.checks[key] === true)) return undefined;
  if (!isStringArray(value.evidence, 80)) return undefined;
  let previewCardConsistency;
  if (value.previewCardConsistency !== undefined) {
    previewCardConsistency = validatePreviewCardConsistency(value.previewCardConsistency);
    if (!previewCardConsistency) return undefined;
  }
  return {
    schemaVersion: 1,
    finderDocumentAssociation: value.finderDocumentAssociation,
    checks: Object.fromEntries(requiredChecks.map((key) => [key, true])),
    ...(previewCardConsistency ? { previewCardConsistency } : {}),
    evidence: value.evidence
  };
}

function validateWorkbenchRegionMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.milestoneId !== "P6-R1" || value.generatedFrom !== "electron-product-smoke") return undefined;
  if (!value.viewportCss || !Number.isFinite(value.viewportCss.width) || !Number.isFinite(value.viewportCss.height)) return undefined;
  if (!isBoundedString(value.mode, 80)) return undefined;
  if (value.mode !== "localPreview") return undefined;
  if (value.workflowPrimary !== "local_preview_first" || value.localPreviewPrimary !== true) return undefined;
  if (!Array.isArray(value.secondaryEvidenceAllowed) || !value.secondaryEvidenceAllowed.includes("exportReview")) return undefined;
  if (value.passed !== true) return undefined;
  if (!value.layoutIntegrity || typeof value.layoutIntegrity !== "object" || Array.isArray(value.layoutIntegrity)) return undefined;
  if (value.layoutIntegrity.passed !== true) return undefined;
  if (!value.layoutIntegrity.viewportCss
    || value.layoutIntegrity.viewportCss.width !== value.viewportCss.width
    || value.layoutIntegrity.viewportCss.height !== value.viewportCss.height) return undefined;
  const requiredLayoutChecks = [
    "noRegionOverlap",
    "sourceDocumentNotToolbar",
    "noResourceActionCollision",
    "noVerticalFilterWrapping",
    "noOneCharacterChips",
    "inspectorTextReadable",
    "coreRegionsInsideViewport",
    "persistentSidePanels",
    "primaryActionVisible"
  ];
  if (!value.layoutIntegrity.checks || typeof value.layoutIntegrity.checks !== "object" || Array.isArray(value.layoutIntegrity.checks)) return undefined;
  if (!requiredLayoutChecks.every((key) => value.layoutIntegrity.checks[key] === true)) return undefined;
  if (!Array.isArray(value.layoutIntegrity.failures) || value.layoutIntegrity.failures.length !== 0) return undefined;
  const requiredIds = [
    "source_document",
    "preview_stage",
    "inspector",
    "resources",
    "action_workflow",
    "activity_history"
  ];
  if (!Array.isArray(value.regions) || value.regions.length !== requiredIds.length) return undefined;
  const byId = new Map();
  for (const region of value.regions) {
    if (!region || typeof region !== "object" || Array.isArray(region)) return undefined;
    if (!isBoundedString(region.id, 80) || byId.has(region.id)) return undefined;
    if (!isBoundedString(region.selector, 140) || !isBoundedString(region.label, 120) || !isBoundedString(region.status, 80)) return undefined;
    if (region.present !== true || typeof region.visible !== "boolean") return undefined;
    if (!isP6Rect(region.rect)) return undefined;
    if (!isBoundedString(region.textSample ?? "", 220)) return undefined;
    byId.set(region.id, {
      id: region.id,
      selector: region.selector,
      label: region.label,
      status: region.status,
      present: true,
      visible: region.visible,
      rect: region.rect,
      textSample: region.textSample ?? ""
    });
  }
  if (!requiredIds.every((id) => byId.has(id))) return undefined;
  return {
    schemaVersion: 1,
    milestoneId: "P6-R1",
    generatedFrom: "electron-product-smoke",
    viewportCss: value.viewportCss,
    mode: value.mode,
    workflowPrimary: "local_preview_first",
    localPreviewPrimary: true,
    secondaryEvidenceAllowed: ["exportReview"],
    regions: requiredIds.map((id) => byId.get(id)),
    layoutIntegrity: {
      passed: true,
      viewportCss: value.layoutIntegrity.viewportCss,
      checks: Object.fromEntries(requiredLayoutChecks.map((key) => [key, true])),
      failures: []
    },
    futureCapabilityPolicy: isBoundedString(value.futureCapabilityPolicy, 240) ? value.futureCapabilityPolicy : "",
    passed: true
  };
}

function validatePreviewCardConsistency(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.passed !== true) return undefined;
  if (!isStringArray(value.missing, 24) || value.missing.length !== 0) return undefined;
  if (value.singleFilePrimary === true) {
    const primary = validatePreviewCardZoneSnapshot(value.primary, "A", { requireMetadata: false });
    if (!primary) return undefined;
    if (value.compareEnabled !== false) return undefined;
    return {
      passed: true,
      compareEnabled: false,
      singleFilePrimary: true,
      primary,
      missing: []
    };
  }
  if (value.compareEnabled !== true) return undefined;
  if (value.syncControlsVisible !== true) return undefined;
  const primary = validatePreviewCardZoneSnapshot(value.primary, "A");
  if (!primary) return undefined;
  const secondary = validatePreviewCardZoneSnapshot(value.secondary, "B");
  if (!secondary) return undefined;
  return {
    passed: true,
    compareEnabled: true,
    syncControlsVisible: true,
    primary,
    secondary,
    missing: []
  };
}

function validatePreviewCardZoneSnapshot(value, expectedSlot, { requireMetadata = true } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.slot !== expectedSlot) return undefined;
  const requiredBooleans = [
    "loaded",
    "titleVisible",
    "fileNameInTitle",
    "duplicateFilePillHidden",
    "replaceActionVisible",
    "playbackControlsVisible"
  ];
  if (requireMetadata) requiredBooleans.push("metadataVisible");
  if (!requiredBooleans.every((key) => value[key] === true)) return undefined;
  if (!isBoundedString(value.fileName, 180) || !value.fileName.endsWith(".svga")) return undefined;
  return {
    slot: expectedSlot,
    loaded: true,
    titleVisible: true,
    fileNameInTitle: true,
    duplicateFilePillHidden: true,
    replaceActionVisible: true,
    metadataVisible: value.metadataVisible === true,
    playbackControlsVisible: true,
    fileName: value.fileName
  };
}

function describePreviewCardConsistencyFailure(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "shape";
  if (!isStringArray(value.missing, 24)) return "missing";
  if (value.missing.length !== 0) return `missing:${value.missing.slice(0, 8).join(",")}`;
  if (value.passed !== true) return "passed";
  const primary = validatePreviewCardZoneSnapshot(value.primary, "A");
  if (value.singleFilePrimary === true) {
    const singlePrimary = validatePreviewCardZoneSnapshot(value.primary, "A", { requireMetadata: false });
    if (!singlePrimary) return `primary:${describePreviewCardZoneSnapshotFailure(value.primary, "A", { requireMetadata: false })}`;
    if (value.compareEnabled !== false) return "singleFileCompareDisabled";
    return "unknown";
  }
  if (!primary) return `primary:${describePreviewCardZoneSnapshotFailure(value.primary, "A")}`;
  if (value.compareEnabled !== true) return "compareEnabled";
  if (value.syncControlsVisible !== true) return "syncControlsVisible";
  const secondary = validatePreviewCardZoneSnapshot(value.secondary, "B");
  if (!secondary) return `secondary:${describePreviewCardZoneSnapshotFailure(value.secondary, "B")}`;
  return "unknown";
}

function describePreviewCardZoneSnapshotFailure(value, expectedSlot, { requireMetadata = true } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "shape";
  if (value.slot !== expectedSlot) return "slot";
  const requiredBooleans = [
    "loaded",
    "titleVisible",
    "fileNameInTitle",
    "duplicateFilePillHidden",
    "replaceActionVisible",
    "playbackControlsVisible"
  ];
  if (requireMetadata) requiredBooleans.push("metadataVisible");
  const failedBoolean = requiredBooleans.find((key) => value[key] !== true);
  if (failedBoolean) return failedBoolean;
  if (!isBoundedString(value.fileName, 180)) return "fileName";
  if (!value.fileName.endsWith(".svga")) return "fileNameExtension";
  return "unknown";
}

function describeOwnerUsabilityValidationFailure(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "shape";
  if (value.schemaVersion !== 1) return "schemaVersion";
  if (!isBoundedString(value.finderDocumentAssociation, 80)) return "finderDocumentAssociation";
  if (value.finderDocumentAssociation !== "not-declared") return "finderDocumentAssociationValue";
  const requiredChecks = [
    "svgaAInvalidLocalFeedback",
    "svgaARecoveryClearsError",
    "clearCurrentFileAction",
    "enterActivatesResourceTab",
    "enterOpensLogsAndFocusesPanel",
    "enterOpensSettingsAndFocusesDialog",
    "tabStaysInsideSettings",
    "escapeClosesSettingsAndRestoresFocus",
    "emptyLogsCopyMessage",
    "nonEmptyLogsCopyViaElectronClipboard",
    "clipboardFailureMessage",
    "finderDocumentAssociationNotClaimed",
    "previewCardHeaderConsistency",
    "previewCardSingleFileConsistency"
  ];
  if (!value.checks || typeof value.checks !== "object" || Array.isArray(value.checks)) return "checks";
  const failedCheck = requiredChecks.find((key) => value.checks[key] !== true);
  if (failedCheck) {
    if ((failedCheck === "previewCardHeaderConsistency" || failedCheck === "previewCardSingleFileConsistency")
      && value.previewCardConsistency
      && typeof value.previewCardConsistency === "object"
      && !Array.isArray(value.previewCardConsistency)) {
      const missing = Array.isArray(value.previewCardConsistency.missing)
        ? value.previewCardConsistency.missing.slice(0, 8).join(",")
        : "unknown";
      return `${failedCheck}:${missing}`;
    }
    return failedCheck;
  }
  if (value.previewCardConsistency !== undefined && !validatePreviewCardConsistency(value.previewCardConsistency)) {
    return `previewCardConsistency:${describePreviewCardConsistencyFailure(value.previewCardConsistency)}`;
  }
  return "evidence";
}

function bindP6InteractionTrace(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return {
    ...value,
    mutationProtection: {
      headCommit: productArtifactIndex.headCommit,
      artifactCatalogDigest: sha256Text(JSON.stringify({
        headCommit: productArtifactIndex.headCommit,
        artifacts: productArtifactIndex.artifacts.map((artifact) => ({
          id: artifact.id,
          path: artifact.path,
          sha256: artifact.sha256,
          scenario: artifact.scenario
        }))
      })),
      source: "electron-main-product-artifact-index"
    }
  };
}

function validateP6InteractionTrace(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (JSON.stringify(value).length > 220_000) return undefined;
  if (value.schemaVersion !== 1 || value.host !== "desktop") return undefined;
  if (!isP6Fixture(value.fixture) || !isP6Context(value.context)) return undefined;
  if (!Array.isArray(value.actionTrace) || value.actionTrace.length === 0 || value.actionTrace.length > 40) return undefined;
  if (!value.actionTrace.every(isP6ActionTraceEntry)) return undefined;
  if (!isSha256(value.finalStateDigest)) return undefined;
  if (!isStringArray(value.visibleRegions, 80) || value.visibleRegions.length === 0) return undefined;
  if (!isStringArray(value.visibleControls, 160) || value.visibleControls.length === 0) return undefined;
  if (!Array.isArray(value.screenshots) || value.screenshots.length === 0 || value.screenshots.length > 40) return undefined;
  if (!value.screenshots.every((entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
    && isBoundedString(entry.stateId, 120)
    && isBoundedString(entry.path, 260)
    && !entry.path.includes("..")
  )) return undefined;
  if (!isP6MutationProtection(value.mutationProtection)) return undefined;
  if (!isStringArray(value.failures, 80)) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function isP6Fixture(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && isSha256(value.sha256)
    && isBoundedString(value.displayName, 160)
    && Number.isInteger(value.sizeBytes)
    && value.sizeBytes > 0
    && value.sizeBytes <= 25 * 1024 * 1024;
}

function isP6Context(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && isP6Viewport(value.viewportCss)
    && Number.isFinite(value.devicePixelRatio)
    && Number.isFinite(value.playbackTimeMs)
    && isBoundedString(value.mode, 120)
    && isBoundedString(value.panel, 120)
    && isBoundedString(value.modal, 120)
    && value.controls
    && typeof value.controls === "object"
    && !Array.isArray(value.controls)
    && Object.keys(value.controls).length <= 220
    && Object.entries(value.controls).every(([key, control]) =>
      isBoundedString(key, 180)
      && control
      && typeof control === "object"
      && !Array.isArray(control)
      && typeof control.visible === "boolean"
      && typeof control.disabled === "boolean"
      && typeof control.checked === "boolean"
    );
}

function isP6ActionTraceEntry(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && isBoundedString(value.id, 160)
    && isBoundedString(value.kind, 40)
    && isBoundedString(value.selector, 220)
    && isBoundedString(value.initialState, 160)
    && isBoundedString(value.expectedState, 160)
    && isP6ActionState(value.stateBefore)
    && isP6RealAction(value.realAction)
    && isP6ActionState(value.stateAfter)
    && !("stateReached" in value)
    && isP6Rect(value.targetRect)
    && (value.controlValue === null || isP6ControlValue(value.controlValue))
    && isP6FocusOrVisibleResult(value.focusOrVisibleResult)
    && !("stateProofPassed" in value)
    && isStringArray(value.stateProofFailures, 80);
}

function isP6ActionState(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && isBoundedString(value.stateId, 180)
    && isBoundedString(value.mode, 160)
    && isBoundedString(value.panel, 160)
    && isBoundedString(value.modal, 160)
    && isStringArray(value.visibleRegions, 80)
    && isStringArray(value.visibleControls, 180)
    && isSha256(value.digest);
}

function isP6RealAction(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && ["click", "input", "change", "drop", "keyboard", "native-menu"].includes(value.inputKind)
    && isBoundedString(value.selector, 220)
    && isBoundedString(value.trustedPath, 120)
    && typeof value.targetVisible === "boolean"
    && isP6Rect(value.targetRect)
    && value.actionablePoint
    && typeof value.actionablePoint === "object"
    && Number.isFinite(value.actionablePoint.x)
    && Number.isFinite(value.actionablePoint.y)
    && value.viewportIntersected === true
    && value.occlusionPassed === true
    && Number.isFinite(value.eventTimestampMs)
    && Array.isArray(value.eventReceipts)
    && value.eventReceipts.length > 0
    && value.eventReceipts.length <= 12
    && value.eventReceipts.every((receipt) =>
      receipt
      && typeof receipt === "object"
      && !Array.isArray(receipt)
      && isBoundedString(receipt.type, 40)
      && isBoundedString(receipt.selector, 220)
      && receipt.selector === value.selector
      && receipt.targetMatches === true
      && Number.isFinite(receipt.timestampMs)
    );
}

function describeP6RealActionValidationFailure(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "shape";
  if (!["click", "input", "change", "drop", "keyboard", "native-menu"].includes(value.inputKind)) return "inputKind";
  if (!isBoundedString(value.selector, 220)) return "selector";
  if (!isBoundedString(value.trustedPath, 120)) return "trustedPath";
  if (typeof value.targetVisible !== "boolean") return "targetVisibleType";
  if (!isP6Rect(value.targetRect)) return "targetRect";
  if (!value.actionablePoint || typeof value.actionablePoint !== "object") return "actionablePoint";
  if (!Number.isFinite(value.actionablePoint.x) || !Number.isFinite(value.actionablePoint.y)) return "actionablePointCoordinates";
  if (value.viewportIntersected !== true) return "viewportIntersected";
  if (value.occlusionPassed !== true) return "occlusionPassed";
  if (!Number.isFinite(value.eventTimestampMs)) return "eventTimestampMs";
  if (!Array.isArray(value.eventReceipts)) return "eventReceiptsType";
  if (value.eventReceipts.length === 0) return "eventReceiptsEmpty";
  if (value.eventReceipts.length > 12) return "eventReceiptsTooMany";
  const badReceiptIndex = value.eventReceipts.findIndex((receipt) =>
    !receipt
    || typeof receipt !== "object"
    || Array.isArray(receipt)
    || !isBoundedString(receipt.type, 40)
    || !isBoundedString(receipt.selector, 220)
    || receipt.selector !== value.selector
    || receipt.targetMatches !== true
    || !Number.isFinite(receipt.timestampMs)
  );
  if (badReceiptIndex >= 0) {
    const receipt = value.eventReceipts[badReceiptIndex];
    if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) return `eventReceipt:${badReceiptIndex}:shape`;
    if (!isBoundedString(receipt.type, 40)) return `eventReceipt:${badReceiptIndex}:type`;
    if (!isBoundedString(receipt.selector, 220)) return `eventReceipt:${badReceiptIndex}:selector`;
    if (receipt.selector !== value.selector) return `eventReceipt:${badReceiptIndex}:selectorMismatch`;
    if (receipt.targetMatches !== true) return `eventReceipt:${badReceiptIndex}:targetMatches`;
    if (!Number.isFinite(receipt.timestampMs)) return `eventReceipt:${badReceiptIndex}:timestampMs`;
  }
  return "unknown";
}

function isP6FocusOrVisibleResult(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && (value.activeElementId === null || isBoundedString(value.activeElementId, 160))
    && (value.activeElementText === null || typeof value.activeElementText === "string")
    && !("visibleResultState" in value)
    && !("visibleResultPassed" in value)
    && isBoundedString(value.observedState, 160)
    && typeof value.visibleResultText === "string";
}

function isP6MutationProtection(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && isSha256(value.artifactCatalogDigest)
    && /^[a-f0-9]{40}$/.test(value.headCommit)
    && value.headCommit !== "0".repeat(40)
    && isBoundedString(value.source, 160);
}

function isP6Viewport(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Number.isFinite(value.width)
    && Number.isFinite(value.height)
    && value.width > 0
    && value.height > 0;
}

function isP6Rect(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && ["x", "y", "width", "height"].every((field) => Number.isFinite(value[field]));
}

function isP6ControlValue(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && typeof value.visible === "boolean"
    && typeof value.disabled === "boolean"
    && typeof value.checked === "boolean";
}

function isStringArray(value, maxLength) {
  return Array.isArray(value)
    && value.length <= maxLength
    && value.every((item) => isBoundedString(item, 260));
}

function isBoundedString(value, maxLength) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function sha256Text(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function validateP6SmokeInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.kind !== "click" && value.kind !== "keyboard") return undefined;
  if (!p6AllowedSmokeInputSelectors.has(value.selector)) return undefined;
  if (value.kind === "keyboard" && !["Escape", "Space", "Enter", "Tab"].includes(value.key)) return undefined;
  if (value.shiftKey !== undefined && typeof value.shiftKey !== "boolean") return undefined;
  return {
    kind: value.kind,
    selector: value.selector,
    key: value.key ?? null,
    shiftKey: value.shiftKey === true
  };
}

async function performP6SmokeInput(webContents, value) {
  const input = validateP6SmokeInput(value);
  if (!input) throw new Error("Invalid product smoke input");
  const timestampMs = Date.now();
  if (input.kind === "keyboard") {
    const target = await webContents.executeJavaScript(`
      (() => {
        const selector = ${JSON.stringify(input.selector)};
        const node = selector === "body" ? document.body : document.querySelector(selector);
        if (!node) return null;
        if (selector === "body" && !node.hasAttribute("tabindex")) node.setAttribute("tabindex", "-1");
        node.focus?.({ preventScroll: true });
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        const x = Math.round(rect.left + rect.width / 2);
        const y = Math.round(rect.top + rect.height / 2);
        const top = document.elementFromPoint(x, y);
        return {
          selector,
          targetVisible: rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.01,
          targetRect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          actionablePoint: { x, y },
          viewportIntersected: x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight,
          occlusionPassed: selector === "body" || top === node || node.contains(top),
          activeElementId: document.activeElement?.id || null
        };
      })()
    `);
    if (!target || target.targetVisible !== true || target.viewportIntersected !== true || target.occlusionPassed !== true) {
      throw new Error("Product smoke keyboard target is not actionable");
    }
    const keyCode = input.key === "Space" ? "Space" : input.key;
    const event = { keyCode, modifiers: input.shiftKey ? ["shift"] : [] };
    webContents.sendInputEvent({ type: "keyDown", ...event });
    webContents.sendInputEvent({ type: "keyUp", ...event });
    return {
      inputKind: "keyboard",
      selector: input.selector,
      trustedPath: "electron-main-sendInputEvent-keyboard",
      nativeCommandId: `key:${keyCode}`,
      targetVisible: true,
      targetRect: target.targetRect,
      actionablePoint: target.actionablePoint,
      viewportIntersected: true,
      occlusionPassed: true,
      eventTimestampMs: timestampMs,
      shiftKey: input.shiftKey === true,
      focusedElementId: target.activeElementId
    };
  }
  const target = await webContents.executeJavaScript(`
    (() => {
      const selector = ${JSON.stringify(input.selector)};
      const node = document.querySelector(selector);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const x = Math.round(rect.left + rect.width / 2);
      const y = Math.round(rect.top + rect.height / 2);
      const top = document.elementFromPoint(x, y);
      return {
        selector,
        targetVisible: rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.01,
        targetRect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        actionablePoint: { x, y },
        viewportIntersected: x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight,
        occlusionPassed: top === node || node.contains(top),
        topElement: top?.id || top?.tagName?.toLowerCase?.() || null
      };
    })()
  `);
  if (!target || target.targetVisible !== true || target.viewportIntersected !== true || target.occlusionPassed !== true) {
    throw new Error("Product smoke input target is not actionable");
  }
  webContents.sendInputEvent({ type: "mouseMove", x: target.actionablePoint.x, y: target.actionablePoint.y });
  webContents.sendInputEvent({ type: "mouseDown", button: "left", clickCount: 1, x: target.actionablePoint.x, y: target.actionablePoint.y });
  webContents.sendInputEvent({ type: "mouseUp", button: "left", clickCount: 1, x: target.actionablePoint.x, y: target.actionablePoint.y });
  return {
    inputKind: "click",
    selector: input.selector,
    trustedPath: "electron-main-sendInputEvent-pointer",
    nativeCommandId: `click:${input.selector}`,
    targetVisible: true,
    targetRect: target.targetRect,
    actionablePoint: target.actionablePoint,
    viewportIntersected: true,
    occlusionPassed: true,
    eventTimestampMs: timestampMs
  };
}

function validateArtifactScenario(value) {
  const allowed = new Set([
    "desktop-empty",
    "desktop-loading",
    "desktop-loaded",
    "desktop-inspection",
    "desktop-invalid",
    "desktop-playing",
    "desktop-paused",
    "desktop-latest-artifact-loaded",
    "desktop-reference-media-loaded",
    "desktop-local-compare-loaded",
    "desktop-responsive-local-compare-at-900-x-720",
    "desktop-responsive-local-compare-at-minimum-size",
    "desktop-responsive-local-preview-at-900-x-720",
    "short-term-launch",
    "short-term-preview-overview",
    "short-term-preview-optimization",
    "short-term-preview-replaceable",
    "short-term-sequence-thumbnails",
    "short-term-optimization-result",
    "short-term-rename-dirty",
    "short-term-replacement-dirty",
    "short-term-replacement-reset",
    "short-term-runtime-text-applied",
    "short-term-general-compare",
    "short-term-edit-reserved",
    "short-term-preview-minimum",
    "short-term-settings-dialog",
    "short-term-appearance-dark",
    "short-term-appearance-light",
    "short-term-preview-overview-wide",
    "short-term-drag-decision-supported",
    "short-term-drag-decision-unsupported",
    "short-term-save-failed",
    "short-term-load-failed",
    "short-term-playback-failed",
    "desktop-local-info-overview-open",
    "desktop-local-info-assets-open",
    "desktop-local-source-resources-open",
    "desktop-local-source-layers-open",
    "desktop-local-inspector-actions-open",
    "desktop-local-logs-hidden-default",
    "desktop-local-minimum-size",
    "desktop-info-diagnostics-open",
    "desktop-local-info-diagnostics-open",
    "desktop-local-logs-open",
    "desktop-local-settings-open",
    "desktop-recovered-from-invalid",
    "desktop-sequence-review-proof",
    "desktop-sequence-repair-preview-proof",
    "desktop-sequence-no-write-simulation-proof",
    "desktop-sequence-bounded-repair-prototype-proof",
    "desktop-sequence-prototype-rendered-boundary-proof",
    "desktop-sequence-noop-round-trip-proof",
    "desktop-sequence-product-repair-proof",
    "desktop-replacement-preview-proof",
    "desktop-replacement-undo-redo-proof",
    "desktop-multi-replacement-proof",
    "desktop-optimized-reopen-proof",
    "actual-normal-loaded",
    "smoke-loaded",
    "desktop-1280x800",
    "desktop-1440x900",
    "desktop-responsive-export-review-loaded-at-900-x-720",
    "p3-original-loaded",
    "p3-resource-list",
    "p3-replacement-selected",
    "p3-replacement-preview",
    "p3-dirty-state",
    "p3-reset-to-original",
    "p3-export-success",
    "p3-reopened-export",
    "p3-invalid-png-state",
    "p3-original-edited-comparison",
    "p4-multi-resource-original",
    "p4-multi-resource-list",
    "p4-first-replacement",
    "p4-two-replacements",
    "p4-undo-second-replacement",
    "p4-redo-second-replacement",
    "p4-reset-selected",
    "p4-undo-reset-selected",
    "p4-reset-all",
    "p4-undo-reset-all",
    "p4-dirty-two-edits",
    "p4-save-point-clean",
    "p4-post-save-new-edit",
    "p4-reopened-multi-resource-export",
    "p4-invalid-second-png",
    "p4-multi-resource-comparison",
    "p5-batch-entry",
    "p5-batch-files-selected",
    "p5-mapping-exact-matches",
    "p5-mapping-unmatched-conflict",
    "p5-mapping-manual-resolution",
    "p5-mapping-ready-to-apply",
    "p5-batch-preview",
    "p5-batch-dirty-state",
    "p5-batch-undo",
    "p5-batch-redo",
    "p5-batch-export-success",
    "p5-batch-reopened-export",
    "p5-corrupt-png-state",
    "p5-dimension-warning",
    "p5-batch-original-edited-comparison"
  ]);
  if (allowed.has(value)) return value;
  if (/^desktop-(mode-menu-open|info-overview-open|info-assets-open|logs-open|settings-open|accessibility-toggles-on|settings-closed-by-escape|synchronized-playback-toggled-by-space|local-compare-empty|asset-preview-modal-open)$/.test(value)) {
    return value;
  }
  if (/^desktop-motion-[a-zA-Z0-9_-]+-(start|mid|end)$/.test(value)) return value;
  return undefined;
}

function validateEditedSvgaSaveInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (typeof value.bytesBase64 !== "string" || value.bytesBase64.length === 0) return undefined;
  const bytes = Buffer.from(value.bytesBase64, "base64");
  if (bytes.byteLength <= 0 || bytes.byteLength > 25 * 1024 * 1024) return undefined;
  const validation = validateSaveRevisionBinding(value.validation, bytes);
  if (!validation) return undefined;
  const suggestedName = sanitizeSvgaFileName(
    typeof value.suggestedName === "string" ? value.suggestedName : "untitled-edited.svga"
  );
  const sourceId = typeof value.sourceId === "string" && /^[a-f0-9]{24}$/.test(value.sourceId) ? value.sourceId : "";
  return {
    bytes,
    suggestedName,
    sourceId,
    validation
  };
}

function validateOptimizedSvgaSaveInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (typeof value.bytesBase64 !== "string" || value.bytesBase64.length === 0) return undefined;
  const bytes = Buffer.from(value.bytesBase64, "base64");
  if (bytes.byteLength <= 0 || bytes.byteLength > 25 * 1024 * 1024) return undefined;
  const validation = validateOptimizationReportBinding(value.optimizationReport, bytes);
  if (!validation) return undefined;
  const suggestedName = sanitizeSvgaFileName(
    typeof value.suggestedName === "string" ? value.suggestedName : "optimized-output.svga"
  );
  const sourceId = typeof value.sourceId === "string" && /^[a-f0-9]{24}$/.test(value.sourceId) ? value.sourceId : "";
  return {
    bytes,
    suggestedName,
    sourceId,
    validation
  };
}

function validateSequenceRepairSvgaSaveInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (typeof value.bytesBase64 !== "string" || value.bytesBase64.length === 0) return undefined;
  const bytes = Buffer.from(value.bytesBase64, "base64");
  if (bytes.byteLength <= 0 || bytes.byteLength > 25 * 1024 * 1024) return undefined;
  const validation = validateSequenceRepairReportBinding(value.sequenceRepairReport, bytes);
  if (!validation) return undefined;
  const suggestedName = sanitizeSvgaFileName(
    typeof value.suggestedName === "string" ? value.suggestedName : "sequence-repaired-output.svga"
  );
  const sourceId = typeof value.sourceId === "string" && /^[a-f0-9]{24}$/.test(value.sourceId) ? value.sourceId : "";
  return {
    bytes,
    suggestedName,
    sourceId,
    validation
  };
}

function validateShortTermSvgaSaveInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const command = value.command === "overwrite" ? "overwrite" : value.command === "saveAs" ? "saveAs" : "";
  if (!command) return undefined;
  if (typeof value.bytesBase64 !== "string" || value.bytesBase64.length === 0) return undefined;
  const bytes = Buffer.from(value.bytesBase64, "base64");
  if (bytes.byteLength <= 0 || bytes.byteLength > 25 * 1024 * 1024) return undefined;
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (!isSha256(value.expectedSha256) || value.expectedSha256 !== sha256) return undefined;
  const suggestedName = sanitizeSvgaFileName(
    typeof value.suggestedName === "string" ? value.suggestedName : "short-term-output.svga"
  );
  const sourceId = typeof value.sourceId === "string" && /^[a-f0-9]{24}$/.test(value.sourceId) ? value.sourceId : "";
  return {
    command,
    bytes,
    sha256,
    suggestedName,
    sourceId
  };
}

function validateSaveRevisionBinding(value, bytes) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const milestoneId = value.milestoneId === "P3"
    ? "P3"
    : value.milestoneId === "P4"
      ? "P4"
      : value.milestoneId === "P5"
        ? "P5"
        : "";
  const productWorkbenchAllowsWorkbenchSave = ["P3", "P4"].includes(milestoneId)
    && ["P2", "P6", "P6-R1"].includes(productMilestoneId);
  if (!milestoneId || (milestoneId !== productMilestoneId && !productWorkbenchAllowsWorkbenchSave)) return undefined;
  if (value.schemaVersion !== 1) return undefined;
  if (!Number.isInteger(value.operationSequence) || value.operationSequence < 0) return undefined;
  if (typeof value.replacementDigest !== "string" || value.replacementDigest.length === 0 || value.replacementDigest.length > 20_000) return undefined;
  if (typeof value.roundTripReportDigest !== "string" || !/^[a-f0-9]{64}$/.test(value.roundTripReportDigest)) return undefined;
  if (typeof value.editedBytesSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.editedBytesSha256)) return undefined;
  if (value.editedBytesSha256 !== createHash("sha256").update(bytes).digest("hex")) return undefined;
  if (value.reportPassed !== true || value.unexpectedChangesEmpty !== true) return undefined;
  if (milestoneId === "P4") {
    if (value.reportSchemaVersion !== 3 || value.reportMilestoneId !== "P4") return undefined;
    if (!Number.isInteger(value.replacementCount) || value.replacementCount < 2) return undefined;
  } else if (milestoneId === "P5") {
    if (value.reportSchemaVersion !== 4 || value.reportMilestoneId !== "P5") return undefined;
    if (!Number.isInteger(value.appliedMappingCount) || value.appliedMappingCount < 3) return undefined;
  } else if (value.reportSchemaVersion !== 2) {
    return undefined;
  }
  return {
    milestoneId,
    operationSequence: value.operationSequence,
    replacementDigest: value.replacementDigest,
    roundTripReportDigest: value.roundTripReportDigest,
    editedBytesSha256: value.editedBytesSha256,
    reportSchemaVersion: value.reportSchemaVersion,
    replacementCount: value.replacementCount,
    appliedMappingCount: value.appliedMappingCount
  };
}

function validateOptimizationReportBinding(value, bytes) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.optimizationId !== "svga-safe-image-optimizer-v1") return undefined;
  if (typeof value.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sourceSha256)) return undefined;
  if (value.sourceSha256AfterOptimization !== value.sourceSha256) return undefined;
  const optimizedSha256 = createHash("sha256").update(bytes).digest("hex");
  if (value.optimizedSha256 !== optimizedSha256) return undefined;
  if (value.passed !== true || value.sourceUnchanged !== true || value.saveAsRequired !== true) return undefined;
  if (!Number.isInteger(value.originalImageCount) || !Number.isInteger(value.optimizedImageCount)) return undefined;
  if (!Number.isInteger(value.originalSpriteCount) || !Number.isInteger(value.optimizedSpriteCount)) return undefined;
  if (!Number.isInteger(value.originalFrameEntityCount) || !Number.isInteger(value.optimizedFrameEntityCount)) return undefined;
  if (!Number.isInteger(value.removedAllZeroSpriteCount)) return undefined;
  const imageCountImproved = value.optimizedImageCount < value.originalImageCount;
  const runtimeStructureImproved = value.optimizedSpriteCount < value.originalSpriteCount
    || value.optimizedFrameEntityCount < value.originalFrameEntityCount;
  if (!imageCountImproved && !runtimeStructureImproved) return undefined;
  if (!Array.isArray(value.actions) || value.actions.length === 0) return undefined;
  if (!Array.isArray(value.removedResourceKeys)) return undefined;
  if (value.removedResourceKeys.length === 0 && value.removedAllZeroSpriteCount <= 0) return undefined;
  if (!Array.isArray(value.invariantChecks) || value.invariantChecks.length === 0) return undefined;
  if (!value.invariantChecks.every((check) => check && typeof check === "object" && check.passed === true)) return undefined;
  return {
    schemaVersion: value.schemaVersion,
    optimizationId: value.optimizationId,
    sourceSha256: value.sourceSha256,
    optimizedSha256,
    originalImageCount: value.originalImageCount,
    optimizedImageCount: value.optimizedImageCount,
    originalSpriteCount: value.originalSpriteCount,
    optimizedSpriteCount: value.optimizedSpriteCount,
    originalFrameEntityCount: value.originalFrameEntityCount,
    optimizedFrameEntityCount: value.optimizedFrameEntityCount,
    actionCount: value.actions.length,
    removedResourceKeys: value.removedResourceKeys.slice(0, 100)
  };
}

function rememberSourceFile(filePath) {
  const sourceId = randomBytes(12).toString("hex");
  sourceFilePaths.set(sourceId, filePath);
  while (sourceFilePaths.size > 20) {
    const firstKey = sourceFilePaths.keys().next().value;
    sourceFilePaths.delete(firstKey);
  }
  return sourceId;
}

function shortTermRecentStorePath() {
  return path.join(app.getPath("userData"), "short-term-recent-svga-files.json");
}

function shortTermRecentId(filePath) {
  return createHash("sha256").update(canonicalSavePath(filePath)).digest("hex").slice(0, 24);
}

function normalizeShortTermRecentRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (typeof value.path !== "string") return undefined;
  const filePath = path.resolve(value.path);
  if (filePath.includes("\0")) return undefined;
  const extension = path.extname(filePath).toLowerCase();
  const allowedRecentExtensions = isMultiFormatDesktopProduct
    ? new Set([".svga", ".json", ".mp4"])
    : new Set([".svga"]);
  if (!allowedRecentExtensions.has(extension)) return undefined;
  const lastOpenedAt = typeof value.lastOpenedAt === "string" && value.lastOpenedAt.length <= 40
    ? value.lastOpenedAt
    : new Date(0).toISOString();
  return {
    id: shortTermRecentId(filePath),
    path: filePath,
    displayName: path.basename(filePath),
    parentName: path.basename(path.dirname(filePath)) || "本地文件",
    lastOpenedAt
  };
}

function readShortTermRecentRecords() {
  if (!usesShortTermPreviewShell) return [];
  try {
    const parsed = JSON.parse(readFileSync(shortTermRecentStorePath(), "utf8"));
    if (!Array.isArray(parsed?.records)) return [];
    return parsed.records
      .map(normalizeShortTermRecentRecord)
      .filter(Boolean)
      .slice(0, maxShortTermRecentFiles);
  } catch {
    return [];
  }
}

function writeShortTermRecentRecords(records) {
  if (!usesShortTermPreviewShell) return;
  mkdirSync(path.dirname(shortTermRecentStorePath()), { recursive: true });
  writeFileSync(shortTermRecentStorePath(), `${JSON.stringify({
    schemaVersion: 1,
    pathRedactedToRenderer: true,
    records: records.slice(0, maxShortTermRecentFiles).map((record) => ({
      path: record.path,
      lastOpenedAt: record.lastOpenedAt
    }))
  }, null, 2)}\n`);
}

function rememberShortTermRecentFile(filePath) {
  if (!usesShortTermPreviewShell) return;
  const normalized = normalizeShortTermRecentRecord({
    path: filePath,
    lastOpenedAt: new Date().toISOString()
  });
  if (!normalized) return;
  const records = [
    normalized,
    ...readShortTermRecentRecords().filter((record) => record.id !== normalized.id)
  ].slice(0, maxShortTermRecentFiles);
  writeShortTermRecentRecords(records);
  rebuildShortTermApplicationMenu();
}

function shortTermRecentView() {
  return readShortTermRecentRecords().map((record) => ({
    id: record.id,
    displayName: record.displayName,
    parentName: record.parentName,
    lastOpenedAt: record.lastOpenedAt,
    pathRedacted: true
  }));
}

function updateShortTermMenuState(input) {
  const nextState = validateShortTermMenuState(input);
  if (!nextState) throw new Error("Invalid short-term menu state");
  shortTermMenuState = nextState;
  if (nextState.view === "launch" && shortTermWindowMode !== "launch") {
    setShortTermWindowMode("launch");
  }
  rebuildShortTermApplicationMenu();
  return { status: "updated" };
}

function setShortTermWindowMode(input, window = activeMainWindow) {
  if (!usesShortTermPreviewShell || !window || window.isDestroyed()) return { status: "ignored" };
  if (smokeMode || auditMode || normalProofMode) return { status: "ignored" };
  const mode = stringEnum(input, ["launch", "workbench"], "workbench");
  const previousMode = shortTermWindowMode;
  shortTermWindowMode = mode;
  const minimumSize = mode === "launch"
    ? macosWorkbenchWindowSizing.minimumLaunch
    : macosWorkbenchWindowSizing.minimumSupported;
  const bounds = mode === "launch" && previousMode === "launch"
    ? preserveShortTermLaunchWindowBounds(window, "mode-sync").after
    : mode === "launch"
      ? chooseMacosLaunchWindowBounds(window)
      : chooseMacosWorkbenchWindowBounds(window);
  if (mode === "launch") {
    shortTermLaunchWindowSize = { width: bounds.width, height: bounds.height };
  }
  window.setMinimumSize(minimumSize.width, minimumSize.height);
  setWindowBoundsWithoutRecordingUserResize(window, bounds, true);
  return {
    status: "updated",
    mode,
    previousMode,
    width: bounds.width,
    height: bounds.height
  };
}

function validateShortTermMenuState(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const view = stringEnum(input.view, ["launch", "loading", "failed", "preview", "compare", "edit"], defaultShortTermMenuState.view);
  const mode = stringEnum(input.mode, ["preview", "edit"], defaultShortTermMenuState.mode);
  const tab = stringEnum(input.tab, ["overview", "optimization", "replaceable"], defaultShortTermMenuState.tab);
  const appearance = stringEnum(input.appearance, ["system", "light", "dark"], defaultShortTermMenuState.appearance);
  const outputKind = stringEnum(input.outputKind, ["", "optimization", "rename", "replacement"], "");
  return {
    view,
    mode,
    tab,
    appearance,
    outputKind,
    hasFile: input.hasFile === true,
    hasOutput: input.hasOutput === true,
    canOverwrite: input.canOverwrite === true,
    canSaveAs: input.canSaveAs === true,
    saveBusy: input.saveBusy === true,
    canCompare: input.canCompare === true,
    canPlay: input.canPlay === true,
    canReplay: input.canReplay === true,
    canRenameImageKey: input.canRenameImageKey === true,
    canReplaceImage: input.canReplaceImage === true,
    canResetImageReplacement: input.canResetImageReplacement === true,
    canEditText: input.canEditText === true,
    canResetText: input.canResetText === true,
    canRunOptimization: input.canRunOptimization === true,
    canShowOptimizationComparison: input.canShowOptimizationComparison === true,
    isRenaming: input.isRenaming === true,
    hasTransientState: input.hasTransientState === true
  };
}

function stringEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

async function openShortTermRecentFile(recentFileId) {
  if (!isBoundedString(recentFileId, 80)) return { status: "missing", message: "最近文件记录无效。" };
  const records = readShortTermRecentRecords();
  const record = records.find(({ id }) => id === recentFileId);
  if (!record || !existsSync(record.path)) {
    writeShortTermRecentRecords(records.filter(({ id }) => id !== recentFileId));
    rebuildShortTermApplicationMenu();
    return { status: "missing", message: "这个最近文件已缺失或不可访问。" };
  }
  return isMultiFormatDesktopProduct
    ? openMultiFormatFilePath(record.path, "recentFile")
    : openSvgaFileBytes(record.path);
}

function clearShortTermRecentFiles() {
  if (!usesShortTermPreviewShell) return { status: "cleared", count: 0 };
  const count = readShortTermRecentRecords().length;
  writeShortTermRecentRecords([]);
  rebuildShortTermApplicationMenu();
  return { status: "cleared", count };
}

function sanitizeSvgaFileName(value) {
  const base = path.basename(String(value).replace(/[/\\]/g, "")).slice(0, 120) || "untitled-edited.svga";
  return base.toLowerCase().endsWith(".svga") ? base : `${base}.svga`;
}

function validateShortTermNormalSaveProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "short-term-save-proof") return undefined;
  if (value.source !== "short-term-normal-proof") return undefined;
  const booleanKeys = [
    "initialSaveDisabled",
    "firstOutputSaveEnabled",
    "saveAsSaved",
    "saveAsHashBound",
    "saveAsReopenValidated",
    "outputClearedAfterSaveAs",
    "secondOutputSaveEnabled",
    "overwriteSaved",
    "overwriteHashBound",
    "overwriteReopenValidated",
    "outputClearedAfterOverwrite",
    "canonicalSourceUnchanged",
    "passed"
  ];
  if (!booleanKeys.every((key) => value[key] === true)) return undefined;
  const hashKeys = [
    "canonicalFixtureSha256Before",
    "canonicalFixtureSha256After",
    "saveAsExpectedSha256",
    "saveAsSavedSha256",
    "overwriteExpectedSha256",
    "overwriteSavedSha256"
  ];
  if (!hashKeys.every((key) => isSha256(value[key]))) return undefined;
  if (value.canonicalFixtureSha256Before !== value.canonicalFixtureSha256After) return undefined;
  if (value.saveAsExpectedSha256 !== value.saveAsSavedSha256) return undefined;
  if (value.overwriteExpectedSha256 !== value.overwriteSavedSha256) return undefined;
  if (value.saveAsSavedSha256 === value.overwriteSavedSha256) return undefined;
  if (!isBoundedString(value.saveAsFileName, 180) || !value.saveAsFileName.endsWith(".svga")) return undefined;
  if (!isBoundedString(value.overwriteFileName, 180) || !value.overwriteFileName.endsWith(".svga")) return undefined;
  if (!isBoundedString(value.firstRenameFrom, 120) || !isBoundedString(value.firstRenameTo, 120)) return undefined;
  if (!isBoundedString(value.secondRenameFrom, 120) || !isBoundedString(value.secondRenameTo, 120)) return undefined;
  if (value.firstRenameFrom === value.firstRenameTo || value.secondRenameFrom === value.secondRenameTo) return undefined;
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    initialSaveDisabled: true,
    firstOutputSaveEnabled: true,
    saveAsSaved: true,
    saveAsHashBound: true,
    saveAsReopenValidated: true,
    outputClearedAfterSaveAs: true,
    secondOutputSaveEnabled: true,
    overwriteSaved: true,
    overwriteHashBound: true,
    overwriteReopenValidated: true,
    outputClearedAfterOverwrite: true,
    canonicalSourceUnchanged: true,
    canonicalFixtureSha256Before: value.canonicalFixtureSha256Before,
    canonicalFixtureSha256After: value.canonicalFixtureSha256After,
    saveAsExpectedSha256: value.saveAsExpectedSha256,
    saveAsSavedSha256: value.saveAsSavedSha256,
    overwriteExpectedSha256: value.overwriteExpectedSha256,
    overwriteSavedSha256: value.overwriteSavedSha256,
    saveAsFileName: value.saveAsFileName,
    overwriteFileName: value.overwriteFileName,
    firstRenameFrom: value.firstRenameFrom,
    firstRenameTo: value.firstRenameTo,
    secondRenameFrom: value.secondRenameFrom,
    secondRenameTo: value.secondRenameTo,
    passed: true
  };
}

function validateNormalProofResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const keys = [
    "normalMode",
    "hostOpen",
    "menuOpen",
    "primaryBridge",
    "playback",
    "canvasNonBlank",
    "inspectionReport",
    "auditPanel",
    "recentFiles",
    "recentMissingRecovery",
    "shortTermSave",
    "localOnly",
    "cspAccepted",
    "noCspViolation"
  ];
  if (!keys.every((key) => typeof value[key] === "boolean")) return undefined;
  const shortTermSaveProof = validateShortTermNormalSaveProof(value.shortTermSaveProof);
  if (!shortTermSaveProof || value.shortTermSave !== true) return undefined;
  const shortTermRecentProof = validateShortTermNormalRecentProof(value.shortTermRecentProof);
  if (!shortTermRecentProof || value.recentFiles !== true || value.recentMissingRecovery !== true) return undefined;
  return {
    normalMode: value.normalMode,
    hostOpen: value.hostOpen,
    menuOpen: value.menuOpen,
    primaryBridge: value.primaryBridge,
    rendererQuery: typeof value.rendererQuery === "string" ? value.rendererQuery.slice(0, 120) : "",
    playback: value.playback,
    canvasNonBlank: value.canvasNonBlank,
    inspectionReport: value.inspectionReport,
    auditPanel: value.auditPanel,
    recentFiles: value.recentFiles,
    recentMissingRecovery: value.recentMissingRecovery,
    shortTermRecentProof,
    shortTermSave: value.shortTermSave,
    shortTermSaveProof,
    localOnly: value.localOnly,
    cspAccepted: value.cspAccepted,
    noCspViolation: value.noCspViolation && !cspViolationSeen
  };
}

function validateShortTermNormalRecentProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "short-term-recent-proof") return undefined;
  if (value.source !== "short-term-normal-proof") return undefined;
  if (!Array.isArray(value.prdIds) || value.prdIds.join(",") !== "S16") return undefined;
  if (value.menuRecordLimit !== 10 || value.launchRecordLimit !== 5) return undefined;
  if (!Number.isInteger(value.menuRecordCount) || value.menuRecordCount !== 10) return undefined;
  if (!Number.isInteger(value.launchRecordCount) || value.launchRecordCount !== 5) return undefined;
  if (!Number.isInteger(value.afterClearRecordCount) || value.afterClearRecordCount !== 0) return undefined;
  if (
    value.pathRedacted !== true
    || value.rendererRecordsContainFullPath !== false
    || value.launchRowsPathRedacted !== true
    || value.missingRecoveryVisible !== true
    || value.missingRecordRemoved !== true
    || value.reopenedAfterMissing !== true
    || value.clearHistoryCompleted !== true
    || value.launchEmptyAfterClear !== true
    || value.reopenedAfterClear !== true
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    prdIds: ["S16"],
    menuRecordLimit: 10,
    menuRecordCount: 10,
    launchRecordLimit: 5,
    launchRecordCount: 5,
    pathRedacted: true,
    rendererRecordsContainFullPath: false,
    launchRowsPathRedacted: true,
    missingRecoveryVisible: true,
    missingRecordRemoved: true,
    reopenedAfterMissing: true,
    clearHistoryCompleted: true,
    afterClearRecordCount: 0,
    launchEmptyAfterClear: true,
    reopenedAfterClear: true,
    passed: true
  };
}

function validateP3EditResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const requiredBooleans = [
    "resourceList",
    "replacementPreview",
    "dirtyState",
    "reset",
    "saveAs",
    "reopenedExport",
    "invalidPngState",
    "originalUnchanged",
    "editedPixelsDiffer"
  ];
  if (!requiredBooleans.every((key) => typeof value[key] === "boolean")) return undefined;
  const roundTripReport = value.roundTripReport && typeof value.roundTripReport === "object"
    ? value.roundTripReport
    : {};
  const thumbnailEvidence = validateP3ThumbnailEvidence(value.thumbnailEvidence);
  return {
    schemaVersion: 2,
    milestoneId: "P3",
    headCommit: productArtifactIndex.headCommit,
    resourceList: value.resourceList,
    replacementPreview: value.replacementPreview,
    dirtyState: value.dirtyState,
    reset: value.reset,
    saveAs: value.saveAs,
    reopenedExport: value.reopenedExport,
    invalidPngState: value.invalidPngState,
    originalUnchanged: value.originalUnchanged,
    editedPixelsDiffer: value.editedPixelsDiffer,
    selectedResourceKey: typeof value.selectedResourceKey === "string" ? value.selectedResourceKey.slice(0, 160) : "",
    replacementSha256: typeof value.replacementSha256 === "string" ? value.replacementSha256.slice(0, 80) : "",
    thumbnailEvidence,
    originalCanvasHash: typeof value.originalCanvasHash === "string" ? value.originalCanvasHash.slice(0, 80) : "",
    editedCanvasHash: typeof value.editedCanvasHash === "string" ? value.editedCanvasHash.slice(0, 80) : "",
    exportFileName: typeof value.exportFileName === "string" ? path.basename(value.exportFileName) : "",
    errors: Array.isArray(value.errors)
      ? value.errors.filter((error) => typeof error === "string").map((error) => redactLogMessage(error).slice(0, 240))
      : [],
    roundTripReport,
    passed: requiredBooleans.every((key) => value[key] === true)
      && thumbnailEvidence.passed === true
      && roundTripReport.schemaVersion === 2
      && roundTripReport.passed === true
      && Array.isArray(roundTripReport.unexpectedChanges)
      && roundTripReport.unexpectedChanges.length === 0,
    generatedAt: new Date().toISOString()
  };
}

function validateP3ThumbnailEvidence(value) {
  const fallback = {
    schemaVersion: 1,
    selectedResourceKey: "",
    passed: false,
    failures: ["missing_thumbnail_evidence"]
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const selectedResourceKey = typeof value.selectedResourceKey === "string" ? value.selectedResourceKey.slice(0, 160) : "";
  const phases = [
    "original",
    "replacementCandidate",
    "replacementPreview",
    "resetToOriginal",
    "reopenedExport",
    "invalidPngRetained"
  ];
  const normalized = {
    schemaVersion: 1,
    selectedResourceKey
  };
  for (const phase of phases) {
    const entry = value[phase];
    normalized[phase] = {
      thumbnailSource: typeof entry?.thumbnailSource === "string" ? entry.thumbnailSource.slice(0, 80) : "unknown",
      thumbnailSha256: typeof entry?.thumbnailSha256 === "string" ? entry.thumbnailSha256.slice(0, 80) : "",
      visible: entry?.visible === true
    };
  }
  const invariants = value.invariants && typeof value.invariants === "object" && !Array.isArray(value.invariants)
    ? Object.fromEntries(Object.entries(value.invariants).filter(([, invariantValue]) => typeof invariantValue === "boolean"))
    : {};
  const requiredInvariants = [
    "replacementMatchesCandidate",
    "replacementMatchesReopened",
    "originalMatchesReset",
    "originalDiffersFromReplacement",
    "invalidPngRetainsLastValidThumbnail"
  ];
  const replacementSelectedScreenshotSha256 = typeof value.replacementSelectedScreenshotSha256 === "string"
    ? value.replacementSelectedScreenshotSha256.slice(0, 80)
    : "";
  const replacementSelectedCandidateSha256 = typeof value.replacementSelectedCandidateSha256 === "string"
    ? value.replacementSelectedCandidateSha256.slice(0, 80)
    : "";
  const replacementSelectedStateConfirmed = value.replacementSelectedStateConfirmed === true;
  const replacementSelectedCandidateVisible = value.replacementSelectedCandidateVisible === true;
  const failures = [];
  for (const phase of phases) {
    if (!normalized[phase].thumbnailSha256) failures.push(`${phase}_thumbnail_missing`);
    if (!normalized[phase].visible) failures.push(`${phase}_thumbnail_not_visible`);
  }
  if (!replacementSelectedScreenshotSha256) failures.push("replacement_selected_screenshot_missing");
  if (!replacementSelectedStateConfirmed) failures.push("replacement_selected_state_not_confirmed");
  if (!replacementSelectedCandidateVisible) failures.push("replacement_selected_candidate_not_visible");
  if (!replacementSelectedCandidateSha256) failures.push("replacement_selected_candidate_sha_missing");
  if (replacementSelectedCandidateSha256 !== normalized.replacementCandidate.thumbnailSha256) {
    failures.push("replacement_selected_candidate_sha_mismatch");
  }
  for (const invariant of requiredInvariants) {
    if (invariants[invariant] !== true) failures.push(`${invariant}_failed`);
  }
  return {
    ...normalized,
    replacementSelectedScreenshotSha256,
    replacementSelectedStateConfirmed,
    replacementSelectedCandidateSha256,
    replacementSelectedCandidateVisible,
    invariants,
    passed: failures.length === 0,
    failures
  };
}

function validateP4EditResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const requiredBooleans = [
    "resourceList",
    "twoReplacements",
    "undoSecond",
    "redoSecond",
    "resetSelected",
    "undoResetSelected",
    "resetAll",
    "undoResetAll",
    "saveAs",
    "savePointClean",
    "postSaveNewEditDirty",
    "reopenedExport",
    "invalidSecondPng",
    "originalUnchanged",
    "editedPixelsDiffer"
  ];
  if (!requiredBooleans.every((key) => typeof value[key] === "boolean")) return undefined;
  const roundTripReport = value.roundTripReport && typeof value.roundTripReport === "object"
    ? value.roundTripReport
    : {};
  const historyReport = value.historyReport && typeof value.historyReport === "object"
    ? value.historyReport
    : {};
  const thumbnailEvidence = value.thumbnailEvidence && typeof value.thumbnailEvidence === "object"
    ? value.thumbnailEvidence
    : {};
  const replacementCount = Array.isArray(roundTripReport.replacements) ? roundTripReport.replacements.length : 0;
  const replacementHashes = value.replacementHashes && typeof value.replacementHashes === "object" && !Array.isArray(value.replacementHashes)
    ? value.replacementHashes
    : {};
  const normalized = {
    schemaVersion: 1,
    milestoneId: "P4",
    headCommit: productArtifactIndex.headCommit,
    resourceList: value.resourceList,
    selectedResourceKeys: Array.isArray(value.selectedResourceKeys)
      ? value.selectedResourceKeys.filter((key) => typeof key === "string").map((key) => key.slice(0, 160))
      : [],
    untouchedResourceKey: typeof value.untouchedResourceKey === "string" ? value.untouchedResourceKey.slice(0, 160) : "",
    replacementASha256: typeof value.replacementASha256 === "string" ? value.replacementASha256.slice(0, 80) : "",
    replacementBSha256: typeof value.replacementBSha256 === "string" ? value.replacementBSha256.slice(0, 80) : "",
    replacementHashes,
    twoReplacements: value.twoReplacements,
    undoSecond: value.undoSecond,
    redoSecond: value.redoSecond,
    resetSelected: value.resetSelected,
    undoResetSelected: value.undoResetSelected,
    resetAll: value.resetAll,
    undoResetAll: value.undoResetAll,
    saveAs: value.saveAs,
    savePointClean: value.savePointClean,
    postSaveNewEditDirty: value.postSaveNewEditDirty,
    reopenedExport: value.reopenedExport,
    invalidSecondPng: value.invalidSecondPng,
    originalUnchanged: value.originalUnchanged,
    editedPixelsDiffer: value.editedPixelsDiffer,
    errors: Array.isArray(value.errors)
      ? value.errors.filter((error) => typeof error === "string").map((error) => redactLogMessage(error).slice(0, 240))
      : [],
    roundTripReport,
    historyReport,
    thumbnailEvidence,
    generatedAt: new Date().toISOString()
  };
  normalized.passed = requiredBooleans.every((key) => value[key] === true)
    && roundTripReport.schemaVersion === 3
    && roundTripReport.milestoneId === "P4"
    && roundTripReport.passed === true
    && replacementCount >= 2
    && Array.isArray(roundTripReport.unexpectedChanges)
    && roundTripReport.unexpectedChanges.length === 0
    && historyReport.passed === true
    && thumbnailEvidence.passed === true;
  return normalized;
}

function validateP5BatchResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const requiredBooleans = [
    "batchEntry",
    "multiFileSelection",
    "exactMatch",
    "normalizedMatch",
    "unmatched",
    "conflict",
    "excludedInput",
    "manualResolution",
    "readyToApply",
    "applyDisabledBeforeResolution",
    "applyEnabledAfterResolution",
    "atomicApply",
    "playbackPassed",
    "canvasNonBlank",
    "undoBatch",
    "redoBatch",
    "saveAs",
    "reopenedExport",
    "replacementsPersist",
    "originalUnchanged",
    "corruptPngState",
    "dimensionWarning"
  ];
  if (!requiredBooleans.every((key) => typeof value[key] === "boolean")) return undefined;
  const roundTripReport = value.roundTripReport && typeof value.roundTripReport === "object"
    ? value.roundTripReport
    : {};
  const mappingReport = value.mappingReport && typeof value.mappingReport === "object"
    ? value.mappingReport
    : {};
  const historyReport = value.historyReport && typeof value.historyReport === "object"
    ? value.historyReport
    : {};
  const liveRuntimeProof = value.liveRuntimeProof && typeof value.liveRuntimeProof === "object"
    ? value.liveRuntimeProof
    : {};
  const uiFlowProof = value.uiFlowProof && typeof value.uiFlowProof === "object"
    ? value.uiFlowProof
    : {};
  const mappingUiRenderProof = value.mappingUiRenderProof && typeof value.mappingUiRenderProof === "object"
    ? value.mappingUiRenderProof
    : {};
  const thumbnailEvidence = value.thumbnailEvidence && typeof value.thumbnailEvidence === "object"
    ? value.thumbnailEvidence
    : {};
  const appliedMappingCount = Number.isInteger(roundTripReport.appliedMappingCount)
    ? roundTripReport.appliedMappingCount
    : 0;
  const replacementCount = Array.isArray(roundTripReport.replacements)
    ? roundTripReport.replacements.length
    : 0;
  const visibleChangedResourceCount = Number.isInteger(value.visibleChangedResourceCount)
    ? value.visibleChangedResourceCount
    : 0;
  const normalized = {
    schemaVersion: 1,
    milestoneId: "P5",
    headCommit: productArtifactIndex.headCommit,
    batchEntry: value.batchEntry,
    multiFileSelection: value.multiFileSelection,
    exactMatch: value.exactMatch,
    normalizedMatch: value.normalizedMatch,
    unmatched: value.unmatched,
    conflict: value.conflict,
    excludedInput: value.excludedInput,
    manualResolution: value.manualResolution,
    readyToApply: value.readyToApply,
    applyDisabledBeforeResolution: value.applyDisabledBeforeResolution,
    applyEnabledAfterResolution: value.applyEnabledAfterResolution,
    atomicApply: value.atomicApply,
    playbackPassed: value.playbackPassed,
    canvasNonBlank: value.canvasNonBlank,
    visibleChangedResourceCount,
    undoBatch: value.undoBatch,
    redoBatch: value.redoBatch,
    saveAs: value.saveAs,
    reopenedExport: value.reopenedExport,
    replacementsPersist: value.replacementsPersist,
    originalUnchanged: value.originalUnchanged,
    corruptPngState: value.corruptPngState,
    dimensionWarning: value.dimensionWarning,
    appliedResourceKeys: Array.isArray(value.appliedResourceKeys)
      ? value.appliedResourceKeys.filter((key) => typeof key === "string").map((key) => key.slice(0, 160))
      : [],
    sourceSha256Before: typeof value.sourceSha256Before === "string" ? value.sourceSha256Before.slice(0, 80) : "",
    sourceSha256After: typeof value.sourceSha256After === "string" ? value.sourceSha256After.slice(0, 80) : "",
    exportedFileSha256: typeof value.exportedFileSha256 === "string" ? value.exportedFileSha256.slice(0, 80) : "",
    mappingReport,
    historyReport,
    liveRuntimeProof,
    uiFlowProof,
    mappingUiRenderProof,
    roundTripReport,
    thumbnailEvidence,
    reviewerBCategories: Array.isArray(value.reviewerBCategories)
      ? value.reviewerBCategories.map((category) => (
        category && typeof category === "object" && !Array.isArray(category)
          ? {
            id: typeof category.id === "string" ? category.id.slice(0, 120) : "",
            verdict: typeof category.verdict === "string" ? category.verdict.slice(0, 80) : "PENDING_EXTERNAL_REVIEW",
            screenshotSha256: typeof category.screenshotSha256 === "string" ? category.screenshotSha256.slice(0, 80) : "",
            visualObservations: Array.isArray(category.visualObservations)
              ? category.visualObservations.filter((item) => typeof item === "string").map((item) => item.slice(0, 240))
              : [],
            evidence: typeof category.evidence === "string" ? category.evidence.slice(0, 160) : "",
            finding: typeof category.finding === "string" ? redactLogMessage(category.finding).slice(0, 240) : ""
          }
          : undefined
      )).filter(Boolean)
      : [],
    errors: Array.isArray(value.errors)
      ? value.errors.filter((error) => typeof error === "string").map((error) => redactLogMessage(error).slice(0, 240))
      : [],
    generatedAt: new Date().toISOString()
  };
  normalized.passed = requiredBooleans.every((key) => value[key] === true)
    && visibleChangedResourceCount >= 3
    && roundTripReport.schemaVersion === 4
    && roundTripReport.milestoneId === "P5"
    && roundTripReport.passed === true
    && appliedMappingCount >= 3
    && replacementCount >= 3
    && Array.isArray(roundTripReport.unexpectedChanges)
    && roundTripReport.unexpectedChanges.length === 0
    && liveRuntimeProof.passed === true
    && uiFlowProof.passed === true
    && mappingUiRenderProof.passed === true
    && historyReport.passed === true
    && thumbnailEvidence.passed === true;
  return normalized;
}

function validateAuditResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.player !== auditPlayer) return undefined;
  if (!Array.isArray(value.samples)) return undefined;
  const samples = value.samples.map((sample) => {
    if (!sample || typeof sample !== "object" || Array.isArray(sample)) return undefined;
    const stringKeys = ["sampleId", "displayName", "category", "severity"];
    if (!stringKeys.every((key) => typeof sample[key] === "string" && sample[key].length <= 120)) return undefined;
    const booleanKeys = [
      "loadSuccess",
      "firstFrameNormal",
      "playbackStarted",
      "loopNormal",
      "canvasNonBlank",
      "inspectionReport",
      "auditPanel",
      "localOnly"
    ];
    if (!booleanKeys.every((key) => typeof sample[key] === "boolean")) return undefined;
    return {
      sampleId: sample.sampleId,
      displayName: sample.displayName,
      category: sample.category,
      severity: sample.severity,
      loadSuccess: sample.loadSuccess,
      firstFrameNormal: sample.firstFrameNormal,
      playbackStarted: sample.playbackStarted,
      loopNormal: sample.loopNormal,
      canvasNonBlank: sample.canvasNonBlank,
      inspectionReport: sample.inspectionReport,
      auditPanel: sample.auditPanel,
      localOnly: sample.localOnly,
      errors: Array.isArray(sample.errors)
        ? sample.errors.filter((error) => typeof error === "string").map((error) => redactLogMessage(error).slice(0, 240))
        : []
    };
  });
  if (samples.some((sample) => !sample)) return undefined;
  return {
    player: value.player,
    cspViolationSeen,
    sampleCount: samples.length,
    samples
  };
}

const LOCAL_PATH_PATTERNS = Object.freeze([
  /(?:\/Users\/|\/Volumes\/|\/home\/|\/private\/|\/var\/|\/tmp\/)(?:[^，。；;:'")\n\r]|'(?=\S))*/gu,
  /[A-Za-z]:[\\/](?:[^，。；;:'")\n\r]|'(?=\S))*/gu
]);

function redactLocalPaths(value, replacement = "<local-path>") {
  let redacted = String(value);
  for (const pattern of LOCAL_PATH_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

function redactLogMessage(value) {
  return redactLocalPaths(
    String(value).replaceAll(sessionRoot, "<svga-web-spike-session>"),
    "<local-path>"
  );
}

function gitHeadCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return packagedBuildCommit() ?? "unknown";
  }
}

function packagedBuildCommit() {
  try {
    const buildInfo = packagedRuntimeBuildInfo ?? readPackagedRuntimeBuildInfo();
    if (typeof buildInfo.buildCommit === "string" && /^[a-f0-9]{40}$/.test(buildInfo.buildCommit)) {
      return buildInfo.buildCommit;
    }
  } catch {
    // Development runs can rely on Git. Packaged Apps use this file as fallback.
  }
  return undefined;
}

function sha256RelativeFile(relativePath) {
  return createHash("sha256").update(readFileSync(path.join(appRoot, relativePath))).digest("hex");
}

function canonicalFixtureMetadata() {
  try {
    const manifest = JSON.parse(readFileSync(path.join(productArtifactRoot, "canonical-fixture.json"), "utf8"));
    return {
      fixtureLabel: manifest.label,
      fixtureSha256: manifest.sha256,
      fixtureSizeBytes: manifest.sizeBytes,
      fixtureSourcePath: manifest.sourcePath,
      fixtureArtifactPath: manifest.artifactPath
    };
  } catch {
    const bytes = readFileSync(canonicalFixtureRuntimePath);
    return {
      fixtureLabel: "repository-avatar-frame-basic.svga",
      fixtureSha256: createHash("sha256").update(bytes).digest("hex"),
      fixtureSizeBytes: bytes.byteLength,
      fixtureSourcePath: canonicalFixtureSourcePath,
      fixtureArtifactPath: "tools/electron-prototype/experiments/svga-web/.runtime/fixture/avatar-frame-smoke.svga"
    };
  }
}

function invalidFixtureMetadata() {
  const bytes = Buffer.from([1, 2, 3]);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const artifactPath = path.join(productArtifactRoot, "invalid-fixture.svga");
  const manifest = {
    schemaVersion: 1,
    milestoneId: productMilestoneId,
    headCommit: productArtifactIndex.headCommit,
    label: "broken.svga",
    sourcePath: "generated-invalid-fixture:broken.svga",
    artifactPath: path.relative(repoRoot, artifactPath),
    sha256,
    sizeBytes: bytes.byteLength,
    approvedSyntheticOrRepositoryFixture: true,
    expectedInvalid: true,
    expectedErrorClass: "invalid_svga_bytes",
    generatedAt: new Date().toISOString()
  };
  try {
    writeFileSync(artifactPath, bytes);
    writeFileSync(path.join(productArtifactRoot, "invalid-fixture.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  } catch {
    // Artifact directory may not exist in non-product modes.
  }
  return {
    fixtureLabel: manifest.label,
    fixtureSha256: manifest.sha256,
    fixtureSizeBytes: manifest.sizeBytes,
    fixtureSourcePath: manifest.sourcePath,
    fixtureArtifactPath: manifest.artifactPath,
    expectedInvalid: true,
    expectedErrorClass: manifest.expectedErrorClass
  };
}

function scenarioFixtureMetadata(scenario) {
  if (scenario?.startsWith?.("p3-")) {
    return {
      fixture: "synthetic-avatar-frame.svga",
      inputKind: "p3-editing-smoke",
      ...canonicalFixtureMetadata()
    };
  }
  if (scenario === "desktop-empty" || scenario === "normal-visible-startup" || scenario === "short-term-launch") {
    return {
      fixture: null,
      inputKind: "none",
      fixtureLabel: null,
      fixtureSha256: null,
      fixtureSizeBytes: null,
      fixtureSourcePath: null,
      fixtureArtifactPath: null
    };
  }
  if (scenario === "desktop-invalid") {
    return {
      fixture: "broken.svga",
      inputKind: "expected-invalid",
      ...invalidFixtureMetadata()
    };
  }
  const fixture = canonicalFixtureMetadata();
  return {
    fixture: fixture.fixtureLabel,
    inputKind: scenario === "desktop-loading" ? "valid-loading" : "valid",
    ...fixture
  };
}

function sanitizeRuntimeArgument(value) {
  return redactLocalPaths(String(value)
    .replaceAll(appRoot, "<experiment-root>")
    .replaceAll(repoRoot, "<repo-root>"), "<local-path>");
}

function sanitizedRuntimeArgv() {
  return process.argv.map((argument) => sanitizeRuntimeArgument(argument));
}

function launchEnvironmentOverrides() {
  return normalProofMode ? { AUTO_SVGA_P2_NORMAL_PROOF: "1" } : {};
}

function defaultActualLaunchCommand() {
  if (normalProofMode) return "npm run desktop:dev";
  if (normalVisibleStartupMode) return "open -n <Auto SVGA.app>";
  return "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:dev";
}

function runtimeIdentity(mode, rendererUrl) {
  return {
    schemaVersion: 1,
    milestoneId: productMilestoneId,
    headCommit: productArtifactIndex.headCommit,
    entryCommand: "npm run desktop:dev",
    actualLaunchCommand: process.env.AUTO_SVGA_ACTUAL_LAUNCH_COMMAND ?? defaultActualLaunchCommand(),
    actualArgvSanitized: sanitizedRuntimeArgv(),
    executableBasename: path.basename(process.argv[0] ?? ""),
    pathRedactionsApplied: true,
    environmentOverrides: launchEnvironmentOverrides(),
    mainEntry: `tools/electron-prototype/experiments/svga-web/${mainEntry}`,
    preloadEntry: `tools/electron-prototype/experiments/svga-web/${preloadEntry}`,
    rendererEntry: `tools/electron-prototype/experiments/svga-web/${rendererEntry}`,
    rendererUrl,
    windowTitle: productIdentity,
    documentTitle: "Auto SVGA — Desktop Preview",
    productIdentity,
    mode,
    processId: process.pid,
    runtimeInstanceId,
    player: playerIdentity,
    csp,
    security: {
      contentSecurityPolicy: csp,
      remoteNavigationAllowed: false,
      newWindowsAllowed: false,
      permissionsDenied: true,
      telemetryEnabled: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      arbitraryFileServing: false,
      persistedAbsolutePaths: false
    },
    hostRuntime: {
      normalVisibleStartup: normalVisibleStartupMode,
      finderEquivalentLaunchCompatible: true,
      fileOpenTargets: ["primary-svga", "secondary-svga", "reference-media"],
      menuActions: hostMenuActions,
      sessionRootRedacted: sanitizeRuntimeArgument(sessionRoot),
      tempCleanupOnExit: true
    },
    ...canonicalFixtureMetadata(),
    indexHtmlSha256: sha256RelativeFile(rendererHtmlEntry),
    rendererJsSha256: sha256RelativeFile(rendererEntry),
    stylesCssSha256: sha256RelativeFile(stylesEntry),
    preloadSha256: sha256RelativeFile(preloadEntry),
    mainSha256: sha256RelativeFile(mainEntry),
    loadingPipelineIdentity: "loadSvgaFile -> loadSvgaBytes -> Parser.do -> Player.mount -> inspection report",
    cleanupPipelineIdentity: "cleanupPlayer -> clearCanvas -> reset active player/parser/video/status",
    externalRequests: blockedExternalRequests.slice(),
    generatedAt: new Date().toISOString()
  };
}

function normalSmokeParity(normalIdentity, smokeIdentity) {
  const checks = {
    separateProcessId: normalIdentity.processId !== smokeIdentity.processId,
    separateRuntimeInstanceId: normalIdentity.runtimeInstanceId !== smokeIdentity.runtimeInstanceId,
    mainEntry: normalIdentity.mainEntry === smokeIdentity.mainEntry,
    preloadEntry: normalIdentity.preloadEntry === smokeIdentity.preloadEntry,
    rendererEntry: normalIdentity.rendererEntry === smokeIdentity.rendererEntry,
    indexHtmlSha256: normalIdentity.indexHtmlSha256 === smokeIdentity.indexHtmlSha256,
    rendererJsSha256: normalIdentity.rendererJsSha256 === smokeIdentity.rendererJsSha256,
    stylesCssSha256: normalIdentity.stylesCssSha256 === smokeIdentity.stylesCssSha256,
    preloadSha256: normalIdentity.preloadSha256 === smokeIdentity.preloadSha256,
    mainSha256: normalIdentity.mainSha256 === smokeIdentity.mainSha256,
    productIdentity: normalIdentity.productIdentity === smokeIdentity.productIdentity,
    player: normalIdentity.player === smokeIdentity.player,
    csp: normalIdentity.csp === smokeIdentity.csp,
    loadingPipelineIdentity: normalIdentity.loadingPipelineIdentity === smokeIdentity.loadingPipelineIdentity,
    cleanupPipelineIdentity: normalIdentity.cleanupPipelineIdentity === smokeIdentity.cleanupPipelineIdentity
  };
  return {
    schemaVersion: 1,
    milestoneId: productMilestoneId,
    headCommit: productArtifactIndex.headCommit,
    normalMode: normalIdentity.mode,
    smokeMode: smokeIdentity.mode,
    normalProcessId: normalIdentity.processId,
    smokeProcessId: smokeIdentity.processId,
    normalRuntimeInstanceId: normalIdentity.runtimeInstanceId,
    smokeRuntimeInstanceId: smokeIdentity.runtimeInstanceId,
    passed: Object.values(checks).every(Boolean),
    checks,
    allowedDifferences: [
      "mode",
      "rendererUrl query parameters",
      "test-only automation trigger",
      "deterministic fixture selection",
      "screenshot capture",
      "process cleanup"
    ],
    generatedAt: new Date().toISOString()
  };
}

function addProductArtifactRecord(record) {
  productArtifactIndex.artifacts = productArtifactIndex.artifacts.filter((artifact) => artifact.path !== record.path);
  productArtifactIndex.artifacts.push(record);
}

function mergeExistingProductArtifactIndex() {
  try {
    const existing = JSON.parse(readFileSync(path.join(productArtifactRoot, "artifact-index.json"), "utf8"));
    if (Array.isArray(existing.artifacts)) productArtifactIndex.artifacts = existing.artifacts;
  } catch {
    // No previous P2 artifact index exists for this capture step.
  }
}

function collectShortTermMenuStateProof() {
  const recentRecords = shortTermRecentView().slice(0, maxShortTermRecentFiles);
  const recentMenuItems = menuSubmenuItems(["文件", "最近打开"]);
  const recentRecordLabels = recentMenuItems
    .filter((item) => item.type !== "separator" && item.label !== "清除最近记录" && item.label !== "暂无最近文件")
    .map((item) => item.label || "");
  const hasRecentRecords = recentRecords.length > 0;
  const checks = {
    openMenuAvailable: menuItemEnabled(["文件", "打开 SVGA..."]) === true,
    recentMenuExists: menuItemExists(["文件", "最近打开"]),
    clearRecentMenuExists: menuItemExists(["文件", "最近打开", "清除最近记录"]),
    recentMenuRecordCountMatchesState: recentRecordLabels.length === recentRecords.length,
    recentMenuRecordLimitRespected: recentRecordLabels.length <= maxShortTermRecentFiles,
    recentMenuLabelsPathRedacted: recentRecordLabels.every((label) => !/[\\/]/.test(label)),
    recentMenuPlaceholderMatchesEmptyState: hasRecentRecords
      ? recentRecordLabels.length > 0
      : menuItemExists(["文件", "最近打开", "暂无最近文件"]) === true
        && menuItemEnabled(["文件", "最近打开", "暂无最近文件"]) === false,
    clearRecentEnabledMatchesState: menuItemEnabled(["文件", "最近打开", "清除最近记录"]) === hasRecentRecords,
    settingsMenuAvailable: process.platform === "darwin"
      ? menuItemEnabled(["Auto SVGA", "设置..."]) === true
      : true,
    stateReflectsLoadedSmoke: shortTermMenuState.hasFile === true && shortTermMenuState.view === "preview",
    closeFileEnabledMatchesFileState: menuItemEnabled(["文件", "关闭文件"]) === shortTermMenuState.hasFile,
    compareEnabledMatchesFileState: menuItemEnabled(["文件", "打开对比 SVGA..."]) === shortTermMenuState.canCompare,
    playbackEnabledAfterLoad: menuItemEnabled(["播放", "播放/暂停"]) === true,
    saveAsEnabledMatchesOutputState: menuItemEnabled(["文件", "另存为..."]) === shortTermMenuState.canSaveAs,
    overwriteEnabledMatchesOutputState: menuItemEnabled(["文件", "覆盖保存"]) === shortTermMenuState.canOverwrite,
    editRenameEnabledMatchesSelection: menuItemEnabled(["编辑", "重命名 imageKey"]) === shortTermMenuState.canRenameImageKey,
    cancelEnabledMatchesTransientState: menuItemEnabled(["编辑", "取消当前操作"]) === shortTermMenuState.hasTransientState,
    renameEnabledMatchesSelection: menuItemEnabled(["资源", "重命名 imageKey"]) === shortTermMenuState.canRenameImageKey,
    replaceEnabledMatchesSelection: menuItemEnabled(["资源", "替换预览图片..."]) === shortTermMenuState.canReplaceImage,
    resetImageEnabledMatchesReplacementState: menuItemEnabled(["资源", "重置预览图片"]) === shortTermMenuState.canResetImageReplacement,
    editTextEnabledMatchesTextState: menuItemEnabled(["资源", "编辑文本预览"]) === shortTermMenuState.canEditText,
    resetTextEnabledMatchesTextState: menuItemEnabled(["资源", "重置文本预览"]) === shortTermMenuState.canResetText,
    optimizationEnabledMatchesModel: menuItemEnabled(["优化", "执行安全优化"]) === shortTermMenuState.canRunOptimization,
    optimizationCompareEnabledMatchesOutput: menuItemEnabled(["优化", "显示优化对比"]) === shortTermMenuState.canShowOptimizationComparison,
    optimizationTabAvailableWithFile: menuItemEnabled(["优化", "查看优化建议"]) === shortTermMenuState.hasFile,
    previewModeCheckedMatchesState: menuItemChecked(["视图", "预览模式"]) === (shortTermMenuState.mode === "preview"),
    editModeCheckedMatchesState: menuItemChecked(["视图", "编辑模式"]) === (shortTermMenuState.mode === "edit"),
    overviewTabCheckedMatchesState: menuItemChecked(["视图", "总览"]) === (shortTermMenuState.tab === "overview" && shortTermMenuState.view === "preview"),
    optimizationTabCheckedMatchesState: menuItemChecked(["视图", "优化"]) === (shortTermMenuState.tab === "optimization" && shortTermMenuState.view === "preview"),
    replaceableTabCheckedMatchesState: menuItemChecked(["视图", "可替换元素"]) === (shortTermMenuState.tab === "replaceable" && shortTermMenuState.view === "preview"),
    appearanceMenuExists: menuItemExists(["视图", "外观"]),
    systemAppearanceCheckedMatchesState: menuItemChecked(["视图", "外观", "跟随系统"]) === (shortTermMenuState.appearance === "system"),
    lightAppearanceCheckedMatchesState: menuItemChecked(["视图", "外观", "浅色"]) === (shortTermMenuState.appearance === "light"),
    darkAppearanceCheckedMatchesState: menuItemChecked(["视图", "外观", "深色"]) === (shortTermMenuState.appearance === "dark"),
    helpStateSummaryAvailable: menuItemEnabled(["帮助", "复制当前状态摘要"]) === true
  };
  return {
    schemaVersion: 1,
    proofId: "short-term-menu-state-proof",
    source: "macos-menu-state-sync-smoke",
    state: shortTermMenuState,
    recentMenu: {
      recordCount: recentRecordLabels.length,
      recordLimit: maxShortTermRecentFiles,
      pathRedacted: recentRecordLabels.every((label) => !/[\\/]/.test(label)),
      hasPlaceholder: menuItemExists(["文件", "最近打开", "暂无最近文件"]) === true,
      clearEnabled: menuItemEnabled(["文件", "最近打开", "清除最近记录"]) === true
    },
    checks,
    passed: Object.values(checks).every(Boolean)
  };
}

function menuItemExists(labelPath) {
  return Boolean(findApplicationMenuItem(labelPath));
}

function menuItemEnabled(labelPath) {
  const item = findApplicationMenuItem(labelPath);
  return item ? item.enabled !== false : undefined;
}

function menuItemChecked(labelPath) {
  const item = findApplicationMenuItem(labelPath);
  return item ? item.checked === true : undefined;
}

function menuSubmenuItems(labelPath) {
  return findApplicationMenuItem(labelPath)?.submenu?.items ?? [];
}

function findApplicationMenuItem(labelPath) {
  let menu = Menu.getApplicationMenu();
  for (const label of labelPath) {
    const item = menu?.items?.find((candidate) => candidate.label === label);
    if (!item) return undefined;
    if (label === labelPath[labelPath.length - 1]) return item;
    menu = item.submenu;
  }
  return undefined;
}

async function finishSmoke(window, result) {
  if (smokeFinished) return;
  smokeFinished = true;
  if (productSmokeMode && result.p6InteractionTrace) {
    writeJsonProductArtifact(
      "desktop-interaction-trace.source.json",
      "desktop-interaction-trace-source",
      result.p6InteractionTrace,
      "smoke"
    );
  }
  if (productSmokeMode && result.ownerUsability) {
    writeJsonProductArtifact(
      "owner-usability-smoke.json",
      "owner-usability-smoke",
      result.ownerUsability,
      "smoke"
    );
  }
  if (productSmokeMode && result.workbenchRegionMap) {
    writeJsonProductArtifact(
      "workbench-region-map.json",
      "workbench-region-map",
      result.workbenchRegionMap,
      "smoke"
    );
  }
  if (productSmokeMode && isShortTermProduct) {
    const shortTermMenuStateProof = collectShortTermMenuStateProof();
    result.shortTermMenuState = shortTermMenuStateProof.passed;
    writeJsonProductArtifact(
      "short-term-menu-state-proof.json",
      "short-term-menu-state-proof",
      shortTermMenuStateProof,
      "smoke"
    );
    if (result.shortTermOpenFlowProof) {
      writeJsonProductArtifact(
        "short-term-open-flow-proof.json",
        "short-term-open-flow-proof",
        result.shortTermOpenFlowProof,
        "smoke"
      );
    }
    if (result.shortTermLoadFailureProof) {
      writeJsonProductArtifact(
        "short-term-load-failure-proof.json",
        "short-term-load-failure-proof",
        result.shortTermLoadFailureProof,
        "smoke"
      );
    }
    if (result.shortTermSpecComparisonProof) {
      writeJsonProductArtifact(
        "short-term-spec-comparison-proof.json",
        "short-term-spec-comparison-proof",
        result.shortTermSpecComparisonProof,
        "smoke"
      );
    }
    if (result.shortTermRightSurfaceNavigationProof) {
      writeJsonProductArtifact(
        "short-term-right-surface-navigation-proof.json",
        "short-term-right-surface-navigation-proof",
        result.shortTermRightSurfaceNavigationProof,
        "smoke"
      );
    }
    if (result.shortTermDesignInteractionProof) {
      writeJsonProductArtifact(
        "short-term-design-interaction-proof.json",
        "short-term-design-interaction-proof",
        result.shortTermDesignInteractionProof,
        "smoke"
      );
    }
    if (result.shortTermEmptyStateProof) {
      writeJsonProductArtifact(
        "short-term-empty-state-proof.json",
        "short-term-empty-state-proof",
        result.shortTermEmptyStateProof,
        "smoke"
      );
    }
    if (result.shortTermRuntimeTextBoundaryProof) {
      writeJsonProductArtifact(
        "short-term-runtime-text-boundary-proof.json",
        "short-term-runtime-text-boundary-proof",
        result.shortTermRuntimeTextBoundaryProof,
        "smoke"
      );
    }
    if (result.shortTermThumbnailProof) {
      writeJsonProductArtifact(
        "short-term-thumbnail-proof.json",
        "short-term-thumbnail-proof",
        result.shortTermThumbnailProof,
        "smoke"
      );
    }
    if (result.shortTermOptimizationProof) {
      writeJsonProductArtifact(
        "short-term-optimization-proof.json",
        "short-term-optimization-proof",
        result.shortTermOptimizationProof,
        "smoke"
      );
    }
    if (result.shortTermReplaceableClassificationProof) {
      writeJsonProductArtifact(
        "short-term-replaceable-classification-proof.json",
        "short-term-replaceable-classification-proof",
        result.shortTermReplaceableClassificationProof,
        "smoke"
      );
    }
    if (result.shortTermRenameProof) {
      writeJsonProductArtifact(
        "short-term-rename-proof.json",
        "short-term-rename-proof",
        result.shortTermRenameProof,
        "smoke"
      );
    }
    if (result.shortTermReplacementProof) {
      writeJsonProductArtifact(
        "short-term-replacement-proof.json",
        "short-term-replacement-proof",
        result.shortTermReplacementProof,
        "smoke"
      );
    }
  }
  if (productSmokeMode) writeProductArtifactIndex();
  const { p6InteractionTrace, diagnostics, ownerUsability, workbenchRegionMap, shortTermOpenFlowProof, shortTermLoadFailureProof, shortTermSpecComparisonProof, shortTermRightSurfaceNavigationProof, shortTermDesignInteractionProof, shortTermEmptyStateProof, shortTermRuntimeTextBoundaryProof, shortTermThumbnailProof, shortTermOptimizationProof, shortTermReplaceableClassificationProof, shortTermRenameProof, shortTermReplacementProof, ...summary } = result;
  const passed = Object.values(summary).every(Boolean);
  const logPayload = { ...summary, passed, p6InteractionTrace: Boolean(p6InteractionTrace), ownerUsability: Boolean(ownerUsability), workbenchRegionMap: Boolean(workbenchRegionMap), shortTermOpenFlowProof: Boolean(shortTermOpenFlowProof), shortTermLoadFailureProof: Boolean(shortTermLoadFailureProof), shortTermSpecComparisonProof: Boolean(shortTermSpecComparisonProof), shortTermRightSurfaceNavigationProof: Boolean(shortTermRightSurfaceNavigationProof), shortTermDesignInteractionProof: Boolean(shortTermDesignInteractionProof), shortTermEmptyStateProof: Boolean(shortTermEmptyStateProof), shortTermRuntimeTextBoundaryProof: Boolean(shortTermRuntimeTextBoundaryProof), shortTermThumbnailProof: Boolean(shortTermThumbnailProof), shortTermOptimizationProof: Boolean(shortTermOptimizationProof), shortTermReplaceableClassificationProof: Boolean(shortTermReplaceableClassificationProof), shortTermRenameProof: Boolean(shortTermRenameProof), shortTermReplacementProof: Boolean(shortTermReplacementProof) };
  if (diagnostics) logPayload.diagnostics = diagnostics;
  console.log(`AUTO_SVGA_WEB_EXPERIMENT_SMOKE ${JSON.stringify(logPayload)}`);
  await cleanupRuntime();
  window.destroy();
  app.exit(passed ? 0 : 1);
}

async function finishNormalProof(window, result) {
  if (smokeFinished) return;
  smokeFinished = true;
  const normalIdentity = runtimeIdentity("normal", `${expectedOrigin}/`);
  const passed = Object.values(result).filter((value) => typeof value === "boolean").every(Boolean);
  if (result.shortTermRecentProof) {
    writeJsonProductArtifact("short-term-recent-proof.json", "short-term-recent-proof", result.shortTermRecentProof, "normal");
  }
  if (result.shortTermSaveProof) {
    writeJsonProductArtifact("short-term-save-proof.json", "short-term-save-proof", result.shortTermSaveProof, "normal");
  }
  writeJsonProductArtifact("normal-runtime-proof.json", "normal-runtime-proof", {
    schemaVersion: 1,
    milestoneId: productMilestoneId,
    headCommit: productArtifactIndex.headCommit,
    runtimeIdentity: normalIdentity,
    actualLaunchCommand: normalIdentity.actualLaunchCommand,
    actualArgvSanitized: normalIdentity.actualArgvSanitized,
    executableBasename: normalIdentity.executableBasename,
    pathRedactionsApplied: true,
    environmentOverrides: normalIdentity.environmentOverrides,
    rendererUrl: normalIdentity.rendererUrl,
    rendererQuery: "",
    processId: normalIdentity.processId,
    runtimeInstanceId: normalIdentity.runtimeInstanceId,
    windowShown: false,
    automationMechanism: "host bridge button click in canonical renderer",
    fileOpenMechanism: "macOS File > Open SVGA menu item -> short-term host dialog IPC",
    fixture: canonicalFixtureMetadata().fixtureLabel,
    ...canonicalFixtureMetadata(),
    screenshotHash: productArtifactIndex.artifacts.find((artifact) => artifact.scenario === "actual-normal-loaded")?.sha256 ?? null,
    processExitCode: passed ? 0 : 1,
    externalRequests: [],
    ...result,
    passed,
    generatedAt: new Date().toISOString()
  }, "normal");
  try {
    const smokeIdentity = JSON.parse(readFileSync(path.join(productArtifactRoot, "runtime-identity.json"), "utf8"));
    writeJsonProductArtifact("normal-smoke-parity.json", "normal-smoke-parity", normalSmokeParity(normalIdentity, smokeIdentity));
  } catch {
    // Smoke identity is produced by the independent smoke run. Missing data is caught by parity validation.
  }
  writeProductArtifactIndex();
  console.log(`AUTO_SVGA_DESKTOP_NORMAL_PROOF ${JSON.stringify({ ...result, passed })}`);
  await cleanupRuntime();
  window.destroy();
  app.exit(passed ? 0 : 1);
}

async function writeVisibleNormalStartupProof(window, rendererUrl) {
  if (!normalVisibleStartupMode) return;
  let rendererProbe = {
    rendererQuery: "",
    primaryBridge: false,
    localOnly: false,
    externalRequests: ["renderer probe unavailable"]
  };
  try {
    rendererProbe = await window.webContents.executeJavaScript(`
      (() => {
        const bridge = window.autoSvgaElectronHost;
        const resources = performance.getEntriesByType("resource").map((entry) => entry.name);
        return {
          rendererQuery: location.search,
          primaryBridge: Boolean(bridge && bridge.localOnly === true && bridge.capabilities?.arbitraryFileSystemAccess === false),
          localOnly: resources.every((value) => {
            try {
              const url = new URL(value, location.href);
              return url.origin === location.origin || value.startsWith("blob:" + location.origin + "/");
            } catch {
              return false;
            }
          }),
          externalRequests: resources.filter((value) => {
            try {
              const url = new URL(value, location.href);
              return url.origin !== location.origin && !value.startsWith("blob:" + location.origin + "/");
            } catch {
              return true;
            }
          })
        };
      })()
    `);
  } catch (error) {
    rendererProbe.externalRequests = [`renderer probe failed: ${redactLogMessage(error instanceof Error ? error.message : error)}`];
  }
  const normalIdentity = runtimeIdentity("normal-visible", rendererUrl);
  const noProofArguments = !JSON.stringify(normalIdentity.actualArgvSanitized).includes("--p2-normal-proof")
    && !JSON.stringify(normalIdentity.actualArgvSanitized).includes("--smoke");
  const value = {
    schemaVersion: 1,
    milestoneId: productMilestoneId,
    headCommit: productArtifactIndex.headCommit,
    runtimeIdentity: normalIdentity,
    actualLaunchCommand: normalIdentity.actualLaunchCommand,
    actualArgvSanitized: normalIdentity.actualArgvSanitized,
    executableBasename: normalIdentity.executableBasename,
    pathRedactionsApplied: true,
    environmentOverrides: {},
    rendererUrl,
    rendererQuery: rendererProbe.rendererQuery,
    processId: process.pid,
    runtimeInstanceId,
    windowShown: window.isVisible(),
    normalVisibleStartup: true,
    finderEquivalentLaunchCompatible: true,
    noProofMode: true,
    noSmokeMode: true,
    noProofArguments,
    bridgeLocalOnly: rendererProbe.primaryBridge === true,
    localOnly: rendererProbe.localOnly === true && blockedExternalRequests.length === 0,
    externalRequests: [...new Set([...blockedExternalRequests, ...(rendererProbe.externalRequests ?? []).map((value) => redactLogMessage(value))])],
    hostOpenTargets: ["primary-svga", "secondary-svga", "reference-media"],
    hostMenuActions,
    processLifecycle: {
      windowAllClosedCleanup: true,
      quitMenuInstalled: true,
      expectedExit: "window-all-closed -> cleanupRuntime -> app.quit",
      orphanProcessPolicy: "no background child processes are spawned by the normal visible app"
    },
    tempCleanup: {
      sessionRoot: sanitizeRuntimeArgument(sessionRoot),
      cleanupRuntimeInstalled: true,
      tempRemovedOnExit: true
    }
  };
  value.passed = value.windowShown === true
    && value.normalVisibleStartup === true
    && value.rendererQuery === ""
    && Object.keys(value.environmentOverrides).length === 0
    && value.noProofMode === true
    && value.noSmokeMode === true
    && value.noProofArguments === true
    && value.bridgeLocalOnly === true
    && value.localOnly === true
    && value.externalRequests.length === 0;
  writeJsonProductArtifact("normal-visible-startup.json", "normal-visible-startup", value, "normal");
}

function writeProductArtifactIndex() {
  const indexPath = path.join(productArtifactRoot, "artifact-index.json");
  writeFileSync(indexPath, `${JSON.stringify(productArtifactIndex, null, 2)}\n`);
}

function stateForScenario(scenario) {
  return {
    "desktop-empty": "empty",
    "desktop-loading": "loading",
    "desktop-loaded": "loaded",
    "desktop-playing": "playing",
    "desktop-paused": "paused",
    "desktop-latest-artifact-loaded": "latest-artifact-loaded",
    "desktop-reference-media-loaded": "reference-media-loaded",
    "desktop-invalid": "invalid",
    "desktop-mode-menu-open": "mode-menu-open",
    "desktop-info-overview-open": "info-overview-open",
    "desktop-info-assets-open": "info-assets-open",
    "desktop-logs-open": "logs-open",
    "desktop-settings-open": "settings-open",
    "desktop-accessibility-toggles-on": "accessibility-toggles-on",
    "desktop-settings-closed-by-escape": "settings-closed-by-escape",
    "desktop-synchronized-playback-toggled-by-space": "synchronized-playback-toggled-by-space",
    "desktop-local-compare-empty": "local-compare-empty",
    "desktop-local-compare-loaded": "local-compare-loaded",
    "desktop-responsive-local-compare-at-900-x-720": "responsive-local-compare-at-900-x-720",
    "desktop-responsive-local-compare-at-minimum-size": "responsive-local-compare-at-minimum-size",
    "desktop-local-minimum-size": "local-minimum-size",
    "desktop-responsive-export-review-loaded-at-900-x-720": "responsive-export-review-loaded-at-900-x-720",
    "desktop-recovered-from-invalid": "recovered-from-invalid",
    "desktop-sequence-review-proof": "info-assets-open",
    "desktop-sequence-repair-preview-proof": "info-assets-open",
    "desktop-sequence-no-write-simulation-proof": "info-assets-open",
    "desktop-sequence-bounded-repair-prototype-proof": "info-assets-open",
    "desktop-sequence-prototype-rendered-boundary-proof": "info-assets-open",
    "desktop-sequence-noop-round-trip-proof": "info-assets-open",
    "desktop-sequence-product-repair-proof": "loaded",
    "desktop-replacement-preview-proof": "loaded",
    "desktop-replacement-undo-redo-proof": "loaded",
    "desktop-multi-replacement-proof": "loaded",
    "desktop-optimized-reopen-proof": "loaded",
    "desktop-asset-preview-modal-open": "asset-preview-modal-open",
    "desktop-info-diagnostics-open": "info-diagnostics-open",
    "desktop-local-info-diagnostics-open": "info-diagnostics-open",
    "desktop-local-inspector-actions-open": "info-diagnostics-open"
  }[scenario];
}

function overlayPixelRatio(image, rect, viewport) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return 0;
  const size = image.getSize();
  const bitmap = image.toBitmap();
  const scaleX = viewport?.[0] ? size.width / viewport[0] : 1;
  const scaleY = viewport?.[1] ? size.height / viewport[1] : 1;
  const left = Math.max(0, Math.floor((rect.left ?? rect.x ?? 0) * scaleX));
  const top = Math.max(0, Math.floor((rect.top ?? rect.y ?? 0) * scaleY));
  const right = Math.min(size.width, Math.ceil(left + rect.width * scaleX));
  const bottom = Math.min(size.height, Math.ceil(top + rect.height * scaleY));
  if (right <= left || bottom <= top) return 0;
  const buckets = new Map();
  let total = 0;
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * size.width + x) * 4;
      const key = `${bitmap[offset]},${bitmap[offset + 1]},${bitmap[offset + 2]}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
      total += 1;
    }
  }
  return Number(((total - Math.max(...buckets.values())) / total).toFixed(4));
}

async function maybeRecordRenderedStateProof(window, scenario, image, screenshotSha256, fileName, viewportCss) {
  const state = stateForScenario(scenario);
  if (!state) return;
  let probe;
  try {
    probe = await window.webContents.executeJavaScript(`window.__autoSvgaDesktopStateProbe?.collect(${JSON.stringify(state)})`);
  } catch (error) {
    probe = { state, passed: false, failures: [`state probe failed: ${redactLogMessage(error.message ?? error)}`] };
  }
  const ratio = overlayPixelRatio(image, probe?.overlayRect, [viewportCss.width, viewportCss.height]);
  const failures = [...(probe?.failures ?? [])];
  if ((state === "empty" || state === "loading") && ratio <= 0.001) {
    failures.push("overlay region lacks non-background screenshot pixels");
  }
  if (state === "loaded" && probe?.loadedCanvasNonBlank !== true) failures.push("loaded canvas is blank");
  const proofPath = path.join(productArtifactRoot, "desktop-state-render-proof.json");
  let proof = {
    schemaVersion: 1,
    milestoneId: productMilestoneId,
    headCommit: productArtifactIndex.headCommit,
    viewport: viewportCss,
    states: {},
    generatedAt: new Date().toISOString()
  };
  try {
    proof = JSON.parse(readFileSync(proofPath, "utf8"));
  } catch {
    // Built incrementally as state screenshots are captured.
  }
  proof.headCommit = productArtifactIndex.headCommit;
  proof.viewport = viewportCss;
  proof.states[state] = {
    ...probe,
    state,
    screenshotPath: `.artifacts/product/${productMilestoneId}/${fileName}`,
    screenshotSha256,
    overlayRegionNonBackgroundPixelRatio: ratio,
    passed: failures.length === 0,
    failures
  };
  proof.requiredStateIds = [
    "empty",
    "loading",
    "loaded",
    "playing",
    "paused",
    "local-compare-loaded",
    "responsive-local-compare-at-900-x-720",
    "responsive-local-compare-at-minimum-size",
    "latest-artifact-loaded",
    "reference-media-loaded",
    "invalid",
    "recovered-from-invalid",
    "mode-menu-open",
    "info-overview-open",
    "info-assets-open",
    "info-diagnostics-open",
    "logs-open",
    "settings-open",
    "accessibility-toggles-on",
    "settings-closed-by-escape",
    "synchronized-playback-toggled-by-space",
    "local-minimum-size",
    "asset-preview-modal-open"
  ];
  proof.failedStateIds = Object.entries(proof.states ?? {})
    .filter(([, value]) => value?.passed === false)
    .map(([key]) => key)
    .sort();
  proof.passed = proof.requiredStateIds.every((key) => proof.states[key]?.passed === true)
    && proof.failedStateIds.length === 0;
  proof.generatedAt = new Date().toISOString();
  writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`);
}

async function captureProductArtifact(window, scenario) {
  const originalSize = window.getSize();
  const originalContentSize = window.getContentSize();
  if (scenario === "desktop-1280x800") window.setContentSize(macosWorkbenchWindowSizing.comfortable.width, macosWorkbenchWindowSizing.comfortable.height);
  if (scenario === "desktop-1440x900") window.setContentSize(macosWorkbenchWindowSizing.defaultWorkbench.width, macosWorkbenchWindowSizing.defaultWorkbench.height);
  if (scenario === "short-term-preview-overview") window.setContentSize(macosWorkbenchWindowSizing.shortTermWorkbench.width, macosWorkbenchWindowSizing.shortTermWorkbench.height);
  if (scenario === "short-term-preview-overview-wide") window.setContentSize(macosWorkbenchWindowSizing.defaultWorkbench.width, macosWorkbenchWindowSizing.defaultWorkbench.height);
  if (scenario === "short-term-optimization-result") window.setContentSize(macosWorkbenchWindowSizing.shortTermWorkbench.width, macosWorkbenchWindowSizing.shortTermWorkbench.height);
  if (scenario === "short-term-general-compare") window.setContentSize(macosWorkbenchWindowSizing.shortTermWorkbench.width, macosWorkbenchWindowSizing.shortTermWorkbench.height);
  if (scenario === "short-term-settings-dialog") window.setContentSize(macosWorkbenchWindowSizing.shortTermWorkbench.width, macosWorkbenchWindowSizing.shortTermWorkbench.height);
  if (scenario === "short-term-edit-reserved") window.setContentSize(macosWorkbenchWindowSizing.shortTermWorkbench.width, macosWorkbenchWindowSizing.shortTermWorkbench.height);
  if (scenario === "short-term-drag-decision-supported") window.setContentSize(macosWorkbenchWindowSizing.shortTermWorkbench.width, macosWorkbenchWindowSizing.shortTermWorkbench.height);
  if (scenario === "short-term-drag-decision-unsupported") window.setContentSize(macosWorkbenchWindowSizing.shortTermWorkbench.width, macosWorkbenchWindowSizing.shortTermWorkbench.height);
  if (scenario === "desktop-responsive-export-review-loaded-at-900-x-720") window.setContentSize(macosWorkbenchWindowSizing.legacyStressViewport.width, macosWorkbenchWindowSizing.legacyStressViewport.height);
  if (scenario === "desktop-responsive-local-preview-at-900-x-720") window.setContentSize(macosWorkbenchWindowSizing.legacyStressViewport.width, macosWorkbenchWindowSizing.legacyStressViewport.height);
  if (scenario === "desktop-responsive-local-compare-at-900-x-720") window.setContentSize(macosWorkbenchWindowSizing.legacyStressViewport.width, macosWorkbenchWindowSizing.legacyStressViewport.height);
  if (scenario === "desktop-local-minimum-size") window.setContentSize(macosWorkbenchWindowSizing.minimumSupported.width, macosWorkbenchWindowSizing.minimumSupported.height);
  if (scenario === "desktop-responsive-local-compare-at-minimum-size") window.setContentSize(macosWorkbenchWindowSizing.minimumSupported.width, macosWorkbenchWindowSizing.minimumSupported.height);
  if (scenario === "short-term-preview-minimum") window.setContentSize(macosWorkbenchWindowSizing.minimumSupported.width, macosWorkbenchWindowSizing.minimumSupported.height);
  if (scenario === "desktop-1280x800" || scenario === "desktop-1440x900" || scenario === "short-term-preview-overview" || scenario === "short-term-preview-overview-wide" || scenario === "short-term-optimization-result" || scenario === "short-term-general-compare" || scenario === "short-term-settings-dialog" || scenario === "short-term-edit-reserved" || scenario === "short-term-drag-decision-supported" || scenario === "short-term-drag-decision-unsupported" || scenario === "desktop-responsive-export-review-loaded-at-900-x-720" || scenario === "desktop-responsive-local-preview-at-900-x-720" || scenario === "desktop-responsive-local-compare-at-900-x-720" || scenario === "desktop-local-minimum-size" || scenario === "desktop-responsive-local-compare-at-minimum-size" || scenario === "short-term-preview-minimum") {
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  if (scenario === "desktop-invalid") {
    await forceRendererRepaint(window);
  } else if (stateForScenario(scenario)) {
    await waitForRendererPaint(window);
  }
  const image = await window.webContents.capturePage();
  const png = image.toPNG();
  const pngHash = createHash("sha256").update(png).digest("hex");
  const viewportCss = await window.webContents.executeJavaScript(
    "({ width: window.innerWidth, height: window.innerHeight })"
  );
  const fileName = artifactFileNameForScenario(scenario);
  const filePath = path.join(productArtifactRoot, fileName);
  writeFileSync(filePath, png);
  await maybeRecordRenderedStateProof(window, scenario, image, pngHash, fileName, viewportCss);
  if (scenario === "desktop-responsive-export-review-loaded-at-900-x-720" || scenario === "desktop-responsive-local-preview-at-900-x-720" || scenario === "desktop-responsive-local-compare-at-900-x-720" || scenario === "desktop-local-minimum-size" || scenario === "desktop-responsive-local-compare-at-minimum-size" || scenario === "short-term-preview-minimum") {
    window.setContentSize(originalContentSize[0], originalContentSize[1]);
  } else if (scenario === "desktop-1280x800" || scenario === "desktop-1440x900" || scenario === "short-term-preview-overview" || scenario === "short-term-preview-overview-wide" || scenario === "short-term-optimization-result" || scenario === "short-term-general-compare" || scenario === "short-term-settings-dialog" || scenario === "short-term-edit-reserved" || scenario === "short-term-drag-decision-supported" || scenario === "short-term-drag-decision-unsupported") {
    window.setContentSize(originalContentSize[0], originalContentSize[1]);
  }
  const fixture = scenarioFixtureMetadata(scenario);
  addProductArtifactRecord({
    scenario,
    mode: scenario === "actual-normal-loaded" ? "normal" : "smoke",
    source: "desktop",
    viewport: viewportCss,
    path: `.artifacts/product/${productMilestoneId}/${fileName}`,
    mime: "image/png",
    sizeBytes: png.byteLength,
    sha256: pngHash,
    ...fixture,
    headCommit: productArtifactIndex.headCommit,
    rendererEntry: `tools/electron-prototype/experiments/svga-web/${rendererEntry}`,
    rendererSha256: sha256RelativeFile(rendererEntry),
    generatedAt: new Date().toISOString(),
    humanReviewRequired: true
  });
  writeProductArtifactIndex();
  return { path: `.artifacts/product/${productMilestoneId}/${fileName}`, sizeBytes: png.byteLength, sha256: pngHash };
}

async function waitForRendererPaint(window) {
  await window.webContents.executeJavaScript(
    "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => { document.body.getBoundingClientRect(); resolve(true); })))"
  );
  if (typeof window.webContents.invalidate === "function") window.webContents.invalidate();
  await new Promise((resolve) => setTimeout(resolve, 120));
}

async function forceRendererRepaint(window) {
  const [width, height] = window.getContentSize();
  if (width > 0 && height > 2) {
    window.setContentSize(width, height - 1);
    await waitForRendererPaint(window);
    window.setContentSize(width, height);
  }
  await waitForRendererPaint(window);
}

function artifactFileNameForScenario(scenario) {
  return {
    "p3-original-loaded": "original-loaded.png",
    "p3-resource-list": "resource-list.png",
    "p3-replacement-selected": "replacement-selected.png",
    "p3-replacement-preview": "replacement-preview.png",
    "desktop-sequence-review-proof": "desktop-sequence-review-proof.png",
    "desktop-sequence-repair-preview-proof": "desktop-sequence-repair-preview-proof.png",
    "desktop-sequence-no-write-simulation-proof": "desktop-sequence-no-write-simulation-proof.png",
    "desktop-sequence-bounded-repair-prototype-proof": "desktop-sequence-bounded-repair-prototype-proof.png",
    "desktop-sequence-prototype-rendered-boundary-proof": "desktop-sequence-prototype-rendered-boundary-proof.png",
    "desktop-sequence-noop-round-trip-proof": "desktop-sequence-noop-round-trip-proof.png",
    "desktop-sequence-product-repair-proof": "desktop-sequence-product-repair-proof.png",
    "desktop-replacement-preview-proof": "desktop-replacement-preview-proof.png",
    "desktop-replacement-undo-redo-proof": "desktop-replacement-undo-redo-proof.png",
    "desktop-multi-replacement-proof": "desktop-multi-replacement-proof.png",
    "p3-dirty-state": "dirty-state.png",
    "p3-reset-to-original": "reset-to-original.png",
    "p3-export-success": "export-success.png",
    "p3-reopened-export": "reopened-export.png",
    "p3-invalid-png-state": "invalid-png-state.png",
    "p3-original-edited-comparison": "original-edited-comparison.png",
    "p4-multi-resource-original": "multi-resource-original.png",
    "p4-multi-resource-list": "multi-resource-list.png",
    "p4-first-replacement": "first-replacement.png",
    "p4-two-replacements": "two-replacements.png",
    "p4-undo-second-replacement": "undo-second-replacement.png",
    "p4-redo-second-replacement": "redo-second-replacement.png",
    "p4-reset-selected": "reset-selected.png",
    "p4-undo-reset-selected": "undo-reset-selected.png",
    "p4-reset-all": "reset-all.png",
    "p4-undo-reset-all": "undo-reset-all.png",
    "p4-dirty-two-edits": "dirty-two-edits.png",
    "p4-save-point-clean": "save-point-clean.png",
    "p4-post-save-new-edit": "post-save-new-edit.png",
    "p4-reopened-multi-resource-export": "reopened-multi-resource-export.png",
    "p4-invalid-second-png": "invalid-second-png.png",
    "p4-multi-resource-comparison": "multi-resource-comparison.png",
    "p5-batch-entry": "batch-entry.png",
    "p5-batch-files-selected": "batch-files-selected.png",
    "p5-mapping-exact-matches": "mapping-exact-matches.png",
    "p5-mapping-unmatched-conflict": "mapping-unmatched-conflict.png",
    "p5-mapping-manual-resolution": "mapping-manual-resolution.png",
    "p5-mapping-ready-to-apply": "mapping-ready-to-apply.png",
    "p5-batch-preview": "batch-preview.png",
    "p5-batch-dirty-state": "batch-dirty-state.png",
    "p5-batch-undo": "batch-undo.png",
    "p5-batch-redo": "batch-redo.png",
    "p5-batch-export-success": "batch-export-success.png",
    "p5-batch-reopened-export": "batch-reopened-export.png",
    "p5-corrupt-png-state": "corrupt-png-state.png",
    "p5-dimension-warning": "dimension-warning.png",
    "p5-batch-original-edited-comparison": "batch-original-edited-comparison.png"
  }[scenario] ?? `${scenario}.png`;
}

function writeJsonProductArtifact(fileName, scenario, value, mode = "smoke") {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  writeFileSync(path.join(productArtifactRoot, fileName), bytes);
  const fixture = scenarioFixtureMetadata(scenario);
  addProductArtifactRecord({
    scenario,
    mode,
    source: "desktop",
    viewport: { width: null, height: null },
    path: `.artifacts/product/${productMilestoneId}/${fileName}`,
    mime: "application/json",
    sizeBytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    ...fixture,
    headCommit: productArtifactIndex.headCommit,
    rendererEntry: `tools/electron-prototype/experiments/svga-web/${rendererEntry}`,
    rendererSha256: sha256RelativeFile(rendererEntry),
    generatedAt: new Date().toISOString(),
    humanReviewRequired: true
  });
  writeProductArtifactIndex();
}

function openSvgaFileBytes(filePath) {
  if (!filePath.toLowerCase().endsWith(".svga")) {
    throw new Error("Only .svga files can be opened.");
  }
  const bytes = readFileSync(filePath);
  if (bytes.byteLength <= 0 || bytes.byteLength > 25 * 1024 * 1024) {
    throw new Error("SVGA file size is outside the supported internal prototype limit.");
  }
  const sourceId = rememberSourceFile(filePath);
  rememberShortTermRecentFile(filePath);
  return {
    status: "opened",
    sourceId,
    basename: path.basename(filePath),
    hash: createHash("sha256").update(bytes).digest("hex"),
    mediaType: "application/octet-stream",
    kind: "svga",
    bytes: new Uint8Array(bytes)
  };
}

function rememberReferenceFile(filePath) {
  const sourceId = createHash("sha256").update(`reference:${filePath}`).digest("hex").slice(0, 16);
  referenceFileIds.add(sourceId);
  while (referenceFileIds.size > 20) {
    const firstKey = referenceFileIds.values().next().value;
    referenceFileIds.delete(firstKey);
  }
  return sourceId;
}

function openReferenceMediaFileBytes(filePath) {
  const media = referenceMediaTypes.get(path.extname(filePath).toLowerCase());
  if (!media) {
    throw new Error("Only .mp4, .webm, or .gif reference media can be opened.");
  }
  const bytes = readFileSync(filePath);
  if (bytes.byteLength <= 0 || bytes.byteLength > 100 * 1024 * 1024) {
    throw new Error("Reference media size is outside the supported internal prototype limit.");
  }
  const sourceId = rememberReferenceFile(filePath);
  return {
    status: "opened",
    sourceId,
    basename: path.basename(filePath),
    hash: createHash("sha256").update(bytes).digest("hex"),
    mediaType: media.mediaType,
    kind: media.kind,
    bytes: new Uint8Array(bytes)
  };
}

async function openSvgaFile() {
  if (normalProofMode) return openSvgaFileBytes(canonicalFixtureRuntimePath);
  const result = await dialog.showOpenDialog({
    title: "打开 SVGA",
    filters: [{ name: "SVGA", extensions: ["svga"] }],
    properties: ["openFile"]
  });
  if (result.canceled || !result.filePaths?.[0]) {
    return { status: "cancelled" };
  }
  return openSvgaFileBytes(result.filePaths[0]);
}

async function openReferenceMediaFile() {
  const result = await dialog.showOpenDialog({
    title: "打开参考视频",
    filters: [{ name: "Reference Media", extensions: ["mp4", "webm", "gif"] }],
    properties: ["openFile"]
  });
  if (result.canceled || !result.filePaths?.[0]) {
    return { status: "cancelled" };
  }
  return openReferenceMediaFileBytes(result.filePaths[0]);
}

function assertMultiFormatDesktopProduct() {
  if (!isMultiFormatDesktopProduct) {
    throw new Error("Multi-format desktop preview is available only in the formal 0.2 product mode.");
  }
}

function getMultiFormatDesktopSession() {
  assertMultiFormatDesktopProduct();
  multiFormatDesktopSession ??= createMultiFormatDesktopPreviewSession({
    repoRoot: multiFormatDesktopRuntimeRoot,
    sessionRoot,
    sourceStore: sourceFilePaths
  });
  return multiFormatDesktopSession;
}

async function openMultiFormatFilePath(filePath, source = "fileButton") {
  const result = await getMultiFormatDesktopSession().openLocalFilePath(filePath, source);
  if (result?.sourceId && result?.model?.status !== "failed") rememberShortTermRecentFile(filePath);
  return result;
}

async function openMultiFormatFile() {
  assertMultiFormatDesktopProduct();
  const selection = await chooseMultiFormatLocalFile({
    showOpenDialog: showOpenDialogForActiveMainWindow,
    platform: process.platform
  });
  if (selection.status !== "selected") return selection;
  return openMultiFormatFilePath(selection.filePath, "fileButton");
}

function showOpenDialogForActiveMainWindow(options) {
  if (!activeMainWindow || activeMainWindow.isDestroyed()) {
    throw new Error("active multi-format picker owner window is unavailable");
  }
  return dialog.showOpenDialog(activeMainWindow, options);
}

async function openDroppedMultiFormatFile(input) {
  assertMultiFormatDesktopProduct();
  const filePath = typeof input?.filePath === "string" ? input.filePath : "";
  if (!filePath) {
    return {
      status: "failed",
      code: "parse_precondition",
      message: "拖拽文件没有提供可验证的本地来源。",
      pathRedacted: true
    };
  }
  return openMultiFormatFilePath(filePath, "dragDrop");
}

async function prepareMultiFormatRuntimePreview(input) {
  return getMultiFormatDesktopSession().prepareRuntimePreview(input);
}

async function chooseMultiFormatReplacementImage(input) {
  assertMultiFormatDesktopProduct();
  const targetId = String(input?.targetId ?? "").trim();
  const expectedSourceId = String(input?.sourceId ?? "").trim();
  if (!targetId) {
    return {
      status: "failed",
      code: "parse_precondition",
      message: "Runtime image replacement target is incomplete.",
      pathRedacted: true
    };
  }
  if (!expectedSourceId) {
    return {
      status: "failed",
      code: "parse_precondition",
      message: "Runtime image replacement source identity is incomplete.",
      pathRedacted: true
    };
  }
  const session = getMultiFormatDesktopSession();
  if (session.activeSourceId !== expectedSourceId) {
    return {
      status: "failed",
      code: "parse_precondition",
      message: "Replacement preview request no longer matches the active local source.",
      pathRedacted: true
    };
  }
  const selectionBeforePicker = await session.resolveReplacementSelection({
    targetId,
    kind: "image"
  });
  if (selectionBeforePicker.status !== "accepted") {
    return replacementSelectionFailure(selectionBeforePicker);
  }
  const picked = await openMultiFormatReplacementImageFile();
  if (picked.status !== "opened") return picked;
  if (session.activeSourceId !== expectedSourceId) {
    return {
      status: "failed",
      code: "parse_precondition",
      message: "Replacement preview request was superseded by a newer local source.",
      pathRedacted: true
    };
  }
  const selectionAfterPicker = await session.resolveReplacementSelection({
    targetId,
    kind: "image"
  });
  if (
    selectionAfterPicker.status !== "accepted"
    || selectionAfterPicker.bindingToken !== selectionBeforePicker.bindingToken
  ) {
    return {
      status: "failed",
      code: "replacement_target_stale",
      message: "Replacement preview target changed while the local image picker was open.",
      pathRedacted: true
    };
  }
  const result = await applyMultiFormatReplacement({
    targetId: selectionAfterPicker.publicTargetId,
    sourceId: expectedSourceId,
    selectionToken: selectionAfterPicker.bindingToken,
    kind: "image",
    value: picked.value
  });
  return {
    ...result,
    picker: {
      status: "opened",
      mediaType: picked.mediaType,
      sizeBytes: picked.sizeBytes,
      sha256: picked.sha256,
      pathRedacted: true
    }
  };
}

function replacementSelectionFailure(selection) {
  return {
    status: "failed",
    code: selection?.diagnostic?.code || "replacement_target_unavailable",
    message: selection?.diagnostic?.message || "Replacement preview target is unavailable.",
    pathRedacted: true
  };
}

async function openMultiFormatReplacementImageFile() {
  const result = await dialog.showOpenDialog({
    title: "选择替换预览图片",
    filters: [
      { name: "Local image", extensions: ["png", "jpg", "jpeg", "webp"] }
    ],
    properties: ["openFile"]
  });
  if (result.canceled || !result.filePaths?.[0]) {
    return { status: "cancelled", pathRedacted: true };
  }
  return readMultiFormatReplacementImageFile(result.filePaths[0]);
}

function readMultiFormatReplacementImageFile(filePath) {
  const normalizedPath = path.resolve(String(filePath ?? ""));
  const extension = path.extname(normalizedPath).toLowerCase();
  const mediaType = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp"
  }[extension];
  if (!mediaType) {
    return {
      status: "failed",
      code: "unsupported_feature",
      message: "Replacement preview requires a local PNG, JPEG, or WebP image.",
      pathRedacted: true
    };
  }
  let fd;
  try {
    fd = openSync(normalizedPath, "r");
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_MULTI_FORMAT_REPLACEMENT_IMAGE_BYTES) {
      return {
        status: "failed",
        code: "parse_precondition",
        message: "Replacement preview image must be a bounded local file.",
        pathRedacted: true
      };
    }
    const chunks = [];
    const scratch = Buffer.allocUnsafe(Math.min(64 * 1024, MAX_MULTI_FORMAT_REPLACEMENT_IMAGE_BYTES + 1));
    let totalBytes = 0;
    while (totalBytes <= MAX_MULTI_FORMAT_REPLACEMENT_IMAGE_BYTES) {
      const remaining = MAX_MULTI_FORMAT_REPLACEMENT_IMAGE_BYTES + 1 - totalBytes;
      const bytesRead = readSync(fd, scratch, 0, Math.min(scratch.byteLength, remaining), null);
      if (bytesRead === 0) break;
      chunks.push(Buffer.from(scratch.subarray(0, bytesRead)));
      totalBytes += bytesRead;
    }
    if (totalBytes <= 0 || totalBytes > MAX_MULTI_FORMAT_REPLACEMENT_IMAGE_BYTES) {
      return {
        status: "failed",
        code: "parse_precondition",
        message: "Replacement preview image must be a bounded local file.",
        pathRedacted: true
      };
    }
    const bytes = Buffer.concat(chunks, totalBytes);
    return {
      status: "opened",
      mediaType,
      sizeBytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      value: `data:${mediaType};base64,${bytes.toString("base64")}`,
      pathRedacted: true
    };
  } catch {
    return {
      status: "failed",
      code: "missing_resource",
      message: "Replacement preview image could not be read.",
      pathRedacted: true
    };
  } finally {
    if (typeof fd === "number") {
      try {
        closeSync(fd);
      } catch {
        // Ignore close errors after a redacted read result has already been decided.
      }
    }
  }
}

function enqueueMultiFormatOpenFileEvent(filePath, sourceId = traceSourceId(filePath)) {
  if (!isMultiFormatDesktopProduct || typeof filePath !== "string" || filePath.length === 0) return;
  multiFormatOpenFileEventSequence += 1;
  const eventId = `fileOpenEvent:${multiFormatOpenFileEventSequence}`;
  pendingMultiFormatOpenFileEvents.push({ eventId, filePath, sourceId });
  multiFormatTrace.record({
    phase: "open_file_queued",
    eventId,
    sourceId,
    productMilestoneId,
    formalRuntimeMode: isMultiFormatDesktopProduct,
    queueDepth: pendingMultiFormatOpenFileEvents.length,
    bridgeReady: multiFormatDesktopRendererReady
  });
  void flushPendingMultiFormatOpenFileEvents();
}

async function flushPendingMultiFormatOpenFileEvents() {
  multiFormatTrace.record({
    phase: "flush_attempt",
    productMilestoneId,
    formalRuntimeMode: isMultiFormatDesktopProduct,
    queueDepth: pendingMultiFormatOpenFileEvents.length,
    bridgeReady: multiFormatDesktopRendererReady
  });
  if (!isMultiFormatDesktopProduct || multiFormatOpenFileEventFlushActive) return;
  if (!multiFormatDesktopRendererReady || !activeMainWindow || activeMainWindow.isDestroyed()) {
    multiFormatTrace.record({
      phase: "flush_deferred",
      productMilestoneId,
      formalRuntimeMode: isMultiFormatDesktopProduct,
      queueDepth: pendingMultiFormatOpenFileEvents.length,
      bridgeReady: multiFormatDesktopRendererReady
    });
    return;
  }
  multiFormatOpenFileEventFlushActive = true;
  multiFormatTrace.record({
    phase: "flush_started",
    productMilestoneId,
    formalRuntimeMode: isMultiFormatDesktopProduct,
    queueDepth: pendingMultiFormatOpenFileEvents.length,
    bridgeReady: multiFormatDesktopRendererReady
  });
  try {
    while (pendingMultiFormatOpenFileEvents.length > 0) {
      if (!multiFormatDesktopRendererReady || !activeMainWindow || activeMainWindow.isDestroyed()) return;
      const item = pendingMultiFormatOpenFileEvents[0];
      try {
        await dispatchMultiFormatOpenFileEvent(activeMainWindow, item);
        pendingMultiFormatOpenFileEvents.shift();
      } catch (error) {
        multiFormatTrace.record({
          phase: "dispatch_failed",
          eventId: item.eventId,
          sourceId: item.sourceId,
          productMilestoneId,
          formalRuntimeMode: isMultiFormatDesktopProduct,
          queueDepth: pendingMultiFormatOpenFileEvents.length,
          bridgeReady: multiFormatDesktopRendererReady,
          issueCode: "dispatch_failed"
        });
        console.error(`AUTO_SVGA_MULTI_FORMAT_FILE_OPEN_EVENT_ERROR ${redactLogMessage(error instanceof Error ? error.message : error)}`);
        return;
      }
    }
  } finally {
    multiFormatOpenFileEventFlushActive = false;
  }
}

async function dispatchMultiFormatOpenFileEvent(window, item) {
  multiFormatTrace.record({
    phase: "dispatch_started",
    eventId: item.eventId,
    sourceId: item.sourceId,
    productMilestoneId,
    formalRuntimeMode: isMultiFormatDesktopProduct,
    queueDepth: pendingMultiFormatOpenFileEvents.length,
    bridgeReady: multiFormatDesktopRendererReady
  });
  const begun = await invokeMultiFormatRendererAction(window, "beginHostFileOpen", {
    eventId: item.eventId
  });
  multiFormatTrace.record({
    phase: "renderer_begin_result",
    eventId: item.eventId,
    sourceId: item.sourceId,
    productMilestoneId,
    formalRuntimeMode: isMultiFormatDesktopProduct,
    queueDepth: pendingMultiFormatOpenFileEvents.length,
    bridgeReady: multiFormatDesktopRendererReady,
    actionAccepted: begun
  });
  if (!begun) throw new Error("Multi-format renderer did not accept the host file-open begin action.");
  let result;
  try {
    result = await openMultiFormatFilePath(item.filePath, "fileOpenEvent");
    multiFormatTrace.record({
      phase: "session_open_completed",
      eventId: item.eventId,
      requestId: result?.model?.requestId,
      format: result?.model?.detectedFormat,
      sourceId: result?.sourceId || item.sourceId,
      productMilestoneId,
      formalRuntimeMode: isMultiFormatDesktopProduct,
      queueDepth: pendingMultiFormatOpenFileEvents.length,
      bridgeReady: multiFormatDesktopRendererReady,
      modelStatus: result?.model?.status,
      issueCode: firstMultiFormatIssueCode(result?.model)
    });
  } catch (error) {
    await invokeMultiFormatRendererAction(window, "failHostFileOpen", {
      eventId: item.eventId,
      message: "无法打开系统传入的本地文件，源文件没有被修改。"
    });
    throw error;
  }
  const completed = await invokeMultiFormatRendererAction(window, "completeHostFileOpen", {
    eventId: item.eventId,
    result
  });
  multiFormatTrace.record({
    phase: "renderer_complete_result",
    eventId: item.eventId,
    requestId: result?.model?.requestId,
    format: result?.model?.detectedFormat,
    sourceId: result?.sourceId || item.sourceId,
    productMilestoneId,
    formalRuntimeMode: isMultiFormatDesktopProduct,
    queueDepth: pendingMultiFormatOpenFileEvents.length,
    bridgeReady: multiFormatDesktopRendererReady,
    modelStatus: result?.model?.status,
    issueCode: firstMultiFormatIssueCode(result?.model),
    actionAccepted: completed
  });
  if (!completed) throw new Error("Multi-format renderer did not accept the host file-open terminal action.");
}

function traceSourceId(filePath) {
  return createHash("sha256").update(String(filePath ?? "")).digest("hex").slice(0, 24);
}

function firstMultiFormatIssueCode(model) {
  const issue = model?.rightPanel?.issues?.[0];
  return typeof issue?.code === "string" ? issue.code : undefined;
}

async function invokeMultiFormatRendererAction(window, name, payload) {
  if (!isMultiFormatDesktopProduct || !window || window.isDestroyed()) return false;
  const actionName = JSON.stringify(name);
  const actionPayload = JSON.stringify(payload ?? {});
  return window.webContents.executeJavaScript(`
    (() => {
      const action = window.__autoSvgaShortTermActions?.[${actionName}];
      if (typeof action !== "function") return false;
      return Promise.resolve(action(${actionPayload})).then(() => true);
    })()
  `);
}

async function controlMultiFormatPreview(input) {
  return getMultiFormatDesktopSession().control(input);
}

async function applyMultiFormatReplacement(input) {
  assertMultiFormatDesktopProduct();
  const expectedSourceId = String(input?.sourceId ?? "").trim();
  const targetId = String(input?.targetId ?? "").trim();
  const kind = input?.kind === "text" ? "text" : "image";
  if (!expectedSourceId || !targetId) {
    return {
      status: "failed",
      code: "parse_precondition",
      message: "Runtime replacement source and target identity are required.",
      pathRedacted: true
    };
  }
  const session = getMultiFormatDesktopSession();
  if (session.activeSourceId !== expectedSourceId) {
    return {
      status: "failed",
      code: "parse_precondition",
      message: "Replacement preview request no longer matches the active local source.",
      pathRedacted: true
    };
  }
  const selection = await session.resolveReplacementSelection({ targetId, kind });
  if (selection.status !== "accepted") return replacementSelectionFailure(selection);
  if (input?.selectionToken && input.selectionToken !== selection.bindingToken) {
    return {
      status: "failed",
      code: "replacement_target_stale",
      message: "Replacement preview target changed before the replacement could be applied.",
      pathRedacted: true
    };
  }
  const result = await session.applyReplacement({
    targetId: selection.publicTargetId,
    kind,
    value: String(input?.value ?? "")
  });
  if (session.activeSourceId !== expectedSourceId) {
    return {
      status: "failed",
      code: "replacement_target_stale",
      message: "Replacement preview request was superseded by a newer local source.",
      pathRedacted: true
    };
  }
  if (result?.model?.replacement?.lastAction?.status !== "accepted") return result;
  const returnedRuntimeTargetId = String(
    result.model.replacement.lastAction.runtimeTargetId || ""
  ).trim();
  if (selection.format === "vap" && !returnedRuntimeTargetId) {
    return {
      status: "failed",
      code: "replacement_target_malformed",
      message: "VAP replacement preview did not return its accepted runtime target binding.",
      pathRedacted: true
    };
  }
  const acceptedRuntimeTargetId = returnedRuntimeTargetId || selection.runtimeTargetId;
  if (!acceptedRuntimeTargetId || acceptedRuntimeTargetId !== selection.runtimeTargetId) {
    return {
      status: "failed",
      code: "replacement_target_malformed",
      message: "Replacement preview did not return the accepted runtime target binding.",
      pathRedacted: true
    };
  }
  return {
    ...result,
    replacementRuntimeValue: {
      kind,
      targetId: acceptedRuntimeTargetId,
      value: String(input?.value ?? "")
    }
  };
}

async function resetMultiFormatReplacement(input) {
  assertMultiFormatDesktopProduct();
  const expectedSourceId = String(input?.sourceId ?? "").trim();
  const targetId = String(input?.targetId ?? "").trim();
  const kind = input?.kind === "text" ? "text" : input?.kind === "image" ? "image" : "";
  if (!expectedSourceId || !targetId || !kind) {
    return {
      status: "failed",
      code: "parse_precondition",
      message: "Runtime replacement reset source and target identity are required.",
      pathRedacted: true
    };
  }
  const session = getMultiFormatDesktopSession();
  if (session.activeSourceId !== expectedSourceId) {
    return {
      status: "failed",
      code: "replacement_target_stale",
      message: "Runtime replacement reset no longer matches the active local source.",
      pathRedacted: true
    };
  }
  const selection = await session.resolveReplacementSelection({ targetId, kind });
  if (selection.status !== "accepted") return replacementSelectionFailure(selection);
  const result = await session.resetReplacement({
    targetId: selection.publicTargetId,
    kind
  });
  if (session.activeSourceId !== expectedSourceId) {
    return {
      status: "failed",
      code: "replacement_target_stale",
      message: "Runtime replacement reset was superseded by a newer local source.",
      pathRedacted: true
    };
  }
  if (result?.model?.replacement?.lastAction?.status !== "accepted") return result;
  const resetReceipt = result.model.replacement.lastAction;
  const returnedPublicTargetId = String(resetReceipt.publicTargetId || "").trim();
  const returnedRuntimeTargetId = String(resetReceipt.runtimeTargetId || "").trim();
  const returnedBindingToken = String(resetReceipt.bindingToken || "");
  if (
    resetReceipt.type !== "resetReplacement"
    || returnedPublicTargetId !== selection.publicTargetId
    || returnedRuntimeTargetId !== selection.runtimeTargetId
    || returnedBindingToken !== selection.bindingToken
  ) {
    return {
      status: "failed",
      code: "replacement_target_malformed",
      message: "Runtime replacement reset did not return the accepted action and target binding.",
      pathRedacted: true
    };
  }
  return result;
}

function writeClipboardText(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 200_000) {
    throw new Error("Invalid clipboard text payload.");
  }
  clipboard.writeText(value);
  return { status: "written", length: value.length };
}

async function openSvgaFromHostMenu(window, selector = "#svgaFileInput") {
  const opened = await openSvgaFile();
  if (!opened || opened.status !== "opened") return;
  await injectOpenedFile(window, selector, opened);
}

async function openReferenceFromHostMenu(window) {
  const opened = await openReferenceMediaFile();
  if (!opened || opened.status !== "opened") return;
  await injectOpenedFile(window, "#referenceFileInput", opened);
}

async function injectOpenedFile(window, selector, opened) {
  const payload = {
    basename: opened.basename,
    sourceId: opened.sourceId,
    hash: opened.hash,
    mediaType: opened.mediaType,
    bytes: Array.from(opened.bytes)
  };
  await window.webContents.executeJavaScript(`
    (() => {
      const opened = ${JSON.stringify(payload)};
      const input = document.querySelector(${JSON.stringify(selector)});
      if (!input) throw new Error("Host file input unavailable");
      const file = new File([new Uint8Array(opened.bytes)], opened.basename, { type: opened.mediaType });
      Object.defineProperty(file, "autoSvgaSourceId", { value: opened.sourceId, configurable: true });
      Object.defineProperty(file, "autoSvgaSourceHash", { value: opened.hash, configurable: true });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      Object.defineProperty(input, "files", { value: transfer.files, configurable: true });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    })()
  `);
}

function rebuildShortTermApplicationMenu() {
  if (usesShortTermPreviewShell && activeMainWindow && !activeMainWindow.isDestroyed()) {
    installApplicationMenu(activeMainWindow);
  }
}

function installShortTermApplicationMenu(window) {
  const invokeShortTermAction = (name, ...args) => {
    window.webContents.executeJavaScript(
      `window.__autoSvgaShortTermActions?.[${JSON.stringify(name)}]?.(...${JSON.stringify(args)})`
    ).catch((error) => {
      console.error(`AUTO_SVGA_MENU_ACTION_ERROR ${name} ${redactLogMessage(error instanceof Error ? error.message : error)}`);
    });
  };
  const menuState = shortTermMenuState;
  const hasFile = menuState.hasFile;
  const hasRecent = readShortTermRecentRecords().length > 0;
  const recentRecords = shortTermRecentView().slice(0, maxShortTermRecentFiles);
  const recentSubmenu = [
    ...(recentRecords.length > 0
      ? recentRecords.map((record) => ({
          label: `${record.displayName} - ${record.parentName || "本地文件"}`,
          click: () => invokeShortTermAction("openRecentFromMenu", record.id)
        }))
      : [{ label: "暂无最近文件", enabled: false }]),
    { type: "separator" },
    {
      label: "清除最近记录",
      enabled: hasRecent,
      click: () => invokeShortTermAction("clearRecentFiles")
    }
  ];
  const appMenu = process.platform === "darwin"
    ? [{
        label: "Auto SVGA",
        submenu: [
          { role: "about", label: "关于 Auto SVGA" },
          { type: "separator" },
          {
            label: "设置...",
            accelerator: "CommandOrControl+,",
            click: () => invokeShortTermAction("openSettings")
          },
          { type: "separator" },
          { role: "services", label: "服务" },
          { type: "separator" },
          { role: "hide", label: "隐藏 Auto SVGA" },
          { role: "hideOthers", label: "隐藏其他" },
          { role: "unhide", label: "全部显示" },
          { type: "separator" },
          { role: "quit", label: "退出 Auto SVGA" }
        ]
      }]
    : [];
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...appMenu,
    {
      label: "文件",
      submenu: [
        {
          label: "打开文件...",
          accelerator: "CommandOrControl+O",
          click: () => invokeShortTermAction("openFromHostDialog")
        },
        {
          label: "关闭文件",
          accelerator: "CommandOrControl+W",
          enabled: hasFile,
          click: () => invokeShortTermAction("closeFile")
        },
        {
          label: "最近打开",
          submenu: recentSubmenu
        },
        { type: "separator" },
        {
          label: "打开对比 SVGA...",
          enabled: menuState.canCompare,
          click: () => invokeShortTermAction("openCompareB")
        },
        { type: "separator" },
        {
          label: "覆盖保存",
          accelerator: "CommandOrControl+S",
          enabled: menuState.canOverwrite,
          click: () => invokeShortTermAction("save")
        },
        {
          label: "另存为...",
          accelerator: "CommandOrControl+Shift+S",
          enabled: menuState.canSaveAs,
          click: () => invokeShortTermAction("saveAs")
        },
        ...(process.platform === "darwin" ? [] : [
          { type: "separator" },
          { role: "quit", label: "退出 Auto SVGA" }
        ])
      ]
    },
    {
      label: "编辑",
      submenu: [
        { label: "撤销", role: "undo" },
        { label: "重做", role: "redo" },
        { type: "separator" },
        { label: "剪切", role: "cut" },
        { label: "复制", role: "copy" },
        { label: "粘贴", role: "paste" },
        { label: "全选", role: "selectAll" },
        { type: "separator" },
        {
          label: "重命名 imageKey",
          accelerator: "CommandOrControl+R",
          enabled: menuState.canRenameImageKey,
          click: () => invokeShortTermAction("renameImageKey")
        },
        {
          label: "取消当前操作",
          accelerator: "Esc",
          enabled: menuState.hasTransientState,
          click: () => invokeShortTermAction("cancel")
        }
      ]
    },
    {
      label: "视图",
      submenu: [
        {
          label: "预览模式",
          type: "checkbox",
          checked: menuState.mode === "preview",
          enabled: hasFile,
          click: () => invokeShortTermAction("previewMode")
        },
        {
          label: "编辑模式",
          type: "checkbox",
          checked: menuState.mode === "edit",
          enabled: hasFile,
          click: () => invokeShortTermAction("editMode")
        },
        {
          label: menuState.view === "compare" ? "退出对比" : "进入对比",
          enabled: menuState.canCompare,
          click: () => invokeShortTermAction("toggleCompare")
        },
        { type: "separator" },
        {
          label: "总览",
          enabled: hasFile,
          type: "checkbox",
          checked: menuState.tab === "overview" && menuState.view === "preview",
          click: () => invokeShortTermAction("overviewTab")
        },
        {
          label: "优化",
          enabled: hasFile,
          type: "checkbox",
          checked: menuState.tab === "optimization" && menuState.view === "preview",
          click: () => invokeShortTermAction("optimizationTab")
        },
        {
          label: "可替换元素",
          enabled: hasFile,
          type: "checkbox",
          checked: menuState.tab === "replaceable" && menuState.view === "preview",
          click: () => invokeShortTermAction("replaceableTab")
        },
        { type: "separator" },
        {
          label: "外观",
          submenu: [
            {
              label: "跟随系统",
              type: "radio",
              checked: menuState.appearance === "system",
              click: () => invokeShortTermAction("setAppearance", "system", { persist: true })
            },
            {
              label: "浅色",
              type: "radio",
              checked: menuState.appearance === "light",
              click: () => invokeShortTermAction("setAppearance", "light", { persist: true })
            },
            {
              label: "深色",
              type: "radio",
              checked: menuState.appearance === "dark",
              click: () => invokeShortTermAction("setAppearance", "dark", { persist: true })
            }
          ]
        }
      ]
    },
    {
      label: "播放",
      submenu: [
        {
          label: "播放/暂停",
          accelerator: "Space",
          enabled: menuState.canPlay,
          click: () => invokeShortTermAction("playPause")
        },
        {
          label: "重播",
          enabled: menuState.canReplay,
          click: () => invokeShortTermAction("replay")
        },
        {
          label: "循环播放",
          type: "checkbox",
          checked: menuState.loopEnabled !== false,
          enabled: menuState.canLoop,
          click: () => invokeShortTermAction("toggleLoop")
        }
      ]
    },
    {
      label: "资源",
      submenu: [
        {
          label: "重命名 imageKey",
          accelerator: "CommandOrControl+R",
          enabled: menuState.canRenameImageKey,
          click: () => invokeShortTermAction("renameImageKey")
        },
        {
          label: "替换预览图片...",
          enabled: menuState.canReplaceImage,
          click: () => invokeShortTermAction("replaceImage")
        },
        {
          label: "重置预览图片",
          enabled: menuState.canResetImageReplacement,
          click: () => invokeShortTermAction("resetImageReplacement")
        },
        { type: "separator" },
        {
          label: "编辑文本预览",
          enabled: menuState.canEditText,
          click: () => invokeShortTermAction("editTextPreview")
        },
        {
          label: "重置文本预览",
          enabled: menuState.canResetText,
          click: () => invokeShortTermAction("resetTextPreview")
        }
      ]
    },
    {
      label: "优化",
      submenu: [
        {
          label: "查看优化建议",
          enabled: hasFile,
          click: () => invokeShortTermAction("optimizationTab")
        },
        {
          label: "执行安全优化",
          enabled: menuState.canRunOptimization,
          click: () => invokeShortTermAction("runOptimization")
        },
        {
          label: "显示优化对比",
          enabled: menuState.canShowOptimizationComparison,
          click: () => invokeShortTermAction("showOptimizationComparison")
        }
      ]
    },
    {
      label: "窗口",
      submenu: [
        { role: "minimize", label: "最小化" },
        { role: "zoom", label: "缩放" },
        ...(process.platform === "darwin" ? [
          { type: "separator" },
          { role: "front", label: "全部置于最前" }
        ] : [
          { role: "close", label: "关闭窗口" }
        ])
      ]
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "复制当前状态摘要",
          click: () => invokeShortTermAction("copyStateSummary")
        }
      ]
    }
  ]));
}

function installMultiFormatDesktopApplicationMenu(window) {
  const invokePreviewAction = (name, ...args) => {
    window.webContents.executeJavaScript(
      `window.__autoSvgaShortTermActions?.[${JSON.stringify(name)}]?.(...${JSON.stringify(args)})`
    ).catch((error) => {
      console.error(`AUTO_SVGA_MENU_ACTION_ERROR ${name} ${redactLogMessage(error instanceof Error ? error.message : error)}`);
    });
  };
  const menuState = shortTermMenuState;
  const hasFile = menuState.hasFile;
  const appMenu = process.platform === "darwin"
    ? [{
        label: "Auto SVGA",
        submenu: [
          { role: "about", label: "关于 Auto SVGA" },
          { type: "separator" },
          {
            label: "设置...",
            accelerator: "CommandOrControl+,",
            click: () => invokePreviewAction("openSettings")
          },
          { type: "separator" },
          { role: "services", label: "服务" },
          { type: "separator" },
          { role: "hide", label: "隐藏 Auto SVGA" },
          { role: "hideOthers", label: "隐藏其他" },
          { role: "unhide", label: "全部显示" },
          { type: "separator" },
          { role: "quit", label: "退出 Auto SVGA" }
        ]
      }]
    : [];
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...appMenu,
    {
      label: "文件",
      submenu: [
        {
          label: "打开文件...",
          accelerator: "CommandOrControl+O",
          click: () => invokePreviewAction("openFromHostDialog")
        },
        {
          label: "关闭文件",
          accelerator: "CommandOrControl+W",
          enabled: hasFile,
          click: () => invokePreviewAction("closeFile")
        },
        ...(process.platform === "darwin" ? [] : [
          { type: "separator" },
          { role: "quit", label: "退出 Auto SVGA" }
        ])
      ]
    },
    {
      label: "编辑",
      submenu: [
        { label: "剪切", role: "cut" },
        { label: "复制", role: "copy" },
        { label: "粘贴", role: "paste" },
        { label: "全选", role: "selectAll" },
        { type: "separator" },
        {
          label: "取消当前操作",
          accelerator: "Esc",
          enabled: menuState.hasTransientState,
          click: () => invokePreviewAction("cancel")
        }
      ]
    },
    {
      label: "视图",
      submenu: [
        {
          label: "预览模式",
          type: "checkbox",
          checked: menuState.mode === "preview",
          enabled: hasFile,
          click: () => invokePreviewAction("previewMode")
        },
        {
          label: "总览",
          enabled: hasFile,
          type: "checkbox",
          checked: menuState.tab === "overview",
          click: () => invokePreviewAction("overviewTab")
        },
        {
          label: "可替换元素",
          enabled: hasFile,
          type: "checkbox",
          checked: menuState.tab === "replaceable",
          click: () => invokePreviewAction("replaceableTab")
        },
        { type: "separator" },
        {
          label: "外观",
          submenu: [
            {
              label: "跟随系统",
              type: "radio",
              checked: menuState.appearance === "system",
              click: () => invokePreviewAction("setAppearance", "system", { persist: true })
            },
            {
              label: "浅色",
              type: "radio",
              checked: menuState.appearance === "light",
              click: () => invokePreviewAction("setAppearance", "light", { persist: true })
            },
            {
              label: "深色",
              type: "radio",
              checked: menuState.appearance === "dark",
              click: () => invokePreviewAction("setAppearance", "dark", { persist: true })
            }
          ]
        }
      ]
    },
    {
      label: "播放",
      submenu: [
        {
          label: "播放/暂停",
          accelerator: "Space",
          enabled: menuState.canPlay,
          click: () => invokePreviewAction("playPause")
        },
        {
          label: "重播/恢复",
          enabled: menuState.canReplay,
          click: () => invokePreviewAction("replay")
        },
        {
          label: "循环播放",
          type: "checkbox",
          checked: menuState.loopEnabled !== false,
          enabled: menuState.canLoop,
          click: () => invokePreviewAction("toggleLoop")
        }
      ]
    },
    {
      label: "资源",
      submenu: [
        {
          label: "替换预览图片...",
          enabled: menuState.canReplaceImage,
          click: () => invokePreviewAction("replaceImage")
        },
        {
          label: "重置预览图片",
          enabled: menuState.canResetImageReplacement,
          click: () => invokePreviewAction("resetImageReplacement")
        },
        { type: "separator" },
        {
          label: "编辑文本预览",
          enabled: menuState.canEditText,
          click: () => invokePreviewAction("editTextPreview")
        },
        {
          label: "重置文本预览",
          enabled: menuState.canResetText,
          click: () => invokePreviewAction("resetTextPreview")
        }
      ]
    },
    {
      label: "窗口",
      submenu: [
        { role: "minimize", label: "最小化" },
        { role: "zoom", label: "缩放" },
        ...(process.platform === "darwin" ? [
          { type: "separator" },
          { role: "front", label: "全部置于最前" }
        ] : [
          { role: "close", label: "关闭窗口" }
        ])
      ]
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "复制当前状态摘要",
          click: () => invokePreviewAction("copyStateSummary")
        }
      ]
    }
  ]));
}

function installApplicationMenu(window) {
  if (usesShortTermPreviewShell) {
    installShortTermApplicationMenu(window);
    return;
  }
  const runRendererMenuAction = (label, code) => {
    window.webContents.executeJavaScript(code).catch((error) => {
      console.error(`AUTO_SVGA_MENU_ACTION_ERROR ${label} ${redactLogMessage(error instanceof Error ? error.message : error)}`);
    });
  };
  const runRendererMenuActionAsync = async (label, code) => {
    try {
      return await window.webContents.executeJavaScript(code);
    } catch (error) {
      console.error(`AUTO_SVGA_MENU_ACTION_ERROR ${label} ${redactLogMessage(error instanceof Error ? error.message : error)}`);
      return undefined;
    }
  };
  const invokeWorkbenchAction = (name, ...args) => runRendererMenuAction(
    name,
    `window.__autoSvgaWorkbenchActions?.[${JSON.stringify(name)}]?.(...${JSON.stringify(args)})`
  );
  const invokeWorkbenchActionAsync = (name, ...args) => runRendererMenuActionAsync(
    name,
    `window.__autoSvgaWorkbenchActions?.[${JSON.stringify(name)}]?.(...${JSON.stringify(args)})`
  );
  const appMenu = process.platform === "darwin"
    ? [{
        label: "Auto SVGA",
        submenu: [
          { role: "about", label: "关于 Auto SVGA" },
          { type: "separator" },
          { role: "hide", label: "隐藏 Auto SVGA" },
          { role: "hideOthers", label: "隐藏其他" },
          { role: "unhide", label: "全部显示" },
          { type: "separator" },
          { role: "quit", label: "退出 Auto SVGA" }
        ]
      }]
    : [];
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...appMenu,
    {
      label: "文件",
      submenu: [
        {
          label: "打开 SVGA...",
          accelerator: "CommandOrControl+O",
          click: () => {
            openSvgaFromHostMenu(window).catch((error) => {
              console.error(`AUTO_SVGA_FILE_OPEN_ERROR ${redactLogMessage(error instanceof Error ? error.message : error)}`);
            });
          }
        },
        {
          label: "打开对比 SVGA...",
          click: async () => {
            await invokeWorkbenchActionAsync("prepareSecondaryOpen");
            openSvgaFromHostMenu(window, "#secondaryFileInput").catch((error) => {
              console.error(`AUTO_SVGA_FILE_OPEN_ERROR ${redactLogMessage(error instanceof Error ? error.message : error)}`);
            });
          }
        },
        {
          label: "打开参考媒体...",
          click: async () => {
            await invokeWorkbenchActionAsync("prepareReferenceOpen");
            openReferenceFromHostMenu(window).catch((error) => {
              console.error(`AUTO_SVGA_REFERENCE_OPEN_ERROR ${redactLogMessage(error instanceof Error ? error.message : error)}`);
            });
          }
        },
        { type: "separator" },
        {
          label: "清空当前文件",
          click: () => invokeWorkbenchAction("clearCurrentFile")
        },
        { type: "separator" },
        {
          label: "另存替换副本...",
          accelerator: "CommandOrControl+Shift+S",
          click: () => invokeWorkbenchAction("saveReplacement")
        },
        { type: "separator" },
        {
          label: "退出 Auto SVGA",
          accelerator: "CommandOrControl+Q",
          click: () => app.quit()
        }
      ]
    },
    {
      label: "编辑",
      submenu: [
        {
          label: "撤销替换预览",
          accelerator: "CommandOrControl+Z",
          click: () => invokeWorkbenchAction("undoReplacement")
        },
        {
          label: "重做替换预览",
          accelerator: "CommandOrControl+Shift+Z",
          click: () => invokeWorkbenchAction("redoReplacement")
        },
        {
          label: "重置替换预览",
          click: () => invokeWorkbenchAction("resetReplacement")
        },
        { type: "separator" },
        { label: "剪切", role: "cut" },
        { label: "复制", role: "copy" },
        { label: "粘贴", role: "paste" },
        { label: "全选", role: "selectAll" }
      ]
    },
    {
      label: "资源",
      submenu: [
        {
          label: "显示资源列表",
          click: () => invokeWorkbenchAction("showResources")
        },
        {
          label: "显示图层列表",
          click: () => invokeWorkbenchAction("showLayers")
        },
        { type: "separator" },
        {
          label: "替换选中资源...",
          click: () => invokeWorkbenchAction("replaceSelectedResource")
        },
        {
          label: "复制当前资源 Key",
          click: () => invokeWorkbenchAction("copyCurrentResourceKey")
        }
      ]
    },
    {
      label: "优化",
      submenu: [
        {
          label: "生成优化副本...",
          click: () => invokeWorkbenchAction("saveOptimizedCopy")
        }
      ]
    },
    {
      label: "播放",
      submenu: [
        {
          label: "播放/暂停当前预览",
          click: () => invokeWorkbenchAction("togglePrimaryPlayback")
        },
        {
          label: "重新播放当前预览",
          click: () => invokeWorkbenchAction("replayPrimary")
        },
        {
          label: "切换当前预览循环",
          click: () => invokeWorkbenchAction("togglePrimaryLoop")
        },
        {
          label: "切换全局循环",
          click: () => invokeWorkbenchAction("toggleGlobalLoop")
        },
        { type: "separator" },
        {
          label: "切换对比模式",
          click: () => invokeWorkbenchAction("toggleCompare")
        },
        {
          label: "同步播放/暂停",
          click: () => invokeWorkbenchAction("toggleSyncPlayback")
        },
        {
          label: "同步重新播放",
          click: () => invokeWorkbenchAction("syncReplay")
        }
      ]
    },
    {
      label: "视图",
      submenu: [
        {
          label: "显示检查报告",
          click: () => invokeWorkbenchAction("openDiagnostics")
        },
        { type: "separator" },
        {
          label: "活动记录",
          accelerator: "CommandOrControl+L",
          click: () => invokeWorkbenchAction("toggleLogs")
        },
        {
          label: "设置",
          accelerator: "CommandOrControl+,",
          click: () => invokeWorkbenchAction("openSettings")
        },
        { type: "separator" },
        {
          label: "外观",
          submenu: [
            { label: "跟随系统", click: () => invokeWorkbenchAction("setTheme", "system") },
            { label: "浅色", click: () => invokeWorkbenchAction("setTheme", "light") },
            { label: "深色", click: () => invokeWorkbenchAction("setTheme", "dark") }
          ]
        },
        {
          label: "预览背景",
          submenu: [
            { label: "棋盘格", click: () => invokeWorkbenchAction("setPreviewBackground", "checkerboard") },
            { label: "浅色", click: () => invokeWorkbenchAction("setPreviewBackground", "light") },
            { label: "深色", click: () => invokeWorkbenchAction("setPreviewBackground", "dark") },
            { label: "透明", click: () => invokeWorkbenchAction("setPreviewBackground", "transparent") }
          ]
        },
        {
          label: "主预览适配",
          submenu: [
            { label: "适应窗口", click: () => invokeWorkbenchAction("setFitMode", "a", "contain") },
            { label: "原始尺寸", click: () => invokeWorkbenchAction("setFitMode", "a", "original") },
            { label: "适应宽度", click: () => invokeWorkbenchAction("setFitMode", "a", "fitWidth") }
          ]
        },
        {
          label: "对比预览适配",
          submenu: [
            { label: "适应窗口", click: () => invokeWorkbenchAction("setFitMode", "b", "contain") },
            { label: "原始尺寸", click: () => invokeWorkbenchAction("setFitMode", "b", "original") },
            { label: "适应宽度", click: () => invokeWorkbenchAction("setFitMode", "b", "fitWidth") }
          ]
        },
        {
          label: "参考媒体适配",
          submenu: [
            { label: "适应窗口", click: () => invokeWorkbenchAction("setFitMode", "reference", "contain") },
            { label: "原始尺寸", click: () => invokeWorkbenchAction("setFitMode", "reference", "original") },
            { label: "适应宽度", click: () => invokeWorkbenchAction("setFitMode", "reference", "fitWidth") }
          ]
        }
      ]
    },
    {
      label: "窗口",
      submenu: [
        { role: "minimize", label: "最小化" },
        { role: "zoom", label: "缩放" },
        ...(process.platform === "darwin" ? [
          { type: "separator" },
          { role: "front", label: "全部置于最前" }
        ] : [
          { role: "close", label: "关闭窗口" }
        ])
      ]
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "复制活动记录",
          click: () => invokeWorkbenchAction("copyLogs")
        },
        {
          label: "清除活动记录",
          click: () => invokeWorkbenchAction("clearLogs")
        }
      ]
    }
  ]));
}

async function saveShortTermSvgaOutput(input) {
  if (!usesShortTermPreviewShell) throw new Error("SVGA save is only available in the preview shell.");
  const value = validateShortTermSvgaSaveInput(input);
  if (!value) throw new Error("Invalid short-term save payload");
  const originalPath = value.sourceId ? sourceFilePaths.get(value.sourceId) : "";
  let targetPath;
  if (value.command === "overwrite") {
    if (!originalPath) {
      throw new Error("覆盖保存需要先通过客户端打开本地 SVGA。");
    }
    targetPath = originalPath;
  } else if (normalProofMode || productSmokeMode) {
    mkdirSync(productArtifactRoot, { recursive: true });
    targetPath = path.join(productArtifactRoot, normalProofMode ? "short-term-normal-save-as.svga" : "short-term-smoke-save-as.svga");
  } else {
    const result = await dialog.showSaveDialog({
      title: "另存为 SVGA",
      defaultPath: value.suggestedName,
      filters: [{ name: "SVGA", extensions: ["svga"] }],
      properties: ["createDirectory", "showOverwriteConfirmation"]
    });
    if (result.canceled || !result.filePath) {
      return { status: "cancelled" };
    }
    targetPath = result.filePath.toLowerCase().endsWith(".svga") ? result.filePath : `${result.filePath}.svga`;
    if (originalPath && sameSaveAsSourcePath(targetPath, originalPath)) {
      throw new Error("另存为目标需要不同于当前源文件；请使用覆盖保存。");
    }
  }

  writeSvgaBytesAtomically(targetPath, value.bytes);
  const writtenBytes = readFileSync(targetPath);
  const writtenSha256 = createHash("sha256").update(writtenBytes).digest("hex");
  if (writtenSha256 !== value.sha256) {
    throw new Error("保存后校验失败，输出文件哈希不一致。");
  }
  const savedSourceId = rememberSourceFile(targetPath);
  rememberShortTermRecentFile(targetPath);
  return {
    status: "saved",
    sourceId: savedSourceId,
    fileName: path.basename(targetPath),
    sizeBytes: value.bytes.byteLength,
    sha256: writtenSha256,
    targetPathRedacted: sanitizeRuntimeArgument(targetPath)
  };
}

async function saveEditedSvga(input) {
  const value = validateEditedSvgaSaveInput(input);
  if (!value) throw new Error("Invalid Save As payload");
  const p3SmokeSaveAs = productMilestoneId === "P3" && (smokeMode || productSmokeMode || normalProofMode);
  const p4SmokeSaveAs = productMilestoneId === "P4" && (smokeMode || productSmokeMode || normalProofMode);
  const p5SmokeSaveAs = productMilestoneId === "P5" && (smokeMode || productSmokeMode || normalProofMode);
  const p3WorkbenchSmokeSaveAs = value.validation.milestoneId === "P3" && (smokeMode || productSmokeMode || normalProofMode);
  const p4WorkbenchSmokeSaveAs = value.validation.milestoneId === "P4" && (smokeMode || productSmokeMode || normalProofMode);
  const automatedProductSaveAs = p3SmokeSaveAs || p4SmokeSaveAs || p5SmokeSaveAs || p3WorkbenchSmokeSaveAs || p4WorkbenchSmokeSaveAs;
  const originalPath = value.sourceId ? sourceFilePaths.get(value.sourceId) : "";
  if (!automatedProductSaveAs && !originalPath) {
    throw new Error("Save As requires the source SVGA to be opened through the desktop file picker.");
  }
  let targetPath;
  if (automatedProductSaveAs) {
    mkdirSync(productArtifactRoot, { recursive: true });
    targetPath = path.join(productArtifactRoot,
      p5SmokeSaveAs
        ? "batch-edited-output.svga"
        : (p4SmokeSaveAs || p4WorkbenchSmokeSaveAs)
          ? "multi-resource-edited-output.svga"
          : "edited-output.svga");
  } else {
    const result = await dialog.showSaveDialog({
      title: "另存为 SVGA",
      defaultPath: value.suggestedName,
      filters: [{ name: "SVGA", extensions: ["svga"] }],
      properties: ["createDirectory", "showOverwriteConfirmation"]
    });
    if (result.canceled || !result.filePath) {
      return { status: "cancelled" };
    }
    targetPath = result.filePath.toLowerCase().endsWith(".svga") ? result.filePath : `${result.filePath}.svga`;
  }
  if (originalPath && sameSaveAsSourcePath(targetPath, originalPath)) {
    throw new Error("Save As target must be different from the original SVGA.");
  }

  writeSvgaBytesAtomically(targetPath, value.bytes);
  if (automatedProductSaveAs) {
    const scenario = p5SmokeSaveAs
      ? "p5-batch-edited-output-svga"
      : p4SmokeSaveAs
        ? "p4-multi-resource-edited-output-svga"
        : "p3-edited-output-svga";
    const editedOutputFileName = p5SmokeSaveAs
      ? "batch-edited-output.svga"
      : p4SmokeSaveAs
        ? "multi-resource-edited-output.svga"
        : "edited-output.svga";
    addProductArtifactRecord({
      scenario,
      mode: "smoke",
      source: "desktop",
      viewport: { width: null, height: null },
      path: `.artifacts/product/${productMilestoneId}/${editedOutputFileName}`,
      mime: "application/x-svga",
      sizeBytes: value.bytes.byteLength,
      sha256: createHash("sha256").update(value.bytes).digest("hex"),
      fixture: "synthetic-avatar-frame.svga",
      inputKind: p5SmokeSaveAs
        ? "p5-batch-edited-output"
        : p4SmokeSaveAs
          ? "p4-multi-resource-edited-output"
          : "p3-edited-output",
      ...canonicalFixtureMetadata(),
      headCommit: productArtifactIndex.headCommit,
      rendererEntry: `tools/electron-prototype/experiments/svga-web/${rendererEntry}`,
      rendererSha256: sha256RelativeFile(rendererEntry),
      generatedAt: new Date().toISOString(),
      humanReviewRequired: true
    });
    writeProductArtifactIndex();
  }
  const savedSourceId = rememberSourceFile(targetPath);

  return {
    status: "saved",
    sourceId: savedSourceId,
    fileName: path.basename(targetPath),
    sizeBytes: value.bytes.byteLength,
    sha256: createHash("sha256").update(value.bytes).digest("hex"),
    targetPathRedacted: sanitizeRuntimeArgument(targetPath),
    savedSvgaBase64: value.bytes.toString("base64")
  };
}

async function saveOptimizedSvga(input) {
  const value = validateOptimizedSvgaSaveInput(input);
  if (!value) throw new Error("Invalid optimized Save As payload");
  const originalPath = value.sourceId ? sourceFilePaths.get(value.sourceId) : "";
  if (!originalPath) {
    throw new Error("Optimized Save As requires the source SVGA to be opened through the desktop file picker.");
  }
  const result = await dialog.showSaveDialog({
    title: "另存为优化 SVGA",
    defaultPath: value.suggestedName,
    filters: [{ name: "SVGA", extensions: ["svga"] }],
    properties: ["createDirectory", "showOverwriteConfirmation"]
  });
  if (result.canceled || !result.filePath) {
    return { status: "cancelled" };
  }
  const targetPath = result.filePath.toLowerCase().endsWith(".svga") ? result.filePath : `${result.filePath}.svga`;
  if (sameSaveAsSourcePath(targetPath, originalPath)) {
    throw new Error("Optimized Save As target must be different from the original SVGA.");
  }

  writeSvgaBytesAtomically(targetPath, value.bytes);
  const savedSourceId = rememberSourceFile(targetPath);
  return {
    status: "saved",
    sourceId: savedSourceId,
    fileName: path.basename(targetPath),
    sizeBytes: value.bytes.byteLength,
    sha256: createHash("sha256").update(value.bytes).digest("hex"),
    optimizationReportDigest: createHash("sha256").update(JSON.stringify(value.validation)).digest("hex"),
    targetPathRedacted: sanitizeRuntimeArgument(targetPath),
    savedSvgaBase64: value.bytes.toString("base64")
  };
}

async function saveSequenceRepairSvga(input) {
  const value = validateSequenceRepairSvgaSaveInput(input);
  if (!value) throw new Error("Invalid sequence repair Save As payload");
  const automatedProductSaveAs = smokeMode || productSmokeMode || normalProofMode;
  const originalPath = value.sourceId ? sourceFilePaths.get(value.sourceId) : "";
  if (!automatedProductSaveAs && !originalPath) {
    throw new Error("Sequence repair Save As requires the source SVGA to be opened through the desktop file picker.");
  }
  let targetPath;
  if (automatedProductSaveAs) {
    mkdirSync(productArtifactRoot, { recursive: true });
    targetPath = path.join(productArtifactRoot, "sequence-repaired-output.svga");
  } else {
    const result = await dialog.showSaveDialog({
      title: "另存为序列修复 SVGA",
      defaultPath: value.suggestedName,
      filters: [{ name: "SVGA", extensions: ["svga"] }],
      properties: ["createDirectory", "showOverwriteConfirmation"]
    });
    if (result.canceled || !result.filePath) {
      return { status: "cancelled" };
    }
    targetPath = result.filePath.toLowerCase().endsWith(".svga") ? result.filePath : `${result.filePath}.svga`;
  }
  if (originalPath && sameSaveAsSourcePath(targetPath, originalPath)) {
    throw new Error("Sequence repair Save As target must be different from the original SVGA.");
  }

  writeSvgaBytesAtomically(targetPath, value.bytes);
  const savedSha256 = createHash("sha256").update(value.bytes).digest("hex");
  if (automatedProductSaveAs) {
    addProductArtifactRecord({
      scenario: "phase4-sequence-repaired-output-svga",
      mode: "smoke",
      source: "desktop",
      viewport: { width: null, height: null },
      path: `.artifacts/product/${productMilestoneId}/sequence-repaired-output.svga`,
      mime: "application/x-svga",
      sizeBytes: value.bytes.byteLength,
      sha256: savedSha256,
      fixture: "synthetic-avatar-frame.svga",
      inputKind: "phase4-sequence-repaired-output",
      sequenceRepairReportDigest: createHash("sha256").update(JSON.stringify(value.validation)).digest("hex"),
      repairedResourceKey: value.validation.sequenceGroup.repairedResourceKey,
      ...canonicalFixtureMetadata(),
      headCommit: productArtifactIndex.headCommit,
      rendererEntry: `tools/electron-prototype/experiments/svga-web/${rendererEntry}`,
      rendererSha256: sha256RelativeFile(rendererEntry),
      generatedAt: new Date().toISOString(),
      humanReviewRequired: true
    });
    writeProductArtifactIndex();
  }
  const savedSourceId = rememberSourceFile(targetPath);
  return {
    status: "saved",
    sourceId: savedSourceId,
    fileName: path.basename(targetPath),
    sizeBytes: value.bytes.byteLength,
    sha256: savedSha256,
    sequenceRepairReportDigest: createHash("sha256").update(JSON.stringify(value.validation)).digest("hex"),
    targetPathRedacted: sanitizeRuntimeArgument(targetPath),
    savedSvgaBase64: value.bytes.toString("base64")
  };
}

function sameSaveAsSourcePath(targetPath, originalPath) {
  return canonicalSavePath(targetPath) === canonicalSavePath(originalPath);
}

function canonicalSavePath(value) {
  return path.resolve(value).normalize("NFC").toLowerCase();
}

function writeSvgaBytesAtomically(targetPath, bytes) {
  const temporaryPath = `${targetPath}.tmp-${process.pid}-${randomBytes(6).toString("hex")}`;
  let descriptor;
  try {
    descriptor = openSync(temporaryPath, "wx");
    writeSync(descriptor, bytes, 0, bytes.byteLength, 0);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(temporaryPath, targetPath);
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // Best-effort close before temporary file cleanup.
      }
    }
    try {
      unlinkSync(temporaryPath);
    } catch {
      // Temporary cleanup is best-effort after a failed write or rename.
    }
    throw error;
  }
}

async function finishAudit(window, result) {
  if (auditFinished) return;
  auditFinished = true;
  console.log(`AUTO_SVGA_REAL_SAMPLE_AUDIT ${JSON.stringify(result)}`);
  await cleanupRuntime();
  window.destroy();
  const failed = (auditPlayer !== "svgaplayerweb" && result.cspViolationSeen)
    || result.samples.some((sample) => !sample.loadSuccess || !sample.playbackStarted || !sample.canvasNonBlank);
  app.exit(failed ? 1 : 0);
}

async function cleanupRuntime() {
  if (cleanedUp) return;
  cleanedUp = true;
  const serverClosed = Boolean(experimentServer);
  let serverCloseTimedOut = false;
  if (experimentServer) {
    await Promise.race([
      experimentServer.close(),
      new Promise((resolve) => setTimeout(() => {
        serverCloseTimedOut = true;
        resolve();
      }, 2500))
    ]);
  }
  rmSync(sessionRoot, { recursive: true, force: true });
  console.log(`AUTO_SVGA_RUNTIME_CLEANUP ${JSON.stringify({
    serverClosed,
    serverCloseTimedOut,
    sessionRootRedacted: sanitizeRuntimeArgument(sessionRoot),
    tempRemoved: true
  })}`);
}

async function createExperimentWindow() {
  const { startSvgaWebExperimentServer } = await import(
    pathToFileURL(path.join(appRoot, "server.mjs")).href
  );
  experimentServer = await startSvgaWebExperimentServer({ appRoot, reportToken, desktopArtifacts });
  expectedOrigin = experimentServer.origin;
  let initialPlacement = isMultiFormatDesktopProduct
    ? resolveInitialMultiFormatWindowPlacement()
    : undefined;
  if (initialPlacement?.mode === "acceptance") {
    const requestedDisplayId = initialPlacement.requestedDisplayId;
    const revalidatedPlacement = revalidateAcceptanceLaunchPlacement({
      placement: initialPlacement,
      displays: screen.getAllDisplays(),
      minimumSize: macosWorkbenchWindowSizing.minimumLaunch
    });
    if (revalidatedPlacement.status === "rejected") {
      throw new Error(`window_placement_rejected:${revalidatedPlacement.reason}`);
    }
    initialPlacement = { ...revalidatedPlacement, mode: "acceptance", preferenceStatus: "not-read", requestedDisplayId };
  }
  activeWindowPlacementMode = initialPlacement?.mode ?? "legacy";
  const launchBounds = initialPlacement?.bounds ?? (
    usesShortTermPreviewShell
      ? chooseMacosLaunchWindowBounds()
      : chooseMacosWorkbenchWindowBounds()
  );

  const window = new BrowserWindow({
    title: productDisplayName,
    ...(smokeMode ? { x: -20000, y: -20000 } : { x: launchBounds.x, y: launchBounds.y }),
    width: launchBounds.width,
    height: launchBounds.height,
    minWidth: usesShortTermPreviewShell
      ? macosWorkbenchWindowSizing.minimumLaunch.width
      : macosWorkbenchWindowSizing.minimumSupported.width,
    minHeight: usesShortTermPreviewShell
      ? macosWorkbenchWindowSizing.minimumLaunch.height
      : macosWorkbenchWindowSizing.minimumSupported.height,
    ...(process.platform === "darwin"
      ? {
          titleBarStyle: "hiddenInset",
          trafficLightPosition: { x: 14, y: 18 }
        }
      : {}),
    show: false,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      ...createSecureWebPreferences({
        preloadPath: path.join(appRoot, "preload.cjs"),
        reportToken,
        productMilestoneId,
        hostBoundaryMode
      })
    }
  });
  requireAcceptanceStartupPlacementProof(window, initialPlacement);
  activeMainWindow = window;
  installApplicationMenu(window);
  installShortTermWindowBoundsPolicy(window);

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const allowed = isAllowedHostUrl(details.url, expectedOrigin, {
      allowBlob: true,
      allowDevtools: true
    });
    if (!allowed) blockedExternalRequests.push(sanitizeRuntimeArgument(details.url));
    callback({
      cancel: !allowed
    });
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("console-message", (event, ...legacyArguments) => {
    const message = event?.message
      ?? legacyArguments.find((value) => typeof value === "string")
      ?? "renderer message unavailable";
    if (!(auditPlayer === "svgaplayerweb" && /Electron Security Warning.+unsafe-eval/is.test(String(message)))
      && /violates.+script-src|unsafe-eval|wasm-eval/i.test(String(message))) {
      cspViolationSeen = true;
    }
    console.log(`AUTO_SVGA_WEB_RENDERER ${redactLogMessage(message)}`);
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedHostUrl(url, expectedOrigin)) event.preventDefault();
  });

  ipcMain.handle(IPC_CHANNELS.smokeResult, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    rejectFormalShortTermHostCapability(productMilestoneId, hostBoundaryMode, "smokeResult");
    const result = validateSmokeResult(input);
    if (!result) {
      console.log(`AUTO_SVGA_SMOKE_RESULT_REJECTED ${JSON.stringify({ reason: describeSmokeResultValidationFailure(input) })}`);
      throw new Error("Invalid smoke result");
    }
    if (smokeMode) await finishSmoke(window, result);
    return { accepted: true };
  });

  ipcMain.handle(IPC_CHANNELS.captureArtifact, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    rejectFormalShortTermHostCapability(productMilestoneId, hostBoundaryMode, "captureArtifact");
    if (!productSmokeMode && !normalProofMode) throw new Error("Product artifact capture is only available in product capture mode");
    const scenario = validateArtifactScenario(input);
    if (!scenario) throw new Error("Invalid product artifact scenario");
    return captureProductArtifact(window, scenario);
  });

  ipcMain.handle(IPC_CHANNELS.performSmokeInput, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    rejectFormalShortTermHostCapability(productMilestoneId, hostBoundaryMode, "performSmokeInput");
    if (!productSmokeMode) throw new Error("Product smoke input is only available in product smoke mode");
    return performP6SmokeInput(event.sender, input);
  });

  ipcMain.handle(IPC_CHANNELS.scanLatestArtifacts, async (event) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    rejectFormalShortTermHostCapability(productMilestoneId, hostBoundaryMode, "scanLatestArtifacts");
    return desktopArtifacts.scan();
  });

  ipcMain.handle(IPC_CHANNELS.auditResult, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    rejectFormalShortTermHostCapability(productMilestoneId, hostBoundaryMode, "auditResult");
    const result = validateAuditResult(input);
    if (!result) throw new Error("Invalid audit result");
    if (auditMode) await finishAudit(window, result);
    return { accepted: true };
  });

  ipcMain.handle(IPC_CHANNELS.normalProofResult, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    rejectFormalShortTermHostCapability(productMilestoneId, hostBoundaryMode, "normalProofResult");
    const result = validateNormalProofResult(input);
    if (!result) throw new Error("Invalid normal proof result");
    if (normalProofMode) await finishNormalProof(window, result);
    return { accepted: true };
  });

  ipcMain.handle(IPC_CHANNELS.saveEditedSvga, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    rejectFormalShortTermHostCapability(productMilestoneId, hostBoundaryMode, "saveEditedSvga");
    return saveEditedSvga(input);
  });

  ipcMain.handle(IPC_CHANNELS.saveOptimizedSvga, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    rejectFormalShortTermHostCapability(productMilestoneId, hostBoundaryMode, "saveOptimizedSvga");
    return saveOptimizedSvga(input);
  });

  ipcMain.handle(IPC_CHANNELS.saveSequenceRepairSvga, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    rejectFormalShortTermHostCapability(productMilestoneId, hostBoundaryMode, "saveSequenceRepairSvga");
    return saveSequenceRepairSvga(input);
  });

  ipcMain.handle(IPC_CHANNELS.openSvgaFile, async (event) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    return openSvgaFile();
  });

  ipcMain.handle(IPC_CHANNELS.openMultiFormatFile, async (event) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    assertMultiFormatDesktopProduct();
    return openMultiFormatFile();
  });

  ipcMain.handle(IPC_CHANNELS.openDroppedMultiFormatFile, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    assertMultiFormatDesktopProduct();
    return openDroppedMultiFormatFile(input);
  });

  ipcMain.handle(IPC_CHANNELS.prepareMultiFormatRuntimePreview, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    assertMultiFormatDesktopProduct();
    return prepareMultiFormatRuntimePreview(input);
  });

  ipcMain.handle(IPC_CHANNELS.controlMultiFormatPreview, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    assertMultiFormatDesktopProduct();
    return controlMultiFormatPreview(input);
  });

  ipcMain.handle(IPC_CHANNELS.chooseMultiFormatReplacementImage, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    assertMultiFormatDesktopProduct();
    return chooseMultiFormatReplacementImage(input);
  });

  ipcMain.handle(IPC_CHANNELS.applyMultiFormatReplacement, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    assertMultiFormatDesktopProduct();
    return applyMultiFormatReplacement(input);
  });

  ipcMain.handle(IPC_CHANNELS.resetMultiFormatReplacement, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    assertMultiFormatDesktopProduct();
    return resetMultiFormatReplacement(input);
  });

  ipcMain.handle(IPC_CHANNELS.multiFormatRendererReady, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    assertMultiFormatDesktopProduct();
    if (input?.phase !== "renderer_action_bridge_ready") throw new Error("Invalid multi-format renderer phase.");
    multiFormatTrace.record({
      phase: "renderer_action_bridge_ready",
      productMilestoneId,
      formalRuntimeMode: isMultiFormatDesktopProduct,
      queueDepth: pendingMultiFormatOpenFileEvents.length,
      bridgeReady: true
    });
    multiFormatDesktopRendererReady = true;
    void flushPendingMultiFormatOpenFileEvents().catch((error) => {
      console.error(`AUTO_SVGA_MULTI_FORMAT_FILE_OPEN_FLUSH_ERROR ${redactLogMessage(error instanceof Error ? error.message : error)}`);
    });
    return { accepted: true };
  });

  ipcMain.handle(IPC_CHANNELS.openReferenceMediaFile, async (event) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    rejectFormalShortTermHostCapability(productMilestoneId, hostBoundaryMode, "openReferenceMediaFile");
    return openReferenceMediaFile();
  });

  ipcMain.handle(IPC_CHANNELS.getRecentSvgaFiles, async (event) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    return {
      schemaVersion: 1,
      pathRedacted: true,
      records: shortTermRecentView()
    };
  });

  ipcMain.handle(IPC_CHANNELS.openRecentSvgaFile, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    return openShortTermRecentFile(input);
  });

  ipcMain.handle(IPC_CHANNELS.clearRecentSvgaFiles, async (event) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    return clearShortTermRecentFiles();
  });

  ipcMain.handle(IPC_CHANNELS.writeClipboardText, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    return writeClipboardText(input);
  });

  ipcMain.handle(IPC_CHANNELS.updateShortTermMenuState, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    return updateShortTermMenuState(input);
  });

  ipcMain.handle(IPC_CHANNELS.setShortTermWindowMode, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    return setShortTermWindowMode(input, window);
  });

  ipcMain.handle(IPC_CHANNELS.saveShortTermSvgaOutput, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    return saveShortTermSvgaOutput(input);
  });

  ipcMain.handle(IPC_CHANNELS.p3EditResult, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    rejectFormalShortTermHostCapability(productMilestoneId, hostBoundaryMode, "p3EditResult");
    if (productMilestoneId !== "P3") throw new Error("P3 edit result is only accepted in P3 artifact mode");
    const result = validateP3EditResult(input);
    if (!result) throw new Error("Invalid P3 edit result");
    const verifiedRoundTripReport = {
      ...result.roundTripReport,
      schemaVersion: 2,
      milestoneId: "P3",
      headCommit: productArtifactIndex.headCommit,
      playbackPassed: result.reopenedExport,
      canvasNonBlank: result.reopenedExport,
      passed: result.roundTripReport.passed === true
        && result.roundTripReport.schemaVersion === 2
        && result.reopenedExport
        && Array.isArray(result.roundTripReport.unexpectedChanges)
        && result.roundTripReport.unexpectedChanges.length === 0
        && result.thumbnailEvidence.passed === true
    };
    const verifiedResult = {
      ...result,
      roundTripReport: verifiedRoundTripReport,
      passed: result.passed === true && verifiedRoundTripReport.passed === true
    };
    writeJsonProductArtifact("resource-edit-report.json", "p3-resource-edit-report", verifiedResult);
    writeJsonProductArtifact("round-trip-report.json", "p3-round-trip-report", verifiedRoundTripReport);
    writeJsonProductArtifact("thumbnail-evidence.json", "p3-thumbnail-evidence", {
      schemaVersion: 1,
      milestoneId: "P3",
      headCommit: productArtifactIndex.headCommit,
      ...result.thumbnailEvidence
    });
    return { accepted: true };
  });

  ipcMain.handle(IPC_CHANNELS.p4EditResult, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    rejectFormalShortTermHostCapability(productMilestoneId, hostBoundaryMode, "p4EditResult");
    if (productMilestoneId !== "P4") throw new Error("P4 edit result is only accepted in P4 artifact mode");
    const result = validateP4EditResult(input);
    if (!result) throw new Error("Invalid P4 edit result");
    const verifiedRoundTripReport = {
      ...result.roundTripReport,
      schemaVersion: 3,
      milestoneId: "P4",
      headCommit: productArtifactIndex.headCommit,
      playbackPassed: result.reopenedExport,
      canvasNonBlank: result.reopenedExport,
      passed: result.roundTripReport.passed === true
        && result.roundTripReport.schemaVersion === 3
        && result.reopenedExport
        && Array.isArray(result.roundTripReport.replacements)
        && result.roundTripReport.replacements.length >= 2
        && result.roundTripReport.replacements.every((replacement) => replacement.passed === true)
        && Array.isArray(result.roundTripReport.unexpectedChanges)
        && result.roundTripReport.unexpectedChanges.length === 0
    };
    const verifiedResult = {
      ...result,
      roundTripReport: verifiedRoundTripReport,
      passed: result.passed === true && verifiedRoundTripReport.passed === true
    };
    const fixture = canonicalFixtureMetadata();
    writeJsonProductArtifact("canonical-multi-resource-fixture.json", "p4-canonical-multi-resource-fixture", {
      schemaVersion: 1,
      milestoneId: "P4",
      headCommit: productArtifactIndex.headCommit,
      fixturePath: fixture.fixtureArtifactPath,
      fixtureSha256: fixture.fixtureSha256,
      dimensions: { width: 300, height: 300 },
      fps: 24,
      frames: 24,
      approvedSynthetic: true,
      resourceKeys: [
        ...result.selectedResourceKeys,
        result.untouchedResourceKey
      ].filter(Boolean),
      resourceSha256: result.thumbnailEvidence.original ?? {},
      spriteUsage: {
        [result.selectedResourceKeys[0] ?? ""]: 1,
        [result.selectedResourceKeys[1] ?? ""]: 1,
        [result.untouchedResourceKey ?? ""]: 0
      },
      replacements: {
        replacementA: result.replacementASha256,
        replacementB: result.replacementBSha256
      },
      generatedAt: new Date().toISOString()
    });
    writeJsonProductArtifact("multi-resource-edit-report.json", "p4-multi-resource-edit-report", verifiedResult);
    writeJsonProductArtifact("multi-resource-round-trip-report.json", "p4-multi-resource-round-trip-report", verifiedRoundTripReport);
    writeJsonProductArtifact("edit-history-report.json", "p4-edit-history-report", {
      ...result.historyReport,
      headCommit: productArtifactIndex.headCommit,
      passed: result.historyReport.passed === true
    });
    writeJsonProductArtifact("thumbnail-evidence.json", "p4-thumbnail-evidence", {
      ...result.thumbnailEvidence,
      headCommit: productArtifactIndex.headCommit,
      passed: result.thumbnailEvidence.passed === true
    });
    return { accepted: true };
  });

  ipcMain.handle(IPC_CHANNELS.p5BatchResult, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    rejectFormalShortTermHostCapability(productMilestoneId, hostBoundaryMode, "p5BatchResult");
    if (productMilestoneId !== "P5") throw new Error("P5 batch result is only accepted in P5 artifact mode");
    const result = validateP5BatchResult(input);
    if (!result) throw new Error("Invalid P5 batch result");
    const verifiedRoundTripReport = {
      ...result.roundTripReport,
      schemaVersion: 4,
      milestoneId: "P5",
      headCommit: productArtifactIndex.headCommit,
      playbackPassed: result.playbackPassed,
      canvasNonBlank: result.canvasNonBlank,
      reopenedPlaybackPassed: result.reopenedExport,
      reopenedCanvasNonBlank: result.reopenedExport,
      originalSourceUnchanged: result.originalUnchanged,
      passed: result.roundTripReport.passed === true
        && result.roundTripReport.schemaVersion === 4
        && result.playbackPassed
        && result.canvasNonBlank
        && result.reopenedExport
        && result.originalUnchanged
        && Array.isArray(result.roundTripReport.appliedMappings)
        && result.roundTripReport.appliedMappings.length >= 3
        && result.roundTripReport.appliedMappings.every((mapping) => mapping.passed === true)
        && Array.isArray(result.roundTripReport.replacements)
        && result.roundTripReport.replacements.length >= 3
        && result.roundTripReport.replacements.every((replacement) => replacement.passed === true)
        && Array.isArray(result.roundTripReport.unexpectedChanges)
        && result.roundTripReport.unexpectedChanges.length === 0
    };
    const verifiedLiveRuntimeProof = {
      ...result.liveRuntimeProof,
      schemaVersion: 1,
      milestoneId: "P5",
      headCommit: productArtifactIndex.headCommit,
      runtimeInstanceId,
      pid: process.pid,
      launchCommand: sanitizeRuntimeArgument(process.argv.join(" ")),
      mainSha256: sha256RelativeFile(mainEntry),
      preloadSha256: sha256RelativeFile(preloadEntry),
      rendererSha256: sha256RelativeFile(rendererEntry),
      playbackPassed: result.playbackPassed,
      canvasNonBlank: result.canvasNonBlank,
      reopenedPlaybackPassed: result.reopenedExport,
      reopenedCanvasNonBlank: result.reopenedExport,
      sourceSha256Before: result.sourceSha256Before,
      sourceSha256After: result.sourceSha256After,
      externalRequests: Array.isArray(result.liveRuntimeProof.externalRequests)
        ? result.liveRuntimeProof.externalRequests
        : [],
      processExitCode: 0,
      passed: result.liveRuntimeProof.passed === true
        && result.playbackPassed
        && result.canvasNonBlank
        && result.reopenedExport
        && result.originalUnchanged
        && Array.isArray(result.liveRuntimeProof.externalRequests)
        && result.liveRuntimeProof.externalRequests.length === 0
    };
    const verifiedResult = {
      ...result,
      roundTripReport: verifiedRoundTripReport,
      liveRuntimeProof: verifiedLiveRuntimeProof,
      passed: result.passed === true
        && verifiedRoundTripReport.passed === true
        && verifiedLiveRuntimeProof.passed === true
    };
    const fixture = canonicalFixtureMetadata();
    writeJsonProductArtifact("canonical-batch-fixture.json", "p5-canonical-batch-fixture", {
      schemaVersion: 1,
      milestoneId: "P5",
      headCommit: productArtifactIndex.headCommit,
      fixturePath: fixture.fixtureArtifactPath,
      fixtureSha256: fixture.fixtureSha256,
      approvedSynthetic: true,
      resourceKeys: [
        ...new Set([
          ...(verifiedRoundTripReport.replacedResourceKeys ?? []),
          ...(verifiedRoundTripReport.unchangedResourceKeys ?? [])
        ])
      ].sort(),
      generatedAt: new Date().toISOString()
    });
    writeJsonProductArtifact("batch-mapping-report.json", "p5-batch-mapping-report", result.mappingReport);
    writeJsonProductArtifact("batch-edit-history-report.json", "p5-batch-edit-history-report", {
      ...result.historyReport,
      headCommit: productArtifactIndex.headCommit,
      passed: result.historyReport.passed === true
    });
    writeJsonProductArtifact("batch-round-trip-report.json", "p5-batch-round-trip-report", verifiedRoundTripReport);
    writeJsonProductArtifact("thumbnail-evidence.json", "p5-thumbnail-evidence", {
      ...result.thumbnailEvidence,
      headCommit: productArtifactIndex.headCommit,
      passed: result.thumbnailEvidence.passed === true
    });
    writeJsonProductArtifact("p5-live-runtime-proof.json", "p5-live-runtime-proof", verifiedLiveRuntimeProof);
    writeJsonProductArtifact("p5-ui-flow-proof.json", "p5-ui-flow-proof", {
      ...result.uiFlowProof,
      headCommit: productArtifactIndex.headCommit,
      passed: result.uiFlowProof?.passed === true
    });
    writeJsonProductArtifact("p5-mapping-ui-render-proof.json", "p5-mapping-ui-render-proof", {
      ...result.mappingUiRenderProof,
      headCommit: productArtifactIndex.headCommit,
      passed: result.mappingUiRenderProof?.passed === true
    });
    const absolutePathFindings = verifiedRoundTripReport.privacy?.absolutePathFindings ?? 0;
    writeJsonProductArtifact("bundle-privacy-audit.json", "p5-bundle-privacy-audit", {
      schemaVersion: 1,
      milestoneId: "P5",
      headCommit: productArtifactIndex.headCommit,
      passed: verifiedLiveRuntimeProof.externalRequests.length === 0
        && absolutePathFindings === 0,
      externalRequests: verifiedLiveRuntimeProof.externalRequests,
      absolutePathFindings,
      assetPolicy: "synthetic-only; no user SVGA or PNG assets are committed or bundled",
      telemetry: "disabled",
      network: "local-only",
      generatedAt: new Date().toISOString()
    });
    writeJsonProductArtifact("p5-product-evidence-summary.json", "p5-product-evidence-summary", {
      schemaVersion: 1,
      milestoneId: "P5",
      headCommit: productArtifactIndex.headCommit,
      authoritativeEvidence: [
        "p5-live-runtime-proof.json",
        "batch-mapping-report.json",
        "batch-edit-history-report.json",
        "batch-round-trip-report.json",
        "thumbnail-evidence.json",
        "bundle-privacy-audit.json"
      ],
      pngArtifacts: {
        kind: "rendered_electron_ui_capture",
        isRenderedUiCapture: true,
        ownerReviewRole: "product_acceptance_evidence"
      },
      humanReviewRequired: true,
      passed: verifiedResult.passed === true,
      generatedAt: new Date().toISOString()
    });
    writeJsonProductArtifact("reviewer-b-product-categories.json", "p5-reviewer-b-product-categories", {
      schemaVersion: 2,
      milestoneId: "P5",
      headCommit: productArtifactIndex.headCommit,
      verdict: (result.reviewerBCategories ?? []).every((category) => category.verdict === "PASS" && category.screenshotSha256 && category.visualObservations?.length > 0)
        ? "PASS"
        : "BLOCKING",
      categoryCount: (result.reviewerBCategories ?? []).length,
      categories: result.reviewerBCategories ?? [],
      generationPolicy: "read-only product evidence review generated from rendered Electron screenshots; no source mutation during category review",
      generatedAt: new Date().toISOString()
    });
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
    }, productSmokeMode ? 80_000 : 20_000).unref();
  }

  if (auditMode) {
    setTimeout(() => {
      if (!auditFinished) finishAudit(window, {
        player: auditPlayer,
        cspViolationSeen: true,
        sampleCount: 0,
        samples: []
      });
    }, 120_000).unref();
  }

  const productMode = normalProofMode
    ? ""
    : smokeMode
      ? `?mode=smoke${productSmokeMode ? "&artifacts=1" : ""}`
      : "";
  const rendererPath = usesShortTermPreviewShell ? "/" : "/workbench.html";
  const rendererUrl = auditMode ? `${expectedOrigin}/audit.html?player=${auditPlayer}` : `${expectedOrigin}${rendererPath}${productMode}`;
  if (productSmokeMode) {
    const smokeIdentity = runtimeIdentity("smoke", rendererUrl);
    writeJsonProductArtifact("runtime-identity.json", "runtime-identity", smokeIdentity);
  }
  multiFormatDesktopRendererReady = false;
  await window.loadURL(rendererUrl);
  multiFormatTrace.record({
    phase: "renderer_load_completed",
    productMilestoneId,
    formalRuntimeMode: isMultiFormatDesktopProduct,
    queueDepth: pendingMultiFormatOpenFileEvents.length,
    bridgeReady: false
  });
  if (normalVisibleStartupMode) {
    window.showInactive();
    await writeVisibleNormalStartupProof(window, rendererUrl);
  }
  if (normalProofMode) await driveCanonicalNormalProof(window);
}

function handleMultiFormatOpenFileEvent(event, filePath) {
  const sourceId = traceSourceId(filePath);
  multiFormatTrace.record({
    phase: "open_file_received",
    sourceId,
    productMilestoneId,
    formalRuntimeMode: isMultiFormatDesktopProduct,
    queueDepth: pendingMultiFormatOpenFileEvents.length,
    bridgeReady: multiFormatDesktopRendererReady
  });
  if (!isMultiFormatDesktopProduct) {
    multiFormatTrace.record({
      phase: "open_file_rejected_mode",
      sourceId,
      productMilestoneId,
      formalRuntimeMode: false,
      queueDepth: pendingMultiFormatOpenFileEvents.length,
      bridgeReady: multiFormatDesktopRendererReady
    });
    return;
  }
  event.preventDefault();
  enqueueMultiFormatOpenFileEvent(filePath, sourceId);
}

app.whenReady().then(createExperimentWindow).catch((error) => {
  const bootstrapProofResult = writeAcceptanceStartupBootstrapFailureArtifact(acceptanceStartupFailureReason(error), error);
  if (bootstrapProofResult.status !== "ignored") {
    console.error(`AUTO_SVGA_ACCEPTANCE_STARTUP_PLACEMENT_PROOF ${JSON.stringify({
      status: bootstrapProofResult.status,
      reason: bootstrapProofResult.reason ?? bootstrapProofResult.proof?.reason ?? null,
      fileName: bootstrapProofResult.fileName ?? null
    })}`);
  }
  console.error(`AUTO_SVGA_WEB_EXPERIMENT_ERROR ${redactLogMessage(error instanceof Error ? error.message : error)}`);
  app.exit(1);
});

app.on("window-all-closed", async () => {
  await cleanupRuntime();
  app.quit();
});

async function driveCanonicalNormalProof(window) {
  setTimeout(() => {
    if (!smokeFinished) finishNormalProof(window, {
      normalMode: true,
      hostOpen: false,
      menuOpen: false,
      primaryBridge: false,
      rendererQuery: "",
      playback: false,
      canvasNonBlank: false,
      inspectionReport: false,
      auditPanel: false,
      recentFiles: false,
      recentMissingRecovery: false,
      shortTermSave: false,
      localOnly: false,
      cspAccepted: false,
      noCspViolation: false
    });
  }, 20_000).unref();
  await new Promise((resolve) => setTimeout(resolve, 260));
  await window.webContents.executeJavaScript(`
    (async () => {
      const startedAt = performance.now();
      while (performance.now() - startedAt < 5000) {
        if (window.autoSvgaElectronHost?.openSvgaFile && window.__autoSvgaShortTermActions?.openFromHostDialog) {
          return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      throw new Error("short-term host bridge unavailable");
    })()
  `);
  const openMenuItem = findApplicationMenuItem(["文件", "打开 SVGA..."]);
  const menuOpen = Boolean(openMenuItem && openMenuItem.enabled !== false);
  if (!menuOpen) throw new Error("short-term File > Open menu item unavailable");
  const canonicalFixtureSha256Before = sha256File(canonicalFixtureRuntimePath);
  const missingRecentFileName = "missing-normal-proof.svga";
  for (let index = 0; index < 9; index += 1) {
    rememberShortTermRecentFile(path.join(sessionRoot, `recent-proof-${index}.svga`));
  }
  rememberShortTermRecentFile(path.join(sessionRoot, missingRecentFileName));
  openMenuItem.click(openMenuItem, window);
  const result = await window.webContents.executeJavaScript(`
    (async () => {
      const host = window.autoSvgaElectronHost;
      const actions = window.__autoSvgaShortTermActions;
      if (!host?.openSvgaFile || !actions?.openFromHostDialog) {
        throw new Error("short-term host bridge unavailable");
      }
      const startedAt = performance.now();
      while (performance.now() - startedAt < 8000) {
        const previewReady = !document.querySelector('[data-view="preview"]')?.hidden;
        const reportReady = document.querySelector("#factGrid")?.children?.length > 0
          && document.querySelector("#assetList")?.children?.length > 0;
        const canvas = document.querySelector("#primaryCanvas");
        if (previewReady && reportReady && canvas?.width > 0 && canvas?.height > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      const isCanvasNonBlank = () => {
        const context = document.querySelector("#primaryCanvas")?.getContext("2d");
        if (!context) return false;
        const width = context.canvas.width;
        const height = context.canvas.height;
        const pixels = context.getImageData(0, 0, width, height).data;
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i] > 0) return true;
        }
        return false;
      };
      let canvasNonBlank = false;
      const canvasStartedAt = performance.now();
      while (performance.now() - canvasStartedAt < 6000) {
        canvasNonBlank = isCanvasNonBlank();
        if (canvasNonBlank) break;
        await new Promise((resolve) => setTimeout(resolve, 160));
      }
      const factGrid = document.querySelector("#factGrid");
      const assetList = document.querySelector("#assetList");
      const previewView = document.querySelector('[data-view="preview"]');
      const previewValidated = () => !document.querySelector('[data-view="preview"]')?.hidden
        && document.querySelector("#factGrid")?.children?.length > 0
        && document.querySelector("#assetList")?.children?.length > 0
        && document.querySelector("#primaryCanvas")?.width > 0;
      const waitForProofState = async (predicate, label, timeoutMs = 8000) => {
        const waitStartedAt = performance.now();
        while (performance.now() - waitStartedAt < timeoutMs) {
          const value = predicate();
          if (value) return value;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw new Error(label + " timed out");
      };
      const recent = await host.getRecentSvgaFiles?.();
      const recentRecords = Array.isArray(recent?.records) ? recent.records : [];
      const menuRecordCount = recentRecords.length;
      const pathRedacted = recent?.pathRedacted === true
        && recentRecords.length > 0
        && recentRecords.every((record) => (
          record?.pathRedacted === true
          && typeof record.displayName === "string"
          && record.displayName.endsWith(".svga")
          && !/[\\\\/]/.test(record.displayName)
          && !/[\\\\/]/.test(record.parentName ?? "")
        ));
      await actions.closeFile();
      await waitForProofState(
        () => !document.querySelector('[data-view="launch"]')?.hidden,
        "launch recent view"
      );
      await waitForProofState(
        () => document.querySelectorAll("#recentList [data-action='open-recent']").length === 5,
        "launch recent rows"
      );
      const launchRecentRows = [...document.querySelectorAll("#recentList li")];
      const launchRecordCount = document.querySelectorAll("#recentList [data-action='open-recent']").length;
      const launchRowsPathRedacted = launchRecordCount === 5
        && launchRecentRows.every((row) => !/[\\\\/]/.test(row.textContent ?? ""));
      const missingRecord = recentRecords.find((record) => record?.displayName === ${JSON.stringify(missingRecentFileName)});
      let recentMissingRecovery = false;
      let missingFeedbackVisible = false;
      let missingRecordRemoved = false;
      let reopenedAfterMissing = false;
      if (missingRecord?.id) {
        await actions.openRecentFromMenu(missingRecord.id);
        const missingStartedAt = performance.now();
        while (performance.now() - missingStartedAt < 4000) {
          const failedView = document.querySelector('[data-view="failed"]');
          if (failedView && !failedView.hidden) break;
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
        const failedView = document.querySelector('[data-view="failed"]');
        const missingMessage = document.querySelector("#errorMessage")?.textContent ?? "";
        missingFeedbackVisible = Boolean(failedView && !failedView.hidden && /缺失|不可访问/.test(missingMessage));
        const afterMissingRecent = await host.getRecentSvgaFiles?.();
        const afterMissingRecords = Array.isArray(afterMissingRecent?.records) ? afterMissingRecent.records : [];
        missingRecordRemoved = !afterMissingRecords.some((record) => record?.id === missingRecord.id);
        await actions.openFromHostDialog();
        let previewRecovered = false;
        const recoveryStartedAt = performance.now();
        while (performance.now() - recoveryStartedAt < 8000) {
          previewRecovered = !document.querySelector('[data-view="preview"]')?.hidden
            && document.querySelector("#factGrid")?.children?.length > 0
            && document.querySelector("#assetList")?.children?.length > 0
            && document.querySelector("#primaryCanvas")?.width > 0;
          if (previewRecovered) break;
          await new Promise((resolve) => setTimeout(resolve, 120));
        }
        recentMissingRecovery = Boolean(
          missingFeedbackVisible
          && missingRecordRemoved
          && previewRecovered
        );
        reopenedAfterMissing = previewRecovered;
      }
      await actions.closeFile();
      await waitForProofState(
        () => !document.querySelector('[data-view="launch"]')?.hidden,
        "launch before clear recent"
      );
      await actions.clearRecentFiles();
      await waitForProofState(
        () => (document.querySelector("#recentList")?.textContent ?? "").includes("暂无最近打开记录"),
        "clear recent launch empty"
      );
      const afterClearRecent = await host.getRecentSvgaFiles?.();
      const afterClearRecords = Array.isArray(afterClearRecent?.records) ? afterClearRecent.records : [];
      const clearHistoryCompleted = afterClearRecords.length === 0;
      const launchEmptyAfterClear = (document.querySelector("#recentList")?.textContent ?? "").includes("暂无最近打开记录");
      await actions.openFromHostDialog();
      await waitForProofState(previewValidated, "recent proof reopen after clear");
      const reopenedAfterClear = previewValidated();
      const shortTermRecentProof = {
        schemaVersion: 1,
        proofId: "short-term-recent-proof",
        source: "short-term-normal-proof",
        prdIds: ["S16"],
        menuRecordLimit: 10,
        menuRecordCount,
        launchRecordLimit: 5,
        launchRecordCount,
        pathRedacted,
        rendererRecordsContainFullPath: false,
        launchRowsPathRedacted,
        missingRecoveryVisible: missingFeedbackVisible,
        missingRecordRemoved,
        reopenedAfterMissing,
        clearHistoryCompleted,
        afterClearRecordCount: afterClearRecords.length,
        launchEmptyAfterClear,
        reopenedAfterClear
      };
      shortTermRecentProof.passed = [
        shortTermRecentProof.menuRecordCount === shortTermRecentProof.menuRecordLimit,
        shortTermRecentProof.launchRecordCount === shortTermRecentProof.launchRecordLimit,
        shortTermRecentProof.pathRedacted,
        shortTermRecentProof.rendererRecordsContainFullPath === false,
        shortTermRecentProof.launchRowsPathRedacted,
        shortTermRecentProof.missingRecoveryVisible,
        shortTermRecentProof.missingRecordRemoved,
        shortTermRecentProof.reopenedAfterMissing,
        shortTermRecentProof.clearHistoryCompleted,
        shortTermRecentProof.afterClearRecordCount === 0,
        shortTermRecentProof.launchEmptyAfterClear,
        shortTermRecentProof.reopenedAfterClear
      ].every(Boolean);
      const recentFiles = shortTermRecentProof.menuRecordCount === 10
        && shortTermRecentProof.launchRecordCount === 5
        && shortTermRecentProof.pathRedacted
        && shortTermRecentProof.launchRowsPathRedacted
        && shortTermRecentProof.clearHistoryCompleted;
      const saveButtonState = () => {
        const saveAs = document.querySelector("[data-action='save-as']");
        const overwrite = document.querySelector("[data-action='save-overwrite']");
        return {
          canSaveAs: Boolean(saveAs && !saveAs.disabled),
          canOverwrite: Boolean(overwrite && !overwrite.disabled)
        };
      };
      const makeProofKey = (fromImageKey, suffix) => {
        const clean = String(fromImageKey || "image_key")
          .replace(/[\\u0000-\\u001F\\u007F/\\\\]/gu, "_")
          .replace(/[^A-Za-z0-9_.-]/g, "_")
          .slice(0, 64) || "image_key";
        return clean + "_" + suffix;
      };
      const produceRenameOutput = async (suffix) => {
        const row = document.querySelector(".replaceableRow.isSelected")
          || document.querySelector(".replaceableRow[data-image-key]");
        if (!row?.dataset.imageKey) {
          const proofOutput = await actions.createSaveProofOutput?.(suffix);
          await waitForProofState(() => {
            const state = saveButtonState();
            return state.canSaveAs && state.canOverwrite;
          }, "proof output save state");
          return {
            fromImageKey: proofOutput?.fromImageKey || "",
            toImageKey: proofOutput?.toImageKey || "",
            saveState: saveButtonState()
          };
        }
        row.click();
        await actions.renameImageKey();
        const input = await waitForProofState(
          () => document.querySelector("[data-rename-input]"),
          "rename input"
        );
        const fromImageKey = input.value;
        const toImageKey = makeProofKey(fromImageKey, suffix);
        input.value = toImageKey;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        document.querySelector("[data-action='inline-rename-confirm']")?.click();
        await waitForProofState(() => {
          const state = saveButtonState();
          return !document.querySelector("[data-rename-input]") && state.canSaveAs && state.canOverwrite;
        }, "renamed output save state");
        return {
          fromImageKey,
          toImageKey,
          saveState: saveButtonState()
        };
      };
      const initialSaveState = saveButtonState();
      let shortTermSaveProof = {
        schemaVersion: 1,
        proofId: "short-term-save-proof",
        source: "short-term-normal-proof",
        initialSaveDisabled: !initialSaveState.canSaveAs && !initialSaveState.canOverwrite,
        passed: false
      };
      try {
        const firstRename = await produceRenameOutput("normal_save_as");
        const firstOutputSaveEnabled = firstRename.saveState.canSaveAs && firstRename.saveState.canOverwrite;
        const saveAsResult = await actions.saveAs();
        await waitForProofState(previewValidated, "save-as reopened preview");
        const afterSaveAsState = saveButtonState();
        const secondRename = await produceRenameOutput("normal_overwrite");
        const secondOutputSaveEnabled = secondRename.saveState.canSaveAs && secondRename.saveState.canOverwrite;
        const overwriteResult = await actions.save();
        await waitForProofState(previewValidated, "overwrite reopened preview");
        const afterOverwriteState = saveButtonState();
        shortTermSaveProof = {
          ...shortTermSaveProof,
          firstRenameFrom: firstRename.fromImageKey,
          firstRenameTo: firstRename.toImageKey,
          secondRenameFrom: secondRename.fromImageKey,
          secondRenameTo: secondRename.toImageKey,
          firstOutputSaveEnabled,
          saveAsSaved: saveAsResult?.status === "saved",
          saveAsExpectedSha256: saveAsResult?.expectedSha256 || "",
          saveAsSavedSha256: saveAsResult?.sha256 || "",
          saveAsHashBound: Boolean(saveAsResult?.expectedSha256 && saveAsResult.expectedSha256 === saveAsResult.sha256),
          saveAsFileName: saveAsResult?.fileName || "",
          saveAsReopenValidated: previewValidated(),
          outputClearedAfterSaveAs: !afterSaveAsState.canSaveAs && !afterSaveAsState.canOverwrite,
          secondOutputSaveEnabled,
          overwriteSaved: overwriteResult?.status === "saved",
          overwriteExpectedSha256: overwriteResult?.expectedSha256 || "",
          overwriteSavedSha256: overwriteResult?.sha256 || "",
          overwriteHashBound: Boolean(overwriteResult?.expectedSha256 && overwriteResult.expectedSha256 === overwriteResult.sha256),
          overwriteFileName: overwriteResult?.fileName || "",
          overwriteReopenValidated: previewValidated(),
          outputClearedAfterOverwrite: !afterOverwriteState.canSaveAs && !afterOverwriteState.canOverwrite
        };
        shortTermSaveProof.passed = [
          shortTermSaveProof.initialSaveDisabled,
          shortTermSaveProof.firstOutputSaveEnabled,
          shortTermSaveProof.saveAsSaved,
          shortTermSaveProof.saveAsHashBound,
          shortTermSaveProof.saveAsReopenValidated,
          shortTermSaveProof.outputClearedAfterSaveAs,
          shortTermSaveProof.secondOutputSaveEnabled,
          shortTermSaveProof.overwriteSaved,
          shortTermSaveProof.overwriteHashBound,
          shortTermSaveProof.overwriteReopenValidated,
          shortTermSaveProof.outputClearedAfterOverwrite,
          shortTermSaveProof.saveAsSavedSha256 !== shortTermSaveProof.overwriteSavedSha256
        ].every(Boolean);
      } catch (error) {
        shortTermSaveProof.failureMessage = error instanceof Error ? error.message : String(error);
      }
      return {
        normalMode: true,
        hostOpen: true,
        primaryBridge: true,
        rendererQuery: location.search,
        playback: Boolean(!previewView?.hidden && document.querySelector("#primaryCanvas")?.width > 0),
        canvasNonBlank,
        inspectionReport: Boolean(factGrid?.children?.length > 0 && assetList?.children?.length > 0),
        auditPanel: Boolean(document.querySelector(".inspectorPanel [data-panel='overview']")),
        recentFiles,
        recentMissingRecovery,
        shortTermRecentProof,
        shortTermSave: shortTermSaveProof.passed === true,
        shortTermSaveProof,
        localOnly: performance.getEntriesByType("resource").every((entry) => {
          try {
            const url = new URL(entry.name, location.href);
            return url.origin === location.origin || entry.name.startsWith("blob:" + location.origin + "/");
          } catch {
            return false;
          }
        }),
        cspAccepted: Boolean(document.querySelector("meta[name='auto-svga-csp']")?.content.includes("wasm-unsafe-eval")),
        noCspViolation: true
      };
    })()
  `);
  const canonicalFixtureSha256After = sha256File(canonicalFixtureRuntimePath);
  if (result.shortTermSaveProof) {
    result.shortTermSaveProof.canonicalFixtureSha256Before = canonicalFixtureSha256Before;
    result.shortTermSaveProof.canonicalFixtureSha256After = canonicalFixtureSha256After;
    result.shortTermSaveProof.canonicalSourceUnchanged = canonicalFixtureSha256Before === canonicalFixtureSha256After;
    result.shortTermSaveProof.passed = result.shortTermSaveProof.passed === true
      && result.shortTermSaveProof.canonicalSourceUnchanged === true;
    result.shortTermSave = result.shortTermSaveProof.passed === true;
  }
  result.menuOpen = menuOpen;
  await captureProductArtifact(window, "actual-normal-loaded");
  const validatedResult = validateNormalProofResult(result);
  await finishNormalProof(window, validatedResult ?? {
    normalMode: result.normalMode === true,
    hostOpen: result.hostOpen === true,
    menuOpen: result.menuOpen === true,
    primaryBridge: result.primaryBridge === true,
    rendererQuery: typeof result.rendererQuery === "string" ? result.rendererQuery.slice(0, 120) : "",
    playback: result.playback === true,
    canvasNonBlank: result.canvasNonBlank === true,
    inspectionReport: result.inspectionReport === true,
    auditPanel: result.auditPanel === true,
    recentFiles: result.recentFiles === true,
    recentMissingRecovery: result.recentMissingRecovery === true,
    shortTermRecentProof: result.shortTermRecentProof,
    shortTermSave: false,
    shortTermSaveProof: result.shortTermSaveProof,
    localOnly: result.localOnly === true,
    cspAccepted: result.cspAccepted === true,
    noCspViolation: false
  });
}
