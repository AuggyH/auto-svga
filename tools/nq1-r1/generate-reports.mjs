#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const artifactRoot = path.join(repoRoot, ".artifacts/product/NQ1-R1");
const helperUrl = pathToFileURL(path.join(repoRoot, "dist/tests/helpers/nq1-r1-hardening.js")).href;
const helper = await import(helperUrl);

await mkdir(artifactRoot, { recursive: true });

const headCommit = git(["rev-parse", "HEAD"]);
const generatedAt = new Date().toISOString();
const sources = {
  mainSource: await readText("tools/electron-prototype/experiments/svga-web/main.cjs"),
  rendererSource: await readText("tools/electron-prototype/experiments/svga-web/web/prototype.js"),
  htmlSource: await readText("tools/electron-prototype/experiments/svga-web/web/index.html"),
  cssSource: await readText("tools/electron-prototype/experiments/svga-web/web/styles.css"),
  preloadSource: await readText("tools/electron-prototype/experiments/svga-web/preload.cjs"),
  packageJsonSource: await readText("package.json"),
  loopValidateSource: await readText("tools/loop-validate.mjs")
};

const asyncSchedule = withMeta(helper.buildNq1R1AsyncScheduleMatrix());
const roundTrip = withMeta(await helper.buildNq1R1RoundTripMatrixV2());
const lifecycle = withMeta(helper.buildNq1R1LifecycleMemoryStressReport(sources));
const performance = withMeta(await helper.buildNq1R1PerformanceOperationMatrix());
const flake = withMeta(await buildFlakeStabilityV2());
const reserve = withMeta(helper.buildNq1R1ReserveModelHistoryReport());
const fifty = withMeta(await helper.buildNq1R1FiftyResourceFixtureReport());
const mutation = withMeta(helper.buildNq1R1MutationDetectionReport(roundTrip));
const accessibility = withMeta(helper.buildNq1R1AccessibilityAuditReport(sources));
const saveAs = withMeta(helper.buildNq1R1SaveAsSafetyMatrix(sources));

await writeJson("async-schedule-matrix-report.json", asyncSchedule);
await writeJson("round-trip-matrix-v2-report.json", roundTrip);
await writeJson("lifecycle-memory-stress-report.json", lifecycle);
await writeJson("performance-operation-matrix.json", performance);
await writeJson("flake-stability-v2-report.json", flake);
await writeJson("reserve-model-history-report.json", reserve);
await writeJson("fifty-resource-fixture-report.json", fifty);
await writeJson("mutation-detection-report.json", mutation);
await writeJson("accessibility-keyboard-error-semantics-audit-report.json", accessibility);
await writeJson("save-as-safety-matrix-report.json", saveAs);

const privacyAudit = withMeta(await buildPrivacyAudit());
await writeJson("bundle-privacy-audit.json", privacyAudit);
const artifactIndex = withMeta(await buildArtifactIndex());
await writeJson("artifact-index.json", artifactIndex);

const passed = [
  asyncSchedule,
  roundTrip,
  lifecycle,
  performance,
  flake,
  reserve,
  fifty,
  mutation,
  accessibility,
  saveAs,
  privacyAudit
].every((report) => report.passed !== false);

console.log(JSON.stringify({
  artifactRoot: ".artifacts/product/NQ1-R1",
  passed,
  reportCount: artifactIndex.artifacts.length,
  headCommit
}, null, 2));

if (!passed) process.exitCode = 1;

function withMeta(report) {
  return {
    ...report,
    generatedAt,
    headCommit
  };
}

