#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const legalLifecycleStatuses = new Set([
  "planned",
  "running",
  "blocked",
  "completed",
  "integrated",
  "retired"
]);

const supportedRegistrySchemaVersions = new Set([2, 3]);

const globalLifecyclePaths = new Set([
  "docs/loop/CURRENT_MILESTONE.md",
  "docs/loop/LOOP_STATE.md",
  "docs/loop/LOOP_HISTORY.jsonl",
  "AGENTS.md",
  "package.json"
]);

const localPathPattern = /(?:^|[^A-Za-z0-9_.-])(?:\/Users\/|\/private\/|\/var\/folders\/|\/tmp\/|[A-Za-z]:\\|\\\\)/;

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function normalizeRepoPath(value) {
  return String(value ?? "").replace(/\\/g, "/").replace(/\/+$/, "");
}

function hasParentChildPathOverlap(left, right) {
  const a = normalizeRepoPath(left);
  const b = normalizeRepoPath(right);
  return a !== b && (a.startsWith(`${b}/`) || b.startsWith(`${a}/`));
}

function isActiveWorker(worker) {
  return worker.lifecycleStatus !== "integrated" && worker.lifecycleStatus !== "retired";
}

function isCompletedButNotIntegrated(worker) {
  return worker.lifecycleStatus === "completed" && !worker.integrationCommit;
}

function normalizeLifecycleWorker(worker) {
  return {
    ...worker,
    workerType: worker.workerType ?? worker.threadType,
    lifecycleStatus: worker.lifecycleStatus ?? worker.status
  };
}

function currentWorkerWaveId(registry) {
  const round = registry?.currentRepairRound;
  return Number.isInteger(round) && round > 0 ? `P6-R${round}` : null;
}

function repairWaveWorkers(registry) {
  return Object.entries(registry ?? {})
    .filter(([key, value]) => /^repair\d+Workers$/.test(key) && Array.isArray(value))
    .flatMap(([, value]) => value.map(normalizeLifecycleWorker));
}

function currentWaveWorkers(registry, workers) {
  const waveId = currentWorkerWaveId(registry);
  if (!waveId) return [];
  return [...workers, ...repairWaveWorkers(registry)].filter((worker) => worker.waveId === waveId);
}

function addUniqueError(errors, message) {
  if (!errors.includes(message)) errors.push(message);
}

function validateUnique(items, label, errors) {
  const seen = new Map();
  for (const item of items) {
    if (!item.value) continue;
    if (seen.has(item.value)) {
      errors.push(`${label} must be unique: ${item.value}`);
      continue;
    }
    seen.set(item.value, item.workerId);
  }
}

