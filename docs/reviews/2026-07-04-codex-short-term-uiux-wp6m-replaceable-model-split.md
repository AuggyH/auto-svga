# Short-Term UI/UX WP6M Replaceable Model Split Review

## Summary

Moved replaceable-image list state, summary copy, empty copy, and selection/rename-cancel calculation into a dedicated short-term replaceable model module.

This is a structural UI/UX implementation slice for S7/S12. It keeps existing replaceable-image behavior and copy unchanged.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit target: UI/UX-only S7/S12 replaceable model split

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-replaceable-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority remains `docs/product/PRODUCT_ROADMAP.md`; no PM-owned PRD document was modified.
- Scope touched: S7 replaceable-element classification display and S12 replaceable-image preview selection state.
- Components/modules touched: `ReplaceableImageRow` and `ReplaceableElementsTabModule`.
- Existing labels, empty-state copy, summary copy, selection behavior, and rename-cancel behavior were moved without rewriting.
- No product feature, visible information block, UI state, action, label, or explanatory copy was added.

## Verification

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-replaceable-model.mjs`
- Keyword guard for previously rejected extra summary/inspection wording
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

Result: all checks passed.

## Risks

- This split does not change the underlying replaceable-element classifier or image replacement workflow.
- Further extraction around rename/replacement should be handled carefully because those paths produce persisted SVGA bytes.

## Next Steps

- Continue extracting side-effect-free module state from `short-term-macos-app.mjs`.
- Keep persisted byte-edit flows behind existing validation and smoke coverage.
