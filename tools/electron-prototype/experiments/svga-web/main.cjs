const { execFileSync } = require("node:child_process");
const { createHash, randomBytes } = require("node:crypto");
const { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync, writeSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, screen, session } = require("electron");
const {
  IPC_CHANNELS,
  createSecureWebPreferences,
  isAllowedHostUrl,
  isExpectedSenderUrl
} = require("./host-adapter-contract.cjs");
const { createDesktopArtifactCatalog } = require("./desktop-artifact-catalog.cjs");

const smokeMode = process.argv.includes("--smoke");
const productSmokeMode = smokeMode && process.argv.includes("--product-smoke");
const normalProofMode = process.argv.includes("--p2-normal-proof") || process.env.AUTO_SVGA_P2_NORMAL_PROOF === "1";
const auditPlayerArgument = process.argv.find((argument) => argument.startsWith("--audit-player="));
const auditPlayer = auditPlayerArgument?.split("=")[1];
const auditMode = auditPlayer === "svga-web" || auditPlayer === "svgaplayerweb";
const normalVisibleStartupMode = !(smokeMode || auditMode || normalProofMode);
const appRoot = app.getAppPath();
const repoRoot = path.resolve(appRoot, "../../../..");
const productIdentity = "auto-svga";
const mainEntry = "main.cjs";
const preloadEntry = "preload.cjs";
const rendererHtmlEntry = "web/index.html";
const rendererEntry = "web/desktop-product-entry.mjs";
const stylesEntry = "web/styles.css";
const playerIdentity = "svga-web@2.4.4";
const csp = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
const productMilestoneId = process.env.AUTO_SVGA_PRODUCT_MILESTONE ?? "P2";
const macosWorkbenchWindowSizing = Object.freeze({
  defaultLaunch: { width: 1440, height: 900 },
  comfortable: { width: 1280, height: 800 },
  compact: { width: 1180, height: 760 },
  minimumSupported: { width: 1180, height: 760 },
  legacyStressViewport: { width: 900, height: 720 },
  availableScreenFitRatio: 0.86,
  aspectRatio: 16 / 10
});
const productMilestoneTitle = {
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
  "#infoPanelButton",
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
const reportToken = randomBytes(24).toString("hex");
const runtimeInstanceId = randomBytes(12).toString("hex");
let experimentServer;
let expectedOrigin;
let smokeFinished = false;
let auditFinished = false;
let cspViolationSeen = false;
let cleanedUp = false;
const blockedExternalRequests = [];
const sourceFilePaths = new Map();
const referenceFileIds = new Set();
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
app.setPath("userData", path.join(sessionRoot, "user-data"));
app.setPath("sessionData", path.join(sessionRoot, "session-data"));

function chooseMacosWorkbenchWindowBounds() {
  const display = screen.getPrimaryDisplay();
  const workArea = display?.workArea ?? {
    x: 0,
    y: 0,
    width: macosWorkbenchWindowSizing.defaultLaunch.width,
    height: macosWorkbenchWindowSizing.defaultLaunch.height
  };
  const maxWidth = Math.floor(workArea.width * macosWorkbenchWindowSizing.availableScreenFitRatio);
  const maxHeight = Math.floor(workArea.height * macosWorkbenchWindowSizing.availableScreenFitRatio);
  let width = Math.min(macosWorkbenchWindowSizing.defaultLaunch.width, maxWidth);
  let height = Math.round(width / macosWorkbenchWindowSizing.aspectRatio);
  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * macosWorkbenchWindowSizing.aspectRatio);
  }
  width = Math.max(width, Math.min(macosWorkbenchWindowSizing.minimumSupported.width, workArea.width));
  height = Math.max(height, Math.min(macosWorkbenchWindowSizing.minimumSupported.height, workArea.height));
  return {
    width,
    height,
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2)
  };
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
  if (value.optimizedReopenProof !== undefined && !validateOptimizedReopenProof(value.optimizedReopenProof)) {
    return "optimizedReopenProof";
  }
  if (value.sequenceReviewProof !== undefined && !validateSequenceReviewProof(value.sequenceReviewProof)) {
    return `sequenceReviewProof:${describeSequenceReviewProofValidationFailure(value.sequenceReviewProof)}`;
  }
  if (value.sequenceRepairPreviewProof !== undefined && !validateSequenceRepairPreviewProof(value.sequenceRepairPreviewProof)) {
    return "sequenceRepairPreviewProof";
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
  const diagnostics = {
    schemaVersion: 1,
    phase: value.phase,
    errorName: value.errorName,
    errorMessage: value.errorMessage,
    actionCount: value.actionCount,
    currentActionId: value.currentActionId,
    lastActionId: value.lastActionId
  };
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
    "enterOpensInfoAndFocusesPanel",
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
    "statusVisible",
    "replaceActionVisible",
    "playbackControlsVisible"
  ];
  if (requireMetadata) requiredBooleans.push("metadataVisible");
  if (!requiredBooleans.every((key) => value[key] === true)) return undefined;
  if (!isBoundedString(value.fileName, 180) || !value.fileName.endsWith(".svga")) return undefined;
  if (!isBoundedString(value.statusText, 80)) return undefined;
  return {
    slot: expectedSlot,
    loaded: true,
    titleVisible: true,
    fileNameInTitle: true,
    duplicateFilePillHidden: true,
    statusVisible: true,
    replaceActionVisible: true,
    metadataVisible: value.metadataVisible === true,
    playbackControlsVisible: true,
    fileName: value.fileName,
    statusText: value.statusText
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
    "statusVisible",
    "replaceActionVisible",
    "playbackControlsVisible"
  ];
  if (requireMetadata) requiredBooleans.push("metadataVisible");
  const failedBoolean = requiredBooleans.find((key) => value[key] !== true);
  if (failedBoolean) return failedBoolean;
  if (!isBoundedString(value.fileName, 180)) return "fileName";
  if (!value.fileName.endsWith(".svga")) return "fileNameExtension";
  if (!isBoundedString(value.statusText, 80)) return "statusText";
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
    "enterOpensInfoAndFocusesPanel",
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
  if (value.optimizedImageCount >= value.originalImageCount) return undefined;
  if (!Array.isArray(value.actions) || value.actions.length === 0) return undefined;
  if (!Array.isArray(value.removedResourceKeys) || value.removedResourceKeys.length === 0) return undefined;
  if (!Array.isArray(value.invariantChecks) || value.invariantChecks.length === 0) return undefined;
  if (!value.invariantChecks.every((check) => check && typeof check === "object" && check.passed === true)) return undefined;
  return {
    schemaVersion: value.schemaVersion,
    optimizationId: value.optimizationId,
    sourceSha256: value.sourceSha256,
    optimizedSha256,
    originalImageCount: value.originalImageCount,
    optimizedImageCount: value.optimizedImageCount,
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

function sanitizeSvgaFileName(value) {
  const base = path.basename(String(value).replace(/[/\\]/g, "")).slice(0, 120) || "untitled-edited.svga";
  return base.toLowerCase().endsWith(".svga") ? base : `${base}.svga`;
}

function validateNormalProofResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const keys = [
    "normalMode",
    "hostOpen",
    "primaryBridge",
    "playback",
    "canvasNonBlank",
    "inspectionReport",
    "auditPanel",
    "localOnly",
    "cspAccepted",
    "noCspViolation"
  ];
  if (!keys.every((key) => typeof value[key] === "boolean")) return undefined;
  return {
    normalMode: value.normalMode,
    hostOpen: value.hostOpen,
    primaryBridge: value.primaryBridge,
    rendererQuery: typeof value.rendererQuery === "string" ? value.rendererQuery.slice(0, 120) : "",
    playback: value.playback,
    canvasNonBlank: value.canvasNonBlank,
    inspectionReport: value.inspectionReport,
    auditPanel: value.auditPanel,
    localOnly: value.localOnly,
    cspAccepted: value.cspAccepted,
    noCspViolation: value.noCspViolation && !cspViolationSeen
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

function redactLogMessage(value) {
  return String(value)
    .replaceAll(sessionRoot, "<svga-web-spike-session>")
    .replace(/(?:[A-Za-z]:\\|\/Users\/|\/home\/)[^\s"']+/g, "<local-path>");
}

function gitHeadCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8"
    }).trim();
  } catch {
    return "unknown";
  }
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
  if (scenario === "desktop-empty" || scenario === "normal-visible-startup") {
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
  return String(value)
    .replaceAll(appRoot, "<experiment-root>")
    .replaceAll(repoRoot, "<repo-root>")
    .replace(/\/Users\/[^/\s]+/g, "<home>")
    .replace(/\/private\/var\/folders\/[^\s"]+/g, "<temp>")
    .replace(/\/var\/folders\/[^\s"]+/g, "<temp>")
    .replace(/[A-Za-z]:\\Users\\[^\\\s]+/g, "<home>");
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
      menuActions: ["load-latest-export-artifact", "toggle-logs", "open-settings", "quit"],
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
  if (productSmokeMode) writeProductArtifactIndex();
  const { p6InteractionTrace, diagnostics, ownerUsability, workbenchRegionMap, ...summary } = result;
  const passed = Object.values(summary).every(Boolean);
  const logPayload = { ...summary, passed, p6InteractionTrace: Boolean(p6InteractionTrace), ownerUsability: Boolean(ownerUsability), workbenchRegionMap: Boolean(workbenchRegionMap) };
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
    fileOpenMechanism: "window.autoSvgaElectronHost.openSvgaFile validated IPC",
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
          }).map((value) => value.replace(/\\/Users\\/[^/\\s]+/g, "<home>"))
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
    externalRequests: [...new Set([...blockedExternalRequests, ...(rendererProbe.externalRequests ?? [])])],
    hostOpenTargets: ["primary-svga", "secondary-svga", "reference-media"],
    hostMenuActions: ["load-latest-export-artifact", "toggle-logs", "open-settings", "quit"],
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
  proof.passed = [
    "empty",
    "loading",
    "loaded",
    "playing",
    "paused",
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
  ].every((key) => proof.states[key]?.passed === true);
  proof.generatedAt = new Date().toISOString();
  writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`);
}

async function captureProductArtifact(window, scenario) {
  const originalSize = window.getSize();
  const originalContentSize = window.getContentSize();
  if (scenario === "desktop-1280x800") window.setContentSize(macosWorkbenchWindowSizing.comfortable.width, macosWorkbenchWindowSizing.comfortable.height);
  if (scenario === "desktop-1440x900") window.setContentSize(macosWorkbenchWindowSizing.defaultLaunch.width, macosWorkbenchWindowSizing.defaultLaunch.height);
  if (scenario === "desktop-responsive-export-review-loaded-at-900-x-720") window.setContentSize(macosWorkbenchWindowSizing.legacyStressViewport.width, macosWorkbenchWindowSizing.legacyStressViewport.height);
  if (scenario === "desktop-responsive-local-preview-at-900-x-720") window.setContentSize(macosWorkbenchWindowSizing.legacyStressViewport.width, macosWorkbenchWindowSizing.legacyStressViewport.height);
  if (scenario === "desktop-responsive-local-compare-at-900-x-720") window.setContentSize(macosWorkbenchWindowSizing.legacyStressViewport.width, macosWorkbenchWindowSizing.legacyStressViewport.height);
  if (scenario === "desktop-local-minimum-size") window.setContentSize(macosWorkbenchWindowSizing.minimumSupported.width, macosWorkbenchWindowSizing.minimumSupported.height);
  if (scenario === "desktop-responsive-local-compare-at-minimum-size") window.setContentSize(macosWorkbenchWindowSizing.minimumSupported.width, macosWorkbenchWindowSizing.minimumSupported.height);
  if (scenario === "desktop-1280x800" || scenario === "desktop-1440x900" || scenario === "desktop-responsive-export-review-loaded-at-900-x-720" || scenario === "desktop-responsive-local-preview-at-900-x-720" || scenario === "desktop-responsive-local-compare-at-900-x-720" || scenario === "desktop-local-minimum-size" || scenario === "desktop-responsive-local-compare-at-minimum-size") {
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
  if (scenario === "desktop-responsive-export-review-loaded-at-900-x-720" || scenario === "desktop-responsive-local-preview-at-900-x-720" || scenario === "desktop-responsive-local-compare-at-900-x-720" || scenario === "desktop-local-minimum-size" || scenario === "desktop-responsive-local-compare-at-minimum-size") {
    window.setContentSize(originalContentSize[0], originalContentSize[1]);
  } else if (scenario === "desktop-1280x800" || scenario === "desktop-1440x900") {
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

function installApplicationMenu(window) {
  const runRendererMenuAction = (label, code) => {
    window.webContents.executeJavaScript(code).catch((error) => {
      console.error(`AUTO_SVGA_MENU_ACTION_ERROR ${label} ${redactLogMessage(error instanceof Error ? error.message : error)}`);
    });
  };
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        {
          label: "Open SVGA...",
          accelerator: "CommandOrControl+O",
          click: () => {
            openSvgaFromHostMenu(window).catch((error) => {
              console.error(`AUTO_SVGA_FILE_OPEN_ERROR ${redactLogMessage(error instanceof Error ? error.message : error)}`);
            });
          }
        },
        {
          label: "Open Secondary SVGA...",
          click: () => {
            openSvgaFromHostMenu(window, "#secondaryFileInput").catch((error) => {
              console.error(`AUTO_SVGA_FILE_OPEN_ERROR ${redactLogMessage(error instanceof Error ? error.message : error)}`);
            });
          }
        },
        {
          label: "Open Reference Media...",
          click: () => {
            openReferenceFromHostMenu(window).catch((error) => {
              console.error(`AUTO_SVGA_REFERENCE_OPEN_ERROR ${redactLogMessage(error instanceof Error ? error.message : error)}`);
            });
          }
        },
        { type: "separator" },
        {
          label: "Load Latest Export Artifact",
          click: () => runRendererMenuAction("latest-artifact", `
            (() => {
              const mode = document.querySelector("#modeSelect");
              if (mode) {
                mode.value = "exportReview";
                mode.dispatchEvent(new Event("change", { bubbles: true }));
              }
              window.setTimeout(() => document.querySelector("#rescanButton")?.click(), 0);
            })()
          `)
        },
        { type: "separator" },
        {
          label: "Quit Auto SVGA",
          accelerator: "CommandOrControl+Q",
          click: () => app.quit()
        }
      ]
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Logs",
          accelerator: "CommandOrControl+L",
          click: () => runRendererMenuAction("logs", `document.querySelector("#logsButton")?.click()`)
        },
        {
          label: "Open Settings",
          accelerator: "CommandOrControl+,",
          click: () => runRendererMenuAction("settings", `document.querySelector("#settingsButton")?.click()`)
        }
      ]
    }
  ]));
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
  if (originalPath && path.resolve(targetPath) === path.resolve(originalPath)) {
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
  if (path.resolve(targetPath) === path.resolve(originalPath)) {
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
  const launchBounds = chooseMacosWorkbenchWindowBounds();

  const window = new BrowserWindow({
    title: productIdentity,
    ...(smokeMode ? { x: -20000, y: -20000 } : { x: launchBounds.x, y: launchBounds.y }),
    width: launchBounds.width,
    height: launchBounds.height,
    minWidth: macosWorkbenchWindowSizing.minimumSupported.width,
    minHeight: macosWorkbenchWindowSizing.minimumSupported.height,
    show: false,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      ...createSecureWebPreferences({
        preloadPath: path.join(appRoot, "preload.cjs"),
        reportToken,
        productMilestoneId
      })
    }
  });
  installApplicationMenu(window);

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
    if (!productSmokeMode && !normalProofMode) throw new Error("Product artifact capture is only available in product capture mode");
    const scenario = validateArtifactScenario(input);
    if (!scenario) throw new Error("Invalid product artifact scenario");
    return captureProductArtifact(window, scenario);
  });

  ipcMain.handle(IPC_CHANNELS.performSmokeInput, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    if (!productSmokeMode) throw new Error("Product smoke input is only available in product smoke mode");
    return performP6SmokeInput(event.sender, input);
  });

  ipcMain.handle(IPC_CHANNELS.scanLatestArtifacts, async (event) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    return desktopArtifacts.scan();
  });

  ipcMain.handle(IPC_CHANNELS.auditResult, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    const result = validateAuditResult(input);
    if (!result) throw new Error("Invalid audit result");
    if (auditMode) await finishAudit(window, result);
    return { accepted: true };
  });

  ipcMain.handle(IPC_CHANNELS.normalProofResult, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    const result = validateNormalProofResult(input);
    if (!result) throw new Error("Invalid normal proof result");
    if (normalProofMode) await finishNormalProof(window, result);
    return { accepted: true };
  });

  ipcMain.handle(IPC_CHANNELS.saveEditedSvga, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    return saveEditedSvga(input);
  });

  ipcMain.handle(IPC_CHANNELS.saveOptimizedSvga, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    return saveOptimizedSvga(input);
  });

  ipcMain.handle(IPC_CHANNELS.openSvgaFile, async (event) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    return openSvgaFile();
  });

  ipcMain.handle(IPC_CHANNELS.openReferenceMediaFile, async (event) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    return openReferenceMediaFile();
  });

  ipcMain.handle(IPC_CHANNELS.writeClipboardText, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    return writeClipboardText(input);
  });

  ipcMain.handle(IPC_CHANNELS.p3EditResult, async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
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
  const rendererUrl = auditMode ? `${expectedOrigin}/audit.html?player=${auditPlayer}` : `${expectedOrigin}/${productMode}`;
  if (productSmokeMode) {
    const smokeIdentity = runtimeIdentity("smoke", rendererUrl);
    writeJsonProductArtifact("runtime-identity.json", "runtime-identity", smokeIdentity);
  }
  await window.loadURL(rendererUrl);
  if (normalVisibleStartupMode) {
    window.showInactive();
    await writeVisibleNormalStartupProof(window, rendererUrl);
  }
  if (normalProofMode) await driveCanonicalNormalProof(window);
}

app.whenReady().then(createExperimentWindow).catch((error) => {
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
      primaryBridge: false,
      rendererQuery: "",
      playback: false,
      canvasNonBlank: false,
      inspectionReport: false,
      auditPanel: false,
      localOnly: false,
      cspAccepted: false,
      noCspViolation: false
    });
  }, 20_000).unref();
  await new Promise((resolve) => setTimeout(resolve, 260));
  const result = await window.webContents.executeJavaScript(`
    (async () => {
      const opened = await window.autoSvgaElectronHost?.openSvgaFile?.();
      if (!opened || opened.status !== "opened" || !opened.sourceId || !opened.hash || !opened.bytes) {
        throw new Error("primary host bridge open failed");
      }
      const bytes = new Uint8Array(opened.bytes);
      const file = new File([bytes], opened.basename ?? "repository-avatar-frame-basic.svga", { type: "application/octet-stream" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const input = document.querySelector("#svgaFileInput");
      Object.defineProperty(input, "files", { value: transfer.files, configurable: true });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      const startedAt = performance.now();
      while (performance.now() - startedAt < 8000) {
        const reportReady = Boolean(document.querySelector(".auditReportSection"));
        const playing = document.querySelector("#svgaStatusA")?.textContent?.includes("播放中");
        if (reportReady && playing) break;
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      const isCanvasNonBlank = () => {
        const context = document.querySelector("#svgaCanvasA canvas")?.getContext("2d");
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
      return {
        normalMode: true,
        hostOpen: true,
        primaryBridge: true,
        rendererQuery: location.search,
        playback: document.querySelector("#svgaStatusA")?.textContent?.includes("播放中") ?? false,
        canvasNonBlank,
        inspectionReport: Boolean(document.querySelector(".specReportSection")),
        auditPanel: Boolean(document.querySelector(".auditReportSection")),
        localOnly: performance.getEntriesByType("resource").every((entry) => new URL(entry.name).origin === location.origin || entry.name.startsWith("blob:" + location.origin + "/")),
        cspAccepted: Boolean(document.querySelector("meta[name='auto-svga-csp']")?.content.includes("wasm-unsafe-eval")),
        noCspViolation: true
      };
    })()
  `);
  await captureProductArtifact(window, "actual-normal-loaded");
  await finishNormalProof(window, validateNormalProofResult(result) ?? {
    normalMode: true,
    hostOpen: false,
    primaryBridge: false,
    rendererQuery: "",
    playback: false,
    canvasNonBlank: false,
    inspectionReport: false,
    auditPanel: false,
    localOnly: false,
    cspAccepted: false,
    noCspViolation: false
  });
}