async function writeJson(fileName, value) {
  await writeFile(path.join(artifactRoot, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

async function buildArtifactIndex() {
  const files = (await readdir(artifactRoot)).filter((file) => file.endsWith(".json") && file !== "artifact-index.json").sort();
  const artifacts = [];
  for (const file of files) {
    const absolute = path.join(artifactRoot, file);
    const bytes = await readFile(absolute);
    const info = await stat(absolute);
    artifacts.push({
      path: `.artifacts/product/NQ1-R1/${file}`,
      sizeBytes: info.size,
      sha256: sha256(bytes)
    });
  }
  return {
    schemaVersion: 1,
    milestoneId: "NQ1-R1",
    reportId: "artifact-index",
    passed: artifacts.length >= 11,
    artifactCount: artifacts.length,
    artifacts
  };
}

async function buildPrivacyAudit() {
  const files = (await readdir(artifactRoot)).filter((file) => file.endsWith(".json")).sort();
  const patterns = [
    { id: "posix_user_path", re: /\/Users\// },
    { id: "home_user_path", re: /\/home\/[^/]+/ },
    { id: "windows_user_path", re: /[A-Za-z]:\\Users\\/ },
    { id: "repo_username", re: /huangtengxin/ },
    { id: "old_nq1_head_short", re: /3c2a8f/ },
    { id: "allowed_upload_pointer", re: /allowedUploadPointer\s*[:=]\s*true/ }
  ];
  const findings = [];
  for (const file of files) {
    if (file === "bundle-privacy-audit.json") continue;
    const text = await readFile(path.join(artifactRoot, file), "utf8");
    for (const pattern of patterns) {
      if (pattern.re.test(text)) {
        findings.push({ file: `.artifacts/product/NQ1-R1/${file}`, pattern: pattern.id });
      }
    }
  }
  return {
    schemaVersion: 1,
    milestoneId: "NQ1-R1",
    reportId: "bundle-privacy-audit",
    passed: findings.length === 0,
    findingCount: findings.length,
    blockingFindingCount: findings.length,
    scannedFileCount: files.length,
    allowedUploadPointer: false,
    findings
  };
}

async function readText(relativePath) {
  return await readFile(path.join(repoRoot, relativePath), "utf8");
}

function git(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function buildFlakeStabilityV2() {
  const staticReport = helper.buildNq1R1FlakeStabilityReport(sources);
  const groups = [
    {
      id: "core-targeted-tests",
      repetitions: 5,
      command: "node --test dist/tests/nq1-history-model.test.js dist/tests/nq1-async-race.test.js dist/tests/nq1-r1-hardening.test.js",
      cmd: process.execPath,
      args: [
        "--test",
        "dist/tests/nq1-history-model.test.js",
        "dist/tests/nq1-async-race.test.js",
        "dist/tests/nq1-r1-hardening.test.js"
      ],
      timeoutMs: 120_000
    },
    {
      id: "electron-prototype-tests",
      repetitions: 3,
      command: "npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test",
      cmd: process.platform === "win32" ? "npm.cmd" : "npm",
      args: ["--prefix", "tools/electron-prototype/experiments/svga-web", "run", "spike:svga-web:test"],
      timeoutMs: 240_000
    },
    {
      id: "desktop-product-smoke",
      repetitions: 3,
      command: "AUTO_SVGA_PRODUCT_MILESTONE=P4 npm run desktop:smoke",
      cmd: process.platform === "win32" ? "npm.cmd" : "npm",
      args: ["run", "desktop:smoke"],
      timeoutMs: 240_000,
      env: { AUTO_SVGA_PRODUCT_MILESTONE: "P4" }
    },
    {
      id: "round-trip-subset",
      repetitions: 3,
      command: "node --test dist/tests/nq1-round-trip-matrix.test.js",
      cmd: process.execPath,
      args: ["--test", "dist/tests/nq1-round-trip-matrix.test.js"],
      timeoutMs: 120_000
    }
  ];
  const repeatedRunGroups = [];
  const repeatedRunDetails = [];
  for (const group of groups) {
    const runs = [];
    for (let index = 1; index <= group.repetitions; index += 1) {
      const result = await runCommand(group, index);
      runs.push(result);
      repeatedRunDetails.push(result);
    }
    repeatedRunGroups.push({
      id: group.id,
      command: group.command,
      expectedRepetitions: group.repetitions,
      actualRepetitions: runs.length,
      passCount: runs.filter((run) => run.status === "pass").length,
      failCount: runs.filter((run) => run.status !== "pass").length,
      durationsMs: runs.map((run) => run.durationMs)
    });
  }
  return {
    ...staticReport,
    passed: staticReport.passed && repeatedRunGroups.every((group) => group.failCount === 0 && group.actualRepetitions === group.expectedRepetitions),
    repeatedRunGroups,
    repeatedRunDetails
  };
}

function runCommand(group, runIndex) {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const result = spawnSync(group.cmd, group.args, {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: group.timeoutMs,
    env: {
      ...process.env,
      ...(group.env ?? {}),
      AUTO_SVGA_NQ1_R1_FLAKE_STABILITY: "1"
    },
    maxBuffer: 20 * 1024 * 1024
  });
  const finishedAtMs = Date.now();
  const status = result.status === 0 ? "pass" : "fail";
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return {
    groupId: group.id,
    runIndex,
    command: group.command,
    status,
    exitCode: result.status,
    signal: result.signal ?? null,
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    failureExcerpt: status === "pass" ? null : lastLines(output, 40)
  };
}

function lastLines(text, count) {
  return text.split(/\r?\n/).filter(Boolean).slice(-count).join("\n");
}
