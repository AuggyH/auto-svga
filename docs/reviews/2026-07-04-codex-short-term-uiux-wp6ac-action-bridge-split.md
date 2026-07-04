# Short-term UI/UX WP6AC Action Bridge Split Review

Date: 2026-07-04
Owner: Codex UI/UX
Scope: short-term macOS client implementation structure

## Summary

Moved the short-term client's host/smoke action bridge out of the main app
entry file and into a dedicated action-bridge module. This keeps the entry file
focused on app orchestration while preserving the same command surface used by
desktop proof and smoke flows.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this slice: `1d4ed815`
- Working tree before edit: clean

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-action-bridge.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-uiux-wp6ac-action-bridge-split.md`

## Requirement Checks

- Product authority: checked `docs/product/PRODUCT_ROADMAP.md`; short-term
  scope remains S1-S16.
- Design authority: checked `DESIGN.md` and
  `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`; this slice
  supports clearer implementation traceability by separating host action
  exposure from page orchestration.
- Ownership boundary: no PM-owned product docs changed.
- Scope boundary: no new visible UI, no action rename, no feature behavior
  change.

## Implementation Notes

- Added `installShortTermActionBridge()` in
  `short-term-macos-action-bridge.mjs`.
- Moved `window.__autoSvgaShortTermActions = Object.freeze(...)` out of
  `short-term-macos-app.mjs`.
- Kept the existing action names and handler mapping intact.
- Updated structural tests so action bridge ownership is checked in the new
  module.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.

## Foreground Evidence

Not collected for this slice. This is an internal host/smoke action bridge
structure change and does not alter visible layout. Foreground macOS
screenshots remain required before any visual or interaction acceptance claim.

## Risks

- The bridge remains a test/host command surface. Future changes should not use
  it to bypass visible product flows or claim owner acceptance.
- The app entry file still owns smoke orchestration; split only when a narrow
  and well-tested boundary is available.

## Next Steps

- Continue extracting narrow UI implementation boundaries from
  `short-term-macos-app.mjs`.
- Keep foreground desktop validation separate from automated smoke regression.
