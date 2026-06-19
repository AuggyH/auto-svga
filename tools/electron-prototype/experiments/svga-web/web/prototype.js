import { renderAvatarFrameInspectionReport } from "/tools/svga-player-preview/inspection-report-view.mjs";
import { FILL_MODE, Parser, Player } from "/vendor/svga-web-2.4.4.js";

const canvas = document.querySelector("#player");
const reportRoot = document.querySelector("#reportRoot");
const playbackStatus = document.querySelector("#playbackStatus");
const runtimeStatus = document.querySelector("#runtimeStatus");
const cspViolations = [];

globalThis.addEventListener("securitypolicyviolation", (event) => {
  cspViolations.push(`${event.violatedDirective}:${event.blockedURI}`);
  console.warn(`CSP violation ${event.violatedDirective} ${event.blockedURI}`);
});

run().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  runtimeStatus.textContent = `加载失败：${error.message}`;
  await reportSmoke(emptyResult());
});

async function run() {
  const fixtureUrl = "/fixture/avatar-frame-smoke.svga";
  const bytes = await fetch(fixtureUrl).then(assertResponse).then((response) => response.arrayBuffer());
  const reportPromise = fetch("/api/avatar-frame-inspection-report?name=synthetic-avatar-frame.svga", {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-auto-svga-prototype-token": window.autoSvgaPrototype.reportToken
    },
    body: bytes.slice(0)
  }).then(assertResponse).then((response) => response.json());

  const parser = new Parser();
  const video = await parser.do(bytes.slice(0));
  const player = new Player(canvas);
  const lifecycle = new Set();
  player
    .$on("start", () => lifecycle.add("start"))
    .$on("process", () => lifecycle.add("process"))
    .$on("pause", () => lifecycle.add("pause"))
    .$on("resume", () => lifecycle.add("resume"));
  player.set({ loop: true, fillMode: FILL_MODE.FORWARDS, noExecutionDelay: false });
  await player.mount(video);
  player.start();
  playbackStatus.textContent = "正在播放";

  const nonblank = await waitForCanvas(canvas, 1500);
  player.pause();
  await delay(80);
  player.resume();
  await delay(250);

  const report = await reportPromise;
  reportRoot.innerHTML = renderAvatarFrameInspectionReport(report, "success");
  const result = {
    localPage: location.hostname === "127.0.0.1",
    localOnly: resourcesAreLocal(),
    strictCsp: document.scripts.length === 1,
    noCspViolation: cspViolations.length === 0,
    playback: video.frames > 0 && Boolean(canvas.getContext("2d")),
    canvasNonBlank: nonblank,
    inspectionReport: report.contractVersion === 1 && Boolean(reportRoot.querySelector(".specReportSection")),
    auditPanel: Boolean(report.auditPresentation) && Boolean(reportRoot.querySelector(".auditReportSection")),
    playerLifecycle: ["start", "process", "pause", "resume"].every((name) => lifecycle.has(name)),
    cleanup: typeof player.destroy === "function" && typeof parser.destroy === "function"
  };
  runtimeStatus.textContent = Object.values(result).every(Boolean) ? "严格 CSP 验证通过" : "验证未通过";
  await reportSmoke(result);
  player.destroy();
  parser.destroy();
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
    playerLifecycle: false,
    cleanup: false
  };
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
