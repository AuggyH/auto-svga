# Short-Term UI/UX WP6O Overview Model Split Review

## Summary

Split short-term Overview tab page-state calculation out of the main renderer into a dedicated UI/UX model module.

This continues the design-system-first implementation direction: PRD surface -> module -> component/page-state source -> evidence. It does not change the parser, playback, asset rows, production-spec facts, optimization, save behavior, or product scope.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit: pending at review creation time

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-overview-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-uiux-wp6o-overview-model-split.md`

## Requirement Checks

- Product authority unchanged: no edits to `docs/product/PRODUCT_ROADMAP.md` or PM-owned PRD files.
- PRD trace: S3, S4, S5, S6, and S15 remain the same rendered Overview and asset information surfaces.
- Module trace: Overview tab state now has a dedicated `short-term-macos-overview-model.mjs` owner.
- Main renderer no longer directly calls `overviewVisibleFacts` or locally derives playback metadata.
- No user-visible copy, menu item, feature, or product state was added.
- No historical Web Preview, Electron prototype, or Workbench visual baseline was revived.

## Verification

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-overview-model.mjs`
- `rg -n "overviewSummary|assetSummary|检查器|检查面板|检查标签|Preview mode|预览模式保持激活|生产规格信息|overviewVisibleFacts" ...`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`

Note: a parallel verification attempt raced over the generated runtime directory. The sequential rerun passed.

## Risks

- The Overview model still delegates HTML-level fact-cell rendering to the shared render model and DOM renderer, which is intentional for this slice.
- This is structural UI/UX cleanup only; it does not attempt visual polish or high-fidelity styling.

## Next Steps

- Continue shrinking the main renderer by extracting page-state boundaries that do not own byte mutation or host bridge calls.
- Keep future visual passes tied to the existing token/component layers and avoid adding unapproved explanatory copy.
