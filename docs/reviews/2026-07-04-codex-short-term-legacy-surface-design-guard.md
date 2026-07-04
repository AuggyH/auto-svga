# Short-term Legacy Surface Design Guard Review

Date: 2026-07-04
Owner: Codex UI/UX
Scope: short-term macOS UI/UX implementation guardrail

## Summary

Added a short-term design-system check that prevents legacy Workbench or
inspector-style language from returning to the owner-visible short-term client
surface. This is a guardrail only: it does not change product scope, visible
layout, runtime behavior, save behavior, or the main PRD.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this slice: `b6c7dc6b`
- Working tree before edit: clean

## Changed Files

- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-legacy-surface-design-guard.md`

## Requirement Checks

- Product authority: checked `docs/product/PRODUCT_ROADMAP.md`; short-term
  scope remains S1-S16.
- Design authority: checked `DESIGN.md` and
  `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`; both require
  design-system traceability and prohibit treating smoke evidence as UI/UX
  acceptance.
- Ownership boundary: no PM-owned product docs changed.
- Scope boundary: no new visible UI copy, no new component, no product behavior
  change.

## Implementation Notes

- Added `visible-surface-avoids-legacy-workbench-and-inspector-language` to the
  short-term design-system report.
- The guard scans `index.html` and short-term `short-term-macos*.mjs` files
  only. It does not scan legacy proof files or product documents.
- The guard blocks owner-visible legacy terms such as `Workbench`, `Inspector`,
  and their Chinese UI concept equivalents while leaving lower-level
  implementation terms like API `inspection` untouched.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.

## Foreground Evidence

Not collected for this slice. This change is a machine guardrail and does not
change visible layout. Foreground macOS screenshots remain required before any
future visual or interaction acceptance claim.

## Risks

- This guard is intentionally textual and conservative. If a future product
  decision formally reintroduces one of these terms, the guard should be
  updated in the same change as the approved product/design documentation.
- This does not solve the broader visual-quality pass; it only prevents one
  known direction drift from recurring.

## Next Steps

- Continue replacing subjective UI/UX judgment gaps with narrow design-system
  guards.
- Resume owner-visible visual refinement only with foreground desktop evidence
  from real production SVGA files.
