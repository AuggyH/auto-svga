#!/usr/bin/env node
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  cp,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createPreviewServer } from "../svga-player-preview/server.mjs";
import {
  buildP6ParityReportFromRuntimeFacts,
  loadP6RuntimeFacts,
  validateP6RuntimeScenarioContract
} from "./parity-runner.mjs";
import { generateP6StateAndMotionEvidence } from "./runtime-scenarios/state-evidence.mjs";
import { generateP6StrictRuntimeEvidence } from "./runtime-scenarios/strict-evidence.mjs";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptRoot, "../..");
const milestoneId = "P6";
const p6Root = path.join(repoRoot, ".artifacts/product/P6");
const webBaselineRoot = path.join(p6Root, "web-baseline");
const packagedRuntimeRoot = path.join(p6Root, "packaged-app-runtime");
const docsProductRoot = path.join(repoRoot, "docs/product");
const contractPath = path.join(docsProductRoot, "P6_WEB_PARITY_CONTRACT.json");
const paritySnapshotPath = path.join(docsProductRoot, "P6_PARITY_REPORT_SNAPSHOT.json");
const evidenceIndexPath = path.join(docsProductRoot, "P6_EVIDENCE_INDEX.md");
const sourceTrackedSnapshotHead = "source-tracked-runtime-snapshot";
const electronBin = path.join(repoRoot, "tools/electron-prototype/node_modules/.bin/electron");
const experimentRoot = path.join(repoRoot, "tools/electron-prototype/experiments/svga-web");
const fixturePath = path.join(repoRoot, "examples/avatar_frame_basic/output/avatar_frame_basic.svga");
const packagedBinary = path.join(
  experimentRoot,
  ".artifacts/internal-trial/Auto SVGA-darwin-arm64/Auto SVGA.app/Contents/MacOS/Auto SVGA"
);
const packageManifestPath = path.join(experimentRoot, ".artifacts/internal-trial/internal-trial-manifest.json");
const packageArchivePath = path.join(experimentRoot, ".artifacts/internal-trial/Auto SVGA-darwin-arm64.zip");
const skipTrackedSnapshots = process.env.AUTO_SVGA_SKIP_TRACKED_SNAPSHOTS === "1";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: "utf8",
    maxBuffer: 80 * 1024 * 1024,
    timeout: options.timeout,
    stdio: options.stdio ?? "pipe"
  });
  if (result.status !== 0) {
    throw new Error([
      `${command} ${args.join(" ")} failed with ${result.status}`,
      result.stdout?.trim(),
      result.stderr?.trim()
    ].filter(Boolean).join("\n"));
  }
  return result;
}

function runAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: options.stdio ?? "inherit"
    });
    const timeout = options.timeout
      ? setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`${command} ${args.join(" ")} timed out after ${options.timeout}ms`));
      }, options.timeout)
      : undefined;
    child.once("error", (error) => {
      if (timeout) clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      if (timeout) clearTimeout(timeout);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with ${code ?? signal}`));
      }
    });
  });
}

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

async function sha256File(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function toRepoPath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function artifactIdFor(repoPath) {
  return repoPath
    .replace(/^\.artifacts\/product\/P6\//, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function mediaTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".json") return "application/json";
  if (ext === ".md") return "text/markdown";
  if (ext === ".png") return "image/png";
  if (ext === ".svga") return "application/octet-stream";
  if (ext === ".zip") return "application/zip";
  return "application/octet-stream";
}

async function collectFiles(root) {
  const out = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".")) continue;
        await walk(absolute);
      } else if (entry.isFile()) {
        out.push(absolute);
      }
    }
  }
  if (existsSync(root)) await walk(root);
  return out.sort((a, b) => toRepoPath(a).localeCompare(toRepoPath(b)));
}

async function artifactBinding(filePath, role) {
  const bytes = await readFile(filePath);
  const repoPath = toRepoPath(filePath);
  return {
    id: artifactIdFor(repoPath),
    path: repoPath,
    role,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sizeBytes: bytes.byteLength,
    mediaType: mediaTypeFor(filePath)
  };
}

async function startWebPreviewServer() {
  const server = createPreviewServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Preview server did not return a port.");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}


async function captureWebBaseline() {
  const server = await startWebPreviewServer();
  const captureEntry = path.join(scriptRoot, "p6-web-baseline-capture.cjs");
  await rm(webBaselineRoot, { recursive: true, force: true });
  await mkdir(webBaselineRoot, { recursive: true });
  try {
    await runAsync(electronBin, [captureEntry], {
      cwd: repoRoot,
      env: {
        AUTO_SVGA_WEB_BASELINE_URL: `${server.origin}/tools/svga-player-preview/`,
        AUTO_SVGA_WEB_BASELINE_FIXTURE_URL: `${server.origin}/examples/avatar_frame_basic/output/avatar_frame_basic.svga`,
        AUTO_SVGA_WEB_BASELINE_OUT: webBaselineRoot,
        AUTO_SVGA_WEB_BASELINE_CONTRACT: contractPath
      },
      stdio: "inherit",
      timeout: 120_000
    });
  } finally {
    await server.close();
  }
}

async function runDesktopSmoke() {
  run("npm", ["run", "desktop:smoke"], {
    env: {
      AUTO_SVGA_PRODUCT_MILESTONE: milestoneId,
      AUTO_SVGA_PRODUCT_ARTIFACTS: p6Root
    },
    stdio: "inherit"
  });
}

async function runPackageAndPackagedNormalProof() {
  run("npm", ["--prefix", "tools/electron-prototype/experiments/svga-web", "run", "internal:trial:package:mac"], {
    stdio: "inherit"
  });
  await mkdir(packagedRuntimeRoot, { recursive: true });
  const startedAt = new Date().toISOString();
  const result = run(packagedBinary, [], {
    cwd: repoRoot,
    env: {
      AUTO_SVGA_P2_NORMAL_PROOF: "1",
      AUTO_SVGA_PRODUCT_MILESTONE: milestoneId,
      AUTO_SVGA_PRODUCT_ARTIFACTS: packagedRuntimeRoot,
      AUTO_SVGA_ACTUAL_LAUNCH_COMMAND: "packaged Auto SVGA.app"
    }
  });
  const stdout = result.stdout ?? "";
  const match = stdout.match(/AUTO_SVGA_DESKTOP_NORMAL_PROOF (\{[^\n]+\})/);
  if (!match) throw new Error("Packaged app normal proof did not emit AUTO_SVGA_DESKTOP_NORMAL_PROOF.");
  const normalProof = JSON.parse(match[1]);
  const detailedNormalProofPath = path.join(packagedRuntimeRoot, "normal-runtime-proof.json");
  const detailedNormalProof = existsSync(detailedNormalProofPath)
    ? await readJson(detailedNormalProofPath)
    : null;
  const proof = {
    schemaVersion: 1,
    milestoneId,
    launchTarget: "packaged .app executable without smoke flags",
    executablePath: toRepoPath(packagedBinary),
    startedAt,
    exitCode: result.status ?? 0,
    normalProof,
    fixtureSha256: detailedNormalProof?.fixtureSha256
      ?? detailedNormalProof?.runtimeIdentity?.fixtureSha256
      ?? null,
    runtimeIdentity: detailedNormalProof?.runtimeIdentity ?? null,
    passed: normalProof.passed === true,
    stdoutTail: redact(stdout).split("\n").slice(-20),
    stderrTail: redact(result.stderr ?? "").split("\n").slice(-20),
    generatedAt: new Date().toISOString()
  };
  await writeJson(path.join(p6Root, "packaged-app-runtime-proof.json"), proof);
  if (!proof.passed) throw new Error("Packaged app normal proof failed.");
  if (existsSync(packageManifestPath)) {
    await cp(packageManifestPath, path.join(p6Root, "internal-trial-manifest.json"));
  }
  if (existsSync(packageArchivePath)) {
    await cp(packageArchivePath, path.join(p6Root, "Auto-SVGA-macOS-internal-runtime.zip"));
  }
  await writeNormalSmokeParityProof();
  await writeReviewerBEvidenceRequest();
}

async function writeNormalSmokeParityProof() {
  const normalProofPath = path.join(packagedRuntimeRoot, "normal-runtime-proof.json");
  const smokeIdentityPath = path.join(p6Root, "runtime-identity.json");
  if (!existsSync(normalProofPath) || !existsSync(smokeIdentityPath)) return;
  const normalProof = await readJson(normalProofPath);
  const normalIdentity = normalProof.runtimeIdentity;
  const smokeIdentity = await readJson(smokeIdentityPath);
  const checks = {
    separateProcessId: normalIdentity.processId !== smokeIdentity.processId,
    separateRuntimeInstanceId: normalIdentity.runtimeInstanceId !== smokeIdentity.runtimeInstanceId,
    mainEntry: normalIdentity.mainEntry === smokeIdentity.mainEntry,
    preloadEntry: normalIdentity.preloadEntry === smokeIdentity.preloadEntry,
    rendererEntry: normalIdentity.rendererEntry === smokeIdentity.rendererEntry,
    indexHtmlSha256: normalIdentity.indexHtmlSha256 === smokeIdentity.indexHtmlSha256,
    rendererJsSha256: normalIdentity.rendererJsSha256 === smokeIdentity.rendererJsSha256,
    stylesCssSha256: normalIdentity.stylesCssSha256 === smokeIdentity.stylesCssSha256,
    preloadSha256: normalIdentity.preloadSha256 === smokeIdentity.preloadSha256,
    mainSha256: normalIdentity.mainSha256 === smokeIdentity.mainSha256,
    productIdentity: normalIdentity.productIdentity === smokeIdentity.productIdentity,
    player: normalIdentity.player === smokeIdentity.player,
    csp: normalIdentity.csp === smokeIdentity.csp,
    loadingPipelineIdentity: normalIdentity.loadingPipelineIdentity === smokeIdentity.loadingPipelineIdentity,
    cleanupPipelineIdentity: normalIdentity.cleanupPipelineIdentity === smokeIdentity.cleanupPipelineIdentity
  };
  await writeJson(path.join(p6Root, "normal-smoke-parity.json"), {
    schemaVersion: 1,
    milestoneId,
    headCommit: git(["rev-parse", "HEAD"]),
    normalMode: normalIdentity.mode,
    smokeMode: smokeIdentity.mode,
    normalProcessId: normalIdentity.processId,
    smokeProcessId: smokeIdentity.processId,
    normalRuntimeInstanceId: normalIdentity.runtimeInstanceId,
    smokeRuntimeInstanceId: smokeIdentity.runtimeInstanceId,
    passed: Object.values(checks).every(Boolean),
    checks,
    allowedDifferences: [
      "mode",
      "rendererUrl query parameters",
      "test-only automation trigger",
      "deterministic fixture selection",
      "screenshot capture",
      "process cleanup"
    ],
    generatedAt: new Date().toISOString()
  });
}

async function artifactEvidence(repoPath) {
  const absolute = path.join(repoRoot, repoPath);
  return {
    path: repoPath,
    sha256: existsSync(absolute) ? await sha256File(absolute) : null,
    present: existsSync(absolute)
  };
}

async function writeReviewerBEvidenceRequest() {
  const categories = [
    ["productIdentity", "Confirm product identity and internal prototype labels using concrete Desktop runtime evidence.", "desktop-loaded.png"],
    ["toolbarAndModes", "Confirm toolbar and mode controls against loaded Desktop state geometry and controls.", "desktop-loaded.png"],
    ["localPreview", "Confirm local SVGA preview renders from the repository fixture in Electron.", "desktop-loaded.png"],
    ["exportReview", "Confirm export-review parity with Web and Desktop state evidence.", "web-baseline/screenshot-export-review-loaded-1440x900.png"],
    ["comparison", "Confirm comparison mode with strict interaction and state evidence.", "interaction-parity-report.json"],
    ["referenceMedia", "Confirm reference media selection and player controls.", "web-baseline/screenshot-info-assets-1440x900.png"],
    ["playbackControls", "Confirm playback controls and timeline values.", "desktop-loaded.png"],
    ["fitControls", "Confirm fit controls and rendered geometry.", "desktop-loaded.png"],
    ["synchronizedPlayback", "Confirm synchronized playback from real keyboard/click traces.", "interaction-parity-report.json"],
    ["inspectionOverview", "Confirm inspection overview side panel content and geometry.", "web-baseline/screenshot-info-overview-1440x900.png"],
    ["assetDetails", "Confirm asset detail evidence and resource panels.", "web-baseline/screenshot-info-assets-1440x900.png"],
    ["motionAssetAudit", "Confirm Motion Asset Audit read-only panel in Desktop and Web evidence.", "desktop-inspection.png"],
    ["runtimeLogs", "Confirm runtime log panel content and controls.", "web-baseline/screenshot-logs-1440x900.png"],
    ["settings", "Confirm settings panel geometry, values, and close behavior.", "web-baseline/screenshot-settings-1440x900.png"],
    ["theme", "Confirm theme state through computed style and screenshot evidence.", "web-baseline/computed-styles-manifest.json"],
    ["accessibilitySettings", "Confirm reduced motion and blur settings with control values.", "interaction-parity-report.json"],
    ["emptyState", "Confirm Desktop empty state differs from loading.", "desktop-empty.png"],
    ["loadingState", "Confirm loading DOM, rect, overlay, and full screenshot share one stateSnapshotId.", "desktop-loading.png"],
    ["invalidState", "Confirm invalid state clears stale canvas, filename, and metadata.", "desktop-invalid.png"],
    ["responsiveLayout", "Confirm responsive Web/Desktop geometry at the required viewport.", "web-baseline/screenshot-export-review-loaded-900x720.png"],
    ["interactionParity", "Confirm Web and Desktop strict interaction traces are host-neutral and matching.", "interaction-parity-report.json"],
    ["motionParity", "Confirm motion start/mid/end, crop, geometry, params, and reduced-motion comparison.", "web-baseline/motion-manifest.json"],
    ["normalMacApp", "Confirm packaged macOS app proof uses normal runtime flags.", "packaged-app-runtime-proof.json"],
    ["bundleCompleteness", "Confirm internal trial manifest and App ZIP are present.", "internal-trial-manifest.json"],
    ["bundlePrivacy", "Confirm request audit and runtime identity evidence show local-only behavior.", "web-baseline/request-audit.json"]
  ];
  const categoryRecords = [];
  for (const [category, request, fragment] of categories) {
    const repoPath = `.artifacts/product/P6/${fragment}`;
    categoryRecords.push({
      category,
      request,
      evidenceNeeded: [await artifactEvidence(repoPath)],
      reviewerMustProvide: [
        "visualObservation",
        "runtimeBehaviorObservation",
        "approvedDifferenceAssessment"
      ]
    });
  }
  await writeJson(path.join(p6Root, "reviewer-b-evidence-request.json"), {
    schemaVersion: 2,
    milestoneId,
    headCommit: git(["rev-parse", "HEAD"]),
    categoryCount: categoryRecords.length,
    categories: categoryRecords,
    generationPolicy: "A4 request-only evidence checklist. This file is not a Reviewer B verdict and cannot mark parity PASS.",
    generatedAt: new Date().toISOString()
  });
}

function redact(text) {
  const macUserPathPattern = new RegExp(String.raw`/${"Users"}/[^/\s]+`, "g");
  const macUserPathRedaction = ["", "Users", "<redacted>"].join("/");
  return String(text)
    .replaceAll(repoRoot, "<repo>")
    .replace(macUserPathPattern, macUserPathRedaction);
}

function requiredCountsFromContract(contract) {
  return {
    visual_parity: contract.requiredCounts?.regions ?? contract.regions.length,
    feature_parity: contract.requiredCounts?.features ?? contract.features.length,
    interaction_parity: contract.requiredCounts?.interactions ?? contract.interactions.length,
    state_parity: contract.requiredCounts?.states ?? contract.states.length,
    motion_parity: contract.requiredCounts?.motions ?? contract.motions.length,
    browser_regression: 3,
    desktop_runtime_proof: 3,
    security_audit: 3,
    accessibility_report: 2,
    artifact_index: 1
  };
}

async function buildArtifactIndex() {
  const files = (await collectFiles(p6Root)).filter((filePath) => existsSync(filePath));
  const bindings = [];
  for (const filePath of files) {
    if (filePath.includes("/.web-baseline-capture/")) continue;
    if (filePath.endsWith("p6-parity-report.json")) continue;
    const repoPath = toRepoPath(filePath);
    const role = repoPath.includes("/web-baseline/")
      ? "web_baseline"
      : repoPath.includes("/packaged-app-runtime")
        ? "packaged_app_runtime"
        : repoPath.includes("desktop")
          ? "desktop_runtime_proof"
          : repoPath.startsWith("docs/product/")
            ? "p6_evidence_snapshot"
            : "p6_evidence";
    bindings.push(await artifactBinding(filePath, role));
  }
  return bindings;
}

async function buildParityReport() {
  const contract = await readJson(contractPath);
  const runtimeHeadCommit = git(["rev-parse", "HEAD"]);
  const headCommit = skipTrackedSnapshots ? runtimeHeadCommit : sourceTrackedSnapshotHead;
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const artifactBindings = await buildArtifactIndex();
  const requiredCounts = requiredCountsFromContract(contract);
  const runtimeFacts = await loadP6RuntimeFacts({
    repoRoot,
    p6Root,
    contract,
    artifactBindings
  });
  const scenarioValidation = validateP6RuntimeScenarioContract(runtimeFacts);
  if (!scenarioValidation.valid) {
    console.warn(`P6 runtime scenario contract gaps: ${scenarioValidation.failures.join("; ")}`);
  }
  const report = buildP6ParityReportFromRuntimeFacts({
    ...runtimeFacts,
    requiredCounts,
    source: {
      baseCommit: contract.baselineCommit,
      headCommit,
      branch
    }
  });
  await writeJson(path.join(p6Root, "p6-parity-report.json"), report);
  if (!skipTrackedSnapshots) {
    await writeJson(paritySnapshotPath, report);
  }
  return report;
}

async function validateParityReport(report) {
  const { validateP6ParityReportV1 } = await import(pathToFileURL(
    path.join(repoRoot, "dist/workbench/p6-parity-report-contract.js")
  ).href);
  const contract = await readJson(contractPath);
  const requiredCounts = requiredCountsFromContract(contract);
  const validation = validateP6ParityReportV1(report, { requiredEvidenceCounts: requiredCounts });
  if (!validation.valid) throw new Error(`P6 parity report validation failed: ${validation.errors.join("; ")}`);
  const nonPass = [];
  for (const [key, section] of Object.entries(report.sections)) {
    if (section.status !== "pass") nonPass.push(`${key}:${section.status}`);
    for (const evidence of section.evidence) {
      if (evidence.status !== "pass") nonPass.push(`${key}.${evidence.id}:${evidence.status}`);
    }
    for (const item of section.items ?? []) {
      if (item.status !== "pass") nonPass.push(`${key}.${item.id}:${item.status}:${item.failures.join("|")}`);
    }
  }
  return nonPass;
}

async function writeEvidenceIndex(report) {
  const artifacts = report.sections.artifactIndex.artifacts;
  const keyArtifacts = artifacts
    .filter((artifact) => (
      artifact.path.includes("p6-parity-report")
      || artifact.path.includes("web-baseline")
      || artifact.path.includes("packaged-app-runtime-proof")
      || artifact.path.includes("internal-trial-manifest")
    ))
    .slice(0, 40);
  const lines = [
    "# P6 Evidence Index",
    "",
    ...(skipTrackedSnapshots
      ? [
        `Generated at: ${report.generatedAt}`,
        `Head commit: \`${report.source.headCommit}\``
      ]
      : [
        "Generated at: source-tracked runtime snapshot",
        `Head commit: \`${sourceTrackedSnapshotHead}\``,
        "",
        "This source-tracked file is intentionally commit-neutral. Final head-bound",
        "P6 evidence is generated into `.artifacts/product/P6/` and mirrored into",
        "`review/P6-latest/` during handoff."
      ]),
    `Branch: \`${report.source.branch}\``,
    "",
    "## Status",
    "",
    "- Web baseline artifacts: generated under `.artifacts/product/P6/web-baseline/`.",
    "- P6 parity report: generated as `.artifacts/product/P6/p6-parity-report.json`; `docs/product/P6_PARITY_REPORT_SNAPSHOT.json` is a source-tracked runtime snapshot.",
    "- Packaged app runtime proof: generated as `.artifacts/product/P6/packaged-app-runtime-proof.json`.",
    "- Final review packets bind generated evidence by path and SHA-256 from `.artifacts/product/P6/` and the visible `review/P6-latest/` mirror.",
    "",
    "## Section Summary",
    "",
    ...Object.entries(report.sections).map(([key, section]) => (
      `- ${key}: ${section.status}, evidence ${section.evidence.length}/${section.requiredEvidenceCount}, inventory ${section.inventory.itemCount}`
    )),
    "",
    "## Key Artifact Hashes",
    "",
    "| Role | Path | Size | SHA-256 |",
    "| --- | --- | ---: | --- |",
    ...keyArtifacts.map((artifact) => `| ${artifact.role} | \`${artifact.path}\` | ${artifact.sizeBytes} | \`${artifact.sha256}\` |`),
    "",
    "## Protected Flows",
    "",
    "- Main Web Preview player implementation: not modified by this evidence generator.",
    "- SVGA exporter: not modified.",
    "- CLI default flow: not modified.",
    "- Browser import, drag-drop, and comparison logic: not modified.",
    ""
  ];
  const outputPath = skipTrackedSnapshots
    ? path.join(p6Root, "P6_EVIDENCE_INDEX.md")
    : evidenceIndexPath;
  await writeFile(outputPath, `${lines.join("\n")}`);
}

