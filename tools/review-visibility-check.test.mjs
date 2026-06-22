import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { validateReviewVisibility } from "./review-visibility-check.mjs";

async function withTempDir(callback) {
  const directory = await mkdtemp(join(tmpdir(), "auto-svga-review-visibility-"));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function createWorkerFolder(root) {
  const folder = join(root, "review/workers/P6/A1-abcdef0");
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, "README.md"), "# A1\n", "utf8");
  await writeFile(join(folder, "WORKER_HANDOFF.md"), "Worker handoff only.\n", "utf8");
  await writeJson(join(folder, "worker-result.json"), {
    baseCommit: "base",
    headCommit: "head",
    branch: "agent/codex/p6-a1",
    workspaceClean: true,
    changedFiles: [],
    tests: []
  });
  return folder;
}

async function createTerminalFolder(root, { companionRequired = false, mismatch = false } = {}) {
  const canonical = join(root, "canonical");
  const visible = join(root, "review/P6-abcdef0");
  await mkdir(canonical, { recursive: true });
  await mkdir(visible, { recursive: true });

  const sealedFiles = {
    "REVIEW_PACKET.md": "# Review\n",
    "validation.json": "{}\n",
    "budget-check.json": "{}\n",
    "reviewer-a.json": "{}\n",
    "reviewer-b.json": "{}\n",
    "post-seal-verification.json": "{}\n"
  };
  if (companionRequired) sealedFiles["changes.patch"] = "diff --git a/a b/a\n";

  for (const [fileName, content] of Object.entries(sealedFiles)) {
    await writeFile(join(canonical, fileName), content, "utf8");
    await writeFile(join(visible, fileName), mismatch && fileName === "REVIEW_PACKET.md" ? "# Changed\n" : content, "utf8");
  }
  await writeFile(join(visible, "README.md"), "# Visible\n", "utf8");
  await writeFile(
    join(visible, "FINAL_RESPONSE.txt"),
    [
      "HUMAN_REQUIRED",
      "",
      "[Review Packet](REVIEW_PACKET.md)",
      "[Owner ZIP](P6-review.zip)",
      ...(companionRequired ? ["[Companion Patch](changes.patch)"] : []),
      ""
    ].join("\n"),
    "utf8"
  );
  await writeFile(join(visible, "P6-review.zip"), "zip placeholder\n", "utf8");
  await writeJson(join(visible, "MANIFEST.json"), {
    companionRequired,
    visibleHandoff: {
      canonicalPacketRoot: "../../canonical"
    }
  });
  return visible;
}

test("worker handoff folder passes with worker-only files", async () => {
  await withTempDir(async (root) => {
    const folder = await createWorkerFolder(root);
    const result = await validateReviewVisibility({ mode: "worker", folder });

    assert.equal(result.status, "pass");
  });
});

test("worker handoff rejects terminal packet files", async () => {
  await withTempDir(async (root) => {
    const folder = await createWorkerFolder(root);
    await writeFile(join(folder, "REVIEW_PACKET.md"), "# should not be here\n", "utf8");
    const result = await validateReviewVisibility({ mode: "worker", folder });

    assert.equal(result.status, "fail");
    assert.equal(result.errors.some((error) => error.includes("must not contain REVIEW_PACKET.md")), true);
  });
});

test("terminal owner handoff passes without optional changes.patch", async () => {
  await withTempDir(async (root) => {
    const folder = await createTerminalFolder(root);
    const result = await validateReviewVisibility({ mode: "terminal", folder });

    assert.equal(result.status, "pass");
  });
});

test("terminal owner handoff requires companion patch when declared", async () => {
  await withTempDir(async (root) => {
    const folder = await createTerminalFolder(root, { companionRequired: true });
    const result = await validateReviewVisibility({ mode: "terminal", folder });

    assert.equal(result.status, "pass");
  });
});

test("terminal owner handoff detects sealed file byte mismatch", async () => {
  await withTempDir(async (root) => {
    const folder = await createTerminalFolder(root, { mismatch: true });
    const result = await validateReviewVisibility({ mode: "terminal", folder });

    assert.equal(result.status, "fail");
    assert.equal(result.errors.some((error) => error.includes("byte-identical")), true);
  });
});

test("visible handoff rejects local absolute paths", async () => {
  await withTempDir(async (root) => {
    const folder = await createWorkerFolder(root);
    await writeFile(join(folder, "README.md"), "Path: /Users/example/asset.svga\n", "utf8");
    const result = await validateReviewVisibility({ mode: "worker", folder });

    assert.equal(result.status, "fail");
    assert.equal(result.errors.some((error) => error.includes("local absolute path")), true);
  });
});
