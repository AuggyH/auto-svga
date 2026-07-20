# Short-Term UI/UX Asset Row Polish

Date: 2026-07-06
Owner: Codex UI/UX lane

## Summary

Polished the short-term macOS client asset/resource row styling so resource rows use a lighter, more canvas-first list hierarchy while keeping the same data, grouping, and actions.

This is UI/UX-only. It does not change asset parsing, grouping, replaceable classification, optimization behavior, or PRD-owned product documents.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority remains `docs/product/PRODUCT_ROADMAP.md`.
- No PM-owned PRD or scope document was modified.
- No new visible text, status label, helper copy, or interaction was added.
- The `AssetRow`, `SequenceThumbnail`, and `AudioAssetRow` data contract is unchanged.
- Resource row visual values now route through asset-row component tokens and aliases.
- The list boundary remains light and tokenized, avoiding a return to heavy boxed cards.

## Verification

- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `git diff --check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

Foreground desktop validation used the second display and real owner production SVGA materials:

- `review/uiux-high-fidelity-packages/foreground-hf20-asset-row-polish-20260706/03-bluecar-light-resource-row-focus-second-display.png`
- `review/uiux-high-fidelity-packages/foreground-hf20-asset-row-polish-20260706/04-warwolf-dark-resource-row-second-display.png`

## Risks

- This slice only tunes resource-row hierarchy. It does not redesign the full right information surface or replaceable-element rows.
- Foreground screenshots are local review evidence and are not Git assets.

## Next Steps

- Continue high-fidelity polish in small visible slices while preserving product scope and design-system traceability.
- Prioritize surfaces that remain visibly prototype-like: replaceable rows, edit reserved mode, drag-decision overlay, and save/error states.
