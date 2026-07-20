# Review: QA Response Expectation Governance

## Summary

- Promoted the QA priority/importance response policy into repository-level
  agent guidance without changing product scope.
- `AGENTS.md` now states that QA routing is not an automatic interruption or
  queue jump.
- `PROJECT_EXPERIENCE_GUIDE.md` now records the coordination lesson for future
  cross-thread work.

## Git State

- Branch: `agent/codex/short-term-preview-qa-20260708`
- This review intentionally does not stage unrelated dirty QA, release, or
  short-term implementation files already present in the worktree.

## Changed Files

- `AGENTS.md`
- `docs/retrospectives/PROJECT_EXPERIENCE_GUIDE.md`
- `docs/reviews/2026-07-08-codex-qa-response-expectation-governance.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## Requirement Checks

- Product scope unchanged: no PRD update.
- QA workflow remains the detailed authority for ticket lifecycle and response
  expectation taxonomy.
- Repository-level guidance now prevents owners from reading QA handoffs as
  always-immediate interrupts.

## Verification

- `git diff --check` passed for staged files.
- Staged retrospective ledger parses as JSONL.
- No production assets staged.

## Risks And Next Steps

- QA worktree changes still need their own normal integration path. This PM
  governance update only adds the high-level rule visible to all agents.

## Project Retrospective

- Cross-thread governance should live at two levels: detailed lifecycle rules
  in the owner workflow document, and a short interruption policy in `AGENTS.md`
  for agents that only need the coordination guardrail.

## Token Usage

- Exact Codex token count unavailable in this session.
