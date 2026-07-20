# Short-term Tab Visual Weight Polish Review

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Reduced the visual weight of the short-term right-panel tab selected state.
The selected tab now reads primarily through text emphasis and the existing
bottom indicator instead of a heavier blue capsule-like surface.

This keeps the right panel closer to a restrained macOS utility surface and
reduces competition with the preview canvas and content area.

## Product And Design Boundary

Consulted:

- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
- `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`
- `DESIGN.md`

Touched PRD surface:

- S3-S5, S8, S11-S13: existing right-panel tabs only.

Non-goals retained:

- no product-scope change;
- no new copy, label, badge, state, or component;
- no tab structure or navigation logic change;
- no preview, save, menu, parser, optimizer, or SVGA byte logic change.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.molecules.css`

## Verification

Passed:

- `npm run desktop:short-term:design-system-check`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm run desktop:smoke`
- `git diff --check`

Automated screenshot evidence refreshed at:

- `.artifacts/product/short-term/short-term-preview-overview.png`
- `.artifacts/product/short-term/short-term-preview-replaceable.png`
- `.artifacts/product/short-term/short-term-preview-optimization.png`

Boundary: screenshot evidence is automated regression evidence only. This
slice does not claim foreground macOS visual acceptance with real production
SVGA materials.
