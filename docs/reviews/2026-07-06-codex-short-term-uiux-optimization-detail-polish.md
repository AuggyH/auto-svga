# UI/UX Review: Optimization Detail Polish

Date: 2026-07-06
Owner lane: UI/UX
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Polished the short-term optimization detail surface by making
`OptimizationFindingRow` lighter and more consistent with the Owner-confirmed
canvas-first, boundary-light direction. The finding row now uses dedicated
finding-row component tokens for spacing, status rail, background, title, and
radius instead of inheriting the heavier generic card row feel.

This review covers UI/UX implementation only. It does not change optimization
detection, execution, save behavior, PRD scope, or visible product copy.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority: aligned to `docs/product/PRODUCT_ROADMAP.md` S8-S10.
- Visual direction: reduces card/outline weight in the optimization detail
  surface without adding helper text or status labels.
- Design system: finding-row visual values are tokenized and asserted in the
  structural test.
- Scope boundary: no product docs, optimization model, optimizer API, save
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
`酷鹅玫影头像框.svga`.

Evidence folder:
`review/uiux-high-fidelity-packages/foreground-hf24-optimization-detail-polish-20260706/`

Key screenshots:

- `00-full-display-optimization-detail-light-real-material-active.png`
- `01-optimization-detail-light-real-material.png`
- `02-optimization-detail-dark-real-material.png`

Observed foreground checks:

- Optimization detail shows one review-only finding row for the real material.
- `OptimizationFindingRow` renders with 0px visible border and a lighter
  status rail/fill.
- The `一键优化` action remains disabled because this real file has no safe
  executable optimization item.

## Risks / Notes

- Real recent materials tested in this slice did not contain a safe executable
  optimization candidate. This review therefore does not claim foreground
  acceptance of the optimization result comparison page.
- Smoke regression still covers the optimizer result flow with its dedicated
  optimization fixture.

## Next Step

Continue the high-fidelity line with another small Owner-visible surface,
preferably one that can be validated with real production material in the
foreground client.
