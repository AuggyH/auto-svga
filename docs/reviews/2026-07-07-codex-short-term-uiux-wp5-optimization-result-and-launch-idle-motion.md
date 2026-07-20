# Review: short-term-uiux-wp5-optimization-result-and-launch-idle-motion

## 1. Summary

This UI/UX slice does two bounded things:

- refines the Optimization Result right surface so the before/after metrics read as an optimization comparison rather than another generic compare card grid;
- implements the PM-synced Launch checkerboard idle motion as a low-emphasis background-only animation.

No new visible product copy, file flow, mode, entry, or shortcut was added. PM-owned PRD/design docs were read as authority but not modified by this implementation slice.

## 2. Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Product-doc baseline: `d71650d5fe8b54388c16ddfee8eb857de7590a22` (`docs: add launch checker idle motion requirement`)
- Implementation commit: `70410578 uiux: refine short-term launch and right surfaces`
- Worktree note: Launch square window, WP4 right-surface alignment, and this WP5/Launch idle-motion slice share token/CSS/test files, so they were committed as one UI/UX implementation bundle while the review records remain separated by WP boundary.

## 3. Authority And Inputs

Read:

- `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
- `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`
- `docs/product/SHORT_TERM_UI_UX_LOW_FIDELITY_IA.md`
- `DESIGN.md`
- `docs/reviews/2026-07-07-codex-launch-checker-idle-motion-requirement.md`
- `docs/retrospectives/PROJECT_EXPERIENCE_GUIDE.md`
- `docs/retrospectives/PROJECT_BASELINE_RETROSPECTIVE.md`

No Figma MCP call was made in this slice.

## 4. Changed Files

Core UI implementation:

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-render-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.page-states.css`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

Review and evidence:

- `docs/reviews/2026-07-07-codex-short-term-uiux-wp5-optimization-result-and-launch-idle-motion.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `review/short-term-uiux-wp5-launch-idle-motion-72156f7/REVIEW_PACKET.md`
- `review/uiux-high-fidelity-packages/Auto-SVGA-macOS-uiux-wp5-launch-idle-20260707-222012-72156f7f.zip`
- `review/uiux-high-fidelity-packages/Auto-SVGA-macOS-uiux-wp5-launch-idle-20260707-222012-72156f7f.zip.sha256`
- `review/uiux-high-fidelity-packages/foreground-wp5-optimization-result-20260707/01-launch-foreground-display2.png`

Package cleanup:

- Removed the oldest UI/UX high-fidelity package from `review/uiux-high-fidelity-packages/` so the directory still keeps only the latest 3 App ZIPs.

## 5. Requirement Checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Launch checkerboard idle motion is background-only | Done |
| 2 | No new Launch text, controls, modes, entries, or flows | Done |
| 3 | Drag-hover and stronger states override or pause idle motion | Done |
| 4 | Reduced-motion users receive a static checkerboard | Done |
| 5 | Prefer tokenized CSS/background animation over JS timer | Done |
| 6 | Optimization Result metrics should emphasize before/after comparison | Done |
| 7 | Preserve existing Save As / Overwrite / Abandon optimization actions | Done |
| 8 | Preserve short-term smoke/function flow | Done |
| 9 | Do not treat smoke screenshots as final foreground visual acceptance | Done |

## 6. Implementation Notes

- Added motion tokens:
  - `--asv-motion-duration-idle`
  - `--asv-motion-easing-idle`
  - `--asv-component-launch-checker-idle-*`
  - `--asv-launch-checker-idle-*`
- Implemented `launchCheckerIdleDrift` on `.launchCanvas` only.
- Paused Launch idle motion during `.launchCanvas.isDragOver`.
- Disabled Launch idle motion inside `@media (prefers-reduced-motion: reduce)`.
- Added `renderOptimizationMetricCellHtml` so Optimization Result does not reuse the generic compare metric card renderer.
- Updated proof checks to require `.optimizationMetricCell` for optimization-result evidence.

## 7. Verification

```
$ node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
passed; 31/31 tests
```

```
$ npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check
passed; includes launch-checker-idle-motion-tokenized=true
```

```
$ git diff --check
passed
```

```
$ npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke
passed; short-term proof remains true
```

```
$ npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac
passed
```

Generated App package:

- `review/uiux-high-fidelity-packages/Auto-SVGA-macOS-uiux-wp5-launch-idle-20260707-222012-72156f7f.zip`
- SHA-256: `6dfcfc7219db76521bafa31fea4b2856d8595e3dae1ae7446e02d3042bee322d`

Foreground evidence:

- `review/uiux-high-fidelity-packages/foreground-wp5-optimization-result-20260707/01-launch-foreground-display2.png`

The foreground screenshot verifies the packaged foreground Launch window on the second display with macOS menu bar and window chrome. It does not prove Optimization Result visual acceptance. Optimization Result is covered by tests, design-system checks, and smoke in this slice; a foreground Optimization Result screenshot remains a follow-up if Owner wants visual acceptance evidence for that state.

## 8. Risks And Gaps

- The local machine has an older same-name `~/Applications/Auto SVGA.app` that can confuse app-name based foreground automation. This slice used the packaged artifact path and a temporary unique validation app name for launch evidence, but did not mutate the user's installed app.
- Foreground Optimization Result evidence is not complete in this slice because same-name app activation and stale installed-app dependency state made app-name targeting unreliable. The runtime flow itself passed smoke and package checks.
- PM-owned Launch idle product docs are already committed at `d71650d5`; the UI/UX implementation bundle is committed at `70410578`.

## 9. Next Steps

- Continue with the next Figma-backed UI/UX WP only after confirming the design target and evidence route.
- For any state that needs Owner-visible visual acceptance, start from a packaged app path or a uniquely named validation copy rather than app-name activation.
- If Optimization Result becomes the next focus, capture a real foreground Optimization Result state with the packaged client and at least one real owner-provided SVGA file.

## 10. Project Retrospective

- Value assessment: High
- Cost drivers:
  - The Launch idle-motion requirement arrived through PM docs mid-slice, so the implementation needed authority-doc alignment before CSS work.
  - Foreground validation hit same-name/stale-app ambiguity, making app-name targeting unreliable.
  - The worktree contains several parallel dirty lanes, so this review has to document ownership narrowly.
- Avoidable costs:
  - Do not target `Auto SVGA` by app name when an older installed copy can satisfy LaunchServices before the freshly packaged artifact.
- Product lessons:
  - Small visual motion details still belong in the short-term PRD/design hierarchy when they affect visible client behavior.
- Technical lessons:
  - Low-emphasis idle motion can stay in tokenized CSS and design-system checks; it does not need renderer timers.
- Design lessons:
  - Optimization Result should use comparison hierarchy and typography, not another neutral card grid that flattens before/after meaning.
- Process lessons:
  - Keep smoke proof, foreground evidence, and Owner acceptance explicitly separate.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: no new candidate; existing foreground/packaged-app lessons already cover the main issue.

## 11. Token Usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: once foreground activation ambiguity is known, stop repeating generic activation attempts and switch to a packaged-path evidence route.
