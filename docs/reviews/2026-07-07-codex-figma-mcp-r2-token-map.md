# Review: figma-mcp-r2-token-map

## 1. Summary

Completed R2 of the Figma MCP UI/UX read plan: read exact Figma variable
values for the five known token collections and mapped them to the current
Auto SVGA CSS token layer.

No client UI, CSS, product scope, or implementation behavior was changed.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `f7e2586c`
- Uncommitted changes before work:
  - `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- Untracked files before work: none related to R2

## 3. Changed files

- `docs/research/figma-mcp-call-log.md`
- `docs/research/figma-mcp-read-packets/r2-token-map-20260707.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `docs/reviews/2026-07-07-codex-figma-mcp-r2-token-map.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Read exact values for all five Figma variable collections | Done |
| 2 | Capture variable ID, name, type, modes, value/alias target, and scope | Done |
| 3 | Map Figma variables to current code tokens | Done |
| 4 | Record gap list and debt list before WP1 | Done |
| 5 | Update Figma MCP usage log | Done |
| 6 | Add task retrospective and ledger entry | Done |
| 7 | Do not modify app UI or CSS | Done |

## 5. Verification

Commands run and results:

```bash
rg --files | rg 'short-term.*css|macos.*css|tokens|design-system|modules\\.css$'
```

Located the active short-term CSS token files and design-system check.

```bash
python3 - <<'PY'
from pathlib import Path
import re
p=Path('tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css')
text=p.read_text()
defs=re.findall(r'\\s(--asv-[a-zA-Z0-9_-]+)\\s*:', text)
refs=re.findall(r'var\\((--asv-[a-zA-Z0-9_-]+)', text)
print('defs', len(set(defs)))
print('refs', len(set(refs)))
PY
```

`short-term-macos.tokens.css` contains 480 unique token definitions and 246
unique token references.

```bash
git diff --check
```

Passed.

```bash
node -e "const fs=require('fs'); const lines=fs.readFileSync('docs/retrospectives/TASK_RETRO_LEDGER.jsonl','utf8').trim().split(/\n/); lines.forEach((line,i)=>JSON.parse(line)); console.log('jsonl lines', lines.length);"
```

Passed; `TASK_RETRO_LEDGER.jsonl` contains 5 valid JSONL entries.

## 6. Output inspection

- Figma token collections: 5
- Figma variables: 95
- Initial all-token read: truncated; not used as final source
- Split collection reads: complete
- Screenshots: none
- Client app: not touched

## 7. Risks

- The current code already has a large component-token layer. WP1 must add
  Figma base/semantic alignment without breaking existing compatibility aliases.
- Figma color variables are mostly base aliases; code currently uses
  translucent surfaces and `color-mix`. Some visual depth choices may need to
  remain component/effect tokens until component reads clarify intent.
- Exact token alignment will require CSS changes in WP1; R2 only documents the
  target map.

## 8. Next steps

- Proceed to R3 corrected component index, or start WP1 only after accepting
  the R2 token map as the implementation input.
- When WP1 starts, add base palette, spacing scale, radius scale, and missing
  semantic tokens first.
- Preserve compatibility aliases during migration.

## 9. Commit

- Commit: recorded in final response; the review file is committed together
  with the task changes, so it does not self-reference a mutable commit hash.
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers:
  - First all-token read was too large and got truncated.
  - Token mapping required comparing Figma variables against the existing
    480-token CSS layer.
- Avoidable costs:
  - Future token reads should split by collection immediately instead of
    attempting all variables in one response.
- Product lessons:
  - Figma tokens guide implementation but do not override PRD scope.
- Technical lessons:
  - Current CSS token structure is extensive but lacks a Figma-aligned base
    palette and full spacing/radius scale.
- Design / interaction lessons:
  - Visual polish should not begin until base/semantic token drift is resolved
    deliberately; otherwise polish will keep fighting the token layer.
- Process lessons:
  - R2 should remain a documentation-only preparation step. Mixing token reads
    with CSS edits would make truncation recovery and review harder.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes

## 11. Token usage

- Source: unavailable
- Input tokens: null
- Cached input tokens: null
- Output tokens: null
- Reasoning output tokens: null
- Total tokens: null
- Token lesson: split Figma variable reads by collection to reduce retry and
  response-truncation cost.
