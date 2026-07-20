# Review: WP6BC Edit Reserved Renderer Family

## Summary

This change removes the remaining generic `short-term-macos-dom-renderers.mjs`
module and moves its last responsibility into
`short-term-macos-edit-reserved-renderers.mjs`. The new renderer family owns
only the short-term Edit reserved `LayerRow` rendering.

This is a structural UI/UX implementation step only. It does not change the
reserved Edit mode product behavior, visible copy, layer-list content, or
short-term scope.

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

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-edit-reserved-renderers.mjs`
  - New renderer family for Edit reserved layer rows.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
  - Removed after its final responsibility moved to a named renderer family.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Imports Edit reserved rendering from the new renderer family.
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
  - Replaces the old generic DOM renderer allowlist entry with the named Edit
    reserved renderer entry.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Updates ownership assertions so the app entry and design-system guard no
    longer depend on the generic DOM renderer.

## Requirement Checks

- PRD boundary preserved: no PM-owned product documentation edited.
- UI text boundary preserved: no visible copy, labels, status, tooltip, or
  helper text added or changed.
- Behavior preserved: Edit reserved layer rows keep the same input model and
  DOM output semantics.
- Design-system direction improved: owner-visible DOM rendering now belongs to
  named renderer families instead of a catch-all DOM module.

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

- Renderer ownership is now much closer to the documented module/component
  hierarchy, but the CSS and DOM still need real visual refinement before the
  client can feel like a polished macOS app.
- The next UI/UX work should shift from renderer-family decomposition toward a
  foreground macOS review pass or a targeted visual polish slice with explicit
  token/component trace.
