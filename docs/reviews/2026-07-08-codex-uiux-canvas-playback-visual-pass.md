# Review: UI/UX Canvas And Playback Visual Pass

## 1. Summary

Applied the Batch 08 Figma canvas/playback contracts to the short-term macOS
client without changing product behavior:

- mode switch now uses the Figma-style pill shell, light selected surface, and
  regular 12px text rhythm;
- playback controls now use the tokenized 44px icon-button contract, 16px
  spacing rhythm, 3px progress track, and 12px/18px time text;
- existing control count and behavior were preserved. No loop/fullscreen
  buttons were added because adding inactive or unimplemented controls would
  exceed the current client behavior boundary.

## 2. Git state

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `edcb2503`
- Pre-existing uncommitted changes not owned by this task:
  - `docs/product/SHORT_TERM_DISTRIBUTION_PREP.md`
  - `docs/quality/PROJECT_TEST_ENGINEER_WORKFLOW.md`
  - `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
  - `docs/reviews/2026-07-08-codex-local-stable-drag-decision-refresh.md`
  - `docs/reviews/2026-07-08-codex-local-stable-qa-regression-refresh.md`
  - `docs/reviews/2026-07-08-codex-local-stable-qa006-refresh.md`
  - `docs/reviews/2026-07-08-codex-owner-client-baseline-routing.md`

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.molecules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-08-codex-uiux-canvas-playback-visual-pass.md`

## 4. Requirement checks

| # | Requirement | Status |
| --- | --- | --- |
| 1 | Follow main PRD over stale Figma interaction details. | Done: drag-decision behavior was not changed from the PRD top/bottom contract. |
| 2 | Keep design-system token/component traceability. | Done: new visual values were added as component tokens and consumed through aliases. |
| 3 | Do not add product-surface copy, helper text, or inactive controls. | Done: no new visible text or controls were added. |
| 4 | Preserve existing playback/open/preview function. | Done by automated checks and smoke. |
| 5 | Keep Figma output adapted to local stack, not copied as React/Tailwind. | Done: only CSS tokens/modules and one test contract changed. |

## 5. Verification

```text
npm run desktop:short-term:design-system-check
PASS

node --test tools/electron-prototype/experiments/svga-web/tests/short-term-playback-fit.test.mjs
PASS 2/2

node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 33/33

npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke
PASS
```

## 6. Output inspection

- Mode switch:
  - `4px` pill-shell padding;
  - full-pill radius;
  - active segment uses the floating surface and subtle `0 1px 1.5px` shadow;
  - active/inactive text is no longer blue/bold by default.
- Playback controls:
  - primary and secondary icon buttons use `44 x 44`;
  - icons use `20 x 20`;
  - action and bar gaps use `16px`;
  - progress track uses `3px`;
  - time text uses `12px` with `18px` line-height.

## 7. Risks

- This is still an automated/smoke-verified pass. Owner-visible final judgment
  needs a promoted local app and real foreground screenshot with macOS chrome.
- Figma includes loop/fullscreen controls in the playback bar. They were not
  added in this pass to avoid creating inactive controls outside the current
  implemented behavior.

## 8. Next steps

- Package and promote the local stable app from the current commit.
- Capture a foreground desktop screenshot of the promoted app with a real SVGA
  file, then continue visual review from that evidence.

## 9. Commit

- Commit: finalized by this commit; use `git log -1 --oneline` for the exact hash.
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 10. Project retrospective

- Value assessment: Medium
- Cost drivers: Figma contracts changed visual test expectations, so the
  renderer-isolation test needed to be updated with the new token contract.
- Avoidable costs: No extra Figma reads were needed after Batch 08.
- Product lessons: Do not implement visual-only controls from Figma when the
  current product behavior does not support them.
- Technical lessons: CSS token changes need matching contract assertions so
  future agents do not restore the older engineering-shell style.
- Design / interaction lessons: Small control-scale changes have large perceived
  impact in this canvas-first direction because the UI relies on subtle
  hierarchy instead of boxes and dividers.
- Process lessons: Automated smoke remains necessary but not sufficient; final
  owner-visible evidence still needs the promoted desktop app.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  Yes, after the shared retrospective ledger dirty state is resolved.

## 11. Token usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: The implementation was cheaper because Batch 08 already named
  concrete token/component contracts; no broad file or Figma rescans were
  needed.
