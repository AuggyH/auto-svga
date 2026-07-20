# Short-Term UI/UX Replaceable Row Polish

Date: 2026-07-06
Owner: Codex UI/UX lane

## Summary

Polished the short-term macOS client replaceable image and runtime text rows so the replaceable-elements surface reads as a lighter native list instead of an engineering form/table.

This is UI/UX-only. It does not change replaceable classification, runtime replacement behavior, imageKey rename behavior, save behavior, or PRD-owned product documents.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-replaceable-renderers.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority remains `docs/product/PRODUCT_ROADMAP.md`.
- No PM-owned PRD or scope document was modified.
- No new visible text, status label, helper copy, or interaction was added.
- Removed the visible inline rename shortcut helper copy while keeping Enter and Esc behavior tested.
- `ReplaceableImageRow`, `ReplaceableTextRow`, and `InlineTextReplacementInput` data contracts remain unchanged.
- Replaceable-row visual values now route through component tokens and aliases.

## Verification

- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `git diff --check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

Foreground desktop validation used the second display and real owner production SVGA materials:

- `review/uiux-high-fidelity-packages/foreground-hf21-replaceable-row-polish-20260706/01-gift-light-replaceable-row-second-display.png`
- `review/uiux-high-fidelity-packages/foreground-hf21-replaceable-row-polish-20260706/02-banner-dark-replaceable-row-second-display.png`
- `review/uiux-high-fidelity-packages/foreground-hf21-replaceable-row-polish-20260706/03-banner-dark-rename-row-no-shortcut-copy-second-display.png`

## Risks

- This slice only tunes row hierarchy and removes one helper line. It does not redesign the resource context menu or replacement image picker.
- Foreground screenshots are local review evidence and are not Git assets.

## Next Steps

- Continue high-fidelity polish in small visible slices while preserving product scope and design-system traceability.
- Candidate next surfaces: drag-decision overlay, save/error states, or Edit reserved mode.
