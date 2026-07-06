# Project Baseline Retrospective

Date: 2026-07-06
Status: expanded first retrospective
Scope: Auto SVGA inception through current head on
`agent/codex/svga-workbench-v1-autonomous`

## Why This Exists

The first weekly retrospective in `docs/retrospectives/weekly/2026-W28.md`
focused mainly on recent UI/UX and project-governance work. That was useful
but too narrow for a first project baseline.

This document expands the first retrospective back to the beginning of the
project so future work can avoid rediscovering the same lessons.

## Coverage

This pass reviewed:

- current Git status and current branch
- current history from 2026-06-02 through 2026-07-06
- `docs/` inventory
- `docs/reviews/` inventory and full-history pattern counts
- `docs/loop/LOOP_HISTORY.jsonl`
- `docs/loop/reviews/*.md`
- `docs/retrospectives/*.md`
- `docs/overnight/*.md`
- `docs/product/*.md`
- `docs/research/*.md`
- `docs/decisions/*.md`
- core project docs such as `PROJECT_CONTEXT`, `ROADMAP`, `CURRENT_STATUS`,
  `CHANGELOG`, `TECH_SPEC`, `TOKEN_BUDGET_RULES`, and local Codex skills

This was not a literal line-by-line reading of every artifact file and every
historical review packet. It was a broad repository scan plus targeted reading
of stage authority, stage summaries, external review outcomes, postmortems,
research notes, and high-value recurring review patterns.

## Quantitative Snapshot

| Metric | Count |
| --- | ---: |
| Files under `docs/` | 611 |
| Files under `docs/reviews/` | 391 |
| Files under `docs/product/` | 73 |
| Files under `docs/loop/` | 57 |
| Files under `docs/retrospectives/` | 19 |
| Current-history commits scanned | 930 |
| `docs/loop/LOOP_HISTORY.jsonl` entries | 169 |

Review files by date:

| Date | Count |
| --- | ---: |
| 2026-06-07 | 9 |
| 2026-06-13 | 23 |
| 2026-06-18 | 1 |
| 2026-06-19 | 31 |
| 2026-06-20 | 2 |
| 2026-06-22 | 6 |
| 2026-06-23 | 1 |
| 2026-06-28 | 1 |
| 2026-06-29 | 2 |
| 2026-06-30 | 8 |
| 2026-07-01 | 7 |
| 2026-07-02 | 107 |
| 2026-07-03 | 48 |
| 2026-07-04 | 101 |
| 2026-07-05 | 24 |
| 2026-07-06 | 20 |

Full-history review pattern counts:

| Pattern | Review files |
| --- | ---: |
| Validation/test language | 384 |
| Protected / unchanged / not touched language | 225 |
| Foreground evidence language | 161 |
| Candidate / deferred / future language | 154 |
| Token or cost language | 99 |
| Not accepted / not release / HUMAN_REQUIRED / REPAIR_REQUIRED language | 89 |
| Smoke-regression boundary language | 84 |
| Product-scope-unchanged language | 69 |
| Save / reopen / round-trip proof language | 69 |
| Dirty-state language | 61 |
| Review package / handoff language | 47 |

Current-history commit phases:

| Phase | Date range | Commits | Pattern |
| --- | --- | ---: | --- |
| MVP / Web Preview | 2026-06-02..2026-06-12 | 55 | avatar-frame pipeline, Web Preview, repo hygiene, early UI recovery |
| P1/P2 inspection architecture | 2026-06-13..2026-06-18 | 55 | workbench contracts, SVGA adapter, spec checks, skills |
| Motion audit / desktop spike | 2026-06-19 | 73 | audit primitives, recommendation boundaries, Electron feasibility |
| Loop P1-P5 / P6 prep | 2026-06-20..2026-06-30 | 417 | milestones, external reviews, evidence, packaging, repair loops |
| PM/UI reset and short-term | 2026-07-01..2026-07-04 | 285 | PRD authority, short-term scope, UI/UX split, foreground gates |
| Short-term UI/UX + mid-term debug | 2026-07-05..2026-07-06 | 45 | high-fidelity UI polish and mid-term debug integration |

## Stage Narrative

### 1. Avatar-frame MVP

The project began as a focused avatar-frame CLI/export pipeline. The most
valuable decisions from this phase are still valid:

