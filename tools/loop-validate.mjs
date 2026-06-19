#!/usr/bin/env node
import { spawn } from "node:child_process";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createPreviewServer } from "./svga-player-preview/server.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

export const knownGaps = {
  lint: "not_available",
  format: "not_available",
  "performance-benchmark": "not_available",
  "visual-quality": "manual_review",
  "svga-web-render-smoke": "optional_heavy_check"
};

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export function createLoopValidationSteps() {
  const npm = npmCommand();
  return [
    {
      id: "handoff-tests",
      command: "node --test tools/loop-handoff.test.mjs",
      required: true,
      run: { cmd: process.execPath, args: ["--test", "tools/loop-handoff.test.mjs"] }
    },
    {
      id: "reviewer-config-check",
      command: "node tools/loop-reviewer-config-check.mjs",
      required: true,
      run: { cmd: process.execPath, args: ["tools/loop-reviewer-config-check.mjs"] }
    },
    {
      id: "loop-budget-check",
      command: "node tools/loop-budget-check.mjs",
      required: true,
      run: { cmd: process.execPath, args: ["tools/loop-budget-check.mjs"] }
    },
    {
      id: "build",
      command: "npm run build",
      required: true,
      run: { cmd: npm, args: ["run", "build"] }
    },
    {
      id: "root-tests",
      command: "npm test",
      required: true,
      run: { cmd: npm, args: ["test"] }
    },
    {
      id: "validate-example",
      command: "npm run validate:example",
      required: true,
      run: { cmd: npm, args: ["run", "validate:example"] }
    },
    {
      id: "launcher-tests",
      command: "node --test tools/launch-local-preview.test.mjs",
      required: true,
      run: { cmd: process.execPath, args: ["--test", "tools/launch-local-preview.test.mjs"] }
    },
    {
      id: "web-inspection-tests",
      command: "node --test tools/svga-player-preview/inspection-report-view.test.mjs tools/svga-player-preview/server-inspection-report.test.mjs",
      required: true,
      run: {
        cmd: process.execPath,
        args: [
          "--test",
          "tools/svga-player-preview/inspection-report-view.test.mjs",
          "tools/svga-player-preview/server-inspection-report.test.mjs"
        ]
      }
    },
    {
      id: "web-main-syntax",
      command: "node --check tools/svga-player-preview/main.js",
      required: true,
      run: { cmd: process.execPath, args: ["--check", "tools/svga-player-preview/main.js"] }
    },
    {
      id: "web-server-syntax",
      command: "node --check tools/svga-player-preview/server.mjs",
      required: true,
      run: { cmd: process.execPath, args: ["--check", "tools/svga-player-preview/server.mjs"] }
    },
    {
      id: "launcher-syntax",
      command: "node --check tools/launch-local-preview.mjs",
      required: true,
      run: { cmd: process.execPath, args: ["--check", "tools/launch-local-preview.mjs"] }
    },
    {
      id: "web-local-smoke",
      command: "web-local-smoke 127.0.0.1 random-port",
      required: true,
      type: "web-smoke"
    },
    {
      id: "electron-prototype-tests",
      command: "npm --prefix tools/electron-prototype run spike:electron:test",
      required: true,
      run: {
        cmd: npm,
        args: ["--prefix", "tools/electron-prototype", "run", "spike:electron:test"]
      }
    },
    {
      id: "svga-web-prototype-tests",
      command: "npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test",
      required: true,
      run: {
        cmd: npm,
        args: ["--prefix", "tools/electron-prototype/experiments/svga-web", "run", "spike:svga-web:test"]
      }
    },
    {
      id: "git-diff-check",
      command: "git diff --check",
      required: true,
      run: { cmd: "git", args: ["diff", "--check"] }
    }
  ];
}

export async function runWebLocalSmoke({
  serverFactory = createPreviewServer,
  fetchImpl = globalThis.fetch
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is not available for web local smoke.");
  }

  const server = serverFactory();
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });

  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to read loopback smoke port.");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const page = await fetchImpl(`${baseUrl}/tools/svga-player-preview/`);
    const latestArtifact = await fetchImpl(`${baseUrl}/api/latest-artifact`);

    if (page.status !== 200) {
      throw new Error(`Preview page returned ${page.status}.`);
    }
    if (latestArtifact.status !== 200) {
      throw new Error(`/api/latest-artifact returned ${latestArtifact.status}.`);
    }

    return {
      pageStatus: page.status,
      latestArtifactStatus: latestArtifact.status
    };
  } finally {
    await new Promise((resolveClose, rejectClose) => {
      server.close((error) => error ? rejectClose(error) : resolveClose());
    });
  }
}

