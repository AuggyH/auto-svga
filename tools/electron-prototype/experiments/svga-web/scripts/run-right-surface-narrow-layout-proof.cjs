"use strict";

const { app, BrowserWindow } = require("electron");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const experimentRoot = path.resolve(__dirname, "..");
const webRoot = path.join(experimentRoot, "web");
const cssFiles = [
  "short-term-macos.tokens.css",
  "short-term-macos.atoms.css",
  "short-term-macos.molecules.css",
  "short-term-macos.components.css",
  "short-term-macos.modules.css",
  "short-term-macos.page-states.css",
  "short-term-macos.css"
];

function proofDocument() {
  const styles = cssFiles
    .map((file) => `<style data-source="${file}">${readFileSync(path.join(webRoot, file), "utf8")}</style>`)
    .join("\n");
  return readFileSync(path.join(webRoot, "index.html"), "utf8")
    .replace(/<link rel="stylesheet"[^>]*>/gu, "")
    .replace(/<script[\s\S]*?<\/script>/gu, "")
    .replace("</head>", `${styles}</head>`);
}

async function run() {
  await app.whenReady();
  const window = new BrowserWindow({
    show: false,
    width: 960,
    height: 640,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  });
  const html = Buffer.from(proofDocument(), "utf8").toString("base64");
  await window.loadURL(`data:text/html;base64,${html}`);
  const proof = await window.webContents.executeJavaScript(`(async () => {
    const appNode = document.querySelector(".macApp");
    const preview = document.querySelector('[data-view="preview"]');
    document.querySelectorAll(".view").forEach((view) => { view.hidden = true; });
    appNode.dataset.appState = "preview";
    preview.hidden = false;

    const makeRows = (count, className, prefix) => Array.from({ length: count }, (_, index) => {
      const row = document.createElement("article");
      row.className = className;
      const copy = '<span class="rowText"><strong>' + prefix + ' ' + (index + 1) + '</strong>'
        + '<span>1280 × 720 · 经过边界约束的较长信息文本</span></span>';
      const thumb = '<span class="thumb" data-component="ThumbnailFrame" data-variant="image"></span>';
      if (className === "replaceableRow") {
        row.innerHTML = '<span class="replaceableIdentity">' + thumb + copy + '</span>'
          + '<button type="button" class="rowMenuButton" aria-label="操作">•••</button>';
      } else if (className === "textElementRow") {
        row.innerHTML = '<span class="replaceableIdentity">'
          + '<span class="thumb" data-component="ThumbnailFrame" data-variant="text"><span class="thumbnailTextIcon"></span></span>'
          + copy + '</span><span class="runtimeTextActions"><input class="runtimeTextInput" value="预览文本">'
          + '<button type="button" class="runtimeTextResetButton" aria-label="重置">↻</button></span>';
      } else if (className === "assetRow") {
        row.innerHTML = thumb + copy + '<button type="button" class="rowMenuButton" aria-label="操作">•••</button>';
      } else {
        row.innerHTML = copy;
      }
      return row;
    });
    document.querySelector("#factGrid").replaceChildren(...makeRows(8, "factCell", "格式信息"));
    document.querySelector("#replaceableList").replaceChildren(...makeRows(10, "replaceableRow", "可替换图片"));
    document.querySelector("#textElementList").replaceChildren(...makeRows(8, "textElementRow", "运行时文本"));
    document.querySelector("#assetList").replaceChildren(...makeRows(22, "assetRow", "资源项目"));
    const panel = document.querySelector("#panelOverview");
    const sentinel = document.createElement("span");
    sentinel.dataset.narrowProofBottom = "true";
    sentinel.style.display = "block";
    sentinel.style.width = "1px";
    sentinel.style.height = "1px";
    panel.append(sentinel);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const style = getComputedStyle(panel);
    const initialScrollTop = panel.scrollTop;
    const maxScrollTop = Math.max(0, panel.scrollHeight - panel.clientHeight);
    panel.scrollTop = maxScrollTop;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const reachedScrollTop = panel.scrollTop;
    const panelRect = panel.getBoundingClientRect();
    const sentinelRect = sentinel.getBoundingClientRect();
    const result = {
      viewport: { width: innerWidth, height: innerHeight, deviceScaleFactor: devicePixelRatio },
      panel: {
        clientWidth: panel.clientWidth,
        scrollWidth: panel.scrollWidth,
        clientHeight: panel.clientHeight,
        scrollHeight: panel.scrollHeight,
        maxScrollTop,
        reachedScrollTop,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        bottomGap: Math.max(0, sentinelRect.bottom - panelRect.bottom)
      }
    };
    panel.scrollTop = initialScrollTop;
    result.passed = result.panel.scrollWidth <= result.panel.clientWidth + 1
      && result.panel.scrollHeight > result.panel.clientHeight
      && result.panel.maxScrollTop > 0
      && Math.abs(result.panel.reachedScrollTop - result.panel.maxScrollTop) <= 1
      && result.panel.bottomGap <= 1
      && result.panel.overflowX === "hidden"
      && (result.panel.overflowY === "auto" || result.panel.overflowY === "scroll");
    return result;
  })()`);
  console.log(`AUTO_SVGA_RIGHT_SURFACE_NARROW_PROOF ${JSON.stringify(proof)}`);
  window.destroy();
  await app.quit();
  process.exitCode = proof.passed ? 0 : 1;
}

run().catch(async (error) => {
  console.error(`AUTO_SVGA_RIGHT_SURFACE_NARROW_PROOF_ERROR ${error?.message || "unknown"}`);
  await app.quit().catch(() => {});
  process.exitCode = 1;
});
