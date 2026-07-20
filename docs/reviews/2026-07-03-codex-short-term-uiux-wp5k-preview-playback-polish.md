# Short-Term UI/UX WP5K Preview And Playback Polish Review

## Summary

This pass continues the short-term macOS client UI/UX refactor after WP5J. It
keeps product behavior unchanged and improves the component traceability and
visual hierarchy of the primary preview canvas and playback controls.

Owner-facing intent:

- Add a subtle preview canvas label using the same label pattern as compare
  A/B canvases.
- Split playback controls into a `PlaybackButtonGroup`.
- Render playback metadata as an `InlineStatus`-style pill rather than loose
  trailing text.
- Keep playback behavior, player mounting, pause, and replay logic unchanged.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this pass: `c2b350e4`
- Worktree before commit: only short-term UI/client files were dirty.
- PM mid-term PRD additions were intentionally not considered for this
  short-term UI/UX slice.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-03-codex-short-term-uiux-wp5k-preview-playback-polish.md`

## Requirement Checks

- PRD authority: no product scope change. Work remains within the corrected
  short-term S1-S16 surface.
- UI/UX authority: follows the macOS-first design brief, design-system
  execution plan, design-system spec, and `DESIGN.md` component traceability
  rules.
- Design-system discipline: preview label and playback metadata reuse existing
  `--asv-*` overlay, badge, text, and spacing tokens.
- Functional boundary: no SVGA parsing, playback implementation, compare,
  rename, replacement, save output, recent-file, IPC, or menu-command logic was
  changed.
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

- This is a preview/playback polish slice, not a final high-fidelity visual
  design pass.
- Hidden smoke screenshots do not include macOS menu bar or system titlebar.
  A foreground real-material review is still needed when the Owner is ready.
- The package manifest's build commit reflects the committed head before this
  uncommitted pass, which is expected before this review is committed.

## Next Step

Continue with final short-term UI/UX polish gates or prepare a consolidated
UI/UX progress review for Owner/PM handoff when requested.
