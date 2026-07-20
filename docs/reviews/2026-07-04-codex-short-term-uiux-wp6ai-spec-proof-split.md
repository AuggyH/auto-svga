# Short-term UI/UX WP6AI Spec Proof Split Review

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

This slice moves the short-term S4 production-spec comparison smoke proof
builder out of the main renderer entry and into the smoke proof model.

The change is proof-structure-only. It does not change the Overview facts,
production-spec display, visible copy, styling, layout, menus, or runtime
product behavior.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
  - Added `collectShortTermSpecComparisonProof(...)` for S4 smoke proof
    construction and pass derivation.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Replaced the inline S4 proof object with a helper call.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Added structure checks that the S4 proof builder lives in the smoke proof
    model, not inline in the renderer entry.

## Requirement Checks

- PRD authority: no change to `docs/product/PRODUCT_ROADMAP.md`; S4 behavior
  remains the same.
- UI/UX execution plan: supports componentized/code ownership cleanup by moving
  proof construction out of the page entry.
- Owner-visible surface: unchanged.
- Validation boundary: automated smoke evidence remains regression evidence,
  not visual or interaction acceptance.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `npm run desktop:short-term:design-system-check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm run desktop:smoke`

Result: all commands passed. Desktop smoke still reports
`shortTermSpecComparisonProof: true`.

## Risks And Follow-up

- This is not a visual/UI acceptance checkpoint. Foreground macOS screenshots
  with real production SVGA files remain required before claiming design
  quality acceptance.
- More large inline smoke proof objects remain in `short-term-macos-app.mjs`
  and can be split in similarly small, behavior-preserving slices.
