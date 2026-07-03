# Short-term UI/UX WP6AQ Recent Renderer Boundary

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`
Status: completed

## Summary

Moved Launch recent-file DOM rendering out of the recent-files model and into
the shared short-term DOM renderer layer.

This is a UI/UX implementation-architecture slice only. It does not change
recent-file behavior, visible copy, styling, menu behavior, persistence, or
product scope.

## Product And Design Boundary

- Product authority checked: `docs/product/PRODUCT_ROADMAP.md`.
- Design execution guidance checked:
  `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md` and `DESIGN.md`.
- PRD ID touched: S16 recent SVGA files.
- Main PRD and PM-owned docs were not edited.
- Automated smoke evidence remains regression evidence only. This review does
  not claim foreground macOS visual or interaction acceptance.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-recent-files-model.mjs`
  - now owns only the Launch recent-record visibility limit and record slicing.
  - no longer imports HTML helpers or creates visible DOM.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
  - now owns `renderLaunchRecentFiles`,
    `renderRecentFilesUnavailable`, `createRecentFileRow`, and
    `createEmptyRecentFileRow`.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - imports recent render functions from the renderer layer.
  - keeps `visibleLaunchRecentRecords` from the recent-files model.
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
  - removes `short-term-macos-recent-files-model.mjs` from the dynamic DOM
    allowlist.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - adds structure assertions that recent-files model stays free of visible DOM
    mutation and recent rendering stays in the DOM renderer.

## Requirement Checks

- S16 behavior remains unchanged: Launch shows recent records through the same
  nodes and existing copy.
- The model-to-renderer boundary is now stricter: model code cannot regain
  visible DOM creation without failing the design-system check.
- No new visible components, labels, explanatory copy, or product actions were
  introduced.

## Verification

Passed:

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-recent-files-model.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm run desktop:short-term:design-system-check`
  - `visible-dom-owned-by-render-modules:short-term-macos-recent-files-model.mjs`
    passed with no dynamic DOM usage.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - 30/30 tests passed.
- `npm run desktop:smoke`
  - smoke result passed.
  - smoke result still reports `ownerUsability:false`, so it is not treated as
    owner-visible UI/UX acceptance.
- `git diff --check`

## Risks And Follow-up

- This slice improves model/render ownership, not visual quality.
- Foreground macOS screenshots with real production SVGA files are still
  required before any visual or interaction acceptance claim.
- The next useful design-system slice is to continue reducing renderer breadth
  by grouping DOM renderers by component family when that can be done without
  changing visible behavior.
