# Review: AI capability boundary rules

## Summary

Added project rules that keep routine Auto SVGA capabilities local,
deterministic, explainable, and offline-capable. Any external AI or model
integration now requires explicit user approval and a privacy, cost, client,
and alternative assessment.

## Git state

- Branch: `agent/codex/ai-capability-boundary-rules`
- Base: `4e95e5c`
- Runtime changes: none

## Changed files

- `codex-skills/auto-svga-core-guard/SKILL.md`
- `codex-skills/auto-svga-client-ready/SKILL.md`
- `docs/codex-skill-usage.md`
- `docs/codex-main-prompt.md`

## Requirement checks

- Core AI capability boundary: done
- Offline, privacy, cost, packaging, and distribution constraints: done
- Explicit confirmation workflow: done
- Short main prompt rule: done
- AI service, model, API, dependency, or runtime integration: not added

## Verification

- Tier 0 documentation validation.
- `git diff --check`: required before commit.
- `git diff --stat`: required before commit.
- Build and runtime regression skipped because runtime code is not touched.

## Risks

- None to current runtime behavior.

## Next step

- Apply the confirmation checklist before any future generative AI module is designed.

## Commit

- Commit: this delivery commit (see repository history)
- Branch: `agent/codex/ai-capability-boundary-rules`
- Tag: none
