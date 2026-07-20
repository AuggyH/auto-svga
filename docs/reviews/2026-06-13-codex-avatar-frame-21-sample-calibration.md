# Review: Avatar-frame 21-sample Calibration

## Summary

- Mainline: P2 design specification checks.
- Analyzed 21 unique external avatar-frame SVGA/PNG pairs.
- Extended the offline calibration helper with resource-role statistics.
- Kept all production thresholds and pass/fail logic unchanged.

## Git State

- Branch: `agent/codex/avatar-frame-21-sample-calibration`
- Commit: this delivery commit
- Base prerequisite: `8913b30` SVGA resource role classification

## Changed Files

- `scripts/calibrate-avatar-frame-alpha-bounds.mjs`
- `scripts/calibrate-avatar-frame-alpha-bounds.test.mjs`
- `docs/avatar-frame-alpha-bound-calibration.md`
- `docs/avatar-frame-21-sample-calibration.md`
- `docs/reviews/2026-06-13-codex-avatar-frame-21-sample-calibration.md`

## Evidence

- 21 unique SVGA files, 1,611 embedded image resources.
- 1,608 known alpha bounds, 3 opaque-only, no unavailable analysis.
- 827 static resources and 784 sequence frames.
- 172 resources exceed 50% padding: 170 sequence, 2 static.
- No source SVGA, PNG, archive, or generated JSON was committed.

## Validation

- TypeScript build: passed.
- Calibration, classifier, adapter, and avatar-frame report targeted tests:
  22 passed, 0 failed.
- All 21 real samples inspected successfully.
- Full regression not run: runtime checker, exporter, playback, CLI routing,
  dependency graph, and Web UI were not changed.

## Regression

- SVGA exporter: not touched.
- Web player implementation and layout: not touched.
- CLI default flow: not touched.
- Import, drag-drop, and comparison: not touched.
- Spec thresholds and pass/fail logic: unchanged.

## Risks

- Existing catalog assets are not automatically an approved production target.
- Generic numeric image keys identify sequences but not their visual purpose.
- A role-aware sequence policy requires group-level evidence before gating.

## Next

Define product intent for separate production-target and legacy-compatibility
profiles before changing file-size, resource-count, FPS, duration, or
transparent-padding gates.
