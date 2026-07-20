# UI/UX Review: Playback Control Polish

Date: 2026-07-06
Owner lane: UI/UX
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Polished the bottom `PlaybackControls` surface so the secondary replay control
and progress track sit more lightly on the canvas. The primary play/pause
button remains the strongest control, while the replay button no longer reads
as a small filled tile by default.

This review covers UI/UX implementation only. It does not add playback
features, change playback behavior, alter timing, or introduce new visible
copy.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority: aligned to `docs/product/PRODUCT_ROADMAP.md` S2 and the
  Owner-confirmed canvas-first visual direction.
- Visual direction: reduces bottom-control weight without hiding existing
  playback actions.
- Design system: replay-control shadow and progress-track background/ring are
  tokenized and asserted.
- Scope boundary: no product docs, renderer state model, playback timing,
  compare playback state, or visible copy changed.

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
`review/uiux-high-fidelity-packages/foreground-hf31-playback-polish-20260706/`

Key screenshots:

- `06-display2-playback-dark-real-material.png`
- `07-display2-playback-light-real-material.png`

Observed foreground checks:

- The replay button is visible but no longer competes with the primary
  play/pause button.
- The progress track remains readable in light and dark appearance.
- The playback bar stays anchored to the canvas and does not overlap the right
  information surface.

## Risks / Notes

- This slice validates only the existing playback control surface. It does not
  add loop, fullscreen, scrubbing, or timeline editing controls.
- Smoke regression still covers desktop launch, open, playback, compare,
  optimization, replacement, menu, and settings flows.

## Next Step

Continue the high-fidelity line with another small Owner-visible surface,
validated through foreground screenshots and smoke regression before packaging.
