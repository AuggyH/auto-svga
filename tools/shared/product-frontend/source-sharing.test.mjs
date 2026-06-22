import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

test("Web preview uses the shared product app and styles as thin entries", async () => {
  const [webScript, webStyles, webHtml, shellHtml, shellLoader] = await Promise.all([
    readRepoFile("tools/svga-player-preview/main.js"),
    readRepoFile("tools/svga-player-preview/styles.css"),
    readRepoFile("tools/svga-player-preview/index.html"),
    readRepoFile("tools/shared/product-frontend/product-shell.html"),
    readRepoFile("tools/shared/product-frontend/product-shell-loader.mjs")
  ]);
  const shellHash = createHash("sha256").update(shellHtml).digest("hex");

  assert.match(webScript, /mountProductShell/);
  assert.match(webScript, /product-shell-loader\.mjs/);
  assert.match(webScript, /product-app\.mjs/);
  assert.equal(webStyles.trim(), '@import url("../shared/product-frontend/product-styles.css");');
  assert.match(webHtml, /id="productShellMount"/);
  assert.match(webHtml, /data-product-shell-src="\.\.\/shared\/product-frontend\/product-shell\.html"/);
  assert.match(webHtml, new RegExp(`data-product-shell-sha256="${shellHash}"`));
  assert.doesNotMatch(webHtml, /<main class="shell"/);
  assert.match(shellHtml, /data-product-shell="canonical"/);
  assert.match(shellHtml, /id="workspace"/);
  assert.match(shellHtml, /id="floatingRoot"/);
  assert.match(shellLoader, /Product shell source hash mismatch/);
  assert.match(webHtml, /src="\.\/main\.js"/);
  assert.match(webHtml, /href="\.\/styles\.css"/);
});

test("shared product app keeps host-specific capabilities behind the Web adapter", async () => {
  const [productApp, webAdapter] = await Promise.all([
    readRepoFile("tools/shared/product-frontend/product-app.mjs"),
    readRepoFile("tools/shared/product-frontend/web-host-adapter.mjs")
  ]);

  assert.match(productApp, /getProductHostAdapter/);
  assert.match(productApp, /const fetch = hostAdapter\.http\.fetch/);
  assert.match(productApp, /const URL = hostAdapter\.urls/);
  assert.match(productApp, /const localStorage = hostAdapter\.storage/);
  assert.match(productApp, /runProductSmoke/);
  assert.match(productApp, /electronBridge\.reportSmokeResult/);
  assert.match(productApp, /if \(isSmokeMode\)/);
  assert.match(productApp, /installStateProbe/);
  assert.match(productApp, /__autoSvgaDesktopStateProbe/);
  assert.match(productApp, /resetSlotMediaState/);
  assert.match(productApp, /setSlotInvalidState/);
  assert.match(webAdapter, /hostKind: "web"/);
  assert.match(webAdapter, /editorIncubationDefaultVisible: false/);
});

test("shared product shell keeps loading distinct and editor incubation hidden by default", async () => {
  const [shellHtml, productApp, productStyles] = await Promise.all([
    readRepoFile("tools/shared/product-frontend/product-shell.html"),
    readRepoFile("tools/shared/product-frontend/product-app.mjs"),
    readRepoFile("tools/shared/product-frontend/product-styles.css")
  ]);

  assert.match(shellHtml, /class="loadingPhaseList"/);
  for (const phase of ["file", "read", "parse", "check"]) {
    assert.match(shellHtml, new RegExp(`data-loading-phase="${phase}"`));
  }
  assert.match(productApp, /applyPrimaryLoadingCopy/);
  assert.match(productApp, /正在加载 SVGA 文件/);
  assert.match(productApp, /staleCanvasCleared/);
  assert.match(productApp, /staleFileBadgeCleared/);
  assert.match(productApp, /staleReportCleared/);
  assert.match(productStyles, /\.previewCard\.isLoading \.loadingPhaseList/);
  assert.doesNotMatch(shellHtml, /batchPngInput|loadBatchPngFiles|svga-image-edit-session/);
});

test("Electron default renderer uses shared product source and hides editor incubation", async () => {
  const [electronHtml, electronStyles, electronEntry, prototypeSource] = await Promise.all([
    readRepoFile("tools/electron-prototype/experiments/svga-web/web/index.html"),
    readRepoFile("tools/electron-prototype/experiments/svga-web/web/styles.css"),
    readRepoFile("tools/electron-prototype/experiments/svga-web/web/desktop-product-entry.mjs"),
    readRepoFile("tools/electron-prototype/experiments/svga-web/web/prototype.js")
  ]);

  assert.match(electronHtml, /class="shell"/);
  assert.match(electronHtml, /src="\/desktop-product-entry\.mjs"/);
  assert.doesNotMatch(electronHtml, /prototype\.js/);
  assert.equal(electronStyles.trim(), '@import url("/tools/shared/product-frontend/product-styles.css");');
  assert.match(electronEntry, /autoSvgaHostAdapter/);
  assert.match(electronEntry, /\/tools\/shared\/product-frontend\/product-app\.mjs/);
  assert.match(electronEntry, /installSvgaWebCompatibility/);
  assert.match(prototypeSource, /loadBatchPngFiles/);
});