async function main() {
  await rm(p6Root, { recursive: true, force: true });
  await mkdir(p6Root, { recursive: true });

  run("npm", ["run", "build"], { stdio: "inherit" });
  await captureWebBaseline();
  await runDesktopSmoke();
  await runPackageAndPackagedNormalProof();
  await generateP6StateAndMotionEvidence({
    p6Root,
    contract: await readJson(contractPath)
  });
  await generateP6StrictRuntimeEvidence({
    p6Root,
    contract: await readJson(contractPath)
  });

  let report = await buildParityReport();
  await writeEvidenceIndex(report);
  report = await buildParityReport();
  await writeEvidenceIndex(report);
  report = await buildParityReport();
  const nonPassEvidence = await validateParityReport(report);

  console.log(JSON.stringify({
    milestoneId,
    headCommit: report.source.headCommit,
    parityStatus: nonPassEvidence.length === 0 ? "pass" : "human_required",
    nonPassEvidenceCount: nonPassEvidence.length,
    nonPassEvidence: nonPassEvidence.slice(0, 40),
    artifactRoot: toRepoPath(p6Root),
    parityReport: toRepoPath(path.join(p6Root, "p6-parity-report.json")),
    paritySnapshot: skipTrackedSnapshots ? null : toRepoPath(paritySnapshotPath),
    evidenceIndex: skipTrackedSnapshots
      ? toRepoPath(path.join(p6Root, "P6_EVIDENCE_INDEX.md"))
      : toRepoPath(evidenceIndexPath),
    artifactCount: report.sections.artifactIndex.artifacts.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
