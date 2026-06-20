const { execFileSync } = require("node:child_process");
const { createHash, randomBytes } = require("node:crypto");
const { mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, ipcMain, session } = require("electron");

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
const productArtifactIndex = {
  milestoneId: productMilestoneId,
  title: "Desktop Product Shell And Web Preview Parity",
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
    "desktop-1440x900"
  ]);
  return allowed.has(value) ? value : undefined;
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

function runtimeIdentity(mode, rendererUrl) {
  return {
    schemaVersion: 1,
    milestoneId: productMilestoneId,
    headCommit: productArtifactIndex.headCommit,
    entryCommand: "npm run desktop:dev",
    actualLaunchCommand: process.env.AUTO_SVGA_ACTUAL_LAUNCH_COMMAND ?? (normalProofMode ? "npm run desktop:dev" : "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:dev"),
    actualArgv: process.argv.slice(0),
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
    actualArgv: normalIdentity.actualArgv,
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

async function captureProductArtifact(window, scenario) {
  const originalSize = window.getSize();
  if (scenario === "desktop-1280x800") window.setSize(1280, 800);
  if (scenario === "desktop-1440x900") window.setSize(1440, 900);
  if (scenario === "desktop-1280x800" || scenario === "desktop-1440x900") {
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  const png = (await window.webContents.capturePage()).toPNG();
  const capturedSize = window.getSize();
  if (scenario === "desktop-1280x800" || scenario === "desktop-1440x900") {
    window.setSize(originalSize[0], originalSize[1]);
  }
  const fileName = `${scenario}.png`;
  const filePath = path.join(productArtifactRoot, fileName);
  writeFileSync(filePath, png);
  const fixture = canonicalFixtureMetadata();
  addProductArtifactRecord({
    scenario,
    mode: scenario === "actual-normal-loaded" ? "normal" : "smoke",
    source: "desktop",
    viewport: { width: capturedSize[0], height: capturedSize[1] },
    path: `.artifacts/product/${productMilestoneId}/${fileName}`,
    mime: "image/png",
    sizeBytes: png.byteLength,
    sha256: createHash("sha256").update(png).digest("hex"),
    fixture: fixture.fixtureLabel,
    ...fixture,
    headCommit: productArtifactIndex.headCommit,
    rendererEntry: `tools/electron-prototype/experiments/svga-web/${rendererEntry}`,
    rendererSha256: sha256RelativeFile(rendererEntry),
    generatedAt: new Date().toISOString(),
    humanReviewRequired: true
  });
  writeProductArtifactIndex();
  return { path: `.artifacts/product/${productMilestoneId}/${fileName}`, sizeBytes: png.byteLength };
}

function writeJsonProductArtifact(fileName, scenario, value, mode = "smoke") {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  writeFileSync(path.join(productArtifactRoot, fileName), bytes);
  const fixture = canonicalFixtureMetadata();
  addProductArtifactRecord({
    scenario,
    mode,
    source: "desktop",
    viewport: { width: null, height: null },
    path: `.artifacts/product/${productMilestoneId}/${fileName}`,
    mime: "application/json",
    sizeBytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    fixture: fixture.fixtureLabel,
    ...fixture,
    headCommit: productArtifactIndex.headCommit,
    rendererEntry: `tools/electron-prototype/experiments/svga-web/${rendererEntry}`,
    rendererSha256: sha256RelativeFile(rendererEntry),
    generatedAt: new Date().toISOString(),
    humanReviewRequired: true
  });
  writeProductArtifactIndex();
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
