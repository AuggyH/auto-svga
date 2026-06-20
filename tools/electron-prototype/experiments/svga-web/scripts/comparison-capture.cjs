const { readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, nativeImage } = require("electron");

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const artifactRoot = readArgument("--artifact-root");
const left = readArgument("--left");
const right = readArgument("--right");
const out = readArgument("--out");
const title = readArgument("--title") ?? "Parity comparison";
const leftLabel = readArgument("--left-label") ?? "Web reference";
const rightLabel = readArgument("--right-label") ?? "Desktop shell";
const headCommit = readArgument("--head-commit") ?? null;
const leftHeadCommit = readArgument("--left-head-commit") ?? headCommit;
const rightHeadCommit = readArgument("--right-head-commit") ?? headCommit;
if (!artifactRoot || !left || !right || !out) {
  console.error("Missing comparison arguments.");
  process.exit(1);
}

function imageData(fileName) {
  const filePath = path.join(artifactRoot, fileName);
  const bytes = readFileSync(filePath);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

function imageSize(fileName) {
  return nativeImage.createFromBuffer(readFileSync(path.join(artifactRoot, fileName))).getSize();
}

async function main() {
  await app.whenReady();
  const leftSize = imageSize(left);
  const rightSize = imageSize(right);
  const columnWidth = 648;
  const gap = 12;
  const paddingX = 14;
  const headerHeight = 48;
  const captionHeight = 36;
  const bottomPadding = 14;
  const leftHeight = Math.round(leftSize.height * (columnWidth / leftSize.width));
  const rightHeight = Math.round(rightSize.height * (columnWidth / rightSize.width));
  const imageHeight = Math.max(leftHeight, rightHeight);
  const outputWidth = paddingX * 2 + columnWidth * 2 + gap;
  const outputHeight = headerHeight + captionHeight + imageHeight + bottomPadding;
  const contentBounds = {
    x: paddingX,
    y: 0,
    width: outputWidth - paddingX * 2,
    height: headerHeight + captionHeight + imageHeight
  };
  const window = new BrowserWindow({
    width: outputWidth,
    height: outputHeight,
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
      header { height: ${headerHeight}px; padding: 14px 18px; font-weight: 700; }
      main { display: grid; grid-template-columns: ${columnWidth}px ${columnWidth}px; gap: ${gap}px; padding: 0 ${paddingX}px ${bottomPadding}px; }
      figure { margin: 0; border: 1px solid #d2d2d7; border-radius: 10px; background: #fff; overflow: hidden; }
      figcaption { height: ${captionHeight}px; padding: 8px 10px; color: #6e6e73; font-size: 12px; }
      img { display: block; width: ${columnWidth}px; height: auto; }
    </style>
    <header>${title}</header>
    <main>
      <figure><figcaption>${leftLabel}</figcaption><img src="${imageData(left)}"></figure>
      <figure><figcaption>${rightLabel}</figcaption><img src="${imageData(right)}"></figure>
    </main>`;
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await new Promise((resolve) => setTimeout(resolve, 400));
  writeFileSync(path.join(artifactRoot, out), (await window.webContents.capturePage()).toPNG());
  writeFileSync(path.join(artifactRoot, `${out}.meta.json`), `${JSON.stringify({
    schemaVersion: 1,
    headCommit,
    outputFile: out,
    outputSize: { width: outputWidth, height: outputHeight },
    contentBounds,
    bottomMarginPx: bottomPadding,
    estimatedBlankRatio: Number(((outputWidth * bottomPadding) / (outputWidth * outputHeight)).toFixed(4)),
    left: { file: left, headCommit: leftHeadCommit, sourceSize: leftSize, renderedSize: { width: columnWidth, height: leftHeight } },
    right: { file: right, headCommit: rightHeadCommit, sourceSize: rightSize, renderedSize: { width: columnWidth, height: rightHeight } }
  }, null, 2)}\n`);
  window.destroy();
  app.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  app.exit(1);
});
