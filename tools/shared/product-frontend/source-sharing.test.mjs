import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

test("Web preview uses the shared product app and styles as thin entries", async () => {
  const [webScript, webStyles, webHtml] = await Promise.all([
    readRepoFile("tools/svga-player-preview/main.js"),
    readRepoFile("tools/svga-player-preview/styles.css"),
    readRepoFile("tools/svga-player-preview/index.html")
  ]);

  assert.equal(webScript.trim(), 'import "../shared/product-frontend/product-app.mjs";');
  assert.equal(webStyles.trim(), '@import url("../shared/product-frontend/product-styles.css");');
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
  assert.match(webAdapter, /hostKind: "web"/);
  assert.match(webAdapter, /editorIncubationDefaultVisible: false/);
});

test("future Electron work must not default to the legacy editor incubation surface", async () => {
  const prototypeHtml = await readRepoFile("tools/electron-prototype/web/index.html");

  assert.match(prototypeHtml, /Legacy Electron Spike/);
  assert.doesNotMatch(prototypeHtml, /product-app\.mjs/);
});
