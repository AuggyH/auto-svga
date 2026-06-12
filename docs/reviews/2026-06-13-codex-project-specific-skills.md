# Project-specific Codex Skills Review

Date: 2026-06-13
Branch: `agent/codex/project-specific-skills`
Base: `e1bc0e5`

## Changed

- Added required Auto SVGA core guard.
- Added focused format, specification, UI, and client-readiness skills.
- Added skill routing and compact main-prompt docs.

## Files

- `codex-skills/auto-svga-core-guard/`
- `codex-skills/auto-svga-motion-formats/`
- `codex-skills/auto-svga-spec-check/`
- `codex-skills/auto-svga-ui-stability/`
- `codex-skills/auto-svga-client-ready/`
- `docs/codex-skill-usage.md`
- `docs/codex-main-prompt.md`
- `AGENTS.md`
- `docs/CURRENT_STATUS.md`
- `docs/CHANGELOG.md`

## Tests

- Official skill validator: 5 passed.
- `git diff --check`: passed.
- Project build and full tests: 35 passed, 0 failed.
- Main prompt: 14 lines; substantially shorter than the project instructions.

## Regression

- Runtime code: not touched.
- Existing tests: not changed.
- SVGA parser/exporter: not touched.
- Web preview: not touched.
- Dependencies: not changed.
- Global Codex installation: not changed.

## Drift

- Work belongs to P1 and P7.
- No new format, UI feature, generic skill, or client shell added.
- Domain skills avoid repeating the core priority and report rules.

## Risks

- Repository-local skills require explicit installation or direct loading.
- Skill effectiveness should be refined from observed future tasks, not speculative expansion.

## Next

- Use the routing guide in the next mainline task and adjust only demonstrated
  trigger or overlap problems.

## Commit

- Commit: `2535bc3`
- Merge: `e2ad3cd`
- Tag: none
