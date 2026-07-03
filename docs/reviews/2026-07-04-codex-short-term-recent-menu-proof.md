# Review: short-term recent menu proof

## 1. Summary
Completed a scoped UI/UX evidence improvement for the short-term macOS client:
`short-term-menu-state-proof` now verifies the actual `File > Recent` submenu
state, not just the existence of the submenu.

This does not change visible menu labels, recent-file behavior, product scope,
or renderer UI. It strengthens S16 evidence for menu record count, path
redaction, empty-state placeholder, and clear-history enablement.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `5fb35dc5`
- Uncommitted changes at review creation:
  - `tools/electron-prototype/experiments/svga-web/main.cjs`
  - `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- Untracked files: none observed before adding this review

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-recent-menu-proof.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Preserve PRD scope and existing S16 recent-file behavior. | Done |
| 2 | Do not add visible copy or menu items. | Done |
| 3 | Prove `File > Recent` record count matches host recent state. | Done |
| 4 | Prove `File > Recent` respects the ten-record menu limit. | Done |
| 5 | Prove recent menu labels remain path-redacted. | Done |
| 6 | Prove clear-history enablement follows recent-state presence. | Done |
| 7 | Do not treat smoke as final visual acceptance. | Done |

## 5. Verification
Commands run and results:
```bash
$ node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
31/31 passed.

$ npm run desktop:smoke
passed=true. shortTermMenuState=true.

$ npm run desktop:short-term:design-system-check
passed=true. Token/component/page-state guardrails remain satisfied.

$ git diff --check
passed.
```

Output spot-check:
```text
short-term-menu-state-proof.json:
passed=true
recentMenu.recordLimit=10
recentMenu.pathRedacted=true
recentMenu.clearEnabled=true
recentMenuRecordCountMatchesState=true
recentMenuRecordLimitRespected=true
recentMenuLabelsPathRedacted=true
recentMenuPlaceholderMatchesEmptyState=true
clearRecentEnabledMatchesState=true
```

## 6. Output inspection
- Product scope: no PRD or PM-owned product document edited.
- Visual surface: no visible menu labels, layout, styling, or renderer copy changed.
- Evidence surface: `short-term-menu-state-proof.json` now records `recentMenu`
  details and fails closed if the macOS menu diverges from recent state.
- Evidence boundary: automated smoke remains regression evidence only; real
  foreground macOS validation with production SVGA files is still required for
  broader UI/UX acceptance.

## 7. Risks
- This strengthens automated menu-state evidence. It does not replace a real
  foreground menu-bar screenshot or owner-visible menu review.
- The proof observes the Electron application menu generated during smoke; it
  does not validate OS-level visual rendering of the menu.

## 8. Next steps
- Continue small UI/UX interaction and design-system slices.
- Prioritize foreground client validation with real production SVGA files
  before claiming visual or interaction acceptance.

## 9. Commit
- Commit: pending
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
