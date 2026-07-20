# Review: WP6AT Launch Recent Renderer Family

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Moved the Launch page recent-file DOM rendering into a dedicated renderer
family. This keeps S16 recent-file behavior unchanged while reducing the
generic short-term DOM renderer surface before later high-fidelity UI work.

## Product And Design Boundary

- PRD authority checked: `docs/product/PRODUCT_ROADMAP.md`.
- Touched requirement: S16 recent SVGA files.
- Subordinate design guidance checked:
  `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`,
  `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`, and `DESIGN.md`.
- No PM-owned PRD or product-scope document was edited.
- No visible copy, product behavior, menu behavior, or styling was changed.
- Automated smoke is recorded as regression evidence only; foreground macOS
  visual or interaction acceptance was not claimed.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-launch-renderers.mjs`
  - New Launch-specific renderer family for recent-file rows and unavailable
    state.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
  - Removed Launch recent-file row rendering from the generic renderer module.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Imports Launch recent-file rendering from the new Launch renderer module.
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
  - Allows dynamic DOM work in the new Launch renderer module while keeping
    models free of visible DOM writes.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Asserts Launch recent-file rendering lives in the Launch renderer family,
    not the generic DOM renderer or recent-files model.

## Verification

Passed:

- `node --check` on the touched app, renderer, design-system check, and test
  files.
- `npm run desktop:short-term:design-system-check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - 30/30 tests passed.
- `npm run desktop:smoke`
- `git diff --check`

## Risks And Follow-up

- This slice improves design-system code ownership only; it does not improve
  visual quality by itself.
- Foreground macOS screenshots with real production SVGA materials are still
  required before claiming UI/UX visual or interaction acceptance.
- A remaining follow-up is to continue reducing the generic renderer module by
  moving other page-state or module-specific rendering into named renderer
  families.
