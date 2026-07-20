# Short-term UI/UX WP6AR Dynamic DOM Guard

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`
Status: completed

## Summary

Tightened the short-term design-system check so dynamic visible DOM mutation is
allowed only in the shared DOM renderer layer.

This is a guardrail slice only. It does not change visible UI copy, styling,
menus, recent-file behavior, playback behavior, or product scope.

## Product And Design Boundary

- Product authority checked: `docs/product/PRODUCT_ROADMAP.md`.
- Design execution guidance checked:
  `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md` and `DESIGN.md`.
- PRD IDs touched: none directly; this supports S1-S16 design-to-code
  traceability.
- Main PRD and PM-owned docs were not edited.
- Automated smoke evidence remains regression evidence only. This review does
  not claim foreground macOS visual or interaction acceptance.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
  - removes `short-term-macos-compare-model.mjs` and
    `short-term-macos-render-model.mjs` from the dynamic DOM allowlist.
  - leaves `short-term-macos-dom-renderers.mjs` as the only allowed dynamic DOM
    owner.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - adds a structure assertion that the dynamic DOM allowlist stays narrowed to
    the renderer layer.

## Requirement Checks

- The design-system check now fails if non-renderer short-term model files add
  `document.createElement`, `innerHTML`, direct class assignment, or similar
  visible DOM mutation.
- Current compare and render model files pass because they have no dynamic DOM
  mutation usage.
- No visible components, labels, explanatory copy, or product actions were
  introduced.

## Verification

Passed:

- `node --check tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `npm run desktop:short-term:design-system-check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - 30/30 tests passed after adding the missing `readFileSync` import for the
    new test assertion.
- `npm run desktop:smoke`
  - smoke result passed.
  - smoke result still reports `ownerUsability:false`, so it is not treated as
    owner-visible UI/UX acceptance.
- `git diff --check`

## Risks And Follow-up

- This guard checks dynamic DOM mutation patterns, not every possible HTML
  string helper. Further tightening should be done only after deciding whether
  pure HTML string helpers belong in `render-model` or a dedicated renderer
  family module.
- Foreground macOS screenshots with real production SVGA files are still
  required before any visual or interaction acceptance claim.
