# Review: short-term UI/UX WP6D DOM state split

Date: 2026-07-03
Owner lane: UI/UX implementation
Base before change: `4ec56e1c uiux: split short-term dom renderers`

## Summary

This pass continues the short-term UI/UX componentization work by moving
low-level DOM state application out of the app controller and into a dedicated
DOM state module.

The change moves existing behavior for:

- page view visibility and `data-app-state`
- Preview/Edit mode button selection
- tab button and tab panel state
- action disabled/title state

No product logic, copy, menu structure, save behavior, playback behavior,
optimization behavior, rename behavior, or replacement behavior was changed.

## Product Authority

- Main PRD authority remains `docs/product/PRODUCT_ROADMAP.md`.
- UI/UX execution remains subordinate to
  `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`.
- `DESIGN.md` remains the design-system manifest.
- No PM-owned product documents were edited.
- Owner boundary retained: no new product-facing explanatory text, labels,
  status blocks, feature entry points, or out-of-scope components were added.

## Changed Files

| File | Change |
| --- | --- |
| `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-state.mjs` | New DOM state helper layer for view, mode, tab, and action state application. |
| `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs` | Delegates repeated DOM state application to the new helper layer. |
| `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` | Adds structure assertions for the new DOM state boundary. |

## Requirement Trace

| Area | Trace |
| --- | --- |
| PRD IDs | S1-S16 indirectly preserved through controller-state behavior; no requirement behavior was modified. |
| Page states | Launch, Loading, Load failed, Preview, Compare, Edit reserved. |
| Modules | Window shell, mode switch, right tab panel, command controls. |
| Components | SegmentedModeSwitch, TabItem, WindowToolbar actions, SaveButtonPair, PlaybackButtonGroup. |
| Design-system layer | Moves controller code closer to component/module/page-state separation by isolating DOM state application from workflow logic. |

## Verification

Passed:

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-state.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - 29/29 tests passed
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
  - `passed: true`
  - short-term open, load failure, spec comparison, tab keyboard, empty states,
    runtime text boundary, thumbnails, optimization, rename, replacement, and
    menu state proofs were true.

## Non-goals Retained

- No visual styling changes in this slice.
- No new UI copy or product-facing explanatory text.
- No product feature additions.
- No PM-owned product document updates.
- No changes to product algorithms or file output.

## Risks And Next Step

This is a low-risk structural split, but the controller still contains workflow,
network, playback, save, proof, and smoke responsibilities in one file. The
next safe UI/UX implementation step is to extract another pure or near-pure
boundary, such as current-state summary/message row rendering or a bounded
interaction-proof helper, before returning to broader visual polish.
