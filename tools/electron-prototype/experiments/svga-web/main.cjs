const { execFileSync } = require("node:child_process");
const { createHash, randomBytes } = require("node:crypto");
const { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync, writeSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, dialog, ipcMain, session } = require("electron");

const smokeMode = process.argv.includes("--smoke");
const productSmokeMode = smokeMode && process.argv.includes("--product-smoke");
const normalProofMode = process.argv.includes("--p2-normal-proof") || process.env.AUTO_SVGA_P2_NORMAL_PROOF === "1";
const auditPlayerArgument = process.argv.find((argument) => argument.startsWith("--audit-player="));
const auditPlayer = auditPlayerArgument?.split("=")[1];
const auditMode = auditPlayer === "svga-web" || auditPlayer === "svgaplayerweb";
const appRoot = app.getAppPath();
const repoRoot = path.resolve(appRoot, "../../../..");
const productIdentity = "Auto SVGA";
const mainEntry = "main.cjs";
const preloadEntry = "preload.cjs";
const rendererHtmlEntry = "web/index.html";
const rendererEntry = "web/prototype.js";
const stylesEntry = "web/styles.css";
const playerIdentity = "svga-web@2.4.4";
const csp = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
const productMilestoneId = process.env.AUTO_SVGA_PRODUCT_MILESTONE ?? "P2";
const productMilestoneTitle = {
  P2: "Desktop Product Shell And Web Preview Parity",
  P3: "Basic Image Resource Replacement And Save As"
}[productMilestoneId] ?? "Auto SVGA Product Milestone";
const productArtifactRoot = process.env.AUTO_SVGA_PRODUCT_ARTIFACTS
  ? path.resolve(process.env.AUTO_SVGA_PRODUCT_ARTIFACTS)
  : path.join(repoRoot, ".artifacts/product", productMilestoneId);
const canonicalFixtureRuntimePath = path.join(appRoot, ".runtime/fixture/avatar-frame-smoke.svga");
const sessionRoot = path.join(os.tmpdir(), `auto-svga-desktop-baseline-${process.pid}`);
const reportToken = randomBytes(24).toString("hex");
const runtimeInstanceId = randomBytes(12).toString("hex");
let experimentServer;
let expectedOrigin;
let smokeFinished = false;
let auditFinished = false;
let cspViolationSeen = false;
let cleanedUp = false;
const sourceFilePaths = new Map();
const productArtifactIndex = {
  milestoneId: productMilestoneId,
  title: productMilestoneTitle,
  productIdentity,
  headCommit: gitHeadCommit(),
  generatedAt: new Date().toISOString(),
  humanReviewRequired: true,
  artifacts: []
};
mergeExistingProductArtifactIndex();

mkdirSync(sessionRoot, { recursive: true });
if (productSmokeMode || normalProofMode) mkdirSync(productArtifactRoot, { recursive: true });
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

function validateArtifactScenario(value) {
  const allowed = new Set([
    "desktop-empty",
    "desktop-loading",
    "desktop-loaded",
    "desktop-inspection",
    "desktop-invalid",
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
    "p3-original-edited-comparison"
  ]);
  return allowed.has(value) ? value : undefined;
}

function validateEditedSvgaSaveInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (typeof value.bytesBase64 !== "string" || value.bytesBase64.length === 0) return undefined;
  const bytes = Buffer.from(value.bytesBase64, "base64");
  if (bytes.byteLength <= 0 || bytes.byteLength > 25 * 1024 * 1024) return undefined;
  const suggestedName = sanitizeSvgaFileName(
    typeof value.suggestedName === "string" ? value.suggestedName : "untitled-edited.svga"
  );
  const sourceId = typeof value.sourceId === "string" && /^[a-f0-9]{24}$/.test(value.sourceId) ? value.sourceId : "";
  return {
    bytes,
    suggestedName,
    sourceId
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
      fixtureLabel: "synthetic-avatar-frame.svga",
      fixtureSha256: createHash("sha256").update(bytes).digest("hex"),
      fixtureSizeBytes: bytes.byteLength,
      fixtureSourcePath: "tools/electron-prototype/experiments/svga-web/.runtime/fixture/avatar-frame-smoke.svga",
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
  if (scenario === "desktop-empty") {
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
    .replace(/[A-Za-z]:\\Users\\[^\\\s]+/g, "<home>");
}

function sanitizedRuntimeArgv() {
  return process.argv.map((argument) => sanitizeRuntimeArgument(argument));
}

function runtimeIdentity(mode, rendererUrl) {
  return {
    schemaVersion: 1,
    milestoneId: productMilestoneId,
    headCommit: productArtifactIndex.headCommit,
    entryCommand: "npm run desktop:dev",
    actualLaunchCommand: process.env.AUTO_SVGA_ACTUAL_LAUNCH_COMMAND ?? (normalProofMode ? "npm run desktop:dev" : "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:dev"),
    actualArgvSanitized: sanitizedRuntimeArgv(),
    executableBasename: path.basename(process.argv[0] ?? ""),
    pathRedactionsApplied: true,
    environmentOverrides: normalProofMode ? { AUTO_SVGA_P2_NORMAL_PROOF: "1" } : {},
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
    ...canonicalFixtureMetadata(),
    indexHtmlSha256: sha256RelativeFile(rendererHtmlEntry),
    rendererJsSha256: sha256RelativeFile(rendererEntry),
    stylesCssSha256: sha256RelativeFile(stylesEntry),
    preloadSha256: sha256RelativeFile(preloadEntry),
    mainSha256: sha256RelativeFile(mainEntry),
    loadingPipelineIdentity: "loadSvgaFile -> loadSvgaBytes -> Parser.do -> Player.mount -> inspection report",
    cleanupPipelineIdentity: "cleanupPlayer -> clearCanvas -> reset active player/parser/video/status",
    externalRequests: [],
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
  if (productSmokeMode) writeProductArtifactIndex();
  const passed = Object.values(result).every(Boolean);
  console.log(`AUTO_SVGA_WEB_EXPERIMENT_SMOKE ${JSON.stringify({ ...result, passed })}`);
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
    windowShown: true,
    automationMechanism: "host-driven file input event in canonical renderer",
    fileOpenMechanism: "ordinary file input change event",
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

function writeProductArtifactIndex() {
  const indexPath = path.join(productArtifactRoot, "artifact-index.json");
  writeFileSync(indexPath, `${JSON.stringify(productArtifactIndex, null, 2)}\n`);
}

function stateForScenario(scenario) {
  return {
    "desktop-empty": "empty",
    "desktop-loading": "loading",
    "desktop-loaded": "loaded",
    "desktop-invalid": "invalid"
  }[scenario];
}

function overlayPixelRatio(image, rect) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return 0;
  const size = image.getSize();
  const bitmap = image.toBitmap();
  const left = Math.max(0, Math.floor(rect.left ?? rect.x ?? 0));
  const top = Math.max(0, Math.floor(rect.top ?? rect.y ?? 0));
  const right = Math.min(size.width, Math.ceil(left + rect.width));
  const bottom = Math.min(size.height, Math.ceil(top + rect.height));
  if (right <= left || bottom <= top) return 0;
  const buckets = new Map();
  let total = 0;
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * size.width + x) * 4;
      const key = `${bitmap[offset] >> 4},${bitmap[offset + 1] >> 4},${bitmap[offset + 2] >> 4}`;
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
  const ratio = overlayPixelRatio(image, probe?.overlayRect);
  const failures = [...(probe?.failures ?? [])];
  if (state !== "loaded" && ratio <= 0.001) failures.push("overlay region lacks non-background screenshot pixels");
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
  proof.passed = ["empty", "loading", "loaded", "invalid"].every((key) => proof.states[key]?.passed === true);
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
    "p3-original-edited-comparison": "original-edited-comparison.png"
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

async function openSvgaFile() {
  const result = await dialog.showOpenDialog({
    title: "打开 SVGA",
    filters: [{ name: "SVGA", extensions: ["svga"] }],
    properties: ["openFile"]
  });
  if (result.canceled || !result.filePaths?.[0]) {
    return { status: "cancelled" };
  }
  const filePath = result.filePaths[0];
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
    fileName: path.basename(filePath),
    sizeBytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytesBase64: bytes.toString("base64")
  };
}

async function saveEditedSvga(input) {
  const value = validateEditedSvgaSaveInput(input);
  if (!value) throw new Error("Invalid Save As payload");
  const p3SmokeSaveAs = productMilestoneId === "P3" && (smokeMode || productSmokeMode || normalProofMode);
  const originalPath = value.sourceId ? sourceFilePaths.get(value.sourceId) : "";
  if (!p3SmokeSaveAs && !originalPath) {
    throw new Error("Save As requires the source SVGA to be opened through the desktop file picker.");
  }
  let targetPath;
  if (p3SmokeSaveAs) {
    mkdirSync(productArtifactRoot, { recursive: true });
    targetPath = path.join(productArtifactRoot, "edited-output.svga");
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
  if (p3SmokeSaveAs) {
    addProductArtifactRecord({
      scenario: "p3-edited-output-svga",
      mode: "smoke",
      source: "desktop",
      viewport: { width: null, height: null },
      path: `.artifacts/product/${productMilestoneId}/edited-output.svga`,
      mime: "application/x-svga",
      sizeBytes: value.bytes.byteLength,
      sha256: createHash("sha256").update(value.bytes).digest("hex"),
      fixture: "synthetic-avatar-frame.svga",
      inputKind: "p3-edited-output",
      ...canonicalFixtureMetadata(),
      headCommit: productArtifactIndex.headCommit,
      rendererEntry: `tools/electron-prototype/experiments/svga-web/${rendererEntry}`,
      rendererSha256: sha256RelativeFile(rendererEntry),
      generatedAt: new Date().toISOString(),
      humanReviewRequired: true
    });
    writeProductArtifactIndex();
  }

  return {
    status: "saved",
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
    title: productIdentity,
    width: 1280,
    height: 800,
    show: !(smokeMode || auditMode),
    webPreferences: {
      preload: path.join(appRoot, "preload.cjs"),
      additionalArguments: [
        `--prototype-report-token=${reportToken}`,
        `--prototype-product-milestone=${productMilestoneId}`
      ],
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
    if (!(auditPlayer === "svgaplayerweb" && /Electron Security Warning.+unsafe-eval/is.test(String(message)))
      && /violates.+script-src|unsafe-eval|wasm-eval/i.test(String(message))) {
      cspViolationSeen = true;
    }
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

  ipcMain.handle("svga-web-experiment:capture-artifact", async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    if (!productSmokeMode && !normalProofMode) throw new Error("Product artifact capture is only available in product capture mode");
    const scenario = validateArtifactScenario(input);
    if (!scenario) throw new Error("Invalid product artifact scenario");
    return captureProductArtifact(window, scenario);
  });

  ipcMain.handle("svga-web-experiment:audit-result", async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    const result = validateAuditResult(input);
    if (!result) throw new Error("Invalid audit result");
    if (auditMode) await finishAudit(window, result);
    return { accepted: true };
  });

  ipcMain.handle("svga-web-experiment:normal-proof-result", async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    const result = validateNormalProofResult(input);
    if (!result) throw new Error("Invalid normal proof result");
    if (normalProofMode) await finishNormalProof(window, result);
    return { accepted: true };
  });

  ipcMain.handle("svga-web-experiment:save-edited-svga", async (event, input) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    return saveEditedSvga(input);
  });

  ipcMain.handle("svga-web-experiment:open-svga-file", async (event) => {
    if (!isExpectedSender(event)) throw new Error("Unexpected IPC sender");
    return openSvgaFile();
  });

  ipcMain.handle("svga-web-experiment:p3-edit-result", async (event, input) => {
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
      const response = await fetch("/fixture/avatar-frame-smoke.svga");
      if (!response.ok) throw new Error("fixture load failed");
      const bytes = new Uint8Array(await response.arrayBuffer());
      const file = new File([bytes], "synthetic-avatar-frame.svga", { type: "application/octet-stream" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const input = document.querySelector("#fileInput");
      Object.defineProperty(input, "files", { value: transfer.files, configurable: true });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      const startedAt = performance.now();
      while (performance.now() - startedAt < 8000) {
        const reportReady = Boolean(document.querySelector('[data-inspection-group="audit"]'));
        const playing = document.querySelector("#playbackStatus")?.textContent?.includes("正在播放");
        if (reportReady && playing) break;
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      const context = document.querySelector("#player")?.getContext("2d");
      let canvasNonBlank = false;
      if (context) {
        const pixels = context.getImageData(0, 0, 300, 300).data;
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i] > 0) { canvasNonBlank = true; break; }
        }
      }
      return {
        normalMode: true,
        rendererQuery: location.search,
        playback: document.querySelector("#playbackStatus")?.textContent?.includes("正在播放") ?? false,
        canvasNonBlank,
        inspectionReport: Boolean(document.querySelector('[data-inspection-group="spec"]')),
        auditPanel: Boolean(document.querySelector('[data-inspection-group="audit"]')),
        localOnly: performance.getEntriesByType("resource").every((entry) => new URL(entry.name).origin === location.origin || entry.name.startsWith("blob:" + location.origin + "/")),
        cspAccepted: Boolean(document.querySelector("meta[name='auto-svga-csp']")?.content.includes("wasm-unsafe-eval")),
        noCspViolation: true
      };
    })()
  `);
  await captureProductArtifact(window, "actual-normal-loaded");
  await finishNormalProof(window, validateNormalProofResult(result) ?? {
    normalMode: true,
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
