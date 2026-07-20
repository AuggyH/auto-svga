# Review: uiux-edit-reserved-layer-polish

## 1. Summary
Continued Auto SVGA 0.1.x / SVGA Preview MVP UI/UX polish on the short-term Edit reserved state.

This slice keeps Edit mode within the confirmed short-term boundary: left layer list, center playback canvas, and an empty right operation area. No editing controls, explanatory placeholder copy, new labels, or new behavior were added. The change only reduces the visual weight of the layer rows by giving `LayerRow` its own thumbnail size and typography tokens instead of inheriting the heavier resource-list presentation.

## 2. Git state
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `7a3e6c20`
- Shared checkout note: unrelated PM/QA dirty files were already present and were not edited by this UI/UX slice.

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-09-codex-uiux-edit-reserved-layer-polish.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Edit mode remains reserved for short-term, without inactive advanced controls. | Done |
| 2 | Left layer list shows layer thumbnail and layer name, excluding audio. | Unchanged |
| 3 | Right operation area stays empty; do not add placeholder explanation text. | Done |
| 4 | Use tokenized component styles, not one-off values in component CSS. | Done |
| 5 | Preserve Preview/Edit mode switch at canvas top center. | Unchanged |
| 6 | Treat smoke screenshot as regression evidence only; final visual acceptance still needs packaged foreground evidence. | Done |

## 5. Verification
Commands run and results:
```bash
node --test --test-name-pattern "short-term design system" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
# PASS: 1/1

npm run desktop:short-term:design-system-check
# PASS

npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke
# PASS

git diff --check
# PASS

node --test --test-name-pattern "default Electron renderer|short-term design system|short-term metric values" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
# PASS: 3/3
```

## 6. Output inspection
- Reviewed `.artifacts/product/short-term/short-term-edit-reserved.png` after smoke.
- `LayerRow` now has a smaller row-specific thumbnail token and lighter title typography, reducing the debug-list feeling without adding selection, editing, or controls.
- Smoke artifact viewport is `720 x 720`; it is useful for regression but clips the full three-column Edit workbench and must not be used as the final full-layout visual acceptance screenshot.

## 7. Risks
- The right reserved operation area remains intentionally empty, so final evaluation should judge whether the real packaged window feels balanced at the wide Preview/Edit size.
- Smoke screenshots do not include macOS chrome or the full owner-visible window context.

## 8. Next steps
- Include Edit reserved in the next packaged foreground visual pass.
- Continue high-fidelity polish on owner-visible states that can be improved without expanding product scope.

## 9. Commit
- Commit: pending
- Branch: `agent/codex/short-term-preview-qa-20260708`

## 10. Project retrospective
- Value assessment: Medium
- Cost drivers: Edit reserved is intentionally sparse, so polish must avoid adding fake controls or explanatory text to make the screen look finished.
- Avoidable costs: Do not judge the full three-column Edit layout from the `720 x 720` smoke screenshot; use it only as regression evidence.
- Product lessons: A reserved mode can still need precise component tokens, but the visual system must not imply unsupported editing capability.
- Technical lessons: `LayerRow` should own its row density and thumbnail size rather than reusing the heavier generic asset/resource row proportions.
- Design lessons: Lowering typography and thumbnail weight is a safer short-term polish than adding selection states, cards, or placeholder copy.
- Process lessons: When a smoke artifact viewport is smaller than the app minimum layout, record that evidence limitation immediately to avoid repeated false layout findings.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes

## 11. Token usage
- Source: codex-goal-token-count
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: 2547330
- Token lesson: Before changing a sparse reserved state, verify whether the issue is a real layout problem or a smoke viewport artifact.
