import { renderAvatarFrameInspectionReport } from "/tools/svga-player-preview/inspection-report-view.mjs";
import { FILL_MODE, Parser, Player } from "/vendor/svga-web-2.4.4.js";

const canvas = document.querySelector("#player");
const dropZone = document.querySelector("#dropZone");
const dropZoneHint = document.querySelector("#dropZoneHint");
const emptySelectButton = document.querySelector("#emptySelectButton");
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

emptySelectButton?.addEventListener("click", () => fileInput.click());

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
  if (!isSmokeMode) return;
  await runSmoke();
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
    reportRoot.innerHTML = renderDesktopInspectionPresentation(report);
    updateFileInfo(name, metadata.sizeBytes ?? bytes.byteLength, report);
    runtimeStatus.textContent = "SVGA 已加载，检查报告已生成。";
    playbackStatus.textContent = `正在播放：${safeDisplayName(name)}`;
    dropZone.classList.remove("isError");
  dropZoneHint.textContent = "可以继续拖入或选择另一个本地 SVGA 文件。";
    dropZone.classList.add("hasLoadedMedia");

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
      inspectionReport: report.contractVersion === 1 && Boolean(reportRoot.querySelector('[data-inspection-group="spec"]')),
      auditPanel: Boolean(report.auditPresentation) && Boolean(reportRoot.querySelector('[data-inspection-group="audit"]')),
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
    && Boolean(reportRoot.querySelector('[data-inspection-group="audit"]'));
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
  dropZone.classList.remove("isError", "isLoading");
  dropZone.classList.remove("hasLoadedMedia");
  dropZoneHint.innerHTML = `
    <span class="uploadIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 16.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" /><path d="M12 4v12" /><path d="m8 8 4-4 4 4" /></svg></span>
    <strong>拖拽 SVGA 文件到此处</strong>
    <span>或选择本地文件，打开后会显示预览、概览、规范检查与动效诊断。</span>
    <button class="dropZoneAction" type="button" data-empty-select-button>选择 SVGA 文件</button>
  `;
  dropZoneHint.querySelector("[data-empty-select-button]")?.addEventListener("click", () => fileInput.click());
  reportRoot.innerHTML = renderInspectionEmpty("打开文件后显示检查结果", "这里会显示概览、规范检查和 Motion Asset Audit，只读展示，不会修改文件。");
  updateFileInfo();
  updatePlaybackControls();
}

function setLoadingState(name) {
  dropZone.classList.remove("isError");
  dropZone.classList.add("isLoading");
  dropZone.classList.remove("hasLoadedMedia");
  runtimeStatus.textContent = "正在加载本地 SVGA...";
  playbackStatus.textContent = `加载中：${safeDisplayName(name)}`;
  dropZoneHint.innerHTML = `
    <span class="uploadIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v5" /><path d="M12 16v5" /><path d="M3 12h5" /><path d="M16 12h5" /></svg></span>
    <strong>正在加载 ${escapeHtml(safeDisplayName(name))}</strong>
    <span>正在解析动画、生成检查报告和动效诊断。</span>
  `;
  reportRoot.innerHTML = renderInspectionEmpty("正在生成检查报告", "解析完成后会显示概览、规范检查和动效诊断。");
  updateFileInfo(name);
  updatePlaybackControls();
}

