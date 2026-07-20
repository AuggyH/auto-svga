# Review: short-term-menu-routing-coverage

## 1. Summary
Added a routing coverage guard for the short-term macOS command menu. The test
now derives menu command ids from the command-menu model and verifies each
current command item has an explicit host, native, or renderer route.

It also checks menu items with macOS native roles remain native-delegated.

## 2. Git state
- Branch: agent/codex/svga-workbench-v1-autonomous
- Commit before work: 54562364 fix: trace short-term command menu to PRD ids
- Uncommitted changes: menu routing coverage test and this review
- Untracked files: docs/research/figma-make-short-term-uiux-prompt.md (unrelated, not staged)

## 3. Changed files
- src/tests/short-term-host-menu-routing.test.ts
- docs/reviews/2026-07-02-codex-short-term-menu-routing-coverage.md

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Every current command-menu item is explicitly classified by host routing. | Done |
| 2 | macOS native role items stay native-delegated. | Done |
| 3 | No temporary UI shell wiring or owner-visible layout changes. | Done |

## 5. Verification
Commands run and results:
```
$ npm run build && node --test dist/tests/short-term-host-menu-routing.test.js dist/tests/short-term-command-menu.test.js dist/tests/short-term-host-actions.test.js
PASS, 30 tests
```

## 6. Risks
- This guard validates menu route coverage, not real Electron menu clicks.
  Runtime click/dispatch evidence remains covered by the host action/session
  tests and should be broadened when the real UI shell is ready.

## 7. Next steps
- Continue tightening short-term host/session contracts and drift guards before
  real UI/UX shell integration.

## 8. Commit
- Commit: recorded in final handoff after commit creation
- Branch: agent/codex/svga-workbench-v1-autonomous
- Tag: none
