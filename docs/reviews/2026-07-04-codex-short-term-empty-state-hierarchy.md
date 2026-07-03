# Review: short-term empty state hierarchy

## 1. Summary

This round lowered the visual hierarchy of short-term empty-state text.

The existing `emptyText` atom no longer renders as a dashed bordered card. It
now behaves as a low-hierarchy inline empty hint with transparent background and
tokenized spacing. No product scope, visible copy, command state, or feature
logic changed.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `72f0a56e`
- Uncommitted changes before this review:
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.atoms.css`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
  - `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- Untracked files before this review: foreground screenshot artifacts under `.artifacts/`

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.atoms.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-empty-state-hierarchy.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Do not add or change visible product copy. | Done |
| 2 | Do not alter optimization behavior, save behavior, or command availability. | Done |
| 3 | Keep the change in the existing atom/token design-system layers. | Done |
| 4 | Remove token aliases made unused by this change. | Done |
| 5 | Add a guard so `emptyText` does not return to dashed-card styling. | Done |
| 6 | Validate with a real foreground screenshot as well as automated checks. | Done |

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
- Foreground screenshot after the empty-state hierarchy change:
  `.artifacts/product/foreground-ui/2026-07-04/12-real-small-optimization-emptytext-low-hierarchy.png`
- The optimization empty text now sits as low-hierarchy inline content inside
  the right panel instead of appearing as an additional card-like block.

## 7. Risks

- The foreground screenshot still shows the development Electron host name in
  the macOS menu bar. Code already sets the product display name and menu
  labels, so this needs a separate host identity investigation rather than a
  speculative UI workaround in this slice.
- Broader visual polish is still pending across toolbar rhythm, focus behavior,
  scrolling comfort, and multi-file foreground coverage.

## 8. Next steps

- Continue another narrow UI/UX slice from foreground evidence, keeping product
  scope and visible copy unchanged.

## 9. Commit

- Commit: included in this task commit
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
