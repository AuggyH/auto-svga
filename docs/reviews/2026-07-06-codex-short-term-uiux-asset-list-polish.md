# UI/UX Review: Asset List Polish

Date: 2026-07-06
Owner lane: UI/UX
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Polished the Preview resource list by removing the remaining row divider and
hover fill treatment from `AssetRow`. The list now reads as a lightweight
thumbnail-and-text resource list instead of a stack of small cards.

This review covers UI/UX implementation only. It does not change resource
classification, thumbnails, context menus, replacement behavior, product scope,
or visible product copy.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority: aligned to `docs/product/PRODUCT_ROADMAP.md` S3, S5, and
  S6.
- Visual direction: reduces line/card weight in the right surface while keeping
  resource thumbnails, names, and metadata visible.
- Design system: asset-list gap, row divider, and hover background are
  tokenized and asserted.
- Scope boundary: no product docs, renderer state model, resource model,
  replacement flow, context menu behavior, or visible copy changed.

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
`review/uiux-high-fidelity-packages/foreground-hf29-asset-list-polish-20260706/`

Key screenshots:

- `00-full-display-asset-list-light-real-material-active.png`
- `01-asset-list-light-real-material.png`
- `02-asset-list-dark-real-material.png`

Observed foreground checks:

- The real material renders 91 resource rows.
- `AssetRow` renders with transparent background, no shadow, and 0px
  transparent bottom border.
- Light and dark modes keep the resource list readable without making rows
  look like individual cards.

## Risks / Notes

- This slice validates the Preview resource list only. It does not claim a new
  acceptance result for replaceable rows, edit-mode layer rows, or context-menu
  keyboard behavior.
- Smoke regression still covers thumbnails, replaceable classification,
  replacement, rename, and resource-menu keyboard behavior.

## Next Step

Continue the high-fidelity line with another small Owner-visible surface,
validated through foreground screenshots and smoke regression before packaging.
