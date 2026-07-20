# Review: Figma MCP R4 Canvas And Playback Contracts

## 1. Summary

Completed a scoped Figma MCP read batch for the next short-term UI/UX
implementation pass. The batch captured implementation-ready contracts for the
center canvas module, playback control bar, Preview/Edit mode switch, and
shared icon-button atom.

No product scope, app code, Figma file content, or Figma Make AI output was
changed.

## 2. Git state

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `7295b69c`
- Pre-existing uncommitted changes not owned by this batch:
  - `docs/product/SHORT_TERM_DISTRIBUTION_PREP.md`
  - `docs/quality/PROJECT_TEST_ENGINEER_WORKFLOW.md`
  - `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
  - `docs/reviews/2026-07-08-codex-local-stable-drag-decision-refresh.md`
  - `docs/reviews/2026-07-08-codex-local-stable-qa-regression-refresh.md`
  - `docs/reviews/2026-07-08-codex-local-stable-qa006-refresh.md`
  - `docs/reviews/2026-07-08-codex-owner-client-baseline-routing.md`

## 3. Changed files

- `docs/research/figma-mcp-call-log.md`
- `docs/research/figma-mcp-uiux-read-plan.md`
- `docs/research/figma-mcp-read-packets/r4-canvas-playback-contracts-20260708.md`
- `docs/reviews/2026-07-08-codex-figma-mcp-r4-canvas-playback-contracts.md`

## 4. Requirement checks

| # | Requirement | Status |
| --- | --- | --- |
| 1 | Stay within standing Figma MCP budget authorization. | Done: current local-day usage was 0/160 before the batch and 4/160 after. |
| 2 | Avoid broad scans and read only named implementation targets. | Done: four named nodes were read; no full page, `备份` page, all-atom, all-molecule, or all-module read was performed. |
| 3 | Record planned vs actual usage. | Done in the packet and call log. |
| 4 | Convert Figma output into project-specific implementation facts. | Done in the packet; generated React/Tailwind is treated only as design context. |
| 5 | Preserve PRD authority over Figma. | Done: the stale Figma left/right drag overlay is explicitly overridden by current PRD top/bottom 25/75 behavior. |

## 5. Verification

Figma MCP calls:

```text
_get_design_context 238:4602 -> complete, 6.6146s
_get_design_context 115:1098 -> complete, 5.2083s
_get_design_context 95:37 -> complete, 4.2247s
_get_design_context 105:23 -> complete, 4.1495s
```

Repository checks:

```text
git status --short --branch
confirmed branch and pre-existing dirty files before work

rg "Date: 2026-07-08" docs/research/figma-mcp-call-log.md
no existing same-day call-log entry before this batch
```

## 6. Output inspection

- Canvas module: `920 x 800`, top-center mode switch at `16px`, centered
  `300 x 300` artwork sample, bottom playback bar.
- Playback controls: `44px` controls, `16px` gap, `24px/12px` padding,
  `20px` icon slot, `3px` progress track, `12px/18px` time text.
- Mode switch: full pill shell, `4px` outer padding, `12px/8px` segment
  padding, active segment uses float surface and subtle shadow.
- Icon button: primary and secondary variants both `44 x 44`, with tokenized
  primary background and secondary text-color icon.
- PRD conflict found: Figma canvas module still shows old left/right drag
  decision overlay; current implementation must use PRD top/bottom split.

## 7. Risks

- Figma component output is useful for visual contracts but does not override
  PM-corrected product behavior.
- The next UI pass should validate against the owner-visible installed app and
  real foreground screenshots, not smoke screenshots alone.

## 8. Next steps

- Implement the canvas/playback visual pass using Batch 08:
  - top-center mode switch;
  - playback rhythm and icon-button sizing;
  - PRD-compliant top/bottom drag-decision overlay.
- Run design-system checks and real foreground visual evidence after code
  changes.

## 9. Commit

- Commit: finalized by this commit; use `git log -1 --oneline` for the exact hash.
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: Figma MCP reads must be scoped to named nodes and reconciled
  with PRD drift.
- Avoidable costs: Broad component-library scans were avoided.
- Product lessons: Figma can lag behind PM-corrected interaction contracts; the
  packet must name the authoritative override.
- Technical lessons: `_get_design_context` is efficient for concrete component
  contracts when the node target is already known.
- Design / interaction lessons: Canvas and playback polish should now move from
  generic engineering shell toward tokenized 44px controls, 12px typography,
  and boundary-light segmented controls.
- Process lessons: Standing budget authorization is useful only when paired
  with per-batch hard caps and written post-read records.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  Yes, after the current shared retrospective ledger dirty state is resolved.

## 11. Token usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: The node-targeted read produced implementation-ready contracts
  in four calls; future reads should continue to target component dependencies,
  not whole pages.
