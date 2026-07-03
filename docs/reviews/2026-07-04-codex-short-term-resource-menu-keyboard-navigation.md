# Review: short-term resource menu keyboard navigation

## 1. Summary
Completed a scoped UI/UX interaction improvement for the short-term macOS
client: the existing resource-row context menu now supports keyboard movement
with ArrowUp, ArrowDown, Home, and End.

This keeps the current S11/S12 resource actions unchanged. No visible copy,
new product feature, new menu item, or layout change was added.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `5a91e17e`
- Uncommitted changes at review creation:
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos-interaction-model.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
  - `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- Untracked files: none observed before adding this review

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-interaction-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-resource-menu-keyboard-navigation.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Preserve PRD scope and existing resource actions. | Done |
| 2 | Keep context-menu keyboard focus predictable. | Done |
| 3 | Skip disabled menu items during keyboard movement. | Done |
| 4 | Keep visible DOM rendering owned by render modules. | Done |
| 5 | Add regression evidence for menu keyboard navigation. | Done |
| 6 | Do not treat smoke as final visual acceptance. | Done |

## 5. Verification
Commands run and results:
```bash
$ node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
31/31 passed.

$ npm run desktop:smoke
passed=true. shortTermReplacementProof=true.

$ npm run desktop:short-term:design-system-check
passed=true. Token/component/page-state guardrails remain satisfied.

$ git diff --check
passed.
```

## 6. Output inspection
- Product scope: no PRD or PM-owned product document edited.
- Visual surface: no layout, typography, color, copy, or spacing changed.
- Interaction surface: ArrowDown, ArrowUp, Home, and End now move focus inside
  the resource context menu using the existing menu items.
- Smoke proof: replacement flow records menu focus moving from Rename to
  Replace, to Reset, and back to Rename before closing the menu.
- Evidence boundary: automated smoke remains regression evidence only; real
  foreground macOS validation with production SVGA files is still required for
  broader UI/UX acceptance.

## 7. Risks
- This validates renderer keyboard behavior. It does not replace native-window
  foreground review with macOS menu bar/titlebar visible.
- Broader menu discoverability and real-file production-material validation
  remain separate follow-up work.

## 8. Next steps
- Continue with small UI/UX interaction and design-system slices.
- Prioritize real foreground screenshots and multi-material validation before
  claiming visual or interaction acceptance.

## 9. Commit
- Commit: pending
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
