# Short-term UI/UX WP6AM Optimization Proof Split Review

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

This slice moves the short-term optimization smoke proof builder out of the
main renderer entry and into the smoke proof model.

The optimization execution flow remains unchanged. This slice only moves the
report-shaping and pass-derivation object after optimization has already run.
It does not change visible UI, copy, styling, layout, menus, optimization
behavior, comparison behavior, or save behavior.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
  - Added `collectShortTermOptimizationProof(...)`.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Replaced inline S8/S9/S10/S14 optimization proof construction with a helper
    call.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Updated structure assertions so the optimization proof builder is guarded
    in the smoke proof module, not inline in the renderer entry.

## Requirement Checks

- PRD authority: no change to `docs/product/PRODUCT_ROADMAP.md`.
- Related short-term IDs: S8, S9, S10, and S14 proof construction remains
  behaviorally equivalent.
- UI/UX execution plan: continues reducing one-off proof structure in the
  renderer entry toward a traceable module boundary.
- Owner-visible surface: unchanged.
- Validation boundary: automated smoke remains regression evidence only and
  does not claim foreground macOS visual acceptance.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `npm run desktop:short-term:design-system-check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm run desktop:smoke`

Result: all commands passed. Desktop smoke still reports
`shortTermOptimizationProof: true`.

## Risks And Follow-up

- This is not a design-quality acceptance checkpoint. Foreground macOS
  screenshots using real production SVGA files are still required before
  claiming visual or interaction acceptance.
- Larger proof blocks for rename, replacement, open flow, and load failure
  remain in `short-term-macos-app.mjs`.
