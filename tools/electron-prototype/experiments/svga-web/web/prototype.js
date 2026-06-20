import { renderAvatarFrameInspectionReport } from "/tools/svga-player-preview/inspection-report-view.mjs";
import { FILL_MODE, Parser, Player } from "/vendor/svga-web-2.4.4.js";

const canvas = document.querySelector("#player");
const dropZone = document.querySelector("#dropZone");
const dropZoneHint = document.querySelector("#dropZoneHint");
const fileInput = document.querySelector("#fileInput");
const reportRoot = document.querySelector("#reportRoot");
const playbackStatus = document.querySelector("#playbackStatus");
const runtimeStatus = document.querySelector("#runtimeStatus");
const playButton = document.querySelector("#playButton");
const pauseButton = document.querySelector("#pauseButton");
const replayButton = document.querySelector("#replayButton");
const fileInfo = document.querySelector("#fileInfo");
const urlParams = new URLSearchParams(location.search);
const isSmokeMode = urlParams.get("mode") === "smoke";
const isNormalProofMode = urlParams.get("normalProof") === "1";
const shouldCaptureArtifacts = urlParams.get("artifacts") === "1";
const cspViolations = [];
let activePlayer;
let activeParser;
let activeVideo;
let activeName = "";
let playerStarted = false;
let playerPaused = false;
let cleanupCount = 0;

globalThis.addEventListener("securitypolicyviolation", (event) => {
  cspViolations.push(`${event.violatedDirective}:${event.blockedURI}`);
  console.warn(`CSP violation ${event.violatedDirective} ${event.blockedURI}`);
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  await loadSvgaFile(file, "file-picker");
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("isDragOver");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("isDragOver");
});

dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dropZone.classList.remove("isDragOver");
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  await loadSvgaFile(file, "drag-drop");
});

playButton.addEventListener("click", () => {
  if (!activePlayer) return;
  if (!playerStarted) {
    activePlayer.start();
    playerStarted = true;
  } else if (playerPaused) {
    activePlayer.resume();
  }
  playerPaused = false;
  updatePlaybackControls();
  playbackStatus.textContent = `正在播放：${safeDisplayName(activeName)}`;
});

pauseButton.addEventListener("click", () => {
  if (!activePlayer || playerPaused) return;
  activePlayer.pause();
  playerPaused = true;
  updatePlaybackControls();
  playbackStatus.textContent = `已暂停：${safeDisplayName(activeName)}`;
});

replayButton.addEventListener("click", () => {
  if (!activePlayer || !activeVideo) return;
  activePlayer.stop();
  activePlayer.start();
  playerStarted = true;
  playerPaused = false;
  updatePlaybackControls();
  playbackStatus.textContent = `重新播放：${safeDisplayName(activeName)}`;
});

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if ((event.metaKey || event.ctrlKey) && key === "o") {
    event.preventDefault();
    fileInput.click();
    return;
  }
  if (event.target instanceof HTMLInputElement) return;
  if (event.code === "Space") {
    event.preventDefault();
    if (!activePlayer) return;
    (playerPaused || !playerStarted ? playButton : pauseButton).click();
  } else if (key === "r") {
    replayButton.click();
  }
});

start().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  showError("启动失败。", error.message);
  await reportSmoke(emptyResult());
});

async function start() {
  showEmptyState();
  if (isNormalProofMode) {
    await runNormalProof();
    return;
  }
  if (!isSmokeMode) return;
  await runSmoke();
}

async function runNormalProof() {
  await delay(180);
  const fixtureUrl = "/fixture/avatar-frame-smoke.svga";
  const bytes = new Uint8Array(await fetch(fixtureUrl).then(assertResponse).then((response) => response.arrayBuffer()));
  const file = new File([bytes], "synthetic-avatar-frame.svga", { type: "application/octet-stream" });
  const proof = await loadSvgaFile(file, "normal-proof");
  await delay(260);
  await captureArtifact("actual-normal-loaded");
  await reportNormalProof({
    normalMode: true,
    rendererQuery: location.search,
    playback: proof.playback,
    canvasNonBlank: proof.canvasNonBlank,
    inspectionReport: proof.inspectionReport,
    auditPanel: proof.auditPanel,
    localOnly: resourcesAreLocal(),
    cspAccepted: cspAllowsOnlyLocalWasm(),
    noCspViolation: cspViolations.length === 0
  });
}

