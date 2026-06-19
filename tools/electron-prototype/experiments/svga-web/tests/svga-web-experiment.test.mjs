import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { strictCsp, startSvgaWebExperimentServer } from "../server.mjs";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendorPath = path.join(experimentRoot, "vendor/svga-web-2.4.4.js");

test("vendored svga-web asset is pinned and strict-CSP compatible", async () => {
  const source = await readFile(vendorPath, "utf8");
  assert.equal(createHash("sha256").update(source).digest("hex"), "6235bc9802e76dd517343123ec730d25e02c4d476b66b81ef26befe7881f3c50");
  assert.equal(source.includes("eval("), false);
  assert.equal(source.includes("Function("), false);
  assert.match(await readFile(path.join(experimentRoot, "vendor/NOTICE.md"), "utf8"), /MIT/);
});

test("server uses strict CSP and keeps report API token-bound", async () => {
  assert.match(strictCsp, /script-src 'self'/);
  assert.doesNotMatch(strictCsp, /unsafe-eval/);
  assert.match(strictCsp, /worker-src 'self' blob:/);
  const reportToken = "test-token";
  const server = await startSvgaWebExperimentServer({ appRoot: experimentRoot, reportToken });
  try {
    const health = await fetch(`${server.origin}/health`).then((response) => response.json());
    assert.deepEqual(health, { status: "ok", runtime: "svga-web-strict-csp-spike" });
    const unauthorized = await fetch(`${server.origin}/api/avatar-frame-inspection-report`, { method: "POST" });
    assert.equal(unauthorized.status, 401);
    const page = await fetch(`${server.origin}/`).then((response) => response.text());
    assert.match(page, /svga-web Strict CSP Spike/);
    assert.doesNotMatch(page, /cdn\.jsdelivr|unsafe-eval/);
  } finally {
    await server.close();
  }
});

test("main process keeps sandboxed Electron security settings", async () => {
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const preload = await readFile(path.join(experimentRoot, "preload.cjs"), "utf8");
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/);
  assert.match(main, /will-navigate/);
  assert.match(main, /webRequest\.onBeforeRequest/);
  assert.match(preload, /reportSmokeResult/);
  assert.doesNotMatch(preload, /require\("node:fs"\)|require\("fs"\)/);
});
