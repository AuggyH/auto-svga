# Review: short-term UI/UX resource and empty-state polish

## 1. Summary

Polished the short-term macOS Preview right information surface without changing
product function:

- Ordinary image resource rows no longer repeat the low-value `图片` badge.
- Resource row text hierarchy is slightly quieter and more native-tool-like.
- Optimization detail empty state now uses a single concise line instead of a
  longer explanatory sentence.

This is a visual/readability polish slice inside the current PRD scope. It does
not add new UI surfaces, product behavior, or PM-owned product documentation.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `31beeaaa uiux: align preview optimization actions`
- Uncommitted changes before commit: short-term macOS resource/optimization UI
  source files and this review file
- Untracked files: foreground screenshot evidence under
  `review/uiux-high-fidelity-packages/foreground-hf10-evidence-20260705/`
  remains local review evidence and is not staged

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-optimization-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-overview-renderers.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-05-codex-short-term-uiux-resource-empty-polish.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | DESIGN.md: remove low-value visible labels and explanatory copy that do not help the approved flow. | Done |
| 2 | S5: resource rows still show thumbnail, key/name, dimensions, file size, and usage count. | Done |
| 3 | S8/S10: optimization detail still exposes summary, disabled batch action, and empty state when no safe items exist. | Done |
| 4 | Design-system execution: use existing token/component layers and avoid one-off visual values. | Done |
| 5 | Foreground validation: verify the visual change in the real macOS client with production SVGA material. | Done |

## 5. Verification

Commands run and results:

```bash
npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check
# passed

node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
# passed: 31/31

git diff --check
# passed

npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke
# passed; product smoke reported "passed": true
```

Foreground desktop evidence was captured from the running Electron client with
real production SVGA material:

- `review/uiux-high-fidelity-packages/foreground-hf10-evidence-20260705/09-preview-dark-bluecar-resource-polish-fullscreen.png`
- `review/uiux-high-fidelity-packages/foreground-hf10-evidence-20260705/10-optimization-empty-copy-polish-fullscreen.png`

## 6. Output inspection

- Resource rows keep the required metadata but remove the repetitive ordinary
  image badge.
- Optimization detail empty copy is concise: `暂无可执行优化项`.
- No new visible helper text, status label, or inactive feature placeholder was
  added.

## 7. Risks

- Sequence, audio, replaceable, and attention badges remain visible by design;
  they should be revisited with real files that contain those cases.
- This slice does not address the broader right-panel visual language, compare
  surface, or edit reserved surface.

## 8. Next steps

- Continue with compare/edit reserved state polish and a broader light/dark
  foreground pass.
- Package the next owner-visible build after this commit if no larger adjacent
  polish batch is added immediately.

## 9. Commit

- Commit: current branch HEAD for `uiux: reduce resource row noise`
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
