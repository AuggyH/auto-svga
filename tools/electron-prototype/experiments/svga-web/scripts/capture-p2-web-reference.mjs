import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const experimentRoot = path.resolve(scriptRoot, "..");
const repoRoot = path.resolve(experimentRoot, "../../../..");
const artifactRoot = path.join(repoRoot, ".artifacts/product/P2");
const port = Number(process.env.AUTO_SVGA_P2_WEB_PORT ?? 4187);
const serverUrl = `http://127.0.0.1:${port}/tools/svga-player-preview/?mode=export`;
const electronBin = path.resolve(experimentRoot, "../../node_modules/.bin/electron");

function gitHeadCommit() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
}

async function readIndex() {
  try {
    return JSON.parse(await readFile(path.join(artifactRoot, "artifact-index.json"), "utf8"));
  } catch {
    return {
      milestoneId: "P2",
      title: "Desktop Product Shell And Web Preview Parity",
      productIdentity: "Auto SVGA",
      headCommit: gitHeadCommit(),
      generatedAt: new Date().toISOString(),
      humanReviewRequired: true,
      artifacts: []
    };
  }
}

async function waitForHealth(origin, timeoutMs = 12_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${origin}/tools/svga-player-preview/index.html`, { method: "HEAD" });
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 160));
  }
  throw new Error("Web preview server did not become ready.");
}

async function addArtifact(index, fileName, scenario, source, mode, viewport) {
  const filePath = path.join(artifactRoot, fileName);
  const bytes = await readFile(filePath);
  const record = {
    scenario,
    mode,
    source,
    viewport,
    path: `.artifacts/product/P2/${fileName}`,
    mime: fileName.endsWith(".json") ? "application/json" : "image/png",
    sizeBytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    fixture: "examples/avatar_frame_basic/output/avatar_frame_basic.svga",
    headCommit: index.headCommit,
    generatedAt: new Date().toISOString(),
    humanReviewRequired: true
  };
  index.artifacts = index.artifacts.filter((artifact) => artifact.path !== record.path);
  index.artifacts.push(record);
}

async function main() {
  await mkdir(artifactRoot, { recursive: true });
  execFileSync("npm", ["run", "export:example"], { cwd: repoRoot, stdio: "ignore" });
  const server = spawn(process.execPath, ["tools/svga-player-preview/server.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" },
    stdio: ["ignore", "ignore", "pipe"]
  });
  let stderr = "";
  server.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  try {
    await waitForHealth(`http://127.0.0.1:${port}`);
    execFileSync(electronBin, [
      path.join(scriptRoot, "web-reference-capture.cjs"),
      "--url", serverUrl,
      "--artifact-root", artifactRoot
    ], {
      cwd: experimentRoot,
      stdio: "inherit"
    });
  } finally {
    server.kill("SIGTERM");
  }
  if (server.exitCode && server.exitCode !== 0 && stderr.trim()) {
    console.error(stderr.trim());
  }

  const index = await readIndex();
  index.headCommit = gitHeadCommit();
  index.generatedAt = new Date().toISOString();
  await addArtifact(index, "web-reference-loaded.png", "web-reference-loaded", "web", "reference", { width: 1440, height: 900 });
  await addArtifact(index, "web-reference-inspection.png", "web-reference-inspection", "web", "reference", { width: 1440, height: 900 });
  await writeFile(path.join(artifactRoot, "artifact-index.json"), `${JSON.stringify(index, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
