# Short-term UI/UX Launch Icons Review

## Summary

UI/UX lane refined the launch canvas so self-evident launch actions use icons in the owner-confirmed canvas-first style. The drag target now includes a quiet upload icon, the primary Open File action includes a folder icon, and the recent-file clear action is now a low-emphasis trash icon button with Chinese accessibility labels.

This is a visual implementation slice only. It does not change file opening, recent-file state, clearing behavior, drag-and-drop behavior, or menu behavior.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit target: launch icon visual WP
- Product/design authority consulted: `docs/product/PRODUCT_ROADMAP.md`, `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`, `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`, `DESIGN.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.molecules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Owner-confirmed rule: self-evident actions should use icons where icons are clearer than text.
- Open File keeps visible Chinese text because it is the primary launch action.
- Recent clear uses an icon-only visual form with `aria-label` and `title` for accessibility.
- New sizes are token-backed through launch component tokens.
- The launch-page minimal-copy check remains active and was updated only to accept the icon-plus-text Open File button structure.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.
- `npm run desktop:smoke` passed.
- `git diff --check` passed.
- Smoke screenshot inspected:
  `.artifacts/product/short-term/short-term-launch.png`
  shows the upload icon, folder icon, and trash icon button rendered in the launch canvas.

## Risks

- This does not claim final foreground visual acceptance.
- Inline SVG icons were used to avoid adding a dependency in this narrow WP.

## Next Steps

- Continue applying the same icon-first treatment to remaining self-evident compact controls where product text is not required.
- Run foreground desktop validation before final UI/UX acceptance.
