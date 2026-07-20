# Review: figma-mcp-r1-screenshot-archive

## 1. Summary

Completed R1 of the Figma MCP UI/UX read plan: captured and archived 15 target
screenshots from the Auto SVGA Figma design file. This task created design
target evidence only. No app UI, product scope, or implementation logic was
changed.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `b1187239`
- Uncommitted changes before work:
  - `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- Untracked files before work: none related to R1

## 3. Changed files

- `docs/research/figma-mcp-call-log.md`
- `docs/research/figma-mcp-read-packets/r1-target-screenshot-manifest-20260707.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `docs/reviews/2026-07-07-codex-figma-mcp-r1-screenshot-archive.md`

Local non-Git archive:

- `/Users/huangtengxin/Documents/Auto_SVGA_References/figma-mcp/2026-07-07-r1-target-screenshots/`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Start from PRD/documentation hierarchy and R1 plan | Done |
| 2 | Do not access the `备份` page | Done |
| 3 | Capture R1 target screenshots using URL output, not base64 | Done |
| 4 | Save screenshots outside Git | Done |
| 5 | Record dimensions, hashes, and local archive path | Done |
| 6 | Update Figma MCP call log with actual usage | Done |
| 7 | Add task retrospective and ledger entry | Done |
| 8 | Do not modify client implementation | Done |

## 5. Verification

Commands run and results:

```bash
file /Users/huangtengxin/Documents/Auto_SVGA_References/figma-mcp/2026-07-07-r1-target-screenshots/*.png
```

All 15 target screenshots and the contact sheet are valid PNG files.

```bash
shasum -a 256 /Users/huangtengxin/Documents/Auto_SVGA_References/figma-mcp/2026-07-07-r1-target-screenshots/*.png
```

Hashes were recorded in the R1 manifest.

```bash
git diff --check
```

Passed.

```bash
node -e "const fs=require('fs'); const lines=fs.readFileSync('docs/retrospectives/TASK_RETRO_LEDGER.jsonl','utf8').trim().split(/\n/); lines.forEach((line,i)=>JSON.parse(line)); console.log('jsonl lines', lines.length);"
```

Passed; `TASK_RETRO_LEDGER.jsonl` contains 4 valid JSONL entries.

## 6. Output inspection

- Target screenshots: 15
- Launch target: 720 x 720
- Most app-state targets: 1360 x 880
- Settings target: 1280 x 800
- Contact sheet: generated and visually inspected
- Client app: not touched

## 7. Risks

- Figma screenshots are design target evidence, not Owner acceptance and not
  release evidence.
- Full-frame screenshot generation can be slow. One frame crossed the 20s soft
  threshold but completed successfully.
- Later implementation still needs foreground macOS screenshots with real
  production SVGA files.

## 8. Next steps

- Run R2 exact token value extraction before Figma-guided UI implementation.
- Keep using small read batches and URL downloads.
- Use the R1 manifest as the visual target source for WP1-WP8.

## 9. Commit

- Commit: recorded in final response; the review file is committed together
  with the task changes, so it does not self-reference a mutable commit hash.
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers:
  - 15 screenshot calls were necessary to create stable target evidence for
    the main short-term UI states.
  - Conservative rate-limit spacing added elapsed time, but protected the
    Figma quota and reduced retry risk.
- Avoidable costs:
  - None significant. A small pilot call prevented wider wasted reads.
- Product lessons:
  - Figma screenshots are design evidence only; the PRD remains the source of
    product scope.
- Technical lessons:
  - Rendered screenshot dimensions can differ from inventory frame dimensions
    because the design includes owner-visible window/shadow treatment.
- Design / interaction lessons:
  - Contact-sheet visual QA is a low-cost way to confirm the complete state
    set before code implementation begins.
- Process lessons:
  - R1 should remain separate from R2/R3. Mixing screenshots with token or
    component reads would make quota and evidence attribution harder.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes

## 11. Token usage

- Source: unavailable
- Input tokens: null
- Cached input tokens: null
- Output tokens: null
- Reasoning output tokens: null
- Total tokens: null
- Token lesson: exact token count was unavailable in the active goal state;
  future long UI/UX runs should use explicit task boundaries if exact token
  reporting is required.
