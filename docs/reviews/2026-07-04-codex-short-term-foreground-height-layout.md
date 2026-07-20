# Review: short-term foreground height layout

## 1. Summary

This round fixed a real foreground macOS layout issue in the short-term client:
after opening a production SVGA file, the preview workspace only occupied the
upper part of the window and left a large empty workbench area below.

The fix keeps product behavior and visible copy unchanged. It only makes the
preview, compare, and edit workspace rows explicitly fill the available app
height, with a static guard so this layout does not regress.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `260efdc4`
- Uncommitted changes before this review:
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.page-states.css`
  - `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- Untracked files before this review: foreground screenshot artifacts under `.artifacts/`

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.page-states.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-foreground-height-layout.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Do not change product scope, visible copy, menu structure, or feature logic. | Done |
| 2 | Keep the fix in the page-state layout layer of the design system. | Done |
| 3 | Preserve the existing two-column file fact grid and right-panel content model. | Done |
| 4 | Add a regression guard for explicit workspace row placement and height fill. | Done |
| 5 | Validate with real foreground macOS screenshots, not smoke evidence only. | Done |

## 5. Verification

```text
npm run desktop:short-term:design-system-check
passed

node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs --test-name-pattern "default Electron renderer is the short-term macOS client"
passed

npm run desktop:smoke
passed
```

## 6. Output inspection

- Real production SVGA opened from the owner material pool:
  `/Users/huangtengxin/Downloads/auto-svga测试物料/未分类/360-6.22/专业团队头像框.svga`
- Foreground screenshot before the fix showed the workspace content ending in
  the upper part of the Electron window:
  `.artifacts/product/foreground-ui/2026-07-04/09-real-small-optimization-foreground.png`
- Foreground screenshot after restart and fix, overview tab:
  `.artifacts/product/foreground-ui/2026-07-04/10-real-small-overview-filled-height.png`
- Foreground screenshot after restart and fix, optimization tab:
  `.artifacts/product/foreground-ui/2026-07-04/11-real-small-optimization-filled-height.png`
- The after screenshots include the macOS menu bar, native titlebar/window
  controls, and the real desktop foreground context.

## 7. Risks

- This fixes the height-fill layout defect only. Broader visual polish, focus
  order, scrolling comfort, and real-file coverage still need additional
  focused slices.
- Smoke evidence remains useful for regression, but it is not owner-visible
  macOS UI/UX acceptance.

## 8. Next steps

- Continue with another narrow UI/UX slice against real foreground screenshots,
  while keeping product scope and visible copy unchanged unless Owner and PM
  explicitly approve otherwise.

## 9. Commit

- Commit: included in this task commit
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
