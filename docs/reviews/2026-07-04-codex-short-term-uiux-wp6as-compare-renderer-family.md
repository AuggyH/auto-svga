# Short-term UI/UX WP6AS Compare Renderer Family

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`
Status: completed

## Summary

Split compare-specific DOM mutation out of the shared short-term DOM renderer
and into a dedicated compare renderer module.

This is a UI/UX implementation-architecture slice only. It does not change
compare behavior, visible copy, styling, menu behavior, playback, save
behavior, or product scope.

## Product And Design Boundary

- Product authority checked: `docs/product/PRODUCT_ROADMAP.md`.
- Design execution guidance checked:
  `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md` and `DESIGN.md`.
- PRD IDs touched: S10 optimization comparison flow and the general compare
  surface, without behavior changes.
- Main PRD and PM-owned docs were not edited.
- Automated smoke evidence remains regression evidence only. This review does
  not claim foreground macOS visual or interaction acceptance.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-renderers.mjs`
  - new compare renderer module.
  - owns compare slot title/meta/dataset updates, compare module/page-state
    trace updates, and compare info panel HTML placement.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
  - no longer owns compare-specific renderer functions.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - imports compare renderer functions from the compare renderer module.
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
  - adds the compare renderer module to the explicit dynamic DOM allowlist.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - adds structure assertions that compare DOM mutation belongs to the compare
    renderer module, not the generic renderer or app entry file.

## Requirement Checks

- S10 behavior remains unchanged: optimization compare still renders before/
  after slots, result metrics, action rows, skipped rows, and Save As entry.
- General compare behavior remains unchanged: A/B slot metadata, placeholder,
  and module trace still render through the same app calls.
- Dynamic visible DOM mutation remains limited to explicitly named renderer
  modules.
- No new visible components, labels, explanatory copy, or product actions were
  introduced.

## Verification

Passed:

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-renderers.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm run desktop:short-term:design-system-check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - 30/30 tests passed.
- `npm run desktop:smoke`
  - smoke result passed.
  - smoke result still reports `ownerUsability:false`, so it is not treated as
    owner-visible UI/UX acceptance.
- `git diff --check`

## Risks And Follow-up

- This slice improves renderer ownership, not visual quality.
- Foreground macOS screenshots with real production SVGA files are still
  required before any visual or interaction acceptance claim.
- The next useful architecture slice is to continue splitting generic DOM
  renderer groups by component family where that can be done without changing
  visible behavior.
