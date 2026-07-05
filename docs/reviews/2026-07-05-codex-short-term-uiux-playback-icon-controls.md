# Short-term UI/UX Playback Icon Controls Review

## Summary

UI/UX lane refined the short-term macOS client playback controls to better match the owner-confirmed canvas-first visual direction. The visible `播放` / `暂停` / `重播` text buttons were replaced with compact icon buttons while preserving Chinese accessible labels, titles, command state, keyboard activation, and existing playback behavior.

This is a visual/UI implementation slice only. It does not change product scope or playback logic.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit target: playback icon controls visual WP
- Product/design authority consulted: `PRODUCT_ROADMAP.md`, `SHORT_TERM_UI_UX_DESIGN_BRIEF.md`, `SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`, `DESIGN.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-state.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Owner-confirmed rule: self-evident controls such as playback and replay should use icons instead of visible text.
- The main surface did not gain explanatory copy, status labels, or new product controls.
- Button state still comes from the existing command-state path.
- Visible button internals are no longer overwritten by `textContent`, preserving SVG icon structure.
- Styling uses token aliases for playback bar, icon sizes, and control surfaces.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.
- `npm run desktop:smoke` passed.
- `git diff --check` passed.
- Smoke screenshot inspected:
  `.artifacts/product/short-term/short-term-preview-overview.png`
  shows the icon controls rendered and the playback state icon switched during the smoke flow.

## Risks

- This review does not claim final owner-visible visual acceptance. The slice still needs real foreground desktop validation with macOS chrome as part of the broader visual QA checkpoint.
- Inline SVG icons were used because the short-term client has no installed icon library and this WP intentionally avoids adding dependencies.

## Next Steps

- Continue visual polish on the canvas/right information boundary and launch/preview density.
- Run the required foreground desktop screenshot pass before claiming high-fidelity UI/UX completion.
