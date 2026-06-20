const { readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const artifactRoot = readArgument("--artifact-root");
const left = readArgument("--left");
const right = readArgument("--right");
const out = readArgument("--out");
const title = readArgument("--title") ?? "Parity comparison";
if (!artifactRoot || !left || !right || !out) {
  console.error("Missing comparison arguments.");
  process.exit(1);
}

function imageData(fileName) {
  const filePath = path.join(artifactRoot, fileName);
  readFileSync(filePath);
  return pathToFileURL(filePath).href;
}

async function main() {
  await app.whenReady();
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
  const html = `<!doctype html>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
      body { margin: 0; background: #f5f5f7; color: #1d1d1f; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      header { padding: 14px 18px; font-weight: 700; }
      main { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 0 14px 14px; }
      figure { margin: 0; border: 1px solid #d2d2d7; border-radius: 10px; background: #fff; overflow: hidden; }
      figcaption { padding: 8px 10px; color: #6e6e73; font-size: 12px; }
      img { display: block; width: 100%; }
    </style>
    <header>${title}</header>
    <main>
      <figure><figcaption>Web reference</figcaption><img src="${imageData(left)}"></figure>
      <figure><figcaption>Desktop shell</figcaption><img src="${imageData(right)}"></figure>
    </main>`;
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await new Promise((resolve) => setTimeout(resolve, 400));
  writeFileSync(path.join(artifactRoot, out), (await window.webContents.capturePage()).toPNG());
  window.destroy();
  app.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  app.exit(1);
});
