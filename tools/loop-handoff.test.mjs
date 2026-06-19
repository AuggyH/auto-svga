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
    maxBuffer: 20 * 1024 * 1024
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

async function createRepo() {
  const repo = await mkdtemp(join(tmpdir(), "auto-svga-handoff-"));
  run("git", ["init"], repo);
  run("git", ["config", "user.name", "Codex"], repo);
  run("git", ["config", "user.email", "codex-agent@local"], repo);
  await writeText(join(repo, "README.md"), "# fixture\n");
  await writeText(join(repo, "docs/loop/CURRENT_MILESTONE.md"), "# M2 fixture contract\n\n## Acceptance\n");
  await writeText(join(repo, "docs/loop/LOOP_HISTORY.md"), "# History\n");
  await writeText(join(repo, "docs/decision.md"), "Question: bounded test decision\nRecommendation: choose one bounded next action\n");
  await writeText(join(repo, ".gitignore"), "node_modules/\n.artifacts/loop-handoff/\n.artifacts/loop-validation/\n*.log\n");
  run("git", ["add", "."], repo);
  run("git", ["commit", "-m", "base"], repo);
  const base = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();
  await writeText(join(repo, "src/example.txt"), "hello\n");
  await writeText(join(repo, "docs/reviewer.md"), "PASS\n\nReviewer original text.\n");
  await writeText(join(repo, ".artifacts/loop-validation/latest.json"), JSON.stringify({
    schemaVersion: 1,
    status: "pass",
    steps: [{ id: "build", status: "pass", exitCode: 0, durationMs: 1 }],
    knownGaps: { lint: "not_available" }
  }, null, 2));
  run("git", ["add", "src/example.txt", "docs/reviewer.md"], repo);
  run("git", ["commit", "-m", "feature"], repo);
  const head = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();
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

test("PASS packet generation creates required files and stable contracts", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateHandoffPacket({
      repoRoot: repo,
      status: "PASS",
      milestone: "M2",
      title: "Standardized Review Handoff Contract",
      base,
      head,
      reviewerReport: "docs/reviewer.md"
    });

    for (const name of [
      "REVIEW_PACKET.md",
      "MANIFEST.json",
      "changes.patch",
      "validation.json",
      "reviewer-report.md",
      "artifact-index.json",
      "FINAL_RESPONSE.txt"
    ]) {
      assert.equal(existsSync(join(result.packetRoot, name)), true, name);
    }

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
      "Independent Reviewer Report",
      "Loop History",
      "Remaining Risks And Gaps",
      "Artifact Index",
      "Human Decision",
      "Recommended Next Milestone"
    ]) {
      assert.match(reviewPacket, new RegExp(`# ${section}`));
    }

    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.status, "PASS");
    assert.equal(manifest.validation.status, "pass");
    assert.equal(manifest.reviewer.status, "pass");
    assert.equal(manifest.workspace.clean, true);
  });
});

test("HUMAN_REQUIRED packet includes tracked and untracked work", async () => {
  await withRepo(async ({ repo, base }) => {
    await writeText(join(repo, "src/example.txt"), "changed but uncommitted\n");
    await writeText(join(repo, "src/new-file.txt"), "new work\n");
    const result = await generateHandoffPacket({
      repoRoot: repo,
      status: "HUMAN_REQUIRED",
      milestone: "M2",
      base,
      reviewerReport: "docs/reviewer.md",
      decisionFile: "docs/decision.md"
    });
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    const paths = manifest.files.map((file) => file.repositoryPath);
    assert.equal(manifest.status, "HUMAN_REQUIRED");
    assert.equal(manifest.humanDecision.packetPath, "decisions/human-decision.md");
    assert.match(await readFile(join(result.packetRoot, "decisions/human-decision.md"), "utf8"), /Recommendation:/);
    assert.ok(paths.includes("src/example.txt"));
    assert.ok(paths.includes("src/new-file.txt"));
  });
});

