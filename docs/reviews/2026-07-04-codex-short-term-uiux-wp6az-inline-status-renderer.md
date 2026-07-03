# Review: WP6AZ Inline Status Renderer

## Summary

This change moves the shared empty/inline status text renderer into its own
renderer module. It is a narrow design-system implementation step that keeps
existing status copy, class names, and `data-component="InlineStatus"` output
unchanged.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Scope: shared UI renderer atom extraction
- Product authority checked: `docs/product/PRODUCT_ROADMAP.md`
- Design inputs checked:
  - `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
  - `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
  - `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`
  - `DESIGN.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-inline-status-renderers.mjs`
  - New shared renderer for inline/empty status text.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
  - Imports the shared inline status renderer instead of owning that atom.
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
  - Allows the new renderer as an approved DOM-owning renderer module.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Adds ownership assertions so the inline status atom does not drift back
    into the generic DOM renderer.

## Requirement Checks

- PRD boundary preserved: no PM-owned product documents were edited.
- Visible UI boundary preserved: no visible text, feature flow, or product
  behavior changed.
- Design-system boundary improved: a shared atom used by optimization,
  replaceable image, and runtime text lists now has a dedicated renderer home.
- Foreground validation boundary preserved: automated smoke evidence is not
  treated as visual or interaction acceptance.

## Verification

- `node --check` on touched renderer, guard, and test files.
- `npm run desktop:short-term:design-system-check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - Result: 30/30 tests passed.
- `npm run desktop:smoke`
- `git diff --check`

## Evidence Boundary

The smoke run confirms the automated regression flow still passes. Real
macOS-frontmost screenshots with native title bar/menu bar, multiple production
SVGA files, keyboard path review, and minimum-window review remain required
before claiming UI/UX acceptance.

## Risks And Next Steps

- The generic DOM renderer still owns optimization rows, replaceable/text rows,
  and edit-reserved rows. The next structural step should split one of those
  families without changing visible behavior.
- This is not a high-fidelity visual pass.