async function runSmoke() {
  await delay(180);
  await captureArtifact("desktop-empty");
  const fixtureUrl = "/fixture/avatar-frame-smoke.svga";
  const bytes = new Uint8Array(await fetch(fixtureUrl).then(assertResponse).then((response) => response.arrayBuffer()));
  const smoke = await loadSvgaBytes(bytes.slice(0), "synthetic-avatar-frame.svga", { sizeBytes: bytes.byteLength });
  await captureArtifact("desktop-loaded");
  await captureArtifact("smoke-loaded");
  await captureArtifact("desktop-1280x800");
  await captureArtifact("desktop-1440x900");
  document.querySelector("#reportTitle")?.scrollIntoView({ block: "start" });
  await delay(180);
  await captureArtifact("desktop-inspection");
  const fileInputSmoke = await smokeFileInput(bytes.slice(0));
  const dragDropSmoke = await smokeDragDrop(bytes.slice(0));
  const errorFileSmoke = await smokeErrorFile();
  await captureArtifact("desktop-invalid");

  const result = {
    localPage: location.hostname === "127.0.0.1",
    localOnly: resourcesAreLocal(),
    strictCsp: cspAllowsOnlyLocalWasm(),
    noCspViolation: cspViolations.length === 0,
    playback: smoke.playback,
    canvasNonBlank: smoke.canvasNonBlank,
    inspectionReport: smoke.inspectionReport,
    auditPanel: smoke.auditPanel,
    fileInput: fileInputSmoke,
    dragDrop: dragDropSmoke,
    errorFile: errorFileSmoke,
    playerLifecycle: smoke.playerLifecycle,
    cleanup: smoke.cleanup && cleanupCount >= 3
  };
  runtimeStatus.textContent = Object.values(result).every(Boolean) ? "内部原型验证通过" : "验证未通过";
  await reportSmoke(result);
  cleanupPlayer();
}

async function loadSvgaFile(file, source) {
  if (!isSvgaFile(file)) {
    cleanupPlayer();
    showError("无法打开此 SVGA 文件。", "不支持的文件类型。请选择 .svga 文件。");
    return false;
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  return loadSvgaBytes(bytes, file.name, { sizeBytes: file.size, source });
}

async function loadSvgaBytes(bytes, name, metadata = {}) {
  cleanupPlayer();
  activeName = name;
  setLoadingState(name);
  await delay(180);
  await captureArtifact("desktop-loading");
  let reportPromise;
  try {
    reportPromise = fetch(`/api/avatar-frame-inspection-report?name=${encodeURIComponent(name)}`, {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "x-auto-svga-prototype-token": window.autoSvgaPrototype.reportToken
      },
      body: bytes.slice(0).buffer
    }).then(assertResponse).then((response) => response.json());

    const parser = new Parser();
    activeParser = parser;
    const video = await parser.do(toArrayBuffer(bytes));
    activeVideo = video;
    const player = new Player(canvas);
    activePlayer = player;
    const lifecycle = new Set();
    player
      .$on("start", () => lifecycle.add("start"))
      .$on("process", () => lifecycle.add("process"))
      .$on("pause", () => lifecycle.add("pause"))
      .$on("resume", () => lifecycle.add("resume"));
    player.set({ loop: true, fillMode: FILL_MODE.FORWARDS, noExecutionDelay: false });
    await player.mount(video);
    player.start();
    playerStarted = true;
    playerPaused = false;
    updatePlaybackControls();
    playbackStatus.textContent = `正在渲染：${safeDisplayName(name)}`;

    const visibleCanvas = await waitForVisibleCanvasSamples(canvas, 1800);
    if (!visibleCanvas.nonBlank || !visibleCanvas.centralContent) {
      throw new Error("SVGA 播放输出为空。");
    }
    const report = await reportPromise;
    reportRoot.innerHTML = renderAvatarFrameInspectionReport(report, "success");
    decorateInspectionReport();
    updateFileInfo(name, metadata.sizeBytes ?? bytes.byteLength, report);
    runtimeStatus.textContent = "SVGA 已加载，检查报告已生成。";
    playbackStatus.textContent = `正在播放：${safeDisplayName(name)}`;
    dropZone.classList.remove("isError");
    dropZoneHint.textContent = "可以继续拖入或选择另一个本地 SVGA 文件。";

    if (isSmokeMode) {
      player.pause();
      playerPaused = true;
      await delay(80);
      player.resume();
      playerPaused = false;
      await delay(250);
      updatePlaybackControls();
    }

    return {
      playback: video.frames > 0 && Boolean(canvas.getContext("2d")),
      canvasNonBlank: visibleCanvas.nonBlank && visibleCanvas.centralContent && visibleCanvas.sampleCount >= 3,
      inspectionReport: report.contractVersion === 1 && Boolean(reportRoot.querySelector(".specReportSection")),
      auditPanel: Boolean(report.auditPresentation) && Boolean(reportRoot.querySelector(".auditReportSection")),
      playerLifecycle: ["start", "process"].every((eventName) => lifecycle.has(eventName))
        && (!isSmokeMode || ["pause", "resume"].every((eventName) => lifecycle.has(eventName))),
      cleanup: typeof player.destroy === "function" && typeof parser.destroy === "function"
    };
  } catch (error) {
    await reportPromise?.catch(() => undefined);
    cleanupPlayer();
    showError("无法打开此 SVGA 文件。", error instanceof Error ? error.message : String(error));
    return {
      playback: false,
      canvasNonBlank: false,
      inspectionReport: false,
      auditPanel: false,
      playerLifecycle: false,
      cleanup: true
    };
  }
}

