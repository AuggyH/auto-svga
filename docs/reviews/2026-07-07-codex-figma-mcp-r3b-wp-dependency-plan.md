# Review: figma-mcp-r3b-wp-dependency-plan

## 1. Summary

Completed R3b: translated the R3 Atom/Molecule/Module component hierarchy into
a work-package dependency plan for later module-first R4 reads.

This task did not call Figma MCP, did not modify the Figma file, did not change
client UI code, and did not update product scope.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `f84b3090`
- Uncommitted changes before this task:
  - `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- Untracked files before this task: none observed

## 3. Changed files

- `docs/research/figma-mcp-read-packets/r3b-wp-component-dependency-plan-20260707.md`
- `docs/research/figma-mcp-uiux-read-plan.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `docs/reviews/2026-07-07-codex-figma-mcp-r3b-wp-dependency-plan.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Perform R3b without Figma MCP calls. | Done |
| 2 | Map each WP to module roots and allowed molecule/atom follow-ups. | Done |
| 3 | Identify dependencies blocked until R4 module reads. | Done |
| 4 | Keep product scope governed by the main PRD. | Done |
| 5 | Preserve unrelated client implementation changes. | Done |
| 6 | Record task retrospective material. | Done |

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
rg -n 'R3b|Module/启动页模块/默认|R4 Read Queue|Blocked' docs/research/figma-mcp-read-packets/r3b-wp-component-dependency-plan-20260707.md docs/research/figma-mcp-uiux-read-plan.md
```

Result: passed. The R3b packet and updated read plan expose the module-first
R4 queue and blocked-dependency list.

## 6. Output inspection

R3b output:

`docs/research/figma-mcp-read-packets/r3b-wp-component-dependency-plan-20260707.md`

Key outcome:

- Next Figma MCP round is R4, not R3.
- R4 must remain module-first.
- Recommended first R4 target:
  `Module/启动页模块/默认` (`125:42`)
- Expected first R4 call budget: 1 call
- First R4 hard cap: 2 calls if compact retry is needed

## 7. Risks

- R3b is a routing plan, not implementation evidence.
- Right surface, center canvas, optimization, settings, and edit details remain
  blocked until targeted R4 module reads.
- If the Figma design changes before R4, the dependency plan should be checked
  against the updated node names/IDs before calling MCP.

## 8. Next steps

- Ask Owner for explicit R4 authorization before any further Figma MCP calls.
- Recommended first R4 target is `Module/启动页模块/默认` (`125:42`) for WP3.
- After R4 launch contract is recorded, start the smallest launch visual
  implementation slice or continue with the next module read if implementation
  still lacks enough evidence.

## 9. Commit

- Commit: this review is included in the task commit; final hash is reported in
  the task response.
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers:
  - R3b needed to reconcile PRD work packages with the Figma module hierarchy.
- Avoidable costs:
  - Future agents should not jump from hierarchy map directly to broad R4 reads.
- Product lessons:
  - Figma dependency routing supports implementation but does not redefine PRD
    scope.
- Technical lessons:
  - A WP-to-module queue lowers the risk of reading low-priority component
    details.
- Design / interaction lessons:
  - Module-first planning preserves the design-system composition instead of
    treating atoms as the implementation entry point.
- Process lessons:
  - Insert no-MCP planning steps between expensive Figma read rounds when they
    materially reduce the next call scope.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  Yes

## 11. Token usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: cheap local dependency planning can save multiple Figma MCP
  reads later.
