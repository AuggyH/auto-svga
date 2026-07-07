# Review: figma-mcp-r4-wp4-right-surface-dependency-contracts

## 1. Summary

Recorded the Owner-authorized R4 Figma MCP reads for the key WP4 Preview
right-surface molecule/atom dependencies. Unlike the previous metadata-only
right-surface module read, these `get_design_context` reads returned usable
component contracts: layout, typography, token names, visible copy, variants,
and screenshot context.

No app UI implementation was changed in this round.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `9bd1acc7`
- Uncommitted changes before work:
  - `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- Untracked files before work: none observed

## 3. Changed files

- `docs/research/figma-mcp-call-log.md`
- `docs/research/figma-mcp-read-packets/r4-wp4-right-surface-dependency-contracts-20260707.md`
- `docs/research/figma-mcp-uiux-read-plan.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `docs/reviews/2026-07-07-codex-figma-mcp-r4-wp4-right-surface-dependency-contracts.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Do not call Figma MCP without explicit Owner authorization | Done. Owner approved this follow-up batch. |
| 2 | Avoid full component-library reads | Done. Read only five WP4 dependencies. |
| 3 | Stay within strict read budget | Done. Planned 3, hard cap 5, actual 5. |
| 4 | Judge implementation route after molecule/atom reads | Done. WP4 first pass can proceed from these contracts. |
| 5 | Do not change app UI or product scope from read output | Done. Documentation only. |

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

- Packet includes contracts for `Molecule/统计信息网格`,
  `Molecule/资源列表行`, `Atom/文件信息头部/默认`, `Atom/筛选标签栏`, and
  `Molecule/缺省`.
- No Figma PNGs, remote assets, or generated runtime output were committed.
- Transient Figma asset URLs were intentionally summarized away; implementation
  must use runtime thumbnails/placeholders, not Figma asset URLs.
- Client files were not edited.

## 7. Risks

- The full right-surface state tree is still not available as a single module
  contract. WP4 should use R1 screenshots for whole-panel vertical composition.
- `get_design_context` returns React/Tailwind-flavored reference code. It must
  be translated into the existing Electron HTML/CSS token/component system.
- Dark-mode component screenshots were not separately captured in this batch.

## 8. Next steps

- Start WP4 Preview default right-surface implementation using R1 screenshots,
  R2 tokens, Batch 06 right-surface state index, and this dependency packet.
- Do not request another Figma read unless implementation exposes a concrete
  visible mismatch that cannot be resolved from the current evidence.

## 9. Commit

- Commit: produced by this review commit; see final handoff / git log
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: five component reads were needed to cover the minimum WP4
  dependency set after the first pilot proved the path useful
- Avoidable costs: avoid judging implementation readiness from module metadata
  alone
- Product lessons: Figma component contracts support implementation but do not
  change PRD scope or allowed visible copy
- Technical lessons: `get_design_context` is a better fit than metadata-only
  reads for molecule/atom implementation contracts
- Design / interaction lessons: two-column fact density, low-emphasis asset
  filters, compact rows, and empty states are now grounded in component
  contracts
- Process lessons: use a pilot read before spending the whole hard cap
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  Yes

## 11. Token usage

- Source: unavailable
- Input tokens: null
- Cached input tokens: null
- Output tokens: null
- Reasoning output tokens: null
- Total tokens: null
- Token lesson: when a module read returns shells, test the smallest dependency
  set before choosing between full-library reads and screenshot-only work.
