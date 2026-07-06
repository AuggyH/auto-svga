# UI/UX Review: Compare Empty State Polish

Date: 2026-07-06
Owner lane: UI/UX
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Polished the general compare empty state by hiding the canvas-corner A/B file
labels. The compare canvases now stay visually clean, with file status carried
by the right comparison information surface instead of duplicated engineering
labels inside the canvas.

This review covers UI/UX implementation only. It does not change compare entry,
file opening, disabled playback, comparison data, or visible product copy.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority: aligned to `docs/product/PRODUCT_ROADMAP.md` general
  comparison mode, including two canvases and one right comparison panel.
- Visual direction: removes duplicated canvas labels and keeps the compare
  canvas immersive.
- Design system: the hidden canvas header behavior is asserted so future
  changes do not reintroduce visible A/B labels in the canvas.
- Scope boundary: no product docs, renderer state model, compare file loading,
  right comparison panel, or visible copy changed.

## Verification

- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `git diff --check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

All checks passed.

## Foreground Evidence

Foreground evidence was captured from the real desktop client with the macOS
menu bar and native window chrome visible, on the secondary display.

Evidence folder:
`review/uiux-high-fidelity-packages/foreground-hf33-compare-empty-review-20260706/`

Key screenshots:

- `00-display2-compare-empty-light-current.png`
- `02-display2-compare-empty-light-polish.png`
- `03-display2-compare-empty-dark-polish.png`

Observed foreground checks:

- Empty compare state keeps two canvas open actions.
- Disabled playback controls remain visible.
- Canvas-corner A/B labels are hidden.
- Right compare information still shows A/B file status.

## Risks / Notes

- This slice validates compare empty state only. Loaded compare and
  optimization result comparison still need final visual review.

## Next Step

Move to loaded compare and optimization result states, then run the final
short-term UI/UX completion pass.
