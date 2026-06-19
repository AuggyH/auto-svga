#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  cp,
  lstat,
  mkdir,
  readFile,
  readlink,
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
const packetSchemaVersion = 3;
const inlineDiffMaxBytes = 1_000_000;
const inlineDiffMaxLines = 5_000;
const sensitiveSentinelLabel = "redacted";
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
    candidate: false,
    retrospectivePacket: undefined,
    repoRoot: defaultRepoRoot
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    if (key === "retrospective" || key === "candidate") {
      args[key] = true;
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
  if (!value) return undefined;
  const resolved = path.resolve(repoRoot, value);
  const relative = path.relative(repoRoot, resolved);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return resolved;
  }
  throw new Error(`Path escapes repository root: ${value}`);
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

function repoPathSegments(repoPath) {
  return repoPath.replaceAll("\\", "/").split("/").filter(Boolean);
}

function isProtectedUserAssetPath(repoPath) {
  const normalized = repoPath.replaceAll("\\", "/").toLowerCase();
  if (normalized.startsWith("fixtures/") || normalized.startsWith("src/tests/fixtures/")) return false;
  return /\.(png|jpg|jpeg|gif|webp|webm|mp4|mov|svga|psd|ai|fig|sketch)$/i.test(normalized);
}

function isSensitiveRepoPath(repoPath) {
  const normalized = repoPath.replaceAll("\\", "/");
  const lower = normalized.toLowerCase();
  const segments = repoPathSegments(lower);
  if (segments.includes(".git") || segments.includes("node_modules") || segments.includes(".runtime")) return true;
  if (segments.some((segment) => segment === ".env" || segment.startsWith(".env."))) return true;
  if (segments.some((segment) => [".npmrc", ".pypirc", ".netrc", "id_rsa", "id_ed25519"].includes(segment))) return true;
  if (segments.some((segment) => segment.startsWith("credentials") || segment.startsWith("secrets"))) return true;
  if (/\.(pem|key|p12|pfx)$/i.test(normalized)) return true;
  return isProtectedUserAssetPath(repoPath);
}

function parseNameStatusZ(buffer) {
  const tokens = buffer.toString("utf8").split("\0").filter(Boolean);
  const entries = [];
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index++];
    if (status.startsWith("R") || status.startsWith("C")) {
      const oldPath = tokens[index++];
      const newPath = tokens[index++];
      entries.push({ status, path: newPath, oldPath });
      continue;
    }
    const filePath = tokens[index++];
    entries.push({ status, path: filePath });
  }
  return entries
    .filter((entry) => entry.status !== "??")
    .filter((entry) => entry.path && !isExcludedRepoPath(entry.path));
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

function parsePorcelainZ(buffer) {
  const tokens = buffer.toString("utf8").split("\0").filter(Boolean);
  const entries = [];
  for (let index = 0; index < tokens.length;) {
    const token = tokens[index++];
    const status = token.slice(0, 2).trim() || "modified";
    const firstPath = token.slice(3);
    if (status.startsWith("R") || status.startsWith("C")) {
      const newPath = tokens[index++];
      entries.push({ status, oldPath: firstPath, path: newPath });
      continue;
    }
    entries.push({ status, path: firstPath });
  }
  return entries
    .filter((entry) => entry.status !== "??")
    .filter((entry) => entry.path && !isExcludedRepoPath(entry.path));
}


function parseWorkspaceStatus(output) {
  return output
    .split("\n")
    .filter(Boolean)
    .filter((line) => {
      const status = line.slice(0, 2).trim() || "modified";
      const rawPath = line.slice(3).trim();
      const repoPath = status.startsWith("R") || status.startsWith("C")
        ? rawPath.split(/\s+/).at(-1)
        : rawPath;
      return repoPath && !isExcludedRepoPath(repoPath);
    });
}

