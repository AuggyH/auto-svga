# Review: short-term toolbar control polish

## 1. Summary

This round refined the short-term macOS titlebar controls without changing
product behavior or visible copy.

The titlebar now has dedicated toolbar-control component tokens. The module
uses those tokens to lower the visual weight of secondary titlebar controls and
the mode switch while preserving the primary blue treatment for `打开 SVGA` and
the disabled state for save buttons.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `a82fc12b`
- Uncommitted changes before this review:
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
  - `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- Untracked files before this review: foreground screenshot artifacts under `.artifacts/`

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-toolbar-control-polish.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Do not change product scope, menu structure, visible copy, or feature logic. | Done |
| 2 | Keep toolbar visual changes tokenized through component aliases. | Done |
| 3 | Keep the generic button system unchanged outside the titlebar context. | Done |
| 4 | Preserve primary action styling for `打开 SVGA`. | Done |
| 5 | Add a source guard for toolbar token usage and primary preservation. | Done |
| 6 | Validate with real foreground macOS screenshot evidence. | Done |

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

- Real production SVGA opened from the owner material pool through recent-file
  state:
  `/Users/huangtengxin/Downloads/auto-svga测试物料/未分类/360-6.22/专业团队头像框.svga`
- Intermediate foreground screenshot caught an unacceptable regression where
  the primary toolbar button was visually flattened:
  `.artifacts/product/foreground-ui/2026-07-04/13-real-small-toolbar-token-refinement.png`
- Corrected foreground screenshot after app restart:
  `.artifacts/product/foreground-ui/2026-07-04/14-real-small-toolbar-token-refinement-primary.png`
- The corrected screenshot includes the macOS menu bar, native titlebar/window
  controls, the real foreground client, and a real production SVGA file.

## 7. Risks

- Development-mode macOS still shows `Electron` as the application name in the
  system menu bar. A quick `app.setName` timing retry was ineffective and was
  not committed; this should be handled as a separate host/package identity
  investigation.
- The toolbar is still a custom web-rendered titlebar. Further native-feeling
  refinements should stay narrow and foreground-verified.

## 8. Next steps

- Continue with the next UI/UX slice from real foreground screenshots, likely
  around tab/fact-card density, scrolling comfort, or host identity evidence.

## 9. Commit

- Commit: included in this task commit
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
