# UI/UX Review: Edit Layer List Polish

Date: 2026-07-06
Owner lane: UI/UX
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Polished the Edit mode layer list by removing per-row divider lines and using a
small tokenized list gap instead. The list now reads through thumbnails and
layer names, rather than repeated horizontal rules.

This review covers UI/UX implementation only. It does not add layer selection,
editing operations, inactive future controls, or new visible copy.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority: aligned to `docs/product/PRODUCT_ROADMAP.md` Edit mode,
  which keeps the short-term surface to a left layer list, center canvas, and
  empty right operation panel.
- Visual direction: reduces line-based hierarchy in the left panel while
  keeping layer thumbnails and names readable.
- Design system: layer row divider and layer list gap are tokenized and
  asserted.
- Scope boundary: no product docs, renderer state model, layer data source,
  edit operations, reserved panel behavior, or visible copy changed.

## Verification

- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `git diff --check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

All checks passed.

## Foreground Evidence

Foreground evidence was captured from the real desktop client with the macOS
menu bar and native window chrome visible, on the secondary display, using real
recent production material `战狼头像框.svga`.

Evidence folder:
`review/uiux-high-fidelity-packages/foreground-hf32-edit-layer-polish-20260706/`

Key screenshots:

- `00-display2-edit-light-current.png`
- `01-display2-edit-light-layer-polish.png`
- `02-display2-edit-dark-layer-polish.png`

Observed foreground checks:

- Edit mode renders 32 layer rows from the real material.
- Layer panel gap computes to `4px`.
- Layer row bottom divider computes to `0px solid`.
- The right reserved operation panel remains empty, with no inactive future
  controls.

## Risks / Notes

- This slice validates Edit mode layer-list visual weight only. It does not
  change the short-term edit capability boundary.
- Smoke regression still covers desktop launch, open, playback, compare,
  optimization, replacement, menu, settings, and edit-mode reachability.

## Next Step

Continue the high-fidelity line with another small Owner-visible surface,
validated through foreground screenshots and smoke regression before packaging.
