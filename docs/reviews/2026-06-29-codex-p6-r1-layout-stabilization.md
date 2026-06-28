# P6-R1 Layout Stabilization

## Summary

Removed residual duplicated layout behavior outside `layoutEngine`.

This follow-up keeps the layout engine as the only place that names workbench
layout modes, collapse decisions, panel sizing, and right-panel presentation.
The UI now receives only render props required to apply engine output.

## Changed Files

- `src/layout/layoutAdapter.ts`
- `src/tests/layout-engine.test.ts`
- `tools/shared/product-frontend/product-app.mjs`
- `tools/shared/product-frontend/product-styles.css`

## Requirement Checks

- Removed DOM `data-layout-mode` and `data-presentation` output.
- Removed CSS mode-specific structural switching for `COMPACT_WORKBENCH` and `MINIMAL_WORKBENCH`.
- Removed UI evidence checks that made mode-based visibility decisions.
- Removed unused adapter exposure of `layoutMode` and `rightPresentation`.
- Kept Electron/Web capture viewport sizing unchanged because it controls host window and evidence capture dimensions, not product panel collapse or workbench layout decisions.

## Verification

- `npm run build` PASS
- `node --test dist/tests/layout-engine.test.js` PASS, 8/8
- `node --test tools/shared/product-frontend/source-sharing.test.mjs` PASS, 7/7
- `node tools/p6/visual-system-audit.mjs --source-only` PASS
- `node --check tools/shared/product-frontend/product-app.mjs` PASS
- `npm test` PASS, 226/226
- Local Web preview static smoke PASS
- `git diff --check` PASS

## Regression Boundary

- No exporter changes.
- No main Web player replacement.
- No CLI default flow changes.
- No import, drag-drop, comparison, dependency, lockfile, Electron runtime, or packaging implementation changes.

## Risks

- This removes CSS fallback behavior that previously reacted directly to layout mode attributes. Any future visual change should still route the decision through `layoutEngine` and only expose render props needed by the UI.
