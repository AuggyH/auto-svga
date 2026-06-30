# SVGA Workbench UI/UX Repair

Date: 2026-06-30
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Continued the HIG-driven UI audit repair for the single-file Workbench flow.
This slice fixes targeted resource-panel IA, operation placement, diagnostics
noise, and panel visual consistency without changing parser, exporter,
replacement, or sequence Save As product boundaries.

## Changed Files

- `tools/shared/product-frontend/product-app.mjs`
- `tools/shared/product-frontend/product-shell.html`
- `tools/shared/product-frontend/product-styles.css`
- `tools/shared/product-frontend/inspection-report-view.mjs`
- `tools/shared/product-frontend/source-sharing.test.mjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/scripts/web-reference-capture.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `tools/svga-player-preview/index.html`
- `tools/svga-player-preview/inspection-report-view.test.mjs`
- `tools/svga-workbench/complete-review-package.mjs`
- `tools/p6/visual-system-audit.mjs`
- `src/layout/layoutEngine.ts`
- `docs/product/SVGA_WORKBENCH_HIG_AUDIT_GUIDE.md`

## Repairs

- Loading keeps a visible header `更换文件` action while the in-stage loading
  body stays focused on progress.
- Settings closes the active diagnostics/log side panel before opening and
  resets its internal scroll to top.
- Toolbar icon targets use a 36px practical hit area.
- Left source header and redundant status/error/file-name rows were removed;
  source facts now show compact data-first metrics.
- Resource and layer tabs plus resource filters now use lightweight page-tab
  styling with validated 36px minimum hit widths.
- Resource rows are focusable, named, selectable with Enter/Space, and keep
  browsing/preview as the primary row purpose.
- PNG replacement moved out of inline rows into a contextual resource menu;
  reset/undo/redo/save replacement commands moved to shortcuts and macOS app
  menu items.
- Right inspector title/readiness chrome and the no-op replacement entry were
  removed; action rows are flattened instead of nested cards.
- Diagnostics and production-spec report rows now prefer Chinese human-readable
  findings over raw rule codes and English report fields.
- Left, preview, and right panel surfaces now share radius, border, background,
  and elevation.
- Standard desktop text editing is restored through macOS menu roles for copy,
  paste, cut, and select all; Workbench text defaults to selectable while
  controls remain non-selectable.
- macOS app menu entries now mirror Workbench operations and are grouped by task:
  file loading/saving, editing, resource browsing/replacement, optimization,
  sequence repair, playback, view/settings, window, and help/log actions.
- Sequence proof cards distinguish readonly, partial, and blocked states.
- Preview-card titles ellipsize inside the title region and redundant playback
  status pills are hidden in single-file preview.
- Desktop keyboard smoke focuses `body` before global shortcut proof so Space
  evidence is stable after closing modals.
- NQ1 accessibility source audit now accepts the current Space-key fallback
  contract while still requiring text-input exclusion and playback toggles.

## Late Product Owner Addendum

After the `SVGA-Workbench-v1-a4681d7-complete-review-directory.zip` baseline,
Product Owner review found that implemented Phase 2/3/4 workflows were still too
hard to discover and that an interim fix had placed operation buttons in the
left resource panel. The follow-up repair treats this as temporary added review
scope:

- the left panel is resource inventory again, with filtering, scrolling, row
  focus, context-menu replacement, and large-preview review kept as the primary
  purpose;
- product actions are split by task weight: optimizer and sequence repair remain
  in the right inspector, resource replacement starts from the selected resource
  context menu, and edit history/save commands use shortcuts plus the macOS menu;
- follow-up desktop basics were added after Product Owner review: text content
  can be selected/copied, and every meaningful Workbench action now has a
  categorized macOS menu entry rather than relying on visible in-window buttons;
- default action labels use product wording such as `优化副本`, `替换图片`, and
  `修复闪帧` instead of expecting reviewers to understand Phase labels;
- dense diagnostics and technical proof details are reduced by default and no
  longer compete with resources or core actions.

The next complete review upload package should include
`UPLOAD_CHANGELOG_SINCE_A4681D7.md` so reviewers can separate these temporary
UI/UX additions from the original Phase 4 sequence-repair blocker work. This
review file does not claim that a new complete review package was generated in
this UI/UX repair slice.

## Evidence

- `.artifacts/product/P2/desktop-loading.png`
- `.artifacts/product/P2/desktop-settings-open.png`
- `.artifacts/product/P2/desktop-info-assets-open.png`
- `.artifacts/product/P2/desktop-synchronized-playback-toggled-by-space.png`
- `.artifacts/product/P2/desktop-state-render-proof.json`
- `.artifacts/product/P2/desktop-interaction-trace.source.json`

The state proof records `loadingHeaderActionText: "更换文件"`,
`comfortableToolbarTargets: true`, `resourceRowsFocusable: true`,
`comfortableResourceActions: true`, `settingsBodyScrollTop: 0`,
`settingsStartsAtTop: true`, and sequence proof states
`readonly`, `partial`, and `blocked`.

## Verification

- `node --check tools/shared/product-frontend/product-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`
- `node --check tools/shared/product-frontend/inspection-report-view.mjs`
- `node --check tools/p6/visual-system-audit.mjs`
- `node --test tools/shared/product-frontend/source-sharing.test.mjs tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs tools/svga-player-preview/inspection-report-view.test.mjs`
- `node --test tools/shared/product-frontend/source-sharing.test.mjs tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm run desktop:smoke`

## Remaining UI Debt

Dense repeated diagnostics may still need product-specific grouping, and a
manual context-menu pass plus full screen-reader review remain before Product
Owner UI acceptance. This review does not claim broad UI polish completion.
