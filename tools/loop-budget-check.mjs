#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

function parseRequiredInt(label, value) {
  if (!/^\d+$/.test(String(value ?? "").trim())) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return Number(value);
}

export function parseLoopBudgetContract(text) {
  const milestoneId = text.match(/^Milestone ID:\s*([A-Za-z0-9-]+)/m)?.[1];
  const maxRepairRounds = text.match(/^maxRepairRounds:\s*(\d+)\s*$/m)?.[1];
  const maxConsecutiveNoProgressRounds = text.match(/^maxConsecutiveNoProgressRounds:\s*(\d+)\s*$/m)?.[1];
  if (!milestoneId) throw new Error("CURRENT_MILESTONE.md missing Milestone ID.");
  return {
    milestoneId,
    maxRepairRounds: parseRequiredInt("maxRepairRounds", maxRepairRounds),
    maxConsecutiveNoProgressRounds: parseRequiredInt(
      "maxConsecutiveNoProgressRounds",
      maxConsecutiveNoProgressRounds
    )
  };
}

export function parseLoopState(text) {
  const fields = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^-\s+([^:]+):\s*(.+?)\s*$/);
    if (match) fields[match[1].trim()] = match[2].trim();
  }
  const milestoneId = fields.milestoneId ?? fields.Milestone?.split(/\s+/)[0];
  if (!milestoneId) throw new Error("LOOP_STATE.md missing milestoneId.");
  return {
    milestoneId,
    state: fields.State,
    nextAction: fields["Next Action"],
    repairRound: parseRequiredInt("repairRound", fields.repairRound),
    consecutiveNoProgressRounds: parseRequiredInt(
      "consecutiveNoProgressRounds",
      fields.consecutiveNoProgressRounds
    ),
    budgetStatus: fields.budgetStatus
  };
}

export function parseLoopHistory(text, milestoneId) {
  const entries = [];
  for (const [index, line] of text.split("\n").entries()) {
    if (!line.trim()) continue;
    let item;
    try {
      item = JSON.parse(line);
    } catch (error) {
      throw new Error(`LOOP_HISTORY.jsonl line ${index + 1} is invalid JSON: ${error.message}`);
    }
    if (item.milestoneId === milestoneId) entries.push(item);
  }
  return entries;
}

function isLegacyProgressEntry(entry) {
  return entry.iteration === "repair-1"
    && entry.result === "PASS"
    && Array.isArray(entry.evidence)
    && entry.evidence.length > 0;
}

function repairRoundProgress(entry, errors) {
  if (typeof entry.progress === "boolean") return entry.progress;
  if (isLegacyProgressEntry(entry)) return true;
  errors.push(`repair history entry ${entry.iteration} is missing required progress boolean.`);
  return false;
}

export function deriveRepairBudgetFromHistory(entries) {
  const errors = [];
  const byRound = new Map();
  for (const entry of entries) {
    const iteration = String(entry.iteration ?? "");
    const exactMatch = iteration.match(/^repair-(\d+)$/);
    if (!exactMatch) {
      if (/repair/i.test(iteration)) {
        errors.push(`repair history iteration ${iteration || "not_available"} must use repair-N format.`);
      }
      continue;
    }
    const round = Number(exactMatch[1]);
    if (!Number.isSafeInteger(round) || round < 1) {
      errors.push(`repair history iteration ${iteration} has an invalid round number.`);
      continue;
    }
    if (!byRound.has(round)) byRound.set(round, []);
    byRound.get(round).push(entry);
  }
  const rounds = [...byRound.keys()].sort((a, b) => a - b);
  const actualRepairRound = rounds.length ? Math.max(...rounds) : 0;
  for (let expected = 1; expected <= actualRepairRound; expected += 1) {
    if (!byRound.has(expected)) {
      errors.push(`repair history skips repair-${expected}.`);
    }
  }
  const progressByRound = new Map();
  for (const round of rounds) {
    const entriesForRound = byRound.get(round);
    const progressValues = entriesForRound.map((entry) => repairRoundProgress(entry, errors));
    progressByRound.set(round, progressValues.at(-1) === true);
  }
  let actualConsecutiveNoProgressRounds = 0;
  for (let round = actualRepairRound; round >= 1; round -= 1) {
    if (progressByRound.get(round) === false) {
      actualConsecutiveNoProgressRounds += 1;
      continue;
    }
    break;
  }
  return {
    actualRepairRound,
    actualConsecutiveNoProgressRounds,
    errors
  };
}

