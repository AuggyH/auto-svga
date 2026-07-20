# Review: uiux-asset-row-text-polish

## 1. Summary
Polished `AssetRow` text containment for Auto SVGA `0.1.x` / SVGA Preview MVP right information surfaces.

The change keeps resource row names and detail text from visually pushing past the right panel in narrow states, while preserving the existing asset copy, title tooltip, row density, and low-boundary canvas-first direction.

## 2. Git state
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `53b5dc82`
- Uncommitted changes: existing PM/QA lane files were present before this WP and were not staged or edited by this task.
- Untracked files: existing PM/QA review and QA files were present before this WP and were not staged or edited by this task.

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-09-codex-uiux-asset-row-text-polish.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Keep Preview right information asset rows within the documented `AssetRow` component boundary. | Done |
| 2 | Do not add visible product copy, controls, states, or product scope. | Done |
| 3 | Preserve tokenized/componentized design-system implementation. | Done |
| 4 | Keep resource detail readable in narrow right-panel states without reducing information density. | Done |
| 5 | Treat smoke screenshots as regression/layout evidence, not final foreground visual acceptance. | Done |

## 5. Verification
Commands run and results:
```bash
$ node --test --test-name-pattern "short-term design system" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS

$ npm run desktop:short-term:design-system-check
PASS

$ git diff --check -- tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS

$ npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke
PASS
```

## 6. Output inspection
- Smoke screenshot inspected: `.artifacts/product/short-term/short-term-preview-overview.png`
- Smoke screenshot inspected: `.artifacts/product/short-term/short-term-sequence-thumbnails.png`
- Resource row detail now remains visually contained in the right surface.
- Sequence resource row badge remains aligned at row end and does not displace the resource name.
- Foreground packaged-app screenshot was not run for this tiny visual constraint WP; it remains part of the next owner-visible bundle acceptance.

## 7. Risks
- This is a smoke-screenshot validated visual constraint, not final foreground acceptance with macOS chrome.
- Very long localized asset names still rely on single-line ellipsis by design; full detail remains available through the existing row title.

## 8. Next steps
- Continue with the next bundled Preview right-surface polish WP, prioritizing rows and panel rhythm before a larger foreground visual review.

## 9. Commit
- Commit: pending
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 10. Project retrospective
- Value assessment: Medium
- Cost drivers: smoke screenshot path changed from an older remembered location; shared dirty checkout required path-scoped staging.
- Avoidable costs: use current root `.artifacts/product/short-term` path first for smoke screenshots.
- Product lessons: asset information can be made more stable without changing the PRD-required fields.
- Technical lessons: `AssetRow` needs component-level text containment even when generic row text atoms already provide ellipsis.
- Design / interaction lessons: dense right-side production panels need stable text truncation before high-fidelity visual polish can look intentional.
- Process lessons: small adjacent visual fixes should remain bundled by surface, but each committed WP still needs a compact review and validation trail.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: No

## 11. Token usage
- Source: codex-goal-token-count
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: 7174970
- Token lesson: locating current smoke artifacts explicitly avoids repeating stale path assumptions.