test("HUMAN_REQUIRED fails when the bounded decision file is missing or incomplete", async () => {
  await withRepo(async ({ repo, base }) => {
    await assert.rejects(
      generateHandoffPacket({
        repoRoot: repo,
        status: "HUMAN_REQUIRED",
        milestone: "M2",
        base,
        reviewerReport: "docs/reviewer.md",
        decisionFile: "docs/missing-decision.md"
      }),
      /decision file is missing/
    );

    await writeText(join(repo, "docs/incomplete-decision.md"), "Question: incomplete\n");
    await assert.rejects(
      generateHandoffPacket({
        repoRoot: repo,
        status: "HUMAN_REQUIRED",
        milestone: "M2",
        base,
        reviewerReport: "docs/reviewer.md",
        decisionFile: "docs/incomplete-decision.md"
      }),
      /Question: and Recommendation:/
    );
  });
});

test("PASS state fails when tracked workspace is dirty", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await writeText(join(repo, "src/example.txt"), "dirty\n");
    await assert.rejects(
      generateHandoffPacket({
        repoRoot: repo,
        status: "PASS",
        milestone: "M2",
        base,
        head,
        reviewerReport: "docs/reviewer.md"
      }),
      /requires a clean source workspace/
    );
  });
});

test("base to head diff range is accurate and snapshots include full text", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateHandoffPacket({
      repoRoot: repo,
      status: "PASS",
      milestone: "M2",
      base,
      head,
      reviewerReport: "docs/reviewer.md"
    });
    const patch = await readFile(join(result.packetRoot, "changes.patch"), "utf8");
    const snapshot = await readFile(join(result.packetRoot, "files/src/example.txt"), "utf8");
    assert.equal(patch.includes("src/example.txt"), true);
    assert.equal(snapshot, "hello\n");
  });
});

test("file and artifact ordering is stable and sha256 values match", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateHandoffPacket({
      repoRoot: repo,
      status: "PASS",
      milestone: "M2",
      base,
      head,
      reviewerReport: "docs/reviewer.md"
    });
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    const filePaths = manifest.files.map((file) => file.repositoryPath);
    assert.deepEqual(filePaths, [...filePaths].sort());

    const snapshot = manifest.files.find((file) => file.repositoryPath === "src/example.txt");
    assert.ok(snapshot);
    assert.equal(
      snapshot.sha256,
      await sha256File(join(result.packetRoot, snapshot.packetPath))
    );

    const artifactIndex = await readJson(join(result.packetRoot, "artifact-index.json"));
    const artifactPaths = artifactIndex.artifacts.map((artifact) => artifact.path);
    assert.deepEqual(artifactPaths, [...artifactPaths].sort());
    assert.equal(artifactPaths.includes("MANIFEST.json"), false);
    assert.equal(artifactPaths.includes("artifact-index.json"), false);
    for (const artifact of artifactIndex.artifacts) {
      assert.equal(
        artifact.sha256,
        await sha256File(join(result.packetRoot, artifact.path)),
        artifact.path
      );
    }
  });
});

test("ignored runtime, node_modules, git, env, and sensitive files are not packed", async () => {
  await withRepo(async ({ repo, base }) => {
    await writeText(join(repo, "node_modules/pkg/index.js"), "bad\n");
    await writeText(join(repo, ".env"), "SECRET=1\n");
    await writeText(join(repo, "tools/electron-prototype/.runtime/file.txt"), "runtime\n");
    await writeText(join(repo, "src/allowed.txt"), "ok\n");
    const result = await generateHandoffPacket({
      repoRoot: repo,
      status: "HUMAN_REQUIRED",
      milestone: "M2",
      base,
      reviewerReport: "docs/reviewer.md",
      decisionFile: "docs/decision.md"
    });
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    const packed = JSON.stringify(manifest);
    assert.equal(packed.includes("src/allowed.txt"), true);
    assert.doesNotMatch(packed, /node_modules/);
    assert.doesNotMatch(packed, /SECRET/);
    assert.doesNotMatch(packed, /\\.runtime/);
  });
});

