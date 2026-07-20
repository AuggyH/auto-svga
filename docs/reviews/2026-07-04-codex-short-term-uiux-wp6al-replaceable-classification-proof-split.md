# Short-term UI/UX WP6AL Replaceable Classification Proof Split Review

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

This slice moves the short-term replaceable-element classification smoke proof
builder out of the main renderer entry and into the smoke proof model.

The change is report-structure-only. It does not change replaceable-element
classification logic, visible UI, copy, styling, layout, menus, rename,
replacement, or save behavior.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
  - Added `collectShortTermReplaceableClassificationProof(...)`.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Replaced inline S7 classification proof construction with a helper call.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Updated structure assertions so the S7 proof builder is guarded in the
    smoke proof module, not inline in the renderer entry.

## Requirement Checks

- PRD authority: no change to `docs/product/PRODUCT_ROADMAP.md`.
- Related short-term ID: S7 proof construction remains behaviorally
  equivalent.
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
`shortTermReplaceableClassificationProof: true`.

## Risks And Follow-up

- This is not a design-quality acceptance checkpoint. Foreground macOS
  screenshots using real production SVGA files are still required before
  claiming visual or interaction acceptance.
- Larger proof blocks for optimization, rename, replacement, open flow, and
  load failure remain in `short-term-macos-app.mjs`.
