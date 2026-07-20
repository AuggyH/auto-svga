# Short-Term UI/UX WP5F Keyboard And Scroll Polish Review

## Summary

This pass continues the short-term macOS client UI/UX refactor after the loaded
workbench hierarchy pass. It improves keyboard and scroll affordances without
changing product scope or SVGA processing logic.

Owner-facing intent:

- Make inspector tab panels reachable as independent scroll regions.
- Make replaceable image rows and runtime text rows usable from keyboard.
- Keep visible focus treatment tokenized and consistent with the design-system
  hierarchy.
- Reduce vertical pressure at the minimum supported desktop window height.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this pass: `4ed9c97c`
- Protected PM-owned dirty files were present and intentionally not touched:
  - `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
  - `docs/product/PRODUCT_ROADMAP.md`
  - `docs/product/MID_TERM_IMPLEMENTATION_PREP.md`
  - `docs/reviews/2026-07-03-codex-mid-term-implementation-prep.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-03-codex-short-term-uiux-wp5f-keyboard-scroll.md`

## Requirement Checks

- PRD authority: no product scope change. Work remains within short-term UI/UX
  execution and S1-S16 client behavior.
- Design-system discipline: new visual values are expressed through
  `--asv-*` tokens and consumed by component/page CSS.
- Component hierarchy: changes stay in token, component, page, and renderer
  layers; no duplicate button/menu/list systems were introduced.
- macOS experience: row activation, context menu discovery, focus visibility,
  and inspector scrolling are closer to native desktop expectations.
- Functional boundary: no SVGA parsing, optimization, rename, replacement,
  save, recent-file, or menu business logic was changed.

## Verification

- `git diff --check` passed for touched files.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  passed, 29/29.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
  first run failed due to an Electron screenshot IPC race after the window had
  already been destroyed. A direct rerun passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac`
  passed and produced the internal unsigned macOS trial package.
- Foreground packaged-App validation used real production material:
  `/Users/huangtengxin/Downloads/auto-svga测试物料/头像框/战狼头像框/战狼头像框.svga`.
- Foreground screenshot evidence:
  `/tmp/auto-svga-uiux-wp5f-keyboard-scroll/02-loaded-minimum-real-display1.png`
- Display note: only one monitor was available during this pass, so the
  second-display foreground check was skipped.

## Risks And Gaps

- The desktop smoke suite still has an occasional screenshot-capture race in
  Electron. It passed on rerun, and this pass did not modify the capture
  pipeline.
- This is still UI/UX polish on the current HTML/CSS/renderer structure. A
  future pass should keep reducing one-off renderer behavior into reusable
  UI modules where it does not disturb product logic.
- Foreground validation covered one large real SVGA after prior multi-file
  checks in earlier UI/UX passes; it did not repeat the full real-material
  matrix in this pass to reduce user interruption.

## Next Step

Continue with a narrow visual-system pass on toolbar/action density and
inspector list polish, still avoiding product scope or PM-owned documentation.
