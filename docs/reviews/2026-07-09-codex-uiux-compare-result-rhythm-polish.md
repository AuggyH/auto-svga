# Review: uiux-compare-result-rhythm-polish

## 1. Summary

Refined the Auto SVGA 0.1.x Compare and Optimization Compare surfaces without
changing product behavior. This slice first corrected the smoke screenshot
viewport for `short-term-general-compare` and `short-term-optimization-result`
so they render at the default workbench size instead of a square launch-sized
viewport. After that, it lightly polished the right comparison surface:
`退出对比` now uses the primary button treatment, and the right-side compare
header uses spacing and text hierarchy instead of a hard divider line.

No new visible copy, controls, product state, or save/optimization logic was
added.

## 2. Git state

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `bcd140f9`
- Uncommitted changes: unrelated PM/QA files existed before this UI/UX slice and
  were not touched.
- Untracked files: unrelated PM/QA review/report files existed before this
  UI/UX slice and were not touched.

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-09-codex-uiux-compare-result-rhythm-polish.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Preserve PRD compare entry/exit and optimization save behavior. | Done |
| 2 | Do not add product-doc-absent copy, controls, modes, or labels. | Done |
| 3 | Keep General Compare as two canvas regions plus one right comparison surface. | Done |
| 4 | Keep Optimization Compare save actions fail-closed for no-benefit output. | Verified |
| 5 | Use tokenized CSS and existing component/module boundaries. | Done |
| 6 | Improve screenshot evidence quality before visual judgment. | Done |

## 5. Verification

Commands run and results:

```bash
node --test --test-name-pattern "default Electron renderer|short-term design system|short-term optimization result UI" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
```

Passed.

```bash
npm run desktop:short-term:design-system-check
```

Passed.

```bash
npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke
```

Passed.

```bash
git diff --check -- tools/electron-prototype/experiments/svga-web/main.cjs tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-model.mjs tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-surface.mjs tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css
```

Passed.

## 6. Output inspection

- General Compare screenshot:
  `.artifacts/product/short-term/short-term-general-compare.png`
- Optimization Compare screenshot:
  `.artifacts/product/short-term/short-term-optimization-result.png`
- Both screenshots now render at `2880 x 1800` pixels on the smoke host,
  corresponding to the default `1440 x 900` workbench viewport.
- Inspection result: the right surface keeps the correct width, the hard header
  divider is removed, and `退出对比` now has the same primary action hierarchy
  as the Owner reference direction. The optimization result save/abandon action
  hierarchy remains intact.
- Foreground packaged-app screenshot: not captured in this slice; smoke evidence
  remains regression evidence only.

## 7. Risks

- This is still a small visual rhythm pass, not final pixel-level acceptance.
- Smoke screenshots do not include the macOS menu bar or native window chrome.
- The canvas content position in the smoke compare fixture appears driven by the
  fixture animation content; this slice did not change playback fitting logic.

## 8. Next steps

- Promote the local stable app after commit so the Owner can inspect the visible
  Compare/Optimization Compare changes.
- Continue high-fidelity polish on remaining Owner-visible states, using
  foreground packaged-app screenshots with real production materials before
  final acceptance.

## 9. Commit

- Commit: pending
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 10. Project retrospective

- Value assessment: Medium
- Cost drivers: an initially misleading square smoke viewport made the Compare
  layout look more broken than it was.
- Avoidable costs: visual-state smoke scenarios should opt into the real
  workbench viewport at creation time when they are used for layout judgment.
- Product lessons: compare UI polish should improve existing action hierarchy
  and information rhythm without creating new compare entry points.
- Technical lessons: screenshot viewport size is part of the visual evidence
  contract and should be asserted alongside the renderer capture.
- Design / interaction lessons: lowering divider weight can make the right panel
  feel closer to the Owner canvas-first direction without reducing information
  density.
- Process lessons: correct evidence geometry before drawing conclusions from a
  screenshot.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes

## 11. Token usage

- Source: codex-session-token-count
- Total tokens at review drafting: 5,015,998
- Token lesson: Fixing a misleading screenshot scenario early prevents wasted
  analysis on layout problems that only exist in evidence.
