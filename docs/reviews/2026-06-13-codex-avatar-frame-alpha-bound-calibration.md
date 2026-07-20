# Review: Avatar-frame Alpha-bound Calibration

## Summary

- Mainline: P2 design specification checks.
- Added a reproducible offline alpha-bound calibration script.
- Measured four unique repository SVGA samples and 140 embedded image resources.
- Kept the provisional 50% threshold unchanged because only two samples use the
  current `300 x 300` production canvas.

## Git State

- Branch: `agent/codex/avatar-frame-alpha-bound-calibration`
- Commit: this delivery commit
- Base prerequisite: `23d8b4a` fast-png host alpha analyzer

## Changed Files

- `src/hosts/avatar-frame-inspection.ts`
- `scripts/calibrate-avatar-frame-alpha-bounds.mjs`
- `scripts/calibrate-avatar-frame-alpha-bounds.test.mjs`
- `docs/avatar-frame-alpha-bound-calibration.md`
- `docs/reviews/2026-06-13-codex-avatar-frame-alpha-bound-calibration.md`

## Requirement Checks

- Uses the existing SVGA adapter and `FastPngAlphaAnalyzer` host composition.
- Reports status counts, ratio statistics, over-50% resources, and fully
  transparent resources.
- Deduplicates identical input bytes by SHA-256.
- Does not change `maxTransparentPaddingRatio` or remove
  `needsProductCalibration`.
- Does not write or commit real SVGA samples.

## Validation

- TypeScript build: passed.
- Calibration helper and related alpha/spec/report tests: 27 passed, 0 failed.
- Four real SVGA samples analyzed successfully.
- Full regression not run: isolated host factory export, offline script, tests,
  and documentation only.

## Regression

- SVGA exporter: not touched.
- Web player implementation and layout: not touched.
- CLI default flow: not touched.
- Import, drag-drop, and comparison: not touched.
- Existing report and checker behavior: unchanged.

## Risks

- Only two current `300 x 300` samples are available.
- Historical samples contain sequence patterns that strongly skew aggregate
  statistics.
- Alpha bounds measure bounding-rectangle waste, not all transparent pixels.

## Next

Collect at least 10 representative production avatar-frame deliveries, then
re-run the script and decide whether the 50% warning should become a calibrated
product threshold or a sequence-aware rule.
