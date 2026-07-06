# Review: expanded baseline retrospective

## 1. Summary

Expanded the first project retrospective from a recent-week scan into an
inception-to-current-head baseline retrospective. The new baseline documents
stage history, review-volume signals, recurring slowdown causes, and a default
execution path for future tasks.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `fea5db76`
- Uncommitted changes before work:
  - `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- Untracked files before work: none related to this task

## 3. Changed files

- `docs/retrospectives/PROJECT_BASELINE_RETROSPECTIVE.md`
- `docs/retrospectives/weekly/2026-W28.md`
- `docs/retrospectives/PROJECT_EXPERIENCE_GUIDE.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/PROJECT_REVIEW_SYSTEM.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `docs/reviews/2026-07-06-codex-expanded-baseline-retrospective.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Expand the first retrospective scope back to project inception. | Done |
| 2 | Prefer broad scan over missing important historical signal. | Done |
| 3 | Keep scan boundary honest and reusable. | Done |
| 4 | Extract useful project-speed lessons, not only token lessons. | Done |
| 5 | Preserve product-document authority boundaries. | Done |
| 6 | Avoid touching unrelated UI/UX working files. | Done |

## 5. Verification

Commands run and results:

```bash
git diff --check
```

Passed.

```bash
python3 - <<'PY'
import json
from pathlib import Path
path = Path('docs/retrospectives/TASK_RETRO_LEDGER.jsonl')
count = 0
for i, line in enumerate(path.read_text().splitlines(), 1):
    if not line.strip():
        continue
    json.loads(line)
    count += 1
print(f'parsed {count} jsonl entries')
PY
```

Passed: parsed 3 JSONL entries.

## 6. Output inspection

- Baseline scope covers current history from 2026-06-02 through 2026-07-06.
- Baseline includes `docs/` inventory, review inventory, loop history count,
  stage narratives, slowdown causes, and task-specific routing guidance.
- It explicitly states the scan was not a literal line-by-line read of every
  historical artifact.

## 7. Risks

- Historical stage labels are synthesis labels, not formal release names.
- Review-pattern counts are useful signals, not acceptance metrics.
- Token usage for this exact Codex task was not available from the local
  repository, so the ledger records `unavailable` rather than inventing counts.

## 8. Next steps

- Future weekly reviews should read this baseline first, then inspect only new
  reviews and ledger entries since the previous retrospective.
- Large milestones should use the baseline's P6/P6-R1 anti-patterns as a
  preflight checklist.

## 9. Commit

- Commit: pending
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: intentionally broad first-time scan across history, docs,
  review files, loop summaries, product docs, and retrospectives.
- Avoidable costs: future tasks should not repeat this scan; use the baseline
  as the historical router.
- Product lessons: product resets accelerate the project only when reflected
  in authority docs and old scope is stopped from leaking back in.
- Technical lessons: vertical user-flow ownership reduces integration debt
  better than pure technical-layer slicing.
- Design / interaction lessons: UI/UX polish needs bundle-level closure and
  foreground acceptance, not endless tiny review loops.
- Process lessons: review discipline is valuable, but review volume itself can
  become a cost center.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes

## 11. Token usage

- Source: unavailable
- Input tokens: null
- Cached input tokens: null
- Output tokens: null
- Reasoning output tokens: null
- Total tokens: null
- Token lesson: a broad historical scan is justified once for baseline
  creation, but should be replaced by targeted reads for ordinary tasks.