function showError(message, detail = "") {
  dropZone.classList.add("isError");
  dropZone.classList.remove("isLoading");
  dropZone.classList.remove("hasLoadedMedia");
  runtimeStatus.textContent = message;
  playbackStatus.textContent = "未播放";
  dropZoneHint.innerHTML = `
    <span class="uploadIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 8v5" /><path d="M12 17h.01" /><path d="M4.9 19h14.2L12 4.8 4.9 19Z" /></svg></span>
    <strong>请换一个有效的 .svga 文件。</strong>
    <button class="dropZoneAction" type="button" data-error-select-button>重新选择 SVGA 文件</button>
    <details class="errorDetails">
      <summary>查看技术细节</summary>
      <code>${escapeHtml(detail || message)}</code>
    </details>
  `;
  dropZoneHint.querySelector("[data-error-select-button]")?.addEventListener("click", () => fileInput.click());
  reportRoot.innerHTML = renderInspectionEmpty("未生成检查报告", "请重新选择有效的 .svga 文件。技术错误已折叠在播放器区域。");
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

function renderInspectionEmpty(title, description) {
  return `
    <section class="inspectionEmpty" data-inspection-empty>
      <span class="badge badgeNeutral">等待文件</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
    </section>
  `;
}

function renderDesktopInspectionPresentation(report) {
  const model = createInspectionPresentation(report);
  return `
    <section class="inspectionSummary" data-inspection-presentation>
      <article class="inspectionGroup" data-inspection-group="overview">
        <h3>概览 <span class="statusPill">${escapeHtml(model.overview.statusLabel)}</span></h3>
        <div class="metricGrid">
          ${model.overview.metrics.map(renderMetric).join("")}
        </div>
      </article>
      <article class="inspectionGroup" data-inspection-group="spec">
        <h3>规范检查 <span class="statusPill">${escapeHtml(model.spec.statusLabel)}</span></h3>
        <p>${escapeHtml(model.spec.summary)}</p>
        ${renderFindings(model.spec.findings)}
      </article>
      <article class="inspectionGroup" data-inspection-group="audit">
        <h3>动效诊断 <span class="statusPill">${escapeHtml(model.audit.statusLabel)}</span></h3>
        <p>${escapeHtml(model.audit.summary)}</p>
        ${renderFindings(model.audit.findings)}
      </article>
      <details class="calibrationDetails" data-calibration-default-collapsed>
        <summary>产品校准说明</summary>
        <p>${escapeHtml(model.calibration.summary)}</p>
      </details>
      <details class="technicalDetails" data-technical-default-collapsed>
        <summary>技术详情</summary>
        ${renderAvatarFrameInspectionReport(report, "success")}
      </details>
    </section>
  `;
}

function createInspectionPresentation(report) {
  const asset = report?.asset ?? {};
  const spec = report?.specReport ?? report?.spec ?? {};
  const audit = report?.auditPresentation ?? report?.auditSummary ?? {};
  const issues = Array.isArray(spec.issues) ? spec.issues : [];
  const auditFindings = Array.isArray(audit.findingCards)
    ? audit.findingCards
    : Array.isArray(audit.primaryFindings)
      ? audit.primaryFindings
      : [];
  const dimensions = asset.dimensions ?? asset.canvasSize ?? {};
  const timing = asset.timing ?? {};
  const parserStatus = report?.parseStatus ?? asset.parserStatus ?? "parsed";
  const specPassed = spec.passed ?? report?.passed ?? issues.length === 0;
  return {
    overview: {
      statusLabel: specPassed ? "可预览" : "需检查",
      metrics: [
        ["文件", asset.name ?? "当前 SVGA"],
        ["画布", dimensions.width && dimensions.height ? `${dimensions.width} × ${dimensions.height}` : "未知"],
        ["FPS", timing.fps ?? asset.fps ?? "未知"],
        ["时长 / 帧数", formatDurationFrames(timing.durationMs, timing.frameCount ?? asset.frameCount)],
        ["图层", asset.spriteCount ?? asset.layerCount ?? "未知"],
        ["资源", asset.resourceCount ?? "未知"],
        ["Parser", parserStatus]
      ]
    },
    spec: {
      statusLabel: specPassed ? "通过" : "有问题",
      summary: specPassed ? "当前文件通过头像框生产目标的基础检查。" : `发现 ${issues.length} 个规范问题，需要复核。`,
      findings: issues.map((issue) => ({
        title: issue.code ?? issue.severity ?? "spec_issue",
        description: issue.message ?? "规范检查问题",
        severity: issue.severity ?? "warning"
      }))
    },
    audit: {
      statusLabel: userFacingAuditStatus(audit.statusLabel ?? audit.auditStatus),
      summary: userFacingAuditSummary(audit.summaryDescription ?? audit.summaryTitle, specPassed),
      findings: auditFindings.slice(0, 4).map((finding) => ({
        title: userFacingAuditText(finding.title ?? finding.titleKey ?? finding.code, "动效诊断项"),
        description: userFacingAuditText(finding.description ?? finding.descriptionKey, "该项需要按报告证据复核。"),
        severity: finding.severity ?? "advisory"
      }))
    },
    calibration: {
      summary: Array.isArray(report?.calibrationNotes)
        ? report.calibrationNotes.join(" ")
        : "文件体积、资源数量和透明空白阈值仍保留产品校准说明。"
    }
  };
}

function userFacingAuditStatus(value) {
  const text = String(value ?? "");
  if (!text || isRawAuditKey(text)) return "动效诊断通过";
  return text;
}

function userFacingAuditSummary(value, specPassed) {
  const text = String(value ?? "");
  if (!text || isRawAuditKey(text)) {
    return specPassed ? "未发现需要立即处理的问题。" : "发现需要复核的动效诊断项。";
  }
  return text;
}

function userFacingAuditText(value, fallback) {
  const text = String(value ?? "");
  return !text || isRawAuditKey(text) ? fallback : text;
}

function isRawAuditKey(value) {
  return /^(audit|finding|opportunity|severity|category|uncertainty)\.[a-z0-9_.-]+$/i.test(String(value));
}

function renderMetric([label, value]) {
  return `<div class="metricItem"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderFindings(findings) {
  if (!findings.length) return `<ul class="findingsList"><li>未发现需要立即处理的问题。</li></ul>`;
  return `
    <ul class="findingsList">
      ${findings.map((finding) => `
        <li><strong>${escapeHtml(finding.severity)} · ${escapeHtml(finding.title)}</strong><br>${escapeHtml(finding.description)}</li>
      `).join("")}
    </ul>
  `;
}

function formatDurationFrames(durationMs, frameCount) {
  const duration = typeof durationMs === "number" ? `${(durationMs / 1000).toFixed(2)}s` : "未知时长";
  const frames = typeof frameCount === "number" ? `${frameCount} 帧` : "未知帧数";
  return `${duration} / ${frames}`;
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

function captureArtifact(scenario) {
  if (!shouldCaptureArtifacts) return Promise.resolve();
  return window.autoSvgaPrototype?.captureArtifact?.(scenario) ?? Promise.resolve();
}
