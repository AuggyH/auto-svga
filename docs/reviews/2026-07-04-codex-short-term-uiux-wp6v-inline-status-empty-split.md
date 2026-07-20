# Short-term UI/UX WP6V Inline Status Empty Split Review

## Summary

Moved repeated empty-state `InlineStatus` DOM creation from the short-term
macOS app entry file into the DOM renderer layer. This keeps the current
optimization, replaceable-image, and replaceable-text empty states visually and
behaviorally unchanged while making the implementation closer to the documented
atom/component layering.

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
- Short-term scope preserved: existing S1-S16 states and actions are unchanged.
- Owner boundary preserved: no new explanatory text, labels, product states, or
  user-facing components were introduced.
- Design-system direction improved: empty-state `InlineStatus` creation is now
  owned by the renderer/component layer instead of repeated in the entry file.
- Regression guard added: tests reject reintroducing direct `p.emptyText`
  `InlineStatus` creation inside the app entry file.

## Verification

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
- Boundary grep for removed legacy/forbidden UI terms and entry-level empty
  status creation.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - Result: 29/29 passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
  - Result: passed.

## Risks

- This is a structural componentization slice. It does not claim visual
  high-fidelity improvement by itself.
- Desktop smoke remains regression evidence only; real foreground macOS review
  is still required for final design-quality judgment.

## Next Steps

- Continue moving repeated UI atoms and state-rendering fragments out of the
  entry file while preserving the PRD and Owner-approved copy boundaries.
- Keep visual refinement separate from product-scope changes.