export function evaluateLoopBudget({ contract, state, historyEntries }) {
  const errors = [];
  if (contract.milestoneId !== state.milestoneId) {
    errors.push(`contract milestoneId ${contract.milestoneId} does not match state ${state.milestoneId}`);
  }
  if (!["within_budget", "exhausted"].includes(state.budgetStatus)) {
    errors.push("budgetStatus must be within_budget or exhausted.");
  }
  const {
    actualRepairRound,
    actualConsecutiveNoProgressRounds,
    errors: historyErrors
  } = deriveRepairBudgetFromHistory(historyEntries);
  errors.push(...historyErrors);
  if (state.repairRound !== actualRepairRound) {
    errors.push(`state repairRound ${state.repairRound} does not match actual repair history ${actualRepairRound}`);
  }
  if (state.consecutiveNoProgressRounds !== actualConsecutiveNoProgressRounds) {
    errors.push(
      `state consecutiveNoProgressRounds ${state.consecutiveNoProgressRounds} does not match actual repair history ${actualConsecutiveNoProgressRounds}`
    );
  }
  if (state.repairRound > contract.maxRepairRounds) {
    errors.push(`repairRound ${state.repairRound} exceeds maxRepairRounds ${contract.maxRepairRounds}`);
  }
  if (state.consecutiveNoProgressRounds > contract.maxConsecutiveNoProgressRounds) {
    errors.push(
      `consecutiveNoProgressRounds ${state.consecutiveNoProgressRounds} exceeds maxConsecutiveNoProgressRounds ${contract.maxConsecutiveNoProgressRounds}`
    );
  }
  const calculatedBudgetStatus = state.repairRound > contract.maxRepairRounds
    || state.consecutiveNoProgressRounds > contract.maxConsecutiveNoProgressRounds
    ? "exhausted"
    : "within_budget";
  if (state.budgetStatus !== calculatedBudgetStatus) {
    errors.push(`state budgetStatus ${state.budgetStatus} does not match calculated ${calculatedBudgetStatus}`);
  }
  const nextRepairRound = state.repairRound + 1;
  const nextRepairAllowed = state.repairRound < contract.maxRepairRounds
    && state.consecutiveNoProgressRounds < contract.maxConsecutiveNoProgressRounds
    && errors.length === 0;
  return {
    schemaVersion: 1,
    status: errors.length === 0 ? "pass" : "fail",
    milestoneId: contract.milestoneId,
    maxRepairRounds: contract.maxRepairRounds,
    maxConsecutiveNoProgressRounds: contract.maxConsecutiveNoProgressRounds,
    repairRound: state.repairRound,
    actualRepairRound,
    consecutiveNoProgressRounds: state.consecutiveNoProgressRounds,
    actualConsecutiveNoProgressRounds,
    budgetStatus: state.budgetStatus,
    nextRepairRound,
    nextRepairAllowed,
    errors
  };
}

export async function runLoopBudgetCheck({
  cwd = repoRoot,
  contractPath = "docs/loop/CURRENT_MILESTONE.md",
  statePath = "docs/loop/LOOP_STATE.md",
  historyPath = "docs/loop/LOOP_HISTORY.jsonl",
  artifactPath = ".artifacts/loop-budget-check/latest.json"
} = {}) {
  const contractText = await readFile(path.resolve(cwd, contractPath), "utf8");
  const stateText = await readFile(path.resolve(cwd, statePath), "utf8");
  const historyText = existsSync(path.resolve(cwd, historyPath))
    ? await readFile(path.resolve(cwd, historyPath), "utf8")
    : "";
  const contract = parseLoopBudgetContract(contractText);
  const state = parseLoopState(stateText);
  const historyEntries = parseLoopHistory(historyText, contract.milestoneId);
  const result = evaluateLoopBudget({ contract, state, historyEntries });
  const absoluteArtifactPath = path.resolve(cwd, artifactPath);
  await mkdir(path.dirname(absoluteArtifactPath), { recursive: true });
  await writeFile(absoluteArtifactPath, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

export async function main() {
  const result = await runLoopBudgetCheck();
  console.log(`AUTO_SVGA_LOOP_BUDGET_CHECK_RESULT=${JSON.stringify(result)}`);
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
