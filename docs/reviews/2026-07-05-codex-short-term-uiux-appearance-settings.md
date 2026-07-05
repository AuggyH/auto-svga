# Review: short-term UI/UX appearance settings

## 1. Summary
This WP implements the short-term client's approved Appearance And Settings
scope. The client now exposes Settings from the macOS application menu and
Appearance from the View menu. The Settings sheet contains only Follow System,
Light, and Dark, and the app applies those choices through the existing
token-driven short-term UI.

No PM-owned product docs were changed.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `5af4e540`
- Uncommitted changes before commit: short-term UI/UX implementation and proof
  updates listed below.
- Untracked files before review creation:
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos-appearance-model.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos-settings-surface.mjs`

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-action-bridge.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-appearance-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-command-state.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-command-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-event-bindings.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-nodes.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-settings-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-runner.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-state.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Light and dark appearance are supported by the short-term client. | Done |
| 2 | Appearance switching is available from the macOS menu, not a main-surface toolbar button. | Done |
| 3 | Settings sheet exposes only Follow System, Light, and Dark. | Done |
| 4 | Appearance state is synchronized through the command/menu model. | Done |
| 5 | Forced Light overrides system dark tokens, forced Dark applies dark tokens, Follow System restores system behavior. | Done |
| 6 | Settings sheet is represented as a canonical design-system component and uses tokenized styles. | Done |
| 7 | Owner-visible real foreground macOS screenshot validation. | Not done in this WP; remains required before broader visual acceptance. |

## 5. Verification
Commands run and results:
```
$ npm run desktop:short-term:design-system-check
passed

$ node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
31/31 tests passed

$ npm run desktop:smoke
passed, shortTermDesignInteractionProof=true, shortTermMenuState=true

$ git diff --check
passed
```

Proofs inspected:
```
.artifacts/product/short-term/short-term-design-interaction-proof.json
passed=true
settingsSheetAvailable=true
appearanceSwitchingWorks=true
appearanceMenuStateSynced=true
noMainSurfaceAppearanceButton=true

.artifacts/product/short-term/short-term-menu-state-proof.json
passed=true
appearance=system
settingsMenuAvailable=true
appearanceMenuExists=true
systemAppearanceCheckedMatchesState=true
lightAppearanceCheckedMatchesState=true
darkAppearanceCheckedMatchesState=true
```

## 6. Output inspection
- `SettingsSheet` exists in `web/index.html` and contains only the approved
  appearance choices.
- `short-term-macos-appearance-model.mjs` owns normalization, persistence, and
  color-scheme mapping.
- `short-term-macos-settings-surface.mjs` owns applying the selected
  appearance, synchronizing radio controls, and opening/closing the sheet.
- `main.cjs` adds the macOS app menu Settings item and View > Appearance radio
  menu.
- Smoke screenshots remain automated regression evidence only. They do not
  replace a real foreground client pass with macOS titlebar/menu chrome and
  real production SVGA files.

## 7. Risks
- This WP validates theme switching behavior through automated smoke and token
  checks, not by a final foreground visual review of dark mode.
- The Settings sheet is intentionally minimal. Additional settings remain out
  of scope unless promoted by Product Owner and PM.

## 8. Next steps
- Continue the short-term UI/UX visual pass with real foreground desktop
  validation when reaching a broader visual checkpoint.
- Keep future settings changes routed through the same appearance model and
  command/menu state boundary.

## 9. Commit
- Commit: this commit (`uiux: add short-term appearance settings`)
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
