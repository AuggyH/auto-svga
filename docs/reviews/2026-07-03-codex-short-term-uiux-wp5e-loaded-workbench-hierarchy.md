# 2026-07-03 Codex Short-Term UI/UX WP5E Loaded Workbench Hierarchy

## Summary

WP5E refines the loaded-file preview workbench using a real production SVGA. The pass keeps all short-term product behavior intact and adjusts only tokenized UI styling for the preview grid, playback bar, inspector tabs, production-spec fact cells, asset rows, and badges. The goal is to reduce the engineering-shell feel of the right inspector while keeping the opened SVGA visually dominant.

## Git State

- Base before this pass: `536ab538 uiux: refine short-term launch empty state`
- Existing PM-owned dirty files were observed and not touched:
  - `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
  - `docs/product/PRODUCT_ROADMAP.md`
  - `docs/product/MID_TERM_IMPLEMENTATION_PREP.md`
  - `docs/reviews/2026-07-03-codex-mid-term-implementation-prep.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
  - Adds preview gap and playback bar component tokens.
  - Tightens fact-cell and asset-row component sizing through token values.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
  - Refines tabs, fact cells, asset rows, and badges.
  - Lowers fail/warning card surface intensity while preserving the status stripe and status text.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.css`
  - Routes loaded preview spacing and playback bar height through component tokens.
  - Adds subtle panel surface treatment without adding decorative cards.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Adds regression assertions for the new loaded-workbench component tokens.
- `docs/reviews/2026-07-03-codex-short-term-uiux-wp5e-loaded-workbench-hierarchy.md`
  - Records this UI/UX validation pass.

## Requirement Checks

- Product scope: no parsing, optimization, replacement, save, recent-file, or product-document behavior changed.
- UI/UX scope: aligns with Preview mode as the complete short-term surface and keeps Edit mode untouched.
- Design-system discipline: all new visual values were introduced as component tokens or token aliases before page/component use.
- Visual hierarchy: the canvas remains primary; the inspector becomes quieter and more scannable.

## Verification

- `git diff --check -- tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css tools/electron-prototype/experiments/svga-web/web/short-term-macos.css tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - 29/29 tests passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
  - Smoke result passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac`
  - Internal `.app` rebuilt successfully for foreground verification.
- Real production SVGA used for visual QA:
  - `/Users/huangtengxin/Downloads/auto-svga测试物料/头像框/战狼头像框/战狼头像框.svga`
- Foreground packaged-app screenshot:
  - `/tmp/auto-svga-uiux-wp5e-loaded-20260703/07-loaded-real-large-final-display2.png`

## Risks / Follow-Up

- This pass validates a large 300 x 300 avatar-frame SVGA. A later pass should also capture a smaller 100-200 KiB file and a text/replaceable-heavy file if available.
- Keyboard focus order and minimum-window behavior still need a dedicated UX pass; this pass only preserved existing focus styling while adjusting visual hierarchy.