async function smokeFileInput(bytes) {
  const file = new File([bytes], "file-input-smoke.svga", { type: "application/octet-stream" });
  return isSvgaFile(file) && (await loadSvgaBytes(new Uint8Array(await file.arrayBuffer()), file.name, { sizeBytes: file.size })).inspectionReport;
}

async function smokeDragDrop(bytes) {
  const file = new File([bytes], "drag-drop-smoke.svga", { type: "application/octet-stream" });
  const event = new DragEvent("drop", {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer()
  });
  event.dataTransfer.items.add(file);
  dropZone.dispatchEvent(event);
  await delay(1800);
  return playbackStatus.textContent.includes("drag-drop-smoke.svga")
    && Boolean(reportRoot.querySelector(".auditReportSection"));
}

async function smokeErrorFile() {
  const invalidType = new File([new Uint8Array([1, 2, 3])], "not-svga.txt", { type: "text/plain" });
  const invalidSvga = new File([new Uint8Array([1, 2, 3])], "broken.svga", { type: "application/octet-stream" });
  const event = new DragEvent("drop", {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer()
  });
  event.dataTransfer.items.add(invalidType);
  dropZone.dispatchEvent(event);
  await delay(80);
  const typeError = runtimeStatus.textContent.includes("无法打开此 SVGA 文件")
    && dropZoneHint.textContent.includes("不支持的文件类型");
  await loadSvgaFile(invalidSvga, "smoke-invalid");
  await delay(80);
  return typeError && runtimeStatus.textContent.includes("无法打开此 SVGA 文件");
}

function showEmptyState() {
  cleanupPlayer();
  runtimeStatus.textContent = "请选择本地 SVGA 文件开始检查。";
  playbackStatus.textContent = "未开始";
  dropZone.classList.remove("isError");
  dropZoneHint.textContent = "选择或拖入本地 SVGA 文件。内部原型，非生产版本。";
  reportRoot.innerHTML = "";
  updateFileInfo();
  updatePlaybackControls();
}

function setLoadingState(name) {
  dropZone.classList.remove("isError");
  runtimeStatus.textContent = "正在加载本地 SVGA...";
  playbackStatus.textContent = `加载中：${safeDisplayName(name)}`;
  dropZoneHint.textContent = "正在解析和生成只读检查报告。";
  reportRoot.innerHTML = "";
  updateFileInfo(name);
  updatePlaybackControls();
}

function showError(message, detail = "") {
  dropZone.classList.add("isError");
  runtimeStatus.textContent = message;
  playbackStatus.textContent = "未播放";
  dropZoneHint.innerHTML = `
    <strong>请换一个有效的 .svga 文件。</strong>
    <details class="errorDetails">
      <summary>查看技术细节</summary>
      <code>${escapeHtml(detail || message)}</code>
    </details>
  `;
  reportRoot.innerHTML = "";
  updateFileInfo();
  updatePlaybackControls();
}

function updatePlaybackControls() {
  const loaded = Boolean(activePlayer && activeVideo);
  playButton.disabled = !loaded || (playerStarted && !playerPaused);
  pauseButton.disabled = !loaded || playerPaused;
  replayButton.disabled = !loaded;
}

function updateFileInfo(name = "未加载", sizeBytes, report) {
  const summary = report?.asset ?? {};
  const timing = summary.timing ?? {};
  const dimensions = summary.dimensions ?? {};
  const canvasLabel = dimensions.width && dimensions.height
    ? `${dimensions.width} × ${dimensions.height}`
    : summary.canvasSize
      ? `${summary.canvasSize.width} × ${summary.canvasSize.height}`
      : summary.width && summary.height
        ? `${summary.width} × ${summary.height}`
    : "未加载";
  const timingLabel = typeof timing.durationMs === "number"
    ? `${(timing.durationMs / 1000).toFixed(2)}s`
    : typeof timing.frameCount === "number"
      ? `${timing.frameCount} frames`
      : "未加载";
  const values = [
    safeDisplayName(name),
    typeof sizeBytes === "number" ? formatBytes(sizeBytes) : "未加载",
    canvasLabel,
    typeof timing.fps === "number" ? `${timing.fps} fps` : summary.fps ?? "未加载",
    timingLabel
  ];
  fileInfo.querySelectorAll("dd").forEach((node, index) => {
    node.textContent = String(values[index] ?? "--");
  });
}

