# Review: Foreground Debug Display Rule

## 1. Summary

Added a project-level rule for foreground desktop debugging and validation:
prefer non-foreground evidence when sufficient; before foreground operation,
check for a second display; use the second/non-primary display when available;
otherwise prefer silent or low-disturbance startup and record the fallback.

## 2. Git state

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `5f837562`
- Uncommitted changes before work:
  - `docs/product/SHORT_TERM_DISTRIBUTION_PREP.md`
  - `docs/quality/PROJECT_TEST_ENGINEER_WORKFLOW.md`
  - `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- Untracked files before work:
  - `docs/reviews/2026-07-08-codex-owner-client-baseline-routing.md`

## 3. Changed files

- `AGENTS.md`
- `codex-skills/auto-svga-client-ready/SKILL.md`
- `codex-skills/auto-svga-ui-stability/SKILL.md`
- `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`
- `docs/retrospectives/PROJECT_EXPERIENCE_GUIDE.md`
- `docs/reviews/2026-07-08-codex-foreground-debug-display-rule.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Prefer checking for a second display before foreground debugging. | Done |
| 2 | Use the second display when available. | Done |
| 3 | If unavailable, prefer silent or low-disturbance startup. | Done |
| 4 | Avoid interrupting the Product Owner's main display except as last resort. | Done |
| 5 | Require reviews/handoffs to record foreground strategy. | Done |
| 6 | Keep product scope and runtime code unchanged. | Done |
| 7 | Avoid staging unrelated existing dirty changes. | Done |

## 5. Verification

Commands run and results:

```text
$ git diff --check -- AGENTS.md codex-skills/auto-svga-client-ready/SKILL.md codex-skills/auto-svga-ui-stability/SKILL.md docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md docs/retrospectives/PROJECT_EXPERIENCE_GUIDE.md docs/reviews/2026-07-08-codex-foreground-debug-display-rule.md docs/retrospectives/TASK_RETRO_LEDGER.jsonl
passed

$ node -e "parse docs/retrospectives/TASK_RETRO_LEDGER.jsonl"
jsonl ok

$ git diff --cached --name-only | rg -i "\\.(png|jpe?g|gif|svg|svga|mp4|mov|webm|avi|psd|fig|sketch)$" || true
no staged design or media assets
```

Runtime tests are not required because this is a documentation-only operation
rule change.

## 6. Output inspection

- `AGENTS.md` now has a dedicated foreground desktop debugging rule.
- `PROJECT_EXPERIENCE_GUIDE.md` records the second-display and low-disturbance
  fallback lesson.
- The short-term UI/UX foreground validation gate now requires display-topology
  checking.
- `auto-svga-client-ready` and `auto-svga-ui-stability` skills now carry the
  same operational rule for future agents.

## 7. Risks

- Agents still need a reliable local way to detect display topology. If the
  tool environment cannot inspect displays, they should state that limitation
  and choose silent/low-disturbance evidence.
- Existing foreground evidence scripts may need future implementation updates
  to enforce this automatically.

## 8. Next steps

- Future foreground automation scripts can add an explicit display-selection
  helper so the rule is machine-enforced, not only documented.

## 9. Commit

- Commit: recorded in final handoff after commit creation
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: The project needs real foreground evidence, but foreground
  automation can interrupt the Product Owner's active desktop.
- Avoidable costs: Future agents should check display topology before launching
  foreground apps instead of discovering display placement during capture.
- Product lessons: None; this is operation governance, not product scope.
- Technical lessons: Foreground validation should record display strategy as
  part of evidence quality.
- Design / interaction lessons: Visual review can still use real foreground
  evidence while respecting the user's main workspace.
- Process lessons: Prefer passive or second-display validation before main
  display focus-stealing.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  No

## 11. Token usage

- Source: unavailable
- Input tokens: null
- Cached input tokens: null
- Output tokens: null
- Reasoning output tokens: null
- Total tokens: null
- Token lesson: Patch the existing foreground-validation docs and skills rather
  than creating another standalone process document.
