# Review: SVGA Embedded Resource Role Classification

## Summary

- Mainline: P2 design specification checks.
- Added conservative resource roles to `MotionAssetInfo`.
- Classification is metadata-only and does not change spec pass/fail behavior.

## Git State

- Branch: `agent/codex/svga-resource-role-classification`
- Commit: this delivery commit
- Base prerequisite: `368cf9d` alpha-bound calibration

## Changed Files

- `src/workbench/contracts.ts`
- `src/workbench/svga/resource-classifier.ts`
- `src/workbench/svga/format-adapter.ts`
- `src/tests/svga-resource-classifier.test.ts`
- `src/tests/svga-format-adapter.test.ts`
- `docs/svga-resource-role-classification.md`
- `docs/TECH_SPEC.md`
- `docs/reviews/2026-06-13-codex-svga-resource-role-classification.md`

## Requirement Checks

- Roles: static image, sequence frame, baked sweep frame, mask/matte, unknown.
- Uses image keys, known dimensions, sprite references, and `matteKey`.
- Sequence grouping supports ascending or descending input order.
- Unknown or weak evidence does not force specialized classification.
- Current 50% threshold and checker logic are unchanged.

## Validation

- TypeScript build: passed.
- Resource classification, SVGA adapter, and avatar-frame spec/report tests:
  20 passed, 0 failed.
- Web report display tests: 8 passed, 0 failed.
- Full regression not run: exporter, playback, build config, dependency graph,
  and CLI routing were not touched.

## Regression

- SVGA exporter: not touched.
- Web player implementation and layout: not touched.
- CLI default flow: not touched.
- Import, drag-drop, and comparison: not touched.

## Risks

- Generic numeric image keys preserve sequence evidence but cannot identify the
  semantic effect that produced the sequence.
- Role-specific transparent-padding policy remains a later task.

## Next

Define role-aware transparent-padding recommendations using additional
production samples, without changing the current global production gate until
the evidence is sufficient.
