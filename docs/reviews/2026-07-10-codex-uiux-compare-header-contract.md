# 2026-07-10 Codex UI/UX Compare Header Contract

## Summary

Refined the Compare right-surface header rhythm using the existing R9 Figma
contract. The visible Compare mode header now consumes a tokenized `54px`
header-height contract and the shared subtle right-surface divider.

This is a visual/module contract correction only. It does not change compare
entry, drag decision, playback, file open, save, optimization, or visible copy.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-10-codex-uiux-compare-header-contract.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## Requirement Check

- Product authority remains `docs/product/PRODUCT_ROADMAP.md`.
- The change uses three design inputs together:
  - token source: Compare and right-surface component tokens;
  - component source: R9 Compare loaded right-surface module contract;
  - page source: Compare workbench page state at `1280 x 800`.
- No product-scope addition, new text, inactive control, menu item, or future
  placeholder was introduced.

## Implementation Notes

- Added `--asv-component-compare-mode-header-min-height: 54px`.
- Added `--asv-component-compare-mode-header-divider`, aliased to the existing
  subtle right-panel section divider.
- Applied these tokens to `.compareModeHeader`.
- Added design-system and unit-test checks so the Compare header does not drift
  back into an untracked CSS tweak.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed `36/36`.
- `git diff --check` passed.

No Figma MCP calls were made. Existing R9/R10 packets were sufficient.

No package promotion or foreground screenshot was produced for this micro-WP.
The change should be bundled into the next owner-visible visual review batch.

## Project Retrospective

Effective: expected medium. This tightens Compare right-surface hierarchy
without adding heavy borders or cards, and keeps the change traceable through
tokens and checks.

Cost control: good so far. This was intentionally not validated as a standalone
package or foreground screenshot; it belongs to a larger Compare/Optimization
visual batch.

Lesson: small page-level polish is acceptable only when it consumes an existing
Figma component/page contract and adds a guard. Otherwise it becomes the kind
of ad hoc selector tuning the Owner explicitly rejected.
