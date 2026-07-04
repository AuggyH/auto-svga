# Short-Term UI/UX WP6FC File, Compare, Preview, and Controller Split Review

## Summary

Owner asked to finish the structural refactor before moving into visual polish. This change completes the current UI/UX structure pass by moving short-term macOS entry responsibilities out of `short-term-macos-app.mjs` and into traceable state, controller, file, compare, preview, and smoke-owned modules.

No product scope, PRD, labels, or user-facing feature behavior was intentionally changed.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit target: UI/UX structural refactor only
- Product docs: not modified

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-state.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-file-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-preview-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Entry file is now assembly-only: imports nodes, event binding, action bridge, initial state, app controller, and smoke runner.
- Initial app state moved to `short-term-macos-state.mjs`.
- Cross-surface glue moved to `short-term-macos-controller.mjs`.
- Preview rendering orchestration moved to `short-term-macos-preview-surface.mjs`.
- Open, recent, drop, load, and close source-file flows moved to `short-term-macos-file-surface.mjs`.
- General compare and compare-B host open flows moved to `short-term-macos-compare-surface.mjs`.
- Design-system check now enforces `app-entry-stays-assembly-only` with a 40-line entry limit and exact allowed entry imports.
- Visible DOM ownership remains renderer/surface-bound; controller and entry do not write visible DOM.
- Automated smoke evidence remains regression-only; real foreground macOS screenshot validation is still the required design-facing validation gate for visual/experience acceptance.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-controller.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-state.mjs`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm run desktop:short-term:design-system-check`

## Risks And Notes

- This is structural groundwork, not visual polish.
- No foreground desktop screenshot pass was run for this slice because no visual style or layout behavior was intentionally changed. The foreground validation gate remains mandatory before claiming UI/UX visual acceptance.
- The controller is intentionally a glue layer. Future visual work should change token, atom, molecule, component, module, page-state CSS and focused render/surface modules, not the entry file.
