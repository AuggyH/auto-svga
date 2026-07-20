# Codex Review: Short-term UI/UX WP4B Component Layer

## Summary

Split the short-term macOS client styles into a reusable component layer after
the WP4A token extraction. This keeps behavior unchanged while moving buttons,
mode switch, tabs, fact cells, rows, thumbnails, badges, dialogs, context menus,
and empty states out of the page/module stylesheet.

This is a UI/UX architecture step only. It does not change PRD scope,
inspection logic, optimization logic, file opening, recent-file behavior, save
behavior, or playback behavior.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this slice: `829bbbc5 uiux: extract short-term macos design tokens`
- PM/product files were already dirty and remain intentionally unstaged:
  - `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
  - `docs/product/PRODUCT_ROADMAP.md`
  - `docs/product/MID_TERM_IMPLEMENTATION_PREP.md`
  - `docs/reviews/2026-07-03-codex-mid-term-implementation-prep.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/index.html`
  - Loads `short-term-macos.components.css` between token CSS and page CSS.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
  - New reusable component stylesheet.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.css`
  - Reduced to module and page-state styling.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Adds a regression contract that component styles are loaded and component
    selectors stay in the component layer.

## Requirement Checks

- Product authority: aligned to `PRODUCT_ROADMAP.md` S1-S16. No new feature or
  scope change.
- Design authority: follows `DESIGN.md` and the short-term UI/UX design-system
  spec requirement for tokenized, componentized, traceable UI code.
- Component trace improved:
  - `short-term-macos.tokens.css`: primitive/semantic/component tokens.
  - `short-term-macos.components.css`: atom/molecule/component rules.
  - `short-term-macos.css`: window shell, modules, and page states.
- Historical Web Preview/Electron/P6 visuals were not used as a visual
  baseline.
- UI labels remain Chinese-first.

## Verification

- `git diff --check` passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  passed: 29/29.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
  passed with `passed=true`.
- Foreground desktop validation used the real Electron client on the second
  display and system screenshots including macOS menu bar/titlebar context.
  Screenshots were saved outside the repo:
  - `/tmp/auto-svga-uiux-wp4b-real-20260703/01-launch-foreground-display2.png`
  - `/tmp/auto-svga-uiux-wp4b-real-20260703/02-real-recent-overview-foreground-display2.png`
  - `/tmp/auto-svga-uiux-wp4b-real-20260703/03-real-recent-optimization-foreground-display2.png`
  - `/tmp/auto-svga-uiux-wp4b-real-20260703/04-real-recent-replaceable-empty-foreground-display2.png`

## Validation Notes

- The real foreground Preview screenshots used an existing real recent SVGA
  record: `金焰藏宝箱头像框.svga`.
- I attempted to open additional real files from
  `/Users/huangtengxin/Downloads/auto-svga测试物料` through the macOS file picker,
  including temporary `/tmp` symlinks to avoid Chinese path input limitations.
  The file picker automation repeatedly lost focus or jumped back to Documents,
  so I did not treat that route as reliable evidence in this slice.
- Temporary symlinks were removed after validation.
- No Electron process was left running.

## Risks

- This slice is mostly structural. It does not yet improve the deeper high-
  fidelity visual quality, typography polish, density tuning, or interaction
  refinements that the Owner expects in later UI/UX passes.
- Component trace is now stronger in CSS, but the renderer JavaScript remains a
  large file and still needs a later behavior-neutral module split.
- Application menu identity still displays `Electron`; that is a packaging/app
  identity issue and was not changed here.

## Next Steps

1. Continue WP4C with a behavior-neutral renderer split for page states,
   modules, and component render helpers.
2. Then start a visual-quality pass with screenshots as the acceptance surface:
   toolbar density, inspector hierarchy, canvas framing, status copy, and
   focus/keyboard path.
