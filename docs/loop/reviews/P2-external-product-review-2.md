# P2 External Product Review 2

externalOutcome: REPAIR_REQUIRED

reviewedHeadCommit: `9833a6eb4616ed306aab1cd90676d2ada5ee708f`

engineeringOutcome: PASS_WITH_EVIDENCE_DEFECTS

productVisualOutcome: REPAIR_REQUIRED

## Blocking Findings

1. `web-reference-capture.cjs` mixed valid and invalid phase console errors, so the expected `broken.svga` error was counted against valid playback.
2. `web-reference-runtime-proof.json` contradicted itself by recording loaded status and inspection evidence while marking playback failed.
3. Web and Desktop comparison evidence used different fixture bytes but titles claimed the same synthetic fixture.
4. `capture-p2-web-reference.mjs` used implicit preferred-candidate fallback, so final Web fixture selection was unstable.
5. Reviewer B lacked the required category-level product review JSON and returned a generic PASS while parity still failed.
6. Final upload ZIP lacked `reviewer-b-product-categories.json`.
7. Desktop empty state lacked the Web-style central drag/drop and file-selection affordance.
8. Desktop inspection still surfaced raw audit localization keys in the main UI.

## Required Repair

- Enter P2 repair-3.
- Freeze one canonical approved fixture for Web, Desktop, normal, smoke, and comparison evidence.
- Isolate Web valid and invalid capture phases.
- Generate truthful same-fixture comparison metadata.
- Productize Desktop empty, loading, invalid, and inspection presentation states.
- Add category-level Reviewer B evidence to the final upload ZIP.
