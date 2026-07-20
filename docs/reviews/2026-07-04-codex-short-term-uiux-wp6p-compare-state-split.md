# Short-Term UI/UX WP6P Compare State Split Review

## Summary

Moved short-term Compare page-state trace and slot-state derivation into the existing compare model.

This keeps `GeneralCompareModule` and `OptimizationCompareModule` trace data with the compare UI model instead of scattering it through the main app entry. The main renderer still owns DOM writes and playback mounting.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit: pending at review creation time

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-uiux-wp6p-compare-state-split.md`

## Requirement Checks

- Product authority unchanged: no edits to `docs/product/PRODUCT_ROADMAP.md` or PM-owned PRD files.
- PRD trace: S10 compare flows remain the same owner-visible surfaces.
- Module trace: compare slot metadata and compare module/page-state trace now live in `short-term-macos-compare-model.mjs`.
- Main app entry no longer hardcodes `setCompareTrace("GeneralCompareModule", ...)` or `setCompareTrace("OptimizationCompareModule", ...)`.
- No user-visible copy, menu item, feature, or product state was added.
- Playback mounting, before/after comparison behavior, optimization output, and save state were not changed.

## Verification

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-model.mjs`
- `rg -n "overviewSummary|assetSummary|检查器|检查面板|检查标签|Preview mode|预览模式保持激活|生产规格信息|setCompareTrace\\(\\\"GeneralCompareModule\\\"|setCompareTrace\\(\\\"OptimizationCompareModule\\\"" ...`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

## Risks

- The compare model still renders HTML for compare side panels; this slice only moves trace and slot-state derivation.
- Further extraction must not move SVGA playback mounting into visual model code unless a clearer host/runtime boundary is introduced.

## Next Steps

- Continue reducing the main app entry around page-state boundaries that do not mutate SVGA bytes.
- Keep visual refinements separate from product-scope changes and avoid adding unapproved explanatory copy.
