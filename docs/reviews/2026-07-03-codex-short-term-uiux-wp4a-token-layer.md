# Auto SVGA Short-Term UI/UX WP4A Token Layer Review

Date: 2026-07-03
Owner confirmation: Not yet confirmed for this WP4A implementation slice.
Base checkpoint: 5e1759e8 `uiux: refine short-term macos client shell`
Scope authority: `docs/product/PRODUCT_ROADMAP.md` S1-S16; design-system execution is subordinate to `DESIGN.md` and `docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`.

## Summary

This pass starts the code-side design-system extraction requested by the UI/UX redesign plan.

- Added `short-term-macos.tokens.css` for primitive, semantic, component, and compatibility token aliases.
- Updated the short-term page to load tokens before component/module styles.
- Removed the token definitions from `short-term-macos.css`, leaving that file responsible for component, module, and page-state styling.
- Updated renderer tests so the default client contract now checks the token stylesheet and the page stylesheet separately.

No product scope, SVGA parsing, optimization execution, replacement behavior, save behavior, or menu command behavior changed.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Trace

- PRD IDs touched: S1-S16 visual shell only.
- Page states touched: Launch, Preview Overview, Preview Optimization through shared token loading.
- Modules touched: LaunchModule, PreviewCanvasModule, OverviewTabModule, OptimizationTabModule, ReplaceableElementsTabModule by shared stylesheet dependency only.
- Components touched: token dependencies for WindowToolbar, LaunchDropCanvas, PreviewStage, RightTabPanel, FactCell, AssetRow, OptimizationFindingRow, ReplaceableImageRow.
- Token namespaces touched: primitive color/type/space/radius/motion; semantic surface/text/border/action/status; component toolbar/control/row/thumbnail/inspector.

## Verification

Passed:

- `git diff --check -- tools/electron-prototype/experiments/svga-web/web/index.html tools/electron-prototype/experiments/svga-web/web/short-term-macos.css tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `AUTO_SVGA_PRODUCT_ARTIFACTS=/tmp/auto-svga-uiux-wp4a-20260703/smoke-artifacts npm run desktop:smoke`

Real foreground desktop evidence on the second display:

- `/tmp/auto-svga-uiux-wp4a-real-20260703/01-launch-token-split-active-display2.png`
- `/tmp/auto-svga-uiux-wp4a-real-20260703/02-large-overview-token-split-active-display2.png`
- `/tmp/auto-svga-uiux-wp4a-real-20260703/03-pegasus-optimization-token-split-active-display2.png`

Real SVGA materials sampled:

- `/Users/huangtengxin/Downloads/auto-svga测试物料/头像框/战狼头像框/战狼头像框.svga`
- `/Users/huangtengxin/Downloads/auto-svga测试物料/未分类/已-长凡-SOULIKE-G2026062217303460703032_3b7e14fba5e81822(1)/167971-Royal Pegasus Wings Frame/167971-Royal Pegasus Wings Frame.svga`

## Risks And Next Step

- This is only the token layer. The app still needs follow-up extraction for atoms, molecules, components, modules, and page-state render helpers.
- Some raw layout values remain in component CSS. They should be moved into component tokens in the next WP4 slice when the corresponding component family is extracted.
- Suggested next step: split toolbar/button/tab/row primitives into component-layer CSS modules or clearly bounded sections with traceable `data-component` coverage.
