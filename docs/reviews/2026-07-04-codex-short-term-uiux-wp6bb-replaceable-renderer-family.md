# Review: WP6BB Replaceable Renderer Family

## Summary

This change splits the short-term Replaceable Elements tab rendering into its
own renderer family. It moves replaceable image rows, inline rename row content,
runtime text rows, summary state writes, and empty-state row replacement out of
the generic DOM renderer.

This is a structural UI/UX implementation step only. It does not add product
scope, change visible copy, alter replacement/rename/text-preview behavior, or
attempt a visual high-fidelity pass.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Scope: short-term macOS client renderer ownership
- Product authority checked: `docs/product/PRODUCT_ROADMAP.md`
- Design inputs checked:
  - `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
  - `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
  - `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`
  - `docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`
  - `DESIGN.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-replaceable-renderers.mjs`
  - New renderer family for `ReplaceableImageRow`, `ReplaceableTextRow`,
    inline rename row content, and Replaceable Elements empty-state rendering.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
  - Removes Replaceable Elements rendering from the generic DOM renderer.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Imports replaceable image and runtime text list rendering from the new
    renderer family.
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
  - Adds the new renderer to the dynamic DOM ownership allowlist.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Adds ownership assertions for the new Replaceable renderer family and
    prevents Replaceable Elements DOM work from drifting back into the app entry
    or generic DOM renderer.

## Requirement Checks

- PRD boundary preserved: no PM-owned product documentation edited.
- UI text boundary preserved: no visible copy, label, status, tooltip, or
  helper text added or changed.
- Behavior preserved: renderer inputs and DOM output semantics remain the same
  for image replacement rows, text preview rows, inline rename confirm/cancel,
  and empty states.
- Design-system direction improved: `ReplaceableElementsTabModule` now has a
  dedicated renderer family aligned with the documented component inventory.

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

- The generic DOM renderer now only owns the short-term Edit reserved layer
  rows. A follow-up slice can either split that into an Edit reserved renderer
  or rename the generic file to match its remaining responsibility.
- This change improves implementation architecture but does not solve visual
  quality, spacing, hierarchy, density, or polished macOS feel by itself.