test("binary file is indexed without text snapshot", async () => {
  await withRepo(async ({ repo, base }) => {
    await mkdir(join(repo, "src"), { recursive: true });
    await writeFile(join(repo, "src/binary.bin"), Buffer.from([0, 1, 2, 3]));
    const result = await generateHandoffPacket({
      repoRoot: repo,
      status: "HUMAN_REQUIRED",
      milestone: "M2",
      base,
      reviewerReport: "docs/reviewer.md",
      decisionFile: "docs/decision.md"
    });
    const manifest = await readJson(join(result.packetRoot, "MANIFEST.json"));
    const binary = manifest.files.find((file) => file.repositoryPath === "src/binary.bin");
    assert.equal(binary.binary, true);
    assert.equal(binary.packetPath, null);
  });
});

test("committed PASS binary files keep exact byte size and sha256", async () => {
  await withRepo(async ({ repo, base }) => {
    const bytes = Buffer.from([0, 255, 128, 64, 10]);
    await mkdir(join(repo, "src"), { recursive: true });
    await writeFile(join(repo, "src/committed.bin"), bytes);
    run("git", ["add", "src/committed.bin"], repo);
    run("git", ["commit", "-m", "binary"], repo);
    const head = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();

    const result = await generateHandoffPacket({
      repoRoot: repo,
      status: "PASS",
      milestone: "M2",
      base,
      head,
      reviewerReport: "docs/reviewer.md"
    });
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
    const result = await generateHandoffPacket({
      repoRoot: repo,
      status: "PASS",
      milestone: "M2",
      base,
      head,
      reviewerReport: "docs/reviewer.md"
    });
    assert.match(await readFile(join(result.packetRoot, "reviewer-report.md"), "utf8"), /Reviewer original text/);
    assert.deepEqual(
      await readJson(join(result.packetRoot, "validation.json")),
      await readJson(join(repo, ".artifacts/loop-validation/latest.json"))
    );
  });
});

test("retrospective packets distinguish authoritative unavailable evidence from loop history", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateHandoffPacket({
      repoRoot: repo,
      status: "PASS",
      milestone: "M1",
      base,
      head,
      validation: "missing-validation.json",
      reviewerReport: "missing-reviewer.md",
      retrospective: true
    });
    const reviewPacket = await readFile(join(result.packetRoot, "REVIEW_PACKET.md"), "utf8");
    const validation = await readJson(join(result.packetRoot, "validation.json"));
    assert.equal(validation.status, "not_available");
    assert.match(reviewPacket, /Retrospective evidence authority/);
    assert.match(reviewPacket, /Loop History` is narrative context only/);
  });
});

test("FINAL_RESPONSE format is stable", async () => {
  await withRepo(async ({ repo, base, head }) => {
    const result = await generateHandoffPacket({
      repoRoot: repo,
      status: "PASS",
      milestone: "M2",
      base,
      head,
      reviewerReport: "docs/reviewer.md"
    });
    const finalResponse = await readFile(join(result.packetRoot, "FINAL_RESPONSE.txt"), "utf8");
    assert.equal(finalResponse.startsWith("PASS\n\nREVIEW_PACKET_READY"), true);
    assert.match(finalResponse, /REVIEW_PACKET:/);
    assert.match(finalResponse, /CHANGES_PATCH:/);
  });
});

test("missing mandatory content fails packet generation", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await assert.rejects(
      generateHandoffPacket({
        repoRoot: repo,
        status: "PASS",
        milestone: "M2",
        base,
        head,
        contract: "docs/loop/missing.md",
        reviewerReport: "docs/reviewer.md"
      }),
      /not_available|missing/
    );
  });
});

test("failure path uses only temporary repository files", async () => {
  await withRepo(async ({ repo, base, head }) => {
    await writeText(join(repo, "src/example.txt"), "dirty\n");
    await assert.rejects(generateHandoffPacket({
      repoRoot: repo,
      status: "PASS",
      milestone: "M2",
      base,
      head,
      reviewerReport: "docs/reviewer.md"
    }));
    const repoStatus = run("git", ["status", "--short"], repo).stdout;
    assert.equal(repoStatus.includes("src/example.txt"), true);
  });
});
