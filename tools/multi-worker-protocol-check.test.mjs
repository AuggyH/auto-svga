import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  runMultiWorkerProtocolCheck,
  validateMultiWorkerProtocol
} from "./multi-worker-protocol-check.mjs";

function baseRegistry(overrides = {}) {
  return {
    schemaVersion: 2,
    milestoneId: "P6",
    integrationCoordinator: "A0",
    integrationBranch: "agent/codex/p6-integration",
    integrationBaseCommit: "abc",
    currentIntegrationHeadCommit: "abc",
    currentRepairRound: 3,
    threadListRefreshedAt: "2026-06-22T00:00:00Z",
    registryRefreshedAt: "2026-06-22T00:00:00Z",
    registryValidation: {
      status: "pass",
      checkedAt: "2026-06-22T00:00:00Z",
      errors: []
    },
    acceptanceCriteria: [
      {
        criterionId: "P6-AC-01",
        implementationOwner: "A1",
        evidenceOwner: "A4",
        integrationVerifier: ["A0"]
      }
    ],
    workers: [
      {
        workerId: "A1",
        waveId: "P6-R3",
        role: "Web Baseline",
        visibleThreadId: "thread-a1",
        workerType: "visible_project_worktree",
        lifecycleStatus: "completed",
        branch: "agent/codex/p6-a1",
        ownedPaths: ["docs/product/P6_WEB_PRODUCT_BASELINE.md"],
        dependencies: [],
        lastVerifiedAt: "2026-06-22T00:00:00Z"
      },
      {
        workerId: "A2",
        waveId: "P6-R3",
        role: "Shared Frontend",
        visibleThreadId: "thread-a2",
        workerType: "visible_project_worktree",
        lifecycleStatus: "running",
        branch: "agent/codex/p6-a2",
        ownedPaths: ["tools/shared/product-frontend/"],
        dependencies: ["A1"],
        lastVerifiedAt: "2026-06-22T00:00:00Z"
      }
    ],
    ...overrides
  };
}

async function withTempDir(callback) {
  const directory = await mkdtemp(join(tmpdir(), "auto-svga-worker-protocol-"));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

test("valid registry passes protocol validation", () => {
  const result = validateMultiWorkerProtocol({
    registry: baseRegistry(),
    registryText: JSON.stringify(baseRegistry()),
    coordinationText: "Current integration head: abc\n"
  });

  assert.equal(result.status, "pass");
  assert.deepEqual(result.errors, []);
});

test("rejects duplicate active worker branches", () => {
  const registry = baseRegistry({
    workers: [
      baseRegistry().workers[0],
      { ...baseRegistry().workers[1], branch: "agent/codex/p6-a1" }
    ]
  });

  const result = validateMultiWorkerProtocol({
    registry,
    registryText: JSON.stringify(registry),
    coordinationText: "Current integration head: abc\n"
  });

  assert.equal(result.status, "fail");
  assert.equal(result.errors.some((error) => error.includes("active branch must be unique")), true);
});

test("rejects owned path overlap across workers", () => {
  const registry = baseRegistry({
    workers: [
      baseRegistry().workers[0],
      {
        ...baseRegistry().workers[1],
        ownedPaths: ["docs/product/"]
      }
    ]
  });

  const result = validateMultiWorkerProtocol({
    registry,
    registryText: JSON.stringify(registry),
    coordinationText: "Current integration head: abc\n"
  });

  assert.equal(result.status, "fail");
  assert.equal(result.errors.some((error) => error.includes("ownedPaths parent-child overlap")), true);
});

test("rejects implementation owner as sole verifier", () => {
  const registry = baseRegistry({
    acceptanceCriteria: [
      {
        criterionId: "P6-AC-01",
        implementationOwner: "A1",
        evidenceOwner: "A4",
        integrationVerifier: ["A1"]
      }
    ]
  });

  const result = validateMultiWorkerProtocol({
    registry,
    registryText: JSON.stringify(registry),
    coordinationText: "Current integration head: abc\n"
  });

  assert.equal(result.status, "fail");
  assert.equal(result.errors.some((error) => error.includes("sole integrationVerifier")), true);
});

test("rejects local absolute paths in tracked registry text", () => {
  const registry = baseRegistry();
  const result = validateMultiWorkerProtocol({
    registry,
    registryText: `${JSON.stringify(registry)}\nworktree=/Users/example/project\n`,
    coordinationText: "Current integration head: abc\n"
  });

  assert.equal(result.status, "fail");
  assert.equal(result.errors.includes("registry must not contain local absolute paths."), true);
});

test("CLI runner reads registry and coordination files", async () => {
  await withTempDir(async (directory) => {
    await mkdir(join(directory, "docs/product/p6"), { recursive: true });
    await writeJson(join(directory, "docs/product/p6/P6_WORKER_REGISTRY.json"), baseRegistry());
    await writeFile(
      join(directory, "docs/product/p6/P6_MULTI_AGENT_COORDINATION.md"),
      "Current integration head: abc\n",
      "utf8"
    );

    const result = await runMultiWorkerProtocolCheck({ cwd: directory });

    assert.equal(result.status, "pass");
  });
});
