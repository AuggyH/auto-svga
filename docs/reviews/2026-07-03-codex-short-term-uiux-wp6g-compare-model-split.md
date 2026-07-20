# Short-Term UI/UX WP6G Compare Model Split Review

## Summary

Moved existing short-term compare view HTML generation out of the main app entry and into a dedicated compare model module.

This is a structural UI/UX implementation step only. It does not add product scope, product-facing copy, new compare states, or new controls.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit target: UI/UX-only slice

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority remains `docs/product/PRODUCT_ROADMAP.md`; no PRD or PM-owned product document was modified.
- Existing compare behavior remains within short-term S10/S14 compare and optimization comparison scope.
- Existing labels and actions were moved without changing user-facing wording.
- No new summary block, explanatory note, status badge, or inspection/checker concept was introduced.
- The split supports the documented design-system direction by reducing the app entry toward page-state orchestration and moving compare-specific rendering into a module boundary.

## Verification

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-model.mjs`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

Result: all checks passed.

## Risks

- This split improves module ownership, but the compare surface still uses HTML string rendering. Further work is needed to continue moving toward tokenized atoms, molecules, modules, and page states.
- Visual polish and foreground macOS screenshot review are still separate follow-up work; this slice only preserves current behavior while improving the implementation boundary.

## Next Steps

- Continue splitting the remaining owner-visible UI surfaces into design-system-aligned modules.
- After structural slices stabilize, run a foreground desktop visual pass with real SVGA materials and macOS window chrome visible.
