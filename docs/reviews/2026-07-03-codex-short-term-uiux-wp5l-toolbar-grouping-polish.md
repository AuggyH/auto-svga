# Short-Term UI/UX WP5L Toolbar Grouping Polish Review

## Summary

This pass continues the short-term macOS client UI/UX refactor after WP5K. It
keeps product behavior unchanged and improves the top toolbar hierarchy by
grouping file/compare/mode actions, file identity, and save actions into a
clearer macOS-style command row.

Owner-facing intent:

- Make the toolbar read as command groups instead of seven independent items.
- Keep the top-left file entry, adjacent compare entry, and mode switch
  together.
- Keep file identity centered and selectable.
- Mark the mode switch as `SegmentedModeSwitch` and save actions as
  `SaveButtonPair` for design-system traceability.
- Preserve launch/loading/failed states where toolbar controls stay hidden.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this pass: `2ba0e557`
- Worktree before commit: only short-term UI/client files were dirty.
- PM mid-term PRD additions were intentionally not considered for this
  short-term UI/UX slice.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-03-codex-short-term-uiux-wp5l-toolbar-grouping-polish.md`

## Requirement Checks

- PRD authority: no product scope change. Work remains within the corrected
  short-term S1-S16 surface.
- UI/UX authority: follows the macOS-first design brief, design-system
  execution plan, design-system spec, and `DESIGN.md` component traceability
  rules.
- Design-system discipline: toolbar grouping reuses existing `--asv-*`
  layout, spacing, control, and text tokens.
- Functional boundary: no file open, compare, mode switching, save output,
  recent-file, IPC, menu-command, or playback logic was changed.
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

- This is a toolbar hierarchy polish slice, not a final high-fidelity visual
  design pass.
- Hidden smoke screenshots do not include macOS menu bar or system titlebar.
  A foreground real-material review is still needed when the Owner is ready.
- The package manifest's build commit reflects the committed head before this
  uncommitted pass, which is expected before this review is committed.

## Next Step

Continue with final short-term UI/UX polish gates or prepare a consolidated
UI/UX progress review for Owner/PM handoff when requested.
