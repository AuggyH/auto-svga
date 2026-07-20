# Short-term UI/UX Foreground Validation Gate

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Added a UI/UX validation supplement that explicitly separates automated smoke
evidence from real visual and interaction acceptance.

The new rule requires foreground screenshots from the actual macOS desktop
client before claiming that page layout, interaction quality, or UI design is
acceptable. Smoke screenshots and smoke reports remain useful regression
evidence, but they cannot substitute for owner-visible foreground review.

## Changed Files

- `DESIGN.md`
- `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`

## Requirement Checks

- Product authority: `docs/product/PRODUCT_ROADMAP.md` remains the sole PRD
  authority. No product scope or PM-owned requirement was changed.
- UI/UX authority: the change belongs to UI/UX execution and design-system
  validation rules.
- Owner correction: the supplement captures the Owner instruction that smoke
  cannot be treated as proof that function flow, page layout, or UI design is
  acceptable in real use.
- Real-client evidence: foreground captures must include the macOS menu bar,
  native titlebar/window chrome, and actual app state.
- Real-material evidence: when available, validation should use multiple SVGA
  files from `/Users/huangtengxin/Downloads/auto-svga测试物料`.

## Verification

- `git diff --check`
- Manual document review for authority boundaries.

Result: checks passed.

## Risks

- This is documentation-only. It adds a validation gate but does not yet capture
  new foreground screenshots.
- Future implementation reviews must follow this rule explicitly; otherwise
  smoke-only evidence remains insufficient for visual or interaction acceptance.

## Next Step

Continue WP6AB implementation cleanup, then schedule a foreground macOS
validation pass with real production SVGA materials before claiming UI/UX visual
or interaction acceptance.
