# Review: short-term UI/UX launch hierarchy polish

## 1. Summary

Polished the short-term macOS client launch page hierarchy to better match the
Owner-confirmed canvas-first direction. The launch center now treats the drag
copy as a lightweight hint instead of a large title, keeps Open File as the
primary action, and lowers the visual weight of recent-file rows.

No product scope was added. Open, drag-and-drop, recent-file count, recent clear,
and File > Recent behavior are unchanged.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `0faa8e52`
- Uncommitted changes before final commit: implementation and this review file
- Untracked files: foreground screenshot evidence under
  `review/uiux-high-fidelity-packages/foreground-hf16-launch-hierarchy-20260706/`

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-06-codex-short-term-uiux-launch-hierarchy-polish.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Launch remains a single full-window canvas/drop surface. | Done |
| 2 | Open File remains the primary action. | Done |
| 3 | Recent files remain secondary and limited to the existing launch list behavior. | Done |
| 4 | No extra launch explanatory copy is added. | Done |
| 5 | Launch copy stays aligned with the Owner sketch direction. | Done |
| 6 | Light and dark foreground launch screenshots are captured. | Done |

## 5. Verification

Commands run and results:

```bash
npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check
# passed

node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
# 31/31 passed

git diff --check
# passed

npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke
# passed
```

Foreground evidence:

- `review/uiux-high-fidelity-packages/foreground-hf16-launch-hierarchy-20260706/01-launch-current-dev-electron-foreground.png`
- `review/uiux-high-fidelity-packages/foreground-hf16-launch-hierarchy-20260706/02-launch-light-dev-electron-foreground.png`

## 6. Output inspection

- Drag hint copy changed from a large SVGA-specific title to `拖拽文件到此处`.
- Launch prompt typography now uses metadata-sized text with muted color.
- Recent-file list width and row typography were reduced to keep it secondary.
- The slice did not touch SVGA parsing, playback, compare, optimization,
  replaceable preview, save, recent-file state, or menu logic.

## 7. Risks

- Foreground screenshots were captured from the dev Electron wrapper, so the
  macOS menu title is `Electron`; packaged app identity remains covered by the
  package proof generated during packaging.
- The screenshot directory is local review evidence and is not staged as Git
  content.

## 8. Next steps

- Continue high-fidelity polishing on the next owner-visible short-term surface.

## 9. Commit

- Commit: pending final commit
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
