# Short-term UI/UX WP6AB Event Binding Split Review

Date: 2026-07-04
Owner: Codex UI/UX
Scope: short-term macOS client design-system structure

## Summary

Moved short-term client event binding out of the main app entry file and into a
dedicated interaction binding module. This continues the design-system
implementation cleanup by separating UI wiring from product orchestration while
keeping visible behavior unchanged.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this slice: `76659c9a`
- Working tree before edit: clean

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-event-bindings.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-uiux-wp6ab-event-binding-split.md`

## Requirement Checks

- Product authority: checked `docs/product/PRODUCT_ROADMAP.md`; short-term
  scope remains S1-S16.
- Design authority: checked `DESIGN.md` and
  `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`; this slice
  supports token-to-component-to-page implementation traceability by giving UI
  event wiring its own source boundary.
- Ownership boundary: no PM-owned product docs changed.
- Scope boundary: no new visible text, no new action, no feature behavior
  change.

## Implementation Notes

- Added `bindShortTermInteractionEvents()` to
  `short-term-macos-event-bindings.mjs`.
- Moved click, keyboard, tab, context menu, replacement file input, runtime text
  dialog key handling, and launch drop-zone event registration out of
  `short-term-macos-app.mjs`.
- Kept the existing app-level handlers and state ownership in
  `short-term-macos-app.mjs`; the binding module receives handlers instead of
  redefining product behavior.
- Added a small `eventElement()` helper so delegated event handling tolerates
  non-Element event targets.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.

## Foreground Evidence

Not collected for this slice. This is an internal event-wiring structure change
and does not alter visible layout. Foreground macOS screenshots remain required
before any visual or interaction acceptance claim.

## Risks

- The app entry file still owns broad orchestration and smoke flow. Future
  splits should remain narrow, with tests proving behavior remains unchanged.
- This does not improve visual styling by itself; it reduces implementation
  drift risk so later visual work has cleaner boundaries.

## Next Steps

- Continue extracting narrow UI orchestration boundaries from
  `short-term-macos-app.mjs`.
- Keep foreground desktop validation separate from automated smoke regression.
