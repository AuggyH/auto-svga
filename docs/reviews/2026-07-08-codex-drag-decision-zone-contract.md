# Review: Drag Decision Zone Contract

## Summary

- Clarified the short-term drag-decision overlay as an exact hit-test contract,
  not only a proportional design direction.
- Final product rule: Add As Compare File is the top secondary strip; Open File
  is the lower primary zone.
- Default split is 25% from the top: top 25% compares, lower 75% opens. The
  allowed responsive range is 20%-30% compare and 70%-80% open.
- Canvas center, lower-center, and bottom-entry casual drops must resolve to
  Open File.

## Git State

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Base context includes short-term implementation commit `fadcca5b`, which
  implemented the opposite orientation: top open, bottom compare.
- This review records a product/documentation correction only.

## Changed Files

- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
- `docs/product/SHORT_TERM_UI_UX_LOW_FIDELITY_IA.md`
- `DESIGN.md`

## Requirement Checks

- Product Owner concern: bottom-to-center drag habits should not accidentally
  enter compare.
- Updated contract makes compare opt-in by requiring deliberate movement into
  the top secondary strip.
- Low-fidelity IA no longer shows Open File on top and Add Compare on bottom.
- Main PRD remains the authority; subordinate design docs now match it.

## Verification

- Documentation wording inspected for the new explicit zone contract.
- Runtime validation not run because this task changed product/design docs only.

## Risks And Next Steps

- Short-term implementation commit `fadcca5b` currently uses top 75% open and
  bottom 25% compare. It must be adjusted to top compare / lower open before
  the interaction can be considered aligned with this product contract.
- Update drag-decision tests/proofs so center, lower-center, and bottom-entry
  points prove Open File, while an intentional top-strip point proves Compare.

## Project Retrospective

- Proportions are not enough for drag interactions. Product docs must define
  spatial orientation, split line, fallback range, and high-probability physical
  drop paths.
- When a correction follows immediately after an implementation handoff, record
  the superseding product contract explicitly so worker lanes do not treat the
  previous Fix Ready as final.

## Token Usage

- Exact Codex token count unavailable in this session.
