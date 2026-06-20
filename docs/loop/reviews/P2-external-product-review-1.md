# P2 External Product Review 1

externalOutcome: REPAIR_REQUIRED

reviewedHeadCommit: `d17eee245f6db72ffcbe3aaa8069051f28dee889`

engineeringOutcome: PASS

productVisualOutcome: REPAIR_REQUIRED

## Blocking Findings

1. Desktop only showed broad dark-theme similarity and did not sufficiently reuse the Web preview brand bar, panel headers, player controls, state components, and information architecture.
2. Desktop grid made the inspection area wider than the player, so the player was not the primary visual center.
3. The internal prototype warning remained a high-contrast first visual signal instead of low-weight supporting status.
4. Inspection remained dominated by long mixed-language engineering text; collapsing Calibration alone was not enough.
5. Empty state left the right Inspector as a large blank region without a complete product empty-state expression.
6. `web-reference-inspection.png` did not actually show the Web inspection/report UI.
7. `web-desktop-loaded-comparison.png` compared mismatched states and media: Web unloaded exported SVGA plus reference MP4 versus Desktop loaded synthetic SVGA.
8. `web-desktop-inspection-comparison.png` did not compare the same inspection state.
9. `build-p2-parity-report.mjs` wrote category results as pass directly, so the parity report was not trusted verification.
10. Normal runtime proof was mislabeled: actual command/query used proof mode, while the report claimed canonical `npm run desktop:dev`.
11. The user-facing upload set omitted required P2 evidence files, so external product review could not inspect all frozen artifacts.
12. Reviewer B reported artifact coherence but did not provide enough category-level visual judgment for product identity, player workspace, inspection, and related categories.

## Product Direction

- Electron should visibly converge with the existing Web preview product system.
- Pixel-perfect copying is not required.
- Current Desktop UI is not accepted.
- P2 must be repaired before P3 basic editing can begin.
