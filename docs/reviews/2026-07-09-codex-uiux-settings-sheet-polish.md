# Review: uiux-settings-sheet-polish

## 1. Summary
Continued Auto SVGA 0.1.x / SVGA Preview MVP UI/UX polish on the existing Settings sheet.

This slice changes only the visual density and hierarchy of the appearance selector. It keeps the confirmed settings scope exactly as-is: Follow System, Light, and Dark. No new settings, explanatory text, toolbar entry, or product behavior were added.

## 2. Git state
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `45feadf1`
- Shared checkout note: unrelated PM/QA dirty files were already present and were not edited by this UI/UX slice.

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-09-codex-uiux-settings-sheet-polish.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Settings sheet exposes only Follow System, Light, and Dark. | Done |
| 2 | Do not add unapproved copy, status labels, or settings. | Done |
| 3 | Keep appearance switching behavior unchanged. | Done |
| 4 | Use tokenized component styles. | Done |
| 5 | Keep Settings accessible through existing menu/sheet flow, not a main-surface toolbar. | Done |
| 6 | Treat smoke screenshot as regression evidence, not final foreground macOS acceptance. | Done |

## 5. Verification
Commands run and results:
```bash
node --test --test-name-pattern "default Electron renderer|short-term design system" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
# PASS: 2/2

npm run desktop:short-term:design-system-check
# PASS

git diff --check -- tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
# PASS

npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke
# PASS
```

## 6. Output inspection
- Reviewed `.artifacts/product/short-term/short-term-settings-dialog.png` after smoke.
- The three appearance options now read as a compact segmented selector instead of three large card choices.
- Selected state remains visible, focus coverage remains protected by existing checks, and the Settings sheet still contains no extra product text.

## 7. Risks
- Smoke screenshot is not a substitute for owner-visible packaged App foreground review.
- The Settings shell is still a web-rendered modal; final native feel should be judged in the packaged App with macOS chrome.

## 8. Next steps
- Include Settings in the next foreground packaged visual pass.
- Continue with Edit Reserved / layer-list visual review only if it can be improved without implying unsupported editing capability.

## 9. Commit
- Commit: pending
- Branch: `agent/codex/short-term-preview-qa-20260708`

## 10. Project retrospective
- Value assessment: Medium
- Cost drivers: Settings had to become lighter without adding any settings, explanatory text, or new main-surface controls.
- Avoidable costs: Keep appearance selector tokens separate from generic card/list tokens so it does not drift back into a card grid.
- Product lessons: A confirmed small settings scope can still need native-feeling presentation, but UI/UX must not expand the settings surface.
- Technical lessons: A compact segmented-control style can be achieved by retokenizing the existing component instead of changing behavior.
- Design lessons: For simple binary/ternary preferences, a lightweight segmented control fits the canvas-first app better than large option cards.
- Process lessons: Smoke screenshot review is enough to catch gross visual regressions, but final acceptance still needs packaged foreground review.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: No

## 11. Token usage
- Source: codex-goal-token-count
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: 2037779
- Token lesson: Reuse existing smoke settings evidence instead of creating a new foreground session for every small visual density adjustment.
