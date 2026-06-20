#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const artifactRoot = path.join(repoRoot, ".artifacts/product/NQ1");
const helperUrl = pathToFileURL(path.join(repoRoot, "dist/tests/helpers/nq1-flake-stability.js")).href;
const {
  buildNq1FlakeStaticChecks,
  buildNq1FlakeStabilityReport
} = await import(helperUrl);

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const runGroups = [
  {
    id: "core-targeted-tests",
    repetitions: 5,
    command: "node --test dist/tests/nq1-history-model.test.js dist/tests/nq1-async-race.test.js dist/tests/nq1-save-as-safety-matrix.test.js dist/tests/nq1-cleanup-stress.test.js dist/tests/nq1-accessibility-audit.test.js",
    cmd: process.execPath,
    args: [
      "--test",
      "dist/tests/nq1-history-model.test.js",
      "dist/tests/nq1-async-race.test.js",
      "dist/tests/nq1-save-as-safety-matrix.test.js",
      "dist/tests/nq1-cleanup-stress.test.js",
      "dist/tests/nq1-accessibility-audit.test.js"
    ],
    timeoutMs: 60_000
  },
  {
    id: "electron-smoke",
    repetitions: 3,
    command: "npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test",
    cmd: npm,
    args: ["--prefix", "tools/electron-prototype/experiments/svga-web", "run", "spike:svga-web:test"],
    timeoutMs: 180_000
  },
  {
    id: "round-trip-subset",
    repetitions: 3,
    command: "node --test dist/tests/nq1-round-trip-matrix.test.js",
    cmd: process.execPath,
    args: ["--test", "dist/tests/nq1-round-trip-matrix.test.js"],
    timeoutMs: 60_000
  }
];

await mkdir(artifactRoot, { recursive: true });

const staticChecks = buildNq1FlakeStaticChecks({
  loopValidateSource: await readText("tools/loop-validate.mjs"),
  launcherSource: await readText("tools/launch-local-preview.mjs"),
  launcherTestSource: await readText("tools/launch-local-preview.test.mjs"),
  svgaWebMainSource: await readText("tools/electron-prototype/experiments/svga-web/main.cjs"),
  svgaWebServerSource: await readText("tools/electron-prototype/experiments/svga-web/server.mjs"),
  svgaWebRendererSource: await readText("tools/electron-prototype/experiments/svga-web/web/prototype.js"),
  svgaWebPrepareSource: await readText("tools/electron-prototype/experiments/svga-web/scripts/prepare-runtime.mjs"),
  packageJsonSource: await readText("package.json")
});

const repeatedRunGroups = [];
const runDetails = [];
for (const group of runGroups) {
  const runs = [];
  for (let index = 0; index < group.repetitions; index += 1) {
    const result = await runCommand(group, index + 1);
    runs.push(result);
    runDetails.push(result);
  }
  repeatedRunGroups.push({
    id: group.id,
    command: group.command,
    expectedRepetitions: group.repetitions,
    actualRepetitions: runs.length,
    passCount: runs.filter(({ status }) => status === "pass").length,
    failCount: runs.filter(({ status }) => status !== "pass").length,
    durationsMs: runs.map(({ durationMs }) => durationMs)
  });
}

const report = {
  ...buildNq1FlakeStabilityReport({
    staticChecks,
    repeatedRunGroups,
    developerDocs: [
      "docs/product/EDITOR_TEST_MATRIX.md",
      "docs/product/EDITOR_TROUBLESHOOTING.md",
      "docs/product/SUPPORTED_EDITABLE_SVGA_BOUNDARY.md"
    ]
  }),
  generatedAt: new Date().toISOString(),
  repeatedRunDetails: runDetails
};

await writeFile(path.join(artifactRoot, "flake-stability-report.json"), `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  reportPath: ".artifacts/product/NQ1/flake-stability-report.json",
  passed: report.passed,
  staticCheckCount: report.staticChecks.length,
  repeatedRunGroupCount: report.repeatedRunGroups.length,
  totalRepeatedRuns: report.repeatedRunGroups.reduce((total, group) => total + group.actualRepetitions, 0)
}));

if (!report.passed) {
  process.exitCode = 1;
}

async function readText(relativePath) {
  return await readFile(path.join(repoRoot, relativePath), "utf8");
}

function runCommand(group, runIndex) {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const child = spawn(group.cmd, group.args, {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      AUTO_SVGA_NQ1_FLAKE_STABILITY: "1"
    }
  });

  let output = "";
  const timeout = setTimeout(() => {
    child.kill("SIGTERM");
  }, group.timeoutMs);

  child.stdout.on("data", (chunk) => {
    output += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString("utf8");
  });

  return new Promise((resolve) => {
    child.on("error", (error) => {
      clearTimeout(timeout);
      const finishedAtMs = Date.now();
      resolve({
        groupId: group.id,
        runIndex,
        command: group.command,
        status: "fail",
        exitCode: 1,
        startedAt,
        finishedAt: new Date(finishedAtMs).toISOString(),
        durationMs: finishedAtMs - startedAtMs,
        failureExcerpt: error.message
      });
    });
    child.on("exit", (code, signal) => {
      clearTimeout(timeout);
      const finishedAtMs = Date.now();
      const status = code === 0 ? "pass" : "fail";
      resolve({
        groupId: group.id,
        runIndex,
        command: group.command,
        status,
        exitCode: code,
        signal: signal ?? null,
        startedAt,
        finishedAt: new Date(finishedAtMs).toISOString(),
        durationMs: finishedAtMs - startedAtMs,
        failureExcerpt: status === "pass" ? null : lastLines(output, 40)
      });
    });
  });
}

function lastLines(text, count) {
  return text.split(/\r?\n/).filter(Boolean).slice(-count).join("\n");
}
