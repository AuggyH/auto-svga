# Short-term UI/UX WP6Y Resource Menu Renderer Split Review

## Summary

Moved resource context-menu DOM application from the short-term macOS app entry
file into the DOM renderer layer. The entry file still owns when to open and
close the menu and how rename/replace/reset actions are dispatched, while the
renderer layer now owns menu visibility, positioning, reset-button enabled
state, and initial focus.

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
- Short-term scope preserved: S11/S12 resource-menu rename, replacement, and
  reset behavior is unchanged.
- Owner boundary preserved: no new user-facing text, labels, states, or
  explanatory UI were introduced.
- Design-system direction improved: resource context-menu DOM details now live
  in the renderer/component layer instead of the app entry file.
- Regression guard added: tests reject reintroducing resource-menu visibility,
  positioning, reset-button state, and focus handling in the app entry file.

## Verification

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
- Boundary grep for removed legacy/forbidden UI terms and entry-level
  resource-menu DOM writes.
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
