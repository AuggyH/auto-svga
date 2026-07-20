import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  deriveRepairBudgetFromHistory,
  evaluateLoopBudget,
  parseLoopBudgetContract,
  parseLoopState,
  runLoopBudgetCheck
} from "./loop-budget-check.mjs";

async function withRepo(callback) {
  const repo = await mkdtemp(join(tmpdir(), "auto-svga-budget-"));
  try {
    await mkdir(join(repo, "docs/loop"), { recursive: true });
    return await callback(repo);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
}

function contract(overrides = {}) {
  return [
    "# M2-R3",
    "",
    `Milestone ID: ${overrides.milestoneId ?? "M2-R3"}`,
    `maxRepairRounds: ${overrides.maxRepairRounds ?? 2}`,
    `maxConsecutiveNoProgressRounds: ${overrides.maxConsecutiveNoProgressRounds ?? 1}`,
    ""
  ].join("\n");
}

function state(overrides = {}) {
  return [
    "# State",
    "",
    `- milestoneId: ${overrides.milestoneId ?? "M2-R3"}`,
    `- State: ${overrides.state ?? "in_progress"}`,
    `- Next Action: ${overrides.nextAction ?? "implement"}`,
    `- repairRound: ${overrides.repairRound ?? 1}`,
    `- consecutiveNoProgressRounds: ${overrides.consecutiveNoProgressRounds ?? 0}`,
    `- budgetStatus: ${overrides.budgetStatus ?? "within_budget"}`,
    ""
  ].join("\n");
}

function history(entries = []) {
  return entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
}

test("budget check passes when state and repair history are within limits", async () => {
  await withRepo(async (repo) => {
    await writeFile(join(repo, "docs/loop/CURRENT_MILESTONE.md"), contract());
    await writeFile(join(repo, "docs/loop/LOOP_STATE.md"), state({ repairRound: 1 }));
    await writeFile(join(repo, "docs/loop/LOOP_HISTORY.jsonl"), history([
      { milestoneId: "M2-R3", iteration: "repair-1", result: "PASS", progress: true }
    ]));

    const result = await runLoopBudgetCheck({ cwd: repo });

    assert.equal(result.status, "pass");
    assert.equal(result.nextRepairAllowed, true);
  });
});

test("budget check fails when repairRound exceeds maxRepairRounds", () => {
  const result = evaluateLoopBudget({
    contract: { milestoneId: "M2-R3", maxRepairRounds: 2, maxConsecutiveNoProgressRounds: 1 },
    state: {
      milestoneId: "M2-R3",
      repairRound: 3,
      consecutiveNoProgressRounds: 0,
      budgetStatus: "exhausted"
    },
    historyEntries: [
      { iteration: "repair-1", progress: true },
      { iteration: "repair-2", progress: true },
      { iteration: "repair-3", progress: true }
    ]
  });

  assert.equal(result.status, "fail");
  assert.match(result.errors.join("\n"), /exceeds maxRepairRounds/);
});

test("budget check fails when no-progress rounds exceed the frozen limit", () => {
  const result = evaluateLoopBudget({
    contract: { milestoneId: "M2-R3", maxRepairRounds: 2, maxConsecutiveNoProgressRounds: 1 },
    state: {
      milestoneId: "M2-R3",
      repairRound: 1,
      consecutiveNoProgressRounds: 2,
      budgetStatus: "within_budget"
    },
    historyEntries: [{ iteration: "repair-1", progress: false }]
  });

  assert.equal(result.status, "fail");
  assert.match(result.errors.join("\n"), /consecutiveNoProgressRounds/);
});

test("budget check fails when state repairRound understates actual repair history", () => {
  const result = evaluateLoopBudget({
    contract: { milestoneId: "M2-R3", maxRepairRounds: 3, maxConsecutiveNoProgressRounds: 1 },
    state: {
      milestoneId: "M2-R3",
      repairRound: 1,
      consecutiveNoProgressRounds: 0,
      budgetStatus: "within_budget"
    },
    historyEntries: [{ iteration: "repair-1", progress: true }, { iteration: "repair-2", progress: true }]
  });

  assert.equal(result.status, "fail");
  assert.match(result.errors.join("\n"), /does not match actual repair history 2/);
});

test("budget check fails when milestone IDs do not match", () => {
  const result = evaluateLoopBudget({
    contract: { milestoneId: "M2-R3", maxRepairRounds: 2, maxConsecutiveNoProgressRounds: 1 },
    state: {
      milestoneId: "M2-R2",
      repairRound: 0,
      consecutiveNoProgressRounds: 0,
      budgetStatus: "within_budget"
    },
    historyEntries: []
  });

  assert.equal(result.status, "fail");
  assert.match(result.errors.join("\n"), /does not match/);
});

test("budget parsers reject missing required budget fields", () => {
  assert.throws(() => parseLoopBudgetContract("Milestone ID: M2-R3\n"), /maxRepairRounds/);
  assert.throws(() => parseLoopState("- milestoneId: M2-R3\n- repairRound: 0\n"), /consecutiveNoProgressRounds/);
});

test("budget check fails when state understates consecutive no-progress history", () => {
  const result = evaluateLoopBudget({
    contract: { milestoneId: "M2-R3", maxRepairRounds: 3, maxConsecutiveNoProgressRounds: 2 },
    state: {
      milestoneId: "M2-R3",
      repairRound: 2,
      consecutiveNoProgressRounds: 1,
      budgetStatus: "within_budget"
    },
    historyEntries: [
      { iteration: "repair-1", progress: false },
      { iteration: "repair-2", progress: false }
    ]
  });

  assert.equal(result.status, "fail");
  assert.match(result.errors.join("\n"), /does not match actual repair history 2/);
});

test("new repair history entry missing progress fails", () => {
  const result = evaluateLoopBudget({
    contract: { milestoneId: "M2-R3", maxRepairRounds: 2, maxConsecutiveNoProgressRounds: 1 },
    state: {
      milestoneId: "M2-R3",
      repairRound: 2,
      consecutiveNoProgressRounds: 0,
      budgetStatus: "within_budget"
    },
    historyEntries: [
      { iteration: "repair-1", result: "PASS", evidence: ["legacy evidence"] },
      { iteration: "repair-2", result: "PASS", evidence: ["new evidence"] }
    ]
  });

  assert.equal(result.status, "fail");
  assert.match(result.errors.join("\n"), /missing required progress/);
});

test("legacy repair-1 PASS with evidence is treated as progress only for migration", () => {
  const derived = deriveRepairBudgetFromHistory([
    { iteration: "repair-1", result: "PASS", evidence: ["legacy evidence"] }
  ]);

  assert.equal(derived.actualRepairRound, 1);
  assert.equal(derived.actualConsecutiveNoProgressRounds, 0);
  assert.deepEqual(derived.errors, []);
});

test("repair max reached makes nextRepairAllowed false without exhausting current PASS", () => {
  const result = evaluateLoopBudget({
    contract: { milestoneId: "M2-R3", maxRepairRounds: 2, maxConsecutiveNoProgressRounds: 1 },
    state: {
      milestoneId: "M2-R3",
      repairRound: 2,
      consecutiveNoProgressRounds: 0,
      budgetStatus: "within_budget"
    },
    historyEntries: [
      { iteration: "repair-1", progress: true },
      { iteration: "repair-2", progress: true }
    ]
  });

  assert.equal(result.status, "pass");
  assert.equal(result.nextRepairAllowed, false);
  assert.equal(result.budgetStatus, "within_budget");
});

test("no-progress max reached makes nextRepairAllowed false", () => {
  const result = evaluateLoopBudget({
    contract: { milestoneId: "M2-R3", maxRepairRounds: 3, maxConsecutiveNoProgressRounds: 1 },
    state: {
      milestoneId: "M2-R3",
      repairRound: 1,
      consecutiveNoProgressRounds: 1,
      budgetStatus: "within_budget"
    },
    historyEntries: [{ iteration: "repair-1", progress: false }]
  });

  assert.equal(result.status, "pass");
  assert.equal(result.nextRepairAllowed, false);
});

test("budgetStatus mismatch fails", () => {
  const result = evaluateLoopBudget({
    contract: { milestoneId: "M2-R3", maxRepairRounds: 1, maxConsecutiveNoProgressRounds: 1 },
    state: {
      milestoneId: "M2-R3",
      repairRound: 2,
      consecutiveNoProgressRounds: 0,
      budgetStatus: "within_budget"
    },
    historyEntries: [
      { iteration: "repair-1", progress: true },
      { iteration: "repair-2", progress: true }
    ]
  });

  assert.equal(result.status, "fail");
  assert.match(result.errors.join("\n"), /budgetStatus/);
});

test("repair-like evasive iteration names fail", () => {
  const result = evaluateLoopBudget({
    contract: { milestoneId: "M2-R3", maxRepairRounds: 2, maxConsecutiveNoProgressRounds: 1 },
    state: {
      milestoneId: "M2-R3",
      repairRound: 0,
      consecutiveNoProgressRounds: 0,
      budgetStatus: "within_budget"
    },
    historyEntries: [{ iteration: "repair-final", progress: true }]
  });

  assert.equal(result.status, "fail");
  assert.match(result.errors.join("\n"), /repair-N/);
});

test("last entry in a repair round determines no-progress derivation", () => {
  const result = evaluateLoopBudget({
    contract: { milestoneId: "M2-R3", maxRepairRounds: 2, maxConsecutiveNoProgressRounds: 1 },
    state: {
      milestoneId: "M2-R3",
      repairRound: 2,
      consecutiveNoProgressRounds: 0,
      budgetStatus: "within_budget"
    },
    historyEntries: [
      { iteration: "repair-1", progress: true },
      { iteration: "repair-2", phase: "implementation", progress: true },
      { iteration: "repair-2", phase: "terminal", progress: false }
    ]
  });

  assert.equal(result.status, "fail");
  assert.match(result.errors.join("\n"), /consecutiveNoProgressRounds 0 does not match actual repair history 1/);
});

test("repair2 and repair_2 evasive iteration names fail", () => {
  for (const iteration of ["repair2", "repair_2", "fix-repair2"]) {
    const result = evaluateLoopBudget({
      contract: { milestoneId: "M2-R3", maxRepairRounds: 2, maxConsecutiveNoProgressRounds: 1 },
      state: {
        milestoneId: "M2-R3",
        repairRound: 0,
        consecutiveNoProgressRounds: 0,
        budgetStatus: "within_budget"
      },
      historyEntries: [{ iteration, progress: true }]
    });

    assert.equal(result.status, "fail", iteration);
    assert.match(result.errors.join("\n"), /repair-N/, iteration);
  }
});
