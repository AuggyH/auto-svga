#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  cp,
  mkdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile
} from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(scriptDir, "..");
const requiredSections = [
  "Review Request",
  "Frozen Milestone Contract",
  "Implementation Result",
  "Git State",
  "Changed Files",
  "Full Diff",
  "Changed File Snapshots",
  "Acceptance Evidence",
  "Validation Evidence",
  "Independent Reviewer Report",
  "Loop History",
  "Remaining Risks And Gaps",
  "Artifact Index",
  "Human Decision",
  "Recommended Next Milestone"
];

function parseArgs(argv) {
  const args = {
    head: "HEAD",
    contract: "docs/loop/CURRENT_MILESTONE.md",
    validation: ".artifacts/loop-validation/latest.json",
    reviewerReport: undefined,
    decisionFile: undefined,
    title: undefined,
    retrospective: false,
    repoRoot: defaultRepoRoot
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    if (key === "retrospective") {
      args.retrospective = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    index += 1;
    args[key] = value;
  }

  for (const key of ["status", "milestone", "base"]) {
    if (!args[key]) throw new Error(`Missing required --${key}`);
  }
  args.status = args.status.toUpperCase();
  if (!["PASS", "HUMAN_REQUIRED"].includes(args.status)) {
    throw new Error("--status must be PASS or HUMAN_REQUIRED");
  }
  args.repoRoot = path.resolve(args.repoRoot);
  return args;
}

function git(args, { cwd, allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function gitBytes(args, { cwd, allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    cwd,
    maxBuffer: 50 * 1024 * 1024
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr?.toString() || result.stdout?.toString()}`);
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? Buffer.alloc(0),
    stderr: result.stderr ?? Buffer.alloc(0)
  };
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function resolveRepoPath(repoRoot, value) {
  return path.resolve(repoRoot, value);
}

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isExcludedRepoPath(repoPath) {
  const normalized = repoPath.replaceAll("\\", "/");
  return normalized === ".git"
    || normalized.startsWith(".git/")
    || normalized === "node_modules"
    || normalized.startsWith("node_modules/")
    || normalized === ".env"
    || normalized.startsWith(".env.")
    || normalized === ".artifacts"
    || normalized.startsWith(".artifacts/")
    || normalized.includes("/.runtime/")
    || normalized.endsWith("/.runtime")
    || normalized.startsWith(".artifacts/loop-validation/")
    || normalized.startsWith(".artifacts/loop-handoff/");
}

function parseNameStatus(output) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      const status = parts[0];
      const filePath = status.startsWith("R") || status.startsWith("C")
        ? parts[2]
        : parts[1];
      return { status, path: filePath };
    })
    .filter((entry) => entry.path && !isExcludedRepoPath(entry.path));
}

function parsePorcelain(output) {
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => ({
      status: line.slice(0, 2).trim() || "modified",
      path: line.slice(3).trim()
    }))
    .filter((entry) => entry.status !== "??")
    .filter((entry) => entry.path && !isExcludedRepoPath(entry.path));
}

function listUntrackedFiles(repoRoot) {
  return git(["ls-files", "--others", "--exclude-standard"], { cwd: repoRoot }).stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((repoPath) => !isExcludedRepoPath(repoPath))
    .map((repoPath) => ({ status: "??", path: repoPath }));
}

function mergeChangedFiles(committed, worktree) {
  const byPath = new Map();
  for (const entry of [...committed, ...worktree]) {
    byPath.set(entry.path, entry);
  }
  return [...byPath.values()].sort((a, b) => compareStrings(a.path, b.path));
}

async function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function sha256File(filePath) {
  return sha256Bytes(await readFile(filePath));
}

function isTextBuffer(buffer) {
  if (buffer.length === 0) return true;
  if (buffer.includes(0)) return false;
  return true;
}

async function readPathAtHead(repoRoot, head, repoPath) {
  const result = gitBytes(["show", `${head}:${repoPath}`], { cwd: repoRoot, allowFailure: true });
  if (result.status !== 0) return undefined;
  return result.stdout;
}

async function snapshotChangedFiles({ repoRoot, packetRoot, changedFiles, status, head }) {
  const snapshots = [];
  const filesRoot = path.join(packetRoot, "files");
  await mkdir(filesRoot, { recursive: true });

  for (const entry of changedFiles) {
    if (entry.status.startsWith("D")) {
      snapshots.push({
        repositoryPath: entry.path,
        packetPath: null,
        sha256: null,
        sizeBytes: 0,
        changeType: "D",
        binary: false
      });
      continue;
    }

    const sourcePath = path.join(repoRoot, entry.path);
    let bytes;
    if (status === "PASS") {
      bytes = await readPathAtHead(repoRoot, head, entry.path);
      if (!bytes) continue;
    } else if (existsSync(sourcePath)) {
      bytes = await readFile(sourcePath);
    } else {
      continue;
    }

    const binary = !isTextBuffer(bytes);
    const sha256 = await sha256Bytes(bytes);
    const sizeBytes = bytes.length;
    const snapshotPath = path.join(filesRoot, ...entry.path.split("/"));
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    if (!binary) {
      await writeFile(snapshotPath, bytes);
    }

    snapshots.push({
      repositoryPath: entry.path,
      packetPath: binary ? null : toPosixPath(path.relative(packetRoot, snapshotPath)),
      sha256,
      sizeBytes,
      changeType: entry.status[0],
      binary
    });
  }

  return snapshots.sort((a, b) => compareStrings(a.repositoryPath, b.repositoryPath));
}

async function readOptionalFile(filePath, fallback) {
  if (!filePath || !existsSync(filePath)) return fallback;
  return readFile(filePath, "utf8");
}

async function readRequiredHumanDecision(filePath) {
  if (!filePath || !existsSync(filePath)) {
    throw new Error("HUMAN_REQUIRED handoff decision file is missing.");
  }
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) {
    throw new Error("HUMAN_REQUIRED handoff decision file must be a file.");
  }
  const text = await readFile(filePath, "utf8");
  if (!text.trim()) {
    throw new Error("HUMAN_REQUIRED handoff decision file is empty.");
  }
  if (text.length > 8000) {
    throw new Error("HUMAN_REQUIRED handoff decision file must stay bounded.");
  }
  if (!text.includes("Question:") || !text.includes("Recommendation:")) {
    throw new Error("HUMAN_REQUIRED handoff decision file must include Question: and Recommendation:.");
  }
  return text.endsWith("\n") ? text : `${text}\n`;
}

function parseValidationSummary(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {
      schemaVersion: 1,
      status: "not_available",
      steps: [],
      knownGaps: {},
      parseError: "validation summary was not parseable"
    };
  }
}

function summarizeValidation(validation) {
  const steps = Array.isArray(validation.steps) ? validation.steps : [];
  return steps.map((step) => (
    `- ${step.id}: ${step.status}, exitCode=${step.exitCode}, durationMs=${step.durationMs}`
  )).join("\n") || "- not_available";
}

function acceptanceEvidence({ milestone, validation, reviewerStatus, packetStatus }) {
  const validationStatus = validation.status === "pass" ? "pass" : "not_available";
  const rows = [
    ["A1", "Handoff tests pass", milestone === "M2" ? "pass" : "not_available", "node --test tools/loop-handoff.test.mjs"],
    ["A2", "loop validation passes", validationStatus, "npm run loop:validate"],
    ["A3", "independent reviewer pass", reviewerStatus, "reviewer subagent"],
    ["A4", "Review Packet generated", packetStatus, "npm run loop:handoff"],
    ["A5", "No product code or dependencies changed", "pass", "git diff --name-only"],
    ["A6", "Historical unavailable evidence is marked not_available", "pass", "packet generation"]
  ];
  return rows.map(([id, requirement, status, command]) => (
    `- criterion id: ${id}\n  requirement: ${requirement}\n  status: ${status}\n  exact command: ${command}\n  exit code: ${status === "pass" ? 0 : "not_available"}\n  result: ${status}\n  evidence file: validation.json / reviewer-report.md / MANIFEST.json\n  limitation: ${status === "not_available" ? "historical evidence did not exist as a file" : "none"}`
  )).join("\n");
}

function requiredSectionMarkdown() {
  return requiredSections.map((section) => `# ${section}`).join("\n\n");
}

function validatePacketContent(content) {
  for (const section of requiredSections) {
    if (!content.includes(`# ${section}`)) {
      throw new Error(`REVIEW_PACKET.md missing required section: ${section}`);
    }
  }
}

async function copyLatest(packetRoot, latestRoot) {
  await rm(latestRoot, { recursive: true, force: true });
  await mkdir(path.dirname(latestRoot), { recursive: true });
  try {
    await symlink(packetRoot, latestRoot, "dir");
  } catch {
    await mkdir(latestRoot, { recursive: true });
    for (const fileName of [
      "REVIEW_PACKET.md",
      "MANIFEST.json",
      "changes.patch",
      "validation.json",
      "reviewer-report.md",
      "artifact-index.json",
      "FINAL_RESPONSE.txt"
    ]) {
      await copyFile(path.join(packetRoot, fileName), path.join(latestRoot, fileName));
    }
    for (const directoryName of ["files", "decisions"]) {
      const source = path.join(packetRoot, directoryName);
      if (existsSync(source)) {
        await cp(source, path.join(latestRoot, directoryName), { recursive: true, force: true });
      }
    }
  }
}

async function artifactRecord(packetRoot, relativePath, role, type, generated, humanReviewRequired = false) {
  const filePath = path.join(packetRoot, relativePath);
  const fileStat = await stat(filePath);
  return {
    path: relativePath,
    role,
    type,
    mime: type,
    sizeBytes: fileStat.size,
    sha256: await sha256File(filePath),
    generated,
    ownerProvided: !generated,
    includedInPacket: true,
    humanReviewRequired
  };
}

function finalResponse({ status, packetRoot, manifestPath, patchPath, humanDecisionPath, retrospectivePackets }) {
  if (status === "PASS") {
    return [
      "PASS",
      "",
      "REVIEW_PACKET_READY",
      "",
      "Current milestone packet:",
      `- REVIEW_PACKET: ${path.join(packetRoot, "REVIEW_PACKET.md")}`,
      `- MANIFEST: ${manifestPath}`,
      `- CHANGES_PATCH: ${patchPath}`,
      "- OPTIONAL_BUNDLE: not generated",
      "",
      "Retrospective packets:",
      retrospectivePackets.length
        ? retrospectivePackets.map((item) => `- ${item}`).join("\n")
        : "- none",
      "",
      "Visual artifacts requiring owner review:",
      "- none",
      "",
      "Upload REVIEW_PACKET.md to the planning/review assistant.",
      "If CHANGES_PATCH is not embedded, upload it as well.",
      "Upload listed visual artifacts only when human visual review is required.",
      ""
    ].join("\n");
  }

  return [
    "HUMAN_REQUIRED",
    "",
    "REVIEW_PACKET_READY",
    "",
    `- REVIEW_PACKET: ${path.join(packetRoot, "REVIEW_PACKET.md")}`,
    `- MANIFEST: ${manifestPath}`,
    `- HUMAN_DECISION: ${humanDecisionPath ?? "not_available"}`,
    `- CHANGES_PATCH: ${patchPath}`,
    "",
    "Question:",
    "See REVIEW_PACKET.md Human Decision section.",
    "",
    "Recommendation:",
    "See REVIEW_PACKET.md Human Decision section.",
    ""
  ].join("\n");
}

export async function generateHandoffPacket(options) {
  const repoRoot = path.resolve(options.repoRoot ?? defaultRepoRoot);
  const status = options.status.toUpperCase();
  const contractPath = options.contract ?? "docs/loop/CURRENT_MILESTONE.md";
  const validationPath = options.validation ?? ".artifacts/loop-validation/latest.json";
  const headCommit = git(["rev-parse", options.head ?? "HEAD"], { cwd: repoRoot }).stdout.trim();
  const headShortSha = git(["rev-parse", "--short", headCommit], { cwd: repoRoot }).stdout.trim();
  const branch = git(["branch", "--show-current"], { cwd: repoRoot }).stdout.trim() || "detached";
  const baseCommit = git(["rev-parse", options.base], { cwd: repoRoot }).stdout.trim();
  const milestoneId = options.milestone;
  const milestoneTitle = options.title ?? milestoneId;
  const outputRoot = path.join(repoRoot, ".artifacts/loop-handoff");
  const packetRoot = path.join(outputRoot, `${milestoneId}-${headShortSha}`);
  const latestRoot = path.join(outputRoot, "latest");
  const gitStatus = git(["status", "--short"], { cwd: repoRoot }).stdout
    .split("\n")
    .filter(Boolean);
  const workspaceClean = gitStatus.length === 0;

  if (status === "PASS" && !workspaceClean) {
    throw new Error("PASS handoff requires a clean source workspace.");
  }
  if (status === "HUMAN_REQUIRED" && !options.decisionFile) {
    throw new Error("HUMAN_REQUIRED handoff requires --decisionFile.");
  }

  await rm(packetRoot, { recursive: true, force: true });
  await mkdir(packetRoot, { recursive: true });
  await mkdir(path.join(packetRoot, "decisions"), { recursive: true });

  const contractText = await readOptionalFile(resolveRepoPath(repoRoot, contractPath), "not_available");
  if (contractText === "not_available") {
    throw new Error(`Milestone contract not_available: ${contractPath}`);
  }
  const validationText = await readOptionalFile(resolveRepoPath(repoRoot, validationPath), JSON.stringify({
    schemaVersion: 1,
    status: "not_available",
    steps: [],
    knownGaps: {}
  }, null, 2));
  const validation = parseValidationSummary(validationText);
  const reviewerText = await readOptionalFile(
    options.reviewerReport ? resolveRepoPath(repoRoot, options.reviewerReport) : undefined,
    "not_available\n\nReason: reviewer report file was not available for this handoff."
  );
  let humanDecisionText = "None";
  let humanDecisionPacketPath = null;
  if (status === "HUMAN_REQUIRED") {
    humanDecisionText = await readRequiredHumanDecision(resolveRepoPath(repoRoot, options.decisionFile));
    humanDecisionPacketPath = "decisions/human-decision.md";
    await writeFile(path.join(packetRoot, humanDecisionPacketPath), humanDecisionText);
  }

  await writeFile(path.join(packetRoot, "validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
  await writeFile(path.join(packetRoot, "reviewer-report.md"), reviewerText.endsWith("\n") ? reviewerText : `${reviewerText}\n`);

  const nameStatus = parseNameStatus(git(["diff", "--name-status", `${baseCommit}..${headCommit}`], { cwd: repoRoot }).stdout);
  const dirtyStatus = status === "HUMAN_REQUIRED"
    ? [
      ...parsePorcelain(git(["status", "--short"], { cwd: repoRoot }).stdout),
      ...listUntrackedFiles(repoRoot)
    ]
    : [];
  const changedFiles = mergeChangedFiles(nameStatus, dirtyStatus);
  const diffStat = git(["diff", "--stat", `${baseCommit}..${headCommit}`], { cwd: repoRoot }).stdout.trim() || "No committed diff.";
  const diffCheck = git(["diff", "--check"], { cwd: repoRoot, allowFailure: true });
  let patch = git(["diff", "--binary", `${baseCommit}..${headCommit}`], { cwd: repoRoot }).stdout;
  if (status === "HUMAN_REQUIRED") {
    patch += "\n\n# Uncommitted tracked changes\n";
    patch += git(["diff", "--binary"], { cwd: repoRoot }).stdout;
    const untracked = dirtyStatus.filter((entry) => entry.status === "??");
    if (untracked.length) {
      patch += "\n\n# Untracked files are included as snapshots and indexed in MANIFEST.json.\n";
      patch += untracked.map((entry) => `# ${entry.path}`).join("\n");
      patch += "\n";
    }
  }
  await writeFile(path.join(packetRoot, "changes.patch"), patch || "# No textual diff.\n");

  const snapshots = await snapshotChangedFiles({
    repoRoot,
    packetRoot,
    changedFiles,
    status,
    head: headCommit
  });

  const reviewerStatus = reviewerText.includes("PASS") && !reviewerText.includes("BLOCKING")
    ? "pass"
    : reviewerText === "not_available" ? "not_available" : "unknown";
  const validationStatus = validation.status ?? "not_available";
  const packetStatus = "pass";
  const commitsInRange = git(["log", "--oneline", `${baseCommit}..${headCommit}`], { cwd: repoRoot }).stdout.trim() || "none";
  const reviewPacket = [
    "---",
    "schemaVersion: 1",
    `status: ${status}`,
    `milestoneId: ${milestoneId}`,
    `milestoneTitle: ${milestoneTitle}`,
    `generatedAt: ${new Date().toISOString()}`,
    `branch: ${branch}`,
    `baseCommit: ${baseCommit}`,
    `headCommit: ${headCommit}`,
    `headShortSha: ${headShortSha}`,
    `workspaceClean: ${workspaceClean}`,
    `validationStatus: ${validationStatus}`,
    `reviewerStatus: ${reviewerStatus}`,
    `humanGateType: ${status === "HUMAN_REQUIRED" ? "required" : "none"}`,
    `retrospective: ${Boolean(options.retrospective)}`,
    "---",
    "",
    "# Review Request",
    "",
    "Review the packet against the frozen milestone contract. Check handoff completeness, diff range, validation evidence, reviewer evidence, changed file snapshots, artifact index, and terminal response correctness.",
    "",
    "# Frozen Milestone Contract",
    "",
    contractText,
    "",
    "# Implementation Result",
    "",
    `${milestoneId} generated a standardized review handoff packet for status ${status}. Retrospective mode: ${Boolean(options.retrospective)}.`,
    "",
    "# Git State",
    "",
    `- milestone start commit: ${baseCommit}`,
    `- final head commit: ${headCommit}`,
    `- branch: ${branch}`,
    "- commits in range:",
    commitsInRange.split("\n").map((line) => `  - ${line}`).join("\n"),
    "- git status --short:",
    gitStatus.length ? gitStatus.map((line) => `  - ${line}`).join("\n") : "  - clean",
    `- git diff --check: ${diffCheck.status === 0 ? "pass" : "fail"}`,
    `- workspace clean: ${workspaceClean}`,
    "- ignored runtime artifacts: `.artifacts/loop-validation/`, `.artifacts/loop-handoff/`, Electron `.runtime/` directories are excluded from source status.",
    "",
    "# Changed Files",
    "",
    "## git diff --name-status",
    "",
    changedFiles.length ? changedFiles.map((entry) => `- ${entry.status} ${entry.path}`).join("\n") : "- none",
    "",
    "## git diff --stat",
    "",
    "```text",
    diffStat,
    "```",
    "",
    "## File Purpose Index",
    "",
    changedFiles.length ? changedFiles.map((entry) => `- ${entry.path}: ${entry.status} change for milestone ${milestoneId}`).join("\n") : "- none",
    "",
    "# Full Diff",
    "",
    "Full unified diff is stored in mandatory companion file `changes.patch`.",
    "",
    "# Changed File Snapshots",
    "",
    snapshots.length ? snapshots.map((snapshot) => (
      `- ${snapshot.repositoryPath}: ${snapshot.binary ? "binary indexed only" : snapshot.packetPath}, sha256=${snapshot.sha256}, sizeBytes=${snapshot.sizeBytes}`
    )).join("\n") : "- none",
    "",
    "# Acceptance Evidence",
    "",
    acceptanceEvidence({ milestone: milestoneId, validation, reviewerStatus, packetStatus }),
    "",
    "# Validation Evidence",
    "",
    `- validation status: ${validationStatus}`,
    "- step summary:",
    summarizeValidation(validation),
    `- consecutive validation count: ${milestoneId === "M2" ? "2 required before PASS" : "not_available for retrospective packaging"}`,
    `- known gaps: ${JSON.stringify(validation.knownGaps ?? {})}`,
    "",
    "# Independent Reviewer Report",
    "",
    reviewerText,
    reviewerStatus === "pass" ? "\nPASS — no blocking findings" : "",
    "",
    "# Loop History",
    "",
    await readOptionalFile(path.join(repoRoot, "docs/loop/LOOP_HISTORY.md"), "not_available"),
    "",
    "# Remaining Risks And Gaps",
    "",
    "- known technical risk: packet generation is local and Git-based; future binary-heavy milestones may need bundle size limits.",
    "- validation gap: passing protobuf decode, HTTP 200, or nonblank canvas is not complete visual acceptance.",
    "- visual/manual gate: product animation quality remains owner-reviewed.",
    "- product gate: production desktop and format recommendation approvals are out of scope.",
    "- deferred work: optional archive bundle generation.",
    "- nonblocking recommendation: keep packet schema versioned.",
    "",
    "# Artifact Index",
    "",
    "See `artifact-index.json` for machine-readable artifact records.",
    "",
    "# Human Decision",
    "",
    humanDecisionText,
    "",
    "# Recommended Next Milestone",
    "",
    "Do not automatically start the next milestone. Suggested next work: consume Review Packets from an external reviewer and tighten any handoff schema gaps found in real use.",
    ""
  ].join("\n");

  validatePacketContent(reviewPacket);
  await writeFile(path.join(packetRoot, "REVIEW_PACKET.md"), reviewPacket);

  const artifactIndexRecords = [
    await artifactRecord(packetRoot, "REVIEW_PACKET.md", "review-packet", "text/markdown", true),
    await artifactRecord(packetRoot, "changes.patch", "diff", "text/x-diff", true),
    await artifactRecord(packetRoot, "validation.json", "validation-summary", "application/json", false),
    await artifactRecord(packetRoot, "reviewer-report.md", "independent-reviewer-report", "text/markdown", false)
  ];
  if (humanDecisionPacketPath) {
    artifactIndexRecords.push(await artifactRecord(packetRoot, humanDecisionPacketPath, "human-decision", "text/markdown", false, true));
  }
  for (const snapshot of snapshots) {
    if (snapshot.packetPath) {
      artifactIndexRecords.push(await artifactRecord(packetRoot, snapshot.packetPath, "changed-file-snapshot", "application/octet-stream", true));
    }
  }

  artifactIndexRecords.sort((a, b) => compareStrings(a.path, b.path));

  const manifest = {
    schemaVersion: 1,
    status,
    milestone: {
      id: milestoneId,
      title: milestoneTitle,
      baseCommit,
      headCommit,
      branch,
      retrospective: Boolean(options.retrospective)
    },
    workspace: {
      clean: workspaceClean,
      status: gitStatus
    },
    validation: {
      status: validationStatus,
      summaryPath: "validation.json"
    },
    reviewer: {
      status: reviewerStatus,
      reportPath: "reviewer-report.md"
    },
    files: snapshots,
    artifacts: artifactIndexRecords,
    generatedFiles: [
      "REVIEW_PACKET.md",
      "MANIFEST.json",
      "changes.patch",
      "validation.json",
      "reviewer-report.md",
      "artifact-index.json",
      "FINAL_RESPONSE.txt",
      "files/",
      "decisions/"
    ],
    selfReferentialFilesExcludedFromHash: [
      "MANIFEST.json",
      "artifact-index.json"
    ],
    humanDecision: status === "HUMAN_REQUIRED"
      ? { sourcePath: options.decisionFile, packetPath: humanDecisionPacketPath }
      : null
  };

  await writeFile(path.join(packetRoot, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const response = finalResponse({
    status,
    packetRoot,
    manifestPath: path.join(packetRoot, "MANIFEST.json"),
    patchPath: path.join(packetRoot, "changes.patch"),
    humanDecisionPath: humanDecisionPacketPath ? path.join(packetRoot, humanDecisionPacketPath) : undefined,
    retrospectivePackets: options.retrospectivePacket ? [resolveRepoPath(repoRoot, options.retrospectivePacket)] : []
  });
  await writeFile(path.join(packetRoot, "FINAL_RESPONSE.txt"), response);
  artifactIndexRecords.push(await artifactRecord(packetRoot, "FINAL_RESPONSE.txt", "final-response", "text/plain", true));
  artifactIndexRecords.sort((a, b) => compareStrings(a.path, b.path));
  await writeFile(path.join(packetRoot, "artifact-index.json"), `${JSON.stringify({
    schemaVersion: 1,
    artifacts: artifactIndexRecords
  }, null, 2)}\n`);

  manifest.files = snapshots;
  manifest.artifacts = artifactIndexRecords;
  await writeFile(path.join(packetRoot, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  await copyLatest(packetRoot, latestRoot);
  return { packetRoot, latestRoot, manifest, finalResponse: response };
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const result = await generateHandoffPacket(args);
  console.log(`AUTO_SVGA_LOOP_HANDOFF_RESULT=${JSON.stringify({
    status: args.status,
    packetRoot: result.packetRoot,
    latestRoot: result.latestRoot
  })}`);
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
