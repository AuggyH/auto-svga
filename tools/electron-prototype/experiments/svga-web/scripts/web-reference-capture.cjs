const { copyFileSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, session } = require("electron");

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const url = readArgument("--url");
const artifactRoot = readArgument("--artifact-root");
const fixture = readArgument("--fixture");
if (!url || !artifactRoot || !fixture) {
  console.error("Missing --url, --artifact-root, or --fixture.");
  process.exit(1);
}

async function waitForReady(window, timeoutMs = 18_000) {
  const startedAt = Date.now();
  let lastState = {};
  while (Date.now() - startedAt < timeoutMs) {
    const state = await window.webContents.executeJavaScript(`
      ({
        readyState: document.readyState,
        href: location.href,
        title: document.title,
        bodyLength: document.body?.innerText?.length ?? 0,
        hasFileInput: Boolean(document.querySelector("#svgaFileInput")),
        bodyStart: (document.body?.innerText ?? "").slice(0, 120)
      })
    `);
    lastState = state;
    const ready = state.readyState === "complete" && state.hasFileInput;
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 220));
  }
  throw new Error(`Web reference page did not become ready: ${JSON.stringify(lastState)}`);
}

async function capture(window, fileName) {
  const png = (await window.webContents.capturePage()).toPNG();
  writeFileSync(path.join(artifactRoot, fileName), png);
}

async function main() {
  mkdirSync(artifactRoot, { recursive: true });
  const requestAudit = {
    mode: "browser-workflow-reference",
    localOrigin: new URL(url).origin,
    blockedRequests: [],
    externalRequests: []
  };
  const consoleMessages = [];
  await app.whenReady();
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const isLocal = details.url.startsWith(new URL(url).origin)
      || details.url.startsWith("blob:")
      || details.url.startsWith("data:");
    const isWebBaselinePlayerAsset = details.url.startsWith("https://cdn.jsdelivr.net/npm/pako@")
      || details.url.startsWith("https://cdn.jsdelivr.net/npm/svgaplayerweb@");
    if (!isLocal) requestAudit.externalRequests.push(details.url);
    if (!isLocal && !isWebBaselinePlayerAsset) {
      requestAudit.blockedRequests.push(details.url);
      callback({ cancel: true });
      return;
    }
    callback({ cancel: false });
  });
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  window.webContents.on("console-message", (_event, level, message) => {
    consoleMessages.push({ level, message });
    if (level >= 2) console.error(`WEB_REFERENCE_CONSOLE ${message}`);
  });
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl) => {
    console.error(`WEB_REFERENCE_LOAD_FAILED ${errorCode} ${errorDescription} ${validatedUrl}`);
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  await window.loadURL(url);
  await waitForReady(window);
  await new Promise((resolve) => setTimeout(resolve, 500));
  await capture(window, "web-reference-empty.png");
  copyFileSync(fixture, path.join(artifactRoot, "web-reference-fixture.svga"));
  const fixtureBase64 = readFileSync(fixture).toString("base64");
  const webProof = await window.webContents.executeJavaScript(`
    (async () => {
      const bytes = Uint8Array.from(atob(${JSON.stringify(fixtureBase64)}), (char) => char.charCodeAt(0));
      const file = new File([bytes], "web-reference-fixture.svga", { type: "application/octet-stream" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const input = document.querySelector("#svgaFileInput");
      Object.defineProperty(input, "files", { value: transfer.files, configurable: true });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      const startedAt = performance.now();
      while (performance.now() - startedAt < 9000) {
        const loaded = document.querySelector("#svgaStatusA")?.textContent?.includes("已加载")
          || document.querySelector("#svgaStatusA")?.textContent?.includes("播放")
          || document.querySelector("#svgaPanelA")?.classList?.contains("hasMedia");
        const inspected = document.querySelector(".specReportSection") || document.querySelector(".auditReportSection");
        if (loaded && inspected) return true;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      return {
        loaded: false,
        statusText: document.querySelector("#svgaStatusA")?.textContent ?? "",
        errorText: document.querySelector("#errorBanner")?.textContent ?? document.body.innerText,
        inspected: Boolean(document.querySelector(".specReportSection") || document.querySelector(".auditReportSection")),
        hasMedia: Boolean(document.querySelector("#svgaPanelA")?.classList?.contains("hasMedia"))
      };
    })()
  `);
  const normalizedProof = webProof === true
    ? { loaded: true, statusText: "loaded", errorText: "", inspected: true, hasMedia: true }
    : webProof;
  if (!normalizedProof.loaded) console.error("WEB_REFERENCE_PLAYBACK_NOT_CONFIRMED");
  await new Promise((resolve) => setTimeout(resolve, 900));
  await capture(window, "web-reference-loaded.png");
  await window.webContents.executeJavaScript(`
    document.querySelector("#infoPanelButton")?.click();
    (document.querySelector("#infoPanel")
      ?? document.querySelector("#reportRoot")
      ?? document.querySelector(".reportPanel")
      ?? document.body).scrollIntoView({ block: "start" });
    true;
  `);
  await new Promise((resolve) => setTimeout(resolve, 450));
  await capture(window, "web-reference-inspection.png");
  await window.webContents.executeJavaScript(`
    (async () => {
      const file = new File([new Uint8Array([1, 2, 3])], "broken.svga", { type: "application/octet-stream" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const input = document.querySelector("#svgaFileInput");
      Object.defineProperty(input, "files", { value: transfer.files, configurable: true });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 900));
      return true;
    })()
  `);
  await capture(window, "web-reference-invalid.png");
  const svgaLoadErrors = consoleMessages.filter((entry) => (
    entry.level >= 3
    && /incorrect header check|SVGA 文件加载失败|Unable to load SVGA/i.test(entry.message)
  ));
  const playbackConfirmed = normalizedProof.loaded === true && svgaLoadErrors.length === 0;
  writeFileSync(
    path.join(artifactRoot, "web-reference-runtime-proof.json"),
    `${JSON.stringify({
      fixture: "web-reference-fixture.svga",
      playbackConfirmed,
      inspectionReportConfirmed: normalizedProof.inspected === true,
      statusText: normalizedProof.statusText,
      errorText: normalizedProof.errorText,
      svgaLoadErrors,
      consoleErrors: consoleMessages.filter((entry) => entry.level >= 2),
      knownBaselineRisk: normalizedProof.loaded === true
        ? playbackConfirmed ? null : "Current Web browser baseline reported SVGA load errors for the generated fixture."
        : "Current Web browser baseline did not confirm playback for the generated SVGA fixture.",
      generatedAt: new Date().toISOString()
    }, null, 2)}\n`
  );
  writeFileSync(
    path.join(artifactRoot, "web-reference-request-audit.json"),
    `${JSON.stringify(requestAudit, null, 2)}\n`
  );
  window.destroy();
  app.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  app.exit(1);
});
