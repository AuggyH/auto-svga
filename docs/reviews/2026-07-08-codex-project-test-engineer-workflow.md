# Review: Project Test Engineer Workflow

## 1. Summary

Created the project-level QA/Test Engineer workflow for owner-reported real-use
issues. The new workflow defines ticket status, severity, lane routing,
cross-thread handoff rules, privacy boundaries, owner fix handback, regression,
and closure.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `a23fa0d8`
- Uncommitted changes before work: none
- Untracked files before work: none

## 3. Changed files

- `AGENTS.md`
- `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
- `docs/quality/PROJECT_TEST_ENGINEER_WORKFLOW.md`
- `docs/quality/templates/BUG_TICKET_TEMPLATE.md`
- `docs/quality/templates/TEST_REPRO_REPORT_TEMPLATE.md`
- `docs/quality/templates/OWNER_FIX_REPORT_TEMPLATE.md`
- `docs/quality/templates/REGRESSION_ACCEPTANCE_REPORT_TEMPLATE.md`
- `docs/reviews/2026-07-08-codex-project-test-engineer-workflow.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Create a dedicated project testing process role and workflow. | Done |
| 2 | Define reproduction, ticketing, owner routing, fix handoff, regression, and closure. | Done |
| 3 | Standardize cross-thread handoff precautions. | Done |
| 4 | Keep PRD authority intact and avoid redefining product scope. | Done |
| 5 | Avoid touching UI/UX implementation or feature code. | Done |
| 6 | Create a new Codex thread for the Test Engineer role. | Pending at review-authoring time; final response records the created thread id. |

## 5. Verification

Commands run and results:

```text
$ git diff --check
passed

$ node -e "parse docs/retrospectives/TASK_RETRO_LEDGER.jsonl"
jsonl ok
```

Runtime tests are not required because this is a documentation-only workflow
change.

## 6. Output inspection

- Product scope authority: `docs/product/PRODUCT_ROADMAP.md` remains the only
  main PRD authority.
- QA workflow authority: `docs/quality/PROJECT_TEST_ENGINEER_WORKFLOW.md`
  covers process only and explicitly cannot override the PRD.
- Templates: ticket, reproduction report, owner fix report, regression
  acceptance report.
- UI/UX implementation: not touched.
- Runtime code: not touched.

## 7. Risks

- The workflow depends on each owner thread actually updating the ticket/report
  files instead of only replying in chat.
- Thread IDs for active owner lanes may change over time; tickets should route
  by owner role first and use thread IDs only as current transport details.

## 8. Next steps

- Test Engineer thread should use this workflow for the first owner-reported
  bug and refine the templates only if the first real ticket exposes friction.

## 9. Commit

- Commit: recorded in final handoff after commit creation
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: Existing review/repair rules were broad, so the new workflow
  needed a specific defect lifecycle without duplicating PRD authority.
- Avoidable costs: Future bug handoffs should link ticket/report files instead
  of re-pasting reproduction context between threads.
- Product lessons: QA is a project coordination lane, not a product scope
  authority.
- Technical lessons: Defect closure needs separate reproduction, owner fix, and
  QA regression records.
- Design / interaction lessons: UI/UX defects need foreground desktop evidence
  when possible; smoke screenshots should stay regression evidence.
- Process lessons: One ticket must remain the source of truth while chat stays
  transport.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  No

## 11. Token usage

- Source: unavailable
- Input tokens: null
- Cached input tokens: null
- Output tokens: null
- Reasoning output tokens: null
- Total tokens: null
- Token lesson: Keep QA handoffs link-based and role-routed to avoid repeated
  long context copying across owner threads.