- `project.json` is the source of truth for preview/export behavior.
- Template semantics expand into concrete layers before export.
- Preview and exporter must share coordinate, anchor, easing, and interpolation
  semantics.
- `exporterReady` and real `.svga` export success are different states.
- Inflate/decode proves binary parseability, not visual success.

Useful documents:

- `docs/PROJECT_CONTEXT.md`
- `docs/TECH_SPEC.md`
- `docs/exporter-contract.md`
- `docs/motion-system-research-notes.md`
- `docs/decisions/ADR-001-avatar-frame-mvp-scope.md`
- `docs/CHANGELOG.md`

Project lesson: the narrow MVP moved because the source of truth and output
contracts were clear. Later slowdowns correlate with broader surfaces and less
vertical ownership.

### 2. Web Preview Rebuild And UI Recovery

The Web Preview work created valuable rollback and validation lineage. It also
shows an early version of the current pattern: UI polish can balloon when it is
not tied to a finite acceptance bundle.

Useful documents:

- `docs/CURRENT_STATUS.md`
- `docs/ROADMAP.md`
- early `docs/reviews/2026-06-07-*.md`

Project lesson: UI changes need a defined visual acceptance target. Otherwise
many small layout and interaction fixes can be individually valid while still
leaving the product "not done."

### 3. P1/P2 Inspection Architecture

This is one of the highest-return periods. It added workbench contracts, SVGA
adapter boundaries, specification checks, inspection reports, production spec
presets, resource dimensions, and project-specific skills.

Why it worked:

- It built reusable primitives instead of one-off UI logic.
- It preserved existing exporter, CLI, playback, and Web preview flows.
- It kept non-SVGA formats as capability knowledge, not production support.

Useful documents:

- `docs/multiformat-workbench-architecture.md`
- `docs/product/auto-svga-product-principles.md`
- `docs/product/auto-svga-backlog.md`
- `docs/decisions/ADR-003-multiformat-workbench-boundaries.md`
- `docs/codex-skill-usage.md`
- `docs/TOKEN_BUDGET_RULES.md`

Project lesson: inspection primitives are the best acceleration layer. They
reduce repeated reasoning in UI, product docs, validation, optimization, and
future format work.

### 4. Motion Asset Audit, Recommendation, And Desktop Spikes

June 19 produced many architecture and evidence-boundary docs. The lasting
value is capability separation:

- capability facts are not implementation maturity;
- implementation maturity is not production support;
- Electron/internal prototype feasibility is not production desktop approval;
- advisory audit opportunities are not automatic repair or optimization.

Useful documents:

- `docs/format-capability-evidence-review-workflow.md`
- `docs/desktop-shell-feasibility.md`
- `docs/electron-desktop-spike.md`
- `docs/electron-prototype.md`
- `docs/player-csp-compatibility-decision.md`
- `docs/reviews/2026-06-19-*.md`

Project lesson: the repository has already solved many support-boundary
questions. Future agents should reuse these docs instead of reopening the same
debates.

### 5. Loop P1-P4 And NQ1

P1-P4 accepted bounded capabilities when each milestone had a clear scope:

- P1 accepted internal functional desktop baseline, not final visual UI.
- P2 accepted desktop product shell and Web parity baseline.
- P3 accepted single-resource vertical editing, not arbitrary SVGA editing.
- P4 accepted bounded multi-resource editing in an isolated prototype.
- NQ1/NQ1-R1 hardened deterministic schedules, round-trip, history, lifecycle,
  performance, accessibility, and privacy evidence.

Useful documents:

- `docs/loop/reviews/P1-final-external-review.md`
- `docs/loop/reviews/P2-final-external-review.md`
- `docs/loop/reviews/P3-final-external-review.md`
- `docs/loop/reviews/P4-final-external-review.md`
- `docs/overnight/NQ1_FINAL_REPORT.md`
- `docs/overnight/NQ1_R1_FINAL_REPORT.md`

Project lesson: acceptance was fastest when the milestone stated what it did
not approve. Non-approval clauses prevented scope creep.

### 6. P5 Reset

P5 is one of the most important product-management moments. It was not failed;
it was deliberately deferred as editor incubation because the product mainline
needed to desktopize the mature Web Preview first.