function validateDependencies(workers, errors) {
  const ids = new Set(workers.map((worker) => worker.workerId));
  const graph = new Map();
  for (const worker of workers) {
    const dependencies = asArray(worker.dependencies);
    graph.set(worker.workerId, dependencies);
    for (const dependency of dependencies) {
      if (!ids.has(dependency)) {
        errors.push(`${worker.workerId} dependency does not exist: ${dependency}`);
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(workerId, stack = []) {
    if (visited.has(workerId)) return;
    if (visiting.has(workerId)) {
      errors.push(`dependency graph contains a cycle: ${[...stack, workerId].join(" -> ")}`);
      return;
    }
    visiting.add(workerId);
    for (const dependency of graph.get(workerId) ?? []) {
      if (graph.has(dependency)) visit(dependency, [...stack, workerId]);
    }
    visiting.delete(workerId);
    visited.add(workerId);
  }

  for (const worker of workers) visit(worker.workerId);
}

function validateOwnedPathBoundaries(workers, errors) {
  const owned = [];
  for (const worker of workers) {
    for (const ownedPath of asArray(worker.ownedPaths)) {
      const normalized = normalizeRepoPath(ownedPath);
      if (!normalized) continue;
      if (worker.workerId !== "A0" && globalLifecyclePaths.has(normalized)) {
        errors.push(`${worker.workerId} must not own global lifecycle path: ${normalized}`);
      }
      owned.push({ workerId: worker.workerId, path: normalized });
    }
  }

  for (let i = 0; i < owned.length; i += 1) {
    for (let j = i + 1; j < owned.length; j += 1) {
      const left = owned[i];
      const right = owned[j];
      if (left.workerId === right.workerId) continue;
      if (left.path === right.path) {
        errors.push(`ownedPaths overlap exactly between ${left.workerId} and ${right.workerId}: ${left.path}`);
      } else if (hasParentChildPathOverlap(left.path, right.path)) {
        errors.push(`ownedPaths parent-child overlap between ${left.workerId} and ${right.workerId}: ${left.path} vs ${right.path}`);
      }
    }
  }
}

function ownerIsSoleVerifier(criterion) {
  const owner = criterion.implementationOwner;
  const verifiers = asArray(criterion.integrationVerifier);
  return owner && verifiers.length === 1 && verifiers[0] === owner;
}

export function validateMultiWorkerProtocol({
  registry,
  registryText = "",
  coordinationText = ""
}) {
  const errors = [];
  const warnings = [];

  if (!supportedRegistrySchemaVersions.has(registry?.schemaVersion)) {
    errors.push("registry schemaVersion must be 2 or 3.");
  }
  if (registry?.integrationCoordinator !== "A0") errors.push("integrationCoordinator must be A0.");
  if (!Number.isInteger(registry?.currentRepairRound) || registry.currentRepairRound < 1) {
    errors.push("currentRepairRound must be a positive integer.");
  }
  if (!registry?.threadListRefreshedAt) errors.push("threadListRefreshedAt is required.");
  if (!registry?.registryRefreshedAt) errors.push("registryRefreshedAt is required.");
  if (registry?.registryValidation?.status !== "pass") errors.push("registryValidation.status must be pass.");
  if (!registry?.registryValidation?.checkedAt) errors.push("registryValidation.checkedAt is required.");

  if (localPathPattern.test(registryText)) errors.push("registry must not contain local absolute paths.");
  if (localPathPattern.test(coordinationText)) errors.push("coordination doc must not contain local absolute paths.");

  const historicalWorkers = Array.isArray(registry?.workers) ? registry.workers.map(normalizeLifecycleWorker) : [];
  const workers = [...historicalWorkers, ...repairWaveWorkers(registry)];
  if (!workers.length) errors.push("registry must include workers.");
  const activeWorkers = workers.filter(isActiveWorker);

  validateUnique(activeWorkers.map((worker) => ({ workerId: worker.workerId, value: worker.workerId })), "active workerId", errors);
  validateUnique(activeWorkers.map((worker) => ({ workerId: worker.workerId, value: worker.visibleThreadId })), "visibleThreadId", errors);
  validateUnique(activeWorkers.map((worker) => ({ workerId: worker.workerId, value: worker.branch })), "active branch", errors);

  for (const worker of workers) {
    if (!worker.workerId) errors.push("worker missing workerId.");
    if (!legalLifecycleStatuses.has(worker.lifecycleStatus)) {
      errors.push(`${worker.workerId ?? "unknown"} lifecycleStatus is not legal: ${worker.lifecycleStatus}`);
    }
    if (isCompletedButNotIntegrated(worker)) {
      errors.push(`${worker.workerId} is completed but missing integrationCommit.`);
    }
    if (isActiveWorker(worker)) {
      if (worker.workerType !== "visible_project_worktree") {
        errors.push(`${worker.workerId} active formal worker must be visible_project_worktree.`);
      }
      if (!worker.visibleThreadId) errors.push(`${worker.workerId} active worker missing visibleThreadId.`);
      if (!worker.lastVerifiedAt) errors.push(`${worker.workerId} active worker missing lastVerifiedAt.`);
      if (registry?.registryRefreshedAt && worker.lastVerifiedAt && worker.lastVerifiedAt < registry.registryRefreshedAt) {
        errors.push(`${worker.workerId} lastVerifiedAt is stale.`);
      }
      if (worker.workerType === "subagent") errors.push(`${worker.workerId} active formal worker cannot be a subagent.`);
    }
    if (worker.lifecycleStatus === "integrated") {
      if (!worker.integrationCommit) errors.push(`${worker.workerId} integrated worker missing integrationCommit.`);
      if (!worker.workerHandoffFolder) errors.push(`${worker.workerId} integrated worker missing worker handoff folder.`);
    }
    if (localPathPattern.test(JSON.stringify(worker))) {
      errors.push(`${worker.workerId ?? "unknown"} must not record local absolute paths.`);
    }
  }

  validateOwnedPathBoundaries(activeWorkers, errors);
  validateDependencies(activeWorkers, errors);

  const currentWorkers = currentWaveWorkers(registry, historicalWorkers);
  if (currentWorkers.length < 5) {
    errors.push(`current Repair ${registry?.currentRepairRound ?? "unknown"} Worker wave is not fully registered.`);
  }
  for (const workerId of ["A1", "A2", "A3", "A4", "A5"]) {
    if (!currentWorkers.some((worker) => worker.workerId === workerId)) {
      errors.push(`Repair ${registry?.currentRepairRound ?? "unknown"} required Worker missing: ${workerId}.`);
    }
  }

  const criteria = Array.isArray(registry?.acceptanceCriteria) ? registry.acceptanceCriteria : [];
  if (!criteria.length) errors.push("acceptanceCriteria ownership table is required.");
  for (const criterion of criteria) {
    const id = criterion.criterionId ?? "unknown";
    if (!criterion.implementationOwner) errors.push(`${id} missing implementationOwner.`);
    if (!criterion.evidenceOwner) errors.push(`${id} missing evidenceOwner.`);
    if (!asArray(criterion.integrationVerifier).length) errors.push(`${id} missing integrationVerifier.`);
    if (ownerIsSoleVerifier(criterion)) {
      errors.push(`${id} implementationOwner cannot be the sole integrationVerifier.`);
    }
  }

  if (registry?.integrationBaseCommit && registry?.currentIntegrationHeadCommit
    && registry.integrationBaseCommit !== registry.currentIntegrationHeadCommit) {
    warnings.push("integrationBaseCommit and currentIntegrationHeadCommit differ; verify stale-head wording.");
  }
  if (registry?.terminalHandoffReady === true) {
    if (!registry?.expectedFinalHeadCommit) errors.push("terminal registry requires expectedFinalHeadCommit.");
    if (registry?.expectedFinalHeadCommit && registry?.currentIntegrationHeadCommit !== registry.expectedFinalHeadCommit) {
      errors.push("terminal registry currentIntegrationHeadCommit must equal expectedFinalHeadCommit.");
    }
    for (const worker of currentWorkers) {
      if (!worker.headCommit) errors.push(`${worker.workerId} Repair ${registry?.currentRepairRound ?? "unknown"} terminal worker missing headCommit.`);
      if (worker.lifecycleStatus !== "integrated" && worker.lifecycleStatus !== "retired") {
        errors.push(`${worker.workerId} Repair ${registry?.currentRepairRound ?? "unknown"} terminal worker must be integrated or retired.`);
      }
      if (worker.lifecycleStatus === "integrated" && !worker.workerHandoffFolder) {
        errors.push(`${worker.workerId} Repair ${registry?.currentRepairRound ?? "unknown"} terminal worker missing handoff folder.`);
      }
    }
  }
  if (registry?.schemaVersion >= 3) {
    if (registry?.currentIntegrationHeadCommit) {
      errors.push("schemaVersion 3 tracked registry must not claim currentIntegrationHeadCommit.");
    }
    if (registry?.expectedFinalHeadCommit) {
      errors.push("schemaVersion 3 tracked registry must not claim expectedFinalHeadCommit.");
    }
    if (registry?.terminalHandoffReady === true) {
      errors.push("schemaVersion 3 tracked registry must not claim terminalHandoffReady.");
    }
    if (registry?.finalHeadBinding?.source !== "ignored_generated_artifact") {
      errors.push("schemaVersion 3 registry requires ignored generated finalHeadBinding.");
    }
    if (!registry?.finalHeadBinding?.path) {
      errors.push("schemaVersion 3 registry finalHeadBinding.path is required.");
    }
  }
  if (coordinationText.includes("Current integration head")
    && registry?.currentIntegrationHeadCommit
    && !coordinationText.includes(registry.currentIntegrationHeadCommit)) {
    errors.push("coordination doc describes a current integration head that does not match registry.");
  }

  return {
    schemaVersion: 1,
    status: errors.length ? "fail" : "pass",
    errors,
    warnings
  };
}

function argValue(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

export async function runMultiWorkerProtocolCheck({
  cwd = repoRoot,
  registryPath = "docs/product/p6/P6_WORKER_REGISTRY.json",
  coordinationPath = "docs/product/p6/P6_MULTI_AGENT_COORDINATION.md"
} = {}) {
  const registryAbsolutePath = path.resolve(cwd, registryPath);
  const coordinationAbsolutePath = path.resolve(cwd, coordinationPath);
  const registryText = await readFile(registryAbsolutePath, "utf8");
  const coordinationText = await readFile(coordinationAbsolutePath, "utf8");
  const registry = JSON.parse(registryText);
  return validateMultiWorkerProtocol({ registry, registryText, coordinationText });
}

export async function main() {
  const args = process.argv.slice(2);
  const result = await runMultiWorkerProtocolCheck({
    registryPath: argValue(args, "--registry", "docs/product/p6/P6_WORKER_REGISTRY.json"),
    coordinationPath: argValue(args, "--coordination", "docs/product/p6/P6_MULTI_AGENT_COORDINATION.md")
  });
  console.log(`AUTO_SVGA_MULTI_WORKER_PROTOCOL_CHECK_RESULT=${JSON.stringify(result)}`);
  process.exitCode = result.status === "pass" ? 0 : 1;
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
