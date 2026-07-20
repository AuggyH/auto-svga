# Review: figma-mcp-r4-right-surface-state-index

## 1. Summary

Recorded the Owner-authorized R4 Figma MCP read for `Module/右侧栏`
(`227:2861`). The read produced a useful 16-state right-surface index, but the
available metadata path did not expose variant internals. This is therefore a
partial R4 result, not a pixel-level implementation contract.

No app UI implementation was changed in this round.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `2294f116`
- Uncommitted changes before work:
  - `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- Untracked files before work: none observed

## 3. Changed files

- `docs/research/figma-mcp-call-log.md`
- `docs/research/figma-mcp-read-packets/r4-right-surface-state-index-20260707.md`
- `docs/research/figma-mcp-uiux-read-plan.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `docs/reviews/2026-07-07-codex-figma-mcp-r4-right-surface-state-index.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Do not call Figma MCP without explicit Owner authorization | Done. Owner confirmed authorization before this R4 read. |
| 2 | Keep R4 module-first and scoped to one target | Done. Only `Module/右侧栏` and its default Preview symbol were read. |
| 3 | Respect the planned hard cap | Done. Stopped at 2 reads. |
| 4 | Record actual tool usage and result quality | Done in call log and packet. |
| 5 | Do not change app UI or product scope from partial evidence | Done. Documentation only. |

## 5. Verification

Commands run and results:

```bash
git diff --check
```

Passed with no output.

```bash
node -e "const fs=require('fs');const p='docs/retrospectives/TASK_RETRO_LEDGER.jsonl';fs.readFileSync(p,'utf8').trim().split(/\\n/).forEach((line)=>JSON.parse(line));console.log('TASK_RETRO_LEDGER jsonl ok')"
```

Passed: `TASK_RETRO_LEDGER jsonl ok`.

## 6. Output inspection

- R4 packet captures the right-surface state list for Preview, Optimization,
  Edit, and Compare.
- No Figma screenshots, PNGs, production assets, or runtime output were added.
- No client files were changed.
- The packet explicitly marks the result partial and blocks pixel-level WP4
  implementation from this metadata alone.

## 7. Risks

- Two quota-counted reads were spent without obtaining a complete right-surface
  component contract. The useful result is a state index, not layout detail.
- Repeating the same metadata path on additional right-surface symbols is
  likely to waste quota. The next read needs a structured child/context path.

## 8. Next steps

- If Owner authorizes another Figma MCP batch, target `模式=预览, 状态=默认`
  (`227:2796`) using a structured child/context read, not metadata-only shell
  output.
- If that read path is unavailable, use R1 screenshots for a rough visual
  analysis pass only and avoid claiming pixel-level implementation readiness.

## 9. Commit

- Commit: produced by this review commit; see final handoff / git log
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none

## 10. Project retrospective

- Value assessment: Medium
- Cost drivers: the available Figma metadata path did not expose component-set
  variant internals
- Avoidable costs: next right-surface read should not repeat `_get_metadata`
  on symbols
- Product lessons: partial Figma evidence must not redefine PRD or trigger UI
  implementation by guesswork
- Technical lessons: metadata-only Figma reads can validate state inventory but
  not layout contracts for symbol internals
- Design / interaction lessons: right-surface pixel polish still needs visible
  hierarchy and nested component details
- Process lessons: hard caps prevented further quota drift once the read path
  proved insufficient
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  Yes

## 11. Token usage

- Source: unavailable
- Input tokens: null
- Cached input tokens: null
- Output tokens: null
- Reasoning output tokens: null
- Total tokens: null
- Token lesson: stop after a read path proves it returns only shells; record
  the limitation and change strategy instead of trying adjacent symbols.
