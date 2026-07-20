# Review: short-term-uiux-wp1a-figma-token-foundation

## 1. Summary

Started WP1A for the short-term UI/UX Figma-guided implementation by turning
the R2 Figma token map into code-level tokens and a regression check.

This task did not call Figma MCP, did not modify the Figma file, did not change
product scope, and did not touch the main PRD. It also does not claim visual
or Owner acceptance; foreground desktop screenshots remain required for later
page-state visual slices.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `e35509c4`
- Pre-existing uncommitted files preserved:
  - `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `docs/research/figma-mcp-uiux-read-plan.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `docs/reviews/2026-07-07-codex-short-term-uiux-wp1a-figma-token-foundation.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Convert R2 Figma token values into code tokens. | Done |
| 2 | Preserve existing compatibility aliases while adding base tokens. | Done |
| 3 | Add regression coverage so R2 token foundation cannot silently disappear. | Done |
| 4 | Avoid Figma MCP calls without Owner authorization. | Done |
| 5 | Avoid touching pre-existing dirty client files from another lane. | Done |
| 6 | Keep product scope governed by the main PRD. | Done |

## 5. Verification

Commands run and results:

```bash
npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check
```

Result: passed. The report includes
`figma-r2-token-foundation-covered: true`.

```bash
node --check tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs
```

Result: passed.

```bash
git diff --check
```

Result: passed.

## 6. Implementation notes

- Added Figma R2 base palette tokens for neutral, blue, green, red, and orange.
- Added missing base spacing and radius tokens, including 2, 6, 10, 32, 40,
  and 48 spacing values.
- Rewired key semantic color tokens through the base palette.
- Added dark-mode semantic aliases through the same base-token model.
- Added a non-product `data-radius-mode="large"` token hook so the code can
  express Figma's large radius mode later without broad component edits.
- Added design-system coverage for required R2 foundation and semantic tokens.

## 7. Risks

- This is a foundation slice, not a page-level pixel pass.
- Some visual values now follow Figma token values more closely; final visual
  quality still needs page-state screenshots and Owner review.
- The existing pre-commit dirty files were intentionally not modified or
  staged by this task.

## 8. Next steps

- Ask Owner for explicit R4 authorization before reading any Figma module
  contract.
- Recommended first R4 target remains `Module/启动页模块/默认` (`125:42`).
- After R4 launch module read, implement the smallest Launch page visual slice
  and validate with a real foreground client screenshot.

## 9. Commit

- Commit: this review is included in the task commit; final hash is reported in
  the task response.
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers:
  - Token values had to be reconciled with existing compatibility aliases and
    dark-mode behavior.
- Avoidable costs:
  - Future token extraction should immediately include a code-check plan.
- Product lessons:
  - Figma tokens guide implementation but do not redefine PRD scope.
- Technical lessons:
  - Exact token reads become useful only when wired into code and regression
    checks.
- Design / interaction lessons:
  - Token foundation should precede page-level polish, otherwise visual work
    tends to reintroduce local values.
- Process lessons:
  - No-MCP implementation slices can convert prior Figma reads into project
    progress without spending quota.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  Yes

## 11. Token usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: converting a completed Figma read into code guardrails is
  cheaper than another read and creates visible implementation leverage.
