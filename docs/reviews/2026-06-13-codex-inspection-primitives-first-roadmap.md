# Review: Inspection-primitives-first Roadmap Principle

## Summary

- Mainline: P1 infrastructure + P2 specification checks + P6 recommendation.
- Documented reusable inspection primitives as the prerequisite for higher-level
  product features.
- Reinforced local, deterministic, explainable analysis and the existing AI
  capability boundary.

## Git State

- Branch: `agent/codex/inspection-primitives-first-roadmap`
- Commit: this delivery commit
- Base: `923794a` 21-sample calibration

## Changed Files

- `docs/ROADMAP.md`
- `docs/TECH_SPEC.md`
- `docs/codex-main-prompt.md`
- `docs/codex-skill-usage.md`
- `codex-skills/auto-svga-core-guard/SKILL.md`
- `docs/reviews/2026-06-13-codex-inspection-primitives-first-roadmap.md`

## Requirement Checks

- Lists required inspection primitives and future higher-level features.
- Requires higher-level features to compose existing primitives.
- Prohibits one-off UI inspection logic.
- Limits evidence to deterministic local metadata and rules.
- Prohibits unapproved AI/external model substitution.

## Validation

- Tier 0 documentation/skill update.
- `git diff --check`: passed.
- Build and runtime regression skipped because runtime code was not touched.

## Regression

- Exporter: not touched.
- Web player and preview: not touched.
- CLI default flow: not touched.
- Playback, import, drag-drop, and comparison: not touched.

## Risks

- This task defines sequencing and boundaries but does not implement decoded
  memory estimation or higher-level audit features.

## Next

Add a host-neutral decoded memory estimation primitive before designing a
performance audit product surface.
