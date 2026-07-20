import { renderAvatarFrameInspectionReport } from "/tools/svga-player-preview/inspection-report-view.mjs";

const playerRoot = document.querySelector("#player");
const reportRoot = document.querySelector("#reportRoot");
const playbackStatus = document.querySelector("#playbackStatus");
const runtimeStatus = document.querySelector("#runtimeStatus");

run().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  runtimeStatus.textContent = `加载失败：${error.message}`;
  await reportSmoke({
    localPage: true,
    playback: false,
    canvasNonBlank: false,
    inspectionReport: false,
    auditPanel: false,
    localOnly: resourcesAreLocal()
  });
});

async function run() {
  if (!window.SVGA?.Parser || !window.SVGA?.Player) throw new Error("Local SVGA player unavailable");
  const fixtureUrl = "/fixture/avatar-frame-smoke.svga";
  const bytes = await fetch(fixtureUrl).then(assertResponse).then((response) => response.arrayBuffer());
  const reportPromise = fetch(`/api/avatar-frame-inspection-report?name=synthetic-avatar-frame.svga`, {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-auto-svga-prototype-token": window.autoSvgaPrototype.reportToken
    },
    body: bytes
  }).then(assertResponse).then((response) => response.json());

  const loadedItem = await parseSvga(fixtureUrl);
  const player = new window.SVGA.Player("#player");
  player.loops = 0;
  player.clearsAfterStop = false;
  player.setContentMode("AspectFit");
  player.setVideoItem(loadedItem);
  player.startAnimation();
  playbackStatus.textContent = "正在播放";

  const report = await reportPromise;
  reportRoot.innerHTML = renderAvatarFrameInspectionReport(report, "success");
  await delay(700);
  const result = {
    localPage: location.hostname === "127.0.0.1",
    playback: Boolean(playerRoot.querySelector("canvas")),
    canvasNonBlank: canvasHasVisiblePixels(playerRoot.querySelector("canvas")),
    inspectionReport: report.contractVersion === 1 && Boolean(reportRoot.querySelector(".specReportSection")),
    auditPanel: Boolean(report.auditPresentation) && Boolean(reportRoot.querySelector(".auditReportSection")),
    localOnly: resourcesAreLocal()
  };
  runtimeStatus.textContent = Object.values(result).every(Boolean) ? "离线验证通过" : "验证未通过";
  await reportSmoke(result);
}

function parseSvga(url) {
  const parser = new window.SVGA.Parser("#player");
  return new Promise((resolve, reject) => parser.load(url, resolve, reject));
}

function canvasHasVisiblePixels(canvas) {
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return false;
  const context = canvas.getContext("2d");
  if (!context) return false;
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] > 0 && (pixels[index] > 20 || pixels[index + 1] > 20 || pixels[index + 2] > 20)) {
      return true;
    }
  }
  return false;
}

function resourcesAreLocal() {
  return performance.getEntriesByType("resource")
    .every((entry) => new URL(entry.name).origin === location.origin);
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
