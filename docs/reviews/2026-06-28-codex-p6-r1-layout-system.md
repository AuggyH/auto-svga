# P6-R1 Deterministic Workbench Layout System

Implementation commit: `3f44c0ec928c0d13f4b1b9ec31dd984e180f5a2d`
Implementation tree: `47eb0240b94da867a325451bd8cd8bcd16728e93`

## Summary

Added a deterministic layout engine under `src/layout/` and refactored the shared product frontend so workspace panel widths, collapse state, responsive mode, and center-region invariants are resolved from one runtime source.

## Requirement Checks

- FULL / COMPACT / MINIMAL mode boundaries are defined at 1280 and 1064.
- Right panel collapses before left panel; center never collapses.
- Left, center, and right min/max constraints match the owner instruction.
- Workspace structural CSS is now guarded so direct `.workspace` grid columns must use layout-engine variables.
- File names, badges, and icon-only button behavior are covered by source rules and layout-mode selectors.

## Verification

- `npm run build` PASS.
- `node --test dist/tests/layout-engine.test.js` PASS, 7/7.
- `node --test tools/shared/product-frontend/source-sharing.test.mjs` PASS, 9/9.
- `node tools/p6/visual-system-audit.mjs --source-only` PASS.
- `node --check tools/shared/product-frontend/product-app.mjs && node --check tools/shared/product-frontend/workbench-layout-engine.mjs && node --check tools/p6/visual-system-audit.mjs` PASS.
- `npm test` PASS, 225/225.
- Background local preview smoke PASS.
- `git diff --check` PASS.

## Risks

- The browser adapter mirrors the TypeScript layout engine for local preview safety; parity is now tested after build.
- Full App smoke was intentionally not run in this layout-only step to avoid disruptive foreground desktop execution.

## Next

Use this as the foundation for future P6-R1 validation, but do not treat it as Product Owner acceptance or terminal `HUMAN_REQUIRED`.
