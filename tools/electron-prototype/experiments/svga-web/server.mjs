import { timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svga", "application/octet-stream"]
]);

export const internalTrialCsp = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
export const legacyBrowserBaselineAuditCsp = "default-src 'self'; script-src 'self' 'unsafe-eval'; worker-src 'self' blob:; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
export const strictCsp = internalTrialCsp;

const securityHeaders = {
  "cache-control": "no-store",
  "content-security-policy": strictCsp,
  "cross-origin-opener-policy": "same-origin",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff"
};

function securityHeadersForRequest(request) {
  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  if (requestUrl.pathname === "/audit.html" && requestUrl.searchParams.get("player") === "svgaplayerweb") {
    return {
      ...securityHeaders,
      "content-security-policy": legacyBrowserBaselineAuditCsp
    };
  }
  return securityHeaders;
}

function sendText(response, statusCode, body) {
  response.writeHead(statusCode, {
    ...securityHeaders,
    "content-type": "text/plain; charset=utf-8"
  });
  response.end(body);
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    ...securityHeaders,
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(value));
}

function tokensMatch(actual, expected) {
  const actualBytes = Buffer.from(actual ?? "");
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length
    && timingSafeEqual(actualBytes, expectedBytes);
}

function isLoopback(request) {
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress);
}

async function readRequestBytes(request, maxBytes = 25 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error("Request is too large"), { statusCode: 413 });
    chunks.push(chunk);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

async function readRequestJson(request, maxBytes = 50 * 1024 * 1024) {
  const bytes = await readRequestBytes(request, maxBytes);
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Request JSON is invalid"), { statusCode: 400 });
  }
}

function decodeBase64Field(value, fieldName, maxBytes = 25 * 1024 * 1024) {
  if (typeof value !== "string" || value.length === 0) {
    throw Object.assign(new Error(`${fieldName} is required`), { statusCode: 400 });
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.byteLength > maxBytes) {
    throw Object.assign(new Error(`${fieldName} is too large`), { statusCode: 413 });
  }
  return new Uint8Array(bytes);
}

function encodeBase64(bytes) {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
}

function normalizeBatchMappings(value) {
  if (!Array.isArray(value)) return [];
  return value.map((mapping) => ({
    inputFileLabel: path.basename(String(mapping?.inputFileLabel ?? "")),
    inputSha256: String(mapping?.inputSha256 ?? ""),
    mappingRuleId: String(mapping?.mappingRuleId ?? ""),
    mappingStatus: String(mapping?.mappingStatus ?? ""),
    resourceKey: String(mapping?.resourceKey ?? "")
  })).filter((mapping) => (
    mapping.inputFileLabel
    && mapping.inputSha256
    && mapping.mappingRuleId
    && mapping.mappingStatus
    && mapping.resourceKey
  ));
}

async function attachSessionThumbnails(session, svgaBytes, inspector) {
  const inspection = await inspector.inspect(svgaBytes);
  const imageBytesByKey = new Map(inspection.images.map((image) => [image.imageKey, image.bytes]));
  return {
    ...session,
    imageResources: session.imageResources.map((resource) => {
      const imageBytes = imageBytesByKey.get(resource.resourceKey);
      return {
        ...resource,
        thumbnailDataUrl: imageBytes && resource.originalMime === "image/png"
          ? `data:image/png;base64,${encodeBase64(imageBytes)}`
          : undefined
      };
    })
  };
}

function resolveStaticPath(appRoot, pathname) {
  const runtimeRoot = path.join(appRoot, ".runtime");
  const mappings = [
    ["/vendor/", path.join(appRoot, "vendor")],
    ["/legacy-vendor/", path.resolve(appRoot, "../..", "vendor")],
    ["/dist/", path.join(runtimeRoot, "dist")],
    ["/tools/svga-player-preview/", path.join(runtimeRoot, "tools/svga-player-preview")],
    ["/tools/shared/", path.join(runtimeRoot, "tools/shared")],
    ["/fixture/", path.join(runtimeRoot, "fixture")],
    ["/audit-samples/", path.join(runtimeRoot, "audit-samples")],
    ["/", path.join(appRoot, "web")]
  ];

  for (const [prefix, root] of mappings) {
    if (!pathname.startsWith(prefix)) continue;
    const relativePath = pathname === "/" ? "index.html" : pathname.slice(prefix.length);
    const requestedPath = path.resolve(root, relativePath);
    if (requestedPath === root || requestedPath.startsWith(`${root}${path.sep}`)) return requestedPath;
  }
  return undefined;
}

