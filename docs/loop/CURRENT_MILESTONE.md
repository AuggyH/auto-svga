# NQ1: Overnight Reliability, Compatibility And Evidence Hardening

Milestone ID: NQ1
Title: Overnight Reliability, Compatibility And Evidence Hardening
Status: frozen
milestoneStartCommit: `fc5e953f6f96a4eb49776af6c5166bd2c2c4f4c4`
Branch: `agent/codex/nq1-overnight-hardening`
Previous milestone: `docs/loop/milestones/P4-multi-resource-editing-undo-redo-export-integrity.md`
Previous final review: `docs/loop/reviews/P4-final-internal-review.md`
P4 final machine HEAD: `fc5e953f6f96a4eb49776af6c5166bd2c2c4f4c4`

maxRepairRounds: 6
maxConsecutiveNoProgressRounds: 2

## Objective

Complete engineering hardening for the existing Auto SVGA P1-P4 work without
accepting P4 product results, starting P5, adding product scope, or using real
user assets. The milestone improves deterministic fixtures, editor regressions,
async safety, round-trip evidence, path safety, cleanup, performance baseline,
accessibility semantics, flake repeatability, and developer handoff material.

## Product Boundary

NQ1 is an engineering reliability milestone. It does not change the accepted
product direction. It does not imply P4 product acceptance. P4 remains a
separate human product review gate.

## Allowed Changes

1. Synthetic fixtures and ignored generated evidence.
2. Deterministic tests and local helper scripts.
3. Reliability, safety, cleanup, performance, accessibility, and flake reports.
4. Documentation for editor validation, troubleshooting, and supported editing
   boundaries.
5. Loop state, history, final report, review packet, visible review folder, and
   upload packaging.

## Prohibited Scope

1. P5 product functionality.
2. Text, timeline, transform, crop, resize, effect, conversion, export
   workbench, auto-fix, cloud, account, telemetry, or AI features.
3. New third-party dependencies, public network, credentials, production
   services, push, merge, release, publish, deploy, or irreversible operations.
4. Real user SVGA, PNG, screenshots, recordings, or labels in Git.
5. Changes to existing SVGA exporter semantics, CLI default flow, browser
   import, drag-drop, comparison, or product direction.

## Acceptance Criteria

- `NQ1-AC-01`: Baseline and Resumable Queue - NQ1 queue, state, history, blocker log, final report placeholder, and resume instructions exist and initial loop validation passes on a clean source workspace.
- `NQ1-AC-02`: Synthetic Fixture Matrix - Approved synthetic SVGA fixtures cover resource counts 1, 2, 3, 5, 10, 25 plus one unsupported unknown-field boundary without real user assets.
- `NQ1-AC-03`: Model-driven Edit History - Deterministic model tests cover undo, redo, reset, save-point, invalid input, failed preview, open-new-file, and history-cap behavior.
- `NQ1-AC-04`: Async Race and Failure Injection - Synthetic race tests prove stale success, stale failure, latest failure rollback, file switch, reset, and save rejection do not overwrite newer valid state.
- `NQ1-AC-05`: Multi-resource Round-trip Matrix - Synthetic round-trip matrix validates P3 single-resource and P4 multi-resource replacement invariants across supported fixtures and keeps unsupported fixtures fail-closed.
- `NQ1-AC-06`: Save As Safety - Cross-platform path and Save As checks cover source identity, same-source rejection, sibling target allowance, IPC boundary, log redaction, and deferred Windows case-variant risk.
- `NQ1-AC-07`: Cleanup Stress - Cleanup validation covers runtime, server, player, parser, session, object URL, and repeated lifecycle cleanup without active resource leaks.
- `NQ1-AC-08`: Performance Baseline - Bounded local performance baseline records deterministic hardening primitive timings with a broad hang guard and no formal cross-machine benchmark claim.
- `NQ1-AC-09`: Accessibility and Error Semantics - Source-level audit covers keyboard, labels, focus, disabled states, error details, retry behavior, and retains manual-review advisories for axe and screen-reader coverage.
- `NQ1-AC-10`: Flake Stability and Developer Docs - Repeat stability runs core targeted tests 5 times, Electron smoke 3 times, round-trip subset 3 times, and commits editor test matrix, troubleshooting, and supported editable SVGA boundary docs.
- `NQ1-AC-11`: Terminal Handoff - Final loop validation passes on the terminal NQ1 HEAD, Review Packet generation succeeds, a visible review folder and upload ZIP are produced, and the source workspace is clean.

## Required Validation Before Terminal State

1. All ten NQ1 work packages are complete, partial, or blocked with evidence.
2. Every three completed work packages have a recorded `npm run loop:validate`
   checkpoint.
3. `npm run nq1:flake-stability` passes.
4. `npm test` passes with the NQ1 tests included.
5. Final `npm run loop:validate` passes on terminal NQ1 HEAD.
6. Review Packet and visible review upload package are generated.
7. Source workspace is clean.
8. Final response is exactly `.artifacts/loop-handoff/latest/FINAL_RESPONSE.txt`.

## Remaining Manual Gaps

- P4 product visual acceptance remains human-owned.
- Pixel-perfect visual parity and screen-reader output remain manual review.
- Real Windows runtime path behavior remains deferred.
- Long-running renderer memory pressure remains outside the bounded NQ1 checks.

## Recommended Next Milestone

After external review of NQ1, either proceed to the next approved product
milestone or repair any review packet / validation blocker first. Do not infer
P4 product acceptance from NQ1 PASS.
