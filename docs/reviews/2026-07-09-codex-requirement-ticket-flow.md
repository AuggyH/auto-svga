# Review: requirement-ticket-flow

## 1. Summary

Added a lightweight product requirement ticket workflow so confirmed Product
Owner feature, optimization, interaction, or production-workflow requests move
from PRD into accountable implementation and QA handoff instead of stopping at
documentation.

## 2. Git state

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `8da9675c41a8353b7bb714bcd0ad90ed93bf4b44`
- Uncommitted changes before work: existing unrelated product/QA/UIUX docs,
  short-term UI files, and newly created QA optimization intake docs were
  already present.
- Untracked files before work: existing local-stable review docs and QA
  optimization intake docs.

## 3. Changed files

- `AGENTS.md`
- `codex-skills/auto-svga-core-guard/SKILL.md`
- `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
- `docs/product/requirements/README.md`
- `docs/product/requirements/templates/REQUIREMENT_TICKET_TEMPLATE.md`
- `docs/retrospectives/PROJECT_EXPERIENCE_GUIDE.md`
- `docs/reviews/2026-07-09-codex-requirement-ticket-flow.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Confirmed owner requests must not stop at PRD updates. | Done |
| 2 | Add a durable requirement ticket mechanism separate from QA bug tickets. | Done |
| 3 | Define owner routing, implementation handoff, QA handoff, and closure rules. | Done |
| 4 | Avoid redefining product scope or changing short-term runtime behavior. | Done |

## 5. Verification

Commands run and results:

```bash
git diff --check
```

Result: PASS.

```bash
node -e "...parse docs/retrospectives/TASK_RETRO_LEDGER.jsonl..."
```

Result: PASS.

## 6. Output inspection

- No source/runtime behavior changed.
- No product feature scope changed.
- New ticket type is `ASV-REQ-YYYYMMDD-###`; defect tickets remain `ASV-QA`.

## 7. Risks

- Existing worktree contains unrelated dirty files from other lanes. Any commit
  must use selective staging.
- The workflow depends on PM actually creating requirement tickets after
  Product Owner confirmation; docs alone do not dispatch work.

## 8. Next steps

- For the next confirmed feature or optimization request, create the first
  `ASV-REQ` ticket and route it to the correct owner instead of relying only on
  PRD edits and chat memory.

## 9. Commit

- Commit: this commit, `docs: add requirement ticket delivery flow`
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: Process flow needed separation from QA defects without
  duplicating the main PRD authority.
- Avoidable costs: Future demand handling should create `ASV-REQ` immediately
  after Product Owner confirmation, not after the owner asks for status.
- Product lessons: Confirmed requirements need an accountable implementation
  ticket and QA acceptance path, not only PRD text.
- Technical lessons: None.
- Design / interaction lessons: None.
- Process lessons: Use `ASV-REQ` for committed product delivery and linked
  `ASV-QA` only for defects or failed acceptance.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  No

## 11. Token usage

- Source: unavailable
- Input tokens:
- Cached input tokens:
- Output tokens:
- Reasoning output tokens:
- Total tokens:
- Token lesson: A small governance patch is cheaper than rediscovering
  dropped requirements during every status check.
