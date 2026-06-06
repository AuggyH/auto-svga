import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "127.0.0.1";

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".gif", "image/gif"],
  [".mp4", "video/mp4"],
  [".webm", "video/webm"],
  [".png", "image/png"],
  [".svga", "application/octet-stream"]
]);

function sendText(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
  response.end(body);
}

function sendJson(response, data, statusCode = 200) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*"
  });
  response.end(JSON.stringify(data));
}

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl, `http://localhost:${port}`);
  const pathname = decodeURIComponent(url.pathname);
  const normalizedPathname = pathname === "/"
    ? "/tools/svga-player-preview/index.html"
    : pathname.endsWith("/")
      ? `${pathname}index.html`
      : pathname;
  const requestedPath = path.resolve(repoRoot, `.${normalizedPathname}`);
  if (!requestedPath.startsWith(`${repoRoot}${path.sep}`) && requestedPath !== repoRoot) {
    return undefined;
  }
  return requestedPath;
}

// ── API: scan for latest export artifacts ──
async function scanOutputDirs(baseDir) {
  const candidates = [];
  const scanDirs = ["jobs", "examples"];
  for (const dir of scanDirs) {
    const dirPath = path.join(baseDir, dir);
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const outputPath = path.join(dirPath, entry.name, "output");
        try {
          const outputStat = await stat(outputPath);
          if (!outputStat.isDirectory()) continue;
          const files = await readdir(outputPath);
          const artifact = {
            jobId: entry.name,
            outputDir: path.join(dir, entry.name, "output"),
            updatedAt: outputStat.mtime.toISOString(),
            svgaPath: undefined,
            gifPath: undefined,
            mp4Path: undefined,
            webmPath: undefined,
            reportPath: undefined,
            warnings: []
          };
          for (const f of files) {
            if (f.endsWith(".svga")) artifact.svgaPath = path.join(dir, entry.name, "output", f);
            else if (f.endsWith(".gif")) artifact.gifPath = path.join(dir, entry.name, "output", f);
            else if (f.endsWith(".mp4")) artifact.mp4Path = path.join(dir, entry.name, "output", f);
            else if (f.endsWith(".webm")) artifact.webmPath = path.join(dir, entry.name, "output", f);
            else if (f === "report.json") artifact.reportPath = path.join(dir, entry.name, "output", f);
          }
          if (artifact.svgaPath || artifact.gifPath) {
            candidates.push(artifact);
          }
        } catch { /* skip inaccessible dirs */ }
      }
    } catch { /* skip missing scan dirs */ }
  }
  // Compute updatedAt from latest file mtime in group
  for (const c of candidates) {
    const files = [c.svgaPath, c.gifPath, c.mp4Path, c.webmPath, c.reportPath].filter(Boolean);
    let latestMs = 0;
    for (const f of files) {
      try { const s = await stat(path.join(baseDir, f)); if (s.mtimeMs > latestMs) latestMs = s.mtimeMs; } catch {}
    }
    if (latestMs > 0) c.updatedAt = new Date(latestMs).toISOString();
  }
  // Sort: SVGA-containing first, then by mtime
  candidates.sort((a, b) => {
    if (!!a.svgaPath !== !!b.svgaPath) return a.svgaPath ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  const latestWithSvga = candidates.find(c => !!c.svgaPath) ?? null;
  const latestAny = candidates[0] ?? null;
  if (latestAny && !latestAny.svgaPath) latestAny.warnings.push("No SVGA in latest group");
  return { artifacts: candidates, latestWithSvga, latestAny };
}

const server = createServer(async (request, response) => {
  // ── API routes ──
  if (request.url === "/api/latest-artifact" && request.method === "GET") {
    try {
      const data = await scanOutputDirs(repoRoot);
      sendJson(response, data);
    } catch (err) {
      sendJson(response, { error: String(err) }, 500);
    }
    return;
  }

  // ── Static file serving ──
  if (!request.url || !["GET", "HEAD"].includes(request.method ?? "")) {
    sendText(response, 405, "Method not allowed");
    return;
  }

  const filePath = resolveRequestPath(request.url);
  if (!filePath) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendText(response, 404, "Not found");
      return;
    }

    const contentType = mimeTypes.get(path.extname(filePath)) ?? "application/octet-stream";
    response.writeHead(200, {
      "content-type": contentType,
      "cache-control": "no-store"
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  } catch {
    sendText(response, 404, "Not found");
  }
});

server.listen(port, host, () => {
  console.log(`SVGA playback preview: http://localhost:${port}/tools/svga-player-preview/`);
});
