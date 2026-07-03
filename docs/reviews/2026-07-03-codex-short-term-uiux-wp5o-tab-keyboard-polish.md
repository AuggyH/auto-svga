# Short-term UI/UX WP5O Tab Keyboard Polish Review

Date: 2026-07-03
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`
Base before change: `c118b2b7 uiux: polish short-term inspector navigation`

## Summary

This slice improves the short-term right inspector tab interaction without
changing product behavior.

The inspector now treats its tab buttons as traceable `TabItem` molecules with
native-feeling keyboard behavior:

- Tabs carry `data-component="TabItem"` for design-system traceability.
- The tablist declares horizontal orientation.
- Only the active tab is in the sequential tab path.
- `ArrowRight`, `ArrowLeft`, `Home`, and `End` move selection and focus through
  the existing `setTab` path.
- `setTab` now keeps visual selection, `aria-selected`, and `tabIndex` in sync.

## Git State

Expected changed files for this review:

- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-03-codex-short-term-uiux-wp5o-tab-keyboard-polish.md`

## Requirement Checks

- Product authority remains `docs/product/PRODUCT_ROADMAP.md`.
- This change stays inside short-term S1-S16 UI surfaces.
- It supports the design-system `RightTabPanel` / `TabItem` keyboard-proof
  expectation without adding new product scope.
- PM's 2026-07-03 AE bridge / mid-term PRD additions were intentionally not
  implemented or interpreted in this UI/UX slice.
- No PM-owned product documents were modified.
- No parsing, optimization, replacement, save, menu, recent-file, or packaging
  logic was changed.
- No foreground desktop client review was run because the Owner currently has
  one monitor and asked to avoid foreground interruption.

## Verification

Passed:

- `git diff --check -- tools/electron-prototype/experiments/svga-web/web/index.html tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
- `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac`

Note: a first test run failed because the new static assertion over-escaped the
tablist selector. The implementation was unchanged; the assertion was corrected
and the full test command passed.

## Risks

- This adds static and hidden-smoke coverage, but not a new persisted smoke
  artifact for tab keyboard navigation. Adding a new `shortTermTabKeyboardProof`
  would require extending the main-process proof whitelist and should be a
  separate evidence-system slice.
- Hidden smoke evidence does not replace a later foreground macOS usability
  review with the real titlebar and menu bar.
- The package proof manifest records the pre-commit HEAD, so final packaged-app
  acceptance still belongs to the integration coordinator.

## Next Steps

- Consider a dedicated UI interaction evidence slice for tab keyboard proof and
  focus-order proof if the proof whitelist is being extended.
- Otherwise continue with another bounded visual hierarchy or interaction
  polish slice that avoids product logic changes.
