# Review: QA Callback Handoff Hardening

## 1. Summary

Synchronized QA workflow hardening from the QA lane into the main repository.
The workflow now makes the Test Engineer responsible for ticket lifecycle
follow-up after Product Owner intake, and makes implementation owners
responsible for actively returning `Fix Ready` handoffs to QA.

## 2. Git state

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `f7fef867`
- Uncommitted changes before work: none
- Untracked files before work: none

## 3. Changed files

- `docs/quality/PROJECT_TEST_ENGINEER_WORKFLOW.md`
- `docs/quality/templates/OWNER_FIX_REPORT_TEMPLATE.md`
- `docs/reviews/2026-07-08-codex-qa-callback-handoff-hardening.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Make QA lifecycle ownership explicit after Owner report enters QA. | Done |
| 2 | Clarify that owner acceptance starts the repair loop. | Done |
| 3 | Require implementation owner to actively return `Fix Ready` to QA. | Done |
| 4 | Define required `Fix Ready` callback payload. | Done |
| 5 | Define QA behavior when owner forgets callback. | Done |
| 6 | Keep Product Owner out of ordinary routing/callback/regression/closure. | Done |
| 7 | Avoid product scope or runtime code changes. | Done |

## 5. Verification

Commands run and results:

```text
$ diff -u docs/quality/PROJECT_TEST_ENGINEER_WORKFLOW.md /Users/huangtengxin/.codex/worktrees/ed2a/auto-svga/docs/quality/PROJECT_TEST_ENGINEER_WORKFLOW.md
no diff

$ diff -u docs/quality/templates/OWNER_FIX_REPORT_TEMPLATE.md /Users/huangtengxin/.codex/worktrees/ed2a/auto-svga/docs/quality/templates/OWNER_FIX_REPORT_TEMPLATE.md
no diff

$ git diff --check
passed

$ node -e "parse docs/retrospectives/TASK_RETRO_LEDGER.jsonl"
jsonl ok
```

Runtime tests are not required because this is a documentation-only process
change.

## 6. Output inspection

- Main workflow matches the QA worktree changes for callback tracking and
  closed-loop ownership.
- Owner fix report template now records QA thread, handoff status, and missing
  handoff reason.
- Product scope: not changed.
- Runtime code: not touched.
- UI/UX files: not touched.

## 7. Risks

- The process still relies on QA and implementation owners reading the workflow
  before acting on tickets.
- Existing open tickets may need manual cleanup if they were created before
  this hardened callback rule.

## 8. Next steps

- QA should apply the new callback tracking rule during ASV-QA-20260708-001/002/003
  regression and record the short-term owner callback gap in the relevant
  tickets or regression reports.

## 9. Commit

- Commit: recorded in final handoff after commit creation
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: The first real QA tickets exposed that owner-thread final
  answers do not automatically become QA lifecycle callbacks.
- Avoidable costs: Future routing prompts should say that acceptance starts the
  repair loop and that `Fix Ready` must be actively returned to QA.
- Product lessons: None; this is process governance, not product scope.
- Technical lessons: Fix reports need explicit handoff status, not just commit
  and validation details.
- Design / interaction lessons: None.
- Process lessons: QA owns cross-thread follow-up; Product Owner should not be
  the callback relay for ordinary bug flow.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  No

## 11. Token usage

- Source: unavailable
- Input tokens: null
- Cached input tokens: null
- Output tokens: null
- Reasoning output tokens: null
- Total tokens: null
- Token lesson: Sync exact workflow deltas from the QA worktree instead of
  re-summarizing the whole QA process.
