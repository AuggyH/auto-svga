# UI/UX Review: Canvas Mode Switch Polish

Date: 2026-07-06
Owner lane: UI/UX
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Polished the canvas-level Preview/Edit mode switch so it behaves visually like
a lightweight control over the canvas instead of a floating card. The outer
switch container is now transparent and shadowless, while the selected mode
keeps its blue pill affordance.

This review covers UI/UX implementation only. It does not change mode
availability, Preview/Edit behavior, keyboard order, product scope, or visible
product copy.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.molecules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority: aligned to `docs/product/PRODUCT_ROADMAP.md` S3 and S15.
- Visual direction: reduces boundary/card weight on the canvas while keeping
  the active mode discoverable.
- Design system: mode switch gap, padding, shadow, button color, hover, and
  selected shadow are tokenized and asserted in structural tests.
- Scope boundary: no product docs, renderer state model, event binding,
  controller logic, or visible copy changed.

## Verification

- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `git diff --check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

All checks passed.

## Foreground Evidence

Foreground evidence was captured from the real desktop client with native
window chrome, on the secondary display, using real recent production material
`战狼头像框.svga`.

Evidence folder:
`review/uiux-high-fidelity-packages/foreground-hf26-mode-switch-polish-20260706/`

Key screenshots:

- `00-full-display-mode-switch-light-real-material-active.png`
- `01-mode-switch-light-real-material.png`
- `02-mode-switch-dark-real-material.png`

Observed foreground checks:

- The canvas mode switch outer container renders with transparent background
  and no shadow.
- The active `预览模式` control remains visible and readable in light and dark
  modes.
- The switch no longer reads as an extra card layered on top of the canvas.

## Risks / Notes

- This slice validates the visual treatment of the mode switch only. It does
  not claim a new acceptance result for edit reserved content or right-surface
  mode-specific behavior.
- Smoke regression still covers Preview/Edit mode reachability.

## Next Step

Continue the high-fidelity line with another small Owner-visible surface and
keep validating with foreground desktop evidence plus smoke regression.
