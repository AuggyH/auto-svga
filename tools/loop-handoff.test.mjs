import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  rm,
  lstat,
  symlink,
  writeFile
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { generateHandoffPacket, verifySealedPacket } from "./loop-handoff.mjs";
import { createLoopValidationSteps } from "./loop-validate.mjs";
import { validateReviewerConfig } from "./loop-reviewer-config-check.mjs";

function run(cmd, args, cwd, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024
  });
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result;
}

async function writeText(filePath, text) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, text);
}

async function writeJson(filePath, value) {
  await writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function requiredValidationSteps() {
  return [
    { id: "handoff-tests", command: "node --test tools/loop-handoff.test.mjs", required: true, status: "pass", exitCode: 0, durationMs: 1, reason: null },
    { id: "reviewer-config-check", command: "node tools/loop-reviewer-config-check.mjs", required: true, status: "pass", exitCode: 0, durationMs: 1, reason: null },
    { id: "loop-budget-check", command: "node tools/loop-budget-check.mjs", required: true, status: "pass", exitCode: 0, durationMs: 1, reason: null }
  ];
}

function budgetSummary({ milestoneId = "M2-R2" } = {}) {
  return {
    schemaVersion: 1,
    status: "pass",
    milestoneId,
    maxRepairRounds: 2,
    maxConsecutiveNoProgressRounds: 1,
    repairRound: 0,
    actualRepairRound: 0,
    consecutiveNoProgressRounds: 0,
    budgetStatus: "within_budget",
    nextRepairRound: 1,
    nextRepairAllowed: true,
    errors: []
  };
}

function hashText(text) {
  return createHash("sha256").update(text).digest("hex");
}

function extractEmbeddedDiffForTest(packetText) {
  const startMarker = "# Full Diff\n\n";
  const startIndex = packetText.indexOf(startMarker);
  assert.notEqual(startIndex, -1);
  const afterMarker = packetText.slice(startIndex + startMarker.length);
  const fenceStart = afterMarker.indexOf("```diff\n");
  assert.notEqual(fenceStart, -1);
  const diffStart = fenceStart + "```diff\n".length;
  const afterDiffStart = afterMarker.slice(diffStart);
  const diffEnd = afterDiffStart.indexOf("\n```\n\n# Changed File Snapshots");
  assert.notEqual(diffEnd, -1);
  return afterDiffStart.slice(0, diffEnd);
}

function criteria(milestoneId = "M2-R2") {
  return Array.from({ length: 15 }, (_, index) => {
    const id = `${milestoneId}-AC-${String(index + 1).padStart(2, "0")}`;
    return {
      id,
      requirement: `${milestoneId} fixture acceptance criterion ${index + 1}`
    };
  });
}

function contractText({ milestoneId = "M2-R2" } = {}) {
  return [
    "# M2-R2 Fixture",
    "",
    `Milestone ID: ${milestoneId}`,
    "",
    "## Acceptance Criteria",
    "",
    ...criteria(milestoneId).map((criterion) => `- \`${criterion.id}\`: ${criterion.requirement}`),
    ""
  ].join("\n");
}

function tableCriteria(milestoneId = "P6-R1") {
  return criteria(milestoneId).map((criterion) => ({
    id: criterion.id,
    criterion: criterion.requirement,
    evidence: `${criterion.requirement} evidence`,
    requirement: `${criterion.requirement}: ${criterion.requirement} evidence`
  }));
}

function tableContractText({ milestoneId = "P6-R1" } = {}) {
  return [
    "# P6-R1 Fixture",
    "",
    `Milestone ID: ${milestoneId}`,
    "",
    "## Formal Acceptance Criteria",
    "",
    "| ID | criterion | required evidence |",
    "| --- | --- | --- |",
    ...tableCriteria(milestoneId).map((criterion) => `| ${criterion.id} | ${criterion.criterion} | ${criterion.evidence} |`),
    ""
  ].join("\n");
}

function acceptanceEvidence({ omit, extra, badHash, milestoneId = "M2-R2" } = {}) {
  const items = criteria(milestoneId)
    .filter((criterion) => criterion.id !== omit)
    .map((criterion) => ({
      criterionId: criterion.id,
      milestoneId,
      requirement: criterion.requirement,
      requirementHash: badHash === criterion.id ? "bad" : hashText(criterion.requirement),
      historicalEvidenceStatus: "PASS",
      retrospectiveEvidenceStatus: "NOT_APPLICABLE",
      evidenceSource: "validation.json, reviewer-a.json, reviewer-b.json, REVIEW_PACKET.md",
      commands: ["node --test tools/loop-handoff.test.mjs"],
      exitCodes: [0],
      evidenceRefs: ["validation.json"],
      limitation: "none"
    }));
  if (extra) {
    items.push({
      criterionId: extra,
      milestoneId,
      requirement: "extra",
      requirementHash: hashText("extra"),
      evidenceSource: "extra",
      commands: ["extra"],
      exitCodes: [0],
      evidenceRefs: ["extra"],
      limitation: "extra"
    });
  }
  return items;
}

function tableAcceptanceEvidence({ milestoneId = "P6-R1" } = {}) {
  return tableCriteria(milestoneId).map((criterion) => ({
    criterionId: criterion.id,
    milestoneId,
    requirement: criterion.requirement,
    requirementHash: hashText(criterion.requirement),
    historicalEvidenceStatus: "PASS",
    retrospectiveEvidenceStatus: "NOT_APPLICABLE",
    evidenceSource: "validation.json, reviewer-a.json, reviewer-b.json, REVIEW_PACKET.md",
    commands: ["node --test tools/loop-handoff.test.mjs"],
    exitCodes: [0],
    evidenceRefs: ["validation.json"],
    limitation: "none"
  }));
}

function baseInput({ base, head, changedFilePurposes, humanDecision = null, milestoneId = "M2-R2" } = {}) {
  return {
    milestoneId,
    milestoneTitle: "Terminal Handoff Trust Hardening",
    reviewedBaseCommit: base,
    reviewedHeadCommit: head,
    milestoneOutcome: "PASS",
    evidenceCompleteness: "COMPLETE",
    historicalValidationEvidence: "PASS",
    historicalReviewerEvidence: "PASS",
    retrospectiveRevalidation: "NOT_APPLICABLE",
    retrospectiveReviewerStatus: "NOT_APPLICABLE",
    implementationSummary: "M2-R2 hardens terminal handoff trust with schema v4, structured reviewer verdicts, validation head binding, candidate seal, safe patch filtering, and concrete human gates.",
    changedFilePurposes,
    acceptanceEvidence: acceptanceEvidence({ milestoneId }),
    validationRuns: [
      { command: "node --test tools/loop-handoff.test.mjs", result: "PASS", exitCode: 0 },
      { command: "npm run loop:validate", result: "PASS", exitCode: 0 }
    ],
    reviewerReports: [
      { reviewer: "A", status: "PASS" },
      { reviewer: "B", status: "PASS" }
    ],
    remainingRisks: ["No product runtime changes are included."],
    visualArtifacts: [],
    humanDecision,
    recommendedNextMilestone: "Wait for external review."
  };
}

async function createRepo() {
  const repo = await mkdtemp(join(tmpdir(), "auto-svga-handoff-v3-"));
  run("git", ["init"], repo);
  run("git", ["config", "user.name", "Codex"], repo);
  run("git", ["config", "user.email", "codex-agent@local"], repo);
  await writeText(join(repo, "docs/loop/CURRENT_MILESTONE.md"), contractText());
  await writeText(join(repo, "docs/loop/LOOP_STATE.md"), [
    "# Auto SVGA Loop State",
    "",
    "- milestoneId: M2-R2",
    "- Milestone: M2-R2 Terminal Handoff Trust Hardening",
    "- State: terminal_pass",
    "- Next Action: external_review",
    ""
  ].join("\n"));
  await writeText(join(repo, "docs/loop/LOOP_HISTORY.jsonl"), `${JSON.stringify({
    milestoneId: "M2-R2",
    iteration: "terminal",
    phase: "seal",
    timestamp: "2026-06-20T00:00:00.000Z",
    hypothesis: "terminal fixture",
    filesChanged: ["src/example.txt"],
    commands: ["node --test tools/loop-handoff.test.mjs"],
    result: "PASS",
    progress: true,
    evidence: ["validation.json"],
    nextAction: "external_review"
  })}\n`);
  await writeText(join(repo, ".gitignore"), ".artifacts/\nnode_modules/\n");
  await writeText(join(repo, "README.md"), "# fixture\n");
  run("git", ["add", "."], repo);
  run("git", ["commit", "-m", "base"], repo);
  const base = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();

  await writeText(join(repo, "src/example.txt"), "hello\n");
  run("git", ["add", "src/example.txt"], repo);
  run("git", ["commit", "-m", "feature"], repo);
  const head = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();

  await writeJson(join(repo, ".artifacts/loop-validation/latest.json"), {
    schemaVersion: 2,
    repositoryHeadCommitAtStart: head,
    repositoryHeadCommitAtFinish: head,
    sourceWorkspaceCleanAtStart: true,
    sourceWorkspaceCleanAtFinish: true,
    status: "pass",
    startedAt: "2026-06-20T00:00:00.000Z",
    finishedAt: "2026-06-20T00:01:00.000Z",
    steps: requiredValidationSteps(),
    knownGaps: {}
  });
  await writeJson(join(repo, ".artifacts/loop-budget-check/latest.json"), budgetSummary());
  await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R2.json"), baseInput({
    base,
    head,
    changedFilePurposes: {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior."
    }
  }));
  return { repo, base, head };
}

