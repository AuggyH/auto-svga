# Short-term UI/UX WP6AB Status Text Renderer Split

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Continued the short-term macOS client UI/UX componentization pass by moving
status text DOM writes out of the app entry file and into the short-term DOM
renderer module.

The app entry still decides the state and copy for loading, file header,
discard confirmation, and failure recovery. The renderer now owns writing those
values into the visible DOM nodes.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority: `docs/product/PRODUCT_ROADMAP.md` remains the sole PRD
  authority. No PRD-owned files were changed.
- UI/UX authority: follows `DESIGN.md` and the short-term UI/UX redesign
  execution plan by keeping visible state rendering behind a renderer boundary.
- Scope boundary: no loading copy, file identity copy, playback metadata copy,
  discard prompt, error recovery copy, product state, or interaction changed.
- Owner correction boundary: no explanatory UI copy, duplicate summary text, or
  inspector/checker framing was introduced.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
- `git diff --check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

Result: all checks passed.

## Notes

- New regression assertions keep direct `textContent` assignments for loading,
  file header, playback metadata, discard message, and failure message out of
  `short-term-macos-app.mjs`.
- Reading these nodes in smoke/proof collection remains in the app entry because
  those reads are evidence collection, not rendering.
- `desktop:smoke` remains automated regression evidence only. It is not a
  substitute for future foreground macOS visual review using real production
  SVGA materials.

## Risks

- This slice improves structure only; it does not claim final visual polish or
  final interaction acceptance.
- Further decomposition is still needed around dialog input, drag/drop state,
  and proof collection.

## Next Step

Continue WP6AB by moving another owner-visible DOM responsibility behind a
renderer/module boundary, then start a focused design-validation pass once the
app entry is no longer carrying most visible rendering.
