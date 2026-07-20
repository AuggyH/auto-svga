# Short-term UI/UX WP6AH Smoke Artifact Capture Split Review

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

This slice continues the short-term UI/UX implementation cleanup by moving
smoke-only screenshot artifact capture accounting out of the main renderer
entry file and into the smoke proof model.

The change does not alter product scope, visible UI, copy, layout, menu items,
or desktop behavior. It only narrows `short-term-macos-app.mjs` toward flow
orchestration while keeping proof helper state inside
`short-term-macos-smoke-proof-model.mjs`.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
  - Added `createSmokeArtifactCapture(bridge)` to own smoke screenshot capture
    bookkeeping and aggregate pass checks.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Replaced local `screenshotCaptures` state with the smoke proof helper.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Added structure assertions that the helper exists and the renderer entry no
    longer owns the screenshot capture array.

## Requirement Checks

- PRD authority: `docs/product/PRODUCT_ROADMAP.md` remains the sole product
  authority; this slice does not change S1-S16 behavior.
- UI/UX execution plan: supports the token/component/page-state implementation
  direction by reducing one-off proof logic in the app entry.
- Owner-visible surface: no visible text, styling, layout, menu, or interaction
  changes.
- Validation boundary: automated smoke remains regression evidence only. This
  review does not claim foreground macOS visual or interaction acceptance.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `npm run desktop:short-term:design-system-check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm run desktop:smoke`

Result: all commands passed.

## Risks And Follow-up

- This is structural cleanup only; foreground desktop screenshots with real
  production SVGA materials are still required before claiming visual or
  interaction acceptance.
- More smoke/proof helpers can still be split from the renderer entry in later
  small slices, as long as product behavior and visible UI remain unchanged.
