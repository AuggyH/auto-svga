import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import assert from "node:assert/strict";

import {
  launchLocalPreview,
  probeAutoSvgaPreview
} from "./launch-local-preview.mjs";

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

async function close(server) {
  server.close();
  await once(server, "close");
}

async function reserveFreePort() {
  const server = createServer((_request, response) => {
    response.writeHead(204);
    response.end();
  });
  const port = await listen(server);
  await close(server);
  return port;
}

async function launchPreviewOnFreePort(options = {}) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const port = await reserveFreePort();
    try {
      return {
        port,
        result: await launchLocalPreview({
          port,
          openBrowser: false,
          stdio: "ignore",
          ...options
        })
      };
    } catch (error) {
      lastError = error;
      if (!/已被占用/.test(error instanceof Error ? error.message : String(error))) throw error;
    }
  }
  throw lastError ?? new Error("Unable to reserve a free preview port.");
}

function createMockPreviewServer() {
  return createServer((request, response) => {
    if (request.url === "/api/latest-artifact") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        latestWithSvga: null,
        latestAny: null,
        artifacts: [],
        warnings: []
      }));
      return;
    }

    if (request.url === "/tools/svga-player-preview/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<!doctype html><title>auto-svga SVGA</title>");
      return;
    }

    response.writeHead(404);
    response.end("not found");
  });
}

test("launcher detects an existing Auto SVGA preview service", async () => {
  const server = createMockPreviewServer();
  const port = await listen(server);
  try {
    const result = await launchLocalPreview({ port, openBrowser: false });
    assert.equal(result.status, "already-running");
    assert.equal(result.child, undefined);
    assert.equal(result.url, `http://127.0.0.1:${port}/tools/svga-player-preview/`);
  } finally {
    await close(server);
  }
});

test("launcher safely fails when the port is occupied by an unknown service", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    response.end("not auto svga");
  });
  const port = await listen(server);
  try {
    await assert.rejects(
      launchLocalPreview({ port, openBrowser: false }),
      /已被占用/
    );
  } finally {
    await close(server);
  }
});

test("launcher starts the existing preview server when offline and can clean it up", async () => {
  const { port, result } = await launchPreviewOnFreePort();

  try {
    assert.equal(result.status, "started");
    assert.ok(result.child);
    const probe = await probeAutoSvgaPreview({ port });
    assert.equal(probe.status, "auto-svga");
  } finally {
    result.stop?.();
    if (result.child?.exitCode === null) {
      await once(result.child, "exit");
    }
  }
});
