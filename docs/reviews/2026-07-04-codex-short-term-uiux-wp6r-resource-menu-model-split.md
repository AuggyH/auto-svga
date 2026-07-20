# Short-Term UI/UX WP6R Resource Menu Model Split Review

## Summary

Split resource context-menu positioning and reset-action view state into a dedicated UI/UX model module.

This keeps `ContextMenuItem` behavior traceable without changing imageKey rename, preview replacement, reset, or keyboard/context-menu entry behavior.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit: pending at review creation time

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-resource-menu-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-uiux-wp6r-resource-menu-model-split.md`

## Requirement Checks

- Product authority unchanged: no edits to `docs/product/PRODUCT_ROADMAP.md` or PM-owned PRD files.
- PRD trace: S11-S13 resource-row rename, replacement preview, and reset entry behavior is preserved.
- Component trace: context-menu positioning and reset disabled state now live in `short-term-macos-resource-menu-model.mjs`.
- Main app entry no longer directly computes keyboard menu anchor coordinates or context-menu reset disabled state.
- No menu item, copy, feature, product state, or persisted byte behavior was added.

## Verification

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-resource-menu-model.mjs`
- `rg -n "overviewSummary|assetSummary|检查器|检查面板|检查标签|Preview mode|预览模式保持激活|生产规格信息|setCompareTrace\\(\\\"GeneralCompareModule\\\"|setCompareTrace\\(\\\"OptimizationCompareModule\\\"|context-reset[\\\\s\\\\S]{0,120}activeOutput|inactive feature|advanced layer editing" ...`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

## Risks

- The model still receives DOM-derived dimensions from the app entry. This is intentional: the model owns calculation, while the app owns real DOM measurement and focus.
- Functional replacement reset protection remains in the app flow and was not moved into the view model.

## Next Steps

- Continue extracting UI-only state from the main app entry while keeping byte mutation and host bridge calls in functional paths.
- Keep later visual refinements token/component based and avoid unapproved explanatory copy.
