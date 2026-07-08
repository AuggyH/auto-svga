# UI/UX Right Header Layout Polish Review

## Summary

Stabilized the Auto SVGA 0.1.x right information header so the filename row no
longer depends on a fixed pixel width that duplicates the current right-panel
padding math. The visible filename copy and save actions are unchanged.

## Git State

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit: pending at review creation
- Scope: UI/UX lane only

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-09-codex-uiux-right-header-layout-polish.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## Requirement Checks

- No PRD-owned files or product scope changed.
- No visible copy, file identity logic, save commands, or mode flow changed.
- Right header width now uses the component token as `auto` so margin/padding
  owns the real available width.
- Filename and save cluster remain constrained with `min-width: 0` and
  ellipsis-friendly layout.

## Verification

- `node --test --test-name-pattern "short-term design system" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm run desktop:short-term:design-system-check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
- `git diff --check -- <touched UI/UX paths>`
- Visual inspection: `short-term-preview-overview.png`,
  `short-term-rename-dirty.png`, `short-term-save-failed.png`

## Risks

- Smoke screenshots are regression evidence only; final foreground packaged-app
  review still needs real production materials.
- This WP stabilizes layout constraints but does not solve every possible
  extreme filename case.

## Next Steps

- Continue the active 5-hour UI/UX goal with the next owner-visible polish WP.

## Project Retrospective

- Good: This kept the fix at the layout-token level instead of adding one-off
  filename handling.
- Improve: Header sizing should be expressed as available-width ownership, not
  as a number derived from one right-panel width.
- Lesson candidate: long filename stability should be part of right-surface
  screenshot review, especially when save actions can appear in the same row.

## Token Usage

- Source: Codex goal token count
- Total at record time: 6,781,503
