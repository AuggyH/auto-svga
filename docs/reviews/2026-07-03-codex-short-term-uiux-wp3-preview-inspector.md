# Auto SVGA Short-Term UI/UX WP3 Preview Inspector Review

Date: 2026-07-03
Owner confirmation: Not yet confirmed for this WP3 polish pass. Previous Owner confirmation covered that the short-term layout skeleton was basically established.
Head at review time: f89ed046
Branch: agent/codex/svga-workbench-v1-autonomous

## Summary

This pass improves the short-term macOS client visual hierarchy and interaction discoverability without changing product scope or SVGA processing logic.

- Tightened inspector tabs into a native-like segmented control treatment.
- Reworked file fact cells so production-spec status is visually scannable: pass, warning, and fail states now map to semantic tokenized surfaces.
- Made optimization findings clearer by separating summary, estimated impact, and disposition badge.
- Changed the optimization primary action copy to `一键优化` and clarified the no-safe-item empty state.
- Added a visible per-row `操作` button for replaceable resources, reusing the existing resource context menu.
- Reduced repeated list/card heaviness with softer row surfaces and tokenized semantic badge backgrounds.

## Scope Boundary

Changed UI implementation files:

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.css`

Not changed in this pass:

- Product scope and PRD authority documents.
- SVGA parsing, optimization execution, save/export, or replacement logic.
- Main-process menu semantics, except where already present from previous work.
- PM-owned documentation.

The working tree already contained unrelated product/main-program/doc changes before this WP3 pass. They remain out of scope for this review.

## Real Desktop Evidence

Primary evidence used real foreground Electron desktop windows on the second display, with macOS titlebar and active macOS menu bar visible. Test records were temporarily written to App Support recent-file stores and restored afterward.

Screenshot evidence directory:

- `/tmp/auto-svga-uiux-real-wp3-post-20260703/`

Key active-menu screenshots:

- `08-launch-active-menu-real-foreground-display2.png`: launch canvas, single-column recent list, Electron active menu bar.
- `09-large-overview-active-menu-real-foreground-display2.png`: large real SVGA, fail/pass production-spec hierarchy visible.
- `10-pegasus-optimization-active-menu-real-foreground-display2.png`: optimization findings, `一键优化`, safe vs review dispositions.
- `11-pegasus-replaceable-active-menu-real-foreground-display2.png`: replaceable list with explicit row operation buttons.
- `12-pegasus-row-action-menu-active-menu-real-foreground-display2.png`: row operation button opens the existing rename/replace/reset menu.

Real SVGA materials sampled:

- `/Users/huangtengxin/Downloads/auto-svga测试物料/未分类/360-6.22/专业团队头像框.svga`
- `/Users/huangtengxin/Downloads/auto-svga测试物料/头像框/战狼头像框/战狼头像框.svga`
- `/Users/huangtengxin/Downloads/auto-svga测试物料/未分类/已-长凡-SOULIKE-G2026062217303460703032_3b7e14fba5e81822(1)/167971-Royal Pegasus Wings Frame/167971-Royal Pegasus Wings Frame.svga`

## Verification

Passed:

- `git diff --check -- tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs tools/electron-prototype/experiments/svga-web/web/short-term-macos.css docs/reviews/2026-07-03-codex-short-term-uiux-wp3-preview-inspector.md`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `AUTO_SVGA_PRODUCT_ARTIFACTS=/tmp/auto-svga-uiux-wp3-20260703/smoke-artifacts npm run desktop:smoke`

Desktop smoke is treated only as functional regression evidence. UI/UX judgment for this pass is based on the real foreground screenshots above.

## Notes And Risks

- The current development app still appears as `Electron` in the macOS app menu. This was observed in active-menu screenshots and remains a packaging/app-identity issue, not a WP3 inspector UI change.
- The UI is visually improved but still not a final high-fidelity design system implementation. The code is still largely CSS/DOM-driven rather than fully token -> atom -> molecule -> component modules.
- The large `战狼头像框.svga` sample can exceed production specs while exposing no safe optimization candidates. The UI now clarifies the no-safe-item state, but product logic still decides what is optimizable.
- The new row `操作` button is a discoverability improvement only. It intentionally reuses the existing context menu actions and does not add replacement capability.

## Suggested Next Step

Proceed to a focused WP4 UI-system extraction pass: split repeated inspector/list/button/status primitives into documented component layers while keeping behavior unchanged and continuing real foreground desktop validation.
