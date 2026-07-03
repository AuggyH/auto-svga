# Short-term UI/UX WP6U Inline Status Renderer Split Review

## Summary

Moved the optimization-result inline status row creation out of the short-term
macOS app entry file and into the DOM renderer layer. This is a structural
UI/UX implementation cleanup only: no PRD-owned document, product behavior,
visible copy, state name, or interaction flow was changed.

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
- UI/UX scope preserved: short-term S1-S16 surfaces remain unchanged.
- Owner boundary preserved: no new explanatory text, labels, product states, or
  non-PRD components were introduced.
- Design-system direction improved: `InlineStatus` message-row DOM creation now
  lives in the renderer/component layer instead of the large app entry file.
- Entry-file regression guard added: tests reject reintroducing local
  `messageRow` or direct `renderMessageRowHtml` usage in the app entry file.

## Verification

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
- Boundary grep for removed legacy/forbidden UI terms and local message-row
  entry usage.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - Result: 29/29 passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
  - Result: passed.

## Risks

- This slice is intentionally structural. It does not claim high-fidelity
  visual improvement by itself.
- Desktop smoke screenshots remain regression evidence only; real foreground
  macOS screenshots are still required for final design-quality review.

## Next Steps

- Continue decomposing the short-term app entry file along documented
  page-state/module/component boundaries.
- Keep visual refinement separate from product-scope changes and avoid adding
  UI copy unless Owner confirms and PRD/UI docs are updated by the responsible
  owner.