export async function runProcessStep(step, {
  cwd = repoRoot,
  stdio = "inherit",
  activeChildren
} = {}) {
  const child = spawn(step.run.cmd, step.run.args, {
    cwd,
    stdio,
    env: {
      ...process.env,
      AUTO_SVGA_LOOP_VALIDATE: "1"
    }
  });
  activeChildren?.add(child);

  return await new Promise((resolveStep) => {
    child.on("error", (error) => {
      activeChildren?.delete(child);
      resolveStep({ exitCode: 1, error: error.message });
    });
    child.on("exit", (code, signal) => {
      activeChildren?.delete(child);
      resolveStep({
        exitCode: typeof code === "number" ? code : 1,
        signal: signal ?? undefined
      });
    });
  });
}

function makeStepResult(step, status, startedAtMs, finishedAtMs, extra = {}) {
  return {
    id: step.id,
    command: step.command,
    required: step.required,
    status,
    exitCode: extra.exitCode ?? null,
    durationMs: Math.max(0, finishedAtMs - startedAtMs),
    reason: extra.reason ?? null
  };
}

function isExcludedSourceStatus(line) {
  const rawPath = line.slice(3).trim();
  return rawPath === ".artifacts"
    || rawPath.startsWith(".artifacts/")
    || rawPath === "node_modules"
    || rawPath.startsWith("node_modules/");
}

function gitText(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8"
  });
  if (result.status !== 0) return undefined;
  return result.stdout.trim();
}

function readRepositorySnapshot(cwd) {
  const head = gitText(["rev-parse", "HEAD"], cwd);
  const statusOutput = gitText(["status", "--short"], cwd);
  const sourceLines = statusOutput === undefined
    ? ["git status unavailable"]
    : statusOutput.split("\n").filter(Boolean).filter((line) => !isExcludedSourceStatus(line));
  return {
    head,
    sourceWorkspaceClean: sourceLines.length === 0,
    sourceStatusCount: sourceLines.length
  };
}

export async function runLoopValidation({
  steps = createLoopValidationSteps(),
  cwd = repoRoot,
  artifactDir = resolve(repoRoot, ".artifacts/loop-validation"),
  executor = runProcessStep,
  webSmoke = runWebLocalSmoke,
  consoleLike = console,
  clock = () => Date.now()
} = {}) {
  const startedAtMs = clock();
  const startedAt = new Date(startedAtMs).toISOString();
  const startSnapshot = readRepositorySnapshot(cwd);
  const results = [];
  const activeChildren = new Set();
  let blocked = false;
  let status = "pass";

  const cleanup = () => {
    for (const child of activeChildren) {
      if (!child.killed) child.kill();
    }
  };

  try {
    for (const step of steps) {
      if (blocked) {
        const skippedAt = clock();
        results.push(makeStepResult(step, "skipped", skippedAt, skippedAt, {
          reason: "blocked_by_previous_failure"
        }));
        continue;
      }

      const stepStartedAt = clock();
      let outcome;
      if (step.type === "web-smoke") {
        await webSmoke();
        outcome = { exitCode: 0 };
      } else {
        outcome = await executor(step, { cwd, activeChildren });
      }
      const stepFinishedAt = clock();
      const exitCode = outcome.exitCode ?? 0;

      if (exitCode === 0) {
        results.push(makeStepResult(step, "pass", stepStartedAt, stepFinishedAt, { exitCode: 0 }));
        continue;
      }

      status = "fail";
      blocked = step.required;
      results.push(makeStepResult(step, "fail", stepStartedAt, stepFinishedAt, {
        exitCode,
        reason: outcome.error ?? outcome.signal ?? "command_failed"
      }));
    }
  } catch (error) {
    status = "fail";
    const failedStep = steps[results.length];
    if (failedStep) {
      const failedAt = clock();
      results.push(makeStepResult(failedStep, "fail", failedAt, failedAt, {
        exitCode: 1,
        reason: error instanceof Error ? error.message : String(error)
      }));
      for (const step of steps.slice(results.length)) {
        results.push(makeStepResult(step, "skipped", failedAt, failedAt, {
          reason: "blocked_by_previous_failure"
        }));
      }
    }
  } finally {
    cleanup();
  }

  const finishedAtMs = clock();
  const finishSnapshot = readRepositorySnapshot(cwd);
  if (startSnapshot.head && finishSnapshot.head && startSnapshot.head !== finishSnapshot.head) {
    status = "fail";
  }
  const summary = {
    schemaVersion: 2,
    repositoryHeadCommitAtStart: startSnapshot.head,
    repositoryHeadCommitAtFinish: finishSnapshot.head,
    sourceWorkspaceCleanAtStart: startSnapshot.sourceWorkspaceClean,
    sourceWorkspaceCleanAtFinish: finishSnapshot.sourceWorkspaceClean,
    status,
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: Math.max(0, finishedAtMs - startedAtMs),
    steps: results,
    knownGaps
  };

  await mkdir(artifactDir, { recursive: true });
  await writeFile(resolve(artifactDir, "latest.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  consoleLike.log(`AUTO_SVGA_LOOP_VALIDATE_RESULT=${JSON.stringify(summary)}`);
  return summary;
}

export async function main() {
  const summary = await runLoopValidation();
  process.exitCode = summary.status === "pass" ? 0 : 1;
}

const isDirectRun = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
