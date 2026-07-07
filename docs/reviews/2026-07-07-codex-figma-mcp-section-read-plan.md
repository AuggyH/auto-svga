# Review: figma-mcp-section-read-plan

## 1. Summary

Refined the Figma MCP UI/UX read plan after the Owner confirmed that the
component library now has three top-level sections named `atom`, `molecule`,
and `module`.

This task did not call Figma MCP. It only narrowed the upcoming R3 plan from
"identify/classify the hierarchy" to "read three known sections and their
direct children," which should reduce quota waste and avoid weak inference.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `30749888`
- Uncommitted changes before this task:
  - `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- Untracked files before this task: none observed

## 3. Changed files

- `docs/research/figma-mcp-uiux-read-plan.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `docs/reviews/2026-07-07-codex-figma-mcp-section-read-plan.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Capture Owner's updated Figma component-library section structure. | Done |
| 2 | Do not call Figma MCP without explicit Owner authorization. | Done |
| 3 | Keep the change in UI/UX read-plan docs, not PRD scope docs. | Done |
| 4 | Preserve unrelated client implementation changes. | Done |
| 5 | Record retrospective material for later reuse. | Done |

## 5. Verification

Commands run and results:

```bash
git diff --check
```

Result: passed.

```bash
node -e '<jsonl parse check>'
```

Result: passed. `TASK_RETRO_LEDGER.jsonl` parses successfully.

```bash
rg -n 'atom|molecule|module|R3' docs/research/figma-mcp-uiux-read-plan.md docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md docs/reviews/2026-07-07-codex-figma-mcp-section-read-plan.md
```

Result: passed. The updated section-read strategy is discoverable in the plan,
lesson candidate, and review.

## 6. Output inspection

- Product scope: unchanged.
- Figma quota: no new MCP calls consumed.
- Asset policy: no design assets or screenshots committed.
- Client behavior: unchanged.

## 7. Risks

- R3 still needs a real Figma MCP call later, and that still requires explicit
  Owner authorization.
- If Figma section names change again, the R3 read plan should be refreshed
  before calling MCP.
- The worktree still contains unrelated modified client files that this task
  intentionally did not stage or modify.

## 8. Next steps

- When ready, request Owner authorization for R3.
- Proposed R3 scope: read the `🧱 组件库` page's `atom`, `molecule`, and
  `module` top-level sections plus direct child summaries.
- Expected R3 cost: 1 structured read; hard cap 3 if split by section.

## 9. Commit

- Commit: this review is included in the task commit; final hash is reported in
  the task response.
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers:
  - The read plan needed to reflect a newly organized Figma structure before
    another quota-consuming MCP call.
- Avoidable costs:
  - Future R3 calls should not infer hierarchy when explicit sections exist.
- Product lessons:
  - Figma section organization is implementation guidance, not product scope.
- Technical lessons:
  - Explicit section names make MCP payloads smaller and downstream dependency
    maps less ambiguous.
- Design / interaction lessons:
  - Atomic design is easier to preserve when the read order follows the file's
    authored structure.
- Process lessons:
  - Owner-provided Figma organization updates should be folded into the read
    plan before the next MCP call.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  Yes

## 11. Token usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: when the design file has explicit section structure, read by
  section instead of spending context on classification inference.
