# Token-saving Skills Review

Date: 2026-06-13
Branch: `agent/codex/token-saving-skills`
Base commit: `0d1ea58`

## Summary

Added three repository-local Codex skills for concise reporting, minimal context
loading, and diff-first completion reports.

## Changed files

- `codex-skills/caveman-report/SKILL.md`
- `codex-skills/caveman-report/agents/openai.yaml`
- `codex-skills/context-budget/SKILL.md`
- `codex-skills/context-budget/agents/openai.yaml`
- `codex-skills/diff-first/SKILL.md`
- `codex-skills/diff-first/agents/openai.yaml`
- `AGENTS.md`
- `docs/CURRENT_STATUS.md`
- `docs/CHANGELOG.md`
- `docs/reviews/2026-06-13-codex-token-saving-skills.md`

## Verification

```text
quick_validate.py codex-skills/caveman-report
passed

quick_validate.py codex-skills/context-budget
passed

quick_validate.py codex-skills/diff-first
passed

npm test
35 passed, 0 failed

git diff --check
passed
```

## Regression

- Runtime code: not touched
- SVGA exporter and bytes: not touched
- Web playback: not touched
- Dependencies: not changed
- Global Codex skills: not installed or modified

## Risks

- Repository-local skills are not automatically available globally; installation
  must remain an explicit user action.
- Using all three simultaneously may be redundant. Load only the skill matching
  the task.

## Next

- Use the skills in normal project work and adjust only after observed output
  quality or trigger problems.

## Commit

- Commit: `6cb0e6f`
- Merge: pending
- Tag: none
