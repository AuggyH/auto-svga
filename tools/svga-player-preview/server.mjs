import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const artifactRoot = path.resolve(process.env.AUTO_SVGA_SCAN_ROOT ?? repoRoot);
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "127.0.0.1";

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
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

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(value));
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

function toPublicPath(filePath) {
  return `/${path.relative(artifactRoot, filePath).split(path.sep).join("/")}`;
}

async function listDirectories(parentPath) {
  try {
    return (await readdir(parentPath, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(parentPath, entry.name));
  } catch {
    return [];
  }
}

async function inspectArtifactDirectory(directoryPath, jobId, extraDirectories = []) {
  const searchDirectories = [directoryPath, ...extraDirectories];
  const files = [];

  for (const searchDirectory of searchDirectories) {
    try {
      for (const entry of await readdir(searchDirectory, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const absolutePath = path.join(searchDirectory, entry.name);
        const fileStat = await stat(absolutePath);
        files.push({ absolutePath, name: entry.name, mtimeMs: fileStat.mtimeMs });
      }
    } catch {
      // Optional generated/reference directories may not exist.
    }
  }

  const pickNewest = (predicate) => files
    .filter(({ name }) => predicate(name.toLowerCase()))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  const svga = pickNewest((name) => name.endsWith(".svga"));
  const gif = pickNewest((name) => name.endsWith(".gif"));
  const mp4 = pickNewest((name) => name.endsWith(".mp4"));
  const webm = pickNewest((name) => name.endsWith(".webm"));
  const report = pickNewest((name) => name === "report.json");
  const packageFile = pickNewest((name) => name === "delivery.zip" || name.endsWith("-delivery.zip"));
  const keyFiles = [svga, gif, mp4, webm, report, packageFile].filter(Boolean);

  if (keyFiles.length === 0) return undefined;

  const warnings = [];
  if (!svga) warnings.push("该产物组不包含 SVGA。");
  if (!gif && !mp4 && !webm) warnings.push("该产物组不包含参考预览文件。");
  if (!report) warnings.push("该产物组不包含 report.json。");

  return {
    jobId,
    outputDir: toPublicPath(directoryPath).replace(/^\//, ""),
    updatedAt: new Date(Math.max(...keyFiles.map(({ mtimeMs }) => mtimeMs))).toISOString(),
    ...(svga ? { svgaPath: toPublicPath(svga.absolutePath) } : {}),
    ...(gif ? { gifPath: toPublicPath(gif.absolutePath) } : {}),
    ...(mp4 ? { mp4Path: toPublicPath(mp4.absolutePath) } : {}),
    ...(webm ? { webmPath: toPublicPath(webm.absolutePath) } : {}),
    ...(report ? { reportPath: toPublicPath(report.absolutePath) } : {}),
    ...(packageFile ? { packagePath: toPublicPath(packageFile.absolutePath) } : {}),
    warnings
  };
}

export async function scanLatestArtifacts(rootPath = artifactRoot) {
  const groups = [];
  const groupedParents = [
    { root: path.join(rootPath, "jobs"), kind: "job" },
    { root: path.join(rootPath, "examples"), kind: "example" }
  ];

  for (const parent of groupedParents) {
    for (const itemDirectory of await listDirectories(parent.root)) {
      const jobId = path.basename(itemDirectory);
      const outputDirectory = path.join(itemDirectory, "output");
      const generatedDirectory = path.join(itemDirectory, "generated");
      const group = await inspectArtifactDirectory(
        outputDirectory,
        `${parent.kind}:${jobId}`,
        [generatedDirectory]
      );
      if (group) groups.push(group);
    }
  }

  for (const standaloneName of ["exports", "preview"]) {
    const standaloneDirectory = path.join(rootPath, standaloneName);
    const group = await inspectArtifactDirectory(
      standaloneDirectory,
      standaloneName
    );
    if (group) groups.push(group);
  }

  groups.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const latestWithSvga = groups.find((group) => group.svgaPath) ?? null;
  const latestAny = groups[0] ?? null;
  const warnings = [];
  if (!latestWithSvga && latestAny) {
    warnings.push("未找到包含 SVGA 的产物组，将仅提供最新参考文件。");
  }
  if (!latestAny) warnings.push("未扫描到可用的本地产物。");

  return { latestWithSvga, latestAny, artifacts: groups, warnings };
}

let reportServicePromise;

async function getAvatarFrameInspectionReportService() {
  reportServicePromise ??= import("../../dist/hosts/avatar-frame-inspection.js")
    .then(({ createAvatarFrameInspectionReportService }) => (
      createAvatarFrameInspectionReportService()
    ));
  return reportServicePromise;
}

export async function inspectAvatarFrameBytes(bytes, name = "local.svga") {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const reportService = await getAvatarFrameInspectionReportService();
  const result = await reportService.inspect({
    id: `memory:${name}`,
    name,
    sizeBytes: data.byteLength,
    mediaType: "application/octet-stream",
    async read() {
      return data;
    }
  });
  if (!result.value) {
    const error = new Error(result.issues.map(({ message }) => message).join("; ") || "SVGA inspection failed.");
    error.issues = result.issues;
    throw error;
  }
  return result.value;
}

async function readRequestBytes(request, maxBytes = 25 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("SVGA 文件超过检查接口的 25 MB 限制。");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

export function createPreviewServer() {
  return createServer(async (request, response) => {
    if (!request.url) {
      sendText(response, 400, "Bad request");
      return;
    }

    const requestUrl = new URL(request.url, `http://localhost:${port}`);
    if (request.method === "POST" && requestUrl.pathname === "/api/avatar-frame-inspection-report") {
      try {
        const bytes = await readRequestBytes(request);
        const name = path.basename(requestUrl.searchParams.get("name") || "local.svga");
        sendJson(response, 200, await inspectAvatarFrameBytes(bytes, name));
      } catch (error) {
        sendJson(response, error?.statusCode ?? 422, {
          error: error instanceof Error ? error.message : String(error),
          ...(Array.isArray(error?.issues) ? { issues: error.issues } : {})
        });
      }
      return;
    }

    if (!["GET", "HEAD"].includes(request.method ?? "")) {
      sendText(response, 405, "Method not allowed");
      return;
    }

    if (requestUrl.pathname === "/api/latest-artifact") {
      try {
        sendJson(response, 200, await scanLatestArtifacts());
      } catch (error) {
        sendJson(response, 500, {
          latestWithSvga: null,
          latestAny: null,
          artifacts: [],
          warnings: [`扫描产物失败：${error instanceof Error ? error.message : String(error)}`]
        });
      }
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
}

export function startPreviewServer() {
  const server = createPreviewServer();
  server.listen(port, host, () => {
    console.log(`SVGA playback preview: http://localhost:${port}/tools/svga-player-preview/`);
  });
  return server;
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) startPreviewServer();
