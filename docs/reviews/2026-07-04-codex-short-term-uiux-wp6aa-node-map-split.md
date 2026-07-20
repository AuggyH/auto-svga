# Short-term UI/UX WP6AA Node Map Split Review

Date: 2026-07-04
Owner: Codex UI/UX
Scope: short-term macOS client design-system structure

## Summary

Moved the short-term client's DOM node collection out of the main app entry
file and into a dedicated node-map module. This continues the design-system
implementation cleanup without changing product behavior, visible copy, layout,
or runtime flows.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this slice: `b74c21bf`
- Working tree before edit: clean

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-nodes.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-uiux-wp6aa-node-map-split.md`

## Requirement Checks

- Product authority: checked `docs/product/PRODUCT_ROADMAP.md`; short-term
  scope remains S1-S16.
- Design authority: checked `DESIGN.md` and
  `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`; this slice
  supports implementation traceability from page state and component modules
  down to smaller UI units.
- Ownership boundary: no PM-owned product docs changed.
- Scope boundary: no new visible UI text, no new interaction, no product logic
  change.

## Implementation Notes

- Added `collectShortTermNodes()` in `short-term-macos-nodes.mjs`.
- Replaced the large inline `const nodes = { ... }` map in
  `short-term-macos-app.mjs` with `collectShortTermNodes()`.
- Updated structural tests so selector ownership is checked in the node-map
  module instead of the entry file.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.

## Foreground Evidence

Not collected for this slice. This is an internal structure change and does not
alter visible layout. Foreground macOS screenshots remain required before any
visual or interaction acceptance claim.

## Risks

- The app entry file still owns substantial orchestration. Further splits
  should stay narrow and keep product behavior unchanged.
- The smoke proof model is still intentionally large because it records many
  acceptance scenarios; it should be split only when a narrow, low-risk boundary
  is available.

## Next Steps

- Continue extracting narrow UI orchestration boundaries from
  `short-term-macos-app.mjs`.
- Keep foreground client validation separate from smoke regression evidence.
