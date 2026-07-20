# Short-Term UI/UX WP6L Text Model Split Review

## Summary

Moved runtime text preview selection, default input, overlay copy, and list summary rules into a dedicated short-term text model module.

This is a structural UI/UX implementation slice for S13. It keeps existing runtime text preview behavior and copy unchanged.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit target: UI/UX-only S13 text model split

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-text-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority remains `docs/product/PRODUCT_ROADMAP.md`; no PM-owned PRD document was modified.
- Scope touched: S13 runtime replaceable text preview.
- Components/modules touched: `ReplaceableTextRow`, runtime text preview actions, and text preview summary state.
- Existing text preview behavior remains runtime-only and does not imply persisted SVGA-byte text editing.
- Existing labels, defaults, empty-state copy, and overlay copy were moved without rewriting.
- No product feature, visible information block, UI state, action, label, or explanatory copy was added.

## Verification

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-text-model.mjs`
- Keyword guard for previously rejected extra summary/inspection wording
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

Result: all checks passed.

## Risks

- This split does not change the modal/dialog interaction itself; it only extracts runtime text model calculations.
- Foreground desktop review with real text-capable SVGA files remains useful for final visual quality.

## Next Steps

- Continue extracting short-term app module logic while keeping S1-S16 behavior stable.
- Treat any runtime text workflow expansion as product scope, not UI-only cleanup.
