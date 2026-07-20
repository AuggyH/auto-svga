# Review: figma-mcp-atomic-read-strategy

## 1. Summary

Updated the Figma MCP UI/UX read plan so the next component-library pass follows
the Owner-confirmed atomic design hierarchy: module -> molecule -> atom.

This task did not call Figma MCP, did not change product scope, and did not
touch client implementation files. It only changed the read strategy and
retrospective records so the next authorized Figma read avoids broad component
scans and quota waste.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `8155a691`
- Uncommitted changes before this task:
  - `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- Untracked files before this task: none observed

## 3. Changed files

- `docs/research/figma-mcp-uiux-read-plan.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `docs/reviews/2026-07-07-codex-figma-mcp-atomic-read-strategy.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Do not call Figma MCP without explicit Owner authorization. | Done |
| 2 | Replace flat component-library scanning with module-first atomic hierarchy reading. | Done |
| 3 | Preserve PRD authority and avoid redefining product scope. | Done |
| 4 | Keep client implementation files untouched in this documentation task. | Done |
| 5 | Record task retrospective material for future process reuse. | Done |

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
rg -n 'Atomic Component Hierarchy|R3b|Module-first|Owner authorization' docs/research/figma-mcp-uiux-read-plan.md docs/reviews/2026-07-07-codex-figma-mcp-atomic-read-strategy.md
```

Result: passed. The updated read-plan checkpoints are discoverable in the
plan, review, and lesson candidate files.

## 6. Output inspection

- Product scope: unchanged; main PRD remains `docs/product/PRODUCT_ROADMAP.md`.
- Figma quota: no new MCP read calls consumed.
- Asset policy: no PNG, SVGA, GIF, or design asset committed.
- Client behavior: unchanged.

## 7. Risks

- R3 still requires a real Figma MCP call later. The plan now requires explicit
  Owner authorization before that call.
- Some component layer classifications may remain provisional until R3 returns
  explicit Figma hierarchy evidence.
- The current implementation worktree still contains unrelated modified client
  files that this task intentionally did not stage or change.

## 8. Next steps

- Ask Owner for explicit R3 authorization when ready.
- If authorized, read only the `🧱 组件库` top-level hierarchy, capped at two
  structured reads.
- Write `r3-atomic-component-hierarchy-YYYYMMDD.md`, then perform R3b locally
  before any R4 component-detail reads.

## 9. Commit

- Commit: this review is included in the task commit; final hash is reported in
  the task response.
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers:
  - R3/R4 needed replanning before another quota-consuming Figma read.
  - The existing plan still reflected a flat component-index mental model.
- Avoidable costs:
  - Future component reads should not start by sweeping all atoms/molecules
    when the Figma file already has an atomic hierarchy.
- Product lessons:
  - Component hierarchy improves implementation routing but does not change
    short-term product scope.
- Technical lessons:
  - Figma reads should capture stable component contracts, not every descendant
    layer.
- Design / interaction lessons:
  - Module-first reading preserves the intended design-system composition and
    makes the code implementation easier to trace back to design units.
- Process lessons:
  - The Owner authorization gate should be embedded into every quota-consuming
    Figma MCP round before it is executed.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  Yes

## 11. Token usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: classify component hierarchy before reading component details
  to reduce Figma quota and context waste.
