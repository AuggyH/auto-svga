# SVGA Workbench UI/UX Repair

Date: 2026-06-30
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Continued the HIG-driven UI audit repair for the single-file Workbench flow.
This slice fixes targeted interaction and layout issues without changing parser,
exporter, replacement, or sequence Save As product boundaries.

## Changed Files

- `tools/shared/product-frontend/product-app.mjs`
- `tools/shared/product-frontend/product-styles.css`
- `tools/shared/product-frontend/source-sharing.test.mjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `src/tests/helpers/nq1-accessibility-audit.ts`
- `docs/product/SVGA_WORKBENCH_HIG_AUDIT_GUIDE.md`
- `docs/autonomous/AUTONOMOUS_RUN_LOG.md`
- `docs/autonomous/SVGA_WORKBENCH_V1_STATUS.md`
- `docs/autonomous/LESSONS_CANDIDATES.md`

## Repairs

- Loading keeps a visible header `更换文件` action while the in-stage loading
  body stays focused on progress.
- Settings closes the active diagnostics/log side panel before opening and
  resets its internal scroll to top.
- Toolbar icon targets use a 36px practical hit area.
- Resource rows are focusable, named, selectable with Enter/Space, and retain
  separate preview/replace/expand button behavior.
- Resource row actions have larger hit areas and wrap without colliding with
  metadata.
- Sequence proof cards distinguish readonly, partial, and blocked states.
- Preview-card titles ellipsize inside the title region instead of colliding
  with status and file actions.
- Desktop keyboard smoke focuses `body` before global shortcut proof so Space
  evidence is stable after closing modals.
- NQ1 accessibility source audit now accepts the current Space-key fallback
  contract while still requiring text-input exclusion and playback toggles.

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
- `node --test tools/shared/product-frontend/source-sharing.test.mjs`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm run desktop:smoke`
- `npm run svga-workbench:v1:validate` passed 14/14 commands at
  `2026-06-30T03:40:17.207Z`.

## Remaining UI Debt

Dense repeated diagnostics, full settings scroll/keyboard review,
screen-reader review, and refreshed full screenshot-audit contact sheets remain
before Product Owner UI acceptance. This review does not claim broad UI polish
completion.
