# Short-Term UI/UX WP6H Right Panel Terminology Review

## Summary

Replaced short-term `inspector` / `检查面板` naming with neutral `rightPanel` / `右侧面板` terminology in the active short-term UI implementation and UI/UX design-system manifest.

This responds to the Owner direction that the short-term app must not be framed as an inspector/checker-style tool. The visible structure and product behavior are unchanged.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit target: UI/UX terminology and token boundary only

## Changed Files

- `DESIGN.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`
- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.page-states.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Main PRD was not modified.
- No product feature, workflow, state, action, or visible information block was added.
- User-facing accessible labels changed from inspection-oriented wording to neutral panel wording.
- Design tokens now use `right-panel` naming for the short-term right-side panel surface and sizing.
- Tests prevent `inspectorPanel`, `检查面板`, `检查标签`, and `检查器` from returning to the short-term page and token/module CSS.

## Verification

- `git diff --check`
- Active short-term UI/UX docs and client files grep clean for `inspector`, `Inspector`, `检查器`, `检查面板`, and `检查标签`.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

Result: all checks passed.

## Risks

- Historical Workbench/P6 documents still contain inspector terminology for their own historical/contracts context. This slice intentionally touched only the active short-term UI/UX design and implementation boundary.
- This is terminology and token hygiene; visual polish remains a separate step.

## Next Steps

- Continue reducing the main app entry by extracting remaining page-state and module orchestration.
- Continue visual polish only inside the existing PRD-defined components and without adding explanatory copy.
