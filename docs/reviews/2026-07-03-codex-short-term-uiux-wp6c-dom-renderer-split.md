# Review: short-term UI/UX WP6C DOM renderer split

Date: 2026-07-03
Owner lane: UI/UX implementation
Base before change: `f926509e uiux: split short-term module page-state css`

## Summary

This pass continues the short-term UI/UX restructuring by splitting repeated
DOM row rendering out of the short-term app controller into a dedicated DOM
renderer layer.

The change is intentionally structural. It does not add product-facing copy,
new UI states, new controls, new product components, or product behavior. It
moves existing rendered structures for fact cells, asset rows, optimization
finding rows, replaceable image rows, replaceable text rows, edit layer rows,
and thumbnail HTML into a traceable renderer module.

## Product Authority

- Main PRD authority remains `docs/product/PRODUCT_ROADMAP.md`.
- Design-system execution source remains
  `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`.
- `DESIGN.md` remains the agent-readable design-system manifest.
- No PM-owned product document was modified.
- Owner boundary retained: no unapproved product-facing explanatory text,
  labels, status blocks, or scope additions were introduced.

## Changed Files

| File | Change |
| --- | --- |
| `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs` | New DOM renderer layer for existing row and thumbnail structures. |
| `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs` | Main controller now delegates repeated row rendering to the renderer layer. |
| `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` | Updated structure assertions so the renderer split is guarded. |

## Requirement Trace

| Area | Trace |
| --- | --- |
| PRD IDs | S3, S5, S8, S11, S12, S13 surfaces are structurally touched by renderer extraction only. |
| Page states | Preview Overview, Preview Optimization, Preview Replaceable Elements, Edit reserved. |
| Modules | Overview, Optimization, Replaceable Elements, Edit reserved layer list. |
| Components | ProductionSpecInlineRow, AssetRow, SequenceThumbnail, AudioAssetRow, OptimizationFindingRow, ReplaceableImageRow, ReplaceableTextRow, LayerRow. |
| Design-system layer | Moves app code closer to token -> atom -> molecule -> component -> module -> page-state execution by isolating component renderers from controller logic. |

## Verification

Passed:

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-render-model.mjs`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - 29/29 tests passed
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
  - `passed: true`
  - short-term open, load failure, spec comparison, tab keyboard, empty states,
    runtime text boundary, thumbnails, optimization, rename, replacement, and
    menu state proofs were true.

During validation, the first full test run failed because an existing structure
assertion still expected moved `role="option"` row code in
`short-term-macos-app.mjs`. The assertion was corrected to validate the new
renderer file boundary, then the same suite passed.

## Non-goals Retained

- No product scope changes.
- No changes to optimization, replacement, rename, save, menu, or playback
  logic.
- No visual restyling in this slice.
- No new product-facing explanatory text.
- No changes to PRD or PM-owned product docs.

## Risks And Next Step

This is a low-risk structural split, but the app controller is still too large.
The next UI/UX implementation step should continue extracting bounded
controller responsibilities without changing product behavior, then return to
visual polish only after the design-system execution structure is less brittle.
