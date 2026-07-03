# Short-Term UI/UX WP6N Optimization Model Split Review

## Summary

Split short-term optimization tab view state out of the main renderer into a dedicated UI/UX model module.

This is a structural UI/UX implementation step toward the documented token -> atom -> molecule -> component -> module -> page state direction. It does not change the optimization workflow, output bytes, save behavior, or product scope.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit: pending at review creation time

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-optimization-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-uiux-wp6n-optimization-model-split.md`

## Requirement Checks

- Product authority unchanged: no edits to `docs/product/PRODUCT_ROADMAP.md` or other PM-owned PRD files.
- Scope preserved: short-term optimization remains the existing safe one-click optimization flow.
- No new product-facing feature was added.
- No historical Web Preview / Workbench visual baseline was revived.
- Main renderer no longer owns optimization tab summary copy, run-button state copy, empty-state copy, or result tone derivation.
- Existing optimization grouping remains shared through the render model and is consumed by the new optimization model.

## Verification

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-optimization-model.mjs`
- `rg -n "overviewSummary|assetSummary|检查器|检查面板|检查标签|Preview mode|预览模式保持激活|生产规格信息" ...`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

Note: an initial parallel `desktop:smoke` attempt raced with another command over the generated runtime directory. The sequential rerun passed.

## Risks

- Real optimization execution still lives in the main app module because it is tied to Electron bridge calls, byte output, and save-state mutation. Further extraction should keep those product-function boundaries intact.
- This slice improves component/page-state ownership only; it is not a visual redesign pass.

## Next Steps

- Continue splitting owner-visible page-state and DOM responsibilities into focused modules before broad visual styling changes.
- Keep future visual refinements tied to existing PRD and UI/UX design documents, without adding unapproved explanatory text or product states.
