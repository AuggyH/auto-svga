# Review: uiux-preview-surface-token-polish

## 1. Summary
Continued Auto SVGA 0.1.x / SVGA Preview MVP UI/UX polish on the current short-term macOS client surface.

This slice keeps the Owner-confirmed canvas-first direction and does not add new product copy, actions, or visible scope. It tightens four already-confirmed areas:

- Launch checkerboard idle motion now uses the Owner-approved direction and speed: left-bottom to right-top, 30s / 12 checker cells.
- Drag decision overlay layout now consumes a tokenized 25% / 75% top-bottom contract instead of hardcoded rows.
- Preview right information facts now separate simple units visually and let the runtime-structure summary span both columns so it reads as one decision field, not a broken engineering label.
- Compare and optimization-compare states now keep empty slots clean while explicitly marking mounted comparison canvases as loaded.

## 2. Git state
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `6b9e090f`
- Uncommitted changes: UI/UX files listed below, plus unrelated PM/QA dirty files already present in the shared checkout.
- Untracked files: unrelated PM/QA review and quality files already present; this review file is UI/UX lane.

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-optimization-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-render-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-overview-renderers.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-09-codex-uiux-preview-surface-token-polish.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Use product docs and current 0.1.x / SVGA Preview MVP scope; do not revive Workbench v1 visual baseline. | Done |
| 2 | Keep Launch checkerboard idle motion as background-only, tokenized, and reduced-motion compatible. | Done |
| 3 | Keep drag decision overlay aligned to PRD top 25% Compare / lower 75% Open File contract. | Done |
| 4 | Do not add unapproved copy, labels, actions, or feature scope while polishing UI. | Done |
| 5 | Keep runtime-structure labels user-facing and avoid protocol terms or layer terminology. | Done |
| 6 | Keep compare mode as two canvases plus one right-side comparison surface; no visible compare toggle is reintroduced. | Done |
| 7 | Keep optimization result compare canvases visible after mounted playback. | Done |
| 8 | Use design-system tokens and component/module layers rather than one-off styling. | Done |
| 9 | Treat smoke screenshots as regression evidence, not final foreground macOS acceptance. | Done |

## 5. Verification
Commands run and results:
```bash
git diff --check -- <UI/UX touched files>
# PASS

node --test --test-name-pattern "short-term metric values|default Electron renderer|short-term design system|short-term drag decision hit testing" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
# PASS: 4/4

npm run desktop:short-term:design-system-check
# PASS

npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke
# PASS
```

## 6. Output inspection
- Smoke screenshots reviewed:
  - `.artifacts/product/short-term/short-term-preview-overview.png`
  - `.artifacts/product/short-term/short-term-general-compare.png`
  - `.artifacts/product/short-term/short-term-optimization-result.png`
- Launch motion is covered by token/check assertions; Owner already confirmed the 30s / 12-cell motion package direction before this slice continued.
- Runtime-structure fact no longer wraps its unit onto a separate line in the two-column grid; it now spans both columns.
- Simple numeric values such as `104.5 KiB`, `9.2 MiB`, and `300 x 300 px` split units into the existing lower-emphasis unit style.
- General compare no longer renders a long table of repeated `未打开` values while only one side is present.
- Optimization result compare keeps both mounted canvases visible after explicit loaded-state synchronization.
- Foreground packaged App screenshot was not taken in this slice to avoid unnecessary frontmost interruption. It remains required before Owner visual acceptance.

## 7. Risks
- Right-side row overflow should be checked in the next foreground packaged App pass with real production materials, not only smoke fixture screenshots.
- The shared checkout still contains unrelated PM/QA dirty files; UI/UX commit staging must stay path-scoped.
- This is visual polish and structure hardening, not final high-fidelity acceptance.

## 8. Next steps
- Continue WP on Preview and Compare right surfaces with real-material foreground screenshots when frontmost lease is available.
- Continue visual polish on optimization result density and action hierarchy, while respecting the net-effect guardrail.
- Package and promote local stable only after a clean UI/UX commit, using the project local stable promotion flow.

## 9. Commit
- Commit: pending
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 10. Project retrospective
- Value assessment: Medium
- Cost drivers: Shared dirty checkout required path-scoped review and validation; smoke screenshots are useful but still not a substitute for foreground macOS evidence.
- Avoidable costs: Future visual slices should record DOM overflow measurements in smoke proof when edge clipping is suspected.
- Product lessons: Runtime-structure summary is decision information and should not be compressed like a small numeric stat.
- Technical lessons: Simple unit splitting needs a narrow parser; broad "anything ending in KiB" parsing breaks mixed diagnostic copy. Compare canvases need explicit loaded-state synchronization after playback mount, not only model-driven slot state.
- Design / interaction lessons: One existing fact can need a different grid span without becoming a new module or extra explanatory copy. Compare empty states should reduce repeated placeholders and keep the visual decision surface calm.
- Process lessons: Batch adjacent token polish into a single review instead of creating a review for each tiny visual adjustment.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: No

## 11. Token usage
- Source: codex-goal-token-count
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: 1338794
- Token lesson: Keep small visual fixes bundled by surface and verify them together to avoid token-heavy repeated smoke/review cycles.
