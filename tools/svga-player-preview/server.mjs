import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
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
  [".png", "image/png"],
  [".svga", "application/octet-stream"]
]);

function sendText(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
  response.end(body);
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

const server = createServer(async (request, response) => {
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
