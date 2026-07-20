# NQ1: Overnight Reliability, Compatibility And Evidence Hardening

Milestone ID: NQ1
Title: Overnight Reliability, Compatibility And Evidence Hardening
Status: terminal_pass_external_review_repair_required
milestoneStartCommit: `fc5e953f6f96a4eb49776af6c5166bd2c2c4f4c4`
terminalCommit: `c745f1a67880bc5aabc2bc74265cdbf00cfac2ff`
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

## Terminal Result

NQ1 reached terminal PASS source state at
`c745f1a67880bc5aabc2bc74265cdbf00cfac2ff`, but external review later
classified the sealed packet as `REPAIR_REQUIRED`.

NQ1-R1 is the repair milestone for the external findings. NQ1 history and
source commits must be preserved.

## Remaining External Findings

See `docs/loop/reviews/NQ1-external-review.md`.