async function sendStaticFile(request, response, filePath) {
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return sendText(response, 404, "Not found");
    response.writeHead(200, {
      ...securityHeadersForRequest(request),
      "content-type": mimeTypes.get(path.extname(filePath)) ?? "application/octet-stream",
      "content-length": fileStat.size
    });
    if (request.method === "HEAD") return response.end();
    createReadStream(filePath).pipe(response);
  } catch {
    sendText(response, 404, "Not found");
  }
}

export async function startSvgaWebExperimentServer({ appRoot, reportToken }) {
  const reportModuleUrl = pathToFileURL(
    path.join(appRoot, ".runtime/dist/hosts/avatar-frame-inspection.js")
  ).href;
  const editorModuleUrl = pathToFileURL(
    path.join(appRoot, ".runtime/dist/workbench/svga/image-resource-editor.js")
  ).href;
  const batchMappingModuleUrl = pathToFileURL(
    path.join(appRoot, ".runtime/dist/workbench/svga/batch-png-mapping.js")
  ).href;
  const inspectorModuleUrl = pathToFileURL(
    path.join(appRoot, ".runtime/dist/workbench/svga/node-protobuf-inspector.js")
  ).href;
  let reportServicePromise;
  let editorPromise;
  let batchMappingPromise;
  let inspectorPromise;

  const server = createServer(async (request, response) => {
    if (!request.url || !isLoopback(request)) return sendText(response, 403, "Forbidden");
    const requestUrl = new URL(request.url, "http://127.0.0.1");

    if (request.method === "GET" && requestUrl.pathname === "/health") {
      return sendJson(response, 200, {
        status: "ok",
        runtime: "auto-svga-desktop-preview",
        prototypeLabel: "Auto SVGA Desktop Preview; internal prototype, not production"
      });
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/avatar-frame-inspection-report") {
      if (!tokensMatch(request.headers["x-auto-svga-prototype-token"], reportToken)) {
        return sendText(response, 401, "Unauthorized");
      }
      try {
        const bytes = await readRequestBytes(request);
        const name = path.basename(requestUrl.searchParams.get("name") || "synthetic-fixture.svga");
        reportServicePromise ??= import(reportModuleUrl)
          .then(({ createAvatarFrameInspectionReportService }) => createAvatarFrameInspectionReportService());
        const reportService = await reportServicePromise;
        const result = await reportService.inspect({
          id: `memory:${name}`,
          name,
          sizeBytes: bytes.byteLength,
          mediaType: "application/octet-stream",
          async read() {
            return bytes;
          }
        });
        if (!result.value) {
          return sendJson(response, 422, { error: "Inspection failed", issues: result.issues });
        }
        return sendJson(response, 200, result.value);
      } catch (error) {
        return sendJson(response, error?.statusCode ?? 422, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/svga-image-edit-session") {
      if (!tokensMatch(request.headers["x-auto-svga-prototype-token"], reportToken)) {
        return sendText(response, 401, "Unauthorized");
      }
      try {
        const input = await readRequestJson(request);
        const bytes = decodeBase64Field(input?.svgaBase64, "svgaBase64");
        const name = path.basename(typeof input?.name === "string" ? input.name : "untitled.svga");
        editorPromise ??= import(editorModuleUrl).then(({ SvgaImageResourceEditor }) => new SvgaImageResourceEditor());
        inspectorPromise ??= import(inspectorModuleUrl).then(({ NodeProtobufSvgaInspector }) => new NodeProtobufSvgaInspector());
        const [editor, inspector] = await Promise.all([editorPromise, inspectorPromise]);
        const session = await editor.createSession(bytes, name);
        return sendJson(response, 200, {
          session: await attachSessionThumbnails(session, bytes, inspector)
        });
      } catch (error) {
        return sendJson(response, error?.statusCode ?? 422, {
          error: error instanceof Error ? error.message : String(error),
          code: error?.code
        });
      }
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/svga-batch-png-map") {
      if (!tokensMatch(request.headers["x-auto-svga-prototype-token"], reportToken)) {
        return sendText(response, 401, "Unauthorized");
      }
      try {
        const input = await readRequestJson(request);
        const bytes = decodeBase64Field(input?.svgaBase64, "svgaBase64");
        const name = path.basename(typeof input?.name === "string" ? input.name : "untitled.svga");
        const files = Array.isArray(input?.files) ? input.files : [];
        editorPromise ??= import(editorModuleUrl).then(({ SvgaImageResourceEditor }) => new SvgaImageResourceEditor());
        batchMappingPromise ??= import(batchMappingModuleUrl);
        const [editor, batchMapping] = await Promise.all([editorPromise, batchMappingPromise]);
        const session = await editor.createSession(bytes, name);
        const pngInputs = files.map((file) => ({
          fileLabel: path.basename(String(file?.fileLabel ?? "untitled.png")),
          pngBytes: decodeBase64Field(file?.pngBase64, "pngBase64", 10 * 1024 * 1024),
          include: file?.include !== false,
          manualResourceKey: typeof file?.manualResourceKey === "string" ? file.manualResourceKey : undefined
        }));
        const report = batchMapping.createSvgaBatchPngMappingReport(session.imageResources, pngInputs);
        return sendJson(response, 200, { report });
      } catch (error) {
        return sendJson(response, error?.statusCode ?? 422, {
          error: error instanceof Error ? error.message : String(error),
          code: error?.code,
          details: error?.details
        });
      }
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/svga-image-replace") {
      if (!tokensMatch(request.headers["x-auto-svga-prototype-token"], reportToken)) {
        return sendText(response, 401, "Unauthorized");
      }
      try {
        const input = await readRequestJson(request);
        const bytes = decodeBase64Field(input?.svgaBase64, "svgaBase64");
        const name = path.basename(typeof input?.name === "string" ? input.name : "untitled.svga");
        const milestoneId = input?.milestoneId === "P3"
          ? "P3"
          : input?.milestoneId === "P5"
            ? "P5"
            : "P4";
        const replacements = Array.isArray(input?.replacements) ? input.replacements : [];
        if (replacements.length === 0) {
          throw Object.assign(new Error("At least one replacement is required"), { statusCode: 400 });
        }
        const decodedReplacements = replacements.map((replacement) => ({
          resourceKey: String(replacement?.resourceKey ?? ""),
          pngBytes: decodeBase64Field(replacement?.pngBase64, "pngBase64", 10 * 1024 * 1024)
        }));
        editorPromise ??= import(editorModuleUrl).then(({ SvgaImageResourceEditor }) => new SvgaImageResourceEditor());
        inspectorPromise ??= import(inspectorModuleUrl).then(({ NodeProtobufSvgaInspector }) => new NodeProtobufSvgaInspector());
        const [editor, inspector] = await Promise.all([editorPromise, inspectorPromise]);
        const result = await editor.replaceImages(bytes, decodedReplacements, name, {
          milestoneId,
          ...(milestoneId === "P5"
            ? {
              batchTransactionId: typeof input?.batchTransactionId === "string" ? input.batchTransactionId : undefined,
              batchMappings: normalizeBatchMappings(input?.batchMappings),
              playbackPassed: false,
              canvasNonBlank: false
            }
            : {})
        });
        return sendJson(response, 200, {
          editedSvgaBase64: encodeBase64(result.editedBytes),
          session: await attachSessionThumbnails(result.session, result.editedBytes, inspector),
          roundTripReport: result.roundTripReport
        });
      } catch (error) {
        return sendJson(response, error?.statusCode ?? 422, {
          error: error instanceof Error ? error.message : String(error),
          code: error?.code,
          details: error?.details
        });
      }
    }

    if (!["GET", "HEAD"].includes(request.method ?? "")) return sendText(response, 405, "Method not allowed");
    const filePath = resolveStaticPath(appRoot, decodeURIComponent(requestUrl.pathname));
    if (!filePath) return sendText(response, 404, "Not found");
    return sendStaticFile(request, response, filePath);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Experiment server did not bind a TCP port");

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close() {
      return new Promise((resolve, reject) => {
        if (!server.listening) return resolve();
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  };
}
