# UI/UX Review: Preview Information Polish

Date: 2026-07-06
Owner lane: UI/UX
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Polished the short-term Preview default information surface by restoring the
base metrics to a denser two-column rhythm and reducing the visual weight of
the `可优化` metric entries. This keeps the right surface useful for scanning
without letting the information area compete with the canvas.

This review covers UI/UX implementation only. It does not change product scope,
optimization detection, optimization execution, save behavior, compare behavior,
or visible product copy.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority: aligned to `docs/product/PRODUCT_ROADMAP.md` S3-S8.
- Visual direction: preserves the Owner-confirmed canvas-first,
  boundary-light direction and avoids adding helper text, labels, or
  annotations.
- Information density: keeps the Preview facts in a compact two-column
  structure instead of making the fifth metric span the full width.
- Design system: fact-grid spacing, fact label/value styles, and metric-entry
  tone are tokenized and covered by structural tests.
- Scope boundary: no product docs, renderer state model, optimizer API, save
  path, or compare/result logic changed.

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
`review/uiux-high-fidelity-packages/foreground-hf25-preview-information-polish-20260706/`

Key screenshots:

- `00-full-display-preview-information-light-real-material-active.png`
- `01-preview-information-light-real-material.png`
- `02-preview-information-dark-real-material.png`

Observed foreground checks:

- Preview facts remain readable and compact with five metrics and no full-width
  fifth fact cell.
- `可优化` remains available where the product surface requires it, but its
  visual tone is lighter than the previous stronger pill treatment.
- Light and dark modes both keep the canvas visually dominant while preserving
  right-surface readability.

## Risks / Notes

- This slice validates the default Preview information surface only. It does
  not claim a new acceptance result for optimization result comparison, compare
  empty states, or edit reserved mode.
- Smoke regression still covers the broader short-term flow matrix.

## Next Step

Continue the high-fidelity line with another small Owner-visible surface while
keeping each slice limited to one visual or interaction area and proving it with
foreground desktop evidence.
