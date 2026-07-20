# Short-term UI/UX Preview Right Surface Empty-State Polish Review

## Summary

UI/UX lane softened the Preview right information surface without changing product behavior. Empty `imageKey` and `运行时文本` sections now expose a traceable `data-empty` state for styling, while keeping the Owner-approved minimal-copy rule: no extra explanatory empty-state text is added.

Resource-list row separators now use the subtler semantic border token so dense asset rows feel less like an engineering table and more like a native macOS information surface.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base HEAD before this slice: `e5290bf2 uiux: refine launch page hierarchy`
- Scope: UI/UX lane, Preview right information surface polish
- Product authority checked: `docs/product/PRODUCT_ROADMAP.md`
- Design authority checked: `DESIGN.md`, `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`, `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-replaceable-renderers.mjs`
  - Adds `data-empty` state to replaceable image and runtime text sections.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
  - Lowers visual emphasis for empty replaceable/runtime text sections.
  - Applies subtle semantic border color to asset rows.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
  - Slightly reduces the global subtle-border strength.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Guards the empty-state hooks and module selectors.
  - Keeps the regression guard against reintroducing unapproved empty-state copy.

## Requirement Checks

- S3/S4/S5/S7/S13 scope remains display-only in this slice.
- No PRD or PM-owned product document was changed.
- No new product behavior, parsing logic, save behavior, playback logic, or menu behavior was added.
- No additional helper/explanatory copy was added to the owner-visible UI.
- The approved compact file-information structure remains intact.
- Empty replaceable/runtime text sections remain visible through heading/count context and reduced visual emphasis only.
- Styling uses existing semantic design tokens and component/module CSS boundaries.

## Verification

- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke` passed.
- `git diff --check` passed.

## Foreground Evidence

Foreground desktop-client screenshots with real production SVGA files were captured under:

- `review/uiux-high-fidelity-packages/foreground-hf17-working-20260706/03-preview-warwolf-current.png`
- `review/uiux-high-fidelity-packages/foreground-hf17-working-20260706/06-preview-bluecar-after-polish.png`
- `review/uiux-high-fidelity-packages/foreground-hf17-working-20260706/07-preview-bluecar-after-polish-light.png`
- `review/uiux-high-fidelity-packages/foreground-hf17-working-20260706/08-preview-warwolf-after-polish-light.png`

Real materials used:

- `/Users/huangtengxin/Downloads/auto-svga测试物料/头像框/战狼头像框/战狼头像框.svga`
- `/Users/huangtengxin/Downloads/auto-svga测试物料/头像框/蓝色豪车头像框/蓝色豪车头像框.svga`

## Risks

- This is a small polish slice, not the final high-fidelity completion.
- The visual improvement is intentionally subtle because it is constrained to the right information surface and avoids adding unapproved copy or behavior.
- Foreground evidence proves this slice only; broader high-fidelity acceptance still requires continued page-state and multi-size review.

## Next Steps

- Continue high-fidelity polish against the current canvas-first direction.
- Keep pairing smoke/design-system checks with real foreground desktop screenshots for meaningful visual changes.
- Avoid expanding product scope unless PM updates the main PRD.
