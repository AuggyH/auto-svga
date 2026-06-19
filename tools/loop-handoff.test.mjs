import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { generateHandoffPacket } from "./loop-handoff.mjs";
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

function hashText(text) {
  return createHash("sha256").update(text).digest("hex");
}

function criteria() {
  return Array.from({ length: 15 }, (_, index) => {
    const id = `M2-R2-AC-${String(index + 1).padStart(2, "0")}`;
    return {
      id,
      requirement: `M2-R2 fixture acceptance criterion ${index + 1}`
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
    ...criteria().map((criterion) => `- \`${criterion.id}\`: ${criterion.requirement}`),
    ""
  ].join("\n");
}

function acceptanceEvidence({ omit, extra, badHash } = {}) {
  const items = criteria()
    .filter((criterion) => criterion.id !== omit)
    .map((criterion) => ({
      criterionId: criterion.id,
      milestoneId: "M2-R2",
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
      milestoneId: "M2-R2",
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

function baseInput({ base, head, changedFilePurposes, humanDecision = null } = {}) {
  return {
    milestoneId: "M2-R2",
    milestoneTitle: "Terminal Handoff Trust Hardening",
    reviewedBaseCommit: base,
    reviewedHeadCommit: head,
    milestoneOutcome: "PASS",
    evidenceCompleteness: "COMPLETE",
    historicalValidationEvidence: "PASS",
    historicalReviewerEvidence: "PASS",
    retrospectiveRevalidation: "NOT_APPLICABLE",
    retrospectiveReviewerStatus: "NOT_APPLICABLE",
    implementationSummary: "M2-R2 hardens terminal handoff trust with schema v3, structured reviewer verdicts, validation head binding, candidate seal, safe patch filtering, and concrete human gates.",
    changedFilePurposes,
    acceptanceEvidence: acceptanceEvidence(),
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
    "- Milestone: M2-R2 Terminal Handoff Trust Hardening",
    "- State: terminal_pass",
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
    steps: [{ id: "handoff-tests", command: "node --test tools/loop-handoff.test.mjs", required: true, status: "pass", exitCode: 0, durationMs: 1, reason: null }],
    knownGaps: {}
  });
  await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R2.json"), baseInput({
    base,
    head,
    changedFilePurposes: {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v3 handoff behavior."
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

async function writeReviewerVerdicts(repo, head, candidateDigest, overrides = {}) {
  await writeJson(join(repo, ".artifacts/loop-review/reviewer-a.json"), {
    schemaVersion: 1,
    reviewerId: "A",
    verdict: "PASS",
    reviewedHeadCommit: head,
    candidateDigest,
    generatedAt: "2026-06-20T00:02:00.000Z",
    conditions: [],
    findings: [],
    ...overrides.A
  });
  await writeJson(join(repo, ".artifacts/loop-review/reviewer-b.json"), {
    schemaVersion: 1,
    reviewerId: "B",
    verdict: "PASS",
    reviewedHeadCommit: head,
    candidateDigest,
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
    steps: [{ id: "handoff-tests", command: "node --test tools/loop-handoff.test.mjs", required: true, status: "pass", exitCode: 0, durationMs: 1, reason: null }],
    knownGaps: {}
  });
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
  await writeReviewerVerdicts(repo, head, candidate.manifest.candidateDigest, reviewerOverrides);
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

test("reviewer.toml config validates and remains read-only", async () => {
  const result = await validateReviewerConfig(".codex/agents/reviewer.toml");

  assert.equal(result.status, "pass");
  assert.equal(result.permissions.mode, "read-only");
  assert.equal(result.permissions.allow_writes, false);
  assert.equal(result.mustCheck.includes("scope drift"), true);
  assert.equal(result.mustCheck.includes("review handoff completeness"), true);
});

test("PASS packet generation creates schema v3 sealed packet", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateSealedPacket({ repo, base, head });
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    const packet = await readFile(join(result.packetRoot, "REVIEW_PACKET.md"), "utf8");

    assert.equal(manifest.schemaVersion, 3);
    assert.equal(manifest.packetStatus, "COMPLETE");
    assert.equal(manifest.milestoneOutcome, "PASS");
    assert.equal(manifest.seal.phase, "sealed");
    assert.equal(manifest.reviewers.reviewerA.status, "PASS");
    assert.equal(manifest.reviewers.reviewerA.candidateDigest, manifest.candidateDigest);
    assert.match(packet, /schemaVersion: 3/);
    assert.match(packet, /candidateDigest:/);
    assert.match(packet, /```diff/);
  });
});

test("terminal state mismatch fails PASS generation", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await writeText(join(repo, "docs/loop/LOOP_STATE.md"), "- Milestone: M2-R2\n- State: implementation_in_progress\n");
    head = await commitFixture(repo, "bad state");
    await refreshValidationAndInput(repo, base, head, {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v3 handoff behavior.",
      "docs/loop/LOOP_STATE.md": "Records an intentionally invalid terminal state for regression coverage."
    });
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
      /LOOP_STATE/
    );
  });
});

test("terminal history final result must match PASS", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await writeText(join(repo, "docs/loop/LOOP_HISTORY.jsonl"), `${JSON.stringify({ milestoneId: "M2-R2", result: "IN_PROGRESS", nextAction: "repair" })}\n`);
    head = await commitFixture(repo, "bad history");
    await refreshValidationAndInput(repo, base, head, {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v3 handoff behavior.",
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
    await writeReviewerVerdicts(repo, head, candidate.manifest.candidateDigest, { A: { reviewedHeadCommit: base } });
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), reviewerA: ".artifacts/loop-review/reviewer-a.json", reviewerB: ".artifacts/loop-review/reviewer-b.json" }),
      /reviewedHeadCommit mismatch/
    );
  });
});

test("reviewer JSON candidate digest mismatch is rejected", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const candidate = await generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true });
    await writeReviewerVerdicts(repo, head, candidate.manifest.candidateDigest, { B: { candidateDigest: "bad" } });
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), reviewerA: ".artifacts/loop-review/reviewer-a.json", reviewerB: ".artifacts/loop-review/reviewer-b.json" }),
      /candidateDigest mismatch/
    );
  });
});

test("reviewer JSON PASS with conditions is rejected", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const candidate = await generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true });
    await writeReviewerVerdicts(repo, head, candidate.manifest.candidateDigest, { A: { conditions: ["needs follow-up"] } });
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
      steps: [{ id: "handoff-tests", required: true, status: "pass", exitCode: 0 }]
    });
    const input = baseInput({
      base,
      head,
      changedFilePurposes: {
        "src/example.txt": "Adds a fixture implementation file used to verify schema v3 handoff behavior.",
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
    const sentinel = "SECRET_SENTINEL_M2R2";
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
      "src/example.txt": "Adds a fixture implementation file used to verify schema v3 handoff behavior.",
      "docs/loop/LOOP_STATE.md": "Records the terminal human required state used by the fixture.",
      "docs/loop/LOOP_HISTORY.jsonl": "Records the terminal human required history used by the fixture."
    } });
    input.milestoneOutcome = "HUMAN_REQUIRED";
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R2.json"), input);
    await writeText(join(repo, "docs/loop/LOOP_STATE.md"), "- Milestone: M2-R2\n- State: terminal_human_required\n");
    await writeText(join(repo, "docs/loop/LOOP_HISTORY.jsonl"), `${JSON.stringify({ milestoneId: "M2-R2", result: "HUMAN_REQUIRED", nextAction: "external_review" })}\n`);
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
    await writeText(join(repo, "credential.pem"), "SECRET_SENTINEL_PEM\n");
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
      steps: [{ id: "handoff-tests", required: true, status: "pass", exitCode: 0 }]
    });
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R2.json"), baseInput({
      base,
      head,
      changedFilePurposes: {
        "src/example.txt": "Adds a fixture implementation file used to verify schema v3 handoff behavior."
      }
    }));
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
      /refuses sensitive/
    );
  });
});

test("symlink snapshots record link target without following outside repository", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const outside = join(repo, "..", "outside-secret.txt");
    await writeText(outside, "SECRET_SENTINEL_OUTSIDE\n");
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
      "src/example.txt": "Adds a fixture implementation file used to verify schema v3 handoff behavior.",
      "safe-link": "Adds a symlink fixture used to verify safe snapshot behavior.",
      "docs/loop/LOOP_STATE.md": "Records the terminal human required state used by the fixture.",
      "docs/loop/LOOP_HISTORY.jsonl": "Records the terminal human required history used by the fixture."
    } });
    input.milestoneOutcome = "HUMAN_REQUIRED";
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R2.json"), input);
    await writeText(join(repo, "docs/loop/LOOP_STATE.md"), "- Milestone: M2-R2\n- State: terminal_human_required\n");
    await writeText(join(repo, "docs/loop/LOOP_HISTORY.jsonl"), `${JSON.stringify({ milestoneId: "M2-R2", result: "HUMAN_REQUIRED", nextAction: "external_review" })}\n`);
    const result = await generateHandoffPacket({ ...defaultOptions(repo, base, head), status: "HUMAN_REQUIRED", decisionFile: ".artifacts/loop-decision.json" });
    const packet = await readFile(join(result.packetRoot, "REVIEW_PACKET.md"), "utf8");
    assert.equal(packet.includes("SECRET_SENTINEL_OUTSIDE"), false);
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

test("paths with spaces and renames are handled", async () => {
  await withRepo(async ({ repo, base }) => {
    await writeText(join(repo, "space name.txt"), "one\n");
    run("git", ["add", "space name.txt"], repo);
    run("git", ["commit", "-m", "space"], repo);
    run("git", ["mv", "space name.txt", "renamed file.txt"], repo);
    run("git", ["commit", "-m", "rename"], repo);
    const head = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();
    await writeJson(join(repo, ".artifacts/loop-validation/latest.json"), {
      schemaVersion: 2,
      repositoryHeadCommitAtStart: head,
      repositoryHeadCommitAtFinish: head,
      sourceWorkspaceCleanAtStart: true,
      sourceWorkspaceCleanAtFinish: true,
      status: "pass",
      steps: [{ id: "handoff-tests", required: true, status: "pass", exitCode: 0 }]
    });
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R2.json"), baseInput({
      base,
      head,
      changedFilePurposes: {
        "src/example.txt": "Adds a fixture implementation file used to verify schema v3 handoff behavior.",
        "renamed file.txt": "Renames a file with spaces to verify NUL-delimited path handling."
      }
    }));
    const result = await generateSealedPacket({ repo, base, head });
    const packet = await readFile(join(result.packetRoot, "REVIEW_PACKET.md"), "utf8");
    assert.match(packet, /renamed file\.txt/);
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
      "src/example.txt": "Adds a fixture implementation file used to verify schema v3 handoff behavior.",
      "docs/loop/LOOP_STATE.md": "Records the terminal human required state used by the fixture.",
      "docs/loop/LOOP_HISTORY.jsonl": "Records the terminal human required history used by the fixture."
    } });
    input.milestoneOutcome = "HUMAN_REQUIRED";
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R2.json"), input);
    await writeText(join(repo, "docs/loop/LOOP_STATE.md"), "- Milestone: M2-R2\n- State: terminal_human_required\n");
    await writeText(join(repo, "docs/loop/LOOP_HISTORY.jsonl"), `${JSON.stringify({ milestoneId: "M2-R2", result: "HUMAN_REQUIRED", nextAction: "external_review" })}\n`);
    const result = await generateHandoffPacket({ ...defaultOptions(repo, base, head), status: "HUMAN_REQUIRED", decisionFile: ".artifacts/loop-decision.json" });
    const response = await readFile(join(result.packetRoot, "FINAL_RESPONSE.txt"), "utf8");
    assert.match(response, /Question:\nChoose the handoff repair direction\?/);
    assert.match(response, /Recommendation:\nA: Continue repair/);
  });
});

test("CLI status and input milestoneOutcome mismatch fails", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const input = baseInput({ base, head, changedFilePurposes: { "src/example.txt": "Adds a fixture implementation file used to verify schema v3 handoff behavior." } });
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
    const input = baseInput({ base, head, changedFilePurposes: { "src/example.txt": "Adds a fixture implementation file used to verify schema v3 handoff behavior." } });
    input.retrospectiveRevalidation = "PASS";
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R2.json"), input);
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
      /NOT_APPLICABLE/
    );
  });
});

test("contract ID in prose does not satisfy exact milestone ID", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await writeText(join(repo, "docs/loop/CURRENT_MILESTONE.md"), `${contractText({ milestoneId: "M2" })}\nM2-R2 appears only in prose.\n`);
    head = await commitFixture(repo, "bad contract id");
    await refreshValidationAndInput(repo, base, head, {
      "src/example.txt": "Adds a fixture implementation file used to verify schema v3 handoff behavior.",
      "docs/loop/CURRENT_MILESTONE.md": "Records an intentionally wrong milestone id for regression coverage."
    });
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true }),
      /does not match/
    );
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
    assert.equal(candidate.manifest.seal.phase, "candidate");
    assert.equal(candidate.manifest.sealVerification.status, "not_run");
  });
});

test("sealed packet post verifier records upload contract and latest pointer", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateSealedPacket({ repo, base, head });
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    const latestTarget = await readlink(join(repo, ".artifacts/loop-handoff/latest"));

    assert.equal(manifest.sealVerification.status, "pass");
    assert.equal(latestTarget.endsWith(`M2-R2-${head.slice(0, 7)}`), true);
    assert.deepEqual(manifest.mandatoryCompanions, []);
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
      await writeText(join(repo, "docs/loop/LOOP_STATE.md"), "- Milestone: M2-R2\n- State: wrong\n");
      head = await commitFixture(repo, "bad terminal state");
      await refreshValidationAndInput(repo, base, head, {
        "src/example.txt": "Adds a fixture implementation file used to verify schema v3 handoff behavior.",
        "docs/loop/LOOP_STATE.md": "Records an intentionally wrong terminal state for failure-path isolation coverage."
      });
      await generateHandoffPacket({ ...defaultOptions(repo, base, head), candidate: true });
    }),
    /LOOP_STATE/
  );
});
