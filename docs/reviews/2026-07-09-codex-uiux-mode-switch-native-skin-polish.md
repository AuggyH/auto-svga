# Review: UI/UX Mode Switch Native Skin Polish

## 1. Summary

Aligned the Preview/Edit mode switch with the Figma/Owner-confirmed low-boundary
canvas direction. The selected segment now renders as a tokenized floating
surface instead of inheriting a dark native macOS button skin in light mode.

The fix stays scoped to the mode-switch molecule. It does not add visible copy,
change product flow, or touch save/open/compare behavior.

## 2. Git state

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `082554bb`
- Uncommitted changes before this WP: unrelated PM/QA lane files plus this
  UI/UX WP.
- Foreground strategy: none. Used smoke screenshots only; no foreground client
  automation.

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.molecules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-09-codex-uiux-mode-switch-native-skin-polish.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Do not change product scope or visible copy | Done |
| 2 | Keep selected mode surface tokenized | Done |
| 3 | Prevent native button skin from overriding the mode switch | Done |
| 4 | Preserve visible focus state after component reset | Done |
| 5 | Verify both light and dark appearance screenshots | Done |

## 5. Verification

```
$ node --test --test-name-pattern "short-term design system" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS

$ npm run desktop:short-term:design-system-check
PASS

$ git diff --check -- <touched UI/UX paths>
PASS

$ npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke
PASS
```

## 6. Output inspection

- Inspected `.artifacts/product/short-term/short-term-appearance-light.png`.
- Inspected `.artifacts/product/short-term/short-term-appearance-dark.png`.
- Light mode selected segment now appears as a light floating surface.
- Dark mode selected segment remains low-contrast and consistent with the dark
  canvas.

## 7. Risks

- Smoke screenshots verify visual regression but do not replace final
  foreground packaged-app review with macOS chrome.
- The mode switch still depends on screenshot inspection for final visual
  quality; the automated guard only proves the component contract exists.

## 8. Next steps

- Continue high-fidelity polish on right-surface typography and canvas playback
  controls using the corrected screenshot evidence.
- Include this control in the next foreground packaged-app visual pass.

## 9. Commit

- Commit: pending at review creation
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 10. Project retrospective

- Value assessment: Medium
- Cost drivers:
  - The first token-only fix was insufficient because the native button skin
    still affected the rendered control.
- Avoidable costs:
  - Component-level reset should have been considered earlier for form controls
    that are visually not native buttons.
- Product lessons:
  - Figma visual direction can require removing native control chrome while
    preserving native interaction semantics.
- Technical lessons:
  - For segmented controls, reset the molecule locally rather than changing
    the global button atom.
- Design / interaction lessons:
  - Low-boundary canvas controls need selected surfaces that are visible by
    hierarchy, not by dark system chrome.
- Process lessons:
  - Use temporary runtime probes only to identify the cause, then remove them
    before validation and commit.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  No

## 11. Token usage

- Source: codex-goal-token-count
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: 9613223
- Token lesson: A targeted runtime style probe prevented broad, risky CSS
  changes after a token-only fix failed.
