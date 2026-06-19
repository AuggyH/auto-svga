import { renderAvatarFrameInspectionReport } from "/tools/svga-player-preview/inspection-report-view.mjs";
import { FILL_MODE, Parser, Player } from "/vendor/svga-web-2.4.4.js";

const playerMode = new URLSearchParams(location.search).get("player");
const svgaWebCanvas = document.querySelector("#svgaWebCanvas");
const legacyPlayerRoot = document.querySelector("#legacyPlayer");
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

runAudit().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  runtimeStatus.textContent = "验证失败";
  await reportAudit({
    player: playerMode,
    samples: [],
    cspViolations
  });
});

async function runAudit() {
  if (!["svga-web", "svgaplayerweb"].includes(playerMode)) throw new Error("Unsupported audit player");
  const manifest = await fetch("/audit-samples/manifest.json").then(assertResponse).then((response) => response.json());
  const samples = [];
  for (const sample of manifest.samples ?? []) {
    samples.push(await auditSample(sample));
  }
  runtimeStatus.textContent = samples.every((sample) => sample.severity === "none") ? "真实样本验证通过" : "存在差异或失败";
  await reportAudit({ player: playerMode, samples, cspViolations });
  cleanupPlayer();
}

async function auditSample(sample) {
  cleanupPlayer();
  playbackStatus.textContent = `验证：${sample.displayName}`;
  reportRoot.innerHTML = "";
  try {
    const url = `/audit-samples/${encodeURIComponent(sample.fileName)}`;
    const bytes = new Uint8Array(await fetch(url).then(assertResponse).then((response) => response.arrayBuffer()));
    const report = await inspectBytes(bytes, sample.displayName);
    const playback = playerMode === "svga-web"
      ? await playWithSvgaWeb(bytes, sample.displayName)
      : await playWithLegacy(url);
    reportRoot.innerHTML = renderAvatarFrameInspectionReport(report, "success");
    const result = {
      sampleId: sample.sampleId,
      displayName: safeDisplayName(sample.displayName),
      category: sample.category ?? "unknown",
      loadSuccess: true,
      firstFrameNormal: playback.canvasNonBlank,
      playbackStarted: playback.playbackStarted,
      loopNormal: playback.loopNormal,
      canvasNonBlank: playback.canvasNonBlank,
      inspectionReport: report.contractVersion === 1 && Boolean(reportRoot.querySelector(".specReportSection")),
      auditPanel: Boolean(report.auditPresentation) && Boolean(reportRoot.querySelector(".auditReportSection")),
      localOnly: resourcesAreLocal(),
      severity: "none",
      errors: []
    };
    result.severity = classifySeverity(result);
    return result;
  } catch (error) {
    return {
      sampleId: sample.sampleId,
      displayName: safeDisplayName(sample.displayName),
      category: sample.category ?? "unknown",
      loadSuccess: false,
      firstFrameNormal: false,
      playbackStarted: false,
      loopNormal: false,
      canvasNonBlank: false,
      inspectionReport: false,
      auditPanel: false,
      localOnly: resourcesAreLocal(),
      severity: "major",
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}

async function inspectBytes(bytes, name) {
  return fetch(`/api/avatar-frame-inspection-report?name=${encodeURIComponent(name)}`, {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-auto-svga-prototype-token": window.autoSvgaPrototype.reportToken
    },
    body: bytes.slice(0).buffer
  }).then(assertResponse).then((response) => response.json());
}

async function playWithSvgaWeb(bytes) {
  svgaWebCanvas.hidden = false;
  legacyPlayerRoot.hidden = true;
  const parser = new Parser();
  activeParser = parser;
  const video = await parser.do(toArrayBuffer(bytes));
  const player = new Player(svgaWebCanvas);
  activePlayer = player;
  const lifecycle = new Set();
  player
    .$on("start", () => lifecycle.add("start"))
    .$on("process", () => lifecycle.add("process"));
  player.set({ loop: true, fillMode: FILL_MODE.FORWARDS, noExecutionDelay: false });
  await player.mount(video);
  player.start();
  const canvasNonBlank = await waitForCanvas(svgaWebCanvas, 1600);
  await delay(400);
  return {
    playbackStarted: video.frames > 0 && lifecycle.has("start"),
    loopNormal: video.frames > 0,
    canvasNonBlank
  };
}

async function playWithLegacy(url) {
  svgaWebCanvas.hidden = true;
  legacyPlayerRoot.hidden = false;
  legacyPlayerRoot.innerHTML = "";
  if (!window.SVGA?.Parser || !window.SVGA?.Player) throw new Error("Legacy SVGA player unavailable");
  const parser = new window.SVGA.Parser("#legacyPlayer");
  activeParser = parser;
  const loadedItem = await new Promise((resolve, reject) => parser.load(url, resolve, reject));
  const player = new window.SVGA.Player("#legacyPlayer");
  activePlayer = player;
  player.loops = 0;
  player.clearsAfterStop = false;
  player.setContentMode("AspectFit");
  player.setVideoItem(loadedItem);
  player.startAnimation();
  const canvas = await waitForLegacyCanvas();
  const canvasNonBlank = await waitForCanvas(canvas, 1600);
  await delay(400);
  return {
    playbackStarted: Boolean(canvas),
    loopNormal: Boolean(loadedItem?.frames && loadedItem.frames > 0),
    canvasNonBlank
  };
}

async function waitForLegacyCanvas() {
  const startedAt = performance.now();
  while (performance.now() - startedAt < 1600) {
    const canvas = legacyPlayerRoot.querySelector("canvas");
    if (canvas) return canvas;
    await delay(80);
  }
  return undefined;
}

function classifySeverity(result) {
  if (!result.loadSuccess || !result.playbackStarted || !result.canvasNonBlank) return "major";
  if (!result.inspectionReport || !result.auditPanel || !result.localOnly) return "minor";
  return "none";
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

function cleanupPlayer() {
  activePlayer?.destroy?.();
  activeParser?.destroy?.();
  legacyPlayerRoot.innerHTML = "";
  activePlayer = undefined;
  activeParser = undefined;
}

function toArrayBuffer(bytes) {
  const copy = bytes.slice(0);
  return copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength);
}

function assertResponse(response) {
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response;
}

function delay(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function safeDisplayName(name) {
  return String(name).replace(/[/\\]/g, "").slice(0, 80);
}

function reportAudit(result) {
  return window.autoSvgaPrototype?.reportAuditResult(result) ?? Promise.resolve();
}
