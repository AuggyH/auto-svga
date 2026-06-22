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

  if (registry?.schemaVersion !== 2) errors.push("registry schemaVersion must be 2.");
  if (registry?.integrationCoordinator !== "A0") errors.push("integrationCoordinator must be A0.");
  if (registry?.currentRepairRound !== 3) errors.push("currentRepairRound must be 3 for P6 Repair 3.");
  if (!registry?.threadListRefreshedAt) errors.push("threadListRefreshedAt is required.");
  if (!registry?.registryRefreshedAt) errors.push("registryRefreshedAt is required.");
  if (registry?.registryValidation?.status !== "pass") errors.push("registryValidation.status must be pass.");
  if (!registry?.registryValidation?.checkedAt) errors.push("registryValidation.checkedAt is required.");

  if (localPathPattern.test(registryText)) errors.push("registry must not contain local absolute paths.");
  if (localPathPattern.test(coordinationText)) errors.push("coordination doc must not contain local absolute paths.");

  const workers = Array.isArray(registry?.workers) ? registry.workers : [];
  if (!workers.length) errors.push("registry must include workers.");
  const activeWorkers = workers.filter(isActiveWorker);

  validateUnique(workers.map((worker) => ({ workerId: worker.workerId, value: worker.workerId })), "workerId", errors);
  validateUnique(activeWorkers.map((worker) => ({ workerId: worker.workerId, value: worker.visibleThreadId })), "visibleThreadId", errors);
  validateUnique(activeWorkers.map((worker) => ({ workerId: worker.workerId, value: worker.branch })), "active branch", errors);

  for (const worker of workers) {
    if (!worker.workerId) errors.push("worker missing workerId.");
    if (!legalLifecycleStatuses.has(worker.lifecycleStatus)) {
      errors.push(`${worker.workerId ?? "unknown"} lifecycleStatus is not legal: ${worker.lifecycleStatus}`);
    }
    if (isActiveWorker(worker)) {
      if (worker.workerType !== "visible_project_worktree") {
        errors.push(`${worker.workerId} active formal worker must be visible_project_worktree.`);
      }
      if (!worker.visibleThreadId) errors.push(`${worker.workerId} active worker missing visibleThreadId.`);
      if (!worker.lastVerifiedAt) errors.push(`${worker.workerId} active worker missing lastVerifiedAt.`);
      if (worker.workerType === "subagent") errors.push(`${worker.workerId} active formal worker cannot be a subagent.`);
    }
    if (localPathPattern.test(JSON.stringify(worker))) {
      errors.push(`${worker.workerId ?? "unknown"} must not record local absolute paths.`);
    }
  }

  validateOwnedPathBoundaries(workers, errors);
  validateDependencies(workers, errors);

  if (!workers.some((worker) => worker.waveId === "P6-R3")) {
    errors.push("current Repair 3 Worker wave is not registered.");
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
