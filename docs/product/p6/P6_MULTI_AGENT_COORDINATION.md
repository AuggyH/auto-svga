# P6 Multi-Agent Coordination

Date: 2026-06-22

P6 uses A0 as the only Integration Coordinator. Formal implementation workers are visible Codex project Worktree threads. Subagents are allowed only for short-lived read-only audit and review.

## Current Integration State

- Integration branch: `agent/codex/p6-integration`
- Current integration head when this protocol was recorded: `d347cd4802ffe47cf2291f69fbebac6c0ec29457`
- Current terminal state: P6 remains `HUMAN_REQUIRED` pending owner acceptance.
- Existing P6 workers must be reused; do not recreate them.

## Existing Visible Workers

| Worker | Visible thread id | Worktree cwd | Current branch |
| --- | --- | --- | --- |
| A1 Web Baseline | `019eeb7d-c4a6-70e3-8d04-756807461f7f` | `/Users/huangtengxin/.codex/worktrees/7795/auto-svga` | `agent/codex/p6-a1-web-baseline` |
| A2 Shared Frontend | `019eeb8a-3dbe-7123-b696-e1334ab9ab60` | `/Users/huangtengxin/.codex/worktrees/4bd8/auto-svga` | `agent/codex/p6-a2-shared-frontend` |
| A3 Electron Host | `019eeb7e-072c-7382-afe5-330eb92b9d2f` | `/Users/huangtengxin/.codex/worktrees/befc/auto-svga` | `agent/codex/p6-r2-a3-electron-host` |
| A4 Parity Test Framework | `019eeb7e-071e-7991-ab4f-075c56dbade1` | `/Users/huangtengxin/.codex/worktrees/40ab/auto-svga` | `agent/codex/p6-a4-parity-tests` |
| A5 macOS Packaging | `019eeb7e-0731-76c0-92e3-d9494b272e14` | `/Users/huangtengxin/.codex/worktrees/44d0/auto-svga` | `agent/codex/p6-a5-macos-package` |

## Worker Lifecycle

Before A0 starts or resumes a worker:

1. List project threads.
2. Match by worker id and role.
3. Reuse the existing visible thread if present.
4. Verify worktree cwd and branch.
5. Send the full context packet.
6. Require hidden/background App debugging when possible.
7. Require the standard handoff fields.

Worker completion does not change milestone status. A0 must integrate fixed commits and revalidate on `agent/codex/p6-integration`.

## Context Packet Checklist

Each P6 worker prompt must include:

- product objective from `docs/loop/CURRENT_MILESTONE.md`
- frozen contract paths:
  - `docs/loop/CURRENT_MILESTONE.md`
  - `docs/product/P6_WEB_PRODUCT_BASELINE.md`
  - `docs/product/P6_WEB_FEATURE_INVENTORY.md`
  - `docs/product/P6_WEB_PARITY_CONTRACT.json`
  - `docs/product/P6_SHARED_FRONTEND_ARCHITECTURE.md`
  - `docs/product/P6_HOST_ADAPTER_CONTRACT.md`
- current integration base commit
- assigned branch
- owned files or directories
- prohibited files
- dependency order
- acceptance criteria owned by the worker
- required tests
- required handoff fields

## Protected Files

Workers must not modify:

- `docs/loop/CURRENT_MILESTONE.md`
- `docs/loop/LOOP_STATE.md`
- `docs/loop/LOOP_HISTORY.jsonl`
- `AGENTS.md`
- root `package.json`
- final handoff inputs

Only A0 may modify these files.

## Acceptance Ownership

| Criterion | Implementation owner | Evidence owner | Integration verifier |
| --- | --- | --- | --- |
| P6-AC-01 Owner Roadmap Reset | A0 | A0 | Reviewer A/B + A0 |
| P6-AC-02 Frozen Web Product Baseline | A1, with A0 repair if blocked | A1 or A0 generated baseline evidence | A0 |
| P6-AC-03 Shared Product Frontend | A2 | A4 evidence helpers + A0 runtime proof | A0 |
| P6-AC-04 Feature Parity | A2/A3/A5 as applicable | A4 + A0 generated parity report | A0 |
| P6-AC-05 UI Region Parity | A2 | A4 + A0 screenshots | A0 |
| P6-AC-06 Interaction Parity | A2/A3 | A4 + A0 interaction traces | A0 |
| P6-AC-07 Product State Parity | A2/A3 | A4 + A0 state evidence | A0 |
| P6-AC-08 Motion Parity | A2 | A4 + A0 motion evidence | A0 |
| P6-AC-09 No Unapproved Difference | A0 | A4 validation + A0 diff review | Reviewer A/B + A0 |
| P6-AC-10 Browser Regression | A1/A2 | A0 browser smoke | A0 |
| P6-AC-11 Desktop Host Integration | A3 | A3 targeted tests + A0 packaged/runtime smoke | A0 |
| P6-AC-12 Local-only Security | A3/A5 | A3/A5 tests + A0 request audit | Reviewer A/B + A0 |
| P6-AC-13 Product Performance And Cleanup | A3/A5 | A0 process/temp cleanup proof | A0 |
| P6-AC-14 macOS Internal App | A5 | A5 package proof + A0 package artifact | A0 |
| P6-AC-15 Actual App Runtime | A0 | A0 packaged App proof | Reviewer A/B + A0 |
| P6-AC-16 Responsive And Accessible | A2 | A0 screenshots + accessibility checks | A0 |
| P6-AC-17 Independent Review | Reviewer A/B | A0 sealed packet evidence | A0 |
| P6-AC-18 Scope Discipline | All workers | A0 changed-file and scope audit | Reviewer A/B + A0 |

Implementation owners do not serve as final acceptance verifiers for their own criteria.

## Integration Order

1. A1
2. A2 after A1 is integrated
3. A3
4. A4
5. A5
6. A0 integration repair
7. A0 heavy validation and seal

A0 must run targeted integration checks after each dependency layer.

## A0 Verification Duties

A0 must re-check on fixed integration HEAD:

- real product behavior
- acceptance criteria coverage
- evidence generation logic
- negative and mutation tests
- hard-coded PASS risks
- user path privacy
- unapproved differences

Heavy Electron, Web server, packaged App smoke, final screenshots, final motion evidence, loop validation, reviewers, and packet sealing stay serial under A0.

## Known P6 Worker Lessons

- A1 initially stopped without committed branch changes; A0 had to take over baseline work.
- A2 initially stopped mid-migration; later resumed in the same visible thread and completed a clean worker handoff.
- A3 had branch confusion between original and Repair 2 branches; future repairs must verify branch and worktree before editing.
- Tests that prepare the same Electron runtime must run sequentially to avoid shared `.runtime` races.
- Worker self-reports are useful handoff material, not acceptance.
