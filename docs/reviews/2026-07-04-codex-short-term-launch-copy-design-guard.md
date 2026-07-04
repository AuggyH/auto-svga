# Codex Review: Short-term Launch Copy Design Guard

Date: 2026-07-04
Agent: Codex
Scope: UI/UX design-system verification guardrail

## Summary

This slice strengthens the short-term design-system check so the launch page
cannot silently regain extra explanatory copy that the Owner removed from the
startup canvas.

The guard keeps the startup hierarchy narrow:

- primary prompt: `拖入 SVGA 文件`
- primary action: `打开文件`
- low-level recent file list

It rejects launch-surface regressions such as `本地预览`, `不上传`,
`仅显示文件名`, and `父级位置` appearing in the launch HTML or launch renderer.

No runtime UI behavior, product logic, product documents, menu structure, or
visible copy was changed in this slice.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this slice: `2cdae3b9 uiux: preserve overview fact density`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
  - Added `launch-page-copy-stays-minimal`.
  - Checks the launch HTML and launch renderer for disallowed extra explanatory
    copy.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Added assertions that the design-system script contains and reports the new
    launch-copy guard.

## Requirement Checks

- Product authority preserved: no change to
  `docs/product/PRODUCT_ROADMAP.md`.
- UI/UX scope preserved: this is a verification guard only.
- Owner copy boundary preserved: no unrequested explanatory launch text may
  return without a deliberate code/test change.
- Design-system execution improved: the documented launch hierarchy is now
  enforced by machine checks, not only by review memory.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.

## Foreground Evidence

Foreground packaged-app validation was attempted through the native Open File
dialog with a real file from
`/Users/huangtengxin/Downloads/auto-svga测试物料/未分类/360-6.22/专业团队头像框.svga`.

The flow still hit macOS Downloads-folder access permission while using the
current packaged app. That remains a real foreground validation blocker until
the Owner chooses the permission response or the product owner/main
implementation owner defines a security-scoped recent-file/bookmark strategy.

This slice therefore does not claim foreground visual or interaction
acceptance. Automated checks remain regression evidence only.

## Risks

- The new guard is intentionally narrow and only protects the launch surface
  against a known copy hierarchy regression.
- It does not validate the complete launch layout visually; real foreground
  screenshots are still needed for final UI/UX acceptance.

## Next Step

Continue strengthening design-system verification around known Owner decisions
while keeping product scope and copy changes out of the UI/UX lane unless the
Owner and product docs explicitly authorize them.
