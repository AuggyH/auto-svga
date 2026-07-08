# Review: uiux-open-button-icon-polish

## 1. Summary
Restored the folder icon on the Launch primary `打开文件` button and aligned Compare empty-state `打开文件` buttons with the same icon treatment. This follows the owner-confirmed icon-first direction without adding new text, actions, states, or product scope.

## 2. Git state
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `17f02ef6`
- Uncommitted changes: existing PM/QA lane files were present before this task and were not modified for this WP.
- Untracked files: existing PM/QA review/report files and `short-term-macos.tokens.css` were present before this task and were not staged.

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.molecules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-09-codex-uiux-open-button-icon-polish.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Keep Launch focused on drag prompt, Open File, and recent files only. | Done |
| 2 | Use icons where they clarify existing actions without adding extra visible copy. | Done |
| 3 | Do not add product-doc-absent actions or future controls. | Done |
| 4 | Keep icon behavior component-level instead of page-specific one-off styling. | Done |
| 5 | Preserve Compare open actions and launch open action semantics. | Done |

## 5. Verification
```
$ node --test --test-name-pattern "short-term design system" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS

$ npm run desktop:short-term:design-system-check
PASS

$ npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke
PASS

$ git diff --check -- tools/electron-prototype/experiments/svga-web/web/index.html tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css tools/electron-prototype/experiments/svga-web/web/short-term-macos.molecules.css tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS
```

## 6. Output inspection
- Launch smoke screenshot: `打开文件` button shows the folder icon and remains the highest action layer under the drag prompt.
- General Compare smoke screenshot: empty compare slot `打开文件` button shows the folder icon; no new compare entry or copy was introduced.
- Foreground packaged-app screenshot: not run for this WP; smoke remains regression evidence.

## 7. Risks
- The same folder SVG is currently repeated in static HTML for Launch and Compare empty-state buttons. This keeps the change small, but a future icon helper could reduce duplication if more large open buttons are added.

## 8. Next steps
- Continue visual polish on the next owner-visible surface.
- Refresh the local stable app after the next meaningful UI bundle or before owner review.

## 9. Commit
- Commit: see git log entry `uiux: polish open button icons`
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 10. Project retrospective
- Value assessment: Medium
- Cost drivers: icon markup existed in Launch but was hidden by page CSS; Compare used a separate static button shape.
- Avoidable costs: open-file button variants should use the same component contract when the button is introduced.
- Product lessons: icon polish can improve clarity without expanding product scope when it stays attached to an existing approved action.
- Technical lessons: flex icons inside fixed-width buttons need `flex: 0 0 auto` to avoid disappearing.
- Design / interaction lessons: primary open actions should carry the same visual affordance across Launch and Compare empty states.
- Process lessons: smoke screenshot inspection caught that static HTML assertions alone did not prove the icon was actually visible.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: No

## 11. Token usage
- Source: codex-goal-token-count
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: 5996692
- Token lesson: screenshot inspection is still needed after DOM assertions when CSS can visually suppress an element.
