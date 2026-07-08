# Review: optimization net-effect guardrail

Date: 2026-07-09
Lane: PM / QA routing
Branch: `agent/codex/short-term-preview-qa-20260708`

## Summary

Clarified the short-term optimization product contract after Product Owner
reported a real-use `一键优化` result where merging duplicate assets produced a
slightly larger file.

The PRD now requires optimization success to prove a positive effect on its
declared target metric. A file-size-targeting one-click optimization that
increases final `.svga` size without another clear positive target effect must
fail closed or report no applicable benefit, with save actions disabled.

## Changed Files

- `docs/product/PRODUCT_ROADMAP.md`
- `docs/reviews/2026-07-09-codex-optimization-net-effect-guardrail.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## Requirement Checks

- S9 now includes a no-negative-net-effect requirement.
- S9 acceptance evidence now requires before/after metric deltas and
  no-negative-net-effect proof.
- Optimization output rules now forbid presenting negative/no-benefit
  candidates as successful optimization.
- The PRD now asks QA to maintain an optimization matrix over real production
  samples plus synthetic rare-condition fixtures, while hiding unimplemented
  executable controls or teasers in short-term builds.

## Verification

- Documentation-only change.
- Planned check: `git diff --check` and JSONL parse.

## Risks

- Some memory/runtime optimizations may legitimately increase file size. The
  rule allows that only when the positive primary target effect is explicit,
  meaningful, and accepted in the result UI.
- Existing implementation may currently pass structural safety without proving
  net benefit. QA should route concrete failures to the short-term main
  engineer.

## Project Retrospective

Lesson: optimization must be validated by product-facing deltas, not only by
structural safety. A safe transform can still be a bad product result if it
increases the only metric it claims to improve.
