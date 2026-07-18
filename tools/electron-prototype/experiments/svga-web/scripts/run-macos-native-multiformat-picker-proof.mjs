import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspectSvgaDocumentTypeDeclaration, inspectSvgaUtiDeclaration } from "./macos-package-proof.mjs";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(experimentRoot, "../../../..");
const requireFromPrototype = createRequire(path.join(experimentRoot, "../..", "package.json"));
const launchServicesRegister = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";
const proofFileName = "macos-native-multiformat-picker-proof.json";
const expectedRows = Object.freeze([
  { alias: "TASK-SVGA-A", env: "AUTO_SVGA_NATIVE_PICKER_SVGA", extension: ".svga", format: "svga" },
  { alias: "TASK-LOTTIE-A", env: "AUTO_SVGA_NATIVE_PICKER_LOTTIE", extension: ".json", format: "lottie" },
  { alias: "TASK-VAP-A", env: "AUTO_SVGA_NATIVE_PICKER_VAP", extension: ".mp4", format: "vap" }
]);

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function requiredAbsolutePath(envName) {
  const value = process.env[envName];
  if (typeof value !== "string" || !path.isAbsolute(value) || value.includes("\0")) {
    throw new Error(`${envName} must be one absolute local path.`);
  }
  return path.normalize(value);
}

function validateRegularInput(spec) {
  const filePath = requiredAbsolutePath(spec.env);
  const link = lstatSync(filePath);
  const file = statSync(filePath);
  if (!link.isFile() || link.isSymbolicLink() || !file.isFile() || file.nlink !== 1 || file.size <= 0) {
    throw new Error(`${spec.alias} is outside the regular single-link input contract.`);
  }
  if (path.extname(filePath).toLowerCase() !== spec.extension) {
    throw new Error(`${spec.alias} does not match its required extension.`);
  }
  return {
    ...spec,
    filePath,
    basename: path.basename(filePath),
    sizeBytes: file.size,
    sha256: sha256File(filePath)
  };
}

function prepareArtifactRoot() {
  const root = requiredAbsolutePath("AUTO_SVGA_NATIVE_PICKER_ARTIFACT_ROOT");
  if (!existsSync(root)) mkdirSync(root, { mode: 0o700 });
  const link = lstatSync(root);
  const stats = statSync(root);
  if (!link.isDirectory() || link.isSymbolicLink() || !stats.isDirectory() || (stats.mode & 0o077) !== 0) {
    throw new Error("Native picker artifact root must be a private regular directory.");
  }
  const proofPath = path.join(root, proofFileName);
  if (existsSync(proofPath)) throw new Error("Native picker proof path already exists.");
  return { root, proofPath, userDataPath: path.join(root, "user-data") };
}

function validateAppBundleAt(appBundle, sourceHead) {
  const link = lstatSync(appBundle);
  if (!link.isDirectory() || link.isSymbolicLink()) throw new Error("Native picker App must be one regular bundle directory.");
  const executable = path.join(appBundle, "Contents/MacOS/Auto SVGA");
  const infoPlistPath = path.join(appBundle, "Contents/Info.plist");
  const asarPath = path.join(appBundle, "Contents/Resources/app.asar");
  for (const requiredPath of [executable, infoPlistPath, asarPath]) {
    const stats = statSync(requiredPath);
    if (!stats.isFile() || stats.size <= 0) throw new Error("Native picker App is missing a required packaged file.");
  }
  const infoPlist = readFileSync(infoPlistPath, "utf8");
  if (!inspectSvgaUtiDeclaration(infoPlist).valid || !inspectSvgaDocumentTypeDeclaration(infoPlist).valid) {
    throw new Error("Packaged App does not contain the canonical SVGA native admission declarations.");
  }
  const asar = requireFromPrototype("@electron/asar");
  const buildInfo = JSON.parse(asar.extractFile(asarPath, ".runtime/build-info.json").toString("utf8"));
  if (buildInfo.buildCommit !== sourceHead || buildInfo.productMilestoneId !== "0.2-multiformat-preview") {
    throw new Error("Packaged App build identity does not match the exact source head and product milestone.");
  }
  return { appBundle, executable, infoPlistPath, asarPath, buildInfo };
}

