# Short-term UI/UX WP6AB Overview Asset Renderer Split

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Continued the short-term macOS client UI/UX componentization pass by moving
Overview fact-grid and resource-list DOM replacement out of the app entry file
and into the short-term DOM renderer module.

This is an implementation-structure slice only. It preserves the existing
Owner-reviewed information layout, field density, labels, copy, and product
behavior.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority: `docs/product/PRODUCT_ROADMAP.md` remains the sole PRD
  authority. No PRD-owned files were changed.
- UI/UX authority: follows `DESIGN.md` and the short-term UI/UX redesign
  execution plan by moving another repeated DOM composition responsibility from
  app-entry code into the renderer/component layer.
- Scope boundary: no new user-facing copy, labels, explanatory text, product
  states, or product interactions were introduced.
- Layout boundary: no changes were made to the established Overview information
  density or resource row presentation.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
- `git diff --check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

Result: all checks passed.

## Notes

- New regression assertions require `short-term-macos-app.mjs` to call
  `renderOverviewFacts` and `renderAssetList` instead of directly replacing
  `factGrid` or `assetList` children.
- `desktop:smoke` remains automated regression evidence only. It is not a
  substitute for future foreground macOS visual review using real production
  SVGA materials.

## Risks

- This slice improves the token/component/module implementation path, but it is
  not a high-fidelity visual redesign by itself.
- The app entry file still owns additional page-state orchestration and some DOM
  responsibilities; further narrow splits are still needed.

## Next Step

Continue WP6AB by moving optimization-list rendering or edit-reserved layer-list
rendering behind a renderer/module boundary, then pair later visual refinement
with foreground macOS screenshots and real SVGA production materials.
