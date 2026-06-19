# Auto SVGA Autonomous Loop Protocol

Date: 2026-06-19

## Purpose

This protocol governs long-running autonomous Auto SVGA tasks. It keeps implementation, validation, review, repair, and handoff tied to a frozen milestone contract.

## Milestone Contract

1. Every product goal is converted into one frozen milestone contract before implementation begins.
2. The milestone contract records objective, allowed changes, prohibited changes, validation gates, review gates, and stop conditions.
3. Codex must not change the milestone objective or acceptance criteria after implementation begins.
4. If the contract must change, stop and enter `HUMAN_REQUIRED`.

## Execution Cycle

Each loop executes:

1. Implement.
2. Validate.
3. Review.
4. Repair.

Rules:

1. Maximum repair rounds: 4.
2. Consecutive rounds with no new evidence: 2, then enter `HUMAN_REQUIRED`.
3. Each round updates `docs/loop/LOOP_STATE.md`.
4. Each round appends evidence to `docs/loop/LOOP_HISTORY.md`.
5. Work on one primary failure cause per repair round.
6. Run the smallest relevant test first, then the full milestone validation.

## Autonomy

Codex decides ordinary implementation choices without asking the user.

Human input is allowed only for:

1. Product direction.
2. Visual acceptance.
3. Security exceptions.
4. Milestone contract changes.
5. External permissions.
6. Irreversible operations.
7. Unsafe existing user changes.

## Reviewer

1. Reviewer must be independent and read-only.
2. Reviewer must not modify code, tests, docs, dependencies, or config.
3. Reviewer checks the current work against the frozen milestone contract.
4. Reviewer findings are blocking only when they identify a contract violation, weakened validation, hidden failure, scope drift, or unsafe state.

## Prohibited Automation

Codex must not automatically:

1. Push.
2. Merge.
3. Release.
4. Deploy.
5. Publish packages.
6. Delete user assets.
7. Hide required check failures with skips, ignores, broad catches, or fallback success.

## Evidence

Each loop history entry must include:

1. Round number.
2. Hypothesis.
3. Files changed.
4. Commands run.
5. Results.
6. New evidence.
7. Next action.

## Terminal States

Allowed terminal states:

- `PASS`: milestone contract is satisfied and independently reviewed.
- `HUMAN_REQUIRED`: further progress requires allowed human input.

Do not stop in any other state.