function stageTestApp(sourceApp, sourceHead) {
  const appBundle = path.join(
    os.homedir(),
    "Applications",
    `Auto SVGA Native Picker Selftest ${sourceHead.slice(0, 12)}.app`
  );
  if (existsSync(appBundle)) throw new Error("Native picker task App path already exists.");
  execFileSync("/usr/bin/ditto", ["--norsrc", sourceApp.appBundle, appBundle], { stdio: "ignore" });
  return validateAppBundleAt(appBundle, sourceHead);
}

function assertNoAutoSvgaProcess() {
  let output = "";
  try {
    output = execFileSync("/usr/bin/pgrep", ["-fl", "Auto SVGA.app/Contents/MacOS/Auto SVGA"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch (error) {
    if (error?.status !== 1) throw error;
  }
  if (output) throw new Error("Another Auto SVGA process owns the native picker runtime slot.");
}

function registerTestApp(appBundle) {
  execFileSync(launchServicesRegister, ["-f", appBundle], { stdio: "ignore" });
}

function unregisterTestApp(appBundle) {
  try {
    execFileSync(launchServicesRegister, ["-u", appBundle], { stdio: "ignore" });
  } catch {
    // A failed unregister is surfaced by the final exact process/listener checks.
  }
}

function readContentTypeTree(filePath) {
  return execFileSync("/usr/bin/mdls", ["-raw", "-name", "kMDItemContentTypeTree", filePath], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function assertNoTcpListener(port) {
  let output = "";
  try {
    output = execFileSync("/usr/sbin/lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch (error) {
    if (error?.status !== 1) throw error;
  }
  if (output) throw new Error("Native picker DevTools listener remained after cleanup.");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor(predicate, { timeoutMs, intervalMs = 100, label }) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await predicate();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }
  throw new Error(`${label} timed out${lastError ? `: ${lastError.message}` : ""}`);
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocket = new WebSocket(webSocketUrl);
    this.nextId = 1;
    this.pending = new Map();
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.webSocket.addEventListener("open", resolve, { once: true });
      this.webSocket.addEventListener("error", reject, { once: true });
    });
    this.webSocket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    });
    await this.call("Runtime.enable");
    return this;
  }

  call(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.webSocket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Renderer evaluation failed.");
    return result.result?.value;
  }

  close() {
    this.webSocket.close();
  }
}

function createDevToolsWaiter(child) {
  let buffered = "";
  let resolveUrl;
  let rejectUrl;
  const promise = new Promise((resolve, reject) => {
    resolveUrl = resolve;
    rejectUrl = reject;
  });
  const onChunk = (chunk) => {
    buffered = `${buffered}${chunk}`.slice(-32768);
    const match = /DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[^\s]+)/u.exec(buffered);
    if (match) resolveUrl(match[1]);
  };
  child.stderr.on("data", onChunk);
  child.stdout.on("data", onChunk);
  child.once("exit", (code, signal) => rejectUrl(new Error(`Packaged App exited before DevTools readiness (${code ?? signal}).`)));
  return {
    promise,
    output: () => buffered.trim()
  };
}

