# P5 External Product Review 1

Milestone: P5 — Batch PNG Replacement And Mapping Review
External outcome: REPAIR_REQUIRED
Reviewed head commit: `21ce7ba92434b684f7cb8c8806e00c450b0ab739`
Repair branch: `agent/codex/p5-r1-live-batch-evidence`
Repair implementation commit: `78074eb55f2a796f99394c542ed723f06628ffcd`

## Functional Outcome

CORE_MAPPING_IMPLEMENTED_BUT_PRODUCT_EVIDENCE_INCOMPLETE

## Blocking Findings

1. The 15 P5 PNG artifacts were deterministic state markers, not real Electron
   UI screenshots.
2. Marker images contained solid-color state cues and did not show product UI,
   mapping lists, controls, animation, or error states.
3. `batch-round-trip-report.json` recorded `passed: false`,
   `playbackPassed: false`, and `canvasNonBlank: false`.
4. `unexpectedChanges` contained `p5_playback_smoke` and
   `p5_canvas_nonblank`.
5. P5-AC-12 was marked PASS despite failed playback/canvas evidence.
6. `reviewer-b-product-categories.json` used schemaVersion 1 and lacked
   independent visual observations, screenshot hashes, and category verdicts.
7. Generic Reviewer B returned PASS without actual reviewable product UI
   screenshots.
8. Product bundle status still said `candidate_review_pending` /
   `includesFinalHandoff: false`, conflicting with sealed HUMAN_REQUIRED
   handoff language.
9. The packet did not prove live Electron multi-file import, exact/normalized
   mapping, unmatched/conflict handling, manual resolution, atomic apply, 3+
   replacement preview, undo/redo, Save As, or reopened export.

## Repair Result

Repair 1 replaces marker-based P5 evidence with a live Electron product smoke:

- 7 synthetic PNG inputs selected through the product batch path.
- Deterministic mapping covers exact, normalized, unmatched, ambiguous,
  duplicate target, excluded, corrupt PNG, manual resolution, and dimension
  warning states.
- Atomic batch apply replaces 4 resources in one transaction.
- Real player remount produces playback and nonblank canvas evidence.
- One undo reverts the full batch and one redo restores it.
- Save As writes `batch-edited-output.svga` and reopened playback/nonblank
  evidence passes.
- Product screenshots are rendered Electron UI captures.
- Final P5 status remains HUMAN_REQUIRED for owner acceptance.

## Validation Evidence

- `npm run p5:reports`: PASS.
- `p5-live-runtime-proof.json`: `passed=true`, `externalRequests=[]`.
- `batch-round-trip-report.json`: schemaVersion 4, `passed=true`,
  `playbackPassed=true`, `canvasNonBlank=true`, `appliedMappingCount=4`,
  `replacementCount=4`.
- `batch-edit-history-report.json`: `passed=true`.
- `thumbnail-evidence.json`: `passed=true`.
- `reviewer-b-product-categories.json`: schemaVersion 2, 18 categories,
  pending independent external review.

## Remaining Human Gate

P5 remains HUMAN_REQUIRED by contract. Owner acceptance is still required before
planning any P6 or next editing capability.
