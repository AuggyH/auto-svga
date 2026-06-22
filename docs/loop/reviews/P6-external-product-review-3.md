# P6 External Product Review 3

Date: 2026-06-22

externalOutcome: `REPAIR_REQUIRED`

reviewedHeadCommit: `92c36b4af1dae15d226ab3848115a5e9537779d7`

productOutcome: `LOCAL_PREVIEW_VISUAL_DIRECTION_ACCEPTED_BUT_FULL_PARITY_NOT_PROVEN`

currentRepairRound: `3`

nextRepairRound: `4`

## Rejected Repair 3 Terminal Evidence

The following Repair 3 terminal artifacts are historical only and must not be
used as Repair 4 terminal proof:

- `review/P6-92c36b4/REVIEW_PACKET.md`
- `candidateDigest`
- `reviewer-a.json`
- `reviewer-b.json`
- `p6-parity-report.json`
- `desktop-state-render-proof.json`
- packaged normal proof
- desktop screenshots
- sealed Packet
- Review ZIP
- App proof

Status: `REJECTED_BY_EXTERNAL_REVIEW`

## Blocking Findings

1. `makeSection()` in the parity generator directly writes `status=pass`.
2. `evidenceForItems()` directly writes `status=pass`.
3. Each item is associated with generic artifacts by keyword rather than
   verified by item-specific runtime checks.
4. Desktop export review, second SVGA, reference media, logs, settings, and
   asset details lack corresponding product evidence.
5. Web/Desktop matching state comparisons are missing.
6. Required motion evidence is not collected on both Web and Desktop.
7. Loading evidence behaves like Empty rather than a real loading state.
8. Invalid state retains old metadata and ready status.
9. State proof can contain failed fields while still reporting `passed=true`.
10. Electron latest-artifact adapter returns fixed empty results.
11. Web and Electron do not prove byte-identical shared Product Shell usage.
12. Normal App proof uses a proof environment and records `windowShown=false`.
13. Committed-range `git diff --check` fails.
14. Reviewer A/B output is not an independent product review.
15. Worker Registry is stale and Repair 3 did not include real Worker product
    contributions.
16. The handoff did not provide a newly valid actual macOS App ZIP for the
    reviewed product state.

## Repair 4 Direction

Repair 4 must replace synthetic and generic PASS evidence with actual runtime
Web/Desktop/App product evidence. The milestone remains P6, terminal state must
remain `HUMAN_REQUIRED`, and Phase 2 remains `NOT_STARTED`.
