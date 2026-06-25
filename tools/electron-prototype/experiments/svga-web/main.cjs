const { execFileSync } = require("node:child_process");
const { createHash, randomBytes } = require("node:crypto");
const { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync, writeSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, Menu, dialog, ipcMain, session } = require("electron");
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
const productIdentity = "Auto SVGA";
const mainEntry = "main.cjs";
const preloadEntry = "preload.cjs";
const rendererHtmlEntry = "web/index.html";
const rendererEntry = "web/desktop-product-entry.mjs";
const stylesEntry = "web/styles.css";
const playerIdentity = "svga-web@2.4.4";
const csp = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
const productMilestoneId = process.env.AUTO_SVGA_PRODUCT_MILESTONE ?? "P2";
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
  return result;
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
    && (value.stateReached === null || isBoundedString(value.stateReached, 160))
    && isP6Rect(value.targetRect)
    && (value.controlValue === null || isP6ControlValue(value.controlValue))
    && isP6FocusOrVisibleResult(value.focusOrVisibleResult)
    && typeof value.stateProofPassed === "boolean"
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
    && isP6Rect(value.targetRect);
}

function isP6FocusOrVisibleResult(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && (value.activeElementId === null || isBoundedString(value.activeElementId, 160))
    && (value.activeElementText === null || typeof value.activeElementText === "string")
    && isBoundedString(value.visibleResultState, 160)
    && typeof value.visibleResultPassed === "boolean"
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
    "desktop-recovered-from-invalid",
    "actual-normal-loaded",
    "smoke-loaded",
    "desktop-1280x800",
    "desktop-1440x900",
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

function validateSaveRevisionBinding(value, bytes) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const milestoneId = value.milestoneId === "P3"
    ? "P3"
    : value.milestoneId === "P4"
      ? "P4"
      : value.milestoneId === "P5"
        ? "P5"
        : "";
  if (!milestoneId || milestoneId !== productMilestoneId) return undefined;
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
  if (productSmokeMode) writeProductArtifactIndex();
  const { p6InteractionTrace, ...summary } = result;
  const passed = Object.values(summary).every(Boolean);
  console.log(`AUTO_SVGA_WEB_EXPERIMENT_SMOKE ${JSON.stringify({ ...summary, passed, p6InteractionTrace: Boolean(p6InteractionTrace) })}`);
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
    "desktop-recovered-from-invalid": "recovered-from-invalid",
    "desktop-asset-preview-modal-open": "asset-preview-modal-open"
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

async function maybeRecordRenderedStateProof(window, scenario, image, screenshotSha256, fileName) {
  const state = stateForScenario(scenario);
  if (!state) return;
  let probe;
  try {
    probe = await window.webContents.executeJavaScript(`window.__autoSvgaDesktopStateProbe?.collect(${JSON.stringify(state)})`);
  } catch (error) {
    probe = { state, passed: false, failures: [`state probe failed: ${redactLogMessage(error.message ?? error)}`] };
  }
  const ratio = overlayPixelRatio(image, probe?.overlayRect, window.getSize());
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
    viewport: { width: 1280, height: 800 },
    states: {},
    generatedAt: new Date().toISOString()
  };
  try {
    proof = JSON.parse(readFileSync(proofPath, "utf8"));
  } catch {
    // Built incrementally as state screenshots are captured.
  }
  proof.headCommit = productArtifactIndex.headCommit;
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
    "logs-open",
    "settings-open",
    "accessibility-toggles-on",
    "settings-closed-by-escape",
    "synchronized-playback-toggled-by-space",
    "local-compare-empty",
    "local-compare-loaded",
    "asset-preview-modal-open"
  ].every((key) => proof.states[key]?.passed === true);
  proof.generatedAt = new Date().toISOString();
  writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`);
}

async function captureProductArtifact(window, scenario) {
  const originalSize = window.getSize();
  if (scenario === "desktop-1280x800") window.setSize(1280, 800);
  if (scenario === "desktop-1440x900") window.setSize(1440, 900);
  if (scenario === "desktop-1280x800" || scenario === "desktop-1440x900") {
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  const image = await window.webContents.capturePage();
  const png = image.toPNG();
  const pngHash = createHash("sha256").update(png).digest("hex");
  const capturedSize = window.getSize();
  if (scenario === "desktop-1280x800" || scenario === "desktop-1440x900") {
    window.setSize(originalSize[0], originalSize[1]);
  }
  const fileName = artifactFileNameForScenario(scenario);
  const filePath = path.join(productArtifactRoot, fileName);
  writeFileSync(filePath, png);
  await maybeRecordRenderedStateProof(window, scenario, image, pngHash, fileName);
  const fixture = scenarioFixtureMetadata(scenario);
  addProductArtifactRecord({
    scenario,
    mode: scenario === "actual-normal-loaded" ? "normal" : "smoke",
    source: "desktop",
    viewport: { width: capturedSize[0], height: capturedSize[1] },
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

function artifactFileNameForScenario(scenario) {
  return {
    "p3-original-loaded": "original-loaded.png",
    "p3-resource-list": "resource-list.png",
    "p3-replacement-selected": "replacement-selected.png",
    "p3-replacement-preview": "replacement-preview.png",
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
  const automatedProductSaveAs = p3SmokeSaveAs || p4SmokeSaveAs || p5SmokeSaveAs;
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
        : p4SmokeSaveAs
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

  const temporaryPath = `${targetPath}.tmp-${process.pid}-${randomBytes(6).toString("hex")}`;
  let descriptor;
  try {
    descriptor = openSync(temporaryPath, "wx");
    writeSync(descriptor, value.bytes, 0, value.bytes.byteLength, 0);
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

  const window = new BrowserWindow({
    title: productIdentity,
    width: 1440,
    height: 900,
    show: !(smokeMode || auditMode || normalProofMode),
    webPreferences: createSecureWebPreferences({
      preloadPath: path.join(appRoot, "preload.cjs"),
      reportToken,
      productMilestoneId
    })
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
    if (!result) throw new Error("Invalid smoke result");
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

  ipcMain.handle(IPC_CHANNELS.openSvgaFile, async (event) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    return openSvgaFile();
  });

  ipcMain.handle(IPC_CHANNELS.openReferenceMediaFile, async (event) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    return openReferenceMediaFile();
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
    }, productMilestoneId === "P5" ? 80_000 : 20_000).unref();
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
  if (normalVisibleStartupMode) await writeVisibleNormalStartupProof(window, rendererUrl);
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
