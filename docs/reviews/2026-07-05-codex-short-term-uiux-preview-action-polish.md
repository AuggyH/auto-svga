# Review: short-term UI/UX preview action polish

## 1. Summary

Aligned the short-term macOS preview surface with the Owner-confirmed
canvas-first direction for metric-level optimization and save-state behavior.

This slice keeps product scope inside the current short-term PRD and does not
modify PM-owned product documents. It focuses on UI behavior and state
presentation:

- Default Preview no longer exposes inactive right-header save controls.
- Metric-level `可优化` entries are actual controls and open the optimization
  detail surface.
- Preview mode returns to the default information surface after leaving a
  transient optimization detail state.
- The duplicate playback/spec metadata pill remains hidden from the visible
  canvas.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `ee9fae51 uiux: capture appearance smoke evidence`
- Uncommitted changes before commit: short-term macOS UI source files listed
  below plus this review file
- Untracked files: foreground screenshot evidence under
  `review/uiux-high-fidelity-packages/foreground-hf10-evidence-20260705/`
  remains local review evidence and is not staged

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-command-state.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-command-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-state.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-event-bindings.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-file-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-output-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-render-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-save-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-state.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `docs/reviews/2026-07-05-codex-short-term-uiux-preview-action-polish.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | S4: default Preview shows compact production-spec status inline and does not duplicate a separate spec module or target thresholds. | Done |
| 2 | S8: optimization entry points live at metric level instead of a persistent top-right summary button. | Done |
| 3 | S10: clicking a metric-level optimization entry replaces the right information surface with optimization detail. | Done |
| 4 | S14: Preview default state does not expose inactive save actions; Save As remains reserved for dirty/output states. | Done |
| 5 | Design execution plan: keep token/component/module structure and do not add one-off visible copy. | Done |
| 6 | Foreground validation: do not rely only on automated smoke screenshots for visual/interaction judgment. | Done |

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
real production SVGA materials from
`/Users/huangtengxin/Downloads/auto-svga测试物料`:

- `review/uiux-high-fidelity-packages/foreground-hf10-evidence-20260705/04-launch-dark-current-fullscreen.png`
- `review/uiux-high-fidelity-packages/foreground-hf10-evidence-20260705/05-preview-dark-warwolf-current-fullscreen.png`
- `review/uiux-high-fidelity-packages/foreground-hf10-evidence-20260705/06-optimization-detail-dark-warwolf-current-fullscreen.png`
- `review/uiux-high-fidelity-packages/foreground-hf10-evidence-20260705/07-preview-after-esc-return-dark-warwolf-fullscreen.png`
- `review/uiux-high-fidelity-packages/foreground-hf10-evidence-20260705/08-preview-dark-bluecar-current-fullscreen.png`

## 6. Output inspection

- Launch: dark canvas-first launch surface with low-emphasis recent files.
- Preview: two real production SVGA files loaded from recent/menu recent flow.
- Right information: default Preview hid inactive header save actions and the
  old playback/spec metadata pill.
- Optimization: metric-level `可优化` opened the optimization detail surface.
- Recovery: `Esc` returned the right surface from optimization detail to default
  Preview information.

## 7. Risks

- Packaged-app foreground launch remains sensitive to macOS Launch Services
  choosing an older local bundle with the same registered identity. This review
  uses dev-start foreground evidence to avoid false visual evidence. Packaging
  identity should be addressed or documented before final owner-visible package
  acceptance.
- The empty optimization detail state still reads more technical than the new
  visual direction prefers. It is a follow-up polish candidate, not expanded in
  this narrow behavior slice.
- Default Preview currently shows optimization markers on every metric reported
  as optimizable by the model. If Product wants only file size and memory to
  expose visible entry buttons, that should be clarified through PM.

## 8. Next steps

- Package the current commit for owner review and retain only the latest three
  UI/UX packages.
- Continue high-fidelity polish on optimization detail empty/result states,
  compare state, edit reserved state, and resource-list density using the same
  foreground validation gate.

## 9. Commit

- Commit: current branch HEAD for `uiux: align preview optimization actions`
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
