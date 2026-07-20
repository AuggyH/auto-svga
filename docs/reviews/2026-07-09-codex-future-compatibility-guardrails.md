# Review: future compatibility guardrails

Date: 2026-07-09
Lane: PM / architecture
Branch: `agent/codex/short-term-preview-qa-20260708`

## Summary

Added implementation guardrails for the short-term UI/UX and desktop-client
work so current SVGA/macOS work can reduce future multi-format, AEB, and
Windows migration cost without exposing future scope.

This does not approve VAP, Lottie, Windows, AEB package intake, or
format-selection UI in the short-term app.

## Changed Files

- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`
- `docs/multiformat-workbench-architecture.md`
- `docs/reviews/2026-07-09-codex-future-compatibility-guardrails.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## Requirement Checks

- Main PRD authority preserved: guardrails are framed as implementation
  constraints, not new short-term visible features.
- Short-term freeze preserved: no visible VAP, Lottie, Windows, AEB, import
  package, or format-selection entry is allowed.
- UI/UX lane guidance added: command intents, playback model, capability-driven
  information surfaces, reusable rows, typed unsupported states, host/path
  helpers, and offline dependency discipline.
- Architecture lane guidance added: current cleanup can prepare host,
  playback, command, error, path, and dependency boundaries without claiming
  multi-format or Windows readiness.

## Verification

- Documentation-only change.
- Planned check: `git diff --check` on changed files.

## Risks

- Future implementers could over-read the guardrails as permission to expose
  future-format UI. The docs explicitly forbid that.
- Some current short-term modules may still contain SVGA/macOS naming; this
  review creates the guardrail, not a full code refactor.

## Project Retrospective

Useful lesson: the cheapest time to prevent future migration cost is during
UI/UX structure work, but only when the change is expressed as an internal
boundary and not as premature product scope.

Token note: the existing roadmap, UI/UX execution plan, architecture doc, and
experience guide were enough; no broad historical scan was needed.
