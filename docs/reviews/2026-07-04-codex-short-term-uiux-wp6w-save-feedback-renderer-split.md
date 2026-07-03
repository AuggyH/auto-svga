# Short-term UI/UX WP6W Save Feedback Renderer Split Review

## Summary

Moved `SaveFeedbackBanner` DOM application from the short-term macOS app entry
file into the DOM renderer layer. The app entry still decides when to show,
hide, or clear save feedback, but the component-level details now live with the
other renderer/component helpers.

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
- Short-term scope preserved: no S1-S16 behavior or interaction state changed.
- Owner boundary preserved: no new user-facing text, labels, states, or
  explanatory UI were introduced.
- Design-system direction improved: `SaveFeedbackBanner` display/hide/clear
  DOM behavior is now owned by the renderer/component layer.
- Behavior nuance preserved: close-file hiding still only hides the banner,
  while transient-output clearing still removes the status attribute.
- Regression guard added: tests reject reintroducing direct `nodes.saveBanner`
  DOM mutation inside the app entry file.

## Verification

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
- Boundary grep for removed legacy/forbidden UI terms and entry-level
  `SaveFeedbackBanner` DOM writes.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - Result: 29/29 passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
  - Result: passed.

## Risks

- This is a structural componentization slice. It does not claim high-fidelity
  visual improvement by itself.
- Desktop smoke remains regression evidence only; final visual design review
  still needs real foreground macOS screenshots with real production SVGA files.

## Next Steps

- Continue moving repeated UI state/rendering fragments out of the app entry
  file along documented component and module boundaries.
- Keep future visual refinement separate from product-scope or copy changes.
