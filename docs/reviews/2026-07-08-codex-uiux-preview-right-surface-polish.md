# UI/UX Preview Right Surface Polish

Date: 2026-07-08
Agent: Codex
Branch: `agent/codex/short-term-preview-qa-20260708`
Status: committed and promoted to local stable

## Summary

Refined the short-term Preview default right information surface without changing
product scope, visible copy, DOM structure, or feature logic.

The change keeps the Owner-confirmed canvas-first direction: the center canvas
remains primary, and the right side reads more like a quiet state-driven
information area instead of an engineering panel.

## Product Authority

- Authority: `docs/product/PRODUCT_ROADMAP.md`
- Supporting UI inputs:
  - `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
  - `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`
  - `DESIGN.md`
- Scope alignment:
  - Preview remains the default complete product mode.
  - No visible Open Another File control was added.
  - No production-spec threshold values were added to default Preview.
  - No new labels, explanatory copy, or feature entry points were added.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`

## UI Changes

- Softened the right-panel separator token.
- Reduced right-surface section rhythm from a heavier module cadence to a
  quieter information-surface cadence.
- Moved section divider styling behind a component token instead of a raw module
  border declaration.
- Tightened the fact-grid row and column rhythm while keeping the existing
  two-column information density.
- Softened metric-level optimization pill fill and border intensity.
- Tightened resource row spacing slightly while preserving the existing list
  contract and transparent hover state.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/short-term-playback-fit.test.mjs` passed: 2/2.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed: 33/33.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke` passed.
- `git diff --check` passed.

## Foreground Evidence

Foreground owner-visible evidence was collected from the promoted local stable
app at `/Users/huangtengxin/Applications/Auto SVGA.app`.

Evidence path:

- `review/uiux-current-client-evidence-20260708/stable-after-right-surface-preview-final-display2.png`

Foreground resource scope:

- Auto SVGA owner local stable app
- display/workspace screenshot
- macOS menu bar and native window chrome

No Finder dialog, browser, clipboard, or system dialog interaction was required
for this visual-only pass. The app was moved to the secondary display before
capture. A real recent SVGA record, `战狼头像框.svga`, was opened without using
the Finder/Open dialog.

## Risks

- This is a small visual refinement, not a full high-fidelity completion pass.
- This pass only captured one real production material in Preview. Broader
  foreground coverage across more real materials remains for a larger visual QA
  bundle.

## Project Retrospective

This slice intentionally avoided changing tests for tiny visual preferences.
When a style adjustment collided with an existing exact-token test, the
low-value hover and fact-height changes were kept or reverted according to the
existing contract rather than broadening the review scope. This preserved the
project rule that small UI/UX polish should be bundled by surface while staying
cheap to validate.

Token usage source: unavailable in local tooling.
