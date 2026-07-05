# Review: short-term UI/UX settings sheet polish

## 1. Summary

Polished the short-term macOS client Settings sheet so the approved appearance
choices render as a compact segmented radio control instead of a plain
engineering-style radio list. The slice keeps the product scope unchanged:
Settings exposes only Follow System, Light, and Dark, and remains reachable from
the macOS menu instead of the main canvas.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `a6a1f508`
- Uncommitted changes before final commit: implementation and this review file
- Untracked files: foreground screenshot evidence under
  `review/uiux-high-fidelity-packages/foreground-hf15-settings-sheet-20260705/`

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-05-codex-short-term-uiux-settings-sheet-polish.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Respect PRD scope: Settings sheet exposes only Follow System, Light, and Dark. | Done |
| 2 | Keep appearance selection in macOS menu / Settings sheet, not on the main canvas. | Done |
| 3 | Use design-system structure and canonical component traceability. | Done |
| 4 | Avoid extra explanatory copy or unapproved settings. | Done |
| 5 | Preserve light and dark appearance switching. | Done |
| 6 | Use real foreground desktop screenshots for visual judgment. | Done |

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

- `review/uiux-high-fidelity-packages/foreground-hf15-settings-sheet-20260705/02-settings-sheet-light-dev-electron-foreground.png`
- `review/uiux-high-fidelity-packages/foreground-hf15-settings-sheet-20260705/04-settings-sheet-light-dev-electron-valid-foreground.png`
- `review/uiux-high-fidelity-packages/foreground-hf15-settings-sheet-20260705/05-settings-sheet-light-selected-dev-electron-foreground.png`

## 6. Output inspection

- Settings sheet uses `SettingsSheet` plus `ThemeSegmentedControl`.
- Appearance options remain real radio inputs for keyboard/focus behavior.
- The settings panel no longer inherits the colored status strip used by
  warning/info dialogs.
- The slice did not touch SVGA parsing, playback, optimization, save, compare,
  or replaceable-resource logic.

## 7. Risks

- Foreground screenshots were captured from the dev Electron wrapper, whose
  macOS app menu title is `Electron`; packaged app identity still needs package
  validation evidence after the final package is generated.
- The screenshot directory is local review evidence and is not staged as Git
  content.

## 8. Next steps

- Continue high-fidelity polishing on the next owner-visible surface after this
  settings slice is packaged and committed.

## 9. Commit

- Commit: pending final commit
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
