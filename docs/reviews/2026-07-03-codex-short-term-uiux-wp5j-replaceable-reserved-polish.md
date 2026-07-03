# Short-Term UI/UX WP5J Replaceable And Reserved Polish Review

## Summary

This pass continues the short-term macOS client UI/UX refactor after WP5I. It
keeps product behavior unchanged and improves the visual traceability of the
Replaceable Elements tab, text preview rows, empty states, and Edit reserved
surface.

Owner-facing intent:

- Add low-emphasis display-only numbering to replaceable image rows and runtime
  text rows for faster scanning.
- Mark optimization, replaceable, and text empty states as `InlineStatus`
  surfaces instead of anonymous paragraphs.
- Mark Edit reserved layer rows as `LayerRow` and the right reserved panel as
  `ReservedOperationPanel`.
- Keep the Edit reserved right panel quiet, without inactive controls or
  deferred feature promises.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this pass: `c04c4cda`
- Worktree before commit: only short-term UI/client files were dirty.
- PM note during work: mid-term PRD changes are out of scope for this UI/UX
  slice and were intentionally ignored.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-03-codex-short-term-uiux-wp5j-replaceable-reserved-polish.md`

## Requirement Checks

- PRD authority: no product scope change. Work remains within the corrected
  short-term S1-S16 surface.
- UI/UX authority: follows the macOS-first design brief, design-system
  execution plan, design-system spec, and `DESIGN.md` traceability rules.
- Design-system discipline: row numbering uses a component token and existing
  `--asv-*` text/spacing tokens.
- Functional boundary: no SVGA parsing, playback, compare, rename execution,
  replacement execution, runtime text behavior, save output, recent-file, IPC,
  or menu-command logic was changed.
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

- This is a replaceable/reserved polish slice, not a final high-fidelity visual
  design pass.
- Hidden smoke screenshots do not include macOS menu bar or system titlebar.
  A foreground real-material review is still needed when the Owner is ready.
- The package manifest's build commit reflects the committed head before this
  uncommitted pass, which is expected before this review is committed.

## Next Step

Continue with another narrow short-term UI/UX polish slice, likely around
toolbar density, preview-stage affordances, or final visual QA gates, while
keeping mid-term PRD additions out of this short-term UI lane.
