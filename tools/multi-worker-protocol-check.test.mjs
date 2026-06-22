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
    currentRepairRound: 4,
    threadListRefreshedAt: "2026-06-22T00:00:00Z",
    registryRefreshedAt: "2026-06-22T00:00:00Z",
    terminalHandoffReady: false,
    expectedFinalHeadCommit: null,
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
        waveId: "P6-R4",
        role: "Web Baseline",
        visibleThreadId: "thread-a1",
        workerType: "visible_project_worktree",
        lifecycleStatus: "running",
        branch: "agent/codex/p6-r4-a1",
        baseCommit: "abc",
        headCommit: null,
        integrationCommit: null,
        ownedPaths: ["docs/product/P6_WEB_PRODUCT_BASELINE.md"],
        dependencies: [],
        lastVerifiedAt: "2026-06-22T00:00:00Z"
      },
      {
        workerId: "A2",
        waveId: "P6-R4",
        role: "Shared Frontend",
        visibleThreadId: "thread-a2",
        workerType: "visible_project_worktree",
        lifecycleStatus: "running",
        branch: "agent/codex/p6-r4-a2",
        baseCommit: "abc",
        headCommit: null,
        integrationCommit: null,
        ownedPaths: ["tools/shared/product-frontend/"],
        dependencies: ["A1"],
        lastVerifiedAt: "2026-06-22T00:00:00Z"
      },
      {
        workerId: "A3",
        waveId: "P6-R4",
        role: "Electron Host",
        visibleThreadId: "thread-a3",
        workerType: "visible_project_worktree",
        lifecycleStatus: "planned",
        branch: "agent/codex/p6-r4-a3",
        baseCommit: "abc",
        headCommit: null,
        integrationCommit: null,
        ownedPaths: ["tools/electron-prototype/experiments/svga-web/host/"],
        dependencies: ["A2"],
        lastVerifiedAt: "2026-06-22T00:00:00Z"
      },
      {
        workerId: "A4",
        waveId: "P6-R4",
        role: "Parity Runtime",
        visibleThreadId: "thread-a4",
        workerType: "visible_project_worktree",
        lifecycleStatus: "planned",
        branch: "agent/codex/p6-r4-a4",
        baseCommit: "abc",
        headCommit: null,
        integrationCommit: null,
        ownedPaths: ["tools/p6/runtime-scenarios/"],
        dependencies: ["A1", "A2", "A3"],
        lastVerifiedAt: "2026-06-22T00:00:00Z"
      },
      {
        workerId: "A5",
        waveId: "P6-R4",
        role: "Packaging",
        visibleThreadId: "thread-a5",
        workerType: "visible_project_worktree",
        lifecycleStatus: "planned",
        branch: "agent/codex/p6-r4-a5",
        baseCommit: "abc",
        headCommit: null,
        integrationCommit: null,
        ownedPaths: ["tools/electron-prototype/experiments/svga-web/packaging/macos/"],
        dependencies: ["A2", "A3", "A4"],
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

test("valid Repair 5 registry can reuse historical Repair 4 worker ids", () => {
  const historicalWorkers = baseRegistry().workers.map((worker) => ({
    ...worker,
    lifecycleStatus: "integrated",
    integrationCommit: "integrated",
    workerHandoffFolder: `docs/product/p6/worker-handoffs/${worker.workerId}-R4.md`
  }));
  const repair5Workers = baseRegistry().workers.map((worker) => ({
    workerId: worker.workerId,
    waveId: "P6-R5",
    role: worker.role,
    visibleThreadId: worker.visibleThreadId,
    threadType: "visible_project_worktree",
    status: "planned",
    branch: worker.branch.replace("p6-r4", "p6-r5"),
    baseCommit: "repair5-base",
    headCommit: null,
    ownedPaths: worker.ownedPaths,
    dependencies: worker.dependencies,
    lastVerifiedAt: "2026-06-22T02:00:00Z"
  }));
  const registry = baseRegistry({
    currentRepairRound: 5,
    registryRefreshedAt: "2026-06-22T02:00:00Z",
    currentIntegrationHeadCommit: "repair5-base",
    workers: historicalWorkers,
    repair5Workers
  });

  const result = validateMultiWorkerProtocol({
    registry,
    registryText: JSON.stringify(registry),
    coordinationText: "Current integration head: repair5-base\n"
  });

  assert.equal(result.status, "pass");
  assert.deepEqual(result.errors, []);
});

test("terminal Repair 5 registry rejects active workers", () => {
  const repair5Workers = baseRegistry().workers.map((worker) => ({
    workerId: worker.workerId,
    waveId: "P6-R5",
    role: worker.role,
    visibleThreadId: worker.visibleThreadId,
    threadType: "visible_project_worktree",
    status: "planned",
    branch: worker.branch.replace("p6-r4", "p6-r5"),
    baseCommit: "repair5-base",
    headCommit: null,
    ownedPaths: worker.ownedPaths,
    dependencies: worker.dependencies,
    lastVerifiedAt: "2026-06-22T02:00:00Z"
  }));
  const registry = baseRegistry({
    currentRepairRound: 5,
    registryRefreshedAt: "2026-06-22T02:00:00Z",
    currentIntegrationHeadCommit: "repair5-base",
    expectedFinalHeadCommit: "repair5-base",
    terminalHandoffReady: true,
    repair5Workers
  });

  const result = validateMultiWorkerProtocol({
    registry,
    registryText: JSON.stringify(registry),
    coordinationText: "Current integration head: repair5-base\n"
  });

  assert.equal(result.status, "fail");
  assert.equal(result.errors.some((error) => error.includes("Repair 5 terminal worker must be integrated or retired")), true);
});

test("rejects duplicate active worker branches", () => {
  const registry = baseRegistry({
    workers: [
      baseRegistry().workers[0],
      { ...baseRegistry().workers[1], branch: baseRegistry().workers[0].branch }
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
  const localUsersPath = `/${"Users"}/example/project`;
  const result = validateMultiWorkerProtocol({
    registry,
    registryText: `${JSON.stringify(registry)}\nworktree=${localUsersPath}\n`,
    coordinationText: "Current integration head: abc\n"
  });

  assert.equal(result.status, "fail");
  assert.equal(result.errors.includes("registry must not contain local absolute paths."), true);
});

test("rejects completed Repair 4 workers without integration commit", () => {
  const registry = baseRegistry({
    workers: [
      { ...baseRegistry().workers[0], lifecycleStatus: "completed", headCommit: "def" },
      ...baseRegistry().workers.slice(1)
    ]
  });

  const result = validateMultiWorkerProtocol({
    registry,
    registryText: JSON.stringify(registry),
    coordinationText: "Current integration head: abc\n"
  });

  assert.equal(result.status, "fail");
  assert.equal(result.errors.some((error) => error.includes("completed but missing integrationCommit")), true);
});

test("rejects stale worker verification timestamps", () => {
  const registry = baseRegistry({
    registryRefreshedAt: "2026-06-22T01:00:00Z"
  });

  const result = validateMultiWorkerProtocol({
    registry,
    registryText: JSON.stringify(registry),
    coordinationText: "Current integration head: abc\n"
  });

  assert.equal(result.status, "fail");
  assert.equal(result.errors.some((error) => error.includes("lastVerifiedAt is stale")), true);
});

test("terminal registry requires final head and integrated or retired workers", () => {
  const registry = baseRegistry({
    terminalHandoffReady: true,
    expectedFinalHeadCommit: "final",
    currentIntegrationHeadCommit: "abc"
  });

  const result = validateMultiWorkerProtocol({
    registry,
    registryText: JSON.stringify(registry),
    coordinationText: "Current integration head: abc\n"
  });

  assert.equal(result.status, "fail");
  assert.equal(result.errors.includes("terminal registry currentIntegrationHeadCommit must equal expectedFinalHeadCommit."), true);
  assert.equal(result.errors.some((error) => error.includes("Repair 4 terminal worker must be integrated or retired")), true);
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
