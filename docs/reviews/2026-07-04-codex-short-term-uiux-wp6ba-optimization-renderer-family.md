# Review: WP6BA Optimization Renderer Family

## Summary

This change splits the short-term Optimization tab rendering into its own
renderer family. It moves optimization finding rows, optimization result rows,
summary/button state writes, and finding-list replacement/prepend operations
out of the generic DOM renderer.

This is a structural UI/UX implementation step only. It does not add product
scope, change visible copy, change optimization behavior, or attempt a visual
high-fidelity pass.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Scope: short-term macOS client renderer ownership
- Product authority checked: `docs/product/PRODUCT_ROADMAP.md`
- Design inputs checked:
  - `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
  - `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
  - `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`
  - `DESIGN.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-optimization-renderers.mjs`
  - New renderer family for Optimization tab rows and inline result messages.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
  - Removed Optimization-owned renderer functions from the generic DOM module.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Imports Optimization rendering from the new renderer family.
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
  - Adds the new renderer to the dynamic DOM ownership allowlist.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Adds ownership assertions for the new Optimization renderer family and
    prevents optimization DOM work from drifting back into the app entry or
    generic DOM renderer.

## Requirement Checks

- PRD boundary preserved: no PM-owned product documentation edited.
- UI text boundary preserved: no visible copy, label, status, or helper text
  added or changed.
- Behavior preserved: optimization list rendering and result insertion keep the
  same model inputs and DOM output semantics.
- Design-system direction improved: Optimization tab now has a dedicated
  renderer family that can be styled and tested as a module instead of living
  inside a catch-all DOM file.

## Verification

- `node --check` on touched app, renderer, guard, and test files.
- `npm run desktop:short-term:design-system-check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - Result: 30/30 tests passed.
- `npm run desktop:smoke`
- `git diff --check`

## Evidence Boundary

The automated smoke run remains regression evidence only. It is not visual or
interaction acceptance. Foreground macOS screenshots with native title bar/menu
bar, multiple real production SVGA files, keyboard path checks, minimum-window
checks, and design review are still required before claiming the UI/UX is
accepted.

## Risks And Next Steps

- The generic DOM renderer still owns replaceable image rows, runtime text rows,
  and edit-reserved layer rows. Those are the next likely structural split
  candidates.
- This change improves implementation architecture but does not solve visual
  quality, spacing, hierarchy, density, or polished macOS feel by itself.
