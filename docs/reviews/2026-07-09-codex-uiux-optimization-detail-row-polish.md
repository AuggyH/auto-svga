# Review: UI/UX Optimization Detail Row Polish

## 1. Summary

Aligned the Preview optimization detail candidate rows with the current Figma
`预览 / 优化详情` row rhythm. The change keeps all optimization logic and visible
product copy unchanged, but moves the candidate rows from large multi-line
engineering cards toward compact tokenized rows with clearer status hierarchy.

## 2. Git state

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `3338bfd7`
- Uncommitted changes before this WP: existing PM/QA lane files plus UI/UX
  files from this WP; unrelated PM/QA files were not modified or staged.
- Foreground strategy: none. This WP used Figma MCP read metadata and smoke
  screenshots only; no foreground desktop client automation was required.

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.atoms.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/research/figma-mcp-call-log.md`
- `docs/research/figma-mcp-read-packets/r5-optimization-detail-surface-20260709.md`
- `docs/reviews/2026-07-09-codex-uiux-optimization-detail-row-polish.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Keep product scope and optimization behavior unchanged | Done |
| 2 | Use tokenized CSS instead of hardcoded owner-visible component values | Done |
| 3 | Preserve safe/review/unsupported candidate status distinctions | Done |
| 4 | Record Figma MCP usage before applying design-derived changes | Done |
| 5 | Keep smoke screenshot evidence as regression evidence only, not final Owner visual acceptance | Done |

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

- Smoke artifact inspected:
  `.artifacts/product/short-term/short-term-preview-optimization.png`
- Candidate rows now use compact single-line title/summary treatment, inline
  impact values, and right-aligned status badges.
- No new visible text, buttons, states, or optimization behavior were added.
- Remaining limitation: this is smoke screenshot evidence without macOS window
  chrome; packaged foreground review is still required before Owner acceptance.

## 7. Risks

- Long optimization summaries now ellipsize in the candidate row. The full
  title/summary remains available through the existing row title attribute, but
  a future design pass may need a richer hover or disclosure treatment if Owner
  asks for full inline details.
- Figma sample shows a simplified row without the implementation's impact value;
  this WP kept the impact value because it is already part of the product
  surface.

## 8. Next steps

- Continue the next UI/UX WP from the active 5-hour goal.
- Consider packaging a refreshed local stable app after one more meaningful
  visible surface polish, since the current promoted app still predates the
  latest right-surface and optimization-detail commits.

## 9. Commit

- Commit: pending at review creation
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 10. Project retrospective

- Value assessment: Medium
- Cost drivers:
  - Needed to reconcile current implementation rows with Figma's compact
    optimization detail row while preserving product-owned optimization copy.
  - Shared dirty checkout required path-scoped staging.
- Avoidable costs:
  - Optimization row rhythm could have been tokenized when the optimization
    surface was first introduced.
- Product lessons:
  - Figma visual rhythm can guide hierarchy without changing PRD-defined
    optimization behavior.
- Technical lessons:
  - Candidate-row typography, badge, impact, and unsupported-state styling need
    explicit component tokens to prevent drift.
- Design / interaction lessons:
  - Optimization findings need status grouping, but compact row rhythm keeps
    the right surface from reverting to engineering-card density.
- Process lessons:
  - A single targeted Figma read was sufficient because the implementation
    question was specific before calling MCP.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  Yes

## 11. Token usage

- Source: codex-goal-token-count
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: 7817418
- Token lesson: Ask a narrow implementation question before reading Figma; one
  compact node read can be enough for a visual WP when scope is already fixed.
