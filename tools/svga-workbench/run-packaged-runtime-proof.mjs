#!/usr/bin/env node
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptRoot, "../..");
const milestoneId = "SVGA-Workbench-v1";
const runtimeRoot = path.join(repoRoot, ".artifacts/svga-workbench-v1-packaged-runtime/latest");
const experimentRoot = path.join(repoRoot, "tools/electron-prototype/experiments/svga-web");
const packagedBinary = path.join(
  experimentRoot,
  ".artifacts/internal-trial/Auto SVGA-darwin-arm64/Auto SVGA.app/Contents/MacOS/Auto SVGA"
);
const internalTrialManifestPath = path.join(experimentRoot, ".artifacts/internal-trial/internal-trial-manifest.json");

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function toRepoPath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function redact(text) {
  return String(text ?? "")
    .replaceAll(repoRoot, "<repo-root>")
    .replace(/\/Users\/[^/\s]+/g, "/Users/<redacted>")
    .replace(/\/private\/[^\s]+/g, "<redacted-private-path>")
    .replace(/\/var\/folders\/[^\s]+/g, "<redacted-var-path>");
}

async function waitForJsonFile(filePath, { timeoutMs = 45_000, pollMs = 250 } = {}) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    if (existsSync(filePath)) {
      try {
        return await readJson(filePath);
      } catch (error) {
        lastError = error;
      }
    }
    await sleep(pollMs);
  }
  throw new Error(`Timed out waiting for ${toRepoPath(filePath)}${lastError ? `: ${lastError.message}` : ""}`);
}

async function stopChildProcess(child) {
  if (child.exitCode !== null || child.signalCode) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  const stopped = await Promise.race([
    exited.then(() => true),
    sleep(5_000).then(() => false)
  ]);
  if (!stopped && child.exitCode === null && !child.signalCode) {
    child.kill("SIGKILL");
    await Promise.race([exited, sleep(2_000)]);
  }
}

async function main() {
  if (!existsSync(packagedBinary)) {
    throw new Error(`packaged App executable missing: ${toRepoPath(packagedBinary)}`);
  }
  const finalHead = git(["rev-parse", "HEAD"]);
  const finalTree = git(["rev-parse", "HEAD^{tree}"]);
  await rm(runtimeRoot, { recursive: true, force: true });
  await mkdir(runtimeRoot, { recursive: true });

  const normalVisibleStartupPath = path.join(runtimeRoot, "normal-visible-startup.json");
  const normalLaunchEnv = { ...process.env };
  for (const key of [
    "AUTO_SVGA_P2_NORMAL_PROOF",
    "AUTO_SVGA_PRODUCT_SMOKE",
    "AUTO_SVGA_SMOKE"
  ]) {
    delete normalLaunchEnv[key];
  }

  const startedAt = new Date().toISOString();
  const child = spawn(packagedBinary, [], {
    cwd: repoRoot,
    env: {
      ...normalLaunchEnv,
      AUTO_SVGA_PRODUCT_MILESTONE: milestoneId,
      AUTO_SVGA_PRODUCT_ARTIFACTS: runtimeRoot,
      AUTO_SVGA_ACTUAL_LAUNCH_COMMAND: "packaged Auto SVGA.app"
    },
    stdio: "pipe"
  });
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk) => {
    stdout += chunk.toString("utf8");
  });
  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });
  const exitPromise = new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });

  let visibleStartup;
  let exitResult = null;
  try {
    visibleStartup = await Promise.race([
      waitForJsonFile(normalVisibleStartupPath),
      exitPromise.then((result) => {
        exitResult = result;
        throw new Error(`Packaged app exited before normal visible startup proof was written: ${JSON.stringify(result)}`);
      })
    ]);
  } finally {
    await stopChildProcess(child);
    exitResult ??= await Promise.race([
      exitPromise,
      sleep(100).then(() => ({ code: child.exitCode, signal: child.signalCode }))
    ]);
  }

  const internalTrialManifest = existsSync(internalTrialManifestPath)
    ? await readJson(internalTrialManifestPath)
    : null;
  const proof = {
    schemaVersion: 1,
    milestoneId,
    proofId: "svga-workbench-packaged-normal-runtime-proof",
    finalHead,
    finalTree,
    buildCommit: internalTrialManifest?.buildCommit ?? null,
    buildCommitMatchesFinalHead: internalTrialManifest?.buildCommit === finalHead,
    launchTarget: "packaged .app executable normal visible startup without smoke or proof flags",
    executablePath: toRepoPath(packagedBinary),
    startedAt,
    exitCode: exitResult?.code ?? null,
    exitSignal: exitResult?.signal ?? null,
    terminatedAfterVisibleStartupCapture: true,
    normalVisibleStartup: visibleStartup,
    runtimeIdentity: visibleStartup?.runtimeIdentity ?? null,
    noSmokeMode: visibleStartup?.noSmokeMode === true,
    noProofArguments: visibleStartup?.noProofArguments === true,
    localOnly: visibleStartup?.localOnly === true,
    externalRequests: visibleStartup?.externalRequests ?? [],
    passed: visibleStartup?.passed === true
      && internalTrialManifest?.buildCommit === finalHead
      && visibleStartup?.noSmokeMode === true
      && visibleStartup?.noProofArguments === true
      && visibleStartup?.localOnly === true
      && Array.isArray(visibleStartup?.externalRequests)
      && visibleStartup.externalRequests.length === 0,
    stdoutTail: redact(stdout).split("\n").slice(-20),
    stderrTail: redact(stderr).split("\n").slice(-20),
    generatedAt: new Date().toISOString()
  };
  await writeJson(path.join(runtimeRoot, "packaged-app-runtime-proof.json"), proof);
  console.log(JSON.stringify({
    proof: toRepoPath(path.join(runtimeRoot, "packaged-app-runtime-proof.json")),
    finalHead,
    buildCommit: proof.buildCommit,
    passed: proof.passed
  }, null, 2));
  if (!proof.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