Useful documents:

- `docs/loop/reviews/P5-owner-roadmap-reset.md`
- `docs/product/EDITOR_INCUBATION_STATUS.md`
- `docs/product/SUPPORTED_EDITABLE_SVGA_BOUNDARY.md`

Project lesson: technically valuable work can still be the wrong mainline. The
project moved faster when the Product Owner reset priority instead of forcing
generic editing into the default desktop product.

### 7. P6 And P6-R1

P6 generated the clearest anti-patterns:

- work split by technical layer instead of user flow;
- evidence proved artifacts before behavior;
- worker PASS was confused with milestone PASS;
- protocol, packaging, review, privacy, and product runtime competed for the
  same repair budget;
- final-head binding and review packet hygiene consumed large effort;
- machine and human gates blurred.

Useful documents:

- `docs/retrospectives/P6_POSTMORTEM.md`
- `docs/retrospectives/P6_ROOT_CAUSE_TREE.md`
- `docs/retrospectives/P6_MULTI_WORKER_ASSESSMENT.md`
- `docs/retrospectives/P6_REPAIR_ROUND_MATRIX.md`
- `docs/engineering/REPAIR_HEALTH_PROTOCOL.md`
- `docs/engineering/MULTI_WORKER_PROTOCOL.md`
- `docs/engineering/REVIEW_PACKET_VISIBILITY_PROTOCOL.md`
- `docs/autonomous/LESSONS_CANDIDATES.md`

Project lesson: every large milestone needs vertical user-flow ownership,
failure-first evidence, and a hard distinction between product behavior,
machine proof, package readiness, and owner acceptance.

### 8. PM Documentation Reset

The PM reset clarified that `PRODUCT_ROADMAP.md` is the single project-level
PRD authority, with subordinate docs only adding execution detail.

Useful documents:

- `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/auto-svga-product-principles.md`

Project lesson: a good document system accelerates only when agents route
through it instead of creating parallel plans. New docs should replace a
recurring decision gap, not become another place to search.

### 9. Short-term UI/UX Reset

The short-term app was corrected into a canvas-first macOS design with S1-S16
scope. The UI/UX lane then correctly moved away from old Web Preview and old
Electron visual baselines. However, review and commit volume spiked.

Useful documents:

- `DESIGN.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
- `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`
- `docs/product/SHORT_TERM_UI_UX_LOW_FIDELITY_IA.md`
- `docs/product/SVGA_WORKBENCH_HIG_AUDIT_GUIDE.md`

Project lesson: design-system decomposition is valuable, but adjacent
visual-only changes should be bundled by surface. Otherwise each small polish
change repeats smoke, foreground, review, and handoff cost.

### 10. Mid-term And AEB

Mid-term and AEB are now both important, but they serve different users:

- mid-term template editing builds reusable local foundations and future
  machine-callable motion abstraction;
- AEB serves current human designers and production workflow, and has higher
  near-term priority than AI/ComfyUI.

Useful documents:

- `docs/product/MID_TERM_IMPLEMENTATION_PREP.md`
- `docs/product/AE_BRIDGE_PRODUCT_BRIEF.md`
- `docs/research/vap-official-repository-research.md`
- `docs/research/figma-svga-editor-competitor-research.md`

Project lesson: mid-term work should continue only where it does not block AEB
or where it provides reusable parsing, transform, compile, preview, history,
budget, or validation foundations.

## Cross-project Slowdown Causes

### 1. Review Volume Became A Cost Center

The repository has strong review discipline, but every review has fixed cost.
Full-history review language shows large repetition around validation, protected
flows, foreground evidence, scope preservation, deferred status, and token cost.

Use reviews for durable changes and meaningful checkpoints. For tiny adjacent
visual changes, prefer grouped review bundles with one shared evidence path.

### 2. Acceptance Terms Were Too Easy To Blur

The project repeatedly needed to separate:

- implemented
- validated
- evidence-ready
- review package generated
- Product Owner accepted
- D0 internal package available
- D1/D2 trusted distribution
- released

Any future status report should use those exact bands. Do not use "ready" as a
standalone word.

### 3. Evidence Sometimes Proved The Toolchain Instead Of The Product

P6 shows that artifact existence, packet completeness, screenshots, or generic
PASS can coexist with missing user-visible behavior. Evidence should be
failure-first and user-flow-bound.

### 4. Technical-layer Parallelism Created Integration Debt

Parallel workers helped traceability, but technical-layer ownership produced
late cross-layer failures. Use vertical work packages for product closure.

### 5. Historical Docs Are Valuable But Heavy

The repository contains many high-value historical docs. Loading all of them
for ordinary tasks is wasteful. The right pattern is:

1. active authority docs;
2. relevant lane doc;
3. project experience guide;
4. one or two historical retrospectives only when the task matches their
   failure pattern.

### 6. UI/UX Work Needs Bundle-level Closure

UI/UX work has strong local discipline, but high polish volume without a shared
acceptance bundle can feel slow. The next acceleration should come from
bundled foreground validation and a short "stop polishing / start packaging"
trigger.

### 7. Product Resets Worked Better Than Incremental Drift

The P5 reset, short-term PRD correction, UI/UX canvas reset, and AEB priority
promotion all improved direction. The lesson is not to avoid correction; it is
to make corrections quickly, write them into the authority doc, and stop old
lanes from leaking into the product surface.

## Recommended Default Execution Path

For any future task, start with:

1. Classify lane: PM, UI/UX, short-term implementation, mid-term, AEB,
   release, research, or retrospective.
2. Read the minimum active pack:
   - `AGENTS.md`
   - `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
   - `docs/product/PRODUCT_ROADMAP.md`
   - lane-specific doc
   - `docs/retrospectives/PROJECT_EXPERIENCE_GUIDE.md`
