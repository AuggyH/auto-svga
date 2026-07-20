# Short-term Design System Check

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Added a narrow automated UI/UX design-system check for the short-term macOS
client. The check turns the existing design-system rules into a runnable gate
for stylesheet ordering, canonical component/module tracing, page-state
tracing, token discipline, focus visibility, reduced motion, minimum-window
boundaries, visible DOM ownership, and foreground-validation documentation.

This is an implementation guardrail only. It does not change product scope,
feature behavior, or user-facing app copy.

## Changed Files

- `DESIGN.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`
- `package.json`
- `tools/electron-prototype/experiments/svga-web/package.json`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority: `docs/product/PRODUCT_ROADMAP.md` remains the only main
  PRD authority. No short-term requirement was added, removed, or redefined.
- UI/UX execution: the new gate follows
  `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`.
- Token discipline: raw color values outside `short-term-macos.tokens.css` now
  fail the design-system check.
- Existing dimension debt: current non-token CSS dimension debt is recorded as
  a maximum per CSS layer. Future work may reduce it, but not increase it.
- DOM ownership: visible DOM construction is restricted to render/model
  modules and is forbidden in the main short-term app entry file.
- Interaction guardrails: focus-visible, reduced-motion, and minimum-window
  boundaries are checked directly.
- Foreground evidence: the gate verifies that smoke-only evidence cannot be
  treated as UI/UX visual acceptance.

## Verification

- `npm run desktop:short-term:design-system-check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `git diff --check`

## Risks

- The check intentionally starts with a debt ceiling instead of a full CSS
  token cleanup. It prevents new raw dimension debt while allowing future
  slices to reduce the current count.
- It is still static validation. It complements, but does not replace,
  foreground macOS screenshots with real SVGA materials.

## Next Step

Continue reducing the main short-term app entry file by moving remaining
state-specific render and proof logic into smaller model or renderer modules,
while keeping this design-system check green.
