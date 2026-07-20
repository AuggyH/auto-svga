# Review: uiux-workbench-state-evidence-sizing

## 1. Summary
Fixed short-term workbench-state smoke evidence for Settings and Edit reserved states. These two scenarios now capture at the default 1440 x 900 workbench content size instead of the launch-sized square window, so later UI/UX review does not judge those states from misleading screenshots.

No product flow, visible copy, or feature logic was changed.

## 2. Git state
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `8d958950`
- Uncommitted changes: existing PM/QA lane files were present before this task and were not modified for this WP.
- Untracked files: existing PM/QA review/report files and `short-term-macos.tokens.css` were present before this task and were not staged.

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-09-codex-uiux-workbench-state-evidence-sizing.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Keep smoke screenshots aligned with the actual Auto SVGA 0.1.x workbench geometry. | Done |
| 2 | Do not add product-doc-absent UI copy, controls, or feature scope. | Done |
| 3 | Preserve Launch square-window behavior. | Done |
| 4 | Keep implementation token/design-system guardrails passing. | Done |
| 5 | Use smoke evidence as regression support, not final owner acceptance. | Done |

## 5. Verification
```
$ node --test --test-name-pattern "default Electron renderer|short-term design system" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS

$ npm run desktop:short-term:design-system-check
PASS

$ npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke
PASS

$ sips -g pixelWidth -g pixelHeight .artifacts/product/short-term/short-term-settings-dialog.png .artifacts/product/short-term/short-term-edit-reserved.png
short-term-settings-dialog.png: 2880 x 1800
short-term-edit-reserved.png: 2880 x 1800

$ git diff --check -- tools/electron-prototype/experiments/svga-web/main.cjs tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS
```

## 6. Output inspection
- Settings dialog: now captured in a full workbench context, with the right surface and playback/canvas context visible behind the modal.
- Edit reserved: now captured in a full workbench context, with left layer list, center canvas, and right reserved column visible.
- Foreground packaged-app screenshot: not run for this WP; this was a non-foreground smoke evidence correction.

## 7. Risks
- The Edit reserved right column is intentionally empty because the short-term scope only keeps it as a reserved panel. Adding placeholder text or future controls would require product confirmation.
- Smoke screenshots remain regression evidence only. Final visual acceptance still needs foreground packaged-app review with macOS chrome.

## 8. Next steps
- Continue owner-visible visual polish using corrected workbench-state evidence.
- Avoid judging Settings/Edit layout from square Launch-window captures.

## 9. Commit
- Commit: see git log entry `uiux: fix workbench state smoke sizing`
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 10. Project retrospective
- Value assessment: Medium
- Cost drivers: misleading screenshot geometry can create false UI issues and waste polish cycles.
- Avoidable costs: register product workbench viewport size when each new workbench-state smoke scenario is created.
- Product lessons: evidence-only changes should not introduce visible copy or controls.
- Technical lessons: host artifact sizing is part of the visual evidence contract and should be tested.
- Design / interaction lessons: workbench states need screenshots that include their true side-surface proportions before visual judgment.
- Process lessons: fix evidence quality before entering another visual polish loop.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: No

## 11. Token usage
- Source: codex-goal-token-count
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: 5488605
- Token lesson: a small evidence-sizing WP is cheaper than repeated visual analysis from misleading screenshots.
