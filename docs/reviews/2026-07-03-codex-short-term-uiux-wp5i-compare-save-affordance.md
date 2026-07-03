# Short-Term UI/UX WP5I Compare And Save Affordance Review

## Summary

This pass continues the short-term macOS client UI/UX refactor after WP5H. It
keeps product behavior unchanged and improves the visual hierarchy of compare
mode plus the readability of save/status feedback.

Owner-facing intent:

- Make compare mode read as a composed workbench instead of loose side panels
  and canvases.
- Add persistent A/B labels to compare canvases without changing playback.
- Split compare side-panel content into `compareSummary`,
  `compareMetricGrid`, and `compareActions` modules.
- Make optimization compare results use clearer success/warning grouping.
- Improve save banner wrapping so longer validation messages remain readable.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this pass: `092c8eb1`
- Protected PM-owned dirty files were present and intentionally not touched:
  - `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
  - `docs/product/PRODUCT_ROADMAP.md`
  - `docs/product/ROADMAP_UI_CAPACITY_MAP.json`
  - `docs/product/auto-svga-backlog.md`
  - `docs/product/AE_BRIDGE_PRODUCT_BRIEF.md`
  - `docs/product/MID_TERM_IMPLEMENTATION_PREP.md`
  - `docs/reviews/2026-07-03-codex-mid-term-implementation-prep.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-03-codex-short-term-uiux-wp5i-compare-save-affordance.md`

## Requirement Checks

- PRD authority: no product scope change. Work remains within the corrected
  short-term S1-S16 surface.
- UI/UX authority: follows the macOS-first design brief, design-system
  execution plan, and `DESIGN.md` token/component traceability rules.
- Design-system discipline: compare and save polish uses existing `--asv-*`
  tokens and adds no one-off product behavior.
- Functional boundary: no SVGA parsing, playback, compare source selection,
  save output, optimization execution, recent-file, IPC, or menu-command logic
  was changed.
- Foreground interruption boundary: no foreground client run was performed
  because the Owner currently has only one display and asked to avoid work
  interruption.

## Verification

- `git diff --check` passed for touched files.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  passed, 29/29.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
  passed with hidden off-screen smoke window.
- `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac`
  passed and produced the internal unsigned macOS trial package.

## Risks And Gaps

- This is a compare/save affordance slice, not a final high-fidelity visual
  design pass.
- Hidden smoke screenshots do not include macOS menu bar or system titlebar.
  A foreground real-material review is still needed when the Owner is ready.
- The package manifest's build commit reflects the committed head before this
  uncommitted pass, which is expected before this review is committed.

## Next Step

Continue with a narrow inspector-density or edit-reserved polish pass under the
same no-foreground-interruption boundary.
