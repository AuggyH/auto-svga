const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, session } = require("electron");

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const url = readArgument("--url");
const artifactRoot = readArgument("--artifact-root");
if (!url || !artifactRoot) {
  console.error("Missing --url or --artifact-root.");
  process.exit(1);
}

async function waitForReady(window, timeoutMs = 18_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const ready = await window.webContents.executeJavaScript(`
      document.readyState === "complete"
        && Boolean(document.body?.innerText)
        && document.body.innerText.length > 200
    `);
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 220));
  }
  throw new Error("Web reference page did not become ready.");
}

async function capture(window, fileName) {
  const png = (await window.webContents.capturePage()).toPNG();
  writeFileSync(path.join(artifactRoot, fileName), png);
}

async function main() {
  mkdirSync(artifactRoot, { recursive: true });
  await app.whenReady();
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const allowed = details.url.startsWith(new URL(url).origin)
      || details.url.startsWith("blob:")
      || details.url.startsWith("data:");
    callback({ cancel: !allowed });
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
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  await window.loadURL(url);
  await waitForReady(window);
  await new Promise((resolve) => setTimeout(resolve, 2200));
  await capture(window, "web-reference-loaded.png");
  await window.webContents.executeJavaScript(`
    (document.querySelector("#infoPanel")
      ?? document.querySelector("#reportRoot")
      ?? document.querySelector(".reportPanel")
      ?? document.body).scrollIntoView({ block: "start" });
    true;
  `);
  await new Promise((resolve) => setTimeout(resolve, 450));
  await capture(window, "web-reference-inspection.png");
  window.destroy();
  app.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  app.exit(1);
});
