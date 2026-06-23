# P6 Postmortem

Status: historical retrospective snapshot. P6-R1 contract revision 1 is now
frozen for external contract review, and implementation remains not started.

Source branch: `agent/codex/p6-postmortem`

P6 final source head reviewed for this retrospective:
`1977cbce7ffc53d215391468aeb5b20daf816f77`.

## Executive Summary

P6 delivered substantial architecture and tooling progress: shared frontend
work, Electron host integration, stricter parity tools, packaged macOS internal
artifacts, visible review handoff, and multi-worker governance. It did not
reach product acceptance after 6/6 repairs.

The repeated failure pattern was not simply bad screenshots or unreliable
workers. The deeper failure was that P6 combined a large product goal with
evidence architecture, packaging, review protocol, privacy, and multi-worker
governance in one milestone. Work was sliced by technical layer instead of
vertical user workflow, so each worker could pass while complete user journeys
remained unproven.

## Inputs Read

- `docs/loop/CURRENT_MILESTONE.md`
- `docs/loop/LOOP_STATE.md`
- `docs/loop/LOOP_HISTORY.jsonl`
- `docs/retrospectives/P6_REVIEW_SOURCE_AVAILABILITY.md`
- `docs/loop/reviews/P6-external-product-review-1.md`
- `docs/loop/reviews/P6-external-product-review-2.md`
- `docs/loop/reviews/P6-external-product-review-3.md`
- `docs/loop/reviews/P6-external-product-review-4.md`
- `docs/loop/reviews/P6-external-product-review-5.md`
- `docs/retrospectives/P6_R6_EXTERNAL_REVIEW_SUMMARY.md`
- R6 owner-provided external review conclusions from the P6 postmortem repair
  directive.
- Exact Review Packets were located for R3, R4, R5, and R6. R1 and R2 exact
  Review Packets for the reviewed heads were unavailable, so the retrospective
  used external reviews and nearby visible P6 packet context instead.
- `review/P6-1228343/REVIEW_PACKET.md`
- `review/P6-1977cbc/REVIEW_PACKET.md`
- `review/P6-1977cbc/validation.json`
- `review/P6-1977cbc/reviewer-a.json`
- `review/P6-1977cbc/reviewer-b.json`
- `.artifacts/product/P6/p6-parity-report.json`
- `.artifacts/product/P6/desktop-state-render-proof.json`
- `.artifacts/product/P6/interaction-parity-report.json`
- `.artifacts/product/P6/normal-smoke-parity.json`
- `.artifacts/product/P6/packaged-app-runtime-proof.json`
- `.artifacts/product/P6/web-baseline/*`
- `docs/product/p6/P6_MULTI_AGENT_COORDINATION.md`
- `docs/product/p6/P6_WORKER_REGISTRY.json`
- `docs/product/p6/worker-handoffs/*`
- `docs/engineering/MULTI_WORKER_PROTOCOL.md`
- `docs/engineering/AGENT_ROUTING_QUALITY_GOVERNANCE.md` from the previous
  governance branch, because it was created after P6 final head and is not in
  this branch.

## Top Findings

See `P6_FINDING_LEDGER.json` for the structured ledger. The highest-impact
findings are:

1. Parity evidence repeatedly treated artifact existence or generated status as
   product behavior.
2. Loading/Empty and Invalid/Recovery state correctness repeated across rounds.
3. Interaction and motion evidence lacked real before/action/after and
   trigger/state equality.
4. Normal App proof repeatedly used proof/smoke paths before visible normal
   startup became first-class.
5. Reviewer B and Reviewer A were too focused on packet integrity compared with
   product observation.
6. Registry, handoff, and final-head binding drift consumed repeated repair
   budget.
7. Multi-worker technical slicing produced worker PASS without end-to-end
   vertical flow closure.
8. Multi-source acceptance flows existed as controls or panels but were not
   proven end to end for second SVGA, reference media, latest artifact,
   synchronization, and cleanup.

## R1/R2/R3 Subreview Synthesis

### R1 Product/runtime

R1 confirmed that early P6 evidence used different product surfaces and generic
parity. R1 also flagged a current uncertainty: the final owner-test package
material has multiple App ZIP identities and some path/casing ambiguity between
visible review paths and current checkout naming. This is a handoff clarity
risk, not proven runtime failure.

### R2 Evidence/testing

R2 found current R6 machine-gate risks:

- normal-motion evidence can pass with identical Web frames;
- state parity can pass with overly broad aliases or `pixelDifferenceRatio=1`;
- interaction parity can pass even when Web/Desktop mode context differs;
- Reviewer B still overweights packet consistency;
- final loop ledger does not record final current head `1977cbc`.

