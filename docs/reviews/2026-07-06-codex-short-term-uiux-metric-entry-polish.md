# Short-Term UI/UX Metric Entry Polish

Date: 2026-07-06
Owner: Codex UI/UX lane

## Summary

Polished the short-term macOS client metric-level optimization entry so the visible "可优化" affordance reads as a compact native action pill instead of an engineering-style text label.

This is UI/UX-only. It does not change optimization scope, detection logic, save behavior, or PRD-owned product documents.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-render-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority remains `docs/product/PRODUCT_ROADMAP.md`.
- No PM-owned PRD or scope document was modified.
- The metric entry is traced as `data-component="MetricOptimizationEntry"`.
- Visual values route through component tokens and aliases before CSS use.
- No extra visible copy, status text, or explanatory label was added.
- Existing metric-level optimization interaction remains `data-action="open-optimization"`.

## Verification

- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `git diff --check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

Foreground desktop validation used the second display and real owner production SVGA materials:

- `review/uiux-high-fidelity-packages/foreground-hf19-metric-entry-20260706/02-bluecar-light-metric-entry-second-display.png`
- `review/uiux-high-fidelity-packages/foreground-hf19-metric-entry-20260706/03-warwolf-dark-metric-entry-second-display.png`

## Risks

- This slice only improves the metric action affordance. It does not attempt broader right-panel layout redesign or canvas framing changes.
- Foreground screenshots are local review evidence and are not Git assets.

## Next Steps

- Continue high-fidelity polish in small visible slices, using second-display foreground validation for owner-visible UI judgment.
- Keep product-scope changes routed through PM review instead of direct PRD edits from the UI/UX lane.
