#!/usr/bin/env node
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultServerPath = path.join(repoRoot, "tools/svga-player-preview/server.mjs");
const defaultPreviewPath = "/tools/svga-player-preview/";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildBaseUrl({ host = "127.0.0.1", port = 4173 } = {}) {
  return `http://${host}:${port}`;
}

function buildPreviewUrl({ host = "127.0.0.1", port = 4173, previewPath = defaultPreviewPath } = {}) {
  return `${buildBaseUrl({ host, port })}${previewPath}`;
}

async function fetchText(url, timeoutMs = 800) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return {
      ok: response.ok,
      status: response.status,
      text: await response.text()
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, timeoutMs = 800) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    try {
      return {
        ok: response.ok,
        status: response.status,
        value: JSON.parse(text)
      };
    } catch {
      return { ok: response.ok, status: response.status, value: undefined };
    }
  } finally {
    clearTimeout(timeout);
  }
}

function isLatestArtifactShape(value) {
  return Boolean(value)
    && typeof value === "object"
    && "latestWithSvga" in value
    && "latestAny" in value
    && Array.isArray(value.artifacts)
    && Array.isArray(value.warnings);
}

function isPreviewPage(text) {
  return text.includes("auto-svga") && text.includes("SVGA");
}

export async function probeAutoSvgaPreview({
  host = "127.0.0.1",
  port = 4173,
  previewPath = defaultPreviewPath,
  timeoutMs = 800
} = {}) {
  const baseUrl = buildBaseUrl({ host, port });
  try {
    const [api, page] = await Promise.all([
      fetchJson(`${baseUrl}/api/latest-artifact`, timeoutMs),
      fetchText(`${baseUrl}${previewPath}`, timeoutMs)
    ]);

    if (api.ok && isLatestArtifactShape(api.value) && page.ok && isPreviewPage(page.text)) {
      return { status: "auto-svga", url: `${baseUrl}${previewPath}` };
    }

    return {
      status: "occupied",
      url: `${baseUrl}${previewPath}`,
      reason: `端口 ${port} 已被占用，但响应不像 Auto SVGA preview 服务。`
    };
  } catch {
    return { status: "offline", url: `${baseUrl}${previewPath}` };
  }
}

export async function waitForAutoSvgaPreview(options = {}) {
  const {
    timeoutMs = 12000,
    intervalMs = 250
  } = options;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const probe = await probeAutoSvgaPreview(options);
    if (probe.status === "auto-svga") return probe;
    if (probe.status === "occupied") {
      throw new Error(probe.reason);
    }
    await sleep(intervalMs);
  }

  throw new Error(`Auto SVGA preview 服务启动超时：${buildPreviewUrl(options)}`);
}

export function openDefaultBrowser(url, { platform = process.platform } = {}) {
  if (platform === "darwin") {
    return spawn("open", [url], { stdio: "ignore", detached: true });
  }
  if (platform === "win32") {
    return spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true });
  }
  return spawn("xdg-open", [url], { stdio: "ignore", detached: true });
}

export function startPreviewServer({
  host = "127.0.0.1",
  port = 4173,
  serverPath = defaultServerPath,
  stdio = "inherit"
} = {}) {
  return spawn(process.execPath, [serverPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOST: host,
      PORT: String(port)
    },
    stdio
  });
}

export async function launchLocalPreview({
  host = "127.0.0.1",
  port = 4173,
  previewPath = defaultPreviewPath,
  openBrowser = true,
  keepAlive = false,
  stdio = "inherit"
} = {}) {
  const firstProbe = await probeAutoSvgaPreview({ host, port, previewPath });
  if (firstProbe.status === "occupied") {
    throw new Error(firstProbe.reason);
  }

  const url = buildPreviewUrl({ host, port, previewPath });
  if (firstProbe.status === "auto-svga") {
    if (openBrowser) openDefaultBrowser(url).unref();
    return { status: "already-running", url, child: undefined };
  }

  const child = startPreviewServer({ host, port, stdio });
  let stopping = false;
  const stopChild = () => {
    if (stopping || child.killed) return;
    stopping = true;
    child.kill("SIGTERM");
  };

  const signalHandlers = ["SIGINT", "SIGTERM"].map((signal) => {
    const handler = () => {
      stopChild();
      process.exitCode = 0;
    };
    process.once(signal, handler);
    return { signal, handler };
  });

  try {
    child.once("exit", (code, signal) => {
      if (!stopping && code !== 0) {
        console.error(`Auto SVGA preview 服务退出：code=${code ?? "null"} signal=${signal ?? "null"}`);
      }
    });

    await waitForAutoSvgaPreview({ host, port, previewPath });
    if (openBrowser) openDefaultBrowser(url).unref();

    if (keepAlive) {
      await once(child, "exit");
    }

    return { status: "started", url, child, stop: stopChild };
  } catch (error) {
    stopChild();
    throw error;
  } finally {
    for (const { signal, handler } of signalHandlers) {
      process.removeListener(signal, handler);
    }
  }
}

function parseArgs(argv) {
  const options = {
    host: process.env.HOST ?? "127.0.0.1",
    port: Number(process.env.PORT ?? 4173),
    previewPath: defaultPreviewPath,
    openBrowser: process.env.AUTO_SVGA_LAUNCH_NO_OPEN !== "1",
    keepAlive: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--host") options.host = argv[++index] ?? options.host;
    else if (arg === "--port") options.port = Number(argv[++index] ?? options.port);
    else if (arg === "--path") options.previewPath = argv[++index] ?? options.previewPath;
    else if (arg === "--no-open") options.openBrowser = false;
    else if (arg === "--once") options.keepAlive = false;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`未知参数：${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`Auto SVGA local preview launcher

Usage:
  npm run local:preview
  node tools/launch-local-preview.mjs [--port 4173] [--host 127.0.0.1] [--no-open]

Options:
  --host <host>   Bind host, default 127.0.0.1.
  --port <port>   Bind port, default 4173.
  --path <path>   Preview page path, default ${defaultPreviewPath}.
  --no-open       Do not open the default browser.
  --once          Start/open and then exit instead of keeping the child server attached.
`);
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
    } else {
      const result = await launchLocalPreview(options);
      console.log(`Auto SVGA preview ${result.status}: ${result.url}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
