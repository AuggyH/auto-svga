# Review: WP6AW Resource Menu Renderer Family

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Moved resource context-menu DOM rendering into a dedicated renderer family.
This keeps imageKey row-menu and keyboard context-menu behavior unchanged while
continuing to reduce the generic short-term DOM renderer surface.

## Product And Design Boundary

- PRD authority checked: `docs/product/PRODUCT_ROADMAP.md`.
- Touched requirements: S11 imageKey rename and S12 replaceable image preview,
  only through the existing resource context-menu presentation.
- Subordinate design guidance checked:
  `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`,
  `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`, and `DESIGN.md`.
- No PM-owned PRD or product-scope document was edited.
- No visible copy, menu items, keyboard behavior, rename behavior, replacement
  behavior, or styling was changed.
- Automated smoke is regression evidence only; foreground macOS visual or
  interaction acceptance was not claimed.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-resource-menu-renderers.mjs`
  - New renderer family for showing, positioning, focusing, and hiding the
    resource context menu.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
  - Removed resource context-menu rendering from the generic renderer module.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Imports resource menu rendering from the new renderer module.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Asserts resource menu rendering lives in the resource menu renderer family,
    while menu view-state logic remains in the resource menu model.

## Verification

Passed:

- `node --check` on the touched app, renderer, and test files.
- `npm run desktop:short-term:design-system-check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - First runs exposed stale test expectations; after updating assertion
    ownership to the new resource menu renderer, 30/30 tests passed.
- `npm run desktop:smoke`
- `git diff --check`

## Risks And Follow-up

- This slice improves code ownership only; it does not improve visual polish by
  itself.
- Foreground macOS screenshots with real production SVGA materials remain
  required before claiming UI/UX visual or interaction acceptance.
- The generic DOM renderer still owns overview, optimization, replaceable,
  runtime-text, edit-reserved, and shared row rendering.
