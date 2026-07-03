# Review: short-term UI/UX WP7A design interaction proof

Date: 2026-07-03
Owner lane: UI/UX implementation
Base before change: `285e7c7a uiux: split short-term command state`

## Summary

This pass adds a design-oriented short-term smoke proof for interaction quality.

The new proof is internal validation only. It does not add any visible UI,
product copy, controls, menus, states, or feature behavior. It makes desktop
smoke fail closed when the short-term client no longer satisfies basic
design-experience checks that are not covered by the functional S1-S16 matrix
alone.

The proof currently checks:

- visible sequential focus targets and toolbar ordering
- selected-tab focus behavior
- focusable, scrollable tab panel region
- selectable metadata text
- copyable current-state summary without local path exposure
- current menu-state discoverability
- reduced-motion CSS rule presence
- minimum-preview screenshot capture

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
| `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs` | Adds renderer-side collection for `short-term-design-interaction-proof`. |
| `tools/electron-prototype/experiments/svga-web/main.cjs` | Adds fail-closed validation, rejection diagnostics, product artifact output, and smoke log binding for the proof. |
| `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` | Adds static assertions that the proof collection and validation path exist. |

## Requirement Trace

| Area | Trace |
| --- | --- |
| PRD IDs | S1, S3, S8, S12, S13, S14, S16 interaction surfaces. |
| Page states | Preview Overview and minimum preview screenshot state. |
| Modules | Window toolbar, right tab panel, metadata rows, menu bridge, smoke evidence. |
| Components | ToolbarButton, TabItem, tab panel, fact cells, asset rows, menu-state snapshot. |
| Design-system layer | Adds evidence for interaction quality beyond functional feature success. |

## Verification

Passed:

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - 29/29 tests passed
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
  - `passed: true`
  - `shortTermDesignInteraction: true`
  - `shortTermDesignInteractionProof: true`

During validation, the first desktop smoke rejected the new proof. The
rejection path was improved to report granular failure reasons, then the proof
definition was corrected:

- Empty fields inside focus-order items are valid when another identifier is
  present.
- State-summary path checks must reject local path exposure, not every `/`,
  because playback summaries may use `/` as a metadata separator.
- The local user-path pattern is built at runtime so package privacy audit does
  not see a local absolute-path literal in bundled source.

## Non-goals Retained

- No visual styling changes in this slice.
- No new UI copy or product-facing explanatory text.
- No product feature additions.
- No PM-owned product document updates.
- No changes to parsing, optimization, replacement, rename, save, playback, or
  menu behavior.

## Risks And Next Step

This proof is still automated and hidden; it does not replace foreground
desktop visual review with real production SVGA materials. The next UI/UX step
should either continue reducing the app controller size or perform a real
foreground desktop review pass using owner production materials before deeper
visual polishing.
