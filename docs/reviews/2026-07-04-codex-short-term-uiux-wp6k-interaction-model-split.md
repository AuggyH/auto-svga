# Short-Term UI/UX WP6K Interaction Model Split Review

## Summary

Moved short-term keyboard interaction predicates and tab navigation index logic into a dedicated interaction model module.

This is a structural UI/UX implementation slice. It preserves the existing tab keyboard behavior, resource-row activation behavior, and context-menu keyboard behavior.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit target: UI/UX-only interaction model split

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-interaction-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority remains `docs/product/PRODUCT_ROADMAP.md`; no PM-owned PRD document was modified.
- Scope touched: existing S3/S8 tab navigation, S11/S12 resource-row keyboard access, and S13 text-row keyboard access.
- Components/molecules touched: `RightTabPanel`, `TabItem`, `ReplaceableImageRow`, and `ReplaceableTextRow`.
- Existing keys remain unchanged: ArrowLeft, ArrowRight, Home, End, Enter, Space/Spacebar, ContextMenu, and Shift+F10.
- No product feature, visible information block, UI state, action, label, or explanatory copy was added.

## Verification

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-interaction-model.mjs`
- Keyword guard for previously rejected extra summary/inspection wording
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

Result: all checks passed.

## Risks

- This split does not broaden keyboard coverage; it only gives existing keyboard rules an explicit module boundary.
- Foreground desktop/manual keyboard review with real files remains useful for visual quality and end-to-end feel.

## Next Steps

- Continue extracting owner-visible module logic from `short-term-macos-app.mjs`.
- Keep interaction changes tied to documented S1-S16 states and existing component contracts.
