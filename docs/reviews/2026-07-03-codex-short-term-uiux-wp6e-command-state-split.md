# Review: short-term UI/UX WP6E command state split

Date: 2026-07-03
Owner lane: UI/UX implementation
Base before change: `bd5c5093 uiux: split short-term dom state`

## Summary

This pass continues the short-term UI/UX implementation split by moving command
state derivation into a dedicated module.

The new module computes the same existing button enablement, disabled-title
reasons, play/pause label, and menu-state snapshot that previously lived inside
the main app controller. The app controller now passes current state into that
module, applies the returned action states, and syncs the returned menu state.

No product behavior, visible copy, menu structure, save behavior, playback
behavior, optimization behavior, rename behavior, or replacement behavior was
changed.

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
| `tools/electron-prototype/experiments/svga-web/web/short-term-macos-command-state.mjs` | New command-state model for action enablement, play/pause copy, and menu snapshot. |
| `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs` | Delegates command-state derivation to the new module. |
| `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` | Adds structure assertions for the command-state boundary. |

## Requirement Trace

| Area | Trace |
| --- | --- |
| PRD IDs | S1-S16 command availability is preserved through the existing state model; no requirement behavior was modified. |
| Page states | Launch, Loading, Load failed, Preview, Compare, Edit reserved, Save validating. |
| Modules | Window toolbar, playback controls, right tab actions, save controls, menu bridge. |
| Components | ToolbarButton, PlaybackButtonGroup, SaveButtonPair, SegmentedModeSwitch menu sync. |
| Design-system layer | Separates command-state derivation from controller workflow and DOM application, improving traceability from page state to command components. |

## Verification

Passed:

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-command-state.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-state.mjs`
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
- No changes to parsing, optimization, replacement, rename, save, or playback
  logic.

## Risks And Next Step

This split is low risk because it preserves the same state inputs and outputs,
but the controller still owns too many responsibilities. The next UI/UX slice
should continue extracting a pure or bounded interface, such as current-state
summary rendering or save/banner feedback modeling, before returning to deeper
visual polishing.
