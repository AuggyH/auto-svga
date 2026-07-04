# Short-term UI/UX WP6AD Command Surface Split Review

Date: 2026-07-04
Owner: Codex UI/UX
Scope: short-term macOS client implementation structure

## Summary

Moved short-term command-surface rendering out of the main app entry file and
into a dedicated command-surface module. This separates command state
build/apply/menu-sync responsibilities from broader app orchestration without
changing any visible controls or product behavior.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this slice: `6b38cdfa`
- Working tree before edit: clean

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-command-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-uiux-wp6ad-command-surface-split.md`

## Requirement Checks

- Product authority: checked `docs/product/PRODUCT_ROADMAP.md`; short-term
  scope remains S1-S16.
- Design authority: checked `DESIGN.md`; this slice supports design-system
  traceability by giving toolbar/action/menu state a named implementation
  surface.
- Ownership boundary: no PM-owned product docs changed.
- Scope boundary: no new visible UI, no copy change, no product action change.

## Implementation Notes

- Added `renderShortTermCommandSurface()` in
  `short-term-macos-command-surface.mjs`.
- Moved `buildCommandState`, `applyCommandState`, `hasOpenDialog`, and
  `syncShortTermMenuState` coordination out of `short-term-macos-app.mjs`.
- Kept the app entry file responsible for deciding when command state refreshes.
- Updated structural tests to assert command-surface ownership in the new
  module.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.

## Foreground Evidence

Not collected for this slice. This is an internal command-surface structure
change and does not alter visible layout. Foreground macOS screenshots remain
required before any visual or interaction acceptance claim.

## Risks

- Command state is central to save/menu availability; future edits should keep
  smoke and command-state tests close to this module.
- The app entry file still owns file loading and smoke orchestration. Split
  those only along narrow, proven boundaries.

## Next Steps

- Continue extracting focused UI implementation surfaces from
  `short-term-macos-app.mjs`.
- Keep foreground desktop validation separate from automated smoke regression.
