# Review: code-review-workflow

## 1. Summary

Established a dedicated source-level Code Review workflow for Auto SVGA and
connected it to the existing project governance docs. The workflow separates
Code Review from QA and defines when high-risk implementation work needs an
independent reviewer before QA acceptance or local-stable promotion.

## 2. Git state

- Branch: agent/codex/short-term-preview-qa-20260708
- Commit before work: not captured before edits
- Uncommitted changes: pre-existing QA, UI/UX, retrospective, and short-term
  implementation changes were present before this task and were not modified
  intentionally.
- Untracked files: pre-existing QA/review/UIUX artifacts were present before
  this task and were not modified intentionally.

## 3. Changed files

- `docs/engineering/CODE_REVIEW_WORKFLOW.md`
- `AGENTS.md`
- `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
- `docs/reviews/2026-07-10-codex-code-review-workflow.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Decide whether Auto SVGA needs dedicated Code Review. | Done |
| 2 | Define a workflow that does not duplicate QA responsibilities. | Done |
| 3 | Make the workflow visible to future agents before high-risk work. | Done |
| 4 | Prepare for a first code-health audit. | Done |

## 5. Verification

Commands run and results:

```text
Read AGENTS, product documentation system, QA workflow, repair health protocol,
core guard skill, and memory routing notes.
```

Documentation-only change. Runtime validation was not run.

## 6. Output inspection

- Code Review is now a separate source-level gate.
- QA remains responsible for user-visible reproduction, regression, and
  closure.
- High-risk areas requiring review are named.
- First code-health audit scope is defined without allowing sweeping refactor.

## 7. Risks

- The Code Review Owner thread still needs to run the first repository audit.
- Existing dirty files from other lanes mean this task must be staged and
  committed carefully.
- The workflow may need refinement after the first audit finds real friction.

## 8. Next steps

- Create or assign the Code Review Owner thread.
- Route the first code-health audit to that thread.
- Use the audit results to decide which review gates should become mandatory
  for the next package promotion.

## 9. Commit

- Commit: pending
- Branch: agent/codex/short-term-preview-qa-20260708
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: Needed to separate QA, PM, implementation, packaging, and
  source-level review responsibilities.
- Avoidable costs: Avoid trying to make QA carry architecture and dependency
  safety responsibilities.
- Product lessons: Product acceptance, QA pass, Code Review approval, and
  package readiness must remain distinct.
- Technical lessons: High-risk code paths should have a named review gate
  before owner-visible promotion.
- Design / interaction lessons: UI/UX changes may need Code Review only when
  they alter state, host commands, or shared architecture.
- Process lessons: Dedicated review lanes should start with audits and
  findings, not broad refactors.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes

## 11. Token usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: A concise workflow doc is cheaper than repeatedly explaining
  why QA and Code Review are different gates.
