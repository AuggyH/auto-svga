# Short-Term UI/UX WP5G Visual System Polish Review

## Summary

This pass continues the short-term macOS client UI/UX refactor after WP5F. It
keeps the current product behavior unchanged and improves visual-system
traceability for the toolbar, inspector, fact cells, rows, badges, panel
boundaries, and overlay surfaces.

Owner-facing intent:

- Reduce one-off visual values in component/page CSS.
- Move common surfaces, borders, row states, panel highlights, and overlay
  styles into `--asv-*` tokens.
- Make toolbar controls, selected tabs, asset attention rows, and metadata
  status copy feel more deliberate and less like an engineering shell.
- Preserve the current short-term S1-S16 behavior and menu scope.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this pass: `caac1351`
- Protected PM-owned dirty files were present and intentionally not touched:
  - `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
  - `docs/product/PRODUCT_ROADMAP.md`
  - `docs/product/MID_TERM_IMPLEMENTATION_PREP.md`
  - `docs/reviews/2026-07-03-codex-mid-term-implementation-prep.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-03-codex-short-term-uiux-wp5g-visual-system-polish.md`

## Requirement Checks

- PRD authority: no product scope change. Work remains within the corrected
  short-term S1-S16 surface.
- UI/UX authority: follows the design brief, execution plan, design-system
  spec, and `DESIGN.md` token/component traceability rules.
- Design-system discipline: new visual values are centralized as semantic or
  component-level `--asv-*` variables before component/page consumption.
- Functional boundary: no SVGA parsing, playback, rename, replacement,
  optimization, save, recent-file, IPC, or menu-command logic was changed.
- Foreground interruption boundary: no foreground client run was performed in
  this pass to avoid interrupting the Owner's single-monitor workflow.

## Verification

- `git diff --check` passed for touched files.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  passed, 29/29.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
  passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac`
  passed and produced the internal unsigned macOS trial package.

## Risks And Gaps

- This is a visual-system polish slice, not a final high-fidelity redesign.
  More work is still needed on empty/error/save states, compare layouts, and
  possibly a dedicated Figma-driven visual pass.
- Automated smoke validates behavior and hidden rendered states but does not
  replace a foreground visual review with real production material. That was
  intentionally skipped here to avoid stealing focus.
- The package manifest's build commit reflects the committed head before this
  uncommitted pass, which is expected before this review is committed.

## Next Step

Continue with a narrow state-quality pass on error/save/optimization result
states, or run a foreground real-material visual review when the Owner is ready
for a short interruption.
