# UI/UX State Surface Polish Review

## Summary

Polished the Auto SVGA 0.1.x loading/failed state surface so it follows the
Owner-confirmed canvas-first direction: low-boundary, centered, and action-led.
No product scope, copy, or feature flow was added.

## Git State

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit: pending at review creation
- Scope: UI/UX lane only

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.page-states.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-09-codex-uiux-state-surface-polish.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## Requirement Checks

- Main PRD authority preserved; no PRD-owned files changed.
- No new visible product copy, feature entry, or unsupported future scope.
- Existing failed-state `打开文件` action was visually aligned with the approved
  open-file affordance by adding the existing folder-icon treatment.
- State surface dimensions, spacing, and action rhythm are tokenized.
- Loading/failed state views now occupy the full app state grid row, preventing
  vertically misleading smoke screenshots.

## Verification

- `node --test --test-name-pattern "short-term design system" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm run desktop:short-term:design-system-check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
- `git diff --check -- <touched UI/UX paths>`
- Visual inspection: `.artifacts/product/short-term/short-term-load-failed.png`

## Risks

- This is smoke evidence, not final foreground packaged-app acceptance evidence.
  Final visual acceptance still needs foreground packaged app screenshots with
  macOS chrome and real production SVGA materials.
- Failed-state dynamic error copy may still include lower-level runtime wording
  from the implementation path; this WP did not change product copy or error
  generation.

## Next Steps

- Continue the active 5-hour UI/UX goal with the next owner-visible surface WP.
- Refresh local stable package only after another meaningful visible group or
  before Owner hands-on review.

## Project Retrospective

- Good: Smoke screenshot inspection caught that the state content was inherited
  into the wrong grid row after the first visual polish.
- Improve: State surfaces should have had a dedicated page-state row assertion
  when the launch square / workbench sizing split was introduced.
- Lesson candidate: for canvas-first UI, state pages should be tested as full
  page states, not as ordinary workbench `view` rows.

## Token Usage

- Source: Codex goal token count
- Total at record time: 6,433,677
