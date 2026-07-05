# Short-term UI/UX Right Surface Boundary Review

## Summary

UI/UX lane softened the short-term macOS client's preview/right-surface boundary to better match the owner-confirmed canvas-first direction. The preview canvas and right information surface no longer use the same boxed card chrome; the right surface now uses a token-backed inset separator while preserving the existing information hierarchy and product copy.

This is a visual implementation slice only. It does not change product scope, feature behavior, file handling, playback, optimization, replacement, or save logic.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit target: right surface boundary-light visual WP
- Product/design authority consulted: `docs/product/PRODUCT_ROADMAP.md`, `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`, `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`, `DESIGN.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Owner-confirmed direction: express hierarchy through typography, tone, shape, spacing, and material depth instead of dense outlines or boxed cards.
- No new visible copy, helper text, labels, status badges, or product controls were added.
- Preview canvas and right information surface remain in their existing product locations.
- The separator, spacing, and material values are token-backed.
- Existing compare, edit-reserved, layer, and result panel chrome remains untouched in this WP.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.
- `npm run desktop:smoke` passed.
- `git diff --check` passed.
- Smoke screenshot inspected:
  `.artifacts/product/short-term/short-term-preview-overview.png`
  shows the right surface rendered with the softened boundary.

## Risks

- This review does not claim final high-fidelity visual acceptance. Smoke screenshots remain regression evidence only.
- Real foreground desktop validation with macOS chrome, light/dark modes, and multiple owner-provided production SVGA files is still required before final UI/UX acceptance.
- Existing right-surface content density and some older explanatory copy remain future visual/product-alignment work; they were intentionally not changed in this boundary-only WP.

## Next Steps

- Continue applying the owner-confirmed canvas-first visual language to the remaining preview, launch, compare, optimization, and edit-reserved states.
- Keep future changes split by WP with token/test/review evidence.
