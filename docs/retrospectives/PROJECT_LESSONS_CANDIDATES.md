# Project Lessons Candidates

Status: active candidate pool

Use this file for reusable project lessons that are promising but not yet
stable enough for `PROJECT_EXPERIENCE_GUIDE.md`.

Do not copy chat history here. Summarize the smallest reusable lesson, cite the
review or task ledger entry that produced it, and mark whether it should be
promoted, watched, rejected, or kept historical.

## Candidate Format

```text
## <short lesson title>

- Source:
- Area: product | implementation | UI/UX | validation | coordination | token-cost | release
- Context:
- Problem:
- Candidate rule:
- Evidence:
- Status: candidate | promote | watch | rejected | historical
```

## Project retrospectives must not collapse into token accounting

- Source: `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- Area: coordination, token-cost
- Context: The Product Owner requested token statistics, but clarified that
  weekly and monthly reviews must cover all project work: product planning,
  implementation, technical architecture, design interaction, validation,
  multi-process coordination, and execution cost.
- Problem: A token-only system would optimize for cheap turns while missing
  higher-impact causes of delay, rework, scope drift, UI churn, and validation
  weakness.
- Candidate rule: Treat token usage as one cost signal inside a broader
  project retrospective system.
- Evidence: Initial project retrospective system created on 2026-07-06.
- Status: promote

## Keep raw session content out of repository retrospectives

- Source: `docs/retrospectives/PROJECT_REVIEW_SYSTEM.md`
- Area: privacy, token-cost, coordination
- Context: Codex session files can contain `token_count` events useful for
  cost analysis, but they also contain raw conversation and tool output.
- Problem: Copying raw session content into Git would create privacy, noise,
  and token-cost problems.
- Candidate rule: Extract only structured counts, task ids, review paths, and
  short lessons. Do not copy raw chats or long logs.
- Evidence: The task ledger schema records token source and counts without raw
  transcript fields.
- Status: promote

## Batch adjacent visual polish into owner-visible bundles

- Source: `docs/retrospectives/weekly/2026-W28.md`
- Area: UI/UX, coordination, token-cost
- Context: The first weekly retrospective counted 144 review files across
  2026-07-04 through 2026-07-06, including 116 UI/UX reviews. Many were
  neighboring split or polish slices with repeated scope, smoke, foreground,
  and next-step language.
- Problem: Small slices improve traceability, but too many adjacent visual-only
  slices multiply startup, validation, screenshot, review, and handoff cost.
- Candidate rule: Batch adjacent visual-only polish by page state or surface
  and run one bundled foreground acceptance pass, unless behavior, save/output,
  host security, accessibility-critical focus behavior, or fragile cross-state
  layout requires isolation.
- Evidence: `docs/retrospectives/weekly/2026-W28.md`
- Status: promote

## Use P6 retrospectives as a preflight anti-pattern checklist

- Source: `docs/retrospectives/P6_POSTMORTEM.md`,
  `docs/retrospectives/P6_ROOT_CAUSE_TREE.md`,
  `docs/retrospectives/P6_MULTI_WORKER_ASSESSMENT.md`,
  `docs/retrospectives/P6_REPAIR_ROUND_MATRIX.md`
- Area: implementation, validation, coordination
- Context: P6 consumed six repair rounds while still missing product
  acceptance because evidence, packaging, protocol, and technical-layer work
  competed with vertical user-flow proof.
- Problem: Future milestones can repeat the same pattern if workers pass by
  layer while no one owns a complete user journey.
- Candidate rule: Before any large multi-lane milestone, check for vertical
  owner, failure-first evidence, machine/human gate separation, and
  final-head-bound proof.
- Evidence: First weekly retrospective confirms these retrospectives remain
  the highest-value historical learning source.
- Status: promote

## Centralize repeated foreground-validation disclaimers

- Source: `docs/retrospectives/weekly/2026-W28.md`
- Area: UI/UX, validation, token-cost
- Context: Recent UI/UX reviews repeatedly state that smoke is regression-only
  and foreground macOS evidence is still required.
- Problem: The disclaimer is correct, but repeating it in every adjacent
  visual slice consumes attention without closing acceptance.
- Candidate rule: Maintain one active foreground-validation checklist per
  UI/UX bundle; individual reviews should reference it and only add deltas.
- Evidence: `docs/retrospectives/weekly/2026-W28.md`
- Status: watch
