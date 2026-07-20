# Short-term UI/UX WP6X Compare Renderer Split Review

## Summary

Moved compare-card and compare-module DOM state application from the
short-term macOS app entry file into the DOM renderer layer. The entry file
still owns when to enter general compare or optimization compare, while the
renderer layer now owns applying `ComparePreviewCard` title/meta/loading state
and compare-module page-state metadata.

No PRD-owned document, product behavior, visible copy, state name, or
interaction flow was changed.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit status at review time: pending commit

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- PRD authority preserved: `docs/product/PRODUCT_ROADMAP.md` remains the only
  product scope authority.
- Short-term scope preserved: S10 General/Optimization compare surfaces remain
  unchanged.
- Owner boundary preserved: no new user-facing text, labels, product states, or
  explanatory UI were introduced.
- Design-system direction improved: `ComparePreviewCard`,
  `GeneralCompareModule`, and `OptimizationCompareModule` DOM state writes now
  live in the renderer/component layer.
- Regression guard added: tests reject reintroducing compare-card
  `textContent`/`dataset` writes inside the app entry file.

## Verification

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
- Boundary grep for removed legacy/forbidden UI terms and entry-level compare
  DOM writes.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - Result: 29/29 passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
  - Result: passed.

## Risks

- This is a structural componentization slice. It does not claim high-fidelity
  visual improvement by itself.
- Desktop smoke remains regression evidence only; final visual review still
  needs foreground macOS screenshots with real production SVGA files.

## Next Steps

- Continue moving repeated UI state/rendering fragments out of the app entry
  file along documented component and module boundaries.
- Keep future visual refinement separate from product-scope or copy changes.
