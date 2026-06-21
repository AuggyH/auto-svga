# P5 Final Internal Review

Milestone: P5 — Batch PNG Replacement And Mapping Review
Reviewed implementation commit: `78074eb55f2a796f99394c542ed723f06628ffcd`
Outcome: HUMAN_REQUIRED

## Summary

P5 Repair 1 closes the external product evidence blockers by replacing
deterministic state-marker PNGs with rendered Electron UI screenshots and live
runtime proof. The implementation keeps P5 scoped to batch PNG replacement and
stops for owner acceptance.

## Changed Files

- `package.json`
- `tools/p5/generate-reports.mjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/package.json`
- `tools/electron-prototype/experiments/svga-web/preload.cjs`
- `tools/electron-prototype/experiments/svga-web/scripts/prepare-p5-runtime.mjs`
- `tools/electron-prototype/experiments/svga-web/web/prototype.js`
- `docs/loop/LOOP_STATE.md`
- `docs/loop/LOOP_HISTORY.jsonl`
- `docs/loop/reviews/P5-external-product-review-1.md`
- `docs/loop/reviews/P5-final-internal-review.md`

## Requirement Checks

- P5 live Electron product path: PASS.
- Multi-PNG selection through real product DOM/API: PASS.
- Exact / normalized / unmatched / ambiguous / duplicate / excluded / invalid
  mapping evidence: PASS.
- Manual mapping resolution: PASS.
- Atomic batch apply with 4 replacements: PASS.
- Playback and nonblank canvas evidence: PASS.
- Undo and redo full batch transaction: PASS.
- Save As and reopened export: PASS.
- Original source immutability: PASS.
- Product screenshots are rendered Electron captures: PASS.
- Reviewer B product category schema upgraded to v2 with screenshot hashes:
  PASS for evidence indexing; final visual verdict remains external.
- Scope discipline: PASS; no P6, no new parser, no format conversion, no
  exporter change, no AI/network service.

## Validation

- `npm run p5:reports`: PASS.
- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`: PASS.
- `node --check tools/electron-prototype/experiments/svga-web/preload.cjs`: PASS.
- `node --check tools/electron-prototype/experiments/svga-web/web/prototype.js`: PASS.
- `node --check tools/electron-prototype/experiments/svga-web/scripts/prepare-p5-runtime.mjs`: PASS.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`: PASS, 15 tests.
- `npm test`: PASS, 200 tests.
- `node tools/loop-budget-check.mjs`: PASS, repairRound 1 within budget.
- `git diff --check`: PASS.

## Product Evidence

Generated under `.artifacts/product/P5`:

- `p5-live-runtime-proof.json`: `passed=true`, `externalRequests=[]`.
- `batch-round-trip-report.json`: schemaVersion 4, `passed=true`,
  `playbackPassed=true`, `canvasNonBlank=true`, `appliedMappingCount=4`,
  `replacementCount=4`.
- `batch-edit-history-report.json`: `passed=true`.
- `thumbnail-evidence.json`: `passed=true`.
- `reviewer-b-product-categories.json`: schemaVersion 2, 18 categories.
- `batch-edited-output.svga`: edited synthetic SVGA output.
- 15 required rendered Electron UI screenshots:
  `batch-entry.png`, `batch-files-selected.png`,
  `mapping-exact-matches.png`, `mapping-unmatched-conflict.png`,
  `mapping-manual-resolution.png`, `mapping-ready-to-apply.png`,
  `batch-preview.png`, `batch-dirty-state.png`, `batch-undo.png`,
  `batch-redo.png`, `batch-export-success.png`,
  `batch-reopened-export.png`, `corrupt-png-state.png`,
  `dimension-warning.png`, and `batch-original-edited-comparison.png`.

## Regression

Not touched:

- SVGA exporter.
- Main Web preview player implementation.
- CLI default flow.
- Browser import / drag-drop / comparison flow.
- Format parser scope beyond existing SVGA image edit path.

## Risks

- P5 remains HUMAN_REQUIRED: owner visual/product acceptance is still required.
- Reviewer B product categories are evidence-indexed and schemaVersion 2, but
  external visual verdicts must still be supplied by the owner/reviewer.
- Electron remains an internal prototype path; production desktop security is
  not approved by this milestone.

## Next

Ask owner whether to accept P5 or identify the single highest-priority product
issue to repair. Do not start P6 before owner acceptance.
