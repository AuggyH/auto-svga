# P6 Multi-Agent Coordination

Date: 2026-06-22

P6 uses A0 as the only Integration Coordinator. Formal implementation workers are visible Codex project Worktree threads. Subagents are allowed only for short-lived read-only audit and review.

## Current Integration State

- Integration branch: `agent/codex/p6-integration`
- Current integration head after A5 Repair 5 integration:
  `023c12be89138bea8f85fca00dfc6dd2244ca31d`
- Current loop state: P6 Repair 5 is `implementation_in_progress`; A1 through A5 are integrated and A0 integration repair is next.
- Repair 4 terminal parity status was `HUMAN_REQUIRED`; browser regression,
  security audit, and artifact index passed, but visual, feature, interaction,
  state, motion, Desktop proof, and Desktop rendered-state evidence still
  contained required non-pass items.
- Existing P6 workers must be reused; do not recreate them.
- Worktree paths are runtime thread metadata and must not be committed to this
  coordination document or to `P6_WORKER_REGISTRY.json`.
- Repair 4 terminal evidence is historical and rejected by external review for
  owner acceptance. Do not use `review/P6-290272e/`, the reviewed
  `p6-parity-report.json`, old screenshots, old reviewer JSON, old App proof,
  or old sealed packets as terminal Repair 5 acceptance evidence.

## Existing Visible Workers

| Worker | Visible thread id | Thread type | Current branch |
| --- | --- | --- | --- |
| A1 Web Baseline | `019eeb7d-c4a6-70e3-8d04-756807461f7f` | visible project Worktree thread | reuse for `agent/codex/p6-r5-a1-runtime-inventory` |
| A2 Shared Frontend | `019eeb8a-3dbe-7123-b696-e1334ab9ab60` | visible project Worktree thread | reuse for `agent/codex/p6-r5-a2-product-states` after A1 integration |
| A3 Electron Host | `019eeb7e-072c-7382-afe5-330eb92b9d2f` | visible project Worktree thread | reuse for `agent/codex/p6-r5-a3-host-app-runtime` |
| A4 Parity Test Framework | `019eeb7e-071e-7991-ab4f-075c56dbade1` | visible project Worktree thread | reuse for `agent/codex/p6-r5-a4-scenarios-motion-parity` |
| A5 macOS Packaging | `019eeb7e-0731-76c0-92e3-d9494b272e14` | visible project Worktree thread | reuse for `agent/codex/p6-r5-a5-final-packaging` |

## Repair 5 Product Findings

External review rejected Repair 4 owner acceptance because the report honestly
showed required gaps instead of completing parity. Repair 5 must close every
remaining required failure with item-specific runtime evidence:

- visual: `playerBarB`, `referencePlayerBar`, `assetPreviewModal`, `reportGrid`
- feature: optional comparison, secondary SVGA select/drop, status announcements
- interaction: mode menu, export review select, accessibility toggles, Escape,
  Space synchronized playback, local compare switch
- state: local empty, mode menu open, local compare empty
- motion: `fitMenuIn`, `sidePanelEnter`, `tabIn`, `overlayIn`, `modalIn`,
  `drawerIn`, `dropdownIn`
- runtime: normal Electron source proof and Desktop rendered-state proof
- protocol: registry final HEAD, terminal readiness, base-range diff,
  privacy scan, Reviewer A/B, Review ZIP, and App ZIP must all bind to the
  final source head

## Worker Lifecycle

Before A0 starts or resumes a worker:

1. List project threads.
2. Match by worker id and role.
3. Reuse the existing visible thread if present.
4. Verify Worktree mode and branch from runtime thread metadata.
5. Send the full context packet.
6. Require hidden/background App debugging when possible.
7. Require the standard handoff fields.
8. Update `P6_WORKER_REGISTRY.json` with thread id, branch, fixed commits,
   lifecycle status, dependencies, and requested integration changes.

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

## Owned Path Boundaries

A1 owns only Web baseline inventory and parity contract sources:

- `docs/product/P6_WEB_PRODUCT_BASELINE.md`
- `docs/product/P6_WEB_FEATURE_INVENTORY.md`
- `docs/product/P6_WEB_PARITY_CONTRACT.json`
- dedicated Web inventory scripts and tests

A2 owns shared frontend product code:

- `tools/shared/product-frontend/`
- shared product shell
- shared core CSS
- shared state machine
- shared motion definitions
- thin Web wrapper entry points needed to mount the shared shell

A3 owns Electron host boundaries:

- Electron main process
- Electron preload
- `ElectronHostAdapter`
- host-only IPC tests
- Desktop latest-artifact adapter
- file, menu, and drop host integration

A4 owns parity and protocol evidence:

- `tools/p6/generate-p6-evidence.mjs`
- runtime scenario runner
- parity generator
- screenshot and motion capture helpers
- parity mutation tests
- multi-worker protocol checker
- visible-review protocol checker

A5 owns macOS package and owner-visible product artifacts:

- macOS package scripts
- plist and bundle templates
- normal packaged-App proof
- App ZIP
- P6 portable review ZIP
- root manifest
- bundle privacy audit
- visible review mirror

A0 owns global lifecycle and terminal state:

- `docs/loop/CURRENT_MILESTONE.md`
- `docs/loop/LOOP_STATE.md`
- `docs/loop/LOOP_HISTORY.jsonl`
- `AGENTS.md`
- root `package.json`
- terminal handoff inputs
- final Review Packet state
- Worker registry integration fields

Workers must not own broad parent paths that overlap another Worker. Examples:
A3 must not own the whole Web frontend directory or `tools/p6/generate-p6-evidence.mjs`;
A3 and A5 must not both own the whole Electron test tree.

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

## Repair 5 Completion Discipline

At terminal handoff, the registry must record:

- `currentIntegrationHeadCommit` equal to the actual final source HEAD
- all completed Repair 5 Workers either integrated or retired
- integrated Workers with `headCommit`, `integrationCommit`, and
  `workerHandoffFolder`
- no stale `lastVerifiedAt`
- no Repair 5 Worker missing contribution metadata
- `terminalHandoffReady=true` only after required parity failures are zero,
  loop validation passes twice, Reviewer A/B pass, App proof passes, bundle
  checks pass, and visible owner artifacts are regenerated from final HEAD

A0 must not mark P6 terminal from A0-only documentation or handoff commits.

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
