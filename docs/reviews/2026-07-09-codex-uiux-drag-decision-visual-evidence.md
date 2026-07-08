# Review: uiux-drag-decision-visual-evidence

## 1. Summary

Added nonforeground smoke screenshot evidence for the short-term drag decision
overlay. The existing drag hit testing already followed the latest PRD contract:
Add As Compare File is the top 25% secondary zone, and Open File is the lower
75% primary zone. This slice adds visual artifacts so the top/bottom split and
unsupported-file rejection can be reviewed from screenshots, not only JSON proof.

No normal product UI behavior, visible copy, or drag/drop decision logic was
changed.

## 2. Git state

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `c9bb5b7b`
- Uncommitted changes: unrelated PM/QA files existed before this UI/UX slice and
  were not touched.
- Untracked files: unrelated PM/QA review/report files existed before this
  UI/UX slice and were not touched.

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-runner.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-09-codex-uiux-drag-decision-visual-evidence.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Preserve top 25% Compare / lower 75% Open contract. | Done |
| 2 | Do not reintroduce left/right drag decision overlay. | Done |
| 3 | Unsupported file drag shows rejection copy in the focused zone. | Captured |
| 4 | Add visual evidence without changing product behavior. | Done |
| 5 | Keep smoke artifacts tied to host scenario allowlist and workbench sizing. | Done |

## 5. Verification

Commands run and results:

```bash
node --test --test-name-pattern "default Electron renderer|short-term design system" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
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

## 6. Output inspection

- Supported drag visual evidence:
  `.artifacts/product/short-term/short-term-drag-decision-supported.png`
- Unsupported drag visual evidence:
  `.artifacts/product/short-term/short-term-drag-decision-unsupported.png`
- Inspection result: supported screenshot shows the top Compare strip as the
  focused green zone and lower Open as the larger primary region. Unsupported
  screenshot shows the lower Open region in red with `不支持的文件格式`.
- Foreground packaged-app screenshot: not captured in this slice because this is
  smoke evidence infrastructure, not a normal UI behavior change.

## 7. Risks

- Smoke screenshots remain regression evidence only. Final interaction feel
  still needs foreground packaged-app validation with a real dragged file.
- The overlay visual style itself was not polished in this slice; only evidence
  coverage was added.

## 8. Next steps

- Continue high-fidelity polish on owner-visible surfaces.
- Use these drag artifacts when reviewing future overlay style changes, so the
  top/bottom contract is not lost.

## 9. Commit

- Commit: pending
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 10. Project retrospective

- Value assessment: Medium
- Cost drivers: finding a capture point that showed clean drag evidence without
  save-failure banners or stale dark-mode state.
- Avoidable costs: supported/unsupported drag screenshots should have been
  captured near the drag proof when the top/bottom contract was first added.
- Product lessons: drag decision interactions need visual evidence because their
  correctness is spatial, not just boolean.
- Technical lessons: every new smoke screenshot scenario needs renderer capture,
  host allowlist, host sizing/restoration, and test assertions.
- Design / interaction lessons: evidence screenshots should be captured in the
  state being evaluated, not after unrelated failure banners or dirty state.
- Process lessons: inspect generated screenshots before committing smoke evidence
  so polluted artifacts do not become the baseline.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes

## 11. Token usage

- Source: codex-session-token-count
- Total tokens at review drafting: 4,490,813
- Token lesson: Screenshot evidence is worth the small cost when the UX contract
  depends on spatial layout.
