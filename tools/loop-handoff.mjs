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
const packetSchemaVersion = 2;
const inlineDiffMaxBytes = 1_000_000;
const inlineDiffMaxLines = 5_000;
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
  "Independent Reviewer Reports",
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
    input: undefined,
    reviewerA: undefined,
    reviewerB: undefined,
    reviewerReport: undefined,
    decisionFile: undefined,
    title: undefined,
    retrospective: false,
    retrospectivePacket: undefined,
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

async function readJsonFile(filePath) {
  const text = await readFile(filePath, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
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

function validationStatusFromFile(validation, validationExists) {
  if (!validationExists) return "NOT_AVAILABLE";
  return validation.status === "pass" ? "PASS" : "FAIL";
}

function parseReviewerStatus(text) {
  if (!text || text.includes("not_available")) return "NOT_AVAILABLE";
  if (/BLOCKING|FAIL/i.test(text)) return "FAIL";
  if (/\bPASS\b/i.test(text)) return "PASS";
  return "UNKNOWN";
}

function patchMetadata(patch) {
  const sizeBytes = Buffer.byteLength(patch, "utf8");
  const lineCount = patch.length ? patch.split("\n").length : 0;
  const companionRequired = sizeBytes > inlineDiffMaxBytes || lineCount > inlineDiffMaxLines;
  return {
    sizeBytes,
    lineCount,
    companionRequired,
    mandatoryCompanions: companionRequired ? ["changes.patch"] : []
  };
}

function isPlaceholderPurpose(value) {
  if (!value || typeof value !== "string") return true;
  const normalized = value.trim().toLowerCase();
  return normalized.length < 12
    || normalized === "update"
    || normalized === "changed file"
    || normalized === "miscellaneous"
    || normalized.includes("change for milestone")
    || normalized.includes("a/m change");
}

function validateChangedFilePurposes({ changedFiles, changedFilePurposes }) {
  if (!changedFilePurposes || typeof changedFilePurposes !== "object") {
    throw new Error("handoff input missing changedFilePurposes.");
  }
  for (const entry of changedFiles) {
    const purpose = changedFilePurposes[entry.path];
    if (isPlaceholderPurpose(purpose)) {
      throw new Error(`changed file purpose missing or placeholder for ${entry.path}`);
    }
  }
}

function validateAcceptanceEvidence({ milestoneId, acceptanceEvidence, retrospective }) {
  if (!Array.isArray(acceptanceEvidence) || acceptanceEvidence.length === 0) {
    throw new Error("handoff input missing acceptanceEvidence.");
  }
  for (const item of acceptanceEvidence) {
    if (!item || typeof item !== "object") {
      throw new Error("acceptanceEvidence entries must be objects.");
    }
    if (!item.criterionId || !item.requirement) {
      throw new Error("acceptanceEvidence entries require criterionId and requirement.");
    }
    if (item.milestoneId && item.milestoneId !== milestoneId) {
      throw new Error(`acceptance evidence ${item.criterionId} references ${item.milestoneId}, expected ${milestoneId}`);
    }
    if (!String(item.criterionId).startsWith(`${milestoneId}-AC-`)) {
      throw new Error(`acceptance evidence id ${item.criterionId} must be milestone-specific for ${milestoneId}`);
    }
    if (!item.evidenceSource || !item.limitation) {
      throw new Error(`acceptance evidence ${item.criterionId} requires evidenceSource and limitation.`);
    }
    const text = JSON.stringify(item);
    if (retrospective && milestoneId === "M1" && /\bM2\b|loop:handoff|Review Packet/i.test(text)) {
      throw new Error(`M1 retrospective acceptance evidence ${item.criterionId} contains M2 or handoff-specific evidence.`);
    }
  }
}

async function readHandoffInput({ repoRoot, inputPath, milestoneId, baseCommit, headCommit, title }) {
  if (!inputPath) {
    throw new Error("Missing required --input handoff JSON.");
  }
  const input = await readJsonFile(resolveRepoPath(repoRoot, inputPath));
  if (input.milestoneId !== milestoneId) {
    throw new Error(`handoff input milestoneId ${input.milestoneId} does not match ${milestoneId}`);
  }
  if (input.reviewedBaseCommit !== baseCommit) {
    throw new Error(`handoff input reviewedBaseCommit ${input.reviewedBaseCommit} does not match ${baseCommit}`);
  }
  if (input.reviewedHeadCommit !== headCommit) {
    throw new Error(`handoff input reviewedHeadCommit ${input.reviewedHeadCommit} does not match ${headCommit}`);
  }
  for (const key of [
    "milestoneOutcome",
    "evidenceCompleteness",
    "historicalValidationEvidence",
    "historicalReviewerEvidence",
    "retrospectiveRevalidation",
    "retrospectiveReviewerStatus",
    "implementationSummary",
    "changedFilePurposes",
    "acceptanceEvidence",
    "remainingRisks",
    "recommendedNextMilestone"
  ]) {
    if (input[key] === undefined || input[key] === null) {
      throw new Error(`handoff input missing ${key}.`);
    }
  }
  if (title && input.milestoneTitle && input.milestoneTitle !== title) {
    throw new Error(`handoff input milestoneTitle ${input.milestoneTitle} does not match ${title}`);
  }
  return input;
}

function validateContractForMilestone(contractText, milestoneId) {
  if (!contractText.includes(milestoneId)) {
    throw new Error(`Milestone contract does not mention ${milestoneId}.`);
  }
}

async function readLoopHistoryForMilestone(repoRoot, milestoneId) {
  const jsonlPath = path.join(repoRoot, "docs/loop/LOOP_HISTORY.jsonl");
  if (!existsSync(jsonlPath)) return "not_available";
  const text = await readFile(jsonlPath, "utf8");
  const entries = [];
  for (const [lineIndex, line] of text.split("\n").entries()) {
    if (!line.trim()) continue;
    try {
      const item = JSON.parse(line);
      if (item.milestoneId === milestoneId) entries.push(item);
    } catch (error) {
      throw new Error(`Invalid docs/loop/LOOP_HISTORY.jsonl line ${lineIndex + 1}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!entries.length) return `No structured history entries for ${milestoneId}.`;
  return entries.map((entry) => [
    `- milestoneId: ${entry.milestoneId}`,
    `  iteration: ${entry.iteration ?? "not_available"}`,
    `  phase: ${entry.phase ?? "not_available"}`,
    `  timestamp: ${entry.timestamp ?? "not_available"}`,
    `  hypothesis: ${entry.hypothesis ?? "not_available"}`,
    `  filesChanged: ${(entry.filesChanged ?? []).join(", ") || "none"}`,
    `  commands: ${(entry.commands ?? []).join("; ") || "none"}`,
    `  result: ${entry.result ?? "not_available"}`,
    `  evidence: ${(entry.evidence ?? []).join(", ") || "not_available"}`,
    `  nextAction: ${entry.nextAction ?? "not_available"}`
  ].join("\n")).join("\n");
}

function acceptanceEvidenceMarkdown(evidence) {
  return evidence.map((item) => [
    `- criterion id: ${item.criterionId}`,
    `  requirement: ${item.requirement}`,
    `  milestoneId: ${item.milestoneId}`,
    `  historical evidence status: ${item.historicalEvidenceStatus ?? "NOT_AVAILABLE"}`,
    `  retrospective evidence status: ${item.retrospectiveEvidenceStatus ?? "NOT_AVAILABLE"}`,
    `  evidence source: ${item.evidenceSource}`,
    `  limitation: ${item.limitation}`,
    item.derivedFromFrozenContract !== undefined
      ? `  derivedFromFrozenContract: ${Boolean(item.derivedFromFrozenContract)}`
      : null
  ].filter(Boolean).join("\n")).join("\n");
}

function remainingRisksMarkdown(risks) {
  return Array.isArray(risks) && risks.length
    ? risks.map((risk) => `- ${risk}`).join("\n")
    : "- none recorded";
}

function validationRunsMarkdown(runs) {
  return Array.isArray(runs) && runs.length
    ? runs.map((run) => `- ${run.command}: ${run.result}${run.exitCode !== undefined ? `, exitCode=${run.exitCode}` : ""}`).join("\n")
    : "- See validation.json.";
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
      "reviewer-a.md",
      "reviewer-b.md",
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

function finalResponse({ status, packetRoot, companionRequired, visualArtifacts, optionalReference }) {
  const uploadLines = [
    `1. ${path.join(packetRoot, "REVIEW_PACKET.md")}`
  ];
  let nextIndex = 2;
  if (companionRequired) {
    uploadLines.push(`${nextIndex}. ${path.join(packetRoot, "changes.patch")}`);
    nextIndex += 1;
  }
  const humanVisualArtifacts = Array.isArray(visualArtifacts) ? visualArtifacts.filter((artifact) => artifact.humanReviewRequired) : [];
  for (const artifact of humanVisualArtifacts) {
    uploadLines.push(`${nextIndex}. ${artifact.path ?? artifact}`);
    nextIndex += 1;
  }

  if (status === "PASS") {
    return [
      "PASS",
      "",
      "REVIEW_PACKET_READY",
      "",
      "UPLOAD_TO_REVIEW_ASSISTANT:",
      ...uploadLines,
      "",
      "OPTIONAL_REFERENCE:",
      optionalReference ? `- ${optionalReference}` : "- none",
      "",
      "Do not upload:",
      "- MANIFEST.json",
      "- validation.json",
      "- reviewer reports",
      "- files directory",
      "unless explicitly listed above.",
      ""
    ].join("\n");
  }

  return [
    "HUMAN_REQUIRED",
    "",
    "REVIEW_PACKET_READY",
    "",
    "UPLOAD_TO_REVIEW_ASSISTANT:",
    ...uploadLines,
    "",
    "OPTIONAL_REFERENCE:",
    optionalReference ? `- ${optionalReference}` : "- none",
    "",
    "Question:",
    "See REVIEW_PACKET.md Human Decision section.",
    "",
    "Recommendation:",
    "See REVIEW_PACKET.md Human Decision section.",
    "",
    "Do not upload:",
    "- MANIFEST.json",
    "- validation.json",
    "- reviewer reports",
    "- files directory",
    "unless explicitly listed above.",
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
  const generatorCommit = git(["rev-parse", "HEAD"], { cwd: repoRoot }).stdout.trim();
  const milestoneId = options.milestone;
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

  const input = await readHandoffInput({
    repoRoot,
    inputPath: options.input,
    milestoneId,
    baseCommit,
    headCommit,
    title: options.title
  });
  const milestoneTitle = options.title ?? input.milestoneTitle ?? milestoneId;

  await rm(packetRoot, { recursive: true, force: true });
  await mkdir(packetRoot, { recursive: true });
  await mkdir(path.join(packetRoot, "decisions"), { recursive: true });

  const contractText = await readOptionalFile(resolveRepoPath(repoRoot, contractPath), "not_available");
  if (contractText === "not_available") {
    throw new Error(`Milestone contract not_available: ${contractPath}`);
  }
  validateContractForMilestone(contractText, milestoneId);

  const validationSourcePath = resolveRepoPath(repoRoot, validationPath);
  const validationExists = existsSync(validationSourcePath);
  const validationText = await readOptionalFile(validationSourcePath, JSON.stringify({
    schemaVersion: 1,
    status: "not_available",
    steps: [],
    knownGaps: {}
  }, null, 2));
  const validation = parseValidationSummary(validationText);

  const reviewerAFallback = "not_available\n\nReason: reviewer A report file was not available for this handoff.\n";
  const reviewerBFallback = "not_available\n\nReason: reviewer B report file was not available for this handoff.\n";
  const reviewerAPath = options.reviewerA ?? options.reviewerReport;
  const reviewerBPath = options.reviewerB ?? options.reviewerReport;
  const reviewerAText = await readOptionalFile(reviewerAPath ? resolveRepoPath(repoRoot, reviewerAPath) : undefined, reviewerAFallback);
  const reviewerBText = await readOptionalFile(reviewerBPath ? resolveRepoPath(repoRoot, reviewerBPath) : undefined, reviewerBFallback);
  const reviewerAStatus = parseReviewerStatus(reviewerAText);
  const reviewerBStatus = parseReviewerStatus(reviewerBText);

  if (status === "PASS" && !options.retrospective) {
    if (!validationExists || validation.status !== "pass") {
      throw new Error("PASS handoff requires a passing validation summary.");
    }
    if (reviewerAStatus !== "PASS" || reviewerBStatus !== "PASS") {
      throw new Error("PASS handoff requires reviewer A and reviewer B PASS reports.");
    }
  }

  let humanDecisionText = "None";
  let humanDecisionPacketPath = null;
  if (status === "HUMAN_REQUIRED") {
    humanDecisionText = await readRequiredHumanDecision(resolveRepoPath(repoRoot, options.decisionFile));
    humanDecisionPacketPath = "decisions/human-decision.md";
    await writeFile(path.join(packetRoot, humanDecisionPacketPath), humanDecisionText);
  }

  await writeFile(path.join(packetRoot, "validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
  await writeFile(path.join(packetRoot, "reviewer-a.md"), reviewerAText.endsWith("\n") ? reviewerAText : `${reviewerAText}\n`);
  await writeFile(path.join(packetRoot, "reviewer-b.md"), reviewerBText.endsWith("\n") ? reviewerBText : `${reviewerBText}\n`);

  const nameStatus = parseNameStatus(git(["diff", "--name-status", `${baseCommit}..${headCommit}`], { cwd: repoRoot }).stdout);
  const dirtyStatus = status === "HUMAN_REQUIRED"
    ? [
      ...parsePorcelain(git(["status", "--short"], { cwd: repoRoot }).stdout),
      ...listUntrackedFiles(repoRoot)
    ]
    : [];
  const changedFiles = mergeChangedFiles(nameStatus, dirtyStatus);
  validateChangedFilePurposes({ changedFiles, changedFilePurposes: input.changedFilePurposes });
  validateAcceptanceEvidence({ milestoneId, acceptanceEvidence: input.acceptanceEvidence, retrospective: Boolean(options.retrospective) });

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
  const normalizedPatch = patch || "# No textual diff.\n";
  const patchInfo = patchMetadata(normalizedPatch);
  await writeFile(path.join(packetRoot, "changes.patch"), normalizedPatch);
  if (patchInfo.companionRequired && !existsSync(path.join(packetRoot, "changes.patch"))) {
    throw new Error("changes.patch is required but was not written.");
  }

  const snapshots = await snapshotChangedFiles({
    repoRoot,
    packetRoot,
    changedFiles,
    status,
    head: headCommit
  });

  const validationEvidenceStatus = validationStatusFromFile(validation, validationExists);
  const packetStatus = "COMPLETE";
  const commitsInRange = git(["log", "--oneline", `${baseCommit}..${headCommit}`], { cwd: repoRoot }).stdout.trim() || "none";
  const loopHistory = await readLoopHistoryForMilestone(repoRoot, milestoneId);
  const visualArtifacts = Array.isArray(input.visualArtifacts) ? input.visualArtifacts : [];
  const optionalReference = options.retrospectivePacket ? resolveRepoPath(repoRoot, options.retrospectivePacket) : null;
  const reportGeneratedAt = new Date().toISOString();

  const fullDiffSection = patchInfo.companionRequired
    ? [
      "Full unified diff exceeds inline packet limits.",
      "",
      `- companionRequired: true`,
      `- mandatory companion: changes.patch`,
      `- patch size bytes: ${patchInfo.sizeBytes}`,
      `- patch line count: ${patchInfo.lineCount}`
    ].join("\n")
    : [
      `- companionRequired: false`,
      `- patch size bytes: ${patchInfo.sizeBytes}`,
      `- patch line count: ${patchInfo.lineCount}`,
      "",
      "```diff",
      normalizedPatch,
      "```"
    ].join("\n");

  const reviewPacket = [
    "---",
    `schemaVersion: ${packetSchemaVersion}`,
    `packetStatus: ${packetStatus}`,
    `milestoneOutcome: ${input.milestoneOutcome}`,
    `evidenceCompleteness: ${input.evidenceCompleteness}`,
    `historicalValidationEvidence: ${input.historicalValidationEvidence}`,
    `historicalReviewerEvidence: ${input.historicalReviewerEvidence}`,
    `retrospectiveRevalidation: ${input.retrospectiveRevalidation}`,
    `retrospectiveReviewerStatus: ${input.retrospectiveReviewerStatus}`,
    `retrospective: ${Boolean(options.retrospective)}`,
    `milestoneId: ${milestoneId}`,
    `milestoneTitle: ${milestoneTitle}`,
    `generatedAt: ${reportGeneratedAt}`,
    `branch: ${branch}`,
    `reviewedBaseCommit: ${baseCommit}`,
    `reviewedHeadCommit: ${headCommit}`,
    `generatorCommit: ${generatorCommit}`,
    `repositoryHeadAtGeneration: ${generatorCommit}`,
    `workspaceCleanAtGeneration: ${workspaceClean}`,
    `companionRequired: ${patchInfo.companionRequired}`,
    `mandatoryCompanions: ${patchInfo.mandatoryCompanions.join(",") || "none"}`,
    "---",
    "",
    "# Review Request",
    "",
    "Review the packet against the frozen milestone contract. Use REVIEW_PACKET.md as the primary artifact. Upload changes.patch only when companionRequired is true. Do not request MANIFEST.json, validation.json, reviewer reports, or files directory unless this packet explicitly lists them.",
    "",
    "# Frozen Milestone Contract",
    "",
    contractText,
    "",
    "# Implementation Result",
    "",
    input.implementationSummary,
    input.retrospectivePackagingNote ? `\nRetrospective Packaging Note: ${input.retrospectivePackagingNote}` : "",
    "",
    "# Git State",
    "",
    `- milestone start commit: ${baseCommit}`,
    `- reviewed head commit: ${headCommit}`,
    `- generator commit: ${generatorCommit}`,
    `- repository head at generation: ${generatorCommit}`,
    `- branch: ${branch}`,
    "- commits in range:",
    commitsInRange.split("\n").map((line) => `  - ${line}`).join("\n"),
    "- git status --short:",
    gitStatus.length ? gitStatus.map((line) => `  - ${line}`).join("\n") : "  - clean",
    `- git diff --check: ${diffCheck.status === 0 ? "pass" : "fail"}`,
    `- workspace clean at generation: ${workspaceClean}`,
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
    changedFiles.length ? changedFiles.map((entry) => `- ${entry.path}: ${input.changedFilePurposes[entry.path]}`).join("\n") : "- none",
    "",
    "# Full Diff",
    "",
    fullDiffSection,
    "",
    "# Changed File Snapshots",
    "",
    snapshots.length ? snapshots.map((snapshot) => (
      `- ${snapshot.repositoryPath}: ${snapshot.binary ? "binary indexed only" : snapshot.packetPath}, sha256=${snapshot.sha256}, sizeBytes=${snapshot.sizeBytes}`
    )).join("\n") : "- none",
    "",
    "# Acceptance Evidence",
    "",
    acceptanceEvidenceMarkdown(input.acceptanceEvidence),
    options.retrospective
      ? "\nRetrospective evidence authority: acceptance entries are derived from the frozen M1 contract and explicitly mark historical validation/reviewer evidence availability. Narrative loop history is not original evidence."
      : "\nEvidence authority: acceptance entries are provided by the milestone handoff input and backed by validation.json, reviewer-a.md, reviewer-b.md, MANIFEST.json, and current Git state.",
    "",
    "# Validation Evidence",
    "",
    `- validation status: ${validationEvidenceStatus}`,
    `- evidence completeness: ${input.evidenceCompleteness}`,
    "- handoff input validation runs:",
    validationRunsMarkdown(input.validationRuns),
    "- validation.json step summary:",
    summarizeValidation(validation),
    `- known gaps: ${JSON.stringify(validation.knownGaps ?? {})}`,
    "",
    "# Independent Reviewer Reports",
    "",
    "## Reviewer A",
    "",
    `- status: ${reviewerAStatus}`,
    "",
    reviewerAText,
    "",
    "## Reviewer B",
    "",
    `- status: ${reviewerBStatus}`,
    "",
    reviewerBText,
    "",
    "# Loop History",
    "",
    loopHistory,
    "",
    "# Remaining Risks And Gaps",
    "",
    remainingRisksMarkdown(input.remainingRisks),
    "",
    "# Artifact Index",
    "",
    "See `artifact-index.json` for machine-readable artifact records. The Review Packet is designed to be sufficient without uploading MANIFEST.json, validation.json, reviewer reports, or files directory unless FINAL_RESPONSE.txt explicitly lists a companion.",
    "",
    "# Human Decision",
    "",
    humanDecisionText,
    "",
    "# Recommended Next Milestone",
    "",
    input.recommendedNextMilestone,
    ""
  ].join("\n");

  validatePacketContent(reviewPacket);
  await writeFile(path.join(packetRoot, "REVIEW_PACKET.md"), reviewPacket);

  const artifactIndexRecords = [
    await artifactRecord(packetRoot, "REVIEW_PACKET.md", "review-packet", "text/markdown", true),
    await artifactRecord(packetRoot, "changes.patch", "diff", "text/x-diff", true),
    await artifactRecord(packetRoot, "validation.json", "validation-summary", "application/json", false),
    await artifactRecord(packetRoot, "reviewer-a.md", "independent-reviewer-a-report", "text/markdown", false),
    await artifactRecord(packetRoot, "reviewer-b.md", "independent-reviewer-b-report", "text/markdown", false)
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
    schemaVersion: packetSchemaVersion,
    packetStatus,
    milestoneOutcome: input.milestoneOutcome,
    evidenceCompleteness: input.evidenceCompleteness,
    historicalValidationEvidence: input.historicalValidationEvidence,
    historicalReviewerEvidence: input.historicalReviewerEvidence,
    retrospectiveRevalidation: input.retrospectiveRevalidation,
    retrospectiveReviewerStatus: input.retrospectiveReviewerStatus,
    retrospective: Boolean(options.retrospective),
    reviewedBaseCommit: baseCommit,
    reviewedHeadCommit: headCommit,
    generatorCommit,
    repositoryHeadAtGeneration: generatorCommit,
    workspaceCleanAtGeneration: workspaceClean,
    companionRequired: patchInfo.companionRequired,
    mandatoryCompanions: patchInfo.mandatoryCompanions,
    patch: patchInfo,
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
      status: validationEvidenceStatus,
      summaryPath: "validation.json"
    },
    reviewers: {
      reviewerA: { status: reviewerAStatus, reportPath: "reviewer-a.md" },
      reviewerB: { status: reviewerBStatus, reportPath: "reviewer-b.md" }
    },
    files: snapshots,
    artifacts: artifactIndexRecords,
    generatedFiles: [
      "REVIEW_PACKET.md",
      "MANIFEST.json",
      "changes.patch",
      "validation.json",
      "reviewer-a.md",
      "reviewer-b.md",
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
    companionRequired: patchInfo.companionRequired,
    visualArtifacts,
    optionalReference
  });
  await writeFile(path.join(packetRoot, "FINAL_RESPONSE.txt"), response);
  artifactIndexRecords.push(await artifactRecord(packetRoot, "FINAL_RESPONSE.txt", "final-response", "text/plain", true));
  artifactIndexRecords.sort((a, b) => compareStrings(a.path, b.path));
  await writeFile(path.join(packetRoot, "artifact-index.json"), `${JSON.stringify({
    schemaVersion: packetSchemaVersion,
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
