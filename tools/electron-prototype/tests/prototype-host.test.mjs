import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { startPrototypeServer } from "../server.mjs";

const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("prototype uses pinned local player assets without CDN references", async () => {
  const html = await readFile(path.join(prototypeRoot, "web/index.html"), "utf8");
  assert.doesNotMatch(html, /https?:\/\//);
  assert.match(html, /pako-2\.1\.0\.min\.js/);
  assert.match(html, /svgaplayerweb-2\.3\.1\.min\.js/);
  assert.equal(await fileHash("pako-2.1.0.min.js"), "ede2693a4a6a5126b9d35669062b358ecab6ae7b9b86a1cf302feb45a8514907");
  assert.equal(await fileHash("svgaplayerweb-2.3.1.min.js"), "3e8cb9a59e17a9b0861298eacc4beba79895ebd7178d97669687af07212509b6");
});

test("prototype server exposes only approved local assets and authenticated inspection", async () => {
  const reportToken = "synthetic-test-token";
  const server = await startPrototypeServer({ appRoot: prototypeRoot, reportToken });
  try {
    assert.equal((await fetch(`${server.origin}/health`)).status, 200);
    assert.equal((await fetch(`${server.origin}/../../package.json`)).status, 404);
    const fixtureResponse = await fetch(`${server.origin}/fixture/avatar-frame-smoke.svga`);
    const fixture = await fixtureResponse.arrayBuffer();
    assert.ok(fixture.byteLength > 0);
    assert.equal((await fetch(`${server.origin}/api/avatar-frame-inspection-report`, {
      method: "POST",
      body: fixture
    })).status, 401);
    const reportResponse = await fetch(`${server.origin}/api/avatar-frame-inspection-report?name=fixture.svga`, {
      method: "POST",
      headers: { "x-auto-svga-prototype-token": reportToken },
      body: fixture
    });
    assert.equal(reportResponse.status, 200);
    const report = await reportResponse.json();
    assert.equal(report.contractVersion, 1);
    assert.equal(report.asset.name, "fixture.svga");
    assert.ok(report.auditPresentation);
    assert.doesNotMatch(JSON.stringify(report), /\/Users\//);
  } finally {
    await server.close();
  }
});

test("Electron window and preload keep the required security boundary", async () => {
  const main = await readFile(path.join(prototypeRoot, "main.cjs"), "utf8");
  const preload = await readFile(path.join(prototypeRoot, "preload.cjs"), "utf8");
  const server = await readFile(path.join(prototypeRoot, "server.mjs"), "utf8");
  for (const expected of [
    "contextIsolation: true",
    "nodeIntegration: false",
    "sandbox: true",
    "webSecurity: true",
    "allowRunningInsecureContent: false",
    "setPermissionRequestHandler",
    "setWindowOpenHandler",
    "will-navigate"
  ]) assert.match(main, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(preload, /contextBridge\.exposeInMainWorld/);
  assert.doesNotMatch(preload, /require\(["']node:fs/);
  assert.doesNotMatch(preload, /shell\.|ipcRenderer\.send/);
  assert.match(server, /script-src 'self' 'unsafe-eval'/);
  assert.match(server, /object-src 'none'/);
  assert.doesNotMatch(server, /https:\/\//);
});

async function fileHash(name) {
  const bytes = await readFile(path.join(prototypeRoot, "vendor", name));
  return createHash("sha256").update(bytes).digest("hex");
}