async function withRepo(callback) {
  const fixture = await createRepo();
  try {
    return await callback(fixture);
  } finally {
    await rm(fixture.repo, { recursive: true, force: true });
  }
}

function defaultOptions(repo, base, head) {
  return {
    repoRoot: repo,
    status: "PASS",
    milestone: "M2-R2",
    title: "Terminal Handoff Trust Hardening",
    base,
    head,
    input: ".artifacts/loop-handoff-input/M2-R2.json"
  };
}

function p6R1Options(repo, base, head) {
  return {
    ...defaultOptions(repo, base, head),
    milestone: "P6-R1",
    title: "Terminal Handoff Trust Hardening",
    input: ".artifacts/loop-handoff-input/P6-R1.json"
  };
}

async function prepareP6R1Repo(repo, base) {
  await writeText(join(repo, "docs/loop/CURRENT_MILESTONE.md"), tableContractText({ milestoneId: "P6-R1" }));
  await writeText(join(repo, "docs/loop/LOOP_STATE.md"), [
    "# Auto SVGA Loop State",
    "",
    "- milestoneId: P6-R1",
    "- Milestone: P6-R1 Runtime Parity Repair",
    "- State: terminal_pass",
    "- Next Action: external_review",
    ""
  ].join("\n"));
  await writeText(join(repo, "docs/loop/LOOP_HISTORY.jsonl"), `${JSON.stringify({
    milestoneId: "P6-R1",
    iteration: "terminal",
    result: "PASS",
    progress: true,
    nextAction: "external_review"
  })}\n`);
  const head = await commitFixture(repo, "p6 r1 fixture");
  await writeJson(join(repo, ".artifacts/loop-validation/latest.json"), {
    schemaVersion: 2,
    repositoryHeadCommitAtStart: head,
    repositoryHeadCommitAtFinish: head,
    sourceWorkspaceCleanAtStart: true,
    sourceWorkspaceCleanAtFinish: true,
    status: "pass",
    startedAt: "2026-06-20T00:00:00.000Z",
    finishedAt: "2026-06-20T00:01:00.000Z",
    steps: requiredValidationSteps(),
    knownGaps: {}
  });
  await writeJson(join(repo, ".artifacts/loop-budget-check/latest.json"), budgetSummary({ milestoneId: "P6-R1" }));
  const input = baseInput({
    base,
    head,
    milestoneId: "P6-R1",
    changedFilePurposes: {
      "src/example.txt": "Adds a fixture implementation file used to verify P6-R1 handoff behavior.",
      "docs/loop/CURRENT_MILESTONE.md": "Records the P6-R1 fixture contract.",
      "docs/loop/LOOP_STATE.md": "Records the P6-R1 fixture terminal state.",
      "docs/loop/LOOP_HISTORY.jsonl": "Records the P6-R1 fixture terminal history."
    }
  });
  input.acceptanceEvidence = tableAcceptanceEvidence({ milestoneId: "P6-R1" });
  await writeJson(join(repo, ".artifacts/loop-handoff-input/P6-R1.json"), input);
  return head;
}

const p6R1ReviewerBCategoryIds = [
  "productIdentity",
  "toolbarAndModes",
  "localPreview",
  "exportReview",
  "comparison",
  "referenceMedia",
  "playbackControls",
  "fitControls",
  "synchronizedPlayback",
  "inspectionOverview",
  "assetDetails",
  "motionAssetAudit",
  "runtimeLogs",
  "settings",
  "theme",
  "accessibilitySettings",
  "emptyState",
  "loadingState",
  "invalidState",
  "responsiveLayout",
  "interactionParity",
  "motionParity",
  "normalMacApp",
  "bundleCompleteness",
  "bundlePrivacy"
];

function p6R1ReviewerBCategories(head, mutate = (category) => category) {
  return p6R1ReviewerBCategoryIds.map((categoryId) => mutate({
    category: categoryId,
    verdict: "PASS",
    visualObservation: `${categoryId} visual evidence was reviewed against the owner-visible material.`,
    runtimeBehaviorObservation: `${categoryId} runtime behavior was reviewed against bound Desktop and Web evidence.`,
    approvedDifferenceAssessment: `${categoryId} differences were checked and no unapproved product difference remains.`,
    evidenceRefs: [{
      path: `.artifacts/product/P6/${categoryId}.json`,
      headCommit: head,
      present: true,
      humanReviewRequired: true
    }]
  }, categoryId));
}

async function writeReviewerVerdicts(repo, head, candidate, overrides = {}) {
  const candidateDigest = typeof candidate === "string" ? candidate : candidate.candidateDigest;
  const sourceDiffSha256 = typeof candidate === "string" ? overrides.A?.sourceDiffSha256 : candidate.sourceDiffSha256;
  const packetDiffSha256 = typeof candidate === "string" ? overrides.B?.packetDiffSha256 : candidate.packetDiffSha256;
  await writeJson(join(repo, ".artifacts/loop-review/reviewer-a.json"), {
    schemaVersion: 2,
    reviewerId: "A",
    verdict: "PASS",
    reviewedHeadCommit: head,
    candidateDigest,
    sourceDiffSha256,
    generatedAt: "2026-06-20T00:02:00.000Z",
    conditions: [],
    findings: [],
    ...overrides.A
  });
  await writeJson(join(repo, ".artifacts/loop-review/reviewer-b.json"), {
    schemaVersion: 2,
    reviewerId: "B",
    verdict: "PASS",
    reviewedHeadCommit: head,
    candidateDigest,
    packetDiffSha256,
    generatedAt: "2026-06-20T00:02:00.000Z",
    conditions: [],
    findings: [],
    ...overrides.B
  });
}

async function refreshValidationAndInput(repo, base, head, changedFilePurposes, inputOverrides = {}) {
  await writeJson(join(repo, ".artifacts/loop-validation/latest.json"), {
    schemaVersion: 2,
    repositoryHeadCommitAtStart: head,
    repositoryHeadCommitAtFinish: head,
    sourceWorkspaceCleanAtStart: true,
    sourceWorkspaceCleanAtFinish: true,
    status: "pass",
    startedAt: "2026-06-20T00:00:00.000Z",
    finishedAt: "2026-06-20T00:01:00.000Z",
    steps: requiredValidationSteps(),
    knownGaps: {}
  });
  await writeJson(join(repo, ".artifacts/loop-budget-check/latest.json"), budgetSummary());
  await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R2.json"), {
    ...baseInput({ base, head, changedFilePurposes }),
    ...inputOverrides
  });
}

async function commitFixture(repo, message) {
  run("git", ["add", "."], repo);
  run("git", ["commit", "-m", message], repo);
  return run("git", ["rev-parse", "HEAD"], repo).stdout.trim();
}

