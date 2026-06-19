import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { generateHandoffPacket } from "./loop-handoff.mjs";

function run(cmd, args, cwd, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 30 * 1024 * 1024
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

function baseInput({ milestoneId, milestoneTitle, base, head, changedFilePurposes }) {
  return {
    milestoneId,
    milestoneTitle,
    reviewedBaseCommit: base,
    reviewedHeadCommit: head,
    milestoneOutcome: "PASS",
    evidenceCompleteness: milestoneId === "M1" ? "PARTIAL" : "COMPLETE",
    historicalValidationEvidence: milestoneId === "M1" ? "NOT_AVAILABLE" : "PASS",
    historicalReviewerEvidence: milestoneId === "M1" ? "NOT_AVAILABLE" : "PASS",
    retrospectiveRevalidation: milestoneId === "M1" ? "NOT_AVAILABLE" : "PASS",
    retrospectiveReviewerStatus: milestoneId === "M1" ? "NOT_AVAILABLE" : "PASS",
    implementationSummary: milestoneId === "M1"
      ? "M1 added unified source-safe validation command, sequential validation runner, failure propagation, stable machine-readable summary, targeted validator tests, and autonomous loop bootstrap docs."
      : "M2-R1 repaired review packet integrity by embedding small diffs, separating packet status from milestone outcome, requiring milestone-specific acceptance evidence, filtering loop history by milestone, and requiring reviewer A/B handoff reports.",
    retrospectivePackagingNote: milestoneId === "M1"
      ? "This packet is retrospective packaging. It does not invent historical reviewer or validation evidence."
      : undefined,
    changedFilePurposes,
    acceptanceEvidence: milestoneId === "M1"
      ? Array.from({ length: 8 }, (_, index) => ({
        criterionId: `M1-AC-${String(index + 1).padStart(2, "0")}`,
        milestoneId: "M1",
        requirement: `M1 frozen acceptance criterion ${index + 1}`,
        historicalEvidenceStatus: "NOT_AVAILABLE",
        retrospectiveEvidenceStatus: "DERIVED_FROM_FROZEN_CONTRACT",
        evidenceSource: "docs/loop/CURRENT_MILESTONE.md M1 frozen contract",
        limitation: "Original M1 evidence was not packaged at the time.",
        derivedFromFrozenContract: true
      }))
      : Array.from({ length: 10 }, (_, index) => ({
        criterionId: `M2-R1-AC-${String(index + 1).padStart(2, "0")}`,
        milestoneId: "M2-R1",
        requirement: `M2-R1 explicit acceptance criterion ${index + 1}`,
        historicalEvidenceStatus: "PASS",
        retrospectiveEvidenceStatus: "PASS",
        evidenceSource: "validation.json, reviewer-a.md, reviewer-b.md, REVIEW_PACKET.md",
        limitation: "none"
      })),
    validationRuns: [
      { command: "node --test tools/loop-handoff.test.mjs", result: "PASS", exitCode: 0 },
      { command: "npm run loop:validate", result: "PASS", exitCode: 0 }
    ],
    reviewerReports: [
      { reviewer: "A", status: milestoneId === "M1" ? "NOT_AVAILABLE" : "PASS" },
      { reviewer: "B", status: milestoneId === "M1" ? "NOT_AVAILABLE" : "PASS" }
    ],
    remainingRisks: ["No product runtime changes are included."],
    visualArtifacts: [],
    humanDecision: null,
    recommendedNextMilestone: "Do not start a new milestone until the packet is externally reviewed."
  };
}

async function createRepo() {
  const repo = await mkdtemp(join(tmpdir(), "auto-svga-handoff-"));
  run("git", ["init"], repo);
  run("git", ["config", "user.name", "Codex"], repo);
  run("git", ["config", "user.email", "codex-agent@local"], repo);
  await writeText(join(repo, "README.md"), "# fixture\n");
  await writeText(join(repo, "docs/loop/CURRENT_MILESTONE.md"), "# M2-R1 fixture contract\n\nMilestone: M2-R1\n");
  await writeText(join(repo, "docs/loop/M1_CONTRACT.md"), "# M1 fixture contract\n\nMilestone: M1\n");
  await writeText(join(repo, "docs/loop/WRONG_CONTRACT.md"), "# Wrong fixture contract\n\nMilestone: M2\n");
  await writeText(join(repo, "docs/decision.md"), "Question: bounded test decision\nRecommendation: choose one bounded next action\n");
  await writeText(join(repo, "docs/loop/LOOP_HISTORY.jsonl"), [
    JSON.stringify({ milestoneId: "M1", iteration: "M1", phase: "implementation", timestamp: "2026-06-19T00:00:00.000Z", hypothesis: "bootstrap validation", filesChanged: ["tools/loop-validate.mjs"], commands: ["npm run loop:validate"], result: "PASS", evidence: ["latest.json"], nextAction: "M2" }),
    JSON.stringify({ milestoneId: "M2", iteration: "M2", phase: "implementation", timestamp: "2026-06-19T01:00:00.000Z", hypothesis: "old milestone should be filtered", filesChanged: ["tools/loop-handoff.mjs"], commands: ["npm run loop:handoff"], result: "PASS", evidence: ["M2 packet"], nextAction: "M2-R1" }),
    JSON.stringify({ milestoneId: "M2-R1", iteration: "M2-R1", phase: "repair", timestamp: "2026-06-19T02:00:00.000Z", hypothesis: "repair packet integrity", filesChanged: ["tools/loop-handoff.mjs"], commands: ["node --test tools/loop-handoff.test.mjs"], result: "PASS", evidence: ["v2 packet"], nextAction: "external review" })
  ].join("\n") + "\n");
  await writeText(join(repo, ".gitignore"), "node_modules/\n.artifacts/\n*.log\n");
  run("git", ["add", "."], repo);
  run("git", ["commit", "-m", "base"], repo);
  const base = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();

  await writeText(join(repo, "src/example.txt"), "hello\n");
  run("git", ["add", "src/example.txt"], repo);
  run("git", ["commit", "-m", "feature"], repo);
  const head = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();

  await writeJson(join(repo, ".artifacts/loop-validation/latest.json"), {
    schemaVersion: 1,
    status: "pass",
    steps: [{ id: "build", status: "pass", exitCode: 0, durationMs: 1 }],
    knownGaps: { lint: "not_available" }
  });
  await writeText(join(repo, ".artifacts/loop-review/reviewer-a.md"), "PASS\n\nReviewer A original text.\n");
  await writeText(join(repo, ".artifacts/loop-review/reviewer-b.md"), "PASS\n\nReviewer B original text.\n");
  await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R1.json"), baseInput({
    milestoneId: "M2-R1",
    milestoneTitle: "Review Handoff Integrity Repair",
    base,
    head,
    changedFilePurposes: {
      "src/example.txt": "Adds the fixture implementation file used to verify packet diff, snapshot, and file purpose behavior."
    }
  }));
  await writeJson(join(repo, ".artifacts/loop-handoff-input/M1.json"), baseInput({
    milestoneId: "M1",
    milestoneTitle: "Autonomous Loop Bootstrap",
    base,
    head,
    changedFilePurposes: {
      "src/example.txt": "Represents the historical M1 implementation output in a retrospective packet fixture."
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

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function sha256File(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

function defaultOptions(repo, base, head) {
  return {
    repoRoot: repo,
    status: "PASS",
    milestone: "M2-R1",
    title: "Review Handoff Integrity Repair",
    base,
    head,
    input: ".artifacts/loop-handoff-input/M2-R1.json",
    reviewerA: ".artifacts/loop-review/reviewer-a.md",
    reviewerB: ".artifacts/loop-review/reviewer-b.md"
  };
}

test("PASS packet generation creates schema v2 required files", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateHandoffPacket(defaultOptions(repo, base, head));
    for (const name of [
      "REVIEW_PACKET.md",
      "MANIFEST.json",
      "changes.patch",
      "validation.json",
      "reviewer-a.md",
      "reviewer-b.md",
      "artifact-index.json",
      "FINAL_RESPONSE.txt"
    ]) {
      assert.equal(existsSync(join(result.packetRoot, name)), true, name);
    }
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    assert.equal(manifest.schemaVersion, 2);
    assert.equal(manifest.packetStatus, "COMPLETE");
    assert.equal(manifest.milestoneOutcome, "PASS");
    assert.equal(manifest.evidenceCompleteness, "COMPLETE");
    assert.equal(manifest.workspaceCleanAtGeneration, true);
  });
});

test("Review Packet contains all required sections and v2 status fields", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateHandoffPacket(defaultOptions(repo, base, head));
    const reviewPacket = await readFile(join(result.packetRoot, "REVIEW_PACKET.md"), "utf8");
    for (const section of [
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
    ]) {
      assert.match(reviewPacket, new RegExp(`# ${section}`));
    }
    assert.match(reviewPacket, /schemaVersion: 2/);
    assert.match(reviewPacket, /packetStatus: COMPLETE/);
    assert.match(reviewPacket, /milestoneOutcome: PASS/);
    assert.match(reviewPacket, /reviewedBaseCommit:/);
    assert.match(reviewPacket, /reviewedHeadCommit:/);
    assert.match(reviewPacket, /generatorCommit:/);
    assert.match(reviewPacket, /repositoryHeadAtGeneration:/);
  });
});

