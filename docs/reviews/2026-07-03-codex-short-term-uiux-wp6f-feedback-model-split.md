# Review: short-term UI/UX WP6F feedback model split

Date: 2026-07-03
Owner lane: UI/UX implementation
Base before change: `5fefc4ff uiux: add short-term design interaction proof`

## Summary

This pass moves existing save-feedback tone and current-state summary
composition out of the short-term app controller into a dedicated feedback
model module.

The change is structural. It does not add visible UI, product copy, product
states, controls, menus, feature behavior, or PM-owned product documentation.
Existing Chinese copy for save tone classification and copyable status summary
was moved into a traceable model boundary used by `SaveStateModule` and the
design-interaction smoke proof.

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
| `tools/electron-prototype/experiments/svga-web/web/short-term-macos-feedback-model.mjs` | New feedback model for save banner tone and copyable current-state summary. |
| `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs` | Delegates feedback tone and state-summary construction to the new model. |
| `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` | Adds structure assertions for the feedback model boundary. |

## Requirement Trace

| Area | Trace |
| --- | --- |
| PRD IDs | S2, S14, S16 surfaces are structurally touched through feedback/status summary only. |
| Page states | Load failed, Preview, Compare, Edit reserved, Save validating, Save complete, Save failed. |
| Modules | SaveStateModule, MenuBarCommandModel evidence, design-interaction proof. |
| Components | SaveFeedbackBanner, InlineStatus copy summary. |
| Design-system layer | Separates feedback copy modeling from workflow control and DOM application. |

## Verification

Passed:

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-feedback-model.mjs`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - 29/29 tests passed
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
  - `passed: true`
  - `shortTermDesignInteraction: true`
  - `shortTermDesignInteractionProof: true`

## Non-goals Retained

- No visual styling changes in this slice.
- No new UI copy or product-facing explanatory text.
- No product feature additions.
- No PM-owned product document updates.
- No changes to parsing, optimization, replacement, rename, save, playback, or
  menu behavior.

## Risks And Next Step

The short-term app controller remains large because smoke proof collection and
workflow orchestration still live there. The next low-risk UI/UX step should
extract another bounded model or hidden proof helper, or run a foreground
desktop visual review pass with real production SVGA materials before deeper
visual polishing.
