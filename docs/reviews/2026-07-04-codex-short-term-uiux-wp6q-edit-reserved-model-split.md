# Short-Term UI/UX WP6Q Edit Reserved Model Split Review

## Summary

Split the short-term Edit reserved layer-list page-state rule into a dedicated UI/UX model module.

The short-term Edit mode remains reserved: it shows a layer list and an empty reserved operation panel, without inactive advanced editing controls.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit: pending at review creation time

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-edit-reserved-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-uiux-wp6q-edit-reserved-model-split.md`

## Requirement Checks

- Product authority unchanged: no edits to `docs/product/PRODUCT_ROADMAP.md` or PM-owned PRD files.
- PRD trace: short-term Edit mode remains a reserved state with layer viewing only.
- Module trace: `EditReservedModule` layer-list filtering now lives in `short-term-macos-edit-reserved-model.mjs`.
- Audio assets remain excluded from the layer list.
- The existing 32-row reserved layer-list cap is preserved.
- No new editing feature, inactive future control, product copy, or menu item was added.

## Verification

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-edit-reserved-model.mjs`
- `rg -n "overviewSummary|assetSummary|检查器|检查面板|检查标签|Preview mode|预览模式保持激活|生产规格信息|setCompareTrace\\(\\\"GeneralCompareModule\\\"|setCompareTrace\\(\\\"OptimizationCompareModule\\\"|inactive feature|advanced layer editing" ...`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

## Risks

- This is structural UI/UX cleanup only; it does not improve the visual design quality of the Edit reserved surface.
- Future mid-term Edit mode work must replace this reserved model deliberately instead of layering active controls onto the short-term reserved state.

## Next Steps

- Continue shrinking the main app entry around page-state boundaries that do not mutate SVGA bytes.
- Keep any later visual polish tied to existing tokens/components and avoid unapproved product-facing copy.