function decorateInspectionReport() {
  const calibration = reportRoot.querySelector(".calibrationGroup");
  if (!calibration || calibration.closest("details")) return;
  const wrapper = document.createElement("details");
  wrapper.className = "calibrationDetails";
  const summary = document.createElement("summary");
  summary.textContent = "产品校准说明";
  calibration.before(wrapper);
  wrapper.append(summary, calibration);
}

function canvasHasVisiblePixels(target, region) {
  if (!target || target.width <= 0 || target.height <= 0) return false;
  const context = target.getContext("2d");
  if (!context) return false;
  const sampleRegion = region ?? { x: 0, y: 0, width: target.width, height: target.height };
  const pixels = context.getImageData(
    sampleRegion.x,
    sampleRegion.y,
    sampleRegion.width,
    sampleRegion.height
  ).data;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] > 0 && (pixels[index] > 20 || pixels[index + 1] > 20 || pixels[index + 2] > 20)) {
      return true;
    }
  }
  return false;
}

async function waitForVisibleCanvasSamples(target, timeoutMs) {
  const startedAt = performance.now();
  let sampleCount = 0;
  let nonBlank = false;
  let centralContent = false;
  const centralRegion = {
    x: Math.floor(target.width * 0.25),
    y: Math.floor(target.height * 0.25),
    width: Math.floor(target.width * 0.5),
    height: Math.floor(target.height * 0.5)
  };
  while (performance.now() - startedAt < timeoutMs) {
    const sampleVisible = canvasHasVisiblePixels(target);
    const sampleCentral = canvasHasVisiblePixels(target, centralRegion);
    if (sampleVisible) nonBlank = true;
    if (sampleCentral) centralContent = true;
    if (sampleVisible && sampleCentral) sampleCount += 1;
    if (sampleCount >= 3) return { nonBlank, centralContent, sampleCount };
    await delay(80);
  }
  return { nonBlank, centralContent, sampleCount };
}

function resourcesAreLocal() {
  return performance.getEntriesByType("resource")
    .every((entry) => {
      const url = new URL(entry.name);
      if (url.protocol === "blob:") return entry.name.startsWith(`blob:${location.origin}/`);
      return url.origin === location.origin;
    });
}

function cspAllowsOnlyLocalWasm() {
  const meta = document.querySelector("meta[name='auto-svga-csp']");
  const policy = meta?.content ?? "";
  return document.scripts.length === 1
    && policy.includes("script-src 'self' 'wasm-unsafe-eval'")
    && !/(?<!wasm-)unsafe-eval/.test(policy);
}

function emptyResult() {
  return {
    localPage: location.hostname === "127.0.0.1",
    localOnly: resourcesAreLocal(),
    strictCsp: false,
    noCspViolation: cspViolations.length === 0,
    playback: false,
    canvasNonBlank: false,
    inspectionReport: false,
    auditPanel: false,
    fileInput: false,
    dragDrop: false,
    errorFile: false,
    playerLifecycle: false,
    cleanup: false
  };
}

function isSvgaFile(file) {
  return Boolean(file?.name?.toLowerCase().endsWith(".svga"));
}

function cleanupPlayer() {
  if (activePlayer || activeParser) cleanupCount += 1;
  activePlayer?.destroy?.();
  activeParser?.destroy?.();
  activePlayer = undefined;
  activeParser = undefined;
  activeVideo = undefined;
  activeName = "";
  playerStarted = false;
  playerPaused = false;
  clearCanvas();
}

function clearCanvas() {
  const context = canvas.getContext("2d");
  context?.clearRect(0, 0, canvas.width, canvas.height);
}

function toArrayBuffer(bytes) {
  const copy = bytes.slice(0);
  return copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength);
}

function safeDisplayName(name) {
  return String(name).replace(/[/\\]/g, "").slice(0, 80);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / 1024 / 1024).toFixed(2)} MiB`;
}

function assertResponse(response) {
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response;
}

function delay(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function reportSmoke(result) {
  return window.autoSvgaPrototype?.reportSmokeResult(result) ?? Promise.resolve();
}

function reportNormalProof(result) {
  return window.autoSvgaPrototype?.reportNormalProofResult?.(result) ?? Promise.resolve();
}

function captureArtifact(scenario) {
  if (!shouldCaptureArtifacts) return Promise.resolve();
  return window.autoSvgaPrototype?.captureArtifact?.(scenario) ?? Promise.resolve();
}
