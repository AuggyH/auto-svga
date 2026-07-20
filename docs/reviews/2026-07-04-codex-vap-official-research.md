# VAP Official Repository Research Review

Date: 2026-07-04
Agent: Codex
Task: Record official Tencent VAP repository research in the Auto SVGA docs.

## Summary

Added a durable research note for Tencent VAP and linked it from the existing
multi-format architecture document. The update preserves the current product
boundary: VAP remains research/long-term multi-format work and is not promoted
into short-term or mid-term scope by this task.

## Git State

- Branch at start: `agent/codex/svga-workbench-v1-autonomous`
- Unrelated dirty files were present during this task and were not touched by
  this research update:
  - `DESIGN.md`
  - `docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`
  - `package.json`
  - `tools/electron-prototype/experiments/svga-web/package.json`
  - `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- This task only staged/committed the VAP research documentation files listed
  below.

## Changed Files

- `docs/research/vap-official-repository-research.md`
- `docs/multiformat-workbench-architecture.md`
- `docs/reviews/2026-07-04-codex-vap-official-research.md`

## Requirement Checks

| Requirement | Status |
| --- | --- |
| Capture VAP official repository research | Done |
| Keep future follow-up easy to resume | Done |
| Avoid changing current product scope | Done |
| Avoid duplicating existing multi-format architecture authority | Done |
| Link from existing VAP architecture boundary | Done |

## Verification

- Read `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`.
- Read `docs/product/PRODUCT_ROADMAP.md`.
- Searched existing docs for VAP overlap before adding the research note.
- Confirmed the VAP note is framed as research input, not PRD authority.

## Risks

- The VAP official repository is no longer maintained, so any future production
  feature needs its own compatibility and redistribution decision.
- The Owner-reported fusion jitter symptom still needs a concrete reproduction
  fixture; this task records likely investigation paths but does not prove root
  cause.
- Official VAP generation may involve ffmpeg/mp4edit redistribution and codec
  licensing concerns; no dependency or encoder decision was made here.

## Next Steps

1. If VAP is promoted into active scope, start with VAP-WP0 fixtures and a
   compatibility brief.
2. Follow with a read-only VAP container inspector before any export/generator
   commitment.