test("small diffs are embedded in REVIEW_PACKET and not mandatory companions", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateHandoffPacket(defaultOptions(repo, base, head));
    const reviewPacket = await readFile(join(result.packetRoot, "REVIEW_PACKET.md"), "utf8");
    const finalResponse = await readFile(join(result.packetRoot, "FINAL_RESPONSE.txt"), "utf8");
    assert.match(reviewPacket, /```diff\n/);
    assert.match(reviewPacket, /src\/example.txt/);
    assert.match(reviewPacket, /companionRequired: false/);
    assert.doesNotMatch(finalResponse, /changes\.patch/);
  });
});

test("large diffs require changes.patch companion", async () => {
  await withRepo(async ({ repo, base }) => {
    await writeText(join(repo, "src/large.txt"), `${"line\n".repeat(5100)}`);
    run("git", ["add", "src/large.txt"], repo);
    run("git", ["commit", "-m", "large diff"], repo);
    const head = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R1.json"), baseInput({
      milestoneId: "M2-R1",
      milestoneTitle: "Review Handoff Integrity Repair",
      base,
      head,
      changedFilePurposes: {
        "src/example.txt": "Adds the fixture implementation file used to verify packet diff behavior.",
        "src/large.txt": "Adds a large deterministic text fixture to force companion patch handling."
      }
    }));
    const result = await generateHandoffPacket(defaultOptions(repo, base, head));
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    const finalResponse = await readFile(join(result.packetRoot, "FINAL_RESPONSE.txt"), "utf8");
    assert.equal(manifest.companionRequired, true);
    assert.deepEqual(manifest.mandatoryCompanions, ["changes.patch"]);
    assert.match(finalResponse, /changes\.patch/);
  });
});

test("acceptance evidence must be milestone-specific", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const input = baseInput({
      milestoneId: "M2-R1",
      milestoneTitle: "Review Handoff Integrity Repair",
      base,
      head,
      changedFilePurposes: {
        "src/example.txt": "Adds the fixture implementation file used to verify packet evidence behavior."
      }
    });
    input.acceptanceEvidence[0].criterionId = "A1";
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R1.json"), input);
    await assert.rejects(
      generateHandoffPacket(defaultOptions(repo, base, head)),
      /must be milestone-specific/
    );
  });
});

test("M1 retrospective packet derives explicit M1 acceptance IDs and marks evidence partial", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateHandoffPacket({
      repoRoot: repo,
      status: "PASS",
      milestone: "M1",
      title: "Autonomous Loop Bootstrap",
      base,
      head,
      contract: "docs/loop/M1_CONTRACT.md",
      validation: "missing-validation.json",
      input: ".artifacts/loop-handoff-input/M1.json",
      retrospective: true
    });
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    const reviewPacket = await readFile(join(result.packetRoot, "REVIEW_PACKET.md"), "utf8");
    assert.equal(manifest.evidenceCompleteness, "PARTIAL");
    assert.equal(manifest.historicalValidationEvidence, "NOT_AVAILABLE");
    assert.match(reviewPacket, /M1-AC-01/);
    assert.match(reviewPacket, /M1-AC-08/);
    assert.match(reviewPacket, /derivedFromFrozenContract: true/);
    assert.doesNotMatch(reviewPacket, /M2-R1-AC/);
  });
});

test("M1 retrospective acceptance evidence cannot cite M2 handoff facts", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const input = baseInput({
      milestoneId: "M1",
      milestoneTitle: "Autonomous Loop Bootstrap",
      base,
      head,
      changedFilePurposes: {
        "src/example.txt": "Represents the historical M1 implementation output in a retrospective packet fixture."
      }
    });
    input.acceptanceEvidence[0].evidenceSource = "M2 loop:handoff Review Packet";
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M1.json"), input);
    await assert.rejects(
      generateHandoffPacket({
        repoRoot: repo,
        status: "PASS",
        milestone: "M1",
        title: "Autonomous Loop Bootstrap",
        base,
        head,
        contract: "docs/loop/M1_CONTRACT.md",
        input: ".artifacts/loop-handoff-input/M1.json",
        retrospective: true
      }),
      /M1 retrospective acceptance evidence/
    );
  });
});

test("implementation result comes from handoff input", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateHandoffPacket(defaultOptions(repo, base, head));
    const reviewPacket = await readFile(join(result.packetRoot, "REVIEW_PACKET.md"), "utf8");
    assert.match(reviewPacket, /M2-R1 repaired review packet integrity/);
    assert.doesNotMatch(reviewPacket, /generated a standardized review handoff packet for status/);
  });
});

test("loop history is filtered by milestone", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateHandoffPacket({
      repoRoot: repo,
      status: "PASS",
      milestone: "M1",
      title: "Autonomous Loop Bootstrap",
      base,
      head,
      contract: "docs/loop/M1_CONTRACT.md",
      input: ".artifacts/loop-handoff-input/M1.json",
      retrospective: true
    });
    const reviewPacket = await readFile(join(result.packetRoot, "REVIEW_PACKET.md"), "utf8");
    assert.match(reviewPacket, /milestoneId: M1/);
    assert.doesNotMatch(reviewPacket, /milestoneId: M2-R1/);
    assert.doesNotMatch(reviewPacket, /old milestone should be filtered/);
  });
});

test("placeholder file purposes fail generation", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const input = baseInput({
      milestoneId: "M2-R1",
      milestoneTitle: "Review Handoff Integrity Repair",
      base,
      head,
      changedFilePurposes: { "src/example.txt": "A change for milestone" }
    });
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R1.json"), input);
    await assert.rejects(
      generateHandoffPacket(defaultOptions(repo, base, head)),
      /purpose missing or placeholder/
    );
  });
});

test("current PASS requires reviewer A and reviewer B reports", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await rm(join(repo, ".artifacts/loop-review/reviewer-b.md"), { force: true });
    await assert.rejects(
      generateHandoffPacket(defaultOptions(repo, base, head)),
      /reviewer A and reviewer B PASS/
    );
  });
});

test("current PASS requires passing validation summary", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await writeJson(join(repo, ".artifacts/loop-validation/latest.json"), { status: "fail", steps: [] });
    await assert.rejects(
      generateHandoffPacket(defaultOptions(repo, base, head)),
      /passing validation summary/
    );
  });
});

test("base and head mismatch in handoff input fails", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const input = baseInput({
      milestoneId: "M2-R1",
      milestoneTitle: "Review Handoff Integrity Repair",
      base: head,
      head,
      changedFilePurposes: {
        "src/example.txt": "Adds the fixture implementation file used to verify packet range checking."
      }
    });
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R1.json"), input);
    await assert.rejects(
      generateHandoffPacket(defaultOptions(repo, base, head)),
      /reviewedBaseCommit/
    );
  });
});

test("FINAL_RESPONSE upload list excludes manifest, validation, reviewers, and files", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateHandoffPacket(defaultOptions(repo, base, head));
    const finalResponse = await readFile(join(result.packetRoot, "FINAL_RESPONSE.txt"), "utf8");
    assert.equal(finalResponse.startsWith("PASS\n\nREVIEW_PACKET_READY"), true);
    assert.match(finalResponse, /UPLOAD_TO_REVIEW_ASSISTANT:\n1\./);
    assert.match(finalResponse, /Do not upload:\n- MANIFEST\.json\n- validation\.json\n- reviewer reports\n- files directory/);
    assert.doesNotMatch(finalResponse, /^- MANIFEST:/m);
  });
});

test("artifact index and manifest use stable sorted paths and correct sha256", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateHandoffPacket(defaultOptions(repo, base, head));
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    const filePaths = manifest.files.map((file) => file.repositoryPath);
    assert.deepEqual(filePaths, [...filePaths].sort());
    const snapshot = manifest.files.find((file) => file.repositoryPath === "src/example.txt");
    assert.ok(snapshot);
    assert.equal(snapshot.sha256, await sha256File(join(result.packetRoot, snapshot.packetPath)));
    const artifactIndex = await readJson(join(result.packetRoot, "artifact-index.json"));
    const artifactPaths = artifactIndex.artifacts.map((artifact) => artifact.path);
    assert.deepEqual(artifactPaths, [...artifactPaths].sort());
    assert.equal(artifactPaths.includes("MANIFEST.json"), false);
    assert.equal(artifactPaths.includes("artifact-index.json"), false);
  });
});

test("ignored runtime, node_modules, git, env, and sensitive files are not packed", async () => {
  await withRepo(async ({ repo, base }) => {
    await writeText(join(repo, "node_modules/pkg/index.js"), "bad\n");
    await writeText(join(repo, ".env"), "SECRET=1\n");
    await writeText(join(repo, "tools/electron-prototype/.runtime/file.txt"), "runtime\n");
    await writeText(join(repo, "src/allowed.txt"), "ok\n");
    const input = baseInput({
      milestoneId: "M2-R1",
      milestoneTitle: "Review Handoff Integrity Repair",
      base,
      head: run("git", ["rev-parse", "HEAD"], repo).stdout.trim(),
      changedFilePurposes: {
        "src/example.txt": "Adds the committed fixture implementation file included in the base-to-head diff.",
        "src/allowed.txt": "Adds an allowed uncommitted fixture to verify sensitive path exclusion."
      }
    });
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R1.json"), input);
    const result = await generateHandoffPacket({
      ...defaultOptions(repo, base, input.reviewedHeadCommit),
      status: "HUMAN_REQUIRED",
      decisionFile: "docs/decision.md"
    });
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    const packed = JSON.stringify(manifest);
    assert.match(packed, /src\/allowed\.txt/);
    assert.doesNotMatch(packed, /node_modules/);
    assert.doesNotMatch(packed, /SECRET/);
    assert.doesNotMatch(packed, /\.runtime/);
  });
});

test("binary files are indexed without text snapshots", async () => {
  await withRepo(async ({ repo, base }) => {
    const bytes = Buffer.from([0, 255, 128, 64, 10]);
    await writeFile(join(repo, "src/committed.bin"), bytes);
    run("git", ["add", "src/committed.bin"], repo);
    run("git", ["commit", "-m", "binary"], repo);
    const head = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R1.json"), baseInput({
      milestoneId: "M2-R1",
      milestoneTitle: "Review Handoff Integrity Repair",
      base,
      head,
      changedFilePurposes: {
        "src/example.txt": "Adds the fixture implementation file used to verify packet snapshot behavior.",
        "src/committed.bin": "Adds a binary fixture to verify binary indexing without text snapshot."
      }
    }));
    const result = await generateHandoffPacket(defaultOptions(repo, base, head));
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    const binary = manifest.files.find((file) => file.repositoryPath === "src/committed.bin");
    assert.equal(binary.binary, true);
    assert.equal(binary.packetPath, null);
    assert.equal(binary.sizeBytes, bytes.length);
    assert.equal(binary.sha256, createHash("sha256").update(bytes).digest("hex"));
  });
});

test("reviewer text and validation summary are preserved", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateHandoffPacket(defaultOptions(repo, base, head));
    assert.match(await readFile(join(result.packetRoot, "reviewer-a.md"), "utf8"), /Reviewer A original text/);
    assert.match(await readFile(join(result.packetRoot, "reviewer-b.md"), "utf8"), /Reviewer B original text/);
    assert.deepEqual(
      await readJson(join(result.packetRoot, "validation.json")),
      await readJson(join(repo, ".artifacts/loop-validation/latest.json"))
    );
  });
});

test("HUMAN_REQUIRED requires bounded decision file", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await writeText(join(repo, "src/example.txt"), "dirty\n");
    await assert.rejects(
      generateHandoffPacket({
        ...defaultOptions(repo, base, head),
        status: "HUMAN_REQUIRED",
        decisionFile: "docs/missing-decision.md"
      }),
      /decision file is missing/
    );
    await writeText(join(repo, "docs/incomplete-decision.md"), "Question: incomplete\n");
    await assert.rejects(
      generateHandoffPacket({
        ...defaultOptions(repo, base, head),
        status: "HUMAN_REQUIRED",
        decisionFile: "docs/incomplete-decision.md"
      }),
      /Question: and Recommendation:/
    );
  });
});

test("PASS fails when tracked workspace is dirty", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await writeText(join(repo, "src/example.txt"), "dirty\n");
    await assert.rejects(
      generateHandoffPacket(defaultOptions(repo, base, head)),
      /requires a clean source workspace/
    );
  });
});

test("PASS ignores excluded runtime artifact roots", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await writeText(join(repo, ".artifacts/loop-review/runtime-note.md"), "ignored runtime note\n");
    const result = await generateHandoffPacket(defaultOptions(repo, base, head));
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    assert.equal(manifest.workspaceCleanAtGeneration, true);
  });
});

test("HUMAN_REQUIRED packet includes tracked and untracked work", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await writeText(join(repo, "src/example.txt"), "changed but uncommitted\n");
    await writeText(join(repo, "src/new-file.txt"), "new work\n");
    const input = baseInput({
      milestoneId: "M2-R1",
      milestoneTitle: "Review Handoff Integrity Repair",
      base,
      head,
      changedFilePurposes: {
        "src/example.txt": "Captures the tracked uncommitted fixture change for HUMAN_REQUIRED packet coverage.",
        "src/new-file.txt": "Captures the untracked fixture file for HUMAN_REQUIRED packet coverage."
      }
    });
    await writeJson(join(repo, ".artifacts/loop-handoff-input/M2-R1.json"), input);
    const result = await generateHandoffPacket({
      ...defaultOptions(repo, base, head),
      status: "HUMAN_REQUIRED",
      decisionFile: "docs/decision.md"
    });
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    const paths = manifest.files.map((file) => file.repositoryPath);
    assert.equal(manifest.packetStatus, "COMPLETE");
    assert.equal(manifest.humanDecision.packetPath, "decisions/human-decision.md");
    assert.ok(paths.includes("src/example.txt"));
    assert.ok(paths.includes("src/new-file.txt"));
  });
});

test("contract mismatch fails generation", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await assert.rejects(
      generateHandoffPacket({ ...defaultOptions(repo, base, head), contract: "docs/loop/WRONG_CONTRACT.md" }),
      /does not mention M2-R1/
    );
  });
});

test("failure path uses only temporary repository files", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await writeText(join(repo, "src/example.txt"), "dirty\n");
    await assert.rejects(generateHandoffPacket(defaultOptions(repo, base, head)));
    const repoStatus = run("git", ["status", "--short"], repo).stdout;
    assert.match(repoStatus, /src\/example\.txt/);
  });
});