async function connectProductPage(browserWebSocketUrl, child, readChildOutput) {
  const endpoint = new URL(browserWebSocketUrl);
  const listUrl = `http://${endpoint.host}/json/list`;
  const target = await waitFor(async () => {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Packaged App exited during renderer startup (${child.exitCode ?? child.signalCode}): ${readChildOutput()}`);
    }
    const response = await fetch(listUrl);
    if (!response.ok) return undefined;
    const targets = await response.json();
    return targets.find((item) => item.type === "page" && /^http:\/\/127\.0\.0\.1:\d+\/(?:$|\?)/u.test(item.url));
  }, { timeoutMs: 15000, label: "packaged product renderer" });
  return new CdpClient(target.webSocketDebuggerUrl).open();
}

function runNativePanelSelection(pid, filePath) {
  const directoryPath = path.dirname(filePath);
  const basename = path.basename(filePath);
  const script = String.raw`
function run(argv) {
  const ownerPid = Number(argv[0]);
  const directoryPath = String(argv[1]);
  const basename = String(argv[2]);
  const events = Application("System Events");
  const owner = events.applicationProcesses().find((process) => Number(process.unixId()) === ownerPid);
  if (!owner) throw new Error("owner_process_missing");
  owner.frontmost.set(true);

  function ownerPanel() {
    try {
      const windows = owner.windows();
      return windows.length > 0 ? windows[0] : null;
    } catch {}
    return null;
  }

  function defaultButton(panel) {
    let buttons = [];
    try { buttons = panel.buttons(); } catch {}
    for (const button of buttons) {
      try {
        const subrole = String(button.subrole() || "");
        const name = String(button.name() || "");
        if (subrole === "AXDefaultButton" || name === "Choose" || name === "选取") return button;
      } catch {}
    }
    return null;
  }

  let panel = null;
  for (let attempt = 0; attempt < 80 && !panel; attempt += 1) {
    panel = ownerPanel();
    if (!panel) delay(0.1);
  }
  if (!panel) throw new Error("native_open_panel_missing");
  events.keystroke("g", { using: ["command down", "shift down"] });
  delay(0.4);
  events.keystroke(directoryPath);
  events.keyCode(36);
  delay(0.9);
  events.keystroke(basename);
  delay(0.7);
  panel = ownerPanel();
  let button = panel ? defaultButton(panel) : null;
  for (let attempt = 0; attempt < 40 && !button; attempt += 1) {
    delay(0.1);
    panel = ownerPanel();
    button = panel ? defaultButton(panel) : null;
  }
  if (!button) throw new Error("native_open_button_missing");
  const enabled = Boolean(button.enabled());
  const name = String(button.name() || "");
  if (enabled) button.click();
  return JSON.stringify({
    openButtonFound: true,
    openButtonEnabled: enabled,
    submitted: enabled,
    buttonName: name,
    requestedBasename: basename,
    selectionMethod: "bounded-keyboard-basename"
  });
}`;
  const output = execFileSync("/usr/bin/osascript", [
    "-l", "JavaScript", "-e", script, "--", String(pid), directoryPath, basename
  ], {
    encoding: "utf8",
    timeout: 20000,
    stdio: ["ignore", "pipe", "pipe"]
  });
  return JSON.parse(output.trim());
}

function runNativePanelCancel(pid) {
  const script = String.raw`
function run(argv) {
  const ownerPid = Number(argv[0]);
  const events = Application("System Events");
  const owner = events.applicationProcesses().find((process) => Number(process.unixId()) === ownerPid);
  if (!owner) throw new Error("owner_process_missing");
  owner.frontmost.set(true);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const windows = owner.windows();
      for (const window of windows) {
        const buttons = window.buttons();
        for (const button of buttons) {
          const name = String(button.name() || "");
          if (name === "Cancel" || name === "取消") {
            button.click();
            return JSON.stringify({ cancelled: true, buttonName: name });
          }
        }
      }
    } catch {}
    delay(0.1);
  }
  events.keyCode(53);
  return JSON.stringify({ cancelled: true, buttonName: "escape" });
}`;
  const output = execFileSync("/usr/bin/osascript", ["-l", "JavaScript", "-e", script, "--", String(pid)], {
    encoding: "utf8",
    timeout: 12000,
    stdio: ["ignore", "pipe", "pipe"]
  });
  return JSON.parse(output.trim());
}

function exactProcessPids(name) {
  try {
    return execFileSync("/usr/bin/pgrep", ["-x", name], { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(Number)
      .filter(Number.isInteger);
  } catch {
    return [];
  }
}

async function waitForNewPickerPid(beforePids) {
  const before = new Set(beforePids);
  return waitFor(() => exactProcessPids("osascript").find((pid) => !before.has(pid)), {
    timeoutMs: 8000,
    intervalMs: 50,
    label: "Standard Additions picker process"
  });
}

const rendererSnapshotExpression = String.raw`(() => {
  const actions = window.__autoSvgaShortTermActions;
  let summary = {};
  try { summary = JSON.parse(actions?.currentStateSummary?.() || "{}"); } catch {}
  const progressNode = document.querySelector("#playbackProgress");
  const mount = document.querySelector("#multiFormatRuntimeMount");
  const primaryCanvas = document.querySelector("#primaryCanvas");
  const playButton = document.querySelector('[data-action="play-pause"]');
  const runtimeCanvas = mount?.querySelector("canvas");
  return {
    productMilestoneId: window.autoSvgaElectronHost?.productMilestoneId,
    status: summary.status || null,
    format: summary.format || null,
    fileIdentity: document.querySelector("#fileIdentity")?.textContent || "",
    playbackMeta: document.querySelector("#playbackMeta")?.textContent || "",
    playbackState: playButton?.dataset.playbackState || null,
    playbackTime: document.querySelector("#playbackTime")?.textContent || "",
    progress: Number(progressNode?.getAttribute("aria-valuenow") || 0),
    runtimeFormat: mount?.dataset.runtimeFormat || null,
    runtimeState: mount?.dataset.runtimePreviewState || null,
    runtimePlayerReady: mount?.dataset.runtimePlayerReady || null,
    primaryCanvas: { width: primaryCanvas?.width || 0, height: primaryCanvas?.height || 0 },
    hasLottieSvg: Boolean(mount?.querySelector("svg")),
    runtimeCanvas: { width: runtimeCanvas?.width || 0, height: runtimeCanvas?.height || 0 },
    videoReadyState: Math.max(0, ...Array.from(document.querySelectorAll("video"), (video) => Number(video.readyState || 0)))
  };
})()`;

function rendererReadyForFormat(snapshot, row) {
  if (!snapshot || snapshot.productMilestoneId !== "0.2-multiformat-preview") return false;
  if (!snapshot.fileIdentity.includes(row.basename) || snapshot.playbackState !== "playing") return false;
  if (row.format === "svga") return snapshot.primaryCanvas.width > 0 && snapshot.primaryCanvas.height > 0;
  if (snapshot.format !== row.format || snapshot.runtimeState !== "loaded" || snapshot.runtimeFormat !== row.format) return false;
  if (row.format === "lottie") return snapshot.hasLottieSvg;
  return snapshot.runtimeCanvas.width > 0 && snapshot.runtimeCanvas.height > 0 && snapshot.videoReadyState >= 2;
}

async function proveRow(client, row) {
  const beforePickerPids = exactProcessPids("osascript");
  await client.evaluate("void window.__autoSvgaShortTermActions.openFromHostDialog()");
  const pickerPid = await waitForNewPickerPid(beforePickerPids);
  const picker = runNativePanelSelection(pickerPid, row.filePath);
  if (!picker.openButtonEnabled || !picker.submitted) {
    throw new Error(`${row.alias} native Open button remained disabled.`);
  }
  const playingFirst = await waitFor(async () => {
    const snapshot = await client.evaluate(rendererSnapshotExpression);
    return rendererReadyForFormat(snapshot, row) ? snapshot : undefined;
  }, { timeoutMs: 30000, intervalMs: 150, label: `${row.alias} autoplay` });
  const playingSecond = await waitFor(async () => {
    const snapshot = await client.evaluate(rendererSnapshotExpression);
    return rendererReadyForFormat(snapshot, row) && snapshot.progress !== playingFirst.progress ? snapshot : undefined;
  }, { timeoutMs: 10000, intervalMs: 150, label: `${row.alias} playback advancement` });
  return {
    alias: row.alias,
    sha256: row.sha256,
    sizeBytes: row.sizeBytes,
    format: row.format,
    picker,
    playingFirst,
    playingSecond
  };
}

async function closeProduct(client, child) {
  try { await client?.evaluate("window.close(); true"); } catch {}
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    delay(5000).then(() => false)
  ]);
  if (!exited && child.exitCode === null) child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(5000)
  ]);
  client?.close();
}

async function main() {
  const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  const artifacts = prepareArtifactRoot();
  const rows = expectedRows.map(validateRegularInput);
  const sourceApp = validateAppBundleAt(requiredAbsolutePath("AUTO_SVGA_NATIVE_PICKER_APP"), sourceHead);
  const app = stageTestApp(sourceApp, sourceHead);
  assertNoAutoSvgaProcess();
  registerTestApp(app.appBundle);
  const svgaContentTypeTree = readContentTypeTree(rows[0].filePath);
  mkdirSync(artifacts.userDataPath, { mode: 0o700 });
  const childEnv = { ...process.env };
  delete childEnv.AUTO_SVGA_PRODUCT_ARTIFACTS;
  delete childEnv.AUTO_SVGA_ACCEPTANCE_EXECUTION_ID;

  const child = spawn(app.executable, [
    `--user-data-dir=${artifacts.userDataPath}`,
    "--remote-debugging-port=0"
  ], {
    cwd: path.dirname(app.executable),
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const devTools = createDevToolsWaiter(child);
  let client;
  let devToolsPort;
  try {
    const browserUrl = await Promise.race([
      devTools.promise,
      delay(15000).then(() => { throw new Error("Packaged App DevTools endpoint timed out."); })
    ]);
    devToolsPort = Number(new URL(browserUrl).port);
    client = await connectProductPage(browserUrl, child, devTools.output);
    await waitFor(
      () => client.evaluate("Boolean(window.__autoSvgaShortTermActions?.openFromHostDialog)"),
      { timeoutMs: 15000, label: "owner Open action" }
    );
    const results = [];
    for (const row of rows) results.push(await proveRow(client, row));

    const beforeCancel = await client.evaluate(rendererSnapshotExpression);
    const beforeCancelPickerPids = exactProcessPids("osascript");
    await client.evaluate("void window.__autoSvgaShortTermActions.openFromHostDialog()");
    const cancelPickerPid = await waitForNewPickerPid(beforeCancelPickerPids);
    const cancel = runNativePanelCancel(cancelPickerPid);
    const afterCancel = await waitFor(async () => {
      const snapshot = await client.evaluate(rendererSnapshotExpression);
      return snapshot.fileIdentity === beforeCancel.fileIdentity && snapshot.format === beforeCancel.format
        ? snapshot
        : undefined;
    }, { timeoutMs: 5000, label: "native picker cancellation state preservation" });

    const proof = {
      schemaVersion: 1,
      proofId: "macos-native-multiformat-picker-proof",
      status: "passed",
      sourceHead,
      buildCommit: app.buildInfo.buildCommit,
      productMilestoneId: app.buildInfo.productMilestoneId,
      nativeAdmission: {
        svgaUti: "com.auto-svga.svga",
        conformsTo: ["public.content", "public.data"],
        launchServicesResolvedAsContent: svgaContentTypeTree.includes("public.content"),
        documentRole: "Viewer",
        handlerRank: "Alternate"
      },
      rows: results,
      cancel: { ...cancel, statePreserved: afterCancel.fileIdentity === beforeCancel.fileIdentity },
      boundaries: {
        taskOwnedInputs: true,
        inputPathsRedacted: true,
        ownerFilesMutated: false,
        installedAppMutated: false,
        packagePromoted: false
      }
    };
    const serialized = `${JSON.stringify(proof, null, 2)}\n`;
    for (const sensitivePath of [app.appBundle, ...rows.map((row) => row.filePath)]) {
      if (serialized.includes(sensitivePath)) throw new Error("Native picker proof contains a raw local path.");
    }
    writeFileSync(artifacts.proofPath, serialized, { flag: "wx", mode: 0o600 });
    process.stdout.write(JSON.stringify({
      status: proof.status,
      sourceHead,
      proofPath: artifacts.proofPath,
      proofSha256: sha256File(artifacts.proofPath),
      rows: results.map((row) => ({ alias: row.alias, format: row.format, openEnabled: row.picker.openButtonEnabled }))
    }, null, 2));
  } finally {
    await closeProduct(client, child);
    unregisterTestApp(app.appBundle);
    rmSync(app.appBundle, { recursive: true, force: false });
    rmSync(artifacts.userDataPath, { recursive: true, force: true });
    assertNoAutoSvgaProcess();
    if (Number.isInteger(devToolsPort) && devToolsPort > 0) assertNoTcpListener(devToolsPort);
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
