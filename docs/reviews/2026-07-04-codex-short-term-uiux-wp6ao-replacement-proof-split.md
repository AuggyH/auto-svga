# Short-term UI/UX WP6AO Replacement Proof Split

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`
Status: completed

## Summary

Moved the short-term runtime image replacement smoke proof builder out of the
main short-term macOS app entry file and into the shared smoke proof model.

This is a UI/UX implementation-architecture slice only. It does not change
visible UI copy, styling, menu structure, save behavior, replacement behavior,
or product scope.

## Product And Design Boundary

- Product authority checked: `docs/product/PRODUCT_ROADMAP.md`.
- Design execution guidance checked:
  `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md` and `DESIGN.md`.
- PRD IDs touched: S12 runtime image replacement preview and S14 persisted
  output save-state proof.
- Main PRD and PM-owned docs were not edited.
- Automated smoke evidence remains regression evidence only. This review does
  not claim foreground macOS visual or interaction acceptance.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - imports and calls `collectShortTermReplacementProof`.
  - no longer owns the inline `short-term-replacement-proof` object.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
  - adds `collectShortTermReplacementProof`.
  - keeps replacement proof schema, PRD IDs, reset checks, preview-mode check,
    save-state check, and source-byte immutability check in the proof model.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - updates structure assertions so replacement proof construction must stay in
    the smoke proof model instead of the app entry file.

## Requirement Checks

- S12: Runtime image replacement proof still checks preview mode remains active,
  replacement canvas renders, reset command is enabled, reset restores original
  preview bytes, and reset clears output state.
- S14: Replacement output proof still checks an edited byte candidate exists
  before reset and Save As is enabled before reset.
- Source safety: the proof still checks original source bytes are unchanged by
  runtime replacement.
- No new visible components, labels, explanatory copy, or product actions were
  introduced.

## Verification

Passed:

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm run desktop:short-term:design-system-check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - 30/30 tests passed.
- `npm run desktop:smoke`
  - smoke result passed and included `shortTermReplacementProof:true`.
  - smoke result still reports `ownerUsability:false`, so it is not treated as
    owner-visible UI/UX acceptance.
- `git diff --check`

## Risks And Follow-up

- This slice improves evidence/model ownership, not visual quality.
- Foreground macOS screenshots with real production SVGA files are still
  required before any visual or interaction acceptance claim.
- Remaining proof blocks that still need similar model ownership cleanup include
  open-flow and load-failure proof paths.
