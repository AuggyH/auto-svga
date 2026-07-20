# P6 External Product Review 2

Date: 2026-06-22

externalOutcome: `REPAIR_REQUIRED`

reviewedHeadCommit: `d347cd4802ffe47cf2291f69fbebac6c0ec29457`

productOutcome: `LOCAL_PREVIEW_PARTIAL_PARITY_ONLY`

## Source

This review records the superseding owner directive that replaces all unsent
P6 Repair 3, multi-worker hardening, and review-visibility follow-up prompts.
All work remains P6 Repair 3. Do not restart P6 and do not start Phase 2.

## Accepted Prior Repair Inputs

- Multi-worker hardening reviewed commit:
  `175c68450d6b1b99bb95fa93ec9b04ea73e802ff`
- Visible review rule reviewed commit:
  `416a9db637d2b92389d7a018c2105bf971774e7c`
- Visible review rule outcome: `DIRECTION_ACCEPTED_REPAIR_REQUIRED`

## Findings

1. P6 still requires evidence-driven full Web/Desktop parity before owner
   acceptance.
2. Multi-worker coordination must be hardened before additional formal worker
   implementation.
3. Formal implementation workers must be visible project Worktree threads;
   background subagents cannot replace long-lived workers.
4. P6 Worker Registry must be upgraded to schemaVersion 2, refreshed from
   current project threads, and machine-validated.
5. Worker ownership must be single-owner per write path, with broad directory
   claims split between owner and read-only paths.
6. Worker context packets must exist in the repository so workers do not depend
   on raw chat history.
7. Owner-visible review handoff must distinguish subagent, formal worker, and
   terminal milestone handoff.
8. Terminal visible mirrors must byte-copy sealed canonical packet files and
   fail on hash drift.
9. Final responses must include clickable links to actual files, not only
   hidden `.artifacts` paths or raw non-clickable paths.
10. Web inventory, shared product shell parity, Electron host parity, loading
    state, invalid state, scenario runner, parity engine, mutation tests,
    motion parity, visible normal macOS App proof, reviewers, and final
    handoff all need Repair 3 work.

## Required Repair Entry Conditions

- `node tools/loop-budget-check.mjs` must report `nextRepairAllowed=true`.
- `node tools/loop-budget-check.mjs` must report `nextRepairRound=3`.

The budget gate passed on 2026-06-22T05:35:24Z:

- `nextRepairAllowed=true`
- `nextRepairRound=3`
- `budgetStatus=within_budget`

## Non-Goals

- Do not accept P6 automatically.
- Do not start Phase 2.
- Do not restore P3-P5 editor UI as the default product.
- Do not add new dependencies, public network use, credentials, production
  services, or real user assets.
- Do not push, merge to a protected mainline, release, publish, sign,
  notarize, or deploy.
