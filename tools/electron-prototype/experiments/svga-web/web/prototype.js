import { renderAvatarFrameInspectionReport } from "/tools/svga-player-preview/inspection-report-view.mjs";
import { FILL_MODE, Parser, Player } from "/vendor/svga-web-2.4.4.js";

const canvas = document.querySelector("#player");
const dropZone = document.querySelector("#dropZone");
const fileInput = document.querySelector("#fileInput");
const reportRoot = document.querySelector("#reportRoot");
const playbackStatus = document.querySelector("#playbackStatus");
const runtimeStatus = document.querySelector("#runtimeStatus");
const cspViolations = [];
let activePlayer;
let activeParser;

globalThis.addEventListener("securitypolicyviolation", (event) => {
  cspViolations.push(`${event.violatedDirective}:${event.blockedURI}`);
  console.warn(`CSP violation ${event.violatedDirective} ${event.blockedURI}`);
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  await loadSvgaBytes(new Uint8Array(await file.arrayBuffer()), file.name);
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
  if (!isSvgaFile(file)) {
    runtimeStatus.textContent = "不支持的文件类型";
    return;
  }
  await loadSvgaBytes(new Uint8Array(await file.arrayBuffer()), file.name);
});

run().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  runtimeStatus.textContent = `加载失败：${error.message}`;
  await reportSmoke(emptyResult());
});

async function run() {
  const fixtureUrl = "/fixture/avatar-frame-smoke.svga";
  const bytes = new Uint8Array(await fetch(fixtureUrl).then(assertResponse).then((response) => response.arrayBuffer()));
  const smoke = await loadSvgaBytes(bytes.slice(0), "synthetic-avatar-frame.svga");
  const fileInputSmoke = await smokeFileInput(bytes.slice(0));
  const dragDropSmoke = await smokeDragDrop(bytes.slice(0));
  const errorFileSmoke = await smokeErrorFile();

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
    cleanup: smoke.cleanup
  };
  runtimeStatus.textContent = Object.values(result).every(Boolean) ? "内部原型验证通过" : "验证未通过";
  await reportSmoke(result);
  cleanupPlayer();
}

async function loadSvgaBytes(bytes, name) {
  cleanupPlayer();
  const reportPromise = fetch(`/api/avatar-frame-inspection-report?name=${encodeURIComponent(name)}`, {
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
  playbackStatus.textContent = `正在播放：${safeDisplayName(name)}`;

  const nonblank = await waitForCanvas(canvas, 1500);
  player.pause();
  await delay(80);
  player.resume();
  await delay(250);

  const report = await reportPromise;
  reportRoot.innerHTML = renderAvatarFrameInspectionReport(report, "success");
  return {
    playback: video.frames > 0 && Boolean(canvas.getContext("2d")),
    canvasNonBlank: nonblank,
    inspectionReport: report.contractVersion === 1 && Boolean(reportRoot.querySelector(".specReportSection")),
    auditPanel: Boolean(report.auditPresentation) && Boolean(reportRoot.querySelector(".auditReportSection")),
    playerLifecycle: ["start", "process", "pause", "resume"].every((eventName) => lifecycle.has(eventName)),
    cleanup: typeof player.destroy === "function" && typeof parser.destroy === "function"
  };
}

async function smokeFileInput(bytes) {
  const file = new File([bytes], "file-input-smoke.svga", { type: "application/octet-stream" });
  return isSvgaFile(file) && (await loadSvgaBytes(new Uint8Array(await file.arrayBuffer()), file.name)).inspectionReport;
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
  const file = new File([new Uint8Array([1, 2, 3])], "not-svga.txt", { type: "text/plain" });
  const event = new DragEvent("drop", {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer()
  });
  event.dataTransfer.items.add(file);
  dropZone.dispatchEvent(event);
  await delay(80);
  return runtimeStatus.textContent.includes("不支持的文件类型");
}

function canvasHasVisiblePixels(target) {
  if (!target || target.width <= 0 || target.height <= 0) return false;
  const context = target.getContext("2d");
  if (!context) return false;
  const pixels = context.getImageData(0, 0, target.width, target.height).data;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] > 0 && (pixels[index] > 20 || pixels[index + 1] > 20 || pixels[index + 2] > 20)) {
      return true;
    }
  }
  return false;
}

async function waitForCanvas(target, timeoutMs) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    if (canvasHasVisiblePixels(target)) return true;
    await delay(80);
  }
  return false;
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
  activePlayer?.destroy?.();
  activeParser?.destroy?.();
  activePlayer = undefined;
  activeParser = undefined;
}

function toArrayBuffer(bytes) {
  const copy = bytes.slice(0);
  return copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength);
}

function safeDisplayName(name) {
  return String(name).replace(/[/\\]/g, "").slice(0, 80);
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