function listUntrackedFiles(repoRoot) {
  return gitBytes(["ls-files", "--others", "--exclude-standard", "-z"], { cwd: repoRoot }).stdout
    .toString("utf8")
    .split("\0")
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

async function snapshotBytesForEntry({ repoRoot, status, head, entry }) {
  if (status === "PASS") {
    return readPathAtHead(repoRoot, head, entry.path);
  }
  const sourcePath = resolveRepoPath(repoRoot, entry.path);
  if (!existsSync(sourcePath)) return undefined;
  const fileStat = await lstat(sourcePath);
  if (fileStat.isSymbolicLink()) {
    const target = await readlink(sourcePath);
    return Buffer.from(`symlink:${target}\n`);
  }
  if (!fileStat.isFile()) return undefined;
  return readFile(sourcePath);
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

    const bytes = await snapshotBytesForEntry({ repoRoot, status, head, entry });
    if (!bytes) continue;

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
  const decision = await readJsonFile(filePath);
  if (decision.schemaVersion !== 1) {
    throw new Error("HUMAN_REQUIRED decision schemaVersion must be 1.");
  }
  if (!decision.question || typeof decision.question !== "string") {
    throw new Error("HUMAN_REQUIRED decision requires one concrete question.");
  }
  if (!Array.isArray(decision.options) || decision.options.length < 2) {
    throw new Error("HUMAN_REQUIRED decision requires at least two options.");
  }
  const optionIds = new Set();
  for (const option of decision.options) {
    if (!option.id || !option.label || !option.impact) {
      throw new Error("Each HUMAN_REQUIRED option requires id, label, and impact.");
    }
    optionIds.add(option.id);
  }
  if (!optionIds.has(decision.recommendation)) {
    throw new Error("HUMAN_REQUIRED recommendation must reference an existing option.");
  }
  if (!Array.isArray(decision.evidence) || decision.evidence.length === 0) {
    throw new Error("HUMAN_REQUIRED decision requires evidence.");
  }
  if (!decision.safeDefaultWhileWaiting) {
    throw new Error("HUMAN_REQUIRED decision requires safeDefaultWhileWaiting.");
  }
  return decision;
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

function validateCurrentValidationSummary({ validation, validationExists, headCommit }) {
  if (!validationExists) {
    throw new Error("PASS handoff requires validation summary.");
  }
  if (validation.schemaVersion !== 2) {
    throw new Error("Current PASS handoff requires validation schemaVersion 2.");
  }
  if (validation.status !== "pass") {
    throw new Error("Current PASS handoff requires validation status pass.");
  }
  if (validation.repositoryHeadCommitAtStart !== headCommit
    || validation.repositoryHeadCommitAtFinish !== headCommit) {
    throw new Error("Validation summary is not bound to reviewedHeadCommit.");
  }
  if (validation.sourceWorkspaceCleanAtStart !== true
    || validation.sourceWorkspaceCleanAtFinish !== true) {
    throw new Error("Validation summary requires clean source workspace at start and finish.");
  }
  const steps = Array.isArray(validation.steps) ? validation.steps : [];
  if (steps.some((step) => step.required && step.status !== "pass")) {
    throw new Error("Validation summary has a required step that did not pass.");
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

async function readReviewerVerdict(filePath, { reviewerId, headCommit, candidateDigest }) {
  if (!filePath) {
    throw new Error(`Reviewer ${reviewerId} JSON verdict is missing.`);
  }
  const verdict = await readJsonFile(filePath);
  if (verdict.schemaVersion !== 1) {
    throw new Error(`Reviewer ${reviewerId} verdict schemaVersion must be 1.`);
  }
  if (verdict.reviewerId !== reviewerId) {
    throw new Error(`Reviewer verdict role mismatch: expected ${reviewerId}.`);
  }
  if (!["PASS", "BLOCKING"].includes(verdict.verdict)) {
    throw new Error(`Reviewer ${reviewerId} verdict must be PASS or BLOCKING.`);
  }
  if (verdict.reviewedHeadCommit !== headCommit) {
    throw new Error(`Reviewer ${reviewerId} reviewedHeadCommit mismatch.`);
  }
  if (verdict.candidateDigest !== candidateDigest) {
    throw new Error(`Reviewer ${reviewerId} candidateDigest mismatch.`);
  }
  if (verdict.verdict === "PASS") {
    if (Array.isArray(verdict.conditions) && verdict.conditions.length > 0) {
      throw new Error(`Reviewer ${reviewerId} PASS verdict cannot include conditions.`);
    }
    const findings = Array.isArray(verdict.findings) ? verdict.findings : [];
    if (findings.some((finding) => finding.severity === "blocking" || finding.blocking === true)) {
      throw new Error(`Reviewer ${reviewerId} PASS verdict cannot include blocking findings.`);
    }
  }
  return verdict;
}

function reviewerVerdictMarkdown(verdict) {
  if (!verdict) return "- not_available";
  return [
    "```json",
    JSON.stringify(verdict, null, 2),
    "```"
  ].join("\n");
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

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex");
}

function computeCandidateDigest(parts) {
  return sha256Text(stableJson(parts));
}

function createRedactedEntry(entry) {
  return {
    repositoryPath: entry.path,
    oldPath: entry.oldPath,
    changeType: entry.status,
    redacted: true,
    reason: isSensitiveRepoPath(entry.path) || (entry.oldPath && isSensitiveRepoPath(entry.oldPath))
      ? "sensitive_or_protected_path"
      : sensitiveSentinelLabel
  };
}

function splitSafeAndSensitiveEntries(entries) {
  const safe = [];
  const sensitive = [];
  for (const entry of entries) {
    if (isSensitiveRepoPath(entry.path) || (entry.oldPath && isSensitiveRepoPath(entry.oldPath))) {
      sensitive.push(entry);
    } else {
      safe.push(entry);
    }
  }
  return { safe, sensitive };
}

function pathspecsForEntries(entries) {
  const paths = new Set();
  for (const entry of entries) {
    if (entry.oldPath) paths.add(entry.oldPath);
    paths.add(entry.path);
  }
  return [...paths].sort(compareStrings);
}

function diffCheckRecord({ repoRoot, label, args }) {
  const result = git(["diff", "--check", ...args], { cwd: repoRoot, allowFailure: true });
  return {
    label,
    command: `git diff --check ${args.join(" ")}`.trim(),
    status: result.status === 0 ? "pass" : "fail",
    exitCode: result.status,
    output: `${result.stdout}${result.stderr}`.trim()
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

function parseMilestoneContract(contractText) {
  const idMatch = contractText.match(/^Milestone ID:\s*([A-Za-z0-9-]+)/m);
  const milestoneId = idMatch?.[1];
  const criteria = [];
  const criterionPattern = /^-\s+`([^`]+)`:\s+(.+)$/gm;
  let match;
  while ((match = criterionPattern.exec(contractText)) !== null) {
    criteria.push({
      id: match[1],
      requirement: match[2].trim(),
      requirementHash: createHash("sha256").update(match[2].trim()).digest("hex")
    });
  }
  return { milestoneId, criteria };
}

function validateAcceptanceEvidence({ milestoneId, acceptanceEvidence, retrospective, contract }) {
  if (!Array.isArray(acceptanceEvidence) || acceptanceEvidence.length === 0) {
    throw new Error("handoff input missing acceptanceEvidence.");
  }
  if (!retrospective) {
    if (contract.milestoneId !== milestoneId) {
      throw new Error(`Contract milestoneId ${contract.milestoneId} does not exactly match ${milestoneId}.`);
    }
    const expectedIds = contract.criteria.map((criterion) => criterion.id).sort();
    const actualIds = acceptanceEvidence.map((item) => item.criterionId).sort();
    if (JSON.stringify(expectedIds) !== JSON.stringify(actualIds)) {
      throw new Error("acceptance evidence IDs must exactly match frozen contract IDs.");
    }
  }
  const criteriaById = new Map(contract.criteria.map((criterion) => [criterion.id, criterion]));
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
    if (!retrospective) {
      const criterion = criteriaById.get(item.criterionId);
      if (!criterion) {
        throw new Error(`acceptance evidence ${item.criterionId} is not in frozen contract.`);
      }
      if (item.requirementHash !== criterion.requirementHash) {
        throw new Error(`acceptance evidence ${item.criterionId} requirementHash does not match frozen contract.`);
      }
      if (!Array.isArray(item.commands) || !Array.isArray(item.exitCodes) || !Array.isArray(item.evidenceRefs)) {
        throw new Error(`acceptance evidence ${item.criterionId} requires commands, exitCodes, and evidenceRefs arrays.`);
      }
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
  const contract = parseMilestoneContract(contractText);
  if (contract.milestoneId && contract.milestoneId !== milestoneId) {
    throw new Error(`Milestone contract id ${contract.milestoneId} does not match ${milestoneId}.`);
  }
  return contract;
}

async function readLoopHistoryEntries(repoRoot, milestoneId) {
  const jsonlPath = path.join(repoRoot, "docs/loop/LOOP_HISTORY.jsonl");
  if (!existsSync(jsonlPath)) return [];
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
  return entries;
}

async function validateTerminalState({ repoRoot, milestoneId, status }) {
  const stateText = await readOptionalFile(path.join(repoRoot, "docs/loop/LOOP_STATE.md"), "");
  const expectedState = status === "PASS" ? "terminal_pass" : "terminal_human_required";
  if (!stateText.includes(`Milestone: ${milestoneId}`) || !stateText.includes(`State: ${expectedState}`)) {
    throw new Error(`LOOP_STATE.md must mark ${milestoneId} as ${expectedState}.`);
  }
  const entries = await readLoopHistoryEntries(repoRoot, milestoneId);
  const last = entries.at(-1);
  if (!last) {
    throw new Error(`LOOP_HISTORY.jsonl missing terminal record for ${milestoneId}.`);
  }
  if (last.result !== status) {
    throw new Error(`Last LOOP_HISTORY result ${last.result} does not match ${status}.`);
  }
  if (!["external_review", "wait_for_next_milestone"].includes(last.nextAction)) {
    throw new Error("Terminal LOOP_HISTORY nextAction must be external_review or wait_for_next_milestone.");
  }
  return { state: expectedState, lastHistory: last };
}

async function readLoopHistoryForMilestone(repoRoot, milestoneId) {
  const entries = await readLoopHistoryEntries(repoRoot, milestoneId);
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
    item.requirementHash ? `  requirement hash: ${item.requirementHash}` : null,
    Array.isArray(item.commands) ? `  commands: ${item.commands.join("; ")}` : null,
    Array.isArray(item.exitCodes) ? `  exit codes: ${item.exitCodes.join(", ")}` : null,
    Array.isArray(item.evidenceRefs) ? `  evidence refs: ${item.evidenceRefs.join(", ")}` : null,
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
      "reviewer-a.json",
      "reviewer-b.json",
      "artifact-index.json",
      "FINAL_RESPONSE.txt"
    ]) {
      const source = path.join(packetRoot, fileName);
      if (existsSync(source)) {
        await copyFile(source, path.join(latestRoot, fileName));
      }
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

function parseFinalResponseUploads(text) {
  const uploadMatch = text.match(/UPLOAD_TO_REVIEW_ASSISTANT:\n([\s\S]*?)\n\nOPTIONAL_REFERENCE:/);
  if (!uploadMatch) return [];
  return uploadMatch[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\d+\.\s*/, ""));
}

export async function verifySealedPacket({ repoRoot, packetRoot, latestRoot, manifest, finalResponseText }) {
  let latestTarget = null;
  if (existsSync(latestRoot)) {
    const latestStat = await lstat(latestRoot);
    latestTarget = latestStat.isSymbolicLink()
      ? path.resolve(path.dirname(latestRoot), await readlink(latestRoot))
      : path.resolve(latestRoot);
  }
  const uploadFiles = parseFinalResponseUploads(finalResponseText);
  const uploadsExist = uploadFiles.every((filePath) => existsSync(filePath));
  const patchListed = uploadFiles.some((filePath) => filePath.endsWith("changes.patch"));
  const errors = [];
  const trackedDiffClean = repoRoot
    ? git(["diff", "--quiet"], { cwd: repoRoot, allowFailure: true }).status === 0
    : false;
  const trackedIndexClean = repoRoot
    ? git(["diff", "--cached", "--quiet"], { cwd: repoRoot, allowFailure: true }).status === 0
    : false;

  if (latestTarget && latestTarget !== path.resolve(packetRoot)) {
    errors.push("latest does not point at packetRoot");
  }
  if (!uploadsExist) errors.push("FINAL_RESPONSE upload file missing");
  if (manifest.milestoneOutcome === "PASS" && (!trackedDiffClean || !trackedIndexClean)) {
    errors.push("tracked source workspace is not clean");
  }
  if (manifest.companionRequired !== patchListed) {
    errors.push("companionRequired does not match FINAL_RESPONSE upload list");
  }
  if (manifest.reviewers.reviewerA?.candidateDigest
    && manifest.reviewers.reviewerA.candidateDigest !== manifest.candidateDigest) {
    errors.push("reviewer A candidateDigest mismatch");
  }
  if (manifest.reviewers.reviewerB?.candidateDigest
    && manifest.reviewers.reviewerB.candidateDigest !== manifest.candidateDigest) {
    errors.push("reviewer B candidateDigest mismatch");
  }
  const artifactIndexPath = path.join(packetRoot, "artifact-index.json");
  let checkedArtifactCount = 0;
  if (!Array.isArray(manifest.artifacts)) {
    errors.push("manifest artifacts missing or invalid");
  } else {
    for (const artifact of manifest.artifacts) {
      if (!artifact?.path) {
        errors.push("manifest artifact path missing");
        continue;
      }
      const artifactPath = path.join(packetRoot, artifact.path);
      if (!existsSync(artifactPath)) {
        errors.push(`artifact missing: ${artifact.path}`);
        continue;
      }
      const artifactStat = await stat(artifactPath);
      const artifactHash = await sha256File(artifactPath);
      checkedArtifactCount += 1;
      if (artifact.sizeBytes !== artifactStat.size) {
        errors.push(`artifact size mismatch: ${artifact.path}`);
      }
      if (artifact.sha256 !== artifactHash) {
        errors.push(`artifact sha256 mismatch: ${artifact.path}`);
      }
    }
  }
  if (!existsSync(artifactIndexPath)) {
    errors.push("artifact-index.json missing");
  } else {
    try {
      const artifactIndex = JSON.parse(await readFile(artifactIndexPath, "utf8"));
      const indexedArtifacts = Array.isArray(artifactIndex.artifacts) ? artifactIndex.artifacts : null;
      if (!indexedArtifacts) {
        errors.push("artifact-index artifacts missing or invalid");
      } else if (JSON.stringify(indexedArtifacts) !== JSON.stringify(manifest.artifacts ?? [])) {
        errors.push("artifact-index does not match manifest artifacts");
      }
    } catch {
      errors.push("artifact-index.json cannot be parsed");
    }
  }
  return {
    schemaVersion: 1,
    status: errors.length === 0 ? "pass" : "fail",
    errors,
    uploadFiles,
    trackedSourceClean: trackedDiffClean && trackedIndexClean,
    checkedArtifactCount
  };
}

function finalResponse({ status, packetRoot, companionRequired, visualArtifacts, optionalReference, humanDecision }) {
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

  const recommended = humanDecision?.options?.find((option) => option.id === humanDecision.recommendation);
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
    humanDecision?.question ?? "not_available",
    "",
    "Recommendation:",
    recommended
      ? `${recommended.id}: ${recommended.label}. ${recommended.impact}`
      : "not_available",
    "",
    "Safe default while waiting:",
    humanDecision?.safeDefaultWhileWaiting ?? "not_available",
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
  const packetRoot = path.join(outputRoot, `${milestoneId}-${headShortSha}${options.candidate ? "-candidate" : ""}`);
  const latestRoot = path.join(outputRoot, "latest");
  const gitStatus = parseWorkspaceStatus(git(["status", "--short"], { cwd: repoRoot }).stdout);
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
  if (input.milestoneOutcome !== status) {
    throw new Error("CLI status and handoff input milestoneOutcome must match.");
  }
  if (Boolean(options.retrospective) === false) {
    if (input.retrospectiveRevalidation !== "NOT_APPLICABLE"
      || input.retrospectiveReviewerStatus !== "NOT_APPLICABLE") {
      throw new Error("Current packets require retrospective fields to be NOT_APPLICABLE.");
    }
  }
  if (Boolean(options.retrospective) && input.evidenceCompleteness === "COMPLETE"
    && (input.historicalValidationEvidence === "NOT_AVAILABLE" || input.historicalReviewerEvidence === "NOT_AVAILABLE")) {
    throw new Error("Retrospective packets cannot claim COMPLETE evidence when original evidence is unavailable.");
  }

  await rm(packetRoot, { recursive: true, force: true });
  await mkdir(packetRoot, { recursive: true });
  await mkdir(path.join(packetRoot, "decisions"), { recursive: true });

  const contractText = await readOptionalFile(resolveRepoPath(repoRoot, contractPath), "not_available");
  if (contractText === "not_available") {
    throw new Error(`Milestone contract not_available: ${contractPath}`);
  }
  const contract = validateContractForMilestone(contractText, milestoneId);

  const validationSourcePath = resolveRepoPath(repoRoot, validationPath);
  const validationExists = existsSync(validationSourcePath);
  const validationText = await readOptionalFile(validationSourcePath, JSON.stringify({
    schemaVersion: 1,
    status: "not_available",
    steps: [],
    knownGaps: {}
  }, null, 2));
  const validation = parseValidationSummary(validationText);

  if (status === "PASS" && !options.retrospective) {
    validateCurrentValidationSummary({ validation, validationExists, headCommit });
  }

  let humanDecision = null;
  let humanDecisionText = "None";
  let humanDecisionPacketPath = null;
  if (status === "HUMAN_REQUIRED") {
    humanDecision = await readRequiredHumanDecision(resolveRepoPath(repoRoot, options.decisionFile));
    humanDecisionText = [
      "```json",
      JSON.stringify(humanDecision, null, 2),
      "```"
    ].join("\n");
    humanDecisionPacketPath = "decisions/human-decision.json";
    await writeFile(path.join(packetRoot, humanDecisionPacketPath), `${JSON.stringify(humanDecision, null, 2)}\n`);
  }

  await writeFile(path.join(packetRoot, "validation.json"), `${JSON.stringify(validation, null, 2)}\n`);

  const nameStatus = parseNameStatusZ(gitBytes(["diff", "--name-status", "-z", `${baseCommit}..${headCommit}`], { cwd: repoRoot }).stdout);
  const dirtyStatus = status === "HUMAN_REQUIRED"
    ? [
      ...parsePorcelainZ(gitBytes(["status", "--short", "-z"], { cwd: repoRoot }).stdout),
      ...listUntrackedFiles(repoRoot)
    ]
    : [];
  const allChangedFiles = mergeChangedFiles(nameStatus, dirtyStatus);
  const { safe: changedFiles, sensitive: sensitiveFiles } = splitSafeAndSensitiveEntries(allChangedFiles);
  if (status === "PASS" && sensitiveFiles.length > 0) {
    throw new Error(`PASS handoff refuses sensitive or protected paths: ${sensitiveFiles.map((entry) => entry.path).join(", ")}`);
  }
  validateChangedFilePurposes({ changedFiles, changedFilePurposes: input.changedFilePurposes });
  validateAcceptanceEvidence({
    milestoneId,
    acceptanceEvidence: input.acceptanceEvidence,
    retrospective: Boolean(options.retrospective),
    contract
  });

  let terminalState = null;
  if (!options.retrospective) {
    terminalState = await validateTerminalState({ repoRoot, milestoneId, status });
  }

  const safePathspecs = pathspecsForEntries(changedFiles);
  const committedDiffArgs = safePathspecs.length
    ? [`${baseCommit}..${headCommit}`, "--", ...safePathspecs]
    : [`${baseCommit}..${headCommit}`];
  const diffStat = git(["diff", "--stat", ...committedDiffArgs], { cwd: repoRoot }).stdout.trim() || "No committed diff.";
  const diffChecks = [
    diffCheckRecord({ repoRoot, label: "baseRange", args: [`${baseCommit}..${headCommit}`] })
  ];
  if (status === "HUMAN_REQUIRED") {
    diffChecks.push(diffCheckRecord({ repoRoot, label: "worktree", args: [] }));
    diffChecks.push(diffCheckRecord({ repoRoot, label: "cached", args: ["--cached"] }));
  }
  if (status === "PASS" && diffChecks.some((record) => record.status !== "pass")) {
    throw new Error("PASS handoff requires git diff --check base..head to pass.");
  }
  let patch = git(["diff", "--binary", ...committedDiffArgs], { cwd: repoRoot }).stdout;
  if (status === "HUMAN_REQUIRED") {
    patch += "\n\n# Uncommitted tracked changes\n";
    patch += safePathspecs.length
      ? git(["diff", "--binary", "--", ...safePathspecs], { cwd: repoRoot }).stdout
      : "# No safe uncommitted tracked paths.\n";
    const untracked = dirtyStatus.filter((entry) => entry.status === "??");
    if (untracked.length) {
      patch += "\n\n# Untracked files are included as snapshots and indexed in MANIFEST.json.\n";
      patch += untracked
        .filter((entry) => !isSensitiveRepoPath(entry.path))
        .map((entry) => `# ${entry.path}`).join("\n");
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
  const packetStatus = options.candidate ? "CANDIDATE" : "COMPLETE";
  const packetEvidenceCompleteness = options.candidate ? "PENDING_CANDIDATE_REVIEW" : input.evidenceCompleteness;
  const packetReviewerEvidence = options.candidate ? "PENDING_CANDIDATE_REVIEW" : input.historicalReviewerEvidence;
  const commitsInRange = git(["log", "--oneline", `${baseCommit}..${headCommit}`], { cwd: repoRoot }).stdout.trim() || "none";
  const loopHistory = await readLoopHistoryForMilestone(repoRoot, milestoneId);
  const visualArtifacts = Array.isArray(input.visualArtifacts) ? input.visualArtifacts : [];
  const optionalReference = options.retrospectivePacket ? resolveRepoPath(repoRoot, options.retrospectivePacket) : null;
  const reportGeneratedAt = new Date().toISOString();
  const contractHash = sha256Text(contractText);
  const diffHash = sha256Text(normalizedPatch);
  const validationHash = sha256Text(JSON.stringify(validation));
  const acceptanceHash = sha256Text(JSON.stringify(input.acceptanceEvidence));
  const stateHistoryHash = sha256Text(JSON.stringify({
    terminalState,
    loopHistory
  }));
  const candidateDigest = computeCandidateDigest({
    reviewedHeadCommit: headCommit,
    contractHash,
    diffHash,
    validationHash,
    acceptanceHash,
    stateHistoryHash
  });

  const reviewerAPath = options.reviewerA ?? options.reviewerReport;
  const reviewerBPath = options.reviewerB ?? options.reviewerReport;
  let reviewerAVerdict = null;
  let reviewerBVerdict = null;
  if (status === "PASS" && !options.retrospective && !options.candidate) {
    reviewerAVerdict = await readReviewerVerdict(
      reviewerAPath ? resolveRepoPath(repoRoot, reviewerAPath) : undefined,
      { reviewerId: "A", headCommit, candidateDigest }
    );
    reviewerBVerdict = await readReviewerVerdict(
      reviewerBPath ? resolveRepoPath(repoRoot, reviewerBPath) : undefined,
      { reviewerId: "B", headCommit, candidateDigest }
    );
    if (reviewerAVerdict.verdict !== "PASS" || reviewerBVerdict.verdict !== "PASS") {
      throw new Error("PASS handoff requires reviewer A and reviewer B structured PASS verdicts.");
    }
  }
  if (reviewerAVerdict) {
    await writeFile(path.join(packetRoot, "reviewer-a.json"), `${JSON.stringify(reviewerAVerdict, null, 2)}\n`);
  }
  if (reviewerBVerdict) {
    await writeFile(path.join(packetRoot, "reviewer-b.json"), `${JSON.stringify(reviewerBVerdict, null, 2)}\n`);
  }

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
    `evidenceCompleteness: ${packetEvidenceCompleteness}`,
    `historicalValidationEvidence: ${input.historicalValidationEvidence}`,
    `historicalReviewerEvidence: ${packetReviewerEvidence}`,
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
    `mandatoryCompanions: ${JSON.stringify(patchInfo.mandatoryCompanions)}`,
    `candidateDigest: ${candidateDigest}`,
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
    "- git diff --check records:",
    diffChecks.map((record) => `  - ${record.label}: ${record.status}, exitCode=${record.exitCode}, command=${record.command}`).join("\n"),
    `- workspace clean at generation: ${workspaceClean}`,
    "- ignored runtime artifacts: `.artifacts/loop-validation/`, `.artifacts/loop-handoff/`, Electron `.runtime/` directories are excluded from source status.",
    "",
    "# Changed Files",
    "",
    "## git diff --name-status",
    "",
    changedFiles.length ? changedFiles.map((entry) => `- ${entry.status} ${entry.path}`).join("\n") : "- none",
    sensitiveFiles.length ? "\nSensitive or protected changed paths:\n" + sensitiveFiles.map((entry) => `- ${entry.status} ${entry.path}: redacted=true`).join("\n") : "",
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
    options.candidate
      ? "\nCandidate phase note: reviewer JSON, seal metadata, FINAL_RESPONSE.txt, latest pointer verification, and post-seal verifier evidence are intentionally pending until the seal phase. The candidate digest covers the pre-seal evidence reviewers must bind to."
      : "",
    options.retrospective
      ? "\nRetrospective evidence authority: acceptance entries are derived from the frozen M1 contract and explicitly mark historical validation/reviewer evidence availability. Narrative loop history is not original evidence."
      : "\nEvidence authority: acceptance entries are provided by the milestone handoff input and backed by validation.json, reviewer-a.json, reviewer-b.json, MANIFEST.json, and current Git state.",
    "",
    "# Validation Evidence",
    "",
    `- validation status: ${validationEvidenceStatus}`,
    `- validation schemaVersion: ${validation.schemaVersion ?? "not_available"}`,
    `- repositoryHeadCommitAtStart: ${validation.repositoryHeadCommitAtStart ?? "not_available"}`,
    `- repositoryHeadCommitAtFinish: ${validation.repositoryHeadCommitAtFinish ?? "not_available"}`,
    `- sourceWorkspaceCleanAtStart: ${validation.sourceWorkspaceCleanAtStart ?? "not_available"}`,
    `- sourceWorkspaceCleanAtFinish: ${validation.sourceWorkspaceCleanAtFinish ?? "not_available"}`,
    `- evidence completeness: ${packetEvidenceCompleteness}`,
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
    `- status: ${reviewerAVerdict?.verdict ?? (options.candidate ? "PENDING_CANDIDATE_REVIEW" : "NOT_AVAILABLE")}`,
    "",
    reviewerVerdictMarkdown(reviewerAVerdict),
    "",
    "## Reviewer B",
    "",
    `- status: ${reviewerBVerdict?.verdict ?? (options.candidate ? "PENDING_CANDIDATE_REVIEW" : "NOT_AVAILABLE")}`,
    "",
    reviewerVerdictMarkdown(reviewerBVerdict),
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
    await artifactRecord(packetRoot, "validation.json", "validation-summary", "application/json", false)
  ];
  if (reviewerAVerdict) {
    artifactIndexRecords.push(await artifactRecord(packetRoot, "reviewer-a.json", "independent-reviewer-a-verdict", "application/json", false));
  }
  if (reviewerBVerdict) {
    artifactIndexRecords.push(await artifactRecord(packetRoot, "reviewer-b.json", "independent-reviewer-b-verdict", "application/json", false));
  }
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
    evidenceCompleteness: packetEvidenceCompleteness,
    historicalValidationEvidence: input.historicalValidationEvidence,
    historicalReviewerEvidence: packetReviewerEvidence,
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
    candidateDigest,
    candidateDigestParts: {
      reviewedHeadCommit: headCommit,
      contractHash,
      diffHash,
      validationHash,
      acceptanceHash,
      stateHistoryHash
    },
    seal: {
      phase: options.candidate ? "candidate" : "sealed",
      allowedAdditions: [
        "reviewer structured verdicts",
        "seal metadata",
        "FINAL_RESPONSE.txt"
      ]
    },
    diffChecks,
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
      reviewerA: reviewerAVerdict
        ? { status: reviewerAVerdict.verdict, verdictPath: "reviewer-a.json", candidateDigest: reviewerAVerdict.candidateDigest }
        : { status: options.candidate ? "PENDING_CANDIDATE_REVIEW" : "NOT_AVAILABLE" },
      reviewerB: reviewerBVerdict
        ? { status: reviewerBVerdict.verdict, verdictPath: "reviewer-b.json", candidateDigest: reviewerBVerdict.candidateDigest }
        : { status: options.candidate ? "PENDING_CANDIDATE_REVIEW" : "NOT_AVAILABLE" }
    },
    files: snapshots,
    redactedFiles: sensitiveFiles.map(createRedactedEntry),
    artifacts: artifactIndexRecords,
    generatedFiles: [
      "REVIEW_PACKET.md",
      "MANIFEST.json",
      "changes.patch",
      "validation.json",
      reviewerAVerdict ? "reviewer-a.json" : null,
      reviewerBVerdict ? "reviewer-b.json" : null,
      "artifact-index.json",
      "FINAL_RESPONSE.txt",
      "files/",
      "decisions/"
    ].filter(Boolean),
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
    optionalReference,
    humanDecision
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

  let sealVerification = {
    status: "not_run",
    errors: ["candidate packet is not sealed"]
  };
  if (!options.candidate) {
    await copyLatest(packetRoot, latestRoot);
    sealVerification = await verifySealedPacket({
      repoRoot,
      packetRoot,
      latestRoot,
      manifest,
      finalResponseText: response
    });
    if (sealVerification.status !== "pass") {
      throw new Error(`post-seal verifier failed: ${sealVerification.errors.join("; ")}`);
    }
  }
  manifest.sealVerification = sealVerification;
  await writeFile(path.join(packetRoot, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  if (!options.candidate) {
    await copyLatest(packetRoot, latestRoot);
  }
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
