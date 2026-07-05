# Short-term UI/UX Canvas Label Removal Review

## Summary

UI/UX lane removed the extra visible `预览` badge from the preview canvas. The canvas-first direction already exposes Preview/Edit through the top-center mode switch, so the additional canvas badge was redundant visible text and made the surface feel more like an engineering prototype.

This is a visual simplification only. It does not change playback, file opening, drag-and-drop, compare, replacement, optimization, save, or accessibility labels.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit target: preview canvas label removal WP
- Product/design authority consulted: `docs/product/PRODUCT_ROADMAP.md`, `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`, `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`, `DESIGN.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Owner-confirmed rule: do not add or preserve unnecessary visible status/helper text not required by the PRD or approved design direction.
- The top-center Preview/Edit switch remains the mode indicator.
- Canvas `aria-label` values remain intact for accessibility.
- No visible product copy was added.
- The removed CSS was dedicated to the deleted badge, avoiding orphaned styling.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.
- `npm run desktop:smoke` passed.
- `git diff --check` passed.
- Smoke screenshot inspected:
  `.artifacts/product/short-term/short-term-preview-overview.png`
  confirms the canvas no longer shows the extra `预览` badge.

## Risks

- This does not claim final foreground visual acceptance.
- Smoke screenshots remain regression evidence only; final UI/UX acceptance still needs foreground desktop screenshots with macOS chrome and real production SVGA materials.

## Next Steps

- Continue reducing unnecessary chrome and engineering-prototype visual weight across the right surface, compare surface, launch state, and edit-reserved state.