These findings mean machine PASS should not be read as owner acceptance.
The R6 external review therefore records `TECHNICAL_REVIEW_REQUIRED`, not P6
acceptance.

### R3 Worker/process

R3 found that visible Worktree workers improved coordination, but worker PASS
and milestone PASS were repeatedly conflated. R3 also identified the final-head
ledger gap: current packet/evidence bind to `1977cbc`, while tracked loop state
describes earlier terminal evidence heads.

## Disagreements And Unresolved Questions

| Viewpoint | Evidence | Unresolved question |
| --- | --- | --- |
| Final P6 packet has complete machine evidence. | `review/P6-1977cbc/REVIEW_PACKET.md` and parity report status counts are all pass. | Should machine PASS be trusted while R2 found permissive state/motion/interaction gates? |
| R6 fixed many prior false-pass mechanics. | Mutation tests and strict gates were added in R6. | Are the remaining permissive thresholds acceptable for technical review? |
| App package exists and smoke passed. | `review/P6-1977cbc/MANIFEST.json` and packaged runtime proof. | Which ZIP identity/path should owner treat as the canonical test package? |
| Worker process is now much stronger. | R6 worker handoffs and registry schema. | Should P6-R1 keep A1-A5 or switch to vertical work packages? |

## Root Causes

Detailed tree: `P6_ROOT_CAUSE_TREE.md`.

Top causes:

1. Evidence was initially self-referential and pass-oriented.
2. Work was split by technical layer, not user workflow.
3. Machine and human gates were conflated.
4. Reviewer independence was incomplete.
5. Contract scope exceeded repair-loop capacity.
6. A0 integration checks were too late for cross-worker failures.

## Machine vs Human Gate Reset

Detailed split: `P6_MACHINE_VS_HUMAN_GATES.md`.

Machine must prove state, interaction, motion facts, local security, cleanup,
privacy, and final-head binding. Human review must judge overall visual feel,
motion taste, and actual day-to-day App usability. Machine must not claim
pixel-perfect or product acceptance without an owner-approved method.

## Multi-worker Evaluation

Detailed assessment: `P6_MULTI_WORKER_ASSESSMENT.md`.

Multi-worker execution was useful, but the technical-layer split was the wrong
unit for P6 acceptance. Future product milestones should use visible Worktree
workers only where each worker owns a vertical slice or a clearly separated
evidence role.

## P6-R1 Recommendation

Detailed plan: `P6_R1_RECOVERY_PROPOSAL.md`.

Recommended path: Option B, vertical end-to-end work packages:

1. WP0 Recovery Gate Bootstrap.
2. WP1 State Correctness.
3. WP2 Multi-source Acceptance Flow.
4. WP3 Interaction Evidence.
5. WP4 Visual And Motion Review.
6. WP5 macOS App Delivery.

Finding ownership is unique: `P6-F013` is the primary finding for WP2, while
other work packages may only reference it as supporting evidence.

The correct order is:

1. Owner reviews and approves the postmortem and recovery proposal.
2. A P6-R1 contract is created and frozen.
3. P6-R1 starts with WP0 Recovery Gate Bootstrap.
4. WP0 must pass before WP1 begins.

## Minimal Future Process Rules

Proposed only; do not persist into `AGENTS.md` until owner approves this
retrospective:

1. Same finding appears two rounds: mandatory root-cause review.
2. Same finding appears three rounds: pause implementation and run
   retrospective.
3. Repair budget exhausted: postmortem before successor repair milestone.
4. External review updates Finding Ledger every round.
5. New repair contract must include root-cause hypothesis, why prior fix
   failed, failing test, success stop condition, and failure stop condition.
6. Required machine gate failure means no owner-acceptance Human Gate.
7. One Lead Implementation Owner per vertical package.
8. Implementer, Evidence Owner, and Integration Verifier must be separated.

These rules should be persisted only after owner approval of this repaired
postmortem.

## Final Position

- P6 productOutcome: `NOT_ACCEPTED`
- P6 engineeringOutcome: `REPAIR_BUDGET_EXHAUSTED`
- P6 nextAction:
  `OWNER_REVIEW_OF_POSTMORTEM_AND_P6_R1_RECOVERY_PLAN`

R6 external review already determined the current risk is unacceptable for P6
PASS. P6-R1 must not begin from the old A1-A5 technical-layer plan, and it must
not begin before owner approval and a frozen P6-R1 contract.
