# Review: short-term UI/UX edit reserved polish

## 1. Summary

Polished the short-term Edit reserved state so it matches the Owner-confirmed
boundary: show the layer list, keep the right operation area present, and avoid
inactive controls or explanatory filler.

Changes:

- Removed repeated `图层资源` / `层` labels from Edit layer rows.
- Removed the visible right-panel placeholder sentence.
- Kept the `ReservedOperationPanel` component boundary intact as an empty
  reserved surface.

No product behavior or PM-owned product document was changed.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `feca2320 uiux: reduce resource row noise`
- Uncommitted changes before commit: Edit reserved HTML/rendering/test/CSS files
  plus this review file
- Untracked files: foreground screenshot evidence under
  `review/uiux-high-fidelity-packages/foreground-hf10-evidence-20260705/`
  remains local review evidence and is not staged

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-edit-reserved-renderers.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-05-codex-short-term-uiux-edit-reserved-polish.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Short-term Edit mode may show only the left layer list. | Done |
| 2 | Right operation panel remains reserved and does not expose inactive controls. | Done |
| 3 | No unapproved explanatory text or placeholder copy is added. | Done |
| 4 | Design-system structure and component boundary remain traceable. | Done |
| 5 | Foreground validation uses real production material in the macOS client. | Done |

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

Foreground desktop evidence:

- `review/uiux-high-fidelity-packages/foreground-hf10-evidence-20260705/11-edit-reserved-minimal-polish-fullscreen.png`

## 6. Output inspection

- Edit left panel shows thumbnails and layer names only.
- Right operation panel is visually present but empty.
- No inactive advanced controls, placeholder sentence, or repeated technical
  labels appear in Edit reserved state.

## 7. Risks

- Edit mode is still a reserved state, not a complete editing experience.
- Layer ordering and semantic layer names are only as good as the current parsed
  SVGA asset model; no new editing logic was added.

## 8. Next steps

- Continue compare surface polish and light/dark foreground checks.
- Package the next build after the adjacent compare/edit polish batch is
  complete.

## 9. Commit

- Commit: current branch HEAD for `uiux: simplify edit reserved state`
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
