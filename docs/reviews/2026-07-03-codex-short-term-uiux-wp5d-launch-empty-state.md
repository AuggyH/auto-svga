# 2026-07-03 Codex Short-Term UI/UX WP5D Launch Empty State

## Summary

WP5D refines the short-term launch screen while preserving the accepted product skeleton: the startup page remains a single full-window canvas with the drag prompt, primary open action, and low-priority recent files list inside the canvas. This pass moves launch sizing and recent-list structure into tokens/components, reduces recent-record prominence, and disables the clear action when the recent list is empty.

## Git State

- Base before this pass: `d7abb754 uiux: set short-term macos app identity`
- Existing PM-owned dirty files were observed and not touched:
  - `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
  - `docs/product/PRODUCT_ROADMAP.md`
  - `docs/product/MID_TERM_IMPLEMENTATION_PREP.md`
  - `docs/reviews/2026-07-03-codex-mid-term-implementation-prep.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
  - Adds launch title, content width, primary action width, and recent row/meta sizing tokens.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
  - Moves the large open button sizing to launch tokens instead of fixed one-off values.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.css`
  - Refines launch canvas spacing, launch prompt type scale, and recent-file list hierarchy.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Disables "清除记录" when there are no visible recent records and marks the empty row for lower-level styling.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Adds regression assertions for launch tokens and recent-list disabled-state wiring.
- `docs/reviews/2026-07-03-codex-short-term-uiux-wp5d-launch-empty-state.md`
  - Records this UI/UX validation pass.

## Requirement Checks

- Product scope: no new product feature or PM-owned PRD content changed.
- Launch skeleton: still one canvas area; no extra outer sidebar, toolbar, or card shell added.
- Visual hierarchy: drag prompt and "打开文件" remain primary; recent records remain secondary.
- Design-system discipline: new visual values are routed through tokens and component aliases.

## Verification

- `git diff --check -- tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css tools/electron-prototype/experiments/svga-web/web/short-term-macos.css tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - 29/29 tests passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
  - Smoke result passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac`
  - Internal `.app` rebuilt successfully.
- Foreground packaged-app screenshot:
  - `/tmp/auto-svga-uiux-wp5d-launch-20260703/01-launch-foreground-display2.png`

## Risks / Follow-Up

- The screenshot covers the empty recent-list state. A later pass should also inspect a populated recent-list state with long production filenames.
- The launch screen is now cleaner, but the broader app still needs deeper visual passes for loaded-file panels, keyboard focus flow, and minimum-window behavior.
