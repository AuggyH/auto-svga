#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptRoot, "../..");
const validationRoot = path.join(repoRoot, ".artifacts/svga-workbench-v1-validation/latest");

const commands = [
  {
    id: "syntax-product-app",
    fileName: "syntax-product-app.json",
    command: "node",
    args: ["--check", "tools/shared/product-frontend/product-app.mjs"]
  },
  {
    id: "syntax-electron-main",
    fileName: "syntax-electron-main.json",
    command: "node",
    args: ["--check", "tools/electron-prototype/experiments/svga-web/main.cjs"]
  },
  {
    id: "syntax-package-proof",
    fileName: "syntax-package-proof.json",
    command: "node",
    args: ["--check", "tools/electron-prototype/experiments/svga-web/scripts/macos-package-proof.mjs"]
  },
  {
    id: "syntax-package-internal-trial",
    fileName: "syntax-package-internal-trial.json",
    command: "node",
    args: ["--check", "tools/electron-prototype/experiments/svga-web/scripts/package-internal-trial.mjs"]
  },
  {
    id: "syntax-complete-review-package",
    fileName: "syntax-complete-review-package.json",
    command: "node",
    args: ["--check", "tools/svga-workbench/complete-review-package.mjs"]
  },
  {
    id: "complete-review-package-test",
    fileName: "complete-review-package-test.json",
    command: "node",
    args: ["--test", "tools/svga-workbench/complete-review-package.test.mjs"]
  },
  {
    id: "source-sharing-test",
    fileName: "source-sharing-test.json",
    command: "node",
    args: ["--test", "tools/shared/product-frontend/source-sharing.test.mjs"]
  },
  {
    id: "npm-test",
    fileName: "npm-test.json",
    command: "npm",
    args: ["test"]
  },
  {
    id: "svga-web-experiment-test",
    fileName: "svga-web-experiment-test.json",
    command: "npm",
    args: ["--prefix", "tools/electron-prototype/experiments/svga-web", "run", "spike:svga-web:test"]
  },
  {
    id: "signing-plan",
    fileName: "signing-plan.json",
    command: "npm",
    args: ["--prefix", "tools/electron-prototype/experiments/svga-web", "run", "internal:trial:signing-plan:mac"]
  },
  {
    id: "macos-package",
    fileName: "macos-package.json",
    command: "npm",
    args: ["--prefix", "tools/electron-prototype/experiments/svga-web", "run", "internal:trial:package:mac"]
  },
  {
    id: "macos-package-proof",
    fileName: "macos-package-proof.json",
    command: "npm",
    args: ["--prefix", "tools/electron-prototype/experiments/svga-web", "run", "internal:trial:proof:mac"]
  },
  {
    id: "desktop-smoke",
    fileName: "desktop-smoke.json",
    command: "npm",
    args: ["run", "desktop:smoke"]
  },
  {
    id: "loop-validate",
    fileName: "loop-validate.json",
    command: "npm",
    args: ["run", "loop:validate"]
  }
];

function sanitizeText(text) {
  let result = String(text ?? "");
  for (const literal of [repoRoot, process.env.HOME, os.tmpdir()]) {
    if (literal) result = result.split(literal).join("<redacted-local-path>");
  }
  const username = os.userInfo().username;
  if (username) result = result.split(username).join("<redacted-user>");
  result = result.replace(/\/Users\/[^\s"'`]+(?:\/[^\s"'`]*)?/g, "<redacted-local-path>");
  result = result.replace(/\/private\/[^\s"'`]+/g, "<redacted-local-path>");
  result = result.replace(/\/var\/folders\/[^\s"'`]+/g, "<redacted-local-path>");
  return result;
}

async function writeJson(filePath, payload) {
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function runCommand(spec) {
  const startedAt = new Date();
  const startedMs = Date.now();
  const result = spawnSync(spec.command, spec.args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      AUTO_SVGA_VALIDATION_CAPTURE: "1"
    },
    encoding: "utf8",
    maxBuffer: 200 * 1024 * 1024
  });
  const durationMs = Date.now() - startedMs;
  return {
    schemaVersion: 1,
    id: spec.id,
    command: [spec.command, ...spec.args].join(" "),
    startedAt: startedAt.toISOString(),
    durationMs,
    exitCode: result.status,
    signal: result.signal,
    passed: result.status === 0,
    stdout: sanitizeText(result.stdout),
    stderr: sanitizeText(result.stderr),
    error: result.error ? sanitizeText(result.error.message) : null
  };
}

async function main() {
  await rm(validationRoot, { recursive: true, force: true });
  await mkdir(validationRoot, { recursive: true });
  const results = [];
  for (const spec of commands) {
    const result = runCommand(spec);
    results.push({
      id: result.id,
      command: result.command,
      fileName: spec.fileName,
      exitCode: result.exitCode,
      passed: result.passed,
      durationMs: result.durationMs
    });
    await writeJson(path.join(validationRoot, spec.fileName), result);
  }
  const summary = {
    schemaVersion: 1,
    milestoneId: "SVGA-Workbench-v1",
    generatedAt: new Date().toISOString(),
    validationRoot: ".artifacts/svga-workbench-v1-validation/latest",
    passed: results.every((result) => result.passed),
    commandCount: results.length,
    results
  };
  await writeJson(path.join(validationRoot, "validation-summary.json"), summary);
  console.log(JSON.stringify({
    passed: summary.passed,
    validationRoot: summary.validationRoot,
    commandCount: summary.commandCount,
    failed: results.filter((result) => !result.passed).map((result) => result.id)
  }, null, 2));
  if (!summary.passed) process.exitCode = 1;
}

if (!existsSync(repoRoot)) {
  throw new Error("repo root not found");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