3. Declare validation tier before running tests.
4. Decide whether the work is an isolated high-risk change or part of a bundle.
5. For product behavior, define one vertical user flow and its evidence path.
6. Update only the nearest source of truth.
7. Record task retrospective only after meaningful work.

## Documents To Prefer By Task

| Task type | Prefer these docs first |
| --- | --- |
| Product scope / roadmap | `PRODUCT_DOCUMENTATION_SYSTEM.md`, `PRODUCT_ROADMAP.md`, `auto-svga-product-principles.md` |
| Short-term implementation | `PRODUCT_ROADMAP.md`, `SUPPORTED_EDITABLE_SVGA_BOUNDARY.md`, relevant short-term review/evidence |
| UI/UX | `DESIGN.md`, short-term UI/UX brief, execution plan, design-system spec, low-fidelity IA, HIG guide |
| Mid-term | `PRODUCT_ROADMAP.md`, `MID_TERM_IMPLEMENTATION_PREP.md`, relevant debug/integration review |
| AEB | `PRODUCT_ROADMAP.md`, `AE_BRIDGE_PRODUCT_BRIEF.md`, AEB discovery/review docs |
| Format research | `multiformat-workbench-architecture.md`, relevant research doc, format capability workflow |
| Export / save / parser | `TECH_SPEC.md`, `exporter-contract.md`, `SUPPORTED_EDITABLE_SVGA_BOUNDARY.md`, NQ1 reports |
| Large milestone / multi-worker | P6 postmortem, root-cause tree, multi-worker assessment, repair matrix, repair health protocol |
| Release / package | `SHORT_TERM_DISTRIBUTION_PREP.md`, review packet visibility protocol, NQ1/NQ1-R1 reports |

## Actions To Reduce Repeated Cost

1. Add a "bundle or isolate?" decision to UI/UX and implementation task
   starts.
2. Maintain one foreground-validation checklist for each UI/UX bundle.
3. Create review packages only at meaningful checkpoints.
4. Use P6 retrospectives as a preflight checklist for any multi-worker or
   acceptance-heavy milestone.
5. Prefer current PRD and lane docs over old roadmap/status snapshots.
6. Keep historical docs marked historical; do not refresh every old doc after
   every product correction.
7. Keep exact token accounting truthful but subordinate to value and rework
   reduction.

## Standing Conclusion

Auto SVGA has already produced a lot of reusable infrastructure and good
governance. The next speed gain will not come from more process. It will come
from using the existing process more selectively:

- fewer tiny review cycles;
- fewer repeated disclaimers;
- fewer broad context reloads;
- more vertical flow closure;
- clearer bundle-level acceptance;
- stronger distinction between evidence, acceptance, and release.
