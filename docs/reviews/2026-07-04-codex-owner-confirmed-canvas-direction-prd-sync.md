# Owner-confirmed Canvas Direction PRD Sync

Date: 2026-07-04
Agent: Codex

## Summary

Synchronized the Owner-confirmed short-term canvas-first client direction into
the PM-owned product documentation lane. The main authority remains
`docs/product/PRODUCT_ROADMAP.md`; subordinate short-term UI/UX docs now align
with that authority instead of preserving the older Workbench/tabbed shell
model.

## Git State

The worktree already contained unrelated UI/UX implementation and design-lane
changes before this PM sync. This review covers only the product-documentation
changes listed below. Do not treat unrelated dirty UI prototype files or design
assets as part of this PM update.

## Changed Files

- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`
- `docs/product/SHORT_TERM_UI_UX_LOW_FIDELITY_IA.md`
- `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`
- `docs/reviews/2026-07-04-codex-owner-confirmed-canvas-direction-prd-sync.md`

## Requirement Checks

- Main PRD now records the 2026-07-04 Owner correction: canvas-first,
  immersive, state-driven short-term app direction.
- Launch page is specified as one full-window canvas/drop surface with central
  drag/open actions and secondary recent records.
- Preview no longer exposes a visible "Open Another File" button.
- Preview/Edit mode switching is specified at the top center of the canvas.
- Compare no longer has a persistent main-surface entry; it enters from the
  macOS menu or drag-decision overlay.
- Default Preview shows compact production-spec status only; actual/limit
  details are reserved for optimization/detail contexts.
- Dirty/save rules now distinguish Preview imageKey rename dirty state from
  optimization result output.
- Inline runtime text preview replaces the older text-edit modal language.
- Short-term Edit remains reserved: left layer list may exist, but no inactive
  advanced controls are exposed.
- Local Owner reference sketches were reviewed and referenced as local inputs
  only; image files were not committed.

## Verification

- Re-read the product authority lane:
  `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md` and
  `docs/product/PRODUCT_ROADMAP.md`.
- Re-read the UI/UX sync inputs:
  `docs/reviews/2026-07-04-codex-uiux-owner-confirmed-canvas-direction-sync.md`
  and `docs/reviews/2026-07-04-codex-uiux-native-tool-static-direction-mvp.md`.
- Visually inspected the Owner local reference sketches listed in
  `docs/product/SHORT_TERM_UI_UX_LOW_FIDELITY_IA.md`.
- Ran `git diff --check` on the touched product docs.
- Scanned touched product docs for stale short-term terms from the older
  tabbed Workbench shell, old overview naming, toolbar compare entry, and
  modal text-editing model.

## Risks

- UI/UX implementation files remain dirty in the working tree from the design
  lane and should be reviewed or committed separately by that owner.
- Exact visual fidelity still needs foreground macOS validation with the actual
  client after implementation catches up.
- The Settings sheet is intentionally limited to appearance options until the
  Product Owner approves more settings.

## Next Steps

- UI/UX implementation should realign to the updated main PRD and subordinate
  UI/UX docs before continuing short-term client work.
- Main-program implementation should use the updated S1-S16 acceptance matrix
  for feature wiring and validation evidence.
