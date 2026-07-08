# Review: uiux-right-surface-token-rhythm

## 1. Summary

Aligned a small part of the Auto SVGA 0.1.x Preview right surface with the
existing Figma R4 dependency packet. This pass only adjusts design tokens for
component rhythm: selected filter tabs now use the canvas-gray selected surface
without an extra ring, and the fact grid uses the Figma-recorded 12px top
padding and 16px row gap.

No product copy, feature behavior, or data flow was changed.

## 2. Git state

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `36cc8f5c`
- Uncommitted changes: unrelated PM/QA files existed before this UI/UX slice and
  were not touched.
- Untracked files: unrelated PM/QA review/report files existed before this
  UI/UX slice and were not touched.

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-09-codex-uiux-right-surface-token-rhythm.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Preserve PRD scope and avoid new visible text / controls. | Done |
| 2 | Keep the Owner-confirmed two-column fact grid. | Done |
| 3 | Use tokenized implementation rather than one-off module CSS. | Done |
| 4 | Align first-pass right-surface rhythm with Figma R4 dependency packet. | Done |
| 5 | Keep dark/light support and design-system guardrails intact. | Verified by checks |

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

- Smoke screenshot inspected:
  `.artifacts/product/short-term/short-term-preview-overview-wide.png`
- Result: right-surface fact grid spacing is less cramped and the selected tab
  surface is quieter. No overflow or canvas regression was observed in the wide
  smoke screenshot.
- Foreground packaged-app screenshot: not captured in this slice; smoke evidence
  remains regression evidence only.

## 7. Risks

- This is a token-level visual polish slice, not final pixel acceptance.
- The right surface still needs packaged foreground screenshots with real
  production SVGA materials before Owner acceptance.

## 8. Next steps

- Continue with the next high-value UI/UX WP, preferably drag decision overlay
  visual evidence or another Figma-backed Preview surface polish.
- Promote the local stable app after commit so Owner can quickly inspect the
  visible token changes.

## 9. Commit

- Commit: pending
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 10. Project retrospective

- Value assessment: Medium
- Cost drivers: verifying that the change stayed inside token contracts and did
  not expand product scope.
- Avoidable costs: none significant; existing Figma packet avoided a new Figma
  MCP read.
- Product lessons: Figma component contracts are useful when they are applied as
  token changes rather than new UI semantics.
- Technical lessons: exact token assertions help keep small visual contracts from
  drifting.
- Design / interaction lessons: selected states can be legible without extra
  blue tint or border rings when the hierarchy is already clear.
- Process lessons: use existing Figma read packets before spending additional MCP
  budget.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes

## 11. Token usage

- Source: codex-session-token-count
- Total tokens at review drafting: 4,086,168
- Token lesson: Small Figma-backed token slices are efficient when prior read
  packets already contain the component contract.
