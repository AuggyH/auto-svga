# Review: requirement-ticket-rollout

## 1. Summary

Created the first two `ASV-REQ` product delivery tickets under the new
requirement flow:

- `ASV-REQ-20260709-001`: optimization net-effect gate and real-material
  optimization matrix.
- `ASV-REQ-20260709-002`: runtime structure risk diagnostics and safe structure
  optimization from the real production case.

The tickets convert already-confirmed PRD work into accountable implementation
and QA handoff records.

## 2. Git state

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `19188a6e`
- Uncommitted changes: existing unrelated distribution, QA workflow, and task
  ledger edits were present before this task.
- Untracked files: existing QA optimization intake docs and local-stable review
  docs were present before this task.

## 3. Changed files

- `docs/product/requirements/ASV-REQ-20260709-001.md`
- `docs/product/requirements/ASV-REQ-20260709-002.md`
- `docs/reviews/2026-07-09-codex-requirement-ticket-rollout.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Create a product-delivery ticket for optimization net-effect and matrix testing. | Done |
| 2 | Create a product-delivery ticket for runtime structure diagnostics/optimization. | Done |
| 3 | Link each ticket to PRD anchors, owner confirmation, acceptance criteria, and QA handoff. | Done |
| 4 | Avoid modifying runtime code or committing production assets. | Done |

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

- `ASV-REQ` tickets are product delivery records, not defect tickets.
- Existing `ASV-QA-20260709-001` remains the QA defect/intake evidence source
  for the optimization report and is linked from `ASV-REQ-20260709-001`.
- No source SVGA, optimized output, screenshot, or video file was added.

## 7. Risks

- `ASV-REQ-20260709-001` still depends on QA actually executing the matrix.
- `ASV-REQ-20260709-002` needs short-term implementation and later QA
  acceptance; it is not implemented by this documentation task.
- Other lanes have dirty worktree files; commit must use selective staging.

## 8. Next steps

- Route `ASV-REQ-20260709-001` to QA and Short-term Main Engineer.
- Route `ASV-REQ-20260709-002` to Short-term Main Engineer and QA.
- Update requirement tickets when owners acknowledge or return implementation /
  QA results.

## 9. Commit

- Commit: pending
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: The first rollout had to bridge existing QA intake and PRD
  items into the new `ASV-REQ` flow.
- Avoidable costs: Future confirmed requirements should create the ticket at
  the same time as the PRD update.
- Product lessons: Requirement tickets should distinguish evidence-gathering
  dependencies from implementation-owner accountability.
- Technical lessons: None.
- Design / interaction lessons: None.
- Process lessons: Link `ASV-QA` tickets as children of product delivery work,
  rather than using QA tickets as the only source of truth for confirmed scope.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  No

## 11. Token usage

- Source: unavailable
- Input tokens:
- Cached input tokens:
- Output tokens:
- Reasoning output tokens:
- Total tokens:
- Token lesson: Reusing PRD anchors and existing QA matrix plans keeps
  requirement rollout concise.
