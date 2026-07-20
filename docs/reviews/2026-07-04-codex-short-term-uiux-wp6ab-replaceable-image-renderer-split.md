# Short-term UI/UX WP6AB Replaceable Image Renderer Split

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Continued the short-term macOS client UI/UX componentization pass by moving
replaceable-image list DOM rendering out of the app entry file and into the
short-term DOM renderer module.

This is a structural UI implementation slice only. It does not change product
scope, user-facing copy, visible interaction flow, recent-file behavior,
optimization behavior, replacement behavior, or PRD-owned documents.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority: `docs/product/PRODUCT_ROADMAP.md` remains the sole PRD
  authority. No PRD-owned files were changed.
- UI/UX authority: follows the design-system direction in `DESIGN.md` and the
  short-term UI/UX redesign execution plan by reducing app-entry DOM ownership
  and strengthening component/module boundaries.
- Scope boundary: no new labels, explanatory text, UI states, or product
  components were introduced.
- Replaceable image behavior: still uses the existing replaceable model view
  and selected/renaming state; only render placement moved.

## Verification

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

Result: all checks passed.

## Notes

- The new regression assertions keep direct replaceable-list DOM replacement and
  summary text assignment out of `short-term-macos-app.mjs`.
- `desktop:smoke` is automated regression evidence only. It does not replace a
  future foreground macOS visual review with real production SVGA materials.

## Risks

- This slice improves structure, not high-fidelity styling. The broader visual
  quality pass remains open.
- The current short-term renderer still contains more component extraction
  opportunities; this change deliberately stays small to reduce regression risk.

## Next Step

Continue WP6AB componentization by moving the next repeated row/list render
responsibility from the app entry into a renderer/component module, then pair it
with design-oriented keyboard, focus, and minimum-window validation.