async function generateSealedPacket({ repo, base, head, options = {}, reviewerOverrides = {} }) {
  const candidate = await generateHandoffPacket({
    ...defaultOptions(repo, base, head),
    ...options,
    candidate: true
  });
  await writeReviewerVerdicts(repo, head, candidate.manifest, reviewerOverrides);
  return generateHandoffPacket({
    ...defaultOptions(repo, base, head),
    ...options,
    reviewerA: ".artifacts/loop-review/reviewer-a.json",
    reviewerB: ".artifacts/loop-review/reviewer-b.json"
  });
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readAllPacketTextFiles(root) {
  const result = [];
  async function walk(current) {
    const entries = await readdir(current);
    for (const entry of entries) {
      const filePath = join(current, entry);
      const fileStat = await lstat(filePath);
      if (fileStat.isDirectory()) {
        await walk(filePath);
        continue;
      }
      if (fileStat.isFile()) {
        const bytes = await readFile(filePath);
        if (!bytes.includes(0)) result.push(bytes.toString("utf8"));
      }
    }
  }
  await walk(root);
  return result;
}

async function writeHumanDecision(repo) {
  await writeJson(join(repo, ".artifacts/loop-decision.json"), {
    schemaVersion: 1,
    gateType: "SECURITY",
    question: "How should the redacted file be handled?",
    options: [
      { id: "A", label: "Keep redacted", impact: "Prevents leaking sensitive content." },
      { id: "B", label: "Stop", impact: "Waits for manual cleanup." }
    ],
    recommendation: "A",
    evidence: ["secret redaction required"],
    safeDefaultWhileWaiting: "Do not generate PASS."
  });
}

async function setHumanRequiredState(repo) {
  await writeText(join(repo, "docs/loop/LOOP_STATE.md"), "- milestoneId: M2-R2\n- Milestone: M2-R2\n- State: terminal_human_required\n- Next Action: external_review\n");
  await writeText(join(repo, "docs/loop/LOOP_HISTORY.jsonl"), `${JSON.stringify({ milestoneId: "M2-R2", iteration: "terminal", result: "HUMAN_REQUIRED", progress: true, nextAction: "external_review" })}\n`);
}

async function expectPacketExcludesSentinel(packetRoot, sentinel) {
  for (const text of await readAllPacketTextFiles(packetRoot)) {
    assert.equal(text.includes(sentinel), false);
  }
}

test("reviewer.toml config validates and remains read-only", async () => {
  const result = await validateReviewerConfig(".codex/agents/reviewer.toml");

  assert.equal(result.status, "pass");
  assert.equal(result.permissions.mode, "read-only");
  assert.equal(result.permissions.allow_writes, false);
  assert.equal(result.mustCheck.includes("scope drift"), true);
  assert.equal(result.mustCheck.includes("review handoff completeness"), true);
});

test("PASS packet generation creates schema v4 sealed packet", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateSealedPacket({ repo, base, head });
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    const packet = await readFile(join(result.packetRoot, "REVIEW_PACKET.md"), "utf8");

    assert.equal(manifest.schemaVersion, 4);
    assert.equal(manifest.packetStatus, "COMPLETE");
    assert.equal(manifest.milestoneOutcome, "PASS");
    assert.equal(manifest.seal.phase, "sealed");
    assert.equal(manifest.reviewers.reviewerA.status, "PASS");
    assert.equal(manifest.reviewers.reviewerA.candidateDigest, manifest.candidateDigest);
    assert.equal(manifest.diffFidelity, "EXACT");
    assert.equal(manifest.sourceDiffSha256, manifest.packetDiffSha256);
    assert.equal(manifest.reviewers.reviewerA.sourceDiffSha256, manifest.sourceDiffSha256);
    assert.equal(manifest.reviewers.reviewerB.packetDiffSha256, manifest.packetDiffSha256);
    assert.match(packet, /schemaVersion: 4/);
    assert.match(packet, /candidateDigest:/);
    assert.match(packet, /```diff/);
  });
});

test("HUMAN_REQUIRED sealed packet can carry reviewer PASS verdicts", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const humanDecision = {
      schemaVersion: 1,
      question: "Accept the visual result?",
      options: [
        { id: "accept", label: "Accept", impact: "Proceed to the next milestone." },
        { id: "reject", label: "Reject", impact: "Keep the milestone blocked for repair." }
      ],
      recommendation: "reject",
      evidence: ["visual artifact"],
      safeDefaultWhileWaiting: "Keep the milestone in HUMAN_REQUIRED."
    };
    await refreshValidationAndInput(repo, base, head, {
      "docs/loop/LOOP_STATE.md": "Records the terminal human required state used by the fixture.",
      "docs/loop/LOOP_HISTORY.jsonl": "Records the terminal human required history used by the fixture.",
      "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior."
    }, {
      milestoneOutcome: "HUMAN_REQUIRED",
      evidenceCompleteness: "PARTIAL",
      historicalReviewerEvidence: "PASS"
    });
    await writeText(join(repo, "docs/loop/LOOP_STATE.md"), "- milestoneId: M2-R2\n- Milestone: M2-R2\n- State: terminal_human_required\n- Next Action: external_review\n");
    await writeText(join(repo, "docs/loop/LOOP_HISTORY.jsonl"), `${JSON.stringify({ milestoneId: "M2-R2", iteration: "terminal", result: "HUMAN_REQUIRED", progress: true, nextAction: "external_review" })}\n`);
    await writeJson(join(repo, ".artifacts/loop-decision.json"), humanDecision);
    const candidate = await generateHandoffPacket({
      ...defaultOptions(repo, base, head),
      status: "HUMAN_REQUIRED",
      decisionFile: ".artifacts/loop-decision.json",
      candidate: true
    });
    await writeReviewerVerdicts(repo, head, candidate.manifest);
    const result = await generateHandoffPacket({
      ...defaultOptions(repo, base, head),
      status: "HUMAN_REQUIRED",
      decisionFile: ".artifacts/loop-decision.json",
      reviewerA: ".artifacts/loop-review/reviewer-a.json",
      reviewerB: ".artifacts/loop-review/reviewer-b.json"
    });
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    const packet = await readFile(join(result.packetRoot, "REVIEW_PACKET.md"), "utf8");

    assert.equal(manifest.milestoneOutcome, "HUMAN_REQUIRED");
    assert.equal(manifest.reviewers.reviewerA.status, "PASS");
    assert.equal(manifest.reviewers.reviewerA.sourceDiffSha256, manifest.sourceDiffSha256);
    assert.equal(manifest.reviewers.reviewerB.status, "PASS");
    assert.equal(manifest.reviewers.reviewerB.packetDiffSha256, manifest.packetDiffSha256);
    assert.match(packet, /## Reviewer A\n\n- status: PASS/);
    assert.match(packet, /## Reviewer B\n\n- status: PASS/);
  });
});

test("PASS changes.patch is byte-exact with literal source diff", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateSealedPacket({ repo, base, head });
    const packetPatch = await readFile(join(result.packetRoot, "changes.patch"), "utf8");
    const sourcePatch = run("git", [
      "--literal-pathspecs",
      "diff",
      "--binary",
      "--no-ext-diff",
      "--no-textconv",
      `${base}..${head}`,
      "--",
      "src/example.txt"
    ], repo).stdout;

    assert.equal(packetPatch, sourcePatch);
    assert.equal(result.manifest.diffFidelity, "EXACT");
    assert.equal(result.manifest.sourceDiffSha256, hashText(sourcePatch));
    assert.equal(result.manifest.packetDiffSha256, hashText(packetPatch));
  });
});

test("embedded full diff is byte-exact with changes.patch and recorded hashes", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateSealedPacket({ repo, base, head });
    const packetText = await readFile(join(result.packetRoot, "REVIEW_PACKET.md"), "utf8");
    const patchText = await readFile(join(result.packetRoot, "changes.patch"), "utf8");
    const embeddedDiff = extractEmbeddedDiffForTest(packetText);

    assert.equal(result.manifest.companionRequired, false);
    assert.equal(embeddedDiff, patchText);
    assert.equal(hashText(embeddedDiff), result.manifest.sourceDiffSha256);
    assert.equal(hashText(embeddedDiff), result.manifest.packetDiffSha256);
  });
});

test("post-seal verifier fails when embedded full diff is changed without changing changes.patch", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateSealedPacket({ repo, base, head });
    const packetPath = join(result.packetRoot, "REVIEW_PACKET.md");
    const packetText = await readFile(packetPath, "utf8");
    await writeText(packetPath, packetText.replace("hello", "hullo"));

    const seal = await verifySealedPacket({
      repoRoot: repo,
      packetRoot: result.packetRoot,
      latestRoot: join(repo, ".artifacts/loop-handoff/latest"),
      manifest: await readJson(join(result.packetRoot, "MANIFEST.json")),
      finalResponseText: await readFile(join(result.packetRoot, "FINAL_RESPONSE.txt"), "utf8")
    });

    assert.equal(seal.status, "fail");
    assert.equal(seal.errors.some((error) => error.includes("embedded full diff") || error.includes("artifact sha256 mismatch")), true);
  });
});

test("handoff refuses private local paths in source diff before sealing", async () => {
  await withRepo(async ({ repo, base }) => {
    const privatePath = ["", "Users", "private-user", "example"].join("/");
    await writeText(join(repo, "src/private-path.js"), `export const path = ${JSON.stringify(privatePath)};\n`);
    run("git", ["add", "src/private-path.js"], repo);
    run("git", ["commit", "-m", "private path"], repo);
    const head = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();
    await refreshValidationAndInput(repo, base, head, {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
      "src/private-path.js": "Adds a generated private-path fixture to verify seal-time privacy failure."
    });

    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
      /private local paths/
    );
  });
});

test("safe token-like source code is not redacted from PASS packet diff", async () => {
  await withRepo(async ({ repo, base }) => {
    await writeText(join(repo, "src/token-code.js"), [
      "const token = argv[index];",
      "const passwordPolicy = config.passwordPolicy;",
      ""
    ].join("\n"));
    run("git", ["add", "src/token-code.js"], repo);
    run("git", ["commit", "-m", "token code"], repo);
    const head = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();
    await refreshValidationAndInput(repo, base, head, {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
      "src/token-code.js": "Adds safe token-named source code to verify packet diffs are not generically redacted."
    });

    const result = await generateSealedPacket({ repo, base, head });
    const patch = await readFile(join(result.packetRoot, "changes.patch"), "utf8");
    assert.match(patch, /const token = argv\[index\];/);
    assert.match(patch, /const passwordPolicy = config\.passwordPolicy;/);
    assert.equal(patch.includes("[redacted]"), false);
  });
});

test("PASS fails closed on high-confidence secret content", async () => {
  await withRepo(async ({ repo, base }) => {
    const secretValue = ["abcdefghijklmnopqrstuvwxyz", "ABC1234567890"].join("");
    await writeText(join(repo, "src/secret-code.js"), `const API_KEY = "${secretValue}";\n`);
    run("git", ["add", "src/secret-code.js"], repo);
    run("git", ["commit", "-m", "secret code"], repo);
    const head = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();
    await refreshValidationAndInput(repo, base, head, {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
      "src/secret-code.js": "Adds a high-confidence secret fixture to verify PASS fail-closed behavior."
    });

    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
      /refuses sensitive content|high-confidence secret/
    );
  });
});

test("HUMAN_REQUIRED redacts committed safe-path secret snapshots", async () => {
  await withRepo(async ({ repo, base }) => {
    const secretValue = ["abcdefghijklmnopqrstuvwxyz", "ABC1234567890"].join("");
    const secretPath = "src/committed-secret.js";
    await writeText(join(repo, secretPath), `const API_KEY = "${secretValue}";\n`);
    run("git", ["add", secretPath], repo);
    run("git", ["commit", "-m", "committed safe secret"], repo);
    const head = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();
    await refreshValidationAndInput(repo, base, head, {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
      "docs/loop/LOOP_STATE.md": "Records the terminal human required state used by the fixture.",
      "docs/loop/LOOP_HISTORY.jsonl": "Records the terminal human required history used by the fixture."
    }, { milestoneOutcome: "HUMAN_REQUIRED" });
    await writeHumanDecision(repo);
    await setHumanRequiredState(repo);

    const result = await generateHandoffPacket({
      ...defaultOptions(repo, base, head),
      status: "HUMAN_REQUIRED",
      decisionFile: ".artifacts/loop-decision.json"
    });
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    const redacted = manifest.redactedFiles.find((entry) => entry.repositoryPath === secretPath);

    assert.equal(Boolean(redacted), true);
    assert.equal(redacted.redacted, true);
    assert.equal(redacted.ruleId, "high-entropy-secret-assignment");
    assert.equal(typeof redacted.sha256, "string");
    assert.equal(redacted.sizeBytes > 0, true);
    assert.equal(manifest.files.some((entry) => entry.repositoryPath === secretPath), false);
    await expectPacketExcludesSentinel(result.packetRoot, secretValue);
  });
});

test("HUMAN_REQUIRED redacts staged safe-path secret snapshots", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const secretValue = ["ZYXWVUTSRQPONMLKJIHGFEDCBA", "9876543210"].join("");
    const secretPath = "src/staged-secret.js";
    await writeText(join(repo, secretPath), `const API_KEY = "${secretValue}";\n`);
    run("git", ["add", secretPath], repo);
    await refreshValidationAndInput(repo, base, head, {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
      "docs/loop/LOOP_STATE.md": "Records the terminal human required state used by the fixture.",
      "docs/loop/LOOP_HISTORY.jsonl": "Records the terminal human required history used by the fixture."
    }, { milestoneOutcome: "HUMAN_REQUIRED" });
    await writeHumanDecision(repo);
    await setHumanRequiredState(repo);

    const result = await generateHandoffPacket({
      ...defaultOptions(repo, base, head),
      status: "HUMAN_REQUIRED",
      decisionFile: ".artifacts/loop-decision.json"
    });
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));

    assert.equal(manifest.redactedFiles.some((entry) => entry.repositoryPath === secretPath && entry.redacted), true);
    assert.equal(manifest.files.some((entry) => entry.repositoryPath === secretPath), false);
    await expectPacketExcludesSentinel(result.packetRoot, secretValue);
  });
});

test("HUMAN_REQUIRED redacts untracked safe-path secret snapshots", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const secretValue = ["MNOPQRSTUVWXYZabcdefghijkl", "1234567890"].join("");
    const secretPath = "src/untracked-secret.js";
    await writeText(join(repo, secretPath), `const API_KEY = "${secretValue}";\n`);
    await refreshValidationAndInput(repo, base, head, {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
      "docs/loop/LOOP_STATE.md": "Records the terminal human required state used by the fixture.",
      "docs/loop/LOOP_HISTORY.jsonl": "Records the terminal human required history used by the fixture."
    }, { milestoneOutcome: "HUMAN_REQUIRED" });
    await writeHumanDecision(repo);
    await setHumanRequiredState(repo);

    const result = await generateHandoffPacket({
      ...defaultOptions(repo, base, head),
      status: "HUMAN_REQUIRED",
      decisionFile: ".artifacts/loop-decision.json"
    });
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));

    assert.equal(manifest.redactedFiles.some((entry) => entry.repositoryPath === secretPath && entry.redacted), true);
    assert.equal(manifest.files.some((entry) => entry.repositoryPath === secretPath), false);
    await expectPacketExcludesSentinel(result.packetRoot, secretValue);
  });
});

test("HUMAN_REQUIRED redacts tracked worktree safe-path secret snapshots", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const secretValue = ["QRSTUVWXabcdefghijklmnop", "1234567890"].join("");
    const secretPath = "src/example.txt";
    await writeText(join(repo, secretPath), `const API_KEY = "${secretValue}";\n`);
    await refreshValidationAndInput(repo, base, head, {
      "docs/loop/LOOP_STATE.md": "Records the terminal human required state used by the fixture.",
      "docs/loop/LOOP_HISTORY.jsonl": "Records the terminal human required history used by the fixture."
    }, { milestoneOutcome: "HUMAN_REQUIRED" });
    await writeHumanDecision(repo);
    await setHumanRequiredState(repo);

    const result = await generateHandoffPacket({
      ...defaultOptions(repo, base, head),
      status: "HUMAN_REQUIRED",
      decisionFile: ".artifacts/loop-decision.json"
    });
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));

    assert.equal(manifest.redactedFiles.some((entry) => entry.repositoryPath === secretPath && entry.redacted), true);
    assert.equal(manifest.files.some((entry) => entry.repositoryPath === secretPath), false);
    await expectPacketExcludesSentinel(result.packetRoot, secretValue);
  });
});

test("PASS requires loop budget check summary", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await rm(join(repo, ".artifacts/loop-budget-check/latest.json"), { force: true });

    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
      /loop budget check summary/
    );
  });
});

test("literal pathspec handles pathspec-magic-looking file names", async () => {
  await withRepo(async ({ repo, base }) => {
    const weirdPath = "src/:(glob)literal.txt";
    await writeText(join(repo, weirdPath), "literal pathspec content\n");
    run("git", ["add", weirdPath], repo);
    run("git", ["commit", "-m", "literal pathspec"], repo);
    const head = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();
    await refreshValidationAndInput(repo, base, head, {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
      [weirdPath]: "Adds a pathspec-magic-looking filename to verify literal Git path handling."
    });

    const result = await generateSealedPacket({ repo, base, head });
    const packet = await readFile(join(result.packetRoot, "REVIEW_PACKET.md"), "utf8");
    assert.match(packet, /src\/:\(glob\)literal\.txt/);
  });
});

test("terminal state mismatch fails PASS generation", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await writeText(join(repo, "docs/loop/LOOP_STATE.md"), "- milestoneId: M2-R2\n- Milestone: M2-R2\n- State: implementation_in_progress\n- Next Action: repair\n");
    head = await commitFixture(repo, "bad state");
    await refreshValidationAndInput(repo, base, head, {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
      "docs/loop/LOOP_STATE.md": "Records an intentionally invalid terminal state for regression coverage."
    });
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
      /LOOP_STATE/
    );
  });
});

test("terminal state requires external_review next action", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await writeText(join(repo, "docs/loop/LOOP_STATE.md"), "- milestoneId: M2-R2\n- Milestone: M2-R2\n- State: terminal_pass\n- Next Action: final_validation\n");
    head = await commitFixture(repo, "bad terminal next action");
    await refreshValidationAndInput(repo, base, head, {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
      "docs/loop/LOOP_STATE.md": "Records an intentionally invalid terminal next action for regression coverage."
    });
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
      /next action/
    );
  });
});

test("terminal state rejects duplicate machine Next Action fields", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await writeText(join(repo, "docs/loop/LOOP_STATE.md"), [
      "- milestoneId: M2-R2",
      "- Milestone: M2-R2",
      "- State: terminal_pass",
      "- Next Action: external_review",
      "- Next Action: repair",
      ""
    ].join("\n"));
    head = await commitFixture(repo, "duplicate next action");
    await refreshValidationAndInput(repo, base, head, {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
      "docs/loop/LOOP_STATE.md": "Records an intentionally duplicated terminal next action for regression coverage."
    });
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
      /exactly one machine Next Action/
    );
  });
});

test("terminal state rejects contradictory human next action section", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await writeText(join(repo, "docs/loop/LOOP_STATE.md"), [
      "# Auto SVGA Loop State",
      "",
      "- milestoneId: M2-R2",
      "- Milestone: M2-R2",
      "- State: terminal_pass",
      "- Next Action: external_review",
      "",
      "## Next Action",
      "",
      "Generate the final candidate and seal packet.",
      ""
    ].join("\n"));
    head = await commitFixture(repo, "contradictory next action section");
    await refreshValidationAndInput(repo, base, head, {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
      "docs/loop/LOOP_STATE.md": "Records an intentionally contradictory human next action section for regression coverage."
    });
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
      /contradicts/
    );
  });
});

test("terminal state rejects implementation, validation, or review requests in human next action section", async () => {
  for (const actionText of [
    "Perform more implementation before external review.",
    "Do validation before external review.",
    "Run review before external_review."
  ]) {
    await withRepo(async ({ repo, base, head }) => {
      await writeText(join(repo, "docs/loop/LOOP_STATE.md"), [
        "# Auto SVGA Loop State",
        "",
        "- milestoneId: M2-R2",
        "- Milestone: M2-R2",
        "- State: terminal_pass",
        "- Next Action: external_review",
        "",
        "## Next Action",
        "",
        actionText,
        ""
      ].join("\n"));
      head = await commitFixture(repo, `contradictory ${actionText.slice(0, 8)}`);
      await refreshValidationAndInput(repo, base, head, {
        "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
        "docs/loop/LOOP_STATE.md": "Records an intentionally contradictory human next action section for regression coverage."
      });
      await assert.rejects(
        generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
        /contradicts/
      );
    });
  }
});

test("terminal state allows await external review with negative action guidance", async () => {
  for (const guidance of [
    [
      "Await external review.",
      "Do not perform additional implementation, validation, review, candidate generation, or sealing until a new directive is received."
    ],
    [
      "Await external review. Do not perform additional implementation, validation,",
      "candidate generation, review, or sealing until a new directive is received."
    ]
  ]) {
    await withRepo(async ({ repo, base, head }) => {
      await writeText(join(repo, "docs/loop/LOOP_STATE.md"), [
        "# Auto SVGA Loop State",
        "",
        "- milestoneId: M2-R2",
        "- Milestone: M2-R2",
        "- State: terminal_pass",
        "- Next Action: external_review",
        "",
        "## Next Action",
        "",
        ...guidance,
        ""
      ].join("\n"));
      head = await commitFixture(repo, "terminal await external review");
      await refreshValidationAndInput(repo, base, head, {
        "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
        "docs/loop/LOOP_STATE.md": "Records terminal external review guidance for regression coverage."
      });

      const result = await generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true });
      assert.equal(result.manifest.packetStatus, "INCOMPLETE");
    });
  }
});

test("terminal HUMAN_REQUIRED state allows product owner human gate next action", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await writeText(join(repo, "docs/loop/LOOP_STATE.md"), [
      "# Auto SVGA Loop State",
      "",
      "- milestoneId: M2-R2",
      "- Milestone: M2-R2 Terminal Handoff Trust Hardening",
      "- State: terminal_human_required",
      "- Next Action: product_owner_human_gate",
      "",
      "## Next Action",
      "",
      "Product Owner Human Gate: review the canonical owner handoff materials.",
      ""
    ].join("\n"));
    await writeText(join(repo, "docs/loop/LOOP_HISTORY.jsonl"), `${JSON.stringify({
      milestoneId: "M2-R2",
      iteration: "terminal",
      result: "HUMAN_REQUIRED",
      progress: true,
      nextAction: "product_owner_human_gate"
    })}\n`);
    head = await commitFixture(repo, "terminal product owner gate");
    await writeJson(join(repo, ".artifacts/loop-decision.json"), {
      schemaVersion: 1,
      question: "Should the Product Owner accept this HUMAN_REQUIRED milestone?",
      recommendation: "review_handoff",
      options: [
        {
          id: "review_handoff",
          label: "Review handoff",
          impact: "Keeps the milestone in HUMAN_REQUIRED until the Product Owner reviews the packet."
        },
        {
          id: "request_changes",
          label: "Request changes",
          impact: "Returns the milestone to repair with explicit Product Owner findings."
        }
      ],
      evidence: [
        "LOOP_STATE.md terminal product_owner_human_gate",
        "LOOP_HISTORY.jsonl terminal HUMAN_REQUIRED entry"
      ],
      safeDefaultWhileWaiting: "Keep the milestone in HUMAN_REQUIRED."
    });
    await refreshValidationAndInput(repo, base, head, {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
      "docs/loop/LOOP_STATE.md": "Records terminal Product Owner Human Gate guidance for regression coverage.",
      "docs/loop/LOOP_HISTORY.jsonl": "Records terminal Product Owner Human Gate history for regression coverage."
    }, {
      milestoneOutcome: "HUMAN_REQUIRED",
      historicalReviewerEvidence: "PASS"
    });

    const result = await generateHandoffPacket({
      ...defaultOptions(repo, base, head),
      status: "HUMAN_REQUIRED",
      decisionFile: ".artifacts/loop-decision.json",
      candidate: true
    });
    assert.equal(result.manifest.packetStatus, "INCOMPLETE");
    assert.equal(result.manifest.milestoneOutcome, "HUMAN_REQUIRED");
  });
});

test("terminal history final result must match PASS", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await writeText(join(repo, "docs/loop/LOOP_HISTORY.jsonl"), `${JSON.stringify({ milestoneId: "M2-R2", iteration: "terminal", result: "IN_PROGRESS", progress: false, nextAction: "repair" })}\n`);
    head = await commitFixture(repo, "bad history");
    await refreshValidationAndInput(repo, base, head, {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
      "docs/loop/LOOP_HISTORY.jsonl": "Records an intentionally invalid terminal history result for regression coverage."
    });
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
      /Last LOOP_HISTORY/
    );
  });
});

test("reviewer JSON head mismatch is rejected", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const candidate = await generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true });
    await writeReviewerVerdicts(repo, head, candidate.manifest, { A: { reviewedHeadCommit: base } });
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), reviewerA: ".artifacts/loop-review/reviewer-a.json", reviewerB: ".artifacts/loop-review/reviewer-b.json" }),
      /reviewedHeadCommit mismatch/
    );
  });
});

test("reviewer JSON candidate digest mismatch is rejected", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const candidate = await generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true });
    await writeReviewerVerdicts(repo, head, candidate.manifest, { B: { candidateDigest: "bad" } });
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), reviewerA: ".artifacts/loop-review/reviewer-a.json", reviewerB: ".artifacts/loop-review/reviewer-b.json" }),
      /candidateDigest mismatch/
    );
  });
});

test("reviewer A sourceDiffSha256 mismatch is rejected", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const candidate = await generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true });
    await writeReviewerVerdicts(repo, head, candidate.manifest, { A: { sourceDiffSha256: "bad" } });
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), reviewerA: ".artifacts/loop-review/reviewer-a.json", reviewerB: ".artifacts/loop-review/reviewer-b.json" }),
      /sourceDiffSha256 mismatch/
    );
  });
});

test("reviewer B packetDiffSha256 mismatch is rejected", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const candidate = await generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true });
    await writeReviewerVerdicts(repo, head, candidate.manifest, { B: { packetDiffSha256: "bad" } });
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), reviewerA: ".artifacts/loop-review/reviewer-a.json", reviewerB: ".artifacts/loop-review/reviewer-b.json" }),
      /packetDiffSha256 mismatch/
    );
  });
});

test("P6-R1 Reviewer B requires 25 structured product category observations", async () => {
  await withRepo(async ({ repo, base }) => {
    const head = await prepareP6R1Repo(repo, base);
    const options = p6R1Options(repo, base, head);
    const candidate = await generateHandoffPacket({ ...options, candidate: true });
    await writeReviewerVerdicts(repo, head, candidate.manifest, {
      B: { categories: p6R1ReviewerBCategories(head) }
    });

    const result = await generateHandoffPacket({
      ...options,
      reviewerA: ".artifacts/loop-review/reviewer-a.json",
      reviewerB: ".artifacts/loop-review/reviewer-b.json"
    });

    assert.equal(result.manifest.reviewers.reviewerB.status, "PASS");
  });
});

test("P6-R1 Reviewer B rejects bare string category PASS", async () => {
  await withRepo(async ({ repo, base }) => {
    const head = await prepareP6R1Repo(repo, base);
    const options = p6R1Options(repo, base, head);
    const candidate = await generateHandoffPacket({ ...options, candidate: true });
    await writeReviewerVerdicts(repo, head, candidate.manifest, {
      B: { categories: p6R1ReviewerBCategoryIds.map(() => "PASS") }
    });

    await assert.rejects(
      generateHandoffPacket({
        ...options,
        reviewerA: ".artifacts/loop-review/reviewer-a.json",
        reviewerB: ".artifacts/loop-review/reviewer-b.json"
      }),
      /categories must be structured objects/
    );
  });
});

test("P6-R1 Reviewer B rejects missing category", async () => {
  await withRepo(async ({ repo, base }) => {
    const head = await prepareP6R1Repo(repo, base);
    const options = p6R1Options(repo, base, head);
    const candidate = await generateHandoffPacket({ ...options, candidate: true });
    await writeReviewerVerdicts(repo, head, candidate.manifest, {
      B: { categories: p6R1ReviewerBCategories(head).filter((category) => category.category !== "bundlePrivacy") }
    });

    await assert.rejects(
      generateHandoffPacket({
        ...options,
        reviewerA: ".artifacts/loop-review/reviewer-a.json",
        reviewerB: ".artifacts/loop-review/reviewer-b.json"
      }),
      /requires 25 categories/
    );
  });
});

test("P6-R1 Reviewer B rejects absent or wrong-head evidence refs", async () => {
  await withRepo(async ({ repo, base }) => {
    const head = await prepareP6R1Repo(repo, base);
    const options = p6R1Options(repo, base, head);
    const candidate = await generateHandoffPacket({ ...options, candidate: true });
    await writeReviewerVerdicts(repo, head, candidate.manifest, {
      B: {
        categories: p6R1ReviewerBCategories(head, (category, categoryId) => (
          categoryId === "invalidState"
            ? { ...category, evidenceRefs: [{ ...category.evidenceRefs[0], present: false }] }
            : category
        ))
      }
    });

    await assert.rejects(
      generateHandoffPacket({
        ...options,
        reviewerA: ".artifacts/loop-review/reviewer-a.json",
        reviewerB: ".artifacts/loop-review/reviewer-b.json"
      }),
      /is not present for review/
    );

    await writeReviewerVerdicts(repo, head, candidate.manifest, {
      B: {
        categories: p6R1ReviewerBCategories(head, (category, categoryId) => (
          categoryId === "invalidState"
            ? { ...category, evidenceRefs: [{ ...category.evidenceRefs[0], headCommit: base }] }
            : category
        ))
      }
    });
    await assert.rejects(
      generateHandoffPacket({
        ...options,
        reviewerA: ".artifacts/loop-review/reviewer-a.json",
        reviewerB: ".artifacts/loop-review/reviewer-b.json"
      }),
      /head mismatch/
    );
  });
});

test("reviewer JSON PASS with conditions is rejected", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const candidate = await generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true });
    await writeReviewerVerdicts(repo, head, candidate.manifest, { A: { conditions: ["needs follow-up"] } });
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), reviewerA: ".artifacts/loop-review/reviewer-a.json", reviewerB: ".artifacts/loop-review/reviewer-b.json" }),
      /cannot include conditions/
    );
  });
});

test("reviewer markdown words do not affect structured verdict", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await writeText(join(repo, ".artifacts/loop-review/reviewer-a.md"), "no blocking findings\nfailure path passed\nPASS condition not met\n");
    const result = await generateSealedPacket({ repo, base, head });
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    assert.equal(manifest.reviewers.reviewerA.status, "PASS");
  });
});

test("stale validation head is rejected", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const validation = await readJson(join(repo, ".artifacts/loop-validation/latest.json"));
    validation.repositoryHeadCommitAtStart = base;
    validation.repositoryHeadCommitAtFinish = base;
    await writeJson(join(repo, ".artifacts/loop-validation/latest.json"), validation);
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
      /not bound to reviewedHeadCommit/
    );
  });
});

test("validation run with changed HEAD is rejected", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const validation = await readJson(join(repo, ".artifacts/loop-validation/latest.json"));
    validation.repositoryHeadCommitAtStart = base;
    validation.repositoryHeadCommitAtFinish = head;
    await writeJson(join(repo, ".artifacts/loop-validation/latest.json"), validation);
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
      /not bound to reviewedHeadCommit/
    );
  });
});

test("committed diff whitespace error is detected for PASS", async () => {
  await withRepo(async ({ repo, base }) => {
    await writeText(join(repo, "src/bad.txt"), "bad trailing  \n");
    run("git", ["add", "src/bad.txt"], repo);
    run("git", ["commit", "-m", "bad whitespace"], repo);
    const head = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();
    await writeJson(join(repo, ".artifacts/loop-validation/latest.json"), {
      schemaVersion: 2,
      repositoryHeadCommitAtStart: head,
      repositoryHeadCommitAtFinish: head,
      sourceWorkspaceCleanAtStart: true,
      sourceWorkspaceCleanAtFinish: true,
      status: "pass",
      steps: requiredValidationSteps()
    });
    const input = baseInput({
      base,
      head,
      changedFilePurposes: {
        "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
        "src/bad.txt": "Adds a whitespace failure fixture used to verify committed diff checking."
      }
    });
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R2.json"), input);
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
      /git diff --check/
    );
  });
});

test("nested secret content does not enter HUMAN_REQUIRED packet files", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const sentinel = ["SECRET", "SENTINEL", "M2R2"].join("_");
    await writeText(join(repo, "nested/.env"), sentinel);
    await writeJson(join(repo, ".artifacts/loop-decision.json"), {
      schemaVersion: 1,
      gateType: "SECURITY",
      question: "How should the secret path be handled?",
      options: [
        { id: "A", label: "Remove it", impact: "Keeps handoff safe." },
        { id: "B", label: "Stop", impact: "Waits for manual cleanup." }
      ],
      recommendation: "A",
      evidence: ["nested .env detected"],
      safeDefaultWhileWaiting: "Do not generate PASS."
    });
    const input = baseInput({ base, head, changedFilePurposes: {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
      "docs/loop/LOOP_STATE.md": "Records the terminal human required state used by the fixture.",
      "docs/loop/LOOP_HISTORY.jsonl": "Records the terminal human required history used by the fixture."
    } });
    input.milestoneOutcome = "HUMAN_REQUIRED";
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R2.json"), input);
    await writeText(join(repo, "docs/loop/LOOP_STATE.md"), "- milestoneId: M2-R2\n- Milestone: M2-R2\n- State: terminal_human_required\n- Next Action: external_review\n");
    await writeText(join(repo, "docs/loop/LOOP_HISTORY.jsonl"), `${JSON.stringify({ milestoneId: "M2-R2", iteration: "terminal", result: "HUMAN_REQUIRED", progress: true, nextAction: "external_review" })}\n`);
    const result = await generateHandoffPacket({
      ...defaultOptions(repo, base, head),
      status: "HUMAN_REQUIRED",
      decisionFile: ".artifacts/loop-decision.json"
    });
    for (const fileName of ["REVIEW_PACKET.md", "changes.patch", "MANIFEST.json", "artifact-index.json"]) {
      const text = await readFile(join(result.packetRoot, fileName), "utf8");
      assert.equal(text.includes(sentinel), false, fileName);
    }
  });
});

test("sensitive committed path is rejected before raw patch generation", async () => {
  await withRepo(async ({ repo, base }) => {
    const sentinel = ["SECRET", "SENTINEL", "PEM"].join("_");
    await writeText(join(repo, "credential.pem"), `${sentinel}\n`);
    run("git", ["add", "credential.pem"], repo);
    run("git", ["commit", "-m", "secret"], repo);
    const head = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();
    await writeJson(join(repo, ".artifacts/loop-validation/latest.json"), {
      schemaVersion: 2,
      repositoryHeadCommitAtStart: head,
      repositoryHeadCommitAtFinish: head,
      sourceWorkspaceCleanAtStart: true,
      sourceWorkspaceCleanAtFinish: true,
      status: "pass",
      steps: requiredValidationSteps()
    });
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R2.json"), baseInput({
      base,
      head,
      changedFilePurposes: {
        "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior."
      }
    }));
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
      /refuses sensitive/
    );
  });
});

test("secret-like safe diffs remain byte-exact when not high-confidence secrets", async () => {
  await withRepo(async ({ repo, base }) => {
    const secretLiteral = ["SECRET", "=", "1"].join("");
    await writeText(join(repo, "src/fixture.js"), `const fixture = "${secretLiteral}";\n`);
    run("git", ["add", "src/fixture.js"], repo);
    run("git", ["commit", "-m", "fixture with secret literal"], repo);
    const head = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();
    await writeJson(join(repo, ".artifacts/loop-validation/latest.json"), {
      schemaVersion: 2,
      repositoryHeadCommitAtStart: head,
      repositoryHeadCommitAtFinish: head,
      sourceWorkspaceCleanAtStart: true,
      sourceWorkspaceCleanAtFinish: true,
      status: "pass",
      steps: requiredValidationSteps()
    });
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R2.json"), baseInput({
      base,
      head,
      changedFilePurposes: {
        "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
        "src/fixture.js": "Adds a safe source fixture used to verify byte-exact diff behavior."
      }
    }));
    const result = await generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true });
    for (const fileName of ["REVIEW_PACKET.md", "changes.patch"]) {
      const text = await readFile(join(result.packetRoot, fileName), "utf8");
      assert.equal(text.includes(secretLiteral), true, fileName);
    }
  });
});

test("symlink snapshots record link target without following outside repository", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const outside = join(repo, "..", "outside-secret.txt");
    const sentinel = ["SECRET", "SENTINEL", "OUTSIDE"].join("_");
    await writeText(outside, `${sentinel}\n`);
    await symlink(outside, join(repo, "safe-link"));
    await writeJson(join(repo, ".artifacts/loop-decision.json"), {
      schemaVersion: 1,
      gateType: "SECURITY",
      question: "Review symlink?",
      options: [
        { id: "A", label: "Keep redacted", impact: "No outside file read." },
        { id: "B", label: "Stop", impact: "Waits for cleanup." }
      ],
      recommendation: "A",
      evidence: ["symlink detected"],
      safeDefaultWhileWaiting: "Do not follow symlink."
    });
    const input = baseInput({ base, head, changedFilePurposes: {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
      "safe-link": "Adds a symlink fixture used to verify safe snapshot behavior.",
      "docs/loop/LOOP_STATE.md": "Records the terminal human required state used by the fixture.",
      "docs/loop/LOOP_HISTORY.jsonl": "Records the terminal human required history used by the fixture."
    } });
    input.milestoneOutcome = "HUMAN_REQUIRED";
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R2.json"), input);
    await writeText(join(repo, "docs/loop/LOOP_STATE.md"), "- milestoneId: M2-R2\n- Milestone: M2-R2\n- State: terminal_human_required\n- Next Action: external_review\n");
    await writeText(join(repo, "docs/loop/LOOP_HISTORY.jsonl"), `${JSON.stringify({ milestoneId: "M2-R2", iteration: "terminal", result: "HUMAN_REQUIRED", progress: true, nextAction: "external_review" })}\n`);
    const result = await generateHandoffPacket({ ...defaultOptions(repo, base, head), status: "HUMAN_REQUIRED", decisionFile: ".artifacts/loop-decision.json" });
    const packet = await readFile(join(result.packetRoot, "REVIEW_PACKET.md"), "utf8");
    assert.equal(packet.includes(sentinel), false);
    assert.match(packet, /safe-link/);
  });
});

test("repository path traversal is rejected", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), contract: "../outside.md", candidate: true }),
      /escapes repository root/
    );
  });
});

test("malicious milestoneId cannot create packet outside loop-handoff root", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const outside = join(repo, "..", "outside-sentinel.txt");
    await writeText(outside, "unchanged\n");

    await assert.rejects(
      generateHandoffPacket({
        ...defaultOptions(repo, base, head),
        milestone: "../../outside",
        candidate: true
      }),
      /Invalid milestoneId/
    );
    assert.equal(await readFile(outside, "utf8"), "unchanged\n");
    assert.equal(existsSync(join(repo, ".artifacts/loop-handoff/latest")), false);
    assert.equal(existsSync(join(repo, "..", "outside")), false);
  });
});

test("invalid milestoneId matrix is rejected before packet output", async () => {
  for (const milestone of ["/tmp/outside", "M2/R3", ".hidden"]) {
    await withRepo(async ({ repo, base, head }) => {
      const outside = join(repo, "..", `outside-${milestone.replaceAll("/", "_")}.txt`);
      await writeText(outside, "unchanged\n");

      await assert.rejects(
        generateHandoffPacket({
          ...defaultOptions(repo, base, head),
          milestone,
          candidate: true
        }),
        /Invalid milestoneId/
      );
      assert.equal(await readFile(outside, "utf8"), "unchanged\n");
      assert.equal(existsSync(join(repo, ".artifacts/loop-handoff/latest")), false);
    });
  }
});

test("legal M2-R3 milestoneId can generate a candidate packet", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const milestoneId = "M2-R3";
    await writeText(join(repo, "docs/loop/CURRENT_MILESTONE.md"), contractText({ milestoneId }));
    await writeText(join(repo, "docs/loop/LOOP_STATE.md"), [
      "# Auto SVGA Loop State",
      "",
      "- milestoneId: M2-R3",
      "- Milestone: M2-R3",
      "- State: terminal_pass",
      "- Next Action: external_review",
      ""
    ].join("\n"));
    await writeText(join(repo, "docs/loop/LOOP_HISTORY.jsonl"), `${JSON.stringify({
      milestoneId,
      iteration: "terminal",
      result: "PASS",
      progress: true,
      evidence: ["validation.json"],
      nextAction: "external_review"
    })}\n`);
    head = await commitFixture(repo, "legal m2 r3");
    await writeJson(join(repo, ".artifacts/loop-validation/latest.json"), {
      schemaVersion: 2,
      repositoryHeadCommitAtStart: head,
      repositoryHeadCommitAtFinish: head,
      sourceWorkspaceCleanAtStart: true,
      sourceWorkspaceCleanAtFinish: true,
      status: "pass",
      steps: requiredValidationSteps(),
      knownGaps: {}
    });
    await writeJson(join(repo, ".artifacts/loop-budget-check/latest.json"), budgetSummary({ milestoneId }));
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R3.json"), baseInput({
      base,
      head,
      milestoneId,
      changedFilePurposes: {
        "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
        "docs/loop/CURRENT_MILESTONE.md": "Records the M2-R3 fixture contract.",
        "docs/loop/LOOP_STATE.md": "Records the M2-R3 fixture terminal state.",
        "docs/loop/LOOP_HISTORY.jsonl": "Records the M2-R3 fixture terminal history."
      }
    }));

    const result = await generateHandoffPacket({
      ...defaultOptions(repo, base, head),
      milestone: milestoneId,
      input: ".artifacts/loop-handoff-input/M2-R3.json",
      candidate: true
    });

    assert.equal(result.packetRoot.endsWith(`M2-R3-${head.slice(0, 7)}-candidate`), true);
    assert.equal(result.manifest.milestone.id, milestoneId);
  });
});

test("paths with spaces, renames, and copies are handled", async () => {
  await withRepo(async ({ repo, base }) => {
    await writeText(join(repo, "space name.txt"), "one\n");
    run("git", ["add", "space name.txt"], repo);
    run("git", ["commit", "-m", "space"], repo);
    const copyBase = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();
    run("git", ["mv", "space name.txt", "renamed file.txt"], repo);
    await writeText(join(repo, "copied file.txt"), "one\n");
    run("git", ["add", "copied file.txt"], repo);
    run("git", ["commit", "-m", "rename and copy"], repo);
    const head = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();
    await writeJson(join(repo, ".artifacts/loop-validation/latest.json"), {
      schemaVersion: 2,
      repositoryHeadCommitAtStart: head,
      repositoryHeadCommitAtFinish: head,
      sourceWorkspaceCleanAtStart: true,
      sourceWorkspaceCleanAtFinish: true,
      status: "pass",
      steps: requiredValidationSteps()
    });
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R2.json"), baseInput({
      base: copyBase,
      head,
      changedFilePurposes: {
        "renamed file.txt": "Renames a file with spaces to verify NUL-delimited path handling.",
        "copied file.txt": "Copies a file with spaces to verify copy path handling."
      }
    }));
    const result = await generateSealedPacket({ repo, base: copyBase, head });
    const packet = await readFile(join(result.packetRoot, "REVIEW_PACKET.md"), "utf8");
    assert.match(packet, /renamed file\.txt/);
    assert.match(packet, /copied file\.txt/);
  });
});

test("HUMAN_REQUIRED final response contains the actual question and recommendation", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await writeJson(join(repo, ".artifacts/loop-decision.json"), {
      schemaVersion: 1,
      gateType: "PRODUCT",
      question: "Choose the handoff repair direction?",
      options: [
        { id: "A", label: "Continue repair", impact: "Keeps the loop moving." },
        { id: "B", label: "Pause", impact: "Waits for human review." }
      ],
      recommendation: "A",
      evidence: ["bounded decision"],
      safeDefaultWhileWaiting: "Continue no product changes."
    });
    const input = baseInput({ base, head, changedFilePurposes: {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
      "docs/loop/LOOP_STATE.md": "Records the terminal human required state used by the fixture.",
      "docs/loop/LOOP_HISTORY.jsonl": "Records the terminal human required history used by the fixture."
    } });
    input.milestoneOutcome = "HUMAN_REQUIRED";
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R2.json"), input);
    await writeText(join(repo, "docs/loop/LOOP_STATE.md"), "- milestoneId: M2-R2\n- Milestone: M2-R2\n- State: terminal_human_required\n- Next Action: external_review\n");
    await writeText(join(repo, "docs/loop/LOOP_HISTORY.jsonl"), `${JSON.stringify({ milestoneId: "M2-R2", iteration: "terminal", result: "HUMAN_REQUIRED", progress: true, nextAction: "external_review" })}\n`);
    const result = await generateHandoffPacket({ ...defaultOptions(repo, base, head), status: "HUMAN_REQUIRED", decisionFile: ".artifacts/loop-decision.json" });
    const response = await readFile(join(result.packetRoot, "FINAL_RESPONSE.txt"), "utf8");
    assert.match(response, /Question:\nChoose the handoff repair direction\?/);
    assert.match(response, /Recommendation:\nA: Continue repair/);
  });
});

test("CLI status and input milestoneOutcome mismatch fails", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const input = baseInput({ base, head, changedFilePurposes: { "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior." } });
    input.milestoneOutcome = "HUMAN_REQUIRED";
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R2.json"), input);
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
      /CLI status/
    );
  });
});

test("current packets require NOT_APPLICABLE retrospective fields", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const input = baseInput({ base, head, changedFilePurposes: { "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior." } });
    input.retrospectiveRevalidation = "PASS";
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R2.json"), input);
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
      /NOT_APPLICABLE/
    );
  });
});

test("schema v4 rejects invalid enum values from handoff input", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const input = baseInput({ base, head, changedFilePurposes: { "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior." } });
    input.evidenceCompleteness = "BOGUS";
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R2.json"), input);
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
      /evidenceCompleteness must be one of/
    );
  });
});

test("contract ID in prose does not satisfy exact milestone ID", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await writeText(join(repo, "docs/loop/CURRENT_MILESTONE.md"), `${contractText({ milestoneId: "M2" })}\nM2-R2 appears only in prose.\n`);
    head = await commitFixture(repo, "bad contract id");
    await refreshValidationAndInput(repo, base, head, {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
      "docs/loop/CURRENT_MILESTONE.md": "Records an intentionally wrong milestone id for regression coverage."
    });
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
      /does not match/
    );
  });
});

test("markdown table acceptance criteria bind to handoff input", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await writeText(join(repo, "docs/loop/CURRENT_MILESTONE.md"), tableContractText({ milestoneId: "M2-R2" }));
    head = await commitFixture(repo, "table contract");
    await refreshValidationAndInput(repo, base, head, {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
      "docs/loop/CURRENT_MILESTONE.md": "Records a Markdown table acceptance contract used by the fixture."
    }, {
      acceptanceEvidence: tableAcceptanceEvidence({ milestoneId: "M2-R2" })
    });
    const result = await generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true });
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    const packet = await readFile(join(result.packetRoot, "REVIEW_PACKET.md"), "utf8");
    assert.equal(manifest.milestoneOutcome, "PASS");
    assert.match(packet, /M2-R2 fixture acceptance criterion 1: M2-R2 fixture acceptance criterion 1 evidence/);
  });
});

test("acceptance evidence missing, extra, or hash mismatch fails", async () => {
  await withRepo(async ({ repo, base, head }) => {
    for (const [label, evidence] of [
      ["missing", acceptanceEvidence({ omit: "M2-R2-AC-01" })],
      ["extra", acceptanceEvidence({ extra: "M2-R2-AC-99" })],
      ["badHash", acceptanceEvidence({ badHash: "M2-R2-AC-01" })]
    ]) {
      const input = baseInput({ base, head, changedFilePurposes: { "src/example.txt": `Fixture purpose for ${label} acceptance evidence validation.` } });
      input.acceptanceEvidence = evidence;
      await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R2.json"), input);
      await assert.rejects(
        generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
        /acceptance evidence/
      );
    }
  });
});

test("candidate digest changes when validation evidence changes", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const first = await generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true });
    const validation = await readJson(join(repo, ".artifacts/loop-validation/latest.json"));
    validation.steps.push({ id: "extra", required: true, status: "pass", exitCode: 0 });
    await writeJson(join(repo, ".artifacts/loop-validation/latest.json"), validation);
    const second = await generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true });
    assert.notEqual(first.manifest.candidateDigest, second.manifest.candidateDigest);
  });
});

test("candidate packet does not update latest handoff pointer", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const candidate = await generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true });

    assert.equal(candidate.packetRoot.endsWith(`M2-R2-${head.slice(0, 7)}-candidate`), true);
    assert.equal(existsSync(join(repo, ".artifacts/loop-handoff/latest")), false);
    assert.equal(candidate.manifest.packetStatus, "INCOMPLETE");
    assert.equal(candidate.manifest.evidenceCompleteness, "PARTIAL");
    assert.equal(candidate.manifest.historicalReviewerEvidence, "PENDING_CANDIDATE_REVIEW");
    assert.equal(candidate.manifest.seal.phase, "candidate");
    assert.equal(candidate.manifest.sealVerification.status, "not_run");
  });
});

test("sealed packet post verifier records upload contract and latest pointer", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateSealedPacket({ repo, base, head });
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    const postSealVerification = await readJson(join(result.packetRoot, "post-seal-verification.json"));
    const latestTarget = await readlink(join(repo, ".artifacts/loop-handoff/latest"));

    assert.equal(manifest.sealVerification.status, "pass");
    assert.equal(latestTarget.endsWith(`M2-R2-${head.slice(0, 7)}`), true);
    assert.deepEqual(manifest.mandatoryCompanions, []);
    assert.equal(manifest.sealVerification.trackedSourceClean, true);
    assert.equal(manifest.sealVerification.checkedArtifactCount > 0, true);
    assert.deepEqual(postSealVerification.uploadFiles, [
      `.artifacts/loop-handoff/M2-R2-${head.slice(0, 7)}/REVIEW_PACKET.md`
    ]);
    assert.equal(JSON.stringify(postSealVerification).includes(repo), false);
  });
});

test("sealed packet post verifier fails when latest pointer targets another packet", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateSealedPacket({ repo, base, head });
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    const latestRoot = join(repo, ".artifacts/loop-handoff/latest");
    const wrongTarget = join(repo, ".artifacts/loop-handoff/wrong-packet");
    await mkdir(wrongTarget, { recursive: true });
    await rm(latestRoot, { recursive: true, force: true });
    await symlink(wrongTarget, latestRoot);

    const seal = await verifySealedPacket({
      repoRoot: repo,
      packetRoot: result.packetRoot,
      latestRoot,
      manifest,
      finalResponseText: await readFile(join(result.packetRoot, "FINAL_RESPONSE.txt"), "utf8")
    });

    assert.equal(seal.status, "fail");
    assert.equal(seal.errors.includes("latest does not point at packetRoot"), true);
  });
});

test("sealed packet post verifier fails when an artifact hash changes", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateSealedPacket({ repo, base, head });
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    await writeText(join(result.packetRoot, "REVIEW_PACKET.md"), "tampered\n");

    const seal = await verifySealedPacket({
      repoRoot: repo,
      packetRoot: result.packetRoot,
      latestRoot: join(repo, ".artifacts/loop-handoff/latest"),
      manifest,
      finalResponseText: await readFile(join(result.packetRoot, "FINAL_RESPONSE.txt"), "utf8")
    });

    assert.equal(seal.status, "fail");
    assert.equal(seal.errors.includes("artifact sha256 mismatch: REVIEW_PACKET.md"), true);
  });
});

test("sealed packet post verifier fails when tracked source changes after validation", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateSealedPacket({ repo, base, head });
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    await writeText(join(repo, "README.md"), "# dirty source\n");

    const seal = await verifySealedPacket({
      repoRoot: repo,
      packetRoot: result.packetRoot,
      latestRoot: join(repo, ".artifacts/loop-handoff/latest"),
      manifest,
      finalResponseText: await readFile(join(result.packetRoot, "FINAL_RESPONSE.txt"), "utf8")
    });

    assert.equal(seal.status, "fail");
    assert.equal(seal.errors.includes("tracked source workspace is not clean"), true);
  });
});

test("loop validation contains handoff tests and reviewer config check", () => {
  const ids = createLoopValidationSteps().map((step) => step.id);
  assert.equal(ids.includes("handoff-tests"), true);
  assert.equal(ids.includes("reviewer-config-check"), true);
});

test("failure path uses only temporary repository files", async () => {
  await assert.rejects(
    withRepo(async ({ repo, base, head }) => {
      await writeText(join(repo, "docs/loop/LOOP_STATE.md"), "- milestoneId: M2-R2\n- Milestone: M2-R2\n- State: wrong\n- Next Action: external_review\n");
      head = await commitFixture(repo, "bad terminal state");
      await refreshValidationAndInput(repo, base, head, {
        "src/example.txt": "Adds a fixture implementation file used to verify schema v4 handoff behavior.",
        "docs/loop/LOOP_STATE.md": "Records an intentionally wrong terminal state for failure-path isolation coverage."
      });
      await generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true });
    }),
    /LOOP_STATE/
  );
});
