# Short-term UI/UX WP6Z Runtime Text Overlay Renderer Split Review

## Summary

Moved runtime text overlay DOM application from the short-term macOS app entry
file into the DOM renderer layer. The entry file still owns S13 runtime text
preview state and copy selection, while the renderer layer now owns applying or
clearing the overlay node.

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
- Short-term scope preserved: S13 runtime text preview remains runtime-only and
  does not persist text into SVGA bytes.
- Owner boundary preserved: no new user-facing text, labels, states, or
  explanatory UI were introduced.
- Design-system direction improved: runtime text overlay display/clear DOM
  details now live in the renderer/component layer instead of the app entry
  file.
- Regression guard added: tests reject reintroducing direct
  `runtimeTextOverlay.hidden` or `runtimeTextOverlay.textContent` assignments in
  the app entry file while preserving read-only smoke evidence checks.

## Verification

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
- Boundary grep for removed legacy/forbidden UI terms and entry-level runtime
  text overlay DOM writes.
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
