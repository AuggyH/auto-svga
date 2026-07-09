# 2026-07-10 Codex UI/UX Workbench Frame Alignment

## Summary

Aligned the Auto SVGA `0.1.x / SVGA Preview MVP` workbench frame contract with
the current Figma page-state design frame. Launch already used the 640 x 640
contract; this pass makes the short-term workbench target 1280 x 800 while
preserving the historical 1440 x 900 wide evidence scenario.

This is a design-system landing change, not a product-scope change.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/design-system-map.json`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-10-codex-uiux-workbench-frame-alignment.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## Requirement Check

- Product authority remains `docs/product/PRODUCT_ROADMAP.md`.
- This pass follows the approved canvas-first, low-boundary macOS client
  direction and does not add visible UI copy, controls, modes, or scope.
- The implementation uses three sources together:
  - tokens: `--asv-layout-page-workbench-frame-width/height`;
  - components/modules: short-term workbench window sizing and page-state map;
  - page states: Figma R6/R8/R9 1280 x 800 workbench frames.

## Implementation Notes

- Added `shortTermWorkbench: { width: 1280, height: 800 }` in the Electron main
  process sizing policy.
- `chooseMacosWorkbenchWindowBounds()` now uses the short-term workbench design
  frame for the current short-term client and keeps `defaultWorkbench`
  available for legacy/wide scenarios.
- Default short-term screenshot scenarios now use the 1280 x 800 workbench
  target. `short-term-preview-overview-wide` and `desktop-1440x900` remain on
  the historical 1440 x 900 frame.
- `design-system-map.json` now traces workbench page states back to
  `main.cjs`, because the visible page frame is determined by both CSS tokens
  and native window bounds.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed `36/36`.
- `git diff --check` passed.

No Figma MCP calls were made for this WP. It used existing R6/R8/R9/R10 read
packets.

No package promotion or foreground screenshot was produced. This was deliberate
cost control: the change is a page-frame contract correction and should be
bundled with the next owner-visible visual batch before refreshing the local
stable app.

## Risks

- Final owner acceptance still needs foreground packaged-app screenshots with
  real production SVGA files.
- Full desktop smoke was not used as the closing gate for this WP; a prior
  smoke timeout was narrowed to the smoke/page-state path rather than fixture
  parsing, and should be handled separately before final acceptance.

## Project Retrospective

Effective: yes. The change removes a structural mismatch that would otherwise
make every page-level visual comparison drift from the Figma 1280 x 800 design
frame.

Cost control: good. No new Figma MCP read, package refresh, foreground capture,
or local stable promotion was used. Validation was bundled through the
design-system check and unit suite.

Lesson: page polish should start by confirming the runtime page frame matches
the design page frame. Tokens alone are not enough when a native shell controls
the actual window size.
